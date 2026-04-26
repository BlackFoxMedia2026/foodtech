import { NextResponse } from "next/server";
import { lookupGiftCard } from "@/server/gift-cards";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// Public lookup. Anyone with the code can see balance + recipient name +
// venue. Rate-limited to discourage brute-force enumeration.
export async function GET(req: Request, { params }: { params: { code: string } }) {
  const limited = rateLimit(req, { key: "gift-lookup", max: 20, windowMs: 60_000 });
  if (!limited.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const card = await lookupGiftCard(params.code);
  if (!card) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(card);
}
