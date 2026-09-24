import AiFillMockup from "./AiFillMockup";
import AssistantCard from "./AssistantCard";

export default function EmployerAssistantCard() {
  return (
    <AssistantCard
      eyebrow="For employers"
      headline="Your company deserves to stand out"
      bullets={[
        {
          title: "One company name. A complete company profile.",
          detail:
            "Starting a company profile shouldn't feel like filling out endless forms — simply give us your company name.",
        },
        {
          title: "AI creates the foundation.",
          detail:
            "Our AI helps build your company profile using the information available on the platform, giving you a strong starting point in seconds.",
        },
        {
          title: "You refine the story.",
          detail: "Then your team takes over — because no AI knows your company better than you do.",
        },
      ]}
      visual={<AiFillMockup />}
    />
  );
}
