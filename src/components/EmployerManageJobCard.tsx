import AssistantCard from "./AssistantCard";
import ManageJobMockup from "./ManageJobMockup";

export default function EmployerManageJobCard() {
  return (
    <AssistantCard
      eyebrow="For employers"
      headline="Every posting, tracked from day one"
      bullets={[
        {
          title: "See status at a glance",
          detail: "Active, pending review, or still a draft — know exactly where every posting stands.",
        },
        {
          title: "Views and applicants, live",
          detail: "Track how each posting performs without switching pages or digging through spreadsheets.",
        },
        {
          title: "Act the moment it matters",
          detail: "Jump straight to a posting's applicants, or edit and resubmit one that needs a second look.",
        },
      ]}
      visual={<ManageJobMockup />}
    />
  );
}
