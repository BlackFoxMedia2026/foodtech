import { NextResponse } from "next/server";
import { venueFeedIcs } from "@/server/calendar";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Token-gated venue feed. Operators subscribe their Google/Outlook calendar
// to this URL to see all upcoming bookings. Token rotation is available
// from the settings UI to revoke access.
export async function GET(
  req: Request,
  { params }: { params: { slug: string; token: string } },
) {
  const limited = rateLimit(req, {
    key: `cal:${params.slug}`,
    max: 60,
    windowMs: 60_000,
  });
  if (!limited.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const baseUrl =
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  const tokenSansExt = params.token.replace(/\.ics$/i, "");
  const ics = await venueFeedIcs(params.slug, tokenSansExt, baseUrl);
  if (!ics) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return new NextResponse(ics, {
    status: 200,
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "cache-control": "private, max-age=300",
    },
  });
}
