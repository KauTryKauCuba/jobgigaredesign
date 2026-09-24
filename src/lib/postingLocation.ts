// Builds the most precise address string available for a job posting's map
// embed — falls back to the short `location` chip text when the structured
// address fields (added alongside company addresses) weren't filled in.
export function fullPostingAddress(posting: {
  location: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postcode?: string | null;
}): string {
  if (posting.addressLine1 && posting.city && posting.state) {
    return [
      posting.addressLine1,
      posting.addressLine2 || null,
      posting.city,
      posting.postcode ? `${posting.state} ${posting.postcode}` : posting.state,
      "Malaysia",
    ]
      .filter(Boolean)
      .join(", ");
  }
  return posting.location;
}
