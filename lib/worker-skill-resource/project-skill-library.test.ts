import { describe, expect, it } from "vitest";
import { buildProjectSkillLibraryReadModel } from "@/lib/worker-skill-resource/project-skill-library";

describe("project skill library read model", () => {
  it("builds the Sprint 2 project-scoped skill library with explicit environment seams", () => {
    const readModel = buildProjectSkillLibraryReadModel({
      capabilitySignals: [
        {
          id: "capability_runtime",
          name: "Token Budget Governor",
          stage: "runtime",
          description: "Keeps context inside a managed token budget.",
          loadPolicy: "always_on",
          reviewRequired: true,
          boundaryNote: "Runtime remains review-first.",
        },
        {
          id: "capability_candidate",
          name: "Relationship Rewarm Pack",
          stage: "candidate_skill",
          description: "Observed candidate pack from accepted suggestions.",
          loadPolicy: "on_demand",
          reviewRequired: true,
          boundaryNote: "Candidate skill still needs formal promotion.",
        },
      ],
    });

    expect(readModel.contractBundle).toBe("worker_skill_resource_sprint_2");
    expect(readModel.summary.workerCount).toBe(4);
    expect(readModel.summary.skillCount).toBe(8);
    expect(readModel.summary.flowCount).toBe(7);
    expect(readModel.summary.liveCapabilitySignals).toBe(2);
    expect(readModel.summary.activeEnvironmentSeams).toBeGreaterThanOrEqual(4);

    const connectorSeam = readModel.environmentSeams.find((item) => item.seamKind === "connector");
    expect(connectorSeam).toMatchObject({
      state: "active",
    });
    expect(connectorSeam?.resourceTypes).toContain("crm_connector");

    const browserSeam = readModel.environmentSeams.find((item) => item.seamKind === "browser");
    expect(browserSeam).toMatchObject({
      state: "active",
    });
    expect(browserSeam?.resourceTypes).toContain("browser_research");

    const officialActionSeam = readModel.environmentSeams.find(
      (item) => item.seamKind === "official_action",
    );
    expect(officialActionSeam).toMatchObject({
      state: "planned_boundary_only",
    });
    expect(officialActionSeam?.resourceIds).toEqual([]);

    const proposalShaping = readModel.skillEntries.find(
      (item) => item.skillId === "proposal-shaping-skill",
    );
    expect(proposalShaping?.requiresApproval).toBe(true);
    expect(proposalShaping?.environmentSeamIds).toEqual(
      expect.arrayContaining([
        "browser-seam",
        "connector-seam",
        "workspace-context-seam",
      ]),
    );

    const reviewNote = readModel.skillEntries.find((item) => item.skillId === "review-note-skill");
    expect(reviewNote?.resourceRefs.some((item) => item.seamKind === "control_plane")).toBe(true);
    expect(reviewNote?.boundaryNote).toContain("internal-only writes");
  });
});
