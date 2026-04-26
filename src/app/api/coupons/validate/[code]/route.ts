import { NextResponse } from "next/server";
import { validateCouponCode } from "@/server/coupons";

export const dynamic = "force-dynamic";

// Public: a guest pastes a coupon code on a public landing or in the
// widget/order flow and we tell them whether it works.
export async function GET(_req: Request, { params }: { params: { code: string } }) {
  const result = await validateCouponCode(params.code);
  if (!result.ok) {
    return NextResponse.json({ ok: false, reason: result.reason }, { status: 200 });
  }
  return NextResponse.json({
    ok: true,
    coupon: result.coupon,
    venue: result.venue,
  });
}
