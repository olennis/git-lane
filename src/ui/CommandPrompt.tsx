import {spawn} from 'node:child_process';
import {statSync} from 'node:fs';
import {homedir} from 'node:os';
import path from 'node:path';
import React from 'react';
import {Text, useInput} from 'ink';
import {Section} from './Section.js';
import {ACCENT} from './theme.js';

type Props = {
  height?: number;
  width?: number;
  onClose: () => void;
};

type CommandResult = {
  command: string;
  cwd: string;
  exitCode: number | null;
  output: string;
};

const MAX_OUTPUT_CHARS = 20_000;

function truncateOutput(output: string): string {
  if (output.length <= MAX_OUTPUT_CHARS) return output;

  return `[output truncated]\n${output.slice(output.length - MAX_OUTPUT_CHARS)}`;
}

function printableInput(input: string): boolean {
  return input.length > 0 && !input.includes('\u001B') && !input.includes('\r') && !input.includes('\n');
}

function resolveCdTarget(cwd: string, target: string | undefined): string {
  if (!target || target === '~') return homedir();
  if (target.startsWith('~/')) return path.join(homedir(), target.slice(2));
  return path.resolve(cwd, target);
}

export function CommandPrompt({height, width, onClose}: Props) {
  const [cwd, setCwd] = React.useState(process.cwd());
  const [command, setCommand] = React.useState('');
  const [running, setRunning] = React.useState(false);
  const [history, setHistory] = React.useState<CommandResult[]>([]);
  const outputRows = Math.max(3, (height ?? process.stdout.rows ?? 20) - 6);

  const appendResult = React.useCallback((result: CommandResult) => {
    setHistory(current => [...current.slice(-5), result]);
  }, []);

  const runCommand = React.useCallback(
    (nextCommand: string) => {
      const trimmed = nextCommand.trim();
      if (!trimmed || running) return;

      if (trimmed === 'exit') {
        onClose();
        return;
      }

      if (trimmed === 'clear') {
        setHistory([]);
        return;
      }

      if (trimmed === 'pwd') {
        appendResult({command: trimmed, cwd, exitCode: 0, output: cwd});
        return;
      }

      if (trimmed === 'cd' || trimmed.startsWith('cd ')) {
        const target = trimmed === 'cd' ? undefined : trimmed.slice(3).trim();
        const nextCwd = resolveCdTarget(cwd, target);

        try {
          if (!statSync(nextCwd).isDirectory()) {
            throw new Error(`not a directory: ${nextCwd}`);
          }

          setCwd(nextCwd);
          appendResult({command: trimmed, cwd, exitCode: 0, output: nextCwd});
        } catch (caught) {
          appendResult({
            command: trimmed,
            cwd,
            exitCode: 1,
            output: caught instanceof Error ? caught.message : String(caught),
          });
        }

        return;
      }

      setRunning(true);

      const shell = process.env.SHELL ?? '/bin/sh';
      const child = spawn(shell, ['-lc', trimmed], {
        cwd,
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let output = '';

      child.stdout.on('data', chunk => {
        output = truncateOutput(output + String(chunk));
      });
      child.stderr.on('data', chunk => {
        output = truncateOutput(output + String(chunk));
      });
      child.on('error', caught => {
        appendResult({command: trimmed, cwd, exitCode: 1, output: caught.message});
        setRunning(false);
      });
      child.on('close', exitCode => {
        appendResult({command: trimmed, cwd, exitCode, output: output.trimEnd()});
        setRunning(false);
      });
    },
    [appendResult, cwd, onClose, running],
  );

  useInput((input, key) => {
    if (running) return;

    if (key.escape) {
      onClose();
      return;
    }

    if (key.return) {
      const nextCommand = command;
      setCommand('');
      runCommand(nextCommand);
      return;
    }

    if (key.backspace || key.delete) {
      setCommand(current => current.slice(0, -1));
      return;
    }

    if (key.ctrl && input === 'u') {
      setCommand('');
      return;
    }

    if (printableInput(input)) {
      setCommand(current => `${current}${input}`);
    }
  });

  const lines = history
    .flatMap(result => {
      const status = result.exitCode === 0 ? '' : ` [exit ${result.exitCode ?? 'unknown'}]`;

      return [
        `$ ${result.command}${status}`,
        ...(result.output ? result.output.split('\n') : []),
      ];
    })
    .slice(-outputRows);

  return (
    <Section title="Command" width={width} height={height}>
      <Text dimColor>{cwd}</Text>
      {lines.length > 0 ? lines.map((line, index) => (
        <Text key={`${index}-${line}`} wrap="truncate-end">
          {line}
        </Text>
      )) : <Text dimColor>No commands run yet.</Text>}
      <Text>
        <Text color={ACCENT} bold>$ </Text>
        <Text>{command}</Text>
        <Text inverse> </Text>
        {running ? <Text color="yellow"> running</Text> : null}
      </Text>
      <Text dimColor>Enter run · Esc close · clear reset output · exit close</Text>
    </Section>
  );
}
