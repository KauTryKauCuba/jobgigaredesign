# Poster Generator — nano banana prompt (reference)

Finalized prompt template for AI-generated poster backgrounds/layouts, worked
out with the user against 5 reference recruitment-flyer images. Kept here for
when the Poster Generator feature is upgraded from the current pure-canvas
render to an AI-assisted one.

Placeholders to fill in per job posting when wiring this up:
- Company name / logo
- Job title (`GRAPHIC DESIGNER` below is an example)
- Requirements bullets (from the posting's `skills` + `minYearsExperience` +
  `minQualificationTier`)
- Location, salary range, employment type
- Contact info (currently no company email/phone field exists — would need
  to either add one, or keep this as "Apply now on JobGiga" instead of a
  literal email/phone)
- Industry-driven theme (color palette / illustration subject) — see the
  8-group industry→theme mapping discussed in chat (Creative & Media,
  Technology, Healthcare & Wellness, Finance & Professional, Industrial &
  Logistics, Hospitality & Retail, Education & Public Good, General/Corporate)

## The prompt

```
Nano Banana Prompt — Balanced Recruitment Flyer

Create a premium, polished corporate recruitment flyer for a professional company. Portrait orientation, 4:5 ratio.

IMPORTANT: Use the attached reference images as the primary visual direction. Match their overall balance, spacing, information structure, proportions, and professional recruitment-flyer aesthetic. Create an original design and do not copy the exact artwork.

The design should feel like a real professional recruitment advertisement designed by a corporate creative agency, not an editorial typography poster and not a generic AI-generated flyer.

OVERALL DESIGN
Use a clean, balanced, sophisticated composition with a clear visual hierarchy.
The design should contain:
company logo at the top
recruitment headline
job title
supporting visual / illustration
requirements
job information
location
strong but clean Apply Now CTA
Do NOT make the headline overwhelmingly large.
The headline should occupy approximately 20–25% of the upper section, leaving enough space for the job information and visual elements.
The overall poster should feel balanced from top to bottom, with no single element dominating the entire design.

HEADER
Place a small, clean company logo near the top.
Below the logo:
WE ARE
HIRING
Use a modern, professional sans-serif font similar to Montserrat, Poppins, or Inter.
"WE ARE" should be smaller.
"HIRING" should be larger and bold, but not enormous.
Use dark navy for the main typography with teal as an accent.
Keep the headline compact and elegant.
Add:
GRAPHIC DESIGNER
inside a clean teal/navy rectangular or softly rounded badge.

MAIN VISUAL
Include a professional modern graphic-design themed illustration on one side of the composition.
The illustration can show a designer working with creative tools, monitor/tablet, typography, color palette, design elements, or abstract graphic-design objects.
Use a clean contemporary vector / semi-3D illustration style.
It should feel sophisticated and professional, similar to a corporate recruitment campaign.
The illustration should support the design, not dominate it.
Do not use a childish cartoon style.
Do not use a photorealistic person.

INFORMATION SECTION
Create a structured information area using simple rectangular sections, thin borders, dividers and subtle rounded corners.
Do not make every piece of information a separate floating card.
Include:
REQUIREMENTS
• Proven portfolio in graphic design
• Proficiency in Adobe Creative Suite
• Strong typography and layout skills
• 2+ years experience
LOCATION
Kota Damansara, Selangor
SALARY
RM3,000–5,000
EMPLOYMENT TYPE
Full-time
Use small clean icons where appropriate.
Keep the information highly readable.

VISUAL STYLE
Use a restrained corporate color palette:
Deep navy + medium/brighter blue + teal + white/light grey
Optional very small warm-gold accent.
Use:
subtle geometric lines
circles
thin grids
abstract blue shapes
subtle background patterns
clean dividers
simple line icons
These elements should create visual interest without making the poster busy.

BOTTOM CTA
At the bottom, use a clean dark navy horizontal section.
Display:
APPLY NOW
Contact:
hr@company.com
+60 XX-XXX XXXX
Make the CTA noticeable but not oversized.

TYPOGRAPHY — VERY IMPORTANT
Typography should be moderately bold, clean and professional.
Do NOT use extremely heavy typography.
Do NOT make "HIRING" gigantic.
Do NOT make typography the main artwork.
Use approximately:
Headline: 36–48% visual emphasis
Job title: 20–25%
Section headings: 10–15%
Body text: 8–12%
The visual illustration and information sections should have comparable visual importance to the headline.

COMPOSITION
Think of the layout as:
Logo → Headline → Job title → Visual + Information → Requirements → Job details → CTA
Maintain generous margins and consistent alignment.
Use a professional grid.
Avoid excessive empty space.
Avoid excessive visual density.
Avoid oversized typography.
Avoid excessive rounded cards.
Avoid giant text.
Avoid giant illustrations.
Avoid excessive gradients.
Avoid glossy effects.
Avoid childish cartoon graphics.
Avoid stock photography.
Avoid random decorative objects.
The final result should look like a polished, realistic corporate recruitment flyer that could genuinely be posted on LinkedIn, Instagram, or used as a printed recruitment advertisement.
```

## Notes for implementation later

- Needs reference images attached alongside the prompt (the model was steered
  by "use the attached reference images" — pure text-only won't reproduce
  this quality on its own).
- Text accuracy (bullets, salary, contact info) still isn't guaranteed
  character-for-character — may still want to composite exact text via
  canvas on top of the AI background, same as the hybrid approach discussed.
- Real company logo isn't reproduced by the model — would need compositing
  the actual `logoUrl` on top afterward if pixel-accurate branding matters.
- No image-generation API is currently configured in this app's env vars
  (only `MIMO_API_KEY` for speech-to-text, `DEEPSEEK_API_KEY` for text) — an
  image-gen provider/key would need to be added when this is built.
