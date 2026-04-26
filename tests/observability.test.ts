import { afterEach, describe, expect, it, vi } from "vitest";
import { captureError, captureWarning, isObservabilityEnabled } from "@/lib/observability";

describe("observability", () => {
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  afterEach(() => errorSpy.mockClear());

  it("captureError logs structured payload", () => {
    captureError(new Error("boom"), { module: "test", venueId: "v1" });
    expect(errorSpy).toHaveBeenCalled();
    const [tag, raw] = errorSpy.mock.calls.at(-1)!;
    expect(tag).toBe("[tavolo:error]");
    const payload = JSON.parse(raw as string);
    expect(payload.module).toBe("test");
    expect(payload.venueId).toBe("v1");
    expect(payload.error.message).toBe("boom");
  });

  it("captureWarning marks severity", () => {
    captureWarning("slow query", { module: "db" });
    const [tag, raw] = errorSpy.mock.calls.at(-1)!;
    expect(tag).toBe("[tavolo:warning]");
    expect(JSON.parse(raw as string).level).toBe("warning");
  });

  it("isObservabilityEnabled reflects DSN env", () => {
    const original = process.env.SENTRY_DSN;
    delete process.env.SENTRY_DSN;
    expect(isObservabilityEnabled()).toBe(false);
    process.env.SENTRY_DSN = "https://abc@sentry.io/123";
    expect(isObservabilityEnabled()).toBe(true);
    if (original === undefined) delete process.env.SENTRY_DSN;
    else process.env.SENTRY_DSN = original;
  });
});
