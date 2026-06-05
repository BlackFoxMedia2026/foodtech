"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BellRing,
  CheckCircle2,
  Hourglass,
  Mail,
  Phone,
  Plus,
  Trash2,
  Users,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyStateRich } from "@/components/ui/empty-state-rich";
import { formatTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

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

type Active = {
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

type Closed = {
  id: string;
  guestName: string;
  partySize: number;
  status: WaitlistStatus;
  updatedAt: string;
};

type TableOpt = { id: string; label: string; seats: number };

const STATUS_META: Record<
  WaitlistStatus,
  { label: string; tone: string }
> = {
  WAITING: { label: "In attesa", tone: "bg-secondary text-secondary" },
  OFFERED: { label: "Offerto", tone: "bg-gilt/15 text-gilt-light" },
  NOTIFIED: { label: "Notificato", tone: "bg-status-vip-soft text-status-vip" },
  CONFIRMED: { label: "Confermato", tone: "bg-status-confirmed-soft text-status-confirmed" },
  SEATED: { label: "Accomodato", tone: "bg-status-confirmed-soft text-status-confirmed" },
  EXPIRED: { label: "Scaduto", tone: "bg-status-pending-soft text-status-pending" },
  DECLINED: { label: "Rifiutato", tone: "bg-status-no-show-soft text-status-no-show" },
  CANCELLED: { label: "Annullato", tone: "bg-secondary text-secondary" },
  NO_SHOW: { label: "No-show", tone: "bg-status-no-show-soft text-status-no-show" },
};

function formatWait(min: number): string {
  if (min < 60) return `${min}m`;
  if (min < 24 * 60) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m === 0 ? `${h}h` : `${h}h${m.toString().padStart(2, "0")}`;
  }
  return ">24h";
}

export function WaitlistBoard({
  active,
  closed,
  tables,
}: {
  active: Active[];
  closed: Closed[];
  tables: TableOpt[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  async function patch(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    await fetch(`/api/waitlist/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusyId(null);
    startTransition(() => router.refresh());
  }

  async function notify(id: string) {
    setBusyId(id);
    await fetch(`/api/waitlist/${id}/notify`, { method: "POST" });
    setBusyId(null);
    startTransition(() => router.refresh());
  }

  async function promote(id: string) {
    setBusyId(id);
    const res = await fetch(`/api/waitlist/${id}/promote`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setBusyId(null);
    if (!data.ok) {
      toast.error(
        data.reason === "no_candidate"
          ? "Nessun ospite in attesa per questa dimensione tavolo."
          : data.reason === "no_contact"
            ? "Il primo in coda non ha email/telefono — chiamalo a voce."
            : "Promozione non riuscita.",
      );
    }
    startTransition(() => router.refresh());
  }

  async function seat(id: string, tableId: string | null) {
    setBusyId(id);
    await fetch(`/api/waitlist/${id}/seat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tableId }),
    });
    setBusyId(null);
    startTransition(() => router.refresh());
  }

  async function remove(id: string) {
    setBusyId(id);
    await fetch(`/api/waitlist/${id}`, { method: "DELETE" });
    setBusyId(null);
    startTransition(() => router.refresh());
  }

  // KPI sintetici
  const totalWaited = active.reduce((s, a) => {
    return s + Math.floor((now - new Date(a.createdAt).getTime()) / 60_000);
  }, 0);
  const avgWait = active.length > 0 ? Math.round(totalWaited / active.length) : 0;
  const overdueCount = active.filter((a) => {
    const w = Math.floor((now - new Date(a.createdAt).getTime()) / 60_000);
    return w > a.expectedWaitMin + 10;
  }).length;
  const seatedToday = closed.filter((c) => c.status === "SEATED").length;

  return (
    <div className="space-y-6">
      {/* KPI strip */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiTile
          label="In coda ora"
          value={String(active.length)}
          hint={active.length === 0 ? "lista vuota" : `${active.reduce((s, a) => s + a.partySize, 0)} pers`}
          emphasized
        />
        <KpiTile
          label="Attesa media"
          value={active.length === 0 ? "—" : formatWait(avgWait)}
          hint={active.length === 0 ? "" : "calcolo realtime"}
        />
        <KpiTile
          label="In ritardo"
          value={String(overdueCount)}
          hint={overdueCount > 0 ? "oltre 10m di sforamento" : "tutto in linea"}
          tone={overdueCount > 0 ? "danger" : undefined}
        />
        <KpiTile
          label="Accolti oggi"
          value={String(seatedToday)}
          hint={`${closed.length} chiusure totali`}
        />
      </section>

      {/* Add CTA */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-secondary">
          {active.length === 0
            ? "Nessuno in attesa. Aggiungi un walk-in quando la sala è piena."
            : "Tieni il polso del servizio — il primo in coda è il prossimo da accomodare."}
        </p>
        <AddDialog />
      </div>

      {/* Queue */}
      <div className="space-y-3">
        {active.length === 0 ? (
          <EmptyStateRich
            icon={Hourglass}
            title="Coda vuota"
            description="Aggiungi un walk-in quando la sala è piena. Riceverà un'offerta via SMS appena un tavolo si libera."
            primary={
              <AddDialog asPrimary />
            }
            hint="In fascia 13:00–14:00 e 20:30–22:00 lo storico mostra picchi di walk-in."
          />
        ) : (
          active.map((a, i) => {
            const waited = Math.max(
              0,
              Math.floor((now - new Date(a.createdAt).getTime()) / 60_000),
            );
            const overdue = waited > a.expectedWaitMin + 10;
            const progress = Math.min(
              100,
              (waited / Math.max(1, a.expectedWaitMin)) * 100,
            );
            const meta = STATUS_META[a.status];

            return (
              <article
                key={a.id}
                className={cn(
                  "panel relative flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:gap-5",
                  overdue && "glow-urgent border-status-no-show/30",
                )}
              >
                {/* Position + name block */}
                <div className="flex items-center gap-4 md:flex-1">
                  <span
                    className={cn(
                      "text-display text-numeric grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-2xl font-medium",
                      overdue
                        ? "bg-status-no-show text-white"
                        : "bg-foreground text-background",
                    )}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-[16px] font-semibold">{a.guestName}</p>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-medium",
                          meta.tone,
                        )}
                      >
                        {meta.label}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-secondary">
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3.5 w-3.5 text-tertiary" />
                        {a.partySize} pers
                      </span>
                      {a.phone && (
                        <a
                          href={`tel:${a.phone}`}
                          className="inline-flex items-center gap-1 hover:text-foreground"
                        >
                          <Phone className="h-3.5 w-3.5 text-tertiary" />
                          {a.phone}
                        </a>
                      )}
                      {a.email && (
                        <a
                          href={`mailto:${a.email}`}
                          className="inline-flex items-center gap-1 hover:text-foreground"
                        >
                          <Mail className="h-3.5 w-3.5 text-tertiary" />
                          {a.email}
                        </a>
                      )}
                    </div>
                    {a.notes && (
                      <p className="mt-1.5 text-[12px] italic text-tertiary line-clamp-1">
                        “{a.notes}”
                      </p>
                    )}
                  </div>
                </div>

                {/* Timer block */}
                <div className="flex shrink-0 items-center gap-4">
                  <div className="text-right">
                    <p
                      className={cn(
                        "text-display text-numeric text-3xl font-medium leading-none tabular-nums",
                        overdue ? "text-status-no-show" : "text-foreground",
                      )}
                    >
                      {formatWait(waited)}
                    </p>
                    <p className="mt-1 text-[10.5px] text-tertiary text-numeric">
                      stima {a.expectedWaitMin}m
                    </p>
                    <div className="mt-2 h-1 w-24 overflow-hidden rounded-full bg-secondary">
                      <div
                        className={cn(
                          "h-full transition-all duration-700",
                          overdue
                            ? "bg-status-no-show"
                            : progress >= 75
                              ? "bg-status-pending"
                              : "bg-status-confirmed",
                        )}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-1.5 md:flex-nowrap md:justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busyId === a.id || a.status === "NOTIFIED"}
                    onClick={() => notify(a.id)}
                    title="Notifica via SMS/Email che il tavolo è quasi pronto"
                  >
                    <BellRing className="h-3.5 w-3.5" /> Notifica
                  </Button>
                  <Button
                    variant="subtle"
                    size="sm"
                    disabled={busyId === a.id || a.status === "OFFERED"}
                    onClick={() => promote(a.id)}
                    title="Magic-link al prossimo in coda con questa dimensione"
                  >
                    Offri tavolo
                  </Button>
                  <SeatPicker
                    tables={tables}
                    onSeat={(tid) => seat(a.id, tid)}
                    disabled={busyId === a.id}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busyId === a.id}
                    onClick={() => patch(a.id, { status: "CANCELLED" })}
                    title="Annulla iscrizione"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busyId === a.id}
                    onClick={() => remove(a.id)}
                    title="Elimina"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </article>
            );
          })
        )}
      </div>

      {/* Closed log */}
      {closed.length > 0 && (
        <section className="panel">
          <header className="flex items-end justify-between gap-3 border-b border-border px-5 py-4">
            <div>
              <p className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-tertiary">
                Storico oggi
              </p>
              <h2 className="text-display mt-0.5 text-lg font-medium leading-none">
                {closed.length} chiusure
              </h2>
            </div>
            <p className="text-xs text-tertiary">
              {seatedToday} accolti · {closed.length - seatedToday} altre
            </p>
          </header>
          <div className="grid gap-2 px-5 py-4 md:grid-cols-2">
            {closed.map((c) => {
              const meta = STATUS_META[c.status];
              return (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-[hsl(var(--surface-sunken))]/40 px-3 py-2 text-sm"
                >
                  <span className="truncate">
                    <span className="font-medium">{c.guestName}</span>
                    <span className="text-tertiary"> · {c.partySize}p</span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-medium",
                        meta.tone,
                      )}
                    >
                      {meta.label}
                    </span>
                    <span className="text-numeric text-tertiary text-[11px]">
                      {formatTime(c.updatedAt)}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function KpiTile({
  label,
  value,
  hint,
  emphasized,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  emphasized?: boolean;
  tone?: "danger";
}) {
  return (
    <div
      className={cn(
        "panel px-4 py-4",
        emphasized && "bg-carbon-800/60",
      )}
    >
      <p className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-tertiary">
        {label}
      </p>
      <p
        className={cn(
          "text-display text-numeric mt-1.5 text-3xl font-medium leading-none tabular-nums",
          tone === "danger" && "text-status-no-show",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1.5 text-[11.5px] text-tertiary">{hint}</p>}
    </div>
  );
}

function SeatPicker({
  tables,
  onSeat,
  disabled,
}: {
  tables: TableOpt[];
  onSeat: (tableId: string | null) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="gold" size="sm" disabled={disabled} onClick={() => setOpen(true)}>
        <CheckCircle2 className="h-3.5 w-3.5" /> Accomoda
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assegna tavolo</DialogTitle>
            <DialogDescription>
              Crea una prenotazione walk-in arrivata e assegna un tavolo.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              onSeat((fd.get("tableId") as string) || null);
              setOpen(false);
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
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Annulla
              </Button>
              <Button type="submit" variant="gold">
                Conferma
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AddDialog({ asPrimary }: { asPrimary?: boolean } = {}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="gold" size={asPrimary ? "default" : "default"}>
          <Plus className="h-4 w-4" /> Aggiungi ospite
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuovo iscritto in lista d&apos;attesa</DialogTitle>
          <DialogDescription>
            Inserisci i dati del cliente che vuole rimanere in coda. Riceverà notifiche se aggiungi telefono o email.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const fd = new FormData(e.currentTarget);
            await fetch("/api/waitlist", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                guestName: String(fd.get("guestName") ?? "").trim(),
                partySize: Number(fd.get("partySize") ?? 2),
                expectedWaitMin: Number(fd.get("expectedWaitMin") ?? 20),
                phone: String(fd.get("phone") ?? "").trim() || null,
                email: String(fd.get("email") ?? "").trim() || null,
                notes: String(fd.get("notes") ?? "").trim() || null,
              }),
            });
            setBusy(false);
            setOpen(false);
            router.refresh();
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="wl-name">Nome</Label>
              <Input id="wl-name" name="guestName" required autoFocus maxLength={80} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wl-party">Persone</Label>
              <Input
                id="wl-party"
                name="partySize"
                type="number"
                min={1}
                max={20}
                defaultValue={2}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wl-wait">Attesa stimata (min)</Label>
              <Input
                id="wl-wait"
                name="expectedWaitMin"
                type="number"
                min={0}
                max={240}
                defaultValue={20}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wl-phone">Telefono</Label>
              <Input id="wl-phone" name="phone" placeholder="+39 …" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wl-email">Email</Label>
              <Input id="wl-email" name="email" type="email" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="wl-notes">Note</Label>
              <Textarea id="wl-notes" name="notes" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Annulla
            </Button>
            <Button type="submit" variant="gold" disabled={busy}>
              {busy ? "Aggiunta…" : "Aggiungi alla coda"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
