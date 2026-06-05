"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CalendarPlus,
  CalendarRange,
  ChefHat,
  Gauge,
  Hourglass,
  LayoutDashboard,
  LayoutPanelLeft,
  LineChart,
  type LucideIcon,
  Megaphone,
  PhoneCall,
  PiggyBank,
  Search,
  Settings,
  Star,
  Tv,
  User as UserIcon,
  Users,
  Workflow,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Action = {
  id: string;
  label: string;
  hint?: string;
  sublabel?: string;
  group: "Vai a" | "Azioni rapide" | "Ospiti";
  icon: LucideIcon;
  run: (router: ReturnType<typeof useRouter>) => void;
  keywords?: string[];
};

const STATIC_ACTIONS: Action[] = [
  // Quick actions
  {
    id: "new-booking",
    label: "Nuova prenotazione",
    hint: "N",
    group: "Azioni rapide",
    icon: CalendarPlus,
    run: (r) => r.push("/bookings/new"),
    keywords: ["prenotazione", "booking", "tavolo"],
  },
  {
    id: "walk-in",
    label: "Walk-in",
    group: "Azioni rapide",
    icon: CalendarRange,
    run: (r) => r.push("/bookings?walkin=1"),
    keywords: ["walkin", "senza prenotazione"],
  },
  // Navigation
  { id: "nav-overview", label: "Panoramica", group: "Vai a", icon: LayoutDashboard, run: (r) => r.push("/overview") },
  { id: "nav-now", label: "Sala live", group: "Vai a", icon: Tv, run: (r) => r.push("/now") },
  { id: "nav-bookings", label: "Prenotazioni", group: "Vai a", icon: CalendarRange, run: (r) => r.push("/bookings") },
  { id: "nav-waitlist", label: "Lista d'attesa", group: "Vai a", icon: Hourglass, run: (r) => r.push("/waitlist") },
  { id: "nav-kitchen", label: "Cucina", group: "Vai a", icon: ChefHat, run: (r) => r.push("/kitchen") },
  { id: "nav-guests", label: "CRM ospiti", group: "Vai a", icon: Users, run: (r) => r.push("/guests"), keywords: ["clienti", "crm"] },
  { id: "nav-reviews", label: "Recensioni", group: "Vai a", icon: Star, run: (r) => r.push("/reviews") },
  { id: "nav-floor", label: "Sala (editor)", group: "Vai a", icon: LayoutPanelLeft, run: (r) => r.push("/floor") },
  { id: "nav-campaigns", label: "Campagne", group: "Vai a", icon: Megaphone, run: (r) => r.push("/campaigns") },
  { id: "nav-automations", label: "Automazioni", group: "Vai a", icon: Workflow, run: (r) => r.push("/automations") },
  { id: "nav-chat", label: "Chatbot", group: "Vai a", icon: PhoneCall, run: (r) => r.push("/chat") },
  { id: "nav-cockpit", label: "Cockpit", group: "Vai a", icon: Gauge, run: (r) => r.push("/cockpit") },
  { id: "nav-insights", label: "Performance", group: "Vai a", icon: LineChart, run: (r) => r.push("/insights"), keywords: ["analytics"] },
  { id: "nav-finance", label: "Controllo economico", group: "Vai a", icon: PiggyBank, run: (r) => r.push("/finance") },
  { id: "nav-settings", label: "Impostazioni", group: "Vai a", icon: Settings, run: (r) => r.push("/settings") },
];

