import "server-only";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { employerProfiles, jobApplications, jobPostings, jobseekerProfiles, users } from "./db/schema";
import { DUMMY_APPLICANT_EMAIL_DOMAIN } from "./dummy-applicants";
import { DUMMY_POSTING_MARKER } from "./dummy-job-postings";
import { JOB_ALERT_MIN_SCORE } from "./job-alerts";
import { scoreJobseekerForPosting } from "./jobseeker-match";
import {
  hardFilterCheck,
  MATCH_WEIGHTS,
  PREFERRED_MAX_BONUS,
  screeningEligibilityCheck,
  weightedScore,
  withCriteriaDefaults,
  withPreferredBonus,
  type MatchComponent,
  type ScreeningItemResult,
} from "./matching";
import { isScorableQuestion } from "./screening-questions";
import { canonicalizeSkill } from "./skills-taxonomy";
import { isUuid } from "./uuid";

// The superadmin's Matching page: every live posting scored against every
// jobseeker profile with the same scoreJobseekerForPosting() that job pages
// and job alerts use, so the numbers here always agree with what jobseekers
// see. (Employer "Top Matches" additionally uses applicants' screening
// answers and the company's criteria switches — see match-results.ts.)

/** Weakest eligible match still drawn on the map — the page's slider starts higher. */
export const MAP_MIN_SCORE = 40;

export type MapJob = { id: string; title: string; slug: string; companyName: string; sample: boolean };
export type MapSeeker = { id: string; name: string; avatarUrl: string | null; targetRole: string; sample: boolean };
export type MapEdge = { job: string; seeker: string; score: number };

export type MatchMap = {
  jobs: MapJob[];
  /** Waiting for superadmin review — not on the map, but previewable in the explorer. */
  pendingJobs: MapJob[];
  seekers: MapSeeker[];
  edges: MapEdge[];
  alertMinScore: number;
};

const postingColumns = {
  id: jobPostings.id,
  title: jobPostings.title,
  slug: jobPostings.slug,
  status: jobPostings.status,
  postingName: jobPostings.postingName,
  companyName: employerProfiles.companyName,
  workAuthorizations: jobPostings.workAuthorizations,
  drivingLicense: jobPostings.drivingLicense,
  skills: jobPostings.skills,
  softSkills: jobPostings.softSkills,
  niceToHaveSkills: jobPostings.niceToHaveSkills,
  minYearsExperience: jobPostings.minYearsExperience,
  industry: jobPostings.industry,
  workArrangement: jobPostings.workArrangement,
  employmentType: jobPostings.employmentType,
  screeningEnabled: jobPostings.screeningEnabled,
  screeningPreferred: jobPostings.screeningPreferred,
  minQualificationTier: jobPostings.minQualificationTier,
  languages: jobPostings.languages,
  askLanguages: jobPostings.askLanguages,
  customScreeningQuestions: jobPostings.customScreeningQuestions,
  smartMatchCriteria: employerProfiles.smartMatchCriteria,
};

const seekerColumns = {
  id: jobseekerProfiles.id,
  fullName: jobseekerProfiles.fullName,
  avatarUrl: jobseekerProfiles.avatarUrl,
  targetRole: jobseekerProfiles.targetRole,
  jobAlertsEnabled: jobseekerProfiles.jobAlertsEnabled,
  email: users.email,
  workAuthorization: jobseekerProfiles.workAuthorization,
  drivingLicense: jobseekerProfiles.drivingLicense,
  professionalSkills: jobseekerProfiles.professionalSkills,
  softSkills: jobseekerProfiles.softSkills,
  otherSkills: jobseekerProfiles.otherSkills,
  yearsExperience: jobseekerProfiles.yearsExperience,
  preferredIndustry: jobseekerProfiles.preferredIndustry,
  workArrangement: jobseekerProfiles.workArrangement,
  employmentType: jobseekerProfiles.employmentType,
  // Shown as "not used for matching" — never scored.
  location: jobseekerProfiles.location,
  expectedSalaryMin: jobseekerProfiles.expectedSalaryMin,
  expectedSalaryMax: jobseekerProfiles.expectedSalaryMax,
  noticePeriod: jobseekerProfiles.noticePeriod,
};

