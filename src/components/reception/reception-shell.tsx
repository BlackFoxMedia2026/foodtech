"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { TableShape } from "@prisma/client";
import {
  ArrowLeft,
  BellRing,
  CheckCircle2,
  Clock,
  Crown,
  Hourglass,
  LayoutGrid,
  LogIn,
  Phone,
  Plus,
  Search,
  UserPlus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FloorLive } from "@/components/floor/floor-live";
import type { TableLiveStatus } from "@/lib/floor";
import { cn, formatTime } from "@/lib/utils";

type View = "sala" | "coda" | "arrivi";
type BookingStatus = "PENDING" | "CONFIRMED";
type LoyaltyTier = "NEW" | "REGULAR" | "VIP" | "AMBASSADOR";
type WaitlistStatus =
  | "WAITING"
  | "OFFERED"
  | "NOTIFIED"
  | "CONFIRMED"
  | "SEATED"
  | "EXPIRED"
  | "DECLINED"
  | "CANCELLED"
  | "NO_SHOW";

type LiveTable = {
  id: string;
  label: string;
  seats: number;
  shape: TableShape;
  posX: number;
  posY: number;
  rotation: number;
  status: TableLiveStatus;
  guestName: string | null;
  bookingId: string | null;
  startsAt: string | null;
  partySize: number | null;
};

type TableOpt = { id: string; label: string; seats: number };

type Arrival = {
  id: string;
  partySize: number;
  startsAt: string;
  status: BookingStatus;
  tableLabel: string | null;
  occasion: string | null;
  notes: string | null;
  guest: {
    firstName: string;
    lastName: string | null;
    phone: string | null;
    loyaltyTier: LoyaltyTier;
  } | null;
};

type WaitlistItem = {
  id: string;
  guestName: string;
  phone: string | null;
  email: string | null;
  partySize: number;
  expectedWaitMin: number;
  status: WaitlistStatus;
  createdAt: string;
  notifiedAt: string | null;
  notes: string | null;
};

