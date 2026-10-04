// Client-safe: the choices shown on the Cover Letters page and accepted by
// the generate/regenerate routes.

export const COVER_LETTER_TONES = ["professional", "friendly", "confident"] as const;
export const COVER_LETTER_LENGTHS = ["standard", "short"] as const;
export const COVER_LETTER_LANGUAGES = ["en", "ms"] as const;

export type CoverLetterOptions = {
  tone: (typeof COVER_LETTER_TONES)[number];
  length: (typeof COVER_LETTER_LENGTHS)[number];
  language: (typeof COVER_LETTER_LANGUAGES)[number];
};

export const DEFAULT_COVER_LETTER_OPTIONS: CoverLetterOptions = {
  tone: "professional",
  length: "standard",
  language: "en",
};

export const COVER_LETTER_TONE_LABEL: Record<CoverLetterOptions["tone"], string> = {
  professional: "Professional",
  friendly: "Friendly",
  confident: "Confident",
};
export const COVER_LETTER_LENGTH_LABEL: Record<CoverLetterOptions["length"], string> = {
  standard: "Standard",
  short: "Short",
};
export const COVER_LETTER_LANGUAGE_LABEL: Record<CoverLetterOptions["language"], string> = {
  en: "English",
  ms: "Bahasa Malaysia",
};

/** True when rich-text HTML has no actual words in it (e.g. "<p></p>"). */
export function isBlankHtml(html: string) {
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim().length === 0;
}
