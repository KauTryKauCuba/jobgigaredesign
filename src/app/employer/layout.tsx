import SiteThemeLayer from "@/components/SiteThemeLayer";

// Every employer page wears the employer site theme, when one is on.
export default function EmployerLayout({ children }: LayoutProps<"/employer">) {
  return (
    <>
      <SiteThemeLayer audience="employer" />
      {children}
    </>
  );
}
