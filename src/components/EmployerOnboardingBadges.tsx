import FloatingBadges, { type Badge } from "./FloatingBadges";

// Onboarding-only badge set: kept separate from EmployerFloatingBadges (the
// landing page's version) so tuning this doesn't touch the landing page.
// Positioned within a fixed-height wrapper (see the parent element below)
// rather than the full hero, since the hero here grows tall with the
// onboarding form — spreading badges across that height would push most of
// them down behind the form instead of around the heading.
const BADGES: Badge[] = [
  {
    id: "blue-collar",
    label: "Manufacturing",
    src: "/employer-types/blue-collar.jpg",
    top: "4%",
    left: "2%",
    duration: "5.4s",
    delay: "0s",
  },
  {
    id: "white-collar",
    label: "Corporate services",
    src: "/employer-types/white-collar.jpg",
    top: "4%",
    right: "2%",
    duration: "6.1s",
    delay: "0.6s",
  },
  {
    id: "construction",
    label: "Construction",
    src: "/employer-types/construction.jpg",
    bottom: "6%",
    left: "8%",
    duration: "5.8s",
    delay: "1.1s",
  },
  {
    id: "office",
    label: "Technology",
    src: "/employer-types/office.jpg",
    bottom: "6%",
    right: "8%",
    duration: "6.4s",
    delay: "0.3s",
  },
];

export default function EmployerOnboardingBadges() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 hidden h-[300px] md:block">
      <FloatingBadges badges={BADGES} />
    </div>
  );
}
