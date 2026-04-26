"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";

export function MenuCostInput({
  menuItemId,
  initial,
}: {
  menuItemId: string;
  initial: number;
}) {
  const router = useRouter();
  const [value, setValue] = useState((initial / 100).toFixed(2));
  const [busy, setBusy] = useState(false);

  async function save(next: string) {
    const cents = Math.round(Number(next.replace(",", ".")) * 100);
    if (Number.isNaN(cents) || cents < 0) return;
    setBusy(true);
    await fetch("/api/finance/menu-costs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ menuItemId, costCents: cents }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <Input
      className="ml-auto h-7 w-24 text-right text-xs"
      type="number"
      step="0.5"
      min={0}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => save(value)}
      disabled={busy}
    />
  );
}
