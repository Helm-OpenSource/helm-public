import { describe, expect, it, vi } from "vitest";

import {
  createCaioDeliveryCursor,
  type CaioDeliveryEnvelope,
} from "./delivery-contracts";
import {
  createCaioDeliveryService,
  createInMemoryCaioDeliveryStore,
} from "./delivery.service";

const HASH_A = `sha256:${"a".repeat(64)}`;
const HASH_B = `sha256:${"b".repeat(64)}`;
const HASH_C = `sha256:${"c".repeat(64)}`;

function enqueueInput(
  overrides: Partial<{
    deliveryObjectId: string;
    deliveryKey: string;
    severity: "critical" | "normal";
    triggerSnapshotHash: string;
    deliveryVersion: number;
    objectVersion: number;
    objectHash: string;
    validUntil: string;
  }> = {},
) {
  return {
    deliveryObjectId:
      overrides.deliveryObjectId ?? "delivery:question-1:v1",
    workspaceId: "workspace:demo",
    source: {
      schemaVersion: "helm.caio-canonical-object-ref/v1" as const,
      objectKind: "operating_question_candidate" as const,
      objectId: "question:1",
      objectVersion: overrides.objectVersion ?? 1,
      objectHash: overrides.objectHash ?? HASH_A,
    },
    deliveryKey:
      overrides.deliveryKey ?? "delivery-key:question-1",
    severity: overrides.severity ?? "critical",
    category: "owner_judgement",
    triggerRuleRef: "trigger-rule:renewal-risk:v1",
    triggerSnapshotHash:
      overrides.triggerSnapshotHash ?? HASH_B,
    validUntil:
      overrides.validUntil ?? "2026-07-26T10:00:00.000Z",
    deliveryVersion: overrides.deliveryVersion ?? 1,
  };
}

function cursor() {
  return createCaioDeliveryCursor({
    workspaceId: "workspace:demo",
    clientId: "client:workbuddy-ceo",
  });
}

