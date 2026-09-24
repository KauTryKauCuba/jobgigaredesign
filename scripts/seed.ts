// Seeds 25 fake employer accounts and 50 fake jobseeker accounts (with full
// profiles), plus two companies with real branding (ParcelTracker, WHALE —
// see seedRealCompanies below) attached to a real dev login for testing
// against something that looks like an actual company. So dashboards,
// lists, and future matching logic have realistic data to work against.
// Safe to re-run: it deletes its own previously seeded rows (identified by
// the `@seed.jobgiga.test` email domain) before inserting fresh ones, so
// `npm run db:seed` works the same right after a `clear db` or on top of an
// already-seeded database.
//
// Does not use `@/lib/db` because that module imports `server-only`, which
// only resolves inside Next's build — this script runs standalone via tsx.
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, inArray, like } from "drizzle-orm";
import {
  users,
  employerProfiles,
  employerAddresses,
  jobseekerProfiles,
  jobseekerWorkExperiences,
  jobseekerEducation,
  jobseekerCertifications,
  jobseekerLanguages,
} from "../src/lib/db/schema";
import { INDUSTRIES, type Industry } from "../src/lib/industries";
import { DUMMY_SEED_EMAIL_DOMAIN, seedDummyCompanies } from "../src/lib/dummy-companies";

const SEED_EMAIL_DOMAIN = DUMMY_SEED_EMAIL_DOMAIN;
const EMPLOYER_COUNT = 25;
const JOBSEEKER_COUNT = 50;

