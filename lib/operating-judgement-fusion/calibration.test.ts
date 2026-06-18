import { describe, expect, it } from "vitest";

import { computeCalibration, pearsonCorrelation } from "./calibration";

describe("computeCalibration", () => {
  it("returns zeroed report for an empty set", () => {
    const report = computeCalibration([]);
    expect(report.sampleCount).toBe(0);
    expect(report.brierScore).toBe(0);
    expect(report.expectedCalibrationError).toBe(0);
    expect(report.overconfident).toBe(false);
  });

  it("computes a low Brier and ECE for well-calibrated predictions", () => {
    // 80%-confidence predictions that are correct 80% of the time.
    const points = [
      ...Array.from({ length: 8 }, () => ({ predicted: 0.8, correct: true })),
      ...Array.from({ length: 2 }, () => ({ predicted: 0.8, correct: false })),
    ];
    const report = computeCalibration(points);
    expect(report.sampleCount).toBe(10);
    expect(report.expectedCalibrationError).toBeCloseTo(0, 5);
    expect(report.overconfident).toBe(false);
    // Brier = 0.8 * (0.2^2) + 0.2 * (0.8^2) = 0.032 + 0.128 = 0.16
    expect(report.brierScore).toBeCloseTo(0.16, 5);
  });

  it("flags overconfidence when a high-confidence bin underperforms", () => {
    // Claims 0.95 confidence but is only correct 40% of the time.
    const points = [
      ...Array.from({ length: 4 }, () => ({ predicted: 0.95, correct: true })),
      ...Array.from({ length: 6 }, () => ({ predicted: 0.95, correct: false })),
    ];
    const report = computeCalibration(points);
    expect(report.overconfident).toBe(true);
    expect(report.maxCalibrationError).toBeGreaterThan(0.15);
  });

  it("does not flag underconfidence as overconfidence", () => {
    const points = [
      ...Array.from({ length: 9 }, () => ({ predicted: 0.3, correct: true })),
      { predicted: 0.3, correct: false },
    ];
    const report = computeCalibration(points);
    expect(report.overconfident).toBe(false);
  });
});

describe("pearsonCorrelation", () => {
  it("returns 0 for fewer than two points or zero variance", () => {
    expect(pearsonCorrelation([1], [1])).toBe(0);
    expect(pearsonCorrelation([1, 1, 1], [0, 1, 0])).toBe(0);
  });

  it("detects a positive relationship between evidence completeness and correctness", () => {
    const completeness = [0.1, 0.2, 0.4, 0.6, 0.8, 1.0];
    const correct = [0, 0, 0, 1, 1, 1];
    expect(pearsonCorrelation(completeness, correct)).toBeGreaterThan(0.7);
  });

  it("detects a negative relationship", () => {
    expect(pearsonCorrelation([1, 2, 3, 4], [4, 3, 2, 1])).toBeCloseTo(-1, 5);
  });
});
