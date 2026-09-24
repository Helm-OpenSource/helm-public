import { afterEach, describe, expect, it } from "vitest";
import { createServer, type Server as HttpsServer } from "node:https";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { X509Certificate } from "node:crypto";

import {
  createCaioWorkerGatewayClient,
  probeCaioWorkerGatewayReadiness,
} from "./gateway-client";

const TOKEN = "hcaio_inf_0123456789abcdef";

/**
 * 用**真实的 mTLS 服务端**验，而不是替换 https 模块。
 *
 * 这个客户端存在的理由之一就是「必须持客户端证书」，用假 transport 测等于把待验的那一条
 * 换成了自己的断言。证书用 openssl 现场生成，只存在于临时目录。
 */
type Pki = Readonly<{ dir: string; caCert: string; serverCert: string; serverKey: string; clientCert: string; clientKey: string }>;

function makePki(): Pki {
  const dir = mkdtempSync(path.join(tmpdir(), "caio-worker-pki-"));
  const openssl = (args: string[]) => execFileSync("openssl", args, { cwd: dir, stdio: ["ignore", "pipe", "pipe"] });
  openssl(["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", "ca.key", "-out", "ca.crt",
    "-days", "1", "-subj", "/CN=caio-test-ca"]);
  for (const [name, cn] of [["server", "127.0.0.1"], ["client", "caio-inference-worker"]] as const) {
    openssl(["req", "-newkey", "rsa:2048", "-nodes", "-keyout", `${name}.key`, "-out", `${name}.csr`,
      "-subj", `/CN=${cn}`]);
    openssl(["x509", "-req", "-in", `${name}.csr`, "-CA", "ca.crt", "-CAkey", "ca.key",
      "-CAcreateserial", "-out", `${name}.crt`, "-days", "1",
      ...(name === "server" ? ["-extfile", writeExt(dir)] : [])]);
  }
  const read = (f: string) => readFileSync(path.join(dir, f), "utf8");
  return {
    dir,
    caCert: read("ca.crt"),
    serverCert: read("server.crt"),
    serverKey: read("server.key"),
    clientCert: read("client.crt"),
    clientKey: read("client.key"),
  };
}

function writeExt(dir: string): string {
  const file = path.join(dir, "server.ext");
  writeFileSync(file, "subjectAltName=IP:127.0.0.1\n");
  return file;
}

type Handler = (body: unknown, url: string) => { status: number; body?: unknown };

async function startServer(
  pki: Pki,
  handler: Handler,
  options: { closeEachResponse?: boolean } = {},
): Promise<{ server: HttpsServer; port: number; peers: number }> {
  const state = { peers: 0 };
  const server = createServer(
    {
      cert: pki.serverCert,
      key: pki.serverKey,
      ca: pki.caCert,
      requestCert: true,
      rejectUnauthorized: true,
      minVersion: "TLSv1.3",
    },
    (req, res) => {
      state.peers += 1;
      const chunks: Buffer[] = [];
      req.on("data", (c: Buffer) => chunks.push(c));
      req.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        const out = handler(text.length ? JSON.parse(text) : null, req.url ?? "");
        res.writeHead(out.status, {
          "content-type": "application/json",
          ...(options.closeEachResponse ? { connection: "close" } : {}),
        });
        res.end(out.body === undefined ? "" : JSON.stringify(out.body));
      });
    },
  );
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address !== null ? address.port : 0;
  return { server, port, get peers() { return state.peers; } } as never;
}

let pki: Pki | null = null;
let open: HttpsServer | null = null;

afterEach(() => {
  open?.close();
  open = null;
  if (pki) rmSync(pki.dir, { recursive: true, force: true });
  pki = null;
});

function client(port: number, p: Pki) {
  return createCaioWorkerGatewayClient({
    host: "127.0.0.1",
    port,
    accessToken: TOKEN,
    clientCertificate: p.clientCert,
    clientPrivateKey: p.clientKey,
    serverCa: p.caCert,
    requestTimeoutMs: 8_000,
  });
}

