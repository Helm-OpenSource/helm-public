import { describe, expect, it } from "vitest";
import { buildEnvironmentContractReadModel } from "@/lib/worker-skill-resource/environment-contract";
import { buildProjectSkillLibraryReadModel } from "@/lib/worker-skill-resource/project-skill-library";

describe("environment contract read model", () => {
  it("overlays connector and official-action runtime posture onto the project skill seams", () => {
    const projectSkillLibrary = buildProjectSkillLibraryReadModel();
    const environmentContract = buildEnvironmentContractReadModel({
      projectSkillLibrary,
      connectors: [
        {
          id: "connector_google",
          provider: "GOOGLE_OAUTH",
          status: "CONNECTED",
          lastSyncStatus: "healthy",
        },
        {
          id: "connector_wecom",
          provider: "WECOM_OAUTH",
          status: "ERROR",
          lastSyncStatus: "token expired",
        },
      ],
      officialActionCoverage: [
        {
          actionType: "crm.attach_note",
          defaultPath: "limited_auto",
          limitedAutoStatus: "eligible",
          executableLimitedAuto: true,
          boundaryReason: "Explicit approval and acknowledgment still required.",
        },
        {
          actionType: "crm.update_blockers",
          defaultPath: "guarded",
          limitedAutoStatus: "eligible_but_manual_only",
          executableLimitedAuto: false,
          boundaryReason: "Current main keeps blockers on a manual-only path.",
        },
        {
          actionType: "crm.update_official_stage",
          defaultPath: "guarded",
          limitedAutoStatus: "blocked",
          executableLimitedAuto: false,
          boundaryReason: "Stage changes stay blocked.",
        },
      ],
      humanExecutionCount: 2,
      officialFollowThroughCount: 1,
    });

    expect(environmentContract.summary.seamCount).toBe(5);
    expect(environmentContract.summary.activeConnectorCount).toBe(2);
    expect(environmentContract.summary.connectedConnectorCount).toBe(1);
    expect(environmentContract.summary.reviewGatedOfficialActions).toBe(2);
    expect(environmentContract.summary.liveOfficialFollowThrough).toBe(1);

    const connectorSeam = environmentContract.seams.find((item) => item.seamKind === "connector");
    expect(connectorSeam).toMatchObject({
      runtimePosture: "partially_connected",
      liveReferenceCount: 2,
    });

    const browserSeam = environmentContract.seams.find((item) => item.seamKind === "browser");
    expect(browserSeam?.runtimePosture).toBe("available");

    const officialActionSeam = environmentContract.seams.find(
      (item) => item.seamKind === "official_action",
    );
    expect(officialActionSeam).toMatchObject({
      runtimePosture: "review_gated",
      liveReferenceCount: 3,
    });
    expect(officialActionSeam?.summary).toContain("limited-auto eligible");
    expect(officialActionSeam?.summary).toContain("human execution trace item");
  });
});
