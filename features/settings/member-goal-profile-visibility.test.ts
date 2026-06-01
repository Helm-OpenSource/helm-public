import { describe, expect, it } from "vitest";
import { maskMembershipGoalProfileFields } from "@/features/settings/queries";

describe("member goal profile visibility masking", () => {
  const memberships = [
    {
      id: "m-1",
      goalTitle: "目标A",
      goalDescription: "描述A",
      goalItemsJson: JSON.stringify(["条目1"]),
      jobResponsibilities: "职责A",
      role: "OWNER",
      status: "ACTIVE",
      joinedAt: new Date("2026-05-14T08:00:00.000Z"),
      title: "负责人",
      persona: null,
      rolePresetKey: null,
      definitionDraftJson: null,
      definitionAcceptedJson: null,
      user: {
        id: "u-1",
        name: "Admin",
        email: "admin@example.com",
      },
    },
  ];

  it("returns original goal fields for manageable roles", () => {
    const result = maskMembershipGoalProfileFields(memberships, true);

    expect(result[0]?.goalTitle).toBe("目标A");
    expect(result[0]?.goalDescription).toBe("描述A");
    expect(result[0]?.goalItemsJson).toContain("条目1");
    expect(result[0]?.jobResponsibilities).toBe("职责A");
  });

  it("masks goal fields for non-manageable roles", () => {
    const result = maskMembershipGoalProfileFields(memberships, false);

    expect(result[0]?.goalTitle).toBeNull();
    expect(result[0]?.goalDescription).toBeNull();
    expect(result[0]?.goalItemsJson).toBeNull();
    expect(result[0]?.jobResponsibilities).toBeNull();
  });
});
