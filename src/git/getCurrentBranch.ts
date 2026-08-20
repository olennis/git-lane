import {runGit} from './runGit.js';

export async function getCurrentBranch(cwd?: string): Promise<string> {
  return (await runGit(['branch', '--show-current'], cwd)).trim();
}
