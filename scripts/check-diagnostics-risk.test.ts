import { describe, it, expect } from "vitest";
import { runDiagnosticsRiskCheck, scanTextForForbidden } from "./check-diagnostics-risk";
import { KNOWN_FORBIDDEN_ACTIONS } from "../lib/diagnostics/command-registry";

describe("runDiagnosticsRiskCheck", () => {
  it("passes on the real diagnostics tool source", () => {
    expect(runDiagnosticsRiskCheck(process.cwd())).toEqual([]);
  });
});

describe("scanTextForForbidden — one bad fixture per forbidden action", () => {
  for (const token of KNOWN_FORBIDDEN_ACTIONS) {
    it(`catches a real ${token} usage`, () => {
      const v = scanTextForForbidden(`export const x = ${token}(payload);`, "fixture.ts");
      expect(v.map((x) => x.detail)).toContain(token);
    });
  }
});

describe("scanTextForForbidden — primitives", () => {
  it("catches network/exec primitives even with string arguments", () => {
    const v = scanTextForForbidden(
      ['const a = fetch("https://x");', "import cp from 'node:child_process';", "cp.execSync(cmd);"].join("\n"),
      "fixture.ts",
    );
    const ids = v.map((x) => x.detail);
    expect(ids).toContain("fetch");
    expect(ids).toContain("child_process");
    expect(ids).toContain("exec");
  });

  it("does NOT flag declarative forbiddenActions strings", () => {
    const v = scanTextForForbidden('forbiddenActions: ["auto_send", "activate_connector"],', "registry.ts");
    expect(v).toEqual([]);
  });
});
