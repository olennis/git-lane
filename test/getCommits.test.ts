import assert from 'node:assert/strict';
import test from 'node:test';
import {parseShortStat} from '../src/git/getCommits.js';

test('parses git --shortstat summaries', () => {
  assert.deepEqual(parseShortStat(' 3 files changed, 192 insertions(+), 2 deletions(-)'), {
    filesChanged: 3,
    insertions: 192,
    deletions: 2,
  });
  assert.deepEqual(parseShortStat(' 1 file changed, 1 deletion(-)'), {
    filesChanged: 1,
    insertions: 0,
    deletions: 1,
  });
});

test('returns undefined when git prints no stat line (e.g. merge commits)', () => {
  assert.equal(parseShortStat(''), undefined);
});
