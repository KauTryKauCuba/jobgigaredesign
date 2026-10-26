// JobGiga's language taxonomy. Each language has one standard name plus the
// other names people use for it ("BM", "Malay", "Bahasa Melayu" are all
// Malay), and — where the dialect really matters for hiring in Malaysia, e.g.
// telemarketing to Kelantan or the Cantonese-speaking market — its dialects.
// Pure (no server-only imports) so the pickers and the server share it.
//
// The model:
// - A job requirement is a language plus ONE dialect or none ("any dialect"):
//   { language: "Malay", dialect: null } or { language: "Chinese", dialect: "Cantonese" }.
// - A jobseeker's language is a language plus the dialects they also speak:
//   { language: "Chinese", dialects: ["Mandarin", "Hokkien"] }.
// - "Any dialect" is met by anyone who speaks the language; a specific dialect
//   only by someone who listed it (see meetsLanguage).
//
// A language not listed here can still be entered through the pickers'
// "Other" option — it's kept as typed, and matched by name.

export const LANGUAGE_GROUPS = [
  "Most common in Malaysia",
  "Indian languages",
  "Sabah, Sarawak & Orang Asli",
  "Southeast Asia",
  "International",
  "Sign language",
] as const;
export type LanguageGroup = (typeof LANGUAGE_GROUPS)[number];

type Dialect = { name: string; aliases?: string[] };
export type LanguageDefinition = { name: string; aliases: string[]; group: LanguageGroup; dialects?: Dialect[] };

