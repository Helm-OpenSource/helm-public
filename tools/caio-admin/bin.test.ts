import { describe, expect, it } from "vitest";

import {
  blockedResult,
  failedResult,
  okResult,
} from "@/tools/caio-admin/contracts";
import {
  runCaioAdminCli,
  usage,
  type CaioAdminDispatch,
  type CliInvocation,
} from "@/tools/caio-admin/bin";

const SECRET_VALUE = "sk-A1b2C3d4E5f6G7h8I9j0K1l2M3n4";

function makeDeps(dispatch: CaioAdminDispatch) {
  const out: string[] = [];
  const err: string[] = [];
  return {
    deps: { dispatch, stdout: (t: string) => out.push(t), stderr: (t: string) => err.push(t) },
    out,
    err,
  };
}

describe("runCaioAdminCli", () => {
  it("maps ok/failed/blocked results to exit codes 0/2/3", async () => {
    for (const [result, code] of [
      [okResult("status"), 0],
      [failedResult("status"), 2],
      [blockedResult("activate", "phase_order"), 3],
    ] as const) {
      const { deps } = makeDeps(async () => result);
      await expect(runCaioAdminCli(["status"], deps)).resolves.toBe(code);
    }
  });

  it("passes the parsed command, positionals and --json flag to the dispatcher", async () => {
    let seen: CliInvocation | undefined;
    const { deps, out } = makeDeps(async (invocation) => {
      seen = invocation;
      return okResult(invocation.command);
    });
    const code = await runCaioAdminCli(["activate", "proxy", "--json"], deps);
    expect(code).toBe(0);
    expect(seen?.command).toBe("activate");
    expect(seen?.positionals).toEqual(["proxy"]);
    expect(seen?.json).toBe(true);
    // --json renders the same structure as JSON.
    const parsed = JSON.parse(out[0]) as { command: string; exitCode: number };
    expect(parsed.command).toBe("activate");
    expect(parsed.exitCode).toBe(0);
  });

  it("rejects unknown commands with usage, echoing only a scrubbed argv", async () => {
    const { deps, err } = makeDeps(async () => okResult("x"));
    const code = await runCaioAdminCli(["frobnicate", SECRET_VALUE], deps);
    expect(code).toBe(2);
    expect(err.join("\n")).toContain(usage());
    expect(err.join("\n")).not.toContain(SECRET_VALUE);
  });

  it("returns exit 2 and a redacted message when the dispatcher throws", async () => {
    const { deps, err } = makeDeps(async () => {
      throw new Error(`connection failed for token ${SECRET_VALUE}`);
    });
    const code = await runCaioAdminCli(["status"], deps);
    expect(code).toBe(2);
    expect(err.join("\n")).toContain("connection failed");
    expect(err.join("\n")).not.toContain(SECRET_VALUE);
  });

  it("renders --json without secret values even if a result carries one", async () => {
    const { deps, out } = makeDeps(async () =>
      okResult("status", { detail: { leaked: SECRET_VALUE } }),
    );
    await runCaioAdminCli(["status", "--json"], deps);
    expect(out[0]).not.toContain(SECRET_VALUE);
    expect(JSON.parse(out[0])).toHaveProperty("detail");
  });
});
