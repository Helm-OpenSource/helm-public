import { describe, expect, it } from "vitest";
import { parseEmergencyArgs } from "./platform-emergency";

describe("emergency rollback arguments", () => {
  it("takes exactly the arguments of each command and is a dry run unless --apply", () => {
    const rollback = ["--command=emergency-rollback", "--workspace-id=ws-1", "--actor-user-id=u1", "--evidence-ref=owner-ruling:x"];
    expect(parseEmergencyArgs(rollback)).toEqual({ command: "emergency-rollback", workspaceId: "ws-1", actorUserId: "u1",
      evidenceRef: "owner-ruling:x", apply: false });
    expect(parseEmergencyArgs([...rollback, "--apply"])).toMatchObject({ apply: true });
    expect(parseEmergencyArgs([...rollback, "--rollback-id=r1"])).toEqual({ invalid: "arguments_invalid" });
    expect(parseEmergencyArgs(rollback.slice(0, 3))).toEqual({ invalid: "arguments_invalid" });
    expect(parseEmergencyArgs([...rollback, "--apply", "--apply"])).toEqual({ invalid: "duplicate_argument" });
    expect(parseEmergencyArgs([...rollback, "--to-mode=off"])).toEqual({ invalid: "unknown_argument" }); // no other direction exists
    expect(parseEmergencyArgs(["--command=confirm-rollback", "--rollback-id=r1", "--actor-user-id=u2", "--evidence-ref=r"]))
      .toMatchObject({ command: "confirm-rollback", rollbackId: "r1", apply: false });
    expect(parseEmergencyArgs(["--command=pending-rollbacks"])).toEqual({ command: "pending-rollbacks" });
    expect(parseEmergencyArgs(["--command=pending-rollbacks", "--apply"])).toEqual({ invalid: "arguments_invalid" });
  });
});
