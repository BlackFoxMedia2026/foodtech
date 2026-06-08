import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

/**
 * GDPR Art. 20 — Right to data portability.
 *
 * Complementare di `anonymizeGuest` (right-to-be-forgotten): l'ospite può
 * chiedere una copia *strutturata, leggibile da macchina* di TUTTI i dati
 * personali che il venue ha su di lui. Il formato JSON `tavolo-guest-export/v1`
 * include profilo, prenotazioni (anche soft-deleted), ordini, pagamenti,
 * ticket esperienze, riscatti coupon, message log campagne, survey, loyalty
 * e consensi.
 *
 * Decimal di Prisma → number (JSON-friendly); Date → ISO string.
 *
 * `privateNotes` NON è incluso di default: è una nota interna del manager
 * (non un dato che l'interessato ha fornito) e l'esclusione è decisa dal
 * caller passando l'opzione `includePrivateNotes`.
 */

export type GuestExport = {
  exportedAt: string;
  format: "tavolo-guest-export/v1";
  guest: {
    id: string;
    firstName: string;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    birthday: string | null;
    language: string;
    loyaltyTier: string;
    loyaltyPoints: number;
    totalVisits: number;
    totalSpend: number;
    noShowCount: number;
    lastVisitAt: string | null;
    allergies: string | null;
    tags: string[];
    marketingOptIn: boolean;
    createdAt: string;
    updatedAt: string;
    anonymizedAt: string | null;
    privateNotes?: string | null;
  };
  bookings: Array<{
    id: string;
    reference: string;
    startsAt: string;
    durationMin: number;
    partySize: number;
    status: string;
    source: string;
    occasion: string | null;
    notes: string | null;
    tableLabel: string | null;
    deletedAt: string | null;
    createdAt: string;
  }>;
  orders: Array<{
    id: string;
    reference: string;
    kind: string;
    status: string;
    address: string | null;
    totalCents: number;
    currency: string;
    items: Array<{ name: string; quantity: number; priceCents: number }>;
    createdAt: string;
  }>;
  payments: Array<{
    id: string;
    kind: string;
    status: string;
    amountCents: number;
    currency: string;
    fxRateToBase: number | null;
    fxBaseCurrency: string | null;
    fxAmountBaseCents: number | null;
    bookingReference: string | null;
    createdAt: string;
  }>;
  tickets: Array<{
    id: string;
    experienceTitle: string;
    quantity: number;
    totalCents: number;
    status: string;
    checkedInAt: string | null;
    createdAt: string;
  }>;
  couponRedemptions: Array<{
    id: string;
    couponCode: string;
    couponName: string;
    amountCents: number | null;
    redeemedAt: string;
  }>;
  messageLogs: Array<{
    id: string;
    channel: string;
    toAddress: string;
    subject: string | null;
    bodyPreview: string | null;
    status: string;
    sentAt: string | null;
    deliveredAt: string | null;
    failedAt: string | null;
    campaignName: string | null;
    createdAt: string;
  }>;
  surveyResponses: Array<{
    id: string;
    npsScore: number;
    sentiment: string;
    comment: string | null;
    recommend: boolean | null;
    createdAt: string;
  }>;
  loyaltyTransactions: Array<{
    id: string;
    kind: string;
    points: number;
    reason: string | null;
    createdAt: string;
  }>;
  consentLogs: Array<{
    id: string;
    channel: string;
    granted: boolean;
    source: string | null;
    createdAt: string;
  }>;
};

type DecimalLike = { toString(): string };

function decimalToNumber(value: Prisma.Decimal | DecimalLike | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  // Prisma Decimal: use toString → Number per evitare precision loss su valori piccoli.
  return Number(value.toString());
}

function decimalToNumberOrNull(
  value: Prisma.Decimal | DecimalLike | number | null | undefined,
): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  return Number(value.toString());
}

function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

export type ExportOptions = { includePrivateNotes?: boolean };

