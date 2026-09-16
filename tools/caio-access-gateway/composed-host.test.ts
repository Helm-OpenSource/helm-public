import { describe, expect, it } from "vitest";

import {
  createComposedGatewayRouter,
  createGatewayHostAccounting,
  resolveComposedGatewaySurfaces,
  type ComposedGatewaySurface,
} from "./composed-host";

/**
 * 这一份只钉**宿主自己的**性质：路由归属、排空、并发、以及 WorkBuddy 端点可选。
 * 端到端的 TLS 与协议行为仍由 helm-self 的现有回归覆盖——纯搬移的判据是那一套结果不变，
 * 在这里重写一遍只会得到一份更弱的复制品。
 */
function surfaceStub(key: string, paths: readonly string[]): ComposedGatewaySurface {
  return Object.freeze({
    key,
    paths: Object.freeze([...paths]),
    serve: async () => {},
  }) as unknown as ComposedGatewaySurface;
}

function deferred(): { promise: Promise<void>; settle: () => void } {
  let settle!: () => void;
  const promise = new Promise<void>((resolve) => {
    settle = resolve;
  });
  return { promise, settle };
}

describe("组合网关宿主", () => {
  it("每条声明的路径只归一个 surface，其余一律不认领", () => {
    const gateway = surfaceStub("caio_access_gateway", ["/livez", "/v1/models"]);
    const router = createComposedGatewayRouter({ workBuddyPath: "/mcp/workbuddy", surfaces: [gateway] });

    expect(router.owner("/mcp/workbuddy")).toBe("workbuddy");
    expect(router.owner("/livez")).toBe(gateway);
    expect(router.owner("/v1/models?limit=1")).toBe(gateway);
    expect(router.owner("/")).toBeNull();
    expect(router.owner("/livez/../mcp/workbuddy")).toBeNull();
  });

  it("没有 WorkBuddy 端点时它的路径无人认领，surface 照常", () => {
    const gateway = surfaceStub("caio_access_gateway", ["/v1/inference-jobs/claim"]);
    const router = createComposedGatewayRouter({ workBuddyPath: null, surfaces: [gateway] });

    expect(router.owner("/v1/inference-jobs/claim")).toBe(gateway);
    expect(router.owner("/mcp/workbuddy")).toBeNull();
    expect(router.paths).toEqual(["/v1/inference-jobs/claim"]);
  });

  it("两个 surface 抢同一条路径时拒绝构建", () => {
    expect(() =>
      createComposedGatewayRouter({
        workBuddyPath: "/mcp/workbuddy",
        surfaces: [surfaceStub("a", ["/livez"]), surfaceStub("b", ["/livez"])],
      }),
    ).toThrow(/composed_gateway_route_conflict/u);
    expect(() =>
      createComposedGatewayRouter({ workBuddyPath: "/mcp/workbuddy", surfaces: [surfaceStub("a", ["livez"])] }),
    ).toThrow(/composed_gateway_route_invalid/u);
  });

  it("不挂访问网关时必须给出理由，不能靠省略", () => {
    const surface = surfaceStub("caio_access_gateway", ["/livez"]);
    expect(resolveComposedGatewaySurfaces({ mounted: true, surface })).toEqual([surface]);
    expect(resolveComposedGatewaySurfaces({ mounted: false, reason: "缺 project resolver" })).toEqual([]);
    expect(() => resolveComposedGatewaySurfaces({ mounted: false, reason: "   " })).toThrow(
      /access_gateway_declaration_reason_required/u,
    );
  });

  it("surface 请求执行中宿主不算 idle——排空的安全属性", async () => {
    const accounting = createGatewayHostAccounting({ maxConcurrentRequests: 2, requestTimeoutMs: 50_000 });
    const held = deferred();
    const entered = deferred();
    void accounting.runComposedOperation(async () => {
      entered.settle();
      await held.promise;
      return "done";
    });
    await entered.promise;

    expect(await accounting.waitForIdle(20)).toBe(false);
    expect(accounting.isAccepting()).toBe(true);
    held.settle();
    expect(await accounting.waitForIdle(1_000)).toBe(true);
  });

  it("并发上限与停机对 surface 同样生效", async () => {
    const accounting = createGatewayHostAccounting({ maxConcurrentRequests: 1, requestTimeoutMs: 50_000 });
    const held = deferred();
    const entered = deferred();
    void accounting.runComposedOperation(async () => {
      entered.settle();
      await held.promise;
      return "first";
    });
    await entered.promise;

    const busy = await accounting.runComposedOperation(async () => "second");
    expect(busy.admitted).toBe(false);
    expect(busy.admitted === false ? busy.reason : null).toBe("busy");

    accounting.beginShutdown();
    const afterShutdown = await accounting.runComposedOperation(async () => "third");
    expect(afterShutdown.admitted).toBe(false);
    expect(afterShutdown.admitted === false ? afterShutdown.reason : null).toBe("shutting-down");
    held.settle();
  });

  it("不合作操作的看门狗超时必须是可用的正数", () => {
    expect(() =>
      createGatewayHostAccounting({
        maxConcurrentRequests: 1,
        requestTimeoutMs: 1_000,
        uncooperativeOperationTimeoutMs: 0,
      }),
    ).toThrow(/uncooperative_operation_timeout_invalid/u);
  });
});
