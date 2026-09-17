//
// ONE ephemeral PKI fixture for the pull inference link, shared by every suite that needs mTLS.
//
// The gateway demands a client certificate (`requireClientCertificate: true`) and the worker client refuses
// to relax server verification, so any suite that exercises this link needs REAL certificates — a fake
// transport would replace the very property under test with the suite's own assertion.
//
// It is defined once, here, because two suites generating their own CA is how "the server the test starts"
// and "the server the worker actually talks to" quietly stop being the same thing. Each call mints a fresh
// throwaway CA in a temporary directory; nothing here is ever a deployment credential.
//

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/** The server certificate names the loopback address: the gateway only ever listens there. */
const SERVER_CN = "127.0.0.1";
const CLIENT_CN = "caio-inference-worker";

export type CaioWorkerPkiFixture = Readonly<{
  dir: string;
  caCert: string;
  serverCert: string;
  serverKey: string;
  clientCert: string;
  clientKey: string;
}>;

/**
 * Mint a throwaway CA plus a server and a client certificate, valid for one day.
 *
 * `openssl` is used rather than a library because the deployment's own material will be minted by the OWNER
 * with openssl too (see the PKI plan): a fixture built by a different tool could pass while the real
 * material fails on an extension neither side thought about.
 */
export function createCaioWorkerPkiFixture(): CaioWorkerPkiFixture {
  const dir = mkdtempSync(path.join(tmpdir(), "caio-worker-pki-"));
  const openssl = (args: string[]) =>
    execFileSync("openssl", args, { cwd: dir, stdio: ["ignore", "pipe", "pipe"] });

  openssl([
    "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", "ca.key", "-out", "ca.crt",
    "-days", "1", "-subj", "/CN=caio-test-ca",
  ]);
  for (const [name, cn] of [["server", SERVER_CN], ["client", CLIENT_CN]] as const) {
    openssl([
      "req", "-newkey", "rsa:2048", "-nodes", "-keyout", `${name}.key`, "-out", `${name}.csr`,
      "-subj", `/CN=${cn}`,
    ]);
    openssl([
      "x509", "-req", "-in", `${name}.csr`, "-CA", "ca.crt", "-CAkey", "ca.key",
      "-CAcreateserial", "-out", `${name}.crt`, "-days", "1",
      // Only the server certificate carries a SAN; a worker certificate is identified by its CA, not a name.
      ...(name === "server" ? ["-extfile", writeServerExtensions(dir)] : []),
    ]);
  }

  const read = (file: string) => readFileSync(path.join(dir, file), "utf8");
  return Object.freeze({
    dir,
    caCert: read("ca.crt"),
    serverCert: read("server.crt"),
    serverKey: read("server.key"),
    clientCert: read("client.crt"),
    clientKey: read("client.key"),
  });
}

/** Remove the temporary material. Safe to call with `null` so suites can clean up unconditionally. */
export function removeCaioWorkerPkiFixture(pki: CaioWorkerPkiFixture | null): void {
  if (pki === null) return;
  rmSync(pki.dir, { recursive: true, force: true });
}

function writeServerExtensions(dir: string): string {
  const file = path.join(dir, "server.ext");
  writeFileSync(file, `subjectAltName=IP:${SERVER_CN}\n`);
  return file;
}
