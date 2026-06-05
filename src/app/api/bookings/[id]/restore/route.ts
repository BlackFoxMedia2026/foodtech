import { NextResponse } from "next/server";
import { can, getActiveVenue } from "@/lib/tenant";
import { db } from "@/lib/db";
import {
  BOOKING_RESTORE_WINDOW_DAYS,
  isWithinRestoreWindow,
  restoreBooking,
} from "@/server/soft-delete";

/**
 * Ripristina una booking soft-deleted entro la finestra di 30 giorni.
 * Solo MANAGER (ability `manage_venue`): è un'operazione "amministrativa
 * recovery", non parte del flusso sala quotidiano.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getActiveVenue();
  if (!can(ctx.role, "manage_venue")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const existing = await db.booking.findFirst({
    where: { id: params.id, venueId: ctx.venueId },
    select: { id: true, deletedAt: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!existing.deletedAt) {
    return NextResponse.json({ error: "not_deleted" }, { status: 400 });
  }
  if (!isWithinRestoreWindow(existing.deletedAt)) {
    return NextResponse.json(
      {
        error: "restore_window_expired",
        windowDays: BOOKING_RESTORE_WINDOW_DAYS,
      },
      { status: 410 },
    );
  }

  try {
    const restored = await restoreBooking(ctx.venueId, params.id, ctx.userId);
    return NextResponse.json({ ok: true, booking: restored });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "restore_failed" },
      { status: 400 },
    );
  }
}
