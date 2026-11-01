import type { AuthUser } from "./AuthModal";
import AnimatedRibbon from "./AnimatedRibbon";
import Footer from "./Footer";
import Navbar from "./Navbar";
import { gradientFrameClass } from "./formStyles";

type Role = "employer" | "jobseeker";
type Release = { date: string; title: string; items: string[] };

// What actually shipped, in plain language — newest first. Add to the top
// of the relevant role's list (or both) when something user-facing ships.
const CONTENT: Record<Role, { headline: string; intro: string; releases: Release[] }> = {
  employer: {
    headline: "What's new for employers",
    intro: "A plain-language log of what's changed in JobGiga — newest first.",
    releases: [
      {
        date: "November 2026",
        title: "Schedule interviews, run evaluations and draft job postings from chat",
        items: [
          "Ask the assistant to schedule, reschedule or cancel an interview — it shows you exactly what it's about to send before anything happens, and nothing changes until you confirm.",
          "Interviewers can submit their evaluation and recommendation straight from the chat, too.",
          "Describe a role and the assistant drafts a complete job posting for you — it's saved as a draft only, so you still review and publish it yourself.",
          "Close a job posting by just asking.",
          "Open several applicants' profiles at once in the chat, including their phone, email and resume when you need them, and see who's phone-verified.",
          "Every assistant reply now shows a copy button and the real time/tokens it took to answer.",
        ],
      },
      {
        date: "November 2026",
        title: "A smarter assistant and Excel export",
        items: [
          "Ask the assistant about your applicants and it looks up the real answer — who's shortlisted, how many applied from Kuala Lumpur, your top matches and where each one stands, one person's skills and experience, who hasn't replied to an interview invite, or when a posting expires. In English or Malay.",
          "Hiring managers and panel members only ever get answers about the postings and candidates they can already see.",
          "Export applicants to Excel from the Applicants page or any posting's page — exactly the list you've filtered to. Or just ask the assistant to \"export it to Excel\".",
          "Exports leave out email addresses and phone numbers, to keep applicants' contact details safe.",
          "AI suggestions are more dependable, with a backup ready if one AI service is slow.",
          "The chat bar now lives in your dashboard after you sign in, rather than on the public home page.",
        ],
      },
      {
        date: "October 2026",
        title: "Clearer guides and a smoother dashboard",
        items: [
          "New \"How it works\" guides on the Team and Advertisement pages, explaining team roles and invites, and how company and job ads are booked, reviewed and run.",
          "Collapse the dashboard sidebar to icons for more room — it remembers your choice on this device.",
          "Dashboard tiles like \"New applicants\" or \"Needs evaluation\" now open Applicants or Interviews already filtered to those people.",
          "When you click a sidebar item, it shows a small spinner while the page loads, so you know it's on its way.",
          "Pages load faster when lots of people visit at the same time.",
          "Seasonal themes now carry through to the colour of the employer page's feature sections.",
        ],
      },
      {
        date: "October 2026",
        title: "About, release notes, and legal pages",
        items: [
          "New pages in the footer: About, Release notes, Privacy, Security, and Terms & Conditions.",
          "Fixed a mobile scrolling glitch where overscrolling past the top or bottom briefly showed a plain white background.",
        ],
      },
      {
        date: "October 2026",
        title: "Applicants' preferred work locations and certification files",
        items: [
          "Applicant profiles now show the towns and areas they'd like to work in, picked from a real place search.",
          "Certifications & licenses can include the actual certificate or license file — open it straight from an applicant's profile.",
          "More reliable Google sign-in and file uploads after a server restart.",
        ],
      },
      {
        date: "October 2026",
        title: "Company directory and video pitches",
        items: [
          "Browse other companies hiring on JobGiga from a public directory.",
          "Applicants can now record a short video pitch, shown alongside their profile.",
          "A Resume Designer to turn a jobseeker's profile into a clean, downloadable resume.",
        ],
      },
      {
        date: "September 2026",
        title: "AI chat assistant",
        items: [
          "A chat assistant that can answer questions and act on your account, with history across sessions.",
          "The dashboard now works properly on mobile and tablet screens.",
        ],
      },
      {
        date: "September 2026",
        title: "Achievement badges and poster generator",
        items: [
          "Earn badges for hiring milestones, shown on your company profile.",
          "Turn any job posting into a ready-to-share poster for social media or print.",
          "AI-written cover letters and screening questions for your postings.",
        ],
      },
    ],
  },
  jobseeker: {
    headline: "What's new for jobseekers",
    intro: "A plain-language log of what's changed in JobGiga — newest first.",
    releases: [
      {
        date: "November 2026",
        title: "A copy button on every chat reply",
        items: ["Every assistant reply now shows a copy button and the real time/tokens it took to answer."],
      },
      {
        date: "November 2026",
        title: "Resume Review and a clearer dashboard",
        items: [
          "New Resume Review: your resume on one side and friendly, practical feedback on the other, with each suggestion highlighted on your resume in its own colour. Up to 3 reviews a day.",
          "A \"Get feedback\" link on your resume card takes you straight there.",
          "My applications on your dashboard now shows each application's progress at a glance.",
          "Resume Designer splits your resume into proper pages — no job or course gets cut in half between pages — and the PDF matches exactly what you see.",
          "AI features are more dependable, with a backup ready if one AI service is slow.",
          "The chat bar now lives in your dashboard after you sign in, rather than on the public home page.",
        ],
      },
      {
        date: "October 2026",
        title: "Smoother navigation",
        items: [
          "When you click a sidebar item, it shows a small spinner while the page loads, so you know it's on its way.",
          "Pages load faster when lots of people visit at the same time.",
          "Seasonal themes now carry through to the colour of the Featured jobs section.",
          "A cleaner tick on your profile checklist once all the required details are done.",
        ],
      },
      {
        date: "October 2026",
        title: "About, release notes, and legal pages",
        items: [
          "New pages in the footer: About, Release notes, Privacy, Security, and Terms & Conditions.",
          "Fixed a mobile scrolling glitch where overscrolling past the top or bottom briefly showed a plain white background.",
        ],
      },
      {
        date: "October 2026",
        title: "Pick your exact town or area",
        items: [
          "Your location and preferred work locations now use a real place search — type an area like \"Kota Damansara\" and it finds the right town and state.",
          "Attach the actual file to a certification or license, not just its name.",
          "More reliable Google sign-in and file uploads after a server restart.",
        ],
      },
      {
        date: "October 2026",
        title: "Video pitch and Resume Designer",
        items: [
          "Record a short video introducing yourself, shown alongside your profile so employers meet you before the interview.",
          "Resume Designer turns your profile into a clean, downloadable resume in a few clicks.",
          "Browse a directory of companies hiring on JobGiga.",
        ],
      },
      {
        date: "September 2026",
        title: "AI chat assistant",
        items: [
          "A chat assistant that can answer questions and act on your account, with history across sessions.",
          "JobGiga now works properly on mobile and tablet screens.",
        ],
      },
      {
        date: "September 2026",
        title: "Cover letters and faster matching",
        items: [
          "Paste a job posting and get a cover letter written for that role, ready to edit.",
          "Improved matching so the jobs you're best suited for surface first.",
        ],
      },
    ],
  },
};

