import {
  chmodSync,
  linkSync,
  readFileSync,
  realpathSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CAIO_INFERENCE_WORKER_RUNTIME_SCHEMA,
  loadCaioInferenceWorkerRuntimeConfig,
  runCaioInferenceWorkerRuntime,
} from "./runtime";
import {
  CAIO_INFERENCE_READINESS_CHALLENGE_SCHEMA,
  CAIO_INFERENCE_TRANSPORT_READINESS_SCHEMA,
} from "./readiness-attest";
import { createCaioWorkerPkiFixture, removeCaioWorkerPkiFixture } from "./pki-fixture";

const roots: string[] = [];
const RAW_TOKEN = `hcaio_inf_${"a".repeat(43)}`;
const MODEL_ACCESS = "omlx-test-access-token";

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function fixture() {
  const root = realpathSync(
    await mkdtemp(join(tmpdir(), "caio-worker-runtime-")),
  );
  roots.push(root);
  chmodSync(root, 0o700);
  const paths = {
    root,
    config: join(root, "inference-worker.json"),
    access: join(root, "inference-access"),
    modelAccess: join(root, "local-model-access"),
    cert: join(root, "worker.crt"),
    key: join(root, "worker.key"),
    ca: join(root, "gateway-ca.crt"),
  };
  for (const [path, body] of [
    [paths.access, RAW_TOKEN],
    [paths.modelAccess, MODEL_ACCESS],
    [paths.cert, "synthetic-worker-certificate"],
    [paths.key, "synthetic-worker-private-key"],
    [paths.ca, "synthetic-gateway-ca"],
  ] as const) {
    writeFileSync(path, body, { mode: 0o600 });
  }
  const config = {
    schemaVersion: CAIO_INFERENCE_WORKER_RUNTIME_SCHEMA,
    gateway: {
      host: "127.0.0.1",
      port: 17443,
      accessTokenPath: paths.access,
      clientCertificatePath: paths.cert,
      clientPrivateKeyPath: paths.key,
      serverCaPath: paths.ca,
      requestTimeoutMs: 20_000,
    },
    model: {
      baseUrl: "http://127.0.0.1:8080/v1",
      model: "local-governed-model",
      accessTokenPath: paths.modelAccess,
      probeTimeoutMs: 5_000,
      completeTimeoutMs: 300_000,
    },
    loopPasses: 32,
  };
  writeFileSync(paths.config, `${JSON.stringify(config, null, 2)}\n`, {
    mode: 0o600,
  });
  return { paths, config };
}

