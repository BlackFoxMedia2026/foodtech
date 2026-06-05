import { NextResponse } from "next/server";
import { z } from "zod";
import { can, getActiveVenue } from "@/lib/tenant";
import { db } from "@/lib/db";

const BulkInput = z.object({
  ids: z.array(z.string().min(1)).min(1).max(500),
  action: z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("addTag"),
      tag: z.string().min(1).max(32),
    }),
    z.object({
      kind: z.literal("removeTag"),
      tag: z.string().min(1).max(32),
    }),
    z.object({
      kind: z.literal("setLoyaltyTier"),
      tier: z.enum(["NEW", "REGULAR", "VIP", "AMBASSADOR"]),
    }),
    z.object({
      kind: z.literal("setMarketingOptIn"),
      optIn: z.boolean(),
    }),
  ]),
});

/**
 * POST /api/guests/bulk — Applica una singola azione a più ospiti del venue.
 * Limite 500 per chiamata. Permessi: edit_marketing.
 */
export async function POST(req: Request) {
  const ctx = await getActiveVenue();
  if (!can(ctx.role, "edit_marketing")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const parsed = BulkInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { ids, action } = parsed.data;

  // Verify all ids belong to the venue (multi-tenant boundary).
  const owned = await db.guest.findMany({
    where: { venueId: ctx.venueId, id: { in: ids } },
    select: { id: true, tags: true },
  });
  const ownedMap = new Map(owned.map((g) => [g.id, g]));
  const validIds = ids.filter((id) => ownedMap.has(id));

  if (validIds.length === 0) {
    return NextResponse.json({ updated: 0 });
  }

  switch (action.kind) {
    case "addTag": {
      // Tag aggiunto solo se non già presente
      const tag = action.tag.trim().toLowerCase();
      let updated = 0;
      for (const g of owned) {
        if ((g.tags ?? []).includes(tag)) continue;
        await db.guest.update({
          where: { id: g.id },
          data: { tags: [...(g.tags ?? []), tag] },
        });
        updated += 1;
      }
      return NextResponse.json({ updated });
    }
    case "removeTag": {
      const tag = action.tag.trim().toLowerCase();
      let updated = 0;
      for (const g of owned) {
        if (!(g.tags ?? []).includes(tag)) continue;
        await db.guest.update({
          where: { id: g.id },
          data: { tags: (g.tags ?? []).filter((t) => t !== tag) },
        });
        updated += 1;
      }
      return NextResponse.json({ updated });
    }
    case "setLoyaltyTier": {
      const res = await db.guest.updateMany({
        where: { venueId: ctx.venueId, id: { in: validIds } },
        data: { loyaltyTier: action.tier },
      });
      return NextResponse.json({ updated: res.count });
    }
    case "setMarketingOptIn": {
      const res = await db.guest.updateMany({
        where: { venueId: ctx.venueId, id: { in: validIds } },
        data: { marketingOptIn: action.optIn },
      });
      return NextResponse.json({ updated: res.count });
    }
  }
}
