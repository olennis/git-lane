#!/usr/bin/env node
import React from 'react';
import {render} from 'ink';
import {App} from './App.js';

function readBaseBranch(argv: string[]): string | undefined {
  const index = argv.indexOf('--base');
  if (index === -1) return undefined;
  return argv[index + 1];
}

const baseBranch = readBaseBranch(process.argv.slice(2));
render(baseBranch ? <App baseBranch={baseBranch} /> : <App />);
