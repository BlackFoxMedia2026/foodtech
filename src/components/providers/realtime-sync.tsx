"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

// Centralised realtime polling. The original code base shipped a handful
// of components that each set up their own `setInterval(..., 30_000)` to
// call `router.refresh()` or bump a local clock — five separate timers
// firing at non-synchronised intervals, each scheduling its own server
// round-trip. That meant 4-6 simultaneous `router.refresh()` calls per
// page load, plus extra re-renders for every "now" tick.
//
// `RealtimeSyncProvider` collapses that into a single 30s interval:
//
//  - one shared counter (`tick`) re-renders only the components that
//    actually call `useRealtimeTick()`.
//  - one shared `router.refresh()` per tick (server data is fetched
//    once, not 4-6 times).
//  - `useRealtimeNow()` is a tiny helper for components that just need
//    a "now" clock to recompute "in 5 min" labels without forcing a
//    server refresh themselves.

type RealtimeContextValue = {
  tick: number;
};

const RealtimeContext = React.createContext<RealtimeContextValue | null>(null);

export function RealtimeSyncProvider({
  children,
  intervalMs = 30_000,
}: {
  children: React.ReactNode;
  intervalMs?: number;
}) {
  const router = useRouter();
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    const id = setInterval(() => {
      setTick((t) => t + 1);
      router.refresh();
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, router]);

  const value = React.useMemo<RealtimeContextValue>(() => ({ tick }), [tick]);

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

/**
 * Returns an incrementing counter that bumps every `intervalMs`.
 * Components that depend on the value will re-render once per tick.
 * Components that don't call this hook are *not* re-rendered.
 */
export function useRealtimeTick(): number {
  const ctx = React.useContext(RealtimeContext);
  // If a consumer is rendered outside the provider (e.g. in a Storybook
  // page or a public route) we degrade gracefully to a no-op counter.
  return ctx?.tick ?? 0;
}

/**
 * Returns a `Date` that updates whenever the shared realtime tick
 * advances. Useful for "tra 5 minuti" countdowns that don't otherwise
 * need a server refresh of their own.
 */
export function useRealtimeNow(): Date {
  const tick = useRealtimeTick();
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    setNow(new Date());
  }, [tick]);
  return now;
}
