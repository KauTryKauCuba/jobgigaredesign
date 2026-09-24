import Image from "next/image";
import Link from "next/link";

const LINK_GROUPS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "For Employers",
    links: [{ label: "Post a job", href: "/employer" }],
  },
  {
    title: "For Jobseekers",
    links: [{ label: "Find a job", href: "/jobseeker" }],
  },
];

export default function Footer({ accent = "teal" }: { accent?: "teal" | "gold" }) {
  const accentClass = accent === "gold" ? "text-brand-gold-dark" : "text-brand-teal-dark";

  return (
    <footer className="bg-white">
      <div className="shell flex flex-col gap-[40px] pt-[56px] pb-[32px]">
        <div className="flex flex-col justify-between gap-[32px] sm:flex-row">
          <div className="max-w-[280px]">
            <Image src="/jg-logo.svg" alt="JobGiga" width={111} height={28} />
            <p className="mt-[8px] text-xs leading-[20px] text-[#4B5468]">
              Hiring in Malaysia, without the forms — talk to an AI assistant that builds your
              job post or profile.
            </p>
          </div>

          <div className="flex gap-[48px]">
            {LINK_GROUPS.map((group) => (
              <div key={group.title}>
                <p className="text-xs tracking-[0.04em] text-[#9AA3B2] uppercase">
                  {group.title}
                </p>
                <ul className="mt-[12px] flex flex-col gap-[10px]">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className={`text-sm ${accentClass} transition-opacity hover:opacity-70`}
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col-reverse items-center justify-between gap-[12px] border-t border-black/[0.06] pt-[20px] sm:flex-row">
          <p className="text-xs text-[#9AA3B2]">
            © {new Date().getFullYear()} JobGiga. Made for Malaysia.
          </p>
        </div>
      </div>
    </footer>
  );
}
