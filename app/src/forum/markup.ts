/* ------------------------------------------------------------------ */
/* What a post may carry: paragraphs, a quoted line, bold, italic, a   */
/* word of code and a bare address that becomes a link. No pictures,   */
/* no tags — the text is never handed to the browser as markup, the    */
/* page draws these pieces itself.                                     */
/* ------------------------------------------------------------------ */

export type Inline = { k: 'text'; s: string } | { k: 'b'; s: string } | { k: 'i'; s: string } | { k: 'code'; s: string } | { k: 'link'; href: string };
export type Block = { k: 'p'; lines: Inline[][] } | { k: 'quote'; lines: Inline[][] };

const INLINE = /(\*\*[^*\n]+\*\*)|(\b_[^_\n]+_\b)|(`[^`\n]+`)|(https?:\/\/[^\s<>()"']+)/g;

/** one line of text, its emphasis and addresses picked out */
export function inline(line: string): Inline[] {
  const out: Inline[] = [];
  let at = 0;
  for (const m of line.matchAll(INLINE)) {
    const i = m.index ?? 0;
    if (i > at) out.push({ k: 'text', s: line.slice(at, i) });
    const [whole, b, it, code, link] = m;
    if (b) out.push({ k: 'b', s: b.slice(2, -2) });
    else if (it) out.push({ k: 'i', s: it.slice(1, -1) });
    else if (code) out.push({ k: 'code', s: code.slice(1, -1) });
    else if (link) {
      /* the full stop after an address belongs to the sentence */
      const trail = /[.,;:!?]+$/.exec(link)?.[0] ?? '';
      out.push({ k: 'link', href: link.slice(0, link.length - trail.length) });
      if (trail) out.push({ k: 'text', s: trail });
    }
    at = i + whole.length;
  }
  if (at < line.length) out.push({ k: 'text', s: line.slice(at) });
  return out;
}

/** the post as blocks: blank lines part paragraphs, "> " opens a quote */
export function parse(text: string): Block[] {
  const blocks: Block[] = [];
  for (const chunk of text.replace(/\r\n?/g, '\n').split(/\n{2,}/)) {
    const lines = chunk.split('\n').filter((l) => l.trim().length);
    if (!lines.length) continue;
    let cur: Block | null = null;
    for (const raw of lines) {
      const quoted = /^>\s?/.test(raw);
      const line = inline(quoted ? raw.replace(/^>\s?/, '') : raw);
      if (!cur || (cur.k === 'quote') !== quoted) {
        const next: Block = { k: quoted ? 'quote' : 'p', lines: [] };
        blocks.push(next);
        cur = next;
      }
      cur.lines.push(line);
    }
  }
  return blocks;
}

/** the text a line of a post reads as, for excerpts and reports */
export function excerpt(text: string, max = 140): string {
  const flat = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(/^>\s?/, ''))
    .join(' ')
    .replace(/\*\*|`|\s+/g, (m) => (m === '**' || m === '`' ? '' : ' '))
    .trim();
  return flat.length > max ? flat.slice(0, max - 1).trimEnd() + '…' : flat;
}

/** the lines quoted, ready for a reply */
export const quoted = (name: string, text: string): string => `**${name}** :\n` + excerpt(text, 400).split('\n').map((l) => `> ${l}`).join('\n') + '\n\n';
