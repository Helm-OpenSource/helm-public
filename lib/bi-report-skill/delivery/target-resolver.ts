export function resolveBiReportTargetKey(targetKey: string) {
  const normalized = targetKey.trim();
  if (!normalized) {
    throw new Error("BI report delivery targetKey is empty");
  }

  if (!normalized.startsWith("env:")) {
    return normalized;
  }

  const envName = normalized.slice("env:".length).trim();
  if (!envName) {
    throw new Error("BI report delivery targetKey env reference is empty");
  }

  const value = process.env[envName]?.trim();
  if (!value) {
    throw new Error(`BI report delivery targetKey env ${envName} is not configured`);
  }

  return value;
}
