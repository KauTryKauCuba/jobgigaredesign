import Link from "next/link";
import type { AuthUser } from "./AuthModal";
import AnimatedRibbon from "./AnimatedRibbon";
import Footer from "./Footer";
import Navbar from "./Navbar";
import { gradientFrameClass } from "./formStyles";
import {
  BellIcon,
  BoltIcon,
  BuildingIcon,
  CalendarIcon,
  DraftIcon,
  FileIcon,
  ImageIcon,
  PencilIcon,
  StarIcon,
  TrendUpIcon,
  UploadIcon,
  UserIcon,
} from "./icons";

type Role = "employer" | "jobseeker";
type Feature = { icon: (props: { className?: string }) => React.ReactNode; title: string; detail: string };

// Everything here describes what the product actually does today — no
// company facts (founders, dates, user counts) that aren't ours to claim.
const CONTENT: Record<
  Role,
  {
    headline: string;
    intro: string;
    principles: { title: string; detail: string }[];
    featuresTitle: string;
    features: Feature[];
    malaysia: string;
    cta: { label: string; href: string };
    other: { label: string; href: string };
    // A real screen recording of the flow (see public/videos), when one exists.
    video?: { src: string; poster: string; title: string; caption: string };
  }
> = {
  employer: {
    headline: "Hiring in Malaysia, without the forms.",
    intro:
      "JobGiga helps Malaysian employers hire with an AI assistant that sets up your company, writes your job posts and organises your applicants — while you make every hiring decision.",
    principles: [
      {
        title: "Let AI do the work",
        detail: "Company profiles, job postings and the busywork in between. Describe what you need and the assistant fills in the rest.",
      },
      {
        title: "Your judgement decides",
        detail: "Nothing goes out without you. You review every posting and choose who moves forward.",
      },
      {
        title: "Start with what you have",
        detail: "A company name and a sentence about the role are enough to begin — no blank pages.",
      },
    ],
    featuresTitle: "Everything you need to hire",
    features: [
      {
        icon: BuildingIcon,
        title: "Set up in seconds",
        detail: "Type your company name and AI builds a complete company profile for you to review.",
      },
      {
        icon: PencilIcon,
        title: "Write jobs with AI",
        detail: "Describe the role in your own words and get a structured posting with responsibilities and requirements.",
      },
      {
        icon: TrendUpIcon,
        title: "Track every posting",
        detail: "Status, views and applicants for every posting, live, in one place.",
      },
      {
        icon: StarIcon,
        title: "Top matches first",
        detail: "Applicants are ranked by how well they fit the role, so the strongest ones surface first.",
      },
      {
        icon: CalendarIcon,
        title: "Interview your way",
        detail: "Schedule in a couple of clicks and follow interviews in a list, Kanban board or calendar.",
      },
      {
        icon: ImageIcon,
        title: "Share it anywhere",
        detail: "Turn any posting into a ready-to-share poster for social media or print.",
      },
    ],
    malaysia:
      "Built around how hiring works here — salaries in RM, SSM-registered companies, and EPF, SOCSO and the other benefits candidates look for.",
    cta: { label: "See who's hiring", href: "/companies" },
    other: { label: "Looking for a job? About JobGiga for jobseekers", href: "/jobseeker/about" },
    video: {
      src: "/videos/employer-walkthrough.mp4",
      poster: "/videos/employer-walkthrough-poster.jpg",
      title: "From sign-up to your dashboard in under a minute",
      caption: "A real recording — the AI's web search is shown sped up.",
    },
  },
  jobseeker: {
    headline: "Job hunting in Malaysia, without the forms.",
    intro:
      "JobGiga turns the resume you already have into a complete profile, so you can apply in one click, stand out with a video pitch and keep track of every application.",
    principles: [
      {
        title: "Start with what you have",
        detail: "The resume you already have is enough to begin — no filling in the same details from scratch.",
      },
      {
        title: "Let AI do the paperwork",
        detail: "Your profile, cover letters and resume, drafted for you in seconds.",
      },
      {
        title: "You stay in control",
        detail: "Review and refine everything before an employer ever sees it.",
      },
    ],
    featuresTitle: "Everything you need to get hired",
    features: [
      {
        icon: UploadIcon,
        title: "Start with your resume",
        detail: "Upload a PDF, DOC or DOCX and AI fills in your skills, experience and education.",
      },
      {
        icon: BoltIcon,
        title: "Apply in one click",
        detail: "Your profile is the application — no repeating the same details for every job.",
      },
      {
        icon: UserIcon,
        title: "Stand out with a video pitch",
        detail: "Record a short video introducing yourself, so employers meet you before the interview.",
      },
      {
        icon: FileIcon,
        title: "Cover letters with AI",
        detail: "Paste a job posting and get a cover letter written for that role, ready to edit.",
      },
      {
        icon: DraftIcon,
        title: "Resume Designer",
        detail: "Turn your profile into a clean, professional resume and download it in a few clicks.",
      },
      {
        icon: BellIcon,
        title: "Never miss a job",
        detail: "Save jobs, get alerts for new ones, and track every application in one place.",
      },
    ],
    malaysia:
      "Jobs from Malaysian companies — salaries in RM, benefits like EPF and SOCSO spelled out, and locations across every state.",
    cta: { label: "Browse jobs", href: "/jobseeker#job-search" },
    other: { label: "Hiring instead? About JobGiga for employers", href: "/employer/about" },
    video: {
      src: "/videos/jobseeker-walkthrough.mp4",
      poster: "/videos/jobseeker-walkthrough-poster.jpg",
      title: "From your resume to a full profile in under a minute",
      caption: "A real recording with a sample resume — the AI step is shown sped up.",
    },
  },
};

