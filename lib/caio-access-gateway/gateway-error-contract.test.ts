import { describe, expect, it } from "vitest";

import {
  CaioAccessGatewayError,
  caioAuditRefusalWireError,
  caioGatewayWireErrorFromError,
  isCaioAccessGatewayError,
  toGatewayError,
} from "@/lib/caio-access-gateway/gateway-error-contract";

describe("toGatewayError", () => {
  it("maps 401 to caio_unauthorized with a reason", () => {
    const wire = toGatewayError({ status: 401, reason: "token_expired" });
    expect(wire.status).toBe(401);
    expect(wire.body).toEqual({
      error: "caio_unauthorized",
      reason: "token_expired",
    });
    expect(wire.headers).toEqual({});
  });

  it("maps 403 to caio_forbidden with a reason", () => {
    const wire = toGatewayError({
      status: 403,
      reason: "source_ip_mismatch",
    });
    expect(wire.status).toBe(403);
    expect(wire.body).toEqual({
      error: "caio_forbidden",
      reason: "source_ip_mismatch",
    });
  });

  it("maps 422 to caio_external_release_denied without a reason", () => {
    const wire = toGatewayError({ status: 422 });
    expect(wire.body).toEqual({ error: "caio_external_release_denied" });
  });

  it("maps 429 to caio_rate_limited with a Retry-After header", () => {
    const wire = toGatewayError({ status: 429, retryAfterSeconds: 17 });
    expect(wire.status).toBe(429);
    expect(wire.body).toEqual({ error: "caio_rate_limited" });
    expect(wire.headers["retry-after"]).toBe("17");
  });

  it("maps 502 to caio_upstream_failed", () => {
    expect(toGatewayError({ status: 502 }).body).toEqual({
      error: "caio_upstream_failed",
    });
  });

  it("maps 503 to audit-unavailable or no-route with Retry-After", () => {
    const audit = toGatewayError({
      status: 503,
      error: "caio_audit_unavailable",
      retryAfterSeconds: 5,
    });
    expect(audit.body).toEqual({ error: "caio_audit_unavailable" });
    expect(audit.headers["retry-after"]).toBe("5");
    const noRoute = toGatewayError({
      status: 503,
      error: "caio_no_route",
      retryAfterSeconds: 30,
    });
    expect(noRoute.body).toEqual({ error: "caio_no_route" });
    expect(noRoute.headers["retry-after"]).toBe("30");
  });

  it("maps a receipt conflict to a permanent 409 with no Retry-After", () => {
    const wire = toGatewayError({
      status: 409,
      error: "caio_audit_receipt_conflict",
    });
    expect(wire.status).toBe(409);
    expect(wire.body).toEqual({ error: "caio_audit_receipt_conflict" });
    expect(wire.headers["retry-after"]).toBeUndefined();
  });

  it("maps a replay-cap hit to 429 caio_audit_replay_limit_exceeded", () => {
    const permanent = toGatewayError({
      status: 429,
      error: "caio_audit_replay_limit_exceeded",
      retryAfterSeconds: null,
    });
    expect(permanent.status).toBe(429);
    expect(permanent.body).toEqual({
      error: "caio_audit_replay_limit_exceeded",
    });
    expect(permanent.headers["retry-after"]).toBeUndefined();
    const advised = toGatewayError({
      status: 429,
      error: "caio_audit_replay_limit_exceeded",
      retryAfterSeconds: 11,
    });
    expect(advised.headers["retry-after"]).toBe("11");
  });

  it("omits Retry-After on a 503 whose retryAfterSeconds is null", () => {
    const wire = toGatewayError({
      status: 503,
      error: "caio_audit_unavailable",
      retryAfterSeconds: null,
    });
    expect(wire.status).toBe(503);
    expect(wire.body).toEqual({ error: "caio_audit_unavailable" });
    expect(wire.headers["retry-after"]).toBeUndefined();
    expect(JSON.stringify(wire.headers)).not.toContain("undefined");
  });

  it("sanitizes free-form reasons so bodies never carry secrets", () => {
    const secret = "Bearer hcaio_mcp_SECRETSECRETSECRET token=abc";
    const wire = toGatewayError({ status: 401, reason: secret });
    expect(JSON.stringify(wire.body)).not.toContain("SECRET");
    expect(wire.body.reason).toBe("unspecified");
    expect(
      toGatewayError({ status: 403, reason: "sha256:deadbeef" }).body.reason,
    ).toBe("unspecified");
  });
});

