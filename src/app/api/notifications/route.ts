import { NextResponse } from "next/server";
import { getActiveVenue } from "@/lib/tenant";
import { listNotifications, unreadCount } from "@/server/notifications";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ctx = await getActiveVenue();
  const url = new URL(req.url);
  const unreadOnly = url.searchParams.get("unread") === "1";
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 20), 100);
  const [items, unread] = await Promise.all([
    listNotifications(ctx.venueId, { limit, unreadOnly }),
    unreadCount(ctx.venueId),
  ]);
  return NextResponse.json({ items, unread });
}
