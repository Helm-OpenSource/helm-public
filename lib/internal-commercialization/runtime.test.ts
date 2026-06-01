import type { InternalCommercializationRun } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { buildInternalCommercializationConnectorRecords } from "@/lib/internal-commercialization/fixture-connector";
import { buildInternalCommercializationLifecycleReadout } from "@/lib/internal-commercialization/runtime";

function makeRuns(): InternalCommercializationRun[] {
  return buildInternalCommercializationConnectorRecords().map((record, index) => ({
    id: `run-${index}`,
    workspaceId: "workspace-helm-reserved",
    createdAt: new Date("2026-05-11T00:00:00.000Z"),
    updatedAt: new Date(`2026-05-11T00:0${index}:00.000Z`),
    ...record,
  }));
}

describe("internal commercialization runtime readout", () => {
  it("builds a read-only lifecycle summary from alias-only runs", () => {
    const readout = buildInternalCommercializationLifecycleReadout({
      runs: makeRuns(),
      english: false,
    });

    expect(readout.counts.totalRunCount).toBe(8);
    expect(readout.counts.positiveRunCount).toBe(4);
    expect(readout.counts.watchOrNoGoCount).toBe(4);
    expect(readout.topWorkItems).toHaveLength(3);
    expect(readout.counts.boundaryIncidentCount).toBe(0);
    expect(readout.boundary).toContain("不直接触客");
    expect(readout.boundaryChecks.every((check) => check.ok)).toBe(true);
  });

  it("surfaces boundary drift instead of hiding it", () => {
    const runs = makeRuns();
    runs[0] = {
      ...runs[0],
      helmDirectCustomerContactAllowed: true,
    };

    const readout = buildInternalCommercializationLifecycleReadout({
      runs,
      english: true,
    });

    expect(readout.counts.boundaryIncidentCount).toBe(1);
    expect(
      readout.boundaryChecks.find(
        (check) => check.id === "direct-customer-contact",
      )?.ok,
    ).toBe(false);
  });
});
