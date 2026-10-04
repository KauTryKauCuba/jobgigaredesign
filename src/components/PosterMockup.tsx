import { MOCKUP_CARD_CLASS as cardClass } from "./formStyles";
import { CheckIcon } from "./icons";

// Same two styles (and swatches) as POSTER_STYLE_OPTIONS in
// PosterGeneratorView.tsx, so the picker reads the same as the real page.
const STYLES = [
  { label: "Playful & Approachable", swatch: "linear-gradient(135deg, #BEE3F8, #FFFFFF)", phase: "a" },
  { label: "Corporate with Photo", swatch: "linear-gradient(135deg, #141B2E, #1FA6C9)", phase: "b" },
];

const POSTING = {
  title: "Graphic Designer",
  company: "ParcelTracker",
  location: "KL Sentral, Kuala Lumpur",
  salary: "RM2,800–4,500",
  type: "Full-time · Onsite",
};

/**
 * A small, animated recreation of the Poster Generator — same composition
 * as the other mockups (narrow side card + wide main card), not a
 * screenshot. The side card holds the posting + style picker; the main card
 * shows one finished poster per style. Both halves alternate between the two
 * styles on one shared timeline (see .poster-mock-* in globals.css): the
 * picker's selection moves, the matching poster lifts forward, and a shine
 * sweeps across it as if just generated. The "Generate poster" pill softly
 * pulses throughout. Pure CSS (see .ai-fill-* in globals.css),
 * respects prefers-reduced-motion.
 */
