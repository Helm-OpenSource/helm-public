import { Agent, request as httpsRequest } from "node:https";
import type { TLSSocket } from "node:tls";

import type { CaioInferenceInput } from "@/lib/caio-inference/contracts";

import type { CaioWorkerClaim, CaioWorkerGatewayPort } from "./contracts";

/**
 * 设备侧 worker 的网关客户端：认领与提交两个调用，别的什么都不做。
 *
 * ── 为什么要双向 TLS 材料，而不只是令牌 ──────────────────────────────
 * 网关的 mTLS 是必填的（`requireClientCertificate: true`），所以 worker 必须持客户端证书。
 * 令牌证明「谁在调用」，客户端证书证明「这台设备被允许连上来」——两者都不可省，
 * 少任何一个都不该起。
 *
 * ── 这个客户端不解释服务端的判断 ────────────────────────────────────
 * 提交的结果（completed / replayed / rejected 与原因码）原样带回，worker 不据此重试、
 * 不据此改写。服务端是唯一裁判：客户端一旦开始「理解」拒因，就会出现两套语义，
 * 而其中一套没有队列状态。
 *
 * ── 失败即关，且分得清 ──────────────────────────────────────────────
 * 认领返回 204/空体是「队列暂时没有活」（null，不是错误）；其余非 2xx 一律抛错并带上状态码，
 * 由 worker 的循环记成 offline。把「没有活」与「连不上」混成同一个结果，
 * 现场就无法区分「系统在等」和「系统断了」。
 */

/** 令牌前缀由 Core 的令牌契约定义；这里只做形状校验，不解析其内容。 */
const INFERENCE_TOKEN_PREFIX = "hcaio_inf_";
/** 响应体上限：认领报文是冻结窗口的引用集合，远小于此；超限即拒，不做流式拼接。 */
const MAX_RESPONSE_BYTES = 512 * 1024;

export type CaioWorkerGatewayClientConfig = Readonly<{
  /** 网关地址。经堡垒机隧道时这是本机转发端点。 */
  host: string;
  port: number;
  /** 推理受众的访问材料（`hcaio_inf_` 前缀）。 */
  accessToken: string;
  /** 客户端证书与私钥：网关要求客户端证书，少了连不上。 */
  clientCertificate: string | Buffer;
  clientPrivateKey: string | Buffer;
  /** 网关服务端证书的签发 CA：用来校验对面是我们那台网关，而不是任何能握手的东西。 */
  serverCa: string | Buffer;
  /** 单次调用时限。 */
  requestTimeoutMs?: number;
}>;

export type CaioWorkerGatewayReadinessObservation = Readonly<{
  livezStatus: number;
  readyzStatus: number;
  workBuddyStatus: number;
  privateExecutionStatus: number;
  missingClientCertificateRejected: boolean;
  serverCertificateFingerprint: `sha256:${string}`;
}>;

/**
 * Exercise the deployed inference surface without claiming work.
 *
 * The four requests use exactly the same mTLS material and endpoint as the
 * claim/submit client.  Response bodies are deliberately discarded: a
 * readiness receipt needs status and peer identity, never application data.
 */
export async function probeCaioWorkerGatewayReadiness(
  config: CaioWorkerGatewayClientConfig,
): Promise<CaioWorkerGatewayReadinessObservation> {
  assertConfig(config);
  const timeoutMs = config.requestTimeoutMs ?? 20_000;
  const authenticatedAgent = createAgent(config);
  let observations: readonly ReadinessResponse[];
  try {
    observations = [
      await readinessRequest(config, authenticatedAgent, timeoutMs, "GET", "/livez"),
      await readinessRequest(config, authenticatedAgent, timeoutMs, "GET", "/readyz"),
      await readinessRequest(config, authenticatedAgent, timeoutMs, "POST", "/mcp/workbuddy"),
      await readinessRequest(config, authenticatedAgent, timeoutMs, "POST", "/v1/execution-results"),
    ];
  } finally {
    authenticatedAgent.destroy();
  }
  const fingerprints = new Set(observations.map(({ fingerprint }) => fingerprint));
  if (fingerprints.size !== 1) {
    throw new Error("caio_worker_gateway_peer_identity_changed");
  }
  const unauthenticatedAgent = new Agent({
    keepAlive: false,
    maxSockets: 1,
    maxCachedSessions: 0,
    ca: config.serverCa,
    rejectUnauthorized: true,
    minVersion: "TLSv1.3",
  });
  let missingClientCertificateRejected = false;
  try {
    await readinessRequest(config, unauthenticatedAgent, timeoutMs, "GET", "/livez", false);
  } catch {
    missingClientCertificateRejected = true;
  } finally {
    unauthenticatedAgent.destroy();
  }
  return Object.freeze({
    livezStatus: observations[0]!.status,
    readyzStatus: observations[1]!.status,
    workBuddyStatus: observations[2]!.status,
    privateExecutionStatus: observations[3]!.status,
    missingClientCertificateRejected,
    serverCertificateFingerprint: observations[0]!.fingerprint,
  });
}

