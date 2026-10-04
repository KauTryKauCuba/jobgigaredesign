import { sanitizeDescriptionHtml } from "./sanitizeHtml";

// The Resume Designer's templates. Each one renders the jobseeker's profile
// data to a plain HTML string styled only by RESUME_CSS (no Tailwind), so the
// on-screen live preview and the print-to-PDF download are byte-for-byte the
// same page. No AI involved — the design is fixed, the content is theirs.

export type ResumeTemplate = "clean" | "modern" | "executive";
export type ResumeLanguage = "en" | "bm";

export const RESUME_TEMPLATES: { value: ResumeTemplate; label: string; description: string }[] = [
  { value: "clean", label: "Clean", description: "Simple single column — reads well everywhere." },
  { value: "modern", label: "Modern", description: "Coloured side panel for contact & skills." },
  { value: "executive", label: "Executive", description: "Classic serif look for senior roles." },
];

export type ResumeData = {
  fullName: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  linkedinUrl: string;
  portfolioUrl: string;
  githubUrl: string;
  avatarUrl: string | null;
  summaryHtml: string;
  experiences: {
    title: string;
    company: string;
    startDate: string;
    endDate: string;
    isCurrent: boolean;
    achievementsHtml: string;
  }[];
  education: {
    institution: string;
    fieldOfStudy: string;
    qualificationTier: string;
    cgpa: string;
    graduationYear: string;
  }[];
  certifications: { name: string; issuer: string; year: string }[];
  skills: string[];
  softSkills: string[];
  languages: { language: string; spokenLevel: string }[];
};

// A4 at 96dpi — the preview page and the printed page are the same size.
export const RESUME_PAGE_WIDTH = 794;
export const RESUME_PAGE_HEIGHT = 1123;

const HEADINGS: Record<ResumeLanguage, Record<string, string>> = {
  en: {
    summary: "Profile Summary",
    experience: "Work Experience",
    education: "Education",
    certifications: "Certifications",
    skills: "Skills",
    softSkills: "Soft Skills",
    languages: "Languages",
    contact: "Contact",
    present: "Present",
  },
  bm: {
    summary: "Ringkasan Profil",
    experience: "Pengalaman Kerja",
    education: "Pendidikan",
    certifications: "Pensijilan",
    skills: "Kemahiran",
    softSkills: "Kemahiran Insaniah",
    languages: "Bahasa",
    contact: "Hubungan",
    present: "Kini",
  },
};

const LEVEL_LABEL: Record<ResumeLanguage, Record<string, string>> = {
  en: { basic: "Basic", conversational: "Conversational", fluent: "Fluent", native: "Native" },
  bm: { basic: "Asas", conversational: "Perbualan", fluent: "Fasih", native: "Bahasa ibunda" },
};

