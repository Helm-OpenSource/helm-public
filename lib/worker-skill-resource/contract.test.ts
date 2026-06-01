import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  controlPlaneGovernedChecks,
  createWorkerSkillResourceContractBundle,
  effectModes,
  workerSkillResourceContractPrinciples,
  workerSkillResourceSprint1Blueprint,
  workerSkillResourceSprint2Blueprint,
} from "@/lib/worker-skill-resource/contract";

const root = path.resolve(__dirname, "..", "..");

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

describe("worker skill resource contract", () => {
  it("keeps the canonical contract principles and effect modes stable", () => {
    expect(workerSkillResourceContractPrinciples).toEqual([
      "worker_defines_role",
      "skill_defines_ability",
      "resource_defines_execution_supply",
      "control_plane_defines_governance",
    ]);

    expect(controlPlaneGovernedChecks).toEqual([
      "review",
      "approval",
      "replay",
      "audit",
      "memory",
      "boundary",
      "external_safe_wording",
    ]);

    expect(effectModes).toEqual([
      "read_only",
      "draft_only",
      "internal_write",
      "customer_visible_send",
    ]);
  });

  it("keeps the Sprint 1 blueprint aligned to the three representative flows", () => {
    expect(workerSkillResourceSprint1Blueprint.workers).toHaveLength(4);
    expect(workerSkillResourceSprint1Blueprint.skills).toHaveLength(4);
    expect(workerSkillResourceSprint1Blueprint.representativeFlows).toEqual([
      expect.objectContaining({
        flowId: "sales-followup-draft",
        scenarioType: "sales_followup",
        workerId: "sales-assistant-worker",
        skillId: "followup-draft-skill",
      }),
      expect.objectContaining({
        flowId: "delivery-activation-checklist",
        scenarioType: "delivery_activation_checklist",
        workerId: "delivery-assistant-worker",
        skillId: "activation-checklist-skill",
      }),
      expect.objectContaining({
        flowId: "success-expansion-review",
        scenarioType: "success_expansion_review",
        workerId: "customer-success-assistant-worker",
        skillId: "expansion-review-skill",
      }),
    ]);

    const salesSkill = workerSkillResourceSprint1Blueprint.skills.find(
      (skill) => skill.skillId === "followup-draft-skill",
    );
    expect(salesSkill).toMatchObject({
      customerFacingAllowed: true,
      requiresReview: true,
      nonCommitmentOnly: true,
      effectMode: "draft_only",
    });
  });

  it("extends the catalog in Sprint 2 without leaving the controlled-trial boundary", () => {
    expect(workerSkillResourceSprint2Blueprint.skills).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          skillId: "objection-handling-skill",
          skillType: "objection_handling",
          customerFacingAllowed: true,
          requiresReview: true,
          requiresApproval: false,
          nonCommitmentOnly: true,
        }),
        expect.objectContaining({
          skillId: "proposal-shaping-skill",
          skillType: "proposal_shaping",
          customerFacingAllowed: true,
          requiresReview: true,
          requiresApproval: true,
          nonCommitmentOnly: true,
        }),
        expect.objectContaining({
          skillId: "review-note-skill",
          skillType: "review_note",
          customerFacingAllowed: false,
          effectMode: "internal_write",
        }),
        expect.objectContaining({
          skillId: "risk-clarification-skill",
          skillType: "risk_clarification",
          customerFacingAllowed: false,
          effectMode: "draft_only",
        }),
      ]),
    );

    expect(workerSkillResourceSprint2Blueprint.representativeFlows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          flowId: "sales-objection-response",
          scenarioType: "sales_objection_response",
          skillId: "objection-handling-skill",
        }),
        expect.objectContaining({
          flowId: "proposal-shaping-review",
          scenarioType: "proposal_shaping_window",
          skillId: "proposal-shaping-skill",
        }),
        expect.objectContaining({
          flowId: "review-note-preparation",
          scenarioType: "review_request_preparation",
          skillId: "review-note-skill",
        }),
        expect.objectContaining({
          flowId: "founder-risk-clarification",
          scenarioType: "risk_clarification",
          skillId: "risk-clarification-skill",
        }),
      ]),
    );
  });

  it("rejects customer-visible send and customer-facing boundary leaks", () => {
    const customerVisibleSend = JSON.parse(
      JSON.stringify(workerSkillResourceSprint1Blueprint),
    );
    customerVisibleSend.skills[0].effectMode = "customer_visible_send";

    expect(() =>
      createWorkerSkillResourceContractBundle(customerVisibleSend),
    ).toThrow("Sprint 1 does not permit autonomous customer-visible send skills");

    const noReview = JSON.parse(JSON.stringify(workerSkillResourceSprint1Blueprint));
    noReview.skills[0].requiresReview = false;

    expect(() => createWorkerSkillResourceContractBundle(noReview)).toThrow(
      "customer-facing skills must require review",
    );

    const commitmentLeak = JSON.parse(
      JSON.stringify(workerSkillResourceSprint1Blueprint),
    );
    commitmentLeak.skills[0].nonCommitmentOnly = false;

    expect(() =>
      createWorkerSkillResourceContractBundle(commitmentLeak),
    ).toThrow("customer-facing skills must stay non-commitment-only");

    const approvalWithoutReview = JSON.parse(
      JSON.stringify(workerSkillResourceSprint2Blueprint),
    );
    const proposalSkill = approvalWithoutReview.skills.find(
      (skill: { skillId: string }) => skill.skillId === "proposal-shaping-skill",
    );
    proposalSkill.requiresReview = false;
    proposalSkill.customerFacingAllowed = false;

    expect(() =>
      createWorkerSkillResourceContractBundle(approvalWithoutReview),
    ).toThrow("approval-required skills must also require review");
  });

  it("rejects role or flow mismatches introduced in Sprint 2", () => {
    const roleMismatch = JSON.parse(
      JSON.stringify(workerSkillResourceSprint2Blueprint),
    );
    const salesWorker = roleMismatch.workers.find(
      (worker: { workerId: string }) => worker.workerId === "sales-assistant-worker",
    );
    salesWorker.defaultSkills.push("activation-checklist-skill");

    expect(() => createWorkerSkillResourceContractBundle(roleMismatch)).toThrow(
      "cannot use skill activation-checklist-skill outside applicableRoles",
    );

    const flowMismatch = JSON.parse(
      JSON.stringify(workerSkillResourceSprint2Blueprint),
    );
    const proposalFlow = flowMismatch.representativeFlows.find(
      (flow: { flowId: string }) => flow.flowId === "proposal-shaping-review",
    );
    proposalFlow.controlPlaneChecks = ["review", "audit", "replay", "boundary"];

    expect(() => createWorkerSkillResourceContractBundle(flowMismatch)).toThrow(
      "must include approval for skill proposal-shaping-skill",
    );
  });

  it("pins the protocol docs and check scripts into the repo entry points", () => {
    const docsReadme = read("docs/README.md");
    const sprint2Report = read(
      "docs/product/HELM_WORKER_SKILL_RESOURCE_CONTRACT_SPRINT_2_REPORT.md",
    );
    const proactiveProtocol = read(
      "docs/product/helm-proactive-work-and-human-collaboration-protocol-v1.md",
    );
    const proactiveCollabReport = read(
      "docs/product/HELM_PROACTIVE_COLLABORATION_MECHANISM_REPORT.md",
    );
    const selfCheck = read("scripts/helm-self-check.ts");
    const boundaryCheck = read("scripts/decision-first-boundary-check.ts");

    for (const snippet of [
      "HELM_WORKER_SKILL_RESOURCE_PROTOCOL_V1.md",
      "HELM_WORKER_SKILL_RESOURCE_CONTRACT_REPORT.md",
      "HELM_WORKER_SKILL_RESOURCE_CONTRACT_SPRINT_1_REPORT.md",
      "HELM_WORKER_SKILL_RESOURCE_CONTRACT_SPRINT_2_REPORT.md",
    ]) {
      expect(docsReadme).toContain(snippet);
    }

    expect(sprint2Report).toContain("objection_handling");
    expect(sprint2Report).toContain("proposal_shaping_window");
    expect(sprint2Report).toContain("review_request_preparation");
    expect(sprint2Report).toContain("risk_clarification");
    expect(proactiveProtocol).toContain("HELM_WORKER_SKILL_RESOURCE_PROTOCOL_V1.md");
    expect(proactiveCollabReport).toContain(
      "HELM_WORKER_SKILL_RESOURCE_PROTOCOL_V1.md",
    );
    expect(selfCheck).toContain("HELM_WORKER_SKILL_RESOURCE_PROTOCOL_V1.md");
    expect(boundaryCheck).toContain("HELM_WORKER_SKILL_RESOURCE_PROTOCOL_V1.md");
  });

  it("records the page-level worker summary and evidence integration in the Sprint 2 report", () => {
    const sprint2Report = read(
      "docs/product/HELM_WORKER_SKILL_RESOURCE_CONTRACT_SPRINT_2_REPORT.md",
    );
    const contractReport = read(
      "docs/product/HELM_WORKER_SKILL_RESOURCE_CONTRACT_REPORT.md",
    );

    expect(sprint2Report).toContain("worker summary / worker assignment / evidence drawer");
    expect(sprint2Report).toContain("approvals / dashboard / opportunities");
    expect(contractReport).toContain(
      "worker summary / worker assignment / grouped evidence",
    );
  });
});
