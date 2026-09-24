import AssistantCard from "./AssistantCard";

export default function JobseekerAssistantCard() {
  return (
    <AssistantCard
      eyebrow="For jobseekers"
      headline="Find a job by just talking about it"
      bullets={[
        { title: "Understands your skills and goals" },
        {
          title: "Builds your profile and matches you to roles",
          detail:
            "Turns a quick chat into a complete profile — skills, experience, availability — matched to jobs that fit.",
        },
        { title: "Applies for you and keeps you updated" },
      ]}
      messages={[
        { from: "user", text: "Can I apply without a resume?" },
        {
          from: "assistant",
          text: "Yes — I'll build your profile from our chat, no resume needed.",
        },
        { from: "assistant", text: "Want to see roles that match you?" },
      ]}
      ctaLabel="See matches"
      accent="gold"
    />
  );
}
