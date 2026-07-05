import { describe, expect, it } from "vitest";

import {
  BOUNDARY_BAR_SEGMENT_LABELS,
  resolveBoundaryBarCopy,
  type BoundaryBarCopyInput,
} from "./boundary-bar-copy";
import {
  EFFECT_MODES,
  resolveEffectModeBadge,
} from "./effect-mode-badge-copy";

const VALID: BoundaryBarCopyInput = {
  observed: { zh: "只读遥测摘要", en: "Read-only telemetry summary" },
  wontDo: { zh: "不读取客户明文", en: "Never reads customer plaintext" },
  decider: { zh: "运营者复核后决定", en: "The operator decides after review" },
  negatives: [
    { zh: "无自动外发", en: "No auto-send" },
    { zh: "无自动写回", en: "No auto-writeback" },
  ],
};

describe("resolveBoundaryBarCopy", () => {
  it("resolves valid copy per locale", () => {
    const zh = resolveBoundaryBarCopy(VALID, false);
    const en = resolveBoundaryBarCopy(VALID, true);

    expect(zh.ok && zh.observed).toBe("只读遥测摘要");
    expect(en.ok && en.observed).toBe("Read-only telemetry summary");
    expect(en.ok && en.negatives).toEqual(["No auto-send", "No auto-writeback"]);
  });

  it("fails closed when any segment is missing in either locale", () => {
    const missingEn = resolveBoundaryBarCopy(
      { ...VALID, wontDo: { zh: "不外发", en: "  " } },
      false,
    );
    expect(missingEn.ok).toBe(false);
    if (!missingEn.ok) {
      expect(missingEn.errorCode).toBe("BOUNDARY_COPY_MISSING_SEGMENT");
      expect(missingEn.missingFields).toEqual(["wontDo"]);
    }
  });

  it("fails closed on empty negative entries instead of dropping them", () => {
    const emptyNegative = resolveBoundaryBarCopy(
      { ...VALID, negatives: [{ zh: "", en: "" }] },
      true,
    );
    expect(emptyNegative.ok).toBe(false);
    if (!emptyNegative.ok) {
      expect(emptyNegative.errorCode).toBe("BOUNDARY_COPY_EMPTY_NEGATIVE");
      expect(emptyNegative.missingFields).toEqual(["negatives[0]"]);
    }
  });

  it("keeps the three segment labels bilingual", () => {
    for (const label of Object.values(BOUNDARY_BAR_SEGMENT_LABELS)) {
      expect(label.zh.length).toBeGreaterThan(0);
      expect(label.en.length).toBeGreaterThan(0);
    }
  });
});

describe("resolveEffectModeBadge", () => {
  it("maps every known effect mode to a non-danger variant and bilingual label", () => {
    for (const mode of EFFECT_MODES) {
      const zh = resolveEffectModeBadge(mode, false);
      const en = resolveEffectModeBadge(mode, true);
      expect(zh.known).toBe(true);
      expect(zh.variant).not.toBe("danger");
      expect(zh.label.length).toBeGreaterThan(0);
      expect(en.label.length).toBeGreaterThan(0);
      expect(zh.label).not.toBe(en.label);
    }
  });

  it("renders unknown modes as explicit danger instead of a silent default", () => {
    const unknown = resolveEffectModeBadge("auto_execute", false);
    expect(unknown.known).toBe(false);
    expect(unknown.variant).toBe("danger");
    expect(unknown.label).toContain("auto_execute");
  });
});
