// Shared by /employer and /jobseeker versions of each legal page (see
// LegalPageView) — the policy itself doesn't change by role, only its
// colour does, so there's exactly one copy of each document here.
//
// Draft text reflecting what the product actually does (third-party sign-in,
// phone verification by text/call, account emails, AI resume parsing/
// assistant, uploaded files, AI interview recordings) — without naming the
// specific vendors behind each, so this text doesn't need updating if a
// vendor changes. Not reviewed by a lawyer — read it over (and have counsel
// check it) before relying on it.

export type LegalSection = { heading: string; paragraphs?: string[]; bullets?: string[] };
export type LegalDoc = { title: string; lastUpdated: string; intro: string; sections: LegalSection[] };

export const PRIVACY_POLICY: LegalDoc = {
  title: "Privacy Policy",
  lastUpdated: "October 2026",
  intro:
    "This explains what JobGiga collects, why, and what you can do about it. It applies whether you're hiring or job hunting.",
  sections: [
    {
      heading: "What we collect",
      bullets: [
        "Account basics from sign-in: your name, email and profile photo.",
        "Jobseeker profiles: resume, work history, education, skills, phone number, location, certifications, and an optional video pitch.",
        "Employer profiles: company details, the SSM registration document you upload for verification, and your team members' details.",
        "What you do on JobGiga: job postings viewed, applications submitted, and basic device/browser info, kept for security and to fix problems.",
      ],
    },
    {
      heading: "How we use it",
      bullets: [
        "To match jobseekers with postings and let employers review who applied.",
        "To verify a phone number with a one-time code, sent by text or call.",
        "To read a resume and fill in a profile for you, and to power the AI assistant and cover-letter writer — your content is sent to our AI service provider to generate that one response, not used to train their models.",
        "To send account emails: verification codes, application updates, team invites.",
      ],
    },
    {
      heading: "Who we share it with",
      paragraphs: ["An employer sees a jobseeker's full profile once that person applies to one of their postings — never before. We don't sell personal data."],
      bullets: [
        "A sign-in provider, to let you sign in without JobGiga handling your password.",
        "A messaging provider, to send the phone verification code.",
        "An email provider, to send account emails.",
        "An AI service provider, to parse resumes and power AI features, as above.",
      ],
    },
    {
      heading: "Where it's kept",
      paragraphs: [
        "Uploaded files (resumes, avatars, certifications, company logos, job posters) are stored on our servers behind access controls. Video pitches and AI interview recordings are kept separately and are only reachable through a permission check — never a public link.",
      ],
    },
    {
      heading: "How long we keep it",
      paragraphs: [
        "We keep your data while your account is active. AI interview recordings are kept for 30 days and then deleted automatically. An employer can delete their company account from Company Profile, which removes its data; if you'd like your jobseeker account and its data removed, contact us and we'll take care of it.",
      ],
    },
    {
      heading: "Your rights",
      paragraphs: [
        "You can review and update most of your information yourself from your profile. For anything else — a copy of your data, a correction, or deleting your account — contact us using the details below.",
      ],
    },
    {
      heading: "Children",
      paragraphs: ["JobGiga is for people old enough to legally work in Malaysia, and isn't intended for children."],
    },
    {
      heading: "Changes to this policy",
      paragraphs: ["If this policy changes in a way that matters, we'll update the date at the top and let you know."],
    },
    {
      heading: "Contact us",
      paragraphs: ["Questions about this policy or your data? Reach us at the contact details on our Company Profile, or through the AI assistant."],
    },
  ],
};