export async function exportGuestData(
  venueId: string,
  guestId: string,
  opts: ExportOptions = {},
): Promise<GuestExport> {
  // 1) Profilo + relations principali in una sola query col include nested.
  const guest = await db.guest.findFirst({
    where: { id: guestId, venueId },
    include: {
      bookings: {
        // Include soft-deleted: la portabilità deve restituire TUTTO.
        orderBy: { startsAt: "desc" },
        include: { table: { select: { label: true } } },
      },
      orders: {
        orderBy: { createdAt: "desc" },
        include: {
          items: { select: { name: true, quantity: true, priceCents: true } },
        },
      },
      payments: {
        orderBy: { createdAt: "desc" },
        include: { booking: { select: { reference: true } } },
      },
      couponRedemptions: {
        orderBy: { redeemedAt: "desc" },
        include: { coupon: { select: { code: true, name: true } } },
      },
      messageLogs: {
        orderBy: { createdAt: "desc" },
        include: { campaign: { select: { name: true } } },
      },
      loyaltyTransactions: { orderBy: { createdAt: "desc" } },
      consentLogs: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!guest) throw new Error("not_found");

  // 2) Tickets via email: ricerca cross-experience del venue.
  //    Surveys: Survey ha bookingId ma non relation `booking` inversa con guestId,
  //    quindi raccogliamo gli id delle prenotazioni del guest dal nested include
  //    e filtriamo per (guestId | bookingId IN bookings).
  const guestBookingIds = guest.bookings.map((b) => b.id);
  const [tickets, surveys] = await Promise.all([
    guest.email
      ? db.ticket.findMany({
          where: {
            buyerEmail: guest.email,
            experience: { venueId },
          },
          include: { experience: { select: { title: true } } },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([] as Array<{
          id: string;
          quantity: number;
          totalCents: number;
          status: string;
          checkedInAt: Date | null;
          createdAt: Date;
          experience: { title: string };
        }>),
    db.surveyResponse.findMany({
      where: {
        survey: {
          venueId,
          OR: [
            { guestId },
            guestBookingIds.length > 0 ? { bookingId: { in: guestBookingIds } } : { id: "__none__" },
          ],
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const out: GuestExport = {
    exportedAt: new Date().toISOString(),
    format: "tavolo-guest-export/v1",
    guest: {
      id: guest.id,
      firstName: guest.firstName,
      lastName: guest.lastName,
      email: guest.email,
      phone: guest.phone,
      birthday: iso(guest.birthday),
      language: guest.language,
      loyaltyTier: guest.loyaltyTier,
      loyaltyPoints: guest.loyaltyPoints,
      totalVisits: guest.totalVisits,
      totalSpend: decimalToNumber(guest.totalSpend),
      noShowCount: guest.noShowCount,
      lastVisitAt: iso(guest.lastVisitAt),
      allergies: guest.allergies,
      tags: guest.tags,
      marketingOptIn: guest.marketingOptIn,
      createdAt: guest.createdAt.toISOString(),
      updatedAt: guest.updatedAt.toISOString(),
      anonymizedAt: iso(guest.anonymizedAt),
      ...(opts.includePrivateNotes ? { privateNotes: guest.privateNotes } : {}),
    },
    bookings: guest.bookings.map((b) => ({
      id: b.id,
      reference: b.reference,
      startsAt: b.startsAt.toISOString(),
      durationMin: b.durationMin,
      partySize: b.partySize,
      status: b.status,
      source: b.source,
      occasion: b.occasion ?? null,
      notes: b.notes,
      tableLabel: b.table?.label ?? null,
      deletedAt: iso(b.deletedAt),
      createdAt: b.createdAt.toISOString(),
    })),
    orders: guest.orders.map((o) => ({
      id: o.id,
      reference: o.reference,
      kind: o.kind,
      status: o.status,
      address: o.address,
      totalCents: o.totalCents,
      currency: o.currency,
      items: o.items.map((it) => ({
        name: it.name,
        quantity: it.quantity,
        priceCents: it.priceCents,
      })),
      createdAt: o.createdAt.toISOString(),
    })),
    payments: guest.payments.map((p) => ({
      id: p.id,
      kind: p.kind,
      status: p.status,
      amountCents: p.amountCents,
      currency: p.currency,
      fxRateToBase: decimalToNumberOrNull(p.fxRateToBase),
      fxBaseCurrency: p.fxBaseCurrency,
      fxAmountBaseCents: p.fxAmountBaseCents,
      bookingReference: p.booking?.reference ?? null,
      createdAt: p.createdAt.toISOString(),
    })),
    tickets: tickets.map((t) => ({
      id: t.id,
      experienceTitle: t.experience.title,
      quantity: t.quantity,
      totalCents: t.totalCents,
      status: t.status,
      checkedInAt: iso(t.checkedInAt),
      createdAt: t.createdAt.toISOString(),
    })),
    couponRedemptions: guest.couponRedemptions.map((r) => ({
      id: r.id,
      couponCode: r.coupon.code,
      couponName: r.coupon.name,
      amountCents: r.amountCents,
      redeemedAt: r.redeemedAt.toISOString(),
    })),
    messageLogs: guest.messageLogs.map((m) => ({
      id: m.id,
      channel: m.channel,
      toAddress: m.toAddress,
      subject: m.subject,
      bodyPreview: m.bodyPreview,
      status: m.status,
      sentAt: iso(m.sentAt),
      deliveredAt: iso(m.deliveredAt),
      failedAt: iso(m.failedAt),
      campaignName: m.campaign?.name ?? null,
      createdAt: m.createdAt.toISOString(),
    })),
    surveyResponses: surveys.map((r) => ({
      id: r.id,
      npsScore: r.npsScore,
      sentiment: r.sentiment,
      comment: r.comment,
      recommend: r.recommend,
      createdAt: r.createdAt.toISOString(),
    })),
    loyaltyTransactions: guest.loyaltyTransactions.map((t) => ({
      id: t.id,
      kind: t.kind,
      points: t.points,
      reason: t.reason,
      createdAt: t.createdAt.toISOString(),
    })),
    consentLogs: guest.consentLogs.map((c) => ({
      id: c.id,
      channel: c.channel,
      granted: c.granted,
      source: c.source,
      createdAt: c.createdAt.toISOString(),
    })),
  };

  return out;
}

export function exportRecordCounts(exp: GuestExport): Record<string, number> {
  return {
    bookings: exp.bookings.length,
    orders: exp.orders.length,
    payments: exp.payments.length,
    tickets: exp.tickets.length,
    couponRedemptions: exp.couponRedemptions.length,
    messageLogs: exp.messageLogs.length,
    surveyResponses: exp.surveyResponses.length,
    loyaltyTransactions: exp.loyaltyTransactions.length,
    consentLogs: exp.consentLogs.length,
  };
}
