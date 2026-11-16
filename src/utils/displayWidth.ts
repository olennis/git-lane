export function charWidth(char: string): number {
  const codePoint = char.codePointAt(0) ?? 0;

  if (
    codePoint === 0 ||
    (codePoint >= 0x300 && codePoint <= 0x36f) ||
    (codePoint >= 0x1ab0 && codePoint <= 0x1aff) ||
    (codePoint >= 0x1dc0 && codePoint <= 0x1dff) ||
    (codePoint >= 0xfe20 && codePoint <= 0xfe2f)
  ) {
    return 0;
  }

  if (
    (codePoint >= 0x1100 && codePoint <= 0x115f) ||
    (codePoint >= 0x2329 && codePoint <= 0x232a) ||
    (codePoint >= 0x2e80 && codePoint <= 0xa4cf) ||
    (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
    (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
    (codePoint >= 0xfe10 && codePoint <= 0xfe19) ||
    (codePoint >= 0xfe30 && codePoint <= 0xfe6f) ||
    (codePoint >= 0xff00 && codePoint <= 0xff60) ||
    (codePoint >= 0xffe0 && codePoint <= 0xffe6) ||
    (codePoint >= 0x1f300 && codePoint <= 0x1faff)
  ) {
    return 2;
  }

  return 1;
}

export function displayWidth(text: string): number {
  return Array.from(text).reduce((width, char) => width + charWidth(char), 0);
}

export function truncateColumns(text: string, maxColumns: number): string {
  if (maxColumns <= 0) return '';
  if (displayWidth(text) <= maxColumns) return text;
  if (maxColumns <= 3) return '.'.repeat(maxColumns);

  const suffix = '...';
  const target = maxColumns - suffix.length;
  let output = '';
  let width = 0;

  for (const char of Array.from(text)) {
    const nextWidth = width + charWidth(char);
    if (nextWidth > target) break;
    output += char;
    width = nextWidth;
  }

  return `${output}${suffix}`;
}
