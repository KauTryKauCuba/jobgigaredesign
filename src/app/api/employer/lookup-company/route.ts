import { after, NextResponse } from "next/server";
import { logAiUsage } from "@/lib/ai-usage";
import { MALAYSIA_STATES } from "@/lib/malaysia";
import { getSession } from "@/lib/session";

const PERPLEXITY_ENDPOINT = "https://api.perplexity.ai/search";
const DEEPSEEK_ENDPOINT = "https://api.deepseek.com/chat/completions";
const MIMO_ENDPOINT = "https://api.xiaomimimo.com/v1/chat/completions";
const COMPANY_SIZES = ["1-10", "11-50", "51-200", "201-500", "500+"] as const;
const COMPANY_TYPES = ["Startup", "SME", "MNC", "GLC", "Government"] as const;
const CURRENT_YEAR = new Date().getFullYear();
const RETRY_ATTEMPTS = 3;
// Kept tight relative to typical response times (successful calls finish in
// 3-7s) so a hung attempt is abandoned and retried quickly rather than
// stacking up to 45s/60s of dead waiting across 3 attempts.
const REQUEST_TIMEOUT_MS = 10_000;
// Wider than REQUEST_TIMEOUT_MS — MiMo in particular has been observed
// legitimately taking ~12s to respond, which the tighter search timeout
// would abort mid-flight. Structuring calls previously had no timeout at
// all here, which meant a hung connection (no error, just silence) could
// stall the whole DeepSeek/MiMo race indefinitely, since Promise.any never
// settles a promise that never resolves or rejects.
const STRUCTURING_TIMEOUT_MS = 25_000;

const STRUCTURE_SYSTEM_PROMPT = `You structure live web search results about a company into a Malaysian job platform's company profile fields. Use ONLY what's stated in the search results given to you — you have no other way to verify anything. When sources disagree, prefer the company's own official website over third-party directories/registries, and prefer a specific descriptive statement over a generic registry "nature of business" classification code, which is often outdated, boilerplate, or inaccurate — this also applies to founding year: a company's own "established/founded in <year>" claim describes when the business itself started and takes priority over a registry's Sdn Bhd incorporation date, which often reflects a later formal registration of an already-operating business. Respond with ONLY a json object, no prose, matching exactly this shape:
{
  "description": string | null,
  "industry": string | null,
  "addressLine1": string | null,
  "city": string | null,
  "state": ${MALAYSIA_STATES.map((s) => `"${s}"`).join(" | ")} | null,
  "postcode": string | null,
  "companySize": ${COMPANY_SIZES.map((s) => `"${s}"`).join(" | ")} | null,
  "websiteUrl": string | null,
  "companyEmail": string | null,
  "companyPhone": string | null,
  "foundedYear": number | null,
  "companyType": ${COMPANY_TYPES.map((t) => `"${t}"`).join(" | ")} | null,
  "ssmNumber": string | null,
  "benefits": string[]
}
Use null for anything the search results don't clearly support — never invent specifics. If the search results are about a different company than the one named, or are too thin/irrelevant to say anything useful, return all nulls (empty array for benefits) rather than guessing. "description" is a 3-5 sentence company profile blurb (not a one-liner) covering what the company does, its industry/services, and any other notable stated facts (size, founding story, notable clients or projects, specialties) — written in your own words but strictly grounded in the search results, no invented specifics. "addressLine1" is the street-level part of the company's office/registered address exactly as published (building/unit number, street name — e.g. "12-3, Jalan SS 2/24"), only when an actual street address is stated somewhere (official site's Contact page, SSM filing, Google Maps listing, etc.) — null if only a city/area is mentioned with no street-level detail, never a P.O. box or a different branch's address if multiple locations are listed and it's unclear which is the main one. "city" is the city/town the company is based in (include the neighbourhood/area if that's what's actually stated, e.g. "Bangsar South" for an address that only names the area, not the wider city), or null if no city-level location is mentioned anywhere. "state" is the exact one of the 16 listed Malaysian states/federal territories the company is based in, inferred from the city if the state itself isn't stated (e.g. a Petaling Jaya address implies "Selangor"), or null if not Malaysia-based or the location can't be placed in any of them. "postcode" is the 5-digit Malaysian postcode from that same address, only if explicitly stated alongside it — null if not given, never guessed from the city. "companySize" should be your best estimate from the closest list option based on stated employee count, or null if not mentioned. "websiteUrl" is the company's own official website (not a directory/listing/social media page), or null if not clearly stated. "companyEmail" is the company's official contact/enquiry email address as explicitly published on their own website or official listing (e.g. found on a "Contact Us" page, next to the company's address/phone, or as a stated general enquiry channel) — extract it even if the address itself looks like a person's first name (e.g. "jane@company.com"), since many smaller companies list a named individual as their sole official contact point and that's still the right answer here; only reject an email that has nothing to do with contacting the company at all — e.g. one mentioned only in an unrelated context like a news article about a specific executive, or scraped from a page about a different person or company entirely. Never guess or construct one from the domain name; null if none is stated anywhere. "companyPhone" is the company's general contact phone number, published the same way and under the same rules as "companyEmail" above (e.g. from the same "Contact Us" page, often listed right next to the email) — keep whatever format it's stated in (don't reformat/normalize it), null if none is stated anywhere. "foundedYear" is the year the company was founded/established, a 4-digit year between 1800 and ${CURRENT_YEAR}, or null. "companyType" is your best classification from the list based on ownership/size/stated description (Startup = early-stage/small and newly founded, SME = small-medium established business, MNC = multinational, GLC = government-linked company, Government = a government body/agency itself), or null if unclear. "ssmNumber" is the company's Companies Commission of Malaysia (SSM) registration number — often shown as "Company No.: 881993-M" (older format) or a 12-digit number (newer format, e.g. "202301012345") in an annual report, official filing, or the company's own site footer; null if not stated anywhere. "benefits" is a list of concrete employee perks/benefits explicitly mentioned (e.g. on a careers page, job listing, or review site) — short phrases like "Medical insurance" or "Performance bonus", not full sentences; empty array if none are mentioned, never invented from what's "typical" for the industry. Review-site content (e.g. Glassdoor, Indeed) mixes genuine benefits with complaints ("cons") about pay, workload, or management — only list something as a benefit if it's a perk actually offered (stated as a "pro," in a "what benefits does X offer" answer, or on a benefits/perks-specific page), never a complaint about a benefit being absent, small, or capped (e.g. "no bonus," "medical with limit" is not a benefit — only list "Medical insurance" if it's otherwise confirmed as offered).`;

