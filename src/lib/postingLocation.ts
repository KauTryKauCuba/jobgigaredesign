// A posting's short location (its chip/card text): "Bangsar South, Kuala
// Lumpur" when there's an area, else "Petaling Jaya, Selangor" — or just
// whichever of city/state is set.
export function postingLocationLabel(area: string, city: string, state: string): string {
  const a = area.trim();
  const c = city.trim();
  if (a && c) return `${a}, ${c}`;
  if (c && state) return `${c}, ${state}`;
  return c || state;
}

// Builds the most precise address string available for a job posting's map
// embed — falls back to the short `location` chip text when the structured
// address fields (added alongside company addresses) weren't filled in.
export function fullPostingAddress(posting: {
  location: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  area?: string | null;
  city?: string | null;
  state?: string | null;
  postcode?: string | null;
}): string {
  if (posting.addressLine1 && posting.city && posting.state) {
    return [
      posting.addressLine1,
      posting.addressLine2 || null,
      posting.area || null,
      posting.city,
      posting.postcode ? `${posting.state} ${posting.postcode}` : posting.state,
      "Malaysia",
    ]
      .filter(Boolean)
      .join(", ");
  }
  return posting.location;
}
