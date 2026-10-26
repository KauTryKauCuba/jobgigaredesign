import "server-only";
import { MALAYSIA_STATES } from "./malaysia";
import { listMalaysianTowns, lookupPostcode } from "./postcodes";
import type { Place } from "./work-locations";

/**
 * Search-as-you-type for where a jobseeker is (or wants to work): towns from
 * the official postcode list, plus areas and neighbourhoods ("Kota
 * Damansara", "Bangsar") from Photon (photon.komoot.io), OpenStreetMap's free
 * geocoder — the same service the employer address search uses. Every result
 * is tied to an official town and state, so it lines up with employer job
 * locations, and areas carry map coordinates for distance features later.
 * The town list needs no network, so towns still come up if Photon is down.
 */
const PHOTON_URL = "https://photon.komoot.io/api/";
const USER_AGENT = `JobGiga/1.0 (${process.env.NEXT_PUBLIC_SITE_URL || "https://jobgiga.my"})`;
// Malaysia's bounding box (west, south, east, north).
const MALAYSIA_BBOX = "99.6,0.8,119.3,7.4";
const CACHE_LIMIT = 2000;
const MAX_RESULTS = 8;
// Place types that are themselves a town (not an area inside one).
const TOWN_LEVEL = new Set(["city", "town", "municipality"]);

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] };
  properties: {
    countrycode?: string;
    osm_value?: string;
    name?: string;
    postcode?: string;
    city?: string;
    state?: string;
  };
};

type MalaysiaState = (typeof MALAYSIA_STATES)[number];

const cache = new Map<string, Place[]>();

function stateByName(name: string | undefined): MalaysiaState | null {
  const n = (name ?? "").toLowerCase().replace(/^(pulau )?pinang$/, "penang");
  return MALAYSIA_STATES.find((s) => s.toLowerCase() === n) ?? null;
}

/** The official town a Photon result belongs to: by postcode, else by name. */
function townFor(p: PhotonFeature["properties"]): { city: string; state: MalaysiaState } | null {
  if (p.postcode && /^\d{5}$/.test(p.postcode)) {
    const [listed] = lookupPostcode(p.postcode);
    if (listed) return listed;
  }
  const towns = listMalaysianTowns();
  const osmState = stateByName(p.state);
  const byName = (name: string | undefined) => {
    if (!name) return null;
    const matches = towns.filter((t) => t.city.toLowerCase() === name.toLowerCase());
    // The same town name exists in two states now and then — the state decides.
    return matches.find((t) => t.state === osmState) ?? (matches.length === 1 ? matches[0] : null);
  };
  return byName(p.city) ?? (TOWN_LEVEL.has(p.osm_value ?? "") ? byName(p.name) : null);
}

function toPlace(feature: PhotonFeature): Place | null {
  const p = feature.properties;
  if (p.countrycode !== "MY" || !p.name) return null;
  const town = townFor(p);
  if (!town) return null;
  const [lng, lat] = feature.geometry?.coordinates ?? [];
  const isTown = p.name.toLowerCase() === town.city.toLowerCase();
  return {
    area: isTown ? null : p.name,
    city: town.city,
    state: town.state,
    lat: typeof lat === "number" ? Math.round(lat * 1e5) / 1e5 : null,
    lng: typeof lng === "number" ? Math.round(lng * 1e5) / 1e5 : null,
  };
}

const keyOf = (p: Pick<Place, "area" | "city" | "state">) => `${(p.area ?? "").toLowerCase()}|${p.city.toLowerCase()}|${p.state}`;

/** Towns from the official list whose name matches — instant, no network. */
function matchingTowns(q: string): Place[] {
  const needle = q.toLowerCase();
  return listMalaysianTowns()
    .filter((t) => t.city.toLowerCase().includes(needle))
    .sort((a, b) => Number(!a.city.toLowerCase().startsWith(needle)) - Number(!b.city.toLowerCase().startsWith(needle)))
    .slice(0, 4)
    .map((t) => ({ area: null, city: t.city, state: t.state, lat: null, lng: null }));
}

async function photonPlaces(q: string): Promise<Place[]> {
  const params = new URLSearchParams({ q, limit: "15", lang: "en", bbox: MALAYSIA_BBOX, osm_tag: "place" });
  const res = await fetch(`${PHOTON_URL}?${params}`, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`Photon ${res.status}`);
  const features = ((await res.json()) as { features?: PhotonFeature[] }).features ?? [];
  return features.map(toPlace).filter((p): p is Place => p !== null);
}

/** Towns and areas for what's been typed so far; `unavailable` when only the town list could be searched. */
export async function searchPlaces(query: string): Promise<{ places: Place[]; unavailable: boolean }> {
  const q = query.trim().replace(/\s+/g, " ");
  if (q.length < 2) return { places: [], unavailable: false };
  const key = q.toLowerCase();
  const cached = cache.get(key);
  if (cached) return { places: cached, unavailable: false };

  const towns = matchingTowns(q);
  let areas: Place[];
  try {
    areas = await photonPlaces(q);
  } catch {
    return { places: towns, unavailable: true };
  }

  // Towns first (with Photon's coordinates when it found the same town),
  // then areas; no repeats.
  const byKey = new Map(areas.map((p) => [keyOf(p), p]));
  const places: Place[] = [];
  const seen = new Set<string>();
  for (const t of towns) {
    const k = keyOf(t);
    places.push(byKey.get(k) ?? t);
    seen.add(k);
  }
  for (const a of areas) {
    const k = keyOf(a);
    if (seen.has(k)) continue;
    seen.add(k);
    places.push(a);
  }
  const result = places.slice(0, MAX_RESULTS);
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
  cache.set(key, result);
  return { places: result, unavailable: false };
}
