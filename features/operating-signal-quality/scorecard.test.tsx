/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { assessOperatingSignalQuality } from "@/lib/operating-signal-quality/assess";
import { formatOperatingSignalQualityReadout } from "@/lib/operating-signal-quality/format-readout";
import type { OperatingSignalQualityEvidence } from "@/lib/operating-signal-quality/types";
import { OperatingSignalQualityScorecard } from "./scorecard";

function buildEvidence(
  overrides: Partial<{
    delivery: Partial<OperatingSignalQualityEvidence["delivery"]>;
    signal: Partial<OperatingSignalQualityEvidence["signal"]>;
    readiness: Partial<OperatingSignalQualityEvidence["readiness"]>;
    collaboration: Partial<OperatingSignalQualityEvidence["collaboration"]>;
    noise: Partial<OperatingSignalQualityEvidence["noise"]>;
    prInflation: Partial<OperatingSignalQualityEvidence["prInflation"]>;
  }> = {},
): OperatingSignalQualityEvidence {
  return {
    delivery: {
      tenantUsable: false,
      customerCanTest: false,
      onlineVerified: false,
      operatingPushForward: false,
      ...overrides.delivery,
    },
    signal: {
      actionable: false,
      timely: false,
      accurate: false,
      leadsToReview: false,
      ...overrides.signal,
    },
    readiness: {
      envConfigured: false,
      cronOrTokenSet: false,
      dbMigrated: false,
      tenantEnabled: false,
      initialDataSeeded: false,
      ...overrides.readiness,
    },
    collaboration: {
      reducedBlockersForOthers: false,
      clearHandoff: false,
      teamSpeedUp: false,
      ...overrides.collaboration,
    },
    noise: {
      duplicateSignalCount: 0,
      misleadingSignalCount: 0,
      wrongAttributionCount: 0,
      invalidReportCount: 0,
      ...overrides.noise,
    },
    prInflation: {
      tinyNonCohesiveSliceCount: 0,
      repeatedNonProgressiveCommitCount: 0,
      commitsForCountSake: false,
      ...overrides.prInflation,
    },
  };
}

function buildReadout(
  evidence: OperatingSignalQualityEvidence,
  english = false,
  subjectLabel = "Tommy",
) {
  const assessment = assessOperatingSignalQuality({
    subject: { kind: "contributor", label: subjectLabel },
    evidence,
  });
  return formatOperatingSignalQualityReadout({ assessment, english });
}

describe("OperatingSignalQualityScorecard", () => {
  it("renders subject, grade, total score and headline", () => {
    const readout = buildReadout(
      buildEvidence({
        delivery: {
          tenantUsable: true,
          customerCanTest: true,
          onlineVerified: true,
          operatingPushForward: true,
        },
        signal: {
          actionable: true,
          timely: true,
          accurate: true,
          leadsToReview: true,
        },
        readiness: {
          envConfigured: true,
          cronOrTokenSet: true,
          dbMigrated: true,
          tenantEnabled: true,
          initialDataSeeded: true,
        },
        collaboration: {
          reducedBlockersForOthers: true,
          clearHandoff: true,
          teamSpeedUp: true,
        },
      }),
    );
    render(<OperatingSignalQualityScorecard readout={readout} />);
    expect(screen.getByTestId("operating-signal-quality-scorecard-total")).toHaveTextContent(
      "100",
    );
    expect(screen.getByText("Tommy")).toBeInTheDocument();
    expect(screen.getByText("贡献者")).toBeInTheDocument();
    expect(screen.getByText("高价值")).toBeInTheDocument();
    expect(screen.getByTestId("operating-signal-quality-scorecard-headline")).toHaveTextContent(
      "信号密度高",
    );
  });

  it("renders six score-line rows in stable order", () => {
    const readout = buildReadout(buildEvidence());
    render(<OperatingSignalQualityScorecard readout={readout} />);
    const breakdown = screen.getByTestId(
      "operating-signal-quality-scorecard-breakdown",
    );
    const items = breakdown.querySelectorAll("ul > li");
    expect(items.length).toBe(6);
    expect(items[0]).toHaveTextContent("交付效果");
    expect(items[1]).toHaveTextContent("经营信号质量");
    expect(items[2]).toHaveTextContent("上线");
    expect(items[3]).toHaveTextContent("协同");
    expect(items[4]).toHaveTextContent("噪声惩罚");
    expect(items[5]).toHaveTextContent("PR 膨胀惩罚");
  });

  it("shows noise findings section only when noise / prInflation are populated", () => {
    const cleanReadout = buildReadout(buildEvidence());
    const { rerender, container } = render(
      <OperatingSignalQualityScorecard readout={cleanReadout} />,
    );
    expect(
      container.querySelector(
        "[data-testid='operating-signal-quality-scorecard-noise']",
      ),
    ).toBeNull();

    const noisyReadout = buildReadout(
      buildEvidence({
        noise: { misleadingSignalCount: 3 },
        prInflation: { commitsForCountSake: true },
      }),
    );
    rerender(<OperatingSignalQualityScorecard readout={noisyReadout} />);
    const noiseSection = screen.getByTestId(
      "operating-signal-quality-scorecard-noise",
    );
    expect(noiseSection).toBeInTheDocument();
    expect(noiseSection).toHaveTextContent("误导性信号");
    expect(noiseSection).toHaveTextContent("为提交数量而提交");
  });

  it("renders the boundary footer reminding readers it is not a settlement input", () => {
    const readout = buildReadout(buildEvidence());
    render(<OperatingSignalQualityScorecard readout={readout} />);
    const boundary = screen.getByTestId(
      "operating-signal-quality-scorecard-boundary",
    );
    expect(boundary).toHaveTextContent("保留租户");
    expect(boundary).toHaveTextContent("不是结算依据");
  });

  it("renders an english variant when readout was built with english=true", () => {
    const readout = buildReadout(buildEvidence(), true, "Tommy");
    render(<OperatingSignalQualityScorecard readout={readout} english />);
    expect(screen.getByText("Contributor")).toBeInTheDocument();
    expect(screen.getByText("Score breakdown")).toBeInTheDocument();
    expect(
      screen.getByTestId("operating-signal-quality-scorecard-boundary"),
    ).toHaveTextContent("Reserved-tenant");
  });

  it("exposes githubHandle for AI-attribution traceability", () => {
    const readout = buildReadout(buildEvidence());
    render(
      <OperatingSignalQualityScorecard
        readout={readout}
        githubHandle="hzqian2026"
      />,
    );
    const gh = screen.getByTestId(
      "operating-signal-quality-scorecard-github",
    );
    expect(gh).toHaveTextContent("hzqian2026");
  });
});
