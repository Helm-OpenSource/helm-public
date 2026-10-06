type Mode = "legacy-optional" | "disabled" | "required";
type Result = Readonly<{ mode: Mode; status:
  "legacy-core-only" | "legacy-registered" | "disabled" | "initialized" }>;
type Bootstrap = {
  registerAllPacks?: unknown;
  serverBootstrapVersion?: unknown;
  serverBootstrapMode?: unknown;
  registerServerBootstrap?: unknown;
};
const refused = () => new Error("server_bootstrap_refused");

/** Creates the single initializer consumed by instrumentation. The source slot
 * is independent of the aggregator and env; it is not a payment approval. */
export function createServerBootstrapInitializer(binding: unknown,
  load: () => Promise<Bootstrap>) {
  if (!binding || typeof binding !== "object" ||
      Object.getPrototypeOf(binding) !== Object.prototype ||
      Reflect.ownKeys(binding).some(k => typeof k !== "string") ||
      Object.keys(binding).sort().join(",") !== "bootstrapVersion,mode,schema" ||
      Object.values(Object.getOwnPropertyDescriptors(binding)).some(d => !Object.hasOwn(d, "value"))) {
    throw new Error("server_bootstrap_binding_refused");
  }
  const b = binding as Record<string, unknown>;
  if (b.schema !== "helm.server-bootstrap-binding/v1" ||
      b.bootstrapVersion !== "helm.server-bootstrap/v1" ||
      !["legacy-optional", "disabled", "required"].includes(b.mode as string)) {
    throw new Error("server_bootstrap_binding_refused");
  }
  const mode = b.mode as Mode;
  let pending: Promise<Result> | undefined;
  let expired = false;
  async function initialize(): Promise<Result> {
    let m: Bootstrap;
    try { m = await load(); }
    catch { if (mode === "legacy-optional") return {mode, status:"legacy-core-only"}; throw refused(); }
    if (expired) throw refused();
    const versioned = m?.serverBootstrapVersion !== undefined || m?.registerServerBootstrap !== undefined;
    if (mode !== "legacy-optional" || versioned) {
      if (!m || m.serverBootstrapVersion !== "helm.server-bootstrap/v1" ||
          !["disabled", "required"].includes(m.serverBootstrapMode as string) ||
          m.serverBootstrapMode !== (mode === "legacy-optional" ? "disabled" : mode) ||
          Object.keys(m).sort().join(",") !== "registerAllPacks,registerServerBootstrap,serverBootstrapMode,serverBootstrapVersion" ||
          typeof m.registerServerBootstrap !== "function" || typeof m.registerAllPacks !== "function") throw refused();
    }
    try {
      if (typeof m?.registerAllPacks !== "function") throw refused();
      const result = m.registerAllPacks();
      if (versioned && result !== undefined) throw refused();
    } catch {
      if (mode === "legacy-optional" && !versioned) return {mode, status:"legacy-core-only"};
      throw refused();
    }
    if (!versioned) return {mode, status:"legacy-registered"};
    try {
      const result = (m.registerServerBootstrap as () => unknown)();
      if (!(result instanceof Promise)) throw refused();
      const value = await result;
      if (value !== undefined) throw refused();
      return {mode, status:m.serverBootstrapMode === "disabled" ? "disabled" : "initialized"};
    } catch { throw refused(); }
  }
  return () => {
    if (!pending) {
      let timer: ReturnType<typeof setTimeout>;
      pending = Promise.race([initialize(), new Promise<never>((_, reject) => {
        timer = setTimeout(() => { expired = true; reject(refused()); }, 10000);
      })]).finally(() => clearTimeout(timer));
    }
    return pending;
  };
}