export function ReceptionShell({
  view,
  venueName,
  room,
  liveTables,
  tables,
  arrivals,
  waitlist,
}: {
  view: View;
  venueName: string;
  room: { width: number; height: number };
  liveTables: LiveTable[];
  tables: TableOpt[];
  arrivals: Arrival[];
  waitlist: WaitlistItem[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [now, setNow] = useState(() => new Date());
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [newBookingOpen, setNewBookingOpen] = useState(false);

  // Clock tick
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Auto-refresh every 30s
  useEffect(() => {
    const r = setInterval(() => router.refresh(), 30_000);
    return () => clearInterval(r);
  }, [router]);

  // Open Cmd+K via global event (the CommandPalette listens for that)
  // Per "Cerca ospite" preferiamo emettere il keyboard event in modo che la
  // command palette globale lo intercetti se montata; altrimenti fallback su
  // un dialog locale per la ricerca veloce.
  function openCommandPalette() {
    // CommandPalette listens for Cmd/Ctrl+K. In Reception layout non c'è la
    // sidebar/AppShell, quindi mostriamo un mini dialog di ricerca.
    setSearchOpen(true);
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Topbar minimale */}
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-white/10 px-5 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-gilt/15 text-gilt-light">
            <LayoutGrid className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-sand-50/55">
              Reception mode
            </p>
            <h1 className="text-display truncate text-lg font-medium leading-tight">
              {venueName}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:block rounded-lg border border-white/15 bg-white/[0.03] px-3 py-1.5 leading-tight">
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-sand-50/45">
              Ora
            </p>
            <p className="text-display text-numeric text-base font-medium tabular-nums">
              {now.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </p>
          </div>
          <Link
            href="/overview"
            className="inline-flex h-12 items-center gap-2 rounded-lg border border-white/15 bg-white/[0.03] px-4 text-sm font-medium text-sand-50/85 transition hover:bg-white/[0.07] hover:text-sand-50"
          >
            <ArrowLeft className="h-4 w-4" /> Esci modalità reception
          </Link>
        </div>
      </header>

      {/* Tab pill grosse */}
      <nav className="shrink-0 border-b border-white/10 px-5">
        <div className="flex gap-1">
          <TabPill href={`${pathname}?view=sala`} active={view === "sala"} count={liveTables.length}>
            Sala
          </TabPill>
          <TabPill href={`${pathname}?view=coda`} active={view === "coda"} count={waitlist.length}>
            Coda
          </TabPill>
          <TabPill href={`${pathname}?view=arrivi`} active={view === "arrivi"} count={arrivals.length}>
            Arrivi
          </TabPill>
        </div>
      </nav>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-6 pb-28">
        {view === "sala" && (
          <SalaView liveTables={liveTables} width={room.width} height={room.height} />
        )}
        {view === "coda" && <CodaView items={waitlist} tables={tables} now={now} />}
        {view === "arrivi" && <ArriviView items={arrivals} now={now} />}
      </div>

      {/* Bottom action bar fissa */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-carbon-900/95 backdrop-blur">
        <div className="mx-auto flex max-w-screen-2xl items-center gap-3 px-5 py-3">
          <BigActionButton tone="gold" icon={<UserPlus className="h-5 w-5" />} onClick={() => setWalkInOpen(true)}>
            Walk-in
          </BigActionButton>
          <BigActionButton tone="muted" icon={<Search className="h-5 w-5" />} onClick={openCommandPalette}>
            Cerca ospite
          </BigActionButton>
          <BigActionButton tone="muted" icon={<Plus className="h-5 w-5" />} onClick={() => setNewBookingOpen(true)}>
            Nuova prenotazione
          </BigActionButton>
        </div>
      </div>

      <WalkInDialog open={walkInOpen} onOpenChange={setWalkInOpen} tables={tables} />
      <GuestSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
      <NewBookingDialog open={newBookingOpen} onOpenChange={setNewBookingOpen} />
    </div>
  );
}

function TabPill({
  href,
  active,
  count,
  children,
}: {
  href: string;
  active: boolean;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-14 min-w-[140px] items-center justify-center gap-3 border-b-[3px] px-5 text-base font-medium transition-colors",
        active
          ? "border-gilt text-sand-50"
          : "border-transparent text-sand-50/55 hover:text-sand-50",
      )}
    >
      <span>{children}</span>
      <span
        className={cn(
          "text-numeric inline-flex h-7 min-w-[28px] items-center justify-center rounded-full px-2 text-sm tabular-nums",
          active ? "bg-gilt/20 text-gilt-light" : "bg-white/10 text-sand-50/70",
        )}
      >
        {count}
      </span>
    </Link>
  );
}

function BigActionButton({
  tone,
  icon,
  onClick,
  children,
}: {
  tone: "gold" | "muted";
  icon: React.ReactNode;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-16 flex-1 items-center justify-center gap-3 rounded-xl text-base font-semibold transition active:scale-[0.98]",
        tone === "gold"
          ? "bg-gilt text-carbon-900 hover:bg-gilt-light glow-gold"
          : "border border-white/15 bg-white/[0.04] text-sand-50 hover:bg-white/[0.08]",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

// -------------------- SALA --------------------

function SalaView({
  liveTables,
  width,
  height,
}: {
  liveTables: LiveTable[];
  width: number;
  height: number;
}) {
  return (
    <div className="space-y-4">
      <FloorLive tables={liveTables} width={width} height={height} />
    </div>
  );
}

// -------------------- CODA --------------------

function CodaView({
  items,
  tables,
  now,
}: {
  items: WaitlistItem[];
  tables: TableOpt[];
  now: Date;
}) {
  if (items.length === 0) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-16 text-center">
        <Hourglass className="h-10 w-10 text-sand-50/40" />
        <p className="mt-4 text-lg font-medium">Coda vuota</p>
        <p className="mt-1 text-sm text-sand-50/55">
          Quando la sala è piena, registra un walk-in dal pulsante in basso.
        </p>
      </div>
    );
  }
  return (
    <ul className="space-y-3">
      {items.map((w, i) => (
        <WaitlistRow key={w.id} item={w} position={i + 1} tables={tables} now={now} />
      ))}
    </ul>
  );
}

function formatWait(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h${m.toString().padStart(2, "0")}`;
}

function WaitlistRow({
  item,
  position,
  tables,
  now,
}: {
  item: WaitlistItem;
  position: number;
  tables: TableOpt[];
  now: Date;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [seatOpen, setSeatOpen] = useState(false);
  const [, startTransition] = useTransition();

  const waited = Math.max(
    0,
    Math.floor((now.getTime() - new Date(item.createdAt).getTime()) / 60_000),
  );
  const overdue = waited > item.expectedWaitMin + 10;

  async function notify() {
    setBusy(true);
    await fetch(`/api/waitlist/${item.id}/notify`, { method: "POST" });
    setBusy(false);
    startTransition(() => router.refresh());
  }

  async function seat(tableId: string | null) {
    setBusy(true);
    await fetch(`/api/waitlist/${item.id}/seat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tableId }),
    });
    setBusy(false);
    setSeatOpen(false);
    startTransition(() => router.refresh());
  }

  return (
    <li
      className={cn(
        "flex flex-col gap-4 rounded-2xl border bg-carbon-800/55 px-5 py-4 md:flex-row md:items-center",
        overdue ? "border-rose-400/45 ring-1 ring-rose-400/20" : "border-white/10",
      )}
    >
      {/* Position chip 14×14 + name */}
      <div className="flex items-center gap-4 md:flex-1 min-w-0">
        <span
          className={cn(
            "text-display text-numeric grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-2xl font-semibold tabular-nums",
            overdue ? "bg-rose-500 text-white" : "bg-sand-50 text-carbon-900",
          )}
        >
          {position}
        </span>
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold leading-tight">{item.guestName}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-sand-50/70">
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-4 w-4 text-sand-50/55" /> {item.partySize} pers
            </span>
            {item.phone && (
              <a
                href={`tel:${item.phone}`}
                className="inline-flex items-center gap-1.5 hover:text-sand-50"
              >
                <Phone className="h-4 w-4 text-sand-50/55" /> {item.phone}
              </a>
            )}
            {item.status === "NOTIFIED" && (
              <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[12px] font-medium text-violet-300">
                Notificato
              </span>
            )}
            {item.status === "OFFERED" && (
              <span className="rounded-full bg-gilt/15 px-2 py-0.5 text-[12px] font-medium text-gilt-light">
                Offerto
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Timer GROSSO 32px tabular */}
      <div className="flex shrink-0 items-center gap-5">
        <div className="text-right">
          <p
            className={cn(
              "text-display text-numeric text-[32px] font-medium leading-none tabular-nums",
              overdue ? "text-rose-300" : "text-sand-50",
            )}
          >
            {formatWait(waited)}
          </p>
          <p className="mt-1 text-[12px] text-sand-50/50 text-numeric">
            stima {item.expectedWaitMin}m
          </p>
        </div>
      </div>

      {/* Bottoni big h-14 */}
      <div className="flex gap-2 md:shrink-0">
        <button
          type="button"
          disabled={busy || item.status === "NOTIFIED"}
          onClick={notify}
          className="inline-flex h-14 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-5 text-base font-medium text-sand-50 transition hover:bg-white/[0.08] disabled:opacity-50"
        >
          <BellRing className="h-5 w-5" /> Notifica
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setSeatOpen(true)}
          className="inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-gilt px-5 text-base font-semibold text-carbon-900 transition hover:bg-gilt-light disabled:opacity-50 glow-gold"
        >
          <CheckCircle2 className="h-5 w-5" /> Accomoda
        </button>
      </div>

      {/* Dialog Accomoda */}
      <Dialog open={seatOpen} onOpenChange={setSeatOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Accomoda {item.guestName}</DialogTitle>
            <DialogDescription>
              Crea una prenotazione walk-in arrivata e assegna il tavolo.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const tid = (fd.get("tableId") as string) || null;
              seat(tid);
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label>Tavolo</Label>
              <Select name="tableId">
                <SelectTrigger>
                  <SelectValue placeholder="Da assegnare in seguito" />
                </SelectTrigger>
                <SelectContent>
                  {tables.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.label} · {t.seats} posti
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setSeatOpen(false)}>
                Annulla
              </Button>
              <Button type="submit" variant="gold" disabled={busy}>
                Conferma
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </li>
  );
}

