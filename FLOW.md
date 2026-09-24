# Job Platform — Employer & Jobseeker Flow (Draft v3)

Concept: an AI-native job platform for Malaysia. Instead of forms, employers and jobseekers talk (voice or text) to an AI assistant that structures data, drives the hiring pipeline, and keeps both sides live-synchronized.

Two personas: **Employer** and **Jobseeker**.

Design principle: **every state change is an event with a defined effect on _both_ sides.** Neither party should ever be left guessing what happened.

---

## ⚠️ Unresolved Strategic Decisions

These are not details — each one reshapes everything below. They should be settled before significant build work.

### A. The concept is currently "ATS + chatbot," not a new category
Strip the AI layer from this document and what remains is a conventional ATS (post → screen → shortlist → interview → hire). Conversational AI is an **interface** innovation, not a **concept** innovation — an incumbent like JobStreet could add a chatbot in a quarter and erase the difference.

The genuinely novel mechanics considered early on were dropped along the way:
- Proof-of-work profiles (verified track record replaces resume claims)
- Paid micro-trials replacing interviews (blind, skill-based)
- Bounty-first hiring (solve a real problem → fast-track offer)
- Anti-ghosting economics (employer deposit forfeited for non-response)
- Mutual-blind matching (identities revealed only on mutual interest)

**Decision needed:** is "talk instead of forms" the whole concept, or does one of these mechanics come back in as the actual differentiator? Everything downstream — data model, pricing, positioning — depends on the answer.

### B. Cold start is unaddressed
Day one has zero jobs and zero candidates. Nothing in this document explains why employer #1 posts into an empty platform, or why jobseeker #1 registers to browse three listings. This is the most common cause of death for job platforms.

Typical resolutions: solve one side first (manually seed postings), or narrow hard to a beachhead — one industry, one city — rather than launching at "Malaysia" scale.

**Decision needed:** which side gets solved first, and what's the beachhead?

### C. No monetization model
Not currently defined anywhere. This is structural, not just commercial — per-post fees, subscription, and success fees each imply different verification strictness, different data retention, and different incentives around anti-ghosting and hire confirmation.

**Decision needed:** who pays, for what, and at which stage?

### D. ATS or HRMS — which is the actual product?
The document treats HRMS as a "future phase," but that may be backwards. ATS functionality is commoditized and hard to charge for; HRMS is sticky — recurring revenue, high switching cost, and a genuine unmet need for Malaysian SMEs handling EPF/SOCSO/EIS and payroll.

"Free ATS that feeds a paid HRMS" is a stronger wedge than "another job board with AI." If that's the real strategy, the hiring pipeline is an acquisition channel and should be scoped accordingly.

**Decision needed:** is the ATS the product, or the on-ramp?

### E. AI value is asymmetric between personas
The employer chatbot answers questions the UI genuinely can't — aggregation across many applicants and postings ("how many shortlisted across all my roles?"). The jobseeker chatbot mostly answers questions a simple table answers better ("what did I apply to?"), since a jobseeker has 5–20 applications, not 500.

Real jobseeker AI value sits in **profile building** (talking instead of writing a resume) and **discovery** (natural-language search), not status queries. The flow below should not assume symmetric AI value on both sides.

---

## 0. Shared Foundations

### 0.1 Account Creation & Verification (before anything else)

| | Employer | Jobseeker |
|---|---|---|
| Sign-up | Email + phone (OTP) | Email + phone (OTP) |
| Verification | **SSM registration number** validated against company name | Phone verified; ID optional until hire stage |
| Why it matters | Blocks fake companies — the root cause of job scams in MY | Blocks spam/bot applications, protects employer inbox |
| Blocked until verified | Cannot publish a posting | Can browse; cannot apply |

Employer verification is the backbone of the jobseeker-side scam protection. Without it, the AI red-flag detection is guessing; with it, "verified SSM" becomes a trust badge on every posting.

### 0.2 Input Modes (both personas)
Every AI interaction accepts:
- **Typed chat** (default)
- **Voice** (transcribed via ASR, then treated identically)
- **File upload** — jobseeker resume PDF, employer existing JD document — parsed by AI as an alternative to talking

Nothing is voice-only or AI-only. Every AI-driven action must also be doable through normal UI, so the platform still works if the AI API is down, mis-hears, or the user simply prefers clicking.

**Voice value is not symmetric.** Employers post jobs at a desk with a keyboard — voice is a convenience at best. The people voice genuinely unlocks are mobile-first jobseekers, particularly in F&B, retail, and logistics, where typing out a full profile is the actual barrier to entry. If voice is built once, build it for the jobseeker profile flow first.

### 0.3 AI Safety Rules (both personas)
- **Confirm before mutating.** Any tool call that changes state irreversibly (reject, hire, close posting, send offer) must be echoed back for explicit confirmation before executing. Mis-hearing "reject Sarah" must never be destructive.
- **Read actions execute freely.** Counting, listing, summarizing — no confirmation needed.
- **AI assists, never auto-decides.** No auto-reject, no auto-hire. Ranking is a suggestion with visible reasoning.
- **Language:** must handle English, Bahasa Malaysia, and code-switched Manglish naturally, in both directions.
- **Screening bias guardrail:** the AI ranks on skills/experience/qualification only. Name, age, gender, race, photo, and school prestige are excluded from ranking inputs — otherwise AI screening quietly reintroduces the exact discrimination the posting filter strips out.
  - Excluding those fields is **necessary but not sufficient**. Bias leaks through proxies: postcode, school name, employment gaps, and fluency of phrasing all correlate with the protected attributes that were removed. A platform that cleans up the job *ad* while running a biased *screen* is worse than one that does neither, because it looks fair.
  - Mitigation is outcome auditing, not input filtering alone: periodically compare shortlist rates across demographic groups and investigate divergence. This requires retaining demographic data for auditing while keeping it out of ranking — a deliberate design decision with PDPA implications (see §6.1).