export default function PosterMockup() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[#F2FAF5] p-[20px]">
      <div className="grid w-full max-w-[840px] grid-cols-1 gap-[12px] md:grid-cols-[1fr_2fr]">
        {/* Hidden below md — same rationale as the other mockups' narrow
            side card: doesn't fit a phone-width card without overflowing. */}
        <div className={`${cardClass} hidden flex-col gap-[10px] self-start md:flex`}>
          <div>
            <h3 className="text-xs font-semibold text-[#141B2E]">Poster generator</h3>
            <p className="mt-[2px] text-xs leading-[13px] text-[#4B5468]">Pick a posting and a look.</p>
          </div>

          <div className="rounded-[8px] border border-brand-teal-dark bg-[#E6F9FA] px-[8px] py-[6px]">
            <p className="truncate text-xs text-[#141B2E]">{POSTING.title}</p>
            <p className="truncate text-[10px] text-[#4B5468]">{POSTING.location}</p>
          </div>

          <div className="flex flex-col gap-[6px]">
            {STYLES.map((s) => (
              <div
                key={s.label}
                className={`flex items-center gap-[6px] rounded-[8px] border border-black/[0.06] px-[8px] py-[6px] poster-mock-style-${s.phase}`}
              >
                <span
                  aria-hidden
                  className="h-[14px] w-[14px] shrink-0 rounded-full border border-black/[0.06]"
                  style={{ background: s.swatch }}
                />
                <span className="truncate text-[10px] text-[#141B2E]">{s.label}</span>
                <CheckIcon className={`ml-auto h-[9px] w-[9px] shrink-0 text-brand-teal-dark poster-mock-check-${s.phase}`} />
              </div>
            ))}
          </div>

          <div className="ai-fill-pulse flex h-[26px] items-center justify-center rounded-full bg-brand-teal-dark text-[10px] text-white">
            Generate poster
          </div>
        </div>

        <div className={`${cardClass} flex flex-col gap-[10px]`}>
          <div>
            <h3 className="text-xs font-semibold text-[#141B2E]">Your posters</h3>
            <p className="mt-[2px] text-xs leading-[13px] text-[#4B5468]">Ready to download and share.</p>
          </div>

          <div className="flex items-center justify-center gap-[14px] rounded-[10px] bg-[#F8FAFB] px-[10px] py-[32px]">
            {/* Playful — sticky note pinned to a soft blue board */}
            <div className="poster-mock-card-a relative flex aspect-[9/16] w-[38%] max-w-[150px] flex-col overflow-hidden rounded-[10px] bg-[#BEE3F8] p-[8px] shadow-[0_4px_12px_rgba(20,27,46,0.12)]">
              <span aria-hidden className="poster-mock-shine-a pointer-events-none absolute inset-y-0 left-0 z-10 w-[40%] bg-gradient-to-r from-transparent via-white/60 to-transparent" />
              <p className="text-center text-[10px] font-semibold text-[#008990]">We&rsquo;re hiring!</p>
              <div className="relative mt-[8px] flex flex-1 -rotate-2 flex-col gap-[4px] rounded-[4px] bg-[#FFF3B0] p-[8px] pt-[12px] shadow-[0_2px_4px_rgba(20,27,46,0.12)]">
                <span
                  aria-hidden
                  className="absolute top-[-4px] left-1/2 h-[9px] w-[9px] -translate-x-1/2 rounded-full bg-[#E5484D] shadow-[0_1px_2px_rgba(0,0,0,0.3)]"
                />
                <p className="text-[11px] font-semibold leading-[13px] text-[#141B2E]">{POSTING.title}</p>
                <p className="text-[9px] leading-[11px] text-[#4B5468]">{POSTING.location}</p>
                <p className="text-[9px] leading-[11px] text-[#4B5468]">{POSTING.type}</p>
                <p className="mt-auto text-[10px] font-semibold text-[#008990]">{POSTING.salary}</p>
              </div>
              <div className="mt-[8px] rounded-full bg-white py-[3px] text-center text-[9px] text-[#141B2E]">
                Apply on JobGiga
              </div>
            </div>

            {/* Corporate — photo header, logo, clean type */}
            <div className="poster-mock-card-b relative flex aspect-[9/16] w-[38%] max-w-[150px] flex-col overflow-hidden rounded-[10px] bg-[#141B2E] shadow-[0_4px_12px_rgba(20,27,46,0.25)]">
              <span aria-hidden className="poster-mock-shine-b pointer-events-none absolute inset-y-0 left-0 z-10 w-[40%] bg-gradient-to-r from-transparent via-white/40 to-transparent" />
              <div className="relative h-[45%] w-full">
                {/* Stand-in "photo": a soft office-scene gradient with a
                    head-and-shoulders silhouette, not a real image. */}
                <div
                  aria-hidden
                  className="absolute inset-0"
                  style={{ background: "linear-gradient(160deg, #9FD8E6 0%, #1FA6C9 55%, #0E5E73 100%)" }}
                />
                <span aria-hidden className="absolute bottom-[22%] left-1/2 h-[22%] w-[18%] -translate-x-1/2 rounded-full bg-[#0E3A48]/70" />
                <span aria-hidden className="absolute bottom-0 left-1/2 h-[22%] w-[40%] -translate-x-1/2 rounded-t-full bg-[#0E3A48]/70" />
                <span className="absolute top-[6px] left-[6px] rounded-[4px] bg-white px-[5px] py-[1px] text-[8px] font-semibold text-[#141B2E]">
                  {POSTING.company}
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-[3px] p-[8px]">
                <p className="text-[8px] uppercase tracking-[0.08em] text-[#FFE9A6]">Now hiring</p>
                <p className="text-[11px] font-semibold leading-[13px] text-white">{POSTING.title}</p>
                <p className="text-[9px] leading-[11px] text-white/70">{POSTING.location}</p>
                <p className="text-[9px] leading-[11px] text-white/70">{POSTING.salary}</p>
                <div className="mt-auto rounded-full bg-[#FFE9A6] py-[3px] text-center text-[9px] text-[#141B2E]">
                  Apply now
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-[6px]">
            <span className="flex h-[24px] flex-1 items-center justify-center rounded-full bg-brand-teal-dark text-[10px] text-white">
              Download PNG
            </span>
            <span className="flex h-[24px] flex-1 items-center justify-center rounded-full border border-black/[0.1] text-[10px] text-[#4B5468]">
              Generate another
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
