import React from 'react';
import {Box, Text, useApp, useInput, useWindowSize} from 'ink';
import {fetchOrigin} from './git/fetchOrigin.js';
import {getBranches} from './git/getBranches.js';
import {getCommits} from './git/getCommits.js';
import {getCurrentBranch} from './git/getCurrentBranch.js';
import {getWorktreeCommit} from './git/getWorktreeCommit.js';
import type {GitBranch, GitCommit} from './git/types.js';
import {buildGraph} from './graph/buildGraph.js';
import {BranchFilter} from './ui/BranchFilter.js';
import {CommandPrompt} from './ui/CommandPrompt.js';
import {CommitDetails} from './ui/CommitDetails.js';
import {CommitInspector} from './ui/CommitInspector.js';
import {GraphView, HorizontalGraphView} from './ui/GraphView.js';
import {KeyHints} from './ui/KeyHints.js';
import {Section} from './ui/Section.js';
import {ACCENT} from './ui/theme.js';

type Props = {
  baseBranch?: string;
};

type Mode = 'graph' | 'branches' | 'details' | 'command';

const AUTO_REFRESH_INTERVAL_MS = 15_000;
// Below this width the details pane moves under the graph instead of beside it.
const NARROW_COLUMNS = 100;
const DETAILS_WIDTH = 44;
const DETAILS_HEIGHT = 9;
const KEY_HINTS: Array<[string, string]> = [
  ['↑↓', 'move'],
  ['⏎', 'files/diff'],
  ['d', 'pane'],
  ['b', 'branches'],
  [':', 'command'],
  ['f', 'focused/full'],
  ['h', 'view'],
  ['o', 'origin'],
  ['r', 'refresh'],
  ['q', 'quit'],
];

const INSPECTOR_KEY_HINTS: Array<[string, string]> = [
  ['↑↓', 'file / scroll'],
  ['⏎ →', 'open diff'],
  ['space u', 'page'],
  ['g G', 'top/end'],
  ['n p', 'next/prev file'],
  ['Esc ←', 'back'],
  ['q', 'close'],
];

function chooseInitialRefs(branches: GitBranch[], current: string, requested?: string): Set<string> {
  const refs = new Set<string>();
  if (current) refs.add(current);
  if (requested && branches.some(branch => branch.name === requested)) refs.add(requested);

  return refs;
}

function originRef(ref: string): string {
  return ref.startsWith('origin/') ? ref : `origin/${ref}`;
}

function removeOriginRefs(refs: Set<string>): Set<string> {
  return new Set([...refs].filter(ref => !ref.startsWith('origin/')));
}

function withOriginCounterparts(refs: Set<string>, branches: GitBranch[]): Set<string> {
  const branchNames = new Set(branches.map(branch => branch.name));
  const next = new Set(refs);

  for (const ref of refs) {
    if (ref.startsWith('origin/')) continue;

    const remote = originRef(ref);
    if (branchNames.has(remote)) next.add(remote);
  }

  return next;
}

async function withWorktreeCommit(
  commits: GitCommit[],
  refs: Set<string>,
  currentBranch: string,
): Promise<GitCommit[]> {
  if (!currentBranch || !refs.has(currentBranch)) return commits;

  const worktreeCommit = await getWorktreeCommit(currentBranch);
  if (!worktreeCommit) return commits;

  const visibleHashes = new Set(commits.map(commit => commit.hash));

  return [
    {
      ...worktreeCommit,
      parents: worktreeCommit.parents.filter(parent => visibleHashes.has(parent)),
    },
    ...commits,
  ];
}

