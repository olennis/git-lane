import type {CommitStats} from '../git/types.js';

export function formatFileCount(stats: CommitStats | undefined): string {
  if (!stats) return '';
  return stats.filesChanged === 1 ? '1 file' : `${stats.filesChanged} files`;
}

export function formatStats(stats: CommitStats | undefined): string {
  if (!stats) return '';

  const lines = stats.insertions === undefined && stats.deletions === undefined
    ? ''
    : `  +${stats.insertions ?? 0} -${stats.deletions ?? 0}`;

  return `${formatFileCount(stats)}${lines}`;
}
