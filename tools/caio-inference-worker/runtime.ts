import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
  realpathSync,
} from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";

import { z } from "zod";

import { isWellFormedCaioToken } from "@/lib/caio-access-gateway/token-contracts";

import {
  caioInferenceWorkerExitCode,
  runCaioInferenceWorkerCli,
} from "./bin";
import type {
  CaioWorkerGatewayPort,
  CaioWorkerLocalModelPort,
} from "./contracts";
import {
  createCaioWorkerGatewayClient,
  probeCaioWorkerGatewayReadiness,
  type CaioWorkerGatewayClientConfig,
  type CaioWorkerGatewayReadinessObservation,
} from "./gateway-client";
import {
  createCaioWorkerLocalModelPort,
  type CaioWorkerLocalModelConfig,
} from "./local-model-port";
import {
  createCaioInferenceTransportReadinessReceipt,
  parseCaioInferenceReadinessChallenge,
  writeCaioInferenceTransportReadinessReceipt,
} from "./readiness-attest";

export const CAIO_INFERENCE_WORKER_RUNTIME_SCHEMA =
  "helm.caio.inference-worker-runtime.v1" as const;
export const CAIO_INFERENCE_WORKER_CONFIG_ENV =
  "HELM_CAIO_INFERENCE_WORKER_CONFIG" as const;

const MAX_CONFIG_BYTES = 64 * 1024;
const MAX_PRIVATE_FILE_BYTES = 1024 * 1024;
const MAX_CHALLENGE_BYTES = 16 * 1024;
const LOOPBACK_HOSTS = new Set([
  "127.0.0.1",
  "localhost",
  "::1",
]);

const privatePathSchema = z.string().min(1).max(1_024);
const timeoutSchema = z.number().int().min(100).max(600_000);
const runtimeSchema = z
  .object({
    schemaVersion: z.literal(CAIO_INFERENCE_WORKER_RUNTIME_SCHEMA),
    gateway: z
      .object({
        host: z
          .string()
          .min(1)
          .max(253)
          .regex(/^[A-Za-z0-9._:-]+$/u),
        port: z.number().int().min(1).max(65_535),
        accessTokenPath: privatePathSchema,
        clientCertificatePath: privatePathSchema,
        clientPrivateKeyPath: privatePathSchema,
        serverCaPath: privatePathSchema,
        requestTimeoutMs: timeoutSchema,
      })
      .strict(),
    model: z
      .object({
        baseUrl: z.string().url().max(1_024),
        model: z.string().min(1).max(200),
        accessTokenPath: privatePathSchema,
        probeTimeoutMs: timeoutSchema,
        completeTimeoutMs: timeoutSchema,
      })
      .strict(),
    loopPasses: z.number().int().min(1).max(128),
  })
  .strict();

export type CaioInferenceWorkerRuntimeConfig = Readonly<{
  gateway: CaioWorkerGatewayClientConfig;
  model: CaioWorkerLocalModelConfig;
  loopPasses: number;
}>;

type RuntimeDependencies = Readonly<{
  configPath?: string;
  env?: Readonly<Record<string, string | undefined>>;
  gatewayFactory?: (
    config: CaioWorkerGatewayClientConfig,
  ) => CaioWorkerGatewayPort;
  modelFactory?: (
    config: CaioWorkerLocalModelConfig,
  ) => CaioWorkerLocalModelPort;
  gatewayReadinessProbe?: (
    config: CaioWorkerGatewayClientConfig,
  ) => Promise<CaioWorkerGatewayReadinessObservation>;
  now?: () => Date;
  stdout?: (text: string) => void;
  signal?: AbortSignal;
}>;

/**
 * Load the device-side runtime from one owner-private directory.
 *
 * The JSON contains references only. Access material and private keys are
 * opened separately from 0600, same-owner, single-link files below the same
 * 0700 root. No database field is accepted, and no loaded value is logged.
 */
