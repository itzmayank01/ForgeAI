import type { Metadata } from "next";
import "./globals.css";
import { NavShell } from "@/components/nav-shell";
import { buildNavSections } from "@/lib/nav-sections";

export const metadata: Metadata = {
  title: "ForgeAI — The Agent That Builds Agents",
  description:
    "A factory that turns a one-paragraph brief and a folder of documents into a tested, self-improving retrieval agent — with the evidence to judge it.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const navSections = await buildNavSections();
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased text-ink bg-canvas">
        <NavShell navSections={navSections}>{children}</NavShell>
      </body>
    </html>
  );
}