type PerplexityResult = {
  title?: string;
  url?: string;
  snippet?: string;
};

type PerplexityResponse = {
  results?: PerplexityResult[];
};

// Shared shape — DeepSeek and MiMo both expose an OpenAI-compatible
// chat-completions response, so one set of types covers whichever of the
// two wins the structuring race below.
type StructuringUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

type StructuringResponse = {
  choices?: { message?: { content?: string } }[];
  usage?: StructuringUsage;
  error?: { message?: string };
};

// snippet is deliberately not part of this — raw scraped page text (stock
// tables, nav boilerplate, etc.) is unreliable as reader-facing copy; the
// title + link alone is what's shown. r.snippet is still used internally
// during filtering (looksNonEnglish, the relevance check) before being
// dropped here.
type NewsItem = {
  title: string;
  url: string;
};

const MAX_NEWS_ITEMS = 2;

// Office photos required an image-search source (Tavily's include_images) —
// Perplexity's Search API doesn't return images at all (only their Sonar
// chat-completions models do, via return_images, which is a materially
// different/pricier API). Dropped rather than half-supported.
type LookupResult = {
  companyDescription: string | null;
  industry: string | null;
  addressLine1: string | null;
  city: string | null;
  state: (typeof MALAYSIA_STATES)[number] | null;
  postcode: string | null;
  companySize: (typeof COMPANY_SIZES)[number] | null;
  websiteUrl: string | null;
  companyEmail: string | null;
  companyPhone: string | null;
  companyLinkedin: string | null;
  companyFacebook: string | null;
  companyInstagram: string | null;
  foundedYear: number | null;
  companyType: (typeof COMPANY_TYPES)[number] | null;
  ssmNumber: string | null;
  benefits: string[];
  logoUrl: string | null;
  recentNews: NewsItem[];
};

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

/**
 * Maps a free-form employee-count string to the closest of our five actual
 * buckets. Despite the prompt spelling out the exact enum, the model
 * sometimes echoes a source's own range verbatim instead (e.g. LinkedIn's
 * "5,001-10,000 employees") — rather than silently discarding a value the
 * model clearly did try to extract, take the largest number mentioned and
 * bucket it ourselves.
 */