export function loadCaioInferenceWorkerRuntimeConfig(
  configPath: string,
): CaioInferenceWorkerRuntimeConfig {
  const normalizedConfigPath = requireAbsolutePath(configPath);
  const privateRoot = requirePrivateRoot(dirname(normalizedConfigPath));
  const source = readPrivateFile(
    normalizedConfigPath,
    privateRoot,
    MAX_CONFIG_BYTES,
  ).toString("utf8");
  let decoded: unknown;
  try {
    decoded = JSON.parse(source) as unknown;
  } catch {
    throw new Error("caio_inference_worker_runtime_invalid");
  }
  const parsed = runtimeSchema.safeParse(decoded);
  if (!parsed.success || !isLoopbackModelUrl(parsed.data.model.baseUrl)) {
    throw new Error("caio_inference_worker_runtime_invalid");
  }

  const accessToken = readPrivateFile(
    parsed.data.gateway.accessTokenPath,
    privateRoot,
    MAX_PRIVATE_FILE_BYTES,
  ).toString("utf8");
  if (!isWellFormedCaioToken(accessToken, "inference")) {
    throw new Error("caio_inference_worker_access_invalid");
  }

  const gateway = Object.freeze({
    host: parsed.data.gateway.host,
    port: parsed.data.gateway.port,
    accessToken,
    clientCertificate: readPrivateFile(
      parsed.data.gateway.clientCertificatePath,
      privateRoot,
      MAX_PRIVATE_FILE_BYTES,
    ),
    clientPrivateKey: readPrivateFile(
      parsed.data.gateway.clientPrivateKeyPath,
      privateRoot,
      MAX_PRIVATE_FILE_BYTES,
    ),
    serverCa: readPrivateFile(
      parsed.data.gateway.serverCaPath,
      privateRoot,
      MAX_PRIVATE_FILE_BYTES,
    ),
    requestTimeoutMs: parsed.data.gateway.requestTimeoutMs,
  });
  const modelAccessToken = readPrivateFile(
    parsed.data.model.accessTokenPath,
    privateRoot,
    MAX_PRIVATE_FILE_BYTES,
  ).toString("utf8");
  if (
    modelAccessToken.length < 16 ||
    modelAccessToken.length > 4_096 ||
    /\s/u.test(modelAccessToken)
  ) {
    throw new Error("caio_inference_worker_local_model_access_invalid");
  }
  const model = Object.freeze({
    baseUrl: parsed.data.model.baseUrl,
    model: parsed.data.model.model,
    accessToken: modelAccessToken,
    probeTimeoutMs: parsed.data.model.probeTimeoutMs,
    completeTimeoutMs: parsed.data.model.completeTimeoutMs,
  });
  return Object.freeze({
    gateway,
    model,
    loopPasses: parsed.data.loopPasses,
  });
}

/** Concrete production entry over the already-reviewed worker ports. */
export async function runCaioInferenceWorkerRuntime(
  argv: readonly string[],
  dependencies: RuntimeDependencies = {},
): Promise<number> {
  const configPath =
    dependencies.configPath ??
    dependencies.env?.[CAIO_INFERENCE_WORKER_CONFIG_ENV] ??
    process.env[CAIO_INFERENCE_WORKER_CONFIG_ENV] ??
    "";
  if (!configPath) {
    throw new Error("caio_inference_worker_config_required");
  }
  const runtime = loadCaioInferenceWorkerRuntimeConfig(configPath);
  const gatewayFactory =
    dependencies.gatewayFactory ?? createCaioWorkerGatewayClient;
  const modelFactory =
    dependencies.modelFactory ?? createCaioWorkerLocalModelPort;
  const stdout =
    dependencies.stdout ?? ((text: string) => process.stdout.write(`${text}\n`));
  if (argv[0] === "readiness-attest") {
    const args = parseReadinessAttestArgs(argv);
    const privateRoot = dirname(requireAbsolutePath(configPath));
    if (dirname(args.challengeFile) !== privateRoot || dirname(args.output) !== privateRoot) {
      throw new Error("caio_inference_readiness_arguments_invalid");
    }
    const challengeBytes = readPrivateFile(args.challengeFile, privateRoot, MAX_CHALLENGE_BYTES);
    let decoded: unknown;
    try {
      decoded = JSON.parse(challengeBytes.toString("utf8")) as unknown;
    } catch {
      throw new Error("caio_inference_readiness_challenge_invalid");
    }
    const now = dependencies.now ?? (() => new Date());
    const challenge = parseCaioInferenceReadinessChallenge(decoded, now());
    const model = modelFactory(runtime.model);
    const readinessProbe = dependencies.gatewayReadinessProbe ?? probeCaioWorkerGatewayReadiness;
    const receipt = await createCaioInferenceTransportReadinessReceipt({
      challenge,
      clientCertificate: runtime.gateway.clientCertificate,
      clientPrivateKey: runtime.gateway.clientPrivateKey,
      modelId: runtime.model.model,
      modelProbe: async () => await model.probe({}),
      gatewayProbe: async () => await readinessProbe(runtime.gateway),
      now,
    });
    const result = writeCaioInferenceTransportReadinessReceipt({
      privateRoot,
      outputPath: args.output,
      receipt,
    });
    stdout(JSON.stringify({
      command: "readiness-attest",
      ok: true,
      receiptSha256: result.receiptSha256,
    }));
    return 0;
  }
  const result = await runCaioInferenceWorkerCli(argv, {
    gateway: gatewayFactory(runtime.gateway),
    model: modelFactory(runtime.model),
    stdout,
    loopPasses: runtime.loopPasses,
    ...(dependencies.signal ? { signal: dependencies.signal } : {}),
  });
  return result === null ? 2 : caioInferenceWorkerExitCode(result);
}

