import { NextResponse } from "next/server";
import { can, getActiveVenue } from "@/lib/tenant";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED = [
  "guests",
  "bookings",
  "payments",
  "costs",
  "shifts",
  "messages",
  "automations",
  "menu-scans",
  "chat-sessions",
] as const;
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
  } else if (kind === "costs") {
    if (!can(ctx.role, "view_revenue")) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const items = await db.costEntry.findMany({
      where: { venueId: ctx.venueId },
      orderBy: { occurredOn: "desc" },
      take: 5000,
    });
    const headers = ["id", "occurredOn", "category", "label", "amountCents", "currency", "recurring", "createdAt"];
    csv = csvRows(
      headers,
      items.map((c) => ({
        id: c.id,
        occurredOn: c.occurredOn.toISOString(),
        category: c.category,
        label: c.label,
        amountCents: c.amountCents,
        currency: c.currency,
        recurring: c.recurring,
        createdAt: c.createdAt.toISOString(),
      })),
    );
  } else if (kind === "shifts") {
    if (!can(ctx.role, "view_revenue")) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const items = await db.staffShift.findMany({
      where: { venueId: ctx.venueId },
      orderBy: { date: "desc" },
      take: 5000,
    });
    const headers = ["id", "date", "staffName", "role", "hours", "hourlyCents", "totalCents", "notes"];
    csv = csvRows(
      headers,
      items.map((s) => ({
        id: s.id,
        date: s.date.toISOString(),
        staffName: s.staffName,
        role: s.role ?? "",
        hours: s.hours,
        hourlyCents: s.hourlyCents,
        totalCents: Math.round(s.hours * s.hourlyCents),
        notes: s.notes ?? "",
      })),
    );
  } else if (kind === "messages") {
    if (!can(ctx.role, "edit_marketing")) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const items = await db.messageLog.findMany({
      where: { venueId: ctx.venueId },
      orderBy: { createdAt: "desc" },
      take: 5000,
      include: {
        campaign: { select: { name: true } },
        guest: { select: { firstName: true, lastName: true } },
      },
    });
    const headers = [
      "id",
      "createdAt",
      "channel",
      "status",
      "toAddress",
      "subject",
      "bodyPreview",
      "providerId",
      "error",
      "campaignName",
      "guestName",
      "sentAt",
      "deliveredAt",
      "failedAt",
    ];
    csv = csvRows(
      headers,
      items.map((m) => ({
        id: m.id,
        createdAt: m.createdAt.toISOString(),
        channel: m.channel,
        status: m.status,
        toAddress: m.toAddress,
        subject: m.subject ?? "",
        bodyPreview: m.bodyPreview ?? "",
        providerId: m.providerId ?? "",
        error: m.error ?? "",
        campaignName: m.campaign?.name ?? "",
        guestName: m.guest
          ? [m.guest.firstName, m.guest.lastName].filter(Boolean).join(" ")
          : "",
        sentAt: m.sentAt?.toISOString() ?? "",
        deliveredAt: m.deliveredAt?.toISOString() ?? "",
        failedAt: m.failedAt?.toISOString() ?? "",
      })),
    );
  } else if (kind === "automations") {
    if (!can(ctx.role, "edit_marketing")) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const items = await db.automationRun.findMany({
      where: { venueId: ctx.venueId },
      orderBy: { createdAt: "desc" },
      take: 5000,
      include: { workflow: { select: { name: true, trigger: true } } },
    });
    const headers = [
      "id",
      "createdAt",
      "workflowName",
      "trigger",
      "status",
      "startedAt",
      "finishedAt",
      "error",
    ];
    csv = csvRows(
      headers,
      items.map((r) => ({
        id: r.id,
        createdAt: r.createdAt.toISOString(),
        workflowName: r.workflow?.name ?? "",
        trigger: r.trigger,
        status: r.status,
        startedAt: r.startedAt?.toISOString() ?? "",
        finishedAt: r.finishedAt?.toISOString() ?? "",
        error: r.error ?? "",
      })),
    );
  } else if (kind === "menu-scans") {
    const items = await db.menuScan.findMany({
      where: { venueId: ctx.venueId },
      orderBy: { createdAt: "desc" },
      take: 5000,
    });
    const headers = [
      "id",
      "createdAt",
      "menuKey",
      "source",
      "email",
      "phone",
      "consentMarketing",
    ];
    csv = csvRows(
      headers,
      items.map((s) => ({
        id: s.id,
        createdAt: s.createdAt.toISOString(),
        menuKey: s.menuKey,
        source: s.source,
        email: s.email ?? "",
        phone: s.phone ?? "",
        consentMarketing: s.consentMarketing,
      })),
    );
  } else if (kind === "chat-sessions") {
    const items = await db.chatSession.findMany({
      where: { venueId: ctx.venueId },
      orderBy: { updatedAt: "desc" },
      take: 5000,
      include: { _count: { select: { messages: true } } },
    });
    const headers = [
      "id",
      "createdAt",
      "updatedAt",
      "source",
      "status",
      "messages",
      "draftPartySize",
      "draftDate",
      "draftTime",
      "draftFirstName",
      "draftLastName",
      "draftEmail",
      "draftPhone",
    ];
    csv = csvRows(
      headers,
      items.map((s) => ({
        id: s.id,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
        source: s.source,
        status: s.status,
        messages: s._count.messages,
        draftPartySize: s.draftPartySize ?? "",
        draftDate: s.draftDate ?? "",
        draftTime: s.draftTime ?? "",
        draftFirstName: s.draftFirstName ?? "",
        draftLastName: s.draftLastName ?? "",
        draftEmail: s.draftEmail ?? "",
        draftPhone: s.draftPhone ?? "",
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
