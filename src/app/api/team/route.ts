import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { can, getActiveVenue } from "@/lib/tenant";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const Body = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(80).optional().nullable(),
  role: z.enum(["MANAGER", "RECEPTION", "WAITER", "MARKETING", "READ_ONLY"]).default("RECEPTION"),
  initialPassword: z.string().min(8).max(100).optional(),
});

export async function POST(req: Request) {
  const ctx = await getActiveVenue();
  if (!can(ctx.role, "manage_venue")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  let user = await db.user.findUnique({ where: { email: body.email } });
  if (!user) {
    user = await db.user.create({
      data: {
        email: body.email,
        name: body.name ?? null,
        passwordHash: body.initialPassword ? await bcrypt.hash(body.initialPassword, 10) : null,
      },
    });
  }

  const existing = await db.venueMembership.findFirst({
    where: { userId: user.id, venueId: ctx.venueId },
  });
  if (existing) {
    return NextResponse.json({ error: "already_member" }, { status: 409 });
  }

  const created = await db.venueMembership.create({
    data: {
      userId: user.id,
      venueId: ctx.venueId,
      role: body.role,
    },
    include: { user: true },
  });
  return NextResponse.json(created, { status: 201 });
}
