import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, uuid, integer, boolean, pgEnum, jsonb, unique, uniqueIndex, doublePrecision, index, date } from "drizzle-orm/pg-core";
import type { AssistantAction } from "../assistant-types";
import type { ThemeBanner, ThemeColors, ThemeEffect, ThemeEffectScope } from "../site-themes-shared";
import type { AiInterviewAnswerEvaluation, AiInterviewReport } from "../ai-interview-shared";
import type { CustomAnswer, CustomQuestion } from "../screening-questions";
import type { WorkPlace } from "../work-locations";

export const roleEnum = pgEnum("role", ["employer", "jobseeker"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  googleId: text("google_id").unique(),
  role: roleEnum("role").notNull(),
  // When this person closed the employer "Get sample data" bar — stored on
  // the account (not the browser) so closing it once hides it everywhere.
  sampleDataBannerDismissedAt: timestamp("sample_data_banner_dismissed_at", { withTimezone: true }),
  // Same, for the "Verify your phone number" bar (jobseekers and employer owners).
  phoneVerifyBannerDismissedAt: timestamp("phone_verify_banner_dismissed_at", { withTimezone: true }),
  // How many companies this account may register. Null = the default
  // (DEFAULT_COMPANY_LIMIT in src/lib/company-limit.ts); a superadmin can set
  // a custom number for a special client.
  companyLimit: integer("company_limit"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const otpCodes = pgTable("otp_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  codeHash: text("code_hash").notNull(),
  role: roleEnum("role"),
  attempts: integer("attempts").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// "unverified" = no SSM document uploaded yet (or it was cleared);
// "pending" = a document is uploaded and waiting on superadmin review;
// "verified" earns the checkmark badge next to the company's logo/avatar;
// "rejected" sends the employer back to "pending" the moment they re-upload.
export const ssmVerificationStatusEnum = pgEnum("ssm_verification_status", [
  "unverified",
  "pending",
  "verified",
  "rejected",
]);

// One account can register several companies (up to its company limit —
// see users.companyLimit), so userId is indexed, not unique.
export const employerProfiles = pgTable("employer_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  avatarUrl: text("avatar_url"),
  contactName: text("contact_name").notNull(),
  // Hiring-function category (Founder/Owner, HR Manager, ...) — a short fixed
  // list, standardizable because it's scoped to "why this person is using
  // the platform." `contactPosition` below is their actual job title in the
  // company org chart (e.g. "Senior Graphic Designer") — free text, since
  // real job titles aren't a short enough list to standardize.
  contactRole: text("contact_role").notNull(),
  contactPosition: text("contact_position").notNull(),
  contactPhone: text("contact_phone").notNull(),
  contactEmail: text("contact_email").notNull(),
  companyName: text("company_name").notNull(),
  ssmNumber: text("ssm_number").notNull(),
  // The uploaded SSM certificate/business registration document (PDF or
  // image) a superadmin checks against `ssmNumber` before verifying.
  ssmDocumentUrl: text("ssm_document_url"),
  ssmVerificationStatus: ssmVerificationStatusEnum("ssm_verification_status").notNull().default("unverified"),
  ssmVerifiedAt: timestamp("ssm_verified_at", { withTimezone: true }),
  // Set when a superadmin rejects the document — shown back to the employer
  // so they know what to fix before re-uploading. Cleared on the next upload.
  ssmRejectionReason: text("ssm_rejection_reason"),
  industry: text("industry").notNull(),
  // One of INDUSTRIES (src/lib/industries.ts), same list jobseekerProfiles
  // .preferredIndustry and jobPostings.industry use — kept separate from the
  // free-text `industry` above (which stays employer-facing/descriptive) so
  // matching/discovery has a value it can compare 1:1 against. Required.
  industryCategory: text("industry_category").notNull(),
  companySize: text("company_size").notNull(),
  companyDescription: text("company_description"),
  logoUrl: text("logo_url"),
  benefits: text("benefits").array().notNull().default([]),
  websiteUrl: text("website_url"),
  companyEmail: text("company_email"),
  companyPhone: text("company_phone"),
  companyLinkedin: text("company_linkedin"),
  companyFacebook: text("company_facebook"),
  companyInstagram: text("company_instagram"),
  foundedYear: integer("founded_year"),
  companyType: text("company_type"),
  officePhotoUrl: text("office_photo_url"),
  // Wide cover image (3:1, resized to 1500x500 WebP on upload) shown across
  // the top of the company's directory card and public company page.
  bannerUrl: text("banner_url"),
  recentNews: jsonb("recent_news")
    .$type<{ title: string; url: string }[]>()
    .notNull()
    .default([]),
  // What the workplace is like (see src/lib/company-workplace.ts): office &
  // team photos the employer uploads, facilities (from FACILITIES), dress
  // code (from DRESS_CODES), awards/certifications and leadership.
  galleryPhotos: jsonb("gallery_photos").$type<string[]>().notNull().default([]),
  facilities: jsonb("facilities").$type<string[]>().notNull().default([]),
  dressCode: text("dress_code"),
  awards: jsonb("awards").$type<{ title: string; year: number | null }[]>().notNull().default([]),
  leaders: jsonb("leaders")
    .$type<{ name: string; title: string; photoUrl: string | null }[]>()
    .notNull()
    .default([]),
  // Applicants page's "Top Matches" card — persisted per employer so the
  // on/off state and which criteria count toward the score survive a
  // refresh instead of resetting to defaults every visit.
  smartMatchEnabled: boolean("smart_match_enabled").notNull().default(true),
  smartMatchCriteria: jsonb("smart_match_criteria")
    .$type<{
      skills: boolean;
      softSkills: boolean;
      niceToHaveSkills: boolean;
      experience: boolean;
      industry: boolean;
      workArrangement: boolean;
      employmentType: boolean;
      workAuthorization: boolean;
      drivingLicense: boolean;
    }>()
    .notNull()
    .default({
      skills: true,
      softSkills: true,
      niceToHaveSkills: true,
      experience: true,
      industry: true,
      workArrangement: true,
      employmentType: true,
      workAuthorization: true,
      drivingLicense: true,
    }),
  // Bumped only when the employer asks the chat assistant "any new
  // applicants since I last checked?" — a chat-scoped checkpoint, distinct
  // from simply viewing the Applicants page, so "since last checked" always
  // means since the last time they asked that exact question.
  applicantsLastCheckedAt: timestamp("applicants_last_checked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("employer_profiles_user_id_idx").on(table.userId)]);

// An employer can have more than one office/branch — the "Company Profile"
// page shows them as a list, and a job posting picks one of these as its
// location instead of retyping an address. `label` (e.g. "Headquarters",
// "Penang branch") is free text so employers can tell rows apart at a
// glance, since street addresses alone often look interchangeable.
export const employerAddresses = pgTable(
  "employer_addresses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employerProfileId: uuid("employer_profile_id")
      .notNull()
      .references(() => employerProfiles.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    addressLine1: text("address_line1").notNull(),
    addressLine2: text("address_line2"),
    // Optional neighbourhood (e.g. "Bangsar South") — the postcode list only
    // goes down to the post-office town, so this is typed by the employer.
    area: text("area"),
    city: text("city").notNull(),
    state: text("state").notNull(),
    postcode: text("postcode").notNull(),
    // The address a new job posting starts with (Post a job pre-fills its
    // location from it). At most one per company; when none is marked, the
    // first address is used — see defaultJobAddress().
    isJobDefault: boolean("is_job_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("employer_addresses_employer_profile_id_idx").on(table.employerProfileId)],
);

// owner/admin run the whole company account. hiring_manager only sees the
// job postings they're assigned to (job_posting_hiring_managers) and moves
// those applicants along; panel only sees the candidates whose interview
// panel they're on, and submits their scorecard. See src/lib/team-roles.ts.
export const teamMemberRoleEnum = pgEnum("team_member_role", ["owner", "admin", "hiring_manager", "panel"]);
export const teamMemberStatusEnum = pgEnum("team_member_status", ["active", "pending"]);

// A company can have more than one login now — this is the membership
// table between a user and the employer profile they belong to.
// `employerProfiles.userId` stays as-is (it's the account that originally
// created the company, unrelated to team membership) rather than being
// migrated away; every route that still checks it directly keeps working
// unchanged, and the Team page/API are additive on top, not a replacement.
// A pending row (`userId` null, just an `email`) becomes active once that
// person signs up/logs in and accepts — invite-acceptance isn't built yet,
// so today pending rows only clear via being removed from the Team page.
export const employerTeamMembers = pgTable(
  "employer_team_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employerProfileId: uuid("employer_profile_id")
      .notNull()
      .references(() => employerProfiles.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: teamMemberRoleEnum("role").notNull().default("admin"),
    // Optional job title (e.g. "Senior Graphic Designer") — nullable since
    // the owner's own row relies on employerProfiles.contactPosition for
    // display instead (set once at onboarding, not duplicated here).
    position: text("position"),
    // A teammate's own "Your role" (CONTACT_ROLES) and phone — the same
    // About-you fields the registrant keeps on employerProfiles
    // (contactRole/contactPhone). Null until they fill in About you.
    hiringRole: text("hiring_role"),
    phone: text("phone"),
    status: teamMemberStatusEnum("status").notNull().default("pending"),
    invitedAt: timestamp("invited_at", { withTimezone: true }).notNull().defaultNow(),
    joinedAt: timestamp("joined_at", { withTimezone: true }),
    // When they finished the "About you" welcome step after joining (name,
    // photo, position). Null = an invited teammate who hasn't yet — they're
    // sent to /employer/welcome first. Never needed for the registrant.
    profileCompletedAt: timestamp("profile_completed_at", { withTimezone: true }),
    // The invite link (/invite/[token]): only a SHA-256 hash of the token is
    // stored, never the token itself. One-time — cleared when accepted or
    // declined — and replaced (so old links stop working) on every resend.
    inviteTokenHash: text("invite_token_hash").unique(),
    // When the link stops working. Null on invites sent before links
    // expired (and on accepted/joined rows).
    inviteExpiresAt: timestamp("invite_expires_at", { withTimezone: true }),
    // Who sent (or last resent) the invite — shown on the invite page.
    invitedByUserId: uuid("invited_by_user_id").references(() => users.id, { onDelete: "set null" }),
  },
  (table) => [
    unique().on(table.employerProfileId, table.email),
    index("employer_team_members_user_id_idx").on(table.userId),
  ],
);

export const teamActivityActionEnum = pgEnum("team_activity_action", [
  "invited",
  "resent_invite",
  "role_changed",
  "removed",
  "declined",
  "joined",
  "job_assigned",
  "job_unassigned",
]);

// One row per team-management action, newest first on the Team page's
// activity list. `actorUserId` is nullable (not `.references()`-cascaded on
// delete) so a log entry survives the actor's own account being removed —
// `actorLabel` is a snapshot of their name/email at the time, so the line
// still reads correctly even if the actor is gone or later renames
// themselves. `targetEmail` is likewise a snapshot, since the affected
// member row can itself be deleted (on removal) or change email.
export const employerTeamActivity = pgTable(
  "employer_team_activity",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employerProfileId: uuid("employer_profile_id")
      .notNull()
      .references(() => employerProfiles.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    actorLabel: text("actor_label").notNull(),
    action: teamActivityActionEnum("action").notNull(),
    targetEmail: text("target_email").notNull(),
    fromRole: teamMemberRoleEnum("from_role"),
    toRole: teamMemberRoleEnum("to_role"),
    // Extra context for the line, e.g. the job title on job_assigned.
    detail: text("detail"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("employer_team_activity_employer_profile_id_idx").on(table.employerProfileId)],
);

// employer_badges — one permanent row per milestone a company has reached
// (see src/lib/badges.ts for the full set and award logic). Deliberately a
// logged, one-time event rather than something derived live from current
// state — same "keep history, don't just recompute" convention as
// employerTeamActivity/jobPostingPosters above, so a badge never quietly
// disappears just because the data that first earned it later changes
// (e.g. deleting your only job posting shouldn't revoke "Posted your first
// job"). The unique constraint below is what makes awarding idempotent —
// callers just try to insert every time the qualifying condition is true,
// and only the very first attempt actually writes a row.
export const employerBadgeKeyEnum = pgEnum("employer_badge_key", [
  "profile_completed",
  "logo_added",
  "profile_boosted",
  "first_job_posted",
  "screening_enabled",
  "first_candidate_screened",
  "first_hire",
  "team_builder",
]);

export const employerBadges = pgTable(
  "employer_badges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employerProfileId: uuid("employer_profile_id")
      .notNull()
      .references(() => employerProfiles.id, { onDelete: "cascade" }),
    badgeKey: employerBadgeKeyEnum("badge_key").notNull(),
    earnedAt: timestamp("earned_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("employer_badges_profile_key_unique").on(table.employerProfileId, table.badgeKey),
    index("employer_badges_employer_profile_id_idx").on(table.employerProfileId),
  ],
);

export const employerOnboardingDrafts = pgTable("employer_onboarding_drafts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  data: jsonb("data").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const workArrangementEnum = pgEnum("work_arrangement", ["remote", "hybrid", "onsite"]);
export const workAuthorizationEnum = pgEnum("work_authorization", [
  "citizen",
  "permanent_resident",
  "work_pass_holder",
  "needs_sponsorship",
]);
export const noticePeriodEnum = pgEnum("notice_period", [
  "immediate",
  "one_week",
  "two_weeks",
  "one_month",
  "two_months",
  "more_than_two_months",
]);
export const languageLevelEnum = pgEnum("language_level", [
  "basic",
  "conversational",
  "fluent",
  "native",
]);
export const genderEnum = pgEnum("gender", ["male", "female", "other", "prefer_not_to_say"]);
export const maritalStatusEnum = pgEnum("marital_status", [
  "single",
  "married",
  "divorced",
  "widowed",
  "prefer_not_to_say",
]);
export const drivingLicenseEnum = pgEnum("driving_license", ["none", "b2", "b", "d", "da", "e"]);
export const jobseekerVisibilityEnum = pgEnum("jobseeker_visibility", [
  "discoverable",
  "private",
  "hidden_from_companies",
]);

export const jobseekerProfiles = pgTable("jobseeker_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id),
  avatarUrl: text("avatar_url"),
  fullName: text("full_name").notNull(),
  // Jobseekers give their age, kept as the year it implies (this year minus
  // the age) so it stays right as the years go by — see src/lib/age.ts. A
  // full date of birth is never stored. Null only for a profile from before
  // ages whose old date couldn't be read; the form asks for it again.
  birthYear: integer("birth_year"),
  gender: genderEnum("gender"),
  maritalStatus: maritalStatusEnum("marital_status"),
  nationality: text("nationality"),
  phone: text("phone"),
  drivingLicense: drivingLicenseEnum("driving_license"),
  // Same pattern as avatarUrl/logoUrl elsewhere — the file itself stored as
  // a data URL, not just a filename, so it can be shown/redownloaded later.
  // Optional: a jobseeker can finish onboarding without ever attaching one.
  resumeUrl: text("resume_url"),
  resumeFileName: text("resume_file_name"),
  resumeFileSize: integer("resume_file_size"),
  // `location` stays the display string (kept for the many existing reads of
  // it, e.g. ApplicantDetailModal), auto-derived — "City, State" in Malaysia,
  // "City, Country" elsewhere; the jobseeker never edits it directly. `state`
  // is one of MALAYSIA_STATES in Malaysia and "" for any other country.
  location: text("location").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  country: text("country").notNull().default("Malaysia"),
  // Malaysia only, from the place search (src/lib/place-search.ts): the area
  // inside the town when one was picked ("Kota Damansara"), and the map
  // coordinates when known — kept for distance features later.
  area: text("area"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  targetRole: text("target_role").notNull(),
  targetOccupationCode: text("target_occupation_code"),
  // One of INDUSTRIES (src/lib/industries.ts) — required, matching
  // employerProfiles.industryCategory, so industry-based matching isn't
  // degraded by most jobseekers skipping an optional field. Matched against
  // job_postings.industry.
  preferredIndustry: text("preferred_industry").notNull(),
  yearsExperience: integer("years_experience").notNull(),
  // DB column stays "skills" (unchanged) — only the JS-side name reflects
  // the new split from a single Skills field into two categories.
  professionalSkills: text("skills").array().notNull(),
  softSkills: text("soft_skills").array().notNull().default([]),
  // Mirrors jobPostings.niceToHaveSkills on the jobseeker side — extra skills
  // that aren't core to the target role but are still relevant, so
  // niceToHaveSkills matching isn't purely one-directional (posting-only).
  otherSkills: text("other_skills").array().notNull().default([]),
  employmentType: text("employment_type").notNull(),
  expectedSalaryMin: integer("expected_salary_min").notNull(),
  expectedSalaryMax: integer("expected_salary_max").notNull(),
  bio: text("bio"),
  linkedinUrl: text("linkedin_url"),
  portfolioUrl: text("portfolio_url"),
  githubUrl: text("github_url"),
  noticePeriod: noticePeriodEnum("notice_period").notNull(),
  workArrangement: workArrangementEnum("work_arrangement").notNull(),
  // Where they'd like to work: town + state pairs from Malaysia's town list
  // (see src/lib/work-locations.ts). Empty = not said.
  preferredWorkPlaces: jsonb("preferred_work_places").$type<WorkPlace[]>().notNull().default([]),
  workAuthorization: workAuthorizationEnum("work_authorization").notNull(),
  // Career target as MASCO occupation codes (§0.5 career switcher matching) —
  // separate from the free-text targetRole, populated once MASCO normalization exists.
  targetMascoCodes: text("target_masco_codes").array().notNull().default([]),
  // Opt-in for employers to approach this jobseeker outside of applications (R10).
  talentPoolConsent: boolean("talent_pool_consent").notNull().default(false),
  visibility: jobseekerVisibilityEnum("visibility").notNull().default("discoverable"),
  // Bell notification when a newly approved posting is a strong match for
  // this profile (see src/lib/job-alerts.ts). On by default; toggled from
  // the Saved Jobs page.
  jobAlertsEnabled: boolean("job_alerts_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const jobseekerOnboardingDrafts = pgTable("jobseeker_onboarding_drafts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  data: jsonb("data").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const jobseekerWorkExperiences = pgTable("jobseeker_work_experiences", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: uuid("profile_id")
    .notNull()
    .references(() => jobseekerProfiles.id, { onDelete: "cascade" }),
  company: text("company").notNull(),
  title: text("title").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date"),
  isCurrent: boolean("is_current").notNull().default(false),
  achievements: text("achievements"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const jobseekerEducation = pgTable("jobseeker_education", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: uuid("profile_id")
    .notNull()
    .references(() => jobseekerProfiles.id, { onDelete: "cascade" }),
  institution: text("institution").notNull(),
  fieldOfStudy: text("field_of_study"),
  qualificationTier: text("qualification_tier").notNull(),
  cgpa: text("cgpa"),
  graduationYear: integer("graduation_year"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const jobseekerCertifications = pgTable("jobseeker_certifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: uuid("profile_id")
    .notNull()
    .references(() => jobseekerProfiles.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  issuer: text("issuer"),
  year: integer("year"),
  // The certificate/license file itself (PDF or image), optional.
  fileUrl: text("file_url"),
  fileName: text("file_name"),
  fileSize: integer("file_size"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const jobseekerLanguages = pgTable("jobseeker_languages", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: uuid("profile_id")
    .notNull()
    .references(() => jobseekerProfiles.id, { onDelete: "cascade" }),
  // The language ("Chinese") and the dialects they also speak ("Mandarin",
  // "Hokkien") — see src/lib/languages.ts.
  language: text("language").notNull(),
  dialects: text("dialects").array().notNull().default([]),
  spokenLevel: languageLevelEnum("spoken_level").notNull(),
  writtenLevel: languageLevelEnum("written_level").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Phone numbers a person has proven they can receive a code on. Keyed by the
// number itself (in international form), not by a profile — so it works while
// someone is still in onboarding, and a profile's phone counts as verified
// only while it is still this exact number. Change it and the tick goes
// until it's verified again.
export const verifiedPhones = pgTable(
  "verified_phones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // +60123456789
    phone: text("phone").notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("verified_phones_user_phone_unique").on(table.userId, table.phone)],
);

// Every code sent or checked, so sending can be rate-limited per person and
// per number (a text costs money, and bots love to trigger them).
export const phoneVerificationAttempts = pgTable(
  "phone_verification_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    phone: text("phone").notNull(),
    // "send" | "call" | "check"
    action: text("action").notNull(),
    // Where the request came from, for the per-IP limit. Null for older rows.
    ip: text("ip"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("phone_verification_attempts_user_idx").on(table.userId, table.createdAt),
    index("phone_verification_attempts_phone_idx").on(table.phone, table.createdAt),
    index("phone_verification_attempts_ip_idx").on(table.ip, table.createdAt),
    // The platform-wide daily budget counts everything in the last day.
    index("phone_verification_attempts_created_idx").on(table.createdAt),
  ],
);

export const jobseekerReferences = pgTable("jobseeker_references", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: uuid("profile_id")
    .notNull()
    .references(() => jobseekerProfiles.id, { onDelete: "cascade" }),
  fullName: text("full_name").notNull(),
  jobTitle: text("job_title"),
  company: text("company"),
  phone: text("phone"),
  email: text("email"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// One row per completed AI call, across every LLM-backed feature — a simple
// usage log, not tied to any one feature's own tables, so total spend/volume
// can be tracked across the whole app from one place.
export const aiUsageFeatureEnum = pgEnum("ai_usage_feature", [
  "company_lookup",
  "job_posting_suggestion",
  "salary_suggestion",
  "resume_parse",
  "skill_suggestion",
  "match_scoring",
  "cover_letter",
  "poster_generation",
  "assistant_chat",
  "ai_interview_questions",
  "ai_interview_transcription",
  "ai_interview_scoring",
]);

// job_postings — finalized 7-state pipeline (see the design memory this was
// built from): draft -> pending (awaiting superadmin approval) -> active ->
// filled/closed, plus rejected (superadmin rejects at initial review) and
// flagged (superadmin flags an already-active posting after a jobseeker
// report) — both loop back to pending once the employer edits and resubmits.
// The superadmin review queue itself isn't built yet; rejectionReason/
// flagReason are plain text until that flow exists to populate them from a
// structured enum.
export const jobPostingStatusEnum = pgEnum("job_posting_status", [
  "draft",
  "pending",
  "active",
  "filled",
  "closed",
  "rejected",
  "flagged",
]);
export const employmentTypeEnum = pgEnum("employment_type", [
  "full_time",
  "part_time",
  "contract",
  "internship",
  "freelance",
  "temporary",
]);

export const jobPostings = pgTable(
  "job_postings",
  {
  id: uuid("id").primaryKey().defaultRandom(),
  employerProfileId: uuid("employer_profile_id")
    .notNull()
    .references(() => employerProfiles.id, { onDelete: "cascade" }),
  // Internal-only label so an employer can tell postings apart at a glance —
  // never shown to jobseekers (see NoMatchHint on the Post a Job form).
  postingName: text("posting_name"),
  // URL slug ("acme-corp-frontend-engineer") — generated once at creation
  // from company name + title and never regenerated on edit, so a shared
  // link keeps working even after the employer tweaks the title later.
  // Uniqueness is enforced with a numeric suffix (see generateUniqueJobPostingSlug).
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  responsibilities: text("responsibilities").notNull(),
  // One of INDUSTRIES (src/lib/industries.ts), same as jobseekerProfiles.preferredIndustry.
  industry: text("industry"),
  employmentType: employmentTypeEnum("employment_type").notNull().default("full_time"),
  workArrangement: workArrangementEnum("work_arrangement").notNull().default("onsite"),
  // Hybrid only: how many days a week are in the office (1–4). Null = not said.
  officeDaysPerWeek: integer("office_days_per_week"),
  // `location` stays the short "City, State" string shown on chips/cards.
  // The fields below are the full structured address (same shape as
  // employerAddresses) used for the location map — optional since older
  // postings and free-text locations never had one.
  location: text("location").notNull(),
  addressLine1: text("address_line1"),
  addressLine2: text("address_line2"),
  // Optional neighbourhood, carried over from a company address.
  area: text("area"),
  city: text("city"),
  state: text("state"),
  postcode: text("postcode"),
  salaryMin: integer("salary_min"),
  salaryMax: integer("salary_max"),
  // What the salary range above is per — "month" | "hour" | "day" |
  // "project" (SALARY_PERIODS in job-posting-options.ts).
  salaryPeriod: text("salary_period").notNull().default("month"),
  // false = the range is kept for the employer's own reference but never
  // sent to jobseekers (stripCustomQuestionAnswers nulls it out).
  showSalary: boolean("show_salary").notNull().default(true),
  openings: integer("openings").notNull().default(1),
  skills: text("skills").array().notNull().default([]),
  softSkills: text("soft_skills").array().notNull().default([]),
  // Boosts match score but doesn't hard-filter, unlike `skills` (required).
  niceToHaveSkills: text("nice_to_have_skills").array().notNull().default([]),
  minYearsExperience: integer("min_years_experience"),
  minQualificationTier: text("min_qualification_tier"),
  // Each: the language, ONE dialect or null for "any dialect", and the minimum level.
  languages: jsonb("languages")
    .$type<{ language: string; dialect?: string | null; level: "basic" | "conversational" | "fluent" | "native" }[]>()
    .notNull()
    .default([]),
  workAuthorizations: workAuthorizationEnum("work_authorizations").array().notNull().default([]),
  drivingLicense: drivingLicenseEnum("driving_license"),
  // Master switch for the fields above — when false, applying stays a
  // one-click action and a jobseeker is never asked to answer any of them,
  // regardless of what's stored in those columns (the API clears them on
  // save when this is off, but this flag is the authoritative gate).
  screeningEnabled: boolean("screening_enabled").notNull().default(false),
  // Per-requirement "ask this" toggles — stored independently of whether
  // the requirement column above actually has a value, since an employer
  // can tick "Ask this" before ever filling the field in (or leave it
  // ticked with the field still blank). Deriving this from "is the value
  // non-null" instead loses the toggle's own state the moment the field
  // is empty, which is exactly the case a plain "did I check the box" flag
  // needs to survive.
  askMinYearsExperience: boolean("ask_min_years_experience").notNull().default(true),
  askMinQualificationTier: boolean("ask_min_qualification_tier").notNull().default(true),
  askDrivingLicense: boolean("ask_driving_license").notNull().default(true),
  askLanguages: boolean("ask_languages").notNull().default(true),
  askWorkAuthorizations: boolean("ask_work_authorizations").notNull().default(true),
  // Free-form yes/no questions beyond the structured fields above (e.g.
  // "Willing to work weekends?") — kept auto-scorable like the rest of
  // screening rather than open text, so it still fits hardFilterCheck's
  // pass/fail model instead of needing manual review. Only used when
  // screeningEnabled is true, same as the fields above.
  customScreeningQuestions: jsonb("custom_screening_questions")
    .$type<CustomQuestion[]>()
    .notNull()
    .default([]),
  // Built-in requirements (see PREFERRABLE_REQUIREMENTS) the employer marked
  // "Preferred": meeting one boosts the match score, missing one never
  // makes an applicant ineligible. Custom questions carry their own flag.
  screeningPreferred: text("screening_preferred").array().notNull().default([]),
  // AI-generated skill suggestions the employer hasn't reviewed yet (the
  // dashed "+ skill" chips on the post-a-job form's Skills card) — saved
  // with the posting itself, not just in the browser, so they're still
  // there when this draft is reopened later, from any device.
  skillSuggestions: jsonb("skill_suggestions").$type<{
    professionalSkills: string[];
    softSkills: string[];
    niceToHaveSkills: string[];
  } | null>(),
  // Benefits offered for this role (pre-filled from the company's benefits).
  benefits: text("benefits").array().notNull().default([]),
  // How soon the hire needs to start — same scale as a jobseeker's notice
  // period (jobseekerProfiles.noticePeriod), plus "flexible". Null = not said.
  startAvailability: text("start_availability"),
  // Free text, e.g. "Mon–Fri, 9am–6pm" or "Rotating shifts, incl. weekends".
  workingHours: text("working_hours"),
  // The teammate shown on the posting as its contact ("Posted by …") — name,
  // position and photo only, never their email or phone. Null = none shown.
  contactUserId: uuid("contact_user_id").references(() => users.id, { onDelete: "set null" }),
  status: jobPostingStatusEnum("status").notNull().default("draft"),
  rejectionReason: text("rejection_reason"),
  flagReason: text("flag_reason"),
  flaggedAt: timestamp("flagged_at", { withTimezone: true }),
  // Total positions to fill — distinct from `openings`, which R4's
  // over-offering logic no longer treats as a live count once offers are
  // outstanding. `openings` stays for display; these three drive auto-closure.
  openingsTotal: integer("openings_total").notNull().default(1),
  offersOutstanding: integer("offers_outstanding").notNull().default(0),
  hiresConfirmed: integer("hires_confirmed").notNull().default(0),
  // How far offersOutstanding + hiresConfirmed may exceed openingsTotal (R4).
  overOfferMultiplier: integer("over_offer_multiplier").notNull().default(1),
  // Malaysia Standard Classification of Occupations code — populated once
  // MASCO normalization exists (§0.4); null until then.
  mascoCode: text("masco_code"),
  // Separate from `status` so an employer can stop taking new applications
  // while keeping the existing pipeline (interviews, offers) alive.
  acceptsNewApplications: boolean("accepts_new_applications").notNull().default(true),
  // Social-media poster (Poster Generator page), generated by Google's
  // Gemini 3 Pro Image ("Nano Banana Pro") via icreat.ai — same "stored as
  // a data URL" convention as
  // avatarUrl/logoUrl/resumeUrl above. `posterGeneratingSince` marks when the
  // async generation task was submitted (surfaced in the UI, and used as a
  // staleness cutoff if a task never resolves); `posterTaskId` is icreat's
  // task id, polled via /v1/task/result until it reports SUCCEEDED. Both are
  // null once posterUrl is set. Only one posting per employer may have these
  // set at a time — enforced in the API route, not the schema.
  posterUrl: text("poster_url"),
  posterGeneratingSince: timestamp("poster_generating_since", { withTimezone: true }),
  posterTaskId: text("poster_task_id"),
  // Style requested for the in-flight generation — carried from /poster/start
  // to /poster/status (which can't otherwise know it) so it can be recorded
  // on the job_posting_posters history row. Null once resolved.
  posterPendingStyle: text("poster_pending_style"),
  // `posterUrl` above stays as a "currently displayed" convenience mirror of
  // the latest row in job_posting_posters — every successful generation also
  // gets its own row there so past posters remain browsable/downloadable
  // instead of being overwritten.
  // When the posting auto-closes — either a deadline or when hiresConfirmed
  // reaches openingsTotal.
  expiryDate: timestamp("expiry_date", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("job_postings_employer_profile_id_idx").on(table.employerProfileId)],
);

// Which Hiring managers (team members with role hiring_manager) cover which
// job postings — they see only these postings' applicants and interviews,
// and are notified when someone applies. Keyed by the team-member row (not
// the user) so a still-pending invite can be assigned too, and removing
// someone from the team or deleting the posting clears it automatically.
export const jobPostingHiringManagers = pgTable(
  "job_posting_hiring_managers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobPostingId: uuid("job_posting_id")
      .notNull()
      .references(() => jobPostings.id, { onDelete: "cascade" }),
    teamMemberId: uuid("team_member_id")
      .notNull()
      .references(() => employerTeamMembers.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("job_posting_hiring_managers_posting_member_unique").on(table.jobPostingId, table.teamMemberId),
    index("job_posting_hiring_managers_team_member_id_idx").on(table.teamMemberId),
  ],
);

// job_posting_posters — one row per successfully generated poster image, so
// employers can browse/download previous posters instead of only ever
// seeing the latest one (which jobPostings.posterUrl still mirrors for
// backward compatibility / cheap "does this posting have a poster" checks).
export const jobPostingPosters = pgTable("job_posting_posters", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobPostingId: uuid("job_posting_id")
    .notNull()
    .references(() => jobPostings.id, { onDelete: "cascade" }),
  posterUrl: text("poster_url").notNull(),
  style: text("style").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// job_applications — one row per jobseeker applying to one posting. Kept
// deliberately smaller than the full finalized design (no separate
// job_application_events timeline yet, no rejectionReason enum) — just
// enough for a real "Apply now" button to do something and for a jobseeker
// to see their own application status.
// "kiv" ("keep in view") sits alongside interview, not after it — a holding
// state once the interview is done but the employer isn't ready to offer or
// reject yet (waiting on other candidates, budget, headcount). Not terminal:
// an application can move from kiv back into the forward pipeline later.
// "interview" means a round is scheduled and still upcoming; "interviewed"
// means that round happened — the employer moves into it automatically the
// moment they mark the candidate attended/no_show, no manual click needed.
// "evaluation" is a deliberate, explicit next step from "interviewed" (the
// employer clicks "Start evaluation") rather than another auto-advance —
// without a real status boundary here, an interviewed candidate is too easy
// to forget about. "evaluated" then follows the same auto-advance pattern
// as "interviewed": saving the interview evaluation moves it there
// automatically, so the Interviews page can tell "mid-evaluation" apart
// from "ready for an offer/reject call".
export const applicationStatusEnum = pgEnum("application_status", [
  "applied",
  "screened",
  "shortlisted",
  "interview",
  "interviewed",
  "evaluation",
  "evaluated",
  "kiv",
  "offer",
  "hired",
  "rejected",
  "withdrawn",
]);

// The jobseeker's response to a scheduled interview invite. Reset to
// "pending" every time the employer (re)schedules interviewDetails, and
// cleared back to null whenever the application leaves the interview stage.
// "attended" and "no_show" are set by the employer, not the jobseeker,
// after the interview time has passed.
export const interviewResponseStatusEnum = pgEnum("interview_response_status", [
  "pending",
  "accepted",
  "declined",
  "reschedule_requested",
  "attended",
  "no_show",
]);

export const applicationRejectionReasonEnum = pgEnum("application_rejection_reason", [
  "skills_mismatch",
  "experience_mismatch",
  "qualification_mismatch",
  "location_mismatch",
  "salary_mismatch",
  "position_filled",
  "failed_interview",
  "other",
]);

export const jobApplications = pgTable(
  "job_applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobPostingId: uuid("job_posting_id")
      .notNull()
      .references(() => jobPostings.id, { onDelete: "cascade" }),
    jobseekerProfileId: uuid("jobseeker_profile_id")
      .notNull()
      .references(() => jobseekerProfiles.id, { onDelete: "cascade" }),
    status: applicationStatusEnum("status").notNull().default("applied"),
    // Set when moving shortlisted -> interview. Deliberately one JSON blob on
    // the application itself rather than a full job_application_events
    // timeline (interview_scheduled/_rescheduled/etc, per the finalized
    // design) — this only needs to hold the *current* scheduled interview,
    // not a history of reschedules, so the smaller shape covers it for now.
    interviewDetails: jsonb("interview_details").$type<{
      round: number;
      mode: "onsite" | "online" | "phone";
      scheduledAt: string;
      durationMinutes: number | null;
      location: string | null;
      meetingLink: string | null;
      // Panel-capable: zero or more interviewer names for this round.
      interviewers: string[];
      // Account ids for the same panel, in the same order as `interviewers` —
      // who's required to submit an evaluation. Absent on interviews
      // scheduled before panel evaluations existed.
      interviewerUserIds?: string[];
      notes: string | null;
    } | null>(),
    interviewResponseStatus: interviewResponseStatusEnum("interview_response_status"),
    // The jobseeker's own confirmation that they attended, separate from the
    // employer's attended/no_show mark on interviewResponseStatus — the
    // evaluation only unlocks once both sides agree the interview happened.
    // Reset to false on every (re)schedule, same as interviewResponseStatus.
    jobseekerConfirmedAttendance: boolean("jobseeker_confirmed_attendance").notNull().default(false),
    // Incremented on every status/interviewDetails write — lets R8 detect a
    // stale read (client acted on an application state that's since changed).
    version: integer("version").notNull().default(1),
    rejectionReasonCode: applicationRejectionReasonEnum("rejection_reason_code"),
    // Snapshot of the posting's terms (salary, location, employment type) at
    // apply time, for R6 dispute resolution if the posting changes later.
    termsSnapshot: jsonb("terms_snapshot").$type<{
      title: string;
      salaryMin: number | null;
      salaryMax: number | null;
      employmentType: string;
      workArrangement: string;
      location: string;
    } | null>(),
    // The jobseeker's answers to the posting's screening requirements,
    // captured at apply time — only present when the posting had
    // screeningEnabled on. One entry per requirement the employer actually
    // set (not every possible question), mirroring jobPostings' own shape.
    screeningAnswers: jsonb("screening_answers").$type<{
      yearsExperience: number | null;
      qualificationTier: string | null;
      drivingLicense: string | null;
      languages: { language: string; dialect?: string | null; level: string }[];
      workAuthorization: string | null;
      customAnswers: CustomAnswer[];
    } | null>(),
    // Whether the answers above meet every requirement the employer set.
    // Null means screening wasn't required for this application (not "no
    // answer given") — distinct from false, which forces the match score to
    // 0 the same way the existing driving-license/work-authorization hard
    // filters already do.
    screeningEligible: boolean("screening_eligible"),
    // How many of the posting's "Preferred" requirements this applicant met,
    // out of how many were set — null when screening wasn't required. Drives
    // a small match-score boost, never eligibility.
    screeningPreferredMet: integer("screening_preferred_met"),
    screeningPreferredTotal: integer("screening_preferred_total"),
    appliedAt: timestamp("applied_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    // Set once, the moment status actually transitions to "hired" — kept
    // separate from updatedAt (which changes for other reasons too) so
    // time-to-hire reporting has a real, stable timestamp to compute from.
    hiredAt: timestamp("hired_at", { withTimezone: true }),
  },
  (table) => [
    unique("job_applications_posting_jobseeker_unique").on(table.jobPostingId, table.jobseekerProfileId),
    index("job_applications_jobseeker_profile_id_idx").on(table.jobseekerProfileId),
  ],
);

export const interviewRecommendationEnum = pgEnum("interview_recommendation", [
  "strong_hire",
  "hire",
  "no_hire",
  "strong_no_hire",
]);

// A jobseeker's optional 60-second video pitch — one per profile; recording
// a new one replaces it. The file lives under storage/video-pitches/ (not
// public/), served only to the jobseeker and to employers they've applied
// to. `intro` and `strengths` are the jobseeker's own skimmable summary
// (strengths picked from their profile skills) — no AI involved.
export const videoPitches = pgTable("video_pitches", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobseekerProfileId: uuid("jobseeker_profile_id")
    .notNull()
    .unique()
    .references(() => jobseekerProfiles.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  durationSeconds: integer("duration_seconds").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  intro: text("intro"),
  strengths: text("strengths").array().notNull().default([]),
  // Off = hidden from employers (the intro/strengths too) without deleting it.
  visible: boolean("visible").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Which employer companies have watched a pitch — one row per company (the
// first watch), powering the jobseeker's "Watched by N employers", their
// "an employer watched your pitch" notification, and the employer-side
// "Watched" mark. Cleared when the jobseeker replaces their video.
export const videoPitchViews = pgTable(
  "video_pitch_views",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    videoPitchId: uuid("video_pitch_id")
      .notNull()
      .references(() => videoPitches.id, { onDelete: "cascade" }),
    employerProfileId: uuid("employer_profile_id")
      .notNull()
      .references(() => employerProfiles.id, { onDelete: "cascade" }),
    viewerUserId: uuid("viewer_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("video_pitch_views_pitch_employer_unique").on(table.videoPitchId, table.employerProfileId)],
);

// A jobseeker's bookmarked postings (the heart button). Kept even after a
// posting closes, so the Saved Jobs page can say "no longer accepting
// applications" instead of the job silently vanishing.
export const savedJobs = pgTable(
  "saved_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobseekerProfileId: uuid("jobseeker_profile_id")
      .notNull()
      .references(() => jobseekerProfiles.id, { onDelete: "cascade" }),
    jobPostingId: uuid("job_posting_id")
      .notNull()
      .references(() => jobPostings.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("saved_jobs_profile_posting_unique").on(table.jobseekerProfileId, table.jobPostingId)],
);

// In-app notifications (the navbar bell). One row per recipient. `audience`
// is which side of the app it belongs to — the same account can be both an
// employer and a jobseeker, and the bell only shows the side they're
// currently signed in as. `link` is where clicking it takes them.
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    audience: roleEnum("audience").notNull(),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    link: text("link"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("notifications_user_audience_created_idx").on(table.userId, table.audience, table.createdAt)],
);

// Append-only log of every pipeline move, so a jobseeker can see *when*
// each step happened (the application row itself only holds the current
// status) and an employer's typical reply time can be measured — the first
// event leaving "applied" is the employer's first response. `fromStatus` is
// null only for the initial "applied" event.
export const jobApplicationEvents = pgTable(
  "job_application_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobApplicationId: uuid("job_application_id")
      .notNull()
      .references(() => jobApplications.id, { onDelete: "cascade" }),
    fromStatus: applicationStatusEnum("from_status"),
    toStatus: applicationStatusEnum("to_status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("job_application_events_job_application_id_idx").on(table.jobApplicationId)],
);

// One scorecard per interviewer per application (not per round) — each
// panelist submits their own, and a later round overwrites that same
// interviewer's previous one rather than keeping a history, same "current
// state only" tradeoff interviewDetails already makes. `evaluatorUserId` is
// null only for scorecards saved before per-interviewer evaluations existed.
export const interviewEvaluations = pgTable(
  "interview_evaluations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobApplicationId: uuid("job_application_id")
      .notNull()
      .references(() => jobApplications.id, { onDelete: "cascade" }),
    evaluatorUserId: uuid("evaluator_user_id").references(() => users.id, { onDelete: "set null" }),
    round: integer("round").notNull(),
    scores: jsonb("scores").$type<Record<string, number>>().notNull(),
    recommendation: interviewRecommendationEnum("recommendation").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("interview_evaluations_application_evaluator_unique").on(table.jobApplicationId, table.evaluatorUserId),
    index("interview_evaluations_job_application_id_idx").on(table.jobApplicationId),
  ],
);

export const offerStatusEnum = pgEnum("offer_status", [
  "pending",
  "accepted",
  "declined",
  "expired",
  "expired_grace",
  "withdrawn",
]);

// offers — first-class entity so an offer can be versioned/expired/counter-
// offered independently of the application's own status field (§8).
export const offers = pgTable("offers", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobApplicationId: uuid("job_application_id")
    .notNull()
    .references(() => jobApplications.id, { onDelete: "cascade" }),
  // Increments on every counter-offer (R3); previous versions are kept as
  // separate rows sharing this jobApplicationId rather than overwritten.
  version: integer("version").notNull().default(1),
  status: offerStatusEnum("status").notNull().default("pending"),
  terms: jsonb("terms").$type<{
    salary: number;
    startDate: string | null;
    employmentType: string;
    benefits: string | null;
    notes: string | null;
  }>().notNull(),
  expiryDate: timestamp("expiry_date", { withTimezone: true }).notNull(),
  // 24-hour grace window after expiryDate where a late acceptance is still
  // honored (R4) before the offer moves to `expired` for good.
  graceWindowEnd: timestamp("grace_window_end", { withTimezone: true }),
  respondedAt: timestamp("responded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// interview_slots — a single bookable slot an employer can propose to
// multiple candidates at once, batching scheduling instead of one-off
// per-candidate invites (R3, §7).
export const interviewSlots = pgTable("interview_slots", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobPostingId: uuid("job_posting_id")
    .notNull()
    .references(() => jobPostings.id, { onDelete: "cascade" }),
  roundName: text("round_name").notNull(),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  durationMinutes: integer("duration_minutes"),
  capacity: integer("capacity").notNull().default(1),
  acceptedCount: integer("accepted_count").notNull().default(0),
  // Candidates this slot was offered to (application ids) — may exceed
  // capacity; acceptedCount tracks how many actually confirmed.
  proposedTo: uuid("proposed_to").array().notNull().default([]),
  responseDeadline: timestamp("response_deadline", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// talent_pool_entries — tracks a jobseeker's consent for a specific employer
// to approach them outside of a normal application (R10). Consent expires
// after 1 year with no hire, enforced by expiryDate.
export const talentPoolEntries = pgTable(
  "talent_pool_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employerProfileId: uuid("employer_profile_id")
      .notNull()
      .references(() => employerProfiles.id, { onDelete: "cascade" }),
    jobseekerProfileId: uuid("jobseeker_profile_id")
      .notNull()
      .references(() => jobseekerProfiles.id, { onDelete: "cascade" }),
    consentDate: timestamp("consent_date", { withTimezone: true }).notNull().defaultNow(),
    expiryDate: timestamp("expiry_date", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("talent_pool_entries_employer_jobseeker_unique").on(
      table.employerProfileId,
      table.jobseekerProfileId,
    ),
  ],
);

// skill_aliases — local curated layer mapping BM/Manglish terms to ESCO
// skill URIs (§0.4, R1), since ESCO itself only ships English/Malay official
// terms, not colloquial ones employers/jobseekers actually type.
export const skillAliases = pgTable("skill_aliases", {
  id: uuid("id").primaryKey().defaultRandom(),
  localTerm: text("local_term").notNull(),
  escoUri: text("esco_uri").notNull(),
  language: text("language").notNull(),
  usageCount: integer("usage_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// job_posting_views — tracks unique viewers, not raw page-load count (a
// jobseeker revisiting the same posting shouldn't inflate it). Only records
// a view for a signed-in jobseeker who has opened the posting's detail
// panel; anonymous browsing isn't tracked since there's no jobseeker_profile
// to key it on.
export const jobPostingViews = pgTable(
  "job_posting_views",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobPostingId: uuid("job_posting_id")
      .notNull()
      .references(() => jobPostings.id, { onDelete: "cascade" }),
    jobseekerProfileId: uuid("jobseeker_profile_id")
      .notNull()
      .references(() => jobseekerProfiles.id, { onDelete: "cascade" }),
    viewedAt: timestamp("viewed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("job_posting_views_posting_jobseeker_unique").on(table.jobPostingId, table.jobseekerProfileId)],
);

// A jobseeker's report on a live posting — the input side of the "flagged"
// lifecycle already modeled on job_postings (status/flagReason/flaggedAt):
// a report doesn't flag the posting by itself, it just surfaces in the
// superadmin Reports queue for a human to review and decide whether to flag.
// One report per jobseeker per posting — re-reporting updates the existing
// row (see the report API route's onConflictDoUpdate) rather than piling up
// duplicates from the same person.
export const jobPostingReportReasonEnum = pgEnum("job_posting_report_reason", [
  "spam",
  "scam",
  "discriminatory",
  "misleading",
  "inappropriate",
  "other",
]);

export const jobPostingReports = pgTable(
  "job_posting_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobPostingId: uuid("job_posting_id")
      .notNull()
      .references(() => jobPostings.id, { onDelete: "cascade" }),
    jobseekerProfileId: uuid("jobseeker_profile_id")
      .notNull()
      .references(() => jobseekerProfiles.id, { onDelete: "cascade" }),
    reason: jobPostingReportReasonEnum("reason").notNull(),
    details: text("details"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("job_posting_reports_posting_jobseeker_unique").on(table.jobPostingId, table.jobseekerProfileId),
  ],
);

export const aiUsageLogs = pgTable("ai_usage_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  feature: aiUsageFeatureEnum("feature").notNull(),
  // Which upstream LLM actually answered ("deepseek" | "mimo" | "none" for a
  // no-op lookup) — null where a route doesn't currently know/propagate it.
  provider: text("provider"),
  // The specific model string sent in the request (e.g. "deepseek-chat",
  // "mimo-v2.5", "mimo-v2.5-asr") — a provider can serve more than one
  // model/price point, so this is tracked separately from `provider`.
  model: text("model"),
  promptTokens: integer("prompt_tokens"),
  completionTokens: integer("completion_tokens"),
  totalTokens: integer("total_tokens"),
  // Perplexity's Search API isn't a chat completion — it has no token usage
  // to report, only a number of search calls made. Null for every other
  // provider, which reports tokens instead.
  callCount: integer("call_count"),
  durationMs: integer("duration_ms"),
  // Real per-call cost reported by the provider itself (e.g. icreat's
  // `costUSD` on a finished image generation task) — takes priority over the
  // published-list-pricing token-based estimate every other provider relies
  // on, when present.
  actualCostUsd: doublePrecision("actual_cost_usd"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// cover_letters — a jobseeker's own standalone tool, not tied to any
// job_posting/job_application row: they paste in a job title/description and
// company name for ANY role (on or off this platform) and get a generated
// letter back, editable afterward. Deliberately has no jobPostingId/
// jobApplicationId — unlike interview_evaluations' "one row per application"
// shape, this is "many rows per jobseeker", one per letter they've generated.
export const coverLetters = pgTable("cover_letters", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobseekerProfileId: uuid("jobseeker_profile_id")
    .notNull()
    .references(() => jobseekerProfiles.id, { onDelete: "cascade" }),
  companyName: text("company_name").notNull(),
  jobTitle: text("job_title").notNull(),
  jobPostingText: text("job_posting_text").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// JobGiga Assistant chat history — one row per conversation, scoped to the
// role (and, for employers, the company) it was held under, since the
// assistant's answers depend on that context. Signed-out visitors' chats
// are never stored.
export const assistantConversations = pgTable(
  "assistant_conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull(),
    employerProfileId: uuid("employer_profile_id").references(() => employerProfiles.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("assistant_conversations_user_updated_idx").on(table.userId, table.updatedAt)],
);

export const assistantMessageRoleEnum = pgEnum("assistant_message_role", ["user", "assistant"]);

export const assistantMessages = pgTable(
  "assistant_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => assistantConversations.id, { onDelete: "cascade" }),
    role: assistantMessageRoleEnum("role").notNull(),
    content: text("content").notNull(),
    action: jsonb("action").$type<AssistantAction | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("assistant_messages_conversation_created_idx").on(table.conversationId, table.createdAt)],
);

// A company's landing-page advertisement booking. The employer landing page
// has 10 ad slots (src/lib/company-ads.ts); each booking runs 30 days from
// its start date, booked up to 3 months ahead, and only shows once a
// superadmin approves it. A company may hold 2 active bookings at once (one
// running, one booked next), never overlapping. "pending" holds its slot
// while awaiting review; "rejected" (or taken down) frees it. Live/scheduled/
// ended are derived from the dates, not stored.
export const companyAdStatusEnum = pgEnum("company_ad_status", ["pending", "approved", "rejected"]);
export const companyAdMediaTypeEnum = pgEnum("company_ad_media_type", ["image", "video"]);

export const companyAds = pgTable(
  "company_ads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employerProfileId: uuid("employer_profile_id")
      .notNull()
      .references(() => employerProfiles.id, { onDelete: "cascade" }),
    mediaType: companyAdMediaTypeEnum("media_type").notNull(),
    // File name in private storage (storage/company-ads) — served through
    // /api/company-ads/[id]/media, which only shows unapproved ads to the
    // company's own team and superadmins.
    fileName: text("file_name").notNull(),
    headline: text("headline").notNull(),
    status: companyAdStatusEnum("status").notNull().default("pending"),
    rejectionReason: text("rejection_reason"),
    // Malaysia calendar days: shows from startDate, gone on endDate (exclusive).
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }).notNull(),
    // Each notification is claimed once (set when sent), so it never repeats.
    liveNotifiedAt: timestamp("live_notified_at", { withTimezone: true }),
    endingNotifiedAt: timestamp("ending_notified_at", { withTimezone: true }),
    endedNotifiedAt: timestamp("ended_notified_at", { withTimezone: true }),
    submittedByUserId: uuid("submitted_by_user_id").references(() => users.id, { onDelete: "set null" }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("company_ads_employer_profile_id_idx").on(table.employerProfileId),
    index("company_ads_dates_idx").on(table.startDate, table.endDate),
  ],
);

// A job posting advertisement: the employer's own square artwork (image or
// short video) attached to one of their live job postings, featured above
// the jobseeker page's job search. Same booking rules as company_ads (its
// own 10 slots, 30-day runs, 2 active bookings per company, superadmin
// review) — see src/lib/job-ads.ts. Only shows while its posting is active.
export const jobAds = pgTable(
  "job_ads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employerProfileId: uuid("employer_profile_id")
      .notNull()
      .references(() => employerProfiles.id, { onDelete: "cascade" }),
    jobPostingId: uuid("job_posting_id")
      .notNull()
      .references(() => jobPostings.id, { onDelete: "cascade" }),
    mediaType: companyAdMediaTypeEnum("media_type").notNull(),
    // File name in private storage (storage/job-ads) — served through
    // /api/job-ads/[id]/media, public only once approved.
    fileName: text("file_name").notNull(),
    status: companyAdStatusEnum("status").notNull().default("pending"),
    rejectionReason: text("rejection_reason"),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }).notNull(),
    liveNotifiedAt: timestamp("live_notified_at", { withTimezone: true }),
    endingNotifiedAt: timestamp("ending_notified_at", { withTimezone: true }),
    endedNotifiedAt: timestamp("ended_notified_at", { withTimezone: true }),
    submittedByUserId: uuid("submitted_by_user_id").references(() => users.id, { onDelete: "set null" }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("job_ads_employer_profile_id_idx").on(table.employerProfileId),
    index("job_ads_job_posting_id_idx").on(table.jobPostingId),
    index("job_ads_dates_idx").on(table.startDate, table.endDate),
  ],
);

// AI interview — a pre-interview screen an employer sends to a shortlisted
// applicant: 5 job-knowledge questions answered by short recordings, then
// transcribed and scored by AI against the key points the employer approved.
// Its own feature, separate from the video pitch. One per application; a
// resend or extension reuses the same row.
export const aiInterviewStatusEnum = pgEnum("ai_interview_status", [
  "invited",
  "in_progress",
  "processing",
  "completed",
  "failed",
  "expired",
  "cancelled",
]);

export const aiInterviews = pgTable(
  "ai_interviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobApplicationId: uuid("job_application_id")
      .notNull()
      .unique()
      .references(() => jobApplications.id, { onDelete: "cascade" }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    status: aiInterviewStatusEnum("status").notNull().default("invited"),
    // Per-answer time limit, chosen by the employer when sending.
    answerSeconds: integer("answer_seconds").notNull().default(30),
    deadlineAt: timestamp("deadline_at", { withTimezone: true }).notNull(),
    inviteSentAt: timestamp("invite_sent_at", { withTimezone: true }).notNull().defaultNow(),
    // When the applicant ticked the consent box (recording + AI processing).
    consentAt: timestamp("consent_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    // The overall AiInterviewReport — advice for the employer, never a decision.
    report: jsonb("report").$type<AiInterviewReport | null>(),
    failureReason: text("failure_reason"),
    // Recordings are deleted after this; transcripts, scores and the report stay.
    recordingsExpireAt: timestamp("recordings_expire_at", { withTimezone: true }),
    recordingsDeletedAt: timestamp("recordings_deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("ai_interviews_status_idx").on(table.status)],
);

// One row per question, carrying its answer too (an answer never exists
// without its question).
export const aiInterviewQuestions = pgTable(
  "ai_interview_questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    aiInterviewId: uuid("ai_interview_id")
      .notNull()
      .references(() => aiInterviews.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    question: text("question").notNull(),
    // What a good answer covers — approved by the employer, used to score.
    keyPoints: text("key_points").array().notNull().default([]),
    // The answer: a file in storage/ai-interviews/<interview id>/.
    mediaFileName: text("media_file_name"),
    mediaKind: text("media_kind"),
    durationSeconds: integer("duration_seconds"),
    // Takes used so far (a first take plus re-records).
    attempts: integer("attempts").notNull().default(0),
    answeredAt: timestamp("answered_at", { withTimezone: true }),
    transcript: text("transcript"),
    score: integer("score"),
    evaluation: jsonb("evaluation").$type<AiInterviewAnswerEvaluation | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("ai_interview_questions_position_unique").on(table.aiInterviewId, table.position),
    index("ai_interview_questions_interview_idx").on(table.aiInterviewId),
  ],
);

// Site-wide settings the superadmin changes from their dashboard, one row
// per key — e.g. "welcome_image.employer" → { url } for the landing pages'
// welcome popup. A missing row means "use the built-in default".
export const siteSettings = pgTable("site_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedByUserId: uuid("updated_by_user_id").references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// A superadmin-made look for one side of the site (employer or jobseeker):
// colours, an optional banner and an optional effect — see
// src/lib/site-themes.ts. At most one live theme per side; with none live,
// that side shows the default design.
export const siteThemeAudienceEnum = pgEnum("site_theme_audience", ["employer", "jobseeker"]);

export const siteThemes = pgTable(
  "site_themes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    audience: siteThemeAudienceEnum("audience").notNull(),
    name: text("name").notNull(),
    // The ready-made theme it started from, if any (for "reset colours").
    presetKey: text("preset_key"),
    colors: jsonb("colors").$type<ThemeColors>().notNull(),
    banner: jsonb("banner").$type<ThemeBanner>().notNull(),
    effect: text("effect").$type<ThemeEffect>().notNull().default("none"),
    effectScope: text("effect_scope").$type<ThemeEffectScope>().notNull().default("landing"),
    isActive: boolean("is_active").notNull().default(false),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("site_themes_one_active_per_audience")
      .on(table.audience)
      .where(sql`${table.isActive}`),
  ],
);

// Superadmin-run reward campaigns — see src/lib/campaigns.ts. A campaign is
// started by one action (its trigger; for now only "phone_verified") and
// offers each side (employer / jobseeker) its own reward: a voucher code
// from an uploaded stock, or an entry into a lucky draw. "draft" has never
// gone live; "paused" can go live again; "ended" is final.
export const campaignStatusEnum = pgEnum("campaign_status", ["draft", "live", "paused", "ended"]);
export const campaignRewardTypeEnum = pgEnum("campaign_reward_type", ["voucher", "draw"]);
// Voucher: pending (waiting for a superadmin, code set aside) → approved
// (code shown) or rejected (code back in stock). Draw: entered → selected
// (picked, waiting for a superadmin) → won, or rejected; everyone left over
// becomes not_selected when the results are announced.
export const campaignClaimStatusEnum = pgEnum("campaign_claim_status", [
  "pending",
  "approved",
  "rejected",
  "entered",
  "selected",
  "won",
  "not_selected",
]);

export const campaigns = pgTable("campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  trigger: text("trigger").notNull().default("phone_verified"),
  status: campaignStatusEnum("status").notNull().default("draft"),
  // Every reward waits for a superadmin before it's given (or a winner announced).
  needsApproval: boolean("needs_approval").notNull().default(true),
  // Optional window, set as whole days in Malaysia time (see campaigns-shared.ts).
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  terms: text("terms").notNull().default(""),
  createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// One per side of a campaign.
export const campaignRewards = pgTable(
  "campaign_rewards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    audience: roleEnum("audience").notNull(),
    enabled: boolean("enabled").notNull().default(false),
    type: campaignRewardTypeEnum("type").notNull().default("voucher"),
    // What they get / the prize, e.g. "RM5 Touch 'n Go eWallet voucher".
    title: text("title").notNull().default(""),
    // How to use the voucher, or more about the prize.
    details: text("details").notNull().default(""),
    // What one voucher costs, for the budget figure. Optional.
    valueRm: doublePrecision("value_rm"),
    winnerCount: integer("winner_count").notNull().default(1),
    drawnAt: timestamp("drawn_at", { withTimezone: true }),
    announcedAt: timestamp("announced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("campaign_rewards_campaign_audience_unique").on(table.campaignId, table.audience)],
);

// The uploaded stock of codes for a voucher reward. `claimId` is set while a
// claim holds the code (pending or approved) and cleared if it's rejected.
export const campaignVoucherCodes = pgTable(
  "campaign_voucher_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    rewardId: uuid("reward_id")
      .notNull()
      .references(() => campaignRewards.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    // The partner's own expiry (last valid day). Expired codes aren't handed out.
    expiresOn: date("expires_on"),
    claimId: uuid("claim_id").unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("campaign_voucher_codes_reward_code_unique").on(table.rewardId, table.code),
    index("campaign_voucher_codes_reward_claim_idx").on(table.rewardId, table.claimId),
  ],
);

// Who got (or is waiting for) a reward. One per person and one per phone
// number per campaign. Kept when the account is deleted (userId goes null,
// the phone and the name/email snapshot stay), so signing up again with the
// same number doesn't earn a second reward.
export const campaignClaims = pgTable(
  "campaign_claims",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    rewardId: uuid("reward_id")
      .notNull()
      .references(() => campaignRewards.id, { onDelete: "cascade" }),
    audience: roleEnum("audience").notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    // +60123456789
    phone: text("phone").notNull(),
    userEmail: text("user_email").notNull(),
    userName: text("user_name"),
    status: campaignClaimStatusEnum("status").notNull(),
    codeId: uuid("code_id").references(() => campaignVoucherCodes.id, { onDelete: "set null" }),
    rejectReason: text("reject_reason"),
    reviewedByEmail: text("reviewed_by_email"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    // When the person closed the "You've earned a reward" popup.
    seenAt: timestamp("seen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("campaign_claims_campaign_user_unique").on(table.campaignId, table.userId),
    unique("campaign_claims_campaign_phone_unique").on(table.campaignId, table.phone),
    index("campaign_claims_reward_status_idx").on(table.rewardId, table.status),
    index("campaign_claims_user_idx").on(table.userId, table.audience),
  ],
);
