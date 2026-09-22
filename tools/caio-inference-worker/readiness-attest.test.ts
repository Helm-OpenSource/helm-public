import { chmodSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  CAIO_INFERENCE_READINESS_CHALLENGE_SCHEMA,
  CAIO_INFERENCE_TRANSPORT_READINESS_SCHEMA,
  createCaioInferenceTransportReadinessReceipt,
  parseCaioInferenceReadinessChallenge,
  verifyCaioInferenceTransportReadinessReceipt,
  writeCaioInferenceTransportReadinessReceipt,
} from "./readiness-attest";
import { createCaioWorkerPkiFixture, removeCaioWorkerPkiFixture, type CaioWorkerPkiFixture } from "./pki-fixture";

const roots: string[] = [];
let pki: CaioWorkerPkiFixture | null = null;

afterEach(async () => {
  removeCaioWorkerPkiFixture(pki);
  pki = null;
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function challenge(now: Date) {
  return {
    schemaVersion: CAIO_INFERENCE_READINESS_CHALLENGE_SCHEMA,
    challengeId: "a".repeat(64),
    issuedAt: new Date(now.getTime() - 1_000).toISOString(),
    expiresAt: new Date(now.getTime() + 5 * 60_000).toISOString(),
    candidate: {
      runtimeDeploymentId: `anson-src-${"b".repeat(64)}`,
      buildRef: "c".repeat(40),
      gatewayEntrypointSha256: `sha256:${"d".repeat(64)}`,
      runtimeEnvSha256: `sha256:${"e".repeat(64)}`,
    },
  } as const;
}

describe("CAIO inference transport readiness attestation", () => {
  it("binds a fresh candidate challenge to real probe observations and an ECDSA-SHA256 client signature", async () => {
    const now = new Date("2026-09-23T01:00:00.000Z");
    pki = createCaioWorkerPkiFixture();
    const parsed = parseCaioInferenceReadinessChallenge(challenge(now), now);
    const receipt = await createCaioInferenceTransportReadinessReceipt({
      challenge: parsed,
      clientCertificate: pki.clientCert,
      clientPrivateKey: pki.clientKey,
      modelId: "local-governed-model",
      modelProbe: async () => ({ ready: true }),
      gatewayProbe: async () => ({
        livezStatus: 200,
        readyzStatus: 200,
        workBuddyStatus: 404,
        privateExecutionStatus: 404,
        missingClientCertificateRejected: true,
        serverCertificateFingerprint: `sha256:${"f".repeat(64)}`,
      }),
      now: () => now,
    });

    expect(receipt).toMatchObject({
      schemaVersion: CAIO_INFERENCE_TRANSPORT_READINESS_SCHEMA,
      challengeId: parsed.challengeId,
      candidate: parsed.candidate,
      model: { modelId: "local-governed-model", probeStatus: "ready" },
      gateway: {
        livezStatus: 200,
        readyzStatus: 200,
        workBuddyStatus: 404,
        privateExecutionStatus: 404,
        missingClientCertificateRejected: true,
      },
      issuer: {
        kind: "caio_inference_worker_mtls_client",
      },
      attestor: { signatureAlgorithm: "ecdsa-sha256", signatureEncoding: "der-base64" },
      businessDataIncluded: false,
      piiIncluded: false,
      secretsIncluded: false,
    });
    expect(verifyCaioInferenceTransportReadinessReceipt(receipt, pki.clientCert)).toBe(true);
    expect(verifyCaioInferenceTransportReadinessReceipt({
      ...receipt,
      model: { ...receipt.model, modelId: "tampered-model" },
    }, pki.clientCert)).toBe(false);
    expect(JSON.stringify(receipt)).not.toContain("PRIVATE KEY");
  });

  it("rejects stale, long-lived, unknown-key challenges and failed readiness evidence", async () => {
    const now = new Date("2026-09-23T01:00:00.000Z");
    const valid = challenge(now);
    expect(() => parseCaioInferenceReadinessChallenge({ ...valid, surprise: true }, now)).toThrow(/challenge_invalid/u);
    expect(() => parseCaioInferenceReadinessChallenge({ ...valid, expiresAt: new Date(now.getTime() + 16 * 60_000).toISOString() }, now)).toThrow(/challenge_invalid/u);
    expect(() => parseCaioInferenceReadinessChallenge({ ...valid, expiresAt: new Date(now.getTime() - 1).toISOString() }, now)).toThrow(/challenge_invalid/u);

    pki = createCaioWorkerPkiFixture();
    await expect(createCaioInferenceTransportReadinessReceipt({
      challenge: parseCaioInferenceReadinessChallenge(valid, now),
      clientCertificate: pki.clientCert,
      clientPrivateKey: pki.clientKey,
      modelId: "local-governed-model",
      modelProbe: async () => ({ ready: false, detail: "model_not_loaded" }),
      gatewayProbe: async () => ({
        livezStatus: 200, readyzStatus: 200, workBuddyStatus: 404, privateExecutionStatus: 404,
        missingClientCertificateRejected: true,
        serverCertificateFingerprint: `sha256:${"f".repeat(64)}`,
      }),
      now: () => now,
    })).rejects.toThrow(/local_model_not_ready/u);

    await expect(createCaioInferenceTransportReadinessReceipt({
      challenge: parseCaioInferenceReadinessChallenge(valid, now),
      clientCertificate: pki.clientCert,
      clientPrivateKey: pki.clientKey,
      modelId: "local-governed-model",
      modelProbe: async () => ({ ready: true }),
      gatewayProbe: async () => ({
        livezStatus: 200, readyzStatus: 200, workBuddyStatus: 403, privateExecutionStatus: 404,
        missingClientCertificateRejected: false,
        serverCertificateFingerprint: `sha256:${"f".repeat(64)}`,
      }),
      now: () => now,
    })).rejects.toThrow(/gateway_not_ready/u);
  });

  it("writes once with 0600 and refuses overwrite without exposing secret inputs", async () => {
    const now = new Date("2026-09-23T01:00:00.000Z");
    pki = createCaioWorkerPkiFixture();
    const root = realpathSync(await mkdtemp(join(tmpdir(), "caio-ready-receipt-")));
    roots.push(root);
    chmodSync(root, 0o700);
    const output = join(root, "transport-readiness.json");
    const receipt = await createCaioInferenceTransportReadinessReceipt({
      challenge: parseCaioInferenceReadinessChallenge(challenge(now), now),
      clientCertificate: pki.clientCert,
      clientPrivateKey: pki.clientKey,
      modelId: "local-governed-model",
      modelProbe: async () => ({ ready: true }),
      gatewayProbe: async () => ({
        livezStatus: 200, readyzStatus: 200, workBuddyStatus: 404, privateExecutionStatus: 404,
        missingClientCertificateRejected: true,
        serverCertificateFingerprint: `sha256:${"f".repeat(64)}`,
      }),
      now: () => now,
    });
    const result = writeCaioInferenceTransportReadinessReceipt({ privateRoot: root, outputPath: output, receipt });
    expect(statSync(output).mode & 0o777).toBe(0o600);
    expect(JSON.parse(readFileSync(output, "utf8"))).toEqual(receipt);
    expect(result.receiptSha256).toMatch(/^sha256:[a-f0-9]{64}$/u);
    expect(() => writeCaioInferenceTransportReadinessReceipt({ privateRoot: root, outputPath: output, receipt })).toThrow(/output_exists/u);

    writeFileSync(join(root, "loose"), "x", { mode: 0o644 });
    expect(readFileSync(output, "utf8")).not.toContain("PRIVATE KEY");
  });
});
