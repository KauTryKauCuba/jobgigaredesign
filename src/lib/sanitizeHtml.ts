import DOMPurify from "isomorphic-dompurify";

// Tags/attributes the Company description rich-text editor (see
// RichTextEditor.tsx) can ever produce — kept narrow so pasted or
// hand-crafted HTML can't smuggle in scripts or event handlers. Used both
// server-side (API route, before it hits the database) and client-side
// (rendering it back out), so it lives outside any "use client" file.
const SANITIZE_CONFIG = {
  ALLOWED_TAGS: ["b", "strong", "i", "em", "u", "ul", "ol", "li", "blockquote", "code", "a", "br", "div"],
  ALLOWED_ATTR: ["href"],
};

export function sanitizeDescriptionHtml(html: string): string {
  return DOMPurify.sanitize(html, SANITIZE_CONFIG);
}
