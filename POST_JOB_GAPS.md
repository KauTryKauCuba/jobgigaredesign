# Post a Job Flow — Implementation Gaps

## Status: Last verified Sept 18, 2026

This document tracks what's missing from the "Post a Job" flow compared to FLOW.md requirements.

---

## Summary

**Overall Status:** 60% complete

✅ **Working:**
- Basic form with all major fields
- AI-fill functionality (generates posting from title)
- Draft/pending status workflow
- Skills & soft skills (tag-based input)
- Hard filters (experience, education, languages, work authorization, driving license)
- Jobseeker preview modal
- Resubmission after rejection

❌ **Missing:**
- Nice-to-have vs. required skills distinction
- Benefits field (EPF/SOCSO/EIS statement)
- Company blurb field
- Notice period expectation field
- Application deadline / auto-expiry date
- Discrimination filter (AI refuses race/gender/age criteria)
- Minimum wage check (RM1,700/month floor)
- Industry normalization to MASCO codes
- Skill normalization to ESCO codes
- Material edit notifications (R6)


---

## 1. Missing Form Fields (per FLOW.md §2.2)

### 1.1 Benefits Field
**FLOW.md requirement (line 179):** Benefits (incl. EPF / SOCSO / EIS statement)

**Current state:** Not in form or schema.

**Why it matters:**
- Malaysia legally requires EPF/SOCSO/EIS contributions
- Jobseekers need to know if statutory benefits are provided
- Distinguishes formal employment from gig/contract work

**Where to add:**
1. Add `benefits` text field to `jobPostings` schema
2. Add benefits textarea to PostJobForm (after salary range)
3. AI-fill should suggest standard benefits based on employment type

---

### 1.2 Application Deadline / Auto-Expiry Date
**FLOW.md requirement (line 184):** Application deadline / auto-expiry date

**Current state:** Not collected. Postings stay open indefinitely.

**Why it matters:**
- Prevents stale listings cluttering the marketplace
- Creates urgency for applicants
- Auto-closes when deadline reached (R5)

**Where to add:**
1. Add `expiryDate` timestamp to `jobPostings` schema (nullable)
2. Add date picker to PostJobForm
3. Cron job to auto-close expired postings (status → `expired`)
4. Default: 30 days from posting date

---

### 1.3 Nice-to-Have vs. Required Skills
**FLOW.md requirement (lines 174-175):** Required skills + Nice-to-have skills

**Current state:** Only one `skills` array; no distinction.

**Why it matters:**
- Hard filters should use required skills
- Nice-to-have skills boost match score but don't filter
- Prevents over-filtering (rejecting 95% match over missing one nice-to-have)

**Where to add:**
1. Add `niceToHaveSkills` text array to `jobPostings` schema
2. Add second skill input section in PostJobForm (after required skills)
3. Matching logic: required skills = hard filter; nice-to-have = scoring boost

---

## 2. Missing Validation & Guards

### 2.1 Discrimination Filter (§2.2, line 187-188)
**FLOW.md requirement:** AI refuses and strips race, gender, age, marital-status criteria, and explains why

**Current state:** Not implemented.

**Why it matters:**
- Legal compliance (Employment Act 1955, Gender Equality Act)
- Platform reputation and ethics
- Prevents discriminatory postings from going live

**Where to add:**
1. AI-fill function should detect discriminatory terms in description/responsibilities
2. If detected, show modal: "We removed discriminatory criteria. Here's why..."
3. Strip offending text automatically
4. Superadmin review should flag residual discrimination

**Example triggers:**
- "Male candidates only"
- "Ages 21-30"
- "Prefer Chinese-speaking"
- "Single preferred"

---

### 2.2 Minimum Wage Check (§2.2, line 189-190)
**FLOW.md requirement:** National minimum is **RM1,700/month** (in force 1 Feb 2025)

**Current state:** No validation on `salaryMin`.

**Why it matters:**
- Legal compliance (Minimum Wages Order 2024)
- Prevents posting jobs below legal minimum
- Platform liability if facilitating illegal postings

**Where to add:**
1. On salary input blur/change, validate `salaryMin >= 1700`
2. If below, show error: "Minimum wage in Malaysia is RM1,700/month (as of Feb 2025)"
3. Block submission if below minimum
4. Allow override for internships/part-time with explanation

- **Actual AI matching/ranking backend**



---

## 3. Missing Backend Logic — THE CRITICAL GAP

