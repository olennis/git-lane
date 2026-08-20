import type {GitCommit} from '../git/types.js';
import type {GraphRow, GraphSegment} from './types.js';

type Direction = 'up' | 'down' | 'left' | 'right';
type Cell = {
  connections: Set<Direction>;
  colorLane: number;
};

const CONNECTION_TO_CHAR = new Map<string, string>([
  ['down,up', '│'],
  ['left,right', '─'],
  ['right,up', '╰'],
  ['left,up', '╯'],
  ['down,right', '╭'],
  ['down,left', '╮'],
  ['down,right,up', '├'],
  ['down,left,up', '┤'],
  ['left,right,up', '┴'],
  ['down,left,right', '┬'],
  ['down,left,right,up', '┼'],
]);

function connectionKey(connections: Set<Direction>): string {
  return [...connections].sort().join(',');
}

function createCells(width: number): Cell[] {
  return Array.from({length: width}, (_, position) => ({
    connections: new Set<Direction>(),
    colorLane: Math.floor(position / 2),
  }));
}

function addConnections(
  cells: Cell[],
  position: number,
  colorLane: number,
  ...directions: Direction[]
) {
  const cell = cells[position];
  if (!cell) return;

  if (cell.connections.size === 0) cell.colorLane = colorLane;
  for (const direction of directions) cell.connections.add(direction);
}

function renderConnections(
  transitions: Array<[number, number]>,
  laneCount: number,
): GraphSegment[] {
  if (laneCount === 0 || transitions.length === 0) return [];

  const width = Math.max(1, laneCount * 2 - 1);
  const cells = createCells(width);

  for (const [fromLane, toLane] of transitions) {
    const from = fromLane * 2;
    const to = toLane * 2;

    if (from === to) {
      addConnections(cells, from, fromLane, 'up', 'down');
      continue;
    }

    if (from < to) {
      addConnections(cells, from, fromLane, 'up', 'right');
      addConnections(cells, to, fromLane, 'left', 'down');
      for (let position = from + 1; position < to; position += 1) {
        addConnections(cells, position, fromLane, 'left', 'right');
      }
      continue;
    }

    addConnections(cells, from, fromLane, 'up', 'left');
    addConnections(cells, to, fromLane, 'right', 'down');
    for (let position = to + 1; position < from; position += 1) {
      addConnections(cells, position, fromLane, 'left', 'right');
    }
  }

  return cells.map(cell => ({
    char: CONNECTION_TO_CHAR.get(connectionKey(cell.connections)) ?? ' ',
    colorLane: cell.colorLane,
  }));
}

function renderNodes(active: string[], lane: number): GraphSegment[] {
  const segments: GraphSegment[] = [];

  active.forEach((_, index) => {
    segments.push({
      char: index === lane ? '●' : '│',
      colorLane: index,
    });

    if (index < active.length - 1) {
      segments.push({char: ' ', colorLane: index});
    }
  });

  return segments;
}

function buildNextLanes(active: string[], lane: number, parents: string[]): string[] {
  const next = [...active];
  const [firstParent, ...otherParents] = parents;

  if (!firstParent) {
    next.splice(lane, 1);
  } else {
    const existingParentLane = next.indexOf(firstParent);

    if (existingParentLane !== -1 && existingParentLane !== lane) {
      next.splice(lane, 1);
    } else {
      next[lane] = firstParent;
    }
  }

  let insertAt = Math.min(lane + 1, next.length);
  for (const parent of otherParents) {
    if (!parent || next.includes(parent)) continue;
    next.splice(insertAt, 0, parent);
    insertAt += 1;
  }

  return next;
}

function buildTransitions(
  active: string[],
  next: string[],
  commitLane: number,
  parents: string[],
): Array<[number, number]> {
  const transitions: Array<[number, number]> = [];
  const seen = new Set<string>();

  const push = (from: number, to: number) => {
    if (to < 0) return;
    const key = `${from}:${to}`;
    if (seen.has(key)) return;
    seen.add(key);
    transitions.push([from, to]);
  };

  active.forEach((hash, lane) => {
    if (lane === commitLane) return;
    push(lane, next.indexOf(hash));
  });

  for (const parent of parents) {
    push(commitLane, next.indexOf(parent));
  }

  return transitions;
}

function hasVisibleConnector(segments: GraphSegment[]): boolean {
  return segments.some(segment => ![' ', '│'].includes(segment.char));
}

/**
 * Converts topologically ordered commits into render-ready graph rows.
 *
 * Git traversal, graph layout and Ink rendering stay separate so each concern
 * can evolve independently. This module owns only DAG -> lane geometry.
 */
export function buildGraph(commits: GitCommit[]): GraphRow[] {
  const active: string[] = [];
  const rows: GraphRow[] = [];

  for (const commit of commits) {
    let lane = active.indexOf(commit.hash);

    if (lane === -1) {
      lane = active.length;
      active.push(commit.hash);
    }

    const before = [...active];
    const next = buildNextLanes(before, lane, commit.parents);
    const transitions = buildTransitions(before, next, lane, commit.parents);
    const laneCount = Math.max(before.length, next.length);
    const edgeSegments = renderConnections(transitions, laneCount);

    rows.push({
      commit,
      lane,
      laneCount,
      nodeSegments: renderNodes(before, lane),
      ...(hasVisibleConnector(edgeSegments) ? {edgeSegments} : {}),
    });

    active.splice(0, active.length, ...next);
  }

  return rows;
}
