"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Locale } from "@/lib/i18n";

const LOCALES: { v: Locale; label: string }[] = [
  { v: "it", label: "IT" },
  { v: "en", label: "EN" },
];

export function LocaleSwitch({ locale }: { locale: Locale }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function pick(next: Locale) {
    if (next === locale) return;
    const sp = new URLSearchParams(Array.from(params.entries()));
    sp.set("lang", next);
    router.replace(`${pathname}?${sp.toString()}`);
  }

  return (
    <div className="inline-flex items-center rounded-full border bg-background p-0.5 text-[10px]">
      {LOCALES.map((l) => (
        <button
          key={l.v}
          type="button"
          onClick={() => pick(l.v)}
          className={
            l.v === locale
              ? "rounded-full bg-carbon-800 px-2 py-0.5 text-sand-50"
              : "rounded-full px-2 py-0.5 text-muted-foreground hover:text-foreground"
          }
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
