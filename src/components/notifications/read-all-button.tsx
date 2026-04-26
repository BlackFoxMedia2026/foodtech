"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ReadAllButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/notifications/read-all", { method: "POST" });
        setBusy(false);
        router.refresh();
      }}
    >
      <CheckCheck className="h-3.5 w-3.5" />
      {busy ? "…" : "Segna tutte come lette"}
    </Button>
  );
}
