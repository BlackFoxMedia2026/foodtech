// Provider-agnostic Wi-Fi captive-portal adapter.
// In production we expect a router/hotspot to redirect users to /wifi/<slug>;
// after the user submits credentials we call provider.grantAccess() to unlock
// the network. Without a real provider configured we run in NoopProvider that
// always grants access in code (the captive page just shows "connected").

export type GrantOptions = {
  leadId: string;
  venueSlug: string;
  ipAddress: string | null;
  userAgent: string | null;
  durationSec?: number;
};

export type GrantResult =
  | { ok: true; sessionId?: string; provider: string }
  | { ok: false; reason: "provider_error" | "no_provider"; provider: string; error?: string };

interface WifiProvider {
  name: string;
  grantAccess(opts: GrantOptions): Promise<GrantResult>;
}

class NoopWifiProvider implements WifiProvider {
  name = "noop";
  async grantAccess(opts: GrantOptions): Promise<GrantResult> {
    console.log(`[wifi:noop] grant for lead ${opts.leadId} venue ${opts.venueSlug}`);
    return { ok: true, provider: this.name };
  }
}

// Hook for future Cisco Meraki / Ubiquiti / Aruba / OpenWisp adapter via a
// shared HTTP webhook. We only define the interface here; ENV vars not set
// means the noop is used.
class HttpHookWifiProvider implements WifiProvider {
  name = "http-hook";
  constructor(private url: string, private secret?: string) {}
  async grantAccess(opts: GrantOptions): Promise<GrantResult> {
    try {
      const res = await fetch(this.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(this.secret ? { authorization: `Bearer ${this.secret}` } : {}),
        },
        body: JSON.stringify(opts),
      });
      if (!res.ok) {
        return { ok: false, reason: "provider_error", provider: this.name, error: `${res.status}` };
      }
      const data = (await res.json().catch(() => ({}))) as { sessionId?: string };
      return { ok: true, sessionId: data.sessionId, provider: this.name };
    } catch (err) {
      return {
        ok: false,
        reason: "provider_error",
        provider: this.name,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

let _provider: WifiProvider | null = null;

export function isWifiHardwareConfigured() {
  return Boolean(process.env.WIFI_HOOK_URL);
}

export function whichWifiProvider() {
  return isWifiHardwareConfigured() ? "http-hook" : "noop";
}

export function wifiProvider(): WifiProvider {
  if (_provider) return _provider;
  const url = process.env.WIFI_HOOK_URL;
  if (url) {
    _provider = new HttpHookWifiProvider(url, process.env.WIFI_HOOK_SECRET);
  } else {
    _provider = new NoopWifiProvider();
  }
  return _provider;
}
