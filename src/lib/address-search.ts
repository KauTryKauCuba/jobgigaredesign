import "server-only";
import { extractRoad, splitPostcode } from "./address-text";
import { MALAYSIA_STATES } from "./malaysia";
import { lookupPostcode } from "./postcodes";

/**
 * Address suggestions as an employer types a street or building — from
 * Photon (photon.komoot.io), OpenStreetMap's free search-as-you-type
 * geocoder. Each suggestion carries the full address, so picking one fills in
 * the postcode, city, area and state. City and state come from the official
 * postcode list (so they always agree with the postcode); the area is
 * OpenStreetMap's locality/district.
 */
const PHOTON_URL = "https://photon.komoot.io/api/";
const USER_AGENT = `JobGiga/1.0 (${process.env.NEXT_PUBLIC_SITE_URL || "https://jobgiga.my"})`;
// Malaysia's bounding box (west, south, east, north).
const MALAYSIA_BBOX = "99.6,0.8,119.3,7.4";
const CACHE_LIMIT = 2000;

export type AddressSuggestion = {
  addressLine1: string;
  area: string | null;
  city: string;
  state: (typeof MALAYSIA_STATES)[number];
  postcode: string;
};

type PhotonFeature = {
  properties: {
    countrycode?: string;
    osm_key?: string;
    osm_value?: string;
    name?: string;
    housenumber?: string;
    street?: string;
    postcode?: string;
    locality?: string;
    district?: string;
    city?: string;
    state?: string;
  };
};

// Results that aren't a place you'd put as an office address — the big ones
// (train lines etc.) are excluded in the query itself, these are the rest.
const EXCLUDED_TAGS = ["railway", "public_transport", "route", "highway:bus_stop", "boundary", "waterway"];
const SKIP_KEYS = new Set(["natural", "landuse"]);
const SKIP_VALUES = new Set(["bus_stop", "shelter", "platform", "station", "stop_position"]);
const ROAD_KEY = "highway";

const cache = new Map<string, AddressSuggestion[]>();

// For the few postcodes missing from the official list (often a big office's
// own postcode): the state from OpenStreetMap — or, in Kuala Lumpur,
// Putrajaya and Labuan, which have no state there, the city itself.
function stateFromOsm(p: PhotonFeature["properties"]): AddressSuggestion["state"] | null {
  const byName = (name?: string) =>
    MALAYSIA_STATES.find((s) => s.toLowerCase() === (name ?? "").toLowerCase().replace(/^(pulau )?pinang$/, "penang"));
  return byName(p.state) ?? byName(p.city) ?? null;
}

function toSuggestion(feature: PhotonFeature): AddressSuggestion | null {
  const p = feature.properties;
  if (p.countrycode !== "MY" || !p.postcode || !/^\d{5}$/.test(p.postcode)) return null;
  if (SKIP_KEYS.has(p.osm_key ?? "") || SKIP_VALUES.has(p.osm_value ?? "")) return null;
  const [listed] = lookupPostcode(p.postcode);
  const osmState = listed ? null : stateFromOsm(p);
  const town = listed ?? (p.city && osmState ? { city: p.city, state: osmState } : null);
  if (!town) return null;

  // A road is its own address line; a building or business is "Name, Road".
  const isRoad = p.osm_key === ROAD_KEY;
  const road = isRoad ? p.name : p.street;
  const place = isRoad ? null : p.name;
  const numbered = p.housenumber && road ? `${p.housenumber}, ${road}` : road;
  const addressLine1 = [place, numbered].filter(Boolean).join(", ");
  if (!addressLine1) return null;

  const area = p.locality ?? p.district ?? null;
  return {
    addressLine1,
    // Not repeated when it's just the town again (e.g. "Kuala Lumpur").
    area: area && area.toLowerCase() !== town.city.toLowerCase() ? area : null,
    city: town.city,
    state: town.state,
    postcode: p.postcode,
  };
}

// A leading unit/house number ("12, ", "No. 12 ", "A-3-1, ") throws the
// search off (it matched a "12" elsewhere) — searched without it; the form
// keeps what the employer typed.
export function withoutHouseNumber(query: string) {
  return query.replace(/^\s*(no\.?\s*)?[a-z]?\d[\w-/]*\s*,?\s+/i, "").trim();
}

export async function searchAddresses(query: string): Promise<AddressSuggestion[]> {
  // A whole address pasted in one go ("no. 1 lot 4139 lorong haji salam
  // kampung sungai pinang dalam, 41400 klang selangor") matches nothing as
  // is — search its road, within its postcode's town, instead.
  const { rest, postcode } = splitPostcode(query);
  const [town] = postcode ? lookupPostcode(postcode) : [];
  const road = extractRoad(rest)?.road;
  const q = [road ?? withoutHouseNumber(rest), town?.city].filter(Boolean).join(" ");
  if (q.length < 3) return [];
  const key = `${q.toLowerCase()}|${postcode ?? ""}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const params = new URLSearchParams({ q, limit: "15", lang: "en", bbox: MALAYSIA_BBOX });
  for (const tag of EXCLUDED_TAGS) params.append("osm_tag", `!${tag}`);
  const res = await fetch(`${PHOTON_URL}?${params}`, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`Photon ${res.status}`);
  const features = ((await res.json()) as { features?: PhotonFeature[] }).features ?? [];

  const seen = new Set<string>();
  const suggestions: AddressSuggestion[] = [];
  for (const feature of features) {
    const s = toSuggestion(feature);
    if (!s) continue;
    // A postcode was given: only that postcode, or its town.
    if (postcode && s.postcode !== postcode && s.city.toLowerCase() !== town?.city.toLowerCase()) continue;
    const id = `${s.addressLine1.toLowerCase()}|${s.postcode}`;
    if (seen.has(id)) continue;
    seen.add(id);
    suggestions.push(s);
    if (suggestions.length === 6) break;
  }

  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
  cache.set(key, suggestions);
  return suggestions;
}
