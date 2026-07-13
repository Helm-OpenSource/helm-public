import { describe, expect, it } from "vitest";
import { VERDICT_COPY, t } from "./audit-copy";

describe("audit-copy", () => {
  it("t() selects language", () => {
    expect(t({ zh: "通过", en: "Pass" }, true)).toBe("Pass");
  });
  it("verdict tones: pass ok, blocked/escalate/quarantined danger, pending neutral", () => {
    expect(VERDICT_COPY.pass.tone).toBe("ok");
    expect(VERDICT_COPY.blocked.tone).toBe("danger");
    expect(VERDICT_COPY.escalate.tone).toBe("danger");
    expect(VERDICT_COPY.quarantined.tone).toBe("danger");
    expect(VERDICT_COPY.pending.tone).toBe("neutral");
  });
  it("covers every verdict value", () => {
    expect(Object.keys(VERDICT_COPY).sort()).toEqual(
      ["advisory", "blocked", "escalate", "pass", "pending", "quarantined"].sort(),
    );
  });
});
