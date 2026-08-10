import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import {
  ActionExecutionMode,
  ActionStatus,
  ActionType,
  ActorType,
  ApprovalStatus,
  ExecutionReceiptOutcome,
  ExecutionReceiptSubjectType,
  ExecutionReceiptVerificationState,
  RejectionReasonCode,
  RiskLevel,
  SourceType,
} from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { db } from "@/lib/db";

const SCREENSHOT_DIR = "/tmp/helm-stage1-terminal-approvals";

type TerminalFixture = {
  actionItemId: string;
  approvalTaskId: string;
  decisionRecordId: string;
  decisionKey: string;
  receiptId: string | null;
  workspaceId: string;
};

const fixtures: TerminalFixture[] = [];

async function openFounderWorkspace(page: Page) {
  await page.goto("/demo");
  await page.getByTestId("demo-entry-founder").click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.locator("html")).toHaveAttribute(
    "data-workspace-density",
    /comfortable|compact/,
  );
}

async function resolveDemoScope() {
  const founder = await db.user.findUniqueOrThrow({
    where: { email: "founder@demo.com" },
    include: {
      memberships: {
        orderBy: { createdAt: "asc" },
        select: { workspaceId: true },
        take: 1,
      },
    },
  });
  const workspaceId = founder.memberships[0]?.workspaceId;
  if (!workspaceId) throw new Error("Founder demo workspace is unavailable");
  const operator = await db.user.findUniqueOrThrow({
    where: { email: "ops@demo.com" },
  });
  const opportunity = await db.opportunity.findFirstOrThrow({
    where: { workspaceId },
    orderBy: { createdAt: "asc" },
  });
  return { founder, operator, opportunity, workspaceId };
}