describe("CAIO typed delivery service", () => {
  it("deduplicates concurrent polls by canonical delivery identity", async () => {
    const store = createInMemoryCaioDeliveryStore();
    const service = createCaioDeliveryService({
      store,
      now: () => "2026-07-26T08:00:00.000Z",
    });
    await service.enqueue(enqueueInput());

    const [first, second] = await Promise.all([
      service.poll({
        workspaceId: "workspace:demo",
        clientId: "client:workbuddy-ceo",
        severity: "critical",
        cursor: cursor(),
        limit: 10,
      }),
      service.poll({
        workspaceId: "workspace:demo",
        clientId: "client:workbuddy-ceo",
        severity: "critical",
        cursor: cursor(),
        limit: 10,
      }),
    ]);

    expect(first.items).toHaveLength(1);
    expect(second.items).toHaveLength(1);
    expect(first.items[0]?.claim.deliveryClaimId).toBe(
      second.items[0]?.claim.deliveryClaimId,
    );
    expect(first.items[0]?.presentation.presentationId).toBe(
      second.items[0]?.presentation.presentationId,
    );
    expect(await store.countClaims()).toBe(1);

    const acknowledged = await service.poll({
      workspaceId: "workspace:demo",
      clientId: "client:workbuddy-ceo",
      severity: "critical",
      cursor: first.cursor,
      limit: 10,
    });
    expect(acknowledged.items).toEqual([]);
  });

  it("keeps critical and normal polling on separate lanes of the shared cursor", async () => {
    const service = createCaioDeliveryService({
      store: createInMemoryCaioDeliveryStore(),
      now: () => "2026-07-26T08:00:00.000Z",
    });
    await service.enqueue(enqueueInput());
    await service.enqueue(
      enqueueInput({
        deliveryObjectId: "delivery:question-2:v1",
        deliveryKey: "delivery-key:question-2",
        severity: "normal",
        triggerSnapshotHash: HASH_C,
      }),
    );

    const urgent = await service.poll({
      workspaceId: "workspace:demo",
      clientId: "client:workbuddy-ceo",
      severity: "critical",
      cursor: cursor(),
      limit: 10,
    });
    expect(urgent.items.map((item) => item.envelope.severity)).toEqual([
      "critical",
    ]);
    expect(urgent.cursor).toMatchObject({
      criticalSequence: 1,
      normalSequence: 0,
    });

    const digest = await service.poll({
      workspaceId: "workspace:demo",
      clientId: "client:workbuddy-ceo",
      severity: "normal",
      cursor: urgent.cursor,
      limit: 10,
    });
    expect(digest.items.map((item) => item.envelope.severity)).toEqual([
      "normal",
    ]);
    expect(digest.cursor).toMatchObject({
      criticalSequence: 1,
      normalSequence: 1,
    });
  });

  it("reuses an existing envelope when the trigger snapshot is unchanged", async () => {
    const service = createCaioDeliveryService({
      store: createInMemoryCaioDeliveryStore(),
      now: () => "2026-07-26T08:00:00.000Z",
    });

    const first = await service.enqueue(enqueueInput());
    const replay = await service.enqueue(
      enqueueInput({
        deliveryObjectId: "delivery:question-1:v2",
        deliveryVersion: 2,
        objectVersion: 2,
        objectHash: HASH_C,
      }),
    );

    expect(first.outcome).toBe("created");
    expect(replay.outcome).toBe("replayed");
    expect(replay.envelope.deliveryObjectId).toBe(
      first.envelope.deliveryObjectId,
    );
  });

  it("rejects changed delivery semantics for the same trigger snapshot", async () => {
    const service = createCaioDeliveryService({
      store: createInMemoryCaioDeliveryStore(),
      now: () => "2026-07-26T08:00:00.000Z",
    });
    await service.enqueue(enqueueInput());

    await expect(
      service.enqueue(
        enqueueInput({
          deliveryObjectId: "delivery:question-1:v2",
          deliveryVersion: 2,
          objectVersion: 2,
          objectHash: HASH_C,
          severity: "normal",
        }),
      ),
    ).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
  });

  it("fails closed when a second WorkBuddy client polls the single-client ledger", async () => {
    const service = createCaioDeliveryService({
      store: createInMemoryCaioDeliveryStore(),
      now: () => "2026-07-26T08:00:00.000Z",
    });
    await service.enqueue(enqueueInput());
    await service.poll({
      workspaceId: "workspace:demo",
      clientId: "client:workbuddy-ceo",
      severity: "critical",
      cursor: cursor(),
      limit: 10,
    });

    await expect(
      service.poll({
        workspaceId: "workspace:demo",
        clientId: "client:other",
        severity: "critical",
        cursor: createCaioDeliveryCursor({
          workspaceId: "workspace:demo",
          clientId: "client:other",
        }),
        limit: 10,
      }),
    ).rejects.toMatchObject({ code: "SCOPE_DENIED" });
  });

  it("honors snooze without creating a second effective delivery claim", async () => {
    let now = "2026-07-26T08:00:00.000Z";
    const store = createInMemoryCaioDeliveryStore();
    const service = createCaioDeliveryService({
      store,
      now: () => now,
    });
    await service.enqueue(enqueueInput());
    const initial = await service.poll({
      workspaceId: "workspace:demo",
      clientId: "client:workbuddy-ceo",
      severity: "critical",
      cursor: cursor(),
      limit: 10,
    });

    await service.snooze({
      workspaceId: "workspace:demo",
      clientId: "client:workbuddy-ceo",
      deliveryObjectId: "delivery:question-1:v1",
      snoozedUntil: "2026-07-26T08:30:00.000Z",
    });
    const beforeDue = await service.poll({
      workspaceId: "workspace:demo",
      clientId: "client:workbuddy-ceo",
      severity: "critical",
      cursor: initial.cursor,
      limit: 10,
    });
    expect(beforeDue.items).toEqual([]);

    now = "2026-07-26T08:30:00.000Z";
    const afterDue = await service.poll({
      workspaceId: "workspace:demo",
      clientId: "client:workbuddy-ceo",
      severity: "critical",
      cursor: initial.cursor,
      limit: 10,
    });
    expect(afterDue.items).toHaveLength(1);
    expect(afterDue.items[0]?.claim.deliveryClaimId).toBe(
      initial.items[0]?.claim.deliveryClaimId,
    );
    expect(afterDue.items[0]?.presentation.presentationId).not.toBe(
      initial.items[0]?.presentation.presentationId,
    );
    expect(await store.countClaims()).toBe(1);
  });

  it("applies bounded suppression and resumes after revocation", async () => {
    const store = createInMemoryCaioDeliveryStore();
    const service = createCaioDeliveryService({
      store,
      now: () => "2026-07-26T08:00:00.000Z",
    });
    await service.enqueue(enqueueInput());
    await service.registerSuppression({
      suppressionId: "suppression:owner-judgement",
      workspaceId: "workspace:demo",
      category: "owner_judgement",
      scope: { kind: "workspace" },
      validFrom: "2026-07-26T07:00:00.000Z",
      validUntil: "2026-07-26T09:00:00.000Z",
    });

    const suppressed = await service.poll({
      workspaceId: "workspace:demo",
      clientId: "client:workbuddy-ceo",
      severity: "critical",
      cursor: cursor(),
      limit: 10,
    });
    expect(suppressed.items).toEqual([]);

    await service.revokeSuppression({
      workspaceId: "workspace:demo",
      suppressionId: "suppression:owner-judgement",
    });
    const resumed = await service.poll({
      workspaceId: "workspace:demo",
      clientId: "client:workbuddy-ceo",
      severity: "critical",
      cursor: cursor(),
      limit: 10,
    });
    expect(resumed.items).toHaveLength(1);
  });

  it("resolves content from the canonical object only at read time", async () => {
    const resolve = vi.fn(
      async (envelope: CaioDeliveryEnvelope) => ({
        schemaVersion: "helm.workbuddy-prompt-projection/v1",
        source: envelope.source,
        available: true,
        content: { questionRef: envelope.source.objectId },
        localViewRequired: false,
      }),
    );
    const service = createCaioDeliveryService({
      store: createInMemoryCaioDeliveryStore(),
      resolve,
      now: () => "2026-07-26T08:00:00.000Z",
    });
    await service.enqueue(enqueueInput());

    const prompt = await service.getPrompt({
      workspaceId: "workspace:demo",
      deliveryObjectId: "delivery:question-1:v1",
    });

    expect(resolve).toHaveBeenCalledTimes(1);
    expect(resolve.mock.calls[0]?.[0].source.objectId).toBe("question:1");
    expect(prompt.projection).toMatchObject({
      available: true,
      content: { questionRef: "question:1" },
    });
    await expect(
      service.getPrompt({
        workspaceId: "workspace:other",
        deliveryObjectId: "delivery:question-1:v1",
      }),
    ).rejects.toThrow(/workspace/i);
  });

  it.each([
    ["withdrawn", "OBJECT_WITHDRAWN"],
    ["expired", "OBJECT_EXPIRED"],
  ] as const)(
    "blocks %s prompt projection before resolving canonical content",
    async (status, code) => {
      let now = "2026-07-26T08:00:00.000Z";
      const resolve = vi.fn(async () => ({
        schemaVersion: "helm.workbuddy-prompt-projection/v1",
        available: true,
        localViewRequired: false,
      }));
      const service = createCaioDeliveryService({
        store: createInMemoryCaioDeliveryStore(),
        resolve,
        now: () => now,
      });
      await service.enqueue(enqueueInput());
      if (status === "withdrawn") {
        await service.withdraw({
          workspaceId: "workspace:demo",
          deliveryObjectId: "delivery:question-1:v1",
        });
      } else {
        now = "2026-07-26T10:00:00.000Z";
      }

      await expect(
        service.getPrompt({
          workspaceId: "workspace:demo",
          deliveryObjectId: "delivery:question-1:v1",
        }),
      ).rejects.toMatchObject({ code });
      expect(resolve).not.toHaveBeenCalled();
    },
  );
});