type GuestSearchResult = {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  loyaltyTier: string;
  totalVisits: number;
};

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [guests, setGuests] = useState<GuestSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      setGuests([]);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  // Async guest search (debounced)
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setGuests([]);
      setSearching(false);
      abortRef.current?.abort();
      return;
    }

    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    const id = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/guests?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          setGuests([]);
          return;
        }
        const data = (await res.json()) as GuestSearchResult[];
        setGuests(data.slice(0, 6));
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setGuests([]);
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 220);

    return () => {
      clearTimeout(id);
      controller.abort();
    };
  }, [query]);

  const guestActions = useMemo<Action[]>(
    () =>
      guests.map((g) => {
        const name = `${g.firstName} ${g.lastName ?? ""}`.trim();
        const sub =
          g.email ?? g.phone ?? `${g.totalVisits} visite · ${g.loyaltyTier.toLowerCase()}`;
        return {
          id: `guest-${g.id}`,
          label: name,
          sublabel: sub,
          group: "Ospiti" as const,
          icon: UserIcon,
          run: (r) => r.push(`/guests/${g.id}`),
          keywords: [g.email ?? "", g.phone ?? "", g.lastName ?? ""].filter(Boolean),
        };
      }),
    [guests],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const staticFiltered = !q
      ? STATIC_ACTIONS
      : STATIC_ACTIONS.filter((a) => {
          const haystack = [a.label, ...(a.keywords ?? [])].join(" ").toLowerCase();
          return haystack.includes(q);
        });
    return [...guestActions, ...staticFiltered];
  }, [query, guestActions]);

  const grouped = useMemo(() => {
    const out: Record<string, Action[]> = {
      Ospiti: [],
      "Azioni rapide": [],
      "Vai a": [],
    };
    for (const a of filtered) out[a.group].push(a);
    return out;
  }, [filtered]);

  function trigger(action: Action) {
    setOpen(false);
    action.run(router);
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const selected = filtered[activeIndex];
      if (selected) trigger(selected);
    }
  }

  let runningIndex = -1;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-xl gap-0 overflow-hidden p-0">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 text-tertiary" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={onKey}
            placeholder="Cerca ospite, vai a sezione, esegui azione…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-tertiary"
          />
          {searching && (
            <span className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-tertiary">
              cerco…
            </span>
          )}
          <span className="kbd">Esc</span>
        </div>
        <div className="max-h-[420px] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-tertiary">
              Nessun risultato per “{query}”.
            </p>
          ) : (
            (Object.keys(grouped) as Array<keyof typeof grouped>).map((groupName) => {
              const items = grouped[groupName];
              if (items.length === 0) return null;
              return (
                <div key={groupName} className="px-1 pb-1 pt-2 first:pt-0">
                  <p className="px-2 pb-1 text-[10px] font-medium uppercase tracking-[0.14em] text-tertiary">
                    {groupName}
                  </p>
                  <ul>
                    {items.map((action) => {
                      runningIndex += 1;
                      const active = runningIndex === activeIndex;
                      const Icon = action.icon;
                      return (
                        <li key={action.id}>
                          <button
                            type="button"
                            onClick={() => trigger(action)}
                            onMouseEnter={() => setActiveIndex(runningIndex)}
                            className={cn(
                              "flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors",
                              active
                                ? "bg-secondary text-foreground"
                                : "text-foreground/90 hover:bg-secondary/60",
                            )}
                          >
                            <Icon
                              className={cn(
                                "h-4 w-4",
                                action.group === "Ospiti"
                                  ? "text-gilt-light"
                                  : "text-tertiary",
                              )}
                            />
                            <div className="min-w-0 flex-1 text-left">
                              <p className="truncate">{action.label}</p>
                              {action.sublabel && (
                                <p className="truncate text-[11px] text-tertiary">
                                  {action.sublabel}
                                </p>
                              )}
                            </div>
                            {action.hint && <span className="kbd">{action.hint}</span>}
                            <ArrowRight
                              className={cn(
                                "h-3.5 w-3.5 transition-opacity",
                                active ? "opacity-100 text-tertiary" : "opacity-0",
                              )}
                            />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })
          )}
        </div>
        <div className="flex items-center justify-between border-t border-border bg-[hsl(var(--surface-sunken))] px-4 py-2 text-[11px] text-tertiary">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="kbd">↵</span> apri
            </span>
            <span className="flex items-center gap-1">
              <span className="kbd">↑</span>
              <span className="kbd">↓</span> naviga
            </span>
          </div>
          <span className="flex items-center gap-1">
            <span className="kbd">⌘</span>
            <span className="kbd">K</span>
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