describe("CaioAccessGatewayError", () => {
  it("binds each code to its wire status and keeps messages code-only", () => {
    const cases: Array<[ConstructorParameters<typeof CaioAccessGatewayError>[0], number]> =
      [
        ["token_unknown", 401],
        ["token_expired", 401],
        ["token_revoked", 401],
        ["token_rotated", 401],
        ["audience_mismatch", 401],
        ["source_ip_mismatch", 403],
        ["project_access_revoked", 403],
        ["scope_violation", 403],
        ["active_token_exists", 409],
        ["rotation_conflict", 409],
        ["external_release_denied", 422],
        ["rate_limited", 429],
        ["upstream_failed", 502],
        ["audit_unavailable", 503],
        ["no_route", 503],
      ];
    for (const [code, status] of cases) {
      const error = new CaioAccessGatewayError(code);
      expect(error.wireStatus).toBe(status);
      expect(error.message).toBe(code);
      expect(isCaioAccessGatewayError(error)).toBe(true);
    }
    expect(isCaioAccessGatewayError(new Error("rate_limited"))).toBe(false);
  });

  it("round-trips typed errors onto the wire contract", () => {
    const limited = caioGatewayWireErrorFromError(
      new CaioAccessGatewayError("rate_limited", { retryAfterSeconds: 42 }),
    );
    expect(limited.status).toBe(429);
    expect(limited.headers["retry-after"]).toBe("42");

    const swap = caioGatewayWireErrorFromError(
      new CaioAccessGatewayError("audience_mismatch"),
    );
    expect(swap.status).toBe(401);
    expect(swap.body).toEqual({
      error: "caio_unauthorized",
      reason: "audience_mismatch",
    });

    const noRoute = caioGatewayWireErrorFromError(
      new CaioAccessGatewayError("no_route", { retryAfterSeconds: 3 }),
    );
    expect(noRoute.status).toBe(503);
    expect(noRoute.body).toEqual({ error: "caio_no_route" });

    const audit = caioGatewayWireErrorFromError(
      new CaioAccessGatewayError("audit_unavailable"),
    );
    expect(audit.status).toBe(503);
    expect(audit.body).toEqual({ error: "caio_audit_unavailable" });
    expect(Number(audit.headers["retry-after"])).toBeGreaterThan(0);
  });

  it("binds the two audit refusal codes to 409 and 429", () => {
    const conflict = caioGatewayWireErrorFromError(
      new CaioAccessGatewayError("audit_receipt_conflict"),
    );
    expect(conflict.status).toBe(409);
    expect(conflict.body).toEqual({ error: "caio_audit_receipt_conflict" });
    expect(conflict.headers["retry-after"]).toBeUndefined();

    const replay = caioGatewayWireErrorFromError(
      new CaioAccessGatewayError("audit_replay_limit_exceeded"),
    );
    expect(replay.status).toBe(429);
    expect(replay.body).toEqual({
      error: "caio_audit_replay_limit_exceeded",
    });
    expect(replay.headers["retry-after"]).toBeUndefined();
  });
});

describe("caioAuditRefusalWireError", () => {
  it("maps the three canonical refusal statuses onto 503, 409 and 429", () => {
    const unavailable = caioAuditRefusalWireError({
      status: "audit_unavailable",
      errorCode: "caio_audit_unavailable",
      httpStatus: 503,
      retryAfterSeconds: 30,
    });
    expect(unavailable.status).toBe(503);
    expect(unavailable.body).toEqual({ error: "caio_audit_unavailable" });
    expect(unavailable.headers["retry-after"]).toBe("30");

    const conflict = caioAuditRefusalWireError({
      status: "receipt_conflict",
      errorCode: "caio_audit_receipt_conflict",
      httpStatus: 409,
      retryAfterSeconds: null,
    });
    expect(conflict.status).toBe(409);
    expect(conflict.body).toEqual({ error: "caio_audit_receipt_conflict" });
    expect(conflict.headers["retry-after"]).toBeUndefined();

    const replayLimit = caioAuditRefusalWireError({
      status: "replay_limit_exceeded",
      errorCode: "caio_audit_replay_limit_exceeded",
      httpStatus: 429,
      retryAfterSeconds: null,
    });
    expect(replayLimit.status).toBe(429);
    expect(replayLimit.body).toEqual({
      error: "caio_audit_replay_limit_exceeded",
    });
    expect(replayLimit.headers["retry-after"]).toBeUndefined();
  });

  it("trusts the refusal status over a mis-set httpStatus from a JS gate", () => {
    // The port is injectable: a JS implementation can report httpStatus 200 on
    // a refusal. The discriminant decides the wire status, never the number.
    const wire = caioAuditRefusalWireError({
      status: "receipt_conflict",
      errorCode: "caio_audit_receipt_conflict",
      httpStatus: 200,
      retryAfterSeconds: null,
    });
    expect(wire.status).toBe(409);
  });

  it("never emits an undefined Retry-After for an unmodelled status", () => {
    const wire = caioAuditRefusalWireError({
      status: "something_new",
      errorCode: "caio_audit_unavailable",
      httpStatus: 503,
    } as never);
    expect(wire.status).toBe(503);
    expect(wire.body).toEqual({ error: "caio_audit_unavailable" });
    expect(wire.headers["retry-after"]).toBeUndefined();
  });
});
