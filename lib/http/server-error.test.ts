import { afterEach, describe, expect, it, vi } from "vitest";

import { serverErrorMessage } from "@/lib/http/server-error";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("serverErrorMessage", () => {
  it("returns only the generic fallback, never the raw error message", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const out = serverErrorMessage(
      new Error("Table `secret_table` does not exist on db host internal-db-host"),
      "Operation failed",
    );
    expect(out).toBe("Operation failed");
    expect(out).not.toContain("secret_table");
    expect(out).not.toContain("internal-db-host");
  });

  it("logs the real error server-side with the context label", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    serverErrorMessage(new Error("boom"), "fallback", "llm-logs");
    expect(spy).toHaveBeenCalledTimes(1);
    expect(String(spy.mock.calls[0][0])).toContain("[llm-logs]");
    expect(String(spy.mock.calls[0][0])).toContain("boom");
  });

  it("handles non-Error throws", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(serverErrorMessage("string failure", "fallback")).toBe("fallback");
  });
});
