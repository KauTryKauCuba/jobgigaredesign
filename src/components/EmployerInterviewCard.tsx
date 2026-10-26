import AssistantCard from "./AssistantCard";
import InterviewMockup from "./InterviewMockup";

export default function EmployerInterviewCard() {
  return (
    <AssistantCard
      reverse
      step={4}
      background="#E3F2EB"
      fadeEdges
      bandStartWidth={45}
      bandDurationMs={1400}
      // Same band as "Write jobs with AI" (EmployerJobPostCard).
      bandGradient="linear-gradient(120deg, #DDF0E8 0%, #E3F2EB 45%, #FBF3DC 100%)"
      eyebrow="Interview your way"
      headline="Interviews, organized your way"
      bullets={[
        {
          title: "Schedule in a couple of clicks",
          detail: "Pick a shortlisted candidate, set the round, mode, and time — done.",
        },
        {
          title: "List, Kanban, or Calendar",
          detail: "Browse a straightforward list, drag candidates through stages on a board, or plan around a calendar — whichever fits how you work.",
        },
        {
          title: "Know who's confirmed",
          detail: "Track responses — pending, accepted, declined, or rescheduled — without chasing anyone down.",
        },
      ]}
      visual={<InterviewMockup />}
    />
  );
}
