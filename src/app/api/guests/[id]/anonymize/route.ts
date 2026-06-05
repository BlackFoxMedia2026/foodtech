import { NextResponse } from "next/server";
import { can, getActiveVenue } from "@/lib/tenant";
import { anonymizeGuest } from "@/server/guests";

/**
 * POST /api/guests/[id]/anonymize
 * GDPR right-to-be-forgotten. Solo Manager (manage_venue).
 * Operazione irreversibile, audit trail preservato via anonymizedAt + anonymizedBy.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getActiveVenue();
  if (!can(ctx.role, "manage_venue")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  try {
    const guest = await anonymizeGuest(ctx.venueId, params.id, ctx.userId, {
      actorEmail: (ctx.session?.user as { email?: string | null } | undefined)?.email ?? null,
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: req.headers.get("user-agent") ?? null,
    });
    return NextResponse.json({ ok: true, anonymizedAt: guest.anonymizedAt });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "invalid";
    const status =
      msg === "not_found" ? 404 : msg === "already_anonymized" ? 409 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
