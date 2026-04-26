import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { db } from "@/lib/db";
import { createOrder } from "@/server/orders";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const venue = await db.venue.findFirst({
    where: { slug: params.slug, active: true },
    select: { id: true },
  });
  if (!venue) return NextResponse.json({ error: "venue_not_found" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  try {
    const created = await createOrder(venue.id, body);
    return NextResponse.json({ reference: created.reference, totalCents: created.totalCents }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "invalid_input", issues: err.issues }, { status: 400 });
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : "invalid" }, { status: 400 });
  }
}
