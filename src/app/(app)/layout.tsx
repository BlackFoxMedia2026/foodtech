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
    <div className="dark relative grid min-h-screen grid-cols-[224px_1fr] bg-background text-foreground app-ambient">
      <aside className="border-r border-white/[0.06] bg-[hsl(var(--surface-sunken))]/80 backdrop-blur">
        <Sidebar />
      </aside>
      <div className="relative z-10 flex min-h-screen flex-col">
        <Topbar
          user={{ name: ctx.session.user?.name, email: ctx.session.user?.email }}
          venues={venueList}
          activeVenueId={ctx.venueId}
        />
        <AreaNav />
        <main className="flex-1 px-5 py-6 lg:px-8 xl:px-10">{children}</main>
      </div>
      <CommandPalette />
    </div>
  );
}