function parseReadinessAttestArgs(argv: readonly string[]): Readonly<{
  challengeFile: string;
  output: string;
}> {
  if (
    argv.length !== 5 ||
    argv[0] !== "readiness-attest" ||
    argv[1] !== "--challenge-file" ||
    argv[3] !== "--output" ||
    !argv[2] ||
    !argv[4]
  ) {
    throw new Error("caio_inference_readiness_arguments_invalid");
  }
  return Object.freeze({
    challengeFile: requireAbsolutePath(argv[2]),
    output: requireAbsolutePath(argv[4]),
  });
}

function requirePrivateRoot(root: string): string {
  let stat;
  let canonical;
  try {
    stat = lstatSync(root);
    canonical = realpathSync(root);
  } catch {
    throw new Error("caio_inference_worker_private_root_invalid");
  }
  if (
    !stat.isDirectory() ||
    stat.isSymbolicLink() ||
    canonical !== root ||
    stat.uid !== currentUid() ||
    (stat.mode & 0o777) !== 0o700
  ) {
    throw new Error("caio_inference_worker_private_root_invalid");
  }
  return canonical;
}

function readPrivateFile(
  filePath: string,
  privateRoot: string,
  maxBytes: number,
): Buffer {
  const normalized = requireAbsolutePath(filePath);
  const escape = relative(privateRoot, normalized);
  if (escape === "" || escape === ".." || escape.startsWith("../") || isAbsolute(escape)) {
    throw new Error("caio_inference_worker_private_path_escape");
  }
  let descriptor: number | null = null;
  try {
    descriptor = openSync(normalized, constants.O_RDONLY | constants.O_NOFOLLOW);
    const before = fstatSync(descriptor);
    if (
      !before.isFile() ||
      before.nlink !== 1 ||
      before.uid !== currentUid() ||
      (before.mode & 0o777) !== 0o600 ||
      before.size < 1 ||
      before.size > maxBytes
    ) {
      throw new Error("caio_inference_worker_private_file_invalid");
    }
    const bytes = readFileSync(descriptor);
    const after = fstatSync(descriptor);
    if (
      bytes.byteLength !== before.size ||
      after.dev !== before.dev ||
      after.ino !== before.ino ||
      after.size !== before.size ||
      after.mtimeMs !== before.mtimeMs ||
      after.ctimeMs !== before.ctimeMs
    ) {
      throw new Error("caio_inference_worker_private_file_drift");
    }
    return bytes;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("caio_inference_worker_")) {
      throw error;
    }
    throw new Error("caio_inference_worker_private_file_invalid");
  } finally {
    if (descriptor !== null) closeSync(descriptor);
  }
}

function requireAbsolutePath(value: string): string {
  if (!value || !isAbsolute(value) || resolve(value) !== value) {
    throw new Error("caio_inference_worker_private_file_invalid");
  }
  return value;
}

function isLoopbackModelUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      LOOPBACK_HOSTS.has(url.hostname) &&
      url.username === "" &&
      url.password === ""
    );
  } catch {
    return false;
  }
}

function currentUid(): number {
  const uid = process.getuid?.();
  if (!Number.isSafeInteger(uid) || uid === undefined || uid < 0) {
    throw new Error("caio_inference_worker_private_file_invalid");
  }
  return uid;
}