- **External data must be disclosed, never presented as verified.** Anywhere the AI pulls in data the user didn't type themselves — public web lookups, business-data APIs, government datasets — the source is visibly labelled (e.g. "Pulled from public sources — please review") and the field stays editable and unconfirmed until the user accepts it. This applies platform-wide, not just to one feature:
  - **Identity-sensitive lookups are gated on verification, not name-matching.** If the AI is filling in details *about* a specific real-world entity (a company, in the current design — see Stage 0), it must only surface once that identity is independently verified (SSM number, in the current design), otherwise it risks attaching a real entity's data — or logo — to the wrong account. Purely descriptive lookups (e.g. typical salary range for a role) carry no such risk and don't need this gate.
  - Public/external data is a convenience suggestion, never a substitute for the platform's own verification steps (SSM check §0.1, PDPA handling §6.1).

### 0.4 Occupation & Skills Taxonomy — MASCO + ESCO via ISCO-08

Matching only works if both sides speak the same vocabulary. An employer typing "Software Engineer" and a jobseeker typing "Programmer" must resolve to the same thing, or free-text matching degrades into keyword roulette.

Malaysia already has an official standard for this: **MASCO — Malaysia Standard Classification of Occupations**, maintained by the Ministry of Human Resources (current edition: MASCO 2020).

- **Structure:** 9 major occupational groups — Managers · Professionals · Technicians and Associate Professionals · Clerical Support Workers · Service and Sales Workers · Skilled Agricultural/Forestry/Fishery Workers · Craft and Related Trades Workers · Plant and Machine Operators and Assemblers · Elementary Occupations
- **Skill levels:** classifies occupations as skilled / semi-skilled / low-skilled, based on the nature of tasks performed rather than formal education — which is a better basis for matching than qualification tier alone
- **Definitions:** a *job* is the tasks performed by one person; an *occupation* is a set of jobs with similar main tasks — so people doing similar work classify together regardless of seniority or job title wording

**Why this matters for the build:**
1. AI normalizes messy employer input ("need someone to build our app") to a MASCO occupation code, and jobseeker profiles map to the same codes — matching then runs on codes, not strings
2. It's the government's own standard, so the platform stays interoperable with national labour data (ILMIA statistics, the Critical Occupations List) — useful later for salary benchmarking and demand signals (any such suggestion is external data and falls under the disclosure rule in §0.3)
3. It gives job titles a canonical form for search without forcing employers to pick from a dropdown

The AI should still display the employer's own title on the posting — MASCO runs underneath as the matching key, not as the user-facing label.

#### Skills: MASCO is not enough

MASCO classifies **occupations, not skills**. Since skills are the primary matching axis (§0.5), a separate skills vocabulary is required. Free text cannot serve: "Photoshop" / "Adobe Photoshop" / "PS" / "photoshop cc" are four strings and one skill.

**Decision: adopt ESCO for skills, bridged to MASCO through ISCO-08.**

| Layer | Standard | Role |
|---|---|---|
| Occupation (MY-official) | **MASCO 2020** | Legal/local legitimacy, government data interoperability |
| Bridge | **ISCO-08** | MASCO is built on ISCO-08; ESCO is aligned to ISCO-08 — the two connect through it |
| Skills | **ESCO** | 13,890 skills/competences across 3,008 occupations, with occupation→skill relationships already mapped |
| Extraction | **LLM** | Normalizes messy human input onto the codes above |
| Local layer | **Alias table** | MY-specific terms ESCO lacks (see caveat) |

Why ESCO over O\*NET:
- **Free and openly licensed** — dataset downloadable at no cost, API under EUPL 1.2, so no licensing exposure
- **Occupation→skill relationships are pre-mapped** — this is what lets the platform suggest "Graphic Designer usually requires: typography, layout, Illustrator…" without building it manually
- **ISCO-aligned**, so it bridges cleanly to MASCO; O\*NET is SOC-based (US) and would need a messier crosswalk
- Multilingual by design, whereas O\*NET is essentially English-only

**Caveat that must be handled: ESCO does not cover Malaysian languages.** Its ~27 languages are European plus Arabic — **no Bahasa Malaysia, no Mandarin, no Tamil**. English coverage is complete, so ESCO works as the canonical vocabulary, but user-facing input in BM or Manglish will not resolve against it directly.

**Resolution:** maintain a local alias table mapping BM/Manglish/MY-industry terms onto ESCO skill URIs — e.g. *kemahiran komunikasi* → communication skills, *jurutera* → engineer, *kedai runcit* → retail. The LLM handles first-pass normalization; every unmatched term is logged for review and promoted into the alias table once seen repeatedly. Budget for this as ongoing curation, not a one-time import — it is the part of the taxonomy work that cannot be outsourced to a standard.

**Storage rule:** persist the ESCO/MASCO code *and* the original text the user typed. Codes drive matching; the original text is shown back to the user and is the audit trail when normalization gets it wrong.

### 0.5 The Matching Model

**Worked example — the case that breaks naive matching:** an employer posts "Graphic Designer." A jobseeker's profile says "Creative Designer." With title-string matching, neither ever sees the other. Creative roles are the worst case: the same job is advertised as Graphic Designer, Visual Designer, Brand Designer, Creative Designer, Multimedia Designer, Graphic Artist, or Art Director depending purely on who wrote it.

Matching therefore runs in layers, weighted in this order:

**1. Skills — the primary axis.** Overlap on Illustrator, Photoshop, InDesign, branding, typography is a far stronger signal than either job title. Titles are marketing; skills are substance. Required skills weigh more than nice-to-haves.

**2. MASCO occupation code — the canonical key.** Both titles normalize to the same MASCO group at creation time (posting *and* profile), and matching runs code-to-code rather than string-to-string.

**3. Semantic similarity — catches the near-misses.** MASCO resolution is imperfect on ambiguous titles ("Creative Designer" could map to graphic design, advertising, or art direction). Embedding similarity covers what exact-code matching drops.

**4. Hard filters — applied last.** Location, salary range overlap, employment type, work arrangement, work authorization. These narrow the set; they do not rank it.

