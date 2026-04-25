import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Vista Sala · Tavolo",
};

export default function NowLayout({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen bg-carbon-900 text-sand-50">{children}</main>;
}
