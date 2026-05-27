import { describe, expect, it } from "vitest";
import { decideCaseAllocation } from "./decide";

describe("case-management-sample case allocation driver", () => {
  it("escalates deep queues to review_required", () => {
    expect(decideCaseAllocation({ queueDepth: 21 }).mode).toBe("review_required");
  });
});