function normalizeCompanySize(value: string): (typeof COMPANY_SIZES)[number] | null {
  if ((COMPANY_SIZES as readonly string[]).includes(value)) {
    return value as (typeof COMPANY_SIZES)[number];
  }
  const numbers = value.replace(/,/g, "").match(/\d+/g);
  if (!numbers) return null;
  const largest = Math.max(...numbers.map(Number));
  if (largest <= 10) return "1-10";
  if (largest <= 50) return "11-50";
  if (largest <= 200) return "51-200";
  if (largest <= 500) return "201-500";
  return "500+";
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateStructured(
  raw: unknown,
): Omit<LookupResult, "logoUrl" | "recentNews" | "companyLinkedin" | "companyFacebook" | "companyInstagram"> {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const companySize = typeof obj.companySize === "string" ? normalizeCompanySize(obj.companySize) : null;
  const companyType =
    typeof obj.companyType === "string" &&
    (COMPANY_TYPES as readonly string[]).includes(obj.companyType)
      ? (obj.companyType as (typeof COMPANY_TYPES)[number])
      : null;
  const foundedYear =
    typeof obj.foundedYear === "number" &&
    Number.isInteger(obj.foundedYear) &&
    obj.foundedYear >= 1800 &&
    obj.foundedYear <= CURRENT_YEAR
      ? obj.foundedYear
      : null;
  // The model can hallucinate a plausible-looking but non-email string (or
  // guess one from the domain despite being told not to) — a format check
  // is a cheap backstop against ever surfacing garbage in this field.
  const companyEmail = nullableString(obj.companyEmail);
  const state =
    typeof obj.state === "string" && (MALAYSIA_STATES as readonly string[]).includes(obj.state)
      ? (obj.state as (typeof MALAYSIA_STATES)[number])
      : null;
  const postcode = typeof obj.postcode === "string" && /^\d{5}$/.test(obj.postcode.trim()) ? obj.postcode.trim() : null;
  return {
    companyDescription: nullableString(obj.description),
    industry: nullableString(obj.industry),
    addressLine1: nullableString(obj.addressLine1),
    city: nullableString(obj.city),
    state,
    postcode,
    companySize,
    websiteUrl: nullableString(obj.websiteUrl),
    companyEmail: companyEmail && EMAIL_PATTERN.test(companyEmail) ? companyEmail.toLowerCase() : null,
    companyPhone: nullableString(obj.companyPhone),
    foundedYear,
    companyType,
    ssmNumber: nullableString(obj.ssmNumber),
    benefits: Array.isArray(obj.benefits)
      ? obj.benefits.filter((b): b is string => typeof b === "string" && b.trim().length > 0).map((b) => b.trim())
      : [],
  };
}

function extractDomain(websiteUrl: string): string | null {
  try {
    const url = new URL(websiteUrl.startsWith("http") ? websiteUrl : `https://${websiteUrl}`);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

async function downloadAsDataUrl(imageUrl: string, maxBytes: number): Promise<string | null> {
  try {
    const upstream = await fetch(imageUrl, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!upstream.ok) return null;
    const contentType = upstream.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) return null;

    const buffer = Buffer.from(await upstream.arrayBuffer());
    if (buffer.length === 0 || buffer.length > maxBytes) return null;
    return `data:${contentType};base64,${buffer.toString("base64")}`;
  } catch (err) {
    console.error(`Image download failed for ${imageUrl}:`, err);
    return null;
  }
}

/**
 * Derives the logo directly from the resolved website's domain via
 * Logo.dev's logo API — no LLM guessing involved, so this either returns
 * the company's real logo or nothing at all. fallback=404 disables their
 * default generic-monogram fallback so a missing logo doesn't get stored
 * as if it were the real one.
 */
async function fetchLogo(websiteUrl: string | null, logoDevKey: string | null): Promise<string | null> {
  const domain = websiteUrl ? extractDomain(websiteUrl) : null;
  if (!domain || !logoDevKey) return null;
  return downloadAsDataUrl(
    `https://img.logo.dev/${domain}?token=${logoDevKey}&size=256&format=png&fallback=404`,
    2 * 1024 * 1024,
  );
}

// Deterministic, not LLM-extracted — confirmed Perplexity's own result URLs
// are a more reliable source for this than asking a model to read and
// reproduce a link from prose (real risk of a garbled or invented URL).
// LinkedIn's own company pages rank well as search results in their own
// right, so this just pattern-matches the URLs already being fetched for
// other purposes rather than issuing a dedicated search for it. /company/
// (not /in/) excludes personal profile pages like a director's own LinkedIn.
function findLinkedInUrl(...resultSets: (PerplexityResponse | null)[]): string | null {
  for (const data of resultSets) {
    for (const r of data?.results ?? []) {
      if (r.url && /linkedin\.com\/company\//i.test(r.url)) return r.url;
    }
  }
  return null;
}

async function searchPerplexity(
  apiKey: string,
  query: string,
  options: {
    maxResults: number;
    recencyFilter?: "month" | "year";
    domainFilter?: string[];
    languageFilter?: string[];
  },
): Promise<{ ok: true; data: PerplexityResponse } | { ok: false; error: string; status: number }> {
  let lastError: unknown;
  let failedStatus: number | null = null;

  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    try {
      const upstream = await fetch(PERPLEXITY_ENDPOINT, {
        method: "POST",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          query,
          max_results: options.maxResults,
          // "high" pulls full-page extraction rather than a thin snippet —
          // the Tavily equivalent ("advanced" depth) was what made the
          // company's own site reliably outrank directory/aggregator pages;
          // same reasoning applies here until proven otherwise against
          // real queries.
          search_context_size: "high",
          country: "MY",
          ...(options.recencyFilter ? { search_recency_filter: options.recencyFilter } : {}),
          ...(options.domainFilter ? { search_domain_filter: options.domainFilter } : {}),
          ...(options.languageFilter ? { search_language_filter: options.languageFilter } : {}),
        }),
      });
      if (!upstream.ok) {
        failedStatus = upstream.status;
        continue;
      }
      const data = (await upstream.json().catch(() => ({}))) as PerplexityResponse;
      return { ok: true, data };
    } catch (err) {
      lastError = err;
      console.error(`Perplexity search failed (attempt ${attempt}/${RETRY_ATTEMPTS}):`, err);
    }
  }

  if (failedStatus) return { ok: false, error: "Company search failed.", status: failedStatus };
  console.error("Perplexity search failed after all retries:", lastError);
  return { ok: false, error: "Couldn't reach the search service. Try again.", status: 502 };
}

