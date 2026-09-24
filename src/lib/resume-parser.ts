import "server-only";
import { extractImages as extractPdfImages, extractText as extractPdfText, getDocumentProxy } from "unpdf";
import mammoth from "mammoth";
import sharp from "sharp";

export const RESUME_MAX_BYTES = 10 * 1024 * 1024;
const MAX_TEXT_CHARS = 15000;
const DEEPSEEK_ENDPOINT = "https://api.deepseek.com/chat/completions";
const MIMO_ENDPOINT = "https://api.xiaomimimo.com/v1/chat/completions";
const RETRY_ATTEMPTS = 3;

export const EMPLOYMENT_TYPES = ["full_time", "part_time", "contract", "internship"] as const;
export const QUALIFICATION_TIERS = ["SPM", "STPM", "Diploma", "Degree", "Master", "PhD", "Other"] as const;
export const LANGUAGE_LEVELS = ["basic", "conversational", "fluent", "native"] as const;
export const GENDERS = ["male", "female", "other", "prefer_not_to_say"] as const;
export const MARITAL_STATUSES = ["single", "married", "divorced", "widowed", "prefer_not_to_say"] as const;
export const DRIVING_LICENSES = ["none", "b2", "b", "d", "da", "e"] as const;

const SYSTEM_PROMPT = `You extract structured profile data from a resume's text for a Malaysian job platform. Respond with ONLY a json object, no prose, matching exactly this shape:
{
  "fullName": string | null,
  "dateOfBirth": string | null,
  "gender": ${GENDERS.map((g) => `"${g}"`).join(" | ")} | null,
  "maritalStatus": ${MARITAL_STATUSES.map((m) => `"${m}"`).join(" | ")} | null,
  "nationality": string | null,
  "phone": string | null,
  "drivingLicense": ${DRIVING_LICENSES.map((d) => `"${d}"`).join(" | ")} | null,
  "location": string | null,
  "targetRole": string | null,
  "yearsExperience": number | null,
  "professionalSkills": string[],
  "softSkills": string[],
  "employmentType": "full_time" | "part_time" | "contract" | "internship" | null,
  "expectedSalaryMin": number | null,
  "expectedSalaryMax": number | null,
  "bio": string | null,
  "linkedinUrl": string | null,
  "portfolioUrl": string | null,
  "githubUrl": string | null,
  "workExperiences": { "company": string, "title": string, "startDate": string, "endDate": string | null, "isCurrent": boolean, "achievements": string | null }[],
  "education": { "institution": string, "fieldOfStudy": string | null, "qualificationTier": ${QUALIFICATION_TIERS.map((t) => `"${t}"`).join(" | ")}, "cgpa": string | null, "graduationYear": number | null }[],
  "certifications": { "name": string, "issuer": string | null, "year": number | null }[],
  "languages": { "language": string, "spokenLevel": ${LANGUAGE_LEVELS.map((l) => `"${l}"`).join(" | ")}, "writtenLevel": ${LANGUAGE_LEVELS.map((l) => `"${l}"`).join(" | ")} }[],
  "references": { "fullName": string, "jobTitle": string | null, "company": string | null, "phone": string | null, "email": string | null }[]
}
Use null for anything you cannot determine from the text. Never invent data. Array fields default to an empty array if none are found. "references" are professional references explicitly listed on the resume (e.g. under a "References" heading) — never invent one, and never treat a listed work-experience contact/supervisor as a reference unless the resume itself presents them as a reference; a resume that just says "References available upon request" with no actual names yields an empty array. "professionalSkills" are hard/technical skills, tools, and technologies (e.g. "Photoshop", "SQL", "Project Management"). "softSkills" are work-style/interpersonal skills (e.g. "Teamwork", "Communication", "Problem Solving") — only include one if the resume actually states or clearly demonstrates it, don't pad the list generically. "targetRole" is the role this person is likely seeking next, inferred from their most recent title/experience. "bio" is a 1-3 sentence professional summary written from the resume content, or null if there isn't enough to summarize. "startDate"/"endDate" should use whatever granularity the resume gives (e.g. "Jan 2022" or "2022"); "endDate" is null when "isCurrent" is true. "qualificationTier" must be the closest match from the given list based on the highest/most relevant qualification in that entry. "cgpa" is the exact grade/CGPA as written on the resume (e.g. "3.75", "3.75/4.00", "First Class Honours"), or null if not stated. "dateOfBirth" must be a full "YYYY-MM-DD" date only if the resume states one explicitly — never derive it from a stated age alone. "gender" and "maritalStatus" are only filled when stated explicitly on the resume (common on Malaysian-style CVs), never guessed from a name. "phone" is the contact phone number as written. "drivingLicense" is the closest matching class from the list when the resume states one (e.g. "own transport, license D" -> "d"); use "none" only when the resume explicitly says no license, otherwise null.`;

type ProviderUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

type ProviderResponse = {
  choices?: { message?: { content?: string } }[];
  usage?: ProviderUsage;
  error?: { message?: string };
};

export type ParsedWorkExperience = {
  company: string;
  title: string;
  startDate: string;
  endDate: string | null;
  isCurrent: boolean;
  achievements: string | null;
};

export type ParsedEducation = {
  institution: string;
  fieldOfStudy: string | null;
  qualificationTier: (typeof QUALIFICATION_TIERS)[number];
  cgpa: string | null;
  graduationYear: number | null;
};

export type ParsedCertification = {
  name: string;
  issuer: string | null;
  year: number | null;
};

export type ParsedReference = {
  fullName: string;
  jobTitle: string | null;
  company: string | null;
  phone: string | null;
  email: string | null;
};

export type ParsedLanguage = {
  language: string;
  spokenLevel: (typeof LANGUAGE_LEVELS)[number];
  writtenLevel: (typeof LANGUAGE_LEVELS)[number];
};

export type ParsedProfile = {
  fullName: string | null;
  dateOfBirth: string | null;
  gender: (typeof GENDERS)[number] | null;
  maritalStatus: (typeof MARITAL_STATUSES)[number] | null;
  nationality: string | null;
  phone: string | null;
  drivingLicense: (typeof DRIVING_LICENSES)[number] | null;
  location: string | null;
  targetRole: string | null;
  yearsExperience: number | null;
  professionalSkills: string[];
  softSkills: string[];
  employmentType: (typeof EMPLOYMENT_TYPES)[number] | null;
  expectedSalaryMin: number | null;
  expectedSalaryMax: number | null;
  bio: string | null;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  githubUrl: string | null;
  workExperiences: ParsedWorkExperience[];
  education: ParsedEducation[];
  certifications: ParsedCertification[];
  languages: ParsedLanguage[];
  references: ParsedReference[];
};

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function nullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function nullableBool(value: unknown): boolean {
  return value === true;
}

function nullableEnum<T extends string>(value: unknown, options: readonly T[]): T | null {
  return typeof value === "string" && (options as readonly string[]).includes(value)
    ? (value as T)
    : null;
}

const DATE_OF_BIRTH_RE = /^\d{4}-\d{2}-\d{2}$/;

