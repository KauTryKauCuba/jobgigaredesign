import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Only regular (400) and semibold (600) are fetched — those are the only
// two weights used anywhere in the app now (see DESIGN.md's Typography
// section); no medium/bold/light faces.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "600"],
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
      <body className="min-h-full bg-white">{children}</body>
    </html>
  );
}
