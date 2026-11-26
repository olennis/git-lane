import React from 'react';
import {Box, Text, useInput} from 'ink';
import type {GitCommit} from '../git/types.js';
import type {GraphRow, GraphSegment} from '../graph/types.js';
import {formatDateTime} from '../utils/formatDate.js';
import {displayWidth, truncateColumns} from '../utils/displayWidth.js';
import {
  ACCENT,
  BORDER,
  CHIP_BG,
  CHIP_REMOTE_BG,
  CHIP_REMOTE_TEXT,
  CHIP_TAG_BG,
  CHIP_TEXT,
  HEAD_MARK,
  HEADER_TEXT,
  LANE_COLORS,
  MUTED_TEXT,
  SELECTED_BG,
} from './theme.js';

type Props = {
  rows: GraphRow[];
  selectedRefs: Set<string>;
  showOrigin: boolean;
  width?: number;
  height?: number;
  cursor: number;
  onCursorChange: (cursor: number) => void;
  onOpenDetails: () => void;
};

const ROW_RIGHT_PADDING = 1;
const CURSOR_WIDTH = 2;
const COLUMN_GAP = 2;
const DATE_WIDTH = 17;
const COMMIT_WIDTH = 8;
const AUTHOR_MIN_WIDTH = 6;
const AUTHOR_MAX_WIDTH = 12;
const GRAPH_MIN_WIDTH = 5;
// Below this many description columns, the Author and then the Date column are dropped.
const DESCRIPTION_MIN_WIDTH = 24;
const REMOTE_PREFIX = 'origin/';

type RefChip = {
  key: string;
  name: string;
  kind: 'branch' | 'remote' | 'tag';
  // A local branch whose origin counterpart sits on the same commit is drawn as one chip.
  withOrigin: boolean;
  head: boolean;
  width: number;
};

type BranchLane = {
  branch: string;
  graphLane: number | undefined;
  displayLane: number;
};

type Columns = {
  graph: number;
  description: number;
  date: number;
  author: number;
};

function laneColor(lane: number): string {
  return LANE_COLORS[lane % LANE_COLORS.length] ?? LANE_COLORS[0];
}

function isMerge(commit: GitCommit): boolean {
  return commit.parents.length > 1;
}

function isWorktree(commit: GitCommit): boolean {
  return commit.kind === 'worktree';
}

function isHead(commit: GitCommit): boolean {
  return commit.refs.some(ref => ref === 'HEAD' || ref.startsWith('HEAD -> '));
}

// Only HEAD gets a round node; other commits thicken their lane so the line stays continuous
// while still marking which lane the commit sits on.
function nodeChar(commit: GitCommit): string {
  if (isWorktree(commit)) return '○';
  return isHead(commit) ? '●' : '┃';
}

function normalizedRefs(refs: string[]): Set<string> {
  return new Set(refs.map(ref => ref.replace(/^HEAD -> /, '')));
}

function selectedRefsForCommit(refs: string[], selectedRefs: Set<string>): string[] {
  const normalized = normalizedRefs(refs);
  return [...selectedRefs].filter(ref => normalized.has(ref));
}

function chipWidth(chip: Omit<RefChip, 'width'>): number {
  return (chip.head ? 2 : 0) + displayWidth(` ${chip.name} `) + (chip.withOrigin ? displayWidth(' origin ') : 0);
}

export function refChips(refs: string[], showOrigin: boolean): RefChip[] {
  let head: string | undefined;
  const locals: string[] = [];
  const tags: string[] = [];
  const remotes = new Set<string>();

  for (const raw of refs) {
    if (raw === 'HEAD') continue;
    if (raw.startsWith('HEAD -> ')) {
      head = raw.slice('HEAD -> '.length);
      locals.push(head);
    } else if (raw.startsWith('tag: ')) {
      tags.push(raw.slice('tag: '.length));
    } else if (raw.startsWith(REMOTE_PREFIX)) {
      remotes.add(raw);
    } else {
      locals.push(raw);
    }
  }

  const chips: Array<Omit<RefChip, 'width'>> = [];

  for (const name of locals) {
    const remote = `${REMOTE_PREFIX}${name}`;
    const withOrigin = showOrigin && remotes.delete(remote);
    chips.push({key: `branch-${name}`, name, kind: 'branch', withOrigin, head: name === head});
  }

  if (showOrigin) {
    for (const name of remotes) {
      chips.push({key: `remote-${name}`, name, kind: 'remote', withOrigin: false, head: false});
    }
  }

  for (const name of tags) {
    chips.push({key: `tag-${name}`, name, kind: 'tag', withOrigin: false, head: false});
  }

  return chips.map(chip => ({...chip, width: chipWidth(chip)}));
}

