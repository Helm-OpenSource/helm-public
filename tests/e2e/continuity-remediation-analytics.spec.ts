import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { db } from "@/lib/db";
import { buildRunThreadPersistedControlPlaneLifecycleSnapshot } from "@/lib/helm-v2/run-thread-persisted-control-plane-lifecycle";
import { getRuntimeSessionTrace } from "@/lib/helm-v2/runtime-upgrade";

function demoEntryName(email: "founder@demo.com") {
  switch (email) {
    case "founder@demo.com":
    default:
      return /进入演示 · 60 秒|Open this · 60 sec/;
  }
}

function demoEntryTestId(email: "founder@demo.com") {
  switch (email) {
    case "founder@demo.com":
    default:
      return "demo-entry-founder";
  }
}

async function waitForWorkspaceUiHydration(page: Page) {
  await expect(page.locator("html")).toHaveAttribute("data-workspace-density", /comfortable|compact/);
  await expect(page.locator("html")).toHaveAttribute("data-workspace-guidance", /guided|focused/);
  await expect(page.locator("html")).toHaveAttribute("data-workspace-form-assist", /enabled|disabled/);
}

async function loginAs(page: Page, email: "founder@demo.com") {
  await page.goto("/demo");
  await waitForWorkspaceUiHydration(page);
  await expect(page.getByTestId(demoEntryTestId(email))).toHaveText(demoEntryName(email));
  await page.getByTestId(demoEntryTestId(email)).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await waitForWorkspaceUiHydration(page);
}

async function openSeedableMeeting(page: Page) {
  await loginAs(page, "founder@demo.com");
  const founder = await db.user.findUniqueOrThrow({
    where: { email: "founder@demo.com" },
    include: {
      memberships: {
        select: { workspaceId: true },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
  });
  const workspaceId = founder.memberships[0]?.workspaceId;
  expect(workspaceId).toBeTruthy();

  const runtimeReadyMeetings = await db.meeting.findMany({
    where: {
      workspaceId,
      note: {
        isNot: null,
      },
    },
    orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }],
    take: 20,
    include: {
      opportunity: true,
      company: true,
    },
  });
  expect(runtimeReadyMeetings.length).toBeGreaterThan(0);
  const meeting = runtimeReadyMeetings[0];
  expect(meeting).toBeTruthy();
  const meetingHref = `/meetings/${meeting.id}`;

  return {
    href: meetingHref,
    meeting: meeting!,
  };
}

function buildContinuitySnapshot(input: {
  objective: string;
  meetingTitle: string;
  opportunityTitle?: string | null;
  companyName?: string | null;
  confirmedFacts: string[];
  blockers: string[];
  decisions: string[];
  nextActions: string[];
  openQuestions: string[];
  evidenceRefs: string[];
  reviewState?: string;
  budgetState?: "SAFE" | "WATCH" | "PRUNE" | "COMPACT";
  loadedHandles?: string[];
  prunedHandles?: string[];
}) {
  return JSON.stringify({
    continuityState: {
      objective: input.objective,
      relevantObjects: [
        `Meeting: ${input.meetingTitle}`,
        input.opportunityTitle ? `Opportunity: ${input.opportunityTitle}` : null,
        input.companyName ? `Company: ${input.companyName}` : null,
      ].filter(Boolean),
      confirmedFacts: input.confirmedFacts,
      blockers: input.blockers,
      decisions: input.decisions,
      nextActions: input.nextActions,
      openQuestions: input.openQuestions,
      evidenceRefs: input.evidenceRefs,
      reviewState: input.reviewState ?? "active",
      boundaryNote: "No auto-send.",
      budgetState: input.budgetState ?? "SAFE",
      loadedHandles: input.loadedHandles ?? [],
      prunedHandles: input.prunedHandles ?? [],
    },
  });
}

