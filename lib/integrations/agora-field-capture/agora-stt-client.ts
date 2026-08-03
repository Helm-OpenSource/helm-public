import { randomUUID } from "node:crypto";
import { RtcRole, RtcTokenBuilder } from "agora-token";
import { z } from "zod";

const DEFAULT_AGORA_STT_BASE_URL = "https://api.sd-rtn.com";
const DEFAULT_TOKEN_TTL_SECONDS = 3600;
const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;
const MAX_UINT32 = 4_294_967_295;

type AgoraSttMockConfig = {
  mode: "MOCK";
  appId: string;
  baseUrl: string;
  tokenTtlSeconds: number;
};

export type AgoraSttRealConfig = {
  mode: "REAL";
  appId: string;
  appCertificate: string;
  customerId: string;
  customerSecret: string;
  webhookSecret: string;
  baseUrl: string;
  tokenTtlSeconds: number;
};

export type AgoraSttConfig = AgoraSttMockConfig | AgoraSttRealConfig;

type Env = Record<string, string | undefined>;

const providerStatusSchema = z.enum([
  "STARTING",
  "RUNNING",
  "STOPPING",
  "STOPPED",
  "RECOVERING",
  "FAILED",
]);

const responseSchema = z.object({
  agent_id: z.string().trim().min(1),
  create_ts: z.number().int().optional().nullable(),
  status: providerStatusSchema,
});

export type AgoraSttStartInput = {
  taskName: string;
  channelName: string;
  language: string;
  publisherUid: number;
  subscriberBotUid: number;
  publisherBotUid: number;
  maxIdleTimeSeconds?: number;
};

export type AgoraRtcTokenInput = {
  appId: string;
  appCertificate: string;
  channelName: string;
  uid: number;
  ttlSeconds: number;
};

export type AgoraSttClientDependencies = {
  fetch?: typeof fetch;
  buildRtcToken?: (input: AgoraRtcTokenInput) => string;
  now?: () => Date;
  requestTimeoutMs?: number;
};

function requireRealConfig(env: Env, key: string) {
  const value = env[key]?.trim();
  return value || null;
}

function normalizeAgoraBaseUrl(value: string, mode: string) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("AGORA_STT_BASE_URL must be a valid URL");
  }
  if (mode === "REAL" && parsed.protocol !== "https:") {
    throw new Error("AGORA_STT_BASE_URL must use HTTPS in REAL mode");
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error("AGORA_STT_BASE_URL must not contain credentials, query, or fragment");
  }
  return parsed.toString().replace(/\/+$/, "");
}

export function resolveAgoraSttConfig(env: Env = process.env): AgoraSttConfig {
  const mode = (env.AGORA_STT_MODE?.trim().toUpperCase() || "MOCK") as string;
  if (mode !== "MOCK" && mode !== "REAL") {
    throw new Error("AGORA_STT_MODE must be MOCK or REAL");
  }
  const baseUrl = normalizeAgoraBaseUrl(
    env.AGORA_STT_BASE_URL?.trim() || DEFAULT_AGORA_STT_BASE_URL,
    mode,
  );
  const configuredTtl = Number(env.AGORA_RTC_TOKEN_TTL_SECONDS ?? DEFAULT_TOKEN_TTL_SECONDS);
  const tokenTtlSeconds =
    Number.isInteger(configuredTtl) && configuredTtl >= 300 && configuredTtl <= 86_400
      ? configuredTtl
      : DEFAULT_TOKEN_TTL_SECONDS;

  if (mode === "MOCK") {
    return {
      mode: "MOCK",
      appId: "mock-agora-app-id",
      baseUrl,
      tokenTtlSeconds,
    };
  }

  const required = [
    "AGORA_APP_ID",
    "AGORA_APP_CERTIFICATE",
    "AGORA_CUSTOMER_ID",
    "AGORA_CUSTOMER_SECRET",
    "AGORA_STT_WEBHOOK_SECRET",
  ] as const;
  const values = Object.fromEntries(
    required.map((key) => [key, requireRealConfig(env, key)]),
  ) as Record<(typeof required)[number], string | null>;
  const missing = required.filter((key) => !values[key]);
  if (missing.length) {
    throw new Error(`Agora STT REAL mode is missing: ${missing.join(", ")}`);
  }

  return {
    mode: "REAL",
    appId: values.AGORA_APP_ID!,
    appCertificate: values.AGORA_APP_CERTIFICATE!,
    customerId: values.AGORA_CUSTOMER_ID!,
    customerSecret: values.AGORA_CUSTOMER_SECRET!,
    webhookSecret: values.AGORA_STT_WEBHOOK_SECRET!,
    baseUrl,
    tokenTtlSeconds,
  };
}

function assertAgoraUid(value: number, field: string) {
  if (!Number.isInteger(value) || value < 1 || value > MAX_UINT32) {
    throw new Error(`${field} must be an unsigned 32-bit Agora UID`);
  }
}

function assertStartInput(input: AgoraSttStartInput) {
  if (!input.taskName.trim() || Buffer.byteLength(input.taskName) > 64) {
    throw new Error("Agora STT taskName must be 1-64 bytes");
  }
  if (!input.channelName.trim() || Buffer.byteLength(input.channelName) > 64) {
    throw new Error("Agora channelName must be 1-64 bytes");
  }
  assertAgoraUid(input.publisherUid, "publisherUid");
  assertAgoraUid(input.subscriberBotUid, "subscriberBotUid");
  assertAgoraUid(input.publisherBotUid, "publisherBotUid");
  if (
    new Set([
      input.publisherUid,
      input.subscriberBotUid,
      input.publisherBotUid,
    ]).size !== 3
  ) {
    throw new Error("Agora publisher and bot UIDs must be distinct");
  }
}