**Why the jobseeker profile carries target occupation(s) — field 15 in §2 Stage 0.**
The history fields in §2 Stage 0 (work history, past titles) capture what a jobseeker *has been*, not what they are *looking for*. A Creative Designer seeking Graphic Designer roles — or anyone changing careers — is invisible to matching that only reads history. During profile creation the AI must ask directly ("you've described yourself as a Creative Designer — are you targeting Graphic Designer, UI/UX, or Art Director roles?") and store **target MASCO codes separately from historical ones**. Match against targets, not just history.

**Tuning — start loose, tighten with inventory.**
With low job inventory, a strict matcher returns an empty screen and the user leaves — which compounds the cold start problem in Strategic Decision B. Early on, surface adjacent matches with a visible reason ("matched on 6 of 8 required skills; different job title") rather than showing nothing. Tighten thresholds as supply grows.

**Explainability is not optional.** Both sides should see *why* something matched. For the employer it justifies the ranking; for the jobseeker it converts a confusing near-miss into useful feedback about what they're missing. It is also the practical prerequisite for auditing the bias risk described in §0.3 — an unexplainable ranker cannot be audited.

---

## 1. Employer Flow

### Stage 0 — Company Setup (one-time)
Employer talks/types company info; AI structures it.
- Company name, SSM number, industry, size, location(s)
- Company description / culture blurb
- Logo / branding
- Default benefits (EPF/SOCSO/EIS + extras) — reused across postings so it isn't re-entered each time

**Optional AI pre-fill from public sources.** Given a company name, the AI may look up public data (web search / business-data API) to suggest industry, size, description, and logo, so the employer isn't typing everything from scratch — governed by the external-data rule in §0.3: pre-fill only surfaces once the entered SSM number resolves to that company (not on name-matching alone, which risks attaching a real company's data or logo to the wrong account), and every suggested field is visibly marked as pulled from public sources and stays editable until the employer confirms it.

### Stage 1 — Job Posting Creation
Employer describes the role naturally. AI extracts fields, asks follow-ups for anything missing, then produces a draft for review and edit before publishing.

**Fields captured (Malaysia-tuned):**
1. Job title
2. Employment type (full-time / part-time / contract / internship)
3. Location + work arrangement (remote / hybrid / onsite)
4. Salary range
5. Required skills
6. Nice-to-have skills
7. Language requirements (BM / English / Mandarin / other)
8. Experience level / years required
9. Responsibilities
10. Benefits (incl. EPF / SOCSO / EIS statement)
11. Company blurb
12. Qualification tier (SPM / STPM / Diploma / Degree)
13. Notice period expectation
14. Number of openings
15. Application deadline / auto-expiry date

**System-level guards (not employer-facing fields):**
- **Discrimination filter** — AI refuses and strips race, gender, age, marital-status criteria, and explains why rather than silently deleting.
- **Minimum wage check** — national minimum is **RM1,700/month** (in force since 1 August 2025), equivalent to RM65.38/day on a six-day week or RM9.78/hour. Applies uniformly across all states including Sabah, Sarawak and Labuan, and covers foreign, part-time and gig workers; only domestic helpers and apprentices are exempt.
  - **Critical detail:** the minimum applies to **basic pay only**. Allowances, bonuses, commissions, overtime and benefits-in-kind cannot be counted toward it. The validation must therefore check the basic salary figure, not the advertised total package — otherwise a posting of "RM1,800 including allowances" passes a naive check while being non-compliant.
- **Employment Pass check** — if the posting is open to foreign candidates, flags salary below the EP threshold as unviable.

**Salary transparency stance:** a salary range is strongly encouraged but not blocked on. A posting without one publishes, is visibly marked as not stating a range, and **ranks below comparable postings that do state one** (R11). "Negotiable" is treated as no range. This is the platform position R11 operationalizes on the matching side.

**Posting lifecycle:** `Draft → Published → Paused → Closed → Expired`
Auto-expiry fires on the deadline date, or when `hires_confirmed` reaches `openings_total` (see R4 for the counter rules). Expiry and closure stop new applications only — candidates already in the pipeline continue (R5).

### Stage 2 — Managing Job Postings
List view by status. Edit, pause, close, duplicate, or extend — via UI or chat ("pause the marketing job", "extend the sales posting by two weeks").

Editing a **live** posting with applicants already in it is a sync event, not a silent update — see §3.

### Stage 3 — Applications Arrive
Each application carries a status and a full history of who changed it and when.

`New → Screened → Shortlisted → Interviewing → Offered → Hired`
with terminal branches `Rejected` (employer) and `Withdrawn` (jobseeker) available from any stage.

Rules:
- One active application per jobseeker per posting (no duplicates)
- Applications to a paused/closed posting are blocked server-side at submit time
- Re-application after rejection follows the 30-day cooldown in R9
- Each application stores a snapshot of the posting terms at apply time, so material edits can be diffed against what the candidate actually agreed to (R6)

### Stage 4 — Screening
AI pre-screens against the posting's own criteria and produces a ranked list with visible reasoning ("meets 6/7 required skills, missing Mandarin"). Employer can:
- Ask for a summary of any candidate instead of reading the full profile
- Ask comparative questions ("who has the most logistics experience?")
- Override any AI judgement — ranking never filters anyone out of view

**Rejection requires a reason code** (skills mismatch / experience level / salary expectation / position filled / other). This feeds the jobseeker's feedback and is the raw material for any future anti-ghosting feature.

### Stage 5 — Shortlisting
Move candidates to Shortlisted individually or in bulk, via UI or chat.

### Stage 6 — Interview Scheduling *(collaborative, not unilateral)*
The employer does **not** just assign a time. Instead:
1. Employer proposes **2–3 slots** (date/time, mode: online link or physical address, round name)
2. Jobseeker receives them and **picks one**, or proposes an alternative
3. Confirmed slot locks on both calendars; both get reminders (24h + 1h before)

This is the single biggest smoothness fix — unilateral scheduling generates reschedule churn and no-shows.