async function materializePersistedLifecycle(session: {
  id: string;
  workspaceId: string;
  updatedAt: Date;
}) {
  const [trace, latestCheckpoint, latestContextEdit, latestRuntimeEvent, latestSession] =
    await Promise.all([
      getRuntimeSessionTrace(session.workspaceId, session.id),
      db.sessionCheckpoint.findFirst({
        where: {
          workspaceId: session.workspaceId,
          runtimeSessionId: session.id,
        },
        orderBy: { updatedAt: "desc" },
        select: { updatedAt: true },
      }),
      db.contextEditEvent.findFirst({
        where: {
          workspaceId: session.workspaceId,
          runtimeSessionId: session.id,
        },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      db.runtimeEvent.findFirst({
        where: {
          workspaceId: session.workspaceId,
          relatedObjectType: "RuntimeSession",
          relatedObjectId: session.id,
        },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      db.runtimeSession.findUnique({
        where: { id: session.id },
        select: { updatedAt: true },
      }),
    ]);
  if (!trace) {
    throw new Error(`Runtime session trace not found for persisted lifecycle seed: ${session.id}`);
  }

  const latestSeededAt = Math.max(
    session.updatedAt.getTime(),
    latestSession?.updatedAt.getTime() ?? 0,
    latestCheckpoint?.updatedAt.getTime() ?? 0,
    latestContextEdit?.createdAt.getTime() ?? 0,
    latestRuntimeEvent?.createdAt.getTime() ?? 0,
  );
  const persistedAt = new Date(latestSeededAt + 250);
  const snapshot = buildRunThreadPersistedControlPlaneLifecycleSnapshot(trace.runThread, persistedAt);

  await db.runtimeSession.update({
    where: { id: session.id },
    data: {
      controlPlaneLifecycleJson: JSON.stringify(snapshot),
      controlPlaneLifecycleUpdatedAt: persistedAt,
      updatedAt: persistedAt,
    },
  });
}

async function seedMeetingEndedRuntimeEvent(
  meeting: Awaited<ReturnType<typeof openSeedableMeeting>>["meeting"],
  createdAt: Date,
) {
  const existing = await db.runtimeEvent.findFirst({
    where: {
      workspaceId: meeting.workspaceId,
      meetingId: meeting.id,
      eventType: "meeting.ended",
    },
    select: { id: true },
  });
  if (existing) return existing.id;

  const event = await db.runtimeEvent.create({
    data: {
      workspaceId: meeting.workspaceId,
      meetingId: meeting.id,
      opportunityId: meeting.opportunityId,
      companyId: meeting.companyId,
      relatedObjectType: "Meeting",
      relatedObjectId: meeting.id,
      eventType: "meeting.ended",
      status: "COMPLETED",
      triggeredBy: "founder@demo.com",
      payload: JSON.stringify({
        sourcePage: `/meetings/${meeting.id}`,
        seedSource: "continuity-e2e",
      }),
      startedAt: createdAt,
      completedAt: createdAt,
      createdAt,
    },
  });

  return event.id;
}

async function seedBlockedRepeatScenario(
  meeting: Awaited<ReturnType<typeof openSeedableMeeting>>["meeting"],
) {
  const unique = `blocked_${randomUUID()}`;
  const sessionCreatedAt = new Date(Date.now() + 65_000);
  await seedMeetingEndedRuntimeEvent(meeting, new Date(sessionCreatedAt.getTime() - 1_000));
  const session = await db.runtimeSession.create({
    data: {
      workspaceId: meeting.workspaceId,
      meetingId: meeting.id,
      opportunityId: meeting.opportunityId,
      companyId: meeting.companyId,
      sessionKey: `e2e_continuity_analytics_${unique}`,
      label: "PR25 blocked repeat remediation",
      status: "ACTIVE",
      currentStage: "continuity_remediation_analytics",
      sourcePage: `/meetings/${meeting.id}`,
      boundaryNote: "No auto-send.",
      budgetTokenLimit: 100,
      budgetTokenUsed: 54,
      loadedTokenCount: 18,
      prunedTokenCount: 0,
      createdAt: sessionCreatedAt,
    },
  });

  await db.sessionNotebook.create({
    data: {
      workspaceId: meeting.workspaceId,
      runtimeSessionId: session.id,
      sessionSummary: "Continuity cannot recover safely from this surface.",
      decisionSummary: "Do not send anything externally.",
      blockerSummary: "No recovery anchor exists for this session.",
      pendingQuestions: JSON.stringify(["How do we rebuild the session substrate?"]),
      openLoopSummary: "Rebuild continuity substrate before downstream use.",
      boundaryNote: "No auto-send.",
    },
  });

  await db.runtimeEvent.create({
    data: {
      workspaceId: meeting.workspaceId,
      meetingId: meeting.id,
      opportunityId: meeting.opportunityId,
      companyId: meeting.companyId,
      relatedObjectType: "RuntimeSession",
      relatedObjectId: session.id,
      eventType: "continuity.remediation.blocked",
      payload: JSON.stringify({
        action: "SAVE_RECOVERY_CHECKPOINT",
        executionStatus: "BLOCKED",
        summary: "save recovery checkpoint was blocked",
        beforeSummary: "Budget posture: WATCH. Replay: NONE. Payload state: all_persisted. Risk: WATCH. Recovery: BLOCKED.",
        afterSummary: "Budget posture: WATCH. Replay: NONE. Payload state: all_persisted. Risk: WATCH. Recovery: BLOCKED.",
        before: {
          riskLevel: "WATCH",
          recoveryState: "BLOCKED",
          failureTaxonomy: "NO_RECOVERY_ANCHOR",
        },
        after: {
          riskLevel: "WATCH",
          recoveryState: "BLOCKED",
          failureTaxonomy: "NO_RECOVERY_ANCHOR",
        },
      }),
      triggeredBy: "founder@demo.com",
      createdAt: new Date(Date.now() + 7_000),
    },
  });

  await db.runtimeEvent.create({
    data: {
      workspaceId: meeting.workspaceId,
      meetingId: meeting.id,
      opportunityId: meeting.opportunityId,
      companyId: meeting.companyId,
      relatedObjectType: "RuntimeSession",
      relatedObjectId: session.id,
      eventType: "continuity.remediation.blocked",
      payload: JSON.stringify({
        action: "SAVE_RECOVERY_CHECKPOINT",
        executionStatus: "BLOCKED",
        summary: "save recovery checkpoint was blocked again",
        beforeSummary: "Budget posture: WATCH. Replay: NONE. Payload state: all_persisted. Risk: WATCH. Recovery: BLOCKED.",
        afterSummary: "Budget posture: WATCH. Replay: NONE. Payload state: all_persisted. Risk: WATCH. Recovery: BLOCKED.",
        before: {
          riskLevel: "WATCH",
          recoveryState: "BLOCKED",
          failureTaxonomy: "NO_RECOVERY_ANCHOR",
        },
        after: {
          riskLevel: "WATCH",
          recoveryState: "BLOCKED",
          failureTaxonomy: "NO_RECOVERY_ANCHOR",
        },
      }),
      triggeredBy: "founder@demo.com",
      createdAt: new Date(Date.now() + 8_000),
    },
  });

  await materializePersistedLifecycle(session);

  return session;
}

async function seedReviewRepeatScenario(
  meeting: Awaited<ReturnType<typeof openSeedableMeeting>>["meeting"],
) {
  const unique = `review_${randomUUID()}`;
  const payloadHandle = `payload://e2e/${unique}/summary`;
  const sessionCreatedAt = new Date(Date.now() + 70_000);
  await seedMeetingEndedRuntimeEvent(meeting, new Date(sessionCreatedAt.getTime() - 1_000));
  const session = await db.runtimeSession.create({
    data: {
      workspaceId: meeting.workspaceId,
      meetingId: meeting.id,
      opportunityId: meeting.opportunityId,
      companyId: meeting.companyId,
      sessionKey: `e2e_continuity_analytics_${unique}`,
      label: "PR25 review repeat remediation",
      status: "ACTIVE",
      currentStage: "continuity_remediation_analytics",
      sourcePage: `/operating`,
      boundaryNote: "No auto-send.",
      budgetTokenLimit: 100,
      budgetTokenUsed: 67,
      loadedTokenCount: 32,
      prunedTokenCount: 0,
      createdAt: sessionCreatedAt,
    },
  });

  await db.sessionNotebook.create({
    data: {
      workspaceId: meeting.workspaceId,
      runtimeSessionId: session.id,
      sessionSummary: "Protected continuity facts still need human confirmation.",
      decisionSummary: "Keep the response internal until review closes.",
      blockerSummary: "Confirmed facts and boundary note still need verification.",
      pendingQuestions: JSON.stringify(["Which reviewer closes the final answer?"]),
      openLoopSummary: "Close the protected-state gap before any remediation.",
      boundaryNote: "No auto-send.",
    },
  });

  await db.persistedPayload.create({
    data: {
      workspaceId: meeting.workspaceId,
      runtimeSessionId: session.id,
      meetingId: meeting.id,
      opportunityId: meeting.opportunityId,
      companyId: meeting.companyId,
      payloadKey: `payload_key_${unique}`,
      sourceType: "meeting_note",
      sourceId: meeting.id,
      loadPolicy: "always_on",
      label: "Continuity review payload",
      handle: payloadHandle,
      preview: "Protected continuity payload.",
      summary: "Protected continuity payload.",
      payloadText: "Protected continuity payload.",
      byteSize: 256,
      estimatedTokens: 32,
      loadedByDefault: true,
    },
  });

  await db.sessionCheckpoint.create({
    data: {
      workspaceId: meeting.workspaceId,
      runtimeSessionId: session.id,
      checkpointKey: `checkpoint_${unique}`,
      label: "meeting_review",
      status: "READY",
      summary: "Checkpoint with protected continuity facts.",
      snapshotJson: buildContinuitySnapshot({
        objective: "Confirm the internal reviewer owner.",
        meetingTitle: meeting.title,
        opportunityTitle: meeting.opportunity?.title,
        companyName: meeting.company?.name,
        confirmedFacts: ["Confirmed owner is Alice."],
        blockers: ["Final reviewer answer is still missing."],
        decisions: ["Keep the reply internal until review closes."],
        nextActions: ["Confirm Alice before external follow-up."],
        openQuestions: ["Which reviewer closes the final answer?"],
        evidenceRefs: ["meeting:review"],
        loadedHandles: [payloadHandle],
      }),
      tokenCount: 32,
    },
  });

  await db.runtimeEvent.create({
    data: {
      workspaceId: meeting.workspaceId,
      meetingId: meeting.id,
      opportunityId: meeting.opportunityId,
      companyId: meeting.companyId,
      relatedObjectType: "RuntimeSession",
      relatedObjectId: session.id,
      eventType: "continuity.remediation.review_required",
      payload: JSON.stringify({
        action: "SAVE_RECOVERY_CHECKPOINT",
        executionStatus: "REVIEW_REQUIRED",
        summary: "save recovery checkpoint stayed review-required",
        beforeSummary: "Budget posture: WATCH. Replay: WEAK. Payload state: checkpoint_snapshot. Risk: HIGH. Recovery: REVIEW_REQUIRED.",
        afterSummary: "Budget posture: WATCH. Replay: WEAK. Payload state: checkpoint_snapshot. Risk: HIGH. Recovery: REVIEW_REQUIRED.",
        before: {
          riskLevel: "HIGH",
          recoveryState: "REVIEW_REQUIRED",
          failureTaxonomy: "PROTECTED_STATE_GAP",
        },
        after: {
          riskLevel: "HIGH",
          recoveryState: "REVIEW_REQUIRED",
          failureTaxonomy: "PROTECTED_STATE_GAP",
        },
        rollbackAnchor: {
          checkpointLabel: "meeting_review",
          checkpointStatus: "READY",
        },
      }),
      triggeredBy: "founder@demo.com",
      createdAt: new Date(Date.now() + 11_000),
    },
  });

  await db.runtimeEvent.create({
    data: {
      workspaceId: meeting.workspaceId,
      meetingId: meeting.id,
      opportunityId: meeting.opportunityId,
      companyId: meeting.companyId,
      relatedObjectType: "RuntimeSession",
      relatedObjectId: session.id,
      eventType: "continuity.remediation.review_required",
      payload: JSON.stringify({
        action: "SAVE_RECOVERY_CHECKPOINT",
        executionStatus: "REVIEW_REQUIRED",
        summary: "save recovery checkpoint stayed review-required again",
        beforeSummary: "Budget posture: WATCH. Replay: WEAK. Payload state: checkpoint_snapshot. Risk: HIGH. Recovery: REVIEW_REQUIRED.",
        afterSummary: "Budget posture: WATCH. Replay: WEAK. Payload state: checkpoint_snapshot. Risk: HIGH. Recovery: REVIEW_REQUIRED.",
        before: {
          riskLevel: "HIGH",
          recoveryState: "REVIEW_REQUIRED",
          failureTaxonomy: "PROTECTED_STATE_GAP",
        },
        after: {
          riskLevel: "HIGH",
          recoveryState: "REVIEW_REQUIRED",
          failureTaxonomy: "PROTECTED_STATE_GAP",
        },
        rollbackAnchor: {
          checkpointLabel: "meeting_review",
          checkpointStatus: "READY",
        },
      }),
      triggeredBy: "founder@demo.com",
      createdAt: new Date(Date.now() + 12_000),
    },
  });

  await materializePersistedLifecycle(session);

  return session;
}

test.afterAll(async () => {
  await db.$disconnect();
});

test.describe.serial("continuity remediation analytics surfaces", () => {
  test("meeting detail shows blocked repeat-pattern analytics, evidence surface, and runbook", async ({ page }) => {
    const { href, meeting } = await openSeedableMeeting(page);
    await seedBlockedRepeatScenario(meeting);

    await page.goto(href);
    await expect(page.getByTestId("continuity-recovery-state")).toHaveText("BLOCKED · NO_RECOVERY_ANCHOR");
    await expect(page.getByTestId("continuity-remediation-analytics")).toContainText("REPEATED_BLOCKED_ACTION");
    await expect(page.getByTestId("continuity-pilot-review")).toContainText("NO_RECOVERY_ANCHOR");
    await expect(page.getByTestId("continuity-pilot-review")).toContainText("threshold 1");
    await expect(page.getByTestId("continuity-pilot-review")).toContainText(/risk /i);
    await expect(page.getByTestId("continuity-pilot-review")).toContainText(/pilot workspace/i);
    await expect(page.getByTestId("continuity-pilot-review")).toContainText(/session density/i);
    await expect(page.getByTestId("continuity-pilot-review")).toContainText(/meeting cadence/i);
    await expect(page.getByTestId("continuity-pilot-review")).toContainText(/failure history/i);
    await expect(page.getByTestId("continuity-pilot-review")).toContainText(/participants/i);
    await expect(page.getByTestId("continuity-pilot-review")).toContainText(/sample /i);
    await expect(page.getByTestId("continuity-pilot-review")).toContainText(/stability /i);
    await expect(page.getByTestId("continuity-pilot-review")).toContainText(/stability confidence /i);
    await expect(page.getByTestId("continuity-pilot-review")).toContainText(/scale-up|larger-sample stability/i);
    await expect(page.getByTestId("continuity-pilot-review")).toContainText(/scale-up recheck/i);
    await expect(page.getByTestId("continuity-pilot-review")).toContainText(/subgroup stability drift review|subgroup drift review/i);
    await expect(page.getByTestId("continuity-pilot-review")).toContainText(/cohort aging comparison|long-term cohort aging review/i);
    await expect(page.getByTestId("continuity-pilot-review")).toContainText(/cohort aging scale-up review|subgroup drift aging scale-up review/i);
    await expect(page.getByTestId("continuity-pilot-review")).toContainText(/subgroup drift long-term cohort aging review|longer-horizon cohort aging review/i);
    await expect(page.getByTestId("continuity-pilot-review")).toContainText(/subgroup drift long-term sample expansion review|long-term sample expansion review/i);
    await expect(page.getByTestId("continuity-pilot-review")).toContainText(/sample expansion refinement review|deep-support|fragile-support/i);
    await expect(page.getByTestId("continuity-pilot-review")).toContainText(/interval /i);
    await expect(page.getByTestId("continuity-pilot-review")).toContainText(/wording drift audit|canonical .* interval wording/i);
    await expect(page.getByTestId("continuity-pilot-review")).toContainText(/wording drift tracking|0% drift/i);
    await expect(page.getByTestId("continuity-pilot-review")).toContainText(/interval consistency guidance|WIDE:|GUARDED:|SETTLED:/i);
    await expect(page.getByTestId("continuity-pilot-review")).toContainText(/interval wording aging audit|aging regression/i);
    await expect(page.getByTestId("continuity-pilot-review")).toContainText(/cross-surface interval wording regression review|wording regression/i);
    await expect(page.getByTestId("continuity-pilot-review")).toContainText(/cross-surface interval wording consistency audit|consistency audit/i);
    await expect(page.getByTestId("continuity-pilot-review")).toContainText(/cross-surface interval wording regression audit|regression audit/i);
    await expect(page.getByTestId("continuity-pilot-review")).toContainText(/cross-readout interval wording regression audit|threshold, step, and guidance/i);
    await expect(page.getByTestId("continuity-pilot-review")).toContainText(/cross-readout interval wording regression refinement|session summary|queue summary|operator card/i);
    await expect(page.getByTestId("continuity-pilot-review")).toContainText(/outcome /i);
    await expect(page.getByTestId("continuity-pilot-review")).toContainText(/material impact /i);
    await expect(page.getByTestId("continuity-pilot-review")).toContainText(/material impact review/i);
    await expect(page.getByTestId("continuity-pilot-review")).toContainText(/material impact audit/i);
    await expect(page.getByTestId("continuity-pilot-review")).toContainText(/material impact pattern aging review|impact aging review/i);
    await expect(page.getByTestId("continuity-pilot-review")).toContainText(/material impact sampling review|sampling review/i);
    await expect(page.getByTestId("continuity-pilot-review")).toContainText(/material impact sampling aging review|sampling aging review/i);
    await expect(page.getByTestId("continuity-pilot-review")).toContainText(/material impact sampling aging refinement|impact aging refinement/i);
    await expect(page.getByTestId("continuity-pilot-review")).toContainText(/material impact sampling aging audit|review-bound/i);
    await expect(page.getByTestId("continuity-pilot-review")).toContainText(/material impact sampling aging refinement audit|durable-comparison|regressing-comparison/i);
    await expect(page.getByTestId("continuity-pilot-review")).toContainText(/pilot sample/i);
    await expect(page.getByTestId("continuity-pilot-review")).toContainText(/wide confidence interval|guarded confidence interval|settled confidence interval/i);
    await expect(page.getByTestId("continuity-pilot-review")).toContainText(/horizon|drift/i);
    await expect(page.getByTestId("continuity-pilot-review")).toContainText(/long-term SOP/i);
    await expect(page.getByTestId("continuity-pilot-review")).toContainText(/material impact on long-term outcomes/i);
    await expect(page.getByTestId("continuity-pilot-review")).toContainText(/guidance|operator handling/i);
    await expect(page.getByTestId("continuity-pilot-review")).toContainText(/variance/i);
    await expect(page.getByTestId("continuity-pilot-review")).toContainText(/runbook|evidence collection/i);
    await expect(page.getByTestId("continuity-sop")).toContainText("Anchor-first recovery SOP");
    await expect(page.getByTestId("continuity-sop")).toContainText(/trustworthy checkpoint anchor/i);
    await expect(page.getByTestId("continuity-evidence-surface")).toContainText(/Repeat pattern|Blocked because/);
    await expect(page.getByTestId("continuity-runbook")).toContainText("Stop repeat remediation loop");
    await expect(page.getByTestId("continuity-runbook")).toContainText(/Stop retrying the same blocked remediation action/);
  });

  test("operating surface shows review-required repeat-pattern analytics without widening authority", async ({ page }) => {
    const { meeting } = await openSeedableMeeting(page);
    await seedReviewRepeatScenario(meeting);

    await page.goto("/operating");
    await expect(page.getByTestId("continuity-repeat-pattern-card")).toContainText(/[1-9]/);
    await expect(page.getByTestId("continuity-low-confidence-card")).toContainText(/[1-9]/);
    await expect(page.getByTestId("continuity-pilot-cases-card")).toContainText("PROTECTED_STATE_GAP");
    await expect(page.getByTestId("continuity-pilot-cases-card")).toContainText(/density|cadence|participant posture/i);
    await expect(page.getByTestId("continuity-pilot-cases-card")).toContainText(/sample-backed|pilot sample/i);
    await expect(page.getByTestId("continuity-pilot-cases-card")).toContainText(/stability/i);
    await expect(page.getByTestId("continuity-pilot-cases-card")).toContainText(/stability confidence/i);
    await expect(page.getByTestId("continuity-pilot-cases-card")).toContainText(/stability scale-up|broader-sample/i);
    await expect(page.getByTestId("continuity-pilot-cases-card")).toContainText(/scale-up recheck|variance-carrying/i);
    await expect(page.getByTestId("continuity-pilot-cases-card")).toContainText(/subgroup stability drift review|subgroup drift stays/i);
    await expect(page.getByTestId("continuity-pilot-cases-card")).toContainText(/cohort aging comparison|long-term cohort aging review/i);
    await expect(page.getByTestId("continuity-pilot-cases-card")).toContainText(/subgroup drift aging scale-up review|aging scale-up review/i);
    await expect(page.getByTestId("continuity-pilot-cases-card")).toContainText(/subgroup drift long-term cohort aging review|long-term cohort aging review/i);
    await expect(page.getByTestId("continuity-pilot-cases-card")).toContainText(/subgroup drift long-term sample expansion review|sample expansion review/i);
    await expect(page.getByTestId("continuity-pilot-cases-card")).toContainText(/sample expansion refinement review|deep-support|fragile-support/i);
    await expect(page.getByTestId("continuity-pilot-cases-card")).toContainText(/confidence bands are now|confidence interval/i);
    await expect(page.getByTestId("continuity-pilot-cases-card")).toContainText(/stability recheck|low-confidence pockets/i);
    await expect(page.getByTestId("continuity-cohort-breakdown-card")).toContainText(/MEETING/);
    await expect(page.getByTestId("continuity-cohort-breakdown-card")).toContainText(/risk /i);
    await expect(page.getByTestId("continuity-cohort-breakdown-card")).toContainText(/density|cadence|participant posture|failure history/i);
    await expect(page.getByTestId("continuity-cohort-breakdown-card")).toContainText(/sample /i);
    await expect(page.getByTestId("continuity-cohort-breakdown-card")).toContainText(/stability /i);
    await expect(page.getByTestId("continuity-cohort-breakdown-card")).toContainText(/stability confidence /i);
    await expect(page.getByTestId("continuity-drift-card")).toContainText(/drift/i);
    await expect(page.getByTestId("continuity-drift-card")).toContainText(/long horizon/i);
    await expect(page.getByTestId("continuity-drift-card")).toContainText(/long-term outcome correlation/i);
    await expect(page.getByTestId("continuity-drift-card")).toContainText(/long-term outcome review/i);
    await expect(page.getByTestId("continuity-drift-card")).toContainText(/long-term SOP impact/i);
    await expect(page.getByTestId("continuity-drift-card")).toContainText(/material impact/i);
    await expect(page.getByTestId("continuity-drift-card")).toContainText(/material impact review/i);
    await expect(page.getByTestId("continuity-drift-card")).toContainText(/material impact audit|optimization hint/i);
    await expect(page.getByTestId("continuity-drift-card")).toContainText(/material impact pattern aging review|aging pattern/i);
    await expect(page.getByTestId("continuity-drift-card")).toContainText(/material impact sampling review|long-term sampling review/i);
    await expect(page.getByTestId("continuity-drift-card")).toContainText(/material impact sampling aging review|sampling aging review/i);
    await expect(page.getByTestId("continuity-drift-card")).toContainText(/material impact sampling aging refinement|sampling aging refinement/i);
    await expect(page.getByTestId("continuity-drift-card")).toContainText(/material impact sampling aging audit|review-bound/i);
    await expect(page.getByTestId("continuity-drift-card")).toContainText(/material impact sampling aging refinement audit|durable-comparison|regressing-comparison/i);
    await expect(page.getByTestId("continuity-drift-card")).toContainText(/panel|cadence|density/i);
    await expect(page.getByTestId("continuity-threshold-revision-card")).toContainText(/threshold 1/i);
    await expect(page.getByTestId("continuity-threshold-revision-card")).toContainText(/pilot sample/i);
    await expect(page.getByTestId("continuity-threshold-revision-card")).toContainText(/interval /i);
    await expect(page.getByTestId("continuity-threshold-revision-card")).toContainText(/wording drift audit|aligned .* drifted/i);
    await expect(page.getByTestId("continuity-threshold-revision-card")).toContainText(/wording drift tracking|drift rate/i);
    await expect(page.getByTestId("continuity-threshold-revision-card")).toContainText(/interval consistency guidance|WIDE:|GUARDED:|SETTLED:/i);
    await expect(page.getByTestId("continuity-threshold-revision-card")).toContainText(/interval wording aging audit|regression rate/i);
    await expect(page.getByTestId("continuity-threshold-revision-card")).toContainText(/cross-surface interval wording regression review|cross-surface regression rate/i);
    await expect(page.getByTestId("continuity-threshold-revision-card")).toContainText(/cross-surface interval wording consistency audit|consistency audit rate/i);
    await expect(page.getByTestId("continuity-threshold-revision-card")).toContainText(/cross-surface interval wording regression audit|regression audit rate/i);
    await expect(page.getByTestId("continuity-threshold-revision-card")).toContainText(/cross-readout interval wording regression audit|readout regression audit rate/i);
    await expect(page.getByTestId("continuity-threshold-revision-card")).toContainText(/cross-readout interval wording regression refinement|refinement rate/i);
    await expect(page.getByTestId("continuity-threshold-revision-card")).toContainText(/stability confidence /i);
    await expect(page.getByTestId("continuity-threshold-revision-card")).toContainText(/wide confidence interval|guarded confidence interval|settled/i);
    await expect(page.getByTestId("continuity-operator-handling-card")).toContainText(/guidance/i);
    await expect(page.getByTestId("continuity-operator-handling-card")).toContainText(/variance|ineffective-after-hit/i);
    await expect(page.getByTestId("continuity-operator-handling-card")).toContainText(/SOP effectiveness synthesis|steadiest|outcome variance/i);
    await expect(page.getByTestId("continuity-operator-handling-card")).toContainText(/stability confidence /i);
    await expect(page.getByTestId("continuity-operator-handling-card")).toContainText(/impact /i);
    await expect(page.getByTestId("continuity-operator-handling-card")).toContainText(/long-term SOP impact/i);
    await expect(page.getByTestId("continuity-operator-handling-card")).toContainText(/long-term outcome review/i);
    await expect(page.getByTestId("continuity-operator-handling-card")).toContainText(/operator runbook|guidance can now be refined|evidence collection/i);
    await expect(page.getByTestId("continuity-operator-handling-card")).toContainText(/Anchor check|Protected field review/i);
    await expect(page.getByTestId("continuity-sop-highlights-card")).toContainText(/Protected-state gaps/);
    await expect(page.getByText("PR25 review repeat remediation").first()).toHaveCount(1);
    await expect(page.getByText(/pilot risk /i).first()).toHaveCount(1);
    await expect(page.getByText(/pilot LOW\/1/).first()).toHaveCount(1);
    await expect(page.getByText(/sop Protected-field review SOP/).first()).toHaveCount(1);
    await expect(page.getByText(/runbook Stop repeat remediation loop/).first()).toHaveCount(1);
    await expect(page.getByText(/effect NO_SIGNAL/).first()).toHaveCount(1);
    await expect(page.getByText(/protected-field review/i).first()).toHaveCount(1);
  });
});
