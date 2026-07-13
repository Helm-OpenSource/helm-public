import { describe, expect, it } from "vitest";

import {
  attentionDedupeKey,
  buildCoreDefaultAttention,
  makeUnreturnedSourceItem,
  validateAttentionItems,
  type AttentionItem,
} from "./attention-feed";

function item(overrides: Partial<AttentionItem> = {}): AttentionItem {
  return {
    key: "case-42-followup-due",
    severity: "warning",
    label: "案件 #42 待跟进",
    roleCategory: "operator",
    href: "/approvals",
    basisRef: "provider:case-42",
    ...overrides,
  };
}

const has = (items: AttentionItem[], issue: string) =>
  validateAttentionItems(items).some((i) => i.issue === issue);

describe("validateAttentionItems", () => {
  it("passes a well-formed, de-identified item", () => {
    expect(validateAttentionItems([item()])).toEqual([]);
  });

  it("rejects a callback field (iron law: read/navigate only)", () => {
    expect(has([{ ...item(), onSelect: () => {} } as never], "callback_field:onSelect")).toBe(true);
  });

  it("rejects unknown severity", () => {
    expect(has([item({ severity: "fatal" as never })], "unknown_severity")).toBe(true);
  });

  it("fails closed on labels that look like PII (phone / id / email)", () => {
    expect(has([item({ label: "客户 13800138000 待联系" })], "label_looks_like_pii")).toBe(true);
    expect(has([item({ label: "身份证 110101199003074219" })], "label_looks_like_pii")).toBe(true);
    expect(has([item({ label: "联系 zhang.san@example.com" })], "label_looks_like_pii")).toBe(true);
  });

  it("rejects empty key/label/basisRef/roleCategory, off-site href, dup key", () => {
    expect(has([item({ key: "" })], "empty_key")).toBe(true);
    expect(has([item({ label: "  " })], "empty_label")).toBe(true);
    expect(has([item({ basisRef: "" })], "empty_basis_ref")).toBe(true);
    expect(has([item({ roleCategory: "" })], "empty_role_category")).toBe(true);
    expect(has([item({ href: "javascript:alert(1)" })], "href_not_in_site")).toBe(true);
    expect(has([item({ key: "d" }), item({ key: "d" })], "duplicate_key")).toBe(true);
  });

  it("allows a null href (item with no navigation target)", () => {
    expect(validateAttentionItems([item({ href: null })])).toEqual([]);
  });
});

describe("attentionDedupeKey", () => {
  it("namespaces item key by provider (cross-source dedupe key)", () => {
    expect(attentionDedupeKey("prov-a", item({ key: "x" }))).toBe("prov-a::x");
    expect(attentionDedupeKey("prov-b", item({ key: "x" }))).not.toBe(
      attentionDedupeKey("prov-a", item({ key: "x" })),
    );
  });
});

describe("makeUnreturnedSourceItem", () => {
  it("produces a PII-free, conformant info item for a missed source", () => {
    const unreturned = makeUnreturnedSourceItem({ providerId: "prov-a", english: false, reason: "timeout" });
    expect(unreturned.severity).toBe("info");
    expect(unreturned.href).toBeNull();
    expect(validateAttentionItems([unreturned])).toEqual([]); // itself must pass conformance
    expect(unreturned.basisRef).toContain("prov-a");
  });

  it("localizes reason (timeout / error / deadline) in both languages", () => {
    expect(makeUnreturnedSourceItem({ providerId: "p", english: true, reason: "error" }).label).toContain("errored");
    expect(makeUnreturnedSourceItem({ providerId: "p", english: false, reason: "deadline" }).label).toContain("超总预算");
  });
});

describe("buildCoreDefaultAttention", () => {
  it("is an honest empty set (Core has no attention source; no fabrication)", () => {
    expect(buildCoreDefaultAttention()).toEqual([]);
  });
});
