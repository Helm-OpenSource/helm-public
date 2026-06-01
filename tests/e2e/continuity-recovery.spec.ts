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

async function seedContinuityScenario(
  meeting: Awaited<ReturnType<typeof openSeedableMeeting>>["meeting"],
  scenario: "recoverable" | "review_required" | "blocked",
) {
  const unique = `${scenario}_${randomUUID()}`;
  const payloadHandle = `payload://e2e/${unique}/summary`;
  const seedBaseTime = Date.now() + 60_000;
  const sessionCreatedAt = new Date(
    seedBaseTime + (scenario === "recoverable" ? 1 : scenario === "review_required" ? 2 : 3) * 1000,
  );
  await seedMeetingEndedRuntimeEvent(meeting, new Date(sessionCreatedAt.getTime() - 1_000));

  const session = await db.runtimeSession.create({
    data: {
      workspaceId: meeting.workspaceId,
      meetingId: meeting.id,
      opportunityId: meeting.opportunityId,
      companyId: meeting.companyId,
      sessionKey: `e2e_continuity_${unique}`,
      label: `PR24 continuity ${scenario}`,
      status: "ACTIVE",
      currentStage: "continuity_recovery",
      sourcePage: `/meetings/${meeting.id}`,
      boundaryNote: "No auto-send.",
      budgetTokenLimit: 100,
      budgetTokenUsed: scenario === "recoverable" ? 58 : 52,
      loadedTokenCount: scenario === "recoverable" ? 58 : 24,
      prunedTokenCount: 0,
      createdAt: sessionCreatedAt,
    },
  });

  await db.sessionNotebook.create({
    data: {
      workspaceId: meeting.workspaceId,
      runtimeSessionId: session.id,
      sessionSummary: "Continuity remediation check is active.",
      decisionSummary:
        scenario === "recoverable"
          ? "Do not send anything externally."
          : "Keep the follow-through internal until review closes.",
      blockerSummary: "One reviewer answer is still outstanding.",
      pendingQuestions: JSON.stringify(["Which reviewer closes the final answer?"]),
      openLoopSummary:
        scenario === "blocked"
          ? "Recover continuity posture before using downstream runtime state."
          : "Keep continuity posture readable before using downstream runtime state.",
      boundaryNote: "No auto-send.",
    },
  });

  if (scenario !== "blocked") {
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
        label: "Continuity summary",
        handle: payloadHandle,
        preview: "Operator-visible continuity summary.",
        summary: "Externalized continuity payload for remediation coverage.",
        payloadText: "Externalized continuity payload for remediation coverage.",
        byteSize: 256,
        estimatedTokens: 32,
        loadedByDefault: true,
      },
    });
  }

  if (scenario === "review_required") {
    await db.sessionCheckpoint.create({
      data: {
        workspaceId: meeting.workspaceId,
        runtimeSessionId: session.id,
        checkpointKey: `checkpoint_${unique}`,
        label: "operator_review_anchor",
        status: "READY",
        summary: "Checkpoint with protected confirmed facts that must not be silently dropped.",
        snapshotJson: buildContinuitySnapshot({
          objective: "Confirm the internal security review owner.",
          meetingTitle: meeting.title,
          opportunityTitle: meeting.opportunity?.title,
          companyName: meeting.company?.name,
          confirmedFacts: ["Confirmed owner is Alice."],
          blockers: ["One reviewer answer is still outstanding."],
          decisions: ["Keep the message internal until review closes."],
          nextActions: ["Confirm Alice before external follow-up."],
          openQuestions: ["Which reviewer closes the final answer?"],
          evidenceRefs: ["meeting:review-required"],
          loadedHandles: [payloadHandle],
        }),
        tokenCount: 32,
      },
    });
  }

  if (scenario === "recoverable") {
    await db.problemSpace.create({
      data: {
        workspaceId: meeting.workspaceId,
        runtimeSessionId: session.id,
        meetingId: meeting.id,
        opportunityId: meeting.opportunityId,
        companyId: meeting.companyId,
        problemKey: `problem_${unique}`,
        title: "Continuity replay drift",
        summary: "Recoverable replay drift still needs a human to confirm the outstanding reviewer answer.",
        nextStep: "Confirm the reviewer answer before downstream follow-up.",
        status: "WAITING_ON_SIGNAL",
        ownerHint: "Founder / COO",
        evidenceRefs: JSON.stringify(["meeting:recoverable"]),
      },
    });

    const promotedCandidate = await db.memoryCandidate.create({
      data: {
        workspaceId: meeting.workspaceId,
        runtimeSessionId: session.id,
        meetingId: meeting.id,
        candidateKey: `candidate_${unique}`,
        summary: "Keep the follow-through internal until review closes.",
        sourceVerification: "HUMAN_CONFIRMED",
        sourceStatus: "PROMOTED",
        status: "PROMOTED",
        evidenceRefs: JSON.stringify(["meeting:recoverable"]),
        confidence: 92,
      },
    });

    await db.memoryPromotion.create({
      data: {
        workspaceId: meeting.workspaceId,
        runtimeSessionId: session.id,
        memoryCandidateId: promotedCandidate.id,
        promotionKey: `promotion_${unique}`,
        status: "PROMOTED",
        rationale: "Recoverable continuity seed needs one promoted fact to preserve protected replay fields.",
      },
    });

    const checkpoint = await db.sessionCheckpoint.create({
      data: {
        workspaceId: meeting.workspaceId,
        runtimeSessionId: session.id,
        checkpointKey: `checkpoint_${unique}`,
        label: "continuity_anchor",
        status: "READY",
        summary: "Checkpoint before replay drift.",
        snapshotJson: buildContinuitySnapshot({
          objective: "Keep continuity posture readable before using downstream runtime state.",
          meetingTitle: meeting.title,
          opportunityTitle: meeting.opportunity?.title,
          companyName: meeting.company?.name,
          confirmedFacts: ["Keep the follow-through internal until review closes."],
          blockers: ["One reviewer answer is still outstanding."],
          decisions: ["Do not send anything externally."],
          nextActions: ["Confirm the reviewer answer before downstream follow-up."],
          openQuestions: ["Which reviewer closes the final answer?"],
          evidenceRefs: ["meeting:recoverable"],
          budgetState: "WATCH",
          loadedHandles: [payloadHandle],
        }),
        tokenCount: 32,
      },
    });

    await db.contextEditEvent.create({
      data: {
        workspaceId: meeting.workspaceId,
        runtimeSessionId: session.id,
        editKey: `edit_${unique}`,
        strategy: "microprune",
        beforeTokenCount: 58,
        afterTokenCount: 42,
        removedHandles: JSON.stringify([payloadHandle]),
        removedSummary: "Replay drift after checkpoint.",
        boundaryNote: "No auto-send.",
        createdAt: new Date(checkpoint.updatedAt.getTime() + 1_000),
      },
    });
  }

  await materializePersistedLifecycle(session);

  return session;
}