function nullableDateOfBirth(value: unknown): string | null {
  return typeof value === "string" && DATE_OF_BIRTH_RE.test(value) ? value : null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function nullableEmail(value: unknown): string | null {
  return typeof value === "string" && EMAIL_RE.test(value.trim()) ? value.trim().toLowerCase() : null;
}

function parseWorkExperiences(value: unknown): ParsedWorkExperience[] {
  if (!Array.isArray(value)) return [];
  const entries: ParsedWorkExperience[] = [];
  for (const raw of value) {
    const obj = (raw ?? {}) as Record<string, unknown>;
    const company = nullableString(obj.company);
    const title = nullableString(obj.title);
    const startDate = nullableString(obj.startDate);
    if (!company || !title || !startDate) continue;
    entries.push({
      company,
      title,
      startDate,
      endDate: nullableString(obj.endDate),
      isCurrent: nullableBool(obj.isCurrent),
      achievements: nullableString(obj.achievements),
    });
  }
  return entries;
}

function parseEducation(value: unknown): ParsedEducation[] {
  if (!Array.isArray(value)) return [];
  const entries: ParsedEducation[] = [];
  for (const raw of value) {
    const obj = (raw ?? {}) as Record<string, unknown>;
    const institution = nullableString(obj.institution);
    const qualificationTier =
      typeof obj.qualificationTier === "string" &&
      (QUALIFICATION_TIERS as readonly string[]).includes(obj.qualificationTier)
        ? (obj.qualificationTier as (typeof QUALIFICATION_TIERS)[number])
        : null;
    if (!institution || !qualificationTier) continue;
    entries.push({
      institution,
      fieldOfStudy: nullableString(obj.fieldOfStudy),
      qualificationTier,
      cgpa: nullableString(obj.cgpa),
      graduationYear: nullableNumber(obj.graduationYear),
    });
  }
  return entries;
}

function parseCertifications(value: unknown): ParsedCertification[] {
  if (!Array.isArray(value)) return [];
  const entries: ParsedCertification[] = [];
  for (const raw of value) {
    const obj = (raw ?? {}) as Record<string, unknown>;
    const name = nullableString(obj.name);
    if (!name) continue;
    entries.push({ name, issuer: nullableString(obj.issuer), year: nullableNumber(obj.year) });
  }
  return entries;
}

function parseReferences(value: unknown): ParsedReference[] {
  if (!Array.isArray(value)) return [];
  const entries: ParsedReference[] = [];
  for (const raw of value) {
    const obj = (raw ?? {}) as Record<string, unknown>;
    const fullName = nullableString(obj.fullName);
    if (!fullName) continue;
    entries.push({
      fullName,
      jobTitle: nullableString(obj.jobTitle),
      company: nullableString(obj.company),
      phone: nullableString(obj.phone),
      email: nullableEmail(obj.email),
    });
  }
  return entries;
}

function parseLanguages(value: unknown): ParsedLanguage[] {
  if (!Array.isArray(value)) return [];
  const entries: ParsedLanguage[] = [];
  for (const raw of value) {
    const obj = (raw ?? {}) as Record<string, unknown>;
    const language = nullableString(obj.language);
    const spokenLevel =
      typeof obj.spokenLevel === "string" && (LANGUAGE_LEVELS as readonly string[]).includes(obj.spokenLevel)
        ? (obj.spokenLevel as (typeof LANGUAGE_LEVELS)[number])
        : null;
    const writtenLevel =
      typeof obj.writtenLevel === "string" && (LANGUAGE_LEVELS as readonly string[]).includes(obj.writtenLevel)
        ? (obj.writtenLevel as (typeof LANGUAGE_LEVELS)[number])
        : null;
    if (!language || !spokenLevel || !writtenLevel) continue;
    entries.push({ language, spokenLevel, writtenLevel });
  }
  return entries;
}

export function validateParsedProfile(raw: unknown): ParsedProfile {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const employmentType =
    typeof obj.employmentType === "string" &&
    (EMPLOYMENT_TYPES as readonly string[]).includes(obj.employmentType)
      ? (obj.employmentType as (typeof EMPLOYMENT_TYPES)[number])
      : null;

  return {
    fullName: nullableString(obj.fullName),
    dateOfBirth: nullableDateOfBirth(obj.dateOfBirth),
    gender: nullableEnum(obj.gender, GENDERS),
    maritalStatus: nullableEnum(obj.maritalStatus, MARITAL_STATUSES),
    nationality: nullableString(obj.nationality),
    phone: nullableString(obj.phone),
    drivingLicense: nullableEnum(obj.drivingLicense, DRIVING_LICENSES),
    location: nullableString(obj.location),
    targetRole: nullableString(obj.targetRole),
    yearsExperience: nullableNumber(obj.yearsExperience),
    professionalSkills: Array.isArray(obj.professionalSkills)
      ? obj.professionalSkills.filter((s): s is string => typeof s === "string")
      : [],
    softSkills: Array.isArray(obj.softSkills)
      ? obj.softSkills.filter((s): s is string => typeof s === "string")
      : [],
    employmentType,
    bio: nullableString(obj.bio),
    linkedinUrl: nullableString(obj.linkedinUrl),
    portfolioUrl: nullableString(obj.portfolioUrl),
    githubUrl: nullableString(obj.githubUrl),
    workExperiences: parseWorkExperiences(obj.workExperiences),
    education: parseEducation(obj.education),
    certifications: parseCertifications(obj.certifications),
    languages: parseLanguages(obj.languages),
    references: parseReferences(obj.references),
    expectedSalaryMin: nullableNumber(obj.expectedSalaryMin),
    expectedSalaryMax: nullableNumber(obj.expectedSalaryMax),
  };
}

async function extractText(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();

  if (name.endsWith(".pdf")) {
    const result = await extractPdfText(new Uint8Array(buffer), { mergePages: true });
    return result.text;
  }

  if (name.endsWith(".docx")) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  throw new Error("Unsupported file type.");
}

// A resume photo is almost always close to square/portrait and a modest
// size — this rules out company logos (wide/thin), decorative banners
// (huge), and tiny bullet/skill icons (tiny) without needing a vision model.
// The upper bound only needs to catch full-page background scans (which
// come out well above this at any normal scan DPI); it was previously 1600,
// which rejected a real headshot embedded at plain phone-camera resolution
// (1613x2048) — raised with headroom for that case.
const PHOTO_MIN_SOURCE_DIMENSION = 80;
const PHOTO_MAX_SOURCE_DIMENSION = 2400;
const PHOTO_MIN_ASPECT = 0.55;
const PHOTO_MAX_ASPECT = 1.75;
const PHOTO_MAX_OUTPUT_DIMENSION = 480;

function looksLikeHeadshot(width: number, height: number): boolean {
  if (width < PHOTO_MIN_SOURCE_DIMENSION || height < PHOTO_MIN_SOURCE_DIMENSION) return false;
  if (width > PHOTO_MAX_SOURCE_DIMENSION || height > PHOTO_MAX_SOURCE_DIMENSION) return false;
  const aspect = width / height;
  return aspect >= PHOTO_MIN_ASPECT && aspect <= PHOTO_MAX_ASPECT;
}

async function encodeImageBufferAsDataUrl(buffer: Buffer): Promise<string> {
  const png = await sharp(buffer)
    .resize(PHOTO_MAX_OUTPUT_DIMENSION, PHOTO_MAX_OUTPUT_DIMENSION, { fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}

async function extractPdfHeadshot(buffer: Buffer): Promise<string | null> {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    // Resume photos are placed on the first page — later pages are just
    // noise (and cost) to scan for this.
    const images = await extractPdfImages(pdf, 1);
    let best: { data: Uint8ClampedArray; width: number; height: number; channels: 1 | 3 | 4; area: number } | null =
      null;
    for (const img of images) {
      if (!looksLikeHeadshot(img.width, img.height)) continue;
      const area = img.width * img.height;
      if (!best || area > best.area) best = { ...img, area };
    }
    if (!best) return null;
    return await encodeImageBufferAsDataUrl(
      await sharp(Buffer.from(best.data), { raw: { width: best.width, height: best.height, channels: best.channels } })
        .png()
        .toBuffer(),
    );
  } catch (err) {
    console.error("resume photo extraction (pdf) failed:", err);
    return null;
  }
}

async function extractDocxHeadshot(buffer: Buffer): Promise<string | null> {
  try {
    const candidates: Buffer[] = [];
    const collectImage = mammoth.images.imgElement((element: { read: (encoding: "base64") => Promise<string> }) =>
      element.read("base64").then((base64) => {
        candidates.push(Buffer.from(base64, "base64"));
        return { src: "" };
      }),
    );
    // We only want the side effect of collectImage populating `candidates` —
    // the generated HTML itself is discarded.
    await mammoth.convertToHtml({ buffer }, { convertImage: collectImage });

    let best: { buffer: Buffer; area: number } | null = null;
    for (const candidate of candidates.slice(0, 8)) {
      let metadata;
      try {
        metadata = await sharp(candidate).metadata();
      } catch {
        continue;
      }
      const { width, height } = metadata;
      if (!width || !height || !looksLikeHeadshot(width, height)) continue;
      const area = width * height;
      if (!best || area > best.area) best = { buffer: candidate, area };
    }
    if (!best) return null;
    return await encodeImageBufferAsDataUrl(best.buffer);
  } catch (err) {
    console.error("resume photo extraction (docx) failed:", err);
    return null;
  }
}

// Best-effort — a resume without an extractable headshot (or one this
// heuristic can't confidently pick out) just yields null, never an error.
async function extractHeadshot(file: File): Promise<string | null> {
  const name = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());
  if (name.endsWith(".pdf")) return extractPdfHeadshot(buffer);
  if (name.endsWith(".docx")) return extractDocxHeadshot(buffer);
  return null;
}

class ProviderError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/**
 * The connection to api.deepseek.com is intermittently flaky from this
 * network (sometimes connects instantly, sometimes hangs for the full
 * timeout) — retrying a couple of times smooths over that without needing
 * the user to manually re-upload. Throws on failure (rather than returning
 * an error result) so callBestProvider's Promise.any race only needs one
 * provider to actually succeed.
 */
async function callProvider(
  endpoint: string,
  model: string,
  apiKey: string,
  text: string,
): Promise<{ content: string; usage: ProviderUsage | null }> {
  let lastError: ProviderError | null = null;
  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    try {
      const upstream = await fetch(endpoint, {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          response_format: { type: "json_object" },
          temperature: 0,
          max_tokens: 2000,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: text.slice(0, MAX_TEXT_CHARS) },
          ],
        }),
      });

      const data: ProviderResponse = await upstream.json().catch(() => ({}));
      if (!upstream.ok) {
        lastError = new ProviderError(data.error?.message ?? "Resume parsing request failed.", upstream.status);
        console.error(`${model} call failed (attempt ${attempt}/${RETRY_ATTEMPTS}): ${upstream.status}`);
        continue;
      }

      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        lastError = new ProviderError("Couldn't read that resume. Try filling in manually.", 502);
        continue;
      }
      return { content, usage: data.usage ?? null };
    } catch (err) {
      console.error(`${model} call failed (attempt ${attempt}/${RETRY_ATTEMPTS}):`, err);
    }
  }
  throw lastError ?? new ProviderError("Couldn't reach the resume parsing service. Try again.", 502);
}

