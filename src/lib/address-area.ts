import "server-only";
import { extractRoad } from "./address-text";
import { lookupPostcode } from "./postcodes";

/**
 * The neighbourhood for a Malaysian street address (e.g. "Jalan Kerinchi",
 * 59200 → "Bangsar South"), from OpenStreetMap's free Nominatim geocoder —
 * the official postcode list only goes down to the post-office town.
 *
 * Nominatim's usage policy: at most one request a second, an identifying
 * User-Agent, and results cached — so requests here are spaced out one at a
 * time across the whole server and every answer is remembered.
 */
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = `JobGiga/1.0 (${process.env.NEXT_PUBLIC_SITE_URL || "https://jobgiga.my"})`;
const MIN_GAP_MS = 1100;
const CACHE_LIMIT = 2000;

const cache = new Map<string, string | null>();
let queue: Promise<unknown> = Promise.resolve();
let lastRequestAt = 0;

// Runs `task` after every earlier one, at least MIN_GAP_MS after the last.
function throttled<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = lastRequestAt + MIN_GAP_MS - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastRequestAt = Date.now();
    return task();
  });
  queue = run.catch(() => {});
  return run;
}

type NominatimResult = { address?: Record<string, string> };

// The value most of `values` agree on — null when it's a tie (or empty).
function majority(values: (string | undefined)[]): string | null {
  const counts = new Map<string, number>();
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (ranked.length === 0 || (ranked[1] && ranked[1][1] === ranked[0][1])) return null;
  return ranked[0][0];
}

async function search(street: string, postcode: string): Promise<string | null> {
  const params = new URLSearchParams({
    street,
    postalcode: postcode,
    country: "my",
    format: "jsonv2",
    addressdetails: "1",
    limit: "5",
  });
  const res = await throttled(() =>
    fetch(`${NOMINATIM_URL}?${params}`, {
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "en" },
      signal: AbortSignal.timeout(6000),
    }),
  );
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  // Only results in this postcode's town — street names repeat across towns.
  // Matched by postcode, or by town since OpenStreetMap's own postcodes are
  // sometimes off (it has Jalan SS 2/25, Petaling Jaya under 57300, not 47300).
  const towns = new Set(lookupPostcode(postcode).map((m) => m.city.toLowerCase()));
  const addresses = ((await res.json()) as NominatimResult[])
    .map((r) => r.address)
    .filter((a): a is Record<string, string> => !!a)
    .filter((a) => a.postcode === postcode || towns.has((a.city ?? a.town ?? "").toLowerCase()));
  if (addresses.length === 0) return null;
  // One road can run through several neighbourhoods (Jalan Kerinchi: Bangsar
  // South and Kampung Kerinchi) — use the one most results agree on, else the
  // wider suburb they share (Pantai Dalam), else the first result's.
  const local = (a: Record<string, string>) => a.neighbourhood ?? a.suburb ?? a.quarter ?? a.residential;
  return (
    majority(addresses.map(local)) ??
    majority(addresses.map((a) => a.suburb ?? a.quarter)) ??
    local(addresses[0]) ??
    null
  );
}

// The part of an address line that names the road — e.g. "Menara Test,
// Jalan Kerinchi" → "Jalan Kerinchi" — for when the whole line doesn't match.
function roadPart(line: string): string | null {
  const road = extractRoad(line)?.road;
  return road && road !== line.trim() ? road : null;
}

/** The area for this street address, or null if OpenStreetMap doesn't know one. */
export async function lookupAddressArea(street: string, postcode: string): Promise<string | null> {
  const key = `${street.trim().toLowerCase()}|${postcode}`;
  if (cache.has(key)) return cache.get(key) ?? null;

  let area = await search(street.trim(), postcode);
  const road = area ? null : roadPart(street);
  if (road) area = await search(road, postcode);

  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
  cache.set(key, area);
  return area;
}
