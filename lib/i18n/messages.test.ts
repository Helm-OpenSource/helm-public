import { describe, expect, it } from "vitest";
import { getUiMessages } from "@/lib/i18n/messages";

describe("shell navigation copy", () => {
  it("keeps reports labelled as a report destination", () => {
    expect(getUiMessages("zh-CN").shell.nav.reports).toBe("经营复盘");
    expect(getUiMessages("en-US").shell.nav.reports).toBe("Operating review");
  });
});
