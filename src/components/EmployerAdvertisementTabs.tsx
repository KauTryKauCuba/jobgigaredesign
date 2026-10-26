"use client";

import { useState } from "react";

export type AdvertisementTab = "company" | "job";

const segment = (active: boolean) =>
  `flex-1 whitespace-nowrap rounded-full px-[14px] py-[7px] text-sm transition-colors ${
    active ? "bg-white text-[#141B2E] shadow-[0_1px_2px_rgba(0,0,0,0.08)]" : "text-[#4B5468] hover:text-[#141B2E]"
  }`;

/**
 * The Advertisement page's two kinds of ads. Both tabs stay mounted while
 * hidden, so switching tabs never loses an unsaved upload. `initialTab`
 * comes from ?tab=job (the job ad notifications link straight there).
 */
export default function EmployerAdvertisementTabs({
  company,
  job,
  initialTab = "company",
}: {
  company: React.ReactNode;
  job: React.ReactNode;
  initialTab?: AdvertisementTab;
}) {
  const [tab, setTab] = useState<AdvertisementTab>(initialTab);

  return (
    <div className="flex flex-col gap-[20px]">
      <div className="flex w-full max-w-[420px] rounded-full bg-[#F1F4F8] p-[4px]" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "company"} onClick={() => setTab("company")} className={segment(tab === "company")}>
          Company advertisement
        </button>
        <button type="button" role="tab" aria-selected={tab === "job"} onClick={() => setTab("job")} className={segment(tab === "job")}>
          Job posting advertisement
        </button>
      </div>

      <div role="tabpanel" hidden={tab !== "company"}>
        {company}
      </div>

      <div role="tabpanel" hidden={tab !== "job"}>
        {job}
      </div>
    </div>
  );
}