function esc(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isBlankHtml(html: string) {
  return !html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
}

function rich(html: string) {
  return sanitizeDescriptionHtml(html);
}

function displayUrl(url: string) {
  return url.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
}

function contactItems(d: ResumeData) {
  return [
    d.email.trim(),
    d.phone.trim(),
    d.location.trim(),
    ...[d.linkedinUrl, d.portfolioUrl, d.githubUrl].map((u) => displayUrl(u.trim())),
  ].filter(Boolean);
}

function dateRange(e: ResumeData["experiences"][number], lang: ResumeLanguage) {
  const end = e.isCurrent ? HEADINGS[lang].present : e.endDate.trim();
  return [e.startDate.trim(), end].filter(Boolean).join(" – ");
}

function section(title: string, body: string) {
  return body ? `<section class="rz-section"><h2 class="rz-h2">${esc(title)}</h2>${body}</section>` : "";
}

function summaryBlock(d: ResumeData, h: Record<string, string>) {
  return isBlankHtml(d.summaryHtml) ? "" : section(h.summary, `<div class="rz-rich">${rich(d.summaryHtml)}</div>`);
}

function experienceBlock(d: ResumeData, h: Record<string, string>, lang: ResumeLanguage) {
  const items = d.experiences
    .filter((e) => e.title.trim() || e.company.trim())
    .map(
      (e) => `<div class="rz-item">
  <div class="rz-item-head"><div><div class="rz-item-title">${esc(e.title)}</div><div class="rz-item-sub">${esc(e.company)}</div></div><div class="rz-date">${esc(dateRange(e, lang))}</div></div>
  ${isBlankHtml(e.achievementsHtml) ? "" : `<div class="rz-rich">${rich(e.achievementsHtml)}</div>`}
</div>`,
    )
    .join("");
  return section(h.experience, items);
}

function educationBlock(d: ResumeData, h: Record<string, string>) {
  const items = d.education
    .filter((e) => e.institution.trim())
    .map((e) => {
      const qualification = [e.qualificationTier, e.fieldOfStudy.trim()].filter(Boolean).join(" · ");
      const cgpa = e.cgpa.trim() ? ` · CGPA ${esc(e.cgpa.trim())}` : "";
      return `<div class="rz-item"><div class="rz-item-head"><div><div class="rz-item-title">${esc(e.institution)}</div><div class="rz-item-sub">${esc(qualification)}${cgpa}</div></div><div class="rz-date">${esc(e.graduationYear)}</div></div></div>`;
    })
    .join("");
  return section(h.education, items);
}

function certificationsBlock(d: ResumeData, h: Record<string, string>) {
  const items = d.certifications
    .filter((c) => c.name.trim())
    .map(
      (c) =>
        `<li><span class="rz-strong">${esc(c.name)}</span>${c.issuer.trim() ? ` — ${esc(c.issuer)}` : ""}${c.year.trim() ? ` (${esc(c.year)})` : ""}</li>`,
    )
    .join("");
  return section(h.certifications, items ? `<ul class="rz-list">${items}</ul>` : "");
}

function chips(items: string[]) {
  const clean = items.map((s) => s.trim()).filter(Boolean);
  return clean.length ? `<div class="rz-chips">${clean.map((s) => `<span class="rz-chip">${esc(s)}</span>`).join("")}</div>` : "";
}

function skillsBlock(d: ResumeData, h: Record<string, string>) {
  return section(h.skills, chips(d.skills)) + section(h.softSkills, chips(d.softSkills));
}

function languagesBlock(d: ResumeData, h: Record<string, string>, lang: ResumeLanguage) {
  const items = d.languages
    .filter((l) => l.language.trim())
    .map((l) => `<li><span class="rz-strong">${esc(l.language)}</span> — ${esc(LEVEL_LABEL[lang][l.spokenLevel] ?? l.spokenLevel)}</li>`)
    .join("");
  return section(h.languages, items ? `<ul class="rz-list rz-plain">${items}</ul>` : "");
}

function photo(d: ResumeData, showPhoto: boolean) {
  return showPhoto && d.avatarUrl ? `<img class="rz-photo" src="${esc(d.avatarUrl)}" alt="" />` : "";
}

export function renderResumeHtml(
  d: ResumeData,
  template: ResumeTemplate,
  lang: ResumeLanguage,
  opts: { showPhoto: boolean },
) {
  const h = HEADINGS[lang];
  const name = esc(d.fullName.trim() || "Your Name");
  const headline = d.headline.trim() ? `<div class="rz-headline">${esc(d.headline)}</div>` : "";

  if (template === "modern") {
    const contact = contactItems(d)
      .map((c) => `<li>${esc(c)}</li>`)
      .join("");
    return `<div class="rz-page rz-modern">
  <aside class="rz-side">
    ${photo(d, opts.showPhoto)}
    ${contact ? section(h.contact, `<ul class="rz-list rz-plain">${contact}</ul>`) : ""}
    ${skillsBlock(d, h)}
    ${languagesBlock(d, h, lang)}
  </aside>
  <main class="rz-main">
    <header class="rz-header"><h1 class="rz-name">${name}</h1>${headline}</header>
    ${summaryBlock(d, h)}
    ${experienceBlock(d, h, lang)}
    ${educationBlock(d, h)}
    ${certificationsBlock(d, h)}
  </main>
</div>`;
  }

  const contactLine = contactItems(d)
    .map((c) => `<span>${esc(c)}</span>`)
    .join('<span class="rz-sep">•</span>');
  return `<div class="rz-page rz-${template}">
  <header class="rz-header">
    ${photo(d, opts.showPhoto)}
    <div class="rz-header-text"><h1 class="rz-name">${name}</h1>${headline}${contactLine ? `<div class="rz-contact">${contactLine}</div>` : ""}</div>
  </header>
  ${summaryBlock(d, h)}
  ${experienceBlock(d, h, lang)}
  ${educationBlock(d, h)}
  ${skillsBlock(d, h)}
  ${certificationsBlock(d, h)}
  ${languagesBlock(d, h, lang)}
</div>`;
}

// Scoped under .rz-page so it can sit inside the app without leaking.
export const RESUME_CSS = `
.rz-page{box-sizing:border-box;width:${RESUME_PAGE_WIDTH}px;min-height:${RESUME_PAGE_HEIGHT}px;background:#fff;color:#1F2937;font-family:Inter,"Helvetica Neue",Arial,sans-serif;font-size:13px;line-height:1.5;padding:48px 52px;text-align:left}
.rz-page *{box-sizing:border-box}
.rz-page h1,.rz-page h2{margin:0}
.rz-name{font-size:30px;font-weight:700;letter-spacing:-0.02em;color:#111827;line-height:1.15}
.rz-headline{margin-top:4px;font-size:15px;color:#0F5C63;font-weight:500}
.rz-contact{margin-top:10px;font-size:12px;color:#4B5563;display:flex;flex-wrap:wrap;gap:4px 8px}
.rz-sep{color:#C0C6D0}
.rz-header{display:flex;align-items:center;gap:20px;margin-bottom:22px}
.rz-photo{width:84px;height:84px;border-radius:50%;object-fit:cover;flex-shrink:0}
.rz-section{margin-top:18px;break-inside:auto}
.rz-h2{font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#0F5C63;padding-bottom:6px;margin-bottom:10px;border-bottom:1px solid #E5E7EB}
.rz-item{margin-bottom:12px;break-inside:avoid}
.rz-item-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}
.rz-item-title{font-weight:600;color:#111827}
.rz-item-sub{color:#4B5563}
.rz-date{color:#6B7280;font-size:12px;white-space:nowrap}
.rz-rich{margin-top:4px;color:#374151}
.rz-rich ul,.rz-rich ol{margin:4px 0;padding-left:18px}
.rz-rich ul{list-style:disc}.rz-rich ol{list-style:decimal}
.rz-rich li{margin:2px 0}
.rz-rich a{color:inherit}
.rz-list{margin:0;padding-left:18px;list-style:disc}
.rz-list li{margin:3px 0}
.rz-plain{list-style:none;padding-left:0}
.rz-strong{font-weight:600;color:#111827}
.rz-chips{display:flex;flex-wrap:wrap;gap:6px}
.rz-chip{border:1px solid #D1D5DB;border-radius:999px;padding:2px 10px;font-size:12px;color:#374151}

/* Clean */
.rz-clean .rz-header{border-bottom:3px solid #0F5C63;padding-bottom:18px}

/* Modern */
.rz-modern{display:flex;padding:0}
.rz-modern .rz-side{width:250px;flex-shrink:0;background:#0F5C63;color:#E6F2F2;padding:44px 26px}
.rz-modern .rz-main{flex:1;padding:44px 40px}
.rz-modern .rz-side .rz-photo{display:block;width:120px;height:120px;margin:0 auto 18px;border:3px solid rgba(255,255,255,0.35)}
.rz-modern .rz-side .rz-section:first-of-type{margin-top:0}
.rz-modern .rz-side .rz-h2{color:#FFE9A6;border-bottom-color:rgba(255,255,255,0.2)}
.rz-modern .rz-side .rz-strong{color:#fff}
.rz-modern .rz-side li{word-break:break-word;font-size:12px}
.rz-modern .rz-side .rz-chip{border-color:rgba(255,255,255,0.35);color:#fff}
.rz-modern .rz-header{display:block;margin-bottom:8px}
.rz-modern .rz-name{font-size:32px}

/* Executive */
.rz-executive{font-family:Georgia,"Times New Roman",serif;padding:54px 60px}
.rz-executive .rz-header{flex-direction:column;text-align:center;gap:12px;border-bottom:1px solid #A8842C;padding-bottom:18px}
.rz-executive .rz-contact{justify-content:center}
.rz-executive .rz-name{font-size:32px;font-weight:400;letter-spacing:0.04em;text-transform:uppercase}
.rz-executive .rz-headline{color:#8A6A1F;font-style:italic}
.rz-executive .rz-h2{color:#8A6A1F;text-align:center;border-bottom:none;letter-spacing:0.18em;font-weight:400;font-size:13px}
.rz-executive .rz-chip{border-color:#D9C79A}
`;

/** A complete standalone document for print/PDF. */
export function resumeDocument(title: string, bodyHtml: string, baseHref?: string) {
  return `<!doctype html><html><head><meta charset="utf-8">${baseHref ? `<base href="${esc(baseHref)}/">` : ""}<title>${esc(title)}</title>
<style>@page{size:A4;margin:0}html,body{margin:0;padding:0;background:#fff}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}${RESUME_CSS}
@media print{.rz-page{min-height:${RESUME_PAGE_HEIGHT}px}.rz-modern .rz-side{min-height:${RESUME_PAGE_HEIGHT}px}}</style>
</head><body>${bodyHtml}</body></html>`;
}
