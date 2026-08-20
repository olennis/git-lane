import type {GitCommit} from '../git/types.js';

export type GraphSegment = {
  char: string;
  colorLane: number;
};

export type GraphRow = {
  commit: GitCommit;
  lane: number;
  laneCount: number;
  nodeSegments: GraphSegment[];
  edgeSegments?: GraphSegment[];
};
