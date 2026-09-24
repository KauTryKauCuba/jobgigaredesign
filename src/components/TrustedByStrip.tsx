import Image from "next/image";

type Logo =
  | { kind: "image"; name: string; src: string; width: number; height: number }
  | {
      kind: "icon";
      name: string;
      Icon: (props: { className?: string }) => React.ReactElement;
    };

/**
 * aikido/Parim/Parcelly/ParcelTracker/WHALE pulled from their own official
 * sites; Bolt (bolt.com) from its Wikipedia entry, since bolt.com itself
 * rate-limited fetches. finbite.com redirects to a domain marketplace (no
 * longer live at that URL), so it still pairs the name with a generic
 * placeholder glyph — not the company's real mark — until a real file is
 * available.
 */
function DotGridIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="currentColor" aria-hidden>
      <circle cx="4" cy="4" r="2.4" />
      <circle cx="10" cy="4" r="2.4" opacity="0.55" />
      <circle cx="4" cy="10" r="2.4" opacity="0.55" />
      <circle cx="10" cy="10" r="2.4" />
    </svg>
  );
}

const LOGOS: Logo[] = [
  { kind: "image", name: "aikido", src: "/logos/aikido.svg", width: 88, height: 20 },
  { kind: "image", name: "Bolt", src: "/logos/bolt.jpg", width: 132, height: 64 },
  { kind: "image", name: "Parim", src: "/logos/parim.svg", width: 104, height: 32 },
  { kind: "image", name: "parcelly", src: "/logos/parcelly.svg", width: 90, height: 31 },
  { kind: "icon", name: "finbite", Icon: DotGridIcon },
  {
    kind: "image",
    name: "ParcelTracker",
    src: "/logos/parceltracker.svg",
    width: 168,
    height: 30,
  },
  { kind: "image", name: "WHALE", src: "/logos/whale.svg", width: 104, height: 22 },
];

export default function TrustedByStrip() {
  return (
    <div className="shell relative z-10 pt-[46px] pb-[48px]">
      <div className="flex flex-wrap items-center justify-center gap-x-[clamp(35px,6.25vw,70px)] gap-y-[25px]">
        {LOGOS.map((logo, index) => {
          if (logo.kind === "image") {
            return (
              <Image
                key={logo.name}
                src={logo.src}
                alt={logo.name}
                width={logo.width}
                height={logo.height}
                priority={index === 0}
                className="h-[27.5px] w-auto object-contain"
              />
            );
          }

          const Icon = logo.Icon;
          return (
            <span key={logo.name} className="flex items-center gap-[7.5px] text-2xl tracking-tight text-[#141B2E]">
              <Icon className="h-[22.5px] w-[22.5px] text-[#141B2E]" />
              {logo.name}
            </span>
          );
        })}
      </div>
    </div>
  );
}
