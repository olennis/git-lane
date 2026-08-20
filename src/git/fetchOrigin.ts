import {runGit} from './runGit.js';

export async function fetchOrigin(cwd?: string): Promise<void> {
  await runGit(['fetch', '--prune', 'origin'], cwd);
}