const applicationColumns = {
  jobId: jobApplications.jobPostingId,
  seekerId: jobApplications.jobseekerProfileId,
  screeningAnswers: jobApplications.screeningAnswers,
  screeningEligible: jobApplications.screeningEligible,
  screeningPreferredMet: jobApplications.screeningPreferredMet,
  screeningPreferredTotal: jobApplications.screeningPreferredTotal,
};

type PostingRow = Awaited<ReturnType<typeof loadPostings>>[number];
type SeekerRow = Awaited<ReturnType<typeof loadSeekers>>[number];
type ApplicationRow = Awaited<ReturnType<typeof loadApplications>>[number];

function loadApplications(where: { postingId: string } | { seekerId: string }) {
  return db
    .select(applicationColumns)
    .from(jobApplications)
    .where(
      "postingId" in where
        ? eq(jobApplications.jobPostingId, where.postingId)
        : eq(jobApplications.jobseekerProfileId, where.seekerId),
    );
}

function loadPostings(where: { id: string } | { status: "active" | "pending" }) {
  return db
    .select(postingColumns)
    .from(jobPostings)
    .innerJoin(employerProfiles, eq(jobPostings.employerProfileId, employerProfiles.id))
    .where("id" in where ? eq(jobPostings.id, where.id) : eq(jobPostings.status, where.status));
}

function loadSeekers(seekerId?: string) {
  const query = db.select(seekerColumns).from(jobseekerProfiles).innerJoin(users, eq(users.id, jobseekerProfiles.userId));
  return seekerId ? query.where(eq(jobseekerProfiles.id, seekerId)) : query;
}

const isSamplePosting = (p: PostingRow) => p.postingName === DUMMY_POSTING_MARKER;
const isSampleSeeker = (s: SeekerRow) => (s.email ?? "").endsWith(`@${DUMMY_APPLICANT_EMAIL_DOMAIN}`);

function toMapJob(p: PostingRow): MapJob {
  return { id: p.id, title: p.title, slug: p.slug, companyName: p.companyName, sample: isSamplePosting(p) };
}

function toMapSeeker(s: SeekerRow): MapSeeker {
  return { id: s.id, name: s.fullName, avatarUrl: s.avatarUrl, targetRole: s.targetRole, sample: isSampleSeeker(s) };
}

/** Every live posting × every jobseeker — the eligible pairs at MAP_MIN_SCORE or above. */
export async function getMatchMap(): Promise<MatchMap> {
  const [postings, pending, seekers] = await Promise.all([
    loadPostings({ status: "active" }),
    loadPostings({ status: "pending" }),
    loadSeekers(),
  ]);
  const edges: MapEdge[] = [];
  for (const p of postings) {
    for (const s of seekers) {
      const { score, eligible } = scoreJobseekerForPosting(p, s);
      if (eligible && score >= MAP_MIN_SCORE) edges.push({ job: p.id, seeker: s.id, score });
    }
  }
  return {
    jobs: postings.map(toMapJob),
    pendingJobs: pending.map(toMapJob),
    seekers: seekers.map(toMapSeeker),
    edges,
    alertMinScore: JOB_ALERT_MIN_SCORE,
  };
}

// ---- One job × one jobseeker, with the full "why" ------------------------

export type ComponentDetail =
  | {
      kind: "skills";
      /** `via` is how the jobseeker wrote it when that differs (e.g. "ReactJS" for "React"). */
      matched: { skill: string; via: string | null }[];
      missing: string[];
    }
  | { kind: "compare"; wanted: string; has: string };

export type ScoredComponent = {
  key: MatchComponent;
  label: string;
  /** How this part turns into a %, in plain words. */
  rule: string;
  weight: number;
  /** 0..1, or null when the posting doesn't set this (left out of the score). */
  value: number | null;
  /** Points this part adds to the 0–100 fit score, after re-balancing across the parts that apply. */
  points: number | null;
  detail: ComponentDetail | null;
  /** The company switched this criterion off — ignored in their Top Matches only. */
  companyOff: boolean;
};

