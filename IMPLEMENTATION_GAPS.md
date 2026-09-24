# Implementation Gaps vs. FLOW.md Requirements

## Status: Last verified Sept 18, 2026

This document tracks the difference between what FLOW.md specifies and what's actually built in the codebase.

---

## 1. Database Schema Gaps

### 1.1 JobPosting Table — Missing Required Fields (§6.2, R4, R5)

**Required by FLOW.md:**
- `openings_total` — total number of positions to fill
- `offers_outstanding` — current number of active offers
- `hires_confirmed` — number of accepted offers / hired candidates
- `over_offer_multiplier` — controls over-offering threshold (default 1.0)
- `masco_code` — Malaysia Standard Classification of Occupations code
- `accepts_new_applications` — separate boolean from status (allows closing for new apps while keeping pipeline live)
- `expiry_date` — when posting auto-expires (deadline or when hires_confirmed = openings_total)

**Current state in schema (line 254-289):**
```
✅ id, employerProfileId, title, description, responsibilities, industry
✅ employmentType, workArrangement, location, salaryMin, salaryMax
✅ openings (column name: "openings") — only field
❌ skills, softSkills, minYearsExperience, minQualificationTier, languages
✅ workAuthorizations, drivingLicense, status, rejectionReason, flagReason
❌ openings_total, offers_outstanding, hires_confirmed, over_offer_multiplier
❌ masco_code
❌ accepts_new_applications
❌ expiry_date
```

**Impact:** Cannot implement:
- Auto-closure when hires reach openings (§2.3, R4)
- Over-offering logic (R4)
- Talent pool retention limits (R10)
- Proper opening count vs. offer vs. hire accounting

---

### 1.2 Job Application Table — Missing Required Fields (§6.2, R8)

**Required by FLOW.md:**
- `version` — for R8 stale-read checks (optimistic lock or timestamp)
- `rejection_reason_code` — structured enum, not free text
- `terms_snapshot` — what the posting's terms said at apply time (for R6 — dispute resolution)

**Current state in schema (line 313-369):**
```
✅ id, jobPostingId, jobseekerProfileId
✅ status, appliedAt, updatedAt
❌ version
❌ rejection_reason_code (structured)
❌ terms_snapshot
```

**Impact:** Cannot implement:
- Stale-read prevention (R8 — applicant applies, posting changes, offer expires from old terms)
- Structured rejection reasons
- Audit trail of what terms were offered at apply time

---

### 1.3 Offer Table — Missing Entirely

**Required by FLOW.md (§8):**
- A first-class entity representing an offer (not embedded in Application)
- Fields: `version[]`, `expiry_date`, `grace_window_end`, `status`, `terms` (jsonb)
- Status states: `pending`, `accepted`, `declined`, `expired`, `expired_grace`

**Current state:**
- Offers are not a table; no `offers` export in schema
- No way to track offer versions, expiry, or grace windows

**Impact:** Cannot implement:
- Offer lifecycle (§8)
- Grace window for accepting expired offers (R4 — 24-hour grace)
- Multiple offer versions (R3)
- Offer counters for matching (R4)

---

### 1.4 Interview Slot Table — Missing Required Fields

**Required by FLOW.md (§7, R3):**
- `capacity` — how many candidates this slot holds
- `accepted_count` — how many have accepted
- `proposed_to[]` — which candidates this was offered to
- `response_deadline` — when candidates must respond
- `round_name` — "screening" / "technical" / "culture" etc.

**Current state:**
- Interview slots not found in schema
- `interviewDetails` is embedded in jobApplications (line 354–359), not a first-class entity
- No capacity, no multi-candidate proposal logic

**Impact:** Cannot implement:
- Interview slot capacity logic (R3 — one slot, multiple candidates propose availability)
- Batch interview scheduling
- Candidate response deadlines
- Interview round labeling

---

### 1.5 Talent Pool Entry Table — Missing Entirely

**Required by FLOW.md (§2.5, R10):**
- Track employer's talent pool consent from jobseekers
- Fields: `company_id`, `jobseeker_id`, `consent_date`, `expiry_date`
- Expiry enforcement per R10

**Current state:**
- No `talentPoolEntries` table
- No way to track consent or expiry

**Impact:** Cannot implement:
- Talent pool feature (employer approaches jobseekers outside of applications)
- Consent tracking (required for PDPA)


---

### 1.6 Skill Alias Table — Missing Entirely

**Required by FLOW.md (§0.4, R1):**
- Local curated layer for BM/Manglish terms → ESCO URIs
- Fields: `local_term`, `esco_uri`, `language`, `usage_count`

**Current state:**
- Not in schema; no way to map local language terms to ESCO

**Impact:** Cannot implement:
- BM/Manglish skill matching
- Alias curation workflow

---

### 1.7 JobseekerProfile Table — Missing Required Fields

**Required by FLOW.md (§2.0, R1):**
- `target_masco_codes[]` — career target as occupation codes
- `talent_pool_consent` — whether opted into employer talent pool
- `visibility` — private / discoverable / hidden_from_companies

**Current state:**
- targetRole exists but not as structured codes
- No talent_pool_consent or visibility fields

**Impact:** Cannot implement:
- Career switcher matching (§0.5)
- Talent pool consent tracking
- Profile visibility controls (§2.0)

