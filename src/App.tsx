import React from 'react';
import {Box, Text, useApp, useInput} from 'ink';
import {fetchOrigin} from './git/fetchOrigin.js';
import {getBranches} from './git/getBranches.js';
import {getCommits} from './git/getCommits.js';
import {getCurrentBranch} from './git/getCurrentBranch.js';
import type {GitBranch, GitCommit} from './git/types.js';
import {buildGraph} from './graph/buildGraph.js';
import {BranchFilter} from './ui/BranchFilter.js';
import {CommitDetails} from './ui/CommitDetails.js';
import {GraphView, HorizontalGraphView} from './ui/GraphView.js';

type Props = {
  baseBranch?: string;
};

type Mode = 'graph' | 'branches' | 'details';

const AUTO_REFRESH_INTERVAL_MS = 15_000;

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

export function App({baseBranch}: Props) {
  const {exit} = useApp();
  const terminalColumns = process.stdout.columns ?? 100;
  const terminalRows = process.stdout.rows ?? 30;
  const [branches, setBranches] = React.useState<GitBranch[]>([]);
  const [selectedRefs, setSelectedRefs] = React.useState<Set<string>>(new Set());
  const [commits, setCommits] = React.useState<GitCommit[]>([]);
  const [cursor, setCursor] = React.useState(0);
  const [mode, setMode] = React.useState<Mode>('graph');
  const [focusedHistory, setFocusedHistory] = React.useState(true);
  const [showOrigin, setShowOrigin] = React.useState(false);
  const [horizontalView, setHorizontalView] = React.useState(false);
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

        const [branchList, nextCommits] = await Promise.all([
          getBranches({includeOrigins}),
          getCommits([...refs], {firstParent: focused}),
        ]);
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

      setBranches(branchList);
      setSelectedRefs(nextRefs);
      setCommits(await getCommits([...nextRefs], {firstParent: true}));
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
    if (input === 'h') setHorizontalView(current => !current);
    if (input === 'r') void loadCommits(selectedRefs, focusedHistory);
    if (input === 'o') {
      const nextShowOrigin = !showOrigin;

      setShowOrigin(nextShowOrigin);
      setLoading(true);
      setError(undefined);

      void (async () => {
        try {
          if (nextShowOrigin) await fetchOrigin();

          const branchList = await getBranches({includeOrigins: nextShowOrigin});
          const nextRefs = nextShowOrigin
            ? withOriginCounterparts(selectedRefs, branchList)
            : removeOriginRefs(selectedRefs);

          setBranches(branchList);
          setSelectedRefs(nextRefs);
          setCommits(await getCommits([...nextRefs], {firstParent: focusedHistory}));
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
  const splitView = horizontalView && terminalColumns >= 70;
  const graphPaneWidth = splitView
    ? Math.min(Math.max(20, Math.floor(terminalColumns * 0.6)), Math.max(20, terminalColumns - 20))
    : terminalColumns;
  const detailsPaneWidth = splitView ? Math.max(0, terminalColumns - graphPaneWidth) : terminalColumns;
  const contentHeight = Math.max(6, terminalRows - 4);

  if (loading) return <Text>Loading git graph…</Text>;
  if (error) return <Text color="red">{error}</Text>;

  return (
    <Box flexDirection="column">
      <Box justifyContent="space-between" borderStyle="round" paddingX={1}>
        <Text bold>Git Lane</Text>
        <Text>
          <Text color={focusedHistory ? 'cyan' : 'yellow'}>
            {focusedHistory ? 'FOCUSED' : 'FULL'}
          </Text>
          {'  '}
          <Text color={showOrigin ? 'cyan' : 'gray'}>
            origin {showOrigin ? 'ON' : 'OFF'}
          </Text>
          {'  '}
          <Text color={horizontalView ? 'cyan' : 'gray'}>
            view {horizontalView ? 'H' : 'V'}
          </Text>
          {'  '}
          <Text dimColor>refs </Text>
          <Text color="green">{[...selectedRefs].join(', ') || 'none'}</Text>
        </Text>
      </Box>

      {mode === 'branches' ? (
        <BranchFilter
          branches={branches}
          selected={selectedRefs}
          height={contentHeight}
          onApply={next => {
            setSelectedRefs(next);
            setMode('graph');
            void loadCommits(next, focusedHistory);
          }}
          onClose={() => setMode('graph')}
        />
      ) : mode === 'details' && currentCommit ? (
        <CommitDetails commit={currentCommit} onClose={() => setMode('graph')} />
      ) : splitView && currentCommit ? (
        <Box flexDirection="row" flexWrap="nowrap">
          <Box width={graphPaneWidth} flexShrink={0}>
            <HorizontalGraphView
              rows={rows}
              selectedRefs={selectedRefs}
              showOrigin={showOrigin}
              width={graphPaneWidth}
              cursor={cursor}
              onCursorChange={setCursor}
              onOpenDetails={() => currentCommit && setMode('details')}
            />
          </Box>
          <CommitDetails commit={currentCommit} width={detailsPaneWidth} showHelp={false} />
        </Box>
      ) : (
        <GraphView
          rows={rows}
          selectedRefs={selectedRefs}
          showOrigin={showOrigin}
          width={terminalColumns}
          cursor={cursor}
          onCursorChange={setCursor}
          onOpenDetails={() => currentCommit && setMode('details')}
        />
      )}

      <Box borderStyle="round" paddingX={1}>
        <Text dimColor>
          ↑↓/←→/jk move · Enter details · b branches · f focused/full · h view · o origin · r refresh · q quit
        </Text>
      </Box>
    </Box>
  );
}
