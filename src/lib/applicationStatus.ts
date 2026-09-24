// Matches application_status exactly (see the finalized pipeline design).
// Shared between JobseekerDashboard's summary card and the full My
// Applications page so the label/color mapping never drifts between them.
export const APPLICATION_STATUS_LABEL: Record<string, string> = {
  applied: "Applied",
  screened: "Screened",
  shortlisted: "Shortlisted",
  interview: "Interview scheduled",
  interviewed: "Interviewed",
  evaluation: "Evaluation",
  evaluated: "Evaluated",
  kiv: "KIV (on hold)",
  offer: "Offer",
  hired: "Hired",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

export const APPLICATION_STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  applied: { bg: "bg-[#F1F4F8]", text: "text-[#4B5468]" },
  screened: { bg: "bg-[#FFF3D6]", text: "text-brand-gold-dark" },
  shortlisted: { bg: "bg-[#E6F9FA]", text: "text-[#008990]" },
  interview: { bg: "bg-[#F1ECFB]", text: "text-[#7C5CD1]" },
  interviewed: { bg: "bg-[#E8F1FF]", text: "text-[#2B6CB0]" },
  evaluation: { bg: "bg-[#FFE9D6]", text: "text-[#B45309]" },
  evaluated: { bg: "bg-[#EDFBF4]", text: "text-[#0F9D6C]" },
  kiv: { bg: "bg-[#EAF0FE]", text: "text-[#3B5BDB]" },
  offer: { bg: "bg-[#FFEFE3]", text: "text-[#C2600A]" },
  hired: { bg: "bg-[#E7F6EC]", text: "text-[#2F9E56]" },
  rejected: { bg: "bg-red-50", text: "text-red-500" },
  withdrawn: { bg: "bg-black/[0.04]", text: "text-[#9AA3B2]" },
};

// Matches job_applications.interview_details exactly.
export type InterviewDetails = {
  round: number;
  mode: "onsite" | "online" | "phone";
  scheduledAt: string;
  durationMinutes: number | null;
  location: string | null;
  meetingLink: string | null;
  interviewerName: string | null;
  notes: string | null;
};

export const INTERVIEW_MODE_LABEL: Record<InterviewDetails["mode"], string> = {
  onsite: "Onsite",
  online: "Online",
  phone: "Phone call",
};

// Matches job_applications.interview_response_status exactly. Reset to
// "pending" whenever the employer (re)schedules an interview.
export type InterviewResponseStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "reschedule_requested"
  | "attended"
  | "no_show";

export const INTERVIEW_RESPONSE_STATUS_LABEL: Record<InterviewResponseStatus, string> = {
  pending: "Waiting for response",
  accepted: "Accepted",
  declined: "Declined",
  reschedule_requested: "Reschedule requested",
  attended: "Attended",
  no_show: "No-show",
};

export const INTERVIEW_RESPONSE_STATUS_COLOR: Record<InterviewResponseStatus, { bg: string; text: string }> = {
  pending: { bg: "bg-[#FFF3D6]", text: "text-brand-gold-dark" },
  accepted: { bg: "bg-[#E7F6EC]", text: "text-[#2F9E56]" },
  declined: { bg: "bg-red-50", text: "text-red-500" },
  reschedule_requested: { bg: "bg-[#FFEFE3]", text: "text-[#C2600A]" },
  attended: { bg: "bg-[#E6F9FA]", text: "text-[#008990]" },
  no_show: { bg: "bg-black/[0.06]", text: "text-[#4B5468]" },
};

export function relativeTimeAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "today";
  if (days === 1) return "1d ago";
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}
