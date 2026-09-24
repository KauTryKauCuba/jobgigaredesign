import Image from "next/image";
import SiriOrb from "./SiriOrb";

type Bullet = { title: string; detail?: string };
type ChatMessage = { from: "user" | "assistant"; text: string };

export default function AssistantCard({
  eyebrow,
  headline,
  bullets,
  messages,
  ctaLabel,
  image,
  visual,
  reverse = false,
  accent = "teal",
}: {
  eyebrow: string;
  headline: string;
  bullets: Bullet[];
  /** Omit to show the image/visual (or placeholder) plain, with no chat overlay. */
  messages?: ChatMessage[];
  ctaLabel?: string;
  /** Optional real product screenshot — falls back to the flat placeholder
   *  when omitted (unset for JobseekerAssistantCard). Ignored when `visual` is set. */
  image?: string;
  /** Optional custom visual (e.g. an animated mockup) — takes priority over `image`. */
  visual?: React.ReactNode;
  /** Mirrors the layout — visual on the left, copy on the right (and the
   *  column ratio flips to match, so the visual stays the larger side). */
  reverse?: boolean;
  /** Employer = teal, Jobseeker = gold — see DESIGN.md's Employer vs. Jobseeker section. */
  accent?: "teal" | "gold";
}) {
  const copy = (
    <div>
      <span className="inline-flex items-center rounded-full bg-[#F1F4F8] px-[14px] py-[7px] text-xs text-[#4B5468]">
        {eyebrow}
      </span>

      <h2
        className="mt-[20px] font-sans font-semibold text-[#141B2E]"
        style={{ fontSize: "clamp(28px,3.4vw,40px)", lineHeight: 1.12, letterSpacing: "-0.02em" }}
      >
        {headline}
      </h2>

      <div className="mt-[28px] border-t border-black/[0.08]">
        {bullets.map((b) => (
          <div key={b.title} className="border-b border-black/[0.08] py-[20px]">
            <p className="text-sm text-[#141B2E]">{b.title}</p>
            {b.detail && <p className="mt-[6px] text-sm leading-[21px] text-[#4B5468]">{b.detail}</p>}
          </div>
        ))}
      </div>
    </div>
  );

  const visualBlock = (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[28px]">
      {visual ? (
        <div className="absolute inset-0">{visual}</div>
      ) : image ? (
        <Image src={image} alt="" fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
      ) : (
        /* Placeholder — swap for a real image. */
        <div aria-hidden className="absolute inset-0 bg-[#E4E7EC]" />
      )}

      {messages && messages.length > 0 && (
        <>
          {/* Scrim so the white chat bubbles below stay legible over a
              real (often white-card-heavy) product screenshot. */}
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-transparent" />

          <div className="absolute inset-0 flex flex-col justify-end gap-[10px] p-[20px] sm:p-[28px]">
            {messages.map((m, i) => (
              <div
                key={i}
                className={
                  m.from === "user"
                    ? "self-end max-w-[80%] rounded-[16px] rounded-br-[4px] bg-white px-[16px] py-[10px] text-sm leading-[20px] text-[#141B2E] shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                    : "max-w-[85%] rounded-[16px] rounded-bl-[4px] bg-white/90 px-[16px] py-[10px] text-sm leading-[20px] text-[#141B2E] shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                }
              >
                {m.text}
              </div>
            ))}

            <div className="flex items-center gap-[8px] rounded-full bg-white px-[8px] py-[8px] shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
              <SiriOrb className="h-[26px] w-[26px] shrink-0" />
              <a
                href="#"
                className={`flex h-[34px] flex-1 items-center justify-center rounded-full px-[16px] text-sm hover:opacity-90 ${
                  accent === "gold" ? "bg-[#FFE9A6] text-[#141B2E]" : "bg-brand-teal-dark text-white"
                }`}
              >
                {ctaLabel}
              </a>
              <a
                href="#"
                className="flex h-[34px] items-center justify-center px-[14px] text-sm text-[#4B5468] transition-colors hover:text-[#141B2E]"
              >
                Skip
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="relative z-10 mx-auto w-[1300px] max-w-[calc(100%-40px)] py-[clamp(40px,7vh,80px)]">
      <div
        className={`grid items-center gap-[48px] lg:gap-[64px] ${
          reverse ? "lg:grid-cols-[3fr_1fr]" : "lg:grid-cols-[1fr_3fr]"
        }`}
      >
        {reverse ? (
          <>
            {visualBlock}
            {copy}
          </>
        ) : (
          <>
            {copy}
            {visualBlock}
          </>
        )}
      </div>
    </div>
  );
}
