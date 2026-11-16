import React from 'react';
import {Box, Text} from 'ink';
import {displayWidth} from '../utils/displayWidth.js';
import {BORDER, SECTION_TITLE} from './theme.js';

type Props = {
  title: string;
  count?: number | string | undefined;
  width?: number | undefined;
  height?: number | undefined;
  borderColor?: string | undefined;
  children: React.ReactNode;
};

// Ink boxes have no border titles, so the top edge is drawn by hand with the title in it.
export function Section({title, count, width, height, borderColor = BORDER, children}: Props) {
  const outerWidth = width ?? process.stdout.columns ?? 100;
  const label = ` ${title}${count === undefined ? '' : `  ${count}`} `;
  const fill = Math.max(0, outerWidth - 3 - displayWidth(label));

  return (
    <Box flexDirection="column" width={outerWidth} height={height} flexShrink={0}>
      <Text wrap="truncate-end">
        <Text color={borderColor}>╭─</Text>
        <Text color={SECTION_TITLE} bold>{label}</Text>
        <Text color={borderColor}>{'─'.repeat(fill)}╮</Text>
      </Text>
      <Box
        flexDirection="column"
        flexGrow={1}
        borderStyle="round"
        borderTop={false}
        borderColor={borderColor}
        paddingX={1}
        overflow="hidden"
      >
        {children}
      </Box>
    </Box>
  );
}