async function seedTerminalFixture(input: {
  outcome: ExecutionReceiptOutcome | null;
  selfReportedByFounder?: boolean;
}) {
  const { founder, operator, opportunity, workspaceId } =
    await resolveDemoScope();
  const suffix = randomUUID();
  const decisionKey = `decision:e2e-terminal:${suffix}`;
  const outcomeLabel = input.outcome ?? "UNKNOWN";
  const decision = await db.decisionRecord.create({
    data: {
      workspaceId,
      decisionKey,
      decisionType: "intervention",
      businessQuestion: `E2E terminal truth ${outcomeLabel}`,
      problemCategoryRef: "e2e-terminal-truth",
      contextRefs: JSON.stringify(["context:e2e-terminal"]),
      knowledgeRefs: JSON.stringify(["knowledge:e2e-terminal"]),
      evidenceRefs: JSON.stringify(["evidence:e2e-terminal"]),
      policyRefs: JSON.stringify(["policy:review-first"]),
      receiptRefs: JSON.stringify([]),
      alternatives: JSON.stringify(["close", "owner_review"]),
      recommendedOption: "owner_review",
      confidence: "high",
      riskLevel: "medium",
      allowedActionLevel: "draft_task",
      ownerGate: "approval_required",
      rollbackPath: "Keep execution closed and return to owner review.",
      factsJson: JSON.stringify([]),
      inferencesJson: JSON.stringify([]),
      unknownsJson: JSON.stringify([]),
      risksJson: JSON.stringify([]),
      ownerRef: founder.id,
      ownerConclusion: "Review the governed closure truth.",
      ownerConfirmedAt: new Date(),
      status: "DISPATCHED",
      validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });
  const action = await db.actionItem.create({
    data: {
      workspaceId,
      opportunityId: opportunity.id,
      ownerId: operator.id,
      actionType: ActionType.CREATE_TASK,
      title: `E2E Stage 1 terminal ${outcomeLabel}`,
      description: "Public-safe browser fixture for terminal review.",
      sourceType: SourceType.SYSTEM_INFERENCE,
      sourceId: `decision-record:${decision.id}`,
      riskLevel: RiskLevel.MEDIUM,
      executionMode: ActionExecutionMode.REQUIRES_APPROVAL,
      requiresApproval: true,
      status: ActionStatus.BLOCKED,
      executionStatus: "blocked",
      statusReason: "Governed close without execution",
      createdByUserId: founder.id,
      contentAuthorship: ActorType.AI,
    },
  });
  const approval = await db.approvalTask.create({
    data: {
      workspaceId,
      actionItemId: action.id,
      approverId: founder.id,
      reviewedById: founder.id,
      status:
        input.outcome === ExecutionReceiptOutcome.REJECTED
          ? ApprovalStatus.REJECTED
          : ApprovalStatus.EXECUTED,
      decisionReason: "E2E governed terminal review",
      reviewedAt: new Date(),
    },
  });
  await db.decisionWorkPacketClaim.create({
    data: {
      workspaceId,
      decisionRecordId: decision.id,
      actionItemId: action.id,
      ownerCommandJson: JSON.stringify({
        goal: "Review close-without-execution truth",
        acceptanceCriteria: ["independent receipt verification"],
        externalSideEffects: [],
        automationLevel: "assist",
      }),
    },
  });
  const receipt = input.outcome
    ? await db.executionReceipt.create({
        data: {
          workspaceId,
          subjectType: ExecutionReceiptSubjectType.ACTION_ITEM,
          subjectId: action.id,
          actionItemId: action.id,
          outcome: input.outcome,
          actionTaken: "CLOSE_WITHOUT_EXECUTION",
          evidenceRefs: JSON.stringify([`action-item:${action.id}`]),
          rejectionReasonCode:
            input.outcome === ExecutionReceiptOutcome.REJECTED
              ? RejectionReasonCode.OWNER_DISAGREEMENT
              : null,
          nextStep: "Owner review remains required.",
          executedByUserId: input.selfReportedByFounder
            ? founder.id
            : operator.id,
          executedByActorType: ActorType.USER,
          verificationState:
            ExecutionReceiptVerificationState.SELF_REPORTED,
          qualityScore: 80,
          qualityFlags: JSON.stringify([]),
        },
      })
    : null;
  const fixture = {
    actionItemId: action.id,
    approvalTaskId: approval.id,
    decisionRecordId: decision.id,
    decisionKey,
    receiptId: receipt?.id ?? null,
    workspaceId,
  };
  fixtures.push(fixture);
  return { ...fixture, founder, operator };
}

async function openApproval(page: Page, approvalTaskId: string) {
  await page.goto(`/approvals?approvalId=${approvalTaskId}`);
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  return dialog;
}

test.afterEach(async () => {
  for (const fixture of fixtures.splice(0).reverse()) {
    const signals = await db.supervisionSignalRecord.findMany({
      where: { decisionRecordId: fixture.decisionRecordId },
      select: { id: true },
    });
    const targetIds = [
      fixture.actionItemId,
      fixture.approvalTaskId,
      fixture.decisionRecordId,
      fixture.receiptId,
      ...signals.map((signal) => signal.id),
    ].filter((value): value is string => Boolean(value));
    await db.auditLog.deleteMany({
      where: {
        workspaceId: fixture.workspaceId,
        OR: [
          { targetId: { in: targetIds } },
          { relatedObjectId: { in: targetIds } },
        ],
      },
    });
    await db.supervisionSignalRecord.deleteMany({
      where: { decisionRecordId: fixture.decisionRecordId },
    });
    await db.memoryFact.deleteMany({
      where: {
        workspaceId: fixture.workspaceId,
        OR: [
          { objectId: fixture.actionItemId },
          { sourceId: `evaluation:${fixture.decisionKey}` },
        ],
      },
    });
    await db.executionReceipt.deleteMany({
      where: { actionItemId: fixture.actionItemId },
    });
    await db.approvalTask.deleteMany({
      where: { id: fixture.approvalTaskId },
    });
    await db.decisionWorkPacketClaim.deleteMany({
      where: { actionItemId: fixture.actionItemId },
    });
    await db.actionItem.deleteMany({ where: { id: fixture.actionItemId } });
    await db.decisionRecord.deleteMany({
      where: { id: fixture.decisionRecordId },
    });
  }
});

test.describe("Stage 1 terminal approvals", () => {
  test("no-execution truth stays distinct, recovers from conflict, and opens supervision", async ({
    page,
  }) => {
    const browserErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });
    const fixture = await seedTerminalFixture({
      outcome: ExecutionReceiptOutcome.NOT_EXECUTED,
      selfReportedByFounder: true,
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await openFounderWorkspace(page);
    const dialog = await openApproval(page, fixture.approvalTaskId);
    const control = dialog.getByTestId("stage1-terminal-result-control");

    await expect(control).toHaveAttribute(
      "data-terminal-mode",
      "closed-without-execution",
    );
    await expect(control).toContainText("未执行即关闭");
    await expect(control).toContainText("这不是业务失败");
    await expect(control).toContainText("不要求业务 ObservationRun");
    await expect(control).toContainText("owner review");
    await expect(control).toContainText("open supervision");
    await expect(
      control.getByTestId("stage1-business-outcome-fields"),
    ).toHaveCount(0);
    await expect(
      dialog.getByRole("button", { name: "批准待执行" }),
    ).toHaveCount(0);
    await expect(dialog.getByLabel("选择拒绝原因并拒绝")).toHaveCount(0);

    await control.getByTestId("stage1-terminal-submit").click();
    await expect(
      page.getByText(/independent_receipt_verifier_required/),
    ).toBeVisible();
    await expect(control).toBeVisible();
    await expect(control).toHaveAttribute(
      "data-terminal-mode",
      "closed-without-execution",
    );

    await db.executionReceipt.update({
      where: { actionItemId: fixture.actionItemId },
      data: { executedByUserId: fixture.operator.id },
    });
    await control.getByTestId("stage1-terminal-submit").click();
    await expect(
      page.getByText("关闭回执已验收，仍需 owner review"),
    ).toBeVisible();

    await expect
      .poll(async () =>
        db.executionReceipt.findUnique({
          where: { actionItemId: fixture.actionItemId },
          select: { verificationState: true, verifiedByUserId: true },
        }),
      )
      .toEqual({
        verificationState: ExecutionReceiptVerificationState.VERIFIED,
        verifiedByUserId: fixture.founder.id,
      });
    await expect
      .poll(async () =>
        db.decisionRecord.findUnique({
          where: { id: fixture.decisionRecordId },
          select: { status: true, evaluationJson: true },
        }),
      )
      .toMatchObject({ status: "EVALUATED" });
    await expect
      .poll(async () =>
        db.supervisionSignalRecord.findUnique({
          where: {
            workspaceId_signalKey: {
              workspaceId: fixture.workspaceId,
              signalKey: `stage1-terminal-result:${fixture.decisionRecordId}`,
            },
          },
          select: { status: true, recommendedRoute: true, actualState: true },
        }),
      )
      .toEqual({
        status: "open",
        recommendedRoute: "owner_review",
        actualState: "closed_without_execution_blocked",
      });

    await mkdir(SCREENSHOT_DIR, { recursive: true });
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "not-executed-desktop.png"),
      fullPage: true,
    });
    expect(browserErrors).toEqual([]);
  });

  test("rejected and unresolved receipts remain truthful on mobile without overflow", async ({
    page,
  }) => {
    const rejected = await seedTerminalFixture({
      outcome: ExecutionReceiptOutcome.REJECTED,
    });
    const unresolved = await seedTerminalFixture({ outcome: null });
    await page.setViewportSize({ width: 390, height: 844 });
    await openFounderWorkspace(page);

    let dialog = await openApproval(page, rejected.approvalTaskId);
    let control = dialog.getByTestId("stage1-terminal-result-control");
    await expect(control).toContainText("执行前已拒绝");
    await expect(control).toContainText("这不是业务失败");
    await expect(
      control.getByTestId("stage1-business-outcome-fields"),
    ).toHaveCount(0);
    await expect(control.getByTestId("stage1-terminal-submit")).toHaveText(
      "验收拒绝关闭",
    );
    await expect(
      dialog.getByRole("button", { name: "批准待执行" }),
    ).toHaveCount(0);
    await expect(dialog.getByLabel("选择拒绝原因并拒绝")).toHaveCount(0);
    expect(
      await control.evaluate(
        (element) => element.scrollWidth <= element.clientWidth + 1,
      ),
    ).toBe(true);

    dialog = await openApproval(page, unresolved.approvalTaskId);
    control = dialog.getByTestId("stage1-terminal-result-control");
    await expect(control).toHaveAttribute("data-terminal-mode", "unresolved");
    await expect(control).toContainText("回执结果缺失、无法识别");
    await expect(control).toContainText("不得推断业务结果");
    await expect(control.getByTestId("stage1-terminal-submit")).toBeDisabled();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true);

    await mkdir(SCREENSHOT_DIR, { recursive: true });
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "terminal-mobile.png"),
      fullPage: true,
    });
  });
});
