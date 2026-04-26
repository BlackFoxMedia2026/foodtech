import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { can, getActiveVenue } from "@/lib/tenant";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getActiveVenue();
  if (!can(ctx.role, "manage_venue")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const table = await db.table.findFirst({
    where: { id: params.id, venueId: ctx.venueId, active: true },
    select: { label: true },
  });
  if (!table) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const baseUrl =
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  const url = `${baseUrl.replace(/\/$/, "")}/t/order/${ctx.venue.slug}/${encodeURIComponent(
    table.label,
  )}`;

  const fmt = new URL(req.url).searchParams.get("format") === "svg" ? "svg" : "png";
  if (fmt === "svg") {
    const svg = await QRCode.toString(url, {
      type: "svg",
      margin: 1,
      width: 320,
      color: { dark: "#15161a", light: "#ffffff" },
    });
    return new NextResponse(svg, {
      status: 200,
      headers: {
        "content-type": "image/svg+xml",
        "content-disposition": `attachment; filename="tavolo-${table.label}.svg"`,
      },
    });
  }
  const data = await QRCode.toDataURL(url, {
    margin: 1,
    width: 320,
    color: { dark: "#15161a", light: "#ffffff" },
  });
  return NextResponse.json({ url, dataUrl: data, label: table.label });
}
