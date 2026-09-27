import type { Metadata } from "next";
import { Inter } from "next/font/google";
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
      <body className="min-h-full bg-white">{children}</body>
    </html>
  );
}