// Two companies with real branding (ParcelTracker, WHALE — see
// src/lib/dummy-companies.ts, shared with the in-app "Get dummy data"
// button) attached to whichever real dev login is passed as the first CLI
// arg, defaulting to muddmma91.learn@gmail.com if none is given — team
// access, not direct ownership, so this works no matter what that account
// already owns. If the account doesn't exist yet, this part of the seed is
// skipped with a warning rather than failing the whole run.
//
// Usage: npm run db:seed -- your@email.com
const REAL_COMPANIES_OWNER_EMAIL = (process.argv[2] ?? "muddmma91.learn@gmail.com").toLowerCase();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN<T>(arr: readonly T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n && copy.length > 0; i++) {
    const idx = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// --- Malaysian-flavored name pools -----------------------------------

const FIRST_NAMES = [
  "Ahmad", "Muhammad", "Aiman", "Amirul", "Danial", "Haziq", "Iskandar", "Zaid", "Farid", "Hafiz",
  "Nur", "Siti", "Aisyah", "Farah", "Nurul", "Aina", "Batrisyia", "Alia", "Izzati", "Sofea",
  "Wei Ling", "Jia Hui", "Mei Xin", "Zhi Hao", "Kai Xuan", "Yi Xuan", "Jun Wei", "Xin Yi", "Chee Keong", "Li Wen",
  "Priya", "Kavitha", "Deepak", "Arun", "Suresh", "Kumar", "Meena", "Divya", "Ravi", "Anitha",
] as const;

const LAST_NAMES = [
  "Rahman", "Ismail", "Yusof", "Hassan", "Ibrahim", "Zainal", "Karim", "Salleh", "Aziz", "Hamid",
  "Tan", "Lim", "Lee", "Wong", "Chong", "Ng", "Ong", "Teoh", "Chin", "Goh",
  "a/l Muthu", "a/p Raman", "a/l Kumar", "a/p Suresh", "a/l Anand", "a/p Devi",
] as const;

function randomFullName() {
  return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
}

const CITIES = [
  "Kuala Lumpur", "Petaling Jaya", "Subang Jaya", "Shah Alam", "George Town, Penang",
  "Johor Bahru", "Ipoh", "Malacca City", "Kota Kinabalu", "Kuching",
  "Seremban", "Kuantan", "Alor Setar", "Miri", "Cyberjaya",
] as const;

// For employerProfiles' structured address — city + its state, and a street
// name to build a plausible addressLine1 from.
const COMPANY_ADDRESSES = [
  { city: "Kuala Lumpur", state: "Kuala Lumpur", street: "Jalan Ampang" },
  { city: "Petaling Jaya", state: "Selangor", street: "Jalan SS 2/24" },
  { city: "Subang Jaya", state: "Selangor", street: "Jalan USJ 10/1B" },
  { city: "Shah Alam", state: "Selangor", street: "Jalan Tengku Ampuan Zabedah" },
  { city: "George Town", state: "Penang", street: "Lebuh Chulia" },
  { city: "Johor Bahru", state: "Johor", street: "Jalan Wong Ah Fook" },
  { city: "Ipoh", state: "Perak", street: "Jalan Sultan Idris Shah" },
  { city: "Malacca City", state: "Melaka", street: "Jalan Hang Tuah" },
  { city: "Kota Kinabalu", state: "Sabah", street: "Jalan Gaya" },
  { city: "Kuching", state: "Sarawak", street: "Jalan Padungan" },
  { city: "Seremban", state: "Negeri Sembilan", street: "Jalan Dato' Bandar Tunggal" },
  { city: "Kuantan", state: "Pahang", street: "Jalan Beserah" },
  { city: "Alor Setar", state: "Kedah", street: "Jalan Sultan Badlishah" },
  { city: "Miri", state: "Sarawak", street: "Jalan Merbau" },
  { city: "Cyberjaya", state: "Selangor", street: "Persiaran Multimedia" },
] as const;

function randomPhone() {
  return `+60 1${randInt(2, 9)}-${randInt(100, 999)} ${randInt(1000, 9999)}`;
}

// --- Employer data ------------------------------------------------------

const COMPANY_NAME_PARTS: Record<Industry, { prefixes: string[]; suffixes: string[] }> = {
  "Accounting & Finance": {
    prefixes: ["Apex", "Prime", "Trust", "Capital", "Strategic", "Elite", "Merit", "Summit"],
    suffixes: ["Accounting", "Finance", "Advisors", "Partners", "Associates", "Solutions", "Consulting"],
  },
  "Administrative & Office Support": {
    prefixes: ["Swift", "Efficient", "Pro", "Premier", "Global", "Elite", "Reliable"],
    suffixes: ["Admin Services", "Business Support", "Office Solutions", "Corporate Services"],
  },
  "Agriculture, Forestry & Fishing": {
    prefixes: ["Green", "Harvest", "Agro", "Fresh", "Natural", "Terra", "Valley"],
    suffixes: ["Farms", "Agriculture", "Plantations", "Produce", "Agritech", "Resources"],
  },
  "Architecture & Engineering": {
    prefixes: ["Vertex", "Blueprint", "Structural", "Design", "Innovative", "Core", "Peak"],
    suffixes: ["Architects", "Engineering", "Design Studio", "Consultants", "Associates"],
  },
  "Arts, Media & Communications": {
    prefixes: ["Creative", "Vision", "Media", "Studio", "Pixel", "Digital", "Content"],
    suffixes: ["Productions", "Media Group", "Studios", "Creative Agency", "Communications"],
  },
  "Automotive & Transportation Equipment": {
    prefixes: ["Auto", "Prime", "Drive", "Velocity", "Metro", "United", "Elite"],
    suffixes: ["Motors", "Automotive", "Transport Equipment", "Auto Parts", "Vehicles"],
  },
  "Aviation & Aerospace": {
    prefixes: ["Aero", "Sky", "Flight", "Aviation", "Air", "Global", "Horizon"],
    suffixes: ["Aviation", "Aerospace", "Airlines", "Air Services", "Flight Operations"],
  },
  "Banking & Financial Services": {
    prefixes: ["Trust", "Global", "Premier", "United", "Capital", "Prosperity", "Wealth"],
    suffixes: ["Bank", "Financial Services", "Banking Group", "Finance", "Capital"],
  },
  "Beauty, Wellness & Personal Care": {
    prefixes: ["Beauty", "Glow", "Radiance", "Wellness", "Spa", "Luxe", "Pure"],
    suffixes: ["Spa", "Beauty Centre", "Wellness", "Salon", "Personal Care", "Aesthetics"],
  },
  "Biotechnology & Life Sciences": {
    prefixes: ["Bio", "Life", "Gene", "Cell", "Advanced", "Innovation", "Molecular"],
    suffixes: ["Biotechnology", "Life Sciences", "Biotech", "Labs", "BioSolutions"],
  },
  "Chemicals & Pharmaceuticals": {
    prefixes: ["Pharma", "Chemical", "Medical", "Life", "Health", "Bio", "Advanced"],
    suffixes: ["Pharmaceuticals", "Chemicals", "Labs", "Industries", "Healthcare"],
  },
  "Construction & Building": {
    prefixes: ["Build", "Construct", "Foundation", "Summit", "Premier", "Grand", "Metro"],
    suffixes: ["Construction", "Builders", "Development", "Projects", "Engineering"],
  },
  "Consulting & Strategy": {
    prefixes: ["Strategic", "Insight", "Pinnacle", "Advisory", "Expert", "Global", "Elite"],
    suffixes: ["Consulting", "Advisors", "Partners", "Strategy Group", "Consultants"],
  },
  "Customer Service & Support": {
    prefixes: ["First", "Premier", "Excellence", "Care", "Support", "Quality", "Fast"],
    suffixes: ["Customer Care", "Support Services", "Contact Centre", "Service Group"],
  },
  "Education & Training": {
    prefixes: ["Bright", "Excel", "Knowledge", "Smart", "Future", "Prime", "Academy"],
    suffixes: ["Education", "Learning Centre", "Training Institute", "Academy", "School"],
  },
  "Electronics & Semiconductors": {
    prefixes: ["Tech", "Micro", "Circuit", "Silicon", "Digital", "Nano", "Advanced"],
    suffixes: ["Electronics", "Semiconductors", "Technology", "Microelectronics", "Components"],
  },
  "Energy & Utilities": {
    prefixes: ["Power", "Energy", "Green", "Synergy", "Prime", "Efficient", "Mega"],
    suffixes: ["Energy", "Power", "Utilities", "Resources", "Solutions", "Group"],
  },
  "Entertainment, Gaming & Recreation": {
    prefixes: ["Play", "Fun", "Game", "Entertainment", "Joy", "Leisure", "Epic"],
    suffixes: ["Entertainment", "Gaming", "Recreation", "Studios", "Games", "Productions"],
  },
  "Environmental Services & Sustainability": {
    prefixes: ["Green", "Eco", "Sustain", "Earth", "Clean", "Pure", "Nature"],
    suffixes: ["Environmental", "Sustainability", "Green Solutions", "Eco Services", "Conservation"],
  },
  "Event Management & Wedding Planning": {
    prefixes: ["Dream", "Perfect", "Elite", "Grand", "Premier", "Royal", "Signature"],
    suffixes: ["Events", "Wedding Planners", "Event Management", "Celebrations", "Productions"],
  },
  "Facilities Management & Maintenance": {
    prefixes: ["Prime", "Expert", "Total", "Integrated", "Professional", "Quality", "Metro"],
    suffixes: ["Facilities", "Maintenance", "FM Services", "Property Services", "Management"],
  },
  "Fashion, Apparel & Textiles": {
    prefixes: ["Style", "Fashion", "Trend", "Elegant", "Urban", "Luxe", "Chic"],
    suffixes: ["Fashion", "Apparel", "Textiles", "Clothing", "Garments", "Style House"],
  },
  "Food & Beverage Services": {
    prefixes: ["Tasty", "Gourmet", "Fresh", "Golden", "Urban", "Flavor", "Royal"],
    suffixes: ["Kitchen", "Bistro", "Dining", "Catering", "Food Group", "Restaurants"],
  },
  "Government & Public Service": {
    prefixes: ["National", "Public", "Federal", "State", "Municipal", "Civil", "Ministry"],
    suffixes: ["Department", "Agency", "Authority", "Council", "Services", "Commission"],
  },
  "Healthcare & Medical": {
    prefixes: ["Care", "Vital", "Wellness", "MedLife", "Prime", "Sunrise", "Harmony", "Pulse"],
    suffixes: ["Health", "Medical Centre", "Clinic Group", "Care Services", "Wellness Hub", "Healthcare"],
  },
  "Hospitality & Tourism": {
    prefixes: ["Grand", "Royal", "Paradise", "Leisure", "Comfort", "Premium", "Vista"],
    suffixes: ["Hotels", "Resort", "Hospitality Group", "Travel", "Tourism", "Suites"],
  },
  "Human Resources & Recruitment": {
    prefixes: ["Talent", "People", "Career", "Hire", "Workforce", "Elite", "Pro"],
    suffixes: ["Recruitment", "HR Solutions", "Talent Group", "Staffing", "Consultants"],
  },
  "Information Technology & Software": {
    prefixes: ["Byte", "Cloud", "Nova", "Quantum", "Pixel", "Data", "Neuro", "Vertex", "Zenith", "Core"],
    suffixes: ["Labs", "Tech", "Systems", "Solutions", "Works", "Digital", "Software", "Networks"],
  },
  "Insurance": {
    prefixes: ["Trust", "Shield", "Secure", "Guardian", "Premier", "National", "United"],
    suffixes: ["Insurance", "Assurance", "Takaful", "Protection", "Life", "General"],
  },
  "Interior Design & Furniture": {
    prefixes: ["Design", "Style", "Modern", "Elegant", "Creative", "Living", "Space"],
    suffixes: ["Interior Design", "Furniture", "Design Studio", "Furnishings", "Interiors"],
  },
  "Legal Services": {
    prefixes: ["Justice", "Legal", "Advocate", "Crown", "Prime", "Elite", "Trust"],
    suffixes: ["Law Firm", "Legal Associates", "Chambers", "Advocates", "Partners"],
  },
  "Logistics & Supply Chain": {
    prefixes: ["Express", "Global", "Swift", "Prime", "Trans", "Rapid", "Efficient"],
    suffixes: ["Logistics", "Supply Chain", "Freight", "Distribution", "Transport"],
  },
  "Manufacturing & Production": {
    prefixes: ["Precision", "Industrial", "Tech", "Prime", "Advanced", "Quality", "Mega"],
    suffixes: ["Manufacturing", "Industries", "Production", "Factory", "Manufacturing Sdn Bhd"],
  },
  "Maritime & Shipping": {
    prefixes: ["Ocean", "Marine", "Ship", "Port", "Cargo", "Maritime", "Global"],
    suffixes: ["Shipping", "Maritime", "Shipping Lines", "Marine Services", "Logistics"],
  },
  "Marketing & Advertising": {
    prefixes: ["Creative", "Brand", "Digital", "Impact", "Vision", "Peak", "Boost"],
    suffixes: ["Marketing", "Advertising", "Media", "Agency", "Communications", "Branding"],
  },
  "Media, Broadcasting & Publishing": {
    prefixes: ["Media", "Broadcast", "Press", "Digital", "Channel", "News", "Publishing"],
    suffixes: ["Media Group", "Broadcasting", "Publications", "Publishers", "Network"],
  },
  "Mining & Quarrying": {
    prefixes: ["Mineral", "Resource", "Earth", "Stone", "Granite", "Industrial", "Premier"],
    suffixes: ["Mining", "Resources", "Quarry", "Industries", "Minerals", "Extraction"],
  },
  "Non-Profit & NGO": {
    prefixes: ["Hope", "Community", "Care", "Support", "United", "Global", "Impact"],
    suffixes: ["Foundation", "NGO", "Society", "Association", "Organization", "Trust"],
  },
  "Oil & Gas": {
    prefixes: ["Petroleum", "Energy", "Global", "Premier", "Offshore", "National", "Mega"],
    suffixes: ["Oil & Gas", "Petroleum", "Energy", "Resources", "Exploration", "Services"],
  },
  "Printing & Packaging": {
    prefixes: ["Print", "Pack", "Creative", "Quality", "Premier", "Universal", "Express"],
    suffixes: ["Printing", "Packaging", "Print Solutions", "Pack Industries", "Graphics"],
  },
  "Property & Real Estate": {
    prefixes: ["Prime", "Urban", "Metro", "Elite", "Capital", "Landmark", "Realty"],
    suffixes: ["Properties", "Real Estate", "Development", "Realty", "Property Group"],
  },
  "Public Relations & Corporate Communications": {
    prefixes: ["Comm", "PR", "Strategic", "Corporate", "Media", "Public", "Impact"],
    suffixes: ["Communications", "PR Agency", "Public Relations", "Media Relations", "Corp Comm"],
  },
  "Retail & Consumer Goods": {
    prefixes: ["Mega", "Prime", "Urban", "Metro", "Sunrise", "Golden", "Value", "Bright"],
    suffixes: ["Mart", "Retail Group", "Trading", "Stores", "Emporium", "Commerce"],
  },
  "Sales & Business Development": {
    prefixes: ["Growth", "Peak", "Strategic", "Prime", "Dynamic", "Global", "Pro"],
    suffixes: ["Sales", "Business Solutions", "Development", "Trading", "Ventures"],
  },
  "Science & Research": {
    prefixes: ["Research", "Scientific", "Innovation", "Lab", "Discovery", "Advanced", "Bio"],
    suffixes: ["Research Institute", "Labs", "Science Centre", "R&D", "Institute"],
  },
  "Security & Law Enforcement": {
    prefixes: ["Guardian", "Shield", "Secure", "Protect", "Safe", "Elite", "Premier"],
    suffixes: ["Security", "Protection Services", "Security Systems", "Guards", "Safety"],
  },
  "Sports & Fitness": {
    prefixes: ["Fit", "Active", "Power", "Peak", "Elite", "Sport", "Energy"],
    suffixes: ["Fitness", "Sports Centre", "Gym", "Athletics", "Health Club", "Training"],
  },
  "Telecommunications": {
    prefixes: ["Telco", "Connect", "Network", "Digital", "Global", "Mega", "Premier"],
    suffixes: ["Telecommunications", "Networks", "Telecom", "Communications", "Connect"],
  },
  "Transportation & Warehousing": {
    prefixes: ["Express", "Swift", "Trans", "Rapid", "Global", "Metro", "Prime"],
    suffixes: ["Transport", "Logistics", "Warehousing", "Freight", "Haulage", "Express"],
  },
  "Travel Agencies & Tour Operations": {
    prefixes: ["Travel", "Tour", "Explore", "Adventure", "Global", "Journey", "Vacation"],
    suffixes: ["Travel", "Tours", "Travel Agency", "Tour Operators", "Holidays"],
  },
  "Veterinary Services & Animal Care": {
    prefixes: ["Pet", "Animal", "Vet", "Care", "Paws", "Happy", "Loving"],
    suffixes: ["Veterinary", "Animal Care", "Pet Clinic", "Vet Services", "Animal Hospital"],
  },
  "Waste Management & Recycling": {
    prefixes: ["Green", "Eco", "Clean", "Waste", "Environmental", "Recycle", "Earth"],
    suffixes: ["Waste Management", "Recycling", "Environmental Services", "Waste Solutions"],
  },
  "Wholesale Trade": {
    prefixes: ["Mega", "Global", "Premier", "Trade", "Wholesale", "Import", "United"],
    suffixes: ["Trading", "Wholesale", "Distributors", "Trade Centre", "Imports"],
  },
};

function randomCompanyName(industry: Industry) {
  const { prefixes, suffixes } = COMPANY_NAME_PARTS[industry];
  return `${pick(prefixes)} ${pick(suffixes)}`;
}

const COMPANY_SIZES = ["1-10", "11-50", "51-200", "201-500", "500+"] as const;
const COMPANY_TYPES = ["Startup", "SME", "MNC", "GLC", "Government"] as const;
const BENEFITS_POOL = [
  "Medical insurance", "Dental coverage", "Annual bonus", "Flexible hours", "Work from home",
  "Study allowance", "Gym membership", "Parking provided", "Free meals", "Team trips",
];

function randomSsmNumber() {
  return `20${randInt(10, 24)}${String(randInt(1, 12)).padStart(2, "0")}${randInt(10000, 99999)}`;
}

function companyLogoUrl(companyName: string) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(companyName)}&background=random&size=256`;
}

function personAvatarUrl(seedIndex: number) {
  return `https://i.pravatar.cc/300?img=${(seedIndex % 70) + 1}`;
}

