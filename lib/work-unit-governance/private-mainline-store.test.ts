import { describe, expect, it } from "vitest";

import { computeWorkUnitSnapshotHash } from "./contracts";
import {
  buildPrivateMainlineStoreAppendEnvelope,
  buildPublicCoreNoopPrivateMainlineStore,
  privateMainlineStoreBindingSchema,
  validatePrivateMainlineStoreBinding,
  type PrivateMainlineStoreBinding,
} from "./private-mainline-store";
import {
  privateMainlineLedgerEventSchema,
  type PrivateMainlineLedger,
  type PrivateMainlineLedgerEvent,
} from "./mainline-ledger";
import {
  buildSyntheticAcceptedWorkUnit,
  syntheticReceipt,
  WORK_UNIT_SYNTHETIC_TIME,
} from "./synthetic-fixtures";

const SYNTHETIC_LEDGER = {
  schemaVersion: "helm.private-mainline-ledger.v1",
  ledgerRef: "synthetic-ledger:work-unit-mainline",
  events: [],
  publicCoreCarriesRealInstance: false,
} satisfies PrivateMainlineLedger;

function privateBinding(
  overrides: Partial<PrivateMainlineStoreBinding> = {},
): PrivateMainlineStoreBinding {
  return privateMainlineStoreBindingSchema.parse({
    schemaVersion: "helm.private-mainline-store-binding.v1",
    bindingRef: "synthetic-binding:private-mainline-store",
    storeMode: "private_control_plane",
    storeRef: "synthetic://private-mainline-store",
    authorityRef: "synthetic://owner-plane/work-unit-mainline",
    capabilities: {
      appendOnly: true,
      snapshotBoundReceipts: true,
      conflictKeySerialization: true,
      humanOwnerReceiptRequired: true,
      activationAuthoritySeparated: true,
      privateStorePersists: true,
      publicCoreCarriesRealInstance: false,
      publicCorePersists: false,
      publicCoreWritesPrivateMainline: false,
      publicCoreSendsExternally: false,
      publicCoreActivatesRuntime: false,
    },
    ...overrides,
  });
}

function publicNoopBinding(
  overrides: Partial<PrivateMainlineStoreBinding> = {},
): PrivateMainlineStoreBinding {
  return privateMainlineStoreBindingSchema.parse({
    ...privateBinding({
      storeMode: "public_core_noop",
      storeRef: "public-core:no-private-mainline-store",
      authorityRef: undefined,
      capabilities: {
        appendOnly: true,
        snapshotBoundReceipts: true,
        conflictKeySerialization: true,
        humanOwnerReceiptRequired: true,
        activationAuthoritySeparated: true,
        privateStorePersists: false,
        publicCoreCarriesRealInstance: false,
        publicCorePersists: false,
        publicCoreWritesPrivateMainline: false,
        publicCoreSendsExternally: false,
        publicCoreActivatesRuntime: false,
      },
    }),
    ...overrides,
  });
}

function promotionEvent(): PrivateMainlineLedgerEvent {
  const workUnit = buildSyntheticAcceptedWorkUnit();
  const snapshotHash = computeWorkUnitSnapshotHash(workUnit);
  return privateMainlineLedgerEventSchema.parse({
    schemaVersion: "helm.private-mainline-ledger-event.v1",
    ledgerRef: SYNTHETIC_LEDGER.ledgerRef,
    eventId: `ledger-event:${workUnit.id}:mainline`,
    workUnitId: workUnit.id,
    eventType: "mainline_recorded",
    actor: { actorType: "human_owner", actorRef: "owner-1" },
    at: WORK_UNIT_SYNTHETIC_TIME,
    snapshotHash,
    conflictKeys: workUnit.conflictKeys,
    baselineEventIds: [],
    supersedesEventIds: [],
    auditRefs: ["synthetic://audit/mainline"],
    receipt: syntheticReceipt("mainline-receipt-1", snapshotHash),
    publicCoreCarriesRealInstance: false,
    createsExternalEffect: false,
  });
}

