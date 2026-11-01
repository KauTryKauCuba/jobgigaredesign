// Finds a quoted line on a rendered PDF page and turns it into highlight
// boxes — Resume Review's "this is the line we mean" marks. Client-safe and
// pure: it works on the text positions pdf.js reports for each page.

/** One run of text on a page, in PDF units (as pdf.js getTextContent gives it). */
export type PdfTextItem = { str: string; x: number; y: number; width: number; fontSize: number };

/** A page's size and text, plus how to turn a PDF point into a viewport point (handles offsets/rotation). */
export type PdfPageText = {
  width: number;
  height: number;
  items: PdfTextItem[];
  toViewport: (x: number, y: number) => [number, number];
};

/** A box as percentages of the page, so it scales with the page image. */
export type HighlightBox = { left: number; top: number; width: number; height: number };

// Typographic variants the AI might quote as plain characters, or vice versa.
const CHAR_MAP: Record<string, string> = {
  "‘": "'",
  "’": "'",
  "“": '"',
  "”": '"',
  "–": "-",
  "—": "-",
  "•": "",
  " ": "",
};
const normalizeChar = (c: string) => (c in CHAR_MAP ? CHAR_MAP[c] : /\s/.test(c) ? "" : c.toLowerCase());

/**
 * Where `quote` appears on the first page that has it, as boxes (one per text
 * run it covers) — or null if it isn't there. Spacing and line breaks are
 * ignored on both sides, since a PDF splits lines differently from the text the
 * quote was taken from.
 */
export function locateQuote(pages: PdfPageText[], quote: string): { page: number; boxes: HighlightBox[] } | null {
  const target = [...quote].map(normalizeChar).join("");
  if (target.length < 4) return null;

  for (let p = 0; p < pages.length; p++) {
    const page = pages[p];
    // Every kept character, and which text run (and position in it) it came from.
    let joined = "";
    const owners: { item: number; index: number }[] = [];
    page.items.forEach((item, i) => {
      [...item.str].forEach((c, index) => {
        const n = normalizeChar(c);
        for (const ch of n) {
          joined += ch;
          owners.push({ item: i, index });
        }
      });
    });
    const at = joined.indexOf(target);
    if (at === -1) continue;

    // The span of characters covered in each text run.
    const spans = new Map<number, { from: number; to: number }>();
    for (const { item, index } of owners.slice(at, at + target.length)) {
      const span = spans.get(item);
      spans.set(item, span ? { from: Math.min(span.from, index), to: Math.max(span.to, index) } : { from: index, to: index });
    }

    // One box per text run first (in page units)…
    const runs: { left: number; right: number; top: number; bottom: number }[] = [];
    for (const [i, { from, to }] of spans) {
      const item = page.items[i];
      const length = Math.max([...item.str].length, 1);
      // Characters assumed evenly wide within a run — close enough for a highlight.
      const x1 = item.x + (item.width * from) / length;
      const x2 = item.x + (item.width * (to + 1)) / length;
      // From a little below the baseline to the top of the capitals.
      const [ax, ay] = page.toViewport(x1, item.y - item.fontSize * 0.25);
      const [bx, by] = page.toViewport(x2, item.y + item.fontSize * 0.9);
      const padX = item.fontSize * 0.15;
      runs.push({
        left: Math.min(ax, bx) - padX,
        right: Math.max(ax, bx) + padX,
        top: Math.min(ay, by),
        bottom: Math.max(ay, by),
      });
    }

    // …then merged into one solid band per line, so justified text (where
    // every word is its own run) reads as a single stripe, not word blocks.
    const lines: typeof runs = [];
    for (const run of runs.sort((a, b) => a.top - b.top || a.left - b.left)) {
      const line = lines.find((l) => Math.abs((l.top + l.bottom) / 2 - (run.top + run.bottom) / 2) < (run.bottom - run.top) / 2);
      if (line) {
        line.left = Math.min(line.left, run.left);
        line.right = Math.max(line.right, run.right);
        line.top = Math.min(line.top, run.top);
        line.bottom = Math.max(line.bottom, run.bottom);
      } else {
        lines.push({ ...run });
      }
    }
    // Neighbouring lines meet halfway instead of overlapping (overlaps show as darker stripes).
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].top < lines[i - 1].bottom) {
        const middle = (lines[i].top + lines[i - 1].bottom) / 2;
        lines[i - 1].bottom = middle;
        lines[i].top = middle;
      }
    }

    const boxes: HighlightBox[] = lines.map((l) => ({
      left: (l.left / page.width) * 100,
      top: (l.top / page.height) * 100,
      width: ((l.right - l.left) / page.width) * 100,
      height: ((l.bottom - l.top) / page.height) * 100,
    }));
    return { page: p, boxes };
  }
  return null;
}
