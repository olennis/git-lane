import React from 'react';
import {Box, Text, useInput} from 'ink';
import {getFileChanges, getFileDiff, type FileChange} from '../git/getFileChanges.js';
import type {GitCommit} from '../git/types.js';
import {parseDiffLines, type DiffLine, type DiffLineKind} from '../utils/diffLines.js';
import {formatDate} from '../utils/formatDate.js';
import {Section} from './Section.js';
import {ACCENT, SELECTED_BG} from './theme.js';

type Props = {
  commit: GitCommit;
  width: number;
  height: number;
  onClose: () => void;
};

type Focus = 'files' | 'diff';

// Below this width only one pane is shown at a time.
const SPLIT_MIN_COLUMNS = 100;
const HEADER_LINES = 2;

const STATUS_COLOR: Record<string, string> = {
  A: 'green',
  '?': 'green',
  D: 'red',
  M: 'yellow',
  R: 'cyan',
  C: 'cyan',
  T: 'magenta',
  U: 'redBright',
};

const LINE_COLOR: Record<DiffLineKind, string | undefined> = {
  add: 'green',
  del: 'red',
  hunk: 'cyan',
  meta: undefined,
  context: undefined,
};

function errorMessage(caught: unknown): string {
  return caught instanceof Error ? caught.message : String(caught);
}

// Keeps `index` inside a window of `size` rows that scrolls only when the cursor leaves it.
function windowStart(index: number, size: number, total: number): number {
  if (total <= size) return 0;
  return Math.min(Math.max(0, index - Math.floor(size / 2)), total - size);
}

function FileRow({file, selected, active, width}: {file: FileChange; selected: boolean; active: boolean; width: number}) {
  const stats = file.binary
    ? 'bin'
    : file.insertions === undefined
      ? ''
      : `+${file.insertions} -${file.deletions ?? 0}`;
  const path = file.oldPath ? `${file.oldPath} → ${file.path}` : file.path;
  const background = selected ? {backgroundColor: SELECTED_BG} : {};
  const statusColor = STATUS_COLOR[file.status];

  return (
    <Box width={width} columnGap={1}>
      <Text {...background} {...(statusColor ? {color: statusColor} : {})} bold>
        {selected ? (active ? '›' : '·') : ' '}
        {file.status}
      </Text>
      <Box flexGrow={1} flexShrink={1} overflow="hidden">
        <Text {...background} bold={selected && active} wrap="truncate-start">
          {path}
        </Text>
      </Box>
      {stats ? (
        <Box flexShrink={0}>
          <Text dimColor={!selected}>
            {file.binary ? stats : (
              <>
                <Text color="green">+{file.insertions}</Text> <Text color="red">-{file.deletions ?? 0}</Text>
              </>
            )}
          </Text>
        </Box>
      ) : null}
    </Box>
  );
}

function DiffRow({line}: {line: DiffLine}) {
  const color = LINE_COLOR[line.kind];
  return (
    <Text
      wrap="truncate-end"
      {...(color ? {color} : {})}
      bold={line.kind === 'meta' && line.text.startsWith('diff --git')}
      dimColor={line.kind === 'meta'}
    >
      {line.text || ' '}
    </Text>
  );
}

