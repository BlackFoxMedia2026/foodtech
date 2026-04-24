import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Prenota · Tavolo",
  description: "Prenota il tuo tavolo o esperienza in pochi secondi.",
};

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-gradient-to-b from-sand-50 to-sand-100 text-foreground">
      {children}
    </main>
  );
}