---

## 2. Business Logic Gaps

### 2.1 Auto-Closure When Hires Reach Openings (§2.3, R4)

**Requirement:** When `hires_confirmed >= openings_total`, posting auto-closes.

**Current state:** No logic exists; closeJob() is manual only.

**Impact:** Postings stay open indefinitely after all positions filled.

---

### 2.2 Over-Offering Validation (R4)

**Requirement:** `offers_outstanding + hires_confirmed` may exceed `openings_total` up to `over_offer_multiplier`.

**Current state:** No logic exists.

**Impact:** Cannot safely over-offer for acceptance rates; risk of over-committing positions.

---

### 2.3 Offer Grace Window (§8, R4)

**Requirement:** Expired offers sit in `Expired (grace)` state for 24 hours before truly expiring.

**Current state:** No offer table, no grace logic.

**Impact:** No recovery mechanism for last-minute acceptances after expiry.

---

### 2.4 Stale-Read Prevention (R8)

**Requirement:** If posting terms change after apply, old applications see old snapshot (prevents disputes).

**Current state:** No `terms_snapshot` field.



---

## 3. Feature Gaps

### 3.1 Superadmin Job Posting Review Queue
- ❌ No superadmin API to list pending postings
- ❌ No superadmin UI to review and reject/approve
- ❌ No email notification on rejection

### 3.2 Talent Pool Search & Outreach
- ❌ No talent pool table + cron
- ❌ No employer talent pool search page
- ❌ No "Reach out" button → message + offer proposal

### 3.3 Jobseeker Profile Visibility Controls
- ❌ No visibility enum or logic
- ❌ No per-company hiding
- ❌ No UI settings panel

### 3.4 MASCO Occupation Matching
- ❌ No MASCO integration (column exists but never populated)
- ❌ No AI function to normalize → MASCO code
- ❌ No matching algorithm using MASCO overlap

### 3.5 ESCO Skill Normalization
- ❌ No skill alias table
- ❌ No AI function to normalize → ESCO URI
- ❌ Skills stored as free text arrays only

### 3.6 Offer Versioning & Counter-Offers
- ❌ No offer table
- ❌ No counter-offer UI
- ❌ No version chain display

### 3.7 Bias Auditing & Outcome Reporting
- ❌ No demographic tracking for auditing
- ❌ No divergence detection dashboard
- ❌ No retention policy per compliance

### 3.8 PDPA Compliance & Data Residency
- ❌ No PII stripping at LLM boundary
- ❌ Resume data sent to China-hosted LLMs (DeepSeek/MiMo)
- ❌ No data residency controls documented

---

## 4. Priority Ranking

**Must-Have (MVP Blockers):**
1. JobPosting fields: `openings_total`, `offers_outstanding`, `hires_confirmed`, `expiry_date`
2. Offer table (enables lifecycle, expiry, grace window)
3. InterviewSlot table (enables batch scheduling)
4. Auto-closure logic (R4)

**Should-Have (Stage 2):**
5. Talent pool table + expiry (R10)
6. Stale-read prevention (R8 — `terms_snapshot`)
7. Over-offering validation (R4)
8. Superadmin review queue UI
9. Jobseeker visibility controls

**Nice-to-Have (Competitive, not core):**
10. MASCO + ESCO integration
11. Offer versioning / counters
12. Bias auditing
13. PDPA data residency controls

---

## 5. Implementation Checklist

- [ ] Add fields to `jobPostings` table (migration 0039)
- [ ] Create `offers` table (migration 0040)
- [ ] Create `interviewSlots` table (migration 0041)
- [ ] Create `talentPoolEntries` table (migration 0042)
- [ ] Create `skillAliases` table (migration 0043)
- [ ] Add fields to `jobseekerProfiles` (migration 0044)
- [ ] Add fields to `jobApplications` (migration 0045)
- [ ] Implement auto-closure logic (cron job)
- [ ] Implement over-offering validation (API)
- [ ] Implement offer grace window (cron + API)
- [ ] Implement talent pool expiry (cron job)
- [ ] Build superadmin review queue (API + UI)
- [ ] Build talent pool search UI
- [ ] Build jobseeker visibility controls UI

---

## 6. Known Blockers

1. **PDPA Legal Review** — Must complete before LLM data handling (§6.1)
2. **MASCO / ESCO Integration** — Requires government API key or reference data import
3. **Superadmin Review Queue** — Depends on UX decision
4. **Offer UI** — Jobseeker side needs offers separate from applications; design needed
**Impact:** Disputes over what terms were offered at apply time.

---

### 2.5 Interview Slot Capacity & Batching (R3, §7)

**Requirement:** One slot with capacity 10, proposed to 15 candidates, 12 accept → shows "12 confirmed, 10 seats, 2 waitlist."

**Current state:** Interview scheduling is per-candidate, no capacity batching.

**Impact:** Cannot batch-schedule interviews or manage capacity overflow.

---

### 2.6 Talent Pool Expiry (R10)

**Requirement:** Jobseeker consents to talent pool; auto-expires after 1 year with no hire.

**Current state:** No talent pool table, no expiry logic.

**Impact:** Cannot implement talent pool feature or consent expiry.
- Automatic pool expiry after 1 year (R10)
