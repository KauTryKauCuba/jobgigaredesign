// Renders HTML produced by RichTextEditor (already sanitized via
// sanitizeDescriptionHtml before it's ever saved, same trust model as any
// other server-stored content) — shared so every place that displays a
// rich-text field back out styles bold/lists/links the same way.
export default function RichTextContent({ html, className = "" }: { html: string; className?: string }) {
  return (
    <div
      className={`[&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-black/[0.15] [&_blockquote]:pl-[12px] [&_code]:rounded [&_code]:bg-black/[0.06] [&_code]:px-[4px] [&_code]:py-[1px] [&_ol]:list-decimal [&_ol]:pl-[20px] [&_ul]:list-disc [&_ul]:pl-[20px] ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
