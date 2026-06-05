// Subscription plan enforcement. `Organization.plan` (STARTER/GROWTH/ENTERPRISE)
// drives both quantitative caps (#venues, #staff, …) and feature flags
// (smart segments, AI concierge, multi-location analytics). Use `getPlanLimits`
// to resolve the matching record, then enforce via `@/server/plan-guard`.

export type PlanName = "STARTER" | "GROWTH" | "ENTERPRISE";

export const PLAN_LIMITS = {
  STARTER: {
    maxVenues: 1,
    maxStaffPerVenue: 5,
    maxActiveAutomations: 3,
    maxCampaignsPerMonth: 5,
    maxApiTokens: 0, // no API
    maxConnectorsPerVenue: 1,
    smartSegments: false,
    aiConcierge: false,
    multiLocationAnalytics: false,
  },
  GROWTH: {
    maxVenues: 5,
    maxStaffPerVenue: 20,
    maxActiveAutomations: 20,
    maxCampaignsPerMonth: 50,
    maxApiTokens: 5,
    maxConnectorsPerVenue: 5,
    smartSegments: true,
    aiConcierge: true,
    multiLocationAnalytics: true,
  },
  ENTERPRISE: {
    maxVenues: Infinity,
    maxStaffPerVenue: Infinity,
    maxActiveAutomations: Infinity,
    maxCampaignsPerMonth: Infinity,
    maxApiTokens: Infinity,
    maxConnectorsPerVenue: Infinity,
    smartSegments: true,
    aiConcierge: true,
    multiLocationAnalytics: true,
  },
} as const;

export type PlanLimit = (typeof PLAN_LIMITS)[keyof typeof PLAN_LIMITS];

export function getPlanLimits(plan: PlanName): PlanLimit {
  return PLAN_LIMITS[plan];
}

// Helper used by upsell messages: which tier would unblock the user?
export function nextTier(plan: PlanName): PlanName | null {
  if (plan === "STARTER") return "GROWTH";
  if (plan === "GROWTH") return "ENTERPRISE";
  return null;
}

// Format Infinity as "∞" for messages; otherwise return the number as-is.
export function formatLimit(value: number): string {
  return value === Infinity ? "∞" : String(value);
}
