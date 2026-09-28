// Badge metadata (icons/labels/descriptions) — kept separate from
// src/lib/badges.ts (which is "server-only", touching the database) so the
// display component can import just this and stay safe to render from a
// Client Component's own module graph without pulling server-only code in.
import {
  BoltIcon,
  BriefcaseIcon,
  BuildingIcon,
  CheckCircleIcon,
  ImageIcon,
  StarIcon,
  UserCheckIcon,
  UsersIcon,
} from "@/components/icons";
import { employerBadgeKeyEnum } from "./db/schema";

export type BadgeKey = (typeof employerBadgeKeyEnum.enumValues)[number];

export type BadgeDefinition = {
  key: BadgeKey;
  label: string;
  short: string;
  description: string;
  icon: typeof BuildingIcon;
  colorFrom: string;
  colorTo: string;
  ribbon: string;
};

// Single source of truth for both award logic (badges.ts) and the display
// card (CompanyBadgesCard.tsx) — order here is display order. colorFrom/
// colorTo/ribbon feed the glossy medal gradient in BadgeMedal.tsx, one
// distinct hue per badge (not a bronze/silver/gold ranking).
export const BADGE_DEFINITIONS: readonly BadgeDefinition[] = [
  { key: "profile_completed", label: "Company profile completed", short: "Profile", description: "Finished every required company profile field.", icon: BuildingIcon, colorFrom: "#5EEAD4", colorTo: "#0D9488", ribbon: "#0F766E" },
  { key: "logo_added", label: "Logo added", short: "Logo", description: "Uploaded a company logo.", icon: ImageIcon, colorFrom: "#86EFAC", colorTo: "#16A34A", ribbon: "#15803D" },
  { key: "profile_boosted", label: "Fully boosted profile", short: "Boosted", description: "Filled in every optional field that helps you stand out.", icon: StarIcon, colorFrom: "#D8B4FE", colorTo: "#9333EA", ribbon: "#7E22CE" },
  { key: "first_job_posted", label: "First job posted", short: "Job", description: "Posted your first job.", icon: BriefcaseIcon, colorFrom: "#FDBA74", colorTo: "#EA580C", ribbon: "#C2410C" },
  { key: "screening_enabled", label: "Screener setup", short: "Screener", description: "Turned on screening requirements for a posting.", icon: BoltIcon, colorFrom: "#FDE68A", colorTo: "#D97706", ribbon: "#B45309" },
  { key: "first_candidate_screened", label: "First candidate screened", short: "Screened", description: "Moved an applicant past Applied.", icon: CheckCircleIcon, colorFrom: "#93C5FD", colorTo: "#2563EB", ribbon: "#1D4ED8" },
  { key: "first_hire", label: "First hire", short: "Hired", description: "Hired your first candidate.", icon: UserCheckIcon, colorFrom: "#FDA4AF", colorTo: "#E11D48", ribbon: "#BE123C" },
  { key: "team_builder", label: "Team builder", short: "Team", description: "Invited a teammate.", icon: UsersIcon, colorFrom: "#A5B4FC", colorTo: "#4F46E5", ribbon: "#4338CA" },
];
