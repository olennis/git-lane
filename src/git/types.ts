export type GitCommit = {
  hash: string;
  shortHash: string;
  parents: string[];
  refs: string[];
  author: string;
  timestamp: number;
  subject: string;
  kind?: 'commit' | 'worktree';
  stats?: CommitStats;
};

export type CommitStats = {
  filesChanged: number;
  // The worktree only counts porcelain entries, so line counts may be unknown.
  insertions?: number;
  deletions?: number;
};

export type GitBranch = {
  name: string;
  current: boolean;
  remote: boolean;
};