### 3.1 AI Matching & Ranking Algorithm (§0.5, §6.2)
**FLOW.md requirement:** Matching architecture: MASCO + ESCO via ISCO-08, layer order, salary tolerance (R11), qualification floor (R14)

**Current state:** **ZERO matching logic exists.**

**Why it matters:**
- UI claims "Matched by AI" but backend does nothing
- MatchHint badges show field mappings but no actual matching happens
- **Core differentiator is marketing, not reality**
- Every field collected (skills, experience, education, languages) is unused

**Where to add:**
1. Create `/api/employer/job-postings/[id]/matches` endpoint
2. Query jobseeker profiles with hard filters + soft scoring
3. Return ranked list with match score + explanation
4. Display in "Top Matches" card on employer dashboard

**Scoring weights (per FLOW.md line 627 — to be tuned empirically):**
- Required skills overlap: 40%
- MASCO occupation match: 25%
- Experience level fit: 15%
- Semantic similarity (LLM): 10%
- Nice-to-have skills: 10%

---

### 3.2 Industry Normalization to MASCO Codes (§0.4)
**FLOW.md requirement:** AI normalizes messy employer input to a MASCO occupation code

**Current state:** `industry` stored as free text; no MASCO integration.

**Why it matters:**
- MASCO (Malaysia Standard Classification of Occupations) is government standard
- Enables matching based on occupation codes, not messy strings

---

### 3.3 Skill Normalization to ESCO Codes (§0.4, R1)
**FLOW.md requirement:** Skills normalized to ESCO skill codes

**Current state:** Skills stored as free text arrays.

**Why it matters:**
- "Photoshop" / "Adobe Photoshop" / "PS" are 4 strings, 1 skill
- BM/Manglish terms need local alias table

---

### 3.4 Material Edit Notifications (§2.3, R6)
**FLOW.md requirement:** If employer changes salary/location after applications exist, notify all applicants

**Current state:** No notification logic.

**Where to add:**
1. Detect material changes on PATCH
2. Email all applicants with diff
3. Add "Confirm Interest" button (7-day deadline)
4. Cron job: auto-withdraw no response after 7 days

---

## 4. Priority Ranking

### Must-Have (Before Public Launch)
1. ✅ Basic form fields (done)
2. ❌ **AI matching algorithm (core value prop)**
3. ❌ Application deadline / expiry date
4. ❌ Minimum wage check (legal compliance)
5. ❌ Discrimination filter (legal + ethical)

### Should-Have (Stage 2)
6. ❌ Nice-to-have vs. required skills
7. ❌ Material edit notifications (R6)
8. ❌ MASCO + ESCO normalization
9. ❌ Benefits field

### Nice-to-Have (Competitive Edge)
10. ❌ Skills suggestion (autocomplete)
11. ❌ Salary benchmarking
12. ❌ Draft auto-save

---

## 5. Implementation Checklist

**Critical Path (MVP):**
- [ ] Build AI matching algorithm endpoint
- [ ] Add hard filters (experience, education, location, authorization)
- [ ] Add soft scoring (skills overlap, semantic similarity)
- [ ] Display match results in employer dashboard

**Schema Changes:**
- [ ] Add `expiryDate` timestamp
- [ ] Add `niceToHaveSkills` array
- [ ] Add `benefits` text field
- [ ] Add `mascoCode` varchar
- [ ] Add `skillAliases` table

**Validation & Guards:**
- [ ] Minimum wage validation (RM1,700 floor)
- [ ] Discrimination filter (AI text scan)
- [ ] Material edit detection + notification flow

**Cron Jobs:**
- [ ] Auto-close expired postings
- [ ] Auto-withdraw unconfirmed applicants (R6)

---

## 6. Known Blockers

1. **MASCO API Access** — Need government API key or static reference data
2. **ESCO Integration** — Need to download/host ESCO v1.2 taxonomy (13,890 skills)
3. **LLM for Matching** — Need embeddings model for semantic similarity
4. **Discrimination Detection** — Need LLM prompt tuning

---

## 7. Bottom Line

**The "Post a Job" form collects all the right data, but nothing uses it.**

The matching algorithm is the most critical gap. Without it, the platform is a basic job board with an AI-fill gimmick, not an AI-native matching platform. Everything else (MASCO, ESCO, discrimination filter, min wage check) can wait — but the matching logic cannot.
