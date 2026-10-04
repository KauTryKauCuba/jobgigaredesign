// Client-safe content for the video pitch guide: the five on-screen
// questions (timed to fit 60s), the example answer, and filming tips.

export type GuideLanguage = "en" | "ms";

export const PITCH_QUESTIONS: { startsAt: number; en: string; ms: string; hint: { en: string; ms: string } }[] = [
  {
    startsAt: 0,
    en: "Who are you?",
    ms: "Siapa anda?",
    hint: { en: "Your name, current or last role, years of experience", ms: "Nama, jawatan sekarang/terakhir, tahun pengalaman" },
  },
  {
    startsAt: 10,
    en: "What are you good at?",
    ms: "Apa kelebihan anda?",
    hint: { en: "Your 2–3 strongest skills", ms: "2–3 kemahiran terbaik anda" },
  },
  {
    startsAt: 25,
    en: "Share one thing you're proud of at work.",
    ms: "Kongsikan satu pencapaian anda.",
    hint: { en: "One real example — this is what employers remember", ms: "Satu contoh sebenar — ini yang majikan ingat" },
  },
  {
    startsAt: 40,
    en: "What kind of job are you looking for?",
    ms: "Kerja apa yang anda cari?",
    hint: { en: "Role, full/part-time, area or shift", ms: "Jawatan, sepenuh/separuh masa, kawasan atau syif" },
  },
  {
    startsAt: 50,
    en: "Why should an employer pick you?",
    ms: "Kenapa majikan patut pilih anda?",
    hint: { en: "A confident closing — and when you can start", ms: "Penutup yang yakin — dan bila boleh mula" },
  },
];

export const PITCH_EXAMPLE: Record<GuideLanguage, string> = {
  en: "“Hi, I'm Aisyah. I've worked 4 years as a cashier and supervisor at Mydin. I'm good with customers, handling cash, and training new staff. Last year I trained 6 new cashiers and our counter had the fewest errors in the store. I'm looking for a full-time retail supervisor role around Shah Alam. I'm reliable, friendly, and I can start immediately. Thank you!”",
  ms: "“Hai, saya Aisyah. Saya sudah 4 tahun bekerja sebagai juruwang dan penyelia di Mydin. Saya mahir melayan pelanggan, mengurus tunai dan melatih staf baharu. Tahun lepas saya melatih 6 juruwang baharu dan kaunter kami paling sedikit kesilapan di kedai. Saya mencari jawatan penyelia runcit sepenuh masa di sekitar Shah Alam. Saya boleh dipercayai, mesra, dan boleh mula serta-merta. Terima kasih!”",
};

export const PITCH_TIPS: Record<GuideLanguage, string[]> = {
  en: [
    "💡 Face a window or lamp — not with the light behind you.",
    "📱 Hold your phone at eye level, or prop it up steady.",
    "🤫 Find a quiet spot so employers can hear you clearly.",
    "🙂 Smile and talk naturally — it doesn't need to be perfect.",
    "🔁 You can re-record as many times as you like.",
  ],
  ms: [
    "💡 Hadap tingkap atau lampu — jangan cahaya di belakang anda.",
    "📱 Pegang telefon pada paras mata, atau sandarkan dengan stabil.",
    "🤫 Cari tempat yang senyap supaya majikan dengar dengan jelas.",
    "🙂 Senyum dan bercakap secara semula jadi — tak perlu sempurna.",
    "🔁 Anda boleh rakam semula seberapa banyak kali.",
  ],
};

/** The question to show at a given second of recording. */
export function questionIndexAt(seconds: number) {
  let index = 0;
  PITCH_QUESTIONS.forEach((q, i) => {
    if (seconds >= q.startsAt) index = i;
  });
  return index;
}