/**
 * Release notes, one per side of the app (like AboutView): /employer/
 * release-notes in teal on mint, /jobseeker/release-notes in gold on cream.
 */
export default function ReleaseNotesView({ role, authUser }: { role: Role; authUser: AuthUser | null }) {
  const c = CONTENT[role];
  const gold = role === "jobseeker";
  const accent = gold ? "gold" : "teal";
  const dateText = gold ? "text-brand-gold-dark" : "text-brand-teal-dark";

  return (
    <main className={`flex min-h-[100svh] flex-col overflow-x-clip pb-[92px] ${gold ? "bg-brand-gold-page" : "bg-brand-teal-page"}`}>
      <Navbar initialUser={authUser} pageRole={role} />

      {/* Same top padding as the landing page's hero (minus this pill + its
          gap, ~46px, which the hero doesn't have), so the heading below
          sits at the same distance from the navbar the hero's does. */}
      <div className="shell pt-[clamp(2px,calc(9vh-46px),50px)]">
        <div className="mx-auto max-w-[720px] text-center">
          <span className="inline-flex items-center rounded-full bg-[#F1F4F8] px-[14px] py-[7px] text-xs text-[#4B5468]">
            Release notes · For {gold ? "jobseekers" : "employers"}
          </span>
          <h1
            className="mt-[16px] font-sans font-semibold text-[#141B2E]"
            style={{ fontSize: "clamp(30px,3.6vw,48px)", lineHeight: 1.1, letterSpacing: "-0.02em" }}
          >
            {c.headline}
          </h1>
          <p className="mx-auto mt-[16px] max-w-[560px] text-sm leading-[24px] text-[#4B5468]">{c.intro}</p>
        </div>

        <div className="mx-auto mt-[48px] flex max-w-[760px] flex-col gap-[16px]">
          {c.releases.map((release, i) => (
            <div
              key={`${release.date}-${release.title}`}
              className={`animate-fade-in-up ${gradientFrameClass(accent)}`}
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <div className="rounded-[19px] bg-white p-[20px] sm:p-[28px]">
                <p className={`text-xs tracking-[0.04em] uppercase ${dateText}`}>{release.date}</p>
                <h2 className="mt-[4px] text-base font-semibold text-[#141B2E]">{release.title}</h2>
                <ul className="mt-[12px] flex flex-col gap-[8px]">
                  {release.items.map((item) => (
                    <li key={item} className="flex gap-[8px] text-sm leading-[21px] text-[#4B5468]">
                      <span className={`mt-[7px] h-[4px] w-[4px] shrink-0 rounded-full ${gold ? "bg-brand-gold-dark" : "bg-brand-teal-dark"}`} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
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
