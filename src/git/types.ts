export type GitCommit = {
  hash: string;
  shortHash: string;
  parents: string[];
  refs: string[];
  author: string;
  timestamp: number;
  subject: string;
};

export type GitBranch = {
  name: string;
  current: boolean;
  remote: boolean;
};