async function seedIneffectiveLoopScenario(
  meeting: Awaited<ReturnType<typeof openSeedableMeeting>>["meeting"],
) {
  const unique = `ineffective_${randomUUID()}`;
  const payloadHandle = `payload://e2e/${unique}/summary`;
  const sessionCreatedAt = new Date(Date.now() + 64_000);
  await seedMeetingEndedRuntimeEvent(meeting, new Date(sessionCreatedAt.getTime() - 1_000));

  const session = await db.runtimeSession.create({
    data: {
      workspaceId: meeting.workspaceId,
      meetingId: meeting.id,
      opportunityId: meeting.opportunityId,
      companyId: meeting.companyId,
      sessionKey: `e2e_continuity_${unique}`,
      label: "PR26 ineffective reprune loop",
      status: "ACTIVE",
      currentStage: "continuity_pilot_calibration",
      sourcePage: `/meetings/${meeting.id}`,
      boundaryNote: "No auto-send.",
      budgetTokenLimit: 100,
      budgetTokenUsed: 84,
      loadedTokenCount: 60,
      prunedTokenCount: 24,
      createdAt: sessionCreatedAt,
    },
  });

  await db.sessionNotebook.create({
    data: {
      workspaceId: meeting.workspaceId,
      runtimeSessionId: session.id,
      sessionSummary: "Repeated reprune still leaves this continuity workflow unstable.",
      decisionSummary: "Do not send anything externally.",
      blockerSummary: "Budget pressure remains unresolved.",
      pendingQuestions: JSON.stringify(["Should the operator restore the checkpoint instead?"]),
      openLoopSummary: "Stop ineffective reprune loops before downstream use.",
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
      label: "Continuity reprune payload",
      handle: payloadHandle,
      preview: "Continuity reprune payload.",
      summary: "Continuity reprune payload.",
      payloadText: "Continuity reprune payload.",
      byteSize: 256,
      estimatedTokens: 32,
      loadedByDefault: true,
    },
  });

  const checkpoint = await db.sessionCheckpoint.create({
    data: {
      workspaceId: meeting.workspaceId,
      runtimeSessionId: session.id,
      checkpointKey: `checkpoint_${unique}`,
      label: "continuity_anchor",
      status: "READY",
      summary: "Checkpoint before reprune loop.",
      snapshotJson: buildContinuitySnapshot({
        objective: "Preserve continuity without losing the internal boundary note.",
        meetingTitle: meeting.title,
        opportunityTitle: meeting.opportunity?.title,
        companyName: meeting.company?.name,
        confirmedFacts: ["The reply must stay internal until review closes."],
        blockers: ["Budget pressure remains unresolved."],
        decisions: ["Do not send anything externally."],
        nextActions: ["Stop reprune loops before downstream use."],
        openQuestions: ["Should the operator restore the checkpoint instead?"],
        evidenceRefs: ["meeting:reprune-loop"],
        budgetState: "PRUNE",
        loadedHandles: [payloadHandle],
        prunedHandles: [],
      }),
      tokenCount: 32,
    },
  });

  await db.contextEditEvent.create({
    data: {
      workspaceId: meeting.workspaceId,
      runtimeSessionId: session.id,
      editKey: `edit_${unique}_1`,
      strategy: "microprune",
      beforeTokenCount: 90,
      afterTokenCount: 66,
      removedHandles: JSON.stringify([payloadHandle]),
      removedSummary: "Budget pressure required selective context pruning.",
      boundaryNote: "No auto-send.",
      createdAt: new Date(checkpoint.updatedAt.getTime() + 1_000),
    },
  });

  await db.contextEditEvent.create({
    data: {
      workspaceId: meeting.workspaceId,
      runtimeSessionId: session.id,
      editKey: `edit_${unique}_2`,
      strategy: "microprune",
      beforeTokenCount: 88,
      afterTokenCount: 64,
      removedHandles: JSON.stringify([payloadHandle]),
      removedSummary: "Budget pressure required selective context pruning again.",
      boundaryNote: "No auto-send.",
      createdAt: new Date(checkpoint.updatedAt.getTime() + 2_000),
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
      eventType: "continuity.remediation.applied",
      payload: JSON.stringify({
        action: "REPRUNE_CONTEXT",
        executionStatus: "APPLIED",
        summary: "reprune applied",
        beforeSummary: "Budget posture: PRUNE. Replay: WATCH. Payload state: checkpoint_plus_edits. Risk: WATCH. Recovery: RECOVERABLE.",
        afterSummary: "Budget posture: PRUNE. Replay: WATCH. Payload state: checkpoint_plus_edits. Risk: WATCH. Recovery: RECOVERABLE.",
        before: {
          riskLevel: "WATCH",
          recoveryState: "RECOVERABLE",
          failureTaxonomy: "REPLAY_DRIFT",
        },
        after: {
          riskLevel: "WATCH",
          recoveryState: "RECOVERABLE",
          failureTaxonomy: "REPLAY_DRIFT",
        },
        rollbackAnchor: {
          checkpointLabel: "continuity_anchor",
          checkpointStatus: "READY",
        },
      }),
      triggeredBy: "founder@demo.com",
      createdAt: new Date(Date.now() + 6_000),
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
      eventType: "continuity.remediation.applied",
      payload: JSON.stringify({
        action: "REPRUNE_CONTEXT",
        executionStatus: "APPLIED",
        summary: "reprune applied again",
        beforeSummary: "Budget posture: PRUNE. Replay: WATCH. Payload state: checkpoint_plus_edits. Risk: WATCH. Recovery: RECOVERABLE.",
        afterSummary: "Budget posture: PRUNE. Replay: WATCH. Payload state: checkpoint_plus_edits. Risk: WATCH. Recovery: RECOVERABLE.",
        before: {
          riskLevel: "WATCH",
          recoveryState: "RECOVERABLE",
          failureTaxonomy: "REPLAY_DRIFT",
        },
        after: {
          riskLevel: "WATCH",
          recoveryState: "RECOVERABLE",
          failureTaxonomy: "REPLAY_DRIFT",
        },
        rollbackAnchor: {
          checkpointLabel: "continuity_anchor",
          checkpointStatus: "READY",
        },
      }),
      triggeredBy: "founder@demo.com",
      createdAt: new Date(Date.now() + 7_000),
    },
  });

  await materializePersistedLifecycle(session);

  return session;
}

