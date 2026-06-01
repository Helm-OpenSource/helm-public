import { describe, expect, it } from "vitest";
import { formatCustomerSuccessDisplayText } from "@/features/customer-success-handoff/display-copy";

describe("formatCustomerSuccessDisplayText", () => {
  it("keeps English copy unchanged", () => {
    expect(
      formatCustomerSuccessDisplayText(
        "Customer Success Queue / Inbox v1.1",
        true,
      ),
    ).toBe("Customer Success Queue / Inbox v1.1");
  });

  it("converts customer-success protocol language for the Chinese surface", () => {
    const text =
      "Customer Success Queue / Inbox v1.1 keeps customer success handoff, review-before-send, follow-through, owner, issue, escalation and commitment visible.";

    expect(formatCustomerSuccessDisplayText(text, false)).toBe(
      "客户成功接手队列 keeps 客户成功接手, 发送前复核, 后续推进, 负责人, 问题, 升级处理 and 承诺 visible.",
    );
  });

  it("removes the highest-friction default-page terms from Chinese copy", () => {
    const formatted = formatCustomerSuccessDisplayText(
      "customer success owner keeps review-before-send follow-through inside an operational surface, not a canonical system of record.",
      false,
    );

    expect(formatted).not.toMatch(
      /customer success|owner|review-before-send|follow-through|operational surface|canonical system of record/,
    );
  });

  it("turns success memory campaign hints into Chinese operating action", () => {
    expect(
      formatCustomerSuccessDisplayText(
        "Pilot rescue -> success memory / campaign",
        false,
      ),
    ).toBe("试点恢复 -> 成功记忆 / 主线");
  });

  it("turns post-send outcome language into Chinese review copy", () => {
    expect(
      formatCustomerSuccessDisplayText(
        "Waiting for the first meaningful external outcome after the human send handoff / manual send record.",
        false,
      ),
    ).toBe("正在等待人工发送交接或手动发送记录后的第一条有效外部反馈。");
  });
});
