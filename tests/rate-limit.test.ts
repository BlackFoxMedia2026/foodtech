import { describe, expect, it } from "vitest";
import { rateLimit } from "@/lib/rate-limit";

function fakeReq(ip: string) {
  return new Request("http://localhost/test", { headers: { "x-forwarded-for": ip } });
}

describe("rateLimit", () => {
  it("allows up to max requests then blocks", () => {
    const ip = "1.2.3.4";
    const opts = { key: "test-bucket", max: 3, windowMs: 60_000 };
    expect(rateLimit(fakeReq(ip), opts).ok).toBe(true);
    expect(rateLimit(fakeReq(ip), opts).ok).toBe(true);
    expect(rateLimit(fakeReq(ip), opts).ok).toBe(true);
    expect(rateLimit(fakeReq(ip), opts).ok).toBe(false);
  });

  it("buckets are scoped by ip", () => {
    const opts = { key: "scoped", max: 1, windowMs: 60_000 };
    expect(rateLimit(fakeReq("9.9.9.1"), opts).ok).toBe(true);
    expect(rateLimit(fakeReq("9.9.9.2"), opts).ok).toBe(true);
    expect(rateLimit(fakeReq("9.9.9.1"), opts).ok).toBe(false);
  });
});
