// Shared between the employer company-address form and its AI lookup fill,
// so both ever offer/accept the same 16 states/federal territories.
export const MALAYSIA_STATES = [
  "Johor",
  "Kedah",
  "Kelantan",
  "Melaka",
  "Negeri Sembilan",
  "Pahang",
  "Penang",
  "Perak",
  "Perlis",
  "Sabah",
  "Sarawak",
  "Selangor",
  "Terengganu",
  "Kuala Lumpur",
  "Labuan",
  "Putrajaya",
] as const;

export type MalaysiaState = (typeof MALAYSIA_STATES)[number];

// Other ways a state gets written.
const STATE_ALIASES: Record<string, MalaysiaState> = {
  kl: "Kuala Lumpur",
  "pulau pinang": "Penang",
  malacca: "Melaka",
  "n. sembilan": "Negeri Sembilan",
  "negri sembilan": "Negeri Sembilan",
};

// Main towns, for locations saved as just the town (older profiles — the
// area/town search now saves "Town, State"). Towns that straddle a state
// line (Ampang, Cheras, Damansara) are left out rather than guessed.
const TOWN_STATE: Record<string, MalaysiaState> = {
  "petaling jaya": "Selangor",
  "subang jaya": "Selangor",
  "shah alam": "Selangor",
  cyberjaya: "Selangor",
  klang: "Selangor",
  puchong: "Selangor",
  kajang: "Selangor",
  bangi: "Selangor",
  rawang: "Selangor",
  sepang: "Selangor",
  "seri kembangan": "Selangor",
  setapak: "Kuala Lumpur",
  bangsar: "Kuala Lumpur",
  kepong: "Kuala Lumpur",
  "mont kiara": "Kuala Lumpur",
  ipoh: "Perak",
  taiping: "Perak",
  seremban: "Negeri Sembilan",
  nilai: "Negeri Sembilan",
  "alor setar": "Kedah",
  "sungai petani": "Kedah",
  kangar: "Perlis",
  "george town": "Penang",
  georgetown: "Penang",
  butterworth: "Penang",
  "bukit mertajam": "Penang",
  "iskandar puteri": "Johor",
  "batu pahat": "Johor",
  muar: "Johor",
  kuantan: "Pahang",
  "kuala terengganu": "Terengganu",
  "kota bharu": "Kelantan",
  kuching: "Sarawak",
  miri: "Sarawak",
  sibu: "Sarawak",
  bintulu: "Sarawak",
  "kota kinabalu": "Sabah",
  sandakan: "Sabah",
  tawau: "Sabah",
};

const STATE_NAMES: [string, MalaysiaState][] = [
  ...MALAYSIA_STATES.map((s): [string, MalaysiaState] => [s.toLowerCase(), s]),
  ...Object.entries(STATE_ALIASES),
];

/** The state this text names on its own ("Selangor", "KL", "Pulau Pinang"), or null — a town like "Ipoh" isn't one. */
export function malaysiaStateNamed(text: string): MalaysiaState | null {
  const name = text.trim().toLowerCase();
  return STATE_NAMES.find(([n]) => n === name)?.[1] ?? null;
}

/** The state a free-text location is in ("Kota Bharu, Kelantan", "Ipoh", "KL"), or null when it can't tell. */
export function malaysiaStateOf(location: string): MalaysiaState | null {
  const text = location.toLowerCase();
  const has = (name: string) => new RegExp(`(^|[^a-z])${name.replace(/[.]/g, "\\.")}($|[^a-z])`).test(text);
  for (const [name, state] of STATE_NAMES) if (has(name)) return state;
  for (const [town, state] of Object.entries(TOWN_STATE)) if (has(town)) return state;
  return null;
}
