"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Dropdown from "./Dropdown";
import Modal from "./Modal";
import { gradientFrameClass, inputClass as formInputClass } from "./formStyles";
import { BriefcaseIcon, CalendarIcon, CheckIcon, PencilIcon, SearchIcon, UserIcon, UsersIcon, XIcon } from "./icons";
import type { EmployerTeamActivityEntry, EmployerTeamMember } from "@/lib/employer-profile";
import { POSITIONS } from "@/lib/positions";
import {
  hasFullAccess,
  TEAM_ROLE_DESCRIPTION,
  TEAM_ROLE_LABEL,
  TEAM_ROLE_PILL,
  TEAM_ROLES,
  type TeamRole,
} from "@/lib/team-roles";

const inputClass = formInputClass("teal");
const OTHER_POSITION = "__other__" as const;

type JobOption = { id: string; title: string; status: string };
type AssignedJob = { id: string; title: string };

// Members-list tabs: everyone, then each kind of access.
const TABS = [
  { key: "all", label: "All", roles: TEAM_ROLES },
  { key: "admins", label: "Owners & admins", roles: ["owner", "admin"] },
  { key: "hiring_manager", label: "Hiring managers", roles: ["hiring_manager"] },
  { key: "panel", label: "Interview panel", roles: ["panel"] },
] as const satisfies readonly { key: string; label: string; roles: readonly TeamRole[] }[];
type TabKey = (typeof TABS)[number]["key"];

const TAB_EMPTY: Record<TabKey, string> = {
  all: "No one on the team yet.",
  admins: "No owners or admins yet.",
  hiring_manager:
    "No hiring managers yet. Invite a department head as a Hiring manager — they'll see only the jobs you assign them, and get notified when someone applies.",
  panel:
    "No panel members yet. Invite someone as a Panel member — they'll see only the interviews they're added to, and submit their evaluation.",
};

const ROLE_ICON: Record<TeamRole, (props: { className?: string }) => React.ReactElement> = {
  owner: UsersIcon,
  admin: UsersIcon,
  hiring_manager: BriefcaseIcon,
  panel: CalendarIcon,
};

// Statuses a Hiring manager can usefully be put on — drafts included, so
// they're set up before the posting goes live.
const ASSIGNABLE_STATUSES = new Set(["draft", "pending", "active", "flagged", "filled", "closed"]);
const JOB_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  pending: "In review",
  active: "Active",
  flagged: "Flagged",
  filled: "Filled",
  closed: "Closed",
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
  const toRoleLabel = entry.toRole ? TEAM_ROLE_LABEL[entry.toRole] : null;
  const fromRoleLabel = entry.fromRole ? TEAM_ROLE_LABEL[entry.fromRole] : null;
  switch (entry.action) {
    case "invited":
      return `${entry.actorLabel} invited ${entry.targetEmail} as ${toRoleLabel}`;
    case "resent_invite":
      return `${entry.actorLabel} resent the invite to ${entry.targetEmail}`;
    case "role_changed":
      return `${entry.actorLabel} changed ${entry.targetEmail}'s role from ${fromRoleLabel} to ${toRoleLabel}`;
    case "removed":
      return `${entry.actorLabel} removed ${entry.targetEmail} (was ${fromRoleLabel})`;
    case "joined":
      return `${entry.targetEmail} accepted the invite and joined as ${toRoleLabel}`;
    case "declined":
      return `${entry.targetEmail} declined the invite`;
    case "job_assigned":
      return `${entry.actorLabel} made ${entry.targetEmail} hiring manager for ${entry.detail ?? "a job"}`;
    case "job_unassigned":
      return `${entry.actorLabel} removed ${entry.targetEmail} as hiring manager for ${entry.detail ?? "a job"}`;
    default:
      return `${entry.actorLabel} updated ${entry.targetEmail}`;
  }
}

function MemberAvatar({ url }: { url: string | null }) {
  // The URL it failed on — a broken photo (e.g. a Google account photo that
  // was removed) falls back to the icon instead of a broken-image box.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (!url || failedUrl === url) {
    return (
      <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-brand-teal-soft text-brand-teal-dark">
        <UserIcon className="h-[16px] w-[16px]" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      // Google account photos rate-limit (429) requests that carry another
      // site's referrer — sending none lets them load.
      referrerPolicy="no-referrer"
      onError={() => setFailedUrl(url)}
      className="h-[38px] w-[38px] shrink-0 rounded-full object-cover"
    />
  );
}

