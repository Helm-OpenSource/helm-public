import { describe, expect, it } from "vitest";
import {
  formatAskHelmBoundaryTypeLabel,
  formatAskHelmIntentTypeLabel,
  formatAskHelmObjectTypeLabel,
  formatAskHelmRelatedObjectStatus,
  formatAskHelmRetrievalSourceLabel,
} from "@/features/search/display-copy";

describe("Ask Helm search display copy", () => {
  it("formats related object labels and statuses for Chinese Ask mode", () => {
    expect(formatAskHelmObjectTypeLabel("contact", false)).toBe("联系人");
    expect(formatAskHelmObjectTypeLabel("company", false)).toBe("公司");
    expect(
      formatAskHelmRelatedObjectStatus("opportunity", "CONTACTED", false),
    ).toBe("已接触");
    expect(formatAskHelmRelatedObjectStatus("contact", "Contact", false)).toBe(
      "联系人",
    );
  });

  it("formats retrieval, boundary and intent tokens before rendering badges", () => {
    expect(formatAskHelmRetrievalSourceLabel("workspace_context", false)).toBe(
      "工作区上下文",
    );
    expect(formatAskHelmBoundaryTypeLabel("read_only", false)).toBe("只读解释");
    expect(formatAskHelmIntentTypeLabel("object_search", false)).toBe(
      "对象查找",
    );
  });

  it("converts persisted Chinese Ask Helm labels for the English surface", () => {
    expect(formatAskHelmObjectTypeLabel("联系人", true)).toBe("Contact");
    expect(formatAskHelmRelatedObjectStatus("opportunity", "已接触", true)).toBe(
      "Contacted",
    );
    expect(formatAskHelmRetrievalSourceLabel("工作区上下文", true)).toBe(
      "Workspace context",
    );
    expect(formatAskHelmBoundaryTypeLabel("建议不等于承诺", true)).toBe(
      "Suggestion, not commitment",
    );
    expect(formatAskHelmIntentTypeLabel("上报经营信号", true)).toBe(
      "Submit business signal",
    );
  });
});
