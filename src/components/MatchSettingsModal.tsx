"use client";

export type CriteriaFlags = {
  skills: boolean;
  softSkills: boolean;
  niceToHaveSkills: boolean;
  experience: boolean;
  industry: boolean;
  workArrangement: boolean;
  employmentType: boolean;
  workAuthorization: boolean;
  drivingLicense: boolean;
};

const CRITERIA_LABELS: { key: keyof CriteriaFlags; label: string; hint: string }[] = [
  { key: "skills", label: "Required skills", hint: "Scored — 35% of the blend" },
  { key: "softSkills", label: "Soft skills", hint: "Scored — 10% of the blend" },
  { key: "niceToHaveSkills", label: "Nice-to-have skills", hint: "Scored — 10% of the blend" },
  { key: "experience", label: "Experience", hint: "Scored — 15% of the blend" },
  { key: "industry", label: "Industry", hint: "Scored — 10% of the blend" },
  { key: "workArrangement", label: "Work arrangement", hint: "Scored — 10% of the blend" },
  { key: "employmentType", label: "Employment type", hint: "Scored — 10% of the blend" },
  { key: "workAuthorization", label: "Work authorization", hint: "Hard filter — excludes non-matching candidates" },
  { key: "drivingLicense", label: "Driving license", hint: "Hard filter — excludes non-matching candidates" },
];

// Inline panel rendered directly on TopMatchesCard (not a popup) — sits
// alongside the score-breakdown panel, toggled the same way.
export default function MatchSettingsModal({
  criteria,
  onChange,
}: {
  criteria: CriteriaFlags;
  onChange: (next: CriteriaFlags) => void;
}) {
  async function toggle(key: keyof CriteriaFlags) {
    const next = { ...criteria, [key]: !criteria[key] };
    // Wait for the save to land before triggering TopMatchesCard's refetch —
    // otherwise a GET that beats the PATCH to the server reads the old
    // criteria, so the just-toggled checkbox doesn't affect the score until
    // the next toggle or a reload.
    try {
      await fetch("/api/employer/smart-match-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ criteria: next }),
      });
    } catch {
      // Still reflect the toggle locally and refetch — a failed save just
      // means the criteria won't persist past a reload, same as before.
    }
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-[10px] rounded-[14px] border border-[#EAEDF2] bg-[#F8FAFB] p-[12px]">
      <p className="text-xs text-[#141B2E]">Match settings</p>
      <p className="-mt-[6px] text-xs text-[#9AA3B2]">Choose which criteria count toward Top Matches.</p>
      <div className="flex flex-col gap-[10px]">
        {CRITERIA_LABELS.map(({ key, label, hint }) => (
          <label key={key} className="flex cursor-pointer items-start gap-[10px]">
            <input
              type="checkbox"
              checked={criteria[key]}
              onChange={() => toggle(key)}
              className="mt-[2px] h-[14px] w-[14px] shrink-0 accent-brand-teal-dark"
            />
            <span>
              <span className="block text-xs text-[#141B2E]">{label}</span>
              <span className="block text-xs text-[#9AA3B2]">{hint}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
