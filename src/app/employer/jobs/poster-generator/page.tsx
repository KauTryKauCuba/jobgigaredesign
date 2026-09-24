import { redirect } from "next/navigation";
import PosterGeneratorView, { type PosterPosting } from "@/components/PosterGeneratorView";
import { getAuthUser } from "@/lib/auth-user";
import { getEmployerProfileForUser } from "@/lib/employer-profile";
import { getJobPostingsForEmployer } from "@/lib/job-postings";
import { getOnboardingRedirect } from "@/lib/onboarding";
import { getSession } from "@/lib/session";

const EMPLOYMENT_TYPE_LABEL: Record<string, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  internship: "Internship",
};
const WORK_ARRANGEMENT_LABEL: Record<string, string> = {
  onsite: "Onsite",
  hybrid: "Hybrid",
  remote: "Remote",
};

export default async function PosterGeneratorPage() {
  const session = await getSession();
  if (!session || session.role !== "employer") redirect("/employer");

  const onboardingRedirect = await getOnboardingRedirect();
  if (onboardingRedirect) redirect(onboardingRedirect);

  const authUser = await getAuthUser();
  if (!authUser) redirect("/employer");

  const profile = await getEmployerProfileForUser(session.userId);
  const postings = profile ? await getJobPostingsForEmployer(profile.id) : [];

  const activePostings: PosterPosting[] = postings
    .filter((p) => p.status === "active")
    .map((p) => ({
      id: p.id,
      title: p.title,
      location: p.location || "Not set",
      employmentType: EMPLOYMENT_TYPE_LABEL[p.employmentType] ?? p.employmentType,
      workArrangement: WORK_ARRANGEMENT_LABEL[p.workArrangement] ?? p.workArrangement,
      salaryMin: p.salaryMin ?? 0,
      salaryMax: p.salaryMax ?? 0,
      minYearsExperience: p.minYearsExperience ?? 0,
      openings: p.openings,
      posterUrl: p.posterUrl,
      posterGeneratingSince: p.posterGeneratingSince ? p.posterGeneratingSince.toISOString() : null,
    }));

  return <PosterGeneratorView authUser={authUser} postings={activePostings} />;
}