function RefChipText({chip}: {chip: RefChip}) {
  return (
    <Text>
      {chip.head ? <Text color={HEAD_MARK} bold>○ </Text> : null}
      <Text color={CHIP_TEXT} backgroundColor={chip.kind === 'tag' ? CHIP_TAG_BG : CHIP_BG} bold={chip.head}>
        {` ${chip.name} `}
      </Text>
      {chip.withOrigin ? (
        <Text color={CHIP_REMOTE_TEXT} backgroundColor={CHIP_REMOTE_BG} italic>
          {' origin '}
        </Text>
      ) : null}
    </Text>
  );
}

function GraphLine({
  segments,
  width,
  selectedLane,
  node = '●',
}: {
  segments: GraphSegment[];
  width: number;
  selectedLane: number | undefined;
  node?: string;
}) {
  const missing = Math.max(0, width - segments.length);

  return (
    <Text>
      {segments.map((segment, index) => {
        const isNode = segment.char === '●';
        const highlighted = segment.colorLane === selectedLane && isNode;
        const char = isNode ? node : segment.char;

        return (
          <Text key={`${index}-${segment.char}`} color={laneColor(segment.colorLane)} bold={highlighted}>
            {char}
          </Text>
        );
      })}
      {' '.repeat(missing)}
    </Text>
  );
}

function CursorCell({selected}: {selected: boolean}) {
  return selected ? <Text color={ACCENT} bold>▌ </Text> : <Text>  </Text>;
}

function DescriptionCell({
  refs,
  showOrigin,
  subject,
  muted,
  selected,
  width,
}: {
  refs: string[];
  showOrigin: boolean;
  subject: string;
  muted: boolean;
  selected: boolean;
  width: number;
}) {
  if (width <= 0) return null;

  let remaining = width;
  const chipsToShow: RefChip[] = [];

  for (const chip of refChips(refs, showOrigin)) {
    const needed = chip.width + 1;
    // Always leave a little room for the subject itself.
    if (needed > remaining - 8) break;

    chipsToShow.push(chip);
    remaining -= needed;
  }

  const subjectText = truncateColumns(subject, remaining);

  return (
    <Box width={width} flexDirection="row" flexWrap="nowrap" flexShrink={0}>
      {chipsToShow.map(chip => (
        <React.Fragment key={chip.key}>
          <RefChipText chip={chip} />
          <Text> </Text>
        </React.Fragment>
      ))}
      <Text
        bold={selected || chipsToShow.some(chip => chip.head)}
        {...(muted ? {color: MUTED_TEXT} : {})}
        wrap="truncate-end"
      >
        {subjectText}
      </Text>
    </Box>
  );
}

function Cell({width, children}: {width: number; children: React.ReactNode}) {
  if (width <= 0) return null;

  return (
    <>
      <Box width={COLUMN_GAP} flexShrink={0}>
        <Text>{' '.repeat(COLUMN_GAP)}</Text>
      </Box>
      <Box width={width} flexShrink={0}>
        {children}
      </Box>
    </>
  );
}

function PlainCell({width, text, muted}: {width: number; text: string; muted: boolean}) {
  return (
    <Cell width={width}>
      <Text {...(muted ? {color: MUTED_TEXT} : {})} wrap="truncate-end">
        {truncateColumns(text, width).padEnd(width)}
      </Text>
    </Cell>
  );
}

function center(text: string, width: number): string {
  const free = Math.max(0, width - displayWidth(text));
  const left = Math.floor(free / 2);
  return `${' '.repeat(left)}${text}${' '.repeat(free - left)}`;
}

function TableHeader({columns, rowWidth}: {columns: Columns; rowWidth: number}) {
  const header = (label: string, width: number) =>
    width > 0 ? (
      <>
        <Box width={COLUMN_GAP} flexShrink={0}>
          <Text color={BORDER}>{' │'.slice(0, COLUMN_GAP)}</Text>
        </Box>
        <Box width={width} flexShrink={0}>
          <Text color={HEADER_TEXT} bold>{center(label, width)}</Text>
        </Box>
      </>
    ) : null;

  return (
    <Box flexDirection="column" width={rowWidth}>
      <Box flexDirection="row" flexWrap="nowrap" width={rowWidth}>
        <Box width={CURSOR_WIDTH + columns.graph} flexShrink={0}>
          <Text color={HEADER_TEXT} bold>{center('Graph', CURSOR_WIDTH + columns.graph)}</Text>
        </Box>
        {header('Description', columns.description)}
        {header('Date', columns.date)}
        {header('Author', columns.author)}
        {header('Commit', COMMIT_WIDTH)}
      </Box>
      <Text color={BORDER}>{'─'.repeat(rowWidth)}</Text>
    </Box>
  );
}

