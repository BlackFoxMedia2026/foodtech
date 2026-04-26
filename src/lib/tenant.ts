import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";
import { db } from "./db";
import type { StaffRole } from "@prisma/client";

const VENUE_COOKIE = "tavolo.venue";

// requireUser is cached per request: every server component on the page
// that calls it will share the same auth() roundtrip.
export const requireUser = cache(async () => {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/sign-in");
  return { userId, session: session! };
});

// getActiveVenue is also cached per request. Every page typically calls it
// at least twice (the AppShell layout + the page itself), and slow pages
// call it again from each server component that needs RBAC. Without dedup
// each page paid 1 auth + 1 membership query × N callers; now it's 1 + 1
// total per render.
export const getActiveVenue = cache(async () => {
  const { userId, session } = await requireUser();

  const memberships = await db.venueMembership.findMany({
    where: { userId },
    include: { venue: { include: { org: true } } },
    orderBy: { createdAt: "asc" },
  });

  if (memberships.length === 0) redirect("/onboarding");

  const cookieVenueId = cookies().get(VENUE_COOKIE)?.value;
  const active =
    memberships.find((m) => m.venueId === cookieVenueId) ?? memberships[0];

  return {
    userId,
    session,
    venueId: active.venueId,
    venue: active.venue,
    role: active.role,
    orgId: active.venue.orgId,
    org: active.venue.org,
    allMemberships: memberships,
  };
});

export type Ability =
  | "manage_org"
  | "manage_venue"
  | "manage_bookings"
  | "view_revenue"
  | "edit_marketing"
  | "view_private";

const matrix: Record<StaffRole, Ability[]> = {
  MANAGER: ["manage_venue", "manage_bookings", "view_revenue", "edit_marketing", "view_private"],
  RECEPTION: ["manage_bookings"],
  WAITER: ["manage_bookings"],
  MARKETING: ["edit_marketing", "view_revenue"],
  READ_ONLY: [],
};

export function can(role: StaffRole, ability: Ability) {
  return matrix[role]?.includes(ability) ?? false;
}

export type GuestSanitized = {
  privateNotes?: string | null;
} & Record<string, unknown>;

export function sanitizeGuest<T extends Record<string, unknown>>(
  guest: T,
  role: StaffRole,
): T {
  if (can(role, "view_private")) return guest;
  if (!("privateNotes" in guest)) return guest;
  const { privateNotes: _privateNotes, ...rest } = guest as T & { privateNotes?: unknown };
  return rest as T;
}

export function sanitizeBooking<T extends Record<string, unknown>>(
  booking: T,
  role: StaffRole,
): T {
  if (can(role, "view_private")) return booking;
  if (!("internalNotes" in booking)) return booking;
  const { internalNotes: _internalNotes, ...rest } = booking as T & { internalNotes?: unknown };
  return rest as T;
}

export function setActiveVenueCookie(venueId: string) {
  cookies().set(VENUE_COOKIE, venueId, { path: "/", httpOnly: false, sameSite: "lax" });
}
