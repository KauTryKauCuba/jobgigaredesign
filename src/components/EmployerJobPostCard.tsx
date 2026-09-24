import AssistantCard from "./AssistantCard";
import JobPostMockup from "./JobPostMockup";

export default function EmployerJobPostCard() {
  return (
    <AssistantCard
      reverse
      eyebrow="For employers"
      headline="Create jobs without starting from scratch"
      bullets={[
        {
          title: "Describe the role in your own words",
          detail: "No blank page, no complicated template — just tell us who you're looking for.",
        },
        {
          title: "AI writes the first draft",
          detail:
            "Your idea becomes a structured, engaging job posting — responsibilities, requirements, and everything candidates need to know.",
        },
        {
          title: "You make it yours",
          detail: "Review, refine, and publish whenever it feels right.",
        },
      ]}
      visual={<JobPostMockup />}
    />
  );
}
