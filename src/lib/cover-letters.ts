import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "./db";
import { coverLetters } from "./db/schema";

export async function getCoverLettersForProfile(jobseekerProfileId: string) {
  return db
    .select()
    .from(coverLetters)
    .where(eq(coverLetters.jobseekerProfileId, jobseekerProfileId))
    .orderBy(desc(coverLetters.createdAt));
}

export async function getCoverLetterForProfile(jobseekerProfileId: string, id: string) {
  const [row] = await db
    .select()
    .from(coverLetters)
    .where(and(eq(coverLetters.id, id), eq(coverLetters.jobseekerProfileId, jobseekerProfileId)));
  return row ?? null;
}

export async function createCoverLetter(params: {
  jobseekerProfileId: string;
  companyName: string;
  jobTitle: string;
  jobPostingText: string;
  content: string;
}) {
  const [row] = await db.insert(coverLetters).values(params).returning();
  return row;
}

export async function updateCoverLetterContent(jobseekerProfileId: string, id: string, content: string) {
  const [row] = await db
    .update(coverLetters)
    .set({ content, updatedAt: new Date() })
    .where(and(eq(coverLetters.id, id), eq(coverLetters.jobseekerProfileId, jobseekerProfileId)))
    .returning();
  return row ?? null;
}

export async function deleteCoverLetter(jobseekerProfileId: string, id: string) {
  const [row] = await db
    .delete(coverLetters)
    .where(and(eq(coverLetters.id, id), eq(coverLetters.jobseekerProfileId, jobseekerProfileId)))
    .returning();
  return row ?? null;
}
