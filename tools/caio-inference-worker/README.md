# CAIO inference worker

The device worker pulls only governed inference jobs and talks to a loopback
OpenAI-compatible model. Runtime configuration and every credential stay in one
same-owner `0700` directory as separate same-owner `0600` files.

## Candidate readiness attestation

An owner-controlled release coordinator may issue a short-lived
`anson.caio-inference-readiness-challenge.v1` file in that private directory.
Run the non-work-claiming check before a candidate cutover:

```bash
HELM_CAIO_INFERENCE_WORKER_CONFIG=/absolute/private/inference-worker.json \
  node --import tsx tools/caio-inference-worker/runtime-cli.ts \
  readiness-attest \
  --challenge-file /absolute/private/readiness-challenge.json \
  --output /absolute/private/transport-readiness.json
```

The command requires a challenge valid for at most 15 minutes and binds its
candidate runtime, build, gateway-entrypoint and runtime-environment digests. It
probes the configured local model, checks the gateway over the configured mTLS
identity, fingerprints the server certificate, proves a connection without the
client certificate is rejected, and requires the WorkBuddy and private-execution
routes to remain absent. The existing client EC key signs the receipt with
ECDSA-SHA256. Output is a new `0600` file; an existing path is never replaced.

The command prints only success and the receipt digest. It does not print HTTP
bodies, tokens, certificates, or private keys, and it does not claim or submit a
job.

## Boundary

This transport receipt is evidence for one challenge and one candidate. It is
not activation, cutover approval, rollback execution, production readiness, or
proof of business results. A verifier must independently trust the issuer
certificate, validate the signature and exact candidate fields, consume the
challenge once before expiry, and retain a separately verified rollback target.
