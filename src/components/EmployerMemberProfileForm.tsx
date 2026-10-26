"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Dropdown from "./Dropdown";
import Field from "./Field";
import { gradientFrameClass, inputClass as formInputClass } from "./formStyles";
import { CheckIcon, UserIcon } from "./icons";
import PhoneInput from "./PhoneInput";
import { CONTACT_ROLES, POSITIONS, type ContactRole } from "@/lib/positions";
import { TEAM_ROLE_LABEL, type TeamRole } from "@/lib/team-roles";

const inputClass = formInputClass("teal");

const AVATAR_MAX_BYTES = 3 * 1024 * 1024;
const OTHER_POSITION = "__other__";

/**
 * My Profile for an invited teammate — their own name, photo and position.
 * (The company registrant edits theirs on the company's contact form
 * instead; those details belong to the company record, not to teammates.)
 */
export default function EmployerMemberProfileForm({
  initialName,
  initialAvatarUrl,
  initialPosition,
  initialHiringRole,
  initialPhone,
  email,
  companyName,
  teamRole,
  sidebarSlot,
  mode = "edit",
}: {
  // "welcome" = the first-time step after joining a team (/employer/welcome):
  // saving continues to the dashboard.
  mode?: "edit" | "welcome";
  teamRole: TeamRole;
  initialName: string;
  initialAvatarUrl: string | null;
  initialPosition: string | null;
  initialHiringRole: string | null;
  initialPhone: string | null;
  email: string;
  companyName: string;
  sidebarSlot?: React.ReactNode;
}) {
  const router = useRouter();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initialName);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  // undefined = unchanged; null = removed; data URL = newly picked.
  const [avatarChange, setAvatarChange] = useState<string | null | undefined>(undefined);
  const listed = !initialPosition || (POSITIONS as readonly string[]).includes(initialPosition);
  const [positionPick, setPositionPick] = useState(listed ? (initialPosition ?? "") : OTHER_POSITION);
  const [positionOther, setPositionOther] = useState(listed ? "" : (initialPosition ?? ""));
  const [hiringRole, setHiringRole] = useState<ContactRole | "">(
    (CONTACT_ROLES as readonly string[]).includes(initialHiringRole ?? "") ? (initialHiringRole as ContactRole) : "",
  );
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const position = positionPick === OTHER_POSITION ? positionOther.trim() : positionPick;
  const welcome = mode === "welcome";

  function handleAvatarFile(files: FileList | null) {
    const picked = files?.[0];
    if (!picked) return;
    if (!/^image\/(png|jpe?g)$/.test(picked.type)) {
      setError("Use a JPG or PNG photo.");
      return;
    }
    if (picked.size > AVATAR_MAX_BYTES) {
      setError("That photo is over 3 MB — try a smaller one.");
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      setAvatarUrl(dataUrl);
      setAvatarChange(dataUrl);
      setSaved(false);
    };
    reader.readAsDataURL(picked);
  }

  async function save() {
    if (!name.trim()) {
      setError("Enter your full name.");
      return;
    }
    if (!hiringRole) {
      setError("Choose your role.");
      return;
    }
    if (!position) {
      setError("Choose your position.");
      return;
    }
    if (!phone.trim()) {
      setError("Enter your phone number.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/employer/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), hiringRole, position, phone: phone.trim(), avatarUrl: avatarChange }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Couldn't save your profile. Try again.");
        return;
      }
      if (welcome) {
        // Keep the button in its busy state through the navigation.
        router.push("/employer/dashboard");
        return;
      }
      setAvatarChange(undefined);
      setSaved(true);
      // Navbar name/photo/position come from the server.
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setSaving(false);
    }
  }

  // Same "required fields" checklist as the registrant's My Profile.
  const requiredFieldChecklist = [
    { label: "Full name", done: name.trim().length > 0, fieldId: "memberName" },
    { label: "Your role", done: !!hiringRole, fieldId: "memberRole" },
    {
      label: "Position",
      done: !!position,
      fieldId: positionPick === OTHER_POSITION ? "memberPositionOther" : "memberPosition",
    },
    { label: "Phone number", done: phone.trim().length > 0, fieldId: "memberPhone" },
  ];
  const requiredChecklistComplete = requiredFieldChecklist.every((item) => item.done);

  function goToField(fieldId: string) {
    const el = document.getElementById(fieldId);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.focus({ preventScroll: true });
  }

  const card = (
      <div
        className={`animate-fade-in-up ${gradientFrameClass("teal")} min-w-0 ${
          welcome ? "xl:flex-[2]" : "lg:sticky lg:top-[85px] lg:flex-1"
        }`}
      >
        <div className="rounded-[19px] bg-white p-[16px] text-left sm:p-[22px]">
          <h1 className="text-xl font-semibold text-[#141B2E]">About you</h1>
          <p className="mt-[6px] text-sm leading-[20px] text-[#4B5468]">
            {welcome
              ? `You've joined ${companyName} as ${teamRole === "owner" || teamRole === "admin" ? "an" : "a"} ${TEAM_ROLE_LABEL[teamRole]}. Tell your team who you are — this is how you'll appear to them, and as an interviewer or a posting's contact.`
              : `How you appear to your team at ${companyName}, and as an interviewer or a posting's contact.`}
          </p>

          <div className="mt-[16px] flex flex-col gap-[12px]">
            <div className="flex items-center gap-[14px]">
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={(e) => {
                  handleAvatarFile(e.target.files);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                aria-label={avatarUrl ? "Change profile photo" : "Upload profile photo"}
                className="flex h-[64px] w-[64px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-black/[0.1] bg-[#F1F4F8] text-[#9AA3B2] hover:border-brand-teal-dark"
              >
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="Profile" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                ) : (
                  <UserIcon className="h-[26px] w-[26px]" />
                )}
              </button>
              <div className="flex flex-col gap-[4px]">
                <div className="flex items-center gap-[10px]">
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    className="rounded-full bg-[#F1F4F8] px-[12px] py-[6px] text-sm text-[#141B2E] hover:bg-black/[0.08]"
                  >
                    {avatarUrl ? "Change photo" : "Upload photo"}
                  </button>
                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setAvatarUrl(null);
                        setAvatarChange(null);
                        setSaved(false);
                      }}
                      className="text-sm text-[#9AA3B2] hover:text-[#141B2E]"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <p className="text-xs text-[#9AA3B2]">JPG or PNG · up to 3 MB</p>
              </div>
            </div>

            <Field label="Full name" htmlFor="memberName" required>
              <input
                id="memberName"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setSaved(false);
                }}
                className={inputClass}
              />
            </Field>

            {/* Same fields, order and options as the registrant's About you
                (EmployerOnboardingForm). */}
            <Field required label="Your role" htmlFor="memberRole">
              <Dropdown
                id="memberRole"
                label="Your role"
                value={hiringRole}
                options={[
                  { value: "" as const, label: "Select your role" },
                  ...CONTACT_ROLES.map((r) => ({ value: r, label: r })),
                ]}
                onChange={(value) => {
                  setHiringRole(value as ContactRole | "");
                  setSaved(false);
                }}
              />
            </Field>

            <Field required label="Position" htmlFor="memberPosition">
              <Dropdown
                id="memberPosition"
                label="Position"
                value={positionPick}
                searchable
                searchPlaceholder="Search positions..."
                options={[
                  { value: "", label: "Select your position" },
                  ...POSITIONS.map((p) => ({ value: p, label: p })),
                  { value: OTHER_POSITION, label: "Other" },
                ]}
                onChange={(value) => {
                  setPositionPick(value);
                  setSaved(false);
                }}
              />
            </Field>
            {positionPick === OTHER_POSITION && (
              <Field required label="Your position" htmlFor="memberPositionOther">
                <input
                  id="memberPositionOther"
                  type="text"
                  value={positionOther}
                  onChange={(e) => {
                    setPositionOther(e.target.value);
                    setSaved(false);
                  }}
                  placeholder="e.g. Senior Graphic Designer"
                  className={inputClass}
                />
              </Field>
            )}

            <PhoneInput
              required
              id="memberPhone"
              label="Phone number"
              accent="teal"
              value={phone}
              onChange={(value) => {
                setPhone(value);
                setSaved(false);
                setError(null);
              }}
            />

            <Field label="Email address" htmlFor="memberEmail">
              <input
                id="memberEmail"
                type="email"
                value={email}
                readOnly
                disabled
                className={`${inputClass} cursor-not-allowed bg-[#F8FAFB] text-[#9AA3B2]`}
              />
            </Field>

            {error && <p className="text-xs text-red-500">{error}</p>}
            {saved && !error && <p className="text-xs text-[#2F7D4F]">Saved.</p>}

            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="flex h-[44px] items-center justify-center rounded-full bg-brand-teal-dark text-sm text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving…" : welcome ? "Continue to dashboard" : "Save changes"}
            </button>
          </div>
        </div>
      </div>
  );

  // Same "required fields" checklist card as the registrant's My Profile.
  const checklist = (
    <div
      className={
        requiredChecklistComplete
          ? gradientFrameClass("teal")
          : "rounded-[20px] bg-gradient-to-br from-[#A66A61] via-white to-[#A66A61] p-px shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_40px_-24px_rgba(20,27,46,0.2)]"
      }
    >
      <div className="rounded-[19px] bg-white p-[16px] sm:p-[22px]">
        <p className="text-left text-lg font-semibold text-[#141B2E]">
          {requiredChecklistComplete ? "All required fields are complete." : "Complete these required fields to continue:"}
        </p>
        <ul className="mt-[16px] flex flex-col gap-[4px]">
          {requiredFieldChecklist.map(({ label, done, fieldId }) => (
            <li key={label}>
              <button
                type="button"
                disabled={done}
                onClick={() => goToField(fieldId)}
                className={`flex w-full items-center gap-[8px] text-left text-sm ${
                  done ? "cursor-default text-[#1F7A3F]" : "text-[#A66A61] hover:underline"
                }`}
              >
                <span
                  className={`flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-full border ${
                    done ? "border-[#1F7A3F] bg-[#1F7A3F]" : "border-[#C99089]"
                  }`}
                >
                  {done && <CheckIcon className="h-[8px] w-[8px] text-white" />}
                </span>
                {label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );

  // The welcome step: About you with the checklist beside it (the page adds
  // the "Your invite" card on the left).
  if (welcome) {
    // Two columns of the page's 1 : 2 : 1 row (same as company onboarding):
    // About you at 2, the checklist at 1 — returned as siblings so they sit
    // directly in the page's flex row.
    return (
      <>
        {card}
        <div className="min-w-0 xl:sticky xl:top-[22px] xl:flex-[1]">{checklist}</div>
      </>
    );
  }

  // Same three-column layout as the registrant's My Profile
  // (EmployerOnboardingForm, mode "edit"): About you + the page's sidebar
  // cards, then the required-fields checklist.
  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-[20px] lg:flex-row lg:items-start">
      <div className="flex min-w-0 flex-col gap-[20px] lg:flex-1 lg:flex-row lg:items-start">
        {card}
        {sidebarSlot && <div className="min-w-0 lg:flex-1">{sidebarSlot}</div>}
      </div>

      <div className="flex flex-col gap-[16px] lg:sticky lg:top-[85px] lg:w-[300px] lg:shrink-0">
        {checklist}
      </div>
    </div>
  );
}
