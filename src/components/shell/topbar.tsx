import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VenueSwitcher } from "./venue-switcher";
import { NotificationBell } from "./notification-bell";
import { UserMenu } from "./user-menu";
import { CommandTrigger } from "./command-trigger";

export function Topbar({
  user,
  venues,
  activeVenueId,
}: {
  user: { name?: string | null; email?: string | null };
  venues: { id: string; name: string; city: string | null }[];
  activeVenueId: string;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-border bg-background/85 px-6 backdrop-blur">
      <div className="flex items-center gap-3">
        <VenueSwitcher venues={venues} activeId={activeVenueId} />
        <CommandTrigger />
      </div>

      <div className="flex items-center gap-2">
        <Button asChild size="sm" variant="gold" className="hidden sm:inline-flex">
          <Link href="/bookings/new">
            <Plus className="h-4 w-4" />
            Nuova prenotazione
          </Link>
        </Button>
        <NotificationBell />
        <UserMenu user={user} />
      </div>
    </header>
  );
}
