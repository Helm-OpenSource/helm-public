import { execFileSync } from "node:child_process";
import { generateKeyPairSync, type KeyObject, randomBytes, randomUUID } from "node:crypto";
import { lstatSync, mkdtempSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { authenticateBillingService, signBillingInternalRequest } from "./service-auth";
import { buildBillingServiceGrant, issueBillingServiceGrant } from "./service-grant-issuance";

const url = process.env.BILLING_MYSQL_DATABASE_URL;
if (process.env.BILLING_MYSQL_REQUIRED === "1" && !url) throw new Error("isolated_billing_database_required");

function assertIsolatedTarget(raw: string) {
  const parsed = new URL(raw);
  const socket = parsed.searchParams.get("socket");
  if (socket) {
    if (!/^\/private\/tmp\/helm-billing-mysql\.[A-Za-z0-9]+\/db\.sock$/.test(socket)) throw new Error("synthetic_socket_path_invalid");
    const file = lstatSync(socket), directory = statSync(dirname(socket));
    if (!file.isSocket() || file.uid !== process.getuid?.() || directory.uid !== process.getuid?.() ||
        (directory.mode & 0o077) !== 0 || realpathSync(socket) !== socket) throw new Error("synthetic_socket_identity_invalid");
    return join(dirname(socket), "data");
  }
  if (process.env.GITHUB_ACTIONS !== "true" || !/^[a-f0-9]{12,64}$/.test(process.env.BILLING_MYSQL_CI_CONTAINER ?? "") ||
      parsed.protocol !== "mysql:" || parsed.hostname !== "127.0.0.1" || parsed.port !== "3306" ||
      parsed.pathname !== "/helm_caio_p1d_ci") throw new Error("ephemeral_ci_target_invalid");
  return null;
}

describe.skipIf(!url)("BillingServiceGrant issuance CLI against MySQL", () => {
  if (!url) { it.skip("requires an explicit synthetic target", () => {}); return; }
  const run = randomUUID().replaceAll("-", "").slice(0, 12);
  const grantId = `e1c-${run}`;
  // The private half stays in this process; only the public PEM is written for the CLI to read.
  const pair = generateKeyPairSync("ed25519");
  const dir = mkdtempSync(join(tmpdir(), "e1c-")), keyFile = join(dir, "public.pem");
  writeFileSync(keyFile, pair.publicKey.export({ type: "spki", format: "pem" }));
  let a: PrismaClient;
  const issueArgs = ["issue", `--grant-id=${grantId}`, "--issuer=synthetic-e1c", "--scopes=reserve,balance-status,quote",
    `--public-key-file=${keyFile}`, "--approval-ref=approval:synthetic", "--created-by=operator:synthetic",
    `--valid-from=${new Date(Date.now() - 3_600_000).toISOString()}`, `--valid-until=${new Date(Date.now() + 86_400_000).toISOString()}`];
  const cli = (args: string[]) => JSON.parse(execFileSync(process.execPath, ["--import", "tsx", "--import",
    "./scripts/node-hooks/allow-server-only.mjs", "scripts/billing-service-grant.ts", ...args],
  { encoding: "utf8", env: { ...process.env, DATABASE_URL: url }, timeout: 60_000 }));
  const authenticate = (pins: Record<string, string>, key: KeyObject = pair.privateKey) => {
    const path = "/api/internal/billing/v1/quote", timestamp = String(Date.now()), nonce = randomBytes(16).toString("base64url");
    const body = Buffer.from("{}");
    const signature = signBillingInternalRequest(key, { method: "POST", path, grantId, timestamp, nonce, body });
    const headers = new Headers({ "x-helm-billing-grant": grantId, "x-helm-billing-timestamp": timestamp,
      "x-helm-billing-nonce": nonce, "x-helm-billing-signature": signature });
    return authenticateBillingService(a, { method: "POST", path, headers, body }, "quote",
      { HELM_BILLING_SERVICE_GRANT_PINS: JSON.stringify(pins) });
  };
  const reason = (promise: Promise<unknown>) => promise.then(() => "ok", (error: { reason?: string }) => error.reason);
  let pin: Record<string, string> = {};

  beforeAll(async () => {
    const datadir = assertIsolatedTarget(url);
    a = new PrismaClient({ datasources: { db: { url } } });
    if (datadir) {
      const [server] = await a.$queryRaw<Array<{ offline: bigint; directory: string }>>`SELECT @@skip_networking AS offline, @@datadir AS directory`;
      if (Number(server?.offline) !== 1 || realpathSync(server.directory) !== realpathSync(datadir)) throw new Error("synthetic_server_identity_invalid");
    }
  });
  afterAll(async () => { rmSync(dir, { recursive: true, force: true }); await a?.$disconnect(); });

  it("dry run writes nothing; the applied row carries the dry-run pin and authenticates with it", async () => {
    const dry = cli(issueArgs);
    expect(dry).toMatchObject({ operation: "issue", applied: false });
    expect(await a.billingServiceGrant.count({ where: { id: grantId } })).toBe(0);
    const applied = cli([...issueArgs, "--apply"]);
    expect(applied).toMatchObject({ applied: true, alreadyIssued: false, contentHash: dry.contentHash, pin: dry.pin });
    pin = applied.pin;
    expect(await a.billingServiceGrant.findUnique({ where: { id: grantId } })).toMatchObject({ contentHash: dry.contentHash,
      scopesJson: '["balance-status","quote","reserve"]', revokedAt: null });
    expect(await authenticate(pin)).toEqual({ grantId, actor: { type: "SYSTEM", ref: `billing-service:synthetic-e1c/${grantId}` } });
  });

  it("a pin differing in one character, or a different signing key, is refused", async () => {
    const hash = pin[grantId], last = hash.at(-1) === "0" ? "1" : "0";
    expect(await reason(authenticate({ [grantId]: hash.slice(0, -1) + last }))).toBe("grant_untrusted");
    expect(await reason(authenticate(pin, generateKeyPairSync("ed25519").privateKey))).toBe("signature_invalid");
  });

  it("re-running the issuance replays; the same key under another id conflicts", async () => {
    expect(cli([...issueArgs, "--apply"])).toMatchObject({ applied: false, alreadyIssued: true, revoked: false });
    const other = buildBillingServiceGrant({ grantId: `e1c-b-${run}`, issuerRef: "synthetic-e1c", scopes: ["quote"],
      publicKeyText: pair.publicKey.export({ type: "spki", format: "pem" }).toString(), approvalRef: "approval:synthetic",
      createdBy: "operator:synthetic", validFrom: "2026-11-12T00:00:00.000Z", validUntil: "2027-11-12T00:00:00.000Z" });
    await expect(issueBillingServiceGrant(a, other.row)).rejects.toMatchObject({ code: "grant_conflict" });
    // same id, different content (new key, other scopes): never a silent replay
    const changed = buildBillingServiceGrant({ grantId, issuerRef: "synthetic-e1c", scopes: ["quote"],
      publicKeyText: generateKeyPairSync("ed25519").publicKey.export({ type: "spki", format: "pem" }).toString(),
      approvalRef: "approval:synthetic", createdBy: "operator:synthetic", validFrom: "2026-11-12T00:00:00.000Z",
      validUntil: "2027-11-12T00:00:00.000Z" });
    await expect(issueBillingServiceGrant(a, changed.row)).rejects.toMatchObject({ code: "grant_conflict" });
  });

  it("revocation is one-way with database time and the pinned grant is then refused", async () => {
    const revoke = ["revoke", `--grant-id=${grantId}`, "--revoked-by=operator:synthetic"];
    expect(cli(revoke)).toMatchObject({ applied: false, alreadyRevoked: false, revokedAt: null });
    expect(await authenticate(pin)).toMatchObject({ grantId });
    const done = cli([...revoke, "--apply"]);
    expect(done).toMatchObject({ applied: true, alreadyRevoked: false, revokedBy: "operator:synthetic" });
    expect(typeof done.revokedAt).toBe("string");
    expect(await reason(authenticate(pin))).toBe("grant_inactive");
    expect(cli([...revoke, "--apply"])).toMatchObject({ applied: false, alreadyRevoked: true, revokedAt: done.revokedAt });
    expect(cli([...issueArgs, "--apply"])).toMatchObject({ alreadyIssued: true, revoked: true });
  });
});
