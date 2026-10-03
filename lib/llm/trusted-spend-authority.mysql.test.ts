import { generateKeyPairSync, randomUUID, sign } from "node:crypto";
import { lstatSync, statSync } from "node:fs";
import { dirname, isAbsolute } from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { createPrismaSpendReservationStore, reserveSpendInTransaction } from "./spend-reservation-prisma-store";
import { authorityHash, canonicalAuthorityJson } from "./trusted-spend-authority";
import { createRegisteredGovernedSpendAuthority, issuerGrantHash, reserveTrustedSpendInTransaction,
  resolveTrustedSpendInTransaction } from "./trusted-spend-authority-prisma";

const url = process.env.TRUSTED_SPEND_MYSQL_URL;
if (process.env.TRUSTED_SPEND_MYSQL_REQUIRED === "1" && !url) throw new Error("synthetic_registry_database_required");
describe.skipIf(!url)("protected signed registry same-transaction MySQL", () => {
  if (!url) { it.skip("requires explicit owned network-disabled socket", () => {}); return; }
  const parsed = new URL(url), socket = parsed.searchParams.get("socket"), database = parsed.pathname.slice(1);
  const ownedSocket=parsed.hostname==="localhost" && !!socket && isAbsolute(socket) && lstatSync(socket).isSocket() &&
    statSync(dirname(socket)).uid===process.getuid?.() && (statSync(dirname(socket)).mode & 0o077)===0 && /^helm_c4_budget_[0-9]+$/u.test(database);
  const ownedCi=process.env.GITHUB_ACTIONS==="true" && process.env.HELM_CI_MYSQL_DATABASE==="helm_caio_p1d_ci" &&
    parsed.hostname==="127.0.0.1" && parsed.port==="3306" && database==="helm_caio_p1d_ci" && !socket &&
    /^[a-f0-9]{64}$/u.test(process.env.TRUSTED_SPEND_MYSQL_CI_CONTAINER??"");
  if(parsed.protocol!=="mysql:" || database!==process.env.TRUSTED_SPEND_MYSQL_DATABASE || (!ownedSocket&&!ownedCi)) throw new Error("synthetic_registry_target_invalid");
  const a = new PrismaClient({ datasources: { db: { url } } });
  const b = new PrismaClient({ datasources: { db: { url } } });
  const runtimeUrl = new URL(process.env.MODEL_EGRESS_RUNTIME_DATABASE_URL ?? url);
  if(!process.env.MODEL_EGRESS_RUNTIME_DATABASE_URL) runtimeUrl.username="c4_runtime";
  if(runtimeUrl.hostname!==parsed.hostname || runtimeUrl.port!==parsed.port || runtimeUrl.pathname!==parsed.pathname || runtimeUrl.search!==parsed.search || runtimeUrl.username===parsed.username) throw new Error("synthetic_registry_runtime_target_invalid");
  const runtime = new PrismaClient({ datasources: { db: { url: runtimeUrl.toString() } } });
  afterAll(async () => { await Promise.all([a.$disconnect(), b.$disconnect(), runtime.$disconnect()]); });
  const keys = generateKeyPairSync("ed25519");
  async function fixture(options: { limit?: string; currency?: "USD" | "CNY"; expires?: boolean; validForMs?: number; changeEnvelope?: (kind: string, envelope: Record<string, unknown>) => Record<string, unknown>; wrongSigner?: boolean } = {}) {
    const id = `synthetic-${randomUUID()}`, owner = `owner-${randomUUID()}`, grantId = `issuer:${randomUUID()}`;
    const now = new Date(), before = new Date(now.getTime() - 60_000), after = new Date(now.getTime() + (options.validForMs ?? 3_600_000));
    const grant = { id: grantId, workspaceId: id, issuerUserId: owner,
      publicKeyPem: keys.publicKey.export({ type: "spki", format: "pem" }).toString(),
      allowedKindsJson: canonicalAuthorityJson(["budget", "period", "price", "fx"]), sourceReceiptHash: `sha256:${"a".repeat(64)}`,
      validFrom: before, validUntil: options.expires ? before : after, revokedAt: null, contentHash: "" };
    // Expired authority is represented by records, so grant schema's from<until still holds.
    grant.validUntil = after; grant.contentHash = issuerGrantHash(grant);
    await a.$executeRaw`INSERT INTO User (id,email,name,updatedAt) VALUES (${owner},${owner+"@example.test"},'Synthetic registry owner',${now})`;
    await a.$executeRaw`INSERT INTO LLMSpendIssuerGrant
      (id,workspaceId,issuerUserId,publicKeyPem,allowedKindsJson,sourceReceiptHash,contentHash,validFrom,validUntil)
      VALUES (${grantId},${id},${owner},${grant.publicKeyPem},${grant.allowedKindsJson},${grant.sourceReceiptHash},${grant.contentHash},${before},${after})`;
    const issue = async (kind: string, ref: string, version: string, payload: unknown) => {
      let envelope: Record<string, unknown> = { schema: "helm.spend-authority/v1", workspaceId: id, ref, kind, version, issuerGrantId: grantId,
        approverId: owner, status: "approved", sourceReceiptHash: `sha256:${"b".repeat(64)}`, issuedAt: before.toISOString(), validFrom: before.toISOString(),
        validUntil: (options.expires ? new Date(now.getTime() - 1) : after).toISOString(), payload };
      envelope = options.changeEnvelope?.(kind, envelope) ?? envelope;
      const json = canonicalAuthorityJson(envelope), hash = authorityHash(envelope), signature = sign(null, Buffer.from(json), options.wrongSigner ? generateKeyPairSync("ed25519").privateKey : keys.privateKey).toString("base64");
      await a.$executeRaw`INSERT INTO LLMSpendAuthorityRecord
       (id,workspaceId,ref,kind,version,issuerGrantId,envelopeJson,signatureBase64,contentHash)
       VALUES (${randomUUID()},${id},${ref},${kind},${version},${grantId},${json},${signature},${hash})`;
      return { ref, hash };
    };
    const period = await issue("period", "period:one", "v1", { algorithm: "calendar-month-v1", timezone: "Asia/Shanghai" });
    const price = await issue("price", "price:one", "price-v1", { billing: "input-output-only-v1", provider: "synthetic", model: "synthetic-model", sku: "text-only", currency: options.currency ?? "USD", input: { numerator: "2", denominator: "1", ceiling: "100" }, output: { numerator: "2", denominator: "1", ceiling: "50" } });
    const fx = options.currency === "CNY" ? await issue("fx", "fx:one", "fx-v1", { from: "CNY", to: "USD", numerator: "1", denominator: "7" }) : null;
    const budget = await issue("budget", "approval:one", "budget-v1", { configVersion: 1, mode: "limited", limitMicros: options.limit ?? "100", currency: "USD", updatedBy: owner, updatedAt: now.toISOString(), periodRef: period.ref, periodHash: period.hash, priceRef: price.ref, priceHash: price.hash, fxRef: fx?.ref ?? null, fxHash: fx?.hash ?? null });
    await a.$executeRaw`INSERT INTO Workspace
      (id,name,slug,updatedAt,llmBudgetMode,llmMonthlyBudgetMicros,llmBudgetEnforcementMode,llmBudgetPeriodPolicyVersion,llmBudgetConfigVersion,
       llmBudgetApprovalRef,llmBudgetUpdatedBy,llmBudgetUpdatedAt,llmBudgetCurrency,llmBudgetPriceBookRef,llmBudgetFxPolicyRef)
      VALUES (${id},'Synthetic registry workspace',${id},${now},'limited',${BigInt(options.limit ?? "100")},'enforce','v1',1,${budget.ref},${owner},${now},'USD',${price.ref},${fx?.ref ?? null})`;
    await a.$executeRaw`INSERT INTO Membership (id,workspaceId,userId,role,status,updatedAt) VALUES (${randomUUID()},${id},${owner},'OWNER','ACTIVE',${now})`;
    const config = { expectedPeriodPolicyVersion: "v1", trustedIssuerGrants: { [grantId]: grant.contentHash } };
    const input = { workspaceId: id, operationRef: `operation:${randomUUID()}`, attemptRef: `attempt:${randomUUID()}`,
      provider: "synthetic", model: "synthetic-model", pricingVersion: "price-v1", maxInputTokens: 20,
      maxOutputTokens: 30, requestedMaxOutputTokens: 10, leaseMs: 30_000 };
    return { id, owner, grantId, config, input, issue };
  }
  it("joins actual protected readback with C2 reserve and refuses unregistered roots", async () => {
    const f = await fixture();
    await expect(a.$transaction((tx) => reserveTrustedSpendInTransaction(tx, f.input, { ...f.config, trustedIssuerGrants: {} }))).rejects.toThrow("issuer_untrusted");
    const result = await runtime.$transaction((tx) => reserveTrustedSpendInTransaction(tx, f.input, f.config));
    expect(result.admission).toBe("reserved"); expect(result.quote.maximumChargeMicros).toBe(BigInt(60));
    expect(result.providerAuthorized).toBe(false);
    const totals = await a.lLMSpendPeriodCounter.findFirstOrThrow({ where: { workspaceId: f.id } });
    expect(totals.reservedMicros).toBe(BigInt(60));
  });
  it("only one of two clients crosses budget; forced rollback preserves no ledger", async () => {
    const f = await fixture();
    const results = await Promise.allSettled([a,b].map((client) => client.$transaction((tx) => reserveTrustedSpendInTransaction(tx, { ...f.input, attemptRef: `attempt:${randomUUID()}` }, f.config))));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await a.lLMSpendLedgerEntry.count({ where: { workspaceId: f.id } })).toBe(1);
    const rollback = await fixture();
    await expect(a.$transaction(async (tx) => { await reserveTrustedSpendInTransaction(tx, rollback.input, rollback.config); throw new Error("synthetic_rollback"); })).rejects.toThrow("synthetic_rollback");
    expect(await a.lLMSpendLedgerEntry.count({ where: { workspaceId: rollback.id } })).toBe(0);
    expect(await a.lLMSpendPeriodCounter.count({ where: { workspaceId: rollback.id } })).toBe(0);
  });
  it("serializes Workspace changes and issuer revocation across separate clients", async () => {
    const f = await fixture(); let ready!: () => void, release!: () => void;
    const held = new Promise<void>((r) => { ready = r; }), barrier = new Promise<void>((r) => { release = r; });
    const reservation = a.$transaction(async (tx) => { await reserveTrustedSpendInTransaction(tx, f.input, f.config); ready(); await barrier; }, { timeout: 10_000 });
    await held; let changed = false;
    const update = b.$executeRaw`UPDATE Workspace SET llmBudgetConfigVersion=2 WHERE id=${f.id}`.then(() => { changed = true; });
    await new Promise((r) => setTimeout(r, 80)); expect(changed).toBe(false); release(); await reservation; await update;
    await expect(a.$transaction((tx) => resolveTrustedSpendInTransaction(tx, f.input, f.config))).rejects.toThrow("approval_config_mismatch");
    const revoke = await fixture();
    let ready2!: () => void, release2!: () => void;
    const held2 = new Promise<void>((r) => { ready2=r; }), barrier2 = new Promise<void>((r) => { release2=r; });
    const first = a.$transaction(async (tx) => { await resolveTrustedSpendInTransaction(tx,revoke.input,revoke.config); ready2(); await barrier2; }, {timeout:10_000});
    await held2; let revoked=false;
    const revoking=b.$executeRaw`UPDATE LLMSpendIssuerGrant SET revokedAt=UTC_TIMESTAMP(3) WHERE id=${revoke.grantId}`.then(()=>{revoked=true;});
    await new Promise((r)=>setTimeout(r,80));expect(revoked).toBe(false);release2();await first;await revoking;
    await expect(a.$transaction((tx)=>resolveTrustedSpendInTransaction(tx,revoke.input,revoke.config))).rejects.toThrow("issuer_untrusted");
  });
  it("consumes C3 port with restricted actual transaction and rejects caller-owned key pin", async () => {
    const f=await fixture(); const port=createRegisteredGovernedSpendAuthority(f.config);
    const request={workspaceId:f.id, decision:{decisionId:f.input.operationRef, workspaceRef:`workspace:${f.id}`, requestedMaxOutputTokens:10, routeSnapshot:{provider:"synthetic",modelId:"synthetic-model",pricingVersion:"price-v1",maxInputTokens:20,maxOutputTokens:30}}, runtime:{provider:"synthetic",modelId:"synthetic-model"}, now:new Date(), dispatchLeaseExpiresAt:new Date(Date.now()+60_000)};
    const quote=await runtime.$transaction((tx)=>port.resolveDispatch({...request,tx} as Parameters<typeof port.resolveDispatch>[0]));
    expect(quote.quote.maximumChargeMicros).toBe(BigInt(60));
    await expect(runtime.$transaction((tx)=>port.resolveDispatch({...request,tx,runtime:{provider:"forged",modelId:"synthetic-model"}} as Parameters<typeof port.resolveDispatch>[0]))).rejects.toThrow("dispatch_route_binding_invalid");
    await expect(runtime.$executeRaw`UPDATE LLMSpendIssuerGrant SET contentHash='forged' WHERE id=${f.grantId}`).rejects.toThrow();
  });
  it("refuses expired metadata, case aliases, wrong period and unauthenticated terminal", async () => {
    const expired=await fixture({expires:true});
    await expect(a.$transaction((tx)=>reserveTrustedSpendInTransaction(tx,expired.input,expired.config))).rejects.toThrow("authority_expired");
    const f=await fixture({currency:"CNY"});
    const result=await a.$transaction((tx)=>resolveTrustedSpendInTransaction(tx,f.input,f.config));expect(result.quote.maximumChargeMicros).toBe(BigInt(9));
    await expect(a.$transaction((tx)=>resolveTrustedSpendInTransaction(tx,{...f.input,workspaceId:f.id.toUpperCase()},f.config))).rejects.toThrow();
    await expect(a.$transaction((tx)=>resolveTrustedSpendInTransaction(tx,f.input,{...f.config,expectedPeriodPolicyVersion:"v2"}))).rejects.toThrow("budget_not_enforceable");
    const port=createRegisteredGovernedSpendAuthority(f.config);
    await expect(port.verifyTerminal({} as Parameters<typeof port.verifyTerminal>[0])).rejects.toThrow("trusted_usage_evidence_unavailable");
    expect(await a.lLMSpendLedgerEntry.count({where:{workspaceId:expired.id}})).toBe(0);
  });
  it("refuses self-signed unknown keys, signed wrong scope and unknown billable dimensions", async () => {
    for (const options of [
      {wrongSigner:true},
      {changeEnvelope:(kind:string,e:Record<string,unknown>)=>kind==="price"?{...e,workspaceId:"foreign-workspace"}:e},
      {changeEnvelope:(kind:string,e:Record<string,unknown>)=>kind==="price"?{...e,payload:{...(e.payload as Record<string,unknown>),reasoning:true}}:e},
      {changeEnvelope:(kind:string,e:Record<string,unknown>)=>kind==="budget"?{...e,status:"pending"}:e},
    ]) {
      const f=await fixture(options);
      await expect(runtime.$transaction((tx)=>reserveTrustedSpendInTransaction(tx,f.input,f.config))).rejects.toThrow();
      expect(await a.lLMSpendLedgerEntry.count({where:{workspaceId:f.id}})).toBe(0);
    }
  });
  it("uses fresh DB time after a blocking Workspace lock, never stale admission time", async () => {
    const f=await fixture({validForMs:220});let unlock!:()=>void,ready!:()=>void;
    const barrier=new Promise<void>((r)=>{unlock=r;}),held=new Promise<void>((r)=>{ready=r;});
    const lock=b.$transaction(async(tx)=>{await tx.$queryRaw`SELECT id FROM Workspace WHERE id=${f.id} FOR UPDATE`;ready();await barrier;},{timeout:10_000});
    await held;
    const waiting=runtime.$transaction((tx)=>reserveTrustedSpendInTransaction(tx,{...f.input,leaseMs:1},f.config));
    // Attach rejection immediately; expiry is expected after the DB wait.
    const refused=expect(waiting).rejects.toThrow("authority_expired_or_future");
    await new Promise((r)=>setTimeout(r,320));unlock();await lock;await refused;
    expect(await a.lLMSpendLedgerEntry.count({where:{workspaceId:f.id}})).toBe(0);
  });
  it("refuses an explicit dispatch deadline beyond the signed validity and never defaults a missing C3 deadline", async () => {
    const f=await fixture({validForMs:90_000});
    await expect(runtime.$transaction((tx)=>resolveTrustedSpendInTransaction(tx,{...f.input,dispatchLeaseExpiresAt:new Date(Date.now()+120_000)},f.config))).rejects.toThrow("authority_expired_or_future");
    const port=createRegisteredGovernedSpendAuthority(f.config);
    const req={workspaceId:f.id,decision:{workspaceRef:`workspace:${f.id}`,routeSnapshot:{}},runtime:{}};
    await expect(runtime.$transaction((tx)=>port.resolveDispatch({...req,tx} as Parameters<typeof port.resolveDispatch>[0]))).rejects.toThrow("dispatch_deadline_missing");
  });

  it("preserves a historical ledger month for known and unknown C2 terminal primitives", async () => {
    const f=await fixture(); const resolved=await runtime.$transaction((tx)=>resolveTrustedSpendInTransaction(tx,f.input,f.config));
    // Historical synthetic seed represents an ALREADY reserved attempt. It is
    // not a fresh C4 admission and supplies no provider usage authentication.
    const oldPeriod="2025-12";
    await runtime.$transaction((tx)=>reserveSpendInTransaction(tx,{...resolved.reservation,periodKey:oldPeriod}));
    const second=`attempt:${randomUUID()}`;
    await runtime.$transaction((tx)=>reserveSpendInTransaction(tx,{...resolved.reservation,attemptRef:second,maximumChargeMicros:BigInt(30),periodKey:oldPeriod} as typeof resolved.reservation));
    await a.$executeRaw`UPDATE Workspace SET llmBudgetPeriodPolicyVersion='future-v2', llmBudgetConfigVersion=2 WHERE id=${f.id}`;
    const store=createPrismaSpendReservationStore(runtime);
    expect(await store.markUnknown({workspaceId:f.id,attemptRef:f.input.attemptRef})).toBe("unknown");
    expect(await store.settle({workspaceId:f.id,attemptRef:second,settledMicros:BigInt(20)})).toBe("settled");
    const row=await a.lLMSpendPeriodCounter.findFirstOrThrow({where:{workspaceId:f.id,periodKey:oldPeriod}});
    expect(row.unknownBoundMicros).toBe(BigInt(60));expect(row.settledMicros).toBe(BigInt(20));
    expect(await a.lLMSpendPeriodCounter.count({where:{workspaceId:f.id,periodKey:resolved.periodKey}})).toBe(0);
  });
  it("database timeout does not leak a reservation or authorize a retry", async () => {
    const f=await fixture();let unlock!:()=>void,ready!:()=>void;
    const gate=new Promise<void>((r)=>{unlock=r;}),held=new Promise<void>((r)=>{ready=r;});
    const lock=b.$transaction(async(tx)=>{await tx.$queryRaw`SELECT id FROM Workspace WHERE id=${f.id} FOR UPDATE`;ready();await gate;},{timeout:10_000});
    await held;
    const refused=expect(runtime.$transaction((tx)=>reserveTrustedSpendInTransaction(tx,f.input,f.config),{timeout:70})).rejects.toThrow();
    await new Promise((r)=>setTimeout(r,140));unlock();await lock;await refused;
    expect(await a.lLMSpendLedgerEntry.count({where:{workspaceId:f.id}})).toBe(0);
    expect(await a.lLMSpendPeriodCounter.count({where:{workspaceId:f.id}})).toBe(0);
  });

  it("immutability and one-way revoke apply even to governance SQL writer", async () => {
    const f=await fixture();
    await expect(a.$executeRaw`UPDATE LLMSpendIssuerGrant SET publicKeyPem='forged' WHERE id=${f.grantId}`).rejects.toThrow();
    await expect(a.$executeRaw`UPDATE LLMSpendAuthorityRecord SET envelopeJson='{}' WHERE workspaceId=${f.id}`).rejects.toThrow();
    await a.$executeRaw`UPDATE LLMSpendAuthorityRecord SET revokedAt=UTC_TIMESTAMP(3) WHERE workspaceId=${f.id} AND ref='price:one'`;
    await expect(a.$executeRaw`UPDATE LLMSpendAuthorityRecord SET revokedAt=NULL WHERE workspaceId=${f.id}`).rejects.toThrow();
    await expect(a.$transaction((tx)=>resolveTrustedSpendInTransaction(tx,f.input,f.config))).rejects.toThrow("record_missing_or_revoked");
  });
});
