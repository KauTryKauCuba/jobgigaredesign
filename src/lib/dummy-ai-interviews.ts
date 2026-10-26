// Sample AI interviews for "Get dummy data" — a few shortlisted dummy
// applicants (matched by name) each get one, in a different state, so the
// AI interview panel has something real to show: finished reports at three
// levels, one half-answered, one just sent, one that ran out of time.
// No server-only imports: scripts/generate-dummy-ai-interview-audio.ts reads
// the transcripts from here to record the sample answers.
import type { AiInterviewAnswerEvaluation, AiInterviewReport } from "./ai-interview-shared";

export type DummyAiQuestion = { question: string; keyPoints: string[] };

// Five questions per job, the way the employer approved them.
export const DUMMY_AI_QUESTION_SETS: Record<string, DummyAiQuestion[]> = {
  "Frontend Engineer": [
    {
      question: "A page in your React app feels slow when the user types into a search box. How would you find the cause and fix it?",
      keyPoints: [
        "Profile with React DevTools or the browser's performance tools",
        "Look for unnecessary re-renders",
        "Debounce the input or the search call",
        "Memoise expensive work (useMemo / React.memo)",
        "Virtualise long result lists",
      ],
    },
    {
      question: "How do you make a form usable for someone on a screen reader, or using only a keyboard?",
      keyPoints: [
        "Every input has a proper label",
        "Logical tab order and a visible focus style",
        "Errors announced and linked to their field",
        "Semantic HTML before ARIA",
        "Test with a screen reader or keyboard only",
      ],
    },
    {
      question: "When would you keep state inside a component, lift it up, or put it in context or a global store?",
      keyPoints: [
        "Keep state as close as possible to where it's used",
        "Lift state up when siblings need it",
        "Context or a store for app-wide data (user, theme)",
        "Server data belongs in a data-fetching cache",
        "Don't duplicate state that can be derived",
      ],
    },
    {
      question: "A designer hands you a Figma screen that breaks on small phones. What do you do?",
      keyPoints: [
        "Raise it with the designer early instead of guessing",
        "Mobile-first responsive layout (flex/grid, breakpoints)",
        "Agree how edge cases behave (long text, narrow widths)",
        "Test on real devices or device emulation",
        "Stay consistent with the design system",
      ],
    },
    {
      question: "How do you make sure a feature you ship doesn't break something else?",
      keyPoints: [
        "Unit tests for logic, end-to-end tests for key flows",
        "Code review before merging",
        "Type checks and linting in CI",
        "Check it on a preview or staging environment",
        "Watch for errors after release and be ready to roll back",
      ],
    },
  ],
  "Backend Engineer": [
    {
      question: "An API endpoint that used to take 100 ms now takes 3 seconds. How do you track down why?",
      keyPoints: [
        "Use logs, metrics or APM to find where the time goes",
        "Inspect slow database queries (EXPLAIN / query plan)",
        "Check for missing indexes or N+1 queries",
        "Compare with recent deploys or data growth",
        "Add caching only after finding the cause",
      ],
    },
    {
      question: "How do you change a database column that live traffic depends on, without downtime?",
      keyPoints: [
        "Expand first: add the new column alongside the old",
        "Backfill the data in batches",
        "Deploy code that reads and writes both",
        "Remove the old column in a later release",
        "Have a rollback plan",
      ],
    },
    {
      question: "How do you design a REST API so web and mobile apps don't break when it changes?",
      keyPoints: [
        "Version the API or keep changes backwards-compatible",
        "Deprecate fields before removing or renaming them",
        "Consistent error format and status codes",
        "Document the contract (e.g. OpenAPI)",
        "Paginate list endpoints",
      ],
    },
    {
      question: "A payment webhook sometimes arrives twice. How do you stop a customer being charged or credited twice?",
      keyPoints: [
        "Make the handler idempotent",
        "Store and check the unique event ID",
        "Enforce it with a unique constraint or transaction",
        "Verify the webhook signature",
        "Acknowledge quickly and process in the background",
      ],
    },
    {
      question: "What do you look for when reviewing a teammate's pull request?",
      keyPoints: [
        "Correctness and edge cases",
        "Tests that cover the change",
        "Security: input validation, auth, secrets",
        "Readability and naming",
        "Performance impact (queries, loops)",
      ],
    },
  ],
  "Registered Nurse": [
    {
      question: "A post-operative patient's blood pressure suddenly drops and they look pale. What do you do first?",
      keyPoints: [
        "Stay with the patient and call for help",
        "Check airway, breathing and circulation",
        "Look for bleeding at the wound or drains",
        "Inform the doctor promptly (e.g. using SBAR)",
        "Monitor vital signs closely and document",
      ],
    },
    {
      question: "How do you make sure you give the right medication to the right patient?",
      keyPoints: [
        "Follow the rights of medication administration",
        "Check the ID band against the chart",
        "Check allergies before giving",
        "Double-check high-alert drugs with a second nurse",
        "Document straight after giving",
      ],
    },
    {
      question: "What do you include when handing a patient over to the next shift?",
      keyPoints: [
        "Diagnosis and current condition",
        "Recent vital signs and any changes",
        "Medications given and due",
        "Pending tests or results",
        "Risks such as falls, pressure sores or allergies",
      ],
    },
    {
      question: "A patient's family is upset because they haven't seen a doctor all day. How do you handle it?",
      keyPoints: [
        "Listen calmly and acknowledge their concern",
        "Explain what you can, within confidentiality",
        "Find out when the doctor will come and tell them",
        "Escalate to the doctor or ward sister if needed",
        "Follow up so they aren't left waiting",
      ],
    },
    {
      question: "How do you stop infections spreading between patients on the ward?",
      keyPoints: [
        "Hand hygiene (the five moments)",
        "Correct use of PPE",
        "Isolate infectious patients when needed",
        "Clean equipment between patients",
        "Safe handling of sharps and clinical waste",
      ],
    },
  ],
};