describe("CAIO inference worker owner-private runtime", () => {
  it("loads only referenced private material and returns the frozen runtime shape", async () => {
    const { paths } = await fixture();
    const loaded = loadCaioInferenceWorkerRuntimeConfig(paths.config);

    expect(loaded.gateway).toMatchObject({
      host: "127.0.0.1",
      port: 17443,
      accessToken: RAW_TOKEN,
      requestTimeoutMs: 20_000,
    });
    expect(loaded.gateway.clientCertificate.toString()).toBe(
      "synthetic-worker-certificate",
    );
    expect(loaded.model).toEqual({
      baseUrl: "http://127.0.0.1:8080/v1",
      model: "local-governed-model",
      accessToken: MODEL_ACCESS,
      probeTimeoutMs: 5_000,
      completeTimeoutMs: 300_000,
    });
    expect(loaded.loopPasses).toBe(32);
    expect(JSON.stringify(loaded)).not.toContain("DATABASE_URL");
  });

  it("composes the real worker CLI without printing access material", async () => {
    const { paths } = await fixture();
    const gateway = { claim: vi.fn(), submit: vi.fn() };
    const model = { probe: vi.fn().mockResolvedValue({ ready: true }), complete: vi.fn() };
    const gatewayFactory = vi.fn(() => gateway);
    const modelFactory = vi.fn(() => model);
    const stdout = vi.fn();

    await expect(
      runCaioInferenceWorkerRuntime(["probe", "--json"], {
        configPath: paths.config,
        gatewayFactory,
        modelFactory,
        stdout,
      }),
    ).resolves.toBe(0);

    expect(gatewayFactory).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: RAW_TOKEN }),
    );
    expect(modelFactory).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: "http://127.0.0.1:8080/v1",
        accessToken: MODEL_ACCESS,
      }),
    );
    expect(stdout).toHaveBeenCalledTimes(1);
    expect(stdout.mock.calls.flat().join("\n")).not.toContain(RAW_TOKEN);
  });

  it("readiness-attest binds a private challenge to model and gateway probes, then writes one safe receipt", async () => {
    const { paths } = await fixture();
    const pki = createCaioWorkerPkiFixture();
    try {
      writeFileSync(paths.cert, pki.clientCert, { mode: 0o600 });
      writeFileSync(paths.key, pki.clientKey, { mode: 0o600 });
      writeFileSync(paths.ca, pki.caCert, { mode: 0o600 });
      const now = new Date("2026-09-23T01:00:00.000Z");
      const challengePath = join(paths.root, "readiness-challenge.json");
      const outputPath = join(paths.root, "readiness-receipt.json");
      writeFileSync(challengePath, JSON.stringify({
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
      }), { mode: 0o600 });
      const modelProbe = vi.fn().mockResolvedValue({ ready: true });
      const stdout = vi.fn();

      await expect(runCaioInferenceWorkerRuntime([
        "readiness-attest", "--challenge-file", challengePath, "--output", outputPath,
      ], {
        configPath: paths.config,
        modelFactory: vi.fn(() => ({ probe: modelProbe, complete: vi.fn() })),
        gatewayReadinessProbe: vi.fn().mockResolvedValue({
          livezStatus: 200,
          readyzStatus: 200,
          workBuddyStatus: 404,
          privateExecutionStatus: 404,
          missingClientCertificateRejected: true,
          serverCertificateFingerprint: `sha256:${"f".repeat(64)}`,
        }),
        now: () => now,
        stdout,
      })).resolves.toBe(0);

      expect(modelProbe).toHaveBeenCalledTimes(1);
      const receipt = JSON.parse(readFileSync(outputPath, "utf8")) as Record<string, unknown>;
      expect(receipt.schemaVersion).toBe(CAIO_INFERENCE_TRANSPORT_READINESS_SCHEMA);
      expect(statSync(outputPath).mode & 0o777).toBe(0o600);
      const emitted = stdout.mock.calls.flat().join("\n");
      expect(emitted).toMatch(/"ok":true/u);
      expect(emitted).not.toContain(RAW_TOKEN);
      expect(emitted).not.toContain(MODEL_ACCESS);
      expect(emitted).not.toContain("PRIVATE KEY");
    } finally {
      removeCaioWorkerPkiFixture(pki);
    }
  });

  it("rejects inline credentials, database fields, remote models and unknown keys", async () => {
    const { paths, config } = await fixture();
    type MutableConfig = typeof config & Record<string, unknown>;
    const mutations: Array<(value: MutableConfig) => void> = [
      (value) => {
        (value.gateway as typeof config.gateway & Record<string, unknown>)
          .accessToken = RAW_TOKEN;
      },
      (value) => {
        value.DATABASE_URL = "mysql://forbidden";
      },
      (value) => {
        value.model.baseUrl = "https://model.example.test/v1";
      },
      (value) => {
        (value.model as typeof config.model & Record<string, unknown>)
          .accessToken = MODEL_ACCESS;
      },
      (value) => {
        (value.gateway as typeof config.gateway & Record<string, unknown>)
          .extra = true;
      },
    ];
    for (const mutate of mutations) {
      const candidate = structuredClone(config) as MutableConfig;
      mutate(candidate);
      writeFileSync(paths.config, `${JSON.stringify(candidate)}\n`, { mode: 0o600 });
      expect(() => loadCaioInferenceWorkerRuntimeConfig(paths.config)).toThrow(
        /caio_inference_worker_runtime_invalid/,
      );
    }
  });

  it("本地模型凭据必须来自同一 0700 根下的 0600 单链接文件", async () => {
    const { paths, config } = await fixture();

    chmodSync(paths.modelAccess, 0o644);
    expect(() => loadCaioInferenceWorkerRuntimeConfig(paths.config)).toThrow(
      /caio_inference_worker_private_file_invalid/,
    );

    chmodSync(paths.modelAccess, 0o600);
    const linked = join(paths.root, "linked-model-access");
    linkSync(paths.modelAccess, linked);
    config.model.accessTokenPath = linked;
    writeFileSync(paths.config, `${JSON.stringify(config)}\n`, { mode: 0o600 });
    expect(() => loadCaioInferenceWorkerRuntimeConfig(paths.config)).toThrow(
      /caio_inference_worker_private_file_invalid/,
    );
  });

  it("rejects wrong-audience material and insecure, linked or escaped files", async () => {
    const { paths, config } = await fixture();

    writeFileSync(paths.access, `hcaio_mcp_${"a".repeat(43)}`, { mode: 0o600 });
    expect(() => loadCaioInferenceWorkerRuntimeConfig(paths.config)).toThrow(
      /caio_inference_worker_access_invalid/,
    );

    writeFileSync(paths.access, RAW_TOKEN, { mode: 0o644 });
    chmodSync(paths.access, 0o644);
    expect(() => loadCaioInferenceWorkerRuntimeConfig(paths.config)).toThrow(
      /caio_inference_worker_private_file_invalid/,
    );

    writeFileSync(paths.access, RAW_TOKEN, { mode: 0o600 });
    chmodSync(paths.access, 0o600);
    const linked = join(paths.root, "linked-access");
    linkSync(paths.access, linked);
    config.gateway.accessTokenPath = linked;
    writeFileSync(paths.config, `${JSON.stringify(config)}\n`, { mode: 0o600 });
    expect(() => loadCaioInferenceWorkerRuntimeConfig(paths.config)).toThrow(
      /caio_inference_worker_private_file_invalid/,
    );

    const outside = realpathSync(
      await mkdtemp(join(tmpdir(), "caio-worker-outside-")),
    );
    roots.push(outside);
    chmodSync(outside, 0o700);
    const outsideAccess = join(outside, "access");
    writeFileSync(outsideAccess, RAW_TOKEN, { mode: 0o600 });
    config.gateway.accessTokenPath = outsideAccess;
    writeFileSync(paths.config, `${JSON.stringify(config)}\n`, { mode: 0o600 });
    expect(() => loadCaioInferenceWorkerRuntimeConfig(paths.config)).toThrow(
      /caio_inference_worker_private_path_escape/,
    );
  });

  it("rejects symlinked config paths and loose private roots", async () => {
    const { paths } = await fixture();
    const linkedConfig = join(paths.root, "linked-config.json");
    symlinkSync(paths.config, linkedConfig);
    expect(() => loadCaioInferenceWorkerRuntimeConfig(linkedConfig)).toThrow(
      /caio_inference_worker_private_file_invalid/,
    );

    chmodSync(paths.root, 0o755);
    expect(() => loadCaioInferenceWorkerRuntimeConfig(paths.config)).toThrow(
      /caio_inference_worker_private_root_invalid/,
    );
  });

  it("fails closed when the entrypoint has no owner-private config path", async () => {
    await expect(
      runCaioInferenceWorkerRuntime(["probe"], {
        configPath: "",
        gatewayFactory: vi.fn(),
        modelFactory: vi.fn(),
        stdout: vi.fn(),
      }),
    ).rejects.toThrow(/caio_inference_worker_config_required/);
  });

  it("the shipped direct entrypoint executes and fails closed without configuration", () => {
    const env = { ...process.env };
    delete env.HELM_CAIO_INFERENCE_WORKER_CONFIG;
    delete env.DATABASE_URL;
    const result = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        join(process.cwd(), "tools/caio-inference-worker/runtime-cli.ts"),
        "probe",
      ],
      { encoding: "utf8", env },
    );
    expect(result.status).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("caio_inference_worker_config_required\n");
  });
});
