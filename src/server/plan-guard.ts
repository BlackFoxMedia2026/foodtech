import { db } from "@/lib/db";
import { getPlanLimits, nextTier, formatLimit, type PlanName } from "@/lib/plan-limits";
import { captureWarning } from "@/lib/observability";

// Thrown by the guards below. Catch the message at the API boundary and forward
// it to the client; the frontend renders a toast with the upgrade hint.
export const PLAN_LIMIT_ERROR = "plan_limit_reached";

class PlanLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlanLimitError";
  }
}

function upgradeHint(plan: PlanName, resourceLabel: string, currentMax: number): string {
  const next = nextTier(plan);
  if (!next) return "";
  const nextMax = (getPlanLimits(next) as Record<string, number | boolean>)[resourceLabel];
  if (typeof nextMax !== "number") return ` Upgrade to ${next}.`;
  return ` Upgrade to ${next} for ${formatLimit(nextMax)}.`;
}

function logHit(module: string, venueId: string | null, message: string) {
  captureWarning(message, {
    module: `plan-guard:${module}`,
    venueId: venueId ?? undefined,
    extra: { code: PLAN_LIMIT_ERROR },
  });
}

async function loadOrgFromVenue(venueId: string): Promise<{ orgId: string; plan: PlanName }> {
  const venue = await db.venue.findUnique({
    where: { id: venueId },
    select: { orgId: true, org: { select: { plan: true } } },
  });
  if (!venue) throw new Error("venue_not_found");
  return { orgId: venue.orgId, plan: venue.org.plan as PlanName };
}

async function loadPlanFromOrg(orgId: string): Promise<PlanName> {
  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { plan: true },
  });
  if (!org) throw new Error("org_not_found");
  return org.plan as PlanName;
}

export async function assertCanCreateVenue(orgId: string): Promise<void> {
  const plan = await loadPlanFromOrg(orgId);
  const limits = getPlanLimits(plan);
  if (limits.maxVenues === Infinity) return;
  const count = await db.venue.count({ where: { orgId } });
  if (count >= limits.maxVenues) {
    const msg = `${plan} plan allows max ${formatLimit(limits.maxVenues)} venue${
      limits.maxVenues === 1 ? "" : "s"
    }.${upgradeHint(plan, "maxVenues", limits.maxVenues)}`;
    logHit("venue", null, msg);
    throw new PlanLimitError(msg);
  }
}

export async function assertCanInviteStaff(venueId: string): Promise<void> {
  const { plan } = await loadOrgFromVenue(venueId);
  const limits = getPlanLimits(plan);
  if (limits.maxStaffPerVenue === Infinity) return;
  const count = await db.venueMembership.count({ where: { venueId } });
  if (count >= limits.maxStaffPerVenue) {
    const msg = `${plan} plan allows max ${formatLimit(
      limits.maxStaffPerVenue,
    )} staff per venue.${upgradeHint(plan, "maxStaffPerVenue", limits.maxStaffPerVenue)}`;
    logHit("staff", venueId, msg);
    throw new PlanLimitError(msg);
  }
}

export async function assertCanCreateAutomation(venueId: string): Promise<void> {
  const { plan } = await loadOrgFromVenue(venueId);
  const limits = getPlanLimits(plan);
  if (limits.maxActiveAutomations === Infinity) return;
  // We count active workflows: drafts (active=false) don't burn the quota.
  const count = await db.automationWorkflow.count({
    where: { venueId, active: true },
  });
  if (count >= limits.maxActiveAutomations) {
    const msg = `${plan} plan allows max ${formatLimit(
      limits.maxActiveAutomations,
    )} active automations.${upgradeHint(
      plan,
      "maxActiveAutomations",
      limits.maxActiveAutomations,
    )}`;
    logHit("automation", venueId, msg);
    throw new PlanLimitError(msg);
  }
}

export async function assertCanSendCampaign(venueId: string): Promise<void> {
  const { plan } = await loadOrgFromVenue(venueId);
  const limits = getPlanLimits(plan);
  if (limits.maxCampaignsPerMonth === Infinity) return;
  const since = new Date(Date.now() - 30 * 86400_000);
  const count = await db.campaign.count({
    where: { venueId, createdAt: { gte: since } },
  });
  if (count >= limits.maxCampaignsPerMonth) {
    const msg = `${plan} plan allows max ${formatLimit(
      limits.maxCampaignsPerMonth,
    )} campaigns per 30 days.${upgradeHint(
      plan,
      "maxCampaignsPerMonth",
      limits.maxCampaignsPerMonth,
    )}`;
    logHit("campaign", venueId, msg);
    throw new PlanLimitError(msg);
  }
}

export async function assertCanCreateApiToken(venueId: string): Promise<void> {
  const { plan } = await loadOrgFromVenue(venueId);
  const limits = getPlanLimits(plan);
  if (limits.maxApiTokens === Infinity) return;
  if (limits.maxApiTokens === 0) {
    const msg = `${plan} plan does not include API tokens.${upgradeHint(
      plan,
      "maxApiTokens",
      limits.maxApiTokens,
    )}`;
    logHit("api-token", venueId, msg);
    throw new PlanLimitError(msg);
  }
  // Active tokens only (revoked tokens don't count against the cap).
  const count = await db.apiToken.count({
    where: { venueId, revokedAt: null },
  });
  if (count >= limits.maxApiTokens) {
    const msg = `${plan} plan allows max ${formatLimit(
      limits.maxApiTokens,
    )} active API tokens.${upgradeHint(plan, "maxApiTokens", limits.maxApiTokens)}`;
    logHit("api-token", venueId, msg);
    throw new PlanLimitError(msg);
  }
}

export async function assertCanCreateConnector(venueId: string): Promise<void> {
  const { plan } = await loadOrgFromVenue(venueId);
  const limits = getPlanLimits(plan);
  if (limits.maxConnectorsPerVenue === Infinity) return;
  const count = await db.connector.count({ where: { venueId } });
  if (count >= limits.maxConnectorsPerVenue) {
    const msg = `${plan} plan allows max ${formatLimit(
      limits.maxConnectorsPerVenue,
    )} connectors per venue.${upgradeHint(
      plan,
      "maxConnectorsPerVenue",
      limits.maxConnectorsPerVenue,
    )}`;
    logHit("connector", venueId, msg);
    throw new PlanLimitError(msg);
  }
}
