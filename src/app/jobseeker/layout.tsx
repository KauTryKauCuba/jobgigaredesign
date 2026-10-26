import SiteThemeLayer from "@/components/SiteThemeLayer";

// Every jobseeker page wears the jobseeker site theme, when one is on.
export default function JobseekerLayout({ children }: LayoutProps<"/jobseeker">) {
  return (
    <>
      <SiteThemeLayer audience="jobseeker" />
      {children}
    </>
  );
}
