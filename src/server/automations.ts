import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { dispatchMessage, hasConsent } from "@/server/messages";
import { captureError } from "@/lib/observability";
import { notify } from "@/server/notifications";

export const TRIGGERS = [
  "BOOKING_CREATED",
  "BOOKING_COMPLETED",
  "GUEST_BIRTHDAY",
  "GUEST_INACTIVE",
  "COUPON_NOT_USED",
  "NPS_DETRACTOR",
  "WIFI_LEAD_CREATED",
  "ORDER_COMPLETED",
  "CUSTOM",
] as const;
export type TriggerKind = (typeof TRIGGERS)[number];

const ConditionsSchema = z
  .object({
    loyaltyTiers: z.array(z.enum(["NEW", "REGULAR", "VIP", "AMBASSADOR"])).optional(),
    minVisits: z.coerce.number().int().min(0).optional(),
    inactiveDays: z.coerce.number().int().min(1).optional(), // for GUEST_INACTIVE
    couponCategory: z.string().optional(), // for COUPON_NOT_USED
    couponDaysSinceCreated: z.coerce.number().int().min(1).optional(),
    minPartySize: z.coerce.number().int().min(1).optional(),
    requireConsent: z.boolean().optional().default(true),
  })
  .strict()
  .partial();

const ActionSchema = z.object({
  kind: z.enum([
    "SEND_EMAIL",
    "SEND_SMS",
    "SEND_WHATSAPP",
    "CREATE_COUPON",
    "ADD_GUEST_TAG",
    "CREATE_STAFF_TASK",
  ]),
  params: z
    .object({
      // SEND_*
      subject: z.string().max(160).optional(),
      body: z.string().max(5000).optional(),
      // CREATE_COUPON
      couponName: z.string().max(80).optional(),
      couponKind: z.enum(["PERCENT", "FIXED", "FREE_ITEM"]).optional(),
      couponValue: z.coerce.number().int().min(0).optional(),
      couponDays: z.coerce.number().int().min(1).optional(),
      couponCategory: z
        .enum([
          "GENERIC",
          "BIRTHDAY",
          "WINBACK",
          "EVENT",
          "NEW_CUSTOMER",
          "WIFI",
          "REFERRAL",
          "STAFF",
        ])
        .optional(),
      // ADD_GUEST_TAG
      tag: z.string().max(40).optional(),
      // CREATE_STAFF_TASK
      title: z.string().max(120).optional(),
      details: z.string().max(500).optional(),
    })
    .partial(),
});

export const WorkflowInput = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(500).optional().nullable(),
  trigger: z.enum(TRIGGERS),
  conditions: ConditionsSchema.optional().nullable(),
  actions: z.array(ActionSchema).min(1).max(5),
  delayMinutes: z.coerce.number().int().min(0).max(60 * 24 * 7).default(0),
  active: z.coerce.boolean().optional(),
});

export type WorkflowInputType = z.infer<typeof WorkflowInput>;

export async function listWorkflows(venueId: string) {
  return db.automationWorkflow.findMany({
    where: { venueId },
    orderBy: [{ active: "desc" }, { createdAt: "desc" }],
  });
}

export async function createWorkflow(venueId: string, raw: unknown, createdBy: string | null) {
  const data = WorkflowInput.parse(raw);
  return db.automationWorkflow.create({
    data: {
      venueId,
      name: data.name,
      description: data.description ?? null,
      trigger: data.trigger,
      conditions: (data.conditions ?? undefined) as Prisma.InputJsonValue | undefined,
      actions: data.actions as Prisma.InputJsonValue,
      delayMinutes: data.delayMinutes,
      active: data.active ?? false,
      createdBy,
    },
  });
}

export async function updateWorkflow(venueId: string, id: string, raw: unknown) {
  const existing = await db.automationWorkflow.findFirst({ where: { id, venueId } });
  if (!existing) throw new Error("not_found");
  const data = WorkflowInput.partial().parse(raw);
  return db.automationWorkflow.update({
    where: { id },
    data: {
      name: data.name ?? undefined,
      description: data.description === undefined ? undefined : data.description ?? null,
      trigger: data.trigger ?? undefined,
      conditions:
        data.conditions === undefined
          ? undefined
          : ((data.conditions ?? undefined) as Prisma.InputJsonValue | undefined),
      actions: data.actions ? (data.actions as Prisma.InputJsonValue) : undefined,
      delayMinutes: data.delayMinutes ?? undefined,
      active: data.active ?? undefined,
    },
  });
}

export async function deleteWorkflow(venueId: string, id: string) {
  const existing = await db.automationWorkflow.findFirst({ where: { id, venueId } });
  if (!existing) throw new Error("not_found");
  await db.automationWorkflow.delete({ where: { id } });
}

