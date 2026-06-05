import { describe, expect, it } from "vitest";
import { riskLabel, riskTone, stageLabel } from "./display-copy";

describe("proposals list display copy", () => {
  it("localizes risk labels without leaking raw enums in English", () => {
    expect(riskLabel("HIGH", true)).toBe("High");
    expect(riskLabel("HIGH", false)).toBe("高");
    expect(riskLabel("CRITICAL", true)).toBe("Critical");
    expect(riskLabel("CRITICAL", false)).toBe("极高");
  });

  it("localizes stage labels without leaking raw enums in English", () => {
    expect(stageLabel("CONTACTED", true)).toBe("Contacted");
    expect(stageLabel("CONTACTED", false)).toBe("已接触");
    expect(stageLabel("WAITING_THEM", true)).toBe("Waiting on customer");
    expect(stageLabel("WAITING_THEM", false)).toBe("等对方");
  });

  it("converts persisted Chinese proposal labels for the English surface", () => {
    expect(riskLabel("高", true)).toBe("High");
    expect(riskLabel("极高", true)).toBe("Critical");
    expect(stageLabel("已接触", true)).toBe("Contacted");
    expect(stageLabel("等对方", true)).toBe("Waiting on customer");
    expect(stageLabel("内部同步", true)).toBe("Internal sync");
  });

  it("keeps risk tone stable for known and unknown risk levels", () => {
    expect(riskTone("LOW")).toBe("neutral");
    expect(riskTone("MEDIUM")).toBe("info");
    expect(riskTone("HIGH")).toBe("warning");
    expect(riskTone("CRITICAL")).toBe("danger");
    expect(riskTone("UNKNOWN")).toBe("neutral");
  });
});
