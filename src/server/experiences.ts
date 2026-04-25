import { z } from "zod";
import { db } from "@/lib/db";

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

export const ExperienceInput = z.object({
  title: z.string().min(2).max(120),
  slug: z
    .string()
    .min(2)
    .max(80)
    .regex(SLUG_RE, "slug deve contenere solo a-z, 0-9 e trattini")
    .optional(),
  description: z.string().max(1000).optional().nullable(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  capacity: z.coerce.number().int().min(1).max(2000),
  priceCents: z.coerce.number().int().min(0).max(1_000_000).default(0),
  ticketUrl: z.string().url().optional().nullable().or(z.literal("")),
  coverImage: z.string().url().optional().nullable().or(z.literal("")),
  published: z.coerce.boolean().default(false),
});

export type ExperienceInputType = z.infer<typeof ExperienceInput>;

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function uniqueSlug(venueId: string, base: string, ignoreId?: string) {
  let slug = base || "evento";
  let i = 1;
  while (true) {
    const existing = await db.experience.findFirst({
      where: { venueId, slug, ...(ignoreId ? { NOT: { id: ignoreId } } : {}) },
      select: { id: true },
    });
    if (!existing) return slug;
    i += 1;
    slug = `${base}-${i}`;
  }
}

export async function createExperience(venueId: string, raw: unknown) {
  const data = ExperienceInput.parse(raw);
  if (data.endsAt < data.startsAt) throw new Error("invalid_dates");
  const slug = await uniqueSlug(venueId, data.slug ?? slugify(data.title));
  return db.experience.create({
    data: {
      venueId,
      title: data.title,
      slug,
      description: data.description || null,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      capacity: data.capacity,
      priceCents: data.priceCents,
      ticketUrl: data.ticketUrl || null,
      coverImage: data.coverImage || null,
      published: data.published,
    },
  });
}

export async function updateExperience(venueId: string, id: string, raw: unknown) {
  const existing = await db.experience.findFirst({ where: { id, venueId } });
  if (!existing) throw new Error("not_found");
  const data = ExperienceInput.partial().parse(raw);
  if (data.startsAt && data.endsAt && data.endsAt < data.startsAt) throw new Error("invalid_dates");
  const slug = data.slug
    ? await uniqueSlug(venueId, data.slug, id)
    : data.title
      ? await uniqueSlug(venueId, slugify(data.title), id)
      : undefined;
  return db.experience.update({
    where: { id },
    data: {
      title: data.title ?? undefined,
      slug: slug ?? undefined,
      description: data.description === undefined ? undefined : data.description || null,
      startsAt: data.startsAt ?? undefined,
      endsAt: data.endsAt ?? undefined,
      capacity: data.capacity ?? undefined,
      priceCents: data.priceCents ?? undefined,
      ticketUrl: data.ticketUrl === undefined ? undefined : data.ticketUrl || null,
      coverImage: data.coverImage === undefined ? undefined : data.coverImage || null,
      published: data.published ?? undefined,
    },
  });
}

export async function deleteExperience(venueId: string, id: string) {
  const existing = await db.experience.findFirst({ where: { id, venueId } });
  if (!existing) throw new Error("not_found");
  await db.experience.delete({ where: { id } });
}
