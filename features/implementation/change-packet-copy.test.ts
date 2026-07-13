import { describe, expect, it } from "vitest";

import {
  CATEGORY_COPY,
  EFFECT_LEVEL_COPY,
  READINESS_COPY,
  ROLLBACK_STRATEGY_COPY,
  rollbackStrategyLabel,
  t,
} from "./change-packet-copy";

describe("change-packet-copy", () => {
  it("t() selects language", () => {
    expect(t({ zh: "目标", en: "Goal" }, false)).toBe("目标");
    expect(t({ zh: "目标", en: "Goal" }, true)).toBe("Goal");
  });

  it("effect-level tone escalates read_only → configuration → external (informational, not execution)", () => {
    expect(EFFECT_LEVEL_COPY.read_only.tone).toBe("neutral");
    expect(EFFECT_LEVEL_COPY.configuration_change.tone).toBe("caution");
    expect(EFFECT_LEVEL_COPY.external_side_effect.tone).toBe("danger");
  });

  it("copy maps cover every contract enum value (Record completeness)", () => {
    // If the contract adds/renames a value, tsc fails on the Record; these guard runtime shape.
    expect(Object.keys(CATEGORY_COPY).sort()).toEqual(
      ["connector_setup", "data_seed", "initialization", "migration", "one_off_config"].sort(),
    );
    expect(Object.keys(READINESS_COPY).sort()).toEqual(
      ["blocked_precondition", "pending_source", "ready"].sort(),
    );
    expect(Object.keys(ROLLBACK_STRATEGY_COPY).sort()).toEqual(
      ["compensating_action", "manual_recovery", "not_applicable", "restore_previous_state"].sort(),
    );
  });

  it("rollbackStrategyLabel localizes known strategies and falls back to the raw value", () => {
    expect(rollbackStrategyLabel("restore_previous_state", false)).toBe("恢复到先前状态");
    expect(rollbackStrategyLabel("restore_previous_state", true)).toBe("Restore previous state");
    // defensive: an unknown value (shouldn't happen via the typed contract) returns itself
    expect(rollbackStrategyLabel("some_future_strategy" as never, true)).toBe("some_future_strategy");
  });
});
