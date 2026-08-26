import { describe, expect, it } from "vitest";

import { resolveReleaseBuildId } from "./release-build-id";

describe("resolveReleaseBuildId", () => {
  it("keeps ordinary builds on the Next.js default", () => {
    expect(resolveReleaseBuildId(undefined)).toBeUndefined();
  });

  it("accepts one explicit immutable release identity", () => {
    const value = `helm-release-${"a".repeat(40)}`;
    expect(resolveReleaseBuildId(value)).toBe(value);
  });

  it.each(["", " ", `helm-release-${"A".repeat(40)}`, "customer-release", `helm-release-${"a".repeat(39)}`])(
    "rejects malformed configured identity %j",
    (value) => {
      expect(() => resolveReleaseBuildId(value)).toThrow(
        /HELM_RELEASE_BUILD_ID/,
      );
    },
  );
});
