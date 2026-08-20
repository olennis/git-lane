# Git Lane

A focused Git lane TUI for local development.

The default view starts from the current branch. It also starts in **FOCUSED** history mode, which follows first-parent history so unrelated merged branches do not explode the graph into dozens of lanes.

## Run locally

```bash
pnpm install
pnpm dev
```

Use another base branch:

```bash
pnpm dev -- --base develop
```

## Keyboard

- `↑` / `↓` / `←` / `→` or `j` / `k`: move through commits
- `Enter`: commit details
- `b`: choose visible branch refs
- `Space`: toggle a branch in the filter
- `Enter` in branch filter: apply selected branches
- `Esc` in branch filter: cancel
- `f`: toggle **FOCUSED / FULL** history
- `h`: toggle vertical/horizontal graph view
- `o`: toggle origin branches on/off
- `r`: refresh
- `q`: quit

### Focused vs Full

**FOCUSED** is the default. It follows the first-parent history of the selected refs and filters parent edges that are outside the visible revision set. This is intended for the common “base branch + my working branch” view.

**FULL** traverses all parents of the selected refs, so merged side branches are visible as well.

## Install as a local command

From npm:

```bash
pnpm add --global @olennis/git-lane
```

For local development:

```bash
pnpm build
pnpm link --global
```

Then, inside any Git repository:

```bash
git-lane
```

Short alias:

```bash
gln
```

The graph renderer is implemented from commit/parent data rather than parsing `git log --graph`, keeping Git I/O and terminal rendering independently testable.
