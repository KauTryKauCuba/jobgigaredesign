import "server-only";
import { allPostcodes } from "malaysia-postcodes";
import { MALAYSIA_STATES } from "./malaysia";

type MalaysiaState = (typeof MALAYSIA_STATES)[number];
export type PostcodeMatch = { city: string; state: MalaysiaState };

// The dataset's state names → the ones this app uses everywhere.
const STATE_NAMES: Record<string, MalaysiaState> = {
  "Wp Kuala Lumpur": "Kuala Lumpur",
  "Wp Labuan": "Labuan",
  "Wp Putrajaya": "Putrajaya",
  "Pulau Pinang": "Penang",
};

// postcode → the post-office town(s) it belongs to. Built once per server;
// a handful of postcodes cover two towns.
let index: Map<string, PostcodeMatch[]> | null = null;
function getIndex() {
  if (index) return index;
  index = new Map();
  for (const state of allPostcodes) {
    const stateName =
      STATE_NAMES[state.name] ?? MALAYSIA_STATES.find((s) => s.toLowerCase() === state.name.toLowerCase());
    if (!stateName) continue;
    for (const city of state.city) {
      for (const postcode of city.postcode) {
        const matches = index.get(postcode) ?? [];
        matches.push({ city: city.name, state: stateName });
        index.set(postcode, matches);
      }
    }
  }
  return index;
}

/** The town(s) and state for a 5-digit Malaysian postcode — empty if it isn't one. */
export function lookupPostcode(postcode: string): PostcodeMatch[] {
  return /^\d{5}$/.test(postcode) ? (getIndex().get(postcode) ?? []) : [];
}

// Every post-office town with its state — the jobseeker's "where are you
// based" list, spelled the same way as employer addresses (which fill their
// city from the postcode). A few town names exist in two states.
let towns: PostcodeMatch[] | null = null;
export function listMalaysianTowns(): PostcodeMatch[] {
  if (towns) return towns;
  const seen = new Set<string>();
  towns = [];
  for (const state of allPostcodes) {
    const stateName =
      STATE_NAMES[state.name] ?? MALAYSIA_STATES.find((s) => s.toLowerCase() === state.name.toLowerCase());
    if (!stateName) continue;
    for (const city of state.city) {
      const key = `${city.name}|${stateName}`;
      if (seen.has(key)) continue;
      seen.add(key);
      towns.push({ city: city.name, state: stateName });
    }
  }
  towns.sort((a, b) => a.city.localeCompare(b.city) || a.state.localeCompare(b.state));
  return towns;
}
