import "server-only";
import { APPLICATION_STATUS_LABEL } from "./applicationStatus";
import type {
  CancelInterviewRequest,
  ClosePostingRequest,
  DraftJobPostingRequest,
  RecordEvaluationRequest,
  ScheduleInterviewRequest,
  StageChangeItem,
} from "./assistant-types";
import { countBy, dayKey, daysBetween, fmtDate, fmtDateTime, locationBreakdown } from "./assistant-context";
import { applicationStatusEnum, interviewResponseStatusEnum } from "./db/schema";
import { db } from "./db";
import { jobseekerProfiles, users } from "./db/schema";
import { eq } from "drizzle-orm";
import type { EmployerProfile, EmployerTeamMember } from "./employer-profile";
import { canManagePostings, type HiringScope } from "./hiring-scope";
import { EVALUATION_CRITERIA, type EvaluationCriterion, type InterviewRecommendation } from "./interviewEvaluation";
import type { getApplicationsForEmployer } from "./job-applications";
import { suggestJobPosting } from "./job-posting-suggestion";
import type { JobPosting } from "./job-postings";
import { getJobseekerProfileById } from "./jobseeker-profile";
import { malaysiaStateNamed, malaysiaStateOf } from "./malaysia";
import { computeMatchResults, type MatchResult } from "./match-results";
import { screeningEligibilityCheck } from "./matching";
import { postingLocationLabel } from "./postingLocation";

// The employer assistant's lookup tools: the model asks for a search ("find
// applicants: Frontend Engineer, shortlisted, from KL"), this runs it and
// hands back real records with every count already worked out, and the model
// only has to phrase the answer.
//
// Read-only, and they only ever search the postings/applications the route
// already loaded for this user with their hiring scope applied — so a Hiring
// manager or Panel member can't look up anything their own pages wouldn't
// show them. Results are compact JSON with empty fields dropped, to keep each
// round trip small and fast.

export type EmployerApplication = Awaited<ReturnType<typeof getApplicationsForEmployer>>[number];

export type ToolDefinition = {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
};

export type ApplicantSearch =
  | { ok: true; list: EmployerApplication[]; matchedPostings?: string[]; fit: Map<string, MatchResult> }
  | { ok: false; error: Record<string, unknown> };

export type AssistantTools = {
  definitions: ToolDefinition[];
  /** Runs one tool call; always resolves to the JSON text to hand back to the model, errors included. */
  run: (name: string, rawArguments: string) => Promise<string>;
  /** find_applicants' filters and sort, without the listing limit — what the Excel export uses. */
  searchApplicants: (args: Record<string, unknown>) => Promise<ApplicantSearch>;
  /** The filters export_applicants was called with this request, if it was — the reply's Download Excel button. */
  exportRequest: () => Record<string, unknown> | null;
  /** The applicants open_applicant picked this request (none, one or several) — shown as profile cards. */
  openRequest: () => { applicationId: string; name: string; posting: string }[];
  /** Every applicant this user can see, by name — to catch a reply naming someone who isn't one. */
  knownNames: () => string[];
  /** Everything the lookups returned this request, as text. */
  lookupText: () => string;
  /** The moves change_stage prepared this request, if any — the reply's confirmation card. */
  stageChangeRequest: () => {
    to: string;
    toLabel: string;
    items: StageChangeItem[];
    skipped: { name: string; reason: string }[];
  } | null;
  /** What schedule_interview prepared this request, if any — the reply's schedule/reschedule card. */
  scheduleInterviewRequest: () => Omit<ScheduleInterviewRequest, "resolution"> | null;
  /** What cancel_interview prepared this request, if any — the reply's cancel card. */
  cancelInterviewRequest: () => Omit<CancelInterviewRequest, "resolution"> | null;
  /** What record_evaluation prepared this request, if any — the reply's evaluation card. */
  recordEvaluationRequest: () => Omit<RecordEvaluationRequest, "resolution"> | null;
  /** What close_posting prepared this request, if any — the reply's close-posting card. */
  closePostingRequest: () => Omit<ClosePostingRequest, "resolution"> | null;
  /** What draft_job_posting prepared this request, if any — the reply's new-posting card. */
  draftJobPostingRequest: () => Omit<DraftJobPostingRequest, "resolution" | "postingId"> | null;
};

const STAGES = applicationStatusEnum.enumValues;
const RESPONSES = interviewResponseStatusEnum.enumValues;
const RESPONSE_LABEL: Record<(typeof RESPONSES)[number], string> = {
  pending: "no reply yet",
  accepted: "accepted",
  declined: "declined",
  reschedule_requested: "asked to reschedule",
  attended: "attended",
  no_show: "no-show",
};
// Stages change_stage can move someone to. Interview / Interviewed /
// Evaluation need a schedule, attendance or scorecards — done in the
// profile window (open_applicant), same as on the dashboard — and Withdrawn
// is the jobseeker's own move.
const CHAT_STAGES = ["applied", "screened", "shortlisted", "kiv", "evaluated", "offer", "hired", "rejected"] as const;
// The most a single confirmation card moves at once.
const STAGE_CHANGE_MAX = 50;
// schedule_interview's modes, cancel_interview's landing stages, and
// record_evaluation's recommendations — the same values the dashboard's
// profile window (ApplicantDetailModal) and the applications/evaluation
// API routes use.
const INTERVIEW_MODES = ["onsite", "online", "phone"] as const;
const CANCEL_TARGET_STAGES = ["shortlisted", "kiv", "rejected"] as const;
const RECOMMENDATIONS = ["strong_hire", "hire", "no_hire", "strong_no_hire"] as const;
// Statuses an interview can't meaningfully be scheduled or cancelled for.
const CLOSED_STATUSES = new Set(["withdrawn", "rejected", "hired"]);
// The most profiles shown in the chat at once — high enough to cover "show
// me everyone for this posting" in practice, while still guarding against a
// genuinely huge bulk open (hundreds of parallel profile fetches).
const OPEN_MAX = 30;
const LIST_LIMIT_DEFAULT = 20;
const LIST_LIMIT_MAX = 50;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const POSTING_PARAM = {
  type: "string",
  description: "Job posting title (or part of it, e.g. \"frontend\") or its id.",
};

/** find_applicants' filters — export_applicants takes the same ones, so a lookup and its export always match. */
function applicantFilterParameters(limitDescription: string): Record<string, unknown> {
  return {
    type: "object",
    properties: {
      posting: POSTING_PARAM,
      stages: {
        type: "array",
        items: { type: "string", enum: STAGES },
        description: "Only these stages. 'interview' = interview scheduled; 'kiv' = on hold.",
      },
      location: {
        type: "string",
        description: "A state (\"Selangor\", \"KL\", \"Penang\") or a town (\"Petaling Jaya\").",
      },
      name: { type: "string", description: "Part of the applicant's name." },
      min_fit_score: { type: "number", description: "Lowest fit score, 0-100." },
      meets_requirements: {
        type: "boolean",
        description: "true = only applicants who meet the posting's must-have requirements; false = only those who don't.",
      },
      verified_phone: {
        type: "boolean",
        description:
          "true = only applicants with a verified phone number (what the user means by \"verified user/applicant\"); false = only unverified ones.",
      },
      applied_within_days: {
        type: "integer",
        description: "Applied in the last N days, today included (1 = today, 7 = past week).",
      },
      applied_from: { type: "string", description: "Applied on or after this date, YYYY-MM-DD." },
      applied_to: { type: "string", description: "Applied on or before this date, YYYY-MM-DD." },
      sort: {
        type: "string",
        enum: ["fit_score", "newest", "oldest", "name"],
        description: "Default newest. Use fit_score for top/best matches.",
      },
      limit: { type: "integer", description: limitDescription },
    },
    additionalProperties: false,
  };
}

