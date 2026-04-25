import { NextResponse } from "next/server";
import { can, getActiveVenue } from "@/lib/tenant";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED = ["guests", "bookings", "payments"] as const;
type Kind = (typeof ALLOWED)[number];

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString();
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function csvRows(headers: string[], rows: Record<string, unknown>[]) {
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(headers.map((h) => csvCell(r[h])).join(","));
  }
  return lines.join("\n");
}

export async function GET(_req: Request, { params }: { params: { kind: string } }) {
  const kind = params.kind as Kind;
  if (!ALLOWED.includes(kind as Kind)) {
    return NextResponse.json({ error: "invalid_kind" }, { status: 400 });
  }
  const ctx = await getActiveVenue();
  const includePrivate = can(ctx.role, "view_private");

  let csv = "";
  let filename = `tavolo-${kind}-${new Date().toISOString().slice(0, 10)}.csv`;

  if (kind === "guests") {
    const items = await db.guest.findMany({
      where: { venueId: ctx.venueId },
      orderBy: [{ loyaltyTier: "desc" }, { createdAt: "desc" }],
      take: 5000,
    });
    const headers = [
      "id",
      "firstName",
      "lastName",
      "email",
      "phone",
      "loyaltyTier",
      "totalVisits",
      "totalSpend",
      "noShowCount",
      "lastVisitAt",
      "tags",
      "marketingOptIn",
      "allergies",
      "createdAt",
      ...(includePrivate ? ["privateNotes"] : []),
    ];
    csv = csvRows(
      headers,
      items.map((g) => ({
        ...g,
        tags: g.tags.join("|"),
        totalSpend: g.totalSpend.toString(),
      })) as unknown as Record<string, unknown>[],
    );
  } else if (kind === "bookings") {
    const items = await db.booking.findMany({
      where: { venueId: ctx.venueId },
      orderBy: { startsAt: "desc" },
      take: 5000,
      include: {
        guest: { select: { firstName: true, lastName: true, email: true, phone: true } },
        table: { select: { label: true } },
      },
    });
    const headers = [
      "id",
      "reference",
      "startsAt",
      "durationMin",
      "partySize",
      "status",
      "source",
      "occasion",
      "depositCents",
      "depositStatus",
      "tableLabel",
      "guestFirstName",
      "guestLastName",
      "guestEmail",
      "guestPhone",
      "notes",
      ...(includePrivate ? ["internalNotes"] : []),
      "createdAt",
    ];
    csv = csvRows(
      headers,
      items.map((b) => ({
        id: b.id,
        reference: b.reference,
        startsAt: b.startsAt.toISOString(),
        durationMin: b.durationMin,
        partySize: b.partySize,
        status: b.status,
        source: b.source,
        occasion: b.occasion ?? "",
        depositCents: b.depositCents,
        depositStatus: b.depositStatus,
        tableLabel: b.table?.label ?? "",
        guestFirstName: b.guest?.firstName ?? "",
        guestLastName: b.guest?.lastName ?? "",
        guestEmail: b.guest?.email ?? "",
        guestPhone: b.guest?.phone ?? "",
        notes: b.notes ?? "",
        internalNotes: b.internalNotes ?? "",
        createdAt: b.createdAt.toISOString(),
      })),
    );
  } else if (kind === "payments") {
    if (!can(ctx.role, "view_revenue")) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const items = await db.payment.findMany({
      where: { venueId: ctx.venueId },
      orderBy: { createdAt: "desc" },
      take: 5000,
      include: {
        booking: { select: { reference: true, startsAt: true } },
        guest: { select: { firstName: true, lastName: true, email: true } },
      },
    });
    const headers = [
      "id",
      "createdAt",
      "kind",
      "status",
      "amountCents",
      "currency",
      "stripePaymentId",
      "bookingReference",
      "bookingStartsAt",
      "guestFirstName",
      "guestLastName",
      "guestEmail",
    ];
    csv = csvRows(
      headers,
      items.map((p) => ({
        id: p.id,
        createdAt: p.createdAt.toISOString(),
        kind: p.kind,
        status: p.status,
        amountCents: p.amountCents,
        currency: p.currency,
        stripePaymentId: p.stripePaymentId ?? "",
        bookingReference: p.booking?.reference ?? "",
        bookingStartsAt: p.booking?.startsAt?.toISOString() ?? "",
        guestFirstName: p.guest?.firstName ?? "",
        guestLastName: p.guest?.lastName ?? "",
        guestEmail: p.guest?.email ?? "",
      })),
    );
  }

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}
