"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Check,
  Crown,
  Mail,
  MessageSquare,
  NotebookPen,
  Phone,
  Plus,
  ShieldAlert,
  Tag,
  Ticket,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Props = {
  guestId: string;
  guestName: string;
  phone: string | null;
  email: string | null;
  loyaltyTier: "NEW" | "REGULAR" | "VIP" | "AMBASSADOR";
  canSeePrivate: boolean;
  canManageBookings: boolean;
  canEditMarketing: boolean;
};

export function GuestQuickActions({
  guestId,
  guestName,
  phone,
  email,
  loyaltyTier,
  canSeePrivate,
  canManageBookings,
  canEditMarketing,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [pending, setPending] = useState<string | null>(null);

  const [noteOpen, setNoteOpen] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const [couponOpen, setCouponOpen] = useState(false);
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const isVip = loyaltyTier === "VIP" || loyaltyTier === "AMBASSADOR";

  async function patchGuest(payload: Record<string, unknown>, label: string) {
    setPending(label);
    setFeedback(null);
    const res = await fetch(`/api/guests/${guestId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    setPending(null);
    if (!res.ok) {
      setFeedback("Operazione non riuscita.");
      return false;
    }
    startTransition(() => router.refresh());
    return true;
  }

  async function toggleVip() {
    if (!canEditMarketing) return;
    const newTier = isVip ? "REGULAR" : "VIP";
    const ok = await patchGuest({ loyaltyTier: newTier }, "vip");
    if (ok) {
      setFeedback(isVip ? "Loyalty tornata a Regular" : "Ospite segnato VIP");
      setTimeout(() => setFeedback(null), 2200);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {/* New booking */}
        {canManageBookings && (
          <Button asChild variant="gold" size="sm">
            <a href={`/bookings/new?guestId=${guestId}`}>
              <Plus className="h-3.5 w-3.5" /> Prenota
            </a>
          </Button>
        )}

        {/* Mark VIP toggle */}
        {canEditMarketing && (
          <Button
            variant={isVip ? "subtle" : "outline"}
            size="sm"
            onClick={toggleVip}
            disabled={pending === "vip"}
            className={cn(
              isVip && "border-gilt/30 bg-gilt/15 text-gilt-light hover:bg-gilt/20",
            )}
          >
            <Crown className="h-3.5 w-3.5" />
            {pending === "vip"
              ? "Salvataggio…"
              : isVip
                ? "VIP attivo"
                : "Segna VIP"}
          </Button>
        )}

        {/* WhatsApp */}
        {phone && (
          <Button variant="outline" size="sm" onClick={() => setWhatsappOpen(true)}>
            <MessageSquare className="h-3.5 w-3.5" /> WhatsApp
          </Button>
        )}

        {/* Tel */}
        {phone && (
          <Button asChild variant="outline" size="sm">
            <a href={`tel:${phone}`}>
              <Phone className="h-3.5 w-3.5" /> Chiama
            </a>
          </Button>
        )}

        {/* Email */}
        {email && (
          <Button asChild variant="outline" size="sm">
            <a href={`mailto:${email}`}>
              <Mail className="h-3.5 w-3.5" /> Email
            </a>
          </Button>
        )}

        {/* Apply coupon */}
        {canManageBookings && (
          <Button variant="outline" size="sm" onClick={() => setCouponOpen(true)}>
            <Ticket className="h-3.5 w-3.5" /> Coupon
          </Button>
        )}

        {/* Add tag */}
        {canEditMarketing && (
          <Button variant="outline" size="sm" onClick={() => setTagOpen(true)}>
            <Tag className="h-3.5 w-3.5" /> Tag
          </Button>
        )}

        {/* Add note */}
        <Button variant="outline" size="sm" onClick={() => setNoteOpen(true)}>
          <NotebookPen className="h-3.5 w-3.5" /> Nota
        </Button>

        {/* History */}
        <Button asChild variant="ghost" size="sm">
          <a href={`/guests/${guestId}/journey`}>
            <Calendar className="h-3.5 w-3.5" /> Storia
          </a>
        </Button>
      </div>

      {feedback && (
        <p
          className={cn(
            "text-[12px] font-medium",
            feedback.startsWith("Operazione") ? "text-status-no-show" : "text-status-confirmed",
          )}
        >
          <Check className="mr-1 inline h-3 w-3" /> {feedback}
        </p>
      )}

      <NoteDialog
        open={noteOpen}
        onOpenChange={setNoteOpen}
        guestId={guestId}
        canSeePrivate={canSeePrivate}
        onSaved={(msg) => {
          setFeedback(msg);
          setTimeout(() => setFeedback(null), 2200);
        }}
      />

      <TagDialog
        open={tagOpen}
        onOpenChange={setTagOpen}
        guestId={guestId}
        onSaved={() => {
          setFeedback("Tag aggiunto");
          setTimeout(() => setFeedback(null), 2200);
        }}
      />

      <CouponDialog
        open={couponOpen}
        onOpenChange={setCouponOpen}
        guestId={guestId}
        onSaved={() => {
          setFeedback("Coupon registrato");
          setTimeout(() => setFeedback(null), 2200);
        }}
      />

      {phone && (
        <WhatsAppDialog
          open={whatsappOpen}
          onOpenChange={setWhatsappOpen}
          phone={phone}
          guestName={guestName}
        />
      )}
    </div>
  );
}

function NoteDialog({
  open,
  onOpenChange,
  guestId,
  canSeePrivate,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  guestId: string;
  canSeePrivate: boolean;
  onSaved: (msg: string) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState<"public" | "private">("public");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const text = String(fd.get("text") ?? "").trim();
    if (!text) {
      setError("Scrivi qualcosa.");
      setBusy(false);
      return;
    }

    // Fetch current notes to append (server doesn't have append endpoint)
    const guestRes = await fetch(`/api/guests/${guestId}`);
    if (!guestRes.ok) {
      setError("Impossibile recuperare il profilo.");
      setBusy(false);
      return;
    }
    const guest = (await guestRes.json()) as {
      notes?: string | null;
      privateNotes?: string | null;
    };

    const date = new Date().toLocaleString("it-IT", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

    const field = scope === "private" ? "privateNotes" : "notes";
    const existing = (scope === "private" ? guest.privateNotes : guest.notes) ?? "";
    const next = existing ? `${existing}\n${date} · ${text}` : `${date} · ${text}`;

    const res = await fetch(`/api/guests/${guestId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ [field]: next }),
    });
    setBusy(false);
    if (!res.ok) {
      setError("Salvataggio fallito.");
      return;
    }
    onSaved(scope === "private" ? "Nota interna aggiunta" : "Nota aggiunta");
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Aggiungi nota</DialogTitle>
          <DialogDescription>
            Verrà appesa allo storico note del profilo con data e ora.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          {canSeePrivate && (
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setScope("public")}
                className={cn(
                  "flex-1 rounded-md border px-3 py-1.5 text-xs font-medium transition",
                  scope === "public"
                    ? "border-gilt/40 bg-gilt/10 text-gilt-light"
                    : "border-border text-secondary hover:bg-secondary/60",
                )}
              >
                Visibile a tutto lo staff
              </button>
              <button
                type="button"
                onClick={() => setScope("private")}
                className={cn(
                  "flex-1 inline-flex items-center justify-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium transition",
                  scope === "private"
                    ? "border-status-no-show/30 bg-status-no-show-soft text-status-no-show"
                    : "border-border text-secondary hover:bg-secondary/60",
                )}
              >
                <ShieldAlert className="h-3 w-3" /> Solo Manager
              </button>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="note-text">Testo</Label>
            <Textarea
              id="note-text"
              name="text"
              rows={4}
              placeholder={
                scope === "private"
                  ? "Es. Comportamento problematico al tavolo 12 il 3 maggio…"
                  : "Es. Preferisce tavolo finestra, ama Barolo, allergico ai crostacei."
              }
              required
              autoFocus
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Annulla
            </Button>
            <Button type="submit" variant="gold" disabled={busy}>
              {busy ? "Salvataggio…" : "Aggiungi"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TagDialog({
  open,
  onOpenChange,
  guestId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  guestId: string;
  onSaved: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const tag = String(fd.get("tag") ?? "").trim().toLowerCase();
    if (!tag) {
      setBusy(false);
      return;
    }

    const guestRes = await fetch(`/api/guests/${guestId}`);
    if (!guestRes.ok) {
      setError("Impossibile recuperare il profilo.");
      setBusy(false);
      return;
    }
    const guest = (await guestRes.json()) as { tags?: string[] };
    const tags = Array.from(new Set([...(guest.tags ?? []), tag]));

    const res = await fetch(`/api/guests/${guestId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tags }),
    });
    setBusy(false);
    if (!res.ok) {
      setError("Salvataggio fallito.");
      return;
    }
    onSaved();
    onOpenChange(false);
    router.refresh();
  }

  const suggestions = [
    "regolare",
    "weekend",
    "business",
    "vino-rosso",
    "vino-bianco",
    "vegetariano",
    "celiaco",
    "famiglia",
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Aggiungi tag</DialogTitle>
          <DialogDescription>
            Crea o aggiungi un tag al profilo. I tag servono per segmentare le campagne.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tag-input">Tag</Label>
            <Input
              id="tag-input"
              name="tag"
              placeholder="es. weekend"
              maxLength={32}
              required
              autoFocus
            />
            <div className="flex flex-wrap gap-1 pt-1">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    const input = document.getElementById("tag-input") as HTMLInputElement;
                    if (input) input.value = s;
                  }}
                  className="rounded-full bg-secondary px-2 py-0.5 text-[10.5px] text-secondary transition hover:bg-secondary/80 hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Annulla
            </Button>
            <Button type="submit" variant="gold" disabled={busy}>
              {busy ? "Salvataggio…" : "Aggiungi tag"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CouponDialog({
  open,
  onOpenChange,
  guestId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  guestId: string;
  onSaved: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const code = String(fd.get("code") ?? "").trim().toUpperCase();
    const amountCents = Number(fd.get("amountCents") ?? 0);
    if (!code) {
      setError("Inserisci il codice coupon.");
      setBusy(false);
      return;
    }
    const res = await fetch("/api/coupons/redeem", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        code,
        guestId,
        amountCents: amountCents > 0 ? amountCents : undefined,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const REASONS: Record<string, string> = {
        not_found: "Coupon non trovato.",
        expired: "Coupon scaduto.",
        exhausted: "Coupon esaurito.",
        not_yet_active: "Coupon non ancora attivo.",
        per_guest_limit: "Questo ospite ha già usato il coupon.",
        wrong_venue: "Coupon di un altro locale.",
        forbidden: "Non hai i permessi.",
        invalid: "Codice non valido.",
      };
      setError(REASONS[data?.error] ?? "Riscatto fallito.");
      return;
    }
    onSaved();
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Applica coupon</DialogTitle>
          <DialogDescription>
            Inserisci il codice del coupon e (opzionale) l'importo dello sconto applicato in cassa.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cp-code">Codice</Label>
            <Input
              id="cp-code"
              name="code"
              placeholder="es. WELCOME10"
              className="font-mono uppercase"
              maxLength={32}
              required
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cp-amount">Importo sconto applicato (cent, opzionale)</Label>
            <Input
              id="cp-amount"
              name="amountCents"
              type="number"
              min={0}
              placeholder="es. 1000 per €10,00"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Annulla
            </Button>
            <Button type="submit" variant="gold" disabled={busy}>
              {busy ? "Registrazione…" : "Riscatta"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function WhatsAppDialog({
  open,
  onOpenChange,
  phone,
  guestName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  phone: string;
  guestName: string;
}) {
  const cleanPhone = phone.replace(/[^\d+]/g, "");
  const firstName = guestName.split(" ")[0] ?? "";
  const templates = [
    {
      label: "Conferma prenotazione",
      text: `Ciao ${firstName}, ti confermiamo la prenotazione di stasera. A presto!`,
    },
    {
      label: "Reminder day-before",
      text: `Ciao ${firstName}, ti aspettiamo domani. Se hai aggiornamenti sui partecipanti, fammelo sapere qui.`,
    },
    {
      label: "Grazie post-visita",
      text: `Ciao ${firstName}, grazie per la tua visita. Sarebbe importante per noi sapere se è andato tutto bene.`,
    },
    {
      label: "Personalizzato",
      text: "",
    },
  ];

  const [textIdx, setTextIdx] = useState(0);
  const [custom, setCustom] = useState("");
  const active = textIdx === templates.length - 1 ? custom : templates[textIdx].text;
  const waUrl = `https://wa.me/${encodeURIComponent(cleanPhone)}?text=${encodeURIComponent(active)}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Invia WhatsApp a {firstName}</DialogTitle>
          <DialogDescription>
            Apre WhatsApp Web/desktop con il testo precompilato. L'invio resta manuale.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-1.5">
            {templates.map((t, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setTextIdx(i)}
                className={cn(
                  "rounded-md border px-3 py-2 text-left text-xs font-medium transition",
                  textIdx === i
                    ? "border-gilt/40 bg-gilt/10 text-gilt-light"
                    : "border-border text-secondary hover:bg-secondary/60",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {textIdx === templates.length - 1 ? (
            <Textarea
              rows={4}
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="Scrivi il messaggio personalizzato…"
              autoFocus
            />
          ) : (
            <div className="rounded-lg border border-border bg-[hsl(var(--surface-sunken))]/40 px-3 py-2.5 text-sm">
              {active}
            </div>
          )}

          <p className="text-[11px] text-tertiary">
            Numero destinatario:{" "}
            <span className="font-mono text-foreground">{cleanPhone}</span>
          </p>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button asChild variant="gold" disabled={!active.trim()}>
            <a href={waUrl} target="_blank" rel="noopener" onClick={() => onOpenChange(false)}>
              <MessageSquare className="h-3.5 w-3.5" /> Apri WhatsApp
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
