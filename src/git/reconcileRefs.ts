import type {GitBranch} from './types.js';

/**
 * Keeps the selected refs valid after the repository changed underneath the TUI.
 *
 * - Refs that no longer exist (renamed or deleted branches) are dropped, otherwise
 *   `git log <ref>` fails and the refresh silently stalls on stale data.
 * - When HEAD moved to another branch (rename or checkout) and the previous current
 *   branch was being followed, the new current branch takes its place.
 * - `pinned` refs (e.g. the base branch passed on the CLI) are never swapped out
 *   while they still exist.
 */
export function reconcileRefs({
  refs,
  branches,
  previousCurrent,
  current,
  pinned,
}: {
  refs: Set<string>;
  branches: GitBranch[];
  previousCurrent: string;
  current: string;
  pinned?: string | undefined;
}): Set<string> {
  const existing = new Set(branches.map(branch => branch.name));
  const next = new Set([...refs].filter(ref => existing.has(ref)));

  const followedCurrent = previousCurrent !== '' && refs.has(previousCurrent);
  const currentChanged = current !== '' && current !== previousCurrent;

  if (currentChanged && followedCurrent) {
    if (previousCurrent !== pinned) {
      next.delete(previousCurrent);
      next.delete(`origin/${previousCurrent}`);
    }

    next.add(current);
    if (refs.has(`origin/${previousCurrent}`) && existing.has(`origin/${current}`)) {
      next.add(`origin/${current}`);
    }
  }

  if (next.size === 0 && current !== '') next.add(current);

  return next;
}

export function sameRefs(a: Set<string>, b: Set<string>): boolean {
  return a.size === b.size && [...a].every(ref => b.has(ref));
}
