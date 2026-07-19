import { describe, expect, it } from "vitest";

import {
  buildOwnerNotificationHandoffEnvelope,
  buildPublicCoreNoopOwnerNotificationDispatcher,
  ownerNotificationBindingSchema,
  validateOwnerNotificationBinding,
  type OwnerNotificationBinding,
} from "./owner-notification-binding";
import {
  buildSyntheticAcceptedWorkUnit,
  buildSyntheticOwnerLifecyclePolicy,
  buildSyntheticWorkUnit,
  WORK_UNIT_SYNTHETIC_TIME,
} from "./synthetic-fixtures";

function privateBinding(
  overrides: Partial<OwnerNotificationBinding> = {},
): OwnerNotificationBinding {
  return ownerNotificationBindingSchema.parse({
    schemaVersion: "helm.owner-notification-binding.v1",
    bindingRef: "synthetic-binding:owner-notification",
    dispatcherMode: "private_control_plane",
    dispatcherRef: "synthetic://private-owner-notifications",
    channel: "private_inbox",
    authorityRef: "synthetic://owner-plane/notification-authority",
    deliveryPolicyRef: "synthetic://owner-plane/delivery-policy",
    capabilities: {
      ownerRefsOnly: true,
      snapshotBoundMessages: true,
      humanOwnerAuthorityRequired: true,
      escalationPolicyRequired: true,
      contactDetailsStoredOutsidePublicCore: true,
      redactedEnvelopeOnly: true,
      privateDispatcherSends: true,
      privateDispatcherPersistsReceipt: true,
      publicCoreCarriesRealInstance: false,
      publicCorePersists: false,
      publicCoreSendsNotification: false,
      publicCoreWritesTarget: false,
      publicCoreActivatesRuntime: false,
      publicCoreGrantsApproval: false,
    },
    ...overrides,
  });
}

function publicNoopBinding(
  overrides: Partial<OwnerNotificationBinding> = {},
): OwnerNotificationBinding {
  return ownerNotificationBindingSchema.parse({
    ...privateBinding({
      dispatcherMode: "public_core_noop",
      dispatcherRef: "public-core:no-owner-notification-dispatcher",
      authorityRef: undefined,
      deliveryPolicyRef: undefined,
      capabilities: {
        ownerRefsOnly: true,
        snapshotBoundMessages: true,
        humanOwnerAuthorityRequired: true,
        escalationPolicyRequired: true,
        contactDetailsStoredOutsidePublicCore: true,
        redactedEnvelopeOnly: true,
        privateDispatcherSends: false,
        privateDispatcherPersistsReceipt: false,
        publicCoreCarriesRealInstance: false,
        publicCorePersists: false,
        publicCoreSendsNotification: false,
        publicCoreWritesTarget: false,
        publicCoreActivatesRuntime: false,
        publicCoreGrantsApproval: false,
      },
    }),
    ...overrides,
  });
}

