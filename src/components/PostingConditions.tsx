import { UserIcon } from "./icons";
import type { PostingContact } from "@/lib/posting-contact-types";

/**
 * A job posting's start date, working hours, benefits and "Posted by"
 * contact — the same block on every jobseeker-facing view of a posting (and
 * the employer's preview of it). Each part only shows when it's set.
 */
export default function PostingConditions({
  benefits,
  startLabel,
  workingHours,
  contact,
  officeDays = null,
}: {
  benefits: string[];
  startLabel: string | null;
  workingHours: string | null;
  contact: PostingContact | null;
  // Hybrid postings, e.g. "3 days a week in the office".
  officeDays?: string | null;
}) {
  if (!startLabel && !workingHours && !officeDays && benefits.length === 0 && !contact) return null;
  return (
    <>
      {(startLabel || workingHours || officeDays) && (
        <div className="mt-[16px] grid grid-cols-1 gap-x-[20px] gap-y-[12px] sm:grid-cols-2">
          {officeDays && (
            <div>
              <p className="text-xs text-[#141B2E]">Hybrid</p>
              <p className="mt-[2px] text-sm text-[#4B5468]">{officeDays}</p>
            </div>
          )}
          {startLabel && (
            <div>
              <p className="text-xs text-[#141B2E]">Start date</p>
              <p className="mt-[2px] text-sm text-[#4B5468]">{startLabel}</p>
            </div>
          )}
          {workingHours && (
            <div>
              <p className="text-xs text-[#141B2E]">Working hours</p>
              <p className="mt-[2px] text-sm text-[#4B5468]">{workingHours}</p>
            </div>
          )}
        </div>
      )}

      {benefits.length > 0 && (
        <div className="mt-[16px]">
          <p className="text-xs text-[#141B2E]">Benefits</p>
          <div className="mt-[8px] flex flex-wrap gap-[6px]">
            {benefits.map((b) => (
              <span key={b} className="rounded-full bg-[#E7F6EC] px-[12px] py-[6px] text-xs text-[#2F7D4F]">
                {b}
              </span>
            ))}
          </div>
        </div>
      )}

      {contact && (
        <div className="mt-[16px]">
          <p className="text-xs text-[#141B2E]">Posted by</p>
          <div className="mt-[8px] flex items-center gap-[10px]">
            {contact.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={contact.avatarUrl} referrerPolicy="no-referrer" alt="" className="h-[36px] w-[36px] shrink-0 rounded-full object-cover" />
            ) : (
              <span className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-full bg-[#F1F4F8] text-[#9AA3B2]">
                <UserIcon className="h-[15px] w-[15px]" />
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm text-[#141B2E]">{contact.name}</p>
              {contact.position && <p className="truncate text-xs text-[#9AA3B2]">{contact.position}</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
