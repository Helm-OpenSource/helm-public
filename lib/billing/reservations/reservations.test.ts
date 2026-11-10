import type { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { SpendGrantRefusal } from "../grants/price-grants";
import { asBillingResult, markUnknownInTransaction, normalizeReserve, releaseInTransaction, type ReleaseReasonCode,
  reserveInTransaction, type ReserveRequest } from "./reservations";

const service = { type: "SYSTEM" as const, ref: "metering" };
const req = (extra: Partial<ReserveRequest> = {}): ReserveRequest => ({ idempotencyKey: "idem:0001", operationRef: "op:bill/1",
  payerRef: "payer-1", grantId: "grant-1", priceVersionId: "pv-1", billingEventRef: "service-billing-event-v1:bill_parsed",
  meterUnit: "document", quantity: "2", ...extra });
const noDb = {} as Prisma.TransactionClient; // input refusals must happen before any database call
const invalid = { ok: false, code: "request_invalid" };

describe("reservation protocol normalization", () => {
  it("binds the hash to every caller choice but not to the key or the actor", () => {
    const base = normalizeReserve(service, req());
    expect(base).toMatchObject({ createdBy: "SYSTEM:metering", quantity: BigInt(2) });
    expect(base.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(normalizeReserve({ type: "SYSTEM", ref: "other" }, req({ idempotencyKey: "idem:0002" })).contentHash).toBe(base.contentHash);
    for (const changed of [{ quantity: "3" }, { grantId: "grant-2" }, { priceVersionId: "pv-2" }, { operationRef: "op:bill/2" },
      { billingEventRef: "event:other" }, { meterUnit: "page" }, { payerRef: "payer-2" }]) {
      expect(normalizeReserve(service, req(changed)).contentHash).not.toBe(base.contentHash);
    }
  });
  it("refuses user actors, non-canonical quantities and malformed references before the database", async () => {
    for (const bad of [{ quantity: "0" }, { quantity: "02" }, { quantity: "-1" }, { quantity: "1.5" }, { quantity: 2 },
      { quantity: "9007199254740992" }, { idempotencyKey: "" }, { idempotencyKey: "short:1" }, { idempotencyKey: "idem/0001" }, { payerRef: "a b" }, { meterUnit: "Document" }]) {
      await expect(asBillingResult(reserveInTransaction(noDb, service, req(bad as Partial<ReserveRequest>)))).resolves.toEqual(invalid);
    }
    await expect(asBillingResult(reserveInTransaction(noDb, { type: "USER", ref: "u1" } as never, req()))).resolves.toEqual(invalid);
    const release = { idempotencyKey: "rel:0001", reservationId: "r1", operationRef: "op:1", reasonCode: "failed" as ReleaseReasonCode, evidenceRef: "claim:1" };
    await expect(asBillingResult(releaseInTransaction(noDb, service, { ...release, reasonCode: "timeout" as ReleaseReasonCode }))).resolves.toEqual(invalid);
    await expect(asBillingResult(releaseInTransaction(noDb, service, { ...release, evidenceRef: "" }))).resolves.toEqual(invalid);
    await expect(asBillingResult(markUnknownInTransaction(noDb, service, { idempotencyKey: "unk:0001", reservationId: "r1", operationRef: "op:1",
      evidenceRef: " " }))).resolves.toEqual(invalid);
  });
  it("maps gate refusals to protocol codes and lets unexpected errors propagate", async () => {
    const fail = (error: Error) => asBillingResult(Promise.reject(error));
    await expect(fail(new SpendGrantRefusal("grant_daily_limit_exceeded"))).resolves.toEqual({ ok: false, code: "limit_exceeded" });
    await expect(fail(new SpendGrantRefusal("payer_billing_off"))).resolves.toEqual({ ok: false, code: "billing_mode_off" });
    await expect(fail(new SpendGrantRefusal("grant_outside_validity"))).resolves.toEqual({ ok: false, code: "grant_not_active" });
    await expect(fail(new Error("reservation_invariant_breach"))).rejects.toThrow("reservation_invariant_breach");
  });
});