/** Checkbox list of the company's postings — the invite form and "Edit jobs" both use it. */
function JobPicker({
  jobs,
  selected,
  onChange,
}: {
  jobs: JobOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const assignable = jobs.filter((j) => ASSIGNABLE_STATUSES.has(j.status));
  if (assignable.length === 0) {
    return (
      <p className="rounded-[12px] bg-[#F8FAFB] p-[12px] text-xs text-[#9AA3B2]">
        No job postings yet — you can assign them from Post a job once you create one.
      </p>
    );
  }
  return (
    <div className="scrollbar-thin-teal flex max-h-[240px] flex-col gap-[6px] overflow-y-auto">
      {assignable.map((job) => {
        const checked = selected.includes(job.id);
        return (
          <button
            key={job.id}
            type="button"
            role="checkbox"
            aria-checked={checked}
            onClick={() => onChange(checked ? selected.filter((id) => id !== job.id) : [...selected, job.id])}
            className={`flex items-center gap-[10px] rounded-[12px] border px-[12px] py-[9px] text-left transition-colors ${
              checked ? "border-brand-teal-dark bg-brand-teal-soft" : "border-[#EAEDF2] bg-white hover:bg-[#F8FAFB]"
            }`}
          >
            <span
              className={`flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-[5px] border ${
                checked ? "border-brand-teal-dark bg-brand-teal-dark text-white" : "border-black/[0.2] bg-white"
              }`}
            >
              {checked && <CheckIcon className="h-[9px] w-[9px]" />}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm text-[#141B2E]">{job.title}</span>
            <span className="shrink-0 text-xs text-[#9AA3B2]">{JOB_STATUS_LABEL[job.status] ?? job.status}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function EmployerTeamView({
  initialMembers,
  initialActivity,
  initialJobAssignments,
  jobPostings,
  currentUserId,
  currentUserRole,
  ownerPosition,
}: {
  initialMembers: EmployerTeamMember[];
  initialActivity: EmployerTeamActivityEntry[];
  // Each Hiring manager's postings, keyed by team-member id.
  initialJobAssignments: Record<string, AssignedJob[]>;
  jobPostings: JobOption[];
  currentUserId: string;
  currentUserRole: TeamRole;
  // The owner's own job title (employerProfiles.contactPosition, set on My
  // Profile) — displayed for their row instead of a `position` column value,
  // since the owner's row has no reason to duplicate that field.
  ownerPosition?: string | null;
}) {
  const [members, setMembers] = useState(initialMembers);
  const [activity, setActivity] = useState(initialActivity);
  const [jobAssignments, setJobAssignments] = useState(initialJobAssignments);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<TeamRole>("admin");
  const [inviteJobIds, setInviteJobIds] = useState<string[]>([]);
  const [invitePositionChoice, setInvitePositionChoice] = useState<(typeof POSITIONS)[number] | "" | "__other__">("");
  const [invitePositionOther, setInvitePositionOther] = useState("");
  const invitePosition = invitePositionChoice === OTHER_POSITION ? invitePositionOther : invitePositionChoice;
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [resentIds, setResentIds] = useState<Set<string>>(() => new Set());
  const [tab, setTab] = useState<TabKey>("all");
  // "Edit jobs" for one Hiring manager.
  const [editingJobs, setEditingJobs] = useState<{ member: EmployerTeamMember; jobIds: string[] } | null>(null);
  const [savingJobs, setSavingJobs] = useState(false);
  const [jobsError, setJobsError] = useState<string | null>(null);

  const isOwner = currentUserRole === "owner";
  // Only an Owner can hand out (or take away) Owner.
  const roleOptions = TEAM_ROLES.filter((r) => r !== "owner" || isOwner).map((r) => ({
    value: r,
    label: TEAM_ROLE_LABEL[r],
  }));

  const ownerCount = members.filter((m) => m.role === "owner").length;
  const [search, setSearch] = useState("");
  // Removing someone, demoting the company's registrant, or moving a Hiring
  // manager off their jobs waits for an explicit yes in the dialog below.
  const [confirming, setConfirming] = useState<
    | { kind: "remove"; member: EmployerTeamMember }
    | { kind: "role"; member: EmployerTeamMember; role: TeamRole }
    | null
  >(null);
  const router = useRouter();
  const searchTerm = search.trim().toLowerCase();
  const tabRoles: readonly TeamRole[] = TABS.find((t) => t.key === tab)?.roles ?? TEAM_ROLES;
  const inTab = members.filter((m) => tabRoles.includes(m.role));
  const visibleMembers = searchTerm
    ? inTab.filter((m) => {
        const position = m.role === "owner" ? ownerPosition : m.position;
        return [m.name, m.email, position].some((v) => (v ?? "").toLowerCase().includes(searchTerm));
      })
    : inTab;

  async function refresh() {
    const res = await fetch("/api/employer/team");
    if (res.ok) {
      const data = await res.json();
      setMembers(data.members);
      setActivity(data.activity);
      setJobAssignments(data.jobAssignments ?? {});
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
    // refresh() is async and only calls setState after its `await fetch(...)`
    // resolves, not synchronously within this effect body, so there's no
    // cascading render on mount; the rule can't see through the function call.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
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
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
          position: invitePosition.trim() || null,
          ...(inviteRole === "hiring_manager" ? { jobPostingIds: inviteJobIds } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't send that invite.");
        return;
      }
      setMembers(data.members);
      if (data.jobAssignments) setJobAssignments(data.jobAssignments);
      // Show the tab the new person landed in.
      setTab(inviteRole === "hiring_manager" ? "hiring_manager" : inviteRole === "panel" ? "panel" : "all");
      setInviteEmail("");
      setInviteRole("admin");
      setInviteJobIds([]);
      setInvitePositionChoice("");
      setInvitePositionOther("");
      await refresh();
    } catch {
      setError("Couldn't send that invite — check your connection.");
    } finally {
      setInviting(false);
    }
  }

  async function handleRoleChange(id: string, role: TeamRole, confirmed = false) {
    const member = members.find((m) => m.id === id);
    if (!member || member.role === role) return;
    // A role decides what someone can see and do, so every change asks for an
    // explicit yes first (the dialog also flags the bigger consequences:
    // demoting the registrant makes you the main contact, and moving a Hiring
    // manager unassigns their jobs).
    if (!confirmed) {
      setConfirming({ kind: "role", member, role });
      return;
    }
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
      // The registration moved to you — your navbar/My Profile change too.
      // Or you changed your own role: as a Hiring manager / Panel member the
      // page reloads into your new dashboard home.
      if (member.isRegistrant || member.userId === currentUserId) router.refresh();
    } catch {
      setError("Couldn't change that role — check your connection.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleRemove(id: string) {
    const member = members.find((m) => m.id === id);
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
      await refresh();
      // The registration moved to you — your navbar/My Profile change too.
      if (member?.isRegistrant) router.refresh();
    } catch {
      setError("Couldn't remove them — check your connection.");
    } finally {
      setBusyId(null);
    }
  }

  async function saveJobs() {
    if (!editingJobs) return;
    setSavingJobs(true);
    setJobsError(null);
    try {
      const res = await fetch(`/api/employer/team/${editingJobs.member.id}/jobs`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobPostingIds: editingJobs.jobIds }),
      });
      const data = await res.json();
      if (!res.ok) {
        setJobsError(data.error ?? "Couldn't save their jobs.");
        return;
      }
      setEditingJobs(null);
      await refresh();
    } catch {
      setJobsError("Couldn't save their jobs — check your connection.");
    } finally {
      setSavingJobs(false);
    }
  }

  return (
    <div className="flex flex-col gap-[20px]">
      {/* Each card is its own stacking layer, so a dropdown opening downward needs its card above the ones below it: invite (z-20) over members (z-10) over activity. */}
      <div className={`relative z-20 animate-fade-in-up ${gradientFrameClass("teal")}`}>
        <div className="flex flex-col gap-[14px] rounded-[19px] bg-white p-[16px] sm:p-[22px]">
          <div>
            <p className="text-sm text-[#141B2E]">Invite a teammate</p>
            <p className="mt-[2px] text-xs text-[#4B5468]">
              They&rsquo;ll need to sign up or log in with this email to join.
            </p>
          </div>
          <form onSubmit={handleInvite} className="flex flex-col gap-[10px]">
            <div className="flex flex-col gap-[10px] sm:flex-row sm:items-end">
              <div className="sm:flex-1">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="teammate@company.com"
                  className={inputClass}
                />
              </div>
              <div className="w-full sm:w-[200px]">
                <Dropdown
                  id="invitePosition"
                  label="Position"
                  searchable
                  searchPlaceholder="Search positions..."
                  value={invitePositionChoice}
                  options={[
                    { value: "" as const, label: "Position (optional)" },
                    ...POSITIONS.map((p) => ({ value: p as (typeof POSITIONS)[number] | "" | "__other__", label: p })),
                    { value: OTHER_POSITION, label: "Other" },
                  ]}
                  onChange={(v) => setInvitePositionChoice(v)}
                />
              </div>
              <div className="w-full sm:w-[170px]">
                <Dropdown
                  id="inviteRole"
                  label="Role"
                  value={inviteRole}
                  options={roleOptions}
                  onChange={(v) => setInviteRole(v)}
                />
              </div>
              <button
                type="submit"
                disabled={inviting || !inviteEmail.trim()}
                className="flex h-[38px] items-center justify-center rounded-[12px] bg-brand-teal-dark px-[18px] text-sm text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {inviting ? "Sending…" : "Send invite"}
              </button>
            </div>
            {invitePositionChoice === OTHER_POSITION && (
              <input
                type="text"
                value={invitePositionOther}
                onChange={(e) => setInvitePositionOther(e.target.value)}
                placeholder="Their position, e.g. Senior Graphic Designer"
                className={`${inputClass} sm:max-w-[320px]`}
              />
            )}

            {/* What the picked role can do — so nobody guesses. */}
            <div className="flex items-start gap-[10px] rounded-[12px] border border-[#EAEDF2] bg-[#F8FAFB] p-[12px]">
              {(() => {
                const Icon = ROLE_ICON[inviteRole];
                const pill = TEAM_ROLE_PILL[inviteRole];
                return (
                  <span className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full ${pill.bg} ${pill.text}`}>
                    <Icon className="h-[14px] w-[14px]" />
                  </span>
                );
              })()}
              <div className="min-w-0">
                <p className="text-xs text-[#141B2E]">{TEAM_ROLE_LABEL[inviteRole]}</p>
                <p className="mt-[1px] text-xs leading-[18px] text-[#4B5468]">{TEAM_ROLE_DESCRIPTION[inviteRole]}</p>
              </div>
            </div>

            {inviteRole === "hiring_manager" && (
              <div className="flex flex-col gap-[8px]">
                <div>
                  <p className="text-xs text-[#141B2E]">Their jobs (optional)</p>
                  <p className="mt-[1px] text-xs text-[#9AA3B2]">
                    They&rsquo;ll see these jobs&rsquo; applicants and be notified when someone applies. You can change
                    this any time, or from Post a job.
                  </p>
                </div>
                <JobPicker jobs={jobPostings} selected={inviteJobIds} onChange={setInviteJobIds} />
              </div>
            )}
          </form>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      </div>

      <div className={`relative z-10 animate-fade-in-up ${gradientFrameClass("teal")}`} style={{ animationDelay: "60ms" }}>
        <div className="flex flex-col gap-[14px] rounded-[19px] bg-white p-[16px] sm:p-[22px]">
          <div className="flex flex-wrap items-center justify-between gap-[10px]">
            <p className="text-sm text-[#141B2E]">
              {searchTerm ? `${visibleMembers.length} of ${inTab.length}` : inTab.length} member
              {(searchTerm ? visibleMembers.length : inTab.length) === 1 ? "" : "s"}
            </p>
            <div role="tablist" aria-label="Filter team by role" className="scrollbar-hide flex max-w-full gap-[4px] overflow-x-auto rounded-full bg-[#F1F4F8] p-[3px]">
              {TABS.map((t) => {
                const count = members.filter((m) => (t.roles as readonly TeamRole[]).includes(m.role)).length;
                const selected = tab === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setTab(t.key)}
                    className={`flex shrink-0 items-center gap-[6px] whitespace-nowrap rounded-full px-[12px] py-[6px] text-xs transition-colors ${
                      selected ? "bg-white text-[#141B2E] shadow-[0_1px_2px_rgba(0,0,0,0.06)]" : "text-[#4B5468] hover:text-[#141B2E]"
                    }`}
                  >
                    {t.label}
                    <span className={selected ? "text-brand-teal-dark" : "text-[#9AA3B2]"}>{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-[8px] rounded-[12px] border border-black/[0.1] px-[12px] focus-within:border-brand-teal-dark">
            <SearchIcon className="h-[13px] w-[13px] shrink-0 text-[#9AA3B2]" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search team by name, email or position..."
              aria-label="Search team members"
              className="h-[38px] w-full bg-transparent text-sm text-[#141B2E] outline-none placeholder:text-[#9AA3B2]"
            />
          </div>
          {searchTerm && visibleMembers.length === 0 && (
            <p className="text-sm text-[#9AA3B2]">No team members match &ldquo;{search.trim()}&rdquo;.</p>
          )}
          {!searchTerm && inTab.length === 0 && (
            <p className="rounded-[12px] bg-[#F8FAFB] p-[14px] text-xs leading-[18px] text-[#9AA3B2]">{TAB_EMPTY[tab]}</p>
          )}
          <div className="flex flex-col gap-[8px]">
            {visibleMembers.map((member) => {
              const pill = TEAM_ROLE_PILL[member.role];
              const isSelf = member.userId === currentUserId;
              const isLastOwner = member.role === "owner" && ownerCount === 1;
              // Admins can't touch an Owner's role (the server refuses too).
              const canEditRole = isOwner || member.role !== "owner";
              // The owner's own row has no `position` of its own — it shows
              // My Profile's contactPosition instead (see `ownerPosition` prop).
              const displayPosition = member.role === "owner" ? ownerPosition : member.position;
              const jobs = jobAssignments[member.id] ?? [];
              return (
                <div
                  key={member.id}
                  className="@container rounded-[12px] border border-[#EAEDF2] bg-[#F8FAFB] p-[12px]"
                >
                  <div className="flex flex-wrap items-center gap-x-[12px] gap-y-[10px]">
                    <MemberAvatar url={member.avatarUrl} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-[#141B2E]">
                        {member.name || member.email}
                        {isSelf && <span className="text-[#9AA3B2]"> (you)</span>}
                      </p>
                      <p className="truncate text-xs text-[#9AA3B2]">
                        {displayPosition ? `${displayPosition} · ${member.email}` : member.email}
                      </p>
                    </div>

                    <div className="order-last flex w-full flex-wrap items-center gap-[8px] @[34rem]:order-none @[34rem]:w-auto">
                      {member.status === "pending" && (
                        <div className="flex items-center gap-[6px]">
                          {member.inviteExpired && !resentIds.has(member.id) ? (
                            <span className="rounded-full bg-[#FFF1E6] px-[9px] py-[3px] text-xs text-[#B4561F]">
                              Invite expired
                            </span>
                          ) : (
                            <span className="rounded-full bg-[#F1F4F8] px-[9px] py-[3px] text-xs text-[#4B5468]">
                              Pending
                            </span>
                          )}
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

                      {canEditRole ? (
                        <div className="w-[160px]">
                          <Dropdown
                            id={`role-${member.id}`}
                            label="Role"
                            value={member.role}
                            disabled={busyId === member.id}
                            options={roleOptions}
                            onChange={(v) => handleRoleChange(member.id, v)}
                          />
                        </div>
                      ) : (
                        <span className={`rounded-full px-[9px] py-[3px] text-xs ${pill.bg} ${pill.text}`}>
                          {TEAM_ROLE_LABEL[member.role]}
                        </span>
                      )}
                    </div>

                    {isSelf ? (
                      // You can't remove yourself (the server refuses too) —
                      // an empty slot keeps the rows' columns lined up.
                      <span className="h-[32px] w-[32px] shrink-0" aria-hidden />
                    ) : (
                      <button
                        type="button"
                        disabled={busyId === member.id || isLastOwner || !canEditRole}
                        onClick={() => setConfirming({ kind: "remove", member })}
                        aria-label={`Remove ${member.name || member.email}`}
                        title={
                          isLastOwner
                            ? "A company needs at least one owner."
                            : !canEditRole
                              ? "Only an owner can remove an owner."
                              : undefined
                        }
                        className="flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-full text-[#9AA3B2] hover:bg-black/[0.05] hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <XIcon className="h-[12px] w-[12px]" />
                      </button>
                    )}
                  </div>

                  {member.role === "hiring_manager" && (
                    <div className="mt-[10px] flex flex-wrap items-center gap-[6px] border-t border-[#EAEDF2] pt-[10px]">
                      <BriefcaseIcon className="h-[12px] w-[12px] shrink-0 text-[#3B5BDB]" />
                      {jobs.length === 0 ? (
                        <span className="text-xs text-[#9AA3B2]">No jobs assigned yet — they won&rsquo;t see any applicants.</span>
                      ) : (
                        jobs.map((job) => (
                          <span key={job.id} className="max-w-[220px] truncate rounded-full bg-[#EAF0FE] px-[9px] py-[2px] text-xs text-[#3B5BDB]">
                            {job.title}
                          </span>
                        ))
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setJobsError(null);
                          setEditingJobs({ member, jobIds: jobs.map((j) => j.id) });
                        }}
                        className="ml-auto flex items-center gap-[4px] text-xs text-brand-teal-dark hover:underline"
                      >
                        <PencilIcon className="h-[10px] w-[10px]" />
                        {jobs.length === 0 ? "Assign jobs" : "Edit jobs"}
                      </button>
                    </div>
                  )}
                  {member.role === "panel" && (
                    <div className="mt-[10px] flex items-center gap-[6px] border-t border-[#EAEDF2] pt-[10px]">
                      <CalendarIcon className="h-[12px] w-[12px] shrink-0 text-[#7C5CD1]" />
                      <span className="text-xs text-[#4B5468]">
                        Add them to an interview&rsquo;s panel when you schedule it — they&rsquo;ll see only those
                        interviews.
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {editingJobs && (
        <Modal ariaLabel={`Jobs for ${editingJobs.member.name || editingJobs.member.email}`} onClose={() => setEditingJobs(null)}>
          <p className="text-lg font-semibold text-[#141B2E]">
            {editingJobs.member.name || editingJobs.member.email}&rsquo;s jobs
          </p>
          <p className="mt-[6px] text-sm leading-[20px] text-[#4B5468]">
            As hiring manager they see these jobs&rsquo; applicants and interviews, move candidates along, and are
            notified when someone applies.
          </p>
          <div className="mt-[14px]">
            <JobPicker
              jobs={jobPostings}
              selected={editingJobs.jobIds}
              onChange={(jobIds) => setEditingJobs((prev) => (prev ? { ...prev, jobIds } : prev))}
            />
          </div>
          {jobsError && <p className="mt-[10px] text-xs text-red-500">{jobsError}</p>}
          <div className="mt-[18px] flex gap-[8px]">
            <button
              type="button"
              disabled={savingJobs}
              onClick={saveJobs}
              className="flex h-[40px] flex-1 items-center justify-center rounded-full bg-brand-teal-dark text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {savingJobs ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditingJobs(null)}
              className="flex h-[40px] items-center justify-center rounded-full border border-black/[0.1] px-[18px] text-sm text-[#141B2E] hover:bg-black/[0.03]"
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}

      {confirming &&
        (() => {
          const { member } = confirming;
          const who = member.name || member.email;
          const toRole = confirming.kind === "role" ? confirming.role : null;
          const jobCount = jobAssignments[member.id]?.length ?? 0;
          return (
            <Modal
              ariaLabel={confirming.kind === "remove" ? `Remove ${who}` : `Change ${who}'s role`}
              onClose={() => setConfirming(null)}
            >
              <p className="text-lg font-semibold text-[#141B2E]">
                {toRole ? `Make ${who} ${toRole === "owner" || toRole === "admin" ? "an" : "a"} ${TEAM_ROLE_LABEL[toRole]}?` : `Remove ${who} from the team?`}
              </p>
              <p className="mt-[8px] text-sm leading-[20px] text-[#4B5468]">
                {confirming.kind === "remove"
                  ? member.status === "pending"
                    ? "Their invite will be cancelled and the link in their email will stop working."
                    : "They'll lose access to this company straight away — its job postings, applicants and interviews."
                  : TEAM_ROLE_DESCRIPTION[toRole!]}
              </p>
              {toRole && (
                <div className="mt-[10px] flex items-center gap-[8px] text-xs text-[#4B5468]">
                  <span className={`rounded-full px-[9px] py-[3px] ${TEAM_ROLE_PILL[member.role].bg} ${TEAM_ROLE_PILL[member.role].text}`}>
                    {TEAM_ROLE_LABEL[member.role]}
                  </span>
                  <span aria-hidden>→</span>
                  <span className={`rounded-full px-[9px] py-[3px] ${TEAM_ROLE_PILL[toRole].bg} ${TEAM_ROLE_PILL[toRole].text}`}>
                    {TEAM_ROLE_LABEL[toRole]}
                  </span>
                </div>
              )}
              {toRole && !hasFullAccess(member.role) && hasFullAccess(toRole) && (
                <p className="mt-[10px] rounded-[12px] border border-[#FBE7B3] bg-brand-gold-soft p-[10px] text-xs leading-[18px] text-[#141B2E]">
                  <span className="font-semibold">This gives {who} full access</span> — every job posting, all applicants,
                  the company profile, ads and the team.
                </p>
              )}
              {toRole && hasFullAccess(member.role) && !hasFullAccess(toRole) && (
                <p className="mt-[10px] rounded-[12px] bg-[#F8FAFB] p-[10px] text-xs leading-[18px] text-[#4B5468]">
                  {who} will lose access to the company profile, ads and team, and to anything outside what a{" "}
                  {TEAM_ROLE_LABEL[toRole]} can see.
                </p>
              )}
              {toRole && member.userId === currentUserId && (
                <p className="mt-[10px] rounded-[12px] border border-[#FBE7B3] bg-brand-gold-soft p-[10px] text-xs leading-[18px] text-[#141B2E]">
                  <span className="font-semibold">This is your own role</span> — your dashboard changes straight away, and
                  you may not be able to change it back.
                </p>
              )}
              {toRole && member.role === "hiring_manager" && jobCount > 0 && (
                <p className="mt-[10px] rounded-[12px] bg-[#F8FAFB] p-[10px] text-xs leading-[18px] text-[#4B5468]">
                  They&rsquo;ll stop being hiring manager for {jobCount} job{jobCount === 1 ? "" : "s"}
                  {hasFullAccess(toRole) ? " — as " + TEAM_ROLE_LABEL[toRole] + " they'll see every job anyway." : "."}
                </p>
              )}
              {member.isRegistrant && member.role === "owner" && (
                <p className="mt-[10px] rounded-[12px] border border-[#FBE7B3] bg-brand-gold-soft p-[10px] text-xs leading-[18px] text-[#141B2E]">
                  {who} registered this company, so <span className="font-semibold">you&rsquo;ll become its main contact</span>{" "}
                  — your name, email and photo replace theirs on the company. Add your phone number and hiring role on My
                  Profile afterwards.
                </p>
              )}
              <div className="mt-[18px] flex gap-[8px]">
                <button
                  type="button"
                  disabled={busyId === member.id}
                  onClick={async () => {
                    setConfirming(null);
                    if (confirming.kind === "remove") await handleRemove(member.id);
                    else await handleRoleChange(member.id, confirming.role, true);
                  }}
                  className={`flex h-[40px] flex-1 items-center justify-center rounded-full text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-60 ${
                    confirming.kind === "remove" ? "bg-red-500" : "bg-brand-teal-dark"
                  }`}
                >
                  {toRole ? `Yes, make ${TEAM_ROLE_LABEL[toRole]}` : "Yes, remove"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(null)}
                  className="flex h-[40px] items-center justify-center rounded-full border border-black/[0.1] px-[18px] text-sm text-[#141B2E] hover:bg-black/[0.03]"
                >
                  Cancel
                </button>
              </div>
            </Modal>
          );
        })()}

      {activity.length > 0 && (
        <div className={`animate-fade-in-up ${gradientFrameClass("teal")}`} style={{ animationDelay: "120ms" }}>
          <div className="flex flex-col gap-[10px] rounded-[19px] bg-white p-[16px] sm:p-[22px]">
            <p className="text-sm text-[#141B2E]">Activity</p>
            <div className="flex flex-col gap-[8px]">
              {activity.map((entry) => (
                <div key={entry.id} className="flex items-start justify-between gap-[12px] text-xs">
                  <p className="text-[#4B5468]">{describeActivity(entry)}</p>
                  {/* "Xm ago" is computed from the current time, so the
                      server's render and the browser's can straddle a
                      minute boundary — an expected, harmless difference. */}
                  <p className="shrink-0 text-[#9AA3B2]" suppressHydrationWarning>
                    {relativeTimeAgo(entry.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
