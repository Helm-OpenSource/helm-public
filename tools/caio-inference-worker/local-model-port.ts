import type { CaioWorkerLocalModelPort } from "./contracts";

/**
 * 本地模型端口：对着设备上的 OpenAI 兼容端点（现场是 oMLX）。
 *
 * ── 为什么只要两个方法 ──────────────────────────────────────────────
 * `probe` 便宜、用于认领之前判断这台设备现在能不能干活；`complete` 出一次补全。
 * worker **不自己重试补全**——重试要占着租约，而租约是队列在管的；
 * 由队列按租约到期回收、再交给下一次认领，比在这里偷偷重试干净。
 *
 * ── 端点必须是本机 ──────────────────────────────────────────────────
 * 这个端口的存在前提是「数据不出域」：模型在现场设备上。所以只接受回环地址，
 * 配成远端就直接拒——那等于把冻结的经营上下文发给第三方，而这正是整条链要避免的事。
 *
 * ── 失败即关，且不猜 ────────────────────────────────────────────────
 * 非 2xx、形状不对、内容为空，一律抛错并带闭集原因；worker 把它记成 model_failed，
 * 不把空串当成一次「模型说了没有问题」的判断。
 */

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
/** 补全响应上限：一次判断的输出被路由策略限住，远小于此。 */
const MAX_RESPONSE_BYTES = 1024 * 1024;

export type CaioWorkerLocalModelConfig = Readonly<{
  /** OpenAI 兼容端点基址，必须是回环，例如 http://127.0.0.1:8080/v1 。 */
  baseUrl: string;
  /** 模型名。由设备侧决定，与路由策略里登记的适配器版本一并构成可追溯性。 */
  model: string;
  /** 设备本地模型端点访问凭据；仅从 owner-private 0600 文件加载。 */
  accessToken: string;
  /** 探测与补全各自的时限。补全默认给得宽，本地大模型首 token 可能较慢。 */
  probeTimeoutMs?: number;
  completeTimeoutMs?: number;
  /** 注入便于测试；默认用全局 fetch。 */
  fetchImpl?: typeof fetch;
}>;

export function createCaioWorkerLocalModelPort(
  config: CaioWorkerLocalModelConfig,
): CaioWorkerLocalModelPort {
  const base = assertLoopbackBase(config.baseUrl);
  const authorization = `Bearer ${assertLocalModelAccessToken(config.accessToken)}`;
  const doFetch = config.fetchImpl ?? fetch;
  const probeTimeoutMs = config.probeTimeoutMs ?? 5_000;
  const completeTimeoutMs = config.completeTimeoutMs ?? 300_000;
  if (!config.model || config.model.length > 200) {
    throw new Error("invalid caio worker local model: model name is required");
  }

  return Object.freeze({
    probe: async ({ signal }) => {
      try {
        const response = await withDeadline(
          (deadlineSignal) => doFetch(`${base}/models`, {
            method: "GET",
            headers: { authorization },
            signal: deadlineSignal,
          }),
          probeTimeoutMs,
          signal,
        );
        if (!response.ok) {
          return { ready: false, detail: `models_status_${response.status}` };
        }
        const body = (await response.json()) as unknown;
        // 端点活着不等于我们要的那个模型在：列表里没有它，就不该去认领作业。
        return listsModel(body, config.model)
          ? { ready: true }
          : { ready: false, detail: "model_not_loaded" };
      } catch (error) {
        // 探测失败只报闭集原因，不把底层报错原文带出去（可能含本机路径）。
        return { ready: false, detail: error instanceof Error && error.name === "AbortError" ? "probe_timeout" : "probe_failed" };
      }
    },
    complete: async ({ prompt, maxOutputTokens, signal }) => {
      if (!prompt || prompt.length === 0) throw new Error("caio_worker_local_model_prompt_empty");
      if (!Number.isInteger(maxOutputTokens) || maxOutputTokens < 1) {
        throw new Error("caio_worker_local_model_budget_invalid");
      }
      const response = await withDeadline(
        (deadlineSignal) =>
          doFetch(`${base}/chat/completions`, {
            method: "POST",
            headers: {
              authorization,
              "content-type": "application/json; charset=utf-8",
            },
            body: JSON.stringify({
              model: config.model,
              max_tokens: maxOutputTokens,
              // 判断要可复核：同一输入尽量给同一输出，温度不留给端点默认值。
              temperature: 0,
              stream: false,
              messages: [{ role: "user", content: prompt }],
            }),
            signal: deadlineSignal,
          }),
        completeTimeoutMs,
        signal,
      );
      if (!response.ok) {
        throw new Error(`caio_worker_local_model_status:${response.status}`);
      }
      const text = await readBounded(response);
      return extractContent(text);
    },
  });
}

function assertLocalModelAccessToken(value: string): string {
  if (
    typeof value !== "string" ||
    value.length < 16 ||
    value.length > 4_096 ||
    /\s/u.test(value)
  ) {
    throw new Error("invalid caio worker local model access");
  }
  return value;
}

function assertLoopbackBase(baseUrl: string): string {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new Error("invalid caio worker local model: baseUrl is not a URL");
  }
  if (!LOOPBACK_HOSTS.has(url.hostname) && !LOOPBACK_HOSTS.has(url.host)) {
    // 这是「数据不出域」的落点：模型必须在本机。配成远端等于把冻结的经营上下文发给第三方。
    throw new Error("invalid caio worker local model: baseUrl must be a loopback address");
  }
  return `${url.origin}${url.pathname.replace(/\/+$/u, "")}`;
}

async function withDeadline<T>(
  run: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  external?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("deadline")), timeoutMs);
  const onExternalAbort = () => controller.abort(new Error("aborted"));
  external?.addEventListener("abort", onExternalAbort, { once: true });
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
    external?.removeEventListener("abort", onExternalAbort);
  }
}

async function readBounded(response: Response): Promise<string> {
  const text = await response.text();
  if (Buffer.byteLength(text, "utf8") > MAX_RESPONSE_BYTES) {
    throw new Error("caio_worker_local_model_response_too_large");
  }
  return text;
}

function listsModel(body: unknown, model: string): boolean {
  if (body === null || typeof body !== "object") return false;
  const data = (body as { data?: unknown }).data;
  if (!Array.isArray(data)) return false;
  return data.some((entry) => typeof entry === "object" && entry !== null && (entry as { id?: unknown }).id === model);
}

/** 只认 OpenAI 兼容的那一个位置；内容为空即抛，不把空串当成一次判断。 */
function extractContent(text: string): string {
  let body: unknown;
  try {
    body = JSON.parse(text) as unknown;
  } catch {
    throw new Error("caio_worker_local_model_response_not_json");
  }
  const choices = (body as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new Error("caio_worker_local_model_response_shape_invalid");
  }
  const content = (choices[0] as { message?: { content?: unknown } }).message?.content;
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error("caio_worker_local_model_response_empty");
  }
  return content;
}
