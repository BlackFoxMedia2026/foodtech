import { NextResponse } from "next/server";
import { getActiveVenue, can } from "@/lib/tenant";
import { createVenue } from "@/server/venues";

export async function POST(req: Request) {
  const ctx = await getActiveVenue();
  if (!can(ctx.role, "manage_venue")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  try {
    const body = await req.json();
    const created = await createVenue({
      orgId: ctx.orgId,
      userId: ctx.userId,
      raw: body,
      actor: {
        actorId: ctx.userId,
        actorEmail:
          (ctx.session?.user as { email?: string | null } | undefined)?.email ?? null,
        ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
        userAgent: req.headers.get("user-agent") ?? null,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "invalid";
    if (err instanceof Error && err.name === "PlanLimitError") {
      return NextResponse.json(
        { error: "plan_limit_reached", message },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
