import { describe, expect, it } from "vitest";
import { isCapturePanelCloseBlocked } from "./capture-panel-lifecycle";

describe("capture panel lifecycle", () => {
  it("blocks closing while capture still owns an active server or processing session", () => {
    expect(isCapturePanelCloseBlocked("recording")).toBe(true);
    expect(isCapturePanelCloseBlocked("processing")).toBe(true);
  });

  it("blocks closing while an idle-looking start transition is still pending", () => {
    expect(isCapturePanelCloseBlocked("idle", true)).toBe(true);
  });

  it("allows closing before capture starts or after it completes", () => {
    expect(isCapturePanelCloseBlocked("idle")).toBe(false);
    expect(isCapturePanelCloseBlocked("completed")).toBe(false);
  });
});
