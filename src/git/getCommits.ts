import type {GitCommit} from './types.js';
import {runGit} from './runGit.js';

const FIELD_SEPARATOR = '\x1f';
const RECORD_SEPARATOR = '\x1e';

export async function getCommits(
  refs: string[],
  options: {cwd?: string; maxCount?: number; firstParent?: boolean} = {},
): Promise<GitCommit[]> {
  if (refs.length === 0) return [];

  const format = ['%H', '%h', '%P', '%D', '%an', '%at', '%s'].join('%x1f') + '%x1e';
  const traversalArgs = options.firstParent ? ['--first-parent'] : [];

  const output = await runGit(
    [
      'log',
      '--topo-order',
      '--date-order',
      ...traversalArgs,
      `--max-count=${options.maxCount ?? 500}`,
      `--pretty=format:${format}`,
      ...refs,
    ],
    options.cwd,
  );

  const commits = output
    .split(RECORD_SEPARATOR)
    .map(record => record.trim())
    .filter(Boolean)
    .map(record => {
      const [hash, shortHash, parents, refsText, author, timestamp, subject] =
        record.split(FIELD_SEPARATOR);

      return {
        hash: hash ?? '',
        shortHash: shortHash ?? '',
        parents: parents ? parents.split(' ').filter(Boolean) : [],
        refs: refsText
          ? refsText.split(',').map(ref => ref.trim()).filter(Boolean)
          : [],
        author: author ?? '',
        timestamp: Number(timestamp ?? 0),
        subject: subject ?? '',
      } satisfies GitCommit;
    });

  // Parents outside the visible revision set would create dangling graph lanes.
  // Filtering them also makes --first-parent useful as a focused branch view:
  // merged side branches disappear, while a selected parent ref can still be drawn.
  const visibleHashes = new Set(commits.map(commit => commit.hash));

  return commits.map(commit => ({
    ...commit,
    parents: commit.parents.filter(parent => visibleHashes.has(parent)),
  }));
}
