// A job posting's "Posted by" contact — public details only. Kept apart from
// posting-extras.ts (server-only) so client components can use the type.
export type PostingContact = { name: string; position: string | null; avatarUrl: string | null };
