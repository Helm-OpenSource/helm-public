import { describe, expect, it } from "vitest";

import { syntheticTemporalOperatingContextInput } from "./context-fixtures";
import {
  projectTemporalOperatingContext,
  validateTemporalOperatingContextProjectionInput,
  validateTemporalOperatingContextSnapshotBinding,
} from "./context-projector";
import { syntheticTenantLiveContextInput, syntheticTenantObservationReceipt } from "./tenant-live-fixtures";

type Mutable = Record<string, unknown>;

describe("tenant live shadow projection", () => {
  it("projects a derived-only snapshot from tenant self-observation and replays it", () => {
    const input = syntheticTenantLiveContextInput();
    expect(validateTemporalOperatingContextProjectionInput(input)).toEqual({ ok: true, errors: [] });
    const projection = projectTemporalOperatingContext(input);
    expect(projection.ok).toBe(true);
    expect(projection.snapshot).toMatchObject({
      derivedOnly: true, canonicalStateAuthority: false, writebackAllowed: false, actionAuthority: "none", modelCallsUsed: false,
      sourceReceipts: [expect.objectContaining({ sourceClass: "tenant_self_observation", promotionId: null })],
    });
    expect(validateTemporalOperatingContextSnapshotBinding({ input, snapshot: projection.snapshot }).ok).toBe(true);
  });

  it("requires observation receipts on a tenant binding", () => {
    const input = syntheticTenantLiveContextInput();
    delete (input.sourceBindings[0] as Mutable).observationReceipts;
    expect(validateTemporalOperatingContextProjectionInput(input).ok).toBe(false);
  });

  it("rejects receipts that do not cover the signal evidence", () => {
    const input = syntheticTenantLiveContextInput();
    (input.sourceBindings[0] as Mutable).observationReceipts = [syntheticTenantObservationReceipt(["caio-evidence:other"])];
    expect(validateTemporalOperatingContextProjectionInput(input).errors).toContain(
      "tenant_source_gate:tenant_observation_evidence_uncovered:caio-evidence:synthetic-dead-letters",
    );
  });

  it("rejects observation receipts on a public binding", () => {
    const input = syntheticTemporalOperatingContextInput();
    (input.sourceBindings[0] as Mutable).observationReceipts = [syntheticTenantObservationReceipt(["evidence:account-health-17"])];
    expect(validateTemporalOperatingContextProjectionInput(input).ok).toBe(false);
  });

  it("never mixes tenant and public sources under either manifest", () => {
    const publicInput = syntheticTemporalOperatingContextInput();
    const tenantInput = syntheticTenantLiveContextInput();

    const tenantUnderPublic = syntheticTemporalOperatingContextInput();
    tenantUnderPublic.manifest = tenantInput.manifest;
    tenantUnderPublic.revision = tenantInput.revision;
    expect(validateTemporalOperatingContextProjectionInput(tenantUnderPublic).errors).toContain(
      "source_class_not_allowed_by_manifest:synthetic_public",
    );

    const publicUnderTenant = syntheticTenantLiveContextInput();
    publicUnderTenant.manifest = publicInput.manifest;
    publicUnderTenant.revision = publicInput.revision;
    expect(validateTemporalOperatingContextProjectionInput(publicUnderTenant).errors).toContain(
      "source_class_not_allowed_by_manifest:tenant_self_observation",
    );
  });
});
