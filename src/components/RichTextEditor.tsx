"use client";

import { useEffect, useRef, useState } from "react";
import { sanitizeDescriptionHtml } from "@/lib/sanitizeHtml";

function exec(command: string, value?: string) {
  document.execCommand(command, false, value);
}

// Keeps the toolbar's mousedown from stealing focus/selection away from the
// contentEditable body — without this, execCommand would run with no
// selection and do nothing.
function preventBlur(e: React.MouseEvent) {
  e.preventDefault();
}

const buttonClass =
  "flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[6px] text-[#4B5468] hover:bg-black/[0.06]";

export default function RichTextEditor({
  id,
  value,
  onChange,
  placeholder,
  disabled = false,
  accent = "teal",
}: {
  id?: string;
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  // A contentEditable div isn't a real form control, so an ancestor
  // `<fieldset disabled>` (the pattern every other field on these forms
  // relies on to lock during view mode) has no effect on it — this has to
  // be wired through explicitly.
  disabled?: boolean;
  accent?: "teal" | "gold";
}) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  // Starts at `null`, not `value` — the contentEditable div below is always
  // rendered empty in JSX (no dangerouslySetInnerHTML), so the very first
  // sync below must always run to actually inject the initial content into
  // the DOM. Seeding this with `value` made that first run a no-op whenever
  // the component mounted with an already non-empty value (restoring a saved
  // draft, or opening an edit page for a profile that already has a
  // description) — the guard saw "nothing changed" and skipped the DOM
  // write entirely, leaving the box visually empty despite `value` (and the
  // database) holding the real content. `null` can never equal a real
  // string, so the first run always goes through.
  const lastEmitted = useRef<string | null>(null);
  const [isEmpty, setIsEmpty] = useState(!value);

  // Only pushes `value` into the DOM when it changed from outside (initial
  // load, AI-fill, draft restore) — never while the user is actively
  // editing, or every keystroke would reset the caret to the start.
  useEffect(() => {
    if (!editorRef.current || value === lastEmitted.current) return;
    const clean = sanitizeDescriptionHtml(value);
    editorRef.current.innerHTML = clean;
    lastEmitted.current = clean;
    setIsEmpty(!editorRef.current.textContent?.trim());
  }, [value]);

  function emitChange() {
    const editor = editorRef.current;
    if (!editor) return;
    const html = sanitizeDescriptionHtml(editor.innerHTML);
    lastEmitted.current = html;
    setIsEmpty(!editor.textContent?.trim());
    onChange(html);
  }

  function run(command: string, commandValue?: string) {
    if (disabled) return;
    editorRef.current?.focus();
    exec(command, commandValue);
    emitChange();
  }

  return (
    <div
      className={`overflow-hidden rounded-[12px] border border-black/[0.1] ${
        accent === "gold" ? "focus-within:border-brand-gold-dark" : "focus-within:border-brand-teal-dark"
      } ${disabled ? "bg-black/[0.03]" : ""}`}
    >
      <div className="relative">
        {isEmpty && placeholder && (
          <p className="pointer-events-none absolute top-[10px] left-[14px] text-sm text-[#9AA3B2]">
            {placeholder}
          </p>
        )}
        <div
          ref={editorRef}
          id={id}
          contentEditable={!disabled}
          suppressContentEditableWarning
          onInput={emitChange}
          onBlur={emitChange}
          className={`min-h-[76px] w-full px-[14px] py-[10px] text-sm text-[#141B2E] outline-none [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-black/[0.15] [&_blockquote]:pl-[12px] [&_blockquote]:text-[#4B5468] [&_code]:rounded [&_code]:bg-black/[0.06] [&_code]:px-[4px] [&_code]:py-[1px] [&_ol]:list-decimal [&_ol]:pl-[20px] [&_ul]:list-disc [&_ul]:pl-[20px] ${disabled ? "cursor-not-allowed opacity-70" : ""}`}
        />
      </div>

      <div className="flex items-center gap-[2px] border-t border-black/[0.1] bg-[#F8FAFB] px-[8px] py-[6px]">
        <button type="button" disabled={disabled} aria-label="Bold" title="Bold" className={`${buttonClass} disabled:cursor-not-allowed disabled:opacity-40`} onMouseDown={preventBlur} onClick={() => run("bold")}>
          B
        </button>
        <button type="button" disabled={disabled} aria-label="Italic" title="Italic" className={`${buttonClass} italic disabled:cursor-not-allowed disabled:opacity-40`} onMouseDown={preventBlur} onClick={() => run("italic")}>
          I
        </button>
        <button type="button" disabled={disabled} aria-label="Underline" title="Underline" className={`${buttonClass} underline disabled:cursor-not-allowed disabled:opacity-40`} onMouseDown={preventBlur} onClick={() => run("underline")}>
          U
        </button>

        <span className="mx-[4px] h-[16px] w-px bg-black/[0.1]" />

        <button type="button" disabled={disabled} aria-label="Bullet list" title="Bullet list" className={`${buttonClass} disabled:cursor-not-allowed disabled:opacity-40`} onMouseDown={preventBlur} onClick={() => run("insertUnorderedList")}>
          <svg viewBox="0 0 16 16" className="h-[15px] w-[15px]" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden>
            <circle cx="2.2" cy="4" r="1" fill="currentColor" stroke="none" />
            <path d="M6 4h8" />
            <circle cx="2.2" cy="8" r="1" fill="currentColor" stroke="none" />
            <path d="M6 8h8" />
            <circle cx="2.2" cy="12" r="1" fill="currentColor" stroke="none" />
            <path d="M6 12h8" />
          </svg>
        </button>
        <button type="button" disabled={disabled} aria-label="Numbered list" title="Numbered list" className={`${buttonClass} disabled:cursor-not-allowed disabled:opacity-40`} onMouseDown={preventBlur} onClick={() => run("insertOrderedList")}>
          <svg viewBox="0 0 16 16" className="h-[15px] w-[15px]" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden>
            <text x="0.5" y="5" fontSize="4.5" fill="currentColor" stroke="none">1</text>
            <path d="M6 4h8" />
            <text x="0.5" y="9" fontSize="4.5" fill="currentColor" stroke="none">2</text>
            <path d="M6 8h8" />
            <text x="0.5" y="13" fontSize="4.5" fill="currentColor" stroke="none">3</text>
            <path d="M6 12h8" />
          </svg>
        </button>
      </div>
    </div>
  );
}