// -------------------- ARRIVI --------------------

function ArriviView({ items, now }: { items: Arrival[]; now: Date }) {
  if (items.length === 0) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-16 text-center">
        <Clock className="h-10 w-10 text-sand-50/40" />
        <p className="mt-4 text-lg font-medium">Nessun arrivo nei prossimi 30 minuti</p>
        <p className="mt-1 text-sm text-sand-50/55">
          Goditi la pausa o controlla la coda.
        </p>
      </div>
    );
  }
  return (
    <ul className="space-y-3">
      {items.map((b) => (
        <ArrivalRow key={b.id} item={b} now={now} />
      ))}
    </ul>
  );
}

function ArrivalRow({ item, now }: { item: Arrival; now: Date }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  const start = new Date(item.startsAt);
  const diffMin = Math.round((start.getTime() - now.getTime()) / 60_000);
  const diffLabel =
    diffMin > 0 ? `tra ${diffMin}m` : diffMin === 0 ? "adesso" : `${-diffMin}m fa`;
  const overdue = diffMin <= -5;
  const isVip =
    item.guest?.loyaltyTier === "VIP" || item.guest?.loyaltyTier === "AMBASSADOR";

  const guestName = item.guest
    ? `${item.guest.firstName} ${item.guest.lastName ?? ""}`.trim()
    : "Walk-in";
  const initials = guestName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  async function markArrived() {
    setBusy(true);
    await fetch(`/api/bookings/${item.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "ARRIVED" }),
    });
    setBusy(false);
    startTransition(() => router.refresh());
  }

  return (
    <li
      className={cn(
        "flex flex-col gap-4 rounded-2xl border bg-carbon-800/55 px-5 py-4 md:flex-row md:items-center",
        overdue ? "border-rose-400/45 ring-1 ring-rose-400/20" : "border-white/10",
      )}
    >
      {/* Avatar 14×14 (h-14 w-14) + nome */}
      <div className="flex items-center gap-4 md:flex-1 min-w-0">
        <span
          className={cn(
            "grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-lg font-semibold uppercase",
            isVip ? "bg-gilt/20 text-gilt-light" : "bg-white/10 text-sand-50/85",
          )}
        >
          {initials || "?"}
        </span>
        <div className="min-w-0">
          <p className="flex items-center gap-2">
            <span className="truncate text-lg font-semibold leading-tight">{guestName}</span>
            {isVip && <Crown className="h-4 w-4 shrink-0 text-gilt-light" />}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-sand-50/70">
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-4 w-4 text-sand-50/55" /> {item.partySize} pers
            </span>
            {item.guest?.phone && (
              <a
                href={`tel:${item.guest.phone}`}
                className="inline-flex items-center gap-1.5 hover:text-sand-50"
              >
                <Phone className="h-4 w-4 text-sand-50/55" /> {item.guest.phone}
              </a>
            )}
            {item.tableLabel ? (
              <span className="rounded border border-white/15 bg-white/[0.04] px-2 py-0.5 text-[12px] text-numeric">
                T {item.tableLabel}
              </span>
            ) : (
              <span className="rounded bg-amber-400/15 px-2 py-0.5 text-[12px] font-medium text-amber-200">
                Senza tavolo
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Time grosso */}
      <div className="flex shrink-0 items-center gap-5">
        <div className="text-right">
          <p
            className={cn(
              "text-display text-numeric text-[32px] font-medium leading-none tabular-nums",
              overdue ? "text-rose-300" : "text-sand-50",
            )}
          >
            {formatTime(item.startsAt)}
          </p>
          <p
            className={cn(
              "mt-1 text-[12px] text-numeric",
              overdue ? "text-rose-300" : "text-sand-50/50",
            )}
          >
            {diffLabel}
          </p>
        </div>
      </div>

      {/* Status pill + Bottone Arrivato big */}
      <div className="flex items-center gap-2 md:shrink-0">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium",
            item.status === "CONFIRMED"
              ? "bg-emerald-400/15 text-emerald-300"
              : "bg-amber-400/15 text-amber-200",
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {item.status === "CONFIRMED" ? "Confermata" : "In attesa"}
        </span>
        <button
          type="button"
          disabled={busy}
          onClick={markArrived}
          className="inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-gilt px-5 text-base font-semibold text-carbon-900 transition hover:bg-gilt-light disabled:opacity-50 glow-gold"
        >
          <LogIn className="h-5 w-5" /> Arrivato
        </button>
      </div>
    </li>
  );
}

// -------------------- DIALOGS --------------------

function WalkInDialog({
  open,
  onOpenChange,
  tables,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tables: TableOpt[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const firstName = String(fd.get("firstName") ?? "").trim() || "Walk-in";
    const lastName = String(fd.get("lastName") ?? "").trim() || null;
    const partySize = Number(fd.get("partySize") ?? 2);
    const tableId = (fd.get("tableId") as string) || null;
    const durationMin = Number(fd.get("durationMin") ?? 90);

    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        guest: { firstName, lastName },
        partySize,
        tableId,
        startsAt: new Date().toISOString(),
        durationMin,
        source: "WALK_IN",
        status: "ARRIVED",
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setError("Impossibile registrare il walk-in.");
      return;
    }
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Walk-in</DialogTitle>
          <DialogDescription>Registra ospiti arrivati senza prenotazione.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rec-wi-firstName">Nome</Label>
              <Input id="rec-wi-firstName" name="firstName" autoFocus placeholder="Walk-in" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rec-wi-lastName">Cognome</Label>
              <Input id="rec-wi-lastName" name="lastName" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rec-wi-party">Persone</Label>
              <Input
                id="rec-wi-party"
                name="partySize"
                type="number"
                min={1}
                max={20}
                defaultValue={2}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rec-wi-duration">Durata (min)</Label>
              <Input
                id="rec-wi-duration"
                name="durationMin"
                type="number"
                min={15}
                max={300}
                defaultValue={90}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Tavolo</Label>
            <Select name="tableId">
              <SelectTrigger>
                <SelectValue placeholder="Assegna in seguito" />
              </SelectTrigger>
              <SelectContent>
                {tables.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.label} · {t.seats} posti
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-sm text-rose-300">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Annulla
            </Button>
            <Button type="submit" variant="gold" disabled={busy}>
              {busy ? "Registro…" : "Registra"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type GuestHit = {
  id: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  email: string | null;
};

function GuestSearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<GuestHit[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setQ("");
      setHits([]);
      return;
    }
  }, [open]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      return;
    }
    const controller = new AbortController();
    const id = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/guests?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        });
        if (res.ok) {
          const data = (await res.json()) as GuestHit[];
          setHits(data.slice(0, 8));
        }
      } catch {
        // ignore
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 200);
    return () => {
      controller.abort();
      clearTimeout(id);
    };
  }, [q]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cerca ospite</DialogTitle>
          <DialogDescription>Nome, telefono o email.</DialogDescription>
        </DialogHeader>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
          placeholder="Cerca…"
          className="h-12 text-base"
        />
        <ul className="max-h-[50vh] space-y-1 overflow-y-auto">
          {loading && <li className="px-3 py-2 text-sm text-sand-50/50">Cerco…</li>}
          {!loading && q.trim().length >= 2 && hits.length === 0 && (
            <li className="px-3 py-2 text-sm text-sand-50/50">Nessun risultato.</li>
          )}
          {hits.map((g) => (
            <li key={g.id}>
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  router.push(`/guests/${g.id}`);
                }}
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-sm transition hover:bg-white/[0.07]"
              >
                <span className="font-medium">
                  {g.firstName} {g.lastName ?? ""}
                </span>
                <span className="text-sand-50/55 text-xs">
                  {g.phone ?? g.email ?? ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Chiudi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewBookingDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuova prenotazione</DialogTitle>
          <DialogDescription>
            Apriamo il form completo nella pagina prenotazioni.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button
            type="button"
            variant="gold"
            onClick={() => {
              onOpenChange(false);
              router.push("/bookings/new");
            }}
          >
            Apri form
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