export const SECURITY_POLICY: LegalDoc = {
  title: "Security",
  lastUpdated: "October 2026",
  intro: "How JobGiga protects your account and the data in it.",
  sections: [
    {
      heading: "Signing in",
      paragraphs: [
        "Sign-in goes through a trusted sign-in provider — JobGiga never sees or stores your password. For an extra layer where it matters (like a phone number on your profile), we verify it with a one-time code rather than trusting what's typed in.",
      ],
    },
    {
      heading: "Your session",
      paragraphs: [
        "Once you're signed in, your session is a short-lived, signed cookie — not something a page's own code can read or tamper with. It's checked on every request that touches your account or data.",
      ],
    },
    {
      heading: "Your data in transit and at rest",
      paragraphs: [
        "Traffic between your browser and JobGiga is encrypted (HTTPS). Files you upload — resumes, avatars, certifications, company documents — are stored behind access controls, not exposed publicly by default. Video pitches and AI interview recordings go a step further: they're only reachable through a permission check tied to your account, so a guessed or shared link can't reach them.",
      ],
    },
    {
      heading: "Who can see what",
      paragraphs: [
        "An employer only sees a jobseeker's profile once that person has actually applied to one of their postings. Within a company, team roles (owner, hiring manager, panel) decide who can edit a posting, see applicants, or just sit on an interview panel — not everyone on a team automatically sees everything.",
      ],
    },
    {
      heading: "Keeping the platform itself secure",
      paragraphs: [
        "We apply security updates to the systems JobGiga runs on, and changes to the product go through review before they ship. If you believe you've found a security issue, please tell us rather than testing it against real accounts or data — see Contact below.",
      ],
    },
    {
      heading: "Contact us",
      paragraphs: ["Found a security problem, or have a question about how something's protected? Reach us at the contact details on our Company Profile, or through the AI assistant."],
    },
  ],
};

export const TERMS_AND_CONDITIONS: LegalDoc = {
  title: "Terms & Conditions",
  lastUpdated: "October 2026",
  intro: "The basics of using JobGiga, for employers and jobseekers alike.",
  sections: [
    {
      heading: "Using JobGiga",
      paragraphs: [
        "You need an account to post jobs or apply to them. You're responsible for keeping your sign-in secure and for what happens under your account — tell us if you think someone else has access to it.",
      ],
    },
    {
      heading: "What you post",
      bullets: [
        "Job postings must describe a real role you're genuinely hiring for, with accurate pay, requirements and location.",
        "Your profile, resume and any documents you upload (including an SSM registration document) must be accurate and belong to you or your company.",
        "No discriminatory, misleading or illegal postings or profile content.",
      ],
    },
    {
      heading: "AI features",
      paragraphs: [
        "JobGiga uses AI to parse resumes, draft job postings, write cover letters and power the assistant. It's a drafting tool, not a decision-maker — review anything it produces before relying on it, and you're responsible for what you ultimately post or submit.",
      ],
    },
    {
      heading: "Company verification",
      paragraphs: [
        "Employers may be asked to upload an SSM registration document so we can verify the company is real. A badge on a verified company reflects that we checked this document — it isn't an endorsement of the company or any posting it makes.",
      ],
    },
    {
      heading: "What you can't do",
      bullets: [
        "Scrape, copy or resell data from JobGiga.",
        "Impersonate a company or person you're not.",
        "Try to access another account or data you're not meant to see.",
        "Use the platform to do anything illegal under Malaysian law.",
      ],
    },
    {
      heading: "Accounts and postings we may remove",
      paragraphs: [
        "We may remove a posting, suspend or close an account that breaks these terms, without it affecting anyone else's use of JobGiga.",
      ],
    },
    {
      heading: "No guarantee of a hire or a job",
      paragraphs: [
        "JobGiga helps employers and jobseekers find each other — it doesn't guarantee a hire, an interview, or a job offer. Hiring decisions are always the employer's own.",
      ],
    },
    {
      heading: "Changes to these terms",
      paragraphs: ["If these terms change in a way that matters, we'll update the date at the top and let you know."],
    },
    {
      heading: "Governing law",
      paragraphs: ["These terms are governed by the laws of Malaysia."],
    },
    {
      heading: "Contact us",
      paragraphs: ["Questions about these terms? Reach us at the contact details on our Company Profile, or through the AI assistant."],
    },
  ],
};