// --- Jobseeker data -------------------------------------------------------

const ROLE_POOLS: Record<Industry, string[]> = {
  "Accounting & Finance": [
    "Accountant", "Financial Analyst", "Tax Specialist", "Auditor", "Bookkeeper",
    "Finance Manager", "Budget Analyst", "Financial Controller", "Payroll Specialist", "Credit Analyst",
  ],
  "Administrative & Office Support": [
    "Administrative Assistant", "Office Manager", "Receptionist", "Data Entry Clerk", "Secretary",
    "Executive Assistant", "Office Coordinator", "Document Controller", "Admin Executive", "Personal Assistant",
  ],
  "Agriculture, Forestry & Fishing": [
    "Farm Manager", "Agricultural Officer", "Plantation Supervisor", "Agronomist", "Fishery Manager",
    "Crop Specialist", "Livestock Officer", "Forestry Technician", "Agricultural Engineer", "Farm Supervisor",
  ],
  "Architecture & Engineering": [
    "Architect", "Civil Engineer", "Structural Engineer", "Mechanical Engineer", "Electrical Engineer",
    "Project Engineer", "CAD Technician", "Site Engineer", "Architectural Designer", "Building Engineer",
  ],
  "Arts, Media & Communications": [
    "Graphic Designer", "Content Writer", "Video Editor", "Social Media Manager", "Copywriter",
    "Creative Director", "Photographer", "Multimedia Designer", "Communications Officer", "Art Director",
  ],
  "Automotive & Transportation Equipment": [
    "Automotive Engineer", "Mechanical Technician", "Auto Parts Specialist", "Vehicle Inspector", "Production Supervisor",
    "Quality Control Inspector", "Design Engineer", "Assembly Line Worker", "Service Technician", "Plant Manager",
  ],
  "Aviation & Aerospace": [
    "Aircraft Engineer", "Aviation Technician", "Flight Operations Officer", "Aerospace Engineer", "Aircraft Mechanic",
    "Ground Operations Coordinator", "Safety Inspector", "Avionics Technician", "Flight Dispatcher", "Maintenance Engineer",
  ],
  "Banking & Financial Services": [
    "Relationship Manager", "Bank Teller", "Loan Officer", "Investment Analyst", "Credit Officer",
    "Branch Manager", "Financial Advisor", "Compliance Officer", "Treasury Analyst", "Private Banker",
  ],
  "Beauty, Wellness & Personal Care": [
    "Beauty Therapist", "Spa Manager", "Massage Therapist", "Beautician", "Aesthetician",
    "Wellness Consultant", "Salon Manager", "Makeup Artist", "Skincare Specialist", "Nail Technician",
  ],
  "Biotechnology & Life Sciences": [
    "Biotech Scientist", "Research Associate", "Lab Technician", "Quality Assurance Specialist", "Clinical Trials Coordinator",
    "Bioprocess Engineer", "Molecular Biologist", "Regulatory Affairs Officer", "Bioinformatics Analyst", "Cell Culture Specialist",
  ],
  "Chemicals & Pharmaceuticals": [
    "Pharmaceutical Scientist", "Chemical Engineer", "Quality Control Analyst", "Production Manager", "Formulation Chemist",
    "Regulatory Affairs Manager", "Process Engineer", "R&D Scientist", "Validation Engineer", "Manufacturing Supervisor",
  ],
  "Construction & Building": [
    "Project Manager", "Site Supervisor", "Quantity Surveyor", "Construction Engineer", "Safety Officer",
    "Building Inspector", "Contract Manager", "Site Foreman", "M&E Engineer", "Construction Planner",
  ],
  "Consulting & Strategy": [
    "Management Consultant", "Business Analyst", "Strategy Consultant", "Operations Consultant", "Risk Consultant",
    "Change Manager", "Process Improvement Specialist", "Advisory Consultant", "Senior Consultant", "Associate Consultant",
  ],
  "Customer Service & Support": [
    "Customer Service Representative", "Call Centre Agent", "Customer Support Specialist", "Service Advisor", "Client Success Manager",
    "Customer Care Executive", "Support Team Leader", "Helpdesk Officer", "CRM Specialist", "Customer Experience Officer",
  ],
  "Education & Training": [
    "Teacher", "Lecturer", "Training Specialist", "Education Coordinator", "Tutor",
    "Curriculum Developer", "Academic Advisor", "School Administrator", "Education Consultant", "Learning Specialist",
  ],
  "Electronics & Semiconductors": [
    "Electronics Engineer", "Semiconductor Technician", "PCB Designer", "Test Engineer", "Quality Engineer",
    "Process Engineer", "Manufacturing Engineer", "Product Engineer", "R&D Engineer", "Application Engineer",
  ],
  "Energy & Utilities": [
    "Power Plant Operator", "Energy Analyst", "Utilities Engineer", "Maintenance Technician", "Energy Manager",
    "Electrical Technician", "Renewable Energy Specialist", "Operations Engineer", "Plant Engineer", "Utility Coordinator",
  ],
  "Entertainment, Gaming & Recreation": [
    "Game Developer", "Entertainment Coordinator", "Event Planner", "Recreation Manager", "Game Designer",
    "Community Manager", "Content Producer", "QA Tester", "Esports Manager", "Venue Manager",
  ],
  "Environmental Services & Sustainability": [
    "Environmental Officer", "Sustainability Consultant", "EHS Manager", "Environmental Engineer", "Waste Coordinator",
    "Compliance Officer", "Sustainability Analyst", "Environmental Scientist", "Green Building Consultant", "Carbon Analyst",
  ],
  "Event Management & Wedding Planning": [
    "Event Manager", "Wedding Planner", "Event Coordinator", "Venue Manager", "Event Producer",
    "Catering Manager", "Event Designer", "Guest Relations Manager", "Event Marketing Manager", "Production Coordinator",
  ],
  "Facilities Management & Maintenance": [
    "Facilities Manager", "Maintenance Supervisor", "Building Engineer", "HVAC Technician", "Facilities Coordinator",
    "Maintenance Technician", "Property Manager", "Operations Manager", "Electrical Technician", "Custodial Supervisor",
  ],
  "Fashion, Apparel & Textiles": [
    "Fashion Designer", "Textile Designer", "Pattern Maker", "Merchandiser", "Fashion Buyer",
    "Production Manager", "Quality Controller", "Garment Technician", "Fashion Stylist", "Product Developer",
  ],
  "Food & Beverage Services": [
    "Chef", "Restaurant Manager", "Kitchen Supervisor", "Waiter", "Barista",
    "F&B Manager", "Pastry Chef", "Bartender", "Catering Manager", "Food Safety Officer",
  ],
  "Government & Public Service": [
    "Civil Servant", "Policy Officer", "Administrative Officer", "Public Relations Officer", "Government Executive",
    "Enforcement Officer", "Public Service Manager", "Municipal Officer", "Development Officer", "Regulatory Officer",
  ],
  "Healthcare & Medical": [
    "Registered Nurse", "Pharmacist", "Medical Officer", "Physiotherapist", "Clinic Assistant",
    "Healthcare Administrator", "Radiographer", "Lab Technician", "Dietitian", "Occupational Therapist",
  ],
  "Hospitality & Tourism": [
    "Hotel Manager", "Front Desk Officer", "Concierge", "Tour Guide", "Housekeeping Supervisor",
    "Guest Relations Officer", "Travel Consultant", "Reservation Agent", "Events Coordinator", "Resort Manager",
  ],
  "Human Resources & Recruitment": [
    "HR Manager", "Recruiter", "Talent Acquisition Specialist", "HR Executive", "Compensation Analyst",
    "Training Coordinator", "HR Business Partner", "Payroll Manager", "Employee Relations Officer", "Recruitment Consultant",
  ],
  "Information Technology & Software": [
    "Software Engineer", "Frontend Developer", "Backend Developer", "Data Analyst", "DevOps Engineer",
    "Product Manager", "QA Engineer", "UI/UX Designer", "Mobile Developer", "IT Support Specialist",
  ],
  "Insurance": [
    "Insurance Agent", "Underwriter", "Claims Adjuster", "Risk Analyst", "Actuary",
    "Insurance Manager", "Policy Advisor", "Takaful Consultant", "Reinsurance Specialist", "Claims Officer",
  ],
  "Interior Design & Furniture": [
    "Interior Designer", "Furniture Designer", "3D Visualizer", "Space Planner", "Design Consultant",
    "Project Coordinator", "CAD Technician", "Showroom Manager", "Design Assistant", "Sales Designer",
  ],
  "Legal Services": [
    "Lawyer", "Legal Assistant", "Paralegal", "Legal Advisor", "Corporate Counsel",
    "Litigation Executive", "Legal Officer", "Conveyancing Clerk", "Legal Executive", "Compliance Counsel",
  ],
  "Logistics & Supply Chain": [
    "Logistics Coordinator", "Supply Chain Manager", "Warehouse Supervisor", "Shipping Clerk", "Inventory Planner",
    "Operations Manager", "Freight Forwarder", "Distribution Manager", "Procurement Officer", "Logistics Analyst",
  ],
  "Manufacturing & Production": [
    "Production Manager", "Quality Control Inspector", "Manufacturing Engineer", "Machine Operator", "Assembly Technician",
    "Plant Manager", "Production Supervisor", "Process Engineer", "Maintenance Technician", "Production Planner",
  ],
  "Maritime & Shipping": [
    "Marine Engineer", "Ship Captain", "Cargo Officer", "Port Operations Manager", "Maritime Surveyor",
    "Shipping Coordinator", "Vessel Operator", "Logistics Officer", "Marine Superintendent", "Port Agent",
  ],
  "Marketing & Advertising": [
    "Marketing Manager", "Digital Marketer", "Brand Manager", "Marketing Executive", "SEO Specialist",
    "Advertising Manager", "Campaign Manager", "Market Research Analyst", "Product Marketing Manager", "Content Strategist",
  ],
  "Media, Broadcasting & Publishing": [
    "Journalist", "News Editor", "Broadcast Producer", "Content Editor", "Video Producer",
    "Radio Presenter", "Publishing Editor", "Media Coordinator", "Scriptwriter", "Production Manager",
  ],
  "Mining & Quarrying": [
    "Mining Engineer", "Geologist", "Quarry Manager", "Drilling Supervisor", "Mine Safety Officer",
    "Mineral Surveyor", "Explosives Technician", "Mining Supervisor", "Ore Processing Engineer", "Mine Planner",
  ],
  "Non-Profit & NGO": [
    "Program Officer", "Community Development Officer", "Fundraising Manager", "Advocacy Officer", "Volunteer Coordinator",
    "Project Manager", "Social Worker", "Grants Manager", "Communications Officer", "Field Officer",
  ],
  "Oil & Gas": [
    "Petroleum Engineer", "Drilling Engineer", "Offshore Engineer", "Production Engineer", "Pipeline Engineer",
    "Reservoir Engineer", "Operations Manager", "HSE Officer", "Geoscientist", "Process Engineer",
  ],
  "Printing & Packaging": [
    "Print Production Manager", "Graphic Prepress Technician", "Packaging Designer", "Print Operator", "Quality Control Inspector",
    "Finishing Specialist", "Production Supervisor", "Print Estimator", "Machine Operator", "Packaging Engineer",
  ],
  "Property & Real Estate": [
    "Property Agent", "Real Estate Manager", "Property Valuer", "Leasing Executive", "Property Consultant",
    "Facilities Manager", "Property Developer", "Asset Manager", "Real Estate Analyst", "Rental Manager",
  ],
  "Public Relations & Corporate Communications": [
    "PR Manager", "Communications Specialist", "Media Relations Officer", "Corporate Communications Manager", "PR Executive",
    "Public Affairs Officer", "Content Strategist", "Spokesperson", "Brand Communications Manager", "Crisis Communications Specialist",
  ],
  "Retail & Consumer Goods": [
    "Retail Store Manager", "Sales Associate", "Merchandiser", "Cashier", "Visual Merchandiser",
    "Inventory Executive", "Customer Service Executive", "E-commerce Executive", "Retail Supervisor", "Purchasing Executive",
  ],
  "Sales & Business Development": [
    "Sales Manager", "Business Development Executive", "Sales Executive", "Account Manager", "Sales Director",
    "Key Account Manager", "Sales Coordinator", "Territory Manager", "Inside Sales Representative", "Business Development Manager",
  ],
  "Science & Research": [
    "Research Scientist", "Laboratory Analyst", "Research Officer", "Biotechnologist", "Clinical Research Coordinator",
    "Data Scientist", "Research Assistant", "Quality Assurance Scientist", "Microbiologist", "Chemical Analyst",
  ],
  "Security & Law Enforcement": [
    "Security Officer", "Security Supervisor", "CCTV Operator", "Security Guard", "Loss Prevention Officer",
    "Security Manager", "Access Control Officer", "Security Coordinator", "Patrol Officer", "Event Security",
  ],
  "Sports & Fitness": [
    "Personal Trainer", "Fitness Instructor", "Sports Coach", "Gym Manager", "Nutritionist",
    "Yoga Instructor", "Strength & Conditioning Coach", "Group Fitness Instructor", "Sports Physiotherapist", "Fitness Consultant",
  ],
  "Telecommunications": [
    "Network Engineer", "Telecommunications Specialist", "Field Technician", "NOC Engineer", "RF Engineer",
    "Network Architect", "Telecom Analyst", "Support Engineer", "Infrastructure Engineer", "Systems Administrator",
  ],
  "Transportation & Warehousing": [
    "Logistics Coordinator", "Warehouse Manager", "Delivery Driver", "Dispatcher", "Fleet Manager",
    "Transport Supervisor", "Warehouse Supervisor", "Cargo Handler", "Operations Coordinator", "Transport Planner",
  ],
  "Travel Agencies & Tour Operations": [
    "Travel Consultant", "Tour Manager", "Travel Agent", "Tour Coordinator", "Booking Executive",
    "Travel Operations Manager", "Destination Specialist", "Tour Guide", "Customer Service Agent", "Visa Specialist",
  ],
  "Veterinary Services & Animal Care": [
    "Veterinarian", "Veterinary Nurse", "Animal Caretaker", "Veterinary Technician", "Pet Groomer",
    "Animal Nutritionist", "Vet Assistant", "Clinic Manager", "Animal Behaviourist", "Wildlife Officer",
  ],
  "Waste Management & Recycling": [
    "Waste Management Officer", "Recycling Coordinator", "Environmental Engineer", "Waste Collection Supervisor", "Sustainability Officer",
    "Recycling Plant Manager", "Waste Analyst", "Operations Manager", "HSE Officer", "Waste Processing Technician",
  ],
  "Wholesale Trade": [
    "Sales Representative", "Purchasing Officer", "Wholesale Manager", "Trade Coordinator", "Distribution Manager",
    "Import/Export Coordinator", "Supply Manager", "Wholesale Buyer", "Trade Analyst", "Procurement Specialist",
  ],
};

