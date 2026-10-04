import {afterEach, describe, expect, it, vi} from "vitest";

const counts = { databaseModuleLoads: 0 };
vi.mock("@/lib/db", () => { counts.databaseModuleLoads += 1; return {db: {}}; });
afterEach(() => { vi.resetModules(); counts.databaseModuleLoads = 0; vi.unstubAllEnvs(); vi.doUnmock("@/lib/caio-collaboration/runtime-binding"); });

describe("WorkBuddy actual route dependency admission", () => {
  it("unconfigured legacy POST returns 503 without loading the database dependency", async () => {
    vi.stubEnv("CAIO_WORKBUDDY_EDGE_SHARED_SECRET", "");
    vi.stubEnv("CAIO_WORKBUDDY_EDGE_WORKSPACE_SYSTEM_KEY", "");
    const {POST} = await import("@/app/api/runtime/caio/workbuddy/route");
    const response = await POST(new Request("https://example.test/api/runtime/caio/workbuddy", {method: "POST", body: "not-json"}));
    expect(response.status).toBe(503);
    expect(counts.databaseModuleLoads).toBe(0);
  });
});


describe("Fixed WorkBuddy binding policy", () => {
  it.each([null, undefined, "legacy-configured", {}, [],
    {schemaVersion: "unknown", routePath: "/api/runtime/caio/workbuddy", mode: "legacy-configured"},
    {schemaVersion: "helm.caio.workbuddy-route-binding.v1", routePath: "/other", mode: "legacy-configured"},
    {schemaVersion: "helm.caio.workbuddy-route-binding.v1", routePath: "/api/runtime/caio/workbuddy", mode: "future"},
    {schemaVersion: "helm.caio.workbuddy-route-binding.v1", routePath: "/api/runtime/caio/workbuddy", mode: "legacy-configured", approved: true},
  ])("unknown shape is refused", async value => {
    const {admitWorkBuddyRoute} = await import("./route-admission");
    expect(admitWorkBuddyRoute(value)).toBe(false);
  });
  it("a throwing proxy is refused without invoking traps", async () => {
    let traps = 0;
    const value = new Proxy({}, {getPrototypeOf() {traps++; throw new Error("private-marker");}});
    const {admitWorkBuddyRoute} = await import("./route-admission");
    expect(admitWorkBuddyRoute(value)).toBe(false);
    expect(traps).toBe(0);
  });
  it("accessor fields are refused without invoking getters", async () => {
    let reads = 0;
    const value = {schemaVersion: "helm.caio.workbuddy-route-binding.v1", routePath: "/api/runtime/caio/workbuddy", get mode() {reads++; return "legacy-configured";}};
    const {admitWorkBuddyRoute} = await import("./route-admission");
    expect(admitWorkBuddyRoute(value)).toBe(false);
    expect(reads).toBe(0);
  });
  it("the fixed legacy default is admitted and frozen", async () => {
    const {admitWorkBuddyRoute} = await import("./route-admission");
    const {WORKBUDDY_RUNTIME_BINDING} = await import("./runtime-binding");
    expect(Object.isFrozen(WORKBUDDY_RUNTIME_BINDING)).toBe(true);
    expect(admitWorkBuddyRoute(WORKBUDDY_RUNTIME_BINDING)).toBe(true);
  });
  it.each(["disabled", "future"])("actual route %s binding refuses before config/body/database", async mode => {
    vi.doMock("@/lib/caio-collaboration/runtime-binding", () => ({WORKBUDDY_RUNTIME_BINDING: {schemaVersion: "helm.caio.workbuddy-route-binding.v1", routePath: "/api/runtime/caio/workbuddy", mode}}));
    vi.stubEnv("CAIO_WORKBUDDY_EDGE_SHARED_SECRET", "s".repeat(48));
    vi.stubEnv("CAIO_WORKBUDDY_EDGE_WORKSPACE_SYSTEM_KEY", "reserved_workspace");
    vi.stubEnv("HELM_RUNTIME_DEPLOYMENT_ID", "deployment-reserved");
    vi.stubEnv("HELM_DEPLOYMENT_KEY", "caller-claimed");
    const {POST} = await import("@/app/api/runtime/caio/workbuddy/route");
    const request = new Request("https://example.test/api/runtime/caio/workbuddy", {method: "POST"});
    Object.defineProperty(request, "body", {get() {throw new Error("body-must-not-be-read");}});
    Object.defineProperty(request, "headers", {get() {throw new Error("headers-must-not-be-read");}});
    const previousEnv = process.env;
    let credentialReads = 0;
    process.env = new Proxy(previousEnv, {get(target,key) {
      if (typeof key === "string" && key.startsWith("CAIO_WORKBUDDY_")) {credentialReads++; throw new Error("config-must-not-be-read");}
      return Reflect.get(target,key);
    }});
    let response: Response;
    try { response = await POST(request); } finally { process.env = previousEnv; }
    expect(credentialReads).toBe(0);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ok: false, error: "workbuddy_edge_not_configured"});
    expect(counts.databaseModuleLoads).toBe(0);
  });
});


it("legacy configured route retains its real credential rejection after lazy loading", async () => {
  vi.stubEnv("CAIO_WORKBUDDY_EDGE_SHARED_SECRET", "s".repeat(48));
  vi.stubEnv("CAIO_WORKBUDDY_EDGE_WORKSPACE_SYSTEM_KEY", "reserved_workspace");
  const {POST} = await import("@/app/api/runtime/caio/workbuddy/route");
  const response = await POST(new Request("https://example.test/api/runtime/caio/workbuddy", {method: "POST", body: "{}"}));
  expect(response.status).toBe(401);
  await expect(response.json()).resolves.toEqual({ok: false, error: "workbuddy_edge_unauthorized"});
  expect(counts.databaseModuleLoads).toBe(1);
});
