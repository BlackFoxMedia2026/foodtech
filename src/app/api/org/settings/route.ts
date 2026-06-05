import { NextResponse } from "next/server";
import { z } from "zod";
import { getActiveVenue, can } from "@/lib/tenant";
import { db } from "@/lib/db";
import { logAudit, sanitizeDiff } from "@/server/audit";

// Whitelist of currencies we expose in the picker. The schema accepts any
// 3-letter code, but we lock the UI to the ones whose ECB-published rate is
// reliable via Frankfurter.
const ALLOWED_CURRENCIES = ["EUR", "USD", "GBP", "CHF", "SEK", "NOK", "JPY", "AUD"] as const;

const OrgSettingsInput = z.object({
  baseCurrency: z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/, "currency_must_be_uppercase_iso_4217")
    .refine((c) => (ALLOWED_CURRENCIES as readonly string[]).includes(c), "currency_not_supported"),
});

export async function POST(req: Request) {
  const ctx = await getActiveVenue();
  // Only org-level managers should touch reporting currency — it changes the
  // numbers every cross-venue dashboard renders. We piggyback on manage_venue
  // (MANAGER only in the RBAC matrix).
  if (!can(ctx.role, "manage_venue")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = OrgSettingsInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const before = await db.organization.findUnique({
    where: { id: ctx.orgId },
    select: { baseCurrency: true, name: true },
  });
  if (!before) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const updated = await db.organization.update({
    where: { id: ctx.orgId },
    data: { baseCurrency: parsed.data.baseCurrency },
    select: { id: true, baseCurrency: true },
  });

  const diff = sanitizeDiff(
    { baseCurrency: before.baseCurrency },
    { baseCurrency: updated.baseCurrency },
  );
  if (Object.keys(diff).length > 0) {
    await logAudit({
      orgId: ctx.orgId,
      actorId: ctx.userId,
      actorEmail:
        (ctx.session?.user as { email?: string | null } | undefined)?.email ?? null,
      action: "venue.update", // re-use closest existing AuditAction; entityType pins it to Organization
      entityType: "Organization",
      entityId: ctx.orgId,
      diff,
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: req.headers.get("user-agent") ?? null,
    });
  }

  return NextResponse.json(updated);
}

// Also expose via PATCH for clients that prefer it; identical handler.
export const PATCH = POST;
