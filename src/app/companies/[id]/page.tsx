import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AnimatedRibbon from "@/components/AnimatedRibbon";
import BadgeMedal from "@/components/BadgeMedal";
import CompanyBanner from "@/components/CompanyBanner";
import { CompanyLogo } from "@/components/CompanyDirectoryView";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import ResponsivenessBadge from "@/components/ResponsivenessBadge";
import RichTextContent from "@/components/RichTextContent";
import { gradientFrameClass } from "@/components/formStyles";
import { getAuthUser } from "@/lib/auth-user";
import { BADGE_DEFINITIONS } from "@/lib/badge-definitions";
import { getPublicCompany } from "@/lib/company-directory";
import { sanitizeDescriptionHtml } from "@/lib/sanitizeHtml";

const EMPLOYMENT_TYPE_LABEL: Record<string, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  internship: "Internship",
};
const WORK_ARRANGEMENT_LABEL: Record<string, string> = { remote: "Remote", hybrid: "Hybrid", onsite: "On-site" };

function salaryLabel(min: number | null, max: number | null) {
  const fmt = (n: number) => `RM${n.toLocaleString("en-MY")}`;
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `From ${fmt(min)}`;
  if (max) return `Up to ${fmt(max)}`;
  return null;
}

function externalHref(url: string) {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function hostname(url: string) {
  try {
    return new URL(externalHref(url)).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const data = await getPublicCompany((await params).id);
  return data
    ? { title: `${data.company.companyName} · JobGiga`, description: `${data.company.companyName} — ${data.company.industry}. See open roles on JobGiga.` }
    : { title: "Company not found · JobGiga" };
}

// A company's public page — its details and open jobs. Anyone can view it.
export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const [authUser, data] = await Promise.all([getAuthUser(), getPublicCompany((await params).id)]);
  if (!data) notFound();
  const { company, addresses, jobs, badges, responsiveness } = data;
  // In the same order as the employer's own Badges card.
  const earnedBadges = BADGE_DEFINITIONS.flatMap((badge) => {
    const earned = badges.find((b) => b.key === badge.key);
    return earned ? [{ badge, earnedAt: earned.earnedAt }] : [];
  });

  const isJobseeker = authUser?.role === "jobseeker";
  const gold = isJobseeker;
  const accentText = gold ? "text-brand-gold-dark" : "text-brand-teal-dark";
  const industryDetail =
    company.industryDetail?.trim() && company.industryDetail.trim().toLowerCase() !== company.industry.toLowerCase()
      ? company.industryDetail.trim()
      : null;
  const facts = [
    company.industry,
    industryDetail,
    company.location,
    company.companySize ? `${company.companySize} staff` : null,
    company.companyType,
    company.foundedYear ? `Founded ${company.foundedYear}` : null,
  ].filter((v): v is string => !!v);
  const links = [
    { label: "Website", url: company.websiteUrl },
    { label: "LinkedIn", url: company.companyLinkedin },
    { label: "Facebook", url: company.companyFacebook },
    { label: "Instagram", url: company.companyInstagram },
  ].filter((l): l is { label: string; url: string } => !!l.url?.trim());
  const email = company.companyEmail?.trim() || null;
  const phone = company.companyPhone?.trim() || null;
  const news = company.recentNews.filter((n) => n.title?.trim() && n.url?.trim());
  const joined = new Date(company.joinedAt).toLocaleDateString("en-MY", { month: "long", year: "numeric" });

  return (
    <main className={`flex min-h-[100svh] flex-col overflow-x-clip pb-[92px] ${gold ? "bg-[#FDFAF0]" : "bg-[#F2FAF5]"}`}>
      <Navbar initialUser={authUser} pageRole={gold ? "jobseeker" : "employer"} />
      <div className="shell pt-[24px]">
        <Link href="/companies" className={`text-sm hover:underline ${accentText}`}>
          ← All companies
        </Link>

        <div className="mt-[16px] grid grid-cols-1 items-start gap-[20px] lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="flex flex-col gap-[20px]">
            <div className={`animate-fade-in-up ${gradientFrameClass(gold ? "gold" : "teal")}`}>
              <div className="overflow-hidden rounded-[19px] bg-white">
                {/* Cover banner — the full 3:1 crop the employer uploaded (or
                    the grey fallback). */}
                <div className="aspect-[3/1] w-full">
                  <CompanyBanner url={company.bannerUrl} eager />
                </div>
                <div className="p-[16px] pt-0 sm:p-[22px] sm:pt-0">
                <div className="flex items-end gap-[16px]">
                  <div className="-mt-[36px] shrink-0 rounded-[18px] bg-white p-[4px] shadow-[0_2px_6px_rgba(0,0,0,0.12)]">
                    <CompanyLogo url={company.logoUrl} size={72} />
                  </div>
                  <div className="min-w-0 pt-[12px]">
                    <h1 className="text-xl font-semibold text-[#141B2E]" style={{ lineHeight: 1.15, letterSpacing: "-0.02em" }}>
                      {company.companyName}
                    </h1>
                    <div className="mt-[8px] flex flex-wrap gap-[6px]">
                      {facts.map((f) => (
                        <span key={f} className="rounded-full bg-[#F1F4F8] px-[9px] py-[3px] text-xs text-[#4B5468]">
                          {f}
                        </span>
                      ))}
                    </div>
                    <div className="mt-[8px] flex flex-wrap items-center gap-x-[10px] gap-y-[6px]">
                      <ResponsivenessBadge responsiveness={responsiveness} />
                      <p className="text-xs text-[#9AA3B2]">On JobGiga since {joined}</p>
                    </div>
                  </div>
                </div>

                {earnedBadges.length > 0 && (
                  <div className="mt-[18px] border-t border-black/[0.06] pt-[16px]">
                    <p className="text-sm font-semibold text-[#141B2E]">Badges</p>
                    <p className="mt-[2px] text-xs text-[#9AA3B2]">Milestones {company.companyName} has reached on JobGiga.</p>
                    <div className="mt-[12px] flex flex-wrap gap-[14px]">
                      {earnedBadges.map(({ badge, earnedAt }) => (
                        <div
                          key={badge.key}
                          title={`${badge.description} Earned ${earnedAt.toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" })}.`}
                          className="flex w-[72px] flex-col items-center gap-[4px]"
                        >
                          <div className="w-[64px]">
                            <BadgeMedal badge={badge} earned />
                          </div>
                          <span className="text-center text-[11px] leading-[14px] text-[#4B5468]">{badge.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {company.companyDescription && (
                  <div className="mt-[18px] border-t border-black/[0.06] pt-[16px]">
                    <p className="text-sm font-semibold text-[#141B2E]">About</p>
                    <RichTextContent
                      html={sanitizeDescriptionHtml(company.companyDescription)}
                      className="mt-[6px] text-sm leading-[21px] text-[#4B5468]"
                    />
                  </div>
                )}

                {company.benefits.length > 0 && (
                  <div className="mt-[16px]">
                    <p className="text-sm font-semibold text-[#141B2E]">Benefits</p>
                    <div className="mt-[8px] flex flex-wrap gap-[6px]">
                      {company.benefits.map((b) => (
                        <span key={b} className="rounded-full bg-[#E7F6EC] px-[10px] py-[3px] text-xs text-[#2F7D4F]">
                          {b}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {addresses.length > 0 && (
                  <div className="mt-[16px]">
                    <p className="text-sm font-semibold text-[#141B2E]">
                      {addresses.length === 1 ? "Office" : `Offices (${addresses.length})`}
                    </p>
                    <div className={`mt-[8px] grid grid-cols-1 gap-[8px] ${addresses.length > 1 ? "sm:grid-cols-2" : ""}`}>
                      {addresses.map((a) => {
                        const full = [a.addressLine1, a.addressLine2, `${a.postcode} ${a.city}`, a.state]
                          .map((p) => p?.trim())
                          .filter(Boolean)
                          .join(", ");
                        // Company name + address: Google drops a pin on the listed
                        // business when it has one (an address alone with unit
                        // numbers often shows just the area, with no pin), and
                        // falls back to the address when it doesn't.
                        const query = encodeURIComponent(`${company.companyName}, ${full}`);
                        return (
                          <div key={a.id} className="min-w-0 overflow-hidden rounded-[12px] border border-[#EAEDF2] bg-[#F8FAFB]">
                            <iframe
                              title={`Map of ${company.companyName} — ${a.label}`}
                              src={`https://maps.google.com/maps?q=${query}&z=16&output=embed`}
                              loading="lazy"
                              referrerPolicy="no-referrer-when-downgrade"
                              className={`block w-full border-0 ${addresses.length > 1 ? "h-[180px]" : "h-[240px]"}`}
                            />
                            <div className="px-[14px] py-[10px]">
                              <p className="text-xs text-[#9AA3B2]">{a.label}</p>
                              <p className="mt-[2px] text-sm leading-[20px] text-[#4B5468]">{full}</p>
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${query}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`mt-[2px] inline-block text-xs hover:underline ${accentText}`}
                              >
                                Open in Maps ↗
                              </a>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {news.length > 0 && (
                  <div className="mt-[16px]">
                    <p className="text-sm font-semibold text-[#141B2E]">In the news</p>
                    <div className="mt-[8px] flex flex-col gap-[6px]">
                      {news.map((n) => (
                        <a
                          key={n.url}
                          href={externalHref(n.url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex items-center justify-between gap-[10px] rounded-[12px] border border-[#EAEDF2] bg-[#F8FAFB] px-[14px] py-[10px] transition-colors hover:border-black/[0.15] hover:bg-white"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm text-[#141B2E] group-hover:underline">{n.title}</span>
                            <span className="block truncate text-xs text-[#9AA3B2]">{hostname(n.url)}</span>
                          </span>
                          <span className={`shrink-0 text-xs ${accentText}`}>Read ↗</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                </div>
              </div>
            </div>

            <div className={`animate-fade-in-up ${gradientFrameClass(gold ? "gold" : "teal")}`} style={{ animationDelay: "60ms" }}>
              <div className="rounded-[19px] bg-white p-[16px] sm:p-[22px]">
                <div className="flex items-center gap-[8px]">
                  <p className="text-sm font-semibold text-[#141B2E]">Open roles</p>
                  <span className="rounded-full bg-[#E7F6EC] px-[9px] py-[2px] text-xs text-[#2F9E56]">{jobs.length}</span>
                </div>
                {jobs.length === 0 ? (
                  <p className="mt-[12px] rounded-[14px] bg-[#F8FAFB] p-[16px] text-sm text-[#9AA3B2]">
                    {company.companyName} isn&rsquo;t hiring right now — check back soon.
                  </p>
                ) : (
                  <div className="mt-[12px] flex flex-col gap-[8px]">
                    {jobs.map((job) => {
                      const salary = salaryLabel(job.salaryMin, job.salaryMax);
                      return (
                        <Link
                          key={job.id}
                          // The job page itself is for signed-in jobseekers; anyone
                          // else is taken to the jobseeker page to sign in first.
                          href={isJobseeker ? `/jobseeker/jobs/${job.slug}` : "/jobseeker"}
                          className="group flex flex-col gap-[4px] rounded-[12px] border border-[#EAEDF2] bg-[#F8FAFB] p-[14px] transition-colors hover:border-black/[0.15] hover:bg-white sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <p className={`truncate text-sm text-[#141B2E] group-hover:underline`}>{job.title}</p>
                            <p className="mt-[2px] truncate text-xs text-[#9AA3B2]">
                              {[job.location, EMPLOYMENT_TYPE_LABEL[job.employmentType], WORK_ARRANGEMENT_LABEL[job.workArrangement]]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-[10px]">
                            {salary && <span className="text-xs text-[#4B5468]">{salary}</span>}
                            <span className={`text-xs ${accentText}`}>{isJobseeker ? "View & apply →" : "Sign in to apply →"}</span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Same 300px as the Company Profile page's checklist sidebar — also
              when it stacks below the main column on smaller screens. */}
          <div className="flex w-full max-w-[300px] flex-col gap-[20px] lg:sticky lg:top-[24px]">
            {company.officePhotoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={company.officePhotoUrl}
                alt={`${company.companyName} office`}
                className="aspect-[4/3] w-full rounded-[20px] object-cover"
              />
            )}
            {(email || phone || links.length > 0) && (
              <div className={gradientFrameClass(gold ? "gold" : "teal")}>
                <div className="flex flex-col gap-[8px] rounded-[19px] bg-white p-[16px] sm:p-[22px]">
                  <p className="text-sm font-semibold text-[#141B2E]">Get in touch</p>
                  {(email || phone) && (
                    <div className="flex flex-col gap-[8px] border-b border-black/[0.06] pb-[10px]">
                      {email && (
                        <div className="min-w-0">
                          <p className="text-xs text-[#9AA3B2]">Email</p>
                          <a href={`mailto:${email}`} className={`block truncate text-sm hover:underline ${accentText}`}>
                            {email}
                          </a>
                        </div>
                      )}
                      {phone && (
                        <div className="min-w-0">
                          <p className="text-xs text-[#9AA3B2]">Phone</p>
                          <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className={`block truncate text-sm hover:underline ${accentText}`}>
                            {phone}
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                  {links.map((l) => (
                    <a
                      key={l.label}
                      href={externalHref(l.url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`truncate text-sm hover:underline ${accentText}`}
                    >
                      {l.label} ↗
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="flex-1" />
      <div className="mt-[48px]">
        <Footer accent={gold ? "gold" : "teal"} />
      </div>
      <div className="-mb-[92px] h-[80px] overflow-hidden sm:h-[110px] lg:h-[150px]">
        <AnimatedRibbon accent={gold ? "gold" : "teal"} />
      </div>
    </main>
  );
}
