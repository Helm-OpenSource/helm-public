import { afterEach, describe, expect, it, vi } from "vitest";
import { addRequestMeta } from "next/dist/server/request-meta";
import { logRequests } from "next/dist/server/dev/log-requests";
import nextConfig from "../../next.config";

const outcomes = [
  { label: "success", statusCode: 200 },
  { label: "failure", statusCode: 401 },
  { label: "exception", statusCode: 500 },
] as const;

const safeFixtureArguments = [{
  identifier: "fixture-marker-17",
  password: "fixture-marker-29",
  token: "fixture-marker-31",
  cookie: "fixture-marker-43",
  form: "fixture-marker-53",
}];

describe("Next development Server Function logging policy", () => {
  afterEach(() => vi.restoreAllMocks());

  it.each(outcomes)("does not print action arguments after a $label result", ({ statusCode }) => {
    expect(nextConfig.logging).toMatchObject({ serverFunctions: false });

    const request: Record<PropertyKey, unknown> & { method: string; url: string } = {
      method: "POST",
      url: "/login",
    };
    const logging = nextConfig.logging;
    const serverFunctionsEnabled =
      typeof logging === "object" && logging !== null && Boolean(logging.serverFunctions);

    // Next's action handler only attaches devServerActionLog when this setting is enabled.
    if (serverFunctionsEnabled) {
      addRequestMeta(request, "devServerActionLog", {
        functionName: "fixtureAction",
        args: safeFixtureArguments,
        location: "fixture",
        duration: 1,
      });
    }

    let output = "";
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
      output += String(chunk);
      return true;
    });
    try {
      logRequests(
        request as never,
        { statusCode } as never,
        logging === false ? {} : logging ?? {},
        0n,
        1_000_000n,
        undefined,
        undefined,
        undefined,
        undefined,
      );
      for (const value of Object.values(safeFixtureArguments[0])) {
        expect(output).not.toContain(value);
      }
    } finally {
      writeSpy.mockRestore();
    }
  });
});
