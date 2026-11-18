import type {GitCommit} from './types.js';
import {runGit} from './runGit.js';

export type FileChangeStatus = 'A' | 'M' | 'D' | 'R' | 'C' | 'T' | 'U' | '?';

export type FileChange = {
  status: FileChangeStatus;
  path: string;
  // Set for renames/copies: the path on the parent side.
  oldPath?: string;
  insertions?: number;
  deletions?: number;
  binary?: boolean;
};

// `git hash-object -t tree /dev/null`: diffing against it works before the first commit.
const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
const DIFF_ARGS = ['-M', '--no-color', '--no-ext-diff'];

// Merge commits are compared against their first parent, matching the FOCUSED lane view.
function commitDiffArgs(hash: string): string[] {
  return ['show', '--format=', '--diff-merges=first-parent', ...DIFF_ARGS, hash];
}

/** Parses `--name-status -z` output: `M\0path\0R100\0old\0new\0`. */
export function parseNameStatus(output: string): FileChange[] {
  const tokens = output.split('\0');
  const changes: FileChange[] = [];

  for (let index = 0; index < tokens.length; ) {
    const code = tokens[index++];
    if (!code) continue;

    const status = (code[0] ?? 'M') as FileChangeStatus;
    if (status === 'R' || status === 'C') {
      const oldPath = tokens[index++] ?? '';
      const path = tokens[index++] ?? '';
      changes.push({status, path, oldPath});
    } else {
      changes.push({status, path: tokens[index++] ?? ''});
    }
  }

  return changes;
}

/**
 * Parses `--numstat -z` output. Plain entries are `added\tdeleted\tpath\0`; renames leave the
 * path empty and follow with `old\0new\0`. Binary files report `-` for both counts.
 */
export function parseNumstat(output: string): Map<string, Pick<FileChange, 'insertions' | 'deletions' | 'binary'>> {
  const tokens = output.split('\0');
  const stats = new Map<string, Pick<FileChange, 'insertions' | 'deletions' | 'binary'>>();

  for (let index = 0; index < tokens.length; ) {
    const entry = tokens[index++];
    if (!entry) continue;

    const [added = '', deleted = '', inlinePath = ''] = entry.split('\t');
    let path = inlinePath;
    if (!path) {
      index++; // old path
      path = tokens[index++] ?? '';
    }

    stats.set(
      path,
      added === '-' ? {binary: true} : {insertions: Number(added), deletions: Number(deleted)},
    );
  }

  return stats;
}

function mergeStats(changes: FileChange[], numstat: string): FileChange[] {
  const stats = parseNumstat(numstat);
  return changes.map(change => ({...change, ...stats.get(change.path)}));
}

// git prints repo-root-relative paths, so every call runs from the root: pathspecs,
// `--no-index` and `ls-files` would otherwise resolve them against a subdirectory cwd.
async function getRepoRoot(cwd: string | undefined): Promise<string> {
  return (await runGit(['rev-parse', '--show-toplevel'], cwd)).trim();
}

async function getHeadOrEmptyTree(cwd: string | undefined): Promise<string> {
  try {
    return (await runGit(['rev-parse', '--verify', 'HEAD'], cwd)).trim();
  } catch {
    return EMPTY_TREE;
  }
}

async function getWorktreeChanges(cwd: string | undefined): Promise<FileChange[]> {
  const base = await getHeadOrEmptyTree(cwd);
  const [nameStatus, numstat, untracked] = await Promise.all([
    runGit(['diff', ...DIFF_ARGS, '--name-status', '-z', base], cwd),
    runGit(['diff', ...DIFF_ARGS, '--numstat', '-z', base], cwd),
    runGit(['ls-files', '--others', '--exclude-standard', '-z'], cwd),
  ]);

  const tracked = mergeStats(parseNameStatus(nameStatus), numstat);
  const added = untracked
    .split('\0')
    .filter(Boolean)
    .map(path => ({status: '?', path}) satisfies FileChange);

  return [...tracked, ...added];
}

export async function getFileChanges(commit: GitCommit, options: {cwd?: string} = {}): Promise<FileChange[]> {
  const cwd = await getRepoRoot(options.cwd);
  if (commit.kind === 'worktree') return await getWorktreeChanges(cwd);

  const [nameStatus, numstat] = await Promise.all([
    runGit([...commitDiffArgs(commit.hash), '--name-status', '-z'], cwd),
    runGit([...commitDiffArgs(commit.hash), '--numstat', '-z'], cwd),
  ]);

  return mergeStats(parseNameStatus(nameStatus), numstat);
}

export async function getFileDiff(
  commit: GitCommit,
  file: FileChange,
  options: {cwd?: string} = {},
): Promise<string> {
  // Both sides of a rename have to be in the pathspec, or git reports a plain add/delete.
  const paths = file.oldPath ? [file.oldPath, file.path] : [file.path];
  const cwd = await getRepoRoot(options.cwd);

  if (commit.kind !== 'worktree') {
    return await runGit([...commitDiffArgs(commit.hash), '--', ...paths], cwd);
  }

  if (file.status === '?') {
    // --no-index exits 1 whenever the files differ, which is always the case here.
    return await runGit(['diff', ...DIFF_ARGS, '--no-index', '--', '/dev/null', file.path], cwd, {
      okExitCodes: [0, 1],
    });
  }

  const base = await getHeadOrEmptyTree(cwd);
  return await runGit(['diff', ...DIFF_ARGS, base, '--', ...paths], cwd);
}
