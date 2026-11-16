import React from 'react';
import {Box, Text} from 'ink';
import {ACCENT} from './theme.js';

type Props = {
  hints: Array<[key: string, label: string]>;
};

export function KeyHints({hints}: Props) {
  return (
    <Box flexDirection="row" flexWrap="nowrap" overflow="hidden" columnGap={2}>
      {hints.map(([key, label]) => (
        <Box key={key} flexShrink={0}>
          <Text>
            <Text color={ACCENT} bold>{key}</Text>
            <Text dimColor> {label}</Text>
          </Text>
        </Box>
      ))}
    </Box>
  );
}
