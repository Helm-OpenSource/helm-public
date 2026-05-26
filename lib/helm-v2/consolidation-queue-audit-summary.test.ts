import { describe, expect, it } from "vitest";
import { buildConsolidationQueueAuditSummary } from "@/lib/helm-v2/consolidation-queue-audit-summary";

describe("buildConsolidationQueueAuditSummary", () => {
  it("keeps idle queues default-off and rollback-safe", () => {
    const summary = buildConsolidationQueueAuditSummary({
      jobs: [],
    });

    expect(summary.state).toBe("idle");
    expect(summary.driver).toBe("no_job");
    expect(summary.nextAction).toContain("Queue manual consolidation");
    expect(summary.rollbackSummary).toContain("single-agent consolidation path");
  });

  it("marks paused queues as review-first before resume", () => {
    const summary = buildConsolidationQueueAuditSummary({
      jobs: [
        {
          id: "job_paused",
          jobType: "manual_runtime_consolidation",
          status: "PAUSED",
          href: "/meetings/meeting_1",
          meetingId: "meeting_1",
          reviewPosture: "Candidate-only and auditable.",
        },
      ],
    });

    expect(summary.state).toBe("paused");
    expect(summary.driver).toBe("paused_job");
    expect(summary.focusMeetingId).toBe("meeting_1");
    expect(summary.nextAction).toContain("Resume the paused consolidation job");
  });

  it("keeps queued jobs review-first without widening write authority", () => {
    const summary = buildConsolidationQueueAuditSummary({
      jobs: [
        {
          id: "job_queued",
          jobType: "meeting_review_consolidation",
          status: "QUEUED",
          href: "/meetings/meeting_2",
          meetingId: "meeting_2",
          reviewPosture: "Review-first and candidate-only.",
        },
      ],
    });

    expect(summary.state).toBe("queued");
    expect(summary.driver).toBe("queued_job");
    expect(summary.summary).toContain("review-first");
    expect(summary.rollbackSummary).toContain("does not auto-mutate canonical memory");
  });

  it("treats running jobs as actively executing instead of queued", () => {
    const summary = buildConsolidationQueueAuditSummary({
      jobs: [
        {
          id: "job_running",
          jobType: "manual_runtime_consolidation",
          status: "RUNNING",
          href: "/meetings/meeting_3",
          meetingId: "meeting_3",
          reviewPosture: "Review-first and candidate-only.",
        },
      ],
    });

    expect(summary.state).toBe("running");
    expect(summary.driver).toBe("running_job");
    expect(summary.counts.runningJobs).toBe(1);
    expect(summary.summary).toContain("actively running");
  });
});
