/** Normalize TeX delimiters before Markdown consumes their backslashes. */
export function normalizeMathDelimiters(content: string): string {
  // Keep code (including unfinished streaming fences), escaped backslashes,
  // and existing dollar-delimited formulas intact.
  const tokens = /^( {0,3})(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:^\1\2[ \t]*(?=\n|$)|(?![\s\S]))|(`+)(?!`)[\s\S]*?\3(?!`)|\\\\|\\\$|\$\$[\s\S]*?\$\$|\$[^\n$]+\$|\\\(([\s\S]*?)\\\)|\\\[([\s\S]*?)\\\]/gm;

  return content.replace(tokens, (match, _indent, _fence, _ticks, inline, display) => {
    if (inline !== undefined) {
      return `$${inline.trim().replace(/\s*\n\s*/g, " ")}$`;
    }
    if (display !== undefined) {
      // A dollar display block needs its delimiters on separate lines.
      return `\n\n$$\n${display.trim()}\n$$\n\n`;
    }
    return match;
  });
}
