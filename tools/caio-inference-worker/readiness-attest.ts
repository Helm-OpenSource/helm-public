import {
  X509Certificate,
  createHash,
  createPrivateKey,
  sign,
  verify,
} from "node:crypto";
import {
  closeSync,
  constants,
  fchmodSync,
  fsyncSync,
  fstatSync,
  lstatSync,
  openSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";

import { z } from "zod";

import type { CaioWorkerGatewayReadinessObservation } from "./gateway-client";

export const CAIO_INFERENCE_READINESS_CHALLENGE_SCHEMA =
  "anson.caio-inference-readiness-challenge.v1" as const;
export const CAIO_INFERENCE_TRANSPORT_READINESS_SCHEMA =
  "anson.caio-inference-transport-readiness.v1" as const;

const HASH = /^sha256:[a-f0-9]{64}$/u;
const MAX_CHALLENGE_LIFETIME_MS = 15 * 60_000;
const CLOCK_SKEW_MS = 30_000;

const challengeSchema = z.object({
  schemaVersion: z.literal(CAIO_INFERENCE_READINESS_CHALLENGE_SCHEMA),
  challengeId: z.string().regex(/^[a-f0-9]{64}$/u),
  issuedAt: z.string().datetime({ offset: true }),
  expiresAt: z.string().datetime({ offset: true }),
  candidate: z.object({
    runtimeDeploymentId: z.string().regex(/^anson-src-[a-f0-9]{64}$/u),
    buildRef: z.string().regex(/^[a-f0-9]{40}$/u),
    gatewayEntrypointSha256: z.string().regex(HASH),
    runtimeEnvSha256: z.string().regex(HASH),
  }).strict(),
}).strict();

export type CaioInferenceReadinessChallenge = Readonly<z.infer<typeof challengeSchema>>;

type ReceiptPayload = Readonly<{
  schemaVersion: typeof CAIO_INFERENCE_TRANSPORT_READINESS_SCHEMA;
  challengeId: string;
  checkedAt: string;
  expiresAt: string;
  candidate: CaioInferenceReadinessChallenge["candidate"];
  gateway: CaioWorkerGatewayReadinessObservation;
  issuer: Readonly<{
    kind: "caio_inference_worker_mtls_client";
    clientCertificateFingerprint: `sha256:${string}`;
  }>;
  model: Readonly<{ modelId: string; probeStatus: "ready" }>;
  businessDataIncluded: false;
  piiIncluded: false;
  secretsIncluded: false;
}>;

export type CaioInferenceTransportReadinessReceipt = ReceiptPayload & Readonly<{
  attestor: Readonly<{
    signatureAlgorithm: "ecdsa-sha256";
    signatureEncoding: "der-base64";
    signedPayloadSha256: `sha256:${string}`;
    signature: string;
  }>;
}>;

export function parseCaioInferenceReadinessChallenge(
  value: unknown,
  now = new Date(),
): CaioInferenceReadinessChallenge {
  const parsed = challengeSchema.safeParse(value);
  if (!parsed.success) throw new Error("caio_inference_readiness_challenge_invalid");
  const issuedAt = Date.parse(parsed.data.issuedAt);
  const expiresAt = Date.parse(parsed.data.expiresAt);
  if (
    expiresAt <= now.getTime() ||
    issuedAt > now.getTime() + CLOCK_SKEW_MS ||
    expiresAt <= issuedAt ||
    expiresAt - issuedAt > MAX_CHALLENGE_LIFETIME_MS
  ) {
    throw new Error("caio_inference_readiness_challenge_invalid");
  }
  return Object.freeze(parsed.data);
}

export async function createCaioInferenceTransportReadinessReceipt(input: Readonly<{
  challenge: CaioInferenceReadinessChallenge;
  clientCertificate: string | Buffer;
  clientPrivateKey: string | Buffer;
  modelId: string;
  modelProbe: () => Promise<{ ready: boolean; detail?: string }>;
  gatewayProbe: () => Promise<CaioWorkerGatewayReadinessObservation>;
  now?: () => Date;
}>): Promise<CaioInferenceTransportReadinessReceipt> {
  const checkedAt = (input.now ?? (() => new Date()))();
  const challenge = parseCaioInferenceReadinessChallenge(input.challenge, checkedAt);
  if (!input.modelId || input.modelId.length > 200) {
    throw new Error("caio_inference_readiness_model_invalid");
  }
  const [model, gateway] = await Promise.all([input.modelProbe(), input.gatewayProbe()]);
  if (!model.ready) throw new Error("caio_inference_readiness_local_model_not_ready");
  if (
    gateway.livezStatus !== 200 ||
    gateway.readyzStatus !== 200 ||
    gateway.workBuddyStatus !== 404 ||
    gateway.privateExecutionStatus !== 404 ||
    gateway.missingClientCertificateRejected !== true ||
    !HASH.test(gateway.serverCertificateFingerprint)
  ) {
    throw new Error("caio_inference_readiness_gateway_not_ready");
  }

  const privateKey = createPrivateKey(input.clientPrivateKey);
  if (privateKey.asymmetricKeyType !== "ec") {
    throw new Error("caio_inference_readiness_signing_key_not_ecdsa");
  }
  const certificate = new X509Certificate(input.clientCertificate);
  const payload: ReceiptPayload = {
    schemaVersion: CAIO_INFERENCE_TRANSPORT_READINESS_SCHEMA,
    challengeId: challenge.challengeId,
    checkedAt: checkedAt.toISOString(),
    expiresAt: challenge.expiresAt,
    candidate: challenge.candidate,
    gateway,
    issuer: {
      kind: "caio_inference_worker_mtls_client",
      clientCertificateFingerprint: certificateFingerprint(certificate),
    },
    model: { modelId: input.modelId, probeStatus: "ready" },
    businessDataIncluded: false,
    piiIncluded: false,
    secretsIncluded: false,
  };
  const bytes = Buffer.from(canonicalJson(payload), "utf8");
  const signature = sign("sha256", bytes, privateKey);
  if (!verify("sha256", bytes, certificate.publicKey, signature)) {
    throw new Error("caio_inference_readiness_key_certificate_mismatch");
  }
  return Object.freeze({
    ...payload,
    attestor: {
      signatureAlgorithm: "ecdsa-sha256" as const,
      signatureEncoding: "der-base64" as const,
      signedPayloadSha256: digest(bytes),
      signature: signature.toString("base64"),
    },
  });
}

export function verifyCaioInferenceTransportReadinessReceipt(
  receipt: CaioInferenceTransportReadinessReceipt,
  clientCertificate: string | Buffer,
): boolean {
  const { attestor, ...payload } = receipt;
  const bytes = Buffer.from(canonicalJson(payload), "utf8");
  if (attestor.signedPayloadSha256 !== digest(bytes)) return false;
  const certificate = new X509Certificate(clientCertificate);
  if (payload.issuer.clientCertificateFingerprint !== certificateFingerprint(certificate)) return false;
  return verify("sha256", bytes, certificate.publicKey, Buffer.from(attestor.signature, "base64"));
}

export function writeCaioInferenceTransportReadinessReceipt(input: Readonly<{
  privateRoot: string;
  outputPath: string;
  receipt: CaioInferenceTransportReadinessReceipt;
}>): Readonly<{ receiptSha256: `sha256:${string}` }> {
  const root = requirePrivateRoot(input.privateRoot);
  const output = requireContainedPath(input.outputPath, root);
  const bytes = Buffer.from(`${JSON.stringify(input.receipt, null, 2)}\n`, "utf8");
  let descriptor: number | null = null;
  try {
    descriptor = openSync(
      output,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      0o600,
    );
    fchmodSync(descriptor, 0o600);
    writeFileSync(descriptor, bytes);
    fsyncSync(descriptor);
    const stat = fstatSync(descriptor);
    if (!stat.isFile() || stat.nlink !== 1 || stat.uid !== currentUid() || (stat.mode & 0o777) !== 0o600 || stat.size !== bytes.byteLength) {
      throw new Error("caio_inference_readiness_output_invalid");
    }
    return Object.freeze({ receiptSha256: digest(bytes) });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EEXIST") {
      throw new Error("caio_inference_readiness_output_exists");
    }
    if (error instanceof Error && error.message.startsWith("caio_inference_readiness_")) throw error;
    throw new Error("caio_inference_readiness_output_invalid");
  } finally {
    if (descriptor !== null) closeSync(descriptor);
  }
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const row = value as Record<string, unknown>;
    return `{${Object.keys(row).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(row[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function digest(value: Buffer): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function certificateFingerprint(certificate: X509Certificate): `sha256:${string}` {
  return `sha256:${certificate.fingerprint256.replaceAll(":", "").toLowerCase()}`;
}

function requirePrivateRoot(root: string): string {
  if (!isAbsolute(root) || resolve(root) !== root) throw new Error("caio_inference_readiness_private_root_invalid");
  let stat;
  let canonical;
  try {
    stat = lstatSync(root);
    canonical = realpathSync(root);
  } catch {
    throw new Error("caio_inference_readiness_private_root_invalid");
  }
  if (!stat.isDirectory() || stat.isSymbolicLink() || canonical !== root || stat.uid !== currentUid() || (stat.mode & 0o777) !== 0o700) {
    throw new Error("caio_inference_readiness_private_root_invalid");
  }
  return canonical;
}

function requireContainedPath(path: string, root: string): string {
  if (!isAbsolute(path) || resolve(path) !== path) throw new Error("caio_inference_readiness_output_invalid");
  // Direct children only. O_NOFOLLOW protects the final path component; this
  // rule also removes symlinked-parent escapes from the output surface.
  if (dirname(path) !== root) {
    throw new Error("caio_inference_readiness_output_invalid");
  }
  return path;
}

function currentUid(): number {
  const uid = process.getuid?.();
  if (!Number.isSafeInteger(uid) || uid === undefined || uid < 0) throw new Error("caio_inference_readiness_output_invalid");
  return uid;
}
