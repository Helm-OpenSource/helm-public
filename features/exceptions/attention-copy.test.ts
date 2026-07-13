import { describe, expect, it } from "vitest";
import { SEVERITY_COPY, severityRank, t } from "./attention-copy";

describe("attention-copy", () => {
  it("t() selects language", () => {
    expect(t({ zh: "紧急", en: "Critical" }, true)).toBe("Critical");
    expect(t({ zh: "紧急", en: "Critical" }, false)).toBe("紧急");
  });
  it("severity ranks critical < warning < info (critical first) and tones escalate", () => {
    expect(severityRank("critical")).toBeLessThan(severityRank("warning"));
    expect(severityRank("warning")).toBeLessThan(severityRank("info"));
    expect(SEVERITY_COPY.critical.tone).toBe("danger");
    expect(SEVERITY_COPY.info.tone).toBe("neutral");
  });
  it("covers every severity value", () => {
    expect(Object.keys(SEVERITY_COPY).sort()).toEqual(["critical", "info", "warning"]);
  });
});