function layoutColumns(rowWidth: number, graphWidth: number, authorWidth: number): Columns {
  const graph = Math.max(GRAPH_MIN_WIDTH, graphWidth);
  const fixed = CURSOR_WIDTH + graph + COLUMN_GAP * 2 + COMMIT_WIDTH;
  let date = DATE_WIDTH;
  let author = authorWidth;

  const description = () => rowWidth - fixed - (date ? date + COLUMN_GAP : 0) - (author ? author + COLUMN_GAP : 0);

  if (description() < DESCRIPTION_MIN_WIDTH) author = 0;
  if (description() < DESCRIPTION_MIN_WIDTH) date = 0;

  return {graph, description: Math.max(0, description()), date, author};
}

export function GraphView({rows, selectedRefs, showOrigin, width, height, cursor, onCursorChange, onOpenDetails}: Props) {
  const terminalColumns = width ?? process.stdout.columns ?? 100;
  const availableRows = height ?? (process.stdout.rows ?? 30) - 8;
  const headerRows = 2;
  const connectorRows = rows.filter(row => row.edgeSegments).length;
  const averageHeight = rows.length === 0 ? 1 : 1 + connectorRows / rows.length;
  const visibleRows = Math.max(3, Math.floor((availableRows - headerRows) / averageHeight));
  const start = Math.max(0, Math.min(cursor - Math.floor(visibleRows / 2), rows.length - visibleRows));
  const end = Math.min(rows.length, start + visibleRows);
  const windowRows = rows.slice(start, end);
  const graphWidth = Math.max(1, ...windowRows.map(row => row.laneCount * 2 - 1));
  const authorWidth = Math.min(
    AUTHOR_MAX_WIDTH,
    Math.max(AUTHOR_MIN_WIDTH, ...windowRows.map(row => displayWidth(row.commit.author))),
  );
  const rowWidth = Math.max(0, terminalColumns - ROW_RIGHT_PADDING);
  const columns = layoutColumns(rowWidth, graphWidth, authorWidth);

  useInput((input, key) => {
    if (key.upArrow || input === 'k') {
      onCursorChange(Math.max(0, cursor - 1));
      return;
    }

    if (key.downArrow || input === 'j') {
      onCursorChange(Math.min(rows.length - 1, cursor + 1));
      return;
    }

    if (key.return) onOpenDetails();
  });

  if (rows.length === 0) {
    return <Text dimColor>No commits for the selected branches.</Text>;
  }

  return (
    <Box flexDirection="column">
      <TableHeader columns={columns} rowWidth={rowWidth} />

      {windowRows.map((row, offset) => {
        const index = start + offset;
        const selected = index === cursor;
        const {commit} = row;
        const worktree = isWorktree(commit);
        const muted = isMerge(commit) || worktree;
        const selectedLane = selectedRefsForCommit(commit.refs, selectedRefs).length > 0 ? row.lane : undefined;

        return (
          <React.Fragment key={commit.hash}>
            <Box
              width={rowWidth}
              flexDirection="row"
              flexWrap="nowrap"
              backgroundColor={selected ? SELECTED_BG : undefined}
            >
              <Box width={CURSOR_WIDTH} flexShrink={0}>
                <CursorCell selected={selected} />
              </Box>
              <Box width={columns.graph} flexShrink={0}>
                <GraphLine
                  segments={row.nodeSegments}
                  width={columns.graph}
                  selectedLane={selectedLane}
                  node={nodeChar(commit)}
                />
              </Box>
              <Cell width={columns.description}>
                <DescriptionCell
                  // The worktree row repeats HEAD's refs; the real HEAD commit carries the chips.
                  refs={worktree ? [] : commit.refs}
                  showOrigin={showOrigin}
                  subject={commit.subject}
                  muted={muted}
                  selected={selected}
                  width={columns.description}
                />
              </Cell>
              <PlainCell width={columns.date} text={worktree ? '' : formatDateTime(commit.timestamp)} muted={muted} />
              <PlainCell width={columns.author} text={worktree ? '*' : commit.author} muted={muted} />
              <PlainCell width={COMMIT_WIDTH} text={worktree ? '*' : commit.shortHash} muted={muted} />
            </Box>
            {row.edgeSegments ? (
              <Box width={rowWidth} flexDirection="row" flexWrap="nowrap">
                <Box width={CURSOR_WIDTH} flexShrink={0}>
                  <Text>  </Text>
                </Box>
                <Box width={columns.graph} flexShrink={0}>
                  <GraphLine segments={row.edgeSegments} width={columns.graph} selectedLane={undefined} />
                </Box>
              </Box>
            ) : null}
          </React.Fragment>
        );
      })}
    </Box>
  );
}

function selectedBranchLanes(rows: GraphRow[], selectedRefs: Set<string>): BranchLane[] {
  return [...selectedRefs].map((branch, displayLane) => ({
    branch,
    graphLane: rows.find(row => selectedRefsForCommit(row.commit.refs, new Set([branch])).length > 0)?.lane,
    displayLane,
  }));
}

