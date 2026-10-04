// The employer contact's actual job title in the company (e.g. "Senior
// Graphic Designer"), separate from `contactRole` (their hiring-function
// category — Founder/Owner, HR Manager, etc). Unlike that short fixed list,
// real job titles span every function and seniority level, so this is a
// broad curated set covering the most common ones across functions rather
// than an exhaustive occupation code system (e.g. MASCO) — "Other" (handled
// by the picker UI, not listed here) covers anything not on this list.
export const POSITIONS = [
  // Leadership / executive
  "Chief Executive Officer (CEO)",
  "Chief Operating Officer (COO)",
  "Chief Financial Officer (CFO)",
  "Chief Technology Officer (CTO)",
  "Chief Marketing Officer (CMO)",
  "Chief Human Resources Officer (CHRO)",
  "Managing Director",
  "General Manager",
  "Vice President",
  "Director",
  "Senior Director",
  "Head of Department",
  "Partner",

  // Human Resources & Talent
  "HR Director",
  "HR Manager",
  "HR Business Partner",
  "HR Executive",
  "HR Officer",
  "Talent Acquisition Manager",
  "Recruiter",
  "Recruitment Consultant",
  "People Operations Manager",
  "Compensation & Benefits Specialist",
  "Learning & Development Manager",

  // Admin / Office
  "Office Manager",
  "Administrative Manager",
  "Administrative Executive",
  "Administrative Assistant",
  "Executive Assistant",
  "Personal Assistant",
  "Receptionist",

  // Finance & Accounting
  "Finance Manager",
  "Finance Executive",
  "Accountant",
  "Senior Accountant",
  "Accounts Executive",
  "Accounts Assistant",
  "Bookkeeper",
  "Financial Analyst",
  "Financial Controller",
  "Auditor",
  "Tax Consultant",
  "Payroll Executive",

  // Sales & Business Development
  "Sales Director",
  "Sales Manager",
  "Senior Sales Executive",
  "Sales Executive",
  "Business Development Manager",
  "Business Development Executive",
  "Account Manager",
  "Account Executive",
  "Key Account Manager",
  "Sales Representative",
  "Telesales Executive",

  // Marketing & Communications
  "Marketing Director",
  "Marketing Manager",
  "Senior Marketing Executive",
  "Marketing Executive",
  "Brand Manager",
  "Digital Marketing Manager",
  "Digital Marketing Executive",
  "Social Media Manager",
  "Social Media Executive",
  "Content Manager",
  "Content Writer",
  "Copywriter",
  "SEO Specialist",
  "Public Relations Manager",
  "Public Relations Executive",
  "Communications Manager",
  "Market Research Analyst",

  // Design & Creative
  "Creative Director",
  "Design Manager",
  "Senior Graphic Designer",
  "Graphic Designer",
  "UI/UX Designer",
  "Senior UI/UX Designer",
  "Product Designer",
  "Illustrator",
  "Video Editor",
  "Motion Graphics Designer",
  "Photographer",
  "Art Director",

  // Engineering & IT
  "Engineering Director",
  "Engineering Manager",
  "Senior Software Engineer",
  "Software Engineer",
  "Junior Software Engineer",
  "Frontend Developer",
  "Backend Developer",
  "Full Stack Developer",
  "Mobile App Developer",
  "DevOps Engineer",
  "QA Engineer",
  "Data Engineer",
  "Data Scientist",
  "Data Analyst",
  "Machine Learning Engineer",
  "Systems Administrator",
  "Network Engineer",
  "IT Manager",
  "IT Support Executive",
  "Technical Lead",
  "Solutions Architect",
  "Product Manager",
  "Technical Product Manager",
  "Project Manager",
  "Scrum Master",

  // Operations & Supply Chain
  "Operations Director",
  "Operations Manager",
  "Operations Executive",
  "Supply Chain Manager",
  "Logistics Manager",
  "Logistics Executive",
  "Procurement Manager",
  "Procurement Executive",
  "Warehouse Manager",
  "Inventory Executive",
  "Facilities Manager",

  // Customer Service
  "Customer Service Manager",
  "Customer Service Executive",
  "Customer Success Manager",
  "Customer Support Specialist",
  "Call Centre Agent",

  // Legal & Compliance
  "Legal Counsel",
  "Legal Manager",
  "Legal Executive",
  "Compliance Manager",
  "Compliance Officer",
  "Company Secretary",

  // Production / Manufacturing / Engineering (industrial)
  "Production Manager",
  "Production Supervisor",
  "Quality Assurance Manager",
  "Quality Control Executive",
  "Plant Manager",
  "Mechanical Engineer",
  "Electrical Engineer",
  "Civil Engineer",
  "Process Engineer",
  "Maintenance Engineer",
  "Site Supervisor",
  "Site Engineer",

  // Healthcare
  "Doctor",
  "Nurse",
  "Pharmacist",
  "Clinic Manager",
  "Healthcare Administrator",

  // Hospitality & Retail
  "Store Manager",
  "Retail Manager",
  "Restaurant Manager",
  "Hotel Manager",
  "Chef",
  "Event Manager",
  "Event Executive",

  // Education
  "Principal",
  "Teacher",
  "Trainer",
  "Academic Coordinator",

  // Founders / consultants
  "Founder",
  "Co-Founder",
  "Owner",
  "Freelancer",
  "Consultant",
  "Business Consultant",
] as const;

export type Position = (typeof POSITIONS)[number];
