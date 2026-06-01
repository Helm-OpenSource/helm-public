export function formatSettlementBatchReference(
  batchKey: string | null | undefined,
  periodLabel: string | null | undefined,
  english: boolean,
) {
  const label = english ? "Settlement batch" : "结算批次";
  const period = periodLabel ?? parseSettlementPeriodFromKey(batchKey);

  return period ? `${label} · ${period}` : label;
}

function parseSettlementPeriodFromKey(batchKey: string | null | undefined) {
  const match = batchKey?.match(/^settlement_(\d{4})_(\d{2})$/);
  return match ? `${match[1]}-${match[2]}` : null;
}
