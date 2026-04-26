import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Ban, Cake, Mail, Phone, ShieldAlert, Sparkles } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoyaltyPill } from "@/components/guests/loyalty-pill";
import { LoyaltyBlockActions } from "@/components/guests/loyalty-block-actions";
import { StatusBadge } from "@/components/bookings/status-badge";
import { can, getActiveVenue } from "@/lib/tenant";
import { getGuest } from "@/server/guests";
import { loyaltyHistory } from "@/server/loyalty";
import { formatCurrency, formatDate, formatDateTime, initials } from "@/lib/utils";

export default async function GuestDetail({ params }: { params: { id: string } }) {
  const ctx = await getActiveVenue();
  const g = await getGuest(ctx.venueId, params.id);
  if (!g) notFound();
  const canSeePrivate = can(ctx.role, "view_private");
  const canEditMarketing = can(ctx.role, "edit_marketing");
  const canManageBookings = can(ctx.role, "manage_bookings");
  const txns = await loyaltyHistory(g.id, 10);

  const name = `${g.firstName} ${g.lastName ?? ""}`.trim();

  return (
    <div className="space-y-6 animate-fade-in">
      <Button asChild variant="ghost" size="sm">
        <Link href="/guests"><ArrowLeft className="h-4 w-4" /> CRM ospiti</Link>
      </Button>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14">
            <AvatarFallback className="text-base">{initials(name)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Ospite</p>
            <h1 className="text-display text-3xl">{name}</h1>
            <div className="mt-2 flex flex-wrap gap-2">
              <LoyaltyPill tier={g.loyaltyTier} />
              {g.loyaltyPoints > 0 && (
                <Badge tone="gold" className="inline-flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> {g.loyaltyPoints} pt
                </Badge>
              )}
              {g.blocked && (
                <Badge tone="danger" className="inline-flex items-center gap-1">
                  <Ban className="h-3 w-3" /> Bloccato
                </Badge>
              )}
              {g.tags.map((t) => <Badge key={t} tone="neutral">{t}</Badge>)}
              {g.allergies && (
                <Badge tone="danger" className="badge-dot">{g.allergies}</Badge>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.6fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Contatti</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {g.email && <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /> {g.email}</p>}
              {g.phone && <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> {g.phone}</p>}
              {g.birthday && <p className="flex items-center gap-2"><Cake className="h-4 w-4 text-muted-foreground" /> {formatDate(g.birthday)}</p>}
              <p className="text-xs text-muted-foreground">
                Marketing: {g.marketingOptIn ? "consenso attivo" : "non iscritto"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Statistiche</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-sm">
              <Stat label="Visite totali" value={String(g.totalVisits)} />
              <Stat label="Spesa totale" value={formatCurrency(Math.round(Number(g.totalSpend) * 100))} />
              <Stat label="No-show" value={String(g.noShowCount)} />
              <Stat label="Ultima visita" value={g.lastVisitAt ? formatDate(g.lastVisitAt) : "—"} />
            </CardContent>
          </Card>

          {g.privateNotes && canSeePrivate && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4" /> Note riservate
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{g.privateNotes}</CardContent>
            </Card>
          )}
          {g.privateNotes && !canSeePrivate && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-muted-foreground">
                  <ShieldAlert className="h-4 w-4" /> Note riservate
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Visibili solo al ruolo Manager.
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-gilt-dark" /> Loyalty
                </span>
                <span className="text-display text-xl">{g.loyaltyPoints} pt</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <LoyaltyBlockActions
                guestId={g.id}
                blocked={g.blocked}
                blockedReason={g.blockedReason}
                canEdit={canEditMarketing}
                canBlock={canManageBookings}
              />
              {txns.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Ancora nessun movimento. I punti vengono accreditati a ordine completato.
                </p>
              ) : (
                <ul className="divide-y text-xs">
                  {txns.map((t) => (
                    <li key={t.id} className="flex items-center justify-between py-1.5">
                      <div>
                        <p className="font-medium">{t.reason ?? t.kind}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {formatDateTime(t.createdAt)}
                        </p>
                      </div>
                      <span
                        className={
                          t.points > 0
                            ? "text-emerald-700"
                            : t.points < 0
                              ? "text-rose-700"
                              : "text-muted-foreground"
                        }
                      >
                        {t.points > 0 ? "+" : ""}
                        {t.points}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Storico visite</CardTitle></CardHeader>
          <CardContent>
            {g.bookings.length === 0 ? (
              <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                Nessuna prenotazione storica.
              </p>
            ) : (
              <ul className="divide-y">
                {g.bookings.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                    <div>
                      <p className="font-medium">{formatDateTime(b.startsAt)}</p>
                      <p className="text-xs text-muted-foreground">
                        {b.partySize} pers. · {b.table?.label ?? "—"}
                      </p>
                    </div>
                    <StatusBadge status={b.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-display text-xl">{value}</p>
    </div>
  );
}
