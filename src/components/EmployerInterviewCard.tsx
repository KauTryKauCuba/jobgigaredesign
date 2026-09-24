import AssistantCard from "./AssistantCard";
import InterviewMockup from "./InterviewMockup";

export default function EmployerInterviewCard() {
  return (
    <AssistantCard
      reverse
      eyebrow="For employers"
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