// The same story is frequently syndicated across multiple URLs (e.g. a
// wire/press-release item reposted under a section-specific and a
// sponsored-content path on the same news site) — normalizing whitespace/case
// on the title is enough to catch that without needing real dedup tooling.
function normalizeNewsTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

// Unlike the news search, this deliberately does NOT restrict to the
// company's own domain — companies almost never publish a detailed benefits
// list on their own site, but Glassdoor/Indeed/Payscale-style pages
// routinely do (confirmed empirically: the main company-profile search
// essentially never surfaces benefits, this query reliably does).
async function searchBenefits(
  apiKey: string,
  companyName: string,
): Promise<{ ok: true; data: PerplexityResponse } | { ok: false; data: null }> {
  const result = await searchPerplexity(apiKey, `"${companyName}" employee benefits perks Malaysia`, {
    maxResults: 5,
  });
  if (!result.ok) return { ok: false, data: null };
  return { ok: true, data: result.data };
}

// Same gap as benefits above, confirmed the same way: the main
// company-profile query almost never surfaces a "Contact Us" page (it's
// optimized for profile/registry/directory results, not contact pages), so
// a company's actual public contact email routinely goes undiscovered
// without asking for it directly. Empirically verified against AP Digital
// Media — 0 emails in the 10 main-query results, a real one
// (jane@apmedia.com.my, from their own /contact page) on the first result
// of this dedicated query.
async function searchCompanyContact(
  apiKey: string,
  companyName: string,
): Promise<{ ok: true; data: PerplexityResponse } | { ok: false; data: null }> {
  const result = await searchPerplexity(apiKey, `"${companyName}" contact email office address city Malaysia`, {
    maxResults: 5,
  });
  if (!result.ok) return { ok: false, data: null };
  return { ok: true, data: result.data };
}

// Legal suffixes ("Sdn Bhd", "Group", "Holdings"...) are almost never
// repeated verbatim in actual news coverage — confirmed losing genuine,
// on-domain news this way: EPOMS Group Sdn Bhd's own site ran a real MoU
// signing article titled just "...- EPOMS", which a literal full-name match
// rejected outright. Stripped iteratively (trailing) since some companies
// stack more than one, e.g. "... Holdings Sdn Bhd".
const CORPORATE_SUFFIXES = [
  "sdn bhd",
  "berhad",
  "bhd",
  "holdings",
  "group",
  "plc",
  "incorporated",
  "inc",
  "ltd",
  "limited",
  "corporation",
  "corp",
  "llc",
];

function coreCompanyName(companyName: string): string {
  let core = companyName.trim().toLowerCase().replace(/[.,]/g, "");
  let changed = true;
  while (changed) {
    changed = false;
    for (const suffix of CORPORATE_SUFFIXES) {
      if (core === suffix) {
        core = "";
        changed = true;
      } else if (core.endsWith(` ${suffix}`)) {
        core = core.slice(0, -(suffix.length + 1)).trim();
        changed = true;
      }
    }
  }
  return core;
}

// Non-Latin scripts (Chinese/Japanese/Korean) are an unambiguous signal on
// their own. Malay shares the Latin alphabet with English though, so
// Perplexity's own search_language_filter doesn't reliably exclude it
// (confirmed empirically: it still let through Malay-language newswav.com
// articles even with language_filter: ["en"] set) — these common
// Malay-only function/news words catch what the API-level filter misses.
// Two-word threshold avoids a false positive on a single incidental match
// (e.g. an English article naming a Malay-titled ministry).
const MALAY_MARKER_WORDS = new Set([
  "yang", "dan", "akan", "adalah", "dengan", "untuk", "daripada", "sebagai",
  "bagi", "telah", "bakal", "meterai", "perjanjian", "bersama", "kerajaan",
  "syarikat", "menteri", "kementerian", "pengarah", "pengurus", "pasar",
]);

function looksNonEnglish(text: string): boolean {
  if (/[一-鿿぀-ヿ가-힯]/.test(text)) return true;
  const words = text.toLowerCase().split(/[^a-z]+/);
  let hits = 0;
  for (const w of words) {
    if (MALAY_MARKER_WORDS.has(w)) hits++;
    if (hits >= 2) return true;
  }
  return false;
}

