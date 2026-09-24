import { pgTable, text, timestamp, uuid, integer, boolean, pgEnum, jsonb, unique } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["employer", "jobseeker"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  googleId: text("google_id").unique(),
  role: roleEnum("role").notNull(),
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

export const employerProfiles = pgTable("employer_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id),
  avatarUrl: text("avatar_url"),
  contactName: text("contact_name").notNull(),
  contactRole: text("contact_role").notNull(),
  contactPhone: text("contact_phone").notNull(),
  contactEmail: text("contact_email").notNull(),
  companyName: text("company_name").notNull(),
  ssmNumber: text("ssm_number").notNull(),
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
  recentNews: jsonb("recent_news")
    .$type<{ title: string; url: string }[]>()
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
});

// An employer can have more than one office/branch — the "Company Profile"
// page shows them as a list, and a job posting picks one of these as its
// location instead of retyping an address. `label` (e.g. "Headquarters",
// "Penang branch") is free text so employers can tell rows apart at a
// glance, since street addresses alone often look interchangeable.
export const employerAddresses = pgTable("employer_addresses", {
  id: uuid("id").primaryKey().defaultRandom(),
  employerProfileId: uuid("employer_profile_id")
    .notNull()
    .references(() => employerProfiles.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  addressLine1: text("address_line1").notNull(),
  addressLine2: text("address_line2"),
  city: text("city").notNull(),
  state: text("state").notNull(),
  postcode: text("postcode").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const teamMemberRoleEnum = pgEnum("team_member_role", ["owner", "admin"]);
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
    status: teamMemberStatusEnum("status").notNull().default("pending"),
    invitedAt: timestamp("invited_at", { withTimezone: true }).notNull().defaultNow(),
    joinedAt: timestamp("joined_at", { withTimezone: true }),
  },
  (table) => [unique().on(table.employerProfileId, table.email)],
);

export const teamActivityActionEnum = pgEnum("team_activity_action", [
  "invited",
  "resent_invite",
  "role_changed",
  "removed",
]);

// One row per team-management action, newest first on the Team page's
// activity list. `actorUserId` is nullable (not `.references()`-cascaded on
// delete) so a log entry survives the actor's own account being removed —
// `actorLabel` is a snapshot of their name/email at the time, so the line
// still reads correctly even if the actor is gone or later renames
// themselves. `targetEmail` is likewise a snapshot, since the affected
// member row can itself be deleted (on removal) or change email.
export const employerTeamActivity = pgTable("employer_team_activity", {
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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

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
  dateOfBirth: text("date_of_birth"),
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
  location: text("location").notNull(),
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
  employmentType: text("employment_type").notNull(),
  expectedSalaryMin: integer("expected_salary_min").notNull(),
  expectedSalaryMax: integer("expected_salary_max").notNull(),
  bio: text("bio"),
  linkedinUrl: text("linkedin_url"),
  portfolioUrl: text("portfolio_url"),
  githubUrl: text("github_url"),
  noticePeriod: noticePeriodEnum("notice_period").notNull(),
  workArrangement: workArrangementEnum("work_arrangement").notNull(),
  workAuthorization: workAuthorizationEnum("work_authorization").notNull(),
  // Career target as MASCO occupation codes (§0.5 career switcher matching) —
  // separate from the free-text targetRole, populated once MASCO normalization exists.
  targetMascoCodes: text("target_masco_codes").array().notNull().default([]),
  // Opt-in for employers to approach this jobseeker outside of applications (R10).
  talentPoolConsent: boolean("talent_pool_consent").notNull().default(false),
  visibility: jobseekerVisibilityEnum("visibility").notNull().default("discoverable"),
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
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const jobseekerLanguages = pgTable("jobseeker_languages", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: uuid("profile_id")
    .notNull()
    .references(() => jobseekerProfiles.id, { onDelete: "cascade" }),
  language: text("language").notNull(),
  spokenLevel: languageLevelEnum("spoken_level").notNull(),
  writtenLevel: languageLevelEnum("written_level").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

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
  "resume_parse",
  "skill_suggestion",
  "match_scoring",
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
]);

export const jobPostings = pgTable("job_postings", {
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
  // `location` stays the short "City, State" string shown on chips/cards.
  // The fields below are the full structured address (same shape as
  // employerAddresses) used for the location map — optional since older
  // postings and free-text locations never had one.
  location: text("location").notNull(),
  addressLine1: text("address_line1"),
  addressLine2: text("address_line2"),
  city: text("city"),
  state: text("state"),
  postcode: text("postcode"),
  salaryMin: integer("salary_min"),
  salaryMax: integer("salary_max"),
  openings: integer("openings").notNull().default(1),
  skills: text("skills").array().notNull().default([]),
  softSkills: text("soft_skills").array().notNull().default([]),
  // Boosts match score but doesn't hard-filter, unlike `skills` (required).
  niceToHaveSkills: text("nice_to_have_skills").array().notNull().default([]),
  minYearsExperience: integer("min_years_experience"),
  minQualificationTier: text("min_qualification_tier"),
  languages: jsonb("languages")
    .$type<{ language: string; level: "basic" | "conversational" | "fluent" | "native" }[]>()
    .notNull()
    .default([]),
  workAuthorizations: workAuthorizationEnum("work_authorizations").array().notNull().default([]),
  drivingLicense: drivingLicenseEnum("driving_license"),
  benefits: text("benefits"),
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
  // When the posting auto-closes — either a deadline or when hiresConfirmed
  // reaches openingsTotal.
  expiryDate: timestamp("expiry_date", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
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
      interviewerName: string | null;
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
    appliedAt: timestamp("applied_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    // Set once, the moment status actually transitions to "hired" — kept
    // separate from updatedAt (which changes for other reasons too) so
    // time-to-hire reporting has a real, stable timestamp to compute from.
    hiredAt: timestamp("hired_at", { withTimezone: true }),
  },
  (table) => [unique("job_applications_posting_jobseeker_unique").on(table.jobPostingId, table.jobseekerProfileId)],
);

export const interviewRecommendationEnum = pgEnum("interview_recommendation", [
  "strong_hire",
  "hire",
  "no_hire",
  "strong_no_hire",
]);

// One scorecard per application (not per round) — a later round overwrites
// the previous one's evaluation rather than keeping a history, same
// "current state only" tradeoff interviewDetails already makes.
export const interviewEvaluations = pgTable("interview_evaluations", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobApplicationId: uuid("job_application_id")
    .notNull()
    .unique()
    .references(() => jobApplications.id, { onDelete: "cascade" }),
  round: integer("round").notNull(),
  scores: jsonb("scores").$type<Record<string, number>>().notNull(),
  recommendation: interviewRecommendationEnum("recommendation").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
