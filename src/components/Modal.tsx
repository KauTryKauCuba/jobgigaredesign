"use client";

import { useEffect } from "react";

export default function Modal({
  onClose,
  ariaLabel,
  children,
}: {
  /** Omit to disable backdrop-click and Escape-to-close (e.g. a dialog that
   *  requires an explicit choice, like Navbar's post-Google role picker). */
  onClose?: () => void;
  ariaLabel?: string;
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[380px] rounded-[24px] bg-white p-[22px] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_24px_48px_-16px_rgba(0,0,0,0.24)]"
      >
        {children}
      </div>
    </div>
  );
}
