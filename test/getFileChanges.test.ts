import assert from 'node:assert/strict';
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {getFileChanges, getFileDiff, parseNameStatus, parseNumstat} from '../src/git/getFileChanges.js';
import {runGit} from '../src/git/runGit.js';
import {WORKTREE_COMMIT_HASH} from '../src/git/getWorktreeCommit.js';
import type {GitCommit} from '../src/git/types.js';
import {parseDiffLines} from '../src/utils/diffLines.js';

test('parses --name-status -z including renames', () => {
  assert.deepEqual(parseNameStatus('M\0src/a.ts\0R087\0old name.ts\0new name.ts\0A\0b.ts\0'), [
    {status: 'M', path: 'src/a.ts'},
    {status: 'R', path: 'new name.ts', oldPath: 'old name.ts'},
    {status: 'A', path: 'b.ts'},
  ]);
});

test('parses --numstat -z including renames and binaries', () => {
  const stats = parseNumstat('3\t1\tsrc/a.ts\0' + '2\t0\t\0old.ts\0new.ts\0' + '-\t-\timg.png\0');
  assert.deepEqual(stats.get('src/a.ts'), {insertions: 3, deletions: 1});
  assert.deepEqual(stats.get('new.ts'), {insertions: 2, deletions: 0});
  assert.deepEqual(stats.get('img.png'), {binary: true});
});

test('classifies diff lines and treats ---/+++ inside hunks as content', () => {
  const lines = parseDiffLines(
    ['diff --git a/x b/x', '--- a/x', '+++ b/x', '@@ -1,2 +1,2 @@', ' same', '--- removed', '+++ added', '\tx'].join('\n') + '\n',
  );
  assert.deepEqual(
    lines.map(line => line.kind),
    ['meta', 'meta', 'meta', 'hunk', 'context', 'del', 'add', 'context'],
  );
  assert.equal(lines.at(-1)?.text, '    x');
  assert.deepEqual(parseDiffLines(''), []);
});

async function makeRepo(): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), 'git-lane-diff-'));
  await runGit(['init', '-q', '-b', 'main'], dir);
  await runGit(['config', 'user.email', 'test@example.com'], dir);
  await runGit(['config', 'user.name', 'Test'], dir);
  await runGit(['config', 'commit.gpgsign', 'false'], dir);
  return dir;
}

function commitOf(hash: string): GitCommit {
  return {hash, shortHash: hash.slice(0, 7), parents: [], refs: [], author: '', timestamp: 0, subject: ''};
}

const worktree: GitCommit = {...commitOf(WORKTREE_COMMIT_HASH), kind: 'worktree'};

test('lists and diffs files for commits and the working tree', async () => {
  const dir = await makeRepo();
  try {
    mkdirSync(join(dir, 'src'));
    writeFileSync(join(dir, 'src', 'keep.ts'), 'export const a = 1;\nexport const long = "' + 'x'.repeat(40) + '";\n');
    writeFileSync(join(dir, 'README.md'), 'hello\n');
    await runGit(['add', '.'], dir);
    await runGit(['commit', '-q', '-m', 'root'], dir);
    const root = (await runGit(['rev-parse', 'HEAD'], dir)).trim();

    // Root commit: everything is an add.
    const rootFiles = await getFileChanges(commitOf(root), {cwd: dir});
    assert.deepEqual(rootFiles.map(file => `${file.status} ${file.path}`).sort(), ['A README.md', 'A src/keep.ts']);

    await runGit(['mv', 'src/keep.ts', 'src/renamed.ts'], dir);
    writeFileSync(join(dir, 'README.md'), 'hello\nworld\n');
    await runGit(['commit', '-q', '-am', 'rename'], dir);
    const second = (await runGit(['rev-parse', 'HEAD'], dir)).trim();

    const files = await getFileChanges(commitOf(second), {cwd: join(dir, 'src')});
    const rename = files.find(file => file.status === 'R');
    assert.deepEqual(rename && {path: rename.path, oldPath: rename.oldPath}, {path: 'src/renamed.ts', oldPath: 'src/keep.ts'});
    const readme = files.find(file => file.path === 'README.md');
    assert.deepEqual(readme && {insertions: readme.insertions, deletions: readme.deletions}, {insertions: 1, deletions: 0});

    // Running from a subdirectory must still resolve root-relative paths.
    const readmeDiff = await getFileDiff(commitOf(second), readme!, {cwd: join(dir, 'src')});
    assert.match(readmeDiff, /^\+world$/m);
    const renameDiff = await getFileDiff(commitOf(second), rename!, {cwd: dir});
    assert.match(renameDiff, /rename from src\/keep\.ts/);

    // Working tree: a modified tracked file plus an untracked one.
    writeFileSync(join(dir, 'README.md'), 'changed\n');
    writeFileSync(join(dir, 'src', 'new.ts'), 'fresh\n');
    const worktreeFiles = await getFileChanges(worktree, {cwd: join(dir, 'src')});
    assert.deepEqual(worktreeFiles.map(file => `${file.status} ${file.path}`), ['M README.md', '? src/new.ts']);

    const untrackedDiff = await getFileDiff(worktree, worktreeFiles[1]!, {cwd: join(dir, 'src')});
    assert.match(untrackedDiff, /^\+fresh$/m);
    const trackedDiff = await getFileDiff(worktree, worktreeFiles[0]!, {cwd: dir});
    assert.match(trackedDiff, /^-world$/m);
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
});

test('compares merge commits against their first parent', async () => {
  const dir = await makeRepo();
  try {
    writeFileSync(join(dir, 'a.txt'), 'a\n');
    await runGit(['add', '.'], dir);
    await runGit(['commit', '-q', '-m', 'root'], dir);
    await runGit(['checkout', '-q', '-b', 'side'], dir);
    writeFileSync(join(dir, 'side.txt'), 'side\n');
    await runGit(['add', '.'], dir);
    await runGit(['commit', '-q', '-m', 'side'], dir);
    await runGit(['checkout', '-q', 'main'], dir);
    writeFileSync(join(dir, 'main.txt'), 'main\n');
    await runGit(['add', '.'], dir);
    await runGit(['commit', '-q', '-m', 'main'], dir);
    await runGit(['merge', '-q', '--no-edit', 'side'], dir);
    const merge = (await runGit(['rev-parse', 'HEAD'], dir)).trim();

    const files = await getFileChanges(commitOf(merge), {cwd: dir});
    assert.deepEqual(files.map(file => `${file.status} ${file.path}`), ['A side.txt']);
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
});
