import { z } from "zod";
import { db } from "@/lib/db";

const CATEGORY = z.enum([
  "GENERIC",
  "WELCOME",
  "REMINDER",
  "THANK_YOU",
  "PROMO",
  "WIN_BACK",
  "BIRTHDAY",
  "ANNIVERSARY",
  "EVENT",
]);

export const TemplateInput = z.object({
  name: z.string().min(1).max(80),
  channel: z.enum(["EMAIL", "SMS", "WHATSAPP"]).default("EMAIL"),
  subject: z.string().max(120).optional().nullable(),
  body: z.string().min(1).max(10_000),
  category: CATEGORY.default("GENERIC"),
});

export type TemplateInputType = z.infer<typeof TemplateInput>;

export async function listTemplates(venueId: string) {
  return db.messageTemplate.findMany({
    where: { venueId },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
}

export async function createTemplate(venueId: string, raw: unknown) {
  const data = TemplateInput.parse(raw);
  return db.messageTemplate.create({
    data: {
      venueId,
      name: data.name,
      channel: data.channel,
      subject: data.subject ?? null,
      body: data.body,
      category: data.category,
    },
  });
}

export async function updateTemplate(venueId: string, id: string, raw: unknown) {
  const existing = await db.messageTemplate.findFirst({ where: { id, venueId } });
  if (!existing) throw new Error("not_found");
  const data = TemplateInput.partial().parse(raw);
  return db.messageTemplate.update({
    where: { id },
    data: {
      name: data.name ?? undefined,
      channel: data.channel ?? undefined,
      subject: data.subject === undefined ? undefined : data.subject ?? null,
      body: data.body ?? undefined,
      category: data.category ?? undefined,
    },
  });
}

export async function deleteTemplate(venueId: string, id: string) {
  const existing = await db.messageTemplate.findFirst({ where: { id, venueId } });
  if (!existing) throw new Error("not_found");
  await db.messageTemplate.delete({ where: { id } });
}