function defaultRtcTokenBuilder(input: AgoraRtcTokenInput) {
  return RtcTokenBuilder.buildTokenWithUid(
    input.appId,
    input.appCertificate,
    input.channelName,
    input.uid,
    RtcRole.PUBLISHER,
    input.ttlSeconds,
    input.ttlSeconds,
  );
}

export class AgoraSttClient {
  private readonly fetchImpl: typeof fetch;
  private readonly buildRtcToken: (input: AgoraRtcTokenInput) => string;
  private readonly now: () => Date;
  private readonly requestTimeoutMs: number;

  constructor(
    private readonly config: AgoraSttConfig = resolveAgoraSttConfig(),
    dependencies: AgoraSttClientDependencies = {},
  ) {
    this.fetchImpl = dependencies.fetch ?? fetch;
    this.buildRtcToken = dependencies.buildRtcToken ?? defaultRtcTokenBuilder;
    this.now = dependencies.now ?? (() => new Date());
    this.requestTimeoutMs = dependencies.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    if (!Number.isInteger(this.requestTimeoutMs) || this.requestTimeoutMs < 100) {
      throw new Error("Agora STT request timeout must be at least 100 ms");
    }
  }

  async start(input: AgoraSttStartInput) {
    assertStartInput(input);
    const expiresAt = new Date(
      this.now().getTime() + this.config.tokenTtlSeconds * 1000,
    );

    if (this.config.mode === "MOCK") {
      return {
        providerAgentId: `mock-agent-${randomUUID()}`,
        providerStatus: "RUNNING",
        createdAtUnixSeconds: Math.floor(this.now().getTime() / 1000),
        rtc: {
          appId: this.config.appId,
          channelName: input.channelName,
          publisherUid: input.publisherUid,
          publisherToken: "mock-rtc-token",
          transcriptBotUid: input.publisherBotUid,
          expiresAt: expiresAt.toISOString(),
          mock: true,
        },
      } as const;
    }

    const realConfig = this.config;
    const tokenFor = (uid: number) =>
      this.buildRtcToken({
        appId: realConfig.appId,
        appCertificate: realConfig.appCertificate,
        channelName: input.channelName,
        uid,
        ttlSeconds: realConfig.tokenTtlSeconds,
      });
    const publisherToken = tokenFor(input.publisherUid);
    const subscriberBotToken = tokenFor(input.subscriberBotUid);
    const publisherBotToken = tokenFor(input.publisherBotUid);

    const response = await this.fetchImpl(
      `${realConfig.baseUrl}/cn/api/speech-to-text/v1/projects/${encodeURIComponent(realConfig.appId)}/join`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${realConfig.customerId}:${realConfig.customerSecret}`,
          ).toString("base64")}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(this.requestTimeoutMs),
        body: JSON.stringify({
          languages: [input.language],
          name: input.taskName,
          maxIdleTime: input.maxIdleTimeSeconds ?? 300,
          rtcConfig: {
            channelName: input.channelName,
            subBotUid: String(input.subscriberBotUid),
            subBotToken: subscriberBotToken,
            pubBotUid: String(input.publisherBotUid),
            pubBotToken: publisherBotToken,
            subscribeAudioUids: [String(input.publisherUid)],
            enableJsonProtocol: false,
          },
        }),
      },
    );

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(`Agora STT join failed with HTTP ${response.status}`);
    }
    const parsed = responseSchema.safeParse(payload);
    if (!parsed.success) {
      throw new Error("Agora STT join returned an invalid response");
    }
    if (["STOPPING", "STOPPED", "FAILED"].includes(parsed.data.status)) {
      throw new Error(`Agora STT join returned terminal status ${parsed.data.status}`);
    }

    return {
      providerAgentId: parsed.data.agent_id,
      providerStatus: parsed.data.status,
      createdAtUnixSeconds: parsed.data.create_ts ?? null,
      rtc: {
        appId: realConfig.appId,
        channelName: input.channelName,
        publisherUid: input.publisherUid,
        publisherToken,
        transcriptBotUid: input.publisherBotUid,
        expiresAt: expiresAt.toISOString(),
        mock: false,
      },
    } as const;
  }

  async stop(providerAgentId: string) {
    if (!providerAgentId.trim()) {
      throw new Error("Agora providerAgentId is required");
    }

    if (this.config.mode === "MOCK") {
      return {
        providerAgentId,
        providerStatus: "STOPPED",
        createdAtUnixSeconds: null,
        mock: true,
      } as const;
    }

    const response = await this.fetchImpl(
      `${this.config.baseUrl}/cn/api/speech-to-text/v1/projects/${encodeURIComponent(this.config.appId)}/agents/${encodeURIComponent(providerAgentId)}/leave`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${this.config.customerId}:${this.config.customerSecret}`,
          ).toString("base64")}`,
        },
        signal: AbortSignal.timeout(this.requestTimeoutMs),
      },
    );
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(`Agora STT leave failed with HTTP ${response.status}`);
    }
    const parsed = responseSchema.safeParse(payload);
    if (!parsed.success) {
      throw new Error("Agora STT leave returned an invalid response");
    }
    if (!["STOPPING", "STOPPED"].includes(parsed.data.status)) {
      throw new Error(`Agora STT leave returned unexpected status ${parsed.data.status}`);
    }

    return {
      providerAgentId: parsed.data.agent_id,
      providerStatus: parsed.data.status,
      createdAtUnixSeconds: parsed.data.create_ts ?? null,
      mock: false,
    } as const;
  }
}
