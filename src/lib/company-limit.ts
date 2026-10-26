import "server-only";
import { count, eq, inArray } from "drizzle-orm";
import { db } from "./db";
import { employerProfiles, users } from "./db/schema";

/** How many companies one account may register unless a superadmin sets a custom limit (users.companyLimit). */
export const DEFAULT_COMPANY_LIMIT = 5;
export const MAX_COMPANY_LIMIT = 100;

export type CompanyLimitInfo = { used: number; limit: number; custom: boolean; canAdd: boolean };

/** Companies this account has registered, against its limit. */
export async function getCompanyLimitInfo(userId: string): Promise<CompanyLimitInfo> {
  const [[user], [row]] = await Promise.all([
    db.select({ companyLimit: users.companyLimit }).from(users).where(eq(users.id, userId)).limit(1),
    db.select({ n: count() }).from(employerProfiles).where(eq(employerProfiles.userId, userId)),
  ]);
  const used = row?.n ?? 0;
  const custom = user?.companyLimit != null;
  const limit = user?.companyLimit ?? DEFAULT_COMPANY_LIMIT;
  return { used, limit, custom, canAdd: used < limit };
}

/** Same, for many accounts at once (the superadmin Employers list). */
export async function getCompanyLimitInfoFor(userIds: string[]): Promise<Map<string, CompanyLimitInfo>> {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return new Map();
  const [limits, counts] = await Promise.all([
    db.select({ id: users.id, companyLimit: users.companyLimit }).from(users).where(inArray(users.id, ids)),
    db
      .select({ userId: employerProfiles.userId, n: count() })
      .from(employerProfiles)
      .where(inArray(employerProfiles.userId, ids))
      .groupBy(employerProfiles.userId),
  ]);
  const used = new Map(counts.map((c) => [c.userId, c.n]));
  return new Map(
    limits.map((u) => {
      const n = used.get(u.id) ?? 0;
      const limit = u.companyLimit ?? DEFAULT_COMPANY_LIMIT;
      return [u.id, { used: n, limit, custom: u.companyLimit != null, canAdd: n < limit }];
    }),
  );
}