function graphLaneRows(rows: GraphRow[]): BranchLane[] {
  return Array.from({length: Math.max(1, ...rows.map(row => row.laneCount))}, (_, displayLane) => ({
    branch: `lane ${displayLane + 1}`,
    graphLane: displayLane,
    displayLane,
  }));
}

function branchTip(row: GraphRow, branch: string): boolean {
  return selectedRefsForCommit(row.commit.refs, new Set([branch])).length > 0;
}

function branchActive(row: GraphRow, graphLane: number | undefined): boolean {
  return graphLane !== undefined && row.nodeSegments[graphLane * 2]?.char !== undefined;
}

function BranchLabel({branch}: {branch: string}) {
  const kind = branch.startsWith(REMOTE_PREFIX) ? 'remote' : 'branch';
  const chip = {key: branch, name: branch, kind, withOrigin: false, head: false} as const;

  return <RefChipText chip={{...chip, width: chipWidth(chip)}} />;
}

export function HorizontalGraphView({
  rows,
  selectedRefs,
  showOrigin,
  width,
  cursor,
  onCursorChange,
  onOpenDetails,
}: Props) {
  const terminalColumns = width ?? process.stdout.columns ?? 100;
  const selectedLaneLabels = React.useMemo(() => selectedBranchLanes(rows, selectedRefs), [rows, selectedRefs]);
  const maxBranchLabelWidth = Math.max(0, ...selectedLaneLabels.map(({branch}) => displayWidth(branch) + 2));
  const laneLabelWidth = Math.max(8, Math.min(20, maxBranchLabelWidth + 1));
  const columnWidth = 2;
  const visibleColumns = Math.max(3, Math.floor((terminalColumns - laneLabelWidth - ROW_RIGHT_PADDING) / columnWidth));
  const start = Math.max(0, Math.min(cursor - Math.floor(visibleColumns / 2), rows.length - visibleColumns));
  const end = Math.min(rows.length, start + visibleColumns);
  const visibleRows = rows.slice(start, end);
  const branchRows = selectedRefs.size > 0 ? selectedLaneLabels : graphLaneRows(visibleRows);
  const selectedCommit = rows[cursor]?.commit;

  useInput((input, key) => {
    if (key.leftArrow || key.upArrow || input === 'k') {
      onCursorChange(Math.max(0, cursor - 1));
      return;
    }

    if (key.rightArrow || key.downArrow || input === 'l' || input === 'j') {
      onCursorChange(Math.min(rows.length - 1, cursor + 1));
      return;
    }

    if (key.return) onOpenDetails();
  });

  if (rows.length === 0) {
    return <Text dimColor>No commits for the selected branches.</Text>;
  }

  return (
    <Box flexDirection="column" width={terminalColumns}>
      <Text color={MUTED_TEXT}>newer ← commits → older</Text>
      {branchRows.map(({branch, graphLane, displayLane}) => {
        const label = truncateColumns(branch, laneLabelWidth - 3);

        return (
          <Box key={branch} flexDirection="row" flexWrap="nowrap" width={terminalColumns}>
            <Box width={laneLabelWidth} flexShrink={0}>
              {branch.startsWith('lane ') ? (
                <Text color={laneColor(displayLane)}>{label.padEnd(laneLabelWidth)}</Text>
              ) : (
                <BranchLabel branch={label} />
              )}
            </Box>
            {visibleRows.map((row, offset) => {
              const index = start + offset;
              const active = branchActive(row, graphLane);
              const tip = branchTip(row, branch);
              const commitHere = tip || (branch.startsWith('lane ') && row.lane === graphLane);
              const selected = index === cursor;
              const nextActive = offset < visibleRows.length - 1 && branchActive(visibleRows[offset + 1] ?? row, graphLane);
              const node = selected ? '◉' : tip ? '◆' : '●';
              const char = commitHere ? node : active ? '─' : ' ';
              const connector = active && nextActive ? '─' : ' ';

              return (
                <Text
                  key={`${row.commit.hash}-${branch}`}
                  color={selected ? ACCENT : laneColor(displayLane)}
                  bold={selected || tip}
                >
                  {char}
                  {connector}
                </Text>
              );
            })}
          </Box>
        );
      })}
      {selectedCommit ? (
        <DescriptionCell
          refs={isWorktree(selectedCommit) ? [] : selectedCommit.refs}
          showOrigin={showOrigin}
          subject={`${selectedCommit.shortHash}  ${selectedCommit.subject}`}
          muted={isMerge(selectedCommit)}
          selected
          width={terminalColumns - ROW_RIGHT_PADDING}
        />
      ) : null}
    </Box>
  );
}
