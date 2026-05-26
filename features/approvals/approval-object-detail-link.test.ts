import { describe, expect, it } from "vitest";
import {
  buildBiReportSourceDetailHref,
  resolveApprovalObjectDetailHref,
} from "@/features/approvals/approval-object-detail-link";

describe("approval queue object detail link source contract", () => {
  it("routes canonical linked approval objects to their detail pages", () => {
    expect(resolveApprovalObjectDetailHref({ contact: { id: "contact-1" } })).toBe(
      "/contacts/contact-1",
    );
    expect(
      resolveApprovalObjectDetailHref({ opportunity: { id: "opportunity-1" } }),
    ).toBe("/opportunities?opportunityId=opportunity-1");
    expect(resolveApprovalObjectDetailHref({ meeting: { id: "meeting-1" } })).toBe(
      "/meetings/meeting-1",
    );
  });

  it("routes BI-sourced approval objects back to the BI signal detail surface", () => {
    const detailHref = buildBiReportSourceDetailHref({
      skillKey: "bi_collection_operating_signal_daily",
      signalId: "signal:daily_process_weak_signal:2026-04-29:team::seat",
    });

    expect(detailHref).toBe(
      "/reports?tab=bi-report&skillKey=bi_collection_operating_signal_daily&signalId=signal%3Adaily_process_weak_signal%3A2026-04-29%3Ateam%3A%3Aseat",
    );
    expect(
      resolveApprovalObjectDetailHref({
        biSource: { detailHref },
      }),
    ).toBe(detailHref);
  });

  it("does not render a fake approval-page fallback for truly unlinked tasks", () => {
    expect(resolveApprovalObjectDetailHref({})).toBeNull();
    expect(
      resolveApprovalObjectDetailHref({
        biSource: { detailHref: "https://example.com/not-allowed" },
      }),
    ).toBeNull();
  });
});
