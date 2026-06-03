import { describe, expect, it } from "vitest";
import caseManagementSamplePayloadExamples from "@/extensions/case-management-sample/hsi-payload-examples.json";
import caseManagementSampleReviewPacketTemplate from "@/extensions/case-management-sample/hsi-review-packet-template.json";
import caseManagementSampleManifest from "@/extensions/case-management-sample/hsi-pack.manifest.json";
import {
  validateHsiPayloadExampleSet,
  validateHsiReviewPacketTemplate,
  type HsiPayloadExampleSet,
  type HsiReviewPacketTemplate,
} from "./pack-artifacts";
import type { HsiPackManifest } from "./pack-manifest";

const manifest = caseManagementSampleManifest as unknown as HsiPackManifest;

describe("HSI review packet template — case-management-sample conformance", () => {
  it("validates clean", () => {
    expect(
      validateHsiReviewPacketTemplate(caseManagementSampleReviewPacketTemplate),
    ).toEqual([]);
  });

  it("preserves HSI-04 preparation-only defaults at literal-false", () => {
    const template = caseManagementSampleReviewPacketTemplate as unknown as HsiReviewPacketTemplate;
    expect(template.defaults.sent).toBe(false);
    expect(template.defaults.approved).toBe(false);
    expect(template.defaults.executed).toBe(false);
    expect(template.defaults.committed).toBe(false);
    expect(template.defaults.officialWritePerformed).toBe(false);
    expect(template.defaults.humanReviewerRequired).toBe(true);
    expect(template.defaults.notForAutoSend).toBe(true);
  });
});

describe("HSI review packet template — violation codes", () => {
  it("flags missing packId", () => {
    const v = validateHsiReviewPacketTemplate({
      ...(caseManagementSampleReviewPacketTemplate as Record<string, unknown>),
      packId: "",
    });
    expect(v).toContain("review_packet_template_missing_pack_id");
  });

  it("flags any forbidden default flipped to true", () => {
    const template = caseManagementSampleReviewPacketTemplate as unknown as HsiReviewPacketTemplate;
    const v = validateHsiReviewPacketTemplate({
      ...(caseManagementSampleReviewPacketTemplate as Record<string, unknown>),
      defaults: { ...template.defaults, sent: true },
    });
    expect(v).toContain("review_packet_template_sent_must_default_false");
  });

  it("flags humanReviewerRequired demoted to false", () => {
    const template = caseManagementSampleReviewPacketTemplate as unknown as HsiReviewPacketTemplate;
    const v = validateHsiReviewPacketTemplate({
      ...(caseManagementSampleReviewPacketTemplate as Record<string, unknown>),
      defaults: { ...template.defaults, humanReviewerRequired: false },
    });
    expect(v).toContain("review_packet_template_human_reviewer_required_not_true");
  });

  it("flags missing forbiddenActions", () => {
    const template = caseManagementSampleReviewPacketTemplate as unknown as HsiReviewPacketTemplate;
    const v = validateHsiReviewPacketTemplate({
      ...(caseManagementSampleReviewPacketTemplate as Record<string, unknown>),
      defaults: { ...template.defaults, forbiddenActions: [] },
    });
    expect(v).toContain("review_packet_template_missing_forbidden_actions");
  });

  it("flags missing PRD-3 review packet schema fields", () => {
    const source = caseManagementSampleReviewPacketTemplate as Record<string, unknown>;
    const schema = { ...(source.schema as Record<string, unknown>) };
    delete schema.nextSteps;

    const v = validateHsiReviewPacketTemplate({
      ...source,
      schema,
    });

    expect(v).toContain("review_packet_template_missing_schema_field:nextSteps");
  });
});

describe("HSI payload examples — case-management-sample conformance", () => {
  it("validates clean against the manifest's declared sourceKinds", () => {
    const violations = validateHsiPayloadExampleSet(
      caseManagementSamplePayloadExamples,
      manifest.sourceKinds,
    );
    expect(violations).toEqual([]);
  });

  it("ships at least one input and one output per declared sourceKind", () => {
    const set = caseManagementSamplePayloadExamples as unknown as HsiPayloadExampleSet;
    for (const kind of manifest.sourceKinds) {
      const inputs = set.examples.filter(
        (e) => e.sourceKind === kind && e.direction === "input",
      );
      const outputs = set.examples.filter(
        (e) => e.sourceKind === kind && e.direction === "output",
      );
      expect(inputs.length, `at least one input for ${kind}`).toBeGreaterThanOrEqual(1);
      expect(outputs.length, `at least one output for ${kind}`).toBeGreaterThanOrEqual(1);
    }
  });

  it("only uses synthetic | redacted | alias_only postures", () => {
    const set = caseManagementSamplePayloadExamples as unknown as HsiPayloadExampleSet;
    for (const example of set.examples) {
      expect(["synthetic", "redacted", "alias_only"]).toContain(example.dataPosture);
    }
  });

  it("has unique exampleIds", () => {
    const set = caseManagementSamplePayloadExamples as unknown as HsiPayloadExampleSet;
    const ids = set.examples.map((e) => e.exampleId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("HSI payload examples — violation codes", () => {
  const baseSet = caseManagementSamplePayloadExamples as unknown as HsiPayloadExampleSet;

  it("flags missing input for a declared sourceKind", () => {
    const tampered = {
      ...baseSet,
      examples: baseSet.examples.filter(
        (e) => !(e.sourceKind === "crm" && e.direction === "input"),
      ),
    };
    const v = validateHsiPayloadExampleSet(tampered, manifest.sourceKinds);
    expect(v).toContain("payload_example_set_missing_input_for_source:crm");
  });

  it("flags missing output for a declared sourceKind", () => {
    const tampered = {
      ...baseSet,
      examples: baseSet.examples.filter(
        (e) => !(e.sourceKind === "meeting" && e.direction === "output"),
      ),
    };
    const v = validateHsiPayloadExampleSet(tampered, manifest.sourceKinds);
    expect(v).toContain("payload_example_set_missing_output_for_source:meeting");
  });

  it("flags an unknown sourceKind", () => {
    const tampered = {
      ...baseSet,
      examples: [
        ...baseSet.examples,
        {
          exampleId: "rogue-1",
          sourceKind: "bogus_source",
          direction: "input",
          dataPosture: "synthetic",
          title: "rogue",
          data: {},
        },
      ],
    };
    const v = validateHsiPayloadExampleSet(tampered, manifest.sourceKinds);
    expect(v.some((m) => m.startsWith("payload_example_unknown_source_kind:rogue-1:"))).toBe(true);
  });

  it("flags an unknown dataPosture", () => {
    const tampered = {
      ...baseSet,
      examples: [
        ...baseSet.examples,
        {
          exampleId: "rogue-posture",
          sourceKind: "im",
          direction: "input",
          dataPosture: "raw",
          title: "rogue posture",
          data: {},
        },
      ],
    };
    const v = validateHsiPayloadExampleSet(tampered, manifest.sourceKinds);
    expect(v.some((m) => m.startsWith("payload_example_unknown_data_posture:rogue-posture:"))).toBe(true);
  });

  it("flags duplicate exampleId", () => {
    const first = baseSet.examples[0];
    const tampered = {
      ...baseSet,
      examples: [...baseSet.examples, { ...first }],
    };
    const v = validateHsiPayloadExampleSet(tampered, manifest.sourceKinds);
    expect(v.some((m) => m.startsWith("payload_example_duplicate_id:"))).toBe(true);
  });
});