// Company name (or its core brand name with legal suffixes stripped) must
// appear in the title/snippet — this runs on both the domain-scoped and the
// open-web fallback pass below, not just the fallback: even a domain-scoped
// result isn't automatically trustworthy on its own (confirmed — EPOMS
// Group's own site ran real news that only the core-name match caught, see
// coreCompanyName above), and the fallback additionally needs it as the
// guard against a wrong, similarly-named company's news once the domain
// restriction is gone. Cheap (no second LLM call needed) and sufficient
// given the query itself already quote-wraps the exact name. The core-name
// fallback only kicks in past a short length floor so it can't degrade into
// a single generic word matching almost anything.
function collectNewsItems(results: PerplexityResult[] | undefined, companyName: string, limit: number): NewsItem[] {
  const normalizedName = companyName.trim().toLowerCase();
  const core = coreCompanyName(companyName);
  const seenTitles = new Set<string>();
  const items: NewsItem[] = [];
  for (const r of results ?? []) {
    if (!r.title || !r.url || !r.snippet) continue;
    const key = normalizeNewsTitle(r.title);
    if (seenTitles.has(key)) continue;
    if (looksNonEnglish(`${r.title} ${r.snippet}`)) continue;
    const haystack = `${r.title} ${r.snippet}`.toLowerCase();
    const matches = haystack.includes(normalizedName) || (core.length >= 4 && haystack.includes(core));
    if (!matches) continue;
    seenTitles.add(key);
    items.push({ title: r.title.trim(), url: r.url.trim() });
    if (items.length === limit) break;
  }
  return items;
}

// Rejects individual post/reel permalinks, keeping only what looks like the
// profile/page root itself — a post about the company from someone else's
// account is not the company's own page. (facebook.com/<numeric-id> is kept:
// confirmed many real business Pages are only reachable by numeric ID, not
// just a vanity slug, e.g. Mydin Mohamed Holdings' own Facebook Page.)
function isSocialProfileUrl(url: string, platform: "facebook" | "instagram"): boolean {
  try {
    const path = new URL(url).pathname.toLowerCase();
    if (platform === "instagram") return !/^\/(p|reel|reels|stories|explore)\//.test(path);
    return !/\/(posts|photos|videos|photo\.php)\//.test(path);
  } catch {
    return false;
  }
}

// Deterministic, not LLM-extracted — same reasoning as the LinkedIn case
// below: Perplexity's own result URLs are a more reliable source than
// asking a model to read and reproduce a link from prose. Domain-restricted
// search is what makes this findable at all — confirmed the open, unscoped
// company-profile search essentially never surfaces Facebook/Instagram
// (they rank far below directories/registries for a generic query), but
// scoping the search directly to facebook.com/instagram.com finds real
// profiles reliably, including for companies (AP Digital Media) that looked
// to have no social presence at all under the unscoped query.
function findSocialProfileUrl(
  data: PerplexityResponse | null,
  companyName: string,
  platform: "facebook" | "instagram",
): string | null {
  const domain = platform === "facebook" ? "facebook.com" : "instagram.com";
  const normalizedName = companyName.trim().toLowerCase();
  const core = coreCompanyName(companyName);
  for (const r of data?.results ?? []) {
    if (!r.url || !r.url.includes(domain)) continue;
    if (!isSocialProfileUrl(r.url, platform)) continue;
    const haystack = `${r.title ?? ""} ${r.snippet ?? ""}`.toLowerCase();
    if (haystack.includes(normalizedName) || (core.length >= 4 && haystack.includes(core))) {
      return r.url;
    }
  }
  return null;
}

async function searchSocialMedia(
  apiKey: string,
  companyName: string,
): Promise<{ ok: true; data: PerplexityResponse } | { ok: false; data: null }> {
  const result = await searchPerplexity(apiKey, `"${companyName}" Malaysia`, {
    maxResults: 8,
    domainFilter: ["facebook.com", "instagram.com"],
  });
  if (!result.ok) return { ok: false, data: null };
  return { ok: true, data: result.data };
}

