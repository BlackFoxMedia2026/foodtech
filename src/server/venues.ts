import { z } from "zod";
import { db } from "@/lib/db";
import { assertCanCreateVenue } from "@/server/plan-guard";
import { logAudit, sanitizeDiff } from "@/server/audit";

export type VenueAuditActor = {
  actorId?: string | null;
  actorEmail?: string | null;
  ip?: string | null;
  userAgent?: string | null;
};

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
  actor?: VenueAuditActor;
}) {
  const data = VenueInput.parse(opts.raw);
  await assertCanCreateVenue(opts.orgId);
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

  // Evento org-level: il venue appena creato non è ancora "attivo" — il log
  // resta visibile anche se più tardi il venue viene cancellato (FK su orgId).
  await logAudit({
    orgId: opts.orgId,
    venueId: venue.id,
    actorId: opts.actor?.actorId ?? opts.userId,
    actorEmail: opts.actor?.actorEmail ?? null,
    action: "venue.create",
    entityType: "Venue",
    entityId: venue.id,
    diff: {
      name: { old: null, new: venue.name },
      slug: { old: null, new: venue.slug },
      kind: { old: null, new: venue.kind },
    },
    ip: opts.actor?.ip ?? null,
    userAgent: opts.actor?.userAgent ?? null,
  });

  return venue;
}

export async function updateVenue(opts: {
  orgId: string;
  venueId: string;
  raw: unknown;
  actor?: VenueAuditActor;
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

  const updated = await db.venue.update({
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

  const diff = sanitizeDiff(
    existing as unknown as Record<string, unknown>,
    updated as unknown as Record<string, unknown>,
  );
  if (Object.keys(diff).length > 0) {
    await logAudit({
      orgId: opts.orgId,
      venueId: opts.venueId,
      actorId: opts.actor?.actorId ?? null,
      actorEmail: opts.actor?.actorEmail ?? null,
      action: "venue.update",
      entityType: "Venue",
      entityId: opts.venueId,
      diff,
      ip: opts.actor?.ip ?? null,
      userAgent: opts.actor?.userAgent ?? null,
    });
  }

  return updated;
}

export async function deleteVenue(opts: {
  orgId: string;
  venueId: string;
  actor?: VenueAuditActor;
}) {
  const existing = await db.venue.findFirst({
    where: { id: opts.venueId, orgId: opts.orgId },
  });
  if (!existing) throw new Error("not_found");

  const remaining = await db.venue.count({ where: { orgId: opts.orgId } });
  if (remaining <= 1) throw new Error("last_venue");

  await db.venue.delete({ where: { id: opts.venueId } });
  // Venue cancellato → venueId nel log a null per evitare riferimenti orfani.
  // L'evento resta agganciato all'org.
  await logAudit({
    orgId: opts.orgId,
    venueId: null,
    actorId: opts.actor?.actorId ?? null,
    actorEmail: opts.actor?.actorEmail ?? null,
    action: "venue.delete",
    entityType: "Venue",
    entityId: opts.venueId,
    diff: {
      name: { old: existing.name, new: null },
      slug: { old: existing.slug, new: null },
    },
    ip: opts.actor?.ip ?? null,
    userAgent: opts.actor?.userAgent ?? null,
  });
  return { ok: true };
}
