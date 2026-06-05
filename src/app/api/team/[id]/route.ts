import { NextResponse } from "next/server";
import { z } from "zod";
import { can, getActiveVenue } from "@/lib/tenant";
import { db } from "@/lib/db";
import { logAudit } from "@/server/audit";

export const dynamic = "force-dynamic";

const Patch = z.object({
  role: z.enum(["MANAGER", "RECEPTION", "WAITER", "MARKETING", "READ_ONLY"]),
});

function actorInfo(req: Request, ctx: Awaited<ReturnType<typeof getActiveVenue>>) {
  return {
    actorEmail: (ctx.session?.user as { email?: string | null } | undefined)?.email ?? null,
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: req.headers.get("user-agent") ?? null,
  };
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getActiveVenue();
  if (!can(ctx.role, "manage_venue")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const existing = await db.venueMembership.findFirst({
    where: { id: params.id, venueId: ctx.venueId },
  });
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (existing.userId === ctx.userId) {
    return NextResponse.json({ error: "cant_edit_self" }, { status: 409 });
  }
  try {
    const body = Patch.parse(await req.json());
    const updated = await db.venueMembership.update({
      where: { id: params.id },
      data: { role: body.role },
    });
    await logAudit({
      orgId: ctx.orgId,
      venueId: ctx.venueId,
      actorId: ctx.userId,
      ...actorInfo(req, ctx),
      action: "team.role.change",
      entityType: "Membership",
      entityId: params.id,
      diff: {
        role: { old: existing.role, new: body.role },
        userId: { old: existing.userId, new: existing.userId },
      },
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getActiveVenue();
  if (!can(ctx.role, "manage_venue")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const existing = await db.venueMembership.findFirst({
    where: { id: params.id, venueId: ctx.venueId },
  });
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (existing.userId === ctx.userId) {
    return NextResponse.json({ error: "cant_remove_self" }, { status: 409 });
  }
  await db.venueMembership.delete({ where: { id: params.id } });
  await logAudit({
    orgId: ctx.orgId,
    venueId: ctx.venueId,
    actorId: ctx.userId,
    ...actorInfo(req, ctx),
    action: "team.remove",
    entityType: "Membership",
    entityId: params.id,
    diff: {
      userId: { old: existing.userId, new: null },
      role: { old: existing.role, new: null },
    },
  });
  return NextResponse.json({ ok: true });
}
