import React from 'react';
import {Box, Text, useInput} from 'ink';
import type {GraphRow, GraphSegment} from '../graph/types.js';
import {formatDate} from '../utils/formatDate.js';

type Props = {
  rows: GraphRow[];
  selectedRefs: Set<string>;
  showOrigin: boolean;
  width?: number;
  cursor: number;
  onCursorChange: (cursor: number) => void;
  onOpenDetails: () => void;
};

const LANE_COLORS = ['cyan', 'magenta', 'yellow', 'green', 'blue', 'red'] as const;
const ROW_RIGHT_PADDING = 1;

type RefBadge = {
  key: string;
  text: string;
  width: number;
  kind: 'local' | 'remote';
};

function laneColor(lane: number) {
  return LANE_COLORS[lane % LANE_COLORS.length] ?? 'cyan';
}

function localRefs(refs: string[]): string[] {
  return refs
    .filter(ref => !ref.startsWith('origin/HEAD'))
    .map(ref => ref.replace(/^HEAD -> /, ''))
    .filter(ref => !ref.startsWith('origin/'))
    .slice(0, 2);
}

function remoteRefs(refs: string[]): string[] {
  return refs
    .filter(ref => ref.startsWith('origin/'))
    .filter(ref => ref !== 'origin/HEAD')
    .slice(0, 1);
}

function normalizedRefs(refs: string[]): Set<string> {
  return new Set(refs.map(ref => ref.replace(/^HEAD -> /, '')));
}

function selectedRefsForCommit(refs: string[], selectedRefs: Set<string>): string[] {
  const normalized = normalizedRefs(refs);
  return [...selectedRefs].filter(ref => normalized.has(ref));
}

