import { describe, expect, it } from "vitest";
import { canSelfCreateOrganization } from "./organization-creation-policy";
describe("organization creation mode", () => {
  it("preserves omitted and explicit self-service deployments", () => {
    expect(canSelfCreateOrganization(undefined)).toBe(true);
    expect(canSelfCreateOrganization("self-service")).toBe(true);
  });
  it.each(["governed", "", "invalid"])("rejects ordinary creation in %s", value => expect(canSelfCreateOrganization(value)).toBe(false));
});
