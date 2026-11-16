import React from 'react';
import {Box, Text, useInput} from 'ink';
import type {GitCommit} from '../git/types.js';
import {formatDate} from '../utils/formatDate.js';
import {formatStats} from '../utils/formatStats.js';
import {Section} from './Section.js';
import {ACCENT} from './theme.js';

type Props = {
  commit: GitCommit;
  onClose?: () => void;
  width?: number;
  height?: number;
  showHelp?: boolean;
};

function DetailLine({label, value}: {label: string; value: string}) {
  return (
    <Text wrap="truncate-end">
      <Text dimColor>{label.padEnd(8)}</Text>
      {value || '-'}
    </Text>
  );
}

export function CommitDetails({commit, onClose, width, height, showHelp = true}: Props) {
  useInput((input, key) => {
    if (!onClose) return;
    if (key.escape || key.return || input === 'q') onClose();
  });

  const worktree = commit.kind === 'worktree';
  // The worktree row uses "working tree" as its author too, so drop repeats.
  const byline = [...new Set([worktree ? 'working tree' : commit.shortHash, commit.author, formatDate(commit.timestamp)])]
    .filter(Boolean)
    .join(' · ');

  return (
    <Section title="Details" width={width} height={height}>
      <Text bold color={ACCENT}>{commit.subject}</Text>
      <Text dimColor wrap="truncate-end">{byline}</Text>
      <Text> </Text>
      <DetailLine label={worktree ? 'status' : 'commit'} value={worktree ? 'uncommitted changes' : commit.hash} />
      <DetailLine label="files" value={formatStats(commit.stats)} />
      <DetailLine label="refs" value={commit.refs.join(', ')} />
      <DetailLine label="parents" value={commit.parents.map(parent => parent.slice(0, 8)).join(' ')} />
      {showHelp ? (
        <Box marginTop={1}>
          <Text dimColor>Enter/Esc close</Text>
        </Box>
      ) : null}
    </Section>
  );
}