describe("private mainline store binding", () => {
  it("builds a private-store append envelope without Public Core persistence or readiness", () => {
    const workUnit = buildSyntheticAcceptedWorkUnit();
    const event = promotionEvent();
    const envelope = buildPrivateMainlineStoreAppendEnvelope({
      binding: privateBinding(),
      ledger: SYNTHETIC_LEDGER,
      workUnit,
      event,
      requestedBy: { actorType: "system", actorRef: "mainline-handoff-builder" },
      requestedAt: WORK_UNIT_SYNTHETIC_TIME,
    });

    expect(envelope.ok).toBe(true);
    if (envelope.ok) {
      expect(envelope.envelope.readinessClaim).toBe("not_readiness");
      expect(envelope.envelope.privateStoreRequired).toBe(true);
      expect(envelope.envelope.publicCorePersists).toBe(false);
      expect(envelope.envelope.publicCoreWritesPrivateMainline).toBe(false);
      expect(envelope.envelope.createsExternalEffect).toBe(false);
      expect(envelope.appendPlan.publicCorePersists).toBe(false);
      expect(envelope.appendPlan.publicCoreWritesPrivateMainline).toBe(false);
      expect(envelope.appendPlan.createsExternalEffect).toBe(false);
      expect(envelope.appendPlan.nextLedger.events).toHaveLength(1);
    }
  });

  it("keeps the Public Core default store as a no-op that cannot append", () => {
    const workUnit = buildSyntheticAcceptedWorkUnit();
    const event = promotionEvent();
    const store = buildPublicCoreNoopPrivateMainlineStore();
    const envelope = buildPrivateMainlineStoreAppendEnvelope({
      binding: publicNoopBinding(),
      ledger: SYNTHETIC_LEDGER,
      workUnit,
      event,
      requestedBy: { actorType: "system", actorRef: "mainline-handoff-builder" },
      requestedAt: WORK_UNIT_SYNTHETIC_TIME,
    });

    expect(envelope.ok).toBe(true);
    if (!envelope.ok) throw new Error("public no-op envelope should still be previewable");

    const result = store.append(envelope.envelope);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violations.map((violation) => violation.rule)).toContain(
        "public-core-private-mainline-store-is-noop",
      );
      expect(result.publicCorePersists).toBe(false);
      expect(result.publicCoreWritesPrivateMainline).toBe(false);
      expect(result.createsExternalEffect).toBe(false);
    }
  });

  it("blocks private bindings that do not prove required governance capabilities", () => {
    const violations = validatePrivateMainlineStoreBinding({
      ...privateBinding(),
      authorityRef: undefined,
      capabilities: {
        ...privateBinding().capabilities,
        appendOnly: false,
        conflictKeySerialization: false,
        humanOwnerReceiptRequired: false,
      },
    });

    expect(violations.map((violation) => violation.rule)).toEqual([
      "private-store-authority-required",
      "private-store-append-only-required",
      "private-store-conflict-serialization-required",
      "private-store-human-owner-receipt-required",
    ]);
  });

  it("blocks public-core bindings that claim real persistence or side effects", () => {
    const violations = validatePrivateMainlineStoreBinding({
      ...publicNoopBinding(),
      capabilities: {
        ...publicNoopBinding().capabilities,
        privateStorePersists: true,
        publicCoreCarriesRealInstance: true,
        publicCorePersists: true,
        publicCoreWritesPrivateMainline: true,
        publicCoreSendsExternally: true,
        publicCoreActivatesRuntime: true,
      },
    });

    expect(violations.map((violation) => violation.rule)).toEqual([
      "public-core-noop-cannot-persist-private-store",
      "private-store-public-core-real-instance-forbidden",
      "private-store-public-core-persistence-forbidden",
      "private-store-public-core-write-forbidden",
      "private-store-public-core-send-forbidden",
      "private-store-public-core-activation-forbidden",
    ]);
  });
});
