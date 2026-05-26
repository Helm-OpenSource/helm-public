import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const surfaceSource = readFileSync(
  "features/dashboard/home-work-entry-surface.tsx",
  "utf8",
);
const trackedButtonSource = readFileSync(
  "components/shared/first-loop-tracked-action-button.tsx",
  "utf8",
);

describe("dashboard home work-entry action accessibility", () => {
  it("keeps first-screen quick actions as named navigation links", () => {
    expect(surfaceSource).toContain("<nav");
    expect(surfaceSource).toContain(
      'aria-label={english ? "Current work quick actions" : "当前工作快速动作"}',
    );
    expect(surfaceSource).toContain('data-dashboard-work-entry-action-rail="true"');
    expect(surfaceSource).toContain(
      'const reviewQueueHref = review ? "/approvals#approval-queue" : "/approvals";',
    );
    expect(surfaceSource).toContain("href={reviewQueueHref}");
    expect(surfaceSource).toContain('ariaLabel={`${ctaLabel}: ${title}`}');
    expect(surfaceSource).toContain('ariaLabel={`${item.ctaLabel}: ${item.title}`}');
    expect(surfaceSource).toContain('aria-label={`${ctaLabel}: ${title}`}');
    expect(surfaceSource).toContain('aria-label={`${item.ctaLabel}: ${item.title}`}');

    expect(trackedButtonSource).toContain("ariaLabel?: string");
    expect(trackedButtonSource).toContain("aria-label={ariaLabel ?? ctaLabel}");
    expect(trackedButtonSource).toContain('data-first-loop-tracked-action-link="true"');
  });
});
