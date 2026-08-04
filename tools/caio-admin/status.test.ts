import { describe, expect, it } from "vitest";

import { caioAdminStatus, type StatusPorts, type StatusSections } from "@/tools/caio-admin/status";

function ports(overrides: Partial<StatusPorts> = {}): StatusPorts {
  return {
    packageSection: async () => ({ state: "ok", activeRelease: "/opt/caio/releases/r1" }),
    configurationSection: async () => ({ state: "ok" }),
    runtimeSection: async () => ({ state: "running" }),
    activationSection: async () => ({ state: "full", phases: ["proxy", "context", "audit"] }),
    ...overrides,
  };
}

function sectionsOf(detail: Record<string, unknown>): StatusSections {
  return detail.sections as StatusSections;
}

describe("caioAdminStatus", () => {
  it("reports five independent sections", async () => {
    const result = await caioAdminStatus(ports());
    expect(result.status).toBe("ok");
    const sections = sectionsOf(result.detail);
    expect(Object.keys(sections).sort()).toEqual([
      "activation",
      "blocked",
      "configuration",
      "package",
      "runtime",
    ]);
    expect(sections.blocked).toEqual([]);
  });

  it("never conflates: installed-but-unconfigured shows package ok + configuration missing + runtime stopped + activation none", async () => {
    const result = await caioAdminStatus(
      ports({
        configurationSection: async () => ({ state: "missing" }),
        runtimeSection: async () => ({ state: "stopped" }),
        activationSection: async () => ({ state: "none", phases: [] }),
      }),
    );
    const sections = sectionsOf(result.detail);
    expect(sections.package.state).toBe("ok");
    expect(sections.configuration.state).toBe("missing");
    expect(sections.runtime.state).toBe("stopped");
    expect(sections.activation.state).toBe("none");
    expect(sections.blocked).toEqual([]);
  });

  it("degrades a failing section into blocked[] without masking the others", async () => {
    const result = await caioAdminStatus(
      ports({
        runtimeSection: async () => {
          throw new Error("launchctl probe failed");
        },
      }),
    );
    const sections = sectionsOf(result.detail);
    expect(sections.package.state).toBe("ok");
    expect(sections.runtime.state).toBe("unknown");
    expect(sections.blocked).toEqual([
      { section: "runtime", reason: "launchctl probe failed" },
    ]);
  });
});
