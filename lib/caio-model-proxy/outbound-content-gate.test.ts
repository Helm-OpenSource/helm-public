import { describe, expect, it } from "vitest";

import {
  NON_REDACTABLE_HARD_BOUNDARY_CATEGORIES,
  detectHardBoundaryHits,
} from "@/lib/caio-context-broker/broker-contracts";

import {
  CAIO_OUTBOUND_DENY_CATEGORIES,
  CaioOutboundContentDeniedError,
  assertCaioOutboundContentAllowed,
  assessCaioOutboundContent,
} from "./outbound-content-gate";

describe("caio outbound content boundary", () => {
  it("allows an ordinary coding-assistant body", () => {
    expect(
      assessCaioOutboundContent({
        model: "caio-codex-default",
        input: "refactor this function to return early",
      }),
    ).toEqual({ denied: false });
  });

  it("refuses a body carrying private key material", () => {
    const assessment = assessCaioOutboundContent({
      model: "caio-codex-default",
      input:
        "why does this fail?\n-----BEGIN RSA PRIVATE KEY-----\nMIIEow==\n-----END RSA PRIVATE KEY-----",
    });
    expect(assessment.denied).toBe(true);
    if (!assessment.denied) return;
    expect(assessment.categories).toContain("private_key");
  });

  it("refuses a secret nested inside a tool argument, not just top-level text", () => {
    const assessment = assessCaioOutboundContent({
      model: "caio-codex-default",
      tools: [
        {
          type: "function",
          name: "connect",
          arguments: {
            // Assembled at runtime: the literal must not appear in source, or
            // the public-mirror credential scanner flags this fixture itself.
            dsn: ["mysql://svc", "pw@db.internal:3306/app"].join(":"),
          },
        },
      ],
    });
    expect(assessment.denied).toBe(true);
    if (!assessment.denied) return;
    expect(assessment.categories).toContain("connection_string");
  });

  // Marker categories refer to the surrounding document, so they can never be
  // redacted away and must always deny.
  it("always refuses a non-redactable marker category", () => {
    const assessment = assessCaioOutboundContent({
      model: "caio-codex-default",
      input: "[[LOCAL-ONLY]] internal design note",
    });
    expect(assessment.denied).toBe(true);
    if (!assessment.denied) return;
    expect(assessment.nonRedactable).toBe(true);
    for (const category of NON_REDACTABLE_HARD_BOUNDARY_CATEGORIES) {
      expect(CAIO_OUTBOUND_DENY_CATEGORIES).toContain(category);
    }
  });

  // The refusal must not become a second channel for the secret it refused.
  it("reports category codes only — never the matched text or its offsets", () => {
    const vendorShapedValue = ["sk", "live", "ABCDEFGH12345678"].join("_");
    const assessment = assessCaioOutboundContent({
      model: "caio-codex-default",
      input: `token: ${vendorShapedValue}`,
    });
    expect(assessment.denied).toBe(true);
    const serialized = JSON.stringify(assessment);
    expect(serialized).not.toContain(vendorShapedValue);
    expect(serialized).not.toContain("start");
    expect(serialized).not.toContain("end");
  });

  it("reuses the broker's detector rather than declaring a second one", () => {
    const body = { input: "Authorization: Bearer abc.def.ghi" };
    const brokerHits = detectHardBoundaryHits(JSON.stringify(body));
    expect(brokerHits.length).toBeGreaterThan(0);
    expect(assessCaioOutboundContent(body).denied).toBe(true);
  });

  it("throws a typed error from the assert form", () => {
    expect(() =>
      assertCaioOutboundContentAllowed({ input: "all clear" }),
    ).not.toThrow();
    let caught: unknown;
    try {
      assertCaioOutboundContentAllowed({
        input: "password: correct horse battery staple",
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(CaioOutboundContentDeniedError);
    expect((caught as CaioOutboundContentDeniedError).code).toBe(
      "caio_content_boundary_denied",
    );
    expect((caught as CaioOutboundContentDeniedError).categories).toContain(
      "password",
    );
  });

  it("refuses a body it cannot canonicalize instead of forwarding it", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(assessCaioOutboundContent(cyclic).denied).toBe(true);
  });
});
