import { NextResponse } from "next/server";
import { getActiveVenue } from "@/lib/tenant";
import { findDuplicateGuest } from "@/server/guests";

// GET /api/guests/find?email=...&phone=...  →  { match: Guest | null }
// Usato dai form prenotazione/lista d'attesa per dedup hint live.
export async function GET(req: Request) {
  const ctx = await getActiveVenue();
  const url = new URL(req.url);
  const email = url.searchParams.get("email");
  const phone = url.searchParams.get("phone");
  if (!email && !phone) {
    return NextResponse.json({ match: null });
  }
  const match = await findDuplicateGuest(ctx.venueId, { email, phone });
  if (!match) return NextResponse.json({ match: null });
  return NextResponse.json({
    match: {
      id: match.id,
      firstName: match.firstName,
      lastName: match.lastName,
      email: match.email,
      phone: match.phone,
      loyaltyTier: match.loyaltyTier,
      totalVisits: match.totalVisits,
      lastVisitAt: match.lastVisitAt,
      allergies: match.allergies,
      tags: match.tags,
      recentBookings: match.bookings.map((b) => ({
        id: b.id,
        startsAt: b.startsAt.toISOString(),
        partySize: b.partySize,
        status: b.status,
      })),
    },
  });
}