/** How an applicant shows in the employer's Top Matches — screening answers decide eligibility there. */
export type ApplicantView = {
  score: number;
  eligible: boolean;
  reasons: string[];
  screening: { items: ScreeningItemResult[]; preferredMet: number; preferredTotal: number; bonus: number } | null;
};

/** One job × one jobseeker. */
export type PairDetail = {
  /** What the jobseeker sees — 0 when a hard filter fails. */
  score: number;
  /** The weighted score before hard filters, so an ineligible but strong fit still shows. */
  fitScore: number;
  eligible: boolean;
  ineligibleReasons: string[];
  applied: boolean;
  /** Would get a new-job alert when this posting goes live (now, for a live one). */
  getsAlert: boolean;
  alertsOn: boolean;
  components: ScoredComponent[];
  /** Set only for jobseekers who applied. */
  applicant: ApplicantView | null;
};

export type SeekerMatchDetail = PairDetail & { seeker: MapSeeker };
export type JobMatchRow = PairDetail & { job: MapJob };

const COMPONENT_LABEL: Record<MatchComponent, string> = {
  skills: "Required skills",
  softSkills: "Soft skills",
  niceToHaveSkills: "Nice-to-have skills",
  experience: "Experience",
  industry: "Industry",
  workArrangement: "Work arrangement",
  employmentType: "Employment type",
};

// Plain-words versions of the scoring functions in matching.ts.
const SKILL_RULE = "Share of these the jobseeker has, from any of their skill lists (2 of 3 = 67%)";
const COMPONENT_RULE: Record<MatchComponent, string> = {
  skills: SKILL_RULE,
  softSkills: SKILL_RULE,
  niceToHaveSkills: SKILL_RULE,
  experience: "Their years ÷ the minimum, capped at 100% (1 of 2 years = 50%)",
  industry: "All or nothing: 100% if it's the same industry, otherwise 0%",
  workArrangement: "All or nothing: 100% if it's the same, otherwise 0% (Remote vs Hybrid = 0%)",
  employmentType: "All or nothing: 100% if it's the same, otherwise 0%",
};

