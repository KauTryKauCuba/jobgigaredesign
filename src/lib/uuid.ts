const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// For ids that come from a request — a malformed one would otherwise make
// Postgres throw on the uuid cast and surface as a 500 instead of a 400/404.
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}
