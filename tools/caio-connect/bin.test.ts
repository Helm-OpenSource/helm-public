import { describe, expect, it } from "vitest";

import {
  connectExitCode,
  connectUsage,
  runCaioConnectCli,
  type ConnectCliResult,
  type ConnectDispatch,
} from "@/tools/caio-connect/bin";

// Synthetic entropy-shaped token built by concatenation so the public-release
// static line scan never matches an assignment-form credential.
const SECRET_TOKEN = ["mcp-tok-", "Aa1Bb2Cc3", "Dd4Ee5Ff6", "Gg7Hh8"].join("");

function makeDeps(dispatch: ConnectDispatch) {
  const out: string[] = [];
  const err: string[] = [];
  return {
    deps: { dispatch, stdout: (t: string) => out.push(t), stderr: (t: string) => err.push(t) },
    out,
    err,
  };
}

describe("runCaioConnectCli", () => {
  it("maps result statuses to exit codes 0/2/3", async () => {
    const cases: Array<[ConnectCliResult, number]> = [
      [{ command: "pair", status: "ok" }, 0],
      [{ command: "pair", status: "failed" }, 2],
      [{ command: "pair", status: "blocked", blockedReason: "blocked:signing_required" }, 3],
    ];
    for (const [result, code] of cases) {
      expect(connectExitCode(result)).toBe(code);
      const { deps } = makeDeps(async () => result);
      await expect(runCaioConnectCli(["pair"], deps)).resolves.toBe(code);
    }
  });

  it("renders --json without secret values", async () => {
    const { deps, out } = makeDeps(async () => ({
      command: "pair",
      status: "ok" as const,
      detail: { note: `token was ${SECRET_TOKEN}` },
    }));
    await runCaioConnectCli(["pair", "--json"], deps);
    expect(out[0]).not.toContain(SECRET_TOKEN);
    expect(JSON.parse(out[0])).toMatchObject({ command: "pair", status: "ok" });
  });

  it("rejects unknown commands with scrubbed argv and usage", async () => {
    const { deps, err } = makeDeps(async () => ({ command: "x", status: "ok" as const }));
    const code = await runCaioConnectCli(["steal", SECRET_TOKEN], deps);
    expect(code).toBe(2);
    expect(err.join("\n")).toContain(connectUsage());
    expect(err.join("\n")).not.toContain(SECRET_TOKEN);
  });

  it("returns exit 2 with a redacted message when the dispatcher throws", async () => {
    const { deps, err } = makeDeps(async () => {
      throw new Error(`gateway said no for ${SECRET_TOKEN}`);
    });
    await expect(runCaioConnectCli(["pair"], deps)).resolves.toBe(2);
    expect(err.join("\n")).not.toContain(SECRET_TOKEN);
  });
});