describe("设备侧网关客户端", () => {
  it("readiness probe uses the real mTLS link, fingerprints the peer and proves closed adjacent routes", async () => {
    pki = makePki();
    const seen: string[] = [];
    const started = await startServer(pki, (_body, url) => {
      seen.push(url);
      if (url === "/livez" || url === "/readyz") return { status: 200, body: { state: "ready" } };
      if (url === "/mcp/workbuddy" || url === "/v1/execution-results") return { status: 404, body: { error: "not_found" } };
      return { status: 500, body: { error: "unexpected" } };
    });
    open = started.server;

    const observation = await probeCaioWorkerGatewayReadiness({
      host: "127.0.0.1",
      port: started.port,
      accessToken: TOKEN,
      clientCertificate: pki.clientCert,
      clientPrivateKey: pki.clientKey,
      serverCa: pki.caCert,
      requestTimeoutMs: 8_000,
    });

    expect(observation).toEqual({
      livezStatus: 200,
      readyzStatus: 200,
      workBuddyStatus: 404,
      privateExecutionStatus: 404,
      missingClientCertificateRejected: true,
      serverCertificateFingerprint: `sha256:${new X509Certificate(pki.serverCert).fingerprint256
        .replaceAll(":", "")
        .toLowerCase()}`,
    });
    expect(seen).toEqual(["/livez", "/readyz", "/mcp/workbuddy", "/v1/execution-results"]);
    expect(JSON.stringify(observation)).not.toContain(TOKEN);
  });

  it("readiness probe still fingerprints every response when the gateway closes each connection (no TLS session resumption)", async () => {
    // The production gateway answers `Connection: close`, so every probe opens a
    // new TLS connection. A resumed TLS 1.3 session carries no certificate, and
    // getPeerCertificate() returns {} there (2026-09-24 readiness ceremony).
    pki = makePki();
    const started = await startServer(
      pki,
      (_body, url) => {
        if (url === "/livez" || url === "/readyz") return { status: 200, body: { state: "ready" } };
        return { status: 404, body: { error: "not_found" } };
      },
      { closeEachResponse: true },
    );
    open = started.server;

    const observation = await probeCaioWorkerGatewayReadiness({
      host: "127.0.0.1",
      port: started.port,
      accessToken: TOKEN,
      clientCertificate: pki.clientCert,
      clientPrivateKey: pki.clientKey,
      serverCa: pki.caCert,
      requestTimeoutMs: 8_000,
    });

    expect(observation.serverCertificateFingerprint).toBe(
      `sha256:${new X509Certificate(pki.serverCert).fingerprint256.replaceAll(":", "").toLowerCase()}`,
    );
    expect(observation.readyzStatus).toBe(200);
  });

  it("令牌必须是推理受众的，客户端材料不能为空", () => {
    const base = {
      host: "127.0.0.1",
      port: 7443,
      clientCertificate: "cert",
      clientPrivateKey: "key",
      serverCa: "ca",
    };
    expect(() => createCaioWorkerGatewayClient({ ...base, accessToken: "hcaio_mcp_x" })).toThrow(
      /not an inference token/u,
    );
    expect(() => createCaioWorkerGatewayClient({ ...base, accessToken: TOKEN, clientCertificate: "" })).toThrow(
      /clientCertificate is empty/u,
    );
    expect(() => createCaioWorkerGatewayClient({ ...base, accessToken: TOKEN, port: 0 })).toThrow(
      /port is out of range/u,
    );
  });

  it("认领：带上 Bearer 与客户端证书，请求体里没有工作区字段", async () => {
    pki = makePki();
    const seen: Array<{ url: string; body: unknown }> = [];
    const started = await startServer(pki, (body, url) => {
      seen.push({ url, body });
      return {
        status: 200,
        body: {
          status: "claimed",
          jobId: "job_1",
          claimToken: "ct_1",
          inputHash: "sha256:abc",
          leaseExpiresAt: "2026-09-17T10:05:00.000Z",
          input: { schemaVersion: "helm.caio.inference-input.v1" },
        },
      };
    });
    open = started.server;
    const claim = await client(started.port, pki).claim({});
    expect(claim?.jobId).toBe("job_1");
    expect(seen[0].url).toBe("/v1/inference-jobs/claim");
    // 工作区由令牌决定：请求体里根本没有这个字段可写。
    expect(seen[0].body).toEqual({});
  });

  it("队列没有活 → null，不是错误", async () => {
    pki = makePki();
    const started = await startServer(pki, () => ({ status: 200, body: { status: "none" } }));
    open = started.server;
    expect(await client(started.port, pki).claim({})).toBeNull();
  });

  it("队列拒绝这次认领 → 也是 null（没有活可做，不是传输故障）", async () => {
    pki = makePki();
    const started = await startServer(pki, () => ({
      status: 200,
      body: { status: "rejected", jobId: "job_2", code: "dispatch_refused" },
    }));
    open = started.server;
    expect(await client(started.port, pki).claim({})).toBeNull();
  });

  it("非 2xx 带状态码抛出——「连不上」与「没有活」必须分得开", async () => {
    pki = makePki();
    const started = await startServer(pki, () => ({ status: 503, body: { error: "unavailable" } }));
    open = started.server;
    await expect(client(started.port, pki).claim({})).rejects.toThrow(/claim_failed:503/u);
  });

  it("提交结果原样带回，客户端不解释服务端的判断", async () => {
    pki = makePki();
    const started = await startServer(pki, () => ({
      status: 200,
      body: { status: "rejected", code: "lease_expired" },
    }));
    open = started.server;
    const outcome = await client(started.port, pki).submit({
      jobId: "job_1",
      claimToken: "ct_1",
      inputHash: "sha256:abc",
      output: { layers: [] },
    });
    // 不重试、不改写：服务端是唯一裁判。
    expect(outcome).toEqual({ status: "rejected", code: "lease_expired" });
  });

  it("没有客户端证书连不上——这条是本客户端存在的理由之一", async () => {
    pki = makePki();
    const started = await startServer(pki, () => ({ status: 200, body: { status: "none" } }));
    open = started.server;
    const naked = createCaioWorkerGatewayClient({
      host: "127.0.0.1",
      port: started.port,
      accessToken: TOKEN,
      // 用 CA 自己的证书冒充客户端证书：签名对不上服务端要求的客户端身份。
      clientCertificate: pki.caCert,
      clientPrivateKey: pki.serverKey,
      serverCa: pki.caCert,
      requestTimeoutMs: 5_000,
    });
    await expect(naked.claim({})).rejects.toThrow();
  });

  it("对面不是我们那台网关就必须拒——不放宽服务端证书校验", async () => {
    // 用另一套 PKI 起服务端：它能完成握手，但证书不是我们给的 CA 签的。
    // 放宽校验的话这条会静默通过，而那意味着 worker 会把冻结的经营上下文交给任何能握手的东西。
    const ours = makePki();
    const theirs = makePki();
    pki = ours;
    const started = await startServer(theirs, () => ({ status: 200, body: { status: "none" } }));
    open = started.server;
    const misdirected = createCaioWorkerGatewayClient({
      host: "127.0.0.1",
      port: started.port,
      accessToken: TOKEN,
      clientCertificate: theirs.clientCert,
      clientPrivateKey: theirs.clientKey,
      // 我们只信自己那套 CA。
      serverCa: ours.caCert,
      requestTimeoutMs: 5_000,
    });
    await expect(misdirected.claim({})).rejects.toThrow();
    rmSync(theirs.dir, { recursive: true, force: true });
  });

  it("认领报文形状不对即拒，不做部分接受", async () => {
    pki = makePki();
    const started = await startServer(pki, () => ({
      status: 200,
      body: { status: "claimed", jobId: "job_1", claimToken: "ct_1" },
    }));
    open = started.server;
    await expect(client(started.port, pki).claim({})).rejects.toThrow(/field_invalid:inputHash/u);
  });
});
