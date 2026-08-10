import { describe, expect, it } from "vitest";

import { parseCaioUserPrincipalRef } from "./caio-user-principal-ref";

describe("CAIO canonical user principal refs", () => {
  it("returns the database user id from a canonical CUID ref", () => {
    expect(
      parseCaioUserPrincipalRef("user:cm1234567890abcdefghijklmn"),
    ).toBe("cm1234567890abcdefghijklmn");
  });

  it.each([
    "cm1234567890abcdefghijklmn",
    "user:",
    "user: owner-1",
    "user:owner-1 ",
    "user:owner:1",
  ])("rejects a non-canonical user principal ref: %s", (userRef) => {
    expect(parseCaioUserPrincipalRef(userRef)).toBeNull();
  });
});
