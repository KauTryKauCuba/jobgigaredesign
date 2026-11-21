import { DRESS_CODES } from "./company-workplace";
import { isValidMalaysianPhone } from "./phone";
import { plainTextToHtml } from "./richText";
import { sanitizeDescriptionHtml } from "./sanitizeHtml";

export const COMPANY_SIZES = ["1-10", "11-50", "51-200", "201-500", "500+"] as const;
export const COMPANY_TYPES = ["Startup", "SME", "MNC", "GLC", "Government"] as const;

export type CompanyEdits = {
  companyDescription?: string | null;
  websiteUrl?: string | null;
  companyEmail?: string | null;
  companyPhone?: string | null;
  companyLinkedin?: string | null;
  companyFacebook?: string | null;
  companyInstagram?: string | null;
  foundedYear?: number | null;
  companyType?: string | null;
  companySize?: string;
  benefits?: string[];
  dressCode?: string | null;
};

const TEXT_MAX = 500;
const DESCRIPTION_MAX = 20_000;

/**
 * Validates a partial edit of a company's details, by the Company Profile
 * form's rules. Fields left out stay as they are; null or blank clears one.
 * Only plain details: the name, SSM number, addresses and images are saved
 * through the full form, which handles their re-verification and uploads.
 */
export function parseCompanyEdits(input: Record<string, unknown>): { ok: true; values: CompanyEdits } | { ok: false; error: string } {
  const values: CompanyEdits = {};
  const clean = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);
  const isText = (value: unknown) => value === null || typeof value === "string";

  if (input.companyDescription !== undefined) {
    if (!isText(input.companyDescription) || String(input.companyDescription ?? "").length > DESCRIPTION_MAX) {
      return { ok: false, error: "Invalid company description." };
    }
    const description = clean(input.companyDescription);
    values.companyDescription = description && sanitizeDescriptionHtml(plainTextToHtml(description));
  }
  const links = [
    ["websiteUrl", "website"],
    ["companyLinkedin", "LinkedIn link"],
    ["companyFacebook", "Facebook link"],
    ["companyInstagram", "Instagram link"],
  ] as const;
  for (const [key, label] of links) {
    if (input[key] === undefined) continue;
    const link = clean(input[key]);
    if (!isText(input[key]) || (link && (link.length > TEXT_MAX || /\s/.test(link)))) {
      return { ok: false, error: `Invalid ${label}.` };
    }
    values[key] = link;
  }
  if (input.companyEmail !== undefined) {
    const email = clean(input.companyEmail);
    if (!isText(input.companyEmail) || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      return { ok: false, error: "Enter a valid company email." };
    }
    values.companyEmail = email && email.toLowerCase();
  }
  if (input.companyPhone !== undefined) {
    const phone = clean(input.companyPhone);
    if (!isText(input.companyPhone) || (phone && !isValidMalaysianPhone(phone))) {
      return { ok: false, error: "Enter a valid company phone number, e.g. 03-1234 5678." };
    }
    values.companyPhone = phone;
  }
  if (input.foundedYear !== undefined) {
    const year = input.foundedYear;
    if (year !== null && !(typeof year === "number" && Number.isInteger(year) && year >= 1800 && year <= new Date().getFullYear())) {
      return { ok: false, error: "Invalid founded year." };
    }
    values.foundedYear = year;
  }
  if (input.companyType !== undefined) {
    const type = clean(input.companyType);
    if (!isText(input.companyType) || (type && !(COMPANY_TYPES as readonly string[]).includes(type))) {
      return { ok: false, error: `Company type must be one of: ${COMPANY_TYPES.join(", ")}.` };
    }
    values.companyType = type;
  }
  if (input.companySize !== undefined) {
    const size = clean(input.companySize);
    if (!size || !(COMPANY_SIZES as readonly string[]).includes(size)) {
      return { ok: false, error: `Company size must be one of: ${COMPANY_SIZES.join(", ")}.` };
    }
    values.companySize = size;
  }
  if (input.benefits !== undefined) {
    if (!Array.isArray(input.benefits) || !input.benefits.every((b) => typeof b === "string" && b.trim() && b.length <= TEXT_MAX)) {
      return { ok: false, error: "Invalid benefits list." };
    }
    values.benefits = [...new Set(input.benefits.map((b: string) => b.trim()))];
  }
  if (input.dressCode !== undefined) {
    const dress = clean(input.dressCode);
    if (!isText(input.dressCode) || (dress && !(DRESS_CODES as readonly string[]).includes(dress))) {
      return { ok: false, error: `Dress code must be one of: ${DRESS_CODES.join(", ")}.` };
    }
    values.dressCode = dress;
  }
  if (Object.keys(values).length === 0) return { ok: false, error: "Nothing to save." };
  return { ok: true, values };
}
