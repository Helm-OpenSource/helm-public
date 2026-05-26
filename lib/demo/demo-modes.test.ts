import { describe, expect, it } from "vitest";
import {
  demoQuickPathMatchesLocation,
  getDemoModeProfile,
  getDemoModeProfiles,
} from "@/lib/demo/demo-modes";

describe("demo mode quick paths", () => {
  it("keeps sales and recruiter quick paths on real, existing workspace routes", () => {
    const salesProfile = getDemoModeProfile("sales", "zh-CN");
    const recruiterProfile = getDemoModeProfile("recruiter", "zh-CN");
    const founderProfile = getDemoModeProfile("founder", "zh-CN");
    const founderEnglishProfile = getDemoModeProfile("founder", "en-US");

    expect(salesProfile.quickPath[1]?.href).toBe(
      "/opportunities?mine=1&action=priority#opportunity-judgement-workspace",
    );
    expect(salesProfile.quickPath[2]?.href).toBe(
      "/opportunities?mine=1#opportunity-memory-summary",
    );
    expect(recruiterProfile.quickPath[1]?.href).toBe(
      "/opportunities?mine=1&action=priority#opportunity-judgement-workspace",
    );
    expect(recruiterProfile.quickPath[3]?.href).toBe(
      "/approvals#approval-preview",
    );
    expect(founderProfile.quickPath[2]?.href).toBe(
      "/approvals#approval-preview",
    );
    expect(founderProfile.quickPath[1]).toMatchObject({
      label: "会议页看会后闭环",
      href: "/meetings",
    });
    expect(founderEnglishProfile.quickPath[1]).toMatchObject({
      label: "See post-meeting loop on the meeting page",
      href: "/meetings",
    });
  });

  it("matches quick paths using pathname plus required query parameters", () => {
    expect(
      demoQuickPathMatchesLocation(
        "/opportunities?mine=1&action=priority#opportunity-judgement-workspace",
        "/opportunities",
        new URLSearchParams("mine=1&action=priority"),
      ),
    ).toBe(true);

    expect(
      demoQuickPathMatchesLocation(
        "/approvals#approval-preview",
        "/approvals",
        new URLSearchParams(),
      ),
    ).toBe(true);

    expect(
      demoQuickPathMatchesLocation(
        "/opportunities?mine=1&action=priority#opportunity-judgement-workspace",
        "/opportunities",
        new URLSearchParams("mine=1"),
      ),
    ).toBe(false);
  });

  it("keeps Chinese demo profiles free of raw implementation terms", () => {
    const profileText = getDemoModeProfiles("zh-CN")
      .map((profile) =>
        [
          profile.homepageMarketingCopy,
          profile.description,
          profile.idealCustomer,
          profile.experienceSummary,
          ...profile.experienceHighlights,
          profile.conversionPrompt,
        ].join("\n"),
      )
      .join("\n");

    expect(profileText).not.toMatch(
      /\b(LLM|workflow|recommendation|commitments|blockers|capture|evolution|follow-up|shortlist|champion|pipeline|approval|today focus|intelligence layer)\b/i,
    );
    expect(profileText).not.toContain("events / tasks");
  });
});
