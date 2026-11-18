import {spawn} from 'node:child_process';

export async function runGit(
  args: string[],
  cwd = process.cwd(),
  options: {okExitCodes?: number[]} = {},
): Promise<string> {
  const okExitCodes = options.okExitCodes ?? [0];

  return await new Promise((resolve, reject) => {
    const child = spawn('git', args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');

    child.stdout.on('data', chunk => {
      stdout += chunk;
    });

    child.stderr.on('data', chunk => {
      stderr += chunk;
    });

    child.on('error', reject);
    child.on('close', code => {
      if (code !== null && okExitCodes.includes(code)) {
        resolve(stdout);
        return;
      }

      reject(new Error(stderr.trim() || `git ${args.join(' ')} exited with ${code}`));
    });
  });
}
