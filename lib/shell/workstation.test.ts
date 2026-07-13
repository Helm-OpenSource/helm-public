import { describe, expect, it } from "vitest";

import {
  buildCoreDefaultWorkstations,
  validateWorkstations,
  type WorkstationDescriptor,
} from "./workstation";

function ws(overrides: Partial<WorkstationDescriptor> = {}): WorkstationDescriptor {
  return {
    key: "collection",
    label: "催收工位",
    href: "/operating",
    roleCategories: ["COLLECTOR"],
    ...overrides,
  };
}

const has = (list: WorkstationDescriptor[], issue: string) =>
  validateWorkstations(list).some((i) => i.issue === issue);

describe("validateWorkstations", () => {
  it("passes a well-formed workstation descriptor", () => {
    expect(validateWorkstations([ws()])).toEqual([]);
  });

  it("allows a null href (registered but no navigation target)", () => {
    expect(validateWorkstations([ws({ href: null })])).toEqual([]);
  });

  it("rejects callback field (navigate-only, no callbacks)", () => {
    expect(has([{ ...ws(), onOpen: () => {} } as never], "callback_field:onOpen")).toBe(true);
  });

  it("rejects empty key/label, dup key, off-site href", () => {
    expect(has([ws({ key: "" })], "empty_key")).toBe(true);
    expect(has([ws({ label: " " })], "empty_label")).toBe(true);
    expect(has([ws({ key: "d" }), ws({ key: "d" })], "duplicate_key")).toBe(true);
    expect(has([ws({ href: "https://evil.example" })], "href_not_in_site")).toBe(true);
    expect(has([ws({ href: "//evil" })], "href_not_in_site")).toBe(true);
  });

  it("rejects non-array roleCategories and empty role category entries", () => {
    expect(has([ws({ roleCategories: "COLLECTOR" as never })], "role_categories_not_array")).toBe(true);
    expect(has([ws({ roleCategories: ["ok", " "] })], "empty_role_category")).toBe(true);
  });
});

describe("buildCoreDefaultWorkstations", () => {
  it("is an honest empty set (Core has no workstations; provided by overlays)", () => {
    expect(buildCoreDefaultWorkstations()).toEqual([]);
  });
});
