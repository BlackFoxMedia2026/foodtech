import { db } from "@/lib/db";

// Per-guest chronological feed: aggregates everything we know about a
// person across modules so the operator can answer "what's this guest's
// story with us?" in 5 seconds.

export type JourneyEventKind =
  | "BOOKING_CREATED"
  | "BOOKING_COMPLETED"
  | "BOOKING_CANCELLED"
  | "BOOKING_NO_SHOW"
  | "ORDER_PLACED"
  | "MESSAGE_SENT"
  | "COUPON_ISSUED"
  | "COUPON_REDEEMED"
  | "LOYALTY_EARNED"
  | "LOYALTY_REDEEMED"
  | "GIFT_CARD_REDEEMED"
  | "WIFI_CONNECTED"
  | "CHAT_OPENED"
  | "CONSENT_GRANTED"
  | "CONSENT_REVOKED";

export type JourneyEvent = {
  id: string;
  kind: JourneyEventKind;
  at: Date;
  title: string;
  body?: string | null;
  amountCents?: number | null;
  currency?: string | null;
  link?: string | null;
};

export async function getGuestJourney(
  venueId: string,
  guestId: string,
): Promise<JourneyEvent[]> {
  const [
    bookings,
    orders,
    messages,
    coupons,
    redemptions,
    loyalty,
    wifi,
    chats,
    consents,
  ] = await Promise.all([
    db.booking.findMany({
      where: { venueId, guestId },
      orderBy: { startsAt: "desc" },
      select: {
        id: true,
        reference: true,
        status: true,
        startsAt: true,
        partySize: true,
        source: true,
        occasion: true,
        createdAt: true,
        closedAt: true,
      },
    }),
    db.order.findMany({
      where: { venueId, guestId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        reference: true,
        kind: true,
        status: true,
        totalCents: true,
        currency: true,
        createdAt: true,
      },
      take: 100,
    }),
    db.messageLog.findMany({
      where: { venueId, guestId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        channel: true,
        status: true,
        subject: true,
        bodyPreview: true,
        createdAt: true,
      },
      take: 100,
    }),
    db.coupon.findMany({
      where: { venueId, guestId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        code: true,
        name: true,
        kind: true,
        value: true,
        createdAt: true,
      },
    }),
    db.couponRedemption.findMany({
      where: { venueId, guestId },
      orderBy: { redeemedAt: "desc" },
      select: {
        id: true,
        amountCents: true,
        redeemedAt: true,
        coupon: { select: { code: true, name: true } },
      },
    }),
    db.loyaltyTransaction.findMany({
      where: { venueId, guestId },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        kind: true,
        points: true,
        reason: true,
        createdAt: true,
      },
    }),
    db.wifiSession.findMany({
      where: { venueId, lead: { guestId } },
      orderBy: { startedAt: "desc" },
      select: { id: true, deviceType: true, startedAt: true },
      take: 50,
    }),
    db.chatSession.findMany({
      where: { venueId, guestId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        source: true,
        status: true,
        createdAt: true,
      },
      take: 30,
    }),
    db.consentLog.findMany({
      where: { venueId, guestId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        channel: true,
        granted: true,
        source: true,
        createdAt: true,
      },
      take: 50,
    }),
  ]);

  // GiftCardRedemption isn't linked to Guest directly. Resolve by joining
  // through this guest's known bookings/orders — that's where redemptions
  // are recorded at checkout time.
  const bookingIds = bookings.map((b) => b.id);
  const orderIds = orders.map((o) => o.id);
  const gifts =
    bookingIds.length === 0 && orderIds.length === 0
      ? []
      : await db.giftCardRedemption.findMany({
          where: {
            OR: [
              ...(bookingIds.length ? [{ bookingId: { in: bookingIds } }] : []),
              ...(orderIds.length ? [{ orderId: { in: orderIds } }] : []),
            ],
          },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            amountCents: true,
            createdAt: true,
            giftCard: { select: { code: true, currency: true } },
          },
        });

  const events: JourneyEvent[] = [];

  for (const b of bookings) {
    events.push({
      id: `booking-${b.id}-created`,
      kind: "BOOKING_CREATED",
      at: b.createdAt,
      title: `Prenotazione · ${b.partySize} pax · ${b.source}`,
      body: `Per ${b.startsAt.toLocaleString("it-IT")}${b.occasion ? ` · ${b.occasion}` : ""}`,
      link: `/bookings/${b.id}`,
    });
    if (b.status === "COMPLETED" && b.closedAt) {
      events.push({
        id: `booking-${b.id}-completed`,
        kind: "BOOKING_COMPLETED",
        at: b.closedAt,
        title: `Visita completata · ${b.partySize} pax`,
        link: `/bookings/${b.id}`,
      });
    } else if (b.status === "CANCELLED" && b.closedAt) {
      events.push({
        id: `booking-${b.id}-cancelled`,
        kind: "BOOKING_CANCELLED",
        at: b.closedAt,
        title: "Prenotazione annullata",
        link: `/bookings/${b.id}`,
      });
    } else if (b.status === "NO_SHOW" && b.closedAt) {
      events.push({
        id: `booking-${b.id}-noshow`,
        kind: "BOOKING_NO_SHOW",
        at: b.closedAt,
        title: "No-show",
        link: `/bookings/${b.id}`,
      });
    }
  }

  for (const o of orders) {
    events.push({
      id: `order-${o.id}`,
      kind: "ORDER_PLACED",
      at: o.createdAt,
      title: `Ordine ${o.kind === "TABLE" ? "al tavolo" : o.kind === "DELIVERY" ? "consegna" : "ritiro"}`,
      body: `${o.status} · #${o.reference.slice(-6).toUpperCase()}`,
      amountCents: o.totalCents,
      currency: o.currency,
    });
  }

  for (const m of messages) {
    events.push({
      id: `msg-${m.id}`,
      kind: "MESSAGE_SENT",
      at: m.createdAt,
      title: `${m.channel} · ${m.status}`,
      body: m.subject ?? m.bodyPreview,
    });
  }

  for (const c of coupons) {
    events.push({
      id: `coupon-${c.id}`,
      kind: "COUPON_ISSUED",
      at: c.createdAt,
      title: `Coupon emesso · ${c.code}`,
      body: c.name,
    });
  }
  for (const r of redemptions) {
    events.push({
      id: `couponredeem-${r.id}`,
      kind: "COUPON_REDEEMED",
      at: r.redeemedAt,
      title: `Coupon riscattato · ${r.coupon.code}`,
      amountCents: r.amountCents,
    });
  }

  for (const l of loyalty) {
    events.push({
      id: `loy-${l.id}`,
      kind: l.points >= 0 ? "LOYALTY_EARNED" : "LOYALTY_REDEEMED",
      at: l.createdAt,
      title: `${l.points >= 0 ? "+" : ""}${l.points} punti loyalty`,
      body: l.reason,
    });
  }

  for (const g of gifts) {
    events.push({
      id: `gift-${g.id}`,
      kind: "GIFT_CARD_REDEEMED",
      at: g.createdAt,
      title: `Gift card riscattata · ${g.giftCard.code}`,
      amountCents: g.amountCents,
      currency: g.giftCard.currency,
    });
  }

  for (const w of wifi) {
    events.push({
      id: `wifi-${w.id}`,
      kind: "WIFI_CONNECTED",
      at: w.startedAt,
      title: `Wi-Fi · ${w.deviceType ?? "device sconosciuto"}`,
    });
  }

  for (const c of chats) {
    events.push({
      id: `chat-${c.id}`,
      kind: "CHAT_OPENED",
      at: c.createdAt,
      title: `Chat ${c.source.toLowerCase()} · ${c.status.toLowerCase()}`,
    });
  }

  for (const c of consents) {
    events.push({
      id: `consent-${c.id}`,
      kind: c.granted ? "CONSENT_GRANTED" : "CONSENT_REVOKED",
      at: c.createdAt,
      title: `${c.granted ? "Consenso" : "Revoca"} · ${c.channel}`,
      body: c.source ? `Origine: ${c.source}` : null,
    });
  }

  events.sort((a, b) => b.at.getTime() - a.at.getTime());
  // 200 ought to be plenty for any single guest's history view.
  return events.slice(0, 200);
}
