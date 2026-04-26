import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// 1x1 transparent GIF (43 bytes)
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

export async function GET(_req: Request, { params }: { params: { campaignId: string } }) {
  await db.campaign
    .update({
      where: { id: params.campaignId },
      data: { openedCount: { increment: 1 } },
    })
    .catch(() => undefined);

  return new Response(PIXEL, {
    status: 200,
    headers: {
      "content-type": "image/gif",
      "cache-control": "private, max-age=0, no-store",
    },
  });
}
