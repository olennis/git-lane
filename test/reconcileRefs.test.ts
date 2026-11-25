import assert from 'node:assert/strict';
import test from 'node:test';
import {reconcileRefs} from '../src/git/reconcileRefs.js';
import type {GitBranch} from '../src/git/types.js';

function branches(...names: string[]): GitBranch[] {
  return names.map(name => ({name, current: false, remote: name.startsWith('origin/')}));
}

test('follows a renamed current branch', () => {
  const next = reconcileRefs({
    refs: new Set(['feat/old']),
    branches: branches('main', 'feat/new'),
    previousCurrent: 'feat/old',
    current: 'feat/new',
  });
  assert.deepEqual([...next], ['feat/new']);
});

test('follows a checkout to another branch but keeps other selected refs', () => {
  const next = reconcileRefs({
    refs: new Set(['feat/a', 'main']),
    branches: branches('main', 'feat/a', 'feat/b'),
    previousCurrent: 'feat/a',
    current: 'feat/b',
  });
  assert.deepEqual([...next].sort(), ['feat/b', 'main']);
});

test('keeps the pinned base branch when HEAD leaves it', () => {
  const next = reconcileRefs({
    refs: new Set(['main']),
    branches: branches('main', 'feat/b'),
    previousCurrent: 'main',
    current: 'feat/b',
    pinned: 'main',
  });
  assert.deepEqual([...next].sort(), ['feat/b', 'main']);
});

test('drops refs that no longer exist and swaps the origin counterpart', () => {
  const next = reconcileRefs({
    refs: new Set(['feat/old', 'origin/feat/old', 'gone']),
    branches: branches('feat/new', 'origin/feat/old', 'origin/feat/new'),
    previousCurrent: 'feat/old',
    current: 'feat/new',
  });
  assert.deepEqual([...next].sort(), ['feat/new', 'origin/feat/new']);
});

test('leaves refs untouched when nothing changed', () => {
  const refs = new Set(['main', 'feat/a']);
  const next = reconcileRefs({refs, branches: branches('main', 'feat/a'), previousCurrent: 'main', current: 'main'});
  assert.deepEqual([...next], ['main', 'feat/a']);
});

test('does not follow HEAD when the user deselected the current branch', () => {
  const next = reconcileRefs({
    refs: new Set(['main']),
    branches: branches('main', 'feat/a', 'feat/b'),
    previousCurrent: 'feat/a',
    current: 'feat/b',
  });
  assert.deepEqual([...next], ['main']);
});