const SKILL_POOLS: Record<Industry, string[]> = {
  "Accounting & Finance": ["QuickBooks", "SAP", "Microsoft Excel", "Financial Modeling", "Tax Compliance", "Audit", "Budgeting", "ACCA", "CPA", "Financial Reporting"],
  "Administrative & Office Support": ["Microsoft Office", "Data Entry", "Scheduling", "Document Management", "Filing", "Reception", "Communication", "Calendar Management"],
  "Agriculture, Forestry & Fishing": ["Crop Management", "Irrigation Systems", "Pest Control", "Sustainable Farming", "Soil Analysis", "Farm Equipment Operation", "Livestock Care"],
  "Architecture & Engineering": ["AutoCAD", "Revit", "SketchUp", "Structural Analysis", "Building Codes", "Project Management", "Civil 3D", "3D Modeling", "Construction Planning"],
  "Arts, Media & Communications": ["Adobe Photoshop", "Adobe Illustrator", "Video Editing", "Content Writing", "Social Media", "Photography", "Graphic Design", "Adobe Premiere Pro", "Copywriting"],
  "Automotive & Transportation Equipment": ["Automotive Engineering", "CAD Design", "Quality Control", "Manufacturing Processes", "Mechanical Systems", "Assembly Line Management", "Automotive Electronics", "Lean Manufacturing"],
  "Aviation & Aerospace": ["Aircraft Maintenance", "Aviation Safety", "Flight Operations", "Avionics", "Aerospace Engineering", "Aircraft Systems", "Regulatory Compliance", "Technical Documentation"],
  "Banking & Financial Services": ["Credit Analysis", "Loan Processing", "Relationship Management", "Banking Operations", "Compliance", "KYC", "Risk Management", "Financial Products"],
  "Beauty, Wellness & Personal Care": ["Beauty Therapy", "Spa Management", "Massage Techniques", "Skincare Treatments", "Customer Service", "Salon Operations", "Makeup Artistry", "Product Knowledge", "Hygiene Standards"],
  "Biotechnology & Life Sciences": ["Biotechnology", "Cell Culture", "Laboratory Techniques", "GMP", "Research Methods", "Bioinformatics", "Molecular Biology", "Data Analysis", "Quality Control"],
  "Chemicals & Pharmaceuticals": ["Chemical Engineering", "Pharmaceutical Manufacturing", "Quality Assurance", "GMP", "Regulatory Affairs", "Process Validation", "Chemical Analysis", "Safety Protocols"],
  "Construction & Building": ["Project Management", "Site Management", "Safety Compliance", "Quantity Surveying", "Construction Planning", "M&E Systems", "Building Regulations"],
  "Consulting & Strategy": ["Business Analysis", "Process Improvement", "Change Management", "Strategy Development", "Stakeholder Management", "Consulting", "Problem Solving"],
  "Customer Service & Support": ["Customer Service", "CRM Software", "Communication", "Problem Resolution", "Active Listening", "Empathy", "Call Handling", "Complaint Management"],
  "Education & Training": ["Teaching", "Curriculum Development", "Lesson Planning", "Student Assessment", "Classroom Management", "Educational Technology", "Instructional Design"],
  "Electronics & Semiconductors": ["Circuit Design", "Semiconductor Fabrication", "PCB Design", "Testing & Validation", "Quality Control", "Embedded Systems", "Technical Documentation"],
  "Energy & Utilities": ["Power Systems", "Electrical Engineering", "Energy Management", "Maintenance", "SCADA", "Renewable Energy", "Safety Protocols", "Technical Troubleshooting"],
  "Entertainment, Gaming & Recreation": ["Game Design", "Event Planning", "Community Management", "Content Production", "Unity/Unreal Engine", "Customer Engagement", "Recreation Programming"],
  "Environmental Services & Sustainability": ["Environmental Compliance", "Sustainability Reporting", "Waste Management", "Environmental Impact Assessment", "Carbon Footprint Analysis", "Regulatory Compliance"],
  "Event Management & Wedding Planning": ["Event Planning", "Vendor Management", "Budget Management", "Client Relations", "Logistics Coordination", "Creative Design", "Negotiation"],
  "Facilities Management & Maintenance": ["Facilities Management", "HVAC Systems", "Preventive Maintenance", "Building Systems", "Vendor Management", "Safety Compliance", "Property Maintenance"],
  "Fashion, Apparel & Textiles": ["Fashion Design", "Pattern Making", "Textile Knowledge", "Trend Analysis", "Garment Construction", "Merchandising", "Quality Control", "Adobe Illustrator"],
  "Food & Beverage Services": ["Food Preparation", "Customer Service", "Food Safety", "Menu Planning", "Kitchen Management", "Hospitality", "Culinary Skills", "HACCP"],
  "Government & Public Service": ["Policy Analysis", "Public Administration", "Regulatory Compliance", "Government Procedures", "Report Writing", "Stakeholder Engagement"],
  "Healthcare & Medical": ["Patient Care", "Clinical Documentation", "First Aid", "Medical Terminology", "CPR Certified", "Electronic Health Records", "Phlebotomy", "Infection Control"],
  "Hospitality & Tourism": ["Guest Relations", "Hotel Operations", "Customer Service", "Booking Systems", "Tour Planning", "Hospitality Management", "Event Coordination"],
  "Human Resources & Recruitment": ["Recruitment", "HRIS", "Talent Acquisition", "Employee Relations", "Performance Management", "Payroll", "HR Policies", "Training & Development"],
  "Information Technology & Software": ["JavaScript", "TypeScript", "React", "Node.js", "Python", "SQL", "AWS", "Docker", "Git", "REST APIs", "Java", "Figma"],
  "Insurance": ["Underwriting", "Claims Processing", "Risk Assessment", "Insurance Products", "Policy Administration", "Actuarial Analysis", "Customer Service", "Compliance"],
  "Interior Design & Furniture": ["Interior Design", "AutoCAD", "SketchUp", "3D Visualization", "Space Planning", "Furniture Design", "Material Knowledge", "Project Coordination", "Rendering Software"],
  "Legal Services": ["Legal Research", "Contract Drafting", "Legal Writing", "Litigation", "Conveyancing", "Legal Compliance", "Case Management", "Legal Advisory"],
  "Logistics & Supply Chain": ["Logistics Management", "Supply Chain", "Inventory Control", "Warehouse Management", "Freight Forwarding", "SAP", "Procurement", "Distribution"],
  "Manufacturing & Production": ["Quality Control", "Lean Manufacturing", "Production Planning", "Machine Operation", "Process Optimization", "Safety Standards", "ISO Compliance"],
  "Maritime & Shipping": ["Maritime Operations", "Vessel Management", "Cargo Handling", "Marine Engineering", "Port Operations", "Shipping Regulations", "Navigation", "Maritime Safety"],
  "Marketing & Advertising": ["Digital Marketing", "SEO", "Content Marketing", "Social Media Marketing", "Google Ads", "Marketing Strategy", "Brand Management", "Analytics"],
  "Media, Broadcasting & Publishing": ["Content Creation", "Video Production", "Broadcasting", "Journalism", "Editing", "Media Production", "Publishing", "Scriptwriting", "Radio Production"],
  "Mining & Quarrying": ["Mining Operations", "Geology", "Safety Compliance", "Blasting", "Surveying", "Heavy Machinery", "Mineral Processing", "Environmental Compliance"],
  "Non-Profit & NGO": ["Program Management", "Fundraising", "Community Engagement", "Grant Writing", "Volunteer Management", "Advocacy", "Social Impact", "Monitoring & Evaluation"],
  "Oil & Gas": ["Petroleum Engineering", "Drilling Operations", "Process Engineering", "HSE Management", "Reservoir Management", "Pipeline Operations", "Offshore Operations"],
  "Printing & Packaging": ["Print Production", "Graphic Design", "Prepress", "Quality Control", "Packaging Design", "Printing Technology", "Color Management", "Finishing Techniques"],
  "Property & Real Estate": ["Property Valuation", "Real Estate Sales", "Property Management", "Leasing", "Negotiation", "Real Estate Law", "Market Analysis", "Client Relations"],
  "Public Relations & Corporate Communications": ["Public Relations", "Media Relations", "Crisis Communications", "Corporate Communications", "Content Strategy", "Stakeholder Management", "Press Release Writing", "Event Management"],
  "Retail & Consumer Goods": ["Customer Service", "POS Systems", "Inventory Management", "Sales", "Merchandising", "Microsoft Excel", "Negotiation", "Stock Control"],
  "Sales & Business Development": ["Sales", "Business Development", "Negotiation", "CRM", "Lead Generation", "Account Management", "Sales Strategy", "Relationship Building"],
  "Science & Research": ["Laboratory Techniques", "Data Analysis", "Research Methodology", "Scientific Writing", "Instrumentation", "Quality Assurance", "Experimental Design"],
  "Security & Law Enforcement": ["Security Operations", "CCTV Monitoring", "Access Control", "Incident Response", "Security Protocols", "First Aid", "Emergency Response"],
  "Sports & Fitness": ["Personal Training", "Fitness Coaching", "Sports Instruction", "Nutrition", "Exercise Programming", "Group Fitness", "Sports Science", "Client Assessment"],
  "Telecommunications": ["Network Engineering", "Telecommunications", "RF Engineering", "Network Architecture", "Troubleshooting", "Cisco", "VoIP", "Fiber Optics"],
  "Transportation & Warehousing": ["Logistics", "Warehouse Management", "Inventory Control", "Fleet Management", "Transportation Planning", "Forklift Operation", "Route Optimization"],
  "Travel Agencies & Tour Operations": ["Travel Planning", "Booking Systems", "Customer Service", "Destination Knowledge", "Tour Coordination", "Visa Processing", "Travel Sales", "Itinerary Planning"],
  "Veterinary Services & Animal Care": ["Veterinary Medicine", "Animal Care", "Veterinary Surgery", "Diagnostics", "Animal Handling", "Pet Grooming", "Client Communication", "Medical Record Keeping"],
  "Waste Management & Recycling": ["Waste Management", "Recycling Processes", "Environmental Compliance", "Sustainability", "Waste Collection", "Hazardous Waste Handling", "Operations Management"],
  "Wholesale Trade": ["Wholesale Operations", "Procurement", "Inventory Management", "Negotiation", "Supply Chain", "Import/Export", "Trading", "Vendor Management"],
};

