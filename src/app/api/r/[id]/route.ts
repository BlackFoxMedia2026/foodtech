import { NextResponse } from "next/server";
import { trackReviewLinkClick } from "@/server/review-links";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Public click-tracking redirect: /api/r/<linkId>?survey=<surveyId>&nps=10
// Used by the survey "thank you" page to count outbound clicks toward
// Google/TripAdvisor/etc.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const url = new URL(req.url);
  const surveyId = url.searchParams.get("survey");
  const nps = url.searchParams.get("nps");
  const ipAddress =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;
  const userAgent = req.headers.get("user-agent");

  const link = await trackReviewLinkClick({
    linkId: params.id,
    surveyId: surveyId ?? null,
    npsScore: nps ? Number(nps) : null,
    ipAddress,
    userAgent,
  });

  if (!link) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.redirect(link.url, { status: 302 });
}
