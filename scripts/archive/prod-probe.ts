export {};

type ProbeHop = {
  url: string;
  status?: number;
  location?: string | null;
  contentType?: string | null;
  error?: string;
  cause?: {
    code?: string;
    errno?: number;
    syscall?: string;
    hostname?: string;
    message?: string;
  };
};

function parseArgs(argv: string[]) {
  const args = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) {
      args.set(key, "true");
      continue;
    }
    args.set(key, value);
    i += 1;
  }
  return args;
}

function normalizeBaseUrl(input: string) {
  const base = input.trim().replace(/\/+$/, "");
  if (!base.startsWith("https://")) {
    throw new Error(`Base URL must start with https:// (got: ${input})`);
  }
  return base;
}

async function fetchWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { redirect: "manual", signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function probeUrl(url: string, opts: { maxHops: number; timeoutMs: number }) {
  const hops: ProbeHop[] = [];
  let current = url;

  for (let i = 0; i < opts.maxHops; i += 1) {
    try {
      const res = await fetchWithTimeout(current, opts.timeoutMs);
      const status = res.status;
      const location = res.headers.get("location");
      const contentType = res.headers.get("content-type");
      hops.push({ url: current, status, location, contentType });
      await res.arrayBuffer().catch(() => null);

      if (status >= 300 && status < 400 && location) {
        current = new URL(location, current).toString();
        continue;
      }

      return hops;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const cause = (err as unknown as { cause?: unknown }).cause;
      const normalizedCause =
        typeof cause === "object" && cause
          ? {
              code: (cause as { code?: string }).code,
              errno: (cause as { errno?: number }).errno,
              syscall: (cause as { syscall?: string }).syscall,
              hostname: (cause as { hostname?: string }).hostname,
              message: (cause as { message?: string }).message,
            }
          : undefined;

      hops.push({
        url: current,
        error: err.message,
        cause: normalizedCause,
      });
      return hops;
    }
  }

  hops.push({ url: current, error: "redirect limit reached" });
  return hops;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const rawBase = args.get("base") ?? process.env.HELM_PROD_PROBE_BASE_URL;
  if (!rawBase) {
    throw new Error("Missing required --base or HELM_PROD_PROBE_BASE_URL for production probe");
  }
  const base = normalizeBaseUrl(rawBase);
  const timeoutMs = Number(args.get("timeout-ms") ?? "12000");
  const maxHops = Number(args.get("max-hops") ?? "8");
  const rawPaths = (args.get("paths") ?? "/,/health,/operating,/workspace")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const targets = rawPaths.map((path) => new URL(path, `${base}/`).toString());
  const results: Record<string, ProbeHop[]> = {};

  for (const target of targets) {
    results[target] = await probeUrl(target, { maxHops, timeoutMs });
  }

  process.stdout.write(`${JSON.stringify({ base, timeoutMs, maxHops, results }, null, 2)}\n`);
}

await main();
