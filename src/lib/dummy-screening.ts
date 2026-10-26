// How a dummy applicant answers the dummy postings' custom screening
// questions (DUMMY_JOB_POSTINGS) — honestly, from their own profile where
// the profile says, and varied by index otherwise, so some applicants pass,
// some miss a must-have and some only miss the nice-to-haves.
import type { CustomAnswer, CustomQuestion } from "./screening-questions";

type DummyApplicantForScreening = {
  index: number;
  fullName: string;
  location: string;
  yearsExperience: number;
  workArrangement: string;
  noticePeriod: string;
  drivingLicense: string | null;
};

// Notice period → the "When can you start?" options.
const START_FOR_NOTICE: Record<string, string> = {
  immediate: "Immediately",
  one_week: "Within 1 month",
  two_weeks: "Within 1 month",
  one_month: "Within 1 month",
  two_months: "Within 2 months",
  more_than_two_months: "More than 2 months",
};

const WARDS = ["Medical", "Surgical", "ICU / Critical care", "Emergency", "Paediatrics", "Other"];

const NURSE_REASONS = [
  "I've worked on a busy medical ward for a few years and want to grow in a hospital with strong training, closer to my family in Perak.",
  "I enjoy patient education and want a role where I can follow patients from admission to discharge.",
  "Your hospital's ICU has a good reputation, and I'd like to build my critical-care skills with an experienced team.",
  "I'm looking for a stable full-time post with rotating shifts that lets me keep developing as a nurse.",
];

function slug(fullName: string) {
  return fullName.toLowerCase().replace(/[^a-z]+/g, "");
}

export function dummyCustomAnswer(question: CustomQuestion, applicant: DummyApplicantForScreening): CustomAnswer {
  const i = applicant.index;
  const start = START_FOR_NOTICE[applicant.noticePeriod] ?? "Within 1 month";
  switch (question.id) {
    // Frontend Engineer
    case "hybrid-ok":
      // Only someone who wants to work fully remote says no.
      return { questionId: question.id, answer: applicant.workArrangement !== "remote" };
    case "fe-react-years":
      return { questionId: question.id, number: Math.max(0, applicant.yearsExperience - (i % 3 === 0 ? 1 : 0)) };
    case "fe-start":
    case "ec-start":
      return { questionId: question.id, choice: start };
    case "fe-portfolio":
      return { questionId: question.id, text: i % 3 === 0 ? `https://${slug(applicant.fullName)}.dev` : `https://github.com/${slug(applicant.fullName)}` };
    // Registered Nurse
    case "rn-apc":
      return { questionId: question.id, answer: i % 6 !== 5 };
    case "rn-shifts":
      return { questionId: question.id, answer: i % 5 !== 2 };
    case "rn-ward":
      return { questionId: question.id, choice: WARDS[i % WARDS.length] };
    case "rn-ipoh":
      return { questionId: question.id, answer: /perak|ipoh/i.test(applicant.location) || i % 2 === 0 };
    case "rn-why":
      return { questionId: question.id, text: NURSE_REASONS[i % NURSE_REASONS.length] };
    // Temporary Event Crew
    case "ec-weekends":
      return { questionId: question.id, answer: i % 4 !== 1 };
    case "ec-stand":
      return { questionId: question.id, answer: i % 7 !== 3 };
    case "ec-transport":
      // A licence isn't a car — about a third get around by train or e-hailing.
      return { questionId: question.id, answer: applicant.drivingLicense !== null && i % 3 !== 1 };
    default:
      // A question added to a dummy posting without an answer here: a plain yes.
      return { questionId: question.id, answer: question.requiredAnswer };
  }
}
