import type { MALAYSIA_STATES } from "./malaysia";

// A place in Malaysia, picked from the place search (src/lib/place-search.ts):
// an official town and state, plus the area when one was picked ("Kota
// Damansara") and map coordinates when known. Used for where a jobseeker is
// and where they'd like to work. Client-safe.

export type Place = {
  area: string | null;
  city: string;
  state: (typeof MALAYSIA_STATES)[number];
  lat: number | null;
  lng: number | null;
};

export type WorkPlace = Place;

export const MAX_WORK_PLACES = 5;
export const AREA_MAX = 100;

/** "Kota Damansara, Petaling Jaya, Selangor" — the town is left out when it's the state ("Setapak, Kuala Lumpur"). */
export function formatPlace(place: Pick<Place, "area" | "city" | "state">): string {
  const town = place.city.toLowerCase() === place.state.toLowerCase() ? place.city : `${place.city}, ${place.state}`;
  return place.area ? `${place.area}, ${town}` : town;
}

/** "Setapak, Kuala Lumpur · Petaling Jaya, Selangor" — or null when they haven't said. */
export function formatWorkPlaces(list: WorkPlace[] | null | undefined): string | null {
  return list && list.length > 0 ? list.map(formatPlace).join(" · ") : null;
}

/** Inside Malaysia's bounding box — coordinates from anywhere else are a mistake. */
export function isMalaysiaCoordinate(lat: unknown, lng: unknown): boolean {
  return typeof lat === "number" && typeof lng === "number" && lat >= 0.8 && lat <= 7.4 && lng >= 99.6 && lng <= 119.3;
}