/**
 * The About page, one per side of the app: /employer/about in teal on mint,
 * /jobseeker/about in gold on cream — always the page's own side, whoever
 * is viewing, so each reads as part of its landing page.
 */
export default function AboutView({ role, authUser }: { role: Role; authUser: AuthUser | null }) {
  const c = CONTENT[role];
  const gold = role === "jobseeker";
  const accent = gold ? "gold" : "teal";
  const solidButton = gold ? "bg-brand-gold text-[#141B2E]" : "bg-brand-teal-dark text-white";
  const iconTile = gold ? "bg-brand-gold-soft text-brand-gold-dark" : "bg-brand-teal-soft text-brand-teal-dark";
  const accentText = gold ? "text-brand-gold-dark" : "text-brand-teal-dark";

  return (
    <main className={`flex min-h-[100svh] flex-col overflow-x-clip pb-[92px] ${gold ? "bg-brand-gold-page" : "bg-brand-teal-page"}`}>
      <Navbar initialUser={authUser} pageRole={role} />

      <div className="shell pt-[clamp(40px,7vh,72px)]">
        <div className="mx-auto max-w-[720px] text-center">
          <span className="inline-flex items-center rounded-full bg-[#F1F4F8] px-[14px] py-[7px] text-xs text-[#4B5468]">
            About JobGiga · For {gold ? "jobseekers" : "employers"}
          </span>
          <h1
            className="mt-[16px] font-sans font-semibold text-[#141B2E]"
            style={{ fontSize: "clamp(30px,3.6vw,48px)", lineHeight: 1.1, letterSpacing: "-0.02em" }}
          >
            {c.headline}
          </h1>
          <p className="mx-auto mt-[16px] max-w-[560px] text-sm leading-[24px] text-[#4B5468]">{c.intro}</p>
        </div>

        {/* See it in action — muted and looping so it autoplays, with no
            player controls: it plays like a moving screenshot. */}
        {c.video && (
          <div className="mx-auto mt-[48px] max-w-[1000px]">
            <div className="text-center">
              <h2 className="text-lg font-semibold text-[#141B2E]">{c.video.title}</h2>
              <p className="mt-[4px] text-xs text-[#9AA3B2]">{c.video.caption}</p>
            </div>
            <div className={`mt-[16px] animate-fade-in-up ${gradientFrameClass(accent)}`}>
              <div className="overflow-hidden rounded-[19px] bg-white">
                <video
                  src={c.video.src}
                  poster={c.video.poster}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  aria-label={c.video.title}
                  className={`block aspect-[8/5] w-full ${gold ? "bg-brand-gold-page" : "bg-brand-teal-page"}`}
                />
              </div>
            </div>
          </div>
        )}

        {/* What we believe */}
        <div className="mt-[56px] grid grid-cols-1 gap-[16px] md:grid-cols-3">
          {c.principles.map((p, i) => (
            <div
              key={p.title}
              className={`animate-fade-in-up ${gradientFrameClass(accent)}`}
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <div className="h-full rounded-[19px] bg-white p-[20px] sm:p-[24px]">
                <span
                  className={`flex h-[28px] w-[28px] items-center justify-center rounded-full text-xs font-semibold ${solidButton}`}
                >
                  {i + 1}
                </span>
                <h2 className="mt-[14px] text-base font-semibold text-[#141B2E]">{p.title}</h2>
                <p className="mt-[6px] text-sm leading-[21px] text-[#4B5468]">{p.detail}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Features */}
        <div className={`mt-[56px] ${gradientFrameClass(accent)}`}>
          <div className="rounded-[19px] bg-white p-[20px] sm:p-[28px]">
            <h2 className="text-lg font-semibold text-[#141B2E]">{c.featuresTitle}</h2>
            <div className="mt-[20px] grid grid-cols-1 gap-x-[28px] gap-y-[22px] sm:grid-cols-2 lg:grid-cols-3">
              {c.features.map((f) => {
                const Icon = f.icon;
                return (
                  <div key={f.title} className="flex items-start gap-[12px]">
                    <span className={`flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-[10px] ${iconTile}`}>
                      <Icon className="h-[16px] w-[16px]" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-[#141B2E]">{f.title}</h3>
                      <p className="mt-[4px] text-sm leading-[21px] text-[#4B5468]">{f.detail}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Made for Malaysia */}
        <div className={`mt-[20px] ${gradientFrameClass(accent)}`}>
          <div className="flex flex-col items-start gap-[16px] rounded-[19px] bg-white p-[20px] sm:p-[28px] md:flex-row md:items-center md:justify-between">
            <div className="max-w-[620px]">
              <h2 className="text-lg font-semibold text-[#141B2E]">Made for Malaysia</h2>
              <p className="mt-[6px] text-sm leading-[22px] text-[#4B5468]">{c.malaysia}</p>
            </div>
            <Link
              href={c.cta.href}
              className={`flex h-[38px] shrink-0 items-center rounded-full px-[18px] text-sm transition-opacity hover:opacity-90 ${solidButton}`}
            >
              {c.cta.label}
            </Link>
          </div>
        </div>

        <p className="mt-[28px] text-center text-sm">
          <Link href={c.other.href} className={`hover:underline ${accentText}`}>
            {c.other.label} →
          </Link>
        </p>
      </div>

      <div className="flex-1" />
      <div className="mt-[64px]">
        <Footer accent={accent} />
      </div>
      <div className="-mb-[92px] h-[80px] overflow-hidden sm:h-[110px] lg:h-[150px]">
        <AnimatedRibbon accent={accent} />
      </div>
    </main>
  );
}
