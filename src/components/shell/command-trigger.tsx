"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";

function isMac() {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform);
}

export function CommandTrigger() {
  const [mac, setMac] = useState(false);

  useEffect(() => {
    setMac(isMac());
  }, []);

  function open() {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
  }

  return (
    <button
      type="button"
      onClick={open}
      className="hidden h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm text-tertiary transition-colors hover:border-border-strong hover:text-secondary md:flex md:w-[320px]"
    >
      <Search className="h-4 w-4" />
      <span className="flex-1 text-left">Cerca o vai a…</span>
      <span className="flex items-center gap-1">
        <span className="kbd">{mac ? "⌘" : "Ctrl"}</span>
        <span className="kbd">K</span>
      </span>
    </button>
  );
}