// Tries the company's own resolved website first — the one source
// unambiguously about them, no risk of attaching a different, similarly-
// named company's news. But plenty of Malaysian companies (confirmed
// empirically) don't self-host a newsroom at all: mid-caps commonly publish
// filings via a third-party IR platform like listedcompany.com — a
// different domain than their main site — and smaller companies often only
// ever post updates on LinkedIn. Only when the domain-scoped search comes
// back empty does this fall back to the open web, guarded by the name-match
// filter in collectNewsItems above.
async function searchNews(
  apiKey: string,
  companyName: string,
  domain: string | null,
): Promise<{ items: NewsItem[]; calls: number }> {
  let items: NewsItem[] = [];
  let calls = 0;

  if (domain) {
    // Capped at MAX_NEWS_ITEMS, not over-fetched — a syndicated duplicate can
    // still fill a slot if it lands in these 2 results, but this dedupes
    // whatever comes back rather than requesting more than asked for. A
    // rejection here (non-English, no name match) shrinks this pass's yield
    // rather than triggering the fallback below to top it back up to
    // MAX_NEWS_ITEMS — the fallback only fires when this pass is entirely
    // empty, not merely under quota.
    const domainResult = await searchPerplexity(apiKey, `"${companyName}" news announcement`, {
      maxResults: MAX_NEWS_ITEMS,
      recencyFilter: "year",
      domainFilter: [domain],
      languageFilter: ["en"],
    });
    calls++;
    if (domainResult.ok) {
      items = collectNewsItems(domainResult.data.results, companyName, MAX_NEWS_ITEMS);
    }
  }

  if (items.length === 0) {
    // Open-web fallback — over-fetched since the name-match filter discards
    // some of these (no domain guarantee here, unlike the pass above).
    const openResult = await searchPerplexity(apiKey, `"${companyName}" news announcement`, {
      maxResults: MAX_NEWS_ITEMS * 4,
      recencyFilter: "year",
      languageFilter: ["en"],
    });
    calls++;
    if (openResult.ok) {
      items = collectNewsItems(openResult.data.results, companyName, MAX_NEWS_ITEMS);
    }
  }

  return { items, calls };
}

function formatSnippets(results: PerplexityResult[] | undefined, maxChars: number): string {
  return (results ?? [])
    .map((r, i) => `[${i + 1}] ${r.title ?? "Untitled"} (${r.url ?? "no url"})\n${r.snippet ?? ""}`)
    .join("\n\n")
    .slice(0, maxChars);
}

type StructuringSuccess = { ok: true; content: string; usage: StructuringUsage | null; provider: string; model: string };
type StructuringFailure = { ok: false; error: string; status: number };

// Thrown (not returned) on failure so Promise.any in raceStructuring below
// can tell a failed provider apart from a successful one — Promise.any only
// skips rejections, it has no concept of "resolved but unusable."
class StructuringError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// DeepSeek and MiMo are called through this same function — same
// OpenAI-compatible request/response shape, same retry pattern, differing
// only in endpoint/model/key. Each independently retries 3x internally
// before giving up; that's separate from (and not a replacement for) the
// race between the two providers in raceStructuring.
async function callStructuringProvider(
  endpoint: string,
  model: string,
  apiKey: string,
  userContent: string,
  providerLabel: string,
): Promise<{ ok: true; content: string; usage: StructuringUsage | null } | StructuringFailure> {
  let lastError: unknown;
  let failedStatus: number | null = null;
  let failedMessage: string | null = null;

  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    try {
      const upstream = await fetch(endpoint, {
        method: "POST",
        cache: "no-store",
        signal: AbortSignal.timeout(STRUCTURING_TIMEOUT_MS),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          response_format: { type: "json_object" },
          temperature: 0,
          max_tokens: 500,
          messages: [
            { role: "system", content: STRUCTURE_SYSTEM_PROMPT },
            { role: "user", content: userContent },
          ],
        }),
      });

      const data: StructuringResponse = await upstream.json().catch(() => ({}));
      if (!upstream.ok) {
        failedStatus = upstream.status;
        failedMessage = data.error?.message ?? "Company structuring failed.";
        console.error(`${providerLabel} structuring failed (attempt ${attempt}/${RETRY_ATTEMPTS}): ${upstream.status}`);
        continue;
      }
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        // A response with no content must lose the race, not win it with an
        // empty result — treating it as ok:true let a hollow response beat
        // the other provider's real, populated answer in Promise.any purely
        // by finishing first. Failing here lets the other provider's result
        // win instead, and (if both are empty) surfaces as ok:false so the
        // outer whole-cycle retry in the route handler kicks in.
        return { ok: false, error: "Company structuring failed.", status: 502 };
      }
      return { ok: true, content, usage: data.usage ?? null };
    } catch (err) {
      lastError = err;
      console.error(`${providerLabel} structuring failed (attempt ${attempt}/${RETRY_ATTEMPTS}):`, err);
    }
  }

  if (failedStatus) return { ok: false, error: failedMessage ?? "Company structuring failed.", status: failedStatus };
  console.error(`${providerLabel} structuring failed after all retries:`, lastError);
  return { ok: false, error: "Couldn't reach the structuring service. Try again.", status: 502 };
}

/**
 * Runs DeepSeek and MiMo at the same time (not one after the other's
 * exhausted retries) and takes whichever succeeds first — each has shown
 * the same kind of intermittent connection flakiness independently, so
 * racing them covers for one being down without waiting through a full
 * sequential failover first. If only one key is configured, that one runs
 * alone. If both fail, the error is whichever provider's — arbitrary, since
 * at that point neither is reachable.
 */
