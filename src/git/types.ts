export type GitCommit = {
  hash: string;
  shortHash: string;
  parents: string[];
  refs: string[];
  author: string;
  timestamp: number;
  subject: string;
  kind?: 'commit' | 'worktree';
};

export type GitBranch = {
  name: string;
  current: boolean;
  remote: boolean;
};
