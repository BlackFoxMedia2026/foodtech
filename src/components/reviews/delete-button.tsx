"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/alert-dialog";

export function ReviewDeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const confirmFn = useConfirm();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={async () => {
        const ok = await confirmFn({
          title: "Eliminare questa recensione dall'archivio?",
          description: "L'operazione è irreversibile.",
          variant: "destructive",
          confirmLabel: "Elimina",
        });
        if (!ok) return;
        setBusy(true);
        await fetch(`/api/reviews/${id}`, { method: "DELETE" });
        setBusy(false);
        router.refresh();
      }}
      disabled={busy}
    >
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  );
}
