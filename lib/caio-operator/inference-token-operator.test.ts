import { describe, expect, it } from "vitest";

import {
  CAIO_INFERENCE_TOKEN_TEMPLATES,
  isCaioInferenceTokenOperation,
  issueInferenceTokenSchema,
  parseCaioInferenceTokenCliArgs,
} from "./inference-token-operator";

describe("inference token CLI arguments", () => {
  it("parses a template request and a run request", () => {
    expect(parseCaioInferenceTokenCliArgs(["--template=issue"])).toEqual({
      mode: "template",
      operation: "issue",
    });
    expect(
      parseCaioInferenceTokenCliArgs([
        "--operation=issue",
        "--workspace-id=ws_1",
        "--actor-user-id=user_1",
        "--input-file=/tmp/input.json",
        "--apply",
      ]),
    ).toEqual({
      mode: "run",
      operation: "issue",
      workspaceId: "ws_1",
      actorUserId: "user_1",
      inputFile: "/tmp/input.json",
      apply: true,
    });
  });

  it("defaults to validation only and lets list run without an input file", () => {
    const parsed = parseCaioInferenceTokenCliArgs([
      "--operation=list",
      "--workspace-id=ws_1",
      "--actor-user-id=user_1",
    ]);
    expect(parsed).toMatchObject({ mode: "run", apply: false, inputFile: null });
  });

  it("refuses unknown operations, unknown arguments and missing identity", () => {
    for (const argv of [
      ["--operation=rotate", "--workspace-id=ws_1", "--actor-user-id=user_1", "--input-file=x"],
      ["--template=rotate"],
      ["--operation=issue", "--workspace-id=ws_1", "--actor-user-id=user_1"],
      ["--operation=issue", "--workspace-id=ws_1", "--input-file=x"],
      ["--operation=issue", "-w", "ws_1"],
    ]) {
      expect(parseCaioInferenceTokenCliArgs(argv).mode).toBe("invalid");
    }
  });

  it("keeps the operation vocabulary and templates aligned", () => {
    for (const operation of ["issue", "revoke", "list"]) {
      expect(isCaioInferenceTokenOperation(operation)).toBe(true);
      expect(CAIO_INFERENCE_TOKEN_TEMPLATES[operation as "issue"]).toBeDefined();
    }
    expect(isCaioInferenceTokenOperation("rotate")).toBe(false);
  });

  it("requires a literal source address on issuance", () => {
    const base = { userRef: "user:inference-worker", deviceRef: "device:on-premises-1" };
    expect(issueInferenceTokenSchema.safeParse({ ...base, approvedSourceIp: [10, 0, 0, 12].join(".") }).success).toBe(true);
    expect(issueInferenceTokenSchema.safeParse({ ...base, approvedSourceIp: "worker.local" }).success).toBe(false);
    expect(issueInferenceTokenSchema.safeParse({ ...base, approvedSourceIp: [10, 0, 0, 12].join("."), extra: 1 }).success).toBe(false);
  });
});
