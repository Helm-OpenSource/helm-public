type OriginEnvironment = { NODE_ENV?: string; APP_URL?: string };
type HeaderReader = Pick<Headers, "get">;
const invalid = (): never => { throw new Error("public_origin_invalid"); };
const loopback = (host: string) => /^(?:localhost|127\.0\.0\.1|\[::1\])(?::([1-9][0-9]{0,4}))?$/.test(host);

/** Canonical public links must not inherit a caller-controlled proxy header. */
export function resolveTrustedPublicOrigin(env: OriginEnvironment, headers?: HeaderReader): string {
  const development = env.NODE_ENV === "development" || env.NODE_ENV === "test";
  if (env.APP_URL !== undefined && env.APP_URL !== "") {
    const raw = env.APP_URL;
    if (raw !== raw.trim() || /[\\\s]/.test(raw)) return invalid();
    let url: URL;
    try { url = new URL(raw); } catch { return invalid(); }
    if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== "/") return invalid();
    if (url.protocol !== "https:" && !(development && loopback(url.host))) return invalid();
    return url.origin;
  }
  if (!development) return invalid();
  // Forwarded headers are intentionally ignored even in development.
  const host = headers?.get("host") ?? "localhost:3000";
  if (!loopback(host)) return invalid();
  let url: URL;
  try { url = new URL(`http://${host}`); } catch { return invalid(); }
  if (url.port && Number(url.port) > 65535) return invalid();
  return url.origin;
}
