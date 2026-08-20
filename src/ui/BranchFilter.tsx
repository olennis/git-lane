import React from 'react';
import {Box, Text, useInput} from 'ink';
import type {GitBranch} from '../git/types.js';

type Props = {
  branches: GitBranch[];
  selected: Set<string>;
  height?: number;
  onApply: (selected: Set<string>) => void;
  onClose: () => void;
};

function windowStart(cursor: number, visibleRows: number, totalRows: number): number {
  return Math.max(0, Math.min(cursor - Math.floor(visibleRows / 2), totalRows - visibleRows));
}

export function BranchFilter({branches, selected, height, onApply, onClose}: Props) {
  const [cursor, setCursor] = React.useState(0);
  const [draft, setDraft] = React.useState(() => new Set(selected));
  const visibleRows = Math.max(1, (height ?? process.stdout.rows ?? 20) - 5);

  const orderedBranches = React.useMemo(
    () => [...branches].sort((a, b) => Number(b.current) - Number(a.current) || a.name.localeCompare(b.name)),
    [branches],
  );
  const start = windowStart(cursor, visibleRows, orderedBranches.length);
  const visibleBranches = orderedBranches.slice(start, start + visibleRows);

  React.useEffect(() => {
    setCursor(current => Math.min(current, Math.max(0, orderedBranches.length - 1)));
  }, [orderedBranches.length]);

  useInput((input, key) => {
    if (key.escape || input === 'b') {
      onClose();
      return;
    }

    if (key.return) {
      onApply(draft);
      return;
    }

    if (key.upArrow || key.leftArrow || input === 'k') {
      setCursor(current => Math.max(0, current - 1));
      return;
    }

    if (key.downArrow || key.rightArrow || input === 'j') {
      setCursor(current => Math.min(orderedBranches.length - 1, current + 1));
      return;
    }

    if (input === ' ') {
      const branch = orderedBranches[cursor];
      if (!branch) return;

      setDraft(current => {
        const next = new Set(current);
        if (next.has(branch.name)) next.delete(branch.name);
        else next.add(branch.name);
        return next;
      });
    }
  });

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Text bold>Visible branches</Text>
      <Text dimColor>Space toggle · Enter apply · ↑↓/←→ move · Esc cancel</Text>
      {start > 0 ? <Text dimColor>↑ {start} more</Text> : null}
      {visibleBranches.map((branch, offset) => {
        const index = start + offset;
        const focused = index === cursor;
        const row = (
          <>
            {focused ? '›' : ' '} {draft.has(branch.name) ? '●' : '○'} {branch.name}
            {branch.current ? '  ← HEAD' : ''}
            {branch.remote ? '  remote' : ''}
          </>
        );

        return focused ? (
          <Text key={branch.name} inverse color="yellow" bold>{row}</Text>
        ) : (
          <Text key={branch.name}>{row}</Text>
        );
      })}
      {start + visibleBranches.length < orderedBranches.length ? (
        <Text dimColor>↓ {orderedBranches.length - start - visibleBranches.length} more</Text>
      ) : null}
    </Box>
  );
}
