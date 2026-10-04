import "server-only";
import { asc, inArray, sql } from "drizzle-orm";
import { db } from "./db";
import { applicationStatusEnum, jobApplicationEvents } from "./db/schema";
import type { ApplicationEvent, EmployerResponsiveness } from "./responsiveness";

type ApplicationStatus = (typeof applicationStatusEnum.enumValues)[number];

// Anything with `.insert()` — the shared db or a transaction.
type Writer = Pick<typeof db, "insert">;

/**
 * Logs one pipeline move. Call it wherever an application's `status`
 * actually changes (a no-op re-save of the same status isn't an event).
 */
export async function recordStatusChange(
  jobApplicationId: string,
  fromStatus: ApplicationStatus | null,
  toStatus: ApplicationStatus,
  writer: Writer = db,
) {
  if (fromStatus === toStatus) return;
  await writer.insert(jobApplicationEvents).values({ jobApplicationId, fromStatus, toStatus });
}

/** Every application's event history, oldest first, keyed by application id. */
export async function getApplicationEvents(jobApplicationIds: string[]): Promise<Map<string, ApplicationEvent[]>> {
  const result = new Map<string, ApplicationEvent[]>();
  if (jobApplicationIds.length === 0) return result;
  const rows = await db
    .select({
      jobApplicationId: jobApplicationEvents.jobApplicationId,
      fromStatus: jobApplicationEvents.fromStatus,
      toStatus: jobApplicationEvents.toStatus,
      createdAt: jobApplicationEvents.createdAt,
    })
    .from(jobApplicationEvents)
    .where(inArray(jobApplicationEvents.jobApplicationId, jobApplicationIds))
    .orderBy(asc(jobApplicationEvents.createdAt));
  for (const row of rows) {
    const list = result.get(row.jobApplicationId) ?? [];
    list.push({ fromStatus: row.fromStatus, toStatus: row.toStatus, createdAt: row.createdAt.toISOString() });
    result.set(row.jobApplicationId, list);
  }
  return result;
}

// How far back reply speed is measured, and how long an untouched
// application has to sit before it counts as "not replied to" (anything
// newer might simply not have been seen yet).
const WINDOW_DAYS = 180;
const UNANSWERED_AFTER_HOURS = 72;
// Below this many measurable applications, a reply-speed claim would be noise.
const MIN_SAMPLE = 3;

/**
 * Each employer's typical time to first response (median hours from
 * application to the first move out of "applied") and the share of
 * applications that got any response at all, over the last 180 days.
 * Employers with too few applications to judge are left out of the map.
 */
export async function getEmployerResponsiveness(
  employerProfileIds: string[],
): Promise<Map<string, EmployerResponsiveness>> {
  const result = new Map<string, EmployerResponsiveness>();
  const ids = [...new Set(employerProfileIds)];
  if (ids.length === 0) return result;

  const rows = await db.execute<{
    employer_profile_id: string;
    measured: string;
    responded: string;
    waiting_long: string;
    median_hours: string | null;
  }>(sql`
    WITH apps AS (
      SELECT
        jp.employer_profile_id,
        ja.applied_at,
        ja.status,
        (
          SELECT min(e.created_at)
          FROM job_application_events e
          WHERE e.job_application_id = ja.id AND e.from_status = 'applied'
        ) AS first_response_at
      FROM job_applications ja
      JOIN job_postings jp ON jp.id = ja.job_posting_id
      WHERE jp.employer_profile_id IN (${sql.join(
        ids.map((id) => sql`${id}::uuid`),
        sql`, `,
      )})
        AND ja.applied_at > now() - make_interval(days => ${WINDOW_DAYS})
        AND ja.status <> 'withdrawn'
    )
    SELECT
      employer_profile_id,
      count(*) FILTER (
        WHERE first_response_at IS NOT NULL
           OR applied_at < now() - make_interval(hours => ${UNANSWERED_AFTER_HOURS})
      ) AS measured,
      count(first_response_at) AS responded,
      count(*) FILTER (
        WHERE first_response_at IS NULL
          AND status = 'applied'
          AND applied_at < now() - make_interval(hours => ${UNANSWERED_AFTER_HOURS})
      ) AS waiting_long,
      percentile_cont(0.5) WITHIN GROUP (
        ORDER BY extract(epoch FROM first_response_at - applied_at) / 3600
      ) FILTER (WHERE first_response_at IS NOT NULL) AS median_hours
    FROM apps
    GROUP BY employer_profile_id
  `);

  for (const row of rows.rows) {
    const measured = Number(row.measured);
    const responded = Number(row.responded);
    if (measured < MIN_SAMPLE || row.median_hours === null) continue;
    result.set(row.employer_profile_id, {
      medianHours: Number(row.median_hours),
      responseRate: responded / measured,
      sampleSize: measured,
      waitingLong: Number(row.waiting_long),
    });
  }
  return result;
}

/** Applications to this employer still sitting at "applied" for over 3 days. */
export async function countApplicantsWaitingLong(employerProfileId: string): Promise<number> {
  const rows = await db.execute<{ count: string }>(sql`
    SELECT count(*) AS count
    FROM job_applications ja
    JOIN job_postings jp ON jp.id = ja.job_posting_id
    WHERE jp.employer_profile_id = ${employerProfileId}::uuid
      AND ja.status = 'applied'
      AND ja.applied_at < now() - make_interval(hours => ${UNANSWERED_AFTER_HOURS})
  `);
  return Number(rows.rows[0]?.count ?? 0);
}
