import {
  MembershipStatus,
  type Prisma,
  WorkspaceRole,
} from "@prisma/client";
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import type {
  ToolEnvelope,
  WorkBuddyClientIdentity,
} from "@/lib/caio-collaboration/contracts";
import {
  WorkBuddyCollaborationError,
} from "@/lib/caio-collaboration/contracts";
import type {
  CaioDeliveryCursor,
} from "@/lib/caio-collaboration/delivery-contracts";
import {
  activateCaioMandate,
  createCaioMandateDraft,
  recordCaioGuardianStop,
  registerCaioPrincipalBinding,
} from "@/lib/caio-governance/mandate-store.service";
import {
  proposeCaioAdvice,
} from "@/lib/caio-governance/advice-store.service";
import { db } from "@/lib/db";
import {
  createPrismaCanonicalPromptResponseService,
} from "./workbuddy-prompt-response.service";
import {
  createPrismaWorkBuddyDeliveryProducer,
  createPrismaWorkBuddyGatewayRuntime,
  type PrismaWorkBuddyDeliveryProducer,
  type PrismaWorkBuddyGatewayRuntime,
} from "@/tools/caio-workbuddy-gateway/prisma-runtime";

const integrationDatabaseUrl =
  process.env.CAIO_WORKBUDDY_DATABASE_URL;
const confirmedDatabaseName =
  process.env.CAIO_WORKBUDDY_TEST_DATABASE_NAME;
const describeMysql = integrationDatabaseUrl
  ? describe.sequential
  : describe.skip;
const suffix = `${process.pid}-${Date.now()}`;
const ISOLATED_DATABASE_PREFIX = "helm_caio_workbuddy_";
const CEO_REF = `ceo-workbuddy-${suffix}`;
const GUARDIAN_REF = `guardian-workbuddy-${suffix}`;
const CLIENT_ID = `client:workbuddy-${suffix}`;
const DEVICE_SIGNATURE = `device-signature:${"a".repeat(32)}`;
const QUESTION_HASH = `sha256:${"1".repeat(64)}`;
const SECOND_QUESTION_HASH = `sha256:${"2".repeat(64)}`;
const THIRD_QUESTION_HASH = `sha256:${"3".repeat(64)}`;
const TEST_PRIVATE_IPV4 = [192, 168, 50, 20].join(".");

function assertIsolatedDatabaseTarget(): void {
  if (
    !integrationDatabaseUrl ||
    process.env.DATABASE_URL !== integrationDatabaseUrl
  ) {
    throw new Error(
      "DATABASE_URL must equal CAIO_WORKBUDDY_DATABASE_URL for the isolated integration test.",
    );
  }
  let databaseName = "";
  try {
    const parsed = new URL(integrationDatabaseUrl);
    databaseName = decodeURIComponent(
      parsed.pathname.replace(/^\/+/u, ""),
    );
  } catch {
    throw new Error(
      "CAIO_WORKBUDDY_DATABASE_URL must be a valid isolated MySQL URL.",
    );
  }
  if (
    !databaseName.startsWith(ISOLATED_DATABASE_PREFIX) ||
    databaseName !== confirmedDatabaseName
  ) {
    throw new Error(
      "Refusing WorkBuddy integration test: confirm the isolated database name and use the helm_caio_workbuddy_ prefix.",
    );
  }
}

function withoutMilliseconds(value: Date): string {
  return value.toISOString().replace(/\.\d{3}Z$/u, "Z");
}

function requireSuccess<T>(
  result: ToolEnvelope<unknown>,
): T {
  if (!result.ok) {
    throw new Error(
      `${result.error.code}: ${result.error.message}`,
    );
  }
  return result.data as T;
}

async function waitForBlockedWorkspaceLock(): Promise<void> {
  const pattern = "%FROM Workspace WHERE id = %FOR UPDATE%";
  for (let attempt = 0; attempt < 400; attempt += 1) {
    const rows = await db.$queryRaw<Array<{ n: bigint | number }>>`
      SELECT COUNT(*) AS n FROM information_schema.PROCESSLIST
      WHERE COMMAND IN ('Query', 'Execute')
        AND INFO LIKE ${pattern}
        AND TIME >= 1
        AND ID <> CONNECTION_ID()`;
    if (Number(rows[0]?.n ?? 0) >= 1) return;
    await new Promise((resolveSleep) =>
      setTimeout(resolveSleep, 25),
    );
  }
  throw new Error("timed out waiting for a blocked Workspace row lock");
}

