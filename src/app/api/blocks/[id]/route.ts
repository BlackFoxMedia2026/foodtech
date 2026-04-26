import { NextResponse } from "next/server";
import { getActiveVenue } from "@/lib/tenant";
import { deleteBlock } from "@/server/blocks";

export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getActiveVenue();
  try {
    await deleteBlock(ctx.venueId, params.id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
}
