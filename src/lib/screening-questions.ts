// Custom screening questions and the "Preferred" level — shared by the
// post-a-job form, the apply modal and the server, so it has no server-only
// imports.

export const SCREENING_QUESTION_TYPES = ["yesno", "choice", "number", "text"] as const;
export type ScreeningQuestionType = (typeof SCREENING_QUESTION_TYPES)[number];

export const SCREENING_QUESTION_TYPE_LABEL: Record<ScreeningQuestionType, string> = {
  yesno: "Yes / No",
  choice: "Multiple choice",
  number: "Number",
  text: "Short answer",
};

export const MAX_CHOICE_OPTIONS = 8;

// What the employer saves. A missing `type` is an old yes/no question.
export type CustomQuestion = {
  id: string;
  question: string;
  type?: ScreeningQuestionType;
  // yesno: the answer the applicant must give.
  requiredAnswer: boolean;
  // choice: what applicants pick from, and which picks meet the requirement.
  options?: string[];
  acceptedOptions?: string[];
  // number: the lowest answer that meets the requirement.
  minNumber?: number | null;
  // Meeting it boosts the match score; missing it never makes anyone ineligible.
  preferred?: boolean;
};

// What a jobseeker may see — never the right answer.
export type PublicCustomQuestion = {
  id: string;
  question: string;
  type: ScreeningQuestionType;
  options?: string[];
};

export type CustomAnswer = {
  questionId: string;
  answer?: boolean;
  choice?: string;
  number?: number | null;
  text?: string;
};

// The built-in requirements an employer can mark Preferred.
export const PREFERRABLE_REQUIREMENTS = [
  "yearsExperience",
  "qualificationTier",
  "drivingLicense",
  "languages",
  "workAuthorization",
] as const;
export type PreferrableRequirement = (typeof PREFERRABLE_REQUIREMENTS)[number];

export function questionType(q: { type?: ScreeningQuestionType }): ScreeningQuestionType {
  return q.type ?? "yesno";
}

// Short-answer questions, and choice/number ones with nothing to check
// against, are read by the employer — they can't pass or fail anyone.
export function isScorableQuestion(q: CustomQuestion): boolean {
  switch (questionType(q)) {
    case "yesno":
      return true;
    case "choice":
      return (q.acceptedOptions?.length ?? 0) > 0;
    case "number":
      return q.minNumber != null;
    default:
      return false;
  }
}

export function toPublicQuestion(q: CustomQuestion): PublicCustomQuestion {
  const type = questionType(q);
  return {
    id: q.id,
    question: q.question,
    type,
    ...(type === "choice" ? { options: q.options ?? [] } : {}),
  };
}

// Ready-made questions for the picker. Every one is about what the job
// needs — never about who the applicant is (no pregnancy, age, marital
// status, religion, race, gender or children).
// Yes/No and Short answer are added in one click; Multiple choice and Number
// fill the builder so the employer can set what qualifies.
export type SuggestedQuestion = { question: string; type: ScreeningQuestionType; options?: string[] };
export type SuggestedQuestionGroup = { label: string; items: SuggestedQuestion[] };

const yesNo = (question: string): SuggestedQuestion => ({ question, type: "yesno" });

export const SUGGESTED_QUESTION_GROUPS: SuggestedQuestionGroup[] = [
  {
    label: "Schedule",
    items: [
      yesNo("Willing to work weekends?"),
      yesNo("Able to work rotating shifts?"),
      yesNo("Available for night shifts?"),
      yesNo("Can you work public holidays?"),
    ],
  },
  {
    label: "Location",
    items: [
      yesNo("Willing to relocate?"),
      yesNo("Have your own transport?"),
      yesNo("Able to work on-site?"),
      yesNo("Willing to travel for work?"),
      yesNo("Comfortable commuting 1+ hour?"),
    ],
  },
  {
    label: "Physical",
    items: [
      yesNo("Able to stand for long periods?"),
      yesNo("Able to lift 15kg?"),
      yesNo("Comfortable working outdoors?"),
    ],
  },
  {
    label: "Sales",
    items: [
      yesNo("Comfortable with cold calling?"),
      yesNo("Experience with targets or commission?"),
      { question: "Calls per day?", type: "number" },
    ],
  },
  {
    label: "Tools",
    items: [
      yesNo("Own a laptop?"),
      yesNo("Own a motorcycle or car?"),
      yesNo("Hold a valid CIDB card?"),
      yesNo("Hold a valid food handler card?"),
    ],
  },
  {
    label: "Availability",
    items: [
      {
        question: "When can you start?",
        type: "choice",
        options: ["Immediately", "Within 1 month", "Within 2 months", "More than 2 months"],
      },
      yesNo("Can you do a 3-month contract?"),
    ],
  },
  {
    label: "Experience",
    items: [
      { question: "Years in telemarketing?", type: "number" },
      { question: "Team size you've led?", type: "number" },
    ],
  },
  {
    label: "Short answer",
    items: [
      { question: "Why this role?", type: "text" },
      { question: "Describe your toughest customer.", type: "text" },
    ],
  },
];
