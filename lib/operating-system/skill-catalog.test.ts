import { describe, expect, it } from "vitest";

import {
  getOperatingSkillById,
  getOperatingSkillDisplayCopy,
} from "./skill-catalog";

describe("operating skill catalog display copy", () => {
  it("provides English copy for the pilot readiness diagnostics skill", () => {
    const skill = getOperatingSkillById("pilot-readiness-diagnostics");

    expect(skill).not.toBeNull();
    const copy = getOperatingSkillDisplayCopy(skill!, true);

    expect(copy).toEqual({
      name: "Pilot readiness diagnostics",
      summary:
        "Turns customer memory, meeting capture, relationship intake, and pending confirmations into a scale-readiness judgment.",
    });
    expect(`${copy.name} ${copy.summary}`).not.toMatch(/[\u3400-\u9fff]/u);
  });
});
