// Shared between the "Get/Remove dummy data" button's team-dummy API route
// (src/app/api/employer/team/dummy) and EmployerJobsView's own hasDummyData
// detection, so both agree on exactly what counts as a dummy teammate row —
// same convention as the dummy-applicant email tagging in dummy-applicants.ts,
// scoped per employerProfileId so cleanup for one company can never touch
// another's.
export const DUMMY_TEAM_EMAIL_DOMAIN = "dummy-team.jobgiga.test";

// The *displayed* email on the Team page — clean, no employerProfileId —
// since employerTeamMembers.email only needs to be unique per-company
// (unique(employerProfileId, email)), which 10 distinct roster names already
// satisfy on their own.
export function buildDummyTeamEmail(slug: string) {
  return `${slug}@${DUMMY_TEAM_EMAIL_DOMAIN}`;
}

// The *login* email for an "active" dummy teammate's real `users` row —
// users.email is globally unique across the whole app, so if two different
// employers each click "Get dummy data" on their own company, both trying to
// create "aisyah.rahman@dummy-team.jobgiga.test" would collide. The
// employerProfileId is embedded here (invisible to the Team page, since it
// only reads employerTeamMembers.email) purely to keep that global uniqueness.
export function buildDummyTeamLoginEmail(slug: string, employerProfileId: string) {
  return `${slug}.${employerProfileId}@${DUMMY_TEAM_EMAIL_DOMAIN}`;
}

// "Zarina Yusof" -> "zarina.yusof" — a readable local-part instead of an
// opaque "teammate7".
export function slugifyName(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, ".");
}

// Same external placeholder-avatar service scripts/seed.ts's personAvatarUrl
// uses for dummy employers/jobseekers (https://i.pravatar.cc/300?img=N, 70
// distinct photos) — reused here instead of a second avatar mechanism.
function dummyTeamAvatarUrl(index: number) {
  return `https://i.pravatar.cc/300?img=${(index % 70) + 1}`;
}

// A 10-person roster shared by both dummy-team sources (the "Get dummy data"
// button's own-company route, and the two fixed ParcelTracker/WHALE
// companies in dummy-companies.ts) — HR/hiring-flavored positions (same
// POSITIONS taxonomy from src/lib/positions.ts) and a realistic active/
// pending mix, rather than every company looking identically fully-joined.
// Pending entries have no avatar — they don't have an account yet, same as a
// real not-yet-accepted invite.
export const DUMMY_TEAM_ROSTER: {
  name: string;
  position: string;
  status: "active" | "pending";
  avatarUrl: string | null;
}[] = [
  { name: "Aisyah Rahman", position: "Talent Acquisition Manager", status: "active", avatarUrl: dummyTeamAvatarUrl(20) },
  { name: "Farid Hassan", position: "HR Manager", status: "active", avatarUrl: dummyTeamAvatarUrl(21) },
  { name: "Nurul Huda", position: "HR Executive", status: "active", avatarUrl: dummyTeamAvatarUrl(22) },
  { name: "Kevin Tan", position: "Recruiter", status: "active", avatarUrl: dummyTeamAvatarUrl(23) },
  { name: "Priya Ramesh", position: "HR Business Partner", status: "active", avatarUrl: dummyTeamAvatarUrl(24) },
  { name: "Daniel Lee", position: "People Operations Manager", status: "active", avatarUrl: dummyTeamAvatarUrl(25) },
  { name: "Zarina Yusof", position: "HR Director", status: "pending", avatarUrl: null },
  { name: "Amirul Hakim", position: "Recruitment Consultant", status: "pending", avatarUrl: null },
  { name: "Chong Mei Yee", position: "HR Officer", status: "pending", avatarUrl: null },
  { name: "Haziq Rizal", position: "Office Manager", status: "pending", avatarUrl: null },
];
