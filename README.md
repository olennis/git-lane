# Git Lane

A focused Git lane TUI for local development.

## Screenshots

<p>
  <img src="./assets/git-lane-screenshot.svg" alt="Git Lane focused commit graph" width="49%">
  <img src="./assets/git-lane-full-view.svg" alt="Git Lane full history mode" width="49%">
</p>
<p>
  <img src="./assets/git-lane-branch-filter.svg" alt="Git Lane branch filter" width="49%">
  <img src="./assets/git-lane-horizontal-view.svg" alt="Git Lane horizontal graph view" width="49%">
</p>
<p>
  <img src="./assets/git-lane-commit-details.svg" alt="Git Lane commit details panel" width="49%">
</p>

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
- `Enter`: open the commit's changed files and diffs
- `d`: toggle the side details pane
- `b`: choose visible branch refs
- `:`: open command prompt
- `Space`: toggle a branch in the filter
- `Enter` in branch filter: apply selected branches
- `Esc` in branch filter: cancel
- `f`: toggle **FOCUSED / FULL** history
- `h`: toggle vertical/horizontal graph view
- `o`: toggle origin branches on/off
- `r`: refresh
- `q`: quit

### Files and diffs

`Enter` on a commit lists its changed files (with `+/-` line counts) next to a diff preview of the selected file.
On narrow terminals (< 100 columns) only one pane is shown at a time.
The uncommitted worktree row diffs against `HEAD` and includes untracked files; merge commits are compared against their first parent.

- `↑` / `↓` or `j` / `k`: pick a file (file list) or scroll (diff)
- `Enter` / `→`: focus the diff, `Esc` / `←`: back to the file list
- `Space` / `u`: page down/up, `g` / `G`: top/bottom
- `n` / `p`: next/previous file while reading a diff
- `q`: back to the graph

### Command prompt

Press `:` while viewing the graph to run shell commands from inside `gln`.
Commands run in the current working directory and their output appears in the prompt.
Use `cd <path>` to change the prompt directory, `clear` to reset prompt output, `exit` or `Esc` to return to the graph.

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
