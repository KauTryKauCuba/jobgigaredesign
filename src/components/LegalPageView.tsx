import type { AuthUser } from "./AuthModal";
import AnimatedRibbon from "./AnimatedRibbon";
import Footer from "./Footer";
import Navbar from "./Navbar";
import { gradientFrameClass } from "./formStyles";
import type { LegalDoc } from "@/lib/legal-content";

type Role = "employer" | "jobseeker";

/**
 * A legal/policy page (Privacy, Security, Terms), one per side of the app
 * like AboutView and ReleaseNotesView: /employer/... in teal on mint,
 * /jobseeker/... in gold on cream. The document itself (`doc`) is the same
 * for both sides — only the theme changes.
 */
export default function LegalPageView({ role, doc, authUser }: { role: Role; doc: LegalDoc; authUser: AuthUser | null }) {
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
            JobGiga · For {gold ? "jobseekers" : "employers"}
          </span>
          <h1
            className="mt-[16px] font-sans font-semibold text-[#141B2E]"
            style={{ fontSize: "clamp(30px,3.6vw,48px)", lineHeight: 1.1, letterSpacing: "-0.02em" }}
          >
            {doc.title}
          </h1>
          <p className={`mt-[10px] text-xs tracking-[0.04em] uppercase ${dateText}`}>Last updated {doc.lastUpdated}</p>
          <p className="mx-auto mt-[16px] max-w-[560px] text-sm leading-[24px] text-[#4B5468]">{doc.intro}</p>
        </div>

        <div className={`mx-auto mt-[48px] max-w-[760px] animate-fade-in-up ${gradientFrameClass(accent)}`}>
          <div className="flex flex-col gap-[28px] rounded-[19px] bg-white p-[20px] sm:p-[32px]">
            {doc.sections.map((section) => (
              <div key={section.heading}>
                <h2 className="text-base font-semibold text-[#141B2E]">{section.heading}</h2>
                {section.paragraphs?.map((p) => (
                  <p key={p} className="mt-[8px] text-sm leading-[22px] text-[#4B5468]">
                    {p}
                  </p>
                ))}
                {section.bullets && (
                  <ul className="mt-[8px] flex flex-col gap-[7px]">
                    {section.bullets.map((b) => (
                      <li key={b} className="flex gap-[8px] text-sm leading-[21px] text-[#4B5468]">
                        <span className={`mt-[7px] h-[4px] w-[4px] shrink-0 rounded-full ${gold ? "bg-brand-gold-dark" : "bg-brand-teal-dark"}`} />
                        {b}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
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