async function hasSettled(promise: Promise<unknown>): Promise<boolean> {
  let settled = false;
  void promise.then(
    () => {
      settled = true;
    },
    () => {
      settled = true;
    },
  );
  for (let turn = 0; turn < 10; turn += 1) {
    await Promise.resolve();
  }
  return settled;
}

function holdWorkspaceLock(workspaceId: string) {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolveGate) => {
    release = resolveGate;
  });
  let acquiredResolve: () => void = () => {};
  const acquired = new Promise<void>((resolveAcquired) => {
    acquiredResolve = resolveAcquired;
  });
  const done = db.$transaction(
    async (tx: Prisma.TransactionClient) => {
      await tx.$queryRaw`
        SELECT id FROM Workspace
        WHERE id = ${workspaceId}
        FOR UPDATE`;
      acquiredResolve();
      await gate;
    },
    { timeout: 30_000 },
  );
  return { acquired, release, done };
}

describeMysql(
  "WorkBuddy CAIO LAN runtime with an isolated MySQL database",
  () => {
    let workspaceId = "";
    let ownerUserId = "";
    let activeMandateId = "";
    let clockMs = Date.now();
    let runtime: PrismaWorkBuddyGatewayRuntime;
    let deliveryProducer: PrismaWorkBuddyDeliveryProducer;
    let identity: WorkBuddyClientIdentity;
    let cursor: CaioDeliveryCursor;
    let firstChallengeId = "";

    const now = () => new Date(clockMs).toISOString();
    const advance = (milliseconds = 1_000) => {
      clockMs += milliseconds;
    };
    const enabledEnv = {
      CAIO_WORKBUDDY_GATEWAY_ENABLED: "true",
      CAIO_WORKBUDDY_READ_ENABLED: "true",
      CAIO_WORKBUDDY_PUSH_ENABLED: "true",
      CAIO_WORKBUDDY_PRESENCE_ENABLED: "true",
      CAIO_WORKBUDDY_MUTATIONS_ENABLED: "true",
      CAIO_WORKBUDDY_PROMPT_RESPONSES_ENABLED: "true",
      CAIO_WORKBUDDY_QUESTION_SELECTIONS_ENABLED: "false",
      CAIO_WORKBUDDY_ADVICE_DECISIONS_ENABLED: "true",
      CAIO_WORKBUDDY_GATEWAY_PROTOCOL: "https",
      CAIO_WORKBUDDY_GATEWAY_BIND_ADDRESS: TEST_PRIVATE_IPV4,
      CAIO_WORKBUDDY_GATEWAY_PORT: "9443",
      CAIO_WORKBUDDY_MTLS_CERT_PATH:
        "/private/etc/helm/server.crt",
      CAIO_WORKBUDDY_MTLS_KEY_PATH:
        "/private/etc/helm/server.key",
      CAIO_WORKBUDDY_MTLS_CA_PATH:
        "/private/etc/helm/client-ca.crt",
      CAIO_WORKBUDDY_MTLS_REQUIRE_CLIENT_CERT: "true",
    } as const;

    function createRuntime(
      runtimeNow: () => string = now,
    ): PrismaWorkBuddyGatewayRuntime {
      return createPrismaWorkBuddyGatewayRuntime({
        env: enabledEnv,
        presenceSignatureVerifier: {
          verify: async ({ proof }) =>
            proof.signature === DEVICE_SIGNATURE,
        },
        mutationProofVerifier: {
          verify: async ({ proof }) =>
            proof.signature === DEVICE_SIGNATURE,
        },
        now: runtimeNow,
      });
    }

    let requestSequence = 0;
    async function dispatch<T>(
      name: string,
      input: unknown,
      targetRuntime = runtime,
    ): Promise<T> {
      requestSequence += 1;
      return requireSuccess<T>(
        await targetRuntime.dispatcher.dispatch({
          name,
          input,
          context: {
            requestId: `request:${suffix}:${requestSequence}`,
            identity,
          },
        }),
      );
    }

    beforeAll(async () => {
      assertIsolatedDatabaseTarget();
      const workspace = await db.workspace.create({
        data: {
          name: `WorkBuddy integration ${suffix}`,
          slug: `workbuddy-integration-${suffix}`,
        },
      });
      workspaceId = workspace.id;
      const owner = await db.user.create({
        data: {
          email: `workbuddy-owner-${suffix}@example.test`,
          name: "WorkBuddy integration owner",
        },
      });
      ownerUserId = owner.id;
      await db.membership.create({
        data: {
          workspaceId,
          userId: ownerUserId,
          role: WorkspaceRole.OWNER,
          status: MembershipStatus.ACTIVE,
        },
      });
      await registerCaioPrincipalBinding({
        workspaceId,
        actorUserId: ownerUserId,
        userId: ownerUserId,
        principalRef: CEO_REF,
        principalKind: "ceo",
        evidenceRef: `evidence:ceo-binding-${suffix}`,
      });
      await registerCaioPrincipalBinding({
        workspaceId,
        actorUserId: ownerUserId,
        userId: ownerUserId,
        principalRef: GUARDIAN_REF,
        principalKind: "guardian",
        evidenceRef: `evidence:guardian-binding-${suffix}`,
      });
      const draft = await createCaioMandateDraft({
        workspaceId,
        actorUserId: ownerUserId,
        caioRef: "caio:helm-self",
        ceoRef: CEO_REF,
        stage: "advise",
        stageDecisionRef: `stage-decision:workbuddy-${suffix}`,
        objectiveRefs: [`objective:workbuddy-${suffix}`],
        scopeRefs: ["scope:advise-readouts"],
        grantBasisRefs: [
          `caio-mandate-grant:${CEO_REF}:issuance-${suffix}`,
        ],
        reservedMatterRefs: ["reserved:external-execution"],
        humanResponsePolicyRef: "policy:human-response-v1",
        accountabilityAnchorRefs: ["anchor:ceo"],
        guardianStopRefs: [GUARDIAN_REF],
        validFrom: withoutMilliseconds(
          new Date(clockMs - 60_000),
        ),
        validUntil: withoutMilliseconds(
          new Date(clockMs + 86_400_000),
        ),
        inFlightDisposition: "freeze",
        auditRefs: [`audit:workbuddy-${suffix}`],
      });
      const active = await activateCaioMandate({
        workspaceId,
        actorUserId: ownerUserId,
        actorCeoRef: CEO_REF,
        mandateRecordId: draft.mandateId,
      });
      activeMandateId = active.mandateId;
      identity = {
        schemaVersion: "helm.workbuddy-client-identity/v1",
        clientId: CLIENT_ID,
        workspaceId,
        actorUserId: ownerUserId,
        certificateFingerprint: `sha256:${"f".repeat(64)}`,
        scopes: [
          "caio:delivery:read",
          "caio:presence:challenge",
          "caio:p1c:read",
          "caio:canonical:mutate",
        ],
        transport: "mtls",
        mtlsVerified: true,
        authenticatedAt: new Date(clockMs - 10_000).toISOString(),
      };
      cursor = {
        schemaVersion: "helm.caio-delivery-cursor/v1",
        workspaceId,
        clientId: CLIENT_ID,
        criticalSequence: 0,
        normalSequence: 0,
      };
      deliveryProducer =
        createPrismaWorkBuddyDeliveryProducer({ now });
      runtime = createRuntime();
    });

    afterAll(async () => {
      await db.$disconnect();
    });

    it("claims one delivery once under concurrent polls and survives restart", async () => {
      await deliveryProducer.enqueue({
        deliveryObjectId: `delivery:question-1:${suffix}`,
        workspaceId,
        source: {
          schemaVersion: "helm.caio-canonical-object-ref/v1",
          objectKind: "operating_question_candidate",
          objectId: `question:workbuddy-1-${suffix}`,
          objectVersion: 1,
          objectHash: QUESTION_HASH,
        },
        deliveryKey: `delivery-key:question-1-${suffix}`,
        severity: "normal",
        category: "operating_question",
        triggerRuleRef: "rule:operating-question-ready",
        triggerSnapshotHash: `sha256:${"3".repeat(64)}`,
        validUntil: new Date(
          clockMs + 3_600_000,
        ).toISOString(),
        deliveryVersion: 1,
      });

      const input = {
        workspaceId,
        severity: "normal",
        cursor,
        limit: 10,
      };
      const [first, concurrent] = await Promise.all([
        dispatch<{
          items: Array<{
            presentation: { presentationId: string };
          }>;
          cursor: CaioDeliveryCursor;
        }>("poll_ceo_prompts", input),
        dispatch<{
          items: Array<{
            presentation: { presentationId: string };
          }>;
          cursor: CaioDeliveryCursor;
        }>("poll_ceo_prompts", input),
      ]);
      expect(first.items).toHaveLength(1);
      expect(concurrent.items).toHaveLength(1);
      expect(
        concurrent.items[0]?.presentation.presentationId,
      ).toBe(first.items[0]?.presentation.presentationId);
      expect(
        await db.workBuddyDeliveryClaim.count({
          where: { workspaceId },
        }),
      ).toBe(1);
      expect(
        await db.workBuddyDeliveryPresentation.count({
          where: { workspaceId },
        }),
      ).toBe(1);

      const restarted = createRuntime();
      const replay = await dispatch<{
        items: unknown[];
        cursor: CaioDeliveryCursor;
      }>("poll_ceo_prompts", input, restarted);
      expect(replay.items).toHaveLength(1);
      cursor = replay.cursor;
      const acknowledged = await dispatch<{ items: unknown[] }>(
        "poll_ceo_prompts",
        {
          ...input,
          cursor,
        },
        restarted,
      );
      expect(acknowledged.items).toEqual([]);
    });

    it("persists suppression and reveals the delivery only after revocation", async () => {
      await deliveryProducer.enqueue({
        deliveryObjectId: `delivery:question-2:${suffix}`,
        workspaceId,
        source: {
          schemaVersion: "helm.caio-canonical-object-ref/v1",
          objectKind: "operating_question_candidate",
          objectId: `question:workbuddy-2-${suffix}`,
          objectVersion: 1,
          objectHash: SECOND_QUESTION_HASH,
        },
        deliveryKey: `delivery-key:question-2-${suffix}`,
        severity: "normal",
        category: "suppressed_question",
        triggerRuleRef: "rule:operating-question-ready",
        triggerSnapshotHash: `sha256:${"4".repeat(64)}`,
        validUntil: new Date(
          clockMs + 3_600_000,
        ).toISOString(),
        deliveryVersion: 1,
      });
      await deliveryProducer.registerSuppression({
        suppressionId: `suppression:question-2-${suffix}`,
        workspaceId,
        category: "suppressed_question",
        scope: { kind: "workspace" },
        validFrom: new Date(clockMs - 1_000).toISOString(),
        validUntil: new Date(
          clockMs + 3_600_000,
        ).toISOString(),
      });

      const suppressed = await dispatch<{ items: unknown[] }>(
        "poll_ceo_prompts",
        {
          workspaceId,
          severity: "normal",
          cursor,
          limit: 10,
        },
      );
      expect(suppressed.items).toEqual([]);

      await deliveryProducer.revokeSuppression({
        workspaceId,
        suppressionId: `suppression:question-2-${suffix}`,
      });
      advance();
      const released = await dispatch<{
        items: unknown[];
        cursor: CaioDeliveryCursor;
      }>("poll_ceo_prompts", {
        workspaceId,
        severity: "normal",
        cursor,
        limit: 10,
      });
      expect(released.items).toHaveLength(1);
      cursor = released.cursor;
    });

    it("consumes presence exactly once and replays the same attestation after restart", async () => {
      const beginInput = {
        workspaceId,
        idempotencyKey: `presence-begin-${suffix}`,
      };
      const [first, concurrent] = await Promise.all([
        dispatch<{ challengeId: string; nonce: string }>(
          "begin_owner_presence_challenge",
          beginInput,
        ),
        dispatch<{ challengeId: string; nonce: string }>(
          "begin_owner_presence_challenge",
          beginInput,
        ),
      ]);
      expect(concurrent).toEqual(first);
      firstChallengeId = first.challengeId;
      const proof = {
        schemaVersion: "helm.owner-presence-proof/v1",
        challengeId: first.challengeId,
        algorithm: "device-bound-signature",
        signature: DEVICE_SIGNATURE,
        assertedAt: now(),
      } as const;
      const completeInput = {
        challengeId: first.challengeId,
        proof,
        idempotencyKey: `presence-complete-${suffix}`,
      };
      const [completed, replayed] = await Promise.all([
        dispatch<{ presenceRef: string }>(
          "complete_owner_presence_challenge",
          completeInput,
        ),
        dispatch<{ presenceRef: string }>(
          "complete_owner_presence_challenge",
          completeInput,
        ),
      ]);
      expect(replayed).toEqual(completed);
      expect(
        await db.workBuddyPresenceChallenge.count({
          where: { workspaceId },
        }),
      ).toBe(1);

      const restarted = createRuntime();
      await expect(
        dispatch(
          "complete_owner_presence_challenge",
          completeInput,
          restarted,
        ),
      ).resolves.toEqual(completed);
      const divergent = await restarted.dispatcher.dispatch({
        name: "complete_owner_presence_challenge",
        input: {
          ...completeInput,
          proof: {
            ...proof,
            signature: `different-signature:${"b".repeat(32)}`,
          },
        },
        context: {
          requestId: `request:${suffix}:divergent-presence`,
          identity,
        },
      });
      expect(divergent).toMatchObject({
        ok: false,
        error: { code: "PRESENCE_REPLAYED" },
      });
    });

    it("rechecks mandate expiry before issuing presence after the workspace lock", async () => {
      const mandate =
        await db.caioMandateRecord.findUniqueOrThrow({
          where: { id: activeMandateId },
          select: { validUntil: true },
        });
      let afterLockRelease = false;
      const preExpiry = new Date(
        mandate.validUntil.getTime() - 1,
      ).toISOString();
      const postExpiry = new Date(
        mandate.validUntil.getTime() + 1,
      ).toISOString();
      const expiringRuntime = createRuntime(
        () => (afterLockRelease ? postExpiry : preExpiry),
      );
      const idempotencyKey = `presence-expiry-issue-${suffix}`;
      const holder = holdWorkspaceLock(workspaceId);
      await holder.acquired;
      const beginPromise = expiringRuntime.dispatcher.dispatch({
        name: "begin_owner_presence_challenge",
        input: {
          workspaceId,
          idempotencyKey,
        },
        context: {
          requestId: `request:${suffix}:presence-expiry-issue`,
          identity,
        },
      });
      try {
        await waitForBlockedWorkspaceLock();
        expect(await hasSettled(beginPromise)).toBe(false);
        afterLockRelease = true;
      } finally {
        holder.release();
        await holder.done;
      }

      await expect(beginPromise).resolves.toMatchObject({
        ok: false,
        error: { code: "MANDATE_REQUIRED" },
      });
      expect(
        await db.workBuddyPresenceChallenge.count({
          where: {
            workspaceId,
            clientId: CLIENT_ID,
            beginIdempotencyKey: idempotencyKey,
          },
        }),
      ).toBe(0);
    });

    it("rechecks mandate expiry after presence waits for the workspace lock", async () => {
      const mandate =
        await db.caioMandateRecord.findUniqueOrThrow({
          where: { id: activeMandateId },
          select: { validUntil: true },
        });
      let afterLockRelease = false;
      const preExpiry = new Date(
        mandate.validUntil.getTime() - 1,
      ).toISOString();
      const postExpiry = new Date(
        mandate.validUntil.getTime() + 1,
      ).toISOString();
      const expiringRuntime = createRuntime(
        () => (afterLockRelease ? postExpiry : preExpiry),
      );
      const challenge = await dispatch<{
        challengeId: string;
        nonce: string;
      }>(
        "begin_owner_presence_challenge",
        {
          workspaceId,
          idempotencyKey: `presence-expiry-begin-${suffix}`,
        },
        expiringRuntime,
      );
      const before =
        await db.workBuddyPresenceChallenge.findUniqueOrThrow({
          where: { id: challenge.challengeId },
          select: {
            consumedAt: true,
            completionIdempotencyKey: true,
            proofHash: true,
            attestationHash: true,
          },
        });
      const holder = holdWorkspaceLock(workspaceId);
      await holder.acquired;
      const completionPromise =
        expiringRuntime.dispatcher.dispatch({
          name: "complete_owner_presence_challenge",
          input: {
            challengeId: challenge.challengeId,
            proof: {
              schemaVersion: "helm.owner-presence-proof/v1",
              challengeId: challenge.challengeId,
              algorithm: "device-bound-signature",
              signature: DEVICE_SIGNATURE,
              assertedAt: preExpiry,
            },
            idempotencyKey: `presence-expiry-complete-${suffix}`,
          },
          context: {
            requestId: `request:${suffix}:presence-expiry`,
            identity,
          },
        });
      try {
        await waitForBlockedWorkspaceLock();
        expect(await hasSettled(completionPromise)).toBe(false);
        afterLockRelease = true;
      } finally {
        holder.release();
        await holder.done;
      }

      await expect(completionPromise).resolves.toMatchObject({
        ok: false,
        error: { code: "MANDATE_REQUIRED" },
      });
      expect(
        await db.workBuddyPresenceChallenge.findUniqueOrThrow({
          where: { id: challenge.challengeId },
          select: {
            consumedAt: true,
            completionIdempotencyKey: true,
            proofHash: true,
            attestationHash: true,
          },
        }),
      ).toEqual(before);
    });

    it("records one payload-bound prompt response under concurrent submission and restart", async () => {
      advance();
      const response = {
        responseKind: "answer",
        deliveryObjectId: `delivery:question-1:${suffix}`,
        answer: "Proceed with the governed local review.",
      } as const;
      const prepareInput = {
        workspaceId,
        expectedVersion: 1,
        response,
        idempotencyKey: `prompt-response-${suffix}`,
      };
      const [prepared, concurrent] = await Promise.all([
        dispatch<{
          challenge: { challengeId: string };
          preview: { summaryHash: string };
        }>("prepare_prompt_response", prepareInput),
        dispatch<{
          challenge: { challengeId: string };
          preview: { summaryHash: string };
        }>("prepare_prompt_response", prepareInput),
      ]);
      expect(concurrent).toEqual(prepared);
      const proof = {
        schemaVersion: "helm.owner-presence-proof/v1",
        challengeId: prepared.challenge.challengeId,
        algorithm: "device-bound-signature",
        signature: DEVICE_SIGNATURE,
        assertedAt: now(),
      } as const;
      const submitInput = {
        ...prepareInput,
        challengeId: prepared.challenge.challengeId,
        proof,
      };
      const [submitted, replayed] = await Promise.all([
        dispatch<{
          outcome: string;
          receipt: { receiptRef: string };
        }>("submit_prompt_response", submitInput),
        dispatch<{
          outcome: string;
          receipt: { receiptRef: string };
        }>("submit_prompt_response", submitInput),
      ]);
      expect(replayed.receipt).toEqual(submitted.receipt);
      expect(
        await db.workBuddyPromptResponseReceipt.count({
          where: { workspaceId },
        }),
      ).toBe(1);
      expect(
        await db.workBuddyMutationReceipt.count({
          where: { workspaceId },
        }),
      ).toBe(1);
      const consumedMutationChallenge =
        await db.workBuddyMutationChallenge.findFirstOrThrow({
          where: {
            workspaceId,
            consumedAt: { not: null },
          },
          select: {
            id: true,
            bindingHash: true,
            consumedAt: true,
            proofHash: true,
          },
        });
      expect(consumedMutationChallenge.proofHash).toMatch(
        /^sha256:[a-f0-9]{64}$/u,
      );
      expect(consumedMutationChallenge.bindingHash).toMatch(
        /^sha256:[a-f0-9]{64}$/u,
      );
      const mutationReceipt =
        await db.workBuddyMutationReceipt.findFirstOrThrow({
          where: { workspaceId },
          select: {
            id: true,
            challengeId: true,
            bindingHash: true,
            recordedAt: true,
          },
        });
      expect(mutationReceipt.recordedAt).toEqual(
        consumedMutationChallenge.consumedAt,
      );
      expect(mutationReceipt.challengeId).toBe(
        consumedMutationChallenge.id,
      );
      expect(mutationReceipt.bindingHash).toBe(
        consumedMutationChallenge.bindingHash,
      );
      const promptResponseReceipt =
        await db.workBuddyPromptResponseReceipt.findFirstOrThrow({
          where: { workspaceId },
          select: {
            id: true,
            deliveryClaimId: true,
            deliveryClaimHash: true,
          },
        });
      const boundDeliveryClaim =
        await db.workBuddyDeliveryClaim.findUniqueOrThrow({
          where: { id: promptResponseReceipt.deliveryClaimId },
          select: {
            contentHash: true,
            workspaceId: true,
            clientId: true,
            deliveryObjectId: true,
          },
        });
      expect(promptResponseReceipt.deliveryClaimHash).toBe(
        boundDeliveryClaim.contentHash,
      );
      expect(boundDeliveryClaim).toMatchObject({
        workspaceId,
        clientId: CLIENT_ID,
        deliveryObjectId: response.deliveryObjectId,
      });

      await expect(
        db.$executeRaw`
          UPDATE WorkBuddyMutationReceipt
          SET bindingHash = ${`sha256:${"9".repeat(64)}`}
          WHERE id = ${mutationReceipt.id}
        `,
      ).rejects.toThrow();
      await expect(
        db.$executeRaw`
          UPDATE WorkBuddyPromptResponseReceipt
          SET deliveryClaimHash = ${`sha256:${"8".repeat(64)}`}
          WHERE id = ${promptResponseReceipt.id}
        `,
      ).rejects.toThrow();

      expect(
        await db.workBuddyMutationReceipt.findUniqueOrThrow({
          where: { id: mutationReceipt.id },
          select: { bindingHash: true },
        }),
      ).toEqual({
        bindingHash: consumedMutationChallenge.bindingHash,
      });
      expect(
        await db.workBuddyPromptResponseReceipt.findUniqueOrThrow({
          where: { id: promptResponseReceipt.id },
          select: { deliveryClaimHash: true },
        }),
      ).toEqual({
        deliveryClaimHash: boundDeliveryClaim.contentHash,
      });
      const envelope =
        await db.workBuddyDeliveryEnvelope.findUniqueOrThrow({
          where: {
            id: `delivery:question-1:${suffix}`,
          },
        });
      expect(envelope.status).toBe("answered");

      const restarted = createRuntime();
      const afterRestart = await dispatch<{
        outcome: string;
        receipt: { receiptRef: string };
      }>("submit_prompt_response", submitInput, restarted);
      expect(afterRestart).toMatchObject({
        outcome: "replayed",
        receipt: {
          receiptRef: submitted.receipt.receiptRef,
        },
      });
      const recovered = await dispatch<{
        receiptRef: string;
      }>(
        "get_prompt_response_receipt",
        {
          workspaceId,
          idempotencyKey: prepareInput.idempotencyKey,
        },
        restarted,
      );
      expect(recovered.receiptRef).toBe(
        submitted.receipt.receiptRef,
      );

      const conflict =
        await restarted.dispatcher.dispatch({
          name: "prepare_prompt_response",
          input: {
            ...prepareInput,
            response: {
              ...response,
              answer: "A different answer must conflict.",
            },
          },
          context: {
            requestId: `request:${suffix}:conflicting-prompt`,
            identity,
          },
        });
      expect(conflict).toMatchObject({
        ok: false,
        error: { code: "VERSION_CONFLICT" },
      });
    });

    it("rechecks mandate expiry after waiting for the workspace lock", async () => {
      const deliveryObjectId = `delivery:question-3:${suffix}`;
      const sourceObjectId = `question:workbuddy-3-${suffix}`;
      const idempotencyKey = `prompt-response-expiry-${suffix}`;
      await deliveryProducer.enqueue({
        deliveryObjectId,
        workspaceId,
        source: {
          schemaVersion: "helm.caio-canonical-object-ref/v1",
          objectKind: "operating_question_candidate",
          objectId: sourceObjectId,
          objectVersion: 1,
          objectHash: THIRD_QUESTION_HASH,
        },
        deliveryKey: `delivery-key:question-3-${suffix}`,
        severity: "normal",
        category: "operating_question",
        triggerRuleRef: "rule:operating-question-ready",
        triggerSnapshotHash: `sha256:${"5".repeat(64)}`,
        validUntil: new Date(
          clockMs + 172_800_000,
        ).toISOString(),
        deliveryVersion: 1,
      });
      const delivered = await dispatch<{
        items: unknown[];
        cursor: CaioDeliveryCursor;
      }>("poll_ceo_prompts", {
        workspaceId,
        severity: "normal",
        cursor,
        limit: 10,
      });
      expect(delivered.items).toHaveLength(1);
      cursor = delivered.cursor;

      const mandate =
        await db.caioMandateRecord.findUniqueOrThrow({
          where: { id: activeMandateId },
          select: { validUntil: true },
        });
      const binding =
        await db.caioPrincipalBinding.findFirstOrThrow({
          where: {
            workspaceId,
            userId: ownerUserId,
            principalRef: CEO_REF,
            principalKind: "ceo",
            revokedAt: null,
          },
          select: { id: true },
        });
      let afterLockRelease = false;
      const preExpiry = new Date(
        mandate.validUntil.getTime() - 1,
      ).toISOString();
      const postExpiry = new Date(
        mandate.validUntil.getTime() + 1,
      ).toISOString();
      const service = createPrismaCanonicalPromptResponseService({
        now: () => (afterLockRelease ? postExpiry : preExpiry),
      });
      const before =
        await db.workBuddyDeliveryEnvelope.findUniqueOrThrow({
          where: { id: deliveryObjectId },
          select: { status: true, updatedAt: true },
        });
      const holder = holdWorkspaceLock(workspaceId);
      await holder.acquired;
      const submitPromise = service.submit({
        workspaceId,
        clientId: CLIENT_ID,
        actorUserId: ownerUserId,
        ceoRef: CEO_REF,
        ceoBindingRef: binding.id,
        mandateRef: activeMandateId,
        sourceObjectKind: "operating_question_candidate",
        sourceObjectId,
        sourceObjectHash: THIRD_QUESTION_HASH,
        expectedVersion: 1,
        command: {
          responseKind: "answer",
          deliveryObjectId,
          answer: "This must not land after mandate expiry.",
        },
        idempotencyKey,
      });
      try {
        await waitForBlockedWorkspaceLock();
        expect(await hasSettled(submitPromise)).toBe(false);
        afterLockRelease = true;
      } finally {
        holder.release();
        await holder.done;
      }

      await expect(submitPromise).rejects.toMatchObject<
        Partial<WorkBuddyCollaborationError>
      >({
        code: "MANDATE_REQUIRED",
      });
      expect(
        await db.workBuddyPromptResponseReceipt.count({
          where: { workspaceId, idempotencyKey },
        }),
      ).toBe(0);
      expect(
        await db.workBuddyDeliveryEnvelope.findUniqueOrThrow({
          where: { id: deliveryObjectId },
          select: { status: true, updatedAt: true },
        }),
      ).toEqual(before);
    });

    it("decides canonical CAIO advice once through the governed runtime", async () => {
      advance();
      const advice = await proposeCaioAdvice({
        workspaceId,
        mandateRecordId: activeMandateId,
        adviceKey: `workbuddy-advice-${suffix}`,
        subjectRef: `subject:workbuddy-${suffix}`,
        title: "Review the synthetic operating constraint",
        recommendation:
          "Keep the review bounded to the approved synthetic evidence.",
        observationRefs: [`observation:workbuddy-${suffix}`],
        validUntil: new Date(
          clockMs + 3_600_000,
        ).toISOString(),
        actorName: "caio:helm-self",
      });
      const decision = {
        outcome: "accepted",
        reason: "The bounded recommendation is ready for review.",
      } as const;
      const prepareInput = {
        workspaceId,
        adviceRef: advice.adviceId,
        expectedVersion: 1,
        decision,
        idempotencyKey: `advice-decision-${suffix}`,
      };
      const prepared = await dispatch<{
        challenge: { challengeId: string };
      }>("prepare_advice_decision", prepareInput);
      const submitInput = {
        ...prepareInput,
        challengeId: prepared.challenge.challengeId,
        proof: {
          schemaVersion: "helm.owner-presence-proof/v1",
          challengeId: prepared.challenge.challengeId,
          algorithm: "device-bound-signature",
          signature: DEVICE_SIGNATURE,
          assertedAt: now(),
        },
      } as const;
      const submitted = await dispatch<{
        outcome: string;
        receipt: { canonicalReceiptRef: string };
      }>("submit_advice_decision", submitInput);
      expect(submitted).toMatchObject({
        outcome: "submitted",
        receipt: {
          canonicalReceiptRef: advice.adviceId,
        },
      });
      expect(
        await db.caioAdviceRecord.findUnique({
          where: { id: advice.adviceId },
          select: {
            status: true,
            decisionOutcome: true,
            decisionReason: true,
            decidedByRef: true,
          },
        }),
      ).toEqual({
        status: "accepted",
        decisionOutcome: "accepted",
        decisionReason: decision.reason,
        decidedByRef: CEO_REF,
      });

      const restarted = createRuntime();
      await expect(
        dispatch(
          "submit_advice_decision",
          submitInput,
          restarted,
        ),
      ).resolves.toMatchObject({
        outcome: "replayed",
        receipt: {
          canonicalReceiptRef: advice.adviceId,
        },
      });
    });

    it("fails closed immediately after a guardian stop", async () => {
      await recordCaioGuardianStop({
        workspaceId,
        actorUserId: ownerUserId,
        guardianRef: GUARDIAN_REF,
        mandateRecordId: activeMandateId,
        reason: "Synthetic integration stop.",
        auditRefs: [`audit:workbuddy-stop-${suffix}`],
      });
      const refused = await runtime.dispatcher.dispatch({
        name: "list_pending_ceo_prompts",
        input: { workspaceId },
        context: {
          requestId: `request:${suffix}:stopped-mandate`,
          identity,
        },
      });
      expect(refused).toMatchObject({
        ok: false,
        error: { code: "MANDATE_REQUIRED" },
      });
      expect(firstChallengeId).toMatch(
        /^workbuddy-presence-challenge:/u,
      );
    });
  },
);