function charWidth(char: string): number {
  const codePoint = char.codePointAt(0) ?? 0;

  if (
    codePoint === 0 ||
    (codePoint >= 0x300 && codePoint <= 0x36f) ||
    (codePoint >= 0x1ab0 && codePoint <= 0x1aff) ||
    (codePoint >= 0x1dc0 && codePoint <= 0x1dff) ||
    (codePoint >= 0xfe20 && codePoint <= 0xfe2f)
  ) {
    return 0;
  }

  if (
    (codePoint >= 0x1100 && codePoint <= 0x115f) ||
    (codePoint >= 0x2329 && codePoint <= 0x232a) ||
    (codePoint >= 0x2e80 && codePoint <= 0xa4cf) ||
    (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
    (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
    (codePoint >= 0xfe10 && codePoint <= 0xfe19) ||
    (codePoint >= 0xfe30 && codePoint <= 0xfe6f) ||
    (codePoint >= 0xff00 && codePoint <= 0xff60) ||
    (codePoint >= 0xffe0 && codePoint <= 0xffe6) ||
    (codePoint >= 0x1f300 && codePoint <= 0x1faff)
  ) {
    return 2;
  }

  return 1;
}

function displayWidth(text: string): number {
  return Array.from(text).reduce((width, char) => width + charWidth(char), 0);
}

function truncateColumns(text: string, maxColumns: number): string {
  if (maxColumns <= 0) return '';
  if (displayWidth(text) <= maxColumns) return text;
  if (maxColumns <= 3) return '.'.repeat(maxColumns);

  const suffix = '...';
  const target = maxColumns - suffix.length;
  let output = '';
  let width = 0;

  for (const char of Array.from(text)) {
    const nextWidth = width + charWidth(char);
    if (nextWidth > target) break;
    output += char;
    width = nextWidth;
  }

  return `${output}${suffix}`;
}

function SelectedBranchLane({
  branch,
  lane,
}: {
  branch: string;
  lane: number | undefined;
}) {
  if (lane === undefined) {
    return (
      <Text dimColor>
        {branch}: -
      </Text>
    );
  }

  return (
    <Text color={laneColor(lane)}>
      ◆ lane {lane + 1}: {branch}
    </Text>
  );
}

function GraphLine({
  segments,
  width,
  selectedLane,
}: {
  segments: GraphSegment[];
  width: number;
  selectedLane: number | undefined;
}) {
  const missing = Math.max(0, width - segments.length);

  return (
    <Text>
      {segments.map((segment, index) => {
        const highlighted = segment.colorLane === selectedLane && segment.char !== ' ';
        const char = highlighted && segment.char === '●' ? '◆' : segment.char;

        return (
          <Text
            key={`${index}-${segment.char}`}
            color={highlighted ? 'yellow' : laneColor(segment.colorLane)}
            bold={highlighted}
          >
            {char}
          </Text>
        );
      })}
      {' '.repeat(missing)}
    </Text>
  );
}

function refBadges(refs: string[], showOrigin: boolean): RefBadge[] {
  const local = localRefs(refs).map(ref => {
    const text = `[${ref}]`;

    return {
      key: `local-${ref}`,
      text,
      width: displayWidth(text),
      kind: 'local' as const,
    };
  });
  const remote = showOrigin
    ? remoteRefs(refs).map(ref => {
        const text = `(${ref})`;

        return {
          key: `remote-${ref}`,
          text,
          width: displayWidth(text),
          kind: 'remote' as const,
        };
      })
    : [];

  return [...local, ...remote];
}

function selectedBranchLanes(rows: GraphRow[], selectedRefs: Set<string>): Array<{branch: string; lane: number | undefined}> {
  return [...selectedRefs].map(branch => ({
    branch,
    lane: rows.find(row => selectedRefsForCommit(row.commit.refs, new Set([branch])).length > 0)?.lane,
  }));
}

function CommitHash({shortHash, selected, branchTip}: {shortHash: string; selected: boolean; branchTip: boolean}) {
  const text = shortHash.padEnd(9);

  if (selected || branchTip) {
    return <Text color="yellow" bold>{text}</Text>;
  }

  return <Text color="yellow">{text}</Text>;
}

function CursorCell({selected}: {selected: boolean}) {
  return selected ? <Text color="yellow">› </Text> : <Text>  </Text>;
}

function RefBadgeText({badge}: {badge: RefBadge}) {
  return badge.kind === 'local' ? (
    <Text color="black" backgroundColor="green" bold>
      {badge.text}
    </Text>
  ) : (
    <Text color="white" backgroundColor="blue" bold>
      {badge.text}
    </Text>
  );
}

function MetadataCell({
  refs,
  showOrigin,
  metadata,
  selected,
  width,
}: {
  refs: string[];
  showOrigin: boolean;
  metadata: string;
  selected: boolean;
  width: number;
}) {
  if (width <= 0) return null;

  let remaining = width;
  const badgesToShow: RefBadge[] = [];

  for (const badge of refBadges(refs, showOrigin)) {
    const needed = badge.width + 1;
    if (needed > remaining) break;

    badgesToShow.push(badge);
    remaining -= needed;
  }

  const text = truncateColumns(metadata, remaining);

  return (
    <Box width={width} flexDirection="row" flexWrap="nowrap" flexShrink={0}>
      {badgesToShow.map(badge => (
        <React.Fragment key={badge.key}>
          <RefBadgeText badge={badge} />
          <Text> </Text>
        </React.Fragment>
      ))}
      {text ? (
        <Text bold={selected} wrap="truncate-end">
          {text}
        </Text>
      ) : null}
    </Box>
  );
}

export function GraphView({rows, selectedRefs, showOrigin, width, cursor, onCursorChange, onOpenDetails}: Props) {
  const terminalColumns = width ?? process.stdout.columns ?? 100;
  const terminalRows = process.stdout.rows ?? 30;
  const connectorRows = rows.filter(row => row.edgeSegments).length;
  const averageHeight = rows.length === 0 ? 1 : 1 + connectorRows / rows.length;
  const visibleRows = Math.max(6, Math.floor((terminalRows - 8) / averageHeight));
  const start = Math.max(0, Math.min(cursor - Math.floor(visibleRows / 2), rows.length - visibleRows));
  const end = Math.min(rows.length, start + visibleRows);
  const graphWidth = Math.max(1, ...rows.slice(start, end).map(row => row.laneCount * 2 - 1));
  const branchLaneLabels = React.useMemo(
    () => selectedBranchLanes(rows, selectedRefs),
    [rows, selectedRefs],
  );

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
      {branchLaneLabels.length > 0 ? (
        <Box columnGap={2}>
          <Text dimColor>selected lanes</Text>
          {branchLaneLabels.map(({branch, lane}) => (
            <SelectedBranchLane key={branch} branch={branch} lane={lane} />
          ))}
        </Box>
      ) : null}

      {rows.slice(start, end).map((row, offset) => {
        const index = start + offset;
        const selected = index === cursor;
        const branchRefs = selectedRefsForCommit(row.commit.refs, selectedRefs);
        const selectedLane = branchRefs.length > 0 ? row.lane : undefined;
        const rowPrefixWidth = 2 + graphWidth + 2 + 9;
        const rowWidth = Math.max(0, terminalColumns - ROW_RIGHT_PADDING);
        const metadataWidth = Math.max(0, rowWidth - rowPrefixWidth);
        const metadata = `${row.commit.subject}  ${row.commit.author} · ${formatDate(row.commit.timestamp)}`;

        return (
          <React.Fragment key={row.commit.hash}>
            <Box width={rowWidth} flexDirection="row" flexWrap="nowrap">
              <Box width={2} flexShrink={0}>
                <CursorCell selected={selected} />
              </Box>
              <Box width={graphWidth} flexShrink={0}>
                <GraphLine segments={row.nodeSegments} width={graphWidth} selectedLane={selectedLane} />
              </Box>
              <Box width={2} flexShrink={0}>
                <Text>  </Text>
              </Box>
              <Box width={9} flexShrink={0}>
                <CommitHash shortHash={row.commit.shortHash} selected={selected} branchTip={branchRefs.length > 0} />
              </Box>
              <MetadataCell
                refs={row.commit.refs}
                showOrigin={showOrigin}
                metadata={metadata}
                selected={selected}
                width={metadataWidth}
              />
            </Box>
            {row.edgeSegments ? (
              <Box width={rowWidth} flexDirection="row" flexWrap="nowrap">
                <Box width={2} flexShrink={0}>
                  <Text>  </Text>
                </Box>
                <Box width={graphWidth} flexShrink={0}>
                  <GraphLine segments={row.edgeSegments} width={graphWidth} selectedLane={selectedLane} />
                </Box>
              </Box>
            ) : null}
          </React.Fragment>
        );
      })}
    </Box>
  );
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
  const maxBranchLabelWidth = Math.max(0, ...selectedLaneLabels.map(({branch}) => displayWidth(branch)));
  const laneLabelWidth = Math.max(8, Math.min(18, maxBranchLabelWidth + 1));
  const columnWidth = 2;
  const visibleColumns = Math.max(3, Math.floor((terminalColumns - laneLabelWidth - ROW_RIGHT_PADDING) / columnWidth));
  const start = Math.max(0, Math.min(cursor - Math.floor(visibleColumns / 2), rows.length - visibleColumns));
  const end = Math.min(rows.length, start + visibleColumns);
  const visibleRows = rows.slice(start, end);
  const laneCount = Math.max(1, ...visibleRows.map(row => row.laneCount));
  const selectedCommit = rows[cursor]?.commit;
  const selectedSummary = selectedCommit ? `${selectedCommit.shortHash} ${selectedCommit.subject}` : '';
  const laneLabels = React.useMemo(() => {
    const labels = new Map<number, string>();

    for (const {branch, lane} of selectedLaneLabels) {
      if (lane === undefined || labels.has(lane)) continue;
      labels.set(lane, branch);
    }

    return labels;
  }, [selectedLaneLabels]);

  useInput((input, key) => {
    if (key.leftArrow) {
      onCursorChange(Math.max(0, cursor - 1));
      return;
    }

    if (key.rightArrow || input === 'l') {
      onCursorChange(Math.min(rows.length - 1, cursor + 1));
      return;
    }

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
    <Box flexDirection="column" width={terminalColumns}>
      <Text dimColor>newer ← commits → older</Text>
      {Array.from({length: laneCount}, (_, lane) => (
        <Box key={lane} flexDirection="row" flexWrap="nowrap" width={terminalColumns}>
          <Box width={laneLabelWidth} flexShrink={0}>
            <Text color={laneColor(lane)}>
              {truncateColumns(laneLabels.get(lane) ?? `lane ${lane + 1}`, laneLabelWidth - 1).padEnd(laneLabelWidth)}
            </Text>
          </Box>
          {visibleRows.map((row, offset) => {
            const index = start + offset;
            const active = row.nodeSegments[lane * 2]?.char !== undefined;
            const commitHere = row.lane === lane;
            const selected = index === cursor;
            const branchTip = selectedRefsForCommit(row.commit.refs, selectedRefs).length > 0;
            const nextActive = visibleRows[offset + 1]?.nodeSegments[lane * 2]?.char !== undefined;
            const node = selected ? '◉' : branchTip ? '◆' : '●';
            const char = commitHere ? node : active ? '─' : ' ';
            const connector = active && nextActive && offset < visibleRows.length - 1 ? '─' : ' ';

            return (
              <Text
                key={`${row.commit.hash}-${lane}`}
                color={selected || branchTip ? 'yellow' : laneColor(lane)}
                bold={selected || branchTip}
              >
                {char}
                {connector}
              </Text>
            );
          })}
        </Box>
      ))}
      {selectedCommit ? (
        <MetadataCell
          refs={selectedCommit.refs}
          showOrigin={showOrigin}
          metadata={selectedSummary}
          selected
          width={terminalColumns - ROW_RIGHT_PADDING}
        />
      ) : null}
    </Box>
  );
}
