import React from 'react';
import {Box, Text} from 'ink';
import {displayWidth, truncateColumns} from '../utils/displayWidth.js';
import {ACCENT, BORDER, HEADER_TEXT, MUTED_TEXT} from './theme.js';

type Props = {
  // undefined means every branch is selected.
  branches: string[] | undefined;
  showOrigin: boolean;
  focused: boolean;
  horizontal: boolean;
  commitCount: number;
  width: number;
};

// Below this width the toolbar drops key hints and shortens its labels.
const COMPACT_COLUMNS = 130;
const VIEW_ICON = {vertical: '↕', horizontal: '↔'} as const;

// Lists as many branch names as fit, then summarises the rest as "+N".
function branchSummary(branches: string[] | undefined, maxWidth: number): string {
  if (!branches) return 'all branches';
  if (branches.length === 0) return 'none';

  let text = '';
  for (const [index, branch] of branches.entries()) {
    const next = index === 0 ? branch : `${text}, ${branch}`;
    const rest = branches.length - index - 1;
    const suffix = rest > 0 ? ` +${rest}` : '';

    if (displayWidth(next + suffix) > maxWidth) {
      if (index === 0) return truncateColumns(branch, maxWidth - suffix.length) + suffix;
      return `${text} +${branches.length - index}`;
    }

    text = next;
  }

  return text;
}

// A terminal take on a git-graph toolbar: what is shown, the remote toggle, and view state.
export function Toolbar({branches, showOrigin, focused, horizontal, commitCount, width}: Props) {
  const compact = width < COMPACT_COLUMNS;
  const summary = branchSummary(branches, compact ? 24 : 48);

  return (
    <Box flexDirection="column">
      <Box paddingX={1} width={width} flexDirection="row" flexWrap="nowrap" columnGap={compact ? 2 : 3} overflow="hidden">
        <Box flexShrink={0}>
          <Text color={ACCENT} bold>✦ Git Lane</Text>
        </Box>
        <Box flexShrink={0}>
          <Text>
            <Text color={MUTED_TEXT}>Branches </Text>
            <Text color={HEADER_TEXT} bold>{summary}</Text>
            <Text color={BORDER}> · </Text>
            {/* History mode belongs to the branch selection: focused = first-parent only. */}
            <Text color={focused ? MUTED_TEXT : 'yellow'} bold={!focused}>{focused ? 'focused' : 'full history'}</Text>
          </Text>
        </Box>
        <Box flexShrink={0}>
          <Text>
            <Text color={BORDER}>[</Text>
            <Text color={showOrigin ? ACCENT : MUTED_TEXT} bold>{showOrigin ? '✓' : ' '}</Text>
            <Text color={BORDER}>] </Text>
            <Text color={HEADER_TEXT} bold>{compact ? 'Remote' : 'Show Remote Branches'}</Text>
          </Text>
        </Box>
        <Box flexShrink={0}>
          <Text>
            <Text color={HEADER_TEXT} bold>{horizontal ? VIEW_ICON.horizontal : VIEW_ICON.vertical}</Text>
            <Text color={MUTED_TEXT}>  </Text>
            <Text bold>{commitCount}</Text>
            <Text color={MUTED_TEXT}> commits</Text>
          </Text>
        </Box>
      </Box>
      <Text> </Text>
    </Box>
  );
}