/** "full_time" → "Full time", for enum values shown as plain text. */
export function humanize(value: string | null | undefined) {
  if (!value) return "—";
  const text = value.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function skillDetail(wanted: string[], have: string[]): ComponentDetail {
  // The jobseeker's own spelling for each canonical skill, to show aliases.
  const haveByCanon = new Map<string, string>();
  for (const h of have) if (!haveByCanon.has(canonicalizeSkill(h))) haveByCanon.set(canonicalizeSkill(h), h);
  const matched: { skill: string; via: string | null }[] = [];
  const missing: string[] = [];
  for (const skill of wanted) {
    const theirs = haveByCanon.get(canonicalizeSkill(skill));
    if (theirs === undefined) missing.push(skill);
    else matched.push({ skill, via: theirs.trim().toLowerCase() === skill.trim().toLowerCase() ? null : theirs });
  }
  return { kind: "skills", matched, missing };
}

/** What scoring one posting needs once, rather than per jobseeker. */
function postingContext(posting: PostingRow) {
  return {
    // Same requirements the apply route checks (api/jobseeker/applications):
    // languages only screen when the employer switched "Ask this" on.
    screeningRequirements: {
      preferred: posting.screeningPreferred,
      minYearsExperience: posting.minYearsExperience,
      minQualificationTier: posting.minQualificationTier,
      drivingLicense: posting.drivingLicense,
      languages: posting.askLanguages ? posting.languages : [],
      workAuthorizations: posting.workAuthorizations,
      customQuestions: posting.customScreeningQuestions,
    },
    criteria: withCriteriaDefaults(posting.smartMatchCriteria),
  };
}

/** Mirrors computeMatchResults (match-results.ts) for one applicant — what the employer's Top Matches shows. */
function applicantView(
  posting: PostingRow,
  ctx: ReturnType<typeof postingContext>,
  s: SeekerRow,
  breakdown: ReturnType<typeof scoreJobseekerForPosting>["breakdown"],
  application: ApplicationRow,
): ApplicantView {
  const check =
    posting.screeningEnabled && application.screeningAnswers
      ? screeningEligibilityCheck(ctx.screeningRequirements, application.screeningAnswers)
      : null;
  // The verdict saved when they applied is what Top Matches trusts; the
  // re-run above only explains it question by question.
  const { eligible, reasons } =
    application.screeningEligible === false
      ? { eligible: false, reasons: check?.reasons.length ? check.reasons : ["Doesn't meet this posting's screening requirements"] }
      : application.screeningEligible === true
        ? { eligible: true, reasons: [] }
        : hardFilterCheck({
            requiredWorkAuthorizations: posting.workAuthorizations,
            candidateWorkAuthorization: s.workAuthorization,
            requiredDrivingLicense: posting.drivingLicense,
            candidateDrivingLicense: s.drivingLicense,
            enabledWorkAuthorization: ctx.criteria.workAuthorization,
            enabledDrivingLicense: ctx.criteria.drivingLicense,
          });
  const base = weightedScore(breakdown, ctx.criteria);
  const score = withPreferredBonus(base, application.screeningPreferredMet, application.screeningPreferredTotal);
  return {
    score,
    eligible,
    reasons,
    screening: check
      ? {
          items: check.items,
          preferredMet: application.screeningPreferredMet ?? check.preferredMet,
          preferredTotal: application.screeningPreferredTotal ?? check.preferredTotal,
          bonus: score - base,
        }
      : null,
  };
}

function scorePair(
  posting: PostingRow,
  ctx: ReturnType<typeof postingContext>,
  s: SeekerRow,
  application: ApplicationRow | undefined,
): PairDetail {
  const match = scoreJobseekerForPosting(posting, s);
  const allSkills = [...s.professionalSkills, ...s.softSkills, ...s.otherSkills];
  const details: Record<MatchComponent, ComponentDetail | null> = {
    skills: posting.skills.length ? skillDetail(posting.skills, allSkills) : null,
    softSkills: posting.softSkills.length ? skillDetail(posting.softSkills, allSkills) : null,
    niceToHaveSkills: posting.niceToHaveSkills.length ? skillDetail(posting.niceToHaveSkills, allSkills) : null,
    experience: posting.minYearsExperience
      ? { kind: "compare", wanted: `${posting.minYearsExperience}+ years`, has: `${s.yearsExperience} years` }
      : null,
    industry: posting.industry ? { kind: "compare", wanted: posting.industry, has: s.preferredIndustry } : null,
    workArrangement: { kind: "compare", wanted: humanize(posting.workArrangement), has: humanize(s.workArrangement) },
    employmentType: { kind: "compare", wanted: humanize(posting.employmentType), has: humanize(s.employmentType) },
  };
  // Same re-balancing as weightedScore(): only the parts that apply share the 100 points.
  const keys = Object.keys(MATCH_WEIGHTS) as MatchComponent[];
  const totalWeight = keys.reduce((sum, k) => sum + (match.breakdown[k] === null ? 0 : MATCH_WEIGHTS[k]), 0);
  const components = keys.map((key): ScoredComponent => {
    const value = match.breakdown[key];
    return {
      key,
      label: COMPONENT_LABEL[key],
      rule: COMPONENT_RULE[key],
      weight: MATCH_WEIGHTS[key],
      value,
      points: value === null || totalWeight === 0 ? null : (value * MATCH_WEIGHTS[key] * 100) / totalWeight,
      detail: details[key],
      companyOff: !ctx.criteria[key],
    };
  });
  return {
    score: match.score,
    fitScore: weightedScore(match.breakdown),
    eligible: match.eligible,
    ineligibleReasons: match.ineligibleReasons,
    applied: !!application,
    // Mirrors sendJobAlertsForPosting's filter (job-alerts.ts).
    getsAlert: s.jobAlertsEnabled && match.eligible && match.score >= JOB_ALERT_MIN_SCORE && !application,
    alertsOn: s.jobAlertsEnabled,
    components,
    applicant: application ? applicantView(posting, ctx, s, match.breakdown, application) : null,
  };
}

const byEligibleThenFit = (a: PairDetail, b: PairDetail) => Number(b.eligible) - Number(a.eligible) || b.fitScore - a.fitScore;

// ---- One posting, every jobseeker ----------------------------------------

/** One scored part as the posting defines it — what it sets, and what on the jobseeker it's compared with. */
export type MatchParameter = {
  key: MatchComponent;
  label: string;
  rule: string;
  /** The posting's value: a list for skill parts, text otherwise; null when not set (part skipped). */
  jobValue: string[] | string | null;
  comparedWith: string;
  weight: number;
  /** Share of the 100 points once skipped parts are left out, or null when skipped. */
  effectiveWeight: number | null;
  companyOff: boolean;
};

export type PostingMatchDetail = {
  job: MapJob & {
    status: string;
    requirements: {
      workAuthorizations: string[];
      drivingLicense: string | null;
    };
    /** Hard filters the company switched off — ignored in their Top Matches only. */
    hardFiltersOff: { workAuthorization: boolean; drivingLicense: boolean };
    parameters: MatchParameter[];
    screening: {
      enabled: boolean;
      /** Each scored requirement, as screeningEligibilityCheck() checks it. */
      requirements: { label: string; preferred: boolean }[];
      /** Questions shown to the employer but never pass/fail anyone (short answers). */
      unscored: string[];
      preferredMaxBonus: number;
    };
  };
  rows: SeekerMatchDetail[];
  alertMinScore: number;
};

export async function getPostingMatchDetail(postingId: string): Promise<PostingMatchDetail | null> {
  if (!isUuid(postingId)) return null;
  const [[posting], seekers, applied] = await Promise.all([
    loadPostings({ id: postingId }),
    loadSeekers(),
    loadApplications({ postingId }),
  ]);
  if (!posting) return null;
  const applications = new Map(applied.map((a) => [a.seekerId, a]));
  const ctx = postingContext(posting);

  const rows = seekers
    .map((s): SeekerMatchDetail => ({ seeker: toMapSeeker(s), ...scorePair(posting, ctx, s, applications.get(s.id)) }))
    .sort(byEligibleThenFit);

  // Mirrors the parts scoreJobseekerForPosting() compares (jobseeker-match.ts):
  // every skill part checks the jobseeker's whole skill pool.
  const skillPool = "Skills, soft skills & other skills";
  const jobValues: Record<MatchComponent, { value: string[] | string | null; comparedWith: string }> = {
    skills: { value: posting.skills.length ? posting.skills : null, comparedWith: skillPool },
    softSkills: { value: posting.softSkills.length ? posting.softSkills : null, comparedWith: skillPool },
    niceToHaveSkills: { value: posting.niceToHaveSkills.length ? posting.niceToHaveSkills : null, comparedWith: skillPool },
    experience: {
      value: posting.minYearsExperience ? `${posting.minYearsExperience}+ years` : null,
      comparedWith: "Years of experience",
    },
    industry: { value: posting.industry ?? null, comparedWith: "Preferred industry" },
    workArrangement: { value: humanize(posting.workArrangement), comparedWith: "Preferred work arrangement" },
    employmentType: { value: humanize(posting.employmentType), comparedWith: "Preferred employment type" },
  };
  const paramKeys = Object.keys(MATCH_WEIGHTS) as MatchComponent[];
  const setWeight = paramKeys.reduce((sum, k) => sum + (jobValues[k].value === null ? 0 : MATCH_WEIGHTS[k]), 0);
  const parameters = paramKeys.map(
    (key): MatchParameter => ({
      key,
      label: COMPONENT_LABEL[key],
      rule: COMPONENT_RULE[key],
      jobValue: jobValues[key].value,
      comparedWith: jobValues[key].comparedWith,
      weight: MATCH_WEIGHTS[key],
      effectiveWeight: jobValues[key].value === null || setWeight === 0 ? null : MATCH_WEIGHTS[key] / setWeight,
      companyOff: !ctx.criteria[key],
    }),
  );

  return {
    job: {
      ...toMapJob(posting),
      status: posting.status,
      requirements: {
        workAuthorizations: posting.workAuthorizations.map(humanize),
        drivingLicense: posting.drivingLicense ? humanize(posting.drivingLicense) : null,
      },
      hardFiltersOff: { workAuthorization: !ctx.criteria.workAuthorization, drivingLicense: !ctx.criteria.drivingLicense },
      parameters,
      screening: {
        enabled: posting.screeningEnabled,
        // Checking blank answers lists every scored requirement in the check's own words.
        requirements: posting.screeningEnabled
          ? screeningEligibilityCheck(ctx.screeningRequirements, {
              yearsExperience: null,
              qualificationTier: null,
              drivingLicense: null,
              languages: [],
              workAuthorization: null,
              customAnswers: [],
            }).items.map(({ label, preferred }) => ({ label, preferred }))
          : [],
        unscored: posting.screeningEnabled
          ? posting.customScreeningQuestions.filter((q) => !isScorableQuestion(q)).map((q) => q.question)
          : [],
        preferredMaxBonus: PREFERRED_MAX_BONUS,
      },
    },
    rows,
    alertMinScore: JOB_ALERT_MIN_SCORE,
  };
}

// ---- One jobseeker, every live posting -----------------------------------

export type SeekerProfileDetail = MapSeeker & {
  alertsOn: boolean;
  /** What matching reads from their profile. */
  used: {
    skills: string[];
    softSkills: string[];
    otherSkills: string[];
    yearsExperience: number;
    preferredIndustry: string;
    workArrangement: string;
    employmentType: string;
    workAuthorization: string;
    drivingLicense: string | null;
  };
  /** On their profile, but never compared with a job. */
  notUsed: { label: string; value: string }[];
};

export type SeekerMatchView = {
  seeker: SeekerProfileDetail;
  rows: JobMatchRow[];
  alertMinScore: number;
};

export async function getSeekerMatchDetail(seekerId: string): Promise<SeekerMatchView | null> {
  if (!isUuid(seekerId)) return null;
  const [[seeker], postings, applied] = await Promise.all([
    loadSeekers(seekerId),
    loadPostings({ status: "active" }),
    loadApplications({ seekerId }),
  ]);
  if (!seeker) return null;
  const applications = new Map(applied.map((a) => [a.jobId, a]));

  const rows = postings
    .map((p): JobMatchRow => ({ job: toMapJob(p), ...scorePair(p, postingContext(p), seeker, applications.get(p.id)) }))
    .sort(byEligibleThenFit);

  const rm = (n: number) => `RM ${n.toLocaleString("en-MY")}`;
  return {
    seeker: {
      ...toMapSeeker(seeker),
      alertsOn: seeker.jobAlertsEnabled,
      used: {
        skills: seeker.professionalSkills,
        softSkills: seeker.softSkills,
        otherSkills: seeker.otherSkills,
        yearsExperience: seeker.yearsExperience,
        preferredIndustry: seeker.preferredIndustry,
        workArrangement: humanize(seeker.workArrangement),
        employmentType: humanize(seeker.employmentType),
        workAuthorization: humanize(seeker.workAuthorization),
        drivingLicense: seeker.drivingLicense ? humanize(seeker.drivingLicense) : null,
      },
      notUsed: [
        { label: "Location", value: seeker.location || "—" },
        { label: "Expected salary", value: `${rm(seeker.expectedSalaryMin)} – ${rm(seeker.expectedSalaryMax)}` },
        { label: "Target role", value: seeker.targetRole || "—" },
        { label: "Notice period", value: humanize(seeker.noticePeriod) },
      ],
    },
    rows,
    alertMinScore: JOB_ALERT_MIN_SCORE,
  };
}