export type DummyAiAnswer = {
  // What they said (the sample clip reads exactly this).
  transcript: string;
  // Only on scored interviews — an in-progress one isn't transcribed or scored yet.
  evaluation?: AiInterviewAnswerEvaluation;
};

export type DummyAiInterview = {
  applicantName: string;
  jobTitle: string;
  status: "completed" | "in_progress" | "invited" | "expired";
  // Seconds allowed per answer when it was sent.
  answerSeconds: 30 | 60;
  // The sample answer clips: assets/sample-ai-interview/<clipKey>-<n>.m4a,
  // read in this macOS voice (see the generate script).
  clipKey?: string;
  voice?: string;
  answers: DummyAiAnswer[];
  report?: AiInterviewReport;
};

function evaluation(
  score: number,
  covered: string[],
  missed: string[],
  quote: string | null,
  summary: string,
): AiInterviewAnswerEvaluation {
  return { score, covered, missed, quote, summary };
}

const FE = DUMMY_AI_QUESTION_SETS["Frontend Engineer"].map((q) => q.keyPoints);
const BE = DUMMY_AI_QUESTION_SETS["Backend Engineer"].map((q) => q.keyPoints);

export const DUMMY_AI_INTERVIEWS: DummyAiInterview[] = [
  {
    applicantName: "Michelle Tan Wei Xuan",
    jobTitle: "Frontend Engineer",
    status: "completed",
    answerSeconds: 60,
    clipKey: "michelle-frontend",
    voice: "Samantha",
    answers: [
      {
        transcript:
          "First I'd open the React profiler and record a few keystrokes to see which components re-render. Usually the whole results list re-renders on every key press. I'd debounce the search so it only runs after the user stops typing for about three hundred milliseconds, wrap the result rows in React.memo, and if the list is long, I'd virtualise it so only the visible rows are rendered. Then I'd profile again to confirm it's actually faster.",
        evaluation: evaluation(
          5,
          FE[0],
          [],
          "I'd debounce the search so it only runs after the user stops typing for about three hundred milliseconds",
          "Measures first, then debounces, memoises and virtualises — and checks the result again.",
        ),
      },
      {
        transcript:
          "I start with proper HTML, so a real label for every input and a real button for submit, not a div. I check the whole form works with only the tab key, in a sensible order, with a visible focus ring. For errors, I link the message to its field with aria-describedby so the screen reader reads it out. Before shipping I test it with VoiceOver on my Mac.",
        evaluation: evaluation(
          5,
          FE[1],
          [],
          "I link the message to its field with aria-describedby so the screen reader reads it out",
          "Covers labels, keyboard order, focus, linked errors and testing with a real screen reader.",
        ),
      },
      {
        transcript:
          "I keep state in the component that uses it. If two sibling components need the same value, I lift it up to their parent. For things the whole app needs, like the signed-in user or the theme, I use context. I try not to put everything in a global store, because it makes every change harder to follow.",
        evaluation: evaluation(
          3,
          [FE[2][0], FE[2][1], FE[2][2]],
          [FE[2][3], FE[2][4]],
          "If two sibling components need the same value, I lift it up to their parent.",
          "Correct on local, lifted and app-wide state, but didn't mention server data or derived state.",
        ),
      },
      {
        transcript:
          "I'd raise it with the designer straight away and show them on my phone where it breaks, rather than guessing a fix. Usually we agree together how it should stack on small screens. I build mobile first with flexbox or grid and a couple of breakpoints, and I test long names and narrow widths in the browser's device mode.",
        evaluation: evaluation(
          4,
          [FE[3][0], FE[3][1], FE[3][2], FE[3][3]],
          [FE[3][4]],
          "I'd raise it with the designer straight away and show them on my phone where it breaks",
          "Talks to the designer first and builds mobile-first; didn't mention the design system.",
        ),
      },
      {
        transcript:
          "I write unit tests for the logic and a Playwright test for the main user flow. The pull request runs TypeScript, lint and the tests in CI, and a teammate reviews it. We check it on the preview deployment first. After release I watch Sentry for new errors, and if something breaks, we roll back.",
        evaluation: evaluation(
          5,
          FE[4],
          [],
          "After release I watch Sentry for new errors, and if something breaks, we roll back.",
          "A complete routine: tests, CI checks, review, preview, monitoring and rollback.",
        ),
      },
    ],
    report: {
      level: "strong",
      recommendation: "interview",
      averageScore: 4.4,
      summary:
        "Michelle showed solid, hands-on frontend knowledge. She measures before optimising, builds accessible forms by default and has a clear testing and release routine. Her answer on where to keep state was right but skipped server data and derived state.",
      gaps: ["Caching server data", "Avoiding duplicated derived state", "Working within a design system"],
      followUps: [
        "How do you handle data from the server — loading states, caching and refetching?",
        "Walk us through a performance problem you actually fixed. What did the profiler show?",
        "How have you kept components consistent with a design system across a team?",
      ],
      model: "deepseek-chat",
    },
  },
  {
    applicantName: "Anitha Devi",
    jobTitle: "Backend Engineer",
    status: "completed",
    answerSeconds: 60,
    clipKey: "anitha-backend",
    voice: "Lekha",
    answers: [
      {
        transcript:
          "I'd start with our logs and the APM dashboard to see which part of the request is slow. Most of the time it's the database, so I'd run EXPLAIN on the query and check whether it's doing a full table scan because an index is missing. I'd also check if anything was deployed around the time it got slow.",
        evaluation: evaluation(
          4,
          [BE[0][0], BE[0][1], BE[0][2], BE[0][3]],
          [BE[0][4]],
          "I'd run EXPLAIN on the query and check whether it's doing a full table scan because an index is missing",
          "Good, evidence-first debugging: traces, query plan, indexes and recent deploys.",
        ),
      },
      {
        transcript:
          "I would add the new column first, copy the data across with a script, then switch the code over to the new column. After that I can drop the old column. I'd do it at night when traffic is low, just in case.",
        evaluation: evaluation(
          3,
          [BE[1][0], BE[1][1]],
          [BE[1][2], BE[1][3], BE[1][4]],
          "I'd do it at night when traffic is low, just in case.",
          "Right first steps, but switching the code in one go and relying on a quiet night isn't zero-downtime.",
        ),
      },
      {
        transcript:
          "We put the version in the URL, like v1 and v2, so older apps keep working. I also write the API docs in Swagger, so the mobile team knows what every endpoint returns.",
        evaluation: evaluation(
          3,
          [BE[2][0], BE[2][3]],
          [BE[2][1], BE[2][2], BE[2][4]],
          "We put the version in the URL, like v1 and v2, so older apps keep working.",
          "Versioning and docs are covered; nothing on deprecation, error format or pagination.",
        ),
      },
      {
        transcript:
          "The webhook has an event ID, so I save every ID we've processed in a table with a unique constraint. If the same ID comes again, the insert fails and we just return 200 without doing anything else. I'd also verify the signature, so nobody can send us a fake webhook.",
        evaluation: evaluation(
          4,
          [BE[3][0], BE[3][1], BE[3][2], BE[3][3]],
          [BE[3][4]],
          "I save every ID we've processed in a table with a unique constraint",
          "A sound idempotent design with signature checks; didn't mention processing in the background.",
        ),
      },
      {
        transcript:
          "I mostly check that the code works and follows our style guide, and that the variable names make sense.",
        evaluation: evaluation(
          2,
          [BE[4][3]],
          [BE[4][0], BE[4][1], BE[4][2], BE[4][4]],
          "I mostly check that the code works and follows our style guide",
          "Very brief — only style and naming, with no mention of tests, security or performance.",
        ),
      },
    ],
    report: {
      level: "partial",
      recommendation: "maybe",
      averageScore: 3.2,
      summary:
        "Anitha has good debugging instincts and handled the duplicate-webhook question well. Her zero-downtime migration plan and code-review checklist were thin: no dual-write step, no rollback plan, and nothing on tests or security when reviewing.",
      gaps: ["Zero-downtime migrations", "Security and tests in code review", "Deprecating API fields safely"],
      followUps: [
        "Walk us through a migration you shipped. What would you do if it had to be rolled back halfway?",
        "What security problems do you look for when reviewing an API change?",
        "How would you remove a field that older mobile app versions still read?",
      ],
      model: "deepseek-chat",
    },
  },
  {
    applicantName: "Ashwin Balakrishnan",
    jobTitle: "Frontend Engineer",
    status: "completed",
    answerSeconds: 30,
    clipKey: "ashwin-frontend",
    voice: "Rishi",
    answers: [
      {
        transcript:
          "I think I would check the code and see what is wrong. Maybe the API is slow, so I would ask the backend team to make it faster. I can also add a loading spinner so the user knows it is searching.",
        evaluation: evaluation(
          1,
          [],
          FE[0],
          "Maybe the API is slow, so I would ask the backend team to make it faster.",
          "Guessed at the cause without measuring anything; a spinner doesn't make it faster.",
        ),
      },
      {
        transcript:
          "For accessibility I would add alt text on the images and make sure the colours have good contrast. And every field should have placeholder text, so people know what to type.",
        evaluation: evaluation(
          2,
          [],
          FE[1],
          "every field should have placeholder text, so people know what to type",
          "Alt text and contrast matter, but not for this form — and a placeholder isn't a label.",
        ),
      },
      {
        transcript:
          "If the state is only used in one component, I keep it there. If many components need it, I use Redux, because then every component can get the data easily.",
        evaluation: evaluation(
          3,
          [FE[2][0], FE[2][2]],
          [FE[2][1], FE[2][3], FE[2][4]],
          "If the state is only used in one component, I keep it there.",
          "Knows local versus shared state, but reaches for Redux where lifting state up would do.",
        ),
      },
      {
        transcript:
          "I would try to make it look the same as the Figma on the small phone, maybe make the font smaller or hide some parts. Then I show the designer when it is done.",
        evaluation: evaluation(
          2,
          [],
          FE[3],
          "maybe make the font smaller or hide some parts",
          "Patches it alone and tells the designer afterwards; no responsive approach described.",
        ),
      },
      {
        transcript:
          "I test it myself on the staging site before it goes live, and someone in the team reviews the code. If there's a bug later, QA will normally find it.",
        evaluation: evaluation(
          3,
          [FE[4][1], FE[4][3]],
          [FE[4][0], FE[4][2], FE[4][4]],
          "If there's a bug later, QA will normally find it.",
          "Review and a staging check, but no automated tests and relies on QA to catch problems.",
        ),
      },
    ],
    report: {
      level: "weak",
      recommendation: "pass",
      averageScore: 2.2,
      summary:
        "Ashwin knows some frontend basics but answered mostly in general terms. He didn't describe how he'd measure a performance problem, confused placeholders with labels, and relies on QA rather than automated tests.",
      gaps: ["Measuring performance before fixing it", "Accessible forms", "Automated testing", "Responsive layouts"],
      followUps: [
        "Show us how you'd use the browser's performance tools on a slow page.",
        "What's the difference between a placeholder and a label for a screen-reader user?",
        "Have you written automated tests before? What did they cover?",
      ],
      model: "deepseek-chat",
    },
  },
  {
    applicantName: "Xin Yi Lee",
    jobTitle: "Registered Nurse",
    status: "in_progress",
    answerSeconds: 60,
    clipKey: "xinyi-nurse",
    voice: "Karen",
    // Two of five recorded so far — not transcribed or scored until she submits.
    answers: [
      {
        transcript:
          "First I'd stay with the patient, call for help and check their airway, breathing and pulse. I'd lie them flat and raise their legs, check the wound and the drain for bleeding, and inform the doctor straight away using SBAR. Then I'd keep monitoring the vital signs every few minutes and document everything.",
      },
      {
        transcript:
          "I always follow the rights of medication: right patient, right drug, right dose, right route and right time. I check the patient's wristband against the chart, ask them their name and date of birth, and check for allergies. For high-alert drugs like insulin, a second nurse double-checks with me.",
      },
    ],
  },
  { applicantName: "Harish Ramanathan", jobTitle: "Backend Engineer", status: "invited", answerSeconds: 30, answers: [] },
  { applicantName: "Devika Sivaraj", jobTitle: "Registered Nurse", status: "expired", answerSeconds: 60, answers: [] },
];

export function dummyClipName(clipKey: string, position: number) {
  return `${clipKey}-${position}.m4a`;
}
