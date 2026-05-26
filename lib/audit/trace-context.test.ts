import { describe, expect, it } from "vitest";
import {
  createAuditTraceContext,
  getCurrentAuditTraceContext,
  runWithAuditTraceContext,
} from "@/lib/audit/trace-context";

describe("audit trace-context", () => {
  it("returns undefined outside any scope", () => {
    expect(getCurrentAuditTraceContext()).toBeUndefined();
  });

  it("creates a fresh context with auto-generated UUIDs when no overrides supplied", () => {
    const context = createAuditTraceContext();
    expect(context.traceId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(context.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(context.parentEventId).toBeNull();
  });

  it("respects explicit overrides", () => {
    const context = createAuditTraceContext({
      traceId: "trace-explicit",
      requestId: "req-explicit",
      parentEventId: "parent-explicit",
    });
    expect(context.traceId).toBe("trace-explicit");
    expect(context.requestId).toBe("req-explicit");
    expect(context.parentEventId).toBe("parent-explicit");
  });

  it("propagates the context to nested sync work", () => {
    const seen: Array<string | undefined> = [];
    runWithAuditTraceContext({ traceId: "trace-1", requestId: "req-1" }, () => {
      seen.push(getCurrentAuditTraceContext()?.traceId);
      seen.push(getCurrentAuditTraceContext()?.requestId);
    });
    expect(seen).toEqual(["trace-1", "req-1"]);
    expect(getCurrentAuditTraceContext()).toBeUndefined();
  });

  it("propagates the context across awaited microtasks", async () => {
    const trace = await runWithAuditTraceContext(
      { traceId: "trace-async", requestId: "req-async" },
      async () => {
        await Promise.resolve();
        return getCurrentAuditTraceContext()?.traceId;
      },
    );
    expect(trace).toBe("trace-async");
  });

  it("isolates concurrent scopes", async () => {
    const [first, second] = await Promise.all([
      runWithAuditTraceContext({ traceId: "trace-A" }, async () => {
        await Promise.resolve();
        return getCurrentAuditTraceContext()?.traceId;
      }),
      runWithAuditTraceContext({ traceId: "trace-B" }, async () => {
        await Promise.resolve();
        return getCurrentAuditTraceContext()?.traceId;
      }),
    ]);
    expect(first).toBe("trace-A");
    expect(second).toBe("trace-B");
  });
});