// Races whichever of DeepSeek/MiMo is configured (first to succeed wins) —
// same pattern as matching-ai.ts and suggest-job-posting — so a busy/
// overloaded DeepSeek (its "Service is too busy" 503) doesn't fail resume
// parsing outright when a second provider is available.
async function callBestProvider(
  text: string,
): Promise<
  | { ok: true; content: string; usage: ProviderUsage | null; provider: string }
  | { ok: false; error: string; status: number }
> {
  const deepseekKey = process.env.DEEPSEEK_API_KEY ?? null;
  const mimoKey = process.env.MIMO_API_KEY ?? null;

  const attempts: Promise<{ content: string; usage: ProviderUsage | null; provider: string }>[] = [];
  if (deepseekKey) {
    attempts.push(
      callProvider(DEEPSEEK_ENDPOINT, "deepseek-chat", deepseekKey, text).then((r) => ({ ...r, provider: "deepseek" })),
    );
  }
  if (mimoKey) {
    attempts.push(callProvider(MIMO_ENDPOINT, "mimo-v2.5", mimoKey, text).then((r) => ({ ...r, provider: "mimo" })));
  }

  if (attempts.length === 0) {
    return { ok: false, error: "Resume parsing is not configured.", status: 500 };
  }

  try {
    const won = await Promise.any(attempts);
    return { ok: true, ...won };
  } catch (err) {
    const first = err instanceof AggregateError ? (err.errors[0] as ProviderError | undefined) : undefined;
    return {
      ok: false,
      error: first?.message ?? "Couldn't reach the resume parsing service. Try again.",
      status: first?.status ?? 502,
    };
  }
}

