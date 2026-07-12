import { describe, expect, it } from "vitest";

import {
  buildCoreDefaultOperationSuggestions,
  validateOperationSuggestions,
  type OperationSuggestion,
} from "./operation-suggestion";

function suggestion(overrides: Partial<OperationSuggestion> = {}): OperationSuggestion {
  return {
    key: "init-focus-areas",
    category: "initialization",
    title: "设置工作区关注领域",
    rationale: "冷启动需先声明关注领域,信号才能对齐",
    readiness: "ready",
    preconditionRefs: [],
    agentBrief: "在 /settings 配置 focusAreas 字段为业务关注领域清单",
    verificationRef: "/settings",
    href: "/settings",
    basisRef: "core:init-focus-areas",
    ...overrides,
  };
}

const has = (items: OperationSuggestion[], issue: string) =>
  validateOperationSuggestions(items).some((i) => i.issue === issue);

describe("validateOperationSuggestions", () => {
  it("passes a well-formed, de-identified suggestion", () => {
    expect(validateOperationSuggestions([suggestion()])).toEqual([]);
  });

  it("passes a blocked suggestion carrying precondition refs", () => {
    expect(
      validateOperationSuggestions([
        suggestion({ readiness: "blocked_precondition", preconditionRefs: ["ref:needs-connector"] }),
      ]),
    ).toEqual([]);
  });

  it("rejects a callback field (suggestion ≠ execution; no callbacks)", () => {
    expect(has([{ ...suggestion(), onRun: () => {} } as never], "callback_field:onRun")).toBe(true);
  });

  it("rejects unknown category / readiness enums", () => {
    expect(has([suggestion({ category: "misc" as never })], "unknown_category")).toBe(true);
    expect(has([suggestion({ readiness: "running" as never })], "unknown_readiness")).toBe(true);
  });

  it("fails closed on suspected SECRETS in title / rationale / agentBrief", () => {
    // Secret-SHAPED strings are built at runtime (interpolation breaks the source
    // literal) so this public-shipped test carries no scannable secret while still
    // exercising the fail-closed validator.
    const skKey = `sk-${"ABCDEF0123456789abcdef"}`;
    const awsKey = `AKIA${"0123456789ABCDEF"}`;
    const ghToken = `gho_${"abcdefghijklmnopqrstuvwxyz0123"}`;
    expect(has([suggestion({ agentBrief: `export ${"TOKEN"}=${skKey}` })], "agent_brief_looks_like_secret")).toBe(true);
    expect(has([suggestion({ agentBrief: `use ${awsKey} for S3` })], "agent_brief_looks_like_secret")).toBe(true);
    expect(has([suggestion({ rationale: `${"password"}: hunter2 required` })], "rationale_looks_like_secret")).toBe(true);
    expect(has([suggestion({ agentBrief: `paste ${ghToken}` })], "agent_brief_looks_like_secret")).toBe(true);
  });

  it("fails closed on suspected PII in free-text fields", () => {
    expect(has([suggestion({ title: "联系 13800138000 开通" })], "title_looks_like_pii")).toBe(true);
    expect(has([suggestion({ agentBrief: "email admin@example.com" })], "agent_brief_looks_like_pii")).toBe(true);
  });

  it("rejects blocked readiness with no precondition refs", () => {
    expect(
      has([suggestion({ readiness: "blocked_precondition", preconditionRefs: [] })], "blocked_without_precondition_refs"),
    ).toBe(true);
  });

  it("rejects pending_source without a note, and empty precondition refs", () => {
    expect(has([suggestion({ readiness: "pending_source" })], "pending_source_without_note")).toBe(true);
    expect(has([suggestion({ preconditionRefs: [" "] })], "empty_precondition_ref")).toBe(true);
  });

  it("rejects empty required strings, off-site href, dup key", () => {
    expect(has([suggestion({ key: "" })], "empty_key")).toBe(true);
    expect(has([suggestion({ title: "" })], "empty_title")).toBe(true);
    expect(has([suggestion({ rationale: " " })], "empty_rationale")).toBe(true);
    expect(has([suggestion({ agentBrief: "" })], "empty_agent_brief")).toBe(true);
    expect(has([suggestion({ verificationRef: "" })], "empty_verification_ref")).toBe(true);
    expect(has([suggestion({ basisRef: "" })], "empty_basis_ref")).toBe(true);
    expect(has([suggestion({ href: "https://evil.example" })], "href_not_in_site")).toBe(true);
    expect(has([suggestion({ key: "d" }), suggestion({ key: "d" })], "duplicate_key")).toBe(true);
  });

  it("allows a null href (suggestion with no detail page)", () => {
    expect(validateOperationSuggestions([suggestion({ href: null })])).toEqual([]);
  });
});

describe("buildCoreDefaultOperationSuggestions", () => {
  it("is an honest empty set (Core has no infrequent-op source; no fabrication)", () => {
    expect(buildCoreDefaultOperationSuggestions()).toEqual([]);
  });
});
