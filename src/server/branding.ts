import { z } from "zod";
import { db } from "@/lib/db";

// Public branding helpers used by every guest-facing page so the operator
// can show their own logo + accent. We default to Tavolo's gold accent
// when the venue hasn't set one, so untouched venues still look polished.

export const DEFAULT_ACCENT = "#c9a25a";

export type Brand = {
  name: string;
  city: string | null;
  logoUrl: string | null;
  accent: string;
  footnote: string | null;
};

export const BrandInput = z.object({
  brandLogoUrl: z
    .string()
    .url()
    .regex(/^https?:\/\//i, "must be http(s)")
    .max(400)
    .optional()
    .nullable(),
  brandAccent: z
    .string()
    .regex(/^#?[0-9a-fA-F]{3,8}$/)
    .max(9)
    .optional()
    .nullable(),
  brandFootnote: z.string().max(280).optional().nullable(),
});

function normaliseAccent(input: string | null | undefined): string {
  if (!input) return DEFAULT_ACCENT;
  return input.startsWith("#") ? input : `#${input}`;
}

export async function getVenueBrandBySlug(slug: string): Promise<Brand | null> {
  const v = await db.venue.findFirst({
    where: { slug, active: true },
    select: {
      name: true,
      city: true,
      brandLogoUrl: true,
      brandAccent: true,
      brandFootnote: true,
    },
  });
  if (!v) return null;
  return {
    name: v.name,
    city: v.city,
    logoUrl: v.brandLogoUrl,
    accent: normaliseAccent(v.brandAccent),
    footnote: v.brandFootnote,
  };
}

export async function getVenueBrandById(id: string): Promise<Brand | null> {
  const v = await db.venue.findUnique({
    where: { id },
    select: {
      name: true,
      city: true,
      brandLogoUrl: true,
      brandAccent: true,
      brandFootnote: true,
    },
  });
  if (!v) return null;
  return {
    name: v.name,
    city: v.city,
    logoUrl: v.brandLogoUrl,
    accent: normaliseAccent(v.brandAccent),
    footnote: v.brandFootnote,
  };
}

export async function saveVenueBrand(venueId: string, raw: unknown) {
  const data = BrandInput.parse(raw);
  const accent = data.brandAccent
    ? data.brandAccent.startsWith("#")
      ? data.brandAccent
      : `#${data.brandAccent}`
    : undefined;
  return db.venue.update({
    where: { id: venueId },
    data: {
      brandLogoUrl:
        data.brandLogoUrl === undefined ? undefined : data.brandLogoUrl ?? null,
      brandAccent: accent === undefined ? undefined : accent ?? null,
      brandFootnote:
        data.brandFootnote === undefined ? undefined : data.brandFootnote ?? null,
    },
    select: {
      brandLogoUrl: true,
      brandAccent: true,
      brandFootnote: true,
    },
  });
}