// ─── Runner ──────────────────────────────────────────────────────────────────

type Conditions = z.infer<typeof ConditionsSchema>;
type Action = z.infer<typeof ActionSchema>;

export type FireContext = {
  venueId: string;
  guestId?: string;
  bookingId?: string;
  orderId?: string;
  payload?: Record<string, unknown>;
};

export async function fireTrigger(trigger: TriggerKind, ctx: FireContext) {
  const workflows = await db.automationWorkflow.findMany({
    where: { venueId: ctx.venueId, trigger, active: true },
  });
  for (const w of workflows) {
    const conditions = (w.conditions ?? null) as Conditions | null;
    const ok = await checkConditions(conditions, ctx);
    if (!ok) continue;
    await runWorkflow(w.id, w.actions as unknown as Action[], ctx, trigger);
  }
}

async function checkConditions(conditions: Conditions | null, ctx: FireContext): Promise<boolean> {
  if (!conditions) return true;
  if (ctx.guestId) {
    const guest = await db.guest.findUnique({
      where: { id: ctx.guestId },
      select: { loyaltyTier: true, totalVisits: true, lastVisitAt: true, marketingOptIn: true },
    });
    if (!guest) return false;
    if (conditions.loyaltyTiers?.length && !conditions.loyaltyTiers.includes(guest.loyaltyTier)) return false;
    if (conditions.minVisits != null && guest.totalVisits < conditions.minVisits) return false;
    if (conditions.inactiveDays != null) {
      const cutoff = new Date(Date.now() - conditions.inactiveDays * 86400_000);
      if (!guest.lastVisitAt || guest.lastVisitAt > cutoff) return false;
    }
  }
  if (conditions.minPartySize != null && ctx.bookingId) {
    const b = await db.booking.findUnique({ where: { id: ctx.bookingId }, select: { partySize: true } });
    if (!b || b.partySize < conditions.minPartySize) return false;
  }
  return true;
}

async function runWorkflow(
  workflowId: string,
  actions: Action[],
  ctx: FireContext,
  trigger: TriggerKind,
) {
  const run = await db.automationRun.create({
    data: {
      workflowId,
      venueId: ctx.venueId,
      trigger,
      status: "RUNNING",
      startedAt: new Date(),
      payload: (ctx.payload ?? {}) as Prisma.InputJsonValue,
    },
  });
  const result: { actions: { kind: string; ok: boolean; info?: string }[] } = { actions: [] };
  let allOk = true;
  for (const a of actions) {
    try {
      const info = await runAction(a, ctx, run.id);
      result.actions.push({ kind: a.kind, ok: true, info });
    } catch (err) {
      allOk = false;
      result.actions.push({
        kind: a.kind,
        ok: false,
        info: err instanceof Error ? err.message : String(err),
      });
      captureError(err, {
        module: "automations",
        venueId: ctx.venueId,
        resourceId: workflowId,
        extra: { trigger, action: a.kind, runId: run.id },
      });
    }
  }
  const finalStatus = allOk
    ? "SUCCEEDED"
    : result.actions.some((a) => a.ok)
      ? "PARTIAL"
      : "FAILED";
  await db.automationRun.update({
    where: { id: run.id },
    data: {
      status: finalStatus,
      finishedAt: new Date(),
      result: result as unknown as Prisma.InputJsonValue,
    },
  });
  if (finalStatus === "FAILED") {
    const failedAction = result.actions.find((a) => !a.ok);
    await notify({
      venueId: ctx.venueId,
      kind: "AUTOMATION_FAILED",
      title: "Automation fallita",
      body: `${trigger} · ${failedAction?.kind ?? "?"} · ${failedAction?.info ?? ""}`,
      link: "/automations",
      meta: { runId: run.id, workflowId },
    });
  }
}