Slots carry a capacity and may be proposed to several candidates at once; contention, live withdrawal, and response deadlines are governed by **R2 and R3**.

**Multi-round support:** interviews are a list, not a single field — `Round 1: HR Screen → Round 2: Technical → Round 3: Final`. Each round has its own slot, mode, interviewer, outcome, and notes. Status stays `Interviewing` across rounds.

### Stage 7 — Interview Outcome
Employer logs per round: Passed / Failed / No-show, plus private notes and an optional rating. No-show on either side is recorded — it matters for both parties' reliability over time.

### Stage 8 — Offer
An offer is a real object, not a status flag:
- Position, confirmed salary, start date, employment type, probation period, benefits summary
- **Offer expiry date**
- Optional attached offer letter (AI can draft it from the posting + agreed terms)

Jobseeker can **Accept**, **Decline**, or **Negotiate** (counter-proposal on salary or start date, which returns to the employer for revision). Offers can be revised and re-sent; each version is retained.

### Stage 9 — Hired → HRMS Handoff
On acceptance, the candidate profile converts to an employee record with no retyping:
- Employee ID, department, start date, confirmed salary, reporting manager
- EPF / SOCSO / EIS enrolment
- Document collection checklist (IC, bank details, qualifications) — the first point where IC and photo are legitimately collected
- Seeds the HRMS module (future phase)

**Statutory contribution rates to build against** (verify at implementation — these change):

| Scheme | Employee | Employer | Wage ceiling |
|---|---|---|---|
| EPF (local) | 11% | 13% | — |
| EPF (foreign worker) | 2% | 2% | — mandatory since 1 Oct 2025 |
| SOCSO | — | ~1.75% combined employer cost | RM6,000/month |
| EIS | 0.2% | 0.2% | RM6,000/month |

Submission deadline is the **15th of the following month**. The SOCSO/EIS ceiling rose from RM4,000 to RM6,000 in October 2024.

Note the EPF employer rate has historically varied by wage band (a lower rate above a threshold) — confirm the current band rules before implementing payroll calculations rather than hardcoding a flat 13%.

Remaining openings decrement; posting auto-closes when they hit zero.

### Stage 10 — Analytics
Beyond raw counts, the employer should be able to ask: time-to-hire, funnel drop-off by stage, applications per posting, offer acceptance rate, average time a candidate sits at each stage.

### Employer Chatbot Tools
Read: `get_applicant_count(job_id, status)` · `get_shortlist(job_id)` · `get_interviews(date_range)` · `get_candidate_summary(applicant_id)` · `get_hiring_stats(job_id, metric)` · `list_postings(status)`
Write *(confirmation required)*: `create_job_posting()` · `update_job_posting()` · `pause_posting()` · `close_posting()` · `update_application_status()` · `propose_interview_slots()` · `send_offer()` · `hire_applicant()`

---

## 2. Jobseeker Flow

### Stage 0 — Profile Creation
Talk, type, or upload a resume — AI structures it into the profile below. No manual form filling required, though every field stays editable through normal UI.

**Profile fields (Malaysia-tuned):**

| # | Field | Notes |
|---|---|---|
| 1 | Full name | |
| 2 | Contact (phone + email) | Phone-first; WhatsApp-reachable |
| 3 | Location (state / city) | Plus willingness to relocate |
| 4 | Professional summary | AI-generated from the conversation |
| 5 | Work history | Company, title, dates, achievements |
| 6 | Total years of experience | Derived from work history, not asked |
| 7 | Skills (hard / soft) | Normalized to **ESCO skill codes** (§0.4) — the same vocabulary employer postings resolve to. Original user wording is stored alongside the code |
| 8 | Qualification tier | SPM / STPM / Diploma / Degree / Master / PhD |
| 9 | Education detail | Institution, field, year, CGPA, SPM results |
| 10 | Certifications / licenses | Professional bodies, safety certs |
| 11 | Languages — **spoken and written tracked separately** | BM / English / Mandarin / Cantonese / Tamil. MY-specific: fluency often differs between spoken and written |
| 12 | Expected salary (RM/month) | Required for matching; a range beats "negotiable" |
| 13 | Current salary | **Optional and skippable by design** — mandatory disclosure entrenches underpayment |
| 14 | Notice period / availability | Statutory defaults by tenure: <2 yrs = 4 weeks · 2–5 yrs = 6 weeks · 5+ yrs = 8 weeks. AI suggests from tenure |
| 15 | **Target occupation(s)** | Stored as MASCO codes, **separate from work history**. What they're looking for ≠ what they've been. Without this, career switchers are invisible to matching — see §0.5 |
| 16 | Employment type sought | Full-time / part-time / contract / internship |
| 17 | Work arrangement preference | Remote / hybrid / onsite |
| 18 | Own transport + driving license | Common MY requirement, especially outside Klang Valley |
| 19 | Shift availability | Night / weekend / rotating — matters for F&B, retail, logistics |
| 20 | Work authorization | Citizen / PR / requires pass — determines EP threshold viability |
| 21 | Portfolio / proof links | GitHub, Behance, certificates |
| 22 | Profile visibility | See below |
| 23 | Date of birth | Optional. Reverses the original "not collected" stance — see note below |
| 24 | Gender | Optional, including "prefer not to say" — see note below |
| 25 | Marital status | Optional, including "prefer not to say" — see note below |
| 26 | Nationality | Optional |

**Deliberately NOT collected: photo, race, religion, IC number.**

Malaysian resumes traditionally include these, and many local companies and GLCs still expect them. Collecting them here would be incoherent with the employer-side discrimination filter — it would clean up the job ad while handing the same bias straight back through the candidate profile. The consistent position is to not collect them at all, and to state that publicly as a platform stance.

Supporting basis: Article 8 of the Federal Constitution prohibits discrimination on religion, race, descent, place of birth, and gender; PDPA requires a clear purpose and consent for collecting personal data. "Not collected because not needed for matching" is a defensible position, not merely an idealistic one.

