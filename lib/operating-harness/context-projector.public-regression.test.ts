import { describe, expect, it } from "vitest";

import { syntheticTemporalOperatingContextInput } from "./context-fixtures";
import { projectTemporalOperatingContext, validateTemporalOperatingContextProjectionInput } from "./context-projector";
import { syntheticFleetHarnessSource } from "./harness-fixtures";

/**
 * Frozen before the tenant live shadow extension: the public offline projection must keep producing
 * byte-identical snapshots and identical rejection codes. Do not update these literals to make a
 * change pass; a difference means the public contract moved.
 */
describe("public offline projection regression freeze", () => {
  it("keeps the synthetic snapshot hashes", () => {
    const projection = projectTemporalOperatingContext(syntheticTemporalOperatingContextInput());
    expect(projection.ok).toBe(true);
    expect(projection.snapshot?.contentHash).toBe("sha256:1bb1145c2ad5afaeb981328d06889c7624da1c0381023da6188ba719960a18a7");
    expect(projection.snapshot?.replayRootHash).toBe("sha256:a10af146003156e815c8f3f6cbd5c85ba2287d32ad03ab9e6403c50b09355710");
  });

  it("keeps the fleet-source rejection codes", () => {
    const fleet = syntheticTemporalOperatingContextInput();
    fleet.sourceBindings[0] = { source: { ...syntheticFleetHarnessSource(), signalId: fleet.signalEvents[0].signalId }, promotion: null };
    expect(validateTemporalOperatingContextProjectionInput(fleet).errors).toEqual([
      "source_gate:source_class_forbidden_from_improvement_loop:fleet_customer_health",
      "source_class_not_allowed_by_manifest:fleet_customer_health",
      "source_use_not_allowed_by_manifest:signal:account-health-17",
    ]);
  });

  it("keeps the window rejection codes", () => {
    const window = syntheticTemporalOperatingContextInput();
    window.windowEnd = window.windowStart;
    expect(validateTemporalOperatingContextProjectionInput(window).errors).toEqual([
      "signal_outside_context_window:signal:account-health-17",
      "signal_outside_context_window:signal:deal-risk-17",
      "signal_outside_context_window:signal:delivery-watch-17",
    ]);
  });
});