export const LANGUAGES: readonly LanguageDefinition[] = [
  { group: "Most common in Malaysia", name: "English", aliases: ["eng", "english language", "bahasa inggeris", "bi"] },
  {
    group: "Most common in Malaysia",
    name: "Malay",
    aliases: ["bahasa malaysia", "bm", "bahasa melayu", "melayu", "bahasa", "malaysian", "bahasa malaysia (bm)", "standard malay"],
    dialects: [
      { name: "Kelantanese", aliases: ["kelantanese malay", "kecek kelate", "loghat kelantan", "kelate"] },
      { name: "Terengganu", aliases: ["terengganu malay", "terengganuan", "cakak tranung", "loghat terengganu", "ganu"] },
      {
        name: "Kedah / Northern",
        aliases: ["kedah malay", "kedah malay (northern)", "kedahan", "loghat utara", "northern malay", "utara", "pelat utara"],
      },
      { name: "Negeri Sembilan", aliases: ["negeri sembilan malay", "nogori", "baso nogori", "loghat negeri sembilan"] },
      { name: "Sarawak", aliases: ["sarawak malay", "bahasa sarawak", "sarawakian malay"] },
      { name: "Sabah", aliases: ["sabah malay", "bahasa sabah", "sabahan malay"] },
    ],
  },
  {
    group: "Most common in Malaysia",
    name: "Chinese",
    aliases: ["中文", "华语", "chinese language"],
    dialects: [
      { name: "Mandarin", aliases: ["mandarin chinese", "putonghua", "huayu", "普通话"] },
      { name: "Cantonese", aliases: ["guangdonghua", "yue", "广东话", "粤语"] },
      { name: "Hokkien", aliases: ["min nan", "minnan", "fujian", "福建话"] },
      { name: "Hakka", aliases: ["kejia", "客家话"] },
      { name: "Teochew", aliases: ["teochiu", "chaozhou", "潮州话"] },
      { name: "Hainanese", aliases: ["hainan", "海南话"] },
      { name: "Foochow", aliases: ["fuzhou", "福州话"] },
      { name: "Henghua", aliases: ["hinghwa", "putian", "puxian", "兴化话", "莆仙话"] },
      { name: "Kwongsai", aliases: ["guangxi", "广西话"] },
      { name: "Hokchia", aliases: ["fuqing", "福清话"] },
    ],
  },
  {
    group: "Most common in Malaysia",
    name: "Tamil",
    aliases: ["tamizh", "தமிழ்"],
    dialects: [
      { name: "Malaysian", aliases: ["malaysian tamil"] },
      { name: "Sri Lankan", aliases: ["sri lankan tamil", "jaffna tamil"] },
    ],
  },

  { group: "Indian languages", name: "Telugu", aliases: [] },
  { group: "Indian languages", name: "Malayalam", aliases: [] },
  { group: "Indian languages", name: "Punjabi", aliases: ["panjabi"] },
  { group: "Indian languages", name: "Hindi", aliases: [] },
  { group: "Indian languages", name: "Urdu", aliases: [] },
  { group: "Indian languages", name: "Bengali", aliases: ["bangla"] },
  { group: "Indian languages", name: "Gujarati", aliases: [] },
  { group: "Indian languages", name: "Sinhala", aliases: ["sinhalese"] },

  {
    group: "Sabah, Sarawak & Orang Asli",
    name: "Iban",
    aliases: ["sea dayak"],
    dialects: [{ name: "Saribas" }, { name: "Balau" }, { name: "Ulu Ai / Baleh", aliases: ["ulu ai", "baleh"] }],
  },
  {
    group: "Sabah, Sarawak & Orang Asli",
    name: "Kadazan-Dusun",
    aliases: ["kadazan", "dusun", "kadazandusun"],
    dialects: [
      { name: "Kadazan (Penampang / Papar)", aliases: ["kadazan penampang", "penampang kadazan"] },
      { name: "Dusun Tindal (Kota Belud)", aliases: ["dusun tindal", "tindal"] },
      { name: "Dusun Ranau", aliases: ["ranau dusun"] },
      { name: "Dusun Tambunan", aliases: ["tambunan dusun"] },
    ],
  },
  {
    group: "Sabah, Sarawak & Orang Asli",
    name: "Bidayuh",
    aliases: ["land dayak"],
    dialects: [
      { name: "Bukar-Sadong (Serian)", aliases: ["bukar-sadong", "bukar sadong"] },
      { name: "Biatah (Siburan)", aliases: ["biatah"] },
      { name: "Jagoi (Bau)", aliases: ["jagoi"] },
    ],
  },
  { group: "Sabah, Sarawak & Orang Asli", name: "Bajau", aliases: ["sama", "sama-bajau"] },
  { group: "Sabah, Sarawak & Orang Asli", name: "Murut", aliases: [] },
  { group: "Sabah, Sarawak & Orang Asli", name: "Melanau", aliases: [] },
  { group: "Sabah, Sarawak & Orang Asli", name: "Kayan", aliases: ["orang ulu"] },
  { group: "Sabah, Sarawak & Orang Asli", name: "Kenyah", aliases: ["orang ulu"] },
  { group: "Sabah, Sarawak & Orang Asli", name: "Semai", aliases: ["orang asli"] },
  { group: "Sabah, Sarawak & Orang Asli", name: "Temiar", aliases: ["orang asli"] },

  { group: "Southeast Asia", name: "Bahasa Indonesia", aliases: ["indonesian", "indonesia"] },
  { group: "Southeast Asia", name: "Javanese", aliases: ["jawa", "bahasa jawa"] },
  { group: "Southeast Asia", name: "Thai", aliases: [] },
  { group: "Southeast Asia", name: "Vietnamese", aliases: [] },
  { group: "Southeast Asia", name: "Filipino", aliases: ["tagalog", "pilipino"] },
  { group: "Southeast Asia", name: "Burmese", aliases: ["myanmar"] },
  { group: "Southeast Asia", name: "Khmer", aliases: ["cambodian"] },
  { group: "Southeast Asia", name: "Lao", aliases: ["laotian"] },

  { group: "International", name: "Nepali", aliases: ["nepalese"] },
  { group: "International", name: "Japanese", aliases: ["nihongo", "日本語"] },
  { group: "International", name: "Korean", aliases: ["hangul", "한국어"] },
  {
    group: "International",
    name: "Arabic",
    aliases: [],
    dialects: [
      { name: "Modern Standard (Fusha)", aliases: ["msa", "fusha", "modern standard arabic", "classical arabic"] },
      { name: "Gulf", aliases: ["gulf arabic", "khaleeji"] },
      { name: "Egyptian", aliases: ["egyptian arabic", "masri"] },
      { name: "Levantine", aliases: ["levantine arabic", "shami"] },
    ],
  },
  { group: "International", name: "French", aliases: ["francais", "français"] },
  { group: "International", name: "German", aliases: ["deutsch"] },
  { group: "International", name: "Spanish", aliases: ["espanol", "español"] },
  { group: "International", name: "Portuguese", aliases: [] },
  { group: "International", name: "Italian", aliases: [] },
  { group: "International", name: "Russian", aliases: [] },
  { group: "International", name: "Dutch", aliases: [] },
  { group: "International", name: "Turkish", aliases: [] },

  {
    group: "Sign language",
    name: "Malaysian Sign Language (BIM)",
    aliases: ["bim", "bahasa isyarat malaysia", "sign language", "msl"],
  },
];

