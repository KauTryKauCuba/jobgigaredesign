"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "./Modal";
import { gradientFrameClass, inputClass as formInputClass } from "./formStyles";

const inputClass = formInputClass("teal");

export default function DeleteAccountCard({ email }: { email: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailMatches = confirmEmail.trim().toLowerCase() === email.toLowerCase();

  function closeModal() {
    if (deleting) return;
    setOpen(false);
    setConfirmEmail("");
    setError(null);
  }

  async function handleDelete() {
    if (!emailMatches) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/employer/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't delete your account.");
      router.push("/employer");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete your account.");
      setDeleting(false);
    }
  }

  return (
    <>
      <div className={`animate-fade-in-up ${gradientFrameClass("teal")}`} style={{ animationDelay: "120ms" }}>
        <div className="flex flex-col gap-[10px] rounded-[19px] bg-white p-[22px]">
          <p className="text-sm text-[#141B2E]">Danger zone</p>
          <p className="text-xs text-[#4B5468]">
            Permanently delete your account. If you own a company with no other team members, this also deletes
            the company and every job posting, applicant, and interview tied to it — this can&rsquo;t be undone.
          </p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-[4px] flex h-[36px] items-center justify-center rounded-full border border-red-200 text-sm text-red-600 hover:bg-red-50"
          >
            Delete my account
          </button>
        </div>
      </div>

      {open && (
        <Modal onClose={closeModal} ariaLabel="Delete account">
          <p className="text-lg font-semibold text-[#141B2E]">Delete your account?</p>
          <p className="mt-[8px] text-sm text-[#4B5468]">
            This permanently deletes your account. If you own a company with no other active team members, it
            also deletes the company, every job posting, applicant, and interview tied to it. This can&rsquo;t be
            undone.
          </p>
          <p className="mt-[14px] text-xs text-[#4B5468]">
            Type <span className="text-[#141B2E]">{email}</span> to confirm.
          </p>
          <input
            type="email"
            value={confirmEmail}
            onChange={(e) => setConfirmEmail(e.target.value)}
            placeholder={email}
            className={`mt-[6px] ${inputClass}`}
            autoFocus
          />
          {error && <p className="mt-[8px] text-xs text-red-500">{error}</p>}
          <div className="mt-[16px] flex justify-end gap-[8px]">
            <button
              type="button"
              onClick={closeModal}
              disabled={deleting}
              className="flex h-[38px] items-center justify-center rounded-full border border-black/[0.1] px-[16px] text-sm text-[#141B2E] hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={!emailMatches || deleting}
              className="flex h-[38px] items-center justify-center rounded-full bg-red-600 px-[16px] text-sm text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {deleting ? "Deleting…" : "Delete my account"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