const SOFT_SKILLS_POOL = [
  "Communication", "Teamwork", "Problem Solving", "Time Management", "Adaptability",
  "Leadership", "Critical Thinking", "Attention to Detail",
];

const INSTITUTIONS = [
  "Universiti Malaya", "Universiti Kebangsaan Malaysia", "Universiti Putra Malaysia", "Universiti Teknologi Malaysia",
  "Universiti Sains Malaysia", "Multimedia University", "Taylor's University", "Sunway University",
  "INTI International University", "UCSI University",
] as const;

const QUALIFICATION_TIERS = ["SPM", "STPM", "Diploma", "Degree", "Master", "PhD", "Other"] as const;
const EMPLOYMENT_TYPES = ["full_time", "part_time", "contract", "internship"] as const;
const WORK_ARRANGEMENTS = ["remote", "hybrid", "onsite"] as const;
const WORK_AUTHORIZATIONS = ["citizen", "permanent_resident", "work_pass_holder", "needs_sponsorship"] as const;
const NOTICE_PERIODS = ["immediate", "one_week", "two_weeks", "one_month", "two_months", "more_than_two_months"] as const;
const LANGUAGE_LEVELS = ["basic", "conversational", "fluent", "native"] as const;
const GENDERS = ["male", "female", "other", "prefer_not_to_say"] as const;
const MARITAL_STATUSES = ["single", "married", "divorced", "widowed", "prefer_not_to_say"] as const;
const DRIVING_LICENSES = ["none", "b2", "b", "d", "da", "e"] as const;
const LANGUAGES_POOL = ["English", "Malay", "Mandarin", "Tamil", "Cantonese"] as const;
const COMPANIES_FOR_EXPERIENCE = [
  "Tech Innovators Sdn Bhd", "Global Retail Group", "Sunrise Healthcare", "Bright Solutions",
  "Metro Trading Co.", "Vital Medical Centre", "Byte Systems", "Prime Commerce",
];

