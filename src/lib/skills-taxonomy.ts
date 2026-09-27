import "server-only";

// INTERIM measure, not the long-term design: FLOW.md §0.4/R1 specs a proper
// ESCO-normalized skills taxonomy (skillAliases table in db/schema.ts,
// mapping BM/Manglish terms to ESCO skill URIs) as the intended fix for
// exactly this problem — see IMPLEMENTATION_GAPS.md, which calls skill/
// occupation-code matching the most critical open gap. That table exists but
// is unwired (no seed data, no query usage anywhere). Until it's built out,
// this hand-curated alias list is a reasonable stopgap — but it shouldn't
// keep growing indefinitely as a substitute for the real ESCO integration.
//
// Skills are entered as freeform tags (OnboardingForm.tsx / EmployerJobsView.tsx),
// including LLM-suggested strings (src/app/api/*/suggest-skills), so the same
// skill routinely ends up stored under different spellings — "React.js",
// "React", "ReactJS" — which would silently fail to match under a plain
// case-insensitive string comparison. This table maps known variant spellings
// to one canonical id so matching.ts can compare skills by meaning rather than
// by exact string. Anything not listed here still falls back to punctuation/
// case-insensitive exact matching via canonicalizeSkill().
//
// Add new variants as they're observed in real user data — this is a living
// list, not an exhaustive taxonomy.
const SKILL_ALIAS_GROUPS: string[][] = [
  ["javascript", "js", "vanilla js", "ecmascript"],
  ["typescript", "ts"],
  ["react", "reactjs", "react.js"],
  ["react native", "reactnative"],
  ["next.js", "nextjs", "next js", "next"],
  ["vue", "vuejs", "vue.js"],
  ["nuxt", "nuxtjs", "nuxt.js"],
  ["angular", "angularjs", "angular.js"],
  ["node", "nodejs", "node.js"],
  ["express", "expressjs", "express.js"],
  ["nestjs", "nest.js", "nest"],
  ["html", "html5"],
  ["css", "css3"],
  ["tailwind", "tailwindcss", "tailwind css"],
  ["sass", "scss"],
  ["python", "python3", "py"],
  ["golang", "go"],
  ["c#", "csharp", "c sharp"],
  ["c++", "cpp", "c plus plus"],
  ["dotnet", ".net", "asp.net", "aspnet"],
  ["postgresql", "postgres", "psql"],
  ["mysql", "my sql"],
  ["mongodb", "mongo"],
  ["sql server", "mssql", "microsoft sql server"],
  ["aws", "amazon web services"],
  ["gcp", "google cloud", "google cloud platform"],
  ["azure", "microsoft azure"],
  ["docker", "containerization"],
  ["kubernetes", "k8s"],
  ["ci/cd", "cicd", "ci cd", "continuous integration"],
  ["git", "github", "version control"],
  ["rest api", "restful api", "rest", "restful"],
  ["graphql", "graph ql"],
  ["figma", "figma design"],
  ["photoshop", "adobe photoshop"],
  ["illustrator", "adobe illustrator"],
  ["excel", "microsoft excel", "ms excel"],
  ["powerpoint", "microsoft powerpoint", "ms powerpoint"],
  ["word", "microsoft word", "ms word"],
  ["seo", "search engine optimization"],
  ["sem", "search engine marketing"],
  ["ui/ux", "ui ux", "ui/ux design", "uiux"],
  ["project management", "pm"],
  ["communication", "communication skills"],
  ["teamwork", "team work", "team player"],
  ["problem solving", "problem-solving"],
  ["time management", "time-management"],
  ["leadership", "team leadership"],
  ["customer service", "customer service skills"],
  ["adaptability", "adaptable"],
  ["critical thinking", "critical-thinking"],
];

const ALIAS_TO_CANONICAL: Map<string, string> = new Map();
for (const group of SKILL_ALIAS_GROUPS) {
  const canonical = group[0];
  for (const variant of group) {
    ALIAS_TO_CANONICAL.set(stripToKey(variant), canonical);
  }
}

// Collapses to a bare alphanumeric key so punctuation/spacing differences
// ("React.js" vs "React JS" vs "react-js") don't prevent an alias lookup.
function stripToKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9+#]/g, "");
}

// Resolves a freeform skill string to a canonical id for comparison purposes.
// Known variants collapse to the same id (see SKILL_ALIAS_GROUPS); anything
// unrecognized falls back to its punctuation/case-insensitive key, which
// still fixes the common case of pure casing/spacing/punctuation differences
// even without an explicit alias entry.
export function canonicalizeSkill(value: string): string {
  const key = stripToKey(value);
  return ALIAS_TO_CANONICAL.get(key) ?? key;
}
