import { NextResponse } from "next/server";
import { bookingIcs } from "@/server/calendar";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: { ref: string } }) {
  const baseUrl =
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  const ics = await bookingIcs(params.ref, baseUrl);
  if (!ics) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return new NextResponse(ics, {
    status: 200,
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="tavolo-${params.ref.slice(-8)}.ics"`,
    },
  });
}