function randomDateOfBirth() {
  const year = randInt(1985, 2003);
  const month = String(randInt(1, 12)).padStart(2, "0");
  const day = String(randInt(1, 28)).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function randomPastDate(yearsAgoMax: number) {
  const year = new Date().getFullYear() - randInt(0, yearsAgoMax);
  const month = String(randInt(1, 12)).padStart(2, "0");
  return `${year}-${month}-01`;
}

async function main() {
  console.log("Clearing previously seeded rows...");

  const existingJobseekerUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(like(users.email, `%@${SEED_EMAIL_DOMAIN}`));
  const existingUserIds = existingJobseekerUsers.map((u) => u.id);

  if (existingUserIds.length > 0) {
    const existingProfiles = await db
      .select({ id: jobseekerProfiles.id })
      .from(jobseekerProfiles)
      .where(inArray(jobseekerProfiles.userId, existingUserIds));
    const existingProfileIds = existingProfiles.map((p) => p.id);

    if (existingProfileIds.length > 0) {
      await db.delete(jobseekerWorkExperiences).where(inArray(jobseekerWorkExperiences.profileId, existingProfileIds));
      await db.delete(jobseekerEducation).where(inArray(jobseekerEducation.profileId, existingProfileIds));
      await db.delete(jobseekerCertifications).where(inArray(jobseekerCertifications.profileId, existingProfileIds));
      await db.delete(jobseekerLanguages).where(inArray(jobseekerLanguages.profileId, existingProfileIds));
    }
    await db.delete(jobseekerProfiles).where(inArray(jobseekerProfiles.userId, existingUserIds));
    await db.delete(employerProfiles).where(inArray(employerProfiles.userId, existingUserIds));
    await db.delete(users).where(inArray(users.id, existingUserIds));
  }

  console.log(`Seeding ${EMPLOYER_COUNT} employers...`);
  for (let i = 0; i < EMPLOYER_COUNT; i++) {
    const industry = INDUSTRIES[i % INDUSTRIES.length];
    const companyName = randomCompanyName(industry);
    const contactName = randomFullName();
    const email = `employer${i + 1}@${SEED_EMAIL_DOMAIN}`;

    const [user] = await db
      .insert(users)
      .values({ email, name: contactName, role: "employer" })
      .returning({ id: users.id });

    const [profile] = await db
      .insert(employerProfiles)
      .values({
        userId: user.id,
        avatarUrl: personAvatarUrl(i),
        contactName,
        contactRole: pick(["HR Manager", "Talent Acquisition Lead", "Founder", "Operations Manager", "HR Executive"]),
        contactPhone: randomPhone(),
        contactEmail: email,
        companyName,
        ssmNumber: randomSsmNumber(),
        industry,
        industryCategory: industry,
        companySize: pick(COMPANY_SIZES),
        companyDescription: `${companyName} is a ${industry.toLowerCase()} company based in Malaysia, focused on delivering great service to our customers and building a strong team.`,
        logoUrl: companyLogoUrl(companyName),
        benefits: pickN(BENEFITS_POOL, randInt(3, 6)),
        websiteUrl: `https://${companyName.toLowerCase().replace(/\s+/g, "")}.com`,
        companyType: pick(COMPANY_TYPES),
        foundedYear: randInt(1998, 2023),
      })
      .returning({ id: employerProfiles.id });

    const address = pick(COMPANY_ADDRESSES);
    await db.insert(employerAddresses).values({
      employerProfileId: profile.id,
      label: "Headquarters",
      addressLine1: `${randInt(1, 88)}, ${address.street}`,
      city: address.city,
      state: address.state,
      postcode: String(randInt(10, 98)).padStart(2, "0") + String(randInt(100, 999)),
    });
  }

  console.log(`Seeding ${JOBSEEKER_COUNT} jobseekers...`);
  for (let i = 0; i < JOBSEEKER_COUNT; i++) {
    const industry = INDUSTRIES[i % INDUSTRIES.length];
    const fullName = randomFullName();
    const email = `jobseeker${i + 1}@${SEED_EMAIL_DOMAIN}`;
    const yearsExperience = randInt(0, 15);
    const salaryMin = randInt(2500, 8000);

    const [user] = await db
      .insert(users)
      .values({ email, name: fullName, role: "jobseeker" })
      .returning({ id: users.id });

    const [profile] = await db
      .insert(jobseekerProfiles)
      .values({
        userId: user.id,
        avatarUrl: personAvatarUrl(i + EMPLOYER_COUNT),
        fullName,
        dateOfBirth: randomDateOfBirth(),
        gender: pick(GENDERS),
        maritalStatus: pick(MARITAL_STATUSES),
        nationality: "Malaysian",
        phone: randomPhone(),
        drivingLicense: pick(DRIVING_LICENSES),
        location: pick(CITIES),
        targetRole: pick(ROLE_POOLS[industry]),
        preferredIndustry: industry,
        yearsExperience,
        professionalSkills: pickN(SKILL_POOLS[industry], randInt(3, 6)),
        softSkills: pickN(SOFT_SKILLS_POOL, randInt(2, 4)),
        employmentType: pick(EMPLOYMENT_TYPES),
        expectedSalaryMin: salaryMin,
        expectedSalaryMax: salaryMin + randInt(500, 3000),
        bio: `${fullName.split(" ")[0]} is a ${pick(ROLE_POOLS[industry]).toLowerCase()} with ${yearsExperience} years of experience in the ${industry.toLowerCase()} industry.`,
        noticePeriod: pick(NOTICE_PERIODS),
        workArrangement: pick(WORK_ARRANGEMENTS),
        workAuthorization: pick(WORK_AUTHORIZATIONS),
      })
      .returning({ id: jobseekerProfiles.id });

    if (yearsExperience > 0) {
      const experienceCount = randInt(1, Math.min(3, Math.max(1, Math.ceil(yearsExperience / 3))));
      const experiences = Array.from({ length: experienceCount }, (_, idx) => ({
        profileId: profile.id,
        company: pick(COMPANIES_FOR_EXPERIENCE),
        title: pick(ROLE_POOLS[industry]),
        startDate: randomPastDate(yearsExperience),
        endDate: idx === 0 ? null : randomPastDate(1),
        isCurrent: idx === 0,
        achievements: "Contributed to key projects and collaborated closely with cross-functional teams.",
        sortOrder: idx,
      }));
      await db.insert(jobseekerWorkExperiences).values(experiences);
    }

    await db.insert(jobseekerEducation).values({
      profileId: profile.id,
      institution: pick(INSTITUTIONS),
      fieldOfStudy: pick(["Computer Science", "Business Administration", "Marketing", "Nursing", "Information Technology", "Accounting"]),
      qualificationTier: pick(QUALIFICATION_TIERS),
      graduationYear: randInt(2010, 2023),
      sortOrder: 0,
    });

    if (Math.random() > 0.5) {
      await db.insert(jobseekerCertifications).values({
        profileId: profile.id,
        name: pick(["Project Management Professional", "AWS Certified Practitioner", "First Aid Certification", "Google Analytics Certified", "Six Sigma Yellow Belt"]),
        issuer: pick(["Coursera", "Udemy", "Local Training Institute", "Professional Body"]),
        year: randInt(2018, 2024),
        sortOrder: 0,
      });
    }

    const languages = pickN(LANGUAGES_POOL, randInt(1, 3));
    await db.insert(jobseekerLanguages).values(
      languages.map((language, idx) => ({
        profileId: profile.id,
        language,
        spokenLevel: pick(LANGUAGE_LEVELS),
        writtenLevel: pick(LANGUAGE_LEVELS),
        sortOrder: idx,
      })),
    );
  }

  console.log("Seeding real-branded companies (ParcelTracker, WHALE)...");
  await seedRealCompanies();

  console.log("Done.");
  await pool.end();
}

async function seedRealCompanies() {
  const [targetUser] = await db.select().from(users).where(eq(users.email, REAL_COMPANIES_OWNER_EMAIL)).limit(1);
  if (!targetUser) {
    console.log(`  Skipped — no user with email ${REAL_COMPANIES_OWNER_EMAIL} yet (sign in with it once first).`);
    return;
  }
  if (targetUser.role !== "employer") {
    console.log(`  Skipped — ${REAL_COMPANIES_OWNER_EMAIL} is a ${targetUser.role} account, not an employer.`);
    return;
  }

  // A one-time migration for anyone who ran an earlier version of this
  // seed, back when ParcelTracker was assigned via direct ownership
  // (employerProfiles.userId) instead of team access — that row lives
  // outside seedDummyCompanies' own seed-domain-owner cleanup (it was owned
  // by a real login, not a seed.jobgiga.test account), so it'd otherwise be
  // left behind as a stale duplicate. Cascades away its address and team
  // rows too.
  await db.delete(employerProfiles).where(eq(employerProfiles.companyName, "ParcelTracker"));

  await seedDummyCompanies(db, targetUser, REAL_COMPANIES_OWNER_EMAIL);
  console.log("  Seeded ParcelTracker (Owner) and WHALE (Admin).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
