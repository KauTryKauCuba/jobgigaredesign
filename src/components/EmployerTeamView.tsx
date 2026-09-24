"use client";

import { useEffect, useState } from "react";
import Dropdown from "./Dropdown";
import { gradientFrameClass, inputClass as formInputClass } from "./formStyles";
import { UserIcon, XIcon } from "./icons";
import type { EmployerTeamActivityEntry, EmployerTeamMember } from "@/lib/employer-profile";

const inputClass = formInputClass("teal");

const ROLE_LABEL: Record<string, string> = { owner: "Owner", admin: "Admin" };
const ROLE_PILL: Record<string, { bg: string; text: string }> = {
  owner: { bg: "bg-[#FFF3D6]", text: "text-[#A67C00]" },
  admin: { bg: "bg-[#E6F9FA]", text: "text-[#008990]" },
};

function relativeTimeAgo(value: string | Date): string {
  const minutes = Math.floor((Date.now() - new Date(value).getTime()) / (1000 * 60));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

function describeActivity(entry: EmployerTeamActivityEntry): string {
  const toRoleLabel = entry.toRole ? ROLE_LABEL[entry.toRole] ?? entry.toRole : null;
  const fromRoleLabel = entry.fromRole ? ROLE_LABEL[entry.fromRole] ?? entry.fromRole : null;
  switch (entry.action) {
    case "invited":
      return `${entry.actorLabel} invited ${entry.targetEmail} as ${toRoleLabel}`;
    case "resent_invite":
      return `${entry.actorLabel} resent the invite to ${entry.targetEmail}`;
    case "role_changed":
      return `${entry.actorLabel} changed ${entry.targetEmail}'s role from ${fromRoleLabel} to ${toRoleLabel}`;
    case "removed":
      return `${entry.actorLabel} removed ${entry.targetEmail} (was ${fromRoleLabel})`;
    default:
      return `${entry.actorLabel} updated ${entry.targetEmail}`;
  }
}

function MemberAvatar({ url }: { url: string | null }) {
  if (!url) {
    return (
      <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-[#E6F9FA] text-brand-teal-dark">
        <UserIcon className="h-[16px] w-[16px]" />
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className="h-[38px] w-[38px] shrink-0 rounded-full object-cover" />;
}

export default function EmployerTeamView({
  initialMembers,
  initialActivity,
  currentUserId,
}: {
  initialMembers: EmployerTeamMember[];
  initialActivity: EmployerTeamActivityEntry[];
  currentUserId: string;
}) {
  const [members, setMembers] = useState(initialMembers);
  const [activity, setActivity] = useState(initialActivity);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"owner" | "admin">("admin");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [resentIds, setResentIds] = useState<Set<string>>(() => new Set());

  const ownerCount = members.filter((m) => m.role === "owner").length;

  async function refresh() {
    const res = await fetch("/api/employer/team");
    if (res.ok) {
      const data = await res.json();
      setMembers(data.members);
      setActivity(data.activity);
    }
  }

  async function handleResend(id: string) {
    setResendingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/employer/team/${id}/resend`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't resend that invite.");
        return;
      }
      setResentIds((prev) => new Set(prev).add(id));
      await refresh();
    } catch {
      setError("Couldn't resend that invite — check your connection.");
    } finally {
      setResendingId(null);
    }
  }

  useEffect(() => {
    // Owner rows self-heal on the server the first time this is fetched —
    // running it once on mount keeps the client in sync even if the server
    // component's initial fetch raced that self-heal.
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setError(null);
    try {
      const res = await fetch("/api/employer/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't send that invite.");
        return;
      }
      setMembers(data.members);
      setInviteEmail("");
      setInviteRole("admin");
      await refresh();
    } catch {
      setError("Couldn't send that invite — check your connection.");
    } finally {
      setInviting(false);
    }
  }

  async function handleRoleChange(id: string, role: "owner" | "admin") {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/employer/team/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't change that role.");
        return;
      }
      await refresh();
    } catch {
      setError("Couldn't change that role — check your connection.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleRemove(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/employer/team/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't remove them.");
        return;
      }
      setMembers((prev) => prev.filter((m) => m.id !== id));
    } catch {
      setError("Couldn't remove them — check your connection.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-[20px]">
      <div className={gradientFrameClass("teal")}>
        <div className="flex flex-col gap-[14px] rounded-[19px] bg-white p-[22px]">
          <div>
            <p className="text-sm text-[#141B2E]">Invite a teammate</p>
            <p className="mt-[2px] text-xs text-[#4B5468]">
              They&rsquo;ll need to sign up or log in with this email to join.
            </p>
          </div>
          <form onSubmit={handleInvite} className="flex flex-col gap-[10px] sm:flex-row sm:items-end">
            <div className="flex-1">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="teammate@company.com"
                className={inputClass}
              />
            </div>
            <div className="w-full sm:w-[160px]">
              <Dropdown
                id="inviteRole"
                label="Role"
                value={inviteRole}
                options={[
                  { value: "admin", label: "Admin" },
                  { value: "owner", label: "Owner" },
                ]}
                onChange={(v) => setInviteRole(v as "owner" | "admin")}
              />
            </div>
            <button
              type="submit"
              disabled={inviting || !inviteEmail.trim()}
              className="flex h-[38px] items-center justify-center rounded-[12px] bg-brand-teal-dark px-[18px] text-sm text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {inviting ? "Sending…" : "Send invite"}
            </button>
          </form>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      </div>

      <div className={gradientFrameClass("teal")}>
        <div className="flex flex-col gap-[14px] rounded-[19px] bg-white p-[22px]">
          <p className="text-sm text-[#141B2E]">
            {members.length} member{members.length === 1 ? "" : "s"}
          </p>
          <div className="flex flex-col gap-[8px]">
            {members.map((member) => {
              const pill = ROLE_PILL[member.role] ?? ROLE_PILL.admin;
              const isSelf = member.userId === currentUserId;
              const isLastOwner = member.role === "owner" && ownerCount === 1;
              return (
                <div
                  key={member.id}
                  className="flex flex-wrap items-center gap-[12px] rounded-[12px] border border-[#EAEDF2] bg-[#F8FAFB] p-[12px]"
                >
                  <MemberAvatar url={member.avatarUrl} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-[#141B2E]">
                      {member.name || member.email}
                      {isSelf && <span className="text-[#9AA3B2]"> (you)</span>}
                    </p>
                    <p className="truncate text-xs text-[#9AA3B2]">{member.email}</p>
                  </div>

                  {member.status === "pending" && (
                    <div className="flex items-center gap-[6px]">
                      <span className="rounded-full bg-[#F1F4F8] px-[9px] py-[3px] text-xs text-[#4B5468]">
                        Pending
                      </span>
                      <button
                        type="button"
                        disabled={resendingId === member.id}
                        onClick={() => handleResend(member.id)}
                        className="text-xs text-brand-teal-dark underline hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {resendingId === member.id ? "Sending…" : resentIds.has(member.id) ? "Sent!" : "Resend"}
                      </button>
                    </div>
                  )}

                  <div className="w-[130px]">
                    <Dropdown
                      id={`role-${member.id}`}
                      label="Role"
                      value={member.role}
                      options={[
                        { value: "admin", label: "Admin" },
                        { value: "owner", label: "Owner" },
                      ]}
                      onChange={(v) => handleRoleChange(member.id, v as "owner" | "admin")}
                    />
                  </div>

                  <span className={`rounded-full px-[9px] py-[3px] text-xs ${pill.bg} ${pill.text}`}>
                    {ROLE_LABEL[member.role] ?? member.role}
                  </span>

                  <button
                    type="button"
                    disabled={busyId === member.id || isLastOwner}
                    onClick={() => handleRemove(member.id)}
                    aria-label={`Remove ${member.name || member.email}`}
                    title={isLastOwner ? "A company needs at least one owner." : undefined}
                    className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-full text-[#9AA3B2] hover:bg-black/[0.05] hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <XIcon className="h-[12px] w-[12px]" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {activity.length > 0 && (
        <div className={gradientFrameClass("teal")}>
          <div className="flex flex-col gap-[10px] rounded-[19px] bg-white p-[22px]">
            <p className="text-sm text-[#141B2E]">Activity</p>
            <div className="flex flex-col gap-[8px]">
              {activity.map((entry) => (
                <div key={entry.id} className="flex items-start justify-between gap-[12px] text-xs">
                  <p className="text-[#4B5468]">{describeActivity(entry)}</p>
                  <p className="shrink-0 text-[#9AA3B2]">{relativeTimeAgo(entry.createdAt)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