test.afterAll(async () => {
  await db.$disconnect();
});

test.describe.serial("continuity recovery surfaces", () => {
  test("recoverable path exposes bounded remediation and records trace with rollback anchor", async ({ page }) => {
    const { href, meeting } = await openSeedableMeeting(page);
    await seedContinuityScenario(meeting, "recoverable");

    await page.goto(href);
    await expect(page.getByTestId("continuity-recovery-state")).toHaveText("RECOVERABLE · REPLAY_DRIFT");
    await expect(page.getByTestId("continuity-remediation-resume_checkpoint")).toBeVisible();
    await expect(page.getByTestId("operator-debugger-request-takeover")).toBeVisible();
    await expect(page.getByTestId("run-thread-result-flow")).toContainText(
      "No downstream human execution",
    );

    await page.getByTestId("operator-debugger-request-takeover").click();
    await expect(page.getByTestId("operator-debugger-takeover-request")).toContainText("requested");
    await expect(page.getByTestId("operator-debugger-acknowledge-takeover")).toBeVisible();
    await expect(page.getByTestId("operator-debugger-acknowledge-takeover")).toBeEnabled();
    await page.getByTestId("operator-debugger-acknowledge-takeover").click();
    await expect(page.getByTestId("operator-debugger-takeover-request")).toContainText("acknowledged");
    await expect(page.getByTestId("run-thread-request-posture")).toContainText(
      "takeover acknowledged",
    );
    await expect(page.getByTestId("operator-debugger-start-takeover")).toBeVisible();
    await expect(page.getByTestId("operator-debugger-start-takeover")).toBeEnabled();
    await page.getByTestId("operator-debugger-start-takeover").click();
    await expect(page.getByTestId("operator-debugger-takeover-activation")).toContainText("active");
    await expect(page.getByTestId("operator-debugger-takeover-activation")).toContainText(
      "RESUME_CHECKPOINT",
    );
    await expect(page.getByTestId("operator-debugger-release-takeover")).toBeVisible();
    await expect(page.getByTestId("operator-debugger-release-takeover")).toBeEnabled();
    await page.getByTestId("operator-debugger-release-takeover").click();
    await expect(page.getByTestId("operator-debugger-takeover-activation")).toContainText("released");
    await expect(page.getByTestId("operator-debugger-takeover-activation")).toContainText(
      "Bounded operator control is released after review handoff.",
    );
    await expect(page.getByTestId("run-thread-request-posture")).toContainText(
      "takeover acknowledged",
    );

    await page.getByTestId("continuity-remediation-resume_checkpoint").click();
    await expect(page.getByTestId("continuity-recovery-state")).toHaveText("RECOVERABLE · REPLAY_DRIFT");
    await expect(page.getByText(/APPLIED · RESUME_CHECKPOINT/)).toBeVisible();
    await expect(page.getByText(/rollback anchor · continuity_anchor · RESUMED/)).toBeVisible();
    await expect(page.getByTestId("continuity-remediation-effectiveness")).toContainText("INEFFECTIVE");
    await expect(page.getByTestId("continuity-recovery-calibration")).toContainText("RECOVERABLE -> RECOVERABLE");
    await expect(page.getByTestId("continuity-recovery-calibration")).toContainText("LOW");
  });

  test("review-required path blocks remediation and keeps protected-state gap operator-visible", async ({ page }) => {
    const { href, meeting } = await openSeedableMeeting(page);
    await seedContinuityScenario(meeting, "review_required");

    await page.goto(href);
    await expect(page.getByText("REVIEW_REQUIRED · PROTECTED_STATE_GAP")).toBeVisible();
    await expect(page.getByText(/review reasons · .*confirmed facts/)).toBeVisible();
    await expect(page.getByText(/bounded remediation action/)).toBeVisible();
    await expect(page.getByTestId("continuity-remediation-save_recovery_checkpoint")).toHaveCount(0);
    await expect(page.getByTestId("operator-debugger-request-human-input")).toBeVisible();

    await page.getByTestId("operator-debugger-request-human-input").click();
    await expect(page.getByTestId("operator-debugger-human-input-request")).toContainText("requested");
    await expect(page.getByTestId("operator-debugger-acknowledge-human-input")).toBeVisible();
    await expect(page.getByTestId("operator-debugger-acknowledge-human-input")).toBeEnabled();
    await page.getByTestId("operator-debugger-acknowledge-human-input").click();
    await expect(page.getByTestId("operator-debugger-human-input-request")).toContainText("acknowledged");
    await expect(page.getByTestId("run-thread-request-posture")).toContainText(
      "human input acknowledged",
    );
  });

  test("blocked path exposes explicit blocked reason with no remediation buttons", async ({ page }) => {
    const { href, meeting } = await openSeedableMeeting(page);
    await seedContinuityScenario(meeting, "blocked");

    await page.goto(href);
    await expect(page.getByTestId("continuity-recovery-state")).toHaveText("BLOCKED · NO_RECOVERY_ANCHOR");
    await expect(page.getByText(/blocked reasons · No recovery anchor exists for this session/)).toBeVisible();
    await expect(page.getByText(/bounded remediation action/)).toBeVisible();
    await expect(page.getByTestId("continuity-remediation-save_recovery_checkpoint")).toHaveCount(0);
  });

  test("ineffective reprune loops stay review-required with low-confidence calibration and no blind retry", async ({ page }) => {
    const { href, meeting } = await openSeedableMeeting(page);
    await seedIneffectiveLoopScenario(meeting);

    await page.goto(href);
    await expect(page.getByTestId("continuity-recovery-state")).toContainText("REVIEW_REQUIRED");
    await expect(page.getByTestId("continuity-recovery-calibration")).toContainText("REVIEW_REQUIRED -> REVIEW_REQUIRED");
    await expect(page.getByTestId("continuity-recovery-calibration")).toContainText("LOW");
    await expect(page.getByTestId("continuity-remediation-effectiveness")).toContainText("INEFFECTIVE");
    await expect(page.getByTestId("continuity-runbook")).toContainText("Escalate ineffective recovery");
    await expect(page.getByTestId("continuity-remediation-reprune_context")).toHaveCount(0);
  });
});