export function App({baseBranch}: Props) {
  const {exit} = useApp();
  const {columns: terminalColumns, rows: terminalRows} = useWindowSize();
  const [branches, setBranches] = React.useState<GitBranch[]>([]);
  const [selectedRefs, setSelectedRefs] = React.useState<Set<string>>(new Set());
  const [commits, setCommits] = React.useState<GitCommit[]>([]);
  const [cursor, setCursor] = React.useState(0);
  const [mode, setMode] = React.useState<Mode>('graph');
  const [focusedHistory, setFocusedHistory] = React.useState(true);
  const [showOrigin, setShowOrigin] = React.useState(false);
  const [horizontalView, setHorizontalView] = React.useState(false);
  const [showDetails, setShowDetails] = React.useState(true);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string>();
  const refreshing = React.useRef(false);

  const refreshData = React.useCallback(
    async ({
      refs,
      focused,
      includeOrigins,
      fetchRemote,
      visibleLoading,
      preserveCursor,
    }: {
      refs: Set<string>;
      focused: boolean;
      includeOrigins: boolean;
      fetchRemote: boolean;
      visibleLoading: boolean;
      preserveCursor: boolean;
    }) => {
      if (refreshing.current) return;
      refreshing.current = true;
      if (visibleLoading) {
        setLoading(true);
        setError(undefined);
      }

      try {
        if (fetchRemote) await fetchOrigin();

        const [branchList, rawCommits, currentBranch] = await Promise.all([
          getBranches({includeOrigins}),
          getCommits([...refs], {firstParent: focused}),
          getCurrentBranch(),
        ]);
        const nextCommits = await withWorktreeCommit(rawCommits, refs, currentBranch);
        const currentHash = preserveCursor ? commits[cursor]?.hash : undefined;

        setBranches(branchList);
        setCommits(nextCommits);
        setCursor(current => {
          if (!preserveCursor || !currentHash) return 0;

          const nextCursor = nextCommits.findIndex(commit => commit.hash === currentHash);
          if (nextCursor !== -1) return nextCursor;

          return Math.min(current, Math.max(0, nextCommits.length - 1));
        });
      } catch (caught) {
        if (visibleLoading) setError(caught instanceof Error ? caught.message : String(caught));
      } finally {
        refreshing.current = false;
        if (visibleLoading) setLoading(false);
      }
    },
    [commits, cursor],
  );

  const loadCommits = React.useCallback(
    async (refs: Set<string>, focused: boolean) => {
      await refreshData({
        refs,
        focused,
        includeOrigins: showOrigin,
        fetchRemote: showOrigin,
        visibleLoading: true,
        preserveCursor: false,
      });
    },
    [refreshData, showOrigin],
  );

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(undefined);

      const branchList = await getBranches();
      const current = await getCurrentBranch();
      const nextRefs = chooseInitialRefs(branchList, current, baseBranch);
      const rawCommits = await getCommits([...nextRefs], {firstParent: true});

      setBranches(branchList);
      setSelectedRefs(nextRefs);
      setCommits(await withWorktreeCommit(rawCommits, nextRefs, current));
      setCursor(0);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  }, [baseBranch]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    if (loading || selectedRefs.size === 0) return;

    const timer = setInterval(() => {
      void refreshData({
        refs: selectedRefs,
        focused: focusedHistory,
        includeOrigins: showOrigin,
        fetchRemote: showOrigin,
        visibleLoading: false,
        preserveCursor: true,
      });
    }, AUTO_REFRESH_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [focusedHistory, loading, refreshData, selectedRefs, showOrigin]);

  useInput(input => {
    if (mode !== 'graph') return;

    if (input === 'q') exit();
    if (input === 'b') setMode('branches');
    if (input === ':') setMode('command');
    if (input === 'h') setHorizontalView(current => !current);
    if (input === 'd') setShowDetails(current => !current);
    if (input === 'r') void loadCommits(selectedRefs, focusedHistory);
    if (input === 'o') {
      const nextShowOrigin = !showOrigin;

      setShowOrigin(nextShowOrigin);
      setLoading(true);
      setError(undefined);

      void (async () => {
        try {
          if (nextShowOrigin) await fetchOrigin();

          const [branchList, currentBranch] = await Promise.all([
            getBranches({includeOrigins: nextShowOrigin}),
            getCurrentBranch(),
          ]);
          const nextRefs = nextShowOrigin
            ? withOriginCounterparts(selectedRefs, branchList)
            : removeOriginRefs(selectedRefs);
          const rawCommits = await getCommits([...nextRefs], {firstParent: focusedHistory});

          setBranches(branchList);
          setSelectedRefs(nextRefs);
          setCommits(await withWorktreeCommit(rawCommits, nextRefs, currentBranch));
          setCursor(0);
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : String(caught));
        } finally {
          setLoading(false);
        }
      })();
    }

    if (input === 'f') {
      const next = !focusedHistory;
      setFocusedHistory(next);
      void loadCommits(selectedRefs, next);
    }
  });

  const rows = React.useMemo(() => buildGraph(commits), [commits]);
  const currentCommit = rows[cursor]?.commit;
  // Title, meta and key-hint lines, plus one spare row so Ink never fills the whole screen.
  const bodyHeight = Math.max(8, terminalRows - 4);
  const detailsBeside = showDetails && currentCommit !== undefined && terminalColumns >= NARROW_COLUMNS;
  const detailsBelow = showDetails && currentCommit !== undefined && !detailsBeside;
  const graphPaneWidth = detailsBeside ? terminalColumns - DETAILS_WIDTH - 1 : terminalColumns;
  const graphPaneHeight = detailsBelow ? Math.max(5, bodyHeight - DETAILS_HEIGHT) : bodyHeight;
  // Section border (2) and horizontal padding (2) around the graph.
  const graphWidth = Math.max(10, graphPaneWidth - 4);
  const graphHeight = Math.max(3, graphPaneHeight - 2);

  if (loading) return <Text>Loading git graph…</Text>;
  if (error) return <Text color="red">{error}</Text>;

  const refs = [...selectedRefs].join(', ');

  return (
    <Box flexDirection="column" width={terminalColumns}>
      <Box paddingX={1}>
        <Text wrap="truncate-end">
          <Text color={ACCENT} bold>✦ Git Lane</Text>
          {'  '}
          <Text bold>{commits.length}</Text>
          <Text dimColor> commits</Text>
        </Text>
      </Box>
      <Box paddingX={2}>
        <Text wrap="truncate-end">
          <Text dimColor>mode </Text>
          <Text bold color={focusedHistory ? 'white' : 'yellow'}>{focusedHistory ? 'FOCUSED' : 'FULL'}</Text>
          <Text dimColor>   origin </Text>
          <Text bold>{showOrigin ? 'ON' : 'OFF'}</Text>
          <Text dimColor>   view </Text>
          <Text bold>{horizontalView ? 'H' : 'V'}</Text>
          <Text dimColor>   refs </Text>
          {refs ? <Text color="green">● </Text> : null}
          <Text bold>{refs || 'none'}</Text>
        </Text>
      </Box>

      {mode === 'branches' ? (
        <BranchFilter
          branches={branches}
          selected={selectedRefs}
          width={terminalColumns}
          height={bodyHeight}
          onApply={next => {
            setSelectedRefs(next);
            setMode('graph');
            void loadCommits(next, focusedHistory);
          }}
          onClose={() => setMode('graph')}
        />
      ) : mode === 'details' && currentCommit ? (
        <CommitInspector
          commit={currentCommit}
          width={terminalColumns}
          height={bodyHeight}
          onClose={() => setMode('graph')}
        />
      ) : mode === 'command' ? (
        <CommandPrompt width={terminalColumns} height={bodyHeight} onClose={() => setMode('graph')} />
      ) : (
        <Box flexDirection={detailsBeside ? 'row' : 'column'} columnGap={1} height={bodyHeight}>
          <Section title="Commits" count={commits.length} width={graphPaneWidth} height={graphPaneHeight}>
            {horizontalView ? (
              <HorizontalGraphView
                rows={rows}
                selectedRefs={selectedRefs}
                showOrigin={showOrigin}
                width={graphWidth}
                cursor={cursor}
                onCursorChange={setCursor}
                onOpenDetails={() => currentCommit && setMode('details')}
              />
            ) : (
              <GraphView
                rows={rows}
                selectedRefs={selectedRefs}
                showOrigin={showOrigin}
                width={graphWidth}
                height={graphHeight}
                cursor={cursor}
                onCursorChange={setCursor}
                onOpenDetails={() => currentCommit && setMode('details')}
              />
            )}
          </Section>
          {currentCommit && (detailsBeside || detailsBelow) ? (
            <CommitDetails
              commit={currentCommit}
              width={detailsBeside ? DETAILS_WIDTH : terminalColumns}
              height={detailsBeside ? bodyHeight : DETAILS_HEIGHT}
              showHelp={false}
            />
          ) : null}
        </Box>
      )}

      <Box paddingX={1}>
        <KeyHints hints={mode === 'details' ? INSPECTOR_KEY_HINTS : KEY_HINTS} />
      </Box>
    </Box>
  );
}
