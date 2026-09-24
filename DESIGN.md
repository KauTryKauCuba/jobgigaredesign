# JobGiga Design Language

## Overview

JobGiga is an AI-assistant-led hiring product — the design language reads as **calm, mint-and-teal-and-gold, conversational**, built around one recurring idea: a chat/voice assistant that fills forms for you. The homepage opens with a full-bleed teal/gold `AnimatedRibbon` behind the hero, floating photo/job badges drifting around the copy, and a bottom-fixed `FloatingDemoWidget` chat pill that's present on every page. There is no dark mode (`color-scheme: light` is hardcoded). Employer and Jobseeker share one layout, card system, typography, and button family throughout — but **interactive elements now carry a deliberate per-role accent color**: Employer stays teal, Jobseeker is gold (see §Employer vs. Jobseeker below).

The color system centers on **Brand Teal-Dark** (`#008990`), used for solid button fills (with white text), active states, and focus borders on the Employer side (and on all shared/role-agnostic chrome — auth modal, navbar, footer). The Jobseeker side does **not** mirror this with a dark-fill/white-text button — true gold hues can't get dark enough for white-text contrast without turning brown. Instead Jobseeker buttons/fills use **pale Gold** (`#FFE9A6`, the same value as the toggle and the gradient-frame card) paired with **dark ink text**, and a separate, more saturated **Brand Gold-Dark** (`#A67C00`) covers borders, icons, focus rings, and small text/accents where white-fill contrast isn't the constraint. **Brand Ink** (`#141B2E`) is the body/heading text color everywhere — never pure black. The brighter **Brand Teal** (`#07BCCA`) is reserved for decorative/illustrative surfaces (the ribbon, the `SiriOrb`) and never appears on interactive UI.

Typography runs on **Inter** (`next/font/google`) at weight 400/600 only — no light weight (unlike a "thin headline" style; headlines here are `font-semibold`, not `font-light`). Headings and interactive text is comfortably substantial-looking, not editorial-thin.

**Key Characteristics:**
- **`AnimatedRibbon`/`RibbonLayer`**: a full-width SVG silk-ribbon of 15 overlapping radial-gradient "light pools," each independently animated via SVG `animateTransform` plus mouse-parallax, masked by one morphing path — reads as a twisting, glowing teal/gold ribbon, not a static gradient bar. Used behind the hero and inside both dashboards.
- **`SiriOrb`**: a small circular icon — three independently-drifting blurred radial-gradient blobs (teal/cyan/gold), hard-clipped so nothing glows past the circle edge. An `active` variant speeds the blobs up and adds a breathing pulse, used to show the assistant "listening/typing."
- **Floating badges** (`FloatingBadges`/`EmployerFloatingBadges`/`JobPostingBadges`): small white pill badges scattered around the hero, each bobbing (`float-bob`) on its own staggered timing, and converging/"stacking" toward a point on scroll.
- **`FloatingDemoWidget`**: a bottom-fixed chat-input pill wrapped in a rotating conic-gradient "gold hairline" sweep, expanding into a message thread when opened; has a working mic-to-transcription call but only canned demo AI replies.
- **Gradient-frame card**: the app's one signature "elevated" card — a 1px gold-to-white-to-gold gradient border wrapping a white `rounded-[19px]` interior — used for highlight/stat/summary surfaces (`HiringStats`, `ResumeUpload`, `CompanyHighlights`, both onboarding forms).
- **AI-fill mockups** (`AiFillMockup`/`JobPostMockup`): static, pure-CSS recreations of the onboarding/job-post forms with a pulsing "Looking up…"/"Writing…" pill and shimmering skeleton bars, standing in for the AI populating fields — not real screenshots.
- **No dark mode; one shared layout system, but a real per-role accent color.** Both roles render through the same components with the same copy structure — the one deliberate visual difference is interactive-element color (teal for Employer, gold for Jobseeker), threaded through an `accent` prop on shared components (`Dropdown`, `DatePicker`, `MonthYearPicker`, `AssistantCard`).

## Colors

> **Source:** `src/app/globals.css`, `src/app/layout.tsx`, and Tailwind arbitrary values across `src/components/*.tsx`.

