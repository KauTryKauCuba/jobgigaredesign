import { cssVarsToText, themeCssVars, type ThemeColors } from "@/lib/site-themes-shared";

// Employer is teal, jobseeker gold, superadmin blue. The superadmin pages are
// built from the employer (teal) styles, so swapping those colours for blue
// here turns the whole area — dialogs included — blue. Jobseeker gold stays,
// so jobseeker-related cards still read as jobseeker. Site themes never apply here.
const SUPERADMIN_BLUE: ThemeColors = {
  main: "#1D5FD1",
  accent: "#3B82F6",
  soft: "#EAF1FD",
  page: "#F3F6FD",
  gradient: ["#1747A6", "#1D5FD1", "#3B82F6", "#C99A1E"],
};

export default function SuperadminLayout({ children }: LayoutProps<"/superadmin">) {
  return (
    <>
      {/* Fixed, checked hex colours only — safe to inline. */}
      <style dangerouslySetInnerHTML={{ __html: `:root{${cssVarsToText(themeCssVars("employer", SUPERADMIN_BLUE))}}` }} />
      {children}
    </>
  );
}
