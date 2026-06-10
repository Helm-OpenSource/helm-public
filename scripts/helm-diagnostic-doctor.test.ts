import { describe, it, expect } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildDoctorEnvelope,
  isAllowedOutputPath,
  main,
} from "./helm-diagnostic-doctor";

const fixedNow = () => new Date("2026-06-07T00:00:00.000Z");

describe("buildDoctorEnvelope", () => {
  it("produces a read-risk envelope that makes no readiness/approval claim", () => {
    const env = buildDoctorEnvelope(process.cwd(), fixedNow);
    expect(env.ok).toBe(true);
    expect(env.command).toBe("helm:diagnostic-doctor");
    expect(env.risk).toBe("read");
    expect(env.data.redactionStatus).toBe("redacted");
    const json = JSON.stringify(env);
    expect(json).not.toMatch(/release[- ]?ready|deployment[- ]?ready|accepted_by_human|approval|approved/i);
  });
});

describe("isAllowedOutputPath", () => {
  it("permits paths under the OS temp dir only", () => {
    const tmp = path.join(os.tmpdir(), "helm-doctor-out.json");
    expect(isAllowedOutputPath(tmp, process.cwd())).toBe(true);
  });

  it("rejects paths inside the repo and arbitrary absolute paths", () => {
    expect(isAllowedOutputPath("docs/out.json", process.cwd())).toBe(false);
    expect(isAllowedOutputPath("/etc/passwd", process.cwd())).toBe(false);
    expect(isAllowedOutputPath(".", process.cwd())).toBe(false);
  });

  it("rejects a symlink inside tmp that points into the repo (realpath)", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "helm-doctor-ln-"));
    try {
      const link = path.join(dir, "escape");
      symlinkSync(process.cwd(), link); // tmp symlink -> repo root
      // Writing "under" the symlink would land in the repo; must be rejected.
      expect(isAllowedOutputPath(path.join(link, "out.json"), process.cwd())).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("main", () => {
  it("prints to stdout and returns 0 without --output", () => {
    expect(main([], process.cwd())).toBe(0);
  });

  it("writes only under the OS temp dir and rejects repo paths", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "helm-doctor-"));
    try {
      const out = path.join(dir, "packet.json");
      expect(main(["--output", out], process.cwd())).toBe(0);
      expect(existsSync(out)).toBe(true);
      const env = JSON.parse(readFileSync(out, "utf8"));
      expect(env.command).toBe("helm:diagnostic-doctor");

      // A repo-relative path must be refused (nonzero, no write).
      expect(main(["--output", "docs/should-not-write.json"], process.cwd())).toBe(1);
      expect(existsSync(path.join(process.cwd(), "docs/should-not-write.json"))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
