"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";

// Single-row "marca letta" trigger. Kept as a small client island so the
// page itself stays a server component (we already do listNotifications()
// + unreadCount() server-side and don't want to ship that fetch logic to
// the client).
export function MarkReadButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch(`/api/notifications/${id}/read`, { method: "POST" });
        setBusy(false);
        router.refresh();
      }}
      aria-label="Segna come letta"
    >
      <Check className="h-3.5 w-3.5" />
    </Button>
  );
}