const DEFINITIONS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "find_applicants",
      description:
        "Search the employer's applicants and get each one's stage, location, fit score and interview, plus counts by stage and by location for everyone who matches. Use for any question about who applied, how many, where they're from, their status/stage, top matches, or recent applicants. All filters are optional and combine.",
      parameters: applicantFilterParameters(
        `How many to list (default ${LIST_LIMIT_DEFAULT}, max ${LIST_LIMIT_MAX}). Counts always cover everyone who matches.`,
      ),
    },
  },
  {
    type: "function",
    function: {
      name: "export_applicants",
      description:
        "Use when the user asks to export or download applicants to Excel, a spreadsheet or a file. Same filters as find_applicants, for exactly the list they want. A Download Excel button for that list then appears under your reply — the app makes the file, without email or phone numbers.",
      parameters: applicantFilterParameters("Only if they asked for a number, e.g. top 10. Leave out to export everyone who matches."),
    },
  },
  {
    type: "function",
    function: {
      name: "get_applicant",
      description:
        "One applicant's full details: contact (phone, email), skills, work experience, education, certifications, languages, expected salary, notice period, and for each of their applications the stage, fit score breakdown, screening answers, interview and evaluation (scores, recommendation, notes). Use for questions about a specific person, including their phone number, email, or what an interviewer wrote about them.",
      parameters: {
        type: "object",
        properties: {
          application_id: { type: "string", description: "From a find_applicants result — the most precise way." },
          name: { type: "string", description: "The applicant's name, or part of it." },
          posting: { ...POSTING_PARAM, description: "Narrow to their application for this posting." },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "open_applicant",
      description: `Shows applicants' profiles in the chat — one, or several at once (up to ${OPEN_MAX}) — each with its full profile, where the user can also schedule or reschedule an interview, mark attendance, fill in an evaluation, or move them through any stage by hand. Use when they want to see, view or open someone's profile (or several people's, e.g. "open all three"), or to do any of those things.`,
      parameters: {
        type: "object",
        properties: {
          application_ids: {
            type: "array",
            items: { type: "string" },
            description: `Several at once, from find_applicants results (up to ${OPEN_MAX}).`,
          },
          application_id: { type: "string", description: "One, from a find_applicants result — the most precise way." },
          name: { type: "string", description: "The applicant's name, or part of it." },
          posting: { ...POSTING_PARAM, description: "Narrow to their application for this posting." },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "change_stage",
      description:
        "Prepares moving one or more applicants to a new hiring stage — shortlist, reject, keep in view (KIV), back to screened, offer, hired. Shows the user a confirmation card listing who moves; NOTHING changes until they press Confirm, so never say it's done. Give application_ids (from find_applicants), or the same filters as find_applicants for a group. Interview scheduling, attendance and evaluation aren't moves here — use open_applicant for those.",
      parameters: (() => {
        const filters = applicantFilterParameters("Only if they asked for a number, e.g. the top 5.") as {
          properties: Record<string, unknown>;
        };
        return {
          type: "object",
          properties: {
            to_stage: {
              type: "string",
              enum: CHAT_STAGES,
              description: "'kiv' = keep in view (on hold). 'evaluated' only moves someone back out of KIV.",
            },
            application_ids: { type: "array", items: { type: "string" }, description: "Exactly who to move." },
            ...filters.properties,
          },
          required: ["to_stage"],
          additionalProperties: false,
        };
      })(),
    },
  },
  {
    type: "function",
    function: {
      name: "schedule_interview",
      description:
        "Prepares scheduling or rescheduling an interview for one applicant — mode, date/time, duration, location or meeting link, interviewer(s), notes. Shows the user a confirmation card; NOTHING is scheduled or sent to the candidate until they press Confirm, so never say it's booked. Give an application_id (from find_applicants), or a name (optionally with a posting).",
      parameters: {
        type: "object",
        properties: {
          application_id: { type: "string", description: "From a find_applicants result — the most precise way." },
          name: { type: "string", description: "The applicant's name, or part of it." },
          posting: { ...POSTING_PARAM, description: "Narrow to their application for this posting." },
          mode: { type: "string", enum: INTERVIEW_MODES, description: "How the interview happens." },
          scheduled_at: {
            type: "string",
            description: "Date and time, e.g. \"2026-11-05 14:30\" or an ISO datetime. Must be in the future.",
          },
          duration_minutes: { type: "integer", description: "Default 60." },
          location: { type: "string", description: "Required when mode is onsite." },
          meeting_link: { type: "string", description: "Required when mode is online." },
          interviewer_names: {
            type: "array",
            items: { type: "string" },
            description: "Who's interviewing, by name — must be active team members. Defaults to just the user asking.",
          },
          notes: { type: "string" },
        },
        required: ["mode", "scheduled_at"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cancel_interview",
      description:
        "Prepares cancelling an applicant's upcoming (not yet happened) interview. Shows the user a confirmation card; NOTHING is cancelled until they press Confirm. Give an application_id, or a name (optionally with a posting).",
      parameters: {
        type: "object",
        properties: {
          application_id: { type: "string", description: "From a find_applicants result — the most precise way." },
          name: { type: "string", description: "The applicant's name, or part of it." },
          posting: { ...POSTING_PARAM, description: "Narrow to their application for this posting." },
          to_stage: {
            type: "string",
            enum: CANCEL_TARGET_STAGES,
            description: "Where they go after cancelling. Default shortlisted.",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "record_evaluation",
      description:
        "Prepares the CALLER'S OWN interview scorecard for an applicant already in the Evaluation step: a 1-5 score per criterion, a recommendation, and optional notes. Shows a confirmation card; NOTHING is submitted until Confirm. Only works once attendance is marked and evaluation has started on their profile — if it isn't reachable yet, say so and point them to the applicant's profile.",
      parameters: {
        type: "object",
        properties: {
          application_id: { type: "string", description: "From a find_applicants result — the most precise way." },
          name: { type: "string", description: "The applicant's name, or part of it." },
          posting: { ...POSTING_PARAM, description: "Narrow to their application for this posting." },
          scores: {
            type: "object",
            description: "1-5 per criterion.",
            properties: Object.fromEntries(
              EVALUATION_CRITERIA.map((c) => [c, { type: "integer", minimum: 1, maximum: 5 }]),
            ),
            additionalProperties: false,
          },
          recommendation: { type: "string", enum: RECOMMENDATIONS },
          notes: { type: "string" },
        },
        required: ["scores", "recommendation"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_interviews",
      description:
        "Interviews by date, with each candidate's time, round, mode, location and whether they replied. With no dates given, lists upcoming interviews from today.",
      parameters: {
        type: "object",
        properties: {
          from: { type: "string", description: "From this date, YYYY-MM-DD (inclusive)." },
          to: { type: "string", description: "To this date, YYYY-MM-DD (inclusive)." },
          posting: POSTING_PARAM,
          reply: { type: "string", enum: RESPONSES, description: "'pending' = hasn't replied yet." },
          name: { type: "string", description: "Part of the candidate's name." },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_posting",
      description:
        "A job posting's details: status, expiry, openings left, salary, location, description, responsibilities, requirements, screening questions, and applicant counts by stage and location.",
      parameters: {
        type: "object",
        properties: { posting: POSTING_PARAM },
        required: ["posting"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "close_posting",
      description:
        "Prepares closing a job posting so it stops accepting new applications. Shows a confirmation card; NOTHING changes until the user presses Confirm, so never say it's closed. Only an Owner or Admin can close a posting.",
      parameters: {
        type: "object",
        properties: { posting: POSTING_PARAM },
        required: ["posting"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "draft_job_posting",
      description:
        "Prepares a new job posting as a draft from a short description (e.g. \"a sales executive role\", \"frontend engineer, remote, RM6000-8000\") — AI fills in the description, responsibilities, skills, salary and other details. Shows a confirmation card; NOTHING is created until the user presses Confirm, so never say it's posted. The draft still needs the user's review and a manual \"submit for review\" on the posting page before it goes live — say so. Only an Owner or Admin can post jobs.",
      parameters: {
        type: "object",
        properties: {
          job_title: { type: "string", description: "The role's title, as plainly as possible, e.g. \"Sales Executive\"." },
          location: { type: "string", description: "Where the role is based, if the user said." },
          salary_min: { type: "number", description: "Minimum monthly salary in RM, if the user said." },
          salary_max: { type: "number", description: "Maximum monthly salary in RM, if the user said." },
          employment_type: {
            type: "string",
            enum: ["full_time", "part_time", "contract", "internship", "freelance", "temporary"],
            description: "If the user said.",
          },
          work_arrangement: { type: "string", enum: ["remote", "hybrid", "onsite"], description: "If the user said." },
        },
        required: ["job_title"],
        additionalProperties: false,
      },
    },
  },
];

const norm = (value: string) => value.toLowerCase().replace(/["'“”‘’]/g, "").replace(/\s+/g, " ").trim();
const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);
const number = (value: unknown) => {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
};
const date = (value: unknown) => {
  const v = text(value);
  return v && DATE_PATTERN.test(v) ? v : null;
};
const stageLabel = (status: string) => APPLICATION_STATUS_LABEL[status] ?? status;

/** Drops null/undefined/empty-array fields so results stay short. */
function compact<T extends Record<string, unknown>>(record: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(record).filter(([, v]) => v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0)),
  ) as Partial<T>;
}

/**
 * The applicant's sign-in email — not on the profile row, only on `users`
 * (joined via the profile's userId). Only get_applicant uses this: a direct,
 * on-screen lookup of one named person, the same thing their dashboard
 * profile page already shows the employer. Never pulled for a list or the
 * Excel export — those deliberately leave contact info out (PDPA).
 */
async function applicantEmail(profileId: string): Promise<string | null> {
  const [row] = await db
    .select({ email: users.email })
    .from(jobseekerProfiles)
    .innerJoin(users, eq(jobseekerProfiles.userId, users.id))
    .where(eq(jobseekerProfiles.id, profileId))
    .limit(1);
  return row?.email ?? null;
}

function interviewSummary(a: EmployerApplication): string | null {
  const i = a.application.interviewDetails;
  if (!i?.scheduledAt) return null;
  const reply = RESPONSE_LABEL[a.application.interviewResponseStatus ?? "pending"];
  return `${fmtDateTime(i.scheduledAt)}, round ${i.round}, ${i.mode}, ${reply}`;
}

export function employerAssistantTools(input: {
  profile: EmployerProfile;
  scope: HiringScope;
  postings: JobPosting[];
  applications: EmployerApplication[];
  // Who's asking (schedule_interview defaults the panel to them; record_evaluation
  // is always their own scorecard) and the company's active team, to resolve
  // interviewer names the same way the dashboard's InterviewerPicker does.
  // Left out where only the read-only lookups run (the Excel export) — the
  // scheduling tools simply aren't offered to the model there.
  currentUserId?: string;
  role?: "owner" | "admin" | "hiring_manager" | "panel";
  teamMembers?: EmployerTeamMember[];
}): AssistantTools {
  const { profile, scope, postings, applications, currentUserId = "", role = "admin", teamMembers = [] } = input;
  const activeMembers = teamMembers.filter((m) => m.status === "active" && m.userId);
  const memberName = (m: EmployerTeamMember) => m.name || m.email;

  // Fit scores are only worked out if a lookup needs them, once per request.
  let fitPromise: Promise<Map<string, MatchResult>> | null = null;
  const fitScores = () =>
    (fitPromise ??= computeMatchResults(profile, scope).then((results) => new Map(results.map((m) => [m.applicationId, m]))));

  function findPostings(query: string): JobPosting[] {
    const q = norm(query);
    const byId = postings.filter((p) => p.id === query.trim() || p.slug === q);
    if (byId.length) return byId;
    const exact = postings.filter((p) => norm(p.title) === q);
    if (exact.length) return exact;
    const contains = postings.filter((p) => norm(p.title).includes(q) || q.includes(norm(p.title)));
    if (contains.length) return contains;
    const words = q.split(" ").filter((w) => w.length > 1);
    return words.length ? postings.filter((p) => words.every((w) => norm(p.title).includes(w))) : [];
  }

  // Two postings can share a title (an old closed one and a new one) — say which.
  const postingLabel = (p: JobPosting) =>
    postings.filter((o) => o.title === p.title).length > 1 ? `${p.title} (${p.status}, posted ${fmtDate(p.createdAt)})` : p.title;

  const noPosting = (query: string) => ({
    error: `No posting the user can see matches "${query}".`,
    postings: postings.map((p) => `${p.title} (${p.status})`),
  });

  /**
   * The posting ids an applicant search should cover. A Panel member sees
   * candidates but no postings, so this falls back to the titles on the
   * applications they can see — "Frontend Engineer applicants" still works.
   */
  function postingIdsFor(query: string): { ids: Set<string>; labels: string[] } | null {
    const found = findPostings(query);
    if (found.length) return { ids: new Set(found.map((p) => p.id)), labels: found.map(postingLabel) };
    const q = norm(query);
    const fromApplications = applications.filter((a) => norm(a.jobPostingTitle).includes(q) || q.includes(norm(a.jobPostingTitle)));
    if (!fromApplications.length) return null;
    return {
      ids: new Set(fromApplications.map((a) => a.jobPostingId)),
      labels: [...new Set(fromApplications.map((a) => a.jobPostingTitle))],
    };
  }

  function locationMatches(location: string | null, query: string) {
    if (!location) return false;
    const state = malaysiaStateNamed(query);
    return state ? malaysiaStateOf(location) === state : norm(location).includes(norm(query));
  }

  // Set by export_applicants / open_applicant / change_stage: the route turns
  // them into the reply's button, profile window or confirmation card — so
  // what they act on always comes from a real lookup, never from the reply.
  let exportFilters: Record<string, unknown> | null = null;
  const openPicks: { applicationId: string; name: string; posting: string }[] = [];
  // Every result handed back to the model this request — what a reply's
  // names are checked against.
  const lookups: string[] = [];
  let stageChange: ReturnType<AssistantTools["stageChangeRequest"]> = null;
  let scheduleInterviewPending: ReturnType<AssistantTools["scheduleInterviewRequest"]> = null;
  let cancelInterviewPending: ReturnType<AssistantTools["cancelInterviewRequest"]> = null;
  let recordEvaluationPending: ReturnType<AssistantTools["recordEvaluationRequest"]> = null;
  let closePostingPending: ReturnType<AssistantTools["closePostingRequest"]> = null;
  let draftJobPostingPending: ReturnType<AssistantTools["draftJobPostingRequest"]> = null;

  /** One application by id, or by name (optionally within a posting) — several people is a question back. */
  function pickApplications(args: Record<string, unknown>): EmployerApplication[] | { error: string } {
    const id = text(args.application_id);
    const name = text(args.name);
    if (!id && !name) return { error: "Give an application_id or a name." };
    let found = id
      ? applications.filter((a) => a.application.id === id)
      : applications.filter((a) => norm(a.applicantName).includes(norm(name!)));
    if (!found.length && name) {
      const words = norm(name).split(" ").filter((w) => w.length > 1);
      found = applications.filter((a) => words.every((w) => norm(a.applicantName).includes(w)));
    }
    const postingQuery = text(args.posting);
    if (postingQuery && found.length) {
      const ids = postingIdsFor(postingQuery)?.ids ?? new Set<string>();
      found = found.filter((a) => ids.has(a.jobPostingId));
    }
    if (!found.length) return { error: `No applicant found for ${id ? `application ${id}` : `"${name}"`}.` };
    return found;
  }

  function openApplicant(args: Record<string, unknown>) {
    const ids = Array.isArray(args.application_ids)
      ? [...new Set(args.application_ids.filter((i): i is string => typeof i === "string"))]
      : [];
    if (ids.length) {
      const picked = ids.map((id) => applications.find((a) => a.application.id === id)).filter((a): a is EmployerApplication => !!a);
      if (!picked.length) return { error: "None of those application ids were found." };
      if (picked.length > OPEN_MAX) return { error: `That's ${picked.length} — open ${OPEN_MAX} or fewer at a time.` };
      // Adds to anything already opened this message.
      const already = new Set(openPicks.map((p) => p.applicationId));
      for (const a of picked) {
        if (!already.has(a.application.id)) {
          openPicks.push({ applicationId: a.application.id, name: a.applicantName, posting: a.jobPostingTitle });
        }
      }
      return {
        opened: picked.map((a) => ({ name: a.applicantName, posting: a.jobPostingTitle, stage: stageLabel(a.application.status) })),
        missing_ids: ids.length - picked.length || undefined,
        note: "Their profiles show in the chat now. Say so in one short sentence; don't repeat their details.",
      };
    }

    const found = pickApplications(args);
    if ("error" in found) return found;
    if (found.length > 1) {
      return {
        several_match: found.slice(0, 15).map((a) => ({
          application_id: a.application.id,
          name: a.applicantName,
          posting: a.jobPostingTitle,
          stage: stageLabel(a.application.status),
        })),
        note: "Ask the user which one they mean, or call again with an application_id.",
      };
    }
    const [a] = found;
    if (!openPicks.some((p) => p.applicationId === a.application.id)) {
      openPicks.push({ applicationId: a.application.id, name: a.applicantName, posting: a.jobPostingTitle });
    }
    return {
      opened: { name: a.applicantName, posting: a.jobPostingTitle, stage: stageLabel(a.application.status) },
      note: "Their profile shows in the chat now. Say so in one short sentence; don't repeat their details.",
    };
  }

  /** pickApplications, narrowed to exactly one — the shape every single-applicant tool needs. */
  function pickOneApplication(args: Record<string, unknown>): EmployerApplication | Record<string, unknown> {
    const found = pickApplications(args);
    if ("error" in found) return found;
    if (found.length > 1) {
      return {
        several_match: found.slice(0, 15).map((a) => ({
          application_id: a.application.id,
          name: a.applicantName,
          posting: a.jobPostingTitle,
          stage: stageLabel(a.application.status),
        })),
        note: "Ask the user which one they mean, or call again with an application_id.",
      };
    }
    return found[0];
  }
  const isApplication = (v: EmployerApplication | Record<string, unknown>): v is EmployerApplication => "application" in v;

  // Interviewer names (free text from the model) resolved against the
  // company's active team members, the same list InterviewerPicker offers on
  // the dashboard — never free text saved as-is.
  function resolveInterviewers(namesInput: unknown): { ids: string[]; names: string[] } | { error: string } {
    const names = Array.isArray(namesInput) ? namesInput.filter((n): n is string => typeof n === "string" && n.trim().length > 0) : [];
    if (!names.length) return { ids: currentUserId ? [currentUserId] : [], names: currentUserId ? [memberNameById(currentUserId)] : [] };
    const ids: string[] = [];
    const resolvedNames: string[] = [];
    const unmatched: string[] = [];
    for (const raw of names) {
      const q = norm(raw);
      const hit =
        activeMembers.find((m) => norm(memberName(m)) === q) ??
        activeMembers.find((m) => norm(memberName(m)).includes(q) || q.includes(norm(memberName(m))));
      if (!hit || !hit.userId) unmatched.push(raw);
      else if (!ids.includes(hit.userId)) {
        ids.push(hit.userId);
        resolvedNames.push(memberName(hit));
      }
    }
    if (unmatched.length) {
      return {
        error: `No active team member matches ${unmatched.map((n) => `"${n}"`).join(", ")}. Active teammates: ${activeMembers.map(memberName).join(", ") || "none"}.`,
      };
    }
    return { ids, names: resolvedNames };
  }
  function memberNameById(userId: string): string {
    const member = activeMembers.find((m) => m.userId === userId);
    return member ? memberName(member) : "You";
  }

  function scheduleInterview(args: Record<string, unknown>) {
    const picked = pickOneApplication(args);
    if (!isApplication(picked)) return picked;
    const a = picked;
    if (!a.canManage) {
      return { error: "You can see this applicant but not schedule for them — only the job's hiring manager or an admin can." };
    }
    if (CLOSED_STATUSES.has(a.application.status)) {
      return { error: `Can't schedule an interview — ${a.applicantName} is ${stageLabel(a.application.status).toLowerCase()}.` };
    }
    const mode = text(args.mode);
    if (!mode || !(INTERVIEW_MODES as readonly string[]).includes(mode)) {
      return { error: "Say how the interview happens.", modes: INTERVIEW_MODES };
    }
    const whenText = text(args.scheduled_at);
    const scheduledAt = whenText ? new Date(whenText) : null;
    if (!whenText || !scheduledAt || Number.isNaN(scheduledAt.getTime())) {
      return { error: "Give a real date and time for the interview." };
    }
    if (scheduledAt.getTime() < Date.now() - 60 * 60 * 1000) {
      return { error: "That time is in the past — give a future date and time." };
    }
    const location = text(args.location);
    const meetingLink = text(args.meeting_link);
    if (mode === "onsite" && !location) return { error: "Add the interview location." };
    if (mode === "online" && !meetingLink) return { error: "Add the meeting link." };
    const panel = resolveInterviewers(args.interviewer_names);
    if ("error" in panel) return panel;
    const duration = number(args.duration_minutes);

    const existing = a.application.interviewDetails;
    const isReschedule = a.application.status === "interview" && !!existing;
    const round = existing ? (isReschedule ? existing.round : existing.round + 1) : 1;

    scheduleInterviewPending = {
      applicationId: a.application.id,
      name: a.applicantName,
      posting: a.jobPostingTitle,
      round,
      mode: mode as (typeof INTERVIEW_MODES)[number],
      scheduledAt: scheduledAt.toISOString(),
      durationMinutes: duration && duration > 0 ? Math.round(duration) : 60,
      location: mode === "onsite" ? location : location || null,
      meetingLink: mode === "online" ? meetingLink : meetingLink || null,
      interviewerUserIds: panel.ids,
      interviewerNames: panel.names,
      notes: text(args.notes),
      isReschedule,
    };
    return compact({
      [isReschedule ? "ready_to_reschedule" : "ready_to_schedule"]: true,
      name: a.applicantName,
      posting: a.jobPostingTitle,
      round,
      when: fmtDateTime(scheduledAt.toISOString()),
      mode,
      interviewers: panel.names,
      note: `A confirmation card appears under your reply. Nothing is scheduled or sent to the candidate until the user presses Confirm — say so, don't say it's booked.`,
    });
  }

  function cancelInterview(args: Record<string, unknown>) {
    const picked = pickOneApplication(args);
    if (!isApplication(picked)) return picked;
    const a = picked;
    if (!a.canManage) {
      return { error: "You can see this applicant but not cancel for them — only the job's hiring manager or an admin can." };
    }
    const details = a.application.interviewDetails;
    if (a.application.status !== "interview" || !details) {
      return { error: `${a.applicantName} doesn't have an upcoming interview to cancel.` };
    }
    const toStage = text(args.to_stage) ?? "shortlisted";
    if (!(CANCEL_TARGET_STAGES as readonly string[]).includes(toStage)) {
      return { error: "Pick where they go after cancelling.", stages: CANCEL_TARGET_STAGES };
    }
    cancelInterviewPending = {
      applicationId: a.application.id,
      name: a.applicantName,
      posting: a.jobPostingTitle,
      scheduledAt: details.scheduledAt,
      toStatus: toStage,
      toLabel: stageLabel(toStage),
    };
    return compact({
      ready_to_cancel: true,
      name: a.applicantName,
      posting: a.jobPostingTitle,
      when: fmtDateTime(details.scheduledAt),
      moves_to: stageLabel(toStage),
      note: "A confirmation card appears under your reply. Nothing is cancelled until the user presses Confirm — say so, don't say it's cancelled.",
    });
  }

  function recordEvaluation(args: Record<string, unknown>) {
    const picked = pickOneApplication(args);
    if (!isApplication(picked)) return picked;
    const a = picked;
    const details = a.application.interviewDetails;
    if (!details) return { error: "Schedule an interview before evaluating this candidate." };
    const panel = details.interviewerUserIds ?? [];
    const onPanel = panel.includes(currentUserId);
    if (panel.length > 0 && !onPanel && role !== "owner") {
      return { error: "Only interviewers on this panel (or an Owner) can evaluate this candidate." };
    }
    if (a.application.status !== "evaluation" && a.application.status !== "evaluated") {
      return {
        error: `${a.applicantName} isn't in the Evaluation step yet — mark attendance and start the evaluation from their profile first (open their profile to do it), then come back.`,
      };
    }
    const rawScores = args.scores && typeof args.scores === "object" ? (args.scores as Record<string, unknown>) : null;
    if (!rawScores) return { error: "Give a 1-5 score per criterion.", criteria: EVALUATION_CRITERIA };
    const scores: Partial<Record<EvaluationCriterion, number>> = {};
    for (const [key, raw] of Object.entries(rawScores)) {
      if (!(EVALUATION_CRITERIA as readonly string[]).includes(key)) {
        return { error: `"${key}" isn't a scoring criterion.`, criteria: EVALUATION_CRITERIA };
      }
      const n = number(raw);
      if (n === null || !Number.isInteger(n) || n < 1 || n > 5) return { error: `${key} needs a whole number 1-5.` };
      scores[key as EvaluationCriterion] = n;
    }
    if (Object.keys(scores).length === 0) return { error: "Give a 1-5 score per criterion.", criteria: EVALUATION_CRITERIA };
    const recommendation = text(args.recommendation);
    if (!recommendation || !(RECOMMENDATIONS as readonly string[]).includes(recommendation)) {
      return { error: "Pick a recommendation.", recommendations: RECOMMENDATIONS };
    }
    recordEvaluationPending = {
      applicationId: a.application.id,
      name: a.applicantName,
      posting: a.jobPostingTitle,
      round: details.round,
      scores,
      recommendation: recommendation as InterviewRecommendation,
      notes: text(args.notes),
    };
    return compact({
      ready_to_submit: true,
      name: a.applicantName,
      posting: a.jobPostingTitle,
      round: details.round,
      scores,
      recommendation,
      note: "A confirmation card appears under your reply. Nothing is submitted until the user presses Confirm — say so, don't say the scorecard is submitted.",
    });
  }

  async function changeStage(args: Record<string, unknown>) {
    const to = text(args.to_stage);
    if (!to || !(CHAT_STAGES as readonly string[]).includes(to)) {
      return { error: "Pick a stage this can move people to.", stages: CHAT_STAGES };
    }
    const toLabel = stageLabel(to);

    let targets: EmployerApplication[];
    const ids = Array.isArray(args.application_ids)
      ? args.application_ids.filter((i): i is string => typeof i === "string")
      : [];
    const unknownIds: string[] = [];
    if (ids.length) {
      targets = [];
      for (const id of new Set(ids)) {
        const a = applications.find((row) => row.application.id === id);
        if (a) targets.push(a);
        else unknownIds.push(id);
      }
    } else {
      // A group by filters — but never "everyone" by accident.
      const filters = Object.fromEntries(
        Object.entries(args).filter(([key]) => key !== "to_stage" && key !== "application_ids"),
      );
      if (!Object.values(filters).some((v) => v !== undefined && v !== null && v !== "")) {
        return { error: "Say who to move: application_ids from find_applicants, or filters for a group." };
      }
      const search = await searchApplicants(filters);
      if (!search.ok) return search.error;
      const limit = number(args.limit);
      targets = limit && limit > 0 ? search.list.slice(0, Math.floor(limit)) : search.list;
    }
    // A second change_stage call this turn to the same stage adds to the
    // same card (the model sometimes works through a group in batches).
    const adding = stageChange?.to === to ? stageChange : null;
    const already = new Set(adding?.items.map((i) => i.applicationId) ?? []);
    targets = targets.filter((a) => !already.has(a.application.id));
    if (targets.length + already.size > STAGE_CHANGE_MAX) {
      // Never a card holding only part of what was asked for.
      stageChange = null;
      return {
        error: `That's ${targets.length + already.size} applicants — more than ${STAGE_CHANGE_MAX} at once, so no confirmation card is shown. Ask the user to narrow it down (a posting, a stage, a location…).`,
      };
    }

    // Each move checked against the same rules as the dashboard's profile window.
    const items: StageChangeItem[] = [];
    const skipped: { name: string; reason: string }[] = [];
    for (const a of targets) {
      const status = a.application.status;
      const skip = (reason: string) => skipped.push({ name: a.applicantName, reason });
      if (!a.canManage) skip("you can see this applicant but not move them — only the job's hiring manager or an admin can");
      else if (status === to) skip(`already ${toLabel}`);
      else if (status === "withdrawn") skip("they withdrew their application");
      else if (to === "evaluated" && status !== "kiv") skip("Evaluated only follows the panel's scorecards, or moves back out of KIV");
      else
        items.push({
          applicationId: a.application.id,
          name: a.applicantName,
          posting: a.jobPostingTitle,
          fromLabel: stageLabel(status),
          fromStatus: status,
        });
    }

    if (items.length === 0 && !adding) {
      return compact({
        nothing_to_move: true,
        skipped,
        unknown_application_ids: unknownIds,
        note: "Nothing can be moved, so no confirmation card is shown. Tell the user why.",
      });
    }
    if (adding) {
      items.unshift(...adding.items);
      skipped.unshift(...adding.skipped);
    }
    stageChange = { to, toLabel, items, skipped };
    return compact({
      ready_to_move: items.length,
      to: toLabel,
      people: items.map((i) => `${i.name} (${i.posting}, now ${i.fromLabel})`).slice(0, 10),
      skipped,
      unknown_application_ids: unknownIds,
      note: "A confirmation card with Confirm / Cancel appears under your reply. Nothing has changed yet — say who will move and ask them to confirm; mention anyone skipped and why.",
    });
  }

  /** find_applicants' filtering and sorting — shared with the Excel export (applicant-export.ts). */
  async function searchApplicants(args: Record<string, unknown>): Promise<ApplicantSearch> {
    let list = applications;
    let matchedPostings: string[] | undefined;
    const postingQuery = text(args.posting);
    if (postingQuery) {
      const match = postingIdsFor(postingQuery);
      if (!match) return { ok: false, error: noPosting(postingQuery) };
      list = list.filter((a) => match.ids.has(a.jobPostingId));
      matchedPostings = match.labels;
    }

    const stageArgs = Array.isArray(args.stages) ? args.stages : typeof args.stages === "string" ? [args.stages] : [];
    const stages = stageArgs.filter((s): s is (typeof STAGES)[number] => STAGES.includes(s as (typeof STAGES)[number]));
    if (stageArgs.length && !stages.length) return { ok: false, error: { error: "Unknown stage.", stages: STAGES } };
    if (stages.length) list = list.filter((a) => stages.includes(a.application.status));

    const location = text(args.location);
    if (location) list = list.filter((a) => locationMatches(a.applicantLocation, location));
    const name = text(args.name);
    if (name) list = list.filter((a) => norm(a.applicantName).includes(norm(name)));

    const today = dayKey(new Date());
    const withinDays = number(args.applied_within_days);
    if (withinDays !== null) list = list.filter((a) => daysBetween(dayKey(new Date(a.application.appliedAt)), today) < withinDays);
    const from = date(args.applied_from);
    const to = date(args.applied_to);
    if (from) list = list.filter((a) => dayKey(new Date(a.application.appliedAt)) >= from);
    if (to) list = list.filter((a) => dayKey(new Date(a.application.appliedAt)) <= to);

    const fit = await fitScores();
    const minScore = number(args.min_fit_score);
    if (minScore !== null) list = list.filter((a) => (fit.get(a.application.id)?.score ?? -1) >= minScore);
    if (typeof args.meets_requirements === "boolean") {
      const wanted = args.meets_requirements;
      list = list.filter((a) => fit.get(a.application.id)?.eligible === wanted);
    }
    if (typeof args.verified_phone === "boolean") {
      const wanted = args.verified_phone;
      list = list.filter((a) => a.applicantPhoneVerified === wanted);
    }

    const sort = text(args.sort) ?? "newest";
    const sorted = [...list].sort((x, y) => {
      if (sort === "fit_score") return (fit.get(y.application.id)?.score ?? -1) - (fit.get(x.application.id)?.score ?? -1);
      if (sort === "name") return x.applicantName.localeCompare(y.applicantName);
      const diff = new Date(y.application.appliedAt).getTime() - new Date(x.application.appliedAt).getTime();
      return sort === "oldest" ? -diff : diff;
    });
    return { ok: true, list: sorted, matchedPostings, fit };
  }

  async function findApplicants(args: Record<string, unknown>) {
    const search = await searchApplicants(args);
    if (!search.ok) return search.error;
    const { list, matchedPostings, fit } = search;
    const limit = Math.min(Math.max(Math.round(number(args.limit) ?? LIST_LIMIT_DEFAULT), 1), LIST_LIMIT_MAX);
    const shown = list.slice(0, limit);

    return compact({
      matched_postings: matchedPostings,
      total: list.length,
      by_stage: list.length ? countBy(list, (a) => stageLabel(a.application.status)) : null,
      by_location: list.length ? locationBreakdown(list.map((a) => a.applicantLocation)) : null,
      note:
        list.length === 0
          ? "No applicants match these filters — that's the answer, don't search again."
          : list.length > shown.length
            ? `Listing ${shown.length} of ${list.length}; the counts above cover all ${list.length}. To act on all of them (change_stage, export_applicants), pass these same filters — no need to list them all first.`
            : null,
      applicants: shown.map((a) => {
        const m = fit.get(a.application.id);
        return compact({
          application_id: a.application.id,
          name: a.applicantName,
          posting: a.jobPostingTitle,
          stage: stageLabel(a.application.status),
          applied: fmtDate(a.application.appliedAt),
          location: a.applicantLocation,
          years_experience: a.applicantYearsExperience,
          fit_score: m?.score ?? null,
          meets_requirements: m ? m.eligible : null,
          verified: a.applicantPhoneVerified || null,
          interview: interviewSummary(a),
        });
      }),
    });
  }

  async function exportApplicants(args: Record<string, unknown>) {
    const search = await searchApplicants(args);
    if (!search.ok) return search.error;
    const limit = number(args.limit);
    const count = limit && limit > 0 ? Math.min(Math.floor(limit), search.list.length) : search.list.length;
    if (count === 0) return { error: "No applicants match, so there's nothing to export." };
    exportFilters = args;
    return compact({
      matched_postings: search.matchedPostings,
      applicants_in_file: count,
      note: "A Download Excel button for this list appears under your reply. Say how many applicants it has and that it leaves out email and phone numbers.",
    });
  }

  async function getApplicant(args: Record<string, unknown>) {
    const found = pickApplications(args);
    if ("error" in found) return found;

    const people = new Set(found.map((a) => a.application.jobseekerProfileId));
    if (people.size > 1) {
      return {
        several_people_match: found.slice(0, 15).map((a) => ({
          application_id: a.application.id,
          name: a.applicantName,
          posting: a.jobPostingTitle,
          stage: stageLabel(a.application.status),
        })),
        note: "Ask the user which person they mean, or call again with an application_id.",
      };
    }

    // Safe to load: this person has an application the user can already see.
    const [person, email, fit] = await Promise.all([
      getJobseekerProfileById(found[0].application.jobseekerProfileId),
      applicantEmail(found[0].application.jobseekerProfileId),
      fitScores(),
    ]);
    if (!person) return { error: "That applicant's profile is no longer available." };

    return compact({
      name: person.fullName,
      phone: person.phone,
      email,
      location: person.location,
      target_role: person.targetRole,
      years_experience: person.yearsExperience,
      skills: person.professionalSkills,
      soft_skills: person.softSkills,
      other_skills: person.otherSkills,
      preferred_industry: person.preferredIndustry,
      expected_salary_rm:
        person.expectedSalaryMin || person.expectedSalaryMax
          ? `${person.expectedSalaryMin ?? "?"}–${person.expectedSalaryMax ?? "?"} a month`
          : null,
      notice_period: person.noticePeriod,
      work_arrangement: person.workArrangement,
      employment_type: person.employmentType,
      work_authorization: person.workAuthorization,
      driving_license: person.drivingLicense,
      about: person.bio ? person.bio.slice(0, 500) : null,
      has_resume: Boolean(person.resumeFileName),
      languages: person.languages.map((l) => compact({ language: l.language, spoken: l.spokenLevel, written: l.writtenLevel })),
      experience: person.workExperiences.map((w) =>
        compact({
          title: w.title,
          company: w.company,
          period: `${w.startDate} – ${w.isCurrent ? "present" : (w.endDate ?? "?")}`,
          achievements: w.achievements ? w.achievements.slice(0, 300) : null,
        }),
      ),
      education: person.education.map((e) =>
        compact({
          qualification: e.qualificationTier,
          field: e.fieldOfStudy,
          institution: e.institution,
          graduated: e.graduationYear,
          cgpa: e.cgpa,
        }),
      ),
      certifications: person.certifications.map((c) => compact({ name: c.name, issuer: c.issuer, year: c.year })),
      applications: found.map((a) => applicationDetail(a, fit.get(a.application.id))),
    });
  }

  function applicationDetail(a: EmployerApplication, m: MatchResult | undefined) {
    const posting = postings.find((p) => p.id === a.jobPostingId);
    const answers = a.application.screeningAnswers;
    const check =
      posting?.screeningEnabled && answers
        ? screeningEligibilityCheck(
            {
              preferred: posting.screeningPreferred,
              minYearsExperience: posting.minYearsExperience,
              minQualificationTier: posting.minQualificationTier,
              drivingLicense: posting.drivingLicense,
              languages: posting.askLanguages ? posting.languages : [],
              workAuthorizations: posting.workAuthorizations,
              customQuestions: posting.customScreeningQuestions,
            },
            answers,
          )
        : null;
    // Short answers are shown to the employer but never pass/fail anyone.
    const shortAnswers = (answers?.customAnswers ?? [])
      .filter((ans) => text(ans.text))
      .map((ans) => ({
        question: posting?.customScreeningQuestions.find((q) => q.id === ans.questionId)?.question ?? "Question",
        answer: ans.text!.slice(0, 300),
      }));
    const evaluation = a.evaluation;

    return compact({
      application_id: a.application.id,
      posting: a.jobPostingTitle,
      stage: stageLabel(a.application.status),
      applied: fmtDate(a.application.appliedAt),
      fit_score: m?.score ?? null,
      meets_requirements: m ? m.eligible : null,
      verified: a.applicantPhoneVerified || null,
      not_met: m?.ineligibleReasons,
      fit_breakdown: m
        ? Object.fromEntries(Object.entries(m.breakdown).filter(([, v]) => v !== null))
        : null,
      screening: check
        ? check.items.map((item) => `${item.met ? "met" : "not met"}: ${item.label}${item.preferred ? " (preferred)" : ""}`)
        : null,
      screening_short_answers: shortAnswers,
      interview: interviewSummary(a),
      evaluation: evaluation
        ? compact({ recommendation: evaluation.recommendation, scores: evaluation.scores, notes: evaluation.notes })
        : null,
      rejection_reason: a.application.rejectionReasonCode,
      has_video_pitch: a.videoPitch ? true : null,
    });
  }

  function listInterviews(args: Record<string, unknown>) {
    const today = dayKey(new Date());
    const from = date(args.from) ?? (date(args.to) ? null : today);
    const to = date(args.to);
    let list = applications.filter((a) => a.application.interviewDetails?.scheduledAt);

    const postingQuery = text(args.posting);
    if (postingQuery) {
      const match = postingIdsFor(postingQuery);
      if (!match) return noPosting(postingQuery);
      list = list.filter((a) => match.ids.has(a.jobPostingId));
    }
    const reply = text(args.reply);
    if (reply) list = list.filter((a) => (a.application.interviewResponseStatus ?? "pending") === reply);
    const name = text(args.name);
    if (name) list = list.filter((a) => norm(a.applicantName).includes(norm(name)));

    const day = (a: EmployerApplication) => dayKey(new Date(a.application.interviewDetails!.scheduledAt));
    if (from) list = list.filter((a) => day(a) >= from);
    if (to) list = list.filter((a) => day(a) <= to);
    list = [...list].sort(
      (x, y) =>
        new Date(x.application.interviewDetails!.scheduledAt).getTime() -
        new Date(y.application.interviewDetails!.scheduledAt).getTime(),
    );

    return compact({
      range: `${from ?? "any date"} to ${to ?? "any date"}`,
      total: list.length,
      by_reply: list.length ? countBy(list, (a) => RESPONSE_LABEL[a.application.interviewResponseStatus ?? "pending"]) : null,
      interviews: list.slice(0, LIST_LIMIT_MAX).map((a) => {
        const i = a.application.interviewDetails!;
        return compact({
          application_id: a.application.id,
          name: a.applicantName,
          posting: a.jobPostingTitle,
          when: fmtDateTime(i.scheduledAt),
          round: i.round,
          mode: i.mode,
          duration_minutes: i.durationMinutes,
          location: i.mode === "onsite" ? i.location : null,
          reply: RESPONSE_LABEL[a.application.interviewResponseStatus ?? "pending"],
          confirmed_attendance: a.application.jobseekerConfirmedAttendance || null,
          stage: stageLabel(a.application.status),
        });
      }),
    });
  }

  function getPosting(args: Record<string, unknown>) {
    const query = text(args.posting);
    if (!query) return { error: "Say which posting." };
    const found = findPostings(query);
    if (found.length === 0) return noPosting(query);
    return {
      postings: found.slice(0, 3).map((p) => {
        const apps = applications.filter((a) => a.jobPostingId === p.id);
        const salary =
          p.salaryMin || p.salaryMax ? `RM ${p.salaryMin ?? "?"}–${p.salaryMax ?? "?"} per ${p.salaryPeriod}` : null;
        return compact({
          id: p.id,
          title: postingLabel(p),
          status: p.status,
          page: `/employer/jobs/${p.slug}`,
          posted: fmtDate(p.createdAt),
          expires: p.expiryDate ? fmtDate(p.expiryDate) : null,
          accepts_new_applications: p.acceptsNewApplications,
          openings_total: p.openingsTotal,
          openings_left: Math.max(p.openingsTotal - p.hiresConfirmed - p.offersOutstanding, 0),
          hires_confirmed: p.hiresConfirmed,
          offers_outstanding: p.offersOutstanding,
          location: postingLocationLabel(p.area ?? "", p.city ?? "", p.state ?? "") || p.location,
          employment_type: p.employmentType,
          work_arrangement: p.workArrangement,
          description: p.description ? p.description.slice(0, 800) : null,
          responsibilities: p.responsibilities ? p.responsibilities.slice(0, 800) : null,
          salary,
          salary_shown_to_applicants: p.showSalary,
          required_skills: p.skills,
          nice_to_have_skills: p.niceToHaveSkills,
          min_years_experience: p.minYearsExperience,
          min_qualification: p.minQualificationTier,
          screening_questions: p.screeningEnabled ? p.customScreeningQuestions.map((q) => q.question) : null,
          rejection_reason: p.rejectionReason,
          flag_reason: p.flagReason,
          applicants_total: apps.length,
          applicants_by_stage: apps.length ? countBy(apps, (a) => stageLabel(a.application.status)) : null,
          applicants_by_location: apps.length ? locationBreakdown(apps.map((a) => a.applicantLocation)) : null,
        });
      }),
      note: found.length > 3 ? `${found.length} postings match; showing 3.` : undefined,
    };
  }

  function closePosting(args: Record<string, unknown>) {
    if (!canManagePostings(role)) {
      return { error: "Only an owner or admin can close a posting — this user can see it but not manage it." };
    }
    const query = text(args.posting);
    if (!query) return { error: "Say which posting." };
    const found = findPostings(query).filter((p) => p.status !== "closed");
    if (found.length === 0) {
      return findPostings(query).length ? { error: "That posting is already closed." } : noPosting(query);
    }
    if (found.length > 1) {
      return {
        several_match: found.slice(0, 10).map((p) => ({ id: p.id, title: postingLabel(p), status: p.status })),
        note: "Ask the user which one they mean.",
      };
    }
    const [p] = found;
    closePostingPending = { postingId: p.id, title: p.title };
    return compact({
      ready_to_close: true,
      title: p.title,
      note: "A confirmation card appears under your reply. Nothing is closed until the user presses Confirm — say so, don't say it's closed.",
    });
  }

  async function draftJobPosting(args: Record<string, unknown>) {
    if (!canManagePostings(role)) {
      return { error: "Only an owner or admin can post a job — this user can see postings but not create one." };
    }
    const jobTitle = text(args.job_title);
    if (!jobTitle) return { error: "Say what role to post." };
    let suggestion;
    try {
      ({ result: suggestion } = await suggestJobPosting(currentUserId, { jobTitle }));
    } catch {
      return { error: "Couldn't generate a draft for that role right now. Try again in a moment." };
    }
    const salaryMin = number(args.salary_min) ?? suggestion.salaryMin;
    const salaryMax = number(args.salary_max) ?? suggestion.salaryMax;
    const employmentType = text(args.employment_type) ?? suggestion.employmentType ?? "full_time";
    const workArrangement = text(args.work_arrangement) ?? suggestion.workArrangement ?? "onsite";
    draftJobPostingPending = {
      title: jobTitle.slice(0, 120),
      description: suggestion.description,
      responsibilities: suggestion.responsibilities,
      industry: suggestion.industry,
      employmentType,
      workArrangement,
      location: text(args.location),
      salaryMin,
      salaryMax,
      skills: suggestion.skills,
    };
    return compact({
      ready_to_create: true,
      title: jobTitle,
      salary: salaryMin || salaryMax ? `RM ${salaryMin ?? "?"}–${salaryMax ?? "?"} a month` : null,
      skills: suggestion.skills,
      note: "A confirmation card with the drafted posting appears under your reply. Nothing is created until the user presses Confirm, and it's saved as a draft only — they'll still review and submit it for review on the posting page before it goes live. Never say it's posted.",
    });
  }

  return {
    definitions: DEFINITIONS,
    searchApplicants,
    exportRequest: () => exportFilters,
    openRequest: () => openPicks,
    knownNames: () => applications.map((a) => a.applicantName),
    lookupText: () => lookups.join("\n"),
    stageChangeRequest: () => stageChange,
    scheduleInterviewRequest: () => scheduleInterviewPending,
    cancelInterviewRequest: () => cancelInterviewPending,
    recordEvaluationRequest: () => recordEvaluationPending,
    closePostingRequest: () => closePostingPending,
    draftJobPostingRequest: () => draftJobPostingPending,
    async run(name, rawArguments) {
      let args: Record<string, unknown> = {};
      try {
        const parsed = rawArguments ? JSON.parse(rawArguments) : {};
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) args = parsed;
      } catch {
        return JSON.stringify({ error: "Arguments weren't valid JSON." });
      }
      try {
        const result =
          name === "find_applicants"
            ? await findApplicants(args)
            : name === "export_applicants"
              ? await exportApplicants(args)
              : name === "open_applicant"
              ? openApplicant(args)
              : name === "change_stage"
              ? await changeStage(args)
              : name === "schedule_interview"
                ? scheduleInterview(args)
                : name === "cancel_interview"
                  ? cancelInterview(args)
                  : name === "record_evaluation"
                    ? recordEvaluation(args)
                    : name === "get_applicant"
              ? await getApplicant(args)
              : name === "list_interviews"
                ? listInterviews(args)
                : name === "get_posting"
                  ? getPosting(args)
                  : name === "close_posting"
                    ? closePosting(args)
                    : name === "draft_job_posting"
                      ? await draftJobPosting(args)
                      : { error: `Unknown tool ${name}.` };
        const text = JSON.stringify(result);
        lookups.push(text);
        return text;
      } catch (err) {
        console.error(`Assistant tool ${name} failed:`, err);
        return JSON.stringify({ error: "That lookup failed. Tell the user to try again." });
      }
    },
  };
}
