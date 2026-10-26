// Shared between the "Get dummy data" button's API route and the one-off
// seed-my-jobs.ts script. postingName marks these as dummy (that field is
// internal-only, never shown to jobseekers) so "Remove dummy data" can find
// and delete exactly these rows without touching real postings.
import type { CustomQuestion } from "./screening-questions";

export const DUMMY_POSTING_MARKER = "__dummy__";

type WorkAuthorization = "citizen" | "permanent_resident" | "work_pass_holder" | "needs_sponsorship";
function wa(...values: WorkAuthorization[]): WorkAuthorization[] {
  return values;
}

type Language = { language: string; dialect: string | null; level: "basic" | "conversational" | "fluent" | "native" };
// No dialect = any dialect of the language (see src/lib/languages.ts).
function lang(language: string, level: Language["level"], dialect: string | null = null): Language {
  return { language, dialect, level };
}

// The office address, saved the way the Post a job form saves it: the full
// structured address, plus `location` as the short "City, State" string
// shown on cards. State is one of MALAYSIA_STATES (src/lib/malaysia.ts).
function office(addressLine1: string, city: string, state: string, postcode: string, addressLine2: string | null = null) {
  return { location: `${city}, ${state}`, addressLine1, addressLine2, city, state, postcode };
}

// Benefits (Malaysia's statutory EPF/SOCSO/EIS first, like the form's
// list), how soon the hire should start, and working hours — all values
// from src/lib/job-posting-options.ts.
type StartAvailability = "immediate" | "one_week" | "two_weeks" | "one_month" | "two_months" | "flexible";
function terms(benefits: string[], startAvailability: StartAvailability, workingHours: string) {
  return { benefits, startAvailability, workingHours };
}
const STATUTORY = ["EPF", "SOCSO", "EIS"];

// The picker's ready-made "When can you start?" question (SUGGESTED_QUESTION_GROUPS).
function START_QUESTION(id: string): CustomQuestion {
  return {
    id,
    question: "When can you start?",
    type: "choice",
    requiredAnswer: true,
    options: ["Immediately", "Within 1 month", "Within 2 months", "More than 2 months"],
  };
}

