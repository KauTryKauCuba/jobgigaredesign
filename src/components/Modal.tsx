"use client";

import { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

const noopSubscribe = () => () => {};

export default function Modal({
  onClose,
  ariaLabel,
  wide = false,
  large = false,
  children,
}: {
  /** Omit to disable backdrop-click and Escape-to-close (e.g. a dialog that
   *  requires an explicit choice, like Navbar's post-Google role picker). */
  onClose?: () => void;
  ariaLabel?: string;
  /** A wider dialog with no padding, for content that runs edge to edge (e.g. an image on top). */
  wide?: boolean;
  /** A roomy dialog for forms and editors: scrolls inside itself when the content is tall. */
  large?: boolean;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const close = onClose;
    if (!close) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Rendered into <body>, not where it's used: inside an animated or
  // transformed card, `fixed` would be relative to that card — the backdrop
  // only covered the card and the dialog centred on it, not the screen.
  // Client-only, since there's no <body> to portal into during SSR.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        onClick={(e) => e.stopPropagation()}
        className={`w-full rounded-[24px] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_24px_48px_-16px_rgba(0,0,0,0.24)] ${
          // Capped by the screen height too, so a tall (e.g. square) image always fits.
          wide
            ? "max-w-[min(554px,calc(100svh-64px))] overflow-hidden"
            : large
              ? "max-h-[calc(100svh-48px)] max-w-[680px] overflow-y-auto p-[22px]"
              : "max-w-[380px] p-[22px]"
        }`}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
