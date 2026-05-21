import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { AreaNav } from "@/components/shell/area-nav";
import { CommandPalette } from "@/components/shell/command-palette";
import { getActiveVenue } from "@/lib/tenant";

export default async function AppShell({ children }: { children: React.ReactNode }) {
  const ctx = await getActiveVenue();

  const venueList = ctx.allMemberships.map((m) => ({
    id: m.venue.id,
    name: m.venue.name,
    city: m.venue.city,
  }));

  return (
    <div className="grid min-h-screen grid-cols-[64px_1fr]">
      <aside className="border-r border-border bg-[hsl(var(--surface-sunken))]/60">
        <Sidebar />
      </aside>
      <div className="flex min-h-screen flex-col">
        <Topbar
          user={{ name: ctx.session.user?.name, email: ctx.session.user?.email }}
          venues={venueList}
          activeVenueId={ctx.venueId}
        />
        <AreaNav />
        <main className="mx-auto w-full max-w-[1280px] flex-1 px-6 py-8 lg:px-10">
          {children}
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}
