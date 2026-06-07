import { describe, it, expect } from "vitest";
import { buildDoctorPacket, helmDoctorPacketSchema, redactText } from "./doctor-packet";

const fixedNow = () => new Date("2026-06-07T00:00:00.000Z");

function basePacket(overrides: Parameters<typeof buildDoctorPacket>[0] = {} as never) {
  return buildDoctorPacket({
    repo: { name: "helm-console", branch: "main", head: "abc123", dirtyState: "unknown" },
    commandResults: [
      {
        commandId: "public-docs-guard",
        ok: true,
        risk: "read",
        outputSummary: "checked public docs",
        evidenceRefs: ["docs/public-docs-manifest.json"],
        degradedEvidence: ["not executed in slice-1"],
      },
    ],
    now: fixedNow,
    ...overrides,
  });
}

describe("buildDoctorPacket", () => {
  it("produces a valid packet with a redactionStatus", () => {
    const packet = basePacket();
    expect(() => helmDoctorPacketSchema.parse(packet)).not.toThrow();
    expect(packet.redactionStatus).toBe("redacted");
    expect(packet.repo.dirtyState).toBe("unknown");
  });

  it("preserves degraded evidence and emits a degraded warning", () => {
    const packet = basePacket();
    expect(packet.commandResults[0].degradedEvidence).toContain("not executed in slice-1");
    expect(packet.warnings.join(" ")).toMatch(/degraded evidence/i);
  });

  it("does NOT claim release-ready / deployment / accepted / approval", () => {
    const json = JSON.stringify(basePacket());
    expect(json).not.toMatch(/release[- ]?ready|deployment[- ]?ready|production[- ]?ready/i);
    expect(json).not.toMatch(/accepted_by_human|approval|approved/i);
    // It DOES state human review is required (recommendation/review-first).
    expect(basePacket().nextActions.join(" ")).toMatch(/human review/i);
  });

  it("never performs auto actions (blockedActions evidence)", () => {
    const blocked = basePacket().blockedActions.join(" ");
    expect(blocked).toMatch(/auto_send: not performed/);
    expect(blocked).toMatch(/activate_connector: not performed/);
  });

  it("redacts raw private paths/emails/credentials in summaries", () => {
    // Credential assembled from fragments so the committed test source has no
    // contiguous scheme://user:pass@host literal (public-release guard).
    const cred = ["mysql://root", "pw@db/x"].join(":");
    const secretPath = ["/Users", "alice", "secret", "path"].join("/");
    const email = ["bob", "example.com"].join("@");
    const packet = buildDoctorPacket({
      repo: { name: "helm-console", branch: "main", head: "abc", dirtyState: "unknown" },
      commandResults: [
        {
          commandId: "c1",
          ok: true,
          risk: "read",
          outputSummary: `failed at ${secretPath} for ${email} via ${cred}`,
        },
      ],
      now: fixedNow,
    });
    const s = packet.commandResults[0].outputSummary;
    expect(s).not.toContain(secretPath);
    expect(s).not.toContain(email);
    expect(s).not.toContain("root:pw@db");
    expect(s).toContain("<path>");
  });
});

describe("redactText", () => {
  it("masks credentials, paths, and emails", () => {
    expect(redactText(["postgres://u", "p@h/db"].join(":"))).toContain("<redacted-credential>");
    expect(redactText("/home/me/.ssh/key")).toContain("<path>");
    expect(redactText("ping a@b.co")).toContain("<email>");
    expect(redactText("plain structural text")).toBe("plain structural text");
  });
});