export type ParsedLanguage = { language: string; dialect: string | null };

function key(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

// Every name a language or dialect goes by → what it means. A term several
// languages share ("orang ulu", "orang asli") helps find them in the pickers
// but can't stand for any one, so it's left out of this lookup.
const BY_KEY = (() => {
  const entries: [string, ParsedLanguage][] = [];
  for (const lang of LANGUAGES) {
    for (const name of [lang.name, ...lang.aliases]) entries.push([key(name), { language: lang.name, dialect: null }]);
    for (const d of lang.dialects ?? []) {
      const meaning = { language: lang.name, dialect: d.name };
      // "Kelantanese", "Malay (Kelantanese)" and each alias.
      for (const name of [d.name, `${lang.name} (${d.name})`, ...(d.aliases ?? [])]) entries.push([key(name), meaning]);
    }
  }
  const counts = new Map<string, number>();
  for (const [k, v] of entries) {
    const id = `${k}|${v.language}|${v.dialect ?? ""}`;
    counts.set(k, (counts.get(k) ?? 0) + (counts.has(id) ? 0 : 1));
    counts.set(id, 1);
  }
  const map = new Map<string, ParsedLanguage>();
  for (const [k, v] of entries) if (counts.get(k) === 1) map.set(k, v);
  return map;
})();

const BY_NAME = new Map(LANGUAGES.map((l) => [l.name, l]));

/**
 * What a language name means: "BM" → Malay; "Hokkien" → Chinese (Hokkien);
 * "kecek kelate" → Malay (Kelantanese); anything unlisted is kept as typed.
 * Also reads names saved before dialects existed ("Bahasa Malaysia", "Mandarin").
 */
export function parseLanguage(value: string): ParsedLanguage {
  const trimmed = value.trim().replace(/\s+/g, " ");
  return BY_KEY.get(key(trimmed)) ?? { language: trimmed, dialect: null };
}

/** The standard name of a language, without any dialect ("BM" → "Malay", "Hokkien" → "Chinese"). */
export function canonicalLanguage(value: string): string {
  return parseLanguage(value).language;
}

/** Whether two names are the same language (dialects aside). */
export function sameLanguage(a: string, b: string): boolean {
  return key(canonicalLanguage(a)) === key(canonicalLanguage(b));
}

export function isListedLanguage(value: string): boolean {
  return BY_NAME.has(canonicalLanguage(value));
}

/** A language's dialects, for the pickers — empty when it has none worth asking about. */
export function languageDialects(language: string): string[] {
  return (BY_NAME.get(canonicalLanguage(language))?.dialects ?? []).map((d) => d.name);
}

/** The standard name of a dialect of `language` ("kelantanese malay" → "Kelantanese"), or null if it isn't one. */
export function canonicalDialect(language: string, dialect: string): string | null {
  const base = canonicalLanguage(language);
  const direct = languageDialects(base).find((d) => key(d) === key(dialect));
  if (direct) return direct;
  const parsed = parseLanguage(dialect);
  return parsed.language === base && parsed.dialect ? parsed.dialect : null;
}

/** Picker options: each language under its group heading, searchable by its other names and its dialects' names. */
export const LANGUAGE_OPTIONS = LANGUAGES.map((l) => ({
  value: l.name,
  label: l.name,
  group: l.group,
  keywords: [...l.aliases, ...(l.dialects ?? []).flatMap((d) => [d.name, ...(d.aliases ?? [])])],
}));

/** A job requirement as read: "Malay (Kelantanese)", "Chinese (any dialect)", "English". */
export function formatLanguageRequirement(language: string, dialect: string | null | undefined): string {
  if (dialect) return `${language} (${dialect})`;
  return languageDialects(language).length > 0 ? `${language} (any dialect)` : language;
}

/** A jobseeker's language as read: "Chinese (Mandarin, Hokkien)", "Malay". */
export function formatSpokenLanguage(language: string, dialects: readonly string[] | null | undefined): string {
  return dialects && dialects.length > 0 ? `${language} (${dialects.join(", ")})` : language;
}

/**
 * Whether someone who speaks `have` (with these dialects) meets a requirement
 * for `required` — "any dialect" is met by anyone who speaks the language, a
 * specific dialect only by someone who listed it. Levels are checked separately.
 */
export function meetsLanguage(
  required: { language: string; dialect?: string | null },
  have: { language: string; dialects?: readonly string[] | null },
): boolean {
  if (!sameLanguage(required.language, have.language)) return false;
  if (!required.dialect) return true;
  const wanted = canonicalDialect(required.language, required.dialect) ?? required.dialect;
  return (have.dialects ?? []).some((d) => key(canonicalDialect(have.language, d) ?? d) === key(wanted));
}

/**
 * Clean up job requirements `{ language, dialect?, ... }`: standard names, a
 * name saved with its dialect split out ("Hokkien" → Chinese + Hokkien), and
 * no language+dialect listed twice.
 */
export function normalizeLanguageRequirements<T extends { language: string; dialect?: string | null }>(
  entries: T[],
): (T & { dialect: string | null })[] {
  const seen = new Set<string>();
  const out: (T & { dialect: string | null })[] = [];
  for (const entry of entries) {
    const parsed = parseLanguage(entry.language);
    if (!parsed.language) continue;
    const dialect = entry.dialect ? canonicalDialect(parsed.language, entry.dialect) : parsed.dialect;
    const id = `${key(parsed.language)}|${dialect ? key(dialect) : ""}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ ...entry, language: parsed.language, dialect });
  }
  return out;
}

/**
 * Clean up a jobseeker's languages `{ language, dialects?, ... }`: standard
 * names, dialects merged into one entry per language ("Mandarin" and
 * "Hokkien" → Chinese with both), the first entry's other fields kept.
 */
export function normalizeSpokenLanguages<T extends { language: string; dialects?: readonly string[] | null }>(
  entries: T[],
): (T & { dialects: string[] })[] {
  const byLanguage = new Map<string, T & { dialects: string[] }>();
  for (const entry of entries) {
    const parsed = parseLanguage(entry.language);
    if (!parsed.language) continue;
    const dialects = [
      ...(parsed.dialect ? [parsed.dialect] : []),
      ...(entry.dialects ?? []).map((d) => canonicalDialect(parsed.language, d)).filter((d): d is string => !!d),
    ];
    const k = key(parsed.language);
    const existing = byLanguage.get(k);
    if (existing) {
      for (const d of dialects) if (!existing.dialects.includes(d)) existing.dialects.push(d);
    } else {
      byLanguage.set(k, { ...entry, language: parsed.language, dialects: [...new Set(dialects)] });
    }
  }
  return [...byLanguage.values()];
}
