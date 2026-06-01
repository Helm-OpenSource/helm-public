export function getApprovalDraftEditCopy(input: {
  english: boolean;
  isEdited: boolean;
}) {
  return {
    sectionTitle: input.english ? "Review draft" : "复核草稿",
    statusLabel: input.isEdited
      ? input.english
        ? "Edited draft ready"
        : "已修改，待复核"
      : input.english
        ? "Original draft unchanged"
        : "原稿未修改",
    approveEditedLabel: input.isEdited
      ? input.english
        ? "Approve revised draft"
        : "按修改稿批准"
      : input.english
        ? "Approve after edit"
        : "编辑后批准",
    approvedEditedToast: input.english
      ? "Revised draft approved"
      : "修改稿已批准",
    restoreLabel: input.english ? "Restore original" : "恢复原稿",
  };
}