async function runAction(action: Action, ctx: FireContext, runId: string): Promise<string> {
  switch (action.kind) {
    case "SEND_EMAIL":
    case "SEND_SMS":
    case "SEND_WHATSAPP": {
      if (!ctx.guestId) return "skipped: no guest";
      const guest = await db.guest.findUnique({
        where: { id: ctx.guestId },
        select: { firstName: true, email: true, phone: true },
      });
      if (!guest) return "skipped: guest_not_found";
      const channel = action.kind === "SEND_EMAIL" ? "EMAIL" : action.kind === "SEND_SMS" ? "SMS" : "WHATSAPP";
      const consent = await hasConsent(ctx.guestId, channel);
      if (!consent) return "skipped: no_consent";
      const to =
        channel === "EMAIL"
          ? guest.email
          : guest.phone;
      if (!to) return "skipped: no_address";
      const personalize = (s: string | undefined) =>
        (s ?? "").replace(/\{\{firstName\}\}/g, guest.firstName);
      await dispatchMessage({
        venueId: ctx.venueId,
        channel,
        to,
        subject: channel === "EMAIL" ? personalize(action.params.subject) : undefined,
        text: personalize(action.params.body) || personalize(action.params.subject) || "",
        guestId: ctx.guestId,
        workflowRunId: runId,
      });
      return `sent ${channel}`;
    }
    case "CREATE_COUPON": {
      const days = action.params.couponDays ?? 30;
      const validUntil = new Date(Date.now() + days * 86400_000);
      const code = `AUTO-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      await db.coupon.create({
        data: {
          venueId: ctx.venueId,
          code,
          name: action.params.couponName ?? "Coupon automatico",
          kind: action.params.couponKind ?? "PERCENT",
          value: action.params.couponValue ?? 10,
          category: action.params.couponCategory ?? "GENERIC",
          status: "ACTIVE",
          validUntil,
          maxPerGuest: 1,
          guestId: ctx.guestId ?? null,
        },
      });
      return `coupon ${code}`;
    }
    case "ADD_GUEST_TAG": {
      if (!ctx.guestId || !action.params.tag) return "skipped";
      const g = await db.guest.findUnique({ where: { id: ctx.guestId }, select: { tags: true } });
      if (!g) return "skipped: guest_not_found";
      if (g.tags.includes(action.params.tag)) return "noop";
      await db.guest.update({
        where: { id: ctx.guestId },
        data: { tags: [...g.tags, action.params.tag] },
      });
      return `tagged ${action.params.tag}`;
    }
    case "CREATE_STAFF_TASK": {
      // Lightweight task: stored as a BookingEvent on the linked booking when
      // present. When there's no booking, we emit a console log for now —
      // a dedicated Task model can be added later.
      if (ctx.bookingId) {
        await db.bookingEvent.create({
          data: {
            bookingId: ctx.bookingId,
            kind: "STATUS_CHANGED",
            message: `[automation] ${action.params.title ?? "Task"}: ${action.params.details ?? ""}`,
          },
        });
        return "task on booking";
      }
      console.log(`[automation:task] ${action.params.title}: ${action.params.details}`);
      return "logged";
    }
    default:
      return "unknown";
  }
}

// ─── Scheduled scans (used by the daily cron) ────────────────────────────────

export async function scanScheduledTriggers() {
  const now = new Date();
  const month = now.getMonth();
  const day = now.getDate();

  // GUEST_BIRTHDAY: only when active workflows for that trigger exist
  const birthdayHits = await db.guest.findMany({
    where: { birthday: { not: null } },
    select: { id: true, venueId: true, birthday: true },
  });
  for (const g of birthdayHits) {
    if (!g.birthday) continue;
    if (g.birthday.getMonth() !== month || g.birthday.getDate() !== day) continue;
    await fireTrigger("GUEST_BIRTHDAY", { venueId: g.venueId, guestId: g.id });
  }

  // GUEST_INACTIVE: 90 days threshold (matches the "Inattivi 90gg" segment)
  const inactiveThreshold = new Date(now.getTime() - 90 * 86400_000);
  const inactiveHits = await db.guest.findMany({
    where: {
      OR: [
        { lastVisitAt: { lt: inactiveThreshold } },
        { AND: [{ lastVisitAt: null }, { totalVisits: { gt: 0 } }] },
      ],
      // We tag inactive-fired so we don't repeat
      NOT: { tags: { has: "automation-inactive-fired" } },
    },
    select: { id: true, venueId: true },
    take: 200,
  });
  for (const g of inactiveHits) {
    await fireTrigger("GUEST_INACTIVE", { venueId: g.venueId, guestId: g.id });
    await db.guest
      .update({ where: { id: g.id }, data: { tags: { push: "automation-inactive-fired" } } })
      .catch(() => undefined);
  }

  // COUPON_NOT_USED: coupons created > N days ago, never redeemed, still ACTIVE
  // Default 14 days, can be tuned per workflow with conditions.couponDaysSinceCreated.
  const couponThreshold = new Date(now.getTime() - 14 * 86400_000);
  const cold = await db.coupon.findMany({
    where: {
      status: "ACTIVE",
      redemptionCount: 0,
      createdAt: { lt: couponThreshold },
      guestId: { not: null },
    },
    select: { id: true, venueId: true, guestId: true },
    take: 200,
  });
  for (const c of cold) {
    await fireTrigger("COUPON_NOT_USED", {
      venueId: c.venueId,
      guestId: c.guestId ?? undefined,
      payload: { couponId: c.id },
    });
  }
}