export function createCaioWorkerGatewayClient(
  config: CaioWorkerGatewayClientConfig,
): CaioWorkerGatewayPort {
  assertConfig(config);
  const timeoutMs = config.requestTimeoutMs ?? 20_000;
  // 一个 agent 复用连接：每次认领都重做 TLS 握手会让轮询的成本远高于它取到的东西。
  const agent = createAgent(config);

  const call = async (
    path: string,
    payload: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<{ status: number; body: unknown }> => {
    const body = Buffer.from(JSON.stringify(payload), "utf8");
    return await new Promise((resolve, reject) => {
      const req = httpsRequest(
        {
          host: config.host,
          port: config.port,
          path,
          method: "POST",
          agent,
          headers: {
            authorization: `Bearer ${config.accessToken}`,
            "content-type": "application/json; charset=utf-8",
            "content-length": String(body.byteLength),
          },
          timeout: timeoutMs,
        },
        (res) => {
          const chunks: Buffer[] = [];
          let received = 0;
          res.on("data", (chunk: Buffer) => {
            received += chunk.byteLength;
            if (received > MAX_RESPONSE_BYTES) {
              req.destroy(new Error("caio_worker_gateway_response_too_large"));
              return;
            }
            chunks.push(chunk);
          });
          res.on("end", () => {
            const text = Buffer.concat(chunks).toString("utf8");
            resolve({
              status: res.statusCode ?? 0,
              body: text.length === 0 ? null : safeJson(text),
            });
          });
          res.on("error", reject);
        },
      );
      req.on("timeout", () => req.destroy(new Error("caio_worker_gateway_timeout")));
      req.on("error", reject);
      if (signal) {
        if (signal.aborted) {
          req.destroy(new Error("caio_worker_gateway_aborted"));
        } else {
          signal.addEventListener("abort", () => req.destroy(new Error("caio_worker_gateway_aborted")), {
            once: true,
          });
        }
      }
      req.end(body);
    });
  };

  return Object.freeze({
    claim: async ({ signal }) => {
      // 请求体里没有工作区字段：由令牌决定，worker 无从点名别人的队列。
      const { status, body } = await call("/v1/inference-jobs/claim", {}, signal);
      if (status === 204 || body === null) return null;
      if (status < 200 || status >= 300) {
        throw new Error(`caio_worker_gateway_claim_failed:${status}`);
      }
      return parseClaim(body);
    },
    submit: async ({ jobId, claimToken, inputHash, output, signal }) => {
      const { status, body } = await call(
        "/v1/inference-jobs/submit",
        { jobId, claimToken, inputHash, output },
        signal,
      );
      if (status < 200 || status >= 300) {
        throw new Error(`caio_worker_gateway_submit_failed:${status}`);
      }
      return parseSubmitOutcome(body);
    },
  });
}

type ReadinessResponse = Readonly<{
  status: number;
  fingerprint: `sha256:${string}`;
}>;

function createAgent(config: CaioWorkerGatewayClientConfig): Agent {
  // maxCachedSessions: 0 — every request fingerprints the gateway certificate,
  // and a resumed TLS 1.3 session presents none (getPeerCertificate() is {}).
  // The gateway closes each connection, so without this every request after the
  // first resumes and fails caio_worker_gateway_peer_certificate_missing.
  return new Agent({
    keepAlive: true,
    maxSockets: 1,
    maxCachedSessions: 0,
    cert: config.clientCertificate,
    key: config.clientPrivateKey,
    ca: config.serverCa,
    rejectUnauthorized: true,
    minVersion: "TLSv1.3",
  });
}

async function readinessRequest(
  config: CaioWorkerGatewayClientConfig,
  agent: Agent,
  timeoutMs: number,
  method: "GET" | "POST",
  path: string,
  includeAuthorization = true,
): Promise<ReadinessResponse> {
  const body = method === "POST" ? Buffer.from("{}", "utf8") : null;
  return await new Promise((resolve, reject) => {
    const req = httpsRequest(
      {
        host: config.host,
        port: config.port,
        path,
        method,
        agent,
        headers: {
          ...(includeAuthorization ? { authorization: `Bearer ${config.accessToken}` } : {}),
          ...(body
            ? {
                "content-type": "application/json; charset=utf-8",
                "content-length": String(body.byteLength),
              }
            : {}),
        },
        timeout: timeoutMs,
      },
      (res) => {
        const socket = res.socket as TLSSocket;
        const peer = socket.getPeerCertificate();
        const fingerprint = peer.fingerprint256?.replaceAll(":", "").toLowerCase();
        if (!fingerprint || !/^[a-f0-9]{64}$/u.test(fingerprint)) {
          req.destroy(new Error("caio_worker_gateway_peer_certificate_missing"));
          return;
        }
        let received = 0;
        res.on("data", (chunk: Buffer) => {
          received += chunk.byteLength;
          if (received > MAX_RESPONSE_BYTES) {
            req.destroy(new Error("caio_worker_gateway_response_too_large"));
          }
        });
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 0,
            fingerprint: `sha256:${fingerprint}`,
          });
        });
        res.on("error", reject);
      },
    );
    req.on("timeout", () => req.destroy(new Error("caio_worker_gateway_timeout")));
    req.on("error", reject);
    req.end(body ?? undefined);
  });
}

