"use client";

import { useEffect, useRef, useState } from "react";
import Modal from "./Modal";
import SuperadminDashboardShell from "./SuperadminDashboardShell";
import { gradientFrameClass, inputClass } from "./formStyles";
import type { AuthUser } from "./AuthModal";
import type { AdminEntry } from "@/lib/superadmin-admins";

/** Their photo, or their initial — also when the stored photo no longer loads (e.g. an old Google photo link). */
function AdminAvatar({ url, label }: { url: string | null; label: string }) {
  const [failed, setFailed] = useState(false);
  const img = useRef<HTMLImageElement>(null);
  // A server-rendered image can fail before React attaches onError, so also
  // check once mounted whether it already finished without loading.
  useEffect(() => {
    const el = img.current;
    if (el?.complete && el.naturalWidth === 0) setFailed(true);
  }, [url]);
  return url && !failed ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img ref={img} src={url} alt="" onError={() => setFailed(true)} className="h-[32px] w-[32px] shrink-0 rounded-full object-cover" />
  ) : (
    <span className="flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-full bg-brand-teal-soft text-xs font-semibold text-brand-teal-dark">
      {label.trim().charAt(0).toUpperCase()}
    </span>
  );
}

function formatAdded(iso: string) {
  return new Date(iso).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Who has superadmin access. Owners (set on the server) can add and remove
 * admins; added admins see the list read-only.
 */
export default function SuperadminAdminsView({
  authUser,
  initialAdmins,
  canManage,
}: {
  authUser: AuthUser;
  initialAdmins: AdminEntry[];
  canManage: boolean;
}) {
  const [admins, setAdmins] = useState(initialAdmins);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addedNote, setAddedNote] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<AdminEntry | null>(null);

  async function send(request: Promise<Response>) {
    setBusy(true);
    setError(null);
    try {
      const res = await request;
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.admins) throw new Error(data?.error ?? "Something went wrong — please try again.");
      setAdmins(data.admins);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const typed = email.trim();
    if (!typed) return;
    setAddedNote(null);
    const ok = await send(
      fetch("/api/superadmin/admins", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: typed }) }),
    );
    if (ok) {
      setEmail("");
      setAddedNote(`${typed.toLowerCase()} now has superadmin access.`);
    }
  }

  async function remove(admin: AdminEntry) {
    setConfirmRemove(null);
    setAddedNote(null);
    if (admin.id) await send(fetch(`/api/superadmin/admins/${admin.id}`, { method: "DELETE" }));
  }

  return (
    <SuperadminDashboardShell
      authUser={authUser}
      active="admins"
      heading="Admins"
      subheading="Who can use this superadmin panel. Owners are set on the server and can add or remove admins; admins can use everything else."
    >
      <div className="flex flex-col gap-[20px]">
        {canManage ? (
          <div className={`animate-fade-in-up ${gradientFrameClass("teal")}`}>
            <form onSubmit={add} className="flex flex-col gap-[10px] rounded-[19px] bg-white p-[16px] sm:p-[22px]">
              <div>
                <p className="text-sm text-[#141B2E]">Add an admin</p>
                <p className="mt-[2px] text-xs text-[#4B5468]">
                  They&rsquo;ll have full access to this panel, except adding or removing admins. They sign in with this exact email — if
                  they already have an account, it works on their next page load.
                </p>
              </div>
              <div className="flex flex-col gap-[10px] sm:flex-row">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  aria-label="Admin email"
                  disabled={busy}
                  className={`${inputClass("teal")} sm:flex-1`}
                />
                <button
                  type="submit"
                  disabled={busy || !email.trim()}
                  className="h-[38px] shrink-0 rounded-full bg-brand-teal-dark px-[18px] text-sm text-white hover:opacity-90 disabled:opacity-50"
                >
                  {busy ? "Saving…" : "Add admin"}
                </button>
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              {addedNote && <p className="text-sm text-brand-teal-dark">{addedNote}</p>}
            </form>
          </div>
        ) : (
          <p className="rounded-[14px] border border-[#EAEDF2] bg-white p-[14px] text-sm text-[#4B5468]">
            Only owners can add or remove admins.
          </p>
        )}

        <div className={`animate-fade-in-up ${gradientFrameClass("teal")}`} style={{ animationDelay: "60ms" }}>
          <div className="rounded-[19px] bg-white p-[16px] sm:p-[22px]">
            <p className="text-sm text-[#141B2E]">
              {admins.length} {admins.length === 1 ? "person has" : "people have"} access
            </p>
            {!canManage && error && <p className="mt-[8px] text-sm text-red-500">{error}</p>}
            <ul className="mt-[12px] flex flex-col gap-[8px]">
              {admins.map((admin) => {
                const isYou = admin.email === authUser.email.toLowerCase();
                return (
                  <li
                    key={admin.id ?? `owner-${admin.email}`}
                    className="flex flex-col gap-[10px] rounded-[14px] border border-[#EAEDF2] bg-[#F8FAFB] p-[12px] sm:flex-row sm:items-center"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-[10px]">
                      <AdminAvatar url={admin.account?.avatarUrl ?? null} label={admin.account?.name ?? admin.email} />
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-[6px] text-sm text-[#141B2E]">
                          <span className="truncate">{admin.account?.name ?? admin.email}</span>
                          <span
                            className={`rounded-full px-[7px] py-[1px] text-[11px] ${
                              admin.kind === "owner" ? "bg-[#FFF3D6] text-[#9A6B00]" : "bg-brand-teal-soft text-brand-teal-dark"
                            }`}
                          >
                            {admin.kind === "owner" ? "Owner" : "Admin"}
                          </span>
                          {isYou && <span className="text-xs text-[#9AA3B2]">(you)</span>}
                        </p>
                        <p className="truncate text-xs text-[#9AA3B2]">
                          {admin.account?.name ? `${admin.email} · ` : ""}
                          {admin.account ? (
                            "Has an account"
                          ) : (
                            <span className="text-[#9A6B00]">No account yet — they need to sign up with this email</span>
                          )}
                        </p>
                        <p className="text-xs text-[#9AA3B2]">
                          {admin.kind === "owner"
                            ? "Set on the server — can't be removed here"
                            : `Added${admin.addedBy ? ` by ${admin.addedBy}` : ""}${admin.addedAt ? ` · ${formatAdded(admin.addedAt)}` : ""}`}
                        </p>
                      </div>
                    </div>
                    {canManage && admin.kind === "admin" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setConfirmRemove(admin)}
                        className="h-[34px] shrink-0 self-start rounded-full border border-black/[0.1] bg-white px-[14px] text-sm text-[#4B5468] hover:bg-black/[0.03] disabled:opacity-50 sm:self-center"
                      >
                        Remove
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>

      {confirmRemove && (
        <Modal onClose={() => setConfirmRemove(null)} ariaLabel="Remove admin">
          <h2 className="text-lg font-semibold text-[#141B2E]">Remove admin access?</h2>
          <p className="mt-[10px] text-sm leading-[20px] text-[#4B5468]">
            {confirmRemove.account?.name ?? confirmRemove.email} will lose access to the superadmin panel on their next page load. Their own
            employer or jobseeker account isn&rsquo;t affected.
          </p>
          <div className="mt-[20px] flex flex-col gap-[8px] sm:flex-row-reverse">
            <button
              type="button"
              onClick={() => remove(confirmRemove)}
              className="h-[38px] rounded-full bg-[#C0362C] px-[18px] text-sm text-white hover:opacity-90"
            >
              Remove access
            </button>
            <button
              type="button"
              onClick={() => setConfirmRemove(null)}
              className="flex h-[38px] items-center justify-center text-sm text-[#9AA3B2] hover:text-[#141B2E]"
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </SuperadminDashboardShell>
  );
}
