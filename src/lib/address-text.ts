// Picking apart an address typed (or pasted) as one line, e.g.
// "no. 1 lot 4139 lorong haji salam kampung sungai pinang dalam, 41400 klang selangor"
// → house/lot "no. 1 lot 4139", road "lorong haji salam", area "kampung sungai
// pinang dalam", postcode "41400". Shared by the address search (server) and
// the address form (browser), so both read an address the same way.

const ROAD_WORDS =
  /\b(jalan|jln\.?|lorong|lrg\.?|persiaran|psrn\.?|lebuhraya|lebuh|lingkaran|lengkok|medan|changkat|lintang|solok|pesiaran|tingkat)\s/i;
// Where a road name ends and the neighbourhood starts. Not "SS", which is
// part of road names too ("Jalan SS 2/24").
const AREA_WORDS =
  /\b(kampung|kg\.?|taman|tmn\.?|bandar|bdr\.?|seksyen|desa|pangsapuri|apartment|kondominium|condominium|felda)\b/i;

/** A 5-digit postcode in the text, and the text before it (what follows — town, state — dropped). */
export function splitPostcode(text: string): { rest: string; postcode: string | null } {
  const matches = [...text.matchAll(/(^|[^\d])(\d{5})(?!\d)/g)];
  const last = matches.at(-1);
  if (!last || last.index === undefined) return { rest: text.trim(), postcode: null };
  const start = last.index + last[1].length;
  return { rest: text.slice(0, start).replace(/[\s,]+$/, "").trim(), postcode: last[2] };
}

/** The road in an address line, with what comes before it (unit, building) and after it (area). */
export function extractRoad(text: string): { before: string; road: string; after: string } | null {
  const match = ROAD_WORDS.exec(text);
  if (!match) return null;
  const start = match.index;
  // The road runs to the next comma, or to an area word that comes after at
  // least one word of the road's own name ("Lorong Haji Salam Kampung…" —
  // but not "Jalan Taman Ibu Kota", which is a road).
  const commaAt = text.indexOf(",", start);
  const segmentEnd = commaAt === -1 ? text.length : commaAt;
  const segment = text.slice(start, segmentEnd);
  const nameStart = match[0].length;
  const firstWordEnd = segment.slice(nameStart).search(/\s|$/) + nameStart;
  const areaAt = segment.slice(firstWordEnd).search(AREA_WORDS);
  const roadEnd = areaAt === -1 ? segmentEnd : start + firstWordEnd + areaAt;
  const clean = (s: string) => s.replace(/^[\s,]+|[\s,]+$/g, "");
  return {
    before: clean(text.slice(0, start)),
    road: clean(text.slice(start, roadEnd)),
    after: clean(text.slice(roadEnd)),
  };
}

/**
 * The neighbourhood named right after the road — "kampung sungai pinang
 * dalam", or "Bangsar South" in "Jalan Kerinchi, Bangsar South" — if any.
 */
export function areaAfterRoad(after: string): string | null {
  return after.split(",")[0].trim() || null;
}

/** "kampung sungai pinang dalam" → "Kampung Sungai Pinang Dalam" (leaves "SS2"-style words alone). */
export function titleCase(text: string): string {
  return text.replace(/\S+/g, (w) => (/[A-Z]/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)));
}
