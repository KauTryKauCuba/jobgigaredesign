ALTER TABLE "jobseeker_languages" ADD COLUMN "dialects" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
-- Languages are now a language plus its dialects (src/lib/languages.ts):
-- names saved as a dialect of their own move under their language.
CREATE TEMP TABLE IF NOT EXISTS "language_name_map" ("old" text PRIMARY KEY, "language" text NOT NULL, "dialect" text);--> statement-breakpoint
INSERT INTO "language_name_map" ("old", "language", "dialect") VALUES
  ('Bahasa Malaysia', 'Malay', NULL),
  ('Kelantanese Malay', 'Malay', 'Kelantanese'),
  ('Terengganu Malay', 'Malay', 'Terengganu'),
  ('Kedah Malay (Northern)', 'Malay', 'Kedah / Northern'),
  ('Negeri Sembilan Malay', 'Malay', 'Negeri Sembilan'),
  ('Sarawak Malay', 'Malay', 'Sarawak'),
  ('Sabah Malay', 'Malay', 'Sabah'),
  ('Mandarin', 'Chinese', 'Mandarin'),
  ('Cantonese', 'Chinese', 'Cantonese'),
  ('Hokkien', 'Chinese', 'Hokkien'),
  ('Hakka', 'Chinese', 'Hakka'),
  ('Teochew', 'Chinese', 'Teochew'),
  ('Hainanese', 'Chinese', 'Hainanese'),
  ('Foochow', 'Chinese', 'Foochow'),
  ('Henghua', 'Chinese', 'Henghua'),
  ('Kwongsai', 'Chinese', 'Kwongsai'),
  ('Hokchia', 'Chinese', 'Hokchia')
ON CONFLICT DO NOTHING;--> statement-breakpoint
UPDATE "jobseeker_languages" AS jl
SET "language" = m."language",
    "dialects" = CASE WHEN m."dialect" IS NULL THEN '{}'::text[] ELSE ARRAY[m."dialect"] END
FROM "language_name_map" AS m
WHERE jl."language" = m."old";--> statement-breakpoint
-- One row per language: e.g. separate Mandarin and Hokkien rows become one
-- Chinese row (the first one's levels) with both dialects.
WITH "groups" AS (
  SELECT "profile_id", "language", (array_agg("id" ORDER BY "sort_order", "created_at"))[1] AS "keep_id"
  FROM "jobseeker_languages"
  GROUP BY "profile_id", "language"
  HAVING count(*) > 1
)
UPDATE "jobseeker_languages" AS jl
SET "dialects" = ARRAY(
  SELECT DISTINCT d
  FROM "jobseeker_languages" AS same, unnest(same."dialects") AS d
  WHERE same."profile_id" = g."profile_id" AND same."language" = g."language"
)
FROM "groups" AS g
WHERE jl."id" = g."keep_id";--> statement-breakpoint
DELETE FROM "jobseeker_languages" AS jl
USING (
  SELECT "id", row_number() OVER (PARTITION BY "profile_id", "language" ORDER BY "sort_order", "created_at") AS n
  FROM "jobseeker_languages"
) AS ranked
WHERE jl."id" = ranked."id" AND ranked.n > 1;--> statement-breakpoint
-- Job requirements: a saved "Mandarin" means Chinese, Mandarin specifically;
-- "Bahasa Malaysia" means Malay, any dialect.
UPDATE "job_postings"
SET "languages" = (
  SELECT jsonb_agg(
    CASE WHEN m."old" IS NULL THEN e
         ELSE jsonb_build_object('language', m."language", 'dialect', m."dialect", 'level', e->'level') END
    ORDER BY t.ord)
  FROM jsonb_array_elements("languages") WITH ORDINALITY AS t(e, ord)
  LEFT JOIN "language_name_map" AS m ON m."old" = e->>'language'
)
WHERE jsonb_typeof("languages") = 'array' AND jsonb_array_length("languages") > 0;--> statement-breakpoint
-- The screening answers stored with each application, the same way.
UPDATE "job_applications"
SET "screening_answers" = jsonb_set("screening_answers", '{languages}', (
  SELECT COALESCE(jsonb_agg(
    CASE WHEN m."old" IS NULL THEN e
         ELSE jsonb_build_object('language', m."language", 'dialect', m."dialect", 'level', e->'level') END
    ORDER BY t.ord), '[]'::jsonb)
  FROM jsonb_array_elements("screening_answers"->'languages') WITH ORDINALITY AS t(e, ord)
  LEFT JOIN "language_name_map" AS m ON m."old" = e->>'language'
))
WHERE jsonb_typeof("screening_answers"->'languages') = 'array' AND jsonb_array_length("screening_answers"->'languages') > 0;