IC number and photo are collected later at the **hire / HRMS stage**, where a genuine legal purpose exists (EPF / SOCSO / EIS enrolment) — never during matching.

**2026-09-13 update:** date of birth, gender, and marital status were added back to the jobseeker onboarding form as optional fields (each with a "prefer not to say" option where applicable), reversing the original exclusion above for those three specifically. Photo, race, religion, and IC number remain excluded per the original reasoning. The bias-discrimination rationale still applies — these fields are not used in matching or shown to employers as filter criteria; they exist for the jobseeker's own profile completeness. Whether/how they surface to employers, and whether the constitutional/PDPA caution above still fully holds for a field that's optional and jobseeker-initiated, is an open follow-up, not resolved here.

Note the tension with §0.3's bias-auditing recommendation: outcome auditing needs demographic data that this stance declines to collect. Resolving that likely means voluntary, separately-stored, matching-excluded demographic data with explicit consent — an open design question, not settled here.

**Profile visibility control** (important, often overlooked): jobseekers choose whether their profile is
- **Private** — visible only to employers they apply to
- **Discoverable** — employers may search and approach them
- **Hidden from specific companies** — so a current employer can't see them job-hunting

### Stage 1 — Job Discovery
Conversational search ("marketing jobs in KL, remote, RM4k+, no weekend work") plus a normal browse/filter view. Only `Published` postings appear.

Supporting features: **saved jobs**, **saved searches with alerts**, and **scam/red-flag warnings** on suspicious postings (unverified SSM, salary wildly out of band, vague description, upfront payment requests).

### Stage 2 — Apply
One-click apply from the structured profile, or AI-assisted ("apply and highlight my project management experience"). Before submitting, the jobseeker sees exactly what the employer will receive.

Jobseekers can **withdraw** an application at any stage.

### Stage 3 — Status Tracking
Mirrors the employer pipeline, with jobseeker-appropriate wording:

| Employer sees | Jobseeker sees |
|---|---|
| New | Applied |
| Screened | Under Review |
| Shortlisted | Shortlisted |
| Interviewing | Interview Scheduled / In Progress |
| Offered | Offer Received |
| Hired | Hired |
| Rejected | Not Selected (+ reason category) |
| Withdrawn | Withdrawn |

Both sides read from the same status field — never a separate copy.

### Stage 4 — Interview
Receives proposed slots, picks one or proposes an alternative, gets reminders (24h + 1h), sees mode/location/interviewer/round name, and can request a reschedule — which notifies the employer rather than silently changing anything.

### Stage 5 — Offer
Sees full offer terms and expiry. Can accept, decline, or counter on salary/start date.

### Stage 6 — Post-Hire
Account transitions to an employee-facing HRMS view: document submission, start-date info, later payslips and EPF/SOCSO records (future phase).

### Jobseeker Chatbot Tools
Read: `search_jobs(criteria)` · `get_my_applications(status)` · `get_application_status(application_id)` · `get_upcoming_interviews()` · `get_job_details(job_id)`
Write *(confirmation required)*: `apply_to_job()` · `withdraw_application()` · `confirm_interview_slot()` · `request_reschedule()` · `respond_to_offer()` · `update_profile()`

**Where the AI actually earns its place here:** profile building (talking instead of writing a resume) and discovery (natural-language search). Status queries are included for completeness, but a jobseeker with a dozen applications is better served by a clear table than a chat round-trip — the status tools should not be the reason this chatbot exists. See Strategic Decision E.

---

## 3. Two-Way Live Sync

Both sides read the same status field — there is never a duplicated per-side copy. Every change is an event with defined effects in **both** directions.

### 3.1 Employer action → Jobseeker effect

| Employer action | Jobseeker effect |
|---|---|
| Pause / close posting | Removed from search; **new applications stop, existing pipeline continues** (R5). Applicants notified of the change in status |
| Cosmetic edit to live posting | Applicants notified of what changed — silent edits break trust (R6) |
| **Material** edit to live posting | Applicants notified of the specific change and asked to confirm continued interest; no response in 7 days auto-withdraws. Candidates at `Offered` are exempt (R6) |
| Screen / shortlist | Status updates + notification |
| Propose interview slots | Notification with slots to choose from, each showing its response deadline (R3) |
| Slot taken by another candidate | Slot withdrawn live from this candidate's options; notified with remaining alternatives, or told new times are coming if none remain (R2) |
| Reschedule / cancel interview | Both calendars update; notified with reason |
| Reject | Notified with reason category (never a silent disappearance) |
| Send offer | Offer appears with full terms + expiry countdown |
| Revise offer | New version shown; previous retained |
| Hire | Converts to employee onboarding view |
| Posting expires | New applications stop; **candidates already in pipeline continue to a real outcome** (R5) |
| Saved to talent pool | Only with the jobseeker's standing consent; visible to them and revocable (R9) |

### 3.2 Jobseeker action → Employer effect

| Jobseeker action | Employer effect |
|---|---|
| Apply | New application appears live; applicant count increments |
| Withdraw application | Removed from active pipeline; employer notified — critical if mid-shortlist |
| Confirm interview slot | Slot consumes capacity and locks to employer's calendar; this candidate's other proposed slots release, and if capacity is now full the slot is withdrawn from all other candidates holding it (R2) |
| Propose alternative slot | Employer notified to approve or counter |
| Request reschedule | Employer notified with reason |
| Let proposed slots lapse | Employer notified and prompted to re-propose (R3) |
| Accept offer | `offers_outstanding` −1, `hires_confirmed` +1; triggers HRMS handoff; posting auto-closes if openings are filled (R4) |
| Decline offer | `offers_outstanding` −1; employer notified with reason; capacity frees for other candidates (R4) |
| Counter-offer | Employer notified with proposed terms |
| Withdraw after accepting, before start date | `hires_confirmed` −1; employer notified and prompted to reopen the posting (R4) |
| Update profile mid-application | Employer sees the updated version, flagged as revised |
| No-show at interview | Recorded and flagged to employer |
| Revoke talent-pool consent | Removed from the employer's talent pool immediately (R9) |

