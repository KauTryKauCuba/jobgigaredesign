import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import { SIDEBAR_COLLAPSED_ATTR, SIDEBAR_COLLAPSED_KEY } from "@/lib/employer-dashboard-prefs";
import "./globals.css";

// Inter is a variable font — per next/font/google's docs, `weight` only
// takes an array for non-variable fonts; a variable font either omits
// `weight` (full range) or takes a single "min max" range string. The app
// only uses 400/600 (see DESIGN.md's Typography section), both of which are
// covered by the default variable range, so `weight` is left unset here.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "JobGiga — Hiring in Malaysia, without the forms",
  description:
    "Talk to an AI assistant that builds your job post or profile, finds the right matches, and keeps everyone in the loop.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      {/* suppressHydrationWarning: the Script below sets this attribute on
          <body> before paint, outside React's own render of this element —
          same documented pattern as any theme-flash script (e.g.
          next-themes). It's the only thing that ever touches this
          attribute, and nothing else reads this element's attributes
          during hydration, so suppressing is safe here. */}
      <body className="min-h-full bg-white" suppressHydrationWarning>
        {/* Runs before hydration (next/script's whole purpose for
            beforeInteractive — a plain <script> rendered by a component
            doesn't reliably do this, and React warns about it) so the
            employer dashboard's collapsible sidebar (EmployerDashboardShell)
            can draw its collapsed look (see globals.css) from localStorage
            immediately, instead of rendering expanded and visibly snapping
            collapsed a moment later once its own effect catches up. A no-op
            on every other page — it only ever sets an attribute nothing
            outside that one sidebar reads. */}
        <Script
          id="emp-sidebar-no-flash"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem(${JSON.stringify(SIDEBAR_COLLAPSED_KEY)})==="1"){document.body.setAttribute(${JSON.stringify(SIDEBAR_COLLAPSED_ATTR)},"true")}}catch(e){}`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