function assertConfig(config: CaioWorkerGatewayClientConfig): void {
  if (!config.host || config.host.includes("/")) {
    throw new Error("invalid caio worker gateway client: host is required");
  }
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65_535) {
    throw new Error("invalid caio worker gateway client: port is out of range");
  }
  if (!config.accessToken.startsWith(INFERENCE_TOKEN_PREFIX)) {
    // 拿别的受众的材料调这两条路由，网关一定拒；在这里先拒，错得更明确。
    throw new Error("invalid caio worker gateway client: access material is not an inference token");
  }
  for (const [name, value] of [
    ["clientCertificate", config.clientCertificate],
    ["clientPrivateKey", config.clientPrivateKey],
    ["serverCa", config.serverCa],
  ] as const) {
    if (typeof value === "string" ? value.length === 0 : value.byteLength === 0) {
      throw new Error(`invalid caio worker gateway client: ${name} is empty`);
    }
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("caio_worker_gateway_response_not_json");
  }
}

/** 认领报文：四个标识符加冻结的输入。形状不对即拒，不做部分接受。 */
function parseClaim(body: unknown): CaioWorkerClaim | null {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("caio_worker_gateway_claim_shape_invalid");
  }
  const row = body as Record<string, unknown>;
  if (row.status === "none") return null;
  if (row.status === "rejected") {
    // 队列判定这次认领不可用（原因码闭集）。不是错误，但也没有活可做。
    return null;
  }
  const jobId = requireString(row.jobId, "jobId");
  const claimToken = requireString(row.claimToken, "claimToken");
  const inputHash = requireString(row.inputHash, "inputHash");
  const leaseExpiresAt = requireString(row.leaseExpiresAt, "leaseExpiresAt");
  if (row.input === null || typeof row.input !== "object") {
    throw new Error("caio_worker_gateway_claim_input_invalid");
  }
  return { jobId, claimToken, inputHash, leaseExpiresAt, input: row.input as CaioInferenceInput };
}

/** 提交结果原样带回：status 与可选的原因码，worker 不解释它。 */
function parseSubmitOutcome(body: unknown): { status: string; code?: string | null } {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("caio_worker_gateway_submit_shape_invalid");
  }
  const row = body as Record<string, unknown>;
  const status = requireString(row.status, "status");
  return typeof row.code === "string" ? { status, code: row.code } : { status };
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 512) {
    throw new Error(`caio_worker_gateway_field_invalid:${field}`);
  }
  return value;
}
