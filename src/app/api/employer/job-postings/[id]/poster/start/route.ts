import { NextResponse } from "next/server";
import { and, eq, isNotNull, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { jobPostings } from "@/lib/db/schema";
import { getEmployerAccess } from "@/lib/employer-profile";
import { POSTER_GENERATION_STALE_MS, isPosterGenerationConfigured, submitPosterImageTask } from "@/lib/icreat";
import { getJobPostingForEmployer } from "@/lib/job-postings";
import { type CompanyInfo, type PosterStyle, derivePostingContent, isPosterStyle, type PostingContent } from "@/lib/poster-content";
import { getSession } from "@/lib/session";

// Single-shot generation, full detail — google/gemini-3-1-flash-image
// ("Nano Banana 2") reliably renders bullet lists, labels, and precise
// values correctly (verified by direct testing against the real API),
// unlike Seedream 5.0 which this replaced after it consistently garbled the
// same content. That means the earlier two-stage "AI hero + canvas text
// overlay" hybrid is no longer needed — everything goes in one prompt again.
//
// Logo reference images: this model rejects data: URLs outright ("image URL
// must end with one of [png, jpg, jpeg, webp]", confirmed against the real
// API), unlike Seedream which accepted them directly — but employer logos
// are stored as data: URLs (same convention as avatarUrl/resumeUrl). The
// ../logo.png route re-encodes whatever format was uploaded into a real
// hosted PNG at a URL literally ending in .png, so that can be passed as a
// reference image here instead. Falls back to clean text only when the
// employer hasn't uploaded a logo at all.
function logoInstruction(hasLogo: boolean): string {
  return hasLogo
    ? "Use the attached logo image exactly as given, placed cleanly near the top — do not redraw, restyle, distort, or reinterpret it, just reproduce it faithfully at a small, clean size."
    : "No logo image is available — show the company name as clean bold text in the top-left corner instead. Do not invent or hallucinate a logo mark.";
}

function buildPlayfulPrompt(content: PostingContent, company: CompanyInfo): string {
  return `Create a warm, playful, approachable recruitment poster, vertical 9:16 composition (like an Instagram Story or WhatsApp Status) — styled like a hiring announcement pinned to a corkboard or desk, not a stiff corporate document.

BACKGROUND
Use a soft gradient sky-blue background (light blue to white), optionally with a few decorative clouds or a subtle grid-paper texture near the bottom edge.

MAIN CARD
Show a white sticky-note-style card, slightly rotated for a casual feel, pinned at the top with a glossy red or orange pushpin (a photorealistic-looking pin, small drop shadow). ${logoInstruction(company.hasLogo)} On the card, in bold rounded handwritten-feel or bold sans-serif typography (dark blue/navy), show:
We're Hiring!
Below that, "${content.title}" inside a rounded pill outline in a bright accent color (orange or teal).
Add a small "Apply now" rounded button in bold blue with white text on the card.
Scatter a couple of small playful decorative elements nearby (a paper airplane, a small butterfly, or sparkle accents) for warmth — subtle, not overwhelming.

REQUIREMENTS
Below the main card, on a second white card, show a bold header "REQUIREMENTS" highlighted with a bright yellow background box behind the text. Below it, list as a clean numbered list, verbatim, spelled exactly as given:
${content.requirementLines.map((r, i) => `${i + 1}. ${r}`).join("\n")}

Location: ${content.location}
Salary: ${content.salaryLine}
Employment Type: ${content.employmentType}

FOOTER
At the bottom, clearly show "${company.name}"${company.contactEmail ? ` and "Send your CV to ${company.contactEmail}"` : ""}, and "Apply now on JobGiga" in friendly bold text.

STYLE
Warm, friendly, approachable, a little playful — like a well-designed hiring poster a real HR/social team would post, not a sterile template. Bold rounded typography, bright but not garish colors, soft shadows, a slightly handcrafted "pinned note" feel. Avoid: stiff corporate minimalism, tiny illegible text.

TEXT RENDERING — VERY IMPORTANT
Every word must be spelled exactly as given above, crisp, fully legible, and rendered as a single clean pass of solid-colored characters. No placeholder text, no invented details. Do not double-print, ghost, overlap, or ripple any letters — if a word cannot be rendered cleanly at a given size, increase its size or shorten the surrounding layout rather than rendering it twice or blurred. Each list item must appear exactly once.`;
}

function buildPhotoCorporatePrompt(content: PostingContent, company: CompanyInfo): string {
  return `Create a polished, modern corporate recruitment poster, vertical 9:16 composition (like an Instagram Story or WhatsApp Status), in the style of a professional HR hiring announcement (like a real company's LinkedIn/Instagram hiring post — clean, trustworthy, a little vibrant, NOT a bare-bones text memo).

HEADER
${logoInstruction(company.hasLogo)}
Below or beside the logo, show a bold headline "We're Hiring!" in large, confident sans-serif typography (navy or dark charcoal), with "Hiring" noticeably larger/bolder than "We're".
Show "${content.title}" directly below the headline, inside a solid-color rounded rectangle badge (navy, teal, or brand-accent color) with white text — clearly readable and prominent.

PHOTO
Include a large, photorealistic photo of a smiling, professional-looking person in business/smart-casual attire, appropriate for the "${content.title}" role, positioned on the right side or as a large cropped circular portrait taking up roughly a third of the composition. The photo should look like genuine professional stock photography — natural lighting, confident and approachable expression, realistic (not illustrated, not cartoon). Add a thin colored ring or soft geometric accent shape behind/around the photo.

INFORMATION SECTIONS
Below the header, in a clean two-column layout with rounded card sections, thin dividers, and small line icons, include, verbatim, spelled exactly as given:
RESPONSIBILITIES
${content.responsibilityLines.length > 0 ? content.responsibilityLines.map((r) => `• ${r}`).join("\n") : "• See full posting on JobGiga"}
QUALIFICATIONS
${content.requirementLines.map((r) => `• ${r}`).join("\n")}

Location: ${content.location}
Salary: ${content.salaryLine}
Employment Type: ${content.employmentType}

Give each column generous width and line spacing — font size must stay large enough for every word to be read at a glance. If the text would otherwise feel cramped, shrink the photo or illustration area first, never the text.

FOOTER
At the bottom, show "${company.name}"${company.contactEmail ? `, "Send your CV to ${company.contactEmail}"` : ""}, and a bold "Apply Now" rounded button/badge in a bright accent color, plus "Apply now on JobGiga".

VISUAL STYLE
Confident corporate palette — navy/charcoal as the base, one vibrant accent color (blue, teal, or orange) for badges/buttons/highlights, white/light-grey backgrounds. Use color-blocked geometric shapes (rounded rectangles, circles, soft diagonal panels) for visual interest. Clean modern sans-serif typography throughout (Poppins/Montserrat/Inter style). This should look like a real, well-produced corporate recruitment graphic, not a generic AI flyer.

Avoid: cartoon/illustrated people, uncanny/distorted faces, cluttered layout, childish styling.

TEXT RENDERING — VERY IMPORTANT
Every word must be spelled exactly as given above, crisp, fully legible, and rendered as a single clean pass of solid-colored characters. No placeholder text, no invented details. Do not double-print, ghost, overlap, or ripple any letters — if a word cannot be rendered cleanly at a given size, increase its size or shorten the surrounding layout rather than rendering it twice or blurred. Each bullet point must appear exactly once.`;
}

function buildPrompt(
  posting: NonNullable<Awaited<ReturnType<typeof getJobPostingForEmployer>>>,
  company: CompanyInfo,
  style: PosterStyle,
): string {
  const content = derivePostingContent(posting);
  return style === "playful" ? buildPlayfulPrompt(content, company) : buildPhotoCorporatePrompt(content, company);
}

// Starts a real Nano Banana 2 (google/gemini-3-1-flash-image via icreat.ai)
// image generation task for one posting. `posterGeneratingSince`/
// `posterTaskId` are the source of truth for "is a poster currently
// generating" — enforced here (not just in the UI) so opening the page in
// two tabs, or hitting this twice quickly, can't start two generations at
// once.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "employer") {
    return NextResponse.json({ error: "Not signed in as an employer." }, { status: 401 });
  }
  if (!isPosterGenerationConfigured()) {
    return NextResponse.json({ error: "Poster generation is not configured." }, { status: 500 });
  }
  const access = await getEmployerAccess(session.userId);
  if (!access) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const profileId = access.profile.id;

  const { id } = await params;
  const posting = await getJobPostingForEmployer(profileId, id);
  if (!posting) return NextResponse.json({ error: "Not found." }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const requestedStyle = (body as Record<string, unknown> | null)?.style;
  const style: PosterStyle = isPosterStyle(requestedStyle) ? requestedStyle : "playful";

  // Self-heal any generation stuck past the staleness cutoff (a dropped
  // icreat task_id, or one that never left PENDING/PROCESSING) before
  // checking the lock below — otherwise a single stuck row would permanently
  // block this employer from ever generating a poster again.
  await db
    .update(jobPostings)
    .set({ posterGeneratingSince: null, posterTaskId: null, posterPendingStyle: null })
    .where(
      and(
        eq(jobPostings.employerProfileId, profileId),
        lt(jobPostings.posterGeneratingSince, new Date(Date.now() - POSTER_GENERATION_STALE_MS)),
      ),
    );

  // Includes the current posting, not just others — otherwise a double-click
  // or the page open in two tabs could start two paid generations for the
  // same posting, with the loser's task_id silently overwritten and its
  // result never recorded.
  const [alreadyGenerating] = await db
    .select({ id: jobPostings.id })
    .from(jobPostings)
    .where(and(eq(jobPostings.employerProfileId, profileId), isNotNull(jobPostings.posterGeneratingSince)))
    .limit(1);
  if (alreadyGenerating) {
    return NextResponse.json(
      { error: "Only one poster can generate at a time — wait for the current one to finish." },
      { status: 409 },
    );
  }

  // The logo.png route (../logo.png) has to be reachable from icreat's
  // servers, not just this browser — on localhost NEXT_PUBLIC_SITE_URL
  // isn't publicly routable, so passing that URL would just fail to fetch
  // silently on their end. Only attach it once the site is actually public.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const logoIsPubliclyFetchable = !!access.profile.logoUrl && /^https:\/\//.test(siteUrl);

  const company: CompanyInfo = {
    name: access.profile.companyName,
    contactEmail: access.profile.companyEmail ?? access.profile.contactEmail ?? null,
    hasLogo: logoIsPubliclyFetchable,
  };

  const logoUrl = logoIsPubliclyFetchable ? `${siteUrl}/api/employer/job-postings/${id}/poster/logo.png` : undefined;

  const submitted = await submitPosterImageTask(
    buildPrompt(posting, company, style),
    logoUrl ? [logoUrl] : undefined,
  );
  if (!submitted.ok) {
    return NextResponse.json({ error: submitted.error }, { status: 502 });
  }

  const [updated] = await db
    .update(jobPostings)
    .set({
      posterGeneratingSince: new Date(),
      posterTaskId: submitted.taskId,
      posterPendingStyle: style,
      posterUrl: null,
      updatedAt: new Date(),
    })
    .where(and(eq(jobPostings.id, id), eq(jobPostings.employerProfileId, profileId)))
    .returning({ id: jobPostings.id, posterGeneratingSince: jobPostings.posterGeneratingSince });

  return NextResponse.json({ posting: updated });
}
