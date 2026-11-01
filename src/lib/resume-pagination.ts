// Splits a rendered resume (.rz-page, laid out at full A4 width, unscaled)
// into A4 pages — used for both Resume Designer's preview and its PDF, so
// what you see is exactly what you download. Browser-only (measures the DOM).

import { RESUME_PAGE_HEIGHT } from "./resume-templates";

/** Space kept clear at the top of page 2 onward (page 1 has the resume's own padding). */
export const RESUME_PAGE_TOP_MARGIN = 44;
/** Space kept clear at the bottom of every page. */
export const RESUME_PAGE_BOTTOM_MARGIN = 44;

/** One page: the slice of the resume (in px from its top) that goes on it. */
export type ResumeSlice = { start: number; end: number };

type Span = { top: number; bottom: number };

// Kept whole on one page where possible — a job, a degree, a certificate…
// (Skill chips aren't: they flow in lines, and a long list can be most of a
// sidebar — each line of chips is kept whole instead.)
const UNBREAKABLE = ".rz-item, .rz-header, .rz-photo";
// Anything taller than this share of a page splits between its lines rather
// than dragging the whole page break up above it.
const MAX_KEEP_SHARE = 0.5;

export function paginateResume(page: HTMLElement): ResumeSlice[] {
  const origin = page.getBoundingClientRect().top;
  const spanOf = (rect: DOMRect): Span => ({ top: rect.top - origin, bottom: rect.bottom - origin });

  // Everything a page break must not cut through: each line of text…
  const keep: Span[] = [];
  const walker = document.createTreeWalker(page, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent?.trim()) continue;
    range.selectNodeContents(node);
    for (const rect of range.getClientRects()) if (rect.height > 0) keep.push(spanOf(rect));
  }
  // …each whole entry…
  page.querySelectorAll<HTMLElement>(UNBREAKABLE).forEach((el) => keep.push(spanOf(el.getBoundingClientRect())));
  // …and each section heading together with the start of what it heads, so a
  // heading is never left alone at the bottom of a page.
  page.querySelectorAll<HTMLElement>(".rz-h2").forEach((heading) => {
    const next = heading.nextElementSibling as HTMLElement | null;
    const first = (next?.querySelector(".rz-item, li, p") as HTMLElement | null) ?? next;
    const top = heading.getBoundingClientRect().top - origin;
    const bottom = (first ?? heading).getBoundingClientRect().bottom - origin;
    keep.push({ top, bottom: Math.max(bottom, heading.getBoundingClientRect().bottom - origin) });
  });

  // Where the content really ends (not the page's own bottom padding or min-height).
  const contentEnd = keep.reduce((max, s) => Math.max(max, s.bottom), 0);

  const slices: ResumeSlice[] = [];
  let start = 0;
  while (start < contentEnd - 1) {
    const first = slices.length === 0;
    const capacity = RESUME_PAGE_HEIGHT - RESUME_PAGE_BOTTOM_MARGIN - (first ? 0 : RESUME_PAGE_TOP_MARGIN);
    const limit = start + capacity;
    if (limit >= contentEnd) {
      slices.push({ start, end: contentEnd });
      break;
    }
    // Pull the break up above anything it would cut through, until nothing is cut.
    let cut = limit;
    for (let moved = true; moved; ) {
      moved = false;
      for (const s of keep) {
        if (s.bottom - s.top > capacity * MAX_KEEP_SHARE) continue;
        if (s.top < cut && s.bottom > cut && s.top > start) {
          cut = s.top;
          moved = true;
        }
      }
    }
    // Something taller than a whole page can't be kept whole — split it at the limit.
    if (cut <= start + capacity * 0.2) cut = limit;
    slices.push({ start, end: cut });
    start = cut;
  }
  return slices.length ? slices : [{ start: 0, end: RESUME_PAGE_HEIGHT }];
}
