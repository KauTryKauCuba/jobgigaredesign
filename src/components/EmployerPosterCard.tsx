import AssistantCard from "./AssistantCard";
import PosterMockup from "./PosterMockup";

export default function EmployerPosterCard() {
  return (
    <AssistantCard
      step={5}
      eyebrow="Share it anywhere"
      headline="Turn any posting into a ready-to-share poster"
      bullets={[
        {
          title: "One click from your posting",
          detail: "Pick an active job and the poster is drawn from its title, pay, location and requirements — nothing to retype.",
        },
        {
          title: "Choose the look that fits your brand",
          detail: "Go playful and approachable, or corporate with a real photo and your logo.",
        },
        {
          title: "Download and post anywhere",
          detail: "Save it as a PNG, share it on social media or WhatsApp groups, and generate another whenever you need a fresh take.",
        },
      ]}
      visual={<PosterMockup />}
    />
  );
}