export function isSupportedResumeFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith(".pdf") || name.endsWith(".docx");
}

export type ResumeParseResult =
  | {
      ok: true;
      profile: ParsedProfile;
      usage: ProviderUsage | null;
      provider: string;
      durationMs: number;
      photoUrl: string | null;
    }
  | { ok: false; error: string; status: number };

export async function parseResumeFile(file: File): Promise<ResumeParseResult> {
  let text: string;
  try {
    text = (await extractText(file)).trim();
  } catch (err) {
    console.error("resume extractText failed:", err);
    return {
      ok: false,
      error: "Couldn't read that file. Try a different resume or fill in manually.",
      status: 400,
    };
  }

  if (!text) {
    return {
      ok: false,
      error: "Couldn't find any text in that file. Try a different resume or fill in manually.",
      status: 400,
    };
  }

  const startedAt = Date.now();
  const [result, photoUrl] = await Promise.all([callBestProvider(text), extractHeadshot(file)]);
  const durationMs = Date.now() - startedAt;
  if (!result.ok) {
    return { ok: false, error: result.error, status: result.status };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.content);
  } catch {
    return { ok: false, error: "Couldn't read that resume. Try filling in manually.", status: 502 };
  }

  return {
    ok: true,
    profile: validateParsedProfile(parsed),
    usage: result.usage,
    provider: result.provider,
    durationMs,
    photoUrl,
  };
}

export function fileToDataUrl(file: File, buffer: Buffer): string {
  return `data:${file.type || "application/octet-stream"};base64,${buffer.toString("base64")}`;
}
