// Cross-repo conformance gate for the CAIO context-source descriptor wire
// contract (`helm.caio.context-source-descriptor.v1`).
//
// WHY THIS LIVES IN CORE
// The dependency direction is Overlay -> Pack SDK -> Core SDK, so a Pack may
// not import Core code: it references the contract by its version STRING and
// mirrors the shape. That mirroring is only safe if something proves the two
// sides still agree, so the proof sits on the OWNING side — Core, which holds
// the single strict schema — and reads the Pack's committed fixture as DATA.
// Reading a JSON fixture is not a code dependency, so the direction is kept.
//
// TWO SOURCES, BOTH ASSERTED
//  1. A byte-identical copy of the Pack fixture is committed here, so the gate
//     always has something to assert against — in the public projection, in a
//     fresh clone, and in CI where no sibling checkout exists.
//  2. When HELM_PACKS_ROOT points at a helm-packs checkout (the same env var
//     the overlays repo uses for `validate:composition`), the LIVE Pack fixture
//     is read too and must be byte-identical to the committed copy. That is the
//     drift detector: the Pack test pins the fixture to its adapter's real
//     output, this test pins the same bytes to Core's schema, so a change on
//     either side that is not mirrored fails here.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  CAIO_CONTEXT_SOURCE_DESCRIPTOR_SCHEMA_VERSION,
  LOCAL_ONLY_SOURCE_DENY_REASON,
  caioContextSourceDescriptorSchema,
  parseCaioContextSourceDescriptor,
  type ContextSourceDescriptor,
} from "@/lib/caio-context-broker/broker-contracts";
import { evaluateContextCandidate } from "@/lib/caio-context-broker/evaluation-pipeline";

/** Committed byte-identical copy of the Pack's contract fixture. */
const COMMITTED_FIXTURE_PATH =
  "lib/caio-context-broker/fixtures/pack-service-delivery-caio-context-source-descriptors.contract.json";

/** Path of the same fixture inside a helm-packs checkout. */
const PACK_FIXTURE_RELATIVE_PATH =
  "packs/service-delivery/operations/fixtures/caio-context-source-descriptors.contract.json";

const PACK_ROOT_ENV = "HELM_PACKS_ROOT";

function readCommittedFixture(): string {
  return readFileSync(resolve(process.cwd(), COMMITTED_FIXTURE_PATH), "utf8");
}

type ContractFixture = {
  contract: string;
  descriptors: readonly unknown[];
};

function parseFixture(raw: string): ContractFixture {
  return JSON.parse(raw) as ContractFixture;
}

const FULL_ELIGIBILITY = {
  identityAuthenticated: true,
  workspaceEligible: true,
  projectEligible: true,
  sourceIpAllowed: true,
  userCanAccessSource: true,
} as const;

describe("pack descriptor conformance — helm.caio.context-source-descriptor.v1", () => {
  const committed = readCommittedFixture();
  const fixture = parseFixture(committed);

  it("declares the contract version Core owns", () => {
    expect(fixture.contract).toBe(CAIO_CONTEXT_SOURCE_DESCRIPTOR_SCHEMA_VERSION);
    expect(fixture.descriptors.length).toBeGreaterThan(0);
  });

  it("parses every pack-emitted descriptor with Core's strict schema", () => {
    for (const [index, descriptor] of fixture.descriptors.entries()) {
      const parsed = caioContextSourceDescriptorSchema.safeParse(descriptor);
      expect(
        parsed.success,
        `descriptor[${index}] must satisfy the contract: ${
          parsed.success
            ? ""
            : parsed.error.issues
                .map(
                  (issue) =>
                    `${issue.path.join(".") || "<root>"}:${issue.code}`,
                )
                .join(" ")
        }`,
      ).toBe(true);
      // The validating parser is the entry point a runtime caller uses, so
      // assert it too rather than only the raw schema.
      expect(() => parseCaioContextSourceDescriptor(descriptor)).not.toThrow();
    }
  });

  it("exercises the localOnly:true branch and excludes it from external release", () => {
    const descriptors = fixture.descriptors.map((descriptor) =>
      parseCaioContextSourceDescriptor(descriptor),
    );
    const localOnly = descriptors.filter((descriptor) => descriptor.localOnly);
    expect(
      localOnly.length,
      "the shared fixture must keep covering the localOnly:true case",
    ).toBeGreaterThan(0);

    for (const descriptor of localOnly) {
      const source: ContextSourceDescriptor = descriptor;
      const result = evaluateContextCandidate({
        workspaceId: "ws-conformance",
        requestingProject: "proj-requesting",
        source,
        content: "Entirely clean synthetic settlement narrative.",
        eligibility: FULL_ELIGIBILITY,
        rules: [],
        policyVersion: "policy-v1",
      });
      expect(result.decision).toBe("DENY_EXTERNAL");
      expect(result.ruleHits).toContain(LOCAL_ONLY_SOURCE_DENY_REASON);
    }
  });

  it("releases a non-localOnly descriptor with clean content", () => {
    // Proves the exclusion above is the flag doing the work, not the fixture
    // being rejected for some unrelated reason.
    const releasable = fixture.descriptors
      .map((descriptor) => parseCaioContextSourceDescriptor(descriptor))
      .find((descriptor) => descriptor.localOnly === false);
    expect(releasable).toBeDefined();
    const result = evaluateContextCandidate({
      workspaceId: "ws-conformance",
      requestingProject: "proj-requesting",
      source: releasable as ContextSourceDescriptor,
      content: "Entirely clean synthetic delivery narrative.",
      eligibility: FULL_ELIGIBILITY,
      rules: [],
      policyVersion: "policy-v1",
    });
    expect(result.decision).toBe("ALLOW");
  });

  it("rejects a drifted descriptor, so this gate cannot pass vacuously", () => {
    const [first] = fixture.descriptors;
    expect(
      caioContextSourceDescriptorSchema.safeParse({
        ...(first as Record<string, unknown>),
        producedByPack: "service-delivery",
      }).success,
      "an added key must fail strict parsing",
    ).toBe(false);
    const withoutFlag: Record<string, unknown> = {
      ...(first as Record<string, unknown>),
    };
    delete withoutFlag.localOnly;
    expect(
      caioContextSourceDescriptorSchema.safeParse(withoutFlag).success,
      "a dropped localOnly flag must fail strict parsing",
    ).toBe(false);
  });

  const packRoot = process.env[PACK_ROOT_ENV];
  const liveFixtureTest = packRoot ? it : it.skip;

  liveFixtureTest(
    `matches the live helm-packs fixture byte for byte (set ${PACK_ROOT_ENV} to run)`,
    () => {
      // Skipped with this name when HELM_PACKS_ROOT is unset: the committed
      // copy above still gates the contract, so an unset env var never makes
      // the suite vacuous.
      const live = readFileSync(
        resolve(packRoot as string, PACK_FIXTURE_RELATIVE_PATH),
        "utf8",
      );
      expect(live).toBe(committed);
    },
  );
});
