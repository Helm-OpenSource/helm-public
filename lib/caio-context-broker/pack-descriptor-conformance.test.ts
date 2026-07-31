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
//
// WHEN THE SECOND SOURCE IS ABSENT it is REPORTED, not silently skipped: the
// test that covers it always runs and says in its NAME whether the cross-repo
// comparison happened, warns with the env var to set, and fails outright when
// HELM_PACKS_ROOT_REQUIRED=1 declares that the comparison was expected.

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
/** Set to "1" to make a missing HELM_PACKS_ROOT a failure, not a report. */
const PACK_ROOT_REQUIRED_ENV = "HELM_PACKS_ROOT_REQUIRED";

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

  // CROSS-REPO DRIFT DETECTOR — reported, never silent.
  //
  // helm-packs is a separate repository and this repo's CI has no checkout of
  // it, so the live comparison cannot run there. The DECISION is therefore:
  // keep the committed byte-identical copy as the gate that always runs, and
  // make the missing half impossible to miss:
  //   1. a test that ALWAYS runs states, by name, whether the live comparison
  //      ran — so "0 failures" can never be mistaken for "both halves ran";
  //   2. a warning names the env var and what was not checked;
  //   3. HELM_PACKS_ROOT_REQUIRED=1 turns the absence into a FAILURE, so a job
  //      that means to run the cross-repo check cannot silently skip it.
  const packRoot = process.env[PACK_ROOT_ENV];
  const packRootRequired = process.env[PACK_ROOT_REQUIRED_ENV] === "1";

  it(
    packRoot
      ? `cross-repo drift detector RAN against ${PACK_ROOT_ENV}`
      : `cross-repo drift detector DID NOT RUN — ${PACK_ROOT_ENV} is unset (committed copy still gates this contract)`,
    () => {
      if (!packRoot) {
        const message =
          `[pack-descriptor-conformance] cross-repo drift check SKIPPED: ${PACK_ROOT_ENV} is unset. ` +
          `The committed copy at ${COMMITTED_FIXTURE_PATH} was still asserted against Core's schema, ` +
          `but nothing here proves it still matches ${PACK_FIXTURE_RELATIVE_PATH} in helm-packs. ` +
          `Set ${PACK_ROOT_ENV}=<helm-packs checkout> to run it, or ${PACK_ROOT_REQUIRED_ENV}=1 to make its absence a failure.`;
        console.warn(message);
        expect(
          packRootRequired,
          `${PACK_ROOT_REQUIRED_ENV}=1 demands the cross-repo comparison, but ${PACK_ROOT_ENV} is unset`,
        ).toBe(false);
        return;
      }
      const livePath = resolve(packRoot, PACK_FIXTURE_RELATIVE_PATH);
      let live: string;
      try {
        live = readFileSync(livePath, "utf8");
      } catch {
        // A pointed-at checkout with no fixture is a DRIFT report, not an
        // ENOENT stack: the pack side has not landed (or has removed) the file
        // this committed copy mirrors.
        throw new Error(
          `${PACK_ROOT_ENV} points at ${packRoot}, but ${PACK_FIXTURE_RELATIVE_PATH} is absent there. ` +
            `Check out the helm-packs branch that carries the fixture, or unset ${PACK_ROOT_ENV} to rely on the committed copy.`,
        );
      }
      expect(live).toBe(committed);
    },
  );
});
