import type {GitBranch} from './types.js';
import {runGit} from './runGit.js';

export async function getBranches(options: {cwd?: string; includeOrigins?: boolean} = {}): Promise<GitBranch[]> {
  const refPatterns = options.includeOrigins
    ? ['refs/heads/', 'refs/remotes/origin/']
    : ['refs/heads/'];
  const output = await runGit(
    ['for-each-ref', '--format=%(HEAD)%09%(refname:short)', ...refPatterns],
    options.cwd,
  );

  return output
    .split('\n')
    .filter(Boolean)
    .map(line => {
      const [head, name] = line.split('\t');
      return {
        name: name ?? '',
        current: head?.trim() === '*',
        remote: name?.startsWith('origin/') ?? false,
      };
    })
    .filter(branch => branch.name.length > 0)
    .filter(branch => branch.name !== 'origin/HEAD');
}
