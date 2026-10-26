/**
 * The number in international form ("+60123456789") when it is a Malaysian
 * MOBILE — the only kind that can receive a text message — or null for
 * anything else (a landline, a 1-300 number, something that isn't a phone).
 * Mobiles are 01x numbers: 9 digits after the 0 (012-345 6789), or 10 for
 * the longer ones (011-1234 5678).
 */
export function toMalaysianMobileE164(value: string): string | null {
  if (!isValidMalaysianPhone(value)) return null;
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("60")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = digits.slice(1);
  if (!digits.startsWith("1")) return null;
  // 1-300 / 1-800 and the like are service numbers, not mobiles.
  if (/^1(300|500|600|700|800|900)/.test(digits)) return null;
  // 9 digits after the 0 (12-345 6789); the 011, 014 and 015 ranges run to 10.
  if (digits.length !== 9 && !(digits.length === 10 && /^1[145]/.test(digits))) return null;
  return `+60${digits}`;
}

/**
 * A Malaysian phone number as people actually type it: mobile or landline,
 * with or without the +60 / 0 prefix, spaces, dashes or brackets — e.g.
 * "03-1234 5678", "+60 12-345 6789", "1300-88-1234". Shared by the form and
 * the API so both accept exactly the same numbers.
 */
export function isValidMalaysianPhone(value: string) {
  const trimmed = value.trim();
  if (!/^[0-9+\-\s()]+$/.test(trimmed)) return false;
  // "+" only as the very first character.
  if (trimmed.indexOf("+") > 0) return false;
  let digits = trimmed.replace(/\D/g, "");
  if (digits.startsWith("60")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = digits.slice(1);
  // 8 digits (e.g. Sarawak landlines) up to 10 (011 mobiles, 1-300 numbers).
  return digits.length >= 8 && digits.length <= 10;
}
