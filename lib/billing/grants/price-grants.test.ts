import type { Prisma, PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { billingPeriodKeys, changeSpendGrantInTransaction, chargeFenForQuantity, createSpendGrant, evaluateSpendGrant,
  normalizePriceVersion, type PublishPriceVersionInput, type SpendGrantRow } from "./price-grants";

const fen = (value: number) => BigInt(value);
const price = (extra: Partial<PublishPriceVersionInput> = {}): PublishPriceVersionInput => ({
  actor: { type: "SYSTEM", ref: "catalog-service" }, productCode: "synthetic.bill_parse", version: 1,
  billingEventRef: "service-billing-event-v1:bill_parsed", meterUnit: "document", acceptanceRef: "acceptance:usable-readback",
  scopeKind: "workspace", unitPriceFenNumerator: fen(100), unitPriceDenominator: fen(3),
  effectiveFrom: new Date("2026-11-01T00:00:00Z"), effectiveUntil: null, approvalRef: "approval:synthetic", ...extra });
const grant = (extra: Partial<SpendGrantRow> = {}): SpendGrantRow => ({ id: "g1", payerAccountId: "p1", productId: "prod",
  priceVersionId: "pv1", state: "active", version: 2, validFrom: new Date("2026-11-01T00:00:00Z"),
  validUntil: new Date("2026-12-01T00:00:00Z"), contentHash: "0".repeat(64), perChargeLimitFen: fen(500),
  dailyLimitFen: fen(1000), monthlyLimitFen: fen(3000), ...extra });
const pv = { id: "pv1", productId: "prod", version: 1, scopeKind: "workspace", billingEventRef: "event:a", meterUnit: "document",
  unitPriceFenNumerator: fen(100), unitPriceDenominator: fen(1), effectiveFrom: new Date("2026-11-01T00:00:00Z"),
  effectiveUntil: null, contentHash: "1".repeat(64) }; // 100 fen per document
const use = (quantity: number, day = 0, month = 0, extra: Record<string, unknown> = {}) => ({ priceVersionId: "pv1",
  billingEventRef: "event:a", meterUnit: "document", quantity: fen(quantity), at: new Date("2026-11-10T04:00:00Z"),
  usedFen: { day: fen(day), month: fen(month) }, ...extra });
const noDb = {} as PrismaClient; // input refusals must happen before any database call

describe("price versions", () => {
  it("hashes the full content and refuses malformed or non-service input", () => {
    const a = normalizePriceVersion(price());
    expect(a).toMatchObject({ rounding: "half_up", createdBy: "SYSTEM:catalog-service" });
    expect(a.contentHash).toMatch(/^[a-f0-9]{64}$/);
    for (const changed of [{ unitPriceFenNumerator: fen(101) }, { acceptanceRef: "acceptance:other" }, { version: 2 },
      { effectiveUntil: new Date("2027-01-01T00:00:00Z") }]) {
      expect(normalizePriceVersion(price(changed)).contentHash).not.toBe(a.contentHash);
    }
    for (const bad of [{ actor: { type: "USER", ref: "u1" } }, { productCode: "Bad Code" }, { version: 0 },
      { unitPriceDenominator: fen(0) }, { unitPriceFenNumerator: fen(-1) }, { meterUnit: "" }, { approvalRef: "" },
      { effectiveUntil: new Date("2026-10-01T00:00:00Z") }]) {
      expect(() => normalizePriceVersion(price(bad as Partial<PublishPriceVersionInput>))).toThrow("price_input_invalid");
    }
  });
  it("prices a quantity exactly and rounds once, half-up", () => {
    const third = { unitPriceFenNumerator: fen(100), unitPriceDenominator: fen(3) }; // 33.33... fen per unit
    expect([1, 2, 3].map(quantity => chargeFenForQuantity(third, fen(quantity)))).toEqual([fen(33), fen(67), fen(100)]);
    expect(chargeFenForQuantity({ unitPriceFenNumerator: fen(1), unitPriceDenominator: fen(2) }, fen(1))).toBe(fen(1));
    expect(() => chargeFenForQuantity(third, fen(0))).toThrow("price_input_invalid");
    expect(() => chargeFenForQuantity({ unitPriceFenNumerator: BigInt(Number.MAX_SAFE_INTEGER), unitPriceDenominator: fen(1) },
      fen(2))).toThrow("price_amount_out_of_range");
  });
  it("derives Asia/Shanghai day and month keys across the UTC boundary", () => {
    expect(billingPeriodKeys(new Date("2026-11-30T15:59:59.999Z"))).toEqual({ day: "2026-11-30", month: "2026-11" });
    expect(billingPeriodKeys(new Date("2026-11-30T16:00:00Z"))).toEqual({ day: "2026-12-01", month: "2026-12" });
    expect(() => billingPeriodKeys(new Date("invalid"))).toThrow("grant_input_invalid");
  });
});

describe("spend grant evaluation", () => {
  it("prices from the bound price row, counts used plus the charge, and refuses each violation", () => {
    expect(evaluateSpendGrant(grant(), pv, use(5, 500, 2500))).toBe(fen(500));
    const cases: Array<[SpendGrantRow, ReturnType<typeof use>, string]> = [
      [grant(), use(6), "grant_per_charge_exceeded"], [grant(), use(4, 601), "grant_daily_limit_exceeded"],
      [grant(), use(4, 0, 2601), "grant_monthly_limit_exceeded"], [grant(), use(1, 0, 0, { meterUnit: "page" }), "grant_meter_mismatch"],
      [grant(), use(1, 0, 0, { billingEventRef: "event:b" }), "grant_meter_mismatch"],
      [grant({ state: "disabled", perChargeLimitFen: fen(0), dailyLimitFen: fen(0), monthlyLimitFen: fen(0) }), use(1), "grant_not_active"],
      [grant({ state: "paused" }), use(1), "grant_not_active"], [grant({ state: "revoked" }), use(1), "grant_not_active"],
      [grant(), use(1, 0, 0, { at: new Date("2026-12-01T00:00:00Z") }), "grant_outside_validity"],
      [grant(), use(1, 0, 0, { priceVersionId: "pv2" }), "grant_price_version_mismatch"], // a newer price never inherits
      [grant(), use(0), "grant_input_invalid"],
    ];
    for (const [row, request, code] of cases) expect(() => evaluateSpendGrant(row, pv, request)).toThrow(code);
    expect(() => evaluateSpendGrant(grant(), { ...pv, effectiveUntil: new Date("2026-11-05T00:00:00Z") }, use(1)))
      .toThrow("price_version_not_effective");
    expect(() => evaluateSpendGrant(grant(), { ...pv, unitPriceFenNumerator: fen(1), unitPriceDenominator: fen(3) }, use(1)))
      .toThrow("grant_charge_zero"); // 1/3 fen rounds to 0
  });
});

describe("spend grant input guards", () => {
  const base = { actorUserId: "u1", payerAccountId: "p1", priceVersionId: "pv1", operationKey: "grant:1", evidenceRef: "consent:1",
    validFrom: new Date("2026-11-01T00:00:00Z"), validUntil: new Date("2026-12-01T00:00:00Z") };
  it("refuses scheduled triggers, unordered limits and inverted validity before touching the database", async () => {
    await expect(createSpendGrant(noDb, { ...base, triggerKind: "scheduled" })).rejects.toThrow("grant_trigger_not_enabled");
    await expect(createSpendGrant(noDb, { ...base, limits: { perChargeLimitFen: fen(10), dailyLimitFen: fen(5),
      monthlyLimitFen: fen(50) } })).rejects.toThrow("grant_limits_invalid");
    await expect(createSpendGrant(noDb, { ...base, validUntil: base.validFrom })).rejects.toThrow("grant_input_invalid");
  });
  it("requires limits exactly for set_limits and refuses unknown actions", async () => {
    const change = { actorUserId: "u1", grantId: "g1", expectedVersion: 1, evidenceRef: "consent:2" };
    const changeSpendGrant = (_: unknown, input: Parameters<typeof changeSpendGrantInTransaction>[1]) =>
      changeSpendGrantInTransaction({} as Prisma.TransactionClient, input);
    await expect(changeSpendGrant(noDb, { ...change, action: "set_limits" })).rejects.toThrow("grant_input_invalid");
    await expect(changeSpendGrant(noDb, { ...change, action: "pause", limits: { perChargeLimitFen: fen(1),
      dailyLimitFen: fen(1), monthlyLimitFen: fen(1) } })).rejects.toThrow("grant_input_invalid");
    await expect(changeSpendGrant(noDb, { ...change, action: "toString" as never })).rejects.toThrow("grant_transition_invalid");
  });
});
