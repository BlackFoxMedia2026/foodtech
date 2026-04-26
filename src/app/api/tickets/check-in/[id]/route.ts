import { NextResponse } from "next/server";
import { getActiveVenue } from "@/lib/tenant";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getActiveVenue();
  const ticket = await db.ticket.findUnique({
    where: { id: params.id },
    include: { experience: { select: { venueId: true, title: true, capacity: true, startsAt: true, endsAt: true } } },
  });
  if (!ticket) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (ticket.experience.venueId !== ctx.venueId) {
    return NextResponse.json({ error: "wrong_venue" }, { status: 403 });
  }
  if (ticket.status === "CHECKED_IN") {
    return NextResponse.json(
      {
        error: "already_checked_in",
        ticket: {
          id: ticket.id,
          buyerName: ticket.buyerName,
          quantity: ticket.quantity,
          experienceTitle: ticket.experience.title,
          startsAt: ticket.experience.startsAt,
          checkedInAt: ticket.checkedInAt,
        },
      },
      { status: 409 },
    );
  }
  if (ticket.status !== "PAID") {
    return NextResponse.json({ error: "invalid_status", status: ticket.status }, { status: 409 });
  }
  const updated = await db.ticket.update({
    where: { id: ticket.id },
    data: {
      status: "CHECKED_IN",
      checkedInAt: new Date(),
      checkedInBy: ctx.userId,
    },
  });
  return NextResponse.json({
    ok: true,
    ticket: {
      id: updated.id,
      buyerName: updated.buyerName,
      quantity: updated.quantity,
      experienceTitle: ticket.experience.title,
      startsAt: ticket.experience.startsAt,
    },
  });
}
