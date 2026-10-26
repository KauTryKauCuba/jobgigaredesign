"use client";

import { useRef, useState } from "react";
import { gradientFrameClass } from "./formStyles";
import Modal from "./Modal";
import SuperadminDashboardShell from "./SuperadminDashboardShell";
import type { AuthUser } from "./AuthModal";
import { DEFAULT_THEME_COLORS, themeCssVars } from "@/lib/site-themes-shared";
import type { WelcomeImage, WelcomeRole } from "@/lib/welcome-images";

const ROLES: { role: WelcomeRole; title: string; page: string; accent: "teal" | "gold" }[] = [
  { role: "employer", title: "Employer page", page: "/employer", accent: "teal" },
  { role: "jobseeker", title: "Jobseeker page", page: "/jobseeker", accent: "gold" },
];
const MAX_BYTES = 10 * 1024 * 1024;

function formatUpdated(iso: string) {
  return new Date(iso).toLocaleString("en-MY", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

/**
 * The landing pages' welcome popup images — one per page. Upload a new one
 * (cropped to a 1:1 square) or go back to the built-in picture.
 */
export default function SuperadminWelcomeView({
  authUser,
  initialImages,
}: {
  authUser: AuthUser;
  initialImages: Record<WelcomeRole, WelcomeImage>;
}) {
  const [images, setImages] = useState(initialImages);
  const [busy, setBusy] = useState<WelcomeRole | null>(null);
  const [errors, setErrors] = useState<Partial<Record<WelcomeRole, string>>>({});
  const [confirmReset, setConfirmReset] = useState<WelcomeRole | null>(null);
  const inputs = useRef<Partial<Record<WelcomeRole, HTMLInputElement | null>>>({});

  async function send(role: WelcomeRole, request: Promise<Response>) {
    setBusy(role);
    setErrors((prev) => ({ ...prev, [role]: undefined }));
    try {
      const res = await request;
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.images) throw new Error(data?.error ?? "Something went wrong — please try again.");
      setImages(data.images);
    } catch (err) {
      setErrors((prev) => ({ ...prev, [role]: err instanceof Error ? err.message : "Something went wrong." }));
    } finally {
      setBusy(null);
    }
  }

  function upload(role: WelcomeRole, file: File | undefined) {
    if (inputs.current[role]) inputs.current[role]!.value = "";
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      setErrors((prev) => ({ ...prev, [role]: "Upload a JPG, PNG or WebP image." }));
      return;
    }
    if (file.size > MAX_BYTES) {
      setErrors((prev) => ({ ...prev, [role]: "That image is too large (max 10 MB)." }));
      return;
    }
    const form = new FormData();
    form.set("role", role);
    form.set("image", file);
    void send(role, fetch("/api/superadmin/welcome-images", { method: "POST", body: form }));
  }

  return (
    <SuperadminDashboardShell
      authUser={authUser}
      active="welcome-popup"
      heading="Welcome Popup"
      subheading="The square image that welcomes signed-out visitors to the employer and jobseeker landing pages (shown once per browser)."
    >
      <div className="grid grid-cols-1 gap-[20px] lg:grid-cols-2">
        {ROLES.map(({ role, title, page, accent }) => {
          const image = images[role];
          const isBusy = busy === role;
          return (
            <div
              key={role}
              className={gradientFrameClass(accent)}
              // Superadmin is blue (see superadmin/layout.tsx), but this card is
              // about the employer side, so it keeps the employer teal — just
              // as the jobseeker card keeps its gold.
              style={role === "employer" ? (themeCssVars("employer", DEFAULT_THEME_COLORS.employer) as React.CSSProperties) : undefined}
            >
              <div className="rounded-[19px] bg-white p-[16px] sm:p-[22px]">
                <div className="flex items-start justify-between gap-[10px]">
                  <div>
                    <h2 className="text-lg font-semibold text-[#141B2E]">{title}</h2>
                    <p className="mt-[2px] text-xs text-[#9AA3B2]">
                      {image.custom && image.updatedAt ? `Custom image · updated ${formatUpdated(image.updatedAt)}` : "Default image"}
                    </p>
                  </div>
                  <a
                    href={page}
                    target="_blank"
                    rel="noreferrer"
                    className={`shrink-0 text-sm hover:underline ${accent === "gold" ? "text-brand-gold-dark" : "text-brand-teal-dark"}`}
                  >
                    View page
                  </a>
                </div>

                <div className="relative mx-auto mt-[16px] aspect-square w-full max-w-[360px] overflow-hidden rounded-[18px] border border-[#EAEDF2] bg-[#F1F4F8]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image.url} alt={`${title} welcome image`} className="h-full w-full object-cover" />
                  {isBusy && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-sm text-[#4B5468]">
                      Saving…
                    </div>
                  )}
                </div>

                <input
                  ref={(el) => {
                    inputs.current[role] = el;
                  }}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => upload(role, e.target.files?.[0])}
                />
                <div className="mt-[16px] flex flex-wrap items-center gap-[8px]">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => inputs.current[role]?.click()}
                    className={`h-[38px] rounded-full px-[18px] text-sm hover:opacity-90 disabled:opacity-50 ${
                      accent === "gold" ? "bg-[#FFE9A6] text-[#141B2E]" : "bg-brand-teal-dark text-white"
                    }`}
                  >
                    Upload new image
                  </button>
                  {image.custom && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => setConfirmReset(role)}
                      className="h-[38px] rounded-full border border-black/[0.1] px-[16px] text-sm text-[#4B5468] hover:bg-black/[0.03] disabled:opacity-50"
                    >
                      Reset to default
                    </button>
                  )}
                </div>
                <p className={`mt-[10px] text-xs ${errors[role] ? "text-red-500" : "text-[#9AA3B2]"}`}>
                  {errors[role] ??
                    "Square (1:1) works best — other shapes are cropped from the centre. JPG, PNG or WebP, up to 10 MB. Keep the top-right corner clear for the close button."}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {confirmReset && (
        <Modal ariaLabel="Reset to the default image?" onClose={() => setConfirmReset(null)}>
          <h2 className="text-lg font-semibold text-[#141B2E]">Reset to the default image?</h2>
          <p className="mt-[10px] text-sm leading-[20px] text-[#4B5468]">
            The {confirmReset} page&rsquo;s welcome popup goes back to the built-in picture, and the uploaded one is
            deleted.
          </p>
          <div className="mt-[18px] flex flex-col gap-[8px]">
            <button
              type="button"
              onClick={() => {
                const role = confirmReset;
                setConfirmReset(null);
                void send(role, fetch(`/api/superadmin/welcome-images?role=${role}`, { method: "DELETE" }));
              }}
              className="flex h-[38px] items-center justify-center rounded-full border border-black/[0.1] text-sm text-red-500 hover:bg-red-50"
            >
              Reset to default
            </button>
            <button
              type="button"
              onClick={() => setConfirmReset(null)}
              className="flex h-[38px] items-center justify-center text-sm text-[#9AA3B2] hover:text-[#141B2E]"
            >
              Keep current image
            </button>
          </div>
        </Modal>
      )}
    </SuperadminDashboardShell>
  );
}
