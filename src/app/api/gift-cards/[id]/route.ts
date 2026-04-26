import { NextResponse } from "next/server";
import { can, getActiveVenue } from "@/lib/tenant";
import { deleteGiftCard } from "@/server/gift-cards";

export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getActiveVenue();
  if (!can(ctx.role, "edit_marketing")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  try {
    await deleteGiftCard(ctx.venueId, params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const code = err instanceof Error ? err.message : "unknown";
    return NextResponse.json(
      { error: code },
      { status: code === "not_found" ? 404 : 409 },
    );
  }
}
