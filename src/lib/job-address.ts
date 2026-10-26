// Which company address a new job posting starts with: the one marked as the
// default for job posts, else the first (oldest — usually HQ). Pure, so the
// client-side Post a job form and the server can both use it.
export function defaultJobAddress<T extends { isJobDefault?: boolean | null }>(addresses: T[]): T | null {
  return addresses.find((a) => a.isJobDefault) ?? addresses[0] ?? null;
}