export function CommitInspector({commit, width, height, onClose}: Props) {
  const [files, setFiles] = React.useState<FileChange[]>();
  const [filesError, setFilesError] = React.useState<string>();
  const [fileCursor, setFileCursor] = React.useState(0);
  const [diff, setDiff] = React.useState<DiffLine[]>();
  const [diffError, setDiffError] = React.useState<string>();
  const [scroll, setScroll] = React.useState(0);
  const [focus, setFocus] = React.useState<Focus>('files');
  const diffRequest = React.useRef(0);

  const split = width >= SPLIT_MIN_COLUMNS;
  const paneHeight = Math.max(5, height - HEADER_LINES);
  // Section top line + bottom border.
  const visibleRows = Math.max(1, paneHeight - 2);
  const filesWidth = split ? Math.max(30, Math.min(56, Math.floor(width * 0.35))) : width;
  const diffWidth = split ? width - filesWidth - 1 : width;
  const selectedFile = files?.[fileCursor];
  const maxScroll = Math.max(0, (diff?.length ?? 0) - visibleRows);
  // The app's auto-refresh rebuilds commit objects every few seconds; keying effects on
  // identity strings keeps the open file list and scroll position from resetting.
  const commitKey = `${commit.kind ?? 'commit'}:${commit.hash}`;
  const fileKey = selectedFile ? `${selectedFile.oldPath ?? ''}:${selectedFile.path}` : '';
  const commitRef = React.useRef(commit);
  commitRef.current = commit;
  const selectedFileRef = React.useRef(selectedFile);
  selectedFileRef.current = selectedFile;

  React.useEffect(() => {
    let cancelled = false;
    setFiles(undefined);
    setFilesError(undefined);
    setFileCursor(0);

    getFileChanges(commitRef.current)
      .then(next => {
        if (!cancelled) setFiles(next);
      })
      .catch(caught => {
        if (!cancelled) setFilesError(errorMessage(caught));
      });

    return () => {
      cancelled = true;
    };
  }, [commitKey]);

  React.useEffect(() => {
    const file = selectedFileRef.current;
    if (!file) return;

    // Moving quickly through the list fires overlapping requests; only the latest may land.
    const request = ++diffRequest.current;
    setDiff(undefined);
    setDiffError(undefined);
    setScroll(0);

    getFileDiff(commitRef.current, file)
      .then(output => {
        if (request === diffRequest.current) setDiff(parseDiffLines(output));
      })
      .catch(caught => {
        if (request === diffRequest.current) setDiffError(errorMessage(caught));
      });
  }, [commitKey, fileKey, files]);

  const moveFile = (delta: number) => {
    if (!files || files.length === 0) return;
    setFileCursor(current => Math.min(files.length - 1, Math.max(0, current + delta)));
  };

  const scrollBy = (delta: number) => {
    setScroll(current => Math.min(maxScroll, Math.max(0, current + delta)));
  };

  useInput((input, key) => {
    if (input === 'q') {
      onClose();
      return;
    }

    if (focus === 'files') {
      if (key.escape || key.leftArrow) onClose();
      else if (key.upArrow || input === 'k') moveFile(-1);
      else if (key.downArrow || input === 'j') moveFile(1);
      else if (key.pageUp) moveFile(-visibleRows);
      else if (key.pageDown) moveFile(visibleRows);
      else if ((key.return || key.rightArrow || input === 'l') && selectedFile) setFocus('diff');
      return;
    }

    if (key.escape || key.leftArrow || input === 'h') setFocus('files');
    else if (key.upArrow || input === 'k') scrollBy(-1);
    else if (key.downArrow || input === 'j' || key.return) scrollBy(1);
    else if (key.pageUp || input === 'u') scrollBy(-visibleRows);
    else if (key.pageDown || input === ' ' || input === 'd') scrollBy(visibleRows);
    else if (key.home || input === 'g') setScroll(0);
    else if (key.end || input === 'G') setScroll(maxScroll);
    else if (input === 'n' || input === ']') moveFile(1);
    else if (input === 'p' || input === '[') moveFile(-1);
  });

  const byline = [commit.kind === 'worktree' ? 'working tree' : commit.shortHash, commit.author, formatDate(commit.timestamp)]
    .filter((value, index, all) => value && all.indexOf(value) === index)
    .join(' · ');

  const filesPane = (
    <Section title="Files" count={files?.length} width={filesWidth} height={paneHeight}>
      {filesError ? (
        <Text color="red" wrap="wrap">{filesError}</Text>
      ) : !files ? (
        <Text dimColor>Loading files…</Text>
      ) : files.length === 0 ? (
        <Text dimColor>No file changes.</Text>
      ) : (
        (() => {
          const start = windowStart(fileCursor, visibleRows, files.length);
          return files.slice(start, start + visibleRows).map((file, offset) => (
            <FileRow
              key={`${file.oldPath ?? ''}:${file.path}`}
              file={file}
              selected={start + offset === fileCursor}
              active={focus === 'files'}
              width={filesWidth - 4}
            />
          ));
        })()
      )}
    </Section>
  );

  const position = diff && diff.length > visibleRows
    ? `${scroll + 1}-${Math.min(diff.length, scroll + visibleRows)}/${diff.length}`
    : undefined;

  const diffPane = (
    <Section
      title={selectedFile ? `Diff  ${selectedFile.path}` : 'Diff'}
      count={position}
      width={diffWidth}
      height={paneHeight}
      borderColor={focus === 'diff' ? ACCENT : undefined}
    >
      {!selectedFile ? (
        <Text dimColor>Select a file.</Text>
      ) : diffError ? (
        <Text color="red" wrap="wrap">{diffError}</Text>
      ) : !diff ? (
        <Text dimColor>Loading diff…</Text>
      ) : diff.length === 0 ? (
        <Text dimColor>No textual changes (mode change or empty file).</Text>
      ) : (
        diff.slice(scroll, scroll + visibleRows).map((line, offset) => <DiffRow key={scroll + offset} line={line} />)
      )}
    </Section>
  );

  return (
    <Box flexDirection="column" width={width} height={height}>
      <Box paddingX={1} flexDirection="column">
        <Text bold color={ACCENT} wrap="truncate-end">{commit.subject}</Text>
        <Text dimColor wrap="truncate-end">{byline}</Text>
      </Box>
      {split ? (
        <Box flexDirection="row" columnGap={1}>
          {filesPane}
          {diffPane}
        </Box>
      ) : focus === 'files' ? (
        filesPane
      ) : (
        diffPane
      )}
    </Box>
  );
}
