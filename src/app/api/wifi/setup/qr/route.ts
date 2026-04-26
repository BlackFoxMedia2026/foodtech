import { NextResponse } from "next/server";
import { can, getActiveVenue } from "@/lib/tenant";
import { generatePortalQr } from "@/server/wifi-setup";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const ctx = await getActiveVenue();
  if (!can(ctx.role, "edit_marketing")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const fmt = new URL(req.url).searchParams.get("format") === "svg" ? "svg" : "png";
  const baseUrl =
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  const captiveUrl = `${baseUrl.replace(/\/$/, "")}/wifi/${ctx.venue.slug}`;
  const data = await generatePortalQr(captiveUrl, fmt);

  if (fmt === "svg") {
    return new NextResponse(data, {
      status: 200,
      headers: {
        "content-type": "image/svg+xml",
        "content-disposition": `attachment; filename="tavolo-wifi-${ctx.venue.slug}.svg"`,
      },
    });
  }
  return NextResponse.json({ url: captiveUrl, dataUrl: data });
}
