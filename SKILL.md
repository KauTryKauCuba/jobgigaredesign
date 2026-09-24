---
name: jobgigaredesign
description: The design system and frontend conventions already established in the JobGiga redesign codebase (Next.js App Router + Tailwind v4). Load before building or editing any UI in this repo so new work matches the existing brand, components, copy voice, and code patterns exactly — this documents what already exists and is liked, not an aspirational or generic style guide.
---

# JobGiga Design System

This is a record of JobGiga's actual, already-built visual language — not a generic
best-practices guide. Every token and pattern below is pulled directly from the
current codebase. When building or editing any UI in this repo, **reuse these exact
patterns** rather than inventing a new card style, a new button shape, a new icon
source, or a new copy voice. If a new screen needs something not covered here,
extend the closest existing pattern rather than starting fresh.

---

## 1. Brand Tokens

Defined in `src/app/globals.css` under `@theme inline` (Tailwind v4 auto-generates
utility classes from these — use `bg-brand-teal-dark`, not the raw hex, wherever a
token exists):

| Token | Hex | Utility | Used for |
|---|---|---|---|
| `--color-brand-teal` | `#07BCCA` | `text-brand-teal`, `bg-brand-teal` | Lighter half of the logo mark, gradient accents (SiriOrb blob). Decorative only — never on buttons/text. |
| `--color-brand-teal-dark` | `#008990` | `text-brand-teal-dark`, `bg-brand-teal-dark` | **The Employer accent color**, and the default for all role-agnostic chrome (`AuthModal`, `Navbar`, `Footer`, marketing homepage). Solid button fill (white text), active pill state, footer background, icon accent, focus border. |
| `--color-brand-gold-dark` | `#A67C00` | `text-brand-gold-dark`, `bg-brand-gold-dark`, `border-brand-gold-dark`, `accent-brand-gold-dark` | **The Jobseeker accent color** — the equivalent of `brand-teal-dark` for everything *except* filled buttons: focus borders, dropzone borders, icon tint, checkbox accent, small accent text. **Not** used for button fills with white text — see the Gold row below for why. |
| `--color-brand-ink` | `#141B2E` | `text-brand-ink` | Primary text color (also `body`'s default `color`) |

Other colors in constant use (no token yet — use the same arbitrary-value hex,
don't invent a nearby shade):

| Hex | Used for |
|---|---|
| `#F2FAF5` | Page background (`body`, every `<main>`) |
| `#4B5468` | Secondary/body text |
| `#9AA3B2` | Muted text, placeholders, helper copy |
| `#F1F4F8` | Soft chip/track background (pill toggles, skill tags) — Employer/shared side |
| `#E6F9FA` | Pale-teal chip/dropzone tint (Employer/shared side), paired with `brand-teal-dark` text |
| `#FFE9A6` | Gold — used two ways: (1) role-agnostic decorative (gradient-border card edge, `SiriOrb`'s third blob, Hero toggle's jobseeker-active track fill); (2) the **Jobseeker button/fill color** — solid buttons, selected date-picker day, assistant-card CTA — always paired with `#141B2E` ink text, never white |
| `#FFF3D6` | Pale-gold chip/dropzone tint — the Jobseeker-side equivalent of `#E6F9FA`, paired with `brand-gold-dark` text/icons |
| `black/[0.1]`, `black/[0.08]` | Hairline borders |
| `red-500` | Error text only |

**Rule:** exactly two accent colors, one per role — `brand-teal-dark` for
Employer (and all shared/role-agnostic chrome), `brand-gold-dark`/`#FFE9A6` for
Jobseeker. Don't introduce a third accent or a different palette family for a
new page. See DESIGN.md's "Employer vs. Jobseeker" section for the full
rationale and the `accent` prop mechanism below.

---

## 2. Typography

* **Font:** Inter, loaded via `next/font/google` in `src/app/layout.tsx` as
  `--font-inter`, wired into Tailwind's `--font-sans`. Never add a Google Fonts
  `<link>` tag — always `next/font`.
* **Case:** sentence case everywhere (headings, buttons, labels). Not Title Case.
* **Real scale in use** (cite these sizes for new UI, don't pick arbitrary ones):
  * Hero headline: `clamp(34px,4vw,56px)`, `font-semibold`, `tracking-[-0.02em]`,
    `leading-[1.08]` (`Hero.tsx`)
  * Card/modal heading: `22px` `font-semibold` (`AuthModal`, both onboarding forms)
  * Emphasis/display text: `20px` `font-semibold` (OTP digit inputs, `Footer`'s
    "JobGiga" wordmark)
  * Pitch-card heading: `15.5px` `font-semibold` (`HiringStats`, `ResumeUpload`,
    and every other small card heading, e.g. `ResumeUpload`'s "Upload your
    resume" heading inside `OnboardingForm`) — this is the one size for a
    small card's own heading; don't reach for `16px`, which is reserved for
    body copy everywhere in this app.
  * Bubble/list-item title: `15px` `font-medium` (`AssistantCard`)
  * Body copy: `16px/24px` for hero subcopy; `14px/20px` for modal/card copy;
    `13–13.5px` for compact card copy
  * Micro/label text: `12–12.5px` (helper text, section labels like "About you")
  * Fine print: `10.5–11px` (**error text is always `text-[11px] text-red-500`**,
    rendered directly above the submit button; also used for the smallest
    secondary captions like the badge sub-label in `JobPostingBadges`)
  * Mockup micro-text: `10px` — the one size for all decorative-mockup text
    below the fine-print floor (`AiFillMockup`/`JobPostMockup`'s skeleton
    captions, status/percentage badges, "Looking up…"/"Writing…" pills).
    Previously drifted between `8.5px`/`9.5px`/`10px`/`10.5px` for the same
    role; standardized to `10px` — don't reintroduce a nearby size for new
    mockup text.
* **One-off exception:** `TrustedByStrip`'s fallback wordmark (for logos not yet
  provided as real assets) uses `text-[25px] font-bold tracking-tight` — this
  is a logo substitute, not a text style (including its `tracking-tight`);
  don't reuse any part of it for headings or body copy.
* **Weight:** default regular; `font-medium` for buttons/pills/labels;
  `font-semibold` for headings and display/emphasis text.
* **Uppercase eyebrow tracking:** `tracking-[0.04em]` is the one standard —
  used by both instances in the app (`OnboardingForm`'s `CategoryHeading`
  section labels and `Footer`'s link-group titles). Previously the two
  disagreed (`Footer` used Tailwind's `tracking-wide`); now unified.

---

## 3. Layout & Spacing

* **`.shell`** (in `globals.css`) is the page container for every top-level
  section — centered, full-width, responsive inline padding: `13.28%` desktop,
  `9%` ≤1440px, `5%` ≤1024px, `20px` ≤640px. Reuse it; don't invent a second
  `max-w-...` wrapper convention.
* **Card width:** every card component (`HiringStats`, `ResumeUpload`,
  `OnboardingForm`, `EmployerOnboardingForm`) is `max-w-[440px]`. Keep new cards
  at this width unless there's a specific reason not to.
* **Control height:** the app uses a small, purpose-driven scale, capped at
  `38px` — no control on the site is taller than that — pick the tier that
  matches what the control *does*, don't invent a new value:
  * `38px` — the maximum height in the system: primary buttons, text inputs,
    pill-toggle rows, secondary/outline buttons (Navbar's Sign out / Switch
    role), and compact pill options (`Dropdown`'s listbox option rows,
    `AuthModal`'s account-type pills, `EmployerProfileSummary`'s section tabs,
    `EmployerOnboardingForm`'s company-size pill) all share this one height
    (previously primary buttons/inputs ran taller at `44px`; unified down to
    `38px`)
  * `34px` — embedded/inline CTA buttons inside a larger card (`AssistantCard`'s
    chat-overlay CTA/Skip)
  * `30px` — voice/mic and send circular buttons (`FloatingDemoWidget`)
  * `28px` — modal/panel primary close `×` (one per modal, top corner)
  * `26px` — compact popover navigation icon (`DatePicker`'s prev/next month
    arrows) and miniature-mockup buttons scaled down intentionally
    (`JobPostMockup`)
  * `24px` — standalone item remove/close `×` next to a row or card (entry
    rows, attached-file rows, `FloatingDemoWidget`'s close button)
  * `16px` — chip-inline remove `×` (nested inside a small tag/pill, e.g. a
    skill chip)

  Icon-button sizes are grouped by what the icon does (chip-inline remove vs.
  standalone remove vs. modal close vs. popover nav), not one flat number —
  but every control performing the *same* role uses the *same* value across
  the whole app; don't pick a nearby-but-different pixel value for a new
  instance of an existing role.
* **Card inner padding:** `p-[22px]` for every card (`HiringStats`,
  `ResumeUpload`, `AuthModal`, `OnboardingForm`, `EmployerOnboardingForm`). Do
  not use a different value.
* **Modal width:** every modal dialog is `max-w-[380px]`, `rounded-[24px]`,
  `p-[22px]`. This chrome is extracted into `src/components/Modal.tsx`
  (`AuthModal`, both of `Navbar`'s dialogs, and `OnboardingForm`'s
  resume-warning dialog all render `<Modal>`) — **use `Modal` for any new
  dialog** rather than hand-rolling a fourth scrim/panel. Pass `onClose` to
  enable backdrop-click and Escape-to-close (both wired automatically); omit
  it for a dialog that must force an explicit choice, like `Navbar`'s
  post-Google role picker.
* **Viewport height:** always `min-h-[100svh]` for full-height page wrappers.
  Never `h-screen` (breaks on mobile Safari's address bar).

---

## 4. Component Patterns

Copy these class strings verbatim when building the same kind of element —
they're the actual patterns already shipped, not a paraphrase.

**Card shell** — the ONE card style in the app. No plain-border cards, no
`shadow-lg` cards:
```
<div className="mx-auto w-full max-w-[440px] rounded-[20px] bg-gradient-to-br from-[#FFE9A6] via-white to-[#FFE9A6] p-px shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_40px_-24px_rgba(20,27,46,0.2)]">
  <div className="rounded-[19px] bg-white p-[22px] text-left">
    ...
  </div>
</div>
```

**Primary button — Employer/shared:**
```
className="flex h-[38px] items-center justify-center rounded-full bg-brand-teal-dark text-[14px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
```

**Primary button — Jobseeker:** same shape, but pale gold fill + dark ink text
(**not** `bg-brand-gold-dark` with white text — that combination fails contrast
and isn't used anywhere in the app):
```
className="flex h-[38px] items-center justify-center rounded-full bg-[#FFE9A6] text-[14px] font-medium text-[#141B2E] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
```

**Secondary / outline button:**
```
className="flex h-[38px] items-center rounded-full border border-black/[0.1] px-[18px] text-[13.5px] font-medium text-[#141B2E] hover:bg-black/[0.03]"
```

**Text input — Employer/shared:**
```
className="h-[38px] rounded-[12px] border border-black/[0.1] px-[14px] text-[14px] text-[#141B2E] outline-none placeholder:text-[#9AA3B2] focus:border-brand-teal-dark"
```
**Text input — Jobseeker:** identical, swap `focus:border-brand-teal-dark` for
`focus:border-brand-gold-dark`.

Both variants (plus the matching textarea and the gradient-frame/flat-mockup
card classes below) are available as shared helpers in
`src/components/formStyles.ts` — `inputClass("teal" | "gold")`,
`textareaClass("teal" | "gold", { autoResize?: boolean })`,
`GRADIENT_FRAME_CLASS`, `MOCKUP_CARD_CLASS`. **Import from here instead of
redeclaring a local `inputClass`/`textareaClass`/`cardClass` constant** — this
replaced what used to be independently duplicated (and quietly
out-of-sync) copies in `OnboardingForm.tsx`/`EmployerOnboardingForm.tsx`/
`AiFillMockup.tsx`/`JobPostMockup.tsx`.

**OTP digit input** (`AuthModal.tsx`) — a fourth, deliberately distinct input
archetype: `h-[52px] w-[44px]`, centered text, no horizontal padding (the
digit itself is centered rather than left-aligned like a normal text input).
One box per digit, auto-advance focus, paste support across all boxes. Don't
reuse the standard `h-[38px]` text-input recipe for a digit-entry field —
this taller/narrower shape is the established pattern for it.

**Labels are always on top of the field, never placeholder-only.** Every form
field (`AuthModal`, `OnboardingForm`, `EmployerOnboardingForm`) uses the shared
`Field` component (`src/components/Field.tsx`):
```tsx
<Field label="Full name" htmlFor="fullName">
  <input id="fullName" ... />
</Field>
```
`Field` renders `<label htmlFor={htmlFor}>` at `text-[12.5px] font-medium
text-[#4B5468]` with `gap-[6px]` above the field. Works for text inputs,
`Dropdown` (pass the same `id` through to it), and pill-toggle radiogroups
(put the `id` on the track `<div>`). Placeholders are examples ("e.g. Ahmad
Zaki"), not a restatement of the label.

**Pill toggle / segmented control** — used for the Employer/Jobseeker toggle,
account-type picker, and company size. Always `role="radiogroup"` on the track
and `role="radio"` + `aria-checked` on each option, never a native `<select>`.
**Only use this for 2-3 short-label options that fit on one row.**

Two variants exist:
* **Brand variant** — the landing page's Employer/Jobseeker toggle (`Hero.tsx`)
  and the auth modal's account-type picker (`AuthModal.tsx`): gold track
  (`bg-[#FFE9A6]`), selected state `bg-brand-teal-dark` + `text-white`.
  ```
  <div role="radiogroup" aria-label="..." className="grid grid-cols-N gap-[4px] rounded-full bg-[#FFE9A6] p-[4px]">
    <button type="button" role="radio" aria-checked={...}
      className="h-[38px] rounded-full text-[...] font-medium text-[#4B5468] transition-colors aria-checked:bg-brand-teal-dark aria-checked:text-white aria-checked:shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
      Label
    </button>
  </div>
  ```
* **Neutral variant** — `EmployerOnboardingForm`'s company-size picker: gray
  track (`bg-[#F1F4F8]`), selected state `bg-white` + `text-[#141B2E]`. Not yet
  unified to the brand variant above — left as-is.

  Note: the brand variant's gold track + teal-dark selected state predates the
  Jobseeker gold accent and is intentionally left as-is — `Hero.tsx`'s toggle
  and `AuthModal`'s account-type picker are role-agnostic components shown
  *before* a role is chosen, not Jobseeker-scoped screens, so they don't take
  the `accent` prop described under Custom dropdown below.

**Custom dropdown** (`src/components/Dropdown.tsx`) — for 4+ options or longer
labels that would wrap a pill row (e.g. employment type). Still never a native
`<select>` (Section 10): a button trigger styled like the standard text input
(`h-[38px] rounded-[12px] border border-black/[0.1] focus:border-brand-teal-dark`)
with a `ChevronDownIcon`, opening an absolutely-positioned `role="listbox"` with
`role="option"` items, closing on outside click. Reuse this component — don't
hand-roll a second dropdown implementation.

`Dropdown`, `DatePicker`, `MonthYearPicker`, and `AssistantCard` — the
components genuinely shared between Employer and Jobseeker — take an
`accent?: "teal" | "gold"` prop (default `"teal"`) that switches their focus
border/fill between the two role colors. Pass `accent="gold"` when rendering
one inside a Jobseeker-only screen (see `OnboardingForm.tsx` for every call
site). Components exclusive to one role (`EmployerOnboardingForm.tsx`,
`OnboardingForm.tsx`, `ResumeUpload.tsx`) just hardcode their role's color
directly — no prop needed. **Use this same `accent` prop pattern for any new
shared component** rather than forking it per role.

**Removable chip/tag** (skills input in `OnboardingForm`):
```
className="flex items-center gap-[6px] rounded-full bg-[#F1F4F8] py-[6px] pl-[12px] pr-[8px] text-[12.5px] font-medium text-[#141B2E]"
```
with an inline `<XIcon>` button to remove.

**File dropzone** — first built in `ResumeUpload.tsx`, reused as-is for the
resume-autofill upload in `OnboardingForm.tsx`: a hidden `<input type="file">`
triggered by a dashed-border button (`onDragOver`/`onDragLeave`/`onDrop` for
drag-and-drop, `border-brand-gold-dark bg-[#FFF3D6]` while dragging — both
resume dropzones are Jobseeker-exclusive, so they hardcode gold rather than
teal), which swaps to a selected-file row (`FileIcon` + filename + size +
`XIcon` remove button in a `bg-[#F8FAFB]` pill) once a file is picked. Reuse
this exact pattern for any new upload control — don't build a second one.

**Error text:** `text-[11px] text-red-500`, rendered directly above the submit
button, never a toast for form validation.

---

## 5. Icons — hand-rolled only, no library

`src/components/icons.tsx` is explicitly commented `"Original SVG icons — no
vendor assets."` Every icon is a small function component returning a raw
`<svg viewBox="..." aria-hidden>` sized entirely by the `className` prop passed
in (e.g. `h-[18px] w-[18px]`).

**Do not install an icon library** (no `lucide-react`, no `@phosphor-icons/react`,
no Heroicons). If a new icon is needed, hand-roll it the same way, matching the
stroke/fill weight of the existing set (`MicIcon`, `ArrowUp`, `UploadIcon`,
`FileIcon`, `TrendUpIcon`, `XIcon`).

---

## 6. Motion — plain CSS keyframes only, no animation library

There is no `motion`/`framer-motion` and no `gsap` in `package.json`, and none
should be added without discussion. Every animation in the app is a hand-written
`@keyframes` block in `globals.css` (`siri-orb-blob-a/b/c`, `voice-wave`,
`float-bob`, `gold-sweep`), applied via a plain class name — no JS-driven motion,
no scroll listeners.

**Every existing animation has a matching reduced-motion override** — this is
already followed consistently and must stay that way for anything new:
```css
@media (prefers-reduced-motion: reduce) {
  .your-new-animation-class {
    animation: none;
  }
}
```
New motion follows this exact recipe: `@keyframes` + a class + the
`prefers-reduced-motion` override. Don't reach for a JS animation dependency for
something CSS already handles here.

---

## 7. Copy Voice (as actually written — do not "correct" this)

* Sentence case, not Title Case.
* **Em dashes are part of the established voice** — e.g. "Talk through the role
  once — AI screens and shortlists your applicants automatically." (`HiringStats`),
  the page `<title>` ("JobGiga — Hiring in Malaysia, without the forms"), the
  footer tagline. Keep using them for the same connective/parenthetical feel.
  This is a deliberate departure from generic "never use em dashes" style guides
  — don't strip them out of existing or new copy.
* No filler startup buzzwords ("revolutionize", "seamless", "unlock"). Copy is
  direct and concrete: "Talk through the role once", "Upload your resume, we'll
  build your profile".
* Buttons are 1–3 words. **One label per intent** — e.g. "Get on this list" is
  the one CTA phrase for the pitch card; don't introduce a second differently-worded
  CTA for the same action elsewhere on the same page.

---

## 8. Architecture Conventions (Next.js App Router)

* **Server Components by default.** Only leaf components that need
  interactivity/state get `"use client"` (`AuthModal`, `Navbar`,
  `OnboardingForm`, `EmployerOnboardingForm`, `FloatingDemoWidget`,
  `SignOutButton`). Pages that need session/DB reads stay server components and
  `redirect()` server-side rather than client-checking auth.
* **Auth/session/onboarding gating** lives in `src/lib/session.ts`
  (`getSession`/`createSession`/`clearSession`) and `src/lib/onboarding.ts`
  (`getOnboardingRedirect`). Reuse these — don't re-derive role/profile checks
  inline in a new page or route.
* **DB access** goes through `src/lib/db` (Drizzle) and
  `src/lib/db/schema.ts` — one table per entity, `userId` unique FK for
  per-role profile tables (`jobseekerProfiles`, `employerProfiles`). Follow this
  shape for any new profile-like table.
* **API routes validate manually** — no `zod`/`yup` dependency. Plain
  `typeof`/enum checks, returning `NextResponse.json({ error }, { status: 400 })`
  on failure, matching every existing route under `src/app/api/`.
* **External AI calls use plain `fetch`, no SDK.** `MIMO_API_KEY` powers
  `/api/transcribe` (voice), `DEEPSEEK_API_KEY` powers
  `/api/jobseeker/parse-resume` (resume-to-profile autofill, model
  `deepseek-chat` — not `deepseek-reasoner`, no reasoning step needed for
  structured extraction) — both call their provider's OpenAI-compatible
  chat-completions endpoint directly with `fetch`, check the key with
  `if (!apiKey) return 500 "... not configured."` before doing any work, and
  define their own minimal response types inline rather than installing an
  `openai`/provider SDK. Follow this same shape for any future AI-backed
  route.
* **Retry AI provider calls 2-3× before failing.** The connection to
  `api.deepseek.com` is intermittently flaky from this network — sometimes
  connects instantly, sometimes hangs for the full timeout — independent of
  the request itself. `parse-resume/route.ts`'s `callDeepSeek()` retries up
  to `RETRY_ATTEMPTS` (3) times, logging each failed attempt via
  `console.error`, before returning the 502 "couldn't reach the service"
  error. Apply the same retry wrapper to any new provider call rather than
  failing on the first flaky connection.
* **File uploads read via `request.formData()`**, never a body-parsing
  middleware — see `parse-resume/route.ts`. Text extraction from uploaded
  documents uses `unpdf` (`extractText(new Uint8Array(buffer), { mergePages: true })`)
  for PDF and `mammoth` (`extractRawText({ buffer })`) for DOCX — legacy `.doc`
  isn't supported (no practical pure-JS parser for it). **Not `pdf-parse`
  v2** — its pdfjs-based worker setup breaks under Turbopack in a route
  handler (`Setting up fake worker failed`); `unpdf` is built worker-free for
  exactly this serverless/edge use case.

---

## 9. Accessibility Baseline

Already followed consistently — keep it that way for anything new:

* WCAG AA contrast on every button/input; spot-check before shipping. Both
  accent colors' text/icon uses (`brand-teal-dark` ~4.2:1, `brand-gold-dark`
  ~3.8:1 against white) sit close to but slightly under the strict 4.5:1 text
  threshold — an established, accepted trade-off in this codebase for small
  accent text/icons, not something to "fix" by darkening the brand color
  further. Button *fills* always pair with sufficiently-contrasting text
  (white on teal-dark, ink on pale gold) and meet AA cleanly.
* `role="radiogroup"` + `role="radio"` + `aria-checked` on every custom toggle
  (never a native `<select>` — none exist in this codebase).
* `aria-label` on icon-only buttons (modal close, remove-chip).
* `prefers-reduced-motion` override for any new CSS animation (Section 6).

---

## 10. What NOT to Introduce

* A third accent color, or a different palette family, beyond the Employer
  (teal) / Jobseeker (gold) pair.
* An icon or animation library (Sections 5, 6).
* A new card style outside the gradient-border pattern (Section 4).
* A native `<select>` — build a custom pill/listbox matching the existing token
  set instead.
* Em-dash stripping in copy edits — that's a generic house style, not this
  project's (Section 7).

---

## 11. Known Gaps (documented, not silently "fixed")

* **Control height** has a spread (`16–38px`) rather than a strict 2-value
  scale — Section 3 documents the full set of bands in use, by purpose
  (primary controls, secondary buttons, embedded CTAs, icon buttons split by
  role), so new components land on an existing value rather than inventing a
  new one. This is a deliberate purpose-driven scale, not an inconsistency —
  as of this audit, every control performing the same role now shares the
  same exact height (previously, icon/remove buttons of the same role drifted
  between 24px and 26px; this has been standardized).
* **`CompanyHighlights.tsx`'s per-tile padding** (`16–26px`) scales with each
  tile's logo size to keep visual balance across size variants, and
  intentionally exceeds the `14–22px` card-padding range used elsewhere — a
  named exception, not drift to fix.
* **Typography audit (resolved):** a follow-up audit found font sizes,
  weights, and line-heights already matched the documented scale almost
  everywhere. Three genuine drifts were found and fixed: the eyebrow-tracking
  split (`Footer` now matches `OnboardingForm`'s `tracking-[0.04em]`), an
  undocumented `16px` card heading (`OnboardingForm`'s "Upload your resume"
  reconciled to the standard `15.5px` pitch-card-heading tier), and three
  overlapping mockup micro-text sizes (`8.5px`/`9.5px`/`10.5px` consolidated
  into the existing `10px` tier). See Section 2 for the corrected values.
