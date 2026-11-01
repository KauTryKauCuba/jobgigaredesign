import "server-only";
import { inArray } from "drizzle-orm";
import { APPLICATION_STATUS_LABEL } from "./applicationStatus";
import { dayKey } from "./assistant-context";
import { employerAssistantTools, type EmployerApplication } from "./assistant-tools";
import { db } from "./db";
import { jobseekerEducation } from "./db/schema";
import type { EmployerProfile } from "./employer-profile";
import type { HiringScope } from "./hiring-scope";
import { getApplicationsForEmployer } from "./job-applications";
import { getJobPostingsForEmployer } from "./job-postings";
import { malaysiaStateOf } from "./malaysia";
import { screeningEligibilityCheck } from "./matching";
import { QUALIFICATION_TIERS } from "./resume-parser";
import { buildXlsx, type XlsxCell, type XlsxColumn } from "./xlsx";

// "Export to Excel" for an employer's applicants — the Applicants page, a
// posting's page, and the JobGiga Assistant's download button all end up
// here. No AI: the rows come straight from the database, through the same
// hiring-scope rules as every applicant list, so nobody can export anyone
// they couldn't already see.
//
// Email and phone are deliberately never included (owner's decision, for
// PDPA): once in a file they can be passed around with no control over it.

export const EXPORT_MAX_APPLICATIONS = 5000;

/** Which applicants to export: the exact rows on screen, or an assistant search's filters. */
export type ApplicantExportRequest =
  | { applicationIds: string[]; title?: string }
  | { filters: Record<string, unknown>; title?: string };

const COLUMNS: XlsxColumn[] = [
  { header: "Name", width: 26 },
  { header: "Job posting", width: 26 },
  { header: "Stage", width: 20 },
  { header: "Applied", width: 13, format: "date" },
  { header: "Location", width: 22 },
  { header: "State", width: 16 },
  { header: "Fit score", width: 10 },
  { header: "Meets must-haves", width: 16 },
  { header: "Years of experience", width: 12 },
  { header: "Skills", width: 40 },
  { header: "Highest education", width: 36 },
  { header: "Expected salary (RM / month)", width: 16 },
  { header: "Notice period", width: 15 },
  { header: "Work arrangement", width: 15 },
  { header: "Employment type", width: 15 },
  { header: "Interview", width: 20, format: "datetime" },
  { header: "Interview reply", width: 18 },
  { header: "Screening", width: 60 },
];

const REPLY_LABEL: Record<string, string> = {
  pending: "No reply yet",
  accepted: "Accepted",
  declined: "Declined",
  reschedule_requested: "Asked to reschedule",
  attended: "Attended",
  no_show: "No-show",
};

/** "one_month" → "One month". */
function plain(value: string | null | undefined): string | null {
  if (!value) return null;
  const text = value.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function salary(min: number | null, max: number | null): string | null {
  if (!min && !max) return null;
  if (min && max) return min === max ? `${min}` : `${min}–${max}`;
  return `${min ?? max}`;
}

/** Highest qualification per jobseeker profile, as "Degree — Computer Science, Multimedia University". */
async function highestEducation(profileIds: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (profileIds.length === 0) return result;
  const rows = await db.select().from(jobseekerEducation).where(inArray(jobseekerEducation.profileId, profileIds));
  // "Other" ranks below SPM; anything unknown ranks lowest of all.
  const rank = (tier: string | null) => (tier === "Other" ? 0 : QUALIFICATION_TIERS.indexOf(tier as never) + 1);
  const best = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    const current = best.get(row.profileId);
    if (!current || rank(row.qualificationTier) > rank(current.qualificationTier)) best.set(row.profileId, row);
  }
  for (const [profileId, row] of best) {
    const detail = [row.fieldOfStudy, row.institution].filter(Boolean).join(", ");
    result.set(profileId, [row.qualificationTier, detail].filter(Boolean).join(" — "));
  }
  return result;
}

function fileName(title: string | undefined): string {
  const base = (title ?? "Applicants")
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
  return `${base || "Applicants"}-${dayKey(new Date())}.xlsx`;
}

export async function buildApplicantExport(
  profile: EmployerProfile,
  scope: HiringScope,
  request: ApplicantExportRequest,
): Promise<{ ok: true; fileName: string; file: Buffer; count: number } | { ok: false; error: string }> {
  const [postings, applications] = await Promise.all([
    getJobPostingsForEmployer(profile.id, scope),
    getApplicationsForEmployer(profile.id, scope),
  ]);
  const tools = employerAssistantTools({ profile, scope, postings, applications });

  // Searching with the request's filters (or none) also works out fit scores.
  const search = await tools.searchApplicants("filters" in request ? request.filters : {});
  if (!search.ok) return { ok: false, error: "Couldn't find those applicants any more." };
  const fit = search.fit;

  let rows: EmployerApplication[];
  if ("applicationIds" in request) {
    // Kept in the order they were on screen; ids the user can't see are skipped.
    const byId = new Map(applications.map((a) => [a.application.id, a]));
    rows = request.applicationIds.map((id) => byId.get(id)).filter((a): a is EmployerApplication => !!a);
  } else {
    // A "limit" is only there when they asked for a number ("top 10").
    const limit = typeof request.filters.limit === "number" ? Math.floor(request.filters.limit) : null;
    rows = limit && limit > 0 ? search.list.slice(0, limit) : search.list;
  }
  if (rows.length === 0) return { ok: false, error: "There are no applicants to export." };

  const education = await highestEducation([...new Set(rows.map((a) => a.application.jobseekerProfileId))]);
  const postingById = new Map(postings.map((p) => [p.id, p]));

  const cells: XlsxCell[][] = rows.map((a) => {
    const m = fit.get(a.application.id);
    const interview = a.application.interviewDetails;
    const posting = postingById.get(a.jobPostingId);
    const answers = a.application.screeningAnswers;
    let screening: string | null = null;
    if (posting?.screeningEnabled && answers) {
      const check = screeningEligibilityCheck(
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
      );
      const shortAnswers = answers.customAnswers
        .filter((ans) => ans.text?.trim())
        .map((ans) => {
          const question = posting.customScreeningQuestions.find((q) => q.id === ans.questionId)?.question ?? "Question";
          return `${question}: ${ans.text!.trim()}`;
        });
      screening =
        [...check.items.map((item) => `${item.met ? "✓" : "✗"} ${item.label}${item.preferred ? " (preferred)" : ""}`), ...shortAnswers].join(
          "; ",
        ) || null;
    }

    return [
      a.applicantName,
      a.jobPostingTitle,
      APPLICATION_STATUS_LABEL[a.application.status] ?? a.application.status,
      new Date(a.application.appliedAt),
      a.applicantLocation,
      a.applicantLocation ? malaysiaStateOf(a.applicantLocation) : null,
      m?.score ?? null,
      m ? (m.eligible ? "Yes" : "No") : null,
      a.applicantYearsExperience,
      a.applicantSkills.join(", "),
      education.get(a.application.jobseekerProfileId) ?? null,
      salary(a.applicantExpectedSalaryMin, a.applicantExpectedSalaryMax),
      plain(a.applicantNoticePeriod),
      plain(a.applicantWorkArrangement),
      plain(a.applicantEmploymentType),
      interview?.scheduledAt ? new Date(interview.scheduledAt) : null,
      interview?.scheduledAt ? REPLY_LABEL[a.application.interviewResponseStatus ?? "pending"] : null,
      screening,
    ];
  });

  return {
    ok: true,
    fileName: fileName(request.title),
    file: await buildXlsx("Applicants", COLUMNS, cells),
    count: rows.length,
  };
}