### 3.3 Race Conditions to Handle Explicitly
- Jobseeker applies at the instant a posting is paused → server re-checks status at submit, rejects with a clear message
- Jobseeker withdraws while employer is scheduling an interview → scheduling aborts with an explanation
- Two candidates accept the same capacity-1 slot simultaneously → resolved transactionally by server order; the loser is handled as a withdrawn-slot case (R2)
- Two employer users act on the same candidate simultaneously → last-write-wins with visible history for direct UI actions; **AI-initiated writes instead abort and re-confirm** when state changed since the read (R8)
- Offer expires while the jobseeker is accepting → a **24-hour grace window** applies from expiry; acceptance inside it succeeds and notifies the employer, outside it fails with a prompt to request a renewed offer. The offer's seat is not released until the window closes — counter effects in R4
- Employer closes a posting with an offer outstanding → outstanding offers survive; they aren't voided by closure (R5)
- Material posting edit lands while a jobseeker is mid-application → submission re-checks terms at submit and shows what changed before confirming (R6)

### 3.4 Notifications
- **Channels:** in-app (always) · email · WhatsApp (dominant in MY — likely more effective than email) · push
- **Per-user preferences** per channel and event type
- **Digest vs. immediate:** high-signal events (offer, interview, rejection) immediate; low-signal (new applicant on a busy posting) batched into a digest
- Every notification deep-links to the exact object it concerns

### 3.5 Audit Trail
Every status change records actor, timestamp, and previous value. This makes disputes resolvable and lets the chatbot answer "when did we shortlist her?" or "how long has this candidate been waiting?" — the latter being the foundation for any future anti-ghosting mechanic.

### 3.6 Delivery Mechanism
Push (websockets or similar) is the goal so a paused job visibly disappears without a refresh. Polling-on-load is acceptable for MVP — but the **server-side status re-check at action time is mandatory regardless**, since that's what actually prevents acting on stale state.

---

## 4. Communication Channel

Scheduling and offers alone aren't enough — the two sides need a way to actually talk.
- A **message thread scoped to each application**, visible to both parties
- Employer can ask a clarifying question pre-interview; jobseeker can ask about the role or flag a delay
- System events (status changes) appear inline in the same thread, so there's one chronological story per application
- AI can draft replies for either side, but never sends unprompted
- Lifecycle, post-rejection limits, and block/report behaviour are defined in R13

---

## 5. Data Model Sketch

`Company` → `JobPosting` → `Application` → `Interview[]` → `Offer` → `EmployeeRecord`
`JobseekerProfile` → `Application`
Supporting: `MessageThread` · `Notification` · `StatusHistory` · `SavedJob` · `SavedSearch` · `TalentPoolEntry` · `SkillAlias`

`Application` is the join at the centre of everything — it holds the single status field both sides read, and owns the interview list, offer, message thread, and history.

**Fields the rules in §6.2 require:**

| Entity | Required fields |
|---|---|
| `JobPosting` | `openings_total` · `offers_outstanding` · `hires_confirmed` · `over_offer_multiplier` · `masco_code` · `accepts_new_applications` (separate from status) · `expiry_date` |
| `InterviewSlot` | `capacity` · `accepted_count` · `proposed_to[]` · `response_deadline` · `round_name` |
| `Application` | `status` · `version` (for R8 stale-read checks) · `rejection_reason_code` · `terms_snapshot` (what the posting said at apply time, for R6) |
| `Offer` | `version[]` · `expiry_date` · terms · `grace_window_end` · `status` (incl. `Expired (grace)`, which still holds its seat — R4) |
| `JobseekerProfile` | `target_masco_codes[]` (separate from history) · `talent_pool_consent` · `visibility` |
| `TalentPoolEntry` | `company_id` · `jobseeker_id` · `consent_date` · `expiry_date` (R10) |
| `SkillAlias` | `local_term` · `esco_uri` · `language` · `usage_count` — the curated BM/Manglish layer from §0.4 |

Every entity carrying personal data needs a retention timestamp to implement R10.

---

## 6. Tech Notes

- **DeepSeek API** — text-only, OpenAI-compatible, function calling (up to 128 functions, `strict: true` schema validation) and JSON mode. Good for structuring and tool-calling.
- **MiMo API** — OpenAI-compatible chat/function-calling, plus native ASR and TTS under the same key. Required if voice is in scope, since DeepSeek has no audio path.
- Both can run together: voice → MiMo ASR (mandatory), chat/generation split by cost and quality per task. Hardcode the routing for MVP.
- **Gemini** (Flash / Flash-Lite) accepts audio directly and returns structured output in one call — worth testing against the two-step pipeline, especially on Manglish.
- **Groq** free tier (Whisper STT, 2,000 req/day, no card) — cheapest way to test transcription quality first.
- **Fallback required:** if the AI provider is down, the platform must remain fully usable through conventional UI.

### 6.1 PDPA — Data Residency (must resolve before launch)
Malaysia's PDPA amendment removed the old cross-border "whitelist" regime as of **1 April 2025**, with Cross Border Personal Data Transfer Guidelines published 29 April 2025. Transfers abroad now require the destination to have substantially similar protection or equivalent safeguards, plus documented controls and record-keeping.

This directly affects the design: resumes, IC numbers, and salary data are sensitive personal data, and DeepSeek and MiMo are both China-hosted. Options to weigh:
1. Strip/pseudonymise PII before it ever reaches an LLM (send skills and experience, never names, IC, or contact details)
2. Use a provider with acceptable jurisdiction/safeguards for anything containing PII
3. Self-host an open model for PII-touching operations, keep third-party APIs for non-PII generation

**Needs legal review — do not treat the above as legal advice.** Option 1 is a sound default regardless, and is cheap to build in from the start; retrofitting it later is painful.

---

## 6.2 Resolved Rules

Each rule below closes a logic gap that would otherwise break the system in production. These are decisions, not options — implement as stated or change deliberately.

