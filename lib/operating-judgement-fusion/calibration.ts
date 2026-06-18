// Operating Judgement Fusion v0.1 — confidence calibration.
//
// The signal-flow `confidenceBand` is a self-reported enum. A v0.1 judgement carries a
// 0..1 `confidence.score`; this module turns a set of (predicted score, realized correct)
// pairs into real calibration evidence — Brier score, Expected/Max Calibration Error, and
// a reliability table — so the system can never *claim* "calibrated" by enum alone.
//
// Pure functions. No IO, no model. Realized correctness comes from the held-out gold /
// recorded outcome upstream; this module only does the arithmetic.

export type CalibrationPoint = { predicted: number; correct: boolean };

export type CalibrationBin = {
  lowerBound: number;
  upperBound: number;
  count: number;
  meanPredicted: number;
  empiricalAccuracy: number;
};

export type CalibrationReport = {
  sampleCount: number;
  brierScore: number;
  expectedCalibrationError: number;
  maxCalibrationError: number;
  bins: CalibrationBin[];
  // True when a high-confidence bucket is materially less accurate than it claimed.
  overconfident: boolean;
};

// A high-confidence bin is "overconfident" when realized accuracy falls this far below
// the mean predicted confidence of that bin.
const OVERCONFIDENCE_GAP_THRESHOLD = 0.15;
const HIGH_CONFIDENCE_FLOOR = 0.7;

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export function computeCalibration(
  points: readonly CalibrationPoint[],
  binCount = 10,
): CalibrationReport {
  const bins: CalibrationBin[] = [];
  const safeBinCount = Math.max(1, Math.floor(binCount));
  for (let i = 0; i < safeBinCount; i += 1) {
    bins.push({
      lowerBound: i / safeBinCount,
      upperBound: (i + 1) / safeBinCount,
      count: 0,
      meanPredicted: 0,
      empiricalAccuracy: 0,
    });
  }

  if (points.length === 0) {
    return {
      sampleCount: 0,
      brierScore: 0,
      expectedCalibrationError: 0,
      maxCalibrationError: 0,
      bins,
      overconfident: false,
    };
  }

  const predictedSums = new Array(safeBinCount).fill(0);
  const correctSums = new Array(safeBinCount).fill(0);
  let brierTotal = 0;

  for (const point of points) {
    const predicted = clamp01(point.predicted);
    const actual = point.correct ? 1 : 0;
    brierTotal += (predicted - actual) ** 2;
    // Highest bin is closed on the right so predicted === 1 lands in the last bin.
    const rawIndex = Math.floor(predicted * safeBinCount);
    const index = Math.min(safeBinCount - 1, rawIndex);
    bins[index].count += 1;
    predictedSums[index] += predicted;
    correctSums[index] += actual;
  }

  let expectedCalibrationError = 0;
  let maxCalibrationError = 0;
  let overconfident = false;

  for (let i = 0; i < safeBinCount; i += 1) {
    const bin = bins[i];
    if (bin.count === 0) continue;
    bin.meanPredicted = predictedSums[i] / bin.count;
    bin.empiricalAccuracy = correctSums[i] / bin.count;
    const gap = Math.abs(bin.meanPredicted - bin.empiricalAccuracy);
    expectedCalibrationError += (bin.count / points.length) * gap;
    if (gap > maxCalibrationError) maxCalibrationError = gap;
    if (
      bin.meanPredicted >= HIGH_CONFIDENCE_FLOOR &&
      bin.meanPredicted - bin.empiricalAccuracy > OVERCONFIDENCE_GAP_THRESHOLD
    ) {
      overconfident = true;
    }
  }

  return {
    sampleCount: points.length,
    brierScore: brierTotal / points.length,
    expectedCalibrationError,
    maxCalibrationError,
    bins,
    overconfident,
  };
}

// Pearson correlation between two equal-length numeric series. Returns 0 when undefined
// (fewer than 2 points or zero variance). Used to test the claim "more evidence → more
// correct"; a non-positive correlation means evidence binding is decorative.
export function pearsonCorrelation(xs: readonly number[], ys: readonly number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return 0;
  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < n; i += 1) {
    sumX += xs[i];
    sumY += ys[i];
  }
  const meanX = sumX / n;
  const meanY = sumY / n;
  let covariance = 0;
  let varianceX = 0;
  let varianceY = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    covariance += dx * dy;
    varianceX += dx * dx;
    varianceY += dy * dy;
  }
  if (varianceX === 0 || varianceY === 0) return 0;
  return covariance / Math.sqrt(varianceX * varianceY);
}
