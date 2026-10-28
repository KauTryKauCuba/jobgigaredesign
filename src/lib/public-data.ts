import "server-only";
import { revalidateTag, unstable_cache } from "next/cache";
import { todayMY } from "./ad-slots";
import { queryLiveCompanyAds, syncCompanyAds } from "./company-ads";
import {
  getEmployersWithPostings,
  getLatestActivePostings,
  getLatestShortlistAndInterviewActivity,
} from "./employer-profile";
import { queryLiveJobAds, syncJobAds } from "./job-ads";
import { getJobPostingsByStatus, stripCustomQuestionAnswers } from "./job-postings";
import { getPostingContacts } from "./posting-extras";
import { getWelcomeImageUrl, type WelcomeRole } from "./welcome-images";

// The public landing pages ("/employer", "/jobseeker") show the same data to
// every visitor, so it's fetched once and shared instead of re-queried on
// every visit. Any API route that changes this data calls
// revalidatePublicData(), so changes show on the next visit; `revalidate` is
// only a backstop in case a write path is missed.
//
// Cached values come back JSON-serialized (Dates become strings) — fine here,
// since these pages JSON-serialize them for their client components anyway.
const PUBLIC_DATA_TAG = "public-data";
const options = { tags: [PUBLIC_DATA_TAG], revalidate: 60 };

/** Route Handlers only — Next.js doesn't allow it during a page render. */
export function revalidatePublicData() {
  revalidateTag(PUBLIC_DATA_TAG, { expire: 0 });
}

export const getPublicEmployersWithPostings = unstable_cache(
  (limit: number) => getEmployersWithPostings(limit),
  ["public-employers-with-postings"],
  options,
);

export const getPublicLatestActivePostings = unstable_cache(
  (limit: number) => getLatestActivePostings(limit),
  ["public-latest-active-postings"],
  options,
);

export const getPublicLatestActivity = unstable_cache(
  (limit: number) => getLatestShortlistAndInterviewActivity(limit),
  ["public-latest-activity"],
  options,
);

export const getPublicWelcomeImageUrl = unstable_cache(
  (role: WelcomeRole) => getWelcomeImageUrl(role),
  ["public-welcome-image-url"],
  options,
);

/** Every active posting with its public "Posted by" contact, screening answers stripped. */
export const getPublicActivePostings = unstable_cache(
  async () => {
    const rows = await getJobPostingsByStatus("active");
    const contacts = await getPostingContacts(rows.map((row) => row.posting));
    return rows.map((row) => ({
      ...row,
      posting: {
        ...stripCustomQuestionAnswers(row.posting),
        contact: contacts.get(`${row.posting.employerProfileId}:${row.posting.contactUserId}`) ?? null,
      },
    }));
  },
  ["public-active-postings"],
  options,
);

// `today` is part of the cache key, so the day's live ads change at midnight
// (Malaysia time) without any write. The booking housekeeping stays outside
// the cache so it still runs on page visits, as it always has.
const cachedLiveCompanyAds = unstable_cache(
  (today: string) => queryLiveCompanyAds(today),
  ["public-live-company-ads"],
  options,
);
const cachedLiveJobAds = unstable_cache((today: string) => queryLiveJobAds(today), ["public-live-job-ads"], options);

export async function getPublicLiveCompanyAds() {
  const today = todayMY();
  await syncCompanyAds(today);
  return cachedLiveCompanyAds(today);
}

export async function getPublicLiveJobAds() {
  const today = todayMY();
  await syncJobAds(today);
  return cachedLiveJobAds(today);
}