### R1. Skills taxonomy — ESCO, bridged to MASCO via ISCO-08
**Resolved in §0.4.** ESCO supplies the skills vocabulary (13,890 skills, free under EUPL 1.2, occupation→skill relationships pre-mapped), MASCO supplies MY-official occupation classification, ISCO-08 bridges them. LLM normalizes input onto codes; a locally curated alias table covers BM/Manglish terms ESCO lacks. Store both the code and the original user text.

### R2. Interview slot collision
Every proposed slot carries a **capacity** (default 1, employer-adjustable per interviewer).

- Proposing one slot to multiple candidates is **allowed** — it is normal practice — but the slot is marked *contended* and the employer sees how many candidates hold it
- **First acceptance consumes capacity.** The moment capacity is reached, that slot is withdrawn in real time from every other candidate still holding it, and those candidates are notified with the remaining alternatives
- If withdrawal leaves a candidate with **no remaining slots**, the employer is prompted immediately to propose new ones, and the candidate is told new times are coming rather than left with an empty list
- Acceptance is transactional: two simultaneous acceptances for a capacity-1 slot resolve by server order, and the loser is treated as a withdrawal case above

### R3. Slot expiry
- A proposed slot expires at whichever comes first: **72 hours after proposal**, or **24 hours before the slot start time**
- Slots whose start time has passed are never displayed as selectable, regardless of expiry state
- On expiry of all slots for a candidate: employer notified and prompted to re-propose; candidate notified that the times lapsed and new ones are being arranged
- Employers may set a shorter response window for urgent roles

### R4. Openings, offers, and hires — three separate counters
Every posting tracks `openings_total`, `offers_outstanding`, and `hires_confirmed` independently.

| Event | Effect |
|---|---|
| Offer sent | `offers_outstanding` +1 |
| Offer accepted | `offers_outstanding` −1, `hires_confirmed` +1 |
| Offer declined | `offers_outstanding` −1 |
| Offer expired | `offers_outstanding` −1, but **only once the 24-hour grace window closes** (§3.3) — the offer sits in `Expired (grace)` until then, and the seat stays reserved |
| Acceptance inside the grace window | Treated as a normal acceptance: `offers_outstanding` −1, `hires_confirmed` +1 |
| Hire withdraws before start date | `hires_confirmed` −1; employer prompted to reopen |

- **Over-offering is permitted:** `offers_outstanding + hires_confirmed` may exceed `openings_total` up to an employer-set multiplier (default 1.0 — no over-offering unless deliberately enabled). Exceeding it requires explicit confirmation
- Posting auto-closes when `hires_confirmed` reaches `openings_total`
- Reducing `openings_total` below `hires_confirmed` is disallowed

### R5. Closure and expiry do not terminate in-flight candidates
Closing, pausing, or expiring a posting sets a flag that **stops new applications only**. Every application not already in a terminal state (`Hired` / `Rejected` / `Withdrawn`) continues through its pipeline to a real conclusion, including outstanding offers.

The posting displays as *"Closed to new applications — N candidates still in pipeline."* Only when every application reaches a terminal state does the posting become fully archived.

### R6. Material vs. cosmetic edits
**Material fields:** salary range · location · work arrangement · employment type · qualification tier · required skills · number of openings (decrease only).
**Cosmetic:** title wording, description prose, nice-to-have skills, company blurb, benefits phrasing.

- **Cosmetic edit** with live applicants → notify only
- **Material edit** with live applicants → all non-terminal applicants notified of exactly what changed and asked to **confirm continued interest**. No response within 7 days auto-withdraws the application with notice to both sides
- Applications already at `Offered` are exempt — an outstanding offer carries its own agreed terms and is not altered by a posting edit
- Changing MASCO occupation code is not an edit; it requires a new posting

### R7. Chatbot reference resolution
- **Screen context is an implicit parameter.** While viewing a posting or candidate, "this one," "pause it," "shortlist her" resolve to the entity on screen
- **Ambiguity always asks, never guesses.** If a reference matches more than one entity, the AI lists the matches with distinguishing detail and asks which
- **Every confirmation echoes identifying detail**, not just the action: *"Pause 'Graphic Designer — KL', posted 3 Feb, 12 applicants?"* — not *"Pause the job?"*
- If a reference matches nothing, say so plainly rather than selecting the nearest match

### R8. Stale reads before writes
Every read that may precede a write captures a version marker (`updated_at` or row version) for the affected entities. At execution the write re-reads and compares.

- **Unchanged** → proceed
- **Changed** → abort, report exactly what changed, re-confirm
- Applies to bulk operations per item: if "shortlist the top 3" finds one withdrawn, the other two proceed and the changed one is reported separately

### R9. Talent pool, rejection, and re-application
- On rejection the employer chooses **Reject** or **Reject + save to talent pool**. Saving requires the jobseeker's profile-level consent to talent-pool retention (opt-in, revocable at any time)
- Talent pool members can be surfaced for future postings and invited directly, which also creates the first employer→jobseeker initiation path
- **Re-application:** blocked on the same posting for **30 days** after rejection; immediately allowed on any other posting. Re-applying after a material change to the posting is allowed without waiting
- Jobseekers can see and remove themselves from any company's talent pool

### R10. Data retention schedule
Retention is purpose-bound under PDPA. Defaults:

| Data | Retention |
|---|---|
| Active application | Life of posting + 6 months |
| Rejected / withdrawn application | 6 months, then anonymized (aggregate stats retained, identity removed) |
| Talent pool entry | 12 months from consent, renewable with re-consent, revocable anytime |
| Message threads | Follow their parent application |
| Dormant jobseeker profile | 24 months inactive → warning notice → deletion after 30 days |
| Hired → employee record | Leaves ATS retention entirely; governed by employment-law record-keeping (longer, statutory) |
| Bias-audit demographic data | Stored separately, pseudonymized, aggregate-only, never joined to matching |

Deletion is real deletion, not a flag. **Confirm these periods with a Malaysian lawyer before launch** — they are a reasonable starting position, not legal advice.