### Brand & Accent
- **Brand Teal-Dark** (`brand-teal-dark` / `#008990`): The Employer-side interactive color, and the default for all role-agnostic shared chrome (auth modal, navbar, footer, marketing hero/homepage) — solid button fill (white text), input focus border, active tab/pill, icon tint.
- **Gold** (`#FFE9A6`): Used two ways, both shared across roles at the token level but role-specific in application: (1) role-agnostic decorative — gradient-frame card border stops, benefit chips, `gold-sweep` border animation, `SiriOrb`'s third blob, the Hero toggle's jobseeker-active fill; (2) as of the Jobseeker theme, this exact value is also the **Jobseeker button/fill color** — solid button fill, selected date-picker day, assistant-card CTA — always paired with `#141B2E` ink text, never white (mirrors the Hero toggle's own text treatment).
- **Brand Gold-Dark** (`brand-gold-dark` / `#A67C00`): The Jobseeker-side equivalent of `brand-teal-dark` for everything that ISN'T a filled button — input focus border, dropzone active border, icon tint, checkbox accent, small accent text (tag-pill text, "today" indicator). Deliberately not used for button fills/white-text contexts — see Gold above for those.
- **Brand Teal** (`brand-teal` / `#07BCCA`): Decorative/illustrative only — `RibbonLayer` gradient stops, `SiriOrb`'s brightest blob. Never used on buttons or text. Role-agnostic (appears on both sides via shared decorative components).
- **Pale Teal** (`#E6F9FA`): Chip/pill backgrounds, drag-active dropzone fill, small "add entry" button fill on the **Employer** side (paired with teal-dark text) and on shared/role-agnostic surfaces.
- **Pale Gold** (`#FFF3D6`): The **Jobseeker**-side equivalent of Pale Teal — skill-tag chip fill, drag-active resume-dropzone fill (paired with `brand-gold-dark` text/icons). Lighter than the `#FFE9A6` button fill so chips/dropzones read as a tinted surface, not a button. Not yet a `@theme` token, following the same arbitrary-hex convention as `#E6F9FA`.
- **Cyan-mint base** (`#CFF4F6`): `SiriOrb` base gradient stop; hover state for pale-teal chips (Employer/shared side).

### Surface
- **Page background** (`#F2FAF5`): Mint-tinted white — set on `<body>` in `layout.tsx` and restated per-page in globals.css.
- **Card white** (`#FFFFFF`): Default card/input/modal background.
- **Light well** (`#F8FAFB`): Nested/repeatable "well" cards (form entry rows).
- **Neutral chip bg** (`#F1F4F8`): Eyebrow badges, avatar-fallback background, dropdown selected-row highlight.
- **Well border** (`#EAEDF2`): Border on the flat "well" card pattern and floating-badge borders.
- **Input border (idle)** (`#D7DCE4`): Dropzone/idle input borders — most other inputs instead use `border-black/[0.1]`.

### Text
- **Ink** (`#141B2E`): Default body/heading text — same value as the `brand-ink` theme token, though most components hardcode the literal hex rather than the token (see Inconsistencies).
- **Ink Secondary** (`#4B5468`): Field labels, secondary/muted body copy, subheadings.
- **Ink Tertiary** (`#9AA3B2`): Placeholder text, tertiary/disabled tint. The one canonical muted-grey value — two near-duplicate greys (`#8A93A6` in `JobPostingBadges`, `#6B7280` in `FloatingDemoWidget`) previously drifted from it and have been unified to `#9AA3B2`.
- **On Primary** (`#FFFFFF`): Text on solid teal-dark buttons and the Footer's solid-teal band.

### Semantic
- **Error** (Tailwind `red-500`): Field-level error captions and the one destructive/active state (mic-recording "listening" button). This is the only semantic color, and it's borrowed straight from Tailwind's default scale rather than a custom token — there is no success/warning/info palette.

## Typography

### Font Family

**Inter**, loaded via `next/font/google` in `layout.tsx` as `--font-inter`, mapped to Tailwind's `font-sans` in `globals.css`. Only two weights are fetched — **400 (regular)** and **600 (semibold)** — and only those two appear anywhere in the app; `font-medium` (500) and `font-bold` (700) were swept out project-wide in favor of `font-semibold`. No other font, no manual `font-feature-settings`.

### Hierarchy (mapped onto the fixed 5-size scale below)

| Role | Utility | Weight | Tracking | Example |
|---|---|---|---|---|
| Marketing hero/section headline | fluid `clamp()`, not a fixed token — see below | 600 (font-semibold) | -0.02em | `Hero.tsx`, `AssistantCard.tsx`, `CompanyHighlights.tsx`, `JobPostingHighlights.tsx` H1/H2s — exempt from the fixed scale, see "Marketing pages are exempt" below |
| Page heading | `text-xl` (21px) | 600 | -0.02em | Dashboard shell `<h1>` (`EmployerDashboardShell`, `JobseekerDashboardShell`, `SuperadminDashboardShell`) |
| Card/section sub-heading | `text-lg` (18px) | 600 | 0 | Card and modal titles that need to stand above body text but below a page heading |
| Body, buttons, labels, most UI text | `text-sm` (14px) | 400 body / 600 labels & buttons | 0 | The default size for nearly everything — inputs, buttons, card copy, form labels |
| Micro text | `text-xs` (12px) | 400 (600 for status badges) | 0 | Timestamps, helper copy, badges, table meta, skeleton captions |
| Uppercase eyebrow | `text-xs`, uppercase | 600 | 0.04em | `OnboardingForm`'s `CategoryHeading` and `Footer`'s link-group titles |

### Principles
- **Weight 600 for anything read as a headline, section title, or card title.** Body copy sits at 400, labels/buttons also at 600 — there is no 500 or 300/light style anywhere in this codebase.
- **Negative tracking (`-0.02em`) is reserved for headline/section-heading scale only**; body, label, and button text carry 0 tracking.
- **Uppercase eyebrow tracking is now consistent** — both instances in the app use `tracking-[0.04em]` (previously `Footer` used Tailwind's `tracking-wide` instead; unified).

### Font Size Scale (fixed, tokenized)

As of 2026-09-17 the app's UI text (dashboards, forms, cards, modals — everything under `src/app/employer`, `src/app/jobseeker`, `src/app/superadmin`, and their shared components) has a hard 5-size type scale, defined once in `globals.css`'s `@theme inline` block and consumed via Tailwind's standard `text-*` utilities — no arbitrary `text-[Npx]` values remain in that surface. Font-size only — no companion line-height token — so these utilities never fight the explicit `leading-[Npx]` classes components already set.

| Utility | Size | Role |
|---|---|---|
| `text-xs` | 12px | Micro text — badges, timestamps, helper copy, table meta |
| `text-sm` | 14px | Body copy, buttons, most UI text |
| `text-lg` | 18px | Card/section sub-headings |
| `text-xl` | 21px | Page headings (dashboard shells) |
| `text-2xl` | 24px | Largest fixed heading size in this scale |

**Marketing pages are exempt.** `Hero.tsx`, `AssistantCard.tsx`, `CompanyHighlights.tsx`, and `JobPostingHighlights.tsx` (the pre-login `/employer` and `/jobseeker` landing pages) keep their original fluid `clamp()` headlines — `clamp(34px, 4vw, 56px)`, `clamp(28px,3.4vw,40px)`, and `clamp(24px,2.6vw,32px)` respectively — deliberately larger and viewport-responsive, unlike the fixed dashboard scale. A brief 2026-09-17 pass had collapsed these onto the fixed scale too; that was reverted the same day since it made the marketing headlines read too small. `RichTextEditor.tsx`'s inline line-number glyphs (SVG `fontSize` attributes on decorative icon marks, not real text) are also outside this scale.

**Going forward:** any new dashboard/app UI text must use one of the five `text-xs/sm/lg/xl/2xl` utilities above — never a new arbitrary `text-[Npx]` value or inline `fontSize`. If none of the five fits, add a new named token to the `@theme inline` block in `globals.css` rather than reaching for an arbitrary value inline. Marketing-page headlines (the four components listed above) are the only sanctioned exception, and should stay on fluid `clamp()` rather than adopting a sixth fixed size.

## Layout

### Spacing System
Arbitrary pixel values tuned by eye, not a strict 4/8px Tailwind scale — a rough ladder of `6 / 8 / 10 / 12 / 14 / 16 / 18 / 20 / 22 / 24 / 28 / 32 / 40 / 48 / 56 / 64 / 80 / 92 / 128px` recurs across gaps and padding. Treat this as the working scale.

- **Card padding**: `14–22px` depending on card type (gradient-frame cards run `22px`; flat mockup/well cards run `14px`). One named exception: `CompanyHighlights`'s logo tiles scale their padding with each tile's size variant (`16/18/22/24/26px`), intentionally exceeding 22px for the larger variants to keep visual balance — not drift.
- **Button padding**: horizontal `14–22px`; height is `38px`, the tallest control in the system — see Buttons below for the full purpose-driven height scale (icon/close buttons included).
- **Section gaps**: `48px` stepping to `64px` at `lg` (`AssistantCard`'s two-column layout).

### Grid & Container
- **`.shell`** (`globals.css`): the site's one container class — `padding-inline: 13.28%` at desktop, stepping to `9%` (≤1440px), `5%` (≤1024px), `20px` (≤640px). This is a bespoke, hand-tuned percentage, not a Tailwind `max-w-*` container.
- **Card grids**: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-6` (`CompanyHighlights`); `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` (onboarding detail grids).
- **Two-column layouts**: `lg:grid-cols-[1fr_3fr]` / mirrored `[3fr_1fr]` (`AssistantCard`), `flex-col lg:flex-row` (profile/onboarding sidebar layouts) — all collapse to a single column below `lg` (1024px).

### Whitespace Philosophy
The page background is a consistent mint-white (`#F2FAF5`) throughout — unlike a hero-only treatment, JobGiga doesn't drop to a different "content" background after the hero. Decorative elements (ribbon, floating badges) are confined to the hero and dashboard bands; the rest of the page is plain cards on the mint background.

## Elevation & Depth

| Level | Treatment | Use |
|---|---|---|
| 0 | Flat, border only | Well/entry cards (`border-[#EAEDF2] bg-[#F8FAFB]`), buttons, footer band |
| 1 | `shadow-[0_1px_2px_rgba(0,0,0,0.06)]` | Small chat bubbles, dropdown menu items, active-tab pills |
| 2 | `shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_40px_-24px_rgba(20,27,46,0.2)]` | Gradient-frame cards (`HiringStats`, `ResumeUpload`, `CompanyHighlights`, onboarding forms) and flat mockup cards (same shadow value, different border/radius) |
| 3 | `shadow-[0_8px_20px_rgba(20,27,46,0.1)]` | Floating badges |
| 3 | `shadow-[0_8px_24px_-8px_rgba(20,27,46,0.2)]` | Open dropdown/date-picker panels |
| 4 | `shadow-[0_1px_2px_rgba(0,0,0,0.04),0_24px_48px_-16px_rgba(0,0,0,0.24)]` | Modals/dialogs (`AuthModal`, Navbar confirm dialogs) |

Unlike a fully flat/borderless system, JobGiga uses a **hybrid model**: borders for static/embedded content, layered soft shadows for anything that visually floats over the page (popovers, modals, gradient-frame cards, floating badges). Two near-identical shadow recipes exist for gradient-frame vs. flat mockup cards — same values, worth consolidating into one shared token if a component library gets extracted.

### Decorative Depth
`RibbonLayer`/`AnimatedRibbon` — 15 overlapping radial-gradient "light pools" behind a single morphing SVG mask, each animated independently via `animateTransform` plus mouse-parallax. `SiriOrb` — three blurred radial-gradient blobs drifting inside a hard-clipped circle (`overflow-hidden`, full radius, no glow bleed). Both respect `prefers-reduced-motion`.

## Shapes

### Border Radius Scale

| Token | Value | Use |
|---|---|---|
| `rounded-[8px]` | 8px | Small skeleton bars, mockup field-bars |
| `rounded-[12px]` | 12px | Text inputs, dropdowns, date fields; also the Google sign-in button (a one-off break from the pill-button family — see Inconsistencies) |
| `rounded-[14px]` | 14px | Flat "well" entry cards; flat mockup cards; `DatePicker` popover |
| `rounded-[19px]` | 19px | Inner white card inside a gradient-frame wrapper (paired 1:1 with the 20px outer radius, since `20 − 1px border = 19`) |
| `rounded-[20px]` | 20px | Gradient-frame card outer wrapper |
| `rounded-[24px]` | 24px | Modals/dialogs |
| `rounded-full` | 9999px | Every button, toggle/tab track, chip/badge, avatar circle — by far the most common radius (86+ occurrences) |

Card radius is **bimodal** (19/20px gradient-frame vs. 14px flat well-card) with the split determined ad hoc per component rather than a documented rule — currently: gradient-bordered → 19/20px, plain-bordered → 14px. The `Dropdown` popover and `DatePicker` popover both use `rounded-[12px]` for the same "floating menu panel" role (previously disagreed — `DatePicker` ran `14px` — resolved).

### Photography Geometry
No photographic hero imagery — `TrustedByStrip` shows real partner logos plus two custom-SVG placeholder glyphs for uncooperative domains; floating badges use small photo thumbnails inside pill chrome. Avatars are circular, `object-cover`.

## Components

### Buttons

**Primary (solid pill)** — the dominant pattern, reused near-verbatim across ~15 files. Employer/shared variant (white text on teal-dark):
```
flex h-[38px] items-center justify-center rounded-full bg-brand-teal-dark
text-[14px] font-semibold text-white transition-opacity hover:opacity-90
disabled:cursor-not-allowed disabled:opacity-40
```
Jobseeker variant swaps the fill/text pair — pale gold (`#FFE9A6`) with ink (`#141B2E`) text, never white — since a gold hue dark enough for white-text contrast reads as brown (see Employer vs. Jobseeker below). Found in `AuthModal`, `Navbar`, `AssistantCard` (both role variants via its `accent` prop), `HiringStats`, `ResumeUpload` (gold), both onboarding forms (teal for Employer, gold for Jobseeker), `Hero`'s role toggle (teal only, role-agnostic), `JobPostMockup`, `DatePicker`'s selected-day pill (both role variants via `accent`).

**Outline pill** — `rounded-full border border-black/[0.1] text-[#141B2E] hover:bg-black/[0.03]` (Navbar "Dashboard"/"Sign out", AuthModal's secondary CTA, and now AuthModal's Google sign-in button too — it previously broke the pill family with `rounded-[12px]`, fixed to `rounded-full`).

**Ghost/text** — no background, `text-[#4B5468] hover:text-[#141B2E]` or `hover:bg-black/[0.03]` (Navbar "Sign in", `SignOutButton`, "Skip" links).

**Icon-only circular** — `flex items-center justify-center rounded-full` with a hover background tint, sized by role rather than one flat number: `16px` chip-inline remove (nested inside a tag/pill), `24px` standalone item remove/close next to a row or card (entry rows, attached-file rows, `FloatingDemoWidget` close — standardized to this single value; previously drifted between 24/26px for the same role), `26px` compact popover navigation (`DatePicker`'s month arrows) and the intentionally-miniature `JobPostMockup` button, `28px` modal/panel primary close, `30px` mic/send circular buttons. Same role → same value everywhere; don't introduce a nearby-but-different pixel value for an existing role.

**Small pill (tinted fill)** — `rounded-full` with a pale tint fill + matching dark accent text instead of a solid fill: `bg-[#E6F9FA] text-[#008990]` on Employer/shared surfaces, `bg-[#FFF3D6] text-brand-gold-dark` on Jobseeker surfaces (OnboardingForm's "add entry" button).

Button height is a **purpose-driven scale, capped at 38px** — `38px` is the maximum, used for primary CTAs/inputs and secondary/outline buttons and compact pill options alike (previously primary CTAs/inputs ran taller at `44px`; unified down to `38px` so no control on the site exceeds it), `34px` embedded CTAs inside a larger card (`AssistantCard`), plus the icon-button tiers above. Every control performing the same role uses the same height across the app — see SKILL.md §3 for the full inventory.

### Cards & Containers

Three distinct card patterns coexist, each serving a different role — there is no single unified card component:

**Gradient-frame card** (the closest thing to a "signature" elevated card): outer `rounded-[20px] bg-gradient-to-br from-[#FFE9A6] via-white to-[#FFE9A6] p-px` wrapping an inner `rounded-[19px] bg-white p-[22px]`, with the Level-2 shadow above. Used for `HiringStats`, `ResumeUpload`, `CompanyHighlights` tiles, `EmployerProfileSummary`, onboarding upload/skeleton panels. The outer wrapper class is now `GRADIENT_FRAME_CLASS`, exported from `src/components/formStyles.ts` — previously re-declared independently as a local `cardClass` constant (or repeated inline) in `EmployerOnboardingForm.tsx`, `OnboardingForm.tsx` (6 inline occurrences), now all import the shared constant instead.

**Flat mockup card**: `rounded-[14px] border border-black/[0.06] bg-white p-[14px]` with the same Level-2 shadow value but a flat white/bordered look instead of a gradient frame. Exported as `MOCKUP_CARD_CLASS` from `src/components/formStyles.ts`; imported by both `AiFillMockup.tsx` and `JobPostMockup.tsx` (previously two byte-identical local `cardClass` declarations, now one shared constant).

**Well/entry card**: `rounded-[14px] border border-[#EAEDF2] bg-[#F8FAFB] p-[10–14px]`, no shadow — the recessed, flat look for nested/repeatable list items (work-experience/education entries, resume-attached chip).

### Inputs & Forms

**`Field.tsx`** — the single label wrapper used everywhere: `flex flex-col gap-[6px]`, label at `text-[12.5px] font-semibold text-[#4B5468]`.

**Text input** — `h-[38px] w-full rounded-[12px] border border-black/[0.1] px-[14px] text-[14px] text-[#141B2E] outline-none placeholder:text-[#9AA3B2] focus:border-brand-teal-dark` (Employer/shared) or `focus:border-brand-gold-dark` (Jobseeker's `OnboardingForm`). Focus state is a border-color change only — no focus ring or shadow. Both variants are generated by `inputClass("teal" | "gold")` / `textareaClass("teal" | "gold", { autoResize? })` in `src/components/formStyles.ts` — previously independently duplicated as a local constant in both `OnboardingForm.tsx` and `EmployerOnboardingForm.tsx` (which had also silently drifted: only `EmployerOnboardingForm`'s textarea had `resize-none overflow-hidden` for its auto-grow behavior — now an explicit `autoResize` option instead of an undocumented difference).

**OTP digit input** (`AuthModal.tsx`) — a distinct fourth input shape, not the standard text-input recipe: `h-[52px] w-[44px]`, centered text, no horizontal padding. One box per digit, auto-advance focus, paste support.

**`Dropdown.tsx`** — custom (no native `<select>`); trigger matches the text-input style; popover is `rounded-[12px]` with `shadow-[0_8px_24px_-8px_rgba(20,27,46,0.2)]`, selected row highlighted `bg-[#F1F4F8]`. Takes an `accent?: "teal" | "gold"` prop (default `"teal"`) so `OnboardingForm.tsx` (Jobseeker) can switch its focus border to gold while `EmployerOnboardingForm.tsx` keeps teal — see Employer vs. Jobseeker below.

**`DatePicker.tsx`** — trigger matches the input style; calendar popover is `rounded-[12px]`, matching both `Dropdown`'s popover and its own trigger for the same "menu panel" role (previously `rounded-[14px]`, an outlier against its own trigger, not just `Dropdown`'s); selected day is a solid pill, teal-dark or pale-gold-with-ink-text depending on its `accent` prop.

**`MonthYearPicker.tsx`** — two `Dropdown` instances side by side; disabled state renders a flat `bg-black/[0.04]` box; also takes and forwards the `accent` prop.

**Error style** — plain `text-[11px] text-red-500` caption below the field; the input's own chrome never changes on error (no red border/background anywhere in the app).

**`ResumeUpload.tsx`** dropzone — `rounded-[14px] border border-dashed`, idle `border-[#D7DCE4]`, drag-active/hover `border-brand-gold-dark bg-[#FFF3D6]` (Jobseeker-exclusive, so hardcoded gold rather than teal).

### Navigation

**`Navbar.tsx`** — `h-[65px]`, scrolls with the page (not sticky/fixed), `relative z-20`. Left: `jg-logo.svg`. Signed-out: ghost "Sign in" + solid pill "Get started". Signed-in: circular avatar+name dropdown, outline "Dashboard" pill, outline "Sign out" pill. Two confirmation dialogs (role-switch, post-Google role choice) render the shared `Modal` component described below, same as `AuthModal`.

**`Footer.tsx`** — solid `bg-brand-teal-dark` full-bleed band (the app's only large solid-teal surface), white/white-opacity text at several opacity steps, uppercase link-group micro-labels, `border-t border-white/15` divider above the copyright line. Stacks `flex-col` → `sm:flex-row`.

### Pills, Tags, and Chips

Status/eyebrow pills use the neutral chip background (`#F1F4F8`) or pale-teal (`#E6F9FA`) depending on context; there is no single dedicated "tag" component — each surface (badges, chips, "Looking up…" pill) implements its own pill inline.

### Signature Components

**`AnimatedRibbon` / `RibbonLayer`** — see Overview/Decorative Depth.

**`SiriOrb`** — see Overview/Decorative Depth.

**`FloatingBadges` (+ `EmployerFloatingBadges`, `JobPostingBadges`)** — small white photo+label pills at absolute hero positions, each bobbing independently (`float-bob`) and converging/"stacking" on scroll (`useScrollStack`). `EmployerFloatingBadges` and `JobPostingBadges` are data-only wrappers around the same shared component (industry photos vs. fake job postings), not visually distinct components.

**`FloatingDemoWidget`** — bottom-fixed chat pill wrapped in a rotating conic-gradient border sweep (`gold-sweep`), expanding into a message thread when opened. Working mic-to-transcription call; only canned demo AI replies.

**`AiFillMockup` / `JobPostMockup`** — static, pure-CSS three-card recreations of the onboarding/job-post forms, with a pulsing "Looking up…"/"Writing…" pill (`ai-fill-pulse`) and shimmering skeleton bars (`ai-fill-shimmer`) simulating AI autofill.

**`HiringStats`** — a gradient-frame card with one static stat and a CTA that opens `AuthModal`.

**`CompanyHighlights`** — a responsive grid of gradient-frame tiles with fixed (not random) size/offset variants, animating into place on scroll (`useScrollReveal`).

**`TrustedByStrip`** — a flat row of partner logos plus two placeholder custom-SVG glyphs; no animation, no cards.

### Auth Pattern

**`AuthModal.tsx`** is a true modal, not a full page: `fixed inset-0 z-50` scrim (`bg-black/40`) with a centered `role="dialog"` panel (`max-w-[380px] rounded-[24px] bg-white p-[22px]`), closes on backdrop click or `Escape`. Two-step flow in the same modal: **email step** (optional Employer/Jobseeker toggle, "Continue with Google" outline button, divider, email field, solid submit button) → **OTP step** (6 separate digit boxes, auto-advance focus, paste support). A `roleChoicePending` sub-state handles one email owning both an employer and jobseeker account.

The same dialog chrome (`max-w-[380px]`, `rounded-[24px]`, `p-[22px]`, Level-4 shadow) is now shared via `src/components/Modal.tsx` — `Navbar.tsx`'s two confirmation dialogs and `OnboardingForm.tsx`'s resume-warning dialog all render `<Modal>` alongside `AuthModal.tsx`, instead of four independently hand-rolled scrim/panel divs. `Modal` takes an optional `onClose` that wires both backdrop-click and Escape-to-close; two dialogs (the role-switch confirm and the resume-warning dialog) gained Escape-to-close for free in the process, since only `AuthModal` had it before. `Navbar`'s post-Google role-choice dialog deliberately omits `onClose` — it still can't be dismissed except by picking a role, unchanged from before. Any new modal should render `<Modal>` rather than hand-rolling a fifth copy of this chrome.

### Icons

`src/components/icons.tsx` — fully custom, hand-drawn inline SVGs, no icon library (no lucide/phosphor/heroicons). Consistent conventions: 14×14 or 16×16 viewBox, `fill="none" stroke="currentColor"`, stroke width 1.3–1.6, rounded caps/joins, `aria-hidden focusable="false"`. A few one-off icons live outside this file where they need brand colors (multi-color `GoogleIcon` in `AuthModal.tsx`) or are single-use placeholders (`DotGridIcon`/`ChevronMarkIcon` in `TrustedByStrip.tsx`), following the same inline-SVG approach.

## Employer vs. Jobseeker

Employer and Jobseeker share one layout, card system, typography, and button family — but they now carry **one deliberate, systemic color distinction**: interactive elements are **teal on Employer, gold on Jobseeker**.

- **Employer interactive color**: `brand-teal-dark` (`#008990`) for everything — buttons keep white text on this dark fill, matches all shared/role-agnostic chrome.
- **Jobseeker interactive color is split in two**, because a true gold hue can't get dark enough for white-text contrast without turning brown (this is why the pale gold in the Hero toggle is always paired with dark text, never white):
  - **Fills** (buttons, selected date-picker day, assistant-card CTA): the same pale **Gold** `#FFE9A6` used decoratively elsewhere, paired with `#141B2E` ink text — visually identical to the Hero toggle's jobseeker-active state.
  - **Everything else** (focus borders, dropzone active border, icon tint, checkbox accent, small accent text): `brand-gold-dark` (`#A67C00`), plus the pale-gold (`#FFF3D6`) chip/dropzone tint that pairs with it.
- **Role-agnostic surfaces stay teal/neutral** regardless of which role is signed in: `AuthModal`, `Navbar`, `Footer`, and the marketing homepage (`Hero`, `AnimatedRibbon`, `TrustedByStrip`, `CompanyHighlights`) are not re-themed per role — only pages/components truly scoped to one role switch color.

**Mechanism — the `accent` prop.** Components genuinely shared between both roles (`Dropdown`, `DatePicker`, `MonthYearPicker`, `AssistantCard`) take an `accent?: "teal" | "gold"` prop, defaulting to `"teal"` so existing Employer call sites are unaffected. `JobseekerAssistantCard` passes `accent="gold"`; `OnboardingForm` (jobseeker onboarding) passes `accent="gold"` to every `Dropdown`/`DatePicker`/`MonthYearPicker` instance it renders. Components that are exclusively one role's (`OnboardingForm.tsx`, `ResumeUpload.tsx` for Jobseeker; `EmployerOnboardingForm.tsx`, `HiringStats.tsx`, `CompanyHighlights.tsx` for Employer) just hardcode their role's color directly — no prop needed.

**This is the sanctioned pattern for new dashboard work**: when a component needs to exist on both sides, thread an `accent` prop through it rather than forking the component or hardcoding one role's color into a shared file. Everything else — spacing, radii, shadows, typography, the gradient-frame/well/mockup card patterns — stays identical between roles; color is the one intentional per-role variable.

## Do's and Don'ts

### Do
- Use the solid teal-dark pill (`bg-brand-teal-dark`, `rounded-full`, `h-[38px]`, white text) as the default primary button on Employer/shared surfaces. On Jobseeker, use `bg-[#FFE9A6]` with `text-[#141B2E]` ink text instead — **not** `bg-brand-gold-dark` with white text; that combination doesn't have enough contrast and isn't used anywhere in the app. Don't invent a new fill color for "just one more CTA" on either side.
- Reserve the brighter `brand-teal` (`#07BCCA`) for decorative/illustrative surfaces (ribbon, orb) — never for buttons or body text.
- Thread an `accent="teal" | "gold"` prop through a component shared by both roles (following `Dropdown`/`DatePicker`/`MonthYearPicker`/`AssistantCard`) rather than forking it or hardcoding one role's color into a shared file.
- Render headline/section-heading text at `font-semibold`; keep body at 400, labels/buttons also at `font-semibold` — there is no 500 (`font-medium`) or "light" weight in this system.
- Respect `prefers-reduced-motion` on any new animated element — `AnimatedRibbon`, `SiriOrb`, `float-bob`, `gold-sweep`, and the AI-fill pulse/shimmer all already do this; match that pattern.
- Route new inputs/labels through `Field.tsx` rather than hand-styling a new label.
- Use `src/components/Modal.tsx` for any new modal dialog, and `inputClass`/`textareaClass`/`GRADIENT_FRAME_CLASS`/`MOCKUP_CARD_CLASS` from `src/components/formStyles.ts` for any new input/textarea/card — don't hand-roll the chrome or redeclare a local constant that already exists.

### Don't
- Don't hand-roll a new modal shell — `AuthModal`, Navbar's two dialogs, and the resume-warning dialog all now render the shared `Modal` component; use it instead of a fifth copy of the same scrim/panel chrome.
- Don't introduce a new muted-grey text color — `#9AA3B2` is the one canonical value used everywhere now.
- Don't hardcode `brand-teal-dark` into a genuinely shared component when building a jobseeker-facing feature (or vice versa) — use the `accent` prop pattern instead, so the component keeps working correctly for both roles.
- Don't re-theme role-agnostic shared chrome (`AuthModal`, `Navbar`, `Footer`, the marketing homepage) per role — those stay teal/neutral regardless of which role is signed in.
- Don't add a red border/background to invalid inputs — the established error pattern is a caption only, input chrome doesn't change.
- Don't pick a new card radius ad hoc — use 19/20px for a gradient-frame elevated card, 14px for a flat well/mockup card; if neither fits, that's a genuine new pattern worth naming here rather than a one-off value.

## Responsive Behavior

### Breakpoints (Tailwind defaults, plus a bespoke `.shell` container)
| Name | Width | Key Changes |
|---|---|---|
| Mobile | < 640px (`sm`) | `.shell` padding drops to 20px; floating badges hidden (`hidden md:block`); nav shows auth/menu essentials only |
| Tablet | 640–1023px (`md`–`lg`) | `.shell` padding 5–9%; mockup side-context cards appear (`md:flex`); company-highlight grid 3-col |
| Desktop | ≥ 1024px (`lg`) | Two-column layouts activate (`AssistantCard`, profile/onboarding sidebars); company-highlight grid 6-col; floating-badge text labels appear |

### Collapsing Strategy
- Hero headline and section headings scale continuously via `clamp()` rather than stepping at breakpoints.
- `AssistantCard`'s `[1fr_3fr]`/`[3fr_1fr]` two-column layout and sidebar+content layouts (`flex-col lg:flex-row`) collapse to a single column below `lg` (1024px).
- Floating badges are hidden entirely below `md` (768px); their text labels only appear at `lg` (1024px) — icon-only below that.
- Footer stacks `flex-col` → `sm:flex-row`.

## Iteration Guide

1. Focus on ONE component at a time and check `src/components/` for an existing pattern before inventing a new one — most needs are already covered by the solid-pill button, the gradient-frame card, the flat well-card, or `Field`/`Dropdown`/`DatePicker`.
2. Reuse the exact Tailwind arbitrary values already in use (`h-[38px]`, `rounded-[14px]`, `text-[#4B5468]`, etc.) rather than inventing new round numbers.
3. Import `inputClass`/`textareaClass`/`GRADIENT_FRAME_CLASS`/`MOCKUP_CARD_CLASS` from `src/components/formStyles.ts` rather than redeclaring a local copy — this was the single highest-value cleanup flagged in this document, now resolved.
4. Prefer the canonical hex (`#9AA3B2` for tertiary text, `#008990` via the `brand-teal-dark` token) over reintroducing a near-duplicate value.
5. If a component needs a new modal, use `src/components/Modal.tsx` rather than hand-rolling another copy of the dialog chrome.
6. Always test new interactive/animated components against `prefers-reduced-motion`, matching the ribbon/orb/badge precedent.
7. Keep Employer and Jobseeker components sharing the same layout/card/typography system — the one deliberate per-role difference is the interactive accent color (teal vs. `brand-gold-dark`), applied via the `accent` prop on shared components or hardcoded directly in role-exclusive ones. Don't invent new per-role differences beyond color without a specific reason.
</content>
