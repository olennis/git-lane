import type {CommitStats, GitCommit} from './types.js';
import {runGit} from './runGit.js';

const FIELD_SEPARATOR = '\x1f';
const RECORD_SEPARATOR = '\x1e';

export function parseShortStat(text: string): CommitStats | undefined {
  const files = /(\d+) files? changed/.exec(text);
  if (!files) return undefined;

  return {
    filesChanged: Number(files[1]),
    insertions: Number(/(\d+) insertions?\(\+\)/.exec(text)?.[1] ?? 0),
    deletions: Number(/(\d+) deletions?\(-\)/.exec(text)?.[1] ?? 0),
  };
}

export async function getCommits(
  refs: string[],
  options: {cwd?: string; maxCount?: number; firstParent?: boolean} = {},
): Promise<GitCommit[]> {
  if (refs.length === 0) return [];

  // The separator leads each record because --shortstat prints its summary after the
  // formatted fields, so the stat line stays inside the record it belongs to.
  const format = '%x1e' + ['%H', '%h', '%P', '%D', '%an', '%at', '%s'].join('%x1f');
  const traversalArgs = options.firstParent ? ['--first-parent'] : [];

  const output = await runGit(
    [
      'log',
      '--topo-order',
      '--date-order',
      ...traversalArgs,
      '--shortstat',
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
      const [hash, shortHash, parents, refsText, author, timestamp, rest] =
        record.split(FIELD_SEPARATOR);
      const [subject, ...statLines] = (rest ?? '').split('\n');
      const stats = parseShortStat(statLines.join('\n'));

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
        ...(stats ? {stats} : {}),
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