describe("owner notification binding", () => {
  it("builds a private notification handoff envelope without contact details or side effects", () => {
    const workUnit = buildSyntheticWorkUnit();
    const result = buildOwnerNotificationHandoffEnvelope({
      binding: privateBinding(),
      workUnit,
      policy: buildSyntheticOwnerLifecyclePolicy({
        reviewDueAt: "2026-07-20T00:00:00.000Z",
      }),
      receipts: [],
      requestedBy: { actorType: "system", actorRef: "owner-notification-handoff-builder" },
      requestedAt: WORK_UNIT_SYNTHETIC_TIME,
      notificationKind: "owner_review_requested",
      reason: "Synthetic owner review is pending.",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.envelope.notificationKind).toBe("owner_review_requested");
      expect(result.envelope.ownerRefs).toEqual(["owner-1"]);
      expect(result.envelope.pendingOwnerRefs).toEqual(["owner-1"]);
      expect(result.envelope.readinessClaim).toBe("not_readiness");
      expect(result.envelope.approvalClaim).toBe("not_approval");
      expect(result.envelope.privateDispatcherRequired).toBe(true);
      expect(result.envelope.deliveryReceiptRequired).toBe(true);
      expect(result.envelope.publicCoreCarriesRealInstance).toBe(false);
      expect(result.envelope.publicCorePersists).toBe(false);
      expect(result.envelope.createsExternalEffect).toBe(false);
      expect(result.envelope.sendsNotification).toBe(false);
      expect(result.envelope.sendsExternally).toBe(false);
      expect(result.envelope.writesTarget).toBe(false);
      expect(result.envelope.activatesRuntime).toBe(false);
      expect(result.envelope.grantsApproval).toBe(false);
      expect(JSON.stringify(result.envelope)).not.toContain("@");
      expect(JSON.stringify(result.envelope)).not.toContain("owner@example.com");
    }

    expect(
      ownerNotificationBindingSchema.safeParse({
        ...privateBinding(),
        contactEndpoint: "owner@example.com",
      }).success,
    ).toBe(false);
  });

  it("keeps the Public Core default dispatcher as a no-op that cannot send", () => {
    const workUnit = buildSyntheticWorkUnit();
    const envelope = buildOwnerNotificationHandoffEnvelope({
      binding: publicNoopBinding(),
      workUnit,
      policy: buildSyntheticOwnerLifecyclePolicy({
        reviewDueAt: "2026-07-20T00:00:00.000Z",
      }),
      receipts: [],
      requestedBy: { actorType: "system", actorRef: "owner-notification-handoff-builder" },
      requestedAt: WORK_UNIT_SYNTHETIC_TIME,
      notificationKind: "owner_review_requested",
      reason: "Synthetic owner review is pending.",
    });

    expect(envelope.ok).toBe(true);
    if (!envelope.ok) throw new Error("public no-op envelope should still be previewable");

    const result = buildPublicCoreNoopOwnerNotificationDispatcher().dispatch(envelope.envelope);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violations.map((violation) => violation.rule)).toContain(
        "public-core-owner-notification-dispatcher-is-noop",
      );
      expect(result.publicCorePersists).toBe(false);
      expect(result.sendsNotification).toBe(false);
      expect(result.createsExternalEffect).toBe(false);
      expect(result.grantsApproval).toBe(false);
    }
  });

  it("blocks private bindings that do not prove notification governance capabilities", () => {
    const violations = validateOwnerNotificationBinding({
      ...privateBinding(),
      authorityRef: undefined,
      deliveryPolicyRef: undefined,
      capabilities: {
        ...privateBinding().capabilities,
        ownerRefsOnly: false,
        snapshotBoundMessages: false,
        humanOwnerAuthorityRequired: false,
        escalationPolicyRequired: false,
        redactedEnvelopeOnly: false,
        privateDispatcherSends: false,
        privateDispatcherPersistsReceipt: false,
      },
    });

    expect(violations.map((violation) => violation.rule)).toEqual([
      "owner-notification-private-authority-required",
      "owner-notification-private-delivery-policy-required",
      "owner-notification-owner-refs-only-required",
      "owner-notification-snapshot-bound-required",
      "owner-notification-human-owner-authority-required",
      "owner-notification-escalation-policy-required",
      "owner-notification-redacted-envelope-required",
      "owner-notification-private-dispatch-required",
      "owner-notification-private-receipt-persistence-required",
    ]);
  });

  it("blocks public-core bindings that claim notification, persistence, approval, or runtime effects", () => {
    const violations = validateOwnerNotificationBinding({
      ...publicNoopBinding(),
      capabilities: {
        ...publicNoopBinding().capabilities,
        privateDispatcherSends: true,
        privateDispatcherPersistsReceipt: true,
        publicCoreCarriesRealInstance: true,
        publicCorePersists: true,
        publicCoreSendsNotification: true,
        publicCoreWritesTarget: true,
        publicCoreActivatesRuntime: true,
        publicCoreGrantsApproval: true,
      },
    });

    expect(violations.map((violation) => violation.rule)).toEqual([
      "public-core-notification-dispatcher-cannot-send",
      "public-core-notification-dispatcher-cannot-persist-receipt",
      "owner-notification-public-core-real-instance-forbidden",
      "owner-notification-public-core-persistence-forbidden",
      "owner-notification-public-core-send-forbidden",
      "owner-notification-public-core-write-forbidden",
      "owner-notification-public-core-activation-forbidden",
      "owner-notification-public-core-approval-forbidden",
    ]);
  });

  it("does not build a review notification when no owner is pending", () => {
    const accepted = buildSyntheticAcceptedWorkUnit();
    const result = buildOwnerNotificationHandoffEnvelope({
      binding: privateBinding(),
      workUnit: accepted,
      policy: buildSyntheticOwnerLifecyclePolicy(),
      receipts: [],
      requestedBy: { actorType: "system", actorRef: "owner-notification-handoff-builder" },
      requestedAt: WORK_UNIT_SYNTHETIC_TIME,
      notificationKind: "owner_review_requested",
      reason: "Synthetic owner review is pending.",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violations.map((violation) => violation.rule)).toContain(
        "owner-notification-no-pending-owner",
      );
    }
  });

  it("fails closed instead of throwing when the handoff reason is missing", () => {
    const result = buildOwnerNotificationHandoffEnvelope({
      binding: privateBinding(),
      workUnit: buildSyntheticWorkUnit(),
      policy: buildSyntheticOwnerLifecyclePolicy({
        reviewDueAt: "2026-07-20T00:00:00.000Z",
      }),
      receipts: [],
      requestedBy: { actorType: "system", actorRef: "owner-notification-handoff-builder" },
      requestedAt: WORK_UNIT_SYNTHETIC_TIME,
      notificationKind: "owner_review_requested",
      reason: "",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violations.map((violation) => violation.rule)).toContain(
        "owner-notification-reason-schema",
      );
      expect(result.sendsNotification).toBe(false);
      expect(result.grantsApproval).toBe(false);
    }
  });
});
