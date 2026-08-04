import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { caioAdminRollback, type RollbackPorts } from "@/tools/caio-admin/rollback";

interface Harness {
  ports: RollbackPorts;
  calls: string[];
  state: { flagsDisabled: boolean; serviceRunning: string | null; activeRelease: string | null };
}

function harness(options: { compatible?: boolean; valid?: boolean } = {}): Harness {
  const calls: string[] = [];
  const state: Harness["state"] = {
    flagsDisabled: false,
    serviceRunning: "new-release",
    activeRelease: "/releases/new",
  };
  const ports: RollbackPorts = {
    featureFlags: {
      disableAll: async () => {
        calls.push("flags.disableAll");
        state.flagsDisabled = true;
        return { disabled: ["caio_proxy", "caio_context"] };
      },
    },
    service: {
      stop: async () => {
        calls.push("service.stop");
        state.serviceRunning = null;
      },
      start: async (releaseDir) => {
        calls.push("service.start");
        state.serviceRunning = releaseDir;
      },
    },
    releaseValidation: {
      validate: async () => {
        calls.push("release.validate");
        return options.valid === false
          ? { valid: false, reason: "seal missing" }
          : { valid: true };
      },
    },
    schema: {
      isCompatibleWithCurrentData: async () => {
        calls.push("schema.check");
        return options.compatible !== false;
      },
    },
    activeRelease: {
      switchTo: async (releaseDir) => {
        calls.push("activeRelease.switchTo");
        state.activeRelease = releaseDir;
      },
    },
  };
  return { ports, calls, state };
}

describe("caioAdminRollback", () => {
  it("enforces the order: flags off -> stop -> validate -> switch -> start", async () => {
    const h = harness();
    const result = await caioAdminRollback({ toRelease: "/releases/old", ports: h.ports });
    expect(result.status).toBe("ok");
    expect(h.calls).toEqual([
      "flags.disableAll",
      "service.stop",
      "release.validate",
      "schema.check",
      "activeRelease.switchTo",
      "service.start",
    ]);
    expect(h.state).toEqual({
      flagsDisabled: true,
      serviceRunning: "/releases/old",
      activeRelease: "/releases/old",
    });
  });

  it("blocks on an invalid target after stopping, without switching or starting", async () => {
    const h = harness({ valid: false });
    const result = await caioAdminRollback({ toRelease: "/releases/old", ports: h.ports });
    expect(result.status).toBe("blocked");
    expect(result.blockedReason).toBe("blocked:invalid_rollback_target");
    expect(h.calls).toEqual(["flags.disableAll", "service.stop", "release.validate"]);
    expect(h.state.serviceRunning).toBeNull();
  });

  it("stays stopped and blocks restore_backup_required on schema incompatibility — never auto-restores", async () => {
    const h = harness({ compatible: false });
    const result = await caioAdminRollback({ toRelease: "/releases/old", ports: h.ports });
    expect(result.status).toBe("blocked");
    expect(result.blockedReason).toBe("blocked:restore_backup_required");
    expect(result.detail.serviceState).toBe("stopped");
    expect(h.state.serviceRunning).toBeNull();
    expect(h.calls).not.toContain("activeRelease.switchTo");
    expect(h.calls).not.toContain("service.start");
  });

  it("is idempotent: a re-run converges on the same terminal state", async () => {
    const h = harness();
    await caioAdminRollback({ toRelease: "/releases/old", ports: h.ports });
    const stateAfterFirst = { ...h.state };
    const second = await caioAdminRollback({ toRelease: "/releases/old", ports: h.ports });
    expect(second.status).toBe("ok");
    expect(h.state).toEqual(stateAfterFirst);
  });

  it("exposes no database-reset capability in its ports", () => {
    const h = harness();
    const portKeys = [
      ...Object.keys(h.ports),
      ...Object.values(h.ports).flatMap((group) => Object.keys(group)),
    ];
    expect(portKeys.some((key) => /reset/i.test(key))).toBe(false);
  });

  it("contains no db-reset invocation in any caio-admin source file", async () => {
    const dir = path.dirname(fileURLToPath(import.meta.url));
    const files = (await fs.readdir(dir)).filter(
      (name) => name.endsWith(".ts") && !name.endsWith(".test.ts"),
    );
    expect(files.length).toBeGreaterThan(0);
    const forbidden = ["db", "reset"].join(":"); // avoid self-matching
    for (const name of files) {
      const body = await fs.readFile(path.join(dir, name), "utf8");
      expect(body.includes(forbidden), `${name} must not reference ${forbidden}`).toBe(false);
    }
  });
});
