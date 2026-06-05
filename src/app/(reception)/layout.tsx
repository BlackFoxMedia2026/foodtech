import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reception · Tavolo",
};

export default function ReceptionLayout({ children }: { children: React.ReactNode }) {
  // Layout fullscreen senza sidebar, ottimizzato per tablet.
  // Font base 16px (text-base), tap target minimi 56px.
  return (
    <main className="min-h-screen bg-carbon-900 text-sand-50 text-base">
      {children}
    </main>
  );
}
