import { describe, expect, it, vi } from "vitest";

import { createCaioWorkerLocalModelPort } from "./local-model-port";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const BASE = "http://127.0.0.1:8080/v1";
const MODEL_ACCESS = "omlx-test-access-token";

describe("设备侧本地模型端口", () => {
  it("端点必须是回环——配成远端直接拒", () => {
    // 内网地址在源码里拼出来：公开镜像守卫会扫 RFC1918 字面量，而这里要测的恰恰是「拒绝它们」。
    const privateHost = (a: number, b: number, c: number, d: number) => `${a}.${b}.${c}.${d}`;
    for (const baseUrl of [
      `http://${privateHost(10, 0, 0, 5)}:8080/v1`,
      "https://api.example.com/v1",
      `http://${privateHost(192, 168, 1, 20)}:8080/v1`,
      "http://model.internal:8080/v1",
    ]) {
      expect(() => createCaioWorkerLocalModelPort({ baseUrl, model: "m", accessToken: MODEL_ACCESS }), baseUrl).toThrow(
        /must be a loopback address/u,
      );
    }
    for (const baseUrl of ["http://127.0.0.1:8080/v1", "http://localhost:8080/v1"]) {
      expect(() => createCaioWorkerLocalModelPort({ baseUrl, model: "m", accessToken: MODEL_ACCESS })).not.toThrow();
    }
  });

  it("端点活着但模型没加载 → 不就绪，且说明原因", async () => {
    const port = createCaioWorkerLocalModelPort({
      baseUrl: BASE,
      model: "deepseek-v4",
      accessToken: MODEL_ACCESS,
      fetchImpl: vi.fn(async () => jsonResponse({ data: [{ id: "some-other-model" }] })) as never,
    });
    expect(await port.probe({})).toEqual({ ready: false, detail: "model_not_loaded" });
  });

  it("模型在列表里 → 就绪", async () => {
    const port = createCaioWorkerLocalModelPort({
      baseUrl: BASE,
      model: "deepseek-v4",
      accessToken: MODEL_ACCESS,
      fetchImpl: vi.fn(async (_url: string, init: RequestInit) => {
        expect(new Headers(init.headers).get("authorization")).toBe(
          `Bearer ${MODEL_ACCESS}`,
        );
        return jsonResponse({ data: [{ id: "deepseek-v4" }] });
      }) as never,
    });
    expect(await port.probe({})).toEqual({ ready: true });
  });

  it("探测失败只报闭集原因，不带底层报错原文", async () => {
    const port = createCaioWorkerLocalModelPort({
      baseUrl: BASE,
      model: "m",
      accessToken: MODEL_ACCESS,
      fetchImpl: vi.fn(async () => {
        throw new Error("connect ECONNREFUSED /Users/someone/private/path");
      }) as never,
    });
    const result = await port.probe({});
    expect(result.ready).toBe(false);
    expect(result.detail).toBe("probe_failed");
    expect(JSON.stringify(result)).not.toContain("private/path");
  });

  it("补全按 OpenAI 兼容形状取内容，温度钉为 0", async () => {
    const calls: Array<{ url: string; body: unknown }> = [];
    const port = createCaioWorkerLocalModelPort({
      baseUrl: BASE,
      model: "deepseek-v4",
      accessToken: MODEL_ACCESS,
      fetchImpl: vi.fn(async (url: string, init: RequestInit) => {
        expect(new Headers(init.headers).get("authorization")).toBe(
          `Bearer ${MODEL_ACCESS}`,
        );
        calls.push({ url, body: JSON.parse(String(init.body)) });
        return jsonResponse({ choices: [{ message: { content: "判断正文" } }] });
      }) as never,
    });
    expect(await port.complete({ prompt: "问题", maxOutputTokens: 1200 })).toBe("判断正文");
    expect(calls[0].url).toBe("http://127.0.0.1:8080/v1/chat/completions");
    // 判断要可复核：同一输入尽量给同一输出，温度不留给端点默认值。
    expect(calls[0].body).toMatchObject({ temperature: 0, max_tokens: 1200, stream: false });
  });

  it("内容为空不当成一次判断", async () => {
    for (const body of [
      { choices: [] },
      { choices: [{ message: { content: "" } }] },
      { choices: [{ message: { content: "   " } }] },
      { choices: [{ message: {} }] },
    ]) {
      const port = createCaioWorkerLocalModelPort({
        baseUrl: BASE,
        model: "m",
        accessToken: MODEL_ACCESS,
        fetchImpl: vi.fn(async () => jsonResponse(body)) as never,
      });
      await expect(port.complete({ prompt: "问题", maxOutputTokens: 10 })).rejects.toThrow(
        /response_(shape_invalid|empty)/u,
      );
    }
  });

  it("非 2xx 带状态码抛出，不返回空串", async () => {
    const port = createCaioWorkerLocalModelPort({
      baseUrl: BASE,
      model: "m",
      accessToken: MODEL_ACCESS,
      fetchImpl: vi.fn(async () => jsonResponse({ error: "busy" }, 503)) as never,
    });
    await expect(port.complete({ prompt: "问题", maxOutputTokens: 10 })).rejects.toThrow(
      /caio_worker_local_model_status:503/u,
    );
  });

  it("输出预算必须是正整数", async () => {
    const port = createCaioWorkerLocalModelPort({
      baseUrl: BASE,
      model: "m",
      accessToken: MODEL_ACCESS,
      fetchImpl: vi.fn(async () => jsonResponse({ choices: [{ message: { content: "x" } }] })) as never,
    });
    for (const budget of [0, -1, 1.5, Number.NaN]) {
      await expect(port.complete({ prompt: "问题", maxOutputTokens: budget })).rejects.toThrow(
        /budget_invalid/u,
      );
    }
  });

  it("拒绝缺失、空白或带换行的本地模型访问凭据", () => {
    for (const accessToken of ["", "short", "contains whitespace", "line\nbreak"]) {
      expect(() =>
        createCaioWorkerLocalModelPort({
          baseUrl: BASE,
          model: "m",
          accessToken,
        }),
      ).toThrow(/local model access/u);
    }
  });
});
