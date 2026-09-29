import { describe, expect, it } from "vitest";

import { MEMBER_PROMPT_RESPONSE_KINDS } from "@/lib/member-gateway/prompt";
import { hashMemberWorkSignalPayload } from "@/lib/member-gateway/signal";
import {
  MEMBER_MCP_RESPONSE_KINDS,
  isCandidateResponseKind,
  isProtectedResponseKind,
  memberResponseConfirmationPayload,
  memberResponseInboxId,
  parseStoredResponseIntent,
  validateResponseText,
} from "@/lib/member-mcp/response-contract";

describe("member MCP response contract", () => {
  it("offers a subset of the Member Gateway response kinds, without commitment_confirm", () => {
    for (const kind of MEMBER_MCP_RESPONSE_KINDS) {
      expect(MEMBER_PROMPT_RESPONSE_KINDS).toContain(kind);
    }
    expect(MEMBER_MCP_RESPONSE_KINDS).not.toContain("commitment_confirm");
  });

  it("classifies protected and candidate kinds", () => {
    expect(["refuse", "pause", "appeal"].every(isProtectedResponseKind)).toBe(true);
    expect(isProtectedResponseKind("acknowledge")).toBe(false);
    expect(["progress_report", "free_text_answer"].every(isCandidateResponseKind)).toBe(true);
    expect(isCandidateResponseKind("refuse")).toBe(false);
  });

  it("requires a reason for protected responses and text for answers, not for acknowledge", () => {
    expect(validateResponseText("acknowledge", "")).toBeNull();
    expect(validateResponseText("refuse", " ")).toBe("reason_required");
    expect(validateResponseText("progress_report", "")).toBe("text_required");
    expect(validateResponseText("appeal", "x".repeat(2001))).toBe("text_too_long");
    expect(validateResponseText("pause", "本周在外出差")).toBeNull();
  });

  it("builds a deterministic confirmation payload that round-trips", () => {
    const intent = { promptRef: "p-1", promptVersion: 2, kind: "refuse" as const, text: "理由" };
    const a = memberResponseConfirmationPayload(intent);
    const b = memberResponseConfirmationPayload({ ...intent });
    expect(hashMemberWorkSignalPayload(a)).toBe(hashMemberWorkSignalPayload(b));
    expect(parseStoredResponseIntent(a.detail)).toEqual(intent);
    expect(hashMemberWorkSignalPayload(memberResponseConfirmationPayload({ ...intent, text: "别的" }))).not.toBe(
      hashMemberWorkSignalPayload(a),
    );
    expect(memberResponseInboxId("c-1")).toBe("mmcp-inbox:c-1");
  });

  it("rejects corrupt stored payloads", () => {
    expect(parseStoredResponseIntent("{")).toBeNull();
    expect(parseStoredResponseIntent(JSON.stringify({ promptRef: "p", promptVersion: 1, kind: "commitment_confirm", text: "" }))).toBeNull();
    expect(parseStoredResponseIntent(JSON.stringify({ promptRef: "p", promptVersion: 1.5, kind: "refuse", text: "" }))).toBeNull();
  });
});
