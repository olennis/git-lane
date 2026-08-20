import React from 'react';
import {Box, Text, useInput} from 'ink';
import type {GitCommit} from '../git/types.js';

type Props = {
  commit: GitCommit;
  onClose?: () => void;
  width?: number;
  showHelp?: boolean;
};

function DetailLine({label, value}: {label: string; value: string}) {
  return (
    <Text wrap="truncate-end">
      <Text dimColor>{label.padEnd(7)}</Text>
      {value || '-'}
    </Text>
  );
}

export function CommitDetails({commit, onClose, width, showHelp = true}: Props) {
  useInput((input, key) => {
    if (!onClose) return;
    if (key.escape || key.return || input === 'q') onClose();
  });

  const boxProps = width === undefined ? {} : {width};

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1} {...boxProps}>
      <Text bold wrap="truncate-end">{commit.subject}</Text>
      <DetailLine label="commit" value={commit.hash} />
      <DetailLine label="author" value={commit.author} />
      <DetailLine label="refs" value={commit.refs.join(', ')} />
      <DetailLine label="parents" value={commit.parents.join(' ')} />
      {showHelp ? <Text dimColor>Enter/Esc close</Text> : null}
    </Box>
  );
}
