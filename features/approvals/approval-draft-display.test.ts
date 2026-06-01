import { describe, expect, it } from "vitest";
import { getApprovalDraftEditCopy } from "@/features/approvals/approval-draft-display";

describe("approval draft edit display copy", () => {
  it("separates the draft field from the approve-after-edit action in Chinese", () => {
    const unchanged = getApprovalDraftEditCopy({
      english: false,
      isEdited: false,
    });
    const edited = getApprovalDraftEditCopy({
      english: false,
      isEdited: true,
    });

    expect(unchanged.sectionTitle).toBe("复核草稿");
    expect(unchanged.statusLabel).toBe("原稿未修改");
    expect(unchanged.approveEditedLabel).toBe("编辑后批准");
    expect(edited.statusLabel).toBe("已修改，待复核");
    expect(edited.approveEditedLabel).toBe("按修改稿批准");
    expect(edited.restoreLabel).toBe("恢复原稿");
  });
});
