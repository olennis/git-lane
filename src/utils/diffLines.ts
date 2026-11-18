export type DiffLineKind = 'meta' | 'hunk' | 'add' | 'del' | 'context';

export type DiffLine = {
  kind: DiffLineKind;
  text: string;
};

const META_PREFIXES = [
  'diff --git',
  'index ',
  '--- ',
  '+++ ',
  'new file mode',
  'deleted file mode',
  'old mode',
  'new mode',
  'similarity index',
  'dissimilarity index',
  'rename from',
  'rename to',
  'copy from',
  'copy to',
  'Binary files',
  '\\ No newline',
];

const TAB = '    ';

function classify(line: string, inHunk: boolean): DiffLineKind {
  if (line.startsWith('@@')) return 'hunk';
  // Inside a hunk, `--- x` / `+++ x` are real removed/added lines, not file headers.
  if (inHunk && line.startsWith('+')) return 'add';
  if (inHunk && line.startsWith('-')) return 'del';
  if (inHunk && line.startsWith('\\')) return 'meta';
  if (inHunk && (line.startsWith(' ') || line === '')) return 'context';
  if (META_PREFIXES.some(prefix => line.startsWith(prefix))) return 'meta';
  return 'context';
}

/** Splits raw `git diff` output into display lines. Tabs are expanded because Ink measures them as width 1. */
export function parseDiffLines(diff: string): DiffLine[] {
  const rawLines = diff.replace(/\r/g, '').replace(/\n$/, '').split('\n');
  const lines: DiffLine[] = [];
  let inHunk = false;

  for (const raw of rawLines) {
    if (raw.startsWith('diff --git')) inHunk = false;
    const kind = classify(raw, inHunk);
    if (kind === 'hunk') inHunk = true;
    lines.push({kind, text: raw.replace(/\t/g, TAB)});
  }

  return diff.trim() === '' ? [] : lines;
}
