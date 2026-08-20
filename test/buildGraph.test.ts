import assert from 'node:assert/strict';
import test from 'node:test';
import {buildGraph} from '../src/graph/buildGraph.js';
import type {GitCommit} from '../src/git/types.js';

function commit(hash: string, parents: string[] = []): GitCommit {
  return {
    hash,
    shortHash: hash,
    parents,
    refs: [],
    author: 'tester',
    timestamp: 0,
    subject: hash,
  };
}

function line(segments: Array<{char: string}> | undefined): string | undefined {
  return segments?.map(segment => segment.char).join('');
}

test('keeps a linear history in one lane without redundant connector rows', () => {
  const rows = buildGraph([
    commit('c3', ['c2']),
    commit('c2', ['c1']),
    commit('c1'),
  ]);

  assert.deepEqual(rows.map(row => row.lane), [0, 0, 0]);
  assert.deepEqual(rows.map(row => line(row.nodeSegments)), ['●', '●', '●']);
  assert.ok(rows.every(row => row.edgeSegments === undefined));
});

test('opens a second lane for a merge parent', () => {
  const rows = buildGraph([
    commit('m', ['a', 'b']),
    commit('a', ['root']),
    commit('b', ['root']),
    commit('root'),
  ]);

  assert.equal(line(rows[0]?.nodeSegments), '●');
  assert.equal(line(rows[0]?.edgeSegments), '├─╮');
  assert.equal(line(rows[1]?.nodeSegments), '● │');
  assert.equal(line(rows[2]?.nodeSegments), '│ ●');
  assert.equal(line(rows[2]?.edgeSegments), '├─╯');
  assert.equal(line(rows[3]?.nodeSegments), '●');
});

test('preserves lane identity on rendered segments', () => {
  const rows = buildGraph([
    commit('m', ['a', 'b']),
    commit('a', ['root']),
    commit('b', ['root']),
    commit('root'),
  ]);

  assert.equal(rows[1]?.nodeSegments[0]?.colorLane, 0);
  assert.equal(rows[1]?.nodeSegments[2]?.colorLane, 1);
});
