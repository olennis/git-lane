import type {GitCommit} from './types.js';
import {runGit} from './runGit.js';

export const WORKTREE_COMMIT_HASH = '__git_lane_worktree__';

async function getHeadHash(cwd: string | undefined): Promise<string> {
  try {
    return (await runGit(['rev-parse', 'HEAD'], cwd)).trim();
  } catch {
    return '';
  }
}

export async function getWorktreeCommit(
  currentBranch: string,
  options: {cwd?: string} = {},
): Promise<GitCommit | undefined> {
  const status = await runGit(['status', '--porcelain'], options.cwd);
  const changedFiles = status.split('\n').filter(Boolean).length;

  if (changedFiles === 0) return undefined;

  const head = await getHeadHash(options.cwd);
  const fileLabel = changedFiles === 1 ? '1 file' : `${changedFiles} files`;
  const refs = currentBranch ? [`HEAD -> ${currentBranch}`, 'uncommitted'] : ['uncommitted'];

  return {
    hash: WORKTREE_COMMIT_HASH,
    shortHash: 'worktree',
    parents: head ? [head] : [],
    refs,
    author: 'working tree',
    timestamp: Math.floor(Date.now() / 1000),
    subject: `Uncommitted changes (${fileLabel})`,
    kind: 'worktree',
  };
}
