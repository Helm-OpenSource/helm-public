import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DashboardHomeWorkEntryModel } from "@/features/dashboard/home-work-entry";
import { DashboardHomeWorkEntrySurface } from "@/features/dashboard/home-work-entry-surface";

function buildModel(
  canReviewGovernedActions: boolean,
): DashboardHomeWorkEntryModel {
  return {
    canReviewGovernedActions,
    state: canReviewGovernedActions ? "review-heavy" : "returning-active",
    title: canReviewGovernedActions ? "现在最该先进入的是复核。" : "继续当前工作。",
    summary: canReviewGovernedActions
      ? "当前有待复核事项。"
      : "继续分配给本角色的工作。",
    topWorkItems: [
      {
        id: "work-1",
        title: "打开本人工作台",
        subject: "当前工作",
        statusLabel: "现在可推进",
        nextStep: "继续处理已分配的工作。",
        boundary: "不会自行执行或外发。",
        href: "/workspace",
        ctaLabel: "打开工作台",
      },
    ],
    reviewItems: canReviewGovernedActions
      ? [
          {
            id: "review-1",
            title: "复核外呼草稿",
            subject: "待确认动作",
            statusLabel: "待你复核",
            nextStep: "确认是否允许继续。",
            boundary: "必须经过人工复核。",
            href: "/approvals?approvalId=review-1",
            ctaLabel: "现在复核",
          },
        ]
      : [],
    reviewItemsArePrimary: false,
    assignmentItems: [],
    resumeItem: {
      id: "resume-1",
      title: "继续当前工作",
      subject: "当前工作",
      statusLabel: "继续推进",
      nextStep: "回到保存的工作位置。",
      boundary: "不会改变对外状态。",
      href: "/dashboard?resume=1",
      ctaLabel: "继续推进",
    },
    blockerItems: [],
  };
}

describe("DashboardHomeWorkEntrySurface", () => {
  it("omits governed review calls to action when the member cannot review", () => {
    const html = renderToStaticMarkup(
      <DashboardHomeWorkEntrySurface
        model={buildModel(false)}
        english={false}
      />,
    );

    expect(html).not.toContain("拍板");
    expect(html).not.toContain("待你复核");
    expect(html).not.toContain('href="/approvals');
    expect(html).toContain("打开本人工作台");
  });

  it("keeps the review rail for roles with governed review capability", () => {
    const html = renderToStaticMarkup(
      <DashboardHomeWorkEntrySurface
        model={buildModel(true)}
        english={false}
      />,
    );

    expect(html).toContain("拍板");
    expect(html).toContain("待你复核");
    expect(html).toContain('href="/approvals');
  });
});