export const DUMMY_JOB_POSTINGS = [
  {
    title: "Frontend Engineer",
    description:
      "We're looking for a Frontend Engineer to join our product team and help build the customer-facing side of our web app. You'll work closely with design and backend engineers to ship polished, accessible interfaces used by thousands of customers every day, and you'll have real ownership over how features look and feel — not just implementing mockups, but pushing back on UX decisions when something doesn't sit right.",
    responsibilities:
      "Implement UI from Figma designs with an eye for pixel-level detail · Build and maintain a reusable React component library · Collaborate with backend engineers on API contracts and data shapes · Write unit and integration tests for critical user flows · Profile and improve page load and runtime performance · Participate in code reviews and help raise the frontend codebase's overall quality bar",
    industry: "Information Technology & Software",
    employmentType: "full_time" as const,
    workArrangement: "hybrid" as const,
    officeDaysPerWeek: 3,
    ...office("Level 15, Menara Ilham", "Kuala Lumpur", "Kuala Lumpur", "50450", "8 Jalan Binjai"),
    ...terms([...STATUTORY, "Medical insurance", "Remote/hybrid work", "Training & development", "Performance bonus"], "one_month", "Mon–Fri, 9am–6pm"),
    salaryMin: 5000,
    salaryMax: 8000,
    openings: 2,
    skills: ["React", "TypeScript", "Tailwind CSS"],
    softSkills: ["Communication", "Teamwork", "Attention to detail"],
    niceToHaveSkills: ["Next.js", "GraphQL", "Testing (Jest/Playwright)", "Figma", "Accessibility (WCAG)"],
    minYearsExperience: 2,
    minQualificationTier: "Degree",
    languages: [lang("English", "fluent"), lang("Malay", "conversational")],
    workAuthorizations: wa("citizen", "permanent_resident"),
    status: "active" as const,
    // Screening on (as on the nurse and event crew postings), so "Get dummy
    // data" also demos screeningEligible-based matching (see
    // src/app/api/employer/applicants/matches/route.ts) instead of every
    // dummy application falling through to the profile-derived hard filter.
    // A degree and Malay are nice to have here, not must-haves.
    screeningEnabled: true,
    screeningPreferred: ["qualificationTier", "languages"],
    customScreeningQuestions: [
      { id: "hybrid-ok", question: "Comfortable with a hybrid schedule (3 days in office)?", requiredAnswer: true },
      { id: "fe-react-years", question: "Years of hands-on React experience?", type: "number", requiredAnswer: true, minNumber: 3, preferred: true },
      { ...START_QUESTION("fe-start"), acceptedOptions: ["Immediately", "Within 1 month"], preferred: true },
      { id: "fe-portfolio", question: "Link to your portfolio or GitHub?", type: "text", requiredAnswer: true },
    ] satisfies CustomQuestion[],
  },
  {
    title: "Backend Engineer",
    description:
      "As a Backend Engineer, you'll design and scale the services behind our platform, with a strong focus on reliability, data integrity, and clean API design. You'll take ownership of entire slices of the system — from schema design through to production monitoring — and work directly with product and frontend teams to shape how our platform evolves as we grow.",
    responsibilities:
      "Design and document REST APIs consumed by web and mobile clients · Own database schema changes and write safe, reversible migrations · Write automated tests covering critical business logic · Monitor service health and respond to production incidents · Optimize slow queries and identify scaling bottlenecks before they become urgent · Mentor junior engineers on backend best practices",
    industry: "Information Technology & Software",
    employmentType: "full_time" as const,
    workArrangement: "onsite" as const,
    ...office("Unit 8-1, Menara Uptown 1", "Petaling Jaya", "Selangor", "47400", "Jalan SS 21/58, Damansara Uptown"),
    ...terms([...STATUTORY, "Medical insurance", "Dental coverage", "Performance bonus", "Parking"], "two_months", "Mon–Fri, 9am–6pm"),
    salaryMin: 6000,
    salaryMax: 9500,
    openings: 1,
    skills: ["Node.js", "PostgreSQL", "Drizzle ORM"],
    softSkills: ["Problem solving", "Ownership", "Clear technical writing"],
    niceToHaveSkills: ["AWS", "Docker", "Redis", "System design", "CI/CD pipelines"],
    minYearsExperience: 3,
    minQualificationTier: "Degree",
    languages: [lang("English", "fluent")],
    workAuthorizations: wa("citizen", "permanent_resident", "work_pass_holder"),
    status: "active" as const,
  },
  {
    title: "Store Supervisor",
    description:
      "We're hiring a Store Supervisor to oversee day-to-day operations at one of our busiest retail outlets. You'll manage a small team of retail staff, keep the store running smoothly during peak hours, and make sure every customer walks out having had a great in-store experience. This is a hands-on leadership role for someone who enjoys being on the floor, not behind a desk.",
    responsibilities:
      "Create and manage weekly staff schedules and shift coverage · Conduct regular stock counts and reconcile inventory discrepancies · Handle escalated customer complaints and service recovery · Train new hires on store procedures and customer service standards · Report daily and weekly sales performance to area management · Ensure the store meets visual merchandising and cleanliness standards",
    industry: "Retail & Consumer Goods",
    employmentType: "full_time" as const,
    workArrangement: "onsite" as const,
    ...office("Lot G-23, Sunway Pyramid", "Subang Jaya", "Selangor", "47500", "3 Jalan PJS 11/15, Bandar Sunway"),
    ...terms([...STATUTORY, "Staff discount", "Meal allowance", "Festive bonus"], "two_weeks", "Rotating shifts, incl. weekends"),
    salaryMin: 2800,
    salaryMax: 3800,
    openings: 3,
    skills: ["Inventory management", "POS systems"],
    softSkills: ["Leadership", "Customer service", "Conflict resolution"],
    niceToHaveSkills: ["Visual merchandising", "Sales reporting", "Staff training"],
    minYearsExperience: 1,
    minQualificationTier: "SPM",
    languages: [lang("English", "conversational"), lang("Malay", "fluent")],
    drivingLicense: "b" as const,
    workAuthorizations: wa("citizen"),
    status: "pending" as const,
  },
  {
    title: "Registered Nurse",
    description:
      "We're looking for a compassionate, detail-oriented Registered Nurse to provide direct patient care in a fast-paced clinical environment. You'll work alongside doctors and fellow nurses across shifts to deliver safe, high-quality care, and you'll be a key point of contact for patients and their families during what's often a stressful time for them.",
    responsibilities:
      "Monitor and record patient vital signs and report changes promptly · Administer medication and treatments as prescribed · Assist doctors during examinations and procedures · Maintain accurate, up-to-date patient records and handover notes · Educate patients and families on post-treatment care · Follow infection control and safety protocols at all times",
    industry: "Healthcare & Medical",
    employmentType: "full_time" as const,
    workArrangement: "onsite" as const,
    ...office("Jalan Raja Dihilir", "Ipoh", "Perak", "30350"),
    ...terms([...STATUTORY, "Medical insurance", "Life insurance", "Extra annual leave", "Housing allowance"], "one_month", "Rotating shifts, incl. weekends"),
    salaryMin: 3500,
    salaryMax: 5000,
    openings: 4,
    skills: ["Patient care", "Clinical documentation"],
    softSkills: ["Empathy", "Attention to detail", "Composure under pressure"],
    niceToHaveSkills: ["IV Therapy", "Electronic Health Records", "Basic Life Support (BLS) certification"],
    minYearsExperience: 2,
    minQualificationTier: "Diploma",
    languages: [lang("English", "conversational"), lang("Malay", "fluent")],
    workAuthorizations: wa("citizen", "permanent_resident"),
    status: "active" as const,
    screeningEnabled: true,
    customScreeningQuestions: [
      { id: "rn-apc", question: "Do you hold a valid Annual Practising Certificate (APC)?", requiredAnswer: true },
      { id: "rn-shifts", question: "Able to work rotating shifts, including nights?", requiredAnswer: true },
      {
        id: "rn-ward",
        question: "Which ward have you worked in most?",
        type: "choice",
        requiredAnswer: true,
        options: ["Medical", "Surgical", "ICU / Critical care", "Emergency", "Paediatrics", "Other"],
        acceptedOptions: ["Medical", "Surgical", "ICU / Critical care", "Emergency"],
        preferred: true,
      },
      { id: "rn-ipoh", question: "Willing to work in Ipoh, Perak?", requiredAnswer: true, preferred: true },
      { id: "rn-why", question: "Why this role?", type: "text", requiredAnswer: true },
    ] satisfies CustomQuestion[],
  },
  {
    title: "Marketing Intern",
    description:
      "Join our marketing team for a 3-month internship where you'll get hands-on experience across content creation, social media, and campaign tracking. This is a great opportunity for someone early in their career to see how a real marketing team operates day to day, with mentorship from senior marketers and real ownership over some of our smaller campaigns.",
    responsibilities:
      "Draft and schedule social media posts across platforms · Track and report on campaign performance metrics · Assist with market and competitor research · Support planning and coordination for marketing events · Help maintain the content calendar and brand asset library",
    industry: "Marketing & Advertising",
    employmentType: "internship" as const,
    workArrangement: "hybrid" as const,
    ...office("Level 5, Wisma Penang Garden", "George Town", "Penang", "10050", "42 Jalan Sultan Ahmad Shah"),
    ...terms(["Transport allowance", "Training & development", "Flexible working hours"], "flexible", "Mon–Fri, 9am–6pm"),
    salaryMin: 1200,
    salaryMax: 1800,
    openings: 1,
    skills: ["Social media", "Content writing"],
    softSkills: ["Creativity", "Adaptability", "Time management"],
    niceToHaveSkills: ["Canva", "SEO Basics", "Video editing"],
    minYearsExperience: 0,
    minQualificationTier: "Diploma",
    languages: [lang("English", "conversational")],
    workAuthorizations: wa("citizen"),
    status: "draft" as const,
  },
  {
    title: "Warehouse Operations Executive",
    description:
      "We're hiring a Warehouse Operations Executive to keep our fulfilment centre running on schedule during a high-growth period. You'll coordinate inbound and outbound shipments, supervise a small crew of pickers and packers, and be the point person when something on the floor needs a quick decision. This role has already filled all its openings for this hiring round.",
    responsibilities:
      "Coordinate daily inbound and outbound shipment schedules · Supervise pickers and packers across shifts · Reconcile stock counts against the warehouse management system · Enforce safety procedures on the warehouse floor · Liaise with logistics partners on delivery timing · Report daily throughput to the operations manager",
    industry: "Logistics & Supply Chain",
    employmentType: "full_time" as const,
    workArrangement: "onsite" as const,
    ...office("Lot 12, Jalan Utas 15/7", "Shah Alam", "Selangor", "40200", "Seksyen 15"),
    ...terms([...STATUTORY, "Medical insurance", "Personal accident insurance", "Meal allowance", "Parking"], "two_weeks", "Mon–Sat, alternate Saturdays"),
    salaryMin: 3200,
    salaryMax: 4200,
    openings: 2,
    skills: ["Warehouse management systems", "Inventory reconciliation"],
    softSkills: ["Leadership", "Time management", "Problem solving"],
    niceToHaveSkills: ["Forklift certification", "Lean/Six Sigma basics"],
    minYearsExperience: 2,
    minQualificationTier: "Diploma",
    languages: [lang("English", "conversational"), lang("Malay", "fluent")],
    drivingLicense: "b" as const,
    workAuthorizations: wa("citizen", "permanent_resident"),
    status: "filled" as const,
  },
  {
    title: "Junior Graphic Designer",
    description:
      "We're looking for a Junior Graphic Designer to support our brand and marketing team with day-to-day visual assets. This seasonal hire supported a product launch campaign; the role has since closed as the campaign wrapped and headcount for the position was not renewed.",
    responsibilities:
      "Design social media graphics and ad creatives from brand guidelines · Resize and adapt existing assets across formats and platforms · Support the design lead on campaign mockups and mood boards · Organize and maintain the shared asset library · Incorporate feedback quickly across multiple review rounds",
    industry: "Marketing & Advertising",
    employmentType: "contract" as const,
    workArrangement: "hybrid" as const,
    officeDaysPerWeek: 2,
    ...office("Level 9, The Gardens North Tower", "Kuala Lumpur", "Kuala Lumpur", "59200", "Mid Valley City, Lingkaran Syed Putra"),
    ...terms([...STATUTORY, "Remote/hybrid work", "Phone/internet allowance"], "one_week", "Mon–Fri, 9am–6pm"),
    salaryMin: 2500,
    salaryMax: 3200,
    openings: 1,
    skills: ["Adobe Photoshop", "Adobe Illustrator", "Figma"],
    softSkills: ["Creativity", "Attention to detail", "Time management"],
    niceToHaveSkills: ["Motion graphics", "Canva", "Brand systems"],
    minYearsExperience: 1,
    minQualificationTier: "Diploma",
    languages: [lang("English", "conversational")],
    workAuthorizations: wa("citizen"),
    status: "closed" as const,
  },
  {
    title: "Telesales Executive",
    description:
      "We're hiring a Telesales Executive to handle outbound calls and convert warm leads into paying customers. This posting was returned by our review team for revision before it can go live — see the note below.",
    responsibilities:
      "Make outbound sales calls from a provided lead list · Explain product features and pricing clearly over the phone · Log every call outcome in the CRM · Follow up on leads that don't convert on the first call · Meet weekly and monthly conversion targets",
    industry: "Sales & Business Development",
    employmentType: "full_time" as const,
    workArrangement: "onsite" as const,
    ...office("Level 3, Menara MSC Cyberport", "Johor Bahru", "Johor", "80000", "5 Jalan Bukit Meldrum"),
    ...terms([...STATUTORY, "Performance bonus", "Transport allowance"], "immediate", "Mon–Fri, 8:30am–5:30pm"),
    salaryMin: 2200,
    salaryMax: 3000,
    openings: 3,
    skills: ["Cold calling", "CRM software"],
    softSkills: ["Persuasion", "Resilience", "Communication"],
    niceToHaveSkills: ["Bahasa Malaysia negotiation", "Upselling"],
    minYearsExperience: 0,
    minQualificationTier: "SPM",
    // Calling customers in Kelantan — the dialect is the requirement.
    languages: [lang("English", "conversational"), lang("Malay", "fluent", "Kelantanese")],
    workAuthorizations: wa("citizen"),
    status: "rejected" as const,
    rejectionReason:
      "Salary range falls below the minimum wage guideline for full-time roles in this location — please revise before resubmitting.",
  },
  {
    title: "Freelance UI/UX Designer",
    description:
      "We're looking for a freelance UI/UX Designer to help us redesign a handful of key product flows over the next quarter. This is a project-based engagement — you'll work remotely, set your own hours, and be paid per project milestone rather than a monthly salary.",
    responsibilities:
      "Design wireframes and high-fidelity mockups for assigned flows · Run quick async feedback loops with the product team · Deliver a finished Figma file with components and specs per milestone · Join a weekly check-in call to review progress",
    industry: "Information Technology & Software",
    employmentType: "freelance" as const,
    workArrangement: "remote" as const,
    // Remote with no office address — saved as the form does (REMOTE_LOCATION).
    location: "Remote",
    ...terms(["Flexible working hours", "Remote/hybrid work"], "flexible", "Flexible hours"),
    salaryMin: 1500,
    salaryMax: 4000,
    salaryPeriod: "project" as const,
    openings: 1,
    skills: ["Figma", "UI design", "UX research"],
    softSkills: ["Self-direction", "Communication", "Time management"],
    niceToHaveSkills: ["Design systems", "Prototyping", "Usability testing"],
    minYearsExperience: 3,
    minQualificationTier: "Diploma",
    languages: [lang("English", "fluent")],
    workAuthorizations: wa("citizen", "permanent_resident", "work_pass_holder", "needs_sponsorship"),
    status: "active" as const,
  },
  {
    title: "Temporary Event Crew",
    description:
      "We need Temporary Event Crew to support a 2-week product launch roadshow across Klang Valley malls. This is a short, fixed-term engagement covering setup, guest assistance, and teardown each event day.",
    responsibilities:
      "Set up and tear down booth fixtures and signage before/after each event day · Greet and assist visitors at the booth · Hand out promotional materials and collect leads · Report daily attendance and stock usage to the event lead",
    industry: "Hospitality & Tourism",
    employmentType: "temporary" as const,
    workArrangement: "onsite" as const,
    ...office("Lingkaran Syed Putra, Mid Valley City", "Kuala Lumpur", "Kuala Lumpur", "59200"),
    ...terms(["Meal allowance", "Transport allowance"], "immediate", "Weekends only"),
    salaryMin: 100,
    salaryMax: 150,
    salaryPeriod: "day" as const,
    openings: 6,
    skills: ["Customer service", "Event setup"],
    softSkills: ["Reliability", "Energy", "Teamwork"],
    niceToHaveSkills: ["Promotional experience", "Own transport"],
    minYearsExperience: 0,
    minQualificationTier: "SPM",
    languages: [lang("Malay", "fluent"), lang("English", "conversational")],
    workAuthorizations: wa("citizen"),
    status: "active" as const,
    screeningEnabled: true,
    customScreeningQuestions: [
      { id: "ec-weekends", question: "Willing to work weekends?", requiredAnswer: true },
      { id: "ec-stand", question: "Able to stand for long periods?", requiredAnswer: true },
      { id: "ec-transport", question: "Have your own transport?", requiredAnswer: true, preferred: true },
      { ...START_QUESTION("ec-start"), acceptedOptions: ["Immediately"], preferred: true },
    ] satisfies CustomQuestion[],
  },
  {
    title: "Delivery Rider",
    description:
      "We're looking for Delivery Riders to handle last-mile deliveries across the Klang Valley during peak hours. This posting was flagged after a jobseeker report and is currently under review by our team.",
    responsibilities:
      "Pick up and deliver orders within assigned zones · Confirm order accuracy before leaving the pickup point · Communicate delays proactively through the rider app · Handle cash-on-delivery transactions accurately · Maintain the delivery vehicle in safe working condition",
    industry: "Logistics & Supply Chain",
    employmentType: "part_time" as const,
    workArrangement: "onsite" as const,
    ...office("Jalan Puchong Utama 1, Bandar Puchong Utama", "Puchong", "Selangor", "47100"),
    ...terms([...STATUTORY, "Phone/internet allowance", "Personal accident insurance"], "one_week", "Flexible hours"),
    salaryMin: 1800,
    salaryMax: 3000,
    openings: 5,
    skills: ["Navigation apps", "Time management"],
    softSkills: ["Reliability", "Customer service"],
    niceToHaveSkills: ["Own vehicle", "Familiarity with Klang Valley routes"],
    minYearsExperience: 0,
    minQualificationTier: "SPM",
    languages: [lang("Malay", "fluent")],
    drivingLicense: "b2" as const,
    workAuthorizations: wa("citizen"),
    status: "flagged" as const,
    flagReason: "Jobseeker reported that the pay described in the posting didn't match what was offered on interview.",
  },
];