async function raceStructuring(
  companyName: string,
  searchData: PerplexityResponse,
  benefitsData: PerplexityResponse | null,
  contactData: PerplexityResponse | null,
  deepseekKey: string | null,
  mimoKey: string | null,
  // Every attempt this call makes gets pushed here (mutated, not returned)
  // so the caller can log every provider's real usage afterward — not just
  // whichever one wins Promise.any below — across every retry of the outer
  // lookup loop, not just the final one.
  collectedAttempts: Promise<StructuringSuccess>[],
): Promise<StructuringSuccess | StructuringFailure> {
  // 9000 was tuned for Tavily's shorter default snippets and was silently
  // truncating later, often-longer Perplexity results (search_context_size:
  // "high" pulls full-page extraction) — confirmed losing an SME's SSM
  // registration number this way when it only appeared in result #7's PDF
  // annual-report snippet, past the old cutoff. 10 results at this depth
  // commonly run ~16000 chars combined; sized with headroom above that.
  const snippets = formatSnippets(searchData.results, 20_000);
  // Kept separate (not merged into the count above) since it's a handful of
  // short review/listing snippets, not another full-page-extraction batch.
  const benefitsSnippets = formatSnippets(benefitsData?.results, 6_000);
  const contactSnippets = formatSnippets(contactData?.results, 6_000);

  if (!snippets && !benefitsSnippets && !contactSnippets) {
    return { ok: true, content: "{}", usage: null, provider: "none", model: "none" };
  }

  const userContent = `Company name: ${companyName}\n\nWeb search results (company profile):\n${snippets || "(none)"}${
    benefitsSnippets
      ? `\n\nWeb search results (employee benefits — from job listings/review sites, use ONLY for the "benefits" field):\n${benefitsSnippets}`
      : ""
  }${
    contactSnippets
      ? `\n\nWeb search results (company contact info — use ONLY for the "companyEmail", "companyPhone", "city", and "state" fields):\n${contactSnippets}`
      : ""
  }`;

  const attempts: Promise<StructuringSuccess>[] = [];
  if (deepseekKey) {
    attempts.push(
      callStructuringProvider(DEEPSEEK_ENDPOINT, "deepseek-chat", deepseekKey, userContent, "DeepSeek").then((r) => {
        if (!r.ok) throw new StructuringError(r.error, r.status);
        return { ...r, provider: "deepseek", model: "deepseek-chat" };
      }),
    );
  }
  if (mimoKey) {
    attempts.push(
      callStructuringProvider(MIMO_ENDPOINT, "mimo-v2.5", mimoKey, userContent, "MiMo").then((r) => {
        if (!r.ok) throw new StructuringError(r.error, r.status);
        return { ...r, provider: "mimo", model: "mimo-v2.5" };
      }),
    );
  }

  if (attempts.length === 0) {
    return { ok: false, error: "Company lookup is not configured.", status: 500 };
  }
  collectedAttempts.push(...attempts);

  try {
    return await Promise.any(attempts);
  } catch (err) {
    const first = err instanceof AggregateError ? (err.errors[0] as StructuringError | undefined) : undefined;
    return {
      ok: false,
      error: first?.message ?? "Couldn't reach the structuring service. Try again.",
      status: first?.status ?? 502,
    };
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "employer") {
    return NextResponse.json({ error: "Not signed in as an employer." }, { status: 401 });
  }

  const perplexityKey = process.env.PERPLEXITY_API_KEY;
  const deepseekKey = process.env.DEEPSEEK_API_KEY ?? null;
  const mimoKey = process.env.MIMO_API_KEY ?? null;
  const logoDevKey = process.env.LOGO_DEV_API_KEY ?? null;
  if (!perplexityKey || (!deepseekKey && !mimoKey)) {
    return NextResponse.json({ error: "Company lookup is not configured." }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { companyName } = (body ?? {}) as Record<string, unknown>;
  if (typeof companyName !== "string" || !companyName.trim()) {
    return NextResponse.json({ error: "Enter a company name first." }, { status: 400 });
  }
  const trimmedName = companyName.trim();

  const startedAt = Date.now();
  // Counts every Perplexity Search call this request makes (main query,
  // benefits, contact, social, news, across retries) — Perplexity has no
  // token usage to log, so this call count is its volume metric instead.
  let perplexityCalls = 0;

  // Independent of the main search/retry cycle below — doesn't need the
  // resolved website, so it can run alongside the first attempt instead of
  // waiting on it.
  const benefitsPromise = searchBenefits(perplexityKey, trimmedName);
  perplexityCalls++;
  const contactPromise = searchCompanyContact(perplexityKey, trimmedName);
  perplexityCalls++;
  // Deterministic (not fed into structuring), so unlike the two above this
  // doesn't need to be re-fetched per retry attempt below — fired once,
  // awaited once, right before the final result is assembled.
  const socialPromise = searchSocialMedia(perplexityKey, trimmedName);
  perplexityCalls++;

  // The underlying search occasionally comes back too thin for the model to
  // extract anything from — a "successful" call (no error, no timeout) that
  // still yields every field null. That's indistinguishable from a genuinely
  // unlisted company from the response alone, so instead of surfacing an
  // empty result and making the employer notice and re-click "Fill with AI"
  // themselves, silently retry the whole search+structure cycle once here.
  const MAX_LOOKUP_ATTEMPTS = 2;
  let search: Awaited<ReturnType<typeof searchPerplexity>> | null = null;
  let sources: string[] = [];
  let structuredResult: ReturnType<typeof validateStructured> | null = null;
  let usage: StructuringUsage | null = null;
  let usedProvider: string | null = null;
  let contactData: PerplexityResponse | null = null;
  const structuringAttempts: Promise<StructuringSuccess>[] = [];

  for (let attempt = 1; attempt <= MAX_LOOKUP_ATTEMPTS; attempt++) {
    // Awaited here (not before the loop) so it actually overlaps with the
    // main search below instead of blocking ahead of it — awaiting an
    // already-settled promise resolves immediately, so this costs nothing
    // once benefitsPromise has finished.
    const [search_, benefitsResult, contactResult] = await Promise.all([
      searchPerplexity(perplexityKey, `"${trimmedName}" company profile, industry, office address, and city in Malaysia`, {
        maxResults: 10,
      }),
      benefitsPromise,
      contactPromise,
    ]);
    perplexityCalls++;
    search = search_;
    contactData = contactResult.data;
    if (!search.ok) {
      if (attempt < MAX_LOOKUP_ATTEMPTS) continue;
      return NextResponse.json({ error: search.error }, { status: search.status });
    }

    const structured = await raceStructuring(
      trimmedName,
      search.data,
      benefitsResult.data,
      contactResult.data,
      deepseekKey,
      mimoKey,
      structuringAttempts,
    );
    if (!structured.ok) {
      if (attempt < MAX_LOOKUP_ATTEMPTS) continue;
      return NextResponse.json({ error: structured.error }, { status: structured.status });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(structured.content);
    } catch {
      parsed = {};
    }

    sources = [
      ...(search.data.results ?? []),
      ...(benefitsResult.data?.results ?? []),
      ...(contactResult.data?.results ?? []),
    ]
      .map((r) => r.url)
      .filter((u): u is string => Boolean(u));
    structuredResult = validateStructured(parsed);
    usage = structured.usage;
    usedProvider = structured.provider;

    const isEmpty = Object.entries(structuredResult).every(
      ([key, v]) => (key === "benefits" ? (v as string[]).length === 0 : v === null),
    );
    if (!isEmpty || attempt === MAX_LOOKUP_ATTEMPTS) break;
  }

  // Every branch above either returns early or assigns these before falling
  // through, but TypeScript can't see that across the loop — narrow here.
  if (!search || !search.ok || !structuredResult) {
    return NextResponse.json({ error: "Couldn't find anything for that company." }, { status: 502 });
  }

  // News search needs the resolved websiteUrl (to scope it to the company's
  // own domain), so it can only start once structuring is done — no longer
  // parallel with the main search the way it was before.
  const domain = structuredResult.websiteUrl ? extractDomain(structuredResult.websiteUrl) : null;
  const [logoUrl, newsResult, socialResult] = await Promise.all([
    fetchLogo(structuredResult.websiteUrl, logoDevKey),
    searchNews(perplexityKey, trimmedName, domain),
    socialPromise,
  ]);
  const recentNews = newsResult.items;
  perplexityCalls += newsResult.calls;
  const companyLinkedin = findLinkedInUrl(search.data, contactData);
  const companyFacebook = findSocialProfileUrl(socialResult.data, trimmedName, "facebook");
  const companyInstagram = findSocialProfileUrl(socialResult.data, trimmedName, "instagram");

  const result: LookupResult = {
    ...structuredResult,
    logoUrl,
    companyLinkedin,
    companyFacebook,
    companyInstagram,
    recentNews,
  };

  sources = [...sources, ...(socialResult.data?.results ?? []).map((r) => r.url).filter((u): u is string => Boolean(u))];

  const durationMs = Date.now() - startedAt;
  await logAiUsage({
    userId: session.userId,
    feature: "company_lookup",
    provider: "perplexity",
    usage: null,
    durationMs,
    callCount: perplexityCalls,
  });

  // Both structuring providers were actually called on every retry (racing
  // for speed) — logging only the winner (`usedProvider`) would silently
  // undercount the loser's real usage/cost, so every attempt that completed
  // gets its own row. Fired after the response is sent so the slower
  // provider's log doesn't add to the employer's wait.
  after(async () => {
    const settled = await Promise.allSettled(structuringAttempts);
    await Promise.all(
      settled
        .filter((r): r is PromiseFulfilledResult<StructuringSuccess> => r.status === "fulfilled")
        .map((r) =>
          logAiUsage({
            userId: session.userId,
            feature: "company_lookup",
            provider: r.value.provider,
            model: r.value.model,
            usage: r.value.usage,
            durationMs: Date.now() - startedAt,
          }),
        ),
    );
  });

  return NextResponse.json({ result, sources, usage, provider: usedProvider, durationMs });
}
