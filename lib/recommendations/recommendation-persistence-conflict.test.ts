import { describe, expect, it } from "vitest";
import { isRecommendationPersistenceConflict } from "@/lib/recommendations/recommendation.service";

describe("recommendation persistence conflict classification", () => {
  it("classifies MySQL record-changed conflicts as retryable persistence conflicts", () => {
    const error = new Error(
      "ConnectorError(QueryError(Server(MysqlError { code: 1020, message: \"Record has changed since last read in table 'recommendationlog'\" })))",
    );

    expect(isRecommendationPersistenceConflict(error)).toBe(true);
  });

  it("classifies Prisma transaction conflicts as retryable persistence conflicts", () => {
    const error = Object.assign(new Error("Transaction failed because of a write conflict"), {
      code: "P2034",
    });

    expect(isRecommendationPersistenceConflict(error)).toBe(true);
  });

  it("does not classify validation failures as persistence conflicts", () => {
    expect(isRecommendationPersistenceConflict(new Error("Recommendation object not found"))).toBe(false);
  });
});