### R11. Salary overlap tolerance
- Ranges that **overlap at all** → full match on salary
- Jobseeker's expectation **up to 15% above** the employer's maximum → match, ranked lower, with the gap shown explicitly to both sides ("expects RM4,500; range tops at RM4,000")
- Beyond 15% → excluded from active matching, but visible if the jobseeker searches directly (they may still choose to apply)
- **Salary never hard-excludes on its own** when every other signal is strong; it ranks down and displays the gap
- Postings without a salary range rank below those with one — this operationalizes the transparency stance in §1 Stage 1

### R12. SSM verification — states and turnaround
Verification is a state machine, not a gate:

| State | Employer can | Duration |
|---|---|---|
| `Unverified` | Create account, complete company profile, **draft** postings | — |
| `Pending` | Everything above; postings queue for auto-publish on approval | Target: automated check in minutes; manual fallback 1 business day |
| `Verified` | Publish; carries a visible "SSM Verified" badge | — |
| `Rejected` | See reason, upload supporting documents, appeal | Appeal reviewed within 2 business days |

Nothing about signup is blocked — only publishing. The badge is the jobseeker-facing trust signal underpinning scam protection (§2 Stage 1).

### R13. Message thread lifecycle
- Thread stays fully open while the application is active
- On a terminal state, the thread remains open for **14 days**, then becomes read-only and archives with the application
- A rejected candidate may send **one** post-rejection message (typically a feedback request); the employer may reply but is not obliged to
- Block and report are available to both sides at any time, and a block ends the thread immediately
- Threads are never deleted independently of their parent application (see R10)

### R14. Absolute qualification floor on ranking
Ranking is relative; qualification is absolute. Every ranked result carries a tier alongside its position:

- **Meets all required** criteria
- **Meets most** — gaps listed explicitly
- **Does not meet required** criteria

The chatbot must state the floor before the ranking: *"3 of 12 applicants meet all required skills. Ranked list follows."* If nobody qualifies, it says so directly rather than presenting a top 5 that implies suitability. This also feeds the explainability requirement in §0.5 and the bias-audit trail in §0.3.

---

## 7. Open Questions

**Strategic** — see the Unresolved Strategic Decisions section at the top. Differentiating mechanic, cold start, monetization, and ATS-vs-HRMS positioning all remain open, and each one reshapes this document.

**Tactical:**
- MVP scope and sequencing — nothing here is prioritized yet. As written, this document is a multi-month build across ATS, HRMS, AI assistant, and a two-sided marketplace; each of those is arguably its own product. A thin first slice needs to be cut.
- Does the floating chatbot replace dashboard views entirely, or sit alongside conventional lists and charts?
- Video interviews hosted in-platform, or external links (Meet/Zoom) only?
- Multi-user employer accounts (recruiter + hiring manager) — deferred, but the data model should not block it
- Should employers be able to search and approach discoverable jobseekers proactively? R9 opens a narrow version of this — inviting talent-pool members they have already interacted with. Open search across all discoverable profiles is a larger decision, with implications for §2's visibility controls and for whether the platform becomes a sourcing tool as well as a job board.
- Anti-ghosting mechanic — response SLA, auto-nudge, or employer responsiveness score? The audit trail makes any of these possible later
- **Match scoring weights.** The matching *architecture* is now settled — §0.4 fixes the taxonomy (MASCO + ESCO via ISCO-08), §0.5 fixes the layer order, R11 fixes salary tolerance, R14 fixes the qualification floor. What remains is empirical, not architectural: the relative weights between skills overlap, occupation-code match, and semantic similarity, and whether jobseekers see a numeric match score or only the explanation. These should be tuned against real usage rather than guessed now.
- **Channel reality:** a large share of Malaysian hiring in F&B, retail, and logistics happens over WhatsApp, not web portals. This document assumes dashboard usage throughout. If those segments are the target, WhatsApp may be the primary interface rather than a notification channel.
- HRMS module depth (payroll, leave, attendance) — undetailed, pending Decision D

---

## Sources
- [Malaysian Guidelines on Cross-Border Data Transfers 2025 — CMS](https://cms.law/en/sgp/legal-updates/malaysian-guidelines-on-cross-border-data-transfers)
- [Key Amendments to Malaysia's PDPA and Cross-Border Transfer Guidelines — Mayer Brown](https://www.mayerbrown.com/en/insights/publications/2025/07/from-legislative-reform-to-practical-guidance-key-amendments-to-malaysias-pdpa-and-the-launch-of-cross-border-transfer-guidelines)
- [Malaysia explores full salary transparency in job postings — HRM Asia](https://hrmasia.com/malaysia-explores-full-salary-transparency-in-job-postings/)
- [Malaysia Employment Pass Salary Requirements 2026 — Envoy Global](https://www.envoyglobal.com/news-alert/malaysia-employment-pass-minimum-salary-requirements-2026/)
- [MASCO 2020 — Malaysia Standard Classification of Occupations, Ministry of Human Resources (PDF)](https://jtksm.mohr.gov.my/sites/default/files/2022-12/MASCO_2020_BI_Edaran.pdf)
- [ESCO — What is ESCO? (European Commission)](https://esco.ec.europa.eu/en/about-esco/what-esco)
- [ESCO — Download the dataset (free, all languages)](https://esco.ec.europa.eu/en/use-esco/download)
- [ESCO — Services / API (EUPL 1.2)](https://esco.ec.europa.eu/en/use-esco/use-esco-services-api)
- [Minimum Wage Malaysia 2026: RM1,700 — KC Group](https://kcgroup.biz/minimum-wage-malaysia-2026-complete-guide/)
- [EPF, SOCSO & EIS Malaysia: Contribution Rates & Employer Guide 2026](https://salarycalculator.my/blog/epf-socso-eis-malaysia-latest-contribution-rates-employer-guide-2026)
- [Notice Period Malaysia 2026 — Employment Act rules](https://kcgroup.biz/notice-period-malaysia-2026/)
