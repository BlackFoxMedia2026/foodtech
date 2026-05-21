import { z } from "zod";
import { db } from "@/lib/db";

export const VenueInput = z.object({
  name: z.string().min(1).max(120),
  kind: z.enum(["RESTAURANT", "BEACH_CLUB", "BAR", "HOTEL_RESTAURANT", "PRIVATE_CLUB"]),
  city: z.string().max(120).optional().nullable(),
  address: z.string().max(240).optional().nullable(),
  country: z.string().max(80).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  timezone: z.string().max(80).optional(),
  currency: z.string().max(8).optional(),
  active: z.boolean().optional(),
});

export type VenueInputType = z.infer<typeof VenueInput>;

function slugify(input: string) {
  return (
    input
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "")
      .slice(0, 60) || "venue"
  );
}

async function uniqueSlug(orgId: string, base: string, ignoreId?: string) {
  let slug = slugify(base);
  let i = 1;
  while (true) {
    const clash = await db.venue.findFirst({
      where: { orgId, slug, NOT: ignoreId ? { id: ignoreId } : undefined },
      select: { id: true },
    });
    if (!clash) return slug;
    i += 1;
    slug = `${slugify(base)}-${i}`;
  }
}

export async function createVenue(opts: {
  orgId: string;
  userId: string;
  raw: unknown;
}) {
  const data = VenueInput.parse(opts.raw);
  const slug = await uniqueSlug(opts.orgId, data.name);

  const venue = await db.venue.create({
    data: {
      orgId: opts.orgId,
      name: data.name,
      slug,
      kind: data.kind,
      city: data.city || null,
      address: data.address || null,
      country: data.country || null,
      phone: data.phone || null,
      email: data.email ? data.email : null,
      timezone: data.timezone || "Europe/Rome",
      currency: data.currency || "EUR",
      active: data.active ?? true,
    },
  });

  await db.venueMembership.create({
    data: { userId: opts.userId, venueId: venue.id, role: "MANAGER" },
  });

  return venue;
}

export async function updateVenue(opts: {
  orgId: string;
  venueId: string;
  raw: unknown;
}) {
  const data = VenueInput.partial().parse(opts.raw);
  const existing = await db.venue.findFirst({
    where: { id: opts.venueId, orgId: opts.orgId },
  });
  if (!existing) throw new Error("not_found");

  const slug =
    data.name && data.name !== existing.name
      ? await uniqueSlug(opts.orgId, data.name, opts.venueId)
      : undefined;

  return db.venue.update({
    where: { id: opts.venueId },
    data: {
      name: data.name ?? undefined,
      slug,
      kind: data.kind ?? undefined,
      city: data.city === undefined ? undefined : data.city || null,
      address: data.address === undefined ? undefined : data.address || null,
      country: data.country === undefined ? undefined : data.country || null,
      phone: data.phone === undefined ? undefined : data.phone || null,
      email: data.email === undefined ? undefined : data.email ? data.email : null,
      timezone: data.timezone ?? undefined,
      currency: data.currency ?? undefined,
      active: data.active ?? undefined,
    },
  });
}

export async function deleteVenue(opts: { orgId: string; venueId: string }) {
  const existing = await db.venue.findFirst({
    where: { id: opts.venueId, orgId: opts.orgId },
  });
  if (!existing) throw new Error("not_found");

  const remaining = await db.venue.count({ where: { orgId: opts.orgId } });
  if (remaining <= 1) throw new Error("last_venue");

  await db.venue.delete({ where: { id: opts.venueId } });
  return { ok: true };
}
