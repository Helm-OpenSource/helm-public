import { describe, expect, it } from "vitest";
import {
  buildCoreDefaultMainline,
  validateMainlineReadout,
  type MainlineNode,
  type MainlineReadout,
} from "@/lib/shell/operating-mainline";
import { resolveNorthstarText } from "@/lib/shell/northstar-text";
import {
  selectSingleWinner,
  type ProviderCandidate,
} from "@/lib/shell/provider-selection";
import {
  getDestinationCatalog,
  resolveRoleLens,
  type RoleLens,
} from "@/lib/shell/role-home";

const ASOF = "2026-07-12T08:00:00.000Z";

function baseNode(overrides: Partial<MainlineNode>): MainlineNode {
  return {
    key: "k",
    label: "L",
    stage: "observing",
    status: "measured",
    inFlightCount: 1,
    countCaliber: "full_volume",
    oldestBlockedSince: null,
    oldestBlockedRef: null,
    needsHuman: 0,
    href: "/approvals",
    basisRef: "b",
    ...overrides,
  };
}

describe("core default mainline", () => {
  it("builds five neutral nodes and passes conformance", () => {
    const readout = buildCoreDefaultMainline({
      asOf: ASOF,
      english: false,
      counts: { judgementPending: 3, reviewQueue: 2, advanceInFlight: null },
    });
    expect(readout.nodes.map((n) => n.key)).toEqual([
      "signal",
      "judgement",
      "review",
      "advance",
      "evidence",
    ]);
    expect(validateMainlineReadout(readout)).toEqual([]);
  });

  it("marks judgement/review counts as daily_schedule caliber", () => {
    const readout = buildCoreDefaultMainline({
      asOf: ASOF,
      english: false,
      counts: { judgementPending: 3, reviewQueue: 2, advanceInFlight: null },
    });
    const byKey = Object.fromEntries(readout.nodes.map((n) => [n.key, n]));
    expect(byKey.judgement.countCaliber).toBe("daily_schedule");
    expect(byKey.review.countCaliber).toBe("daily_schedule");
  });

  it("is honest: null counts become pending_source with a note, never fabricated", () => {
    const readout = buildCoreDefaultMainline({
      asOf: ASOF,
      english: true,
      counts: { judgementPending: null, reviewQueue: null, advanceInFlight: null },
    });
    for (const node of readout.nodes) {
      expect(node.status).toBe("pending_source");
      expect(node.inFlightCount).toBeNull();
      expect(node.pendingSourceNote).toBeTruthy();
    }
    expect(validateMainlineReadout(readout)).toEqual([]);
  });

  it("uses no execution-state stage vocabulary", () => {
    const readout = buildCoreDefaultMainline({
      asOf: ASOF,
      english: false,
      counts: { judgementPending: 1, reviewQueue: 1, advanceInFlight: 1 },
    });
    const allowed = new Set([
      "unbound",
      "observing",
      "suggesting",
      "suggestion_ready_pending_human",
    ]);
    for (const node of readout.nodes) expect(allowed.has(node.stage)).toBe(true);
  });
});

describe("mainline conformance validator", () => {
  const wrap = (nodes: MainlineNode[]): MainlineReadout => ({ asOf: ASOF, nodes });
  const has = (readout: MainlineReadout, issue: string) =>
    validateMainlineReadout(readout).some((i) => i.issue === issue || i.issue.startsWith(issue));

  it("rejects callback fields (read/navigate-only iron rule)", () => {
    const node = baseNode({}) as MainlineNode & { onClick?: unknown };
    node.onClick = () => {};
    expect(has(wrap([node]), "callback_field:")).toBe(true);
  });

  it("rejects unknown status/stage/caliber enums at runtime", () => {
    expect(has(wrap([baseNode({ status: "executing" as never })]), "unknown_status")).toBe(true);
    expect(has(wrap([baseNode({ stage: "executing" as never })]), "unknown_stage")).toBe(true);
    expect(
      has(wrap([baseNode({ countCaliber: "guess" as never })]), "unknown_count_caliber"),
    ).toBe(true);
  });

  it("rejects non-measured nodes carrying values and pending without note", () => {
    expect(
      has(
        wrap([
          baseNode({
            status: "pending_source",
            inFlightCount: 5,
            pendingSourceNote: "n",
          }),
        ]),
        "non_measured_carries_values",
      ),
    ).toBe(true);
    expect(
      has(
        wrap([
          baseNode({
            status: "pending_source",
            inFlightCount: null,
            needsHuman: null,
            countCaliber: null,
          }),
        ]),
        "pending_source_without_note",
      ),
    ).toBe(true);
  });

  it("requires caliber on measured counts and rejects non-finite/non-integer counts", () => {
    expect(
      has(wrap([baseNode({ countCaliber: null })]), "measured_count_without_caliber"),
    ).toBe(true);
    for (const bad of [-1, Number.NaN, Number.POSITIVE_INFINITY, 1.5]) {
      expect(has(wrap([baseNode({ inFlightCount: bad })]), "invalid_count")).toBe(true);
    }
  });

  it("rejects empty key/label/basisRef", () => {
    expect(has(wrap([baseNode({ key: " " })]), "empty_key")).toBe(true);
    expect(has(wrap([baseNode({ label: "" })]), "empty_label")).toBe(true);
    expect(has(wrap([baseNode({ basisRef: "" })]), "empty_basis_ref")).toBe(true);
  });

  it("enforces blocked pair + ordering + parsable ISO against asOf", () => {
    expect(
      has(wrap([baseNode({ oldestBlockedSince: ASOF, oldestBlockedRef: null })]), "blocked_pair_null_mismatch"),
    ).toBe(true);
    expect(
      has(
        wrap([
          baseNode({
            oldestBlockedSince: "2026-07-13T00:00:00.000Z",
            oldestBlockedRef: "r",
          }),
        ]),
        "blocked_since_after_asOf",
      ),
    ).toBe(true);
    expect(
      has(
        wrap([
          baseNode({ oldestBlockedSince: "2026-13-45T99:99:99Z", oldestBlockedRef: "r" }),
        ]),
        "blocked_since_not_iso8601",
      ),
    ).toBe(true);
    expect(
      validateMainlineReadout({ asOf: "2026-13-45T99:99:99Z", nodes: [baseNode({})] }).some(
        (i) => i.issue === "asOf_not_iso8601",
      ),
    ).toBe(true);
  });

  it("rejects off-site hrefs and out-of-range node counts", () => {
    expect(has(wrap([baseNode({ href: "https://evil.example" })]), "href_not_in_site")).toBe(true);
    expect(
      validateMainlineReadout(
        wrap(Array.from({ length: 9 }, (_, i) => baseNode({ key: `k${i}` }))),
      ).some((i) => i.issue === "node_count_out_of_range"),
    ).toBe(true);
  });

  it("accepts read-only asset-scope navigation and rejects unsafe option hrefs", () => {
    const readout: MainlineReadout = {
      ...wrap([baseNode({})]),
      assetScope: {
        label: "运营资产",
        currentValue: "0039",
        defaulted: false,
        basisRef: "test:asset-scope",
        options: [
          {
            value: "0039",
            label: "0039",
            href: "/dashboard?stay=1&assetScope=0039",
            current: true,
            basisRef: "test:asset-scope:0039",
          },
          {
            value: "0038",
            label: "0038",
            href: "/dashboard?stay=1&assetScope=0038",
            current: false,
            basisRef: "test:asset-scope:0038",
          },
        ],
      },
    };

    expect(validateMainlineReadout(readout)).toEqual([]);
    expect(
      has(
        {
          ...readout,
          assetScope: {
            ...readout.assetScope!,
            options: [
              ...readout.assetScope!.options.slice(0, 1),
              {
                ...readout.assetScope!.options[1],
                href: "https://evil.example",
              },
            ],
          },
        },
        "asset_scope_option_href_not_in_site",
      ),
    ).toBe(true);
  });
});

describe("single-winner provider selection (binding-is-authorization)", () => {
  const candidate = (
    id: string,
    priority: number,
    eligible = true,
  ): ProviderCandidate => ({
    providerId: id,
    contractVersion: "1",
    priority,
    provenance: "test",
    enabled: eligible,
    accessOk: eligible,
    contractCompatible: eligible,
  });

  it("no binding → core default, regardless of priority", () => {
    const result = selectSingleWinner({
      surfaceKey: "mainline",
      candidates: [candidate("a", 100), candidate("b", 1)],
      binding: null,
    });
    expect(result.winner).toBe("core_default");
    expect(result.recommendations).toEqual(["a", "b"]);
  });

  it("priority tie without binding → core default + conflict receipt (never lexicographic auto-pick)", () => {
    const result = selectSingleWinner({
      surfaceKey: "mainline",
      candidates: [candidate("b", 5), candidate("a", 5)],
      binding: null,
    });
    expect(result.winner).toBe("core_default");
    expect(result.conflictReceipt?.reason).toBe(
      "multiple_top_recommendations_without_binding",
    );
  });

  it("valid binding wins; invalid/ineligible binding falls back to core with receipt", () => {
    const ok = selectSingleWinner({
      surfaceKey: "mainline",
      candidates: [candidate("a", 1)],
      binding: { surfaceKey: "mainline", providerId: "a" },
    });
    expect(ok.winner).toEqual({ providerId: "a" });

    const missing = selectSingleWinner({
      surfaceKey: "mainline",
      candidates: [candidate("a", 1)],
      binding: { surfaceKey: "mainline", providerId: "ghost" },
    });
    expect(missing.winner).toBe("core_default");
    expect(missing.conflictReceipt?.reason).toBe("binding_provider_not_found");

    const ineligible = selectSingleWinner({
      surfaceKey: "mainline",
      candidates: [candidate("a", 1, false)],
      binding: { surfaceKey: "mainline", providerId: "a" },
    });
    expect(ineligible.winner).toBe("core_default");
    expect(ineligible.conflictReceipt?.reason).toBe("binding_provider_not_eligible");
  });

  it("binding to another surface → core default + binding_surface_mismatch receipt", () => {
    const result = selectSingleWinner({
      surfaceKey: "mainline",
      candidates: [candidate("a", 1)],
      binding: { surfaceKey: "attention", providerId: "a" },
    });
    expect(result.winner).toBe("core_default");
    expect(result.conflictReceipt?.reason).toBe("binding_surface_mismatch");
  });

  it("duplicate provider ids surface the root cause on every path", () => {
    // 绑定指向重复 id：回执 = duplicate（根因），不掩盖为 not_found
    const dup = selectSingleWinner({
      surfaceKey: "mainline",
      candidates: [candidate("a", 1), candidate("a", 2), candidate("b", 1)],
      binding: { surfaceKey: "mainline", providerId: "a" },
    });
    expect(dup.winner).toBe("core_default");
    expect(dup.conflictReceipt?.reason).toBe("duplicate_provider_id");

    const dupNoBinding = selectSingleWinner({
      surfaceKey: "mainline",
      candidates: [candidate("a", 1), candidate("a", 2)],
      binding: null,
    });
    expect(dupNoBinding.conflictReceipt?.reason).toBe("duplicate_provider_id");
  });

  it("non-finite priority is never silent: receipt without binding, ineligible with binding", () => {
    const silentless = selectSingleWinner({
      surfaceKey: "mainline",
      candidates: [candidate("a", Number.NaN), candidate("b", 1)],
      binding: null,
    });
    expect(silentless.winner).toBe("core_default");
    expect(silentless.conflictReceipt?.reason).toBe("non_finite_priority");

    const bound = selectSingleWinner({
      surfaceKey: "mainline",
      candidates: [candidate("a", Number.NaN)],
      binding: { surfaceKey: "mainline", providerId: "a" },
    });
    expect(bound.winner).toBe("core_default");
    expect(bound.conflictReceipt?.reason).toBe("binding_provider_not_eligible");
  });
});

describe("role lens + per-preset destination catalog (Appendix B row-by-row)", () => {
  it("maps all nine built-in presets and fails safe to generic", () => {
    const cases: Array<[string | null, RoleLens]> = [
      ["FOUNDER_CEO", "control_tower"],
      ["SALES_LEAD", "advance_desk"],
      ["ACCOUNT_EXECUTIVE", "advance_desk"],
      ["RECRUITER", "generic"],
      ["CUSTOMER_SUCCESS", "delivery_desk"],
      ["DELIVERY_LEAD", "delivery_desk"],
      ["PRODUCT_ENGINEER", "generic"],
      ["OPERATIONS_FINANCE", "review_desk"],
      ["GENERAL_OPERATOR", "generic"],
      [null, "generic"],
      ["UNKNOWN_CUSTOM_NOT_NORMALIZED", "generic"],
    ];
    for (const [key, lens] of cases) expect(resolveRoleLens(key)).toBe(lens);
  });

  it("keeps Appendix B primary rows per preset (not merged by lens)", () => {
    const primaryHrefs = (key: string | null) =>
      getDestinationCatalog(key).primary.map((e) => e.href);

    // 附录 B：主线卡带·需你拍板（同为 /dashboard 控制塔段①②）·复核队列·周期复盘深链
    // 控制塔入口带 ?stay=1 逃生口:配了 defaultLandingPath 的租户才进得去控制塔(CodeX P1)。
    expect(primaryHrefs("FOUNDER_CEO")).toEqual([
      "/dashboard?stay=1",
      "/approvals",
      "/reports",
    ]);
    expect(getDestinationCatalog("FOUNDER_CEO").secondary.map((e) => e.href)).toEqual([
      "/memory",
    ]);
    expect(primaryHrefs("SALES_LEAD")).toEqual([
      "/opportunities",
      "/approvals",
      "/meetings",
      "/reports",
    ]);
    expect(primaryHrefs("ACCOUNT_EXECUTIVE")).toEqual([
      "/opportunities",
      "/meetings",
      "/inbox",
      "/capture",
    ]);
    // RECRUITER：无专属工位，不默认给拍板入口
    expect(primaryHrefs("RECRUITER")).toEqual(["/search"]);
    expect(primaryHrefs("CUSTOMER_SUCCESS")).toEqual([
      "/customer-success",
      "/approvals",
      "/companies",
    ]);
    expect(primaryHrefs("DELIVERY_LEAD")).toEqual([
      "/customer-success",
      "/approvals",
      "/reports",
    ]);
    // PRODUCT_ENGINEER：diagnostics/memory 次区
    expect(primaryHrefs("PRODUCT_ENGINEER")).toEqual(["/search"]);
    expect(getDestinationCatalog("PRODUCT_ENGINEER").secondary.map((e) => e.href)).toEqual([
      "/diagnostics",
      "/memory",
    ]);
    expect(primaryHrefs("OPERATIONS_FINANCE")).toEqual(["/approvals", "/memory"]);
    expect(primaryHrefs("GENERAL_OPERATOR")).toEqual(["/search", "/approvals"]);
    // 解析失败 → 最低信息面：仅搜索，无拍板、无业务队列
    expect(primaryHrefs(null)).toEqual(["/search"]);
    expect(primaryHrefs("UNKNOWN")).toEqual(["/search"]);
  });

  it("primary zone stays within 4 entries with in-site hrefs", () => {
    const keys = [
      "FOUNDER_CEO",
      "SALES_LEAD",
      "ACCOUNT_EXECUTIVE",
      "RECRUITER",
      "CUSTOMER_SUCCESS",
      "DELIVERY_LEAD",
      "PRODUCT_ENGINEER",
      "OPERATIONS_FINANCE",
      "GENERAL_OPERATOR",
      null,
    ];
    for (const key of keys) {
      const catalog = getDestinationCatalog(key);
      expect(catalog.primary.length).toBeGreaterThan(0);
      expect(catalog.primary.length).toBeLessThanOrEqual(4);
      for (const entry of [
        ...catalog.primary,
        ...catalog.secondary,
        ...catalog.drawer,
      ]) {
        expect(entry.href.startsWith("/")).toBe(true);
        expect(entry.href.startsWith("//")).toBe(false);
        expect(entry.href.includes(":")).toBe(false);
      }
    }
  });
});

describe("northstar text", () => {
  it("parses focusAreas honestly and returns null when unset", () => {
    expect(resolveNorthstarText(null, false)).toBeNull();
    expect(resolveNorthstarText("", false)).toBeNull();
    expect(resolveNorthstarText("[]", false)).toBeNull();
    expect(resolveNorthstarText(JSON.stringify(["回款率提升"]), false)).toBe(
      "北极星：回款率提升",
    );
    expect(
      resolveNorthstarText(JSON.stringify(["A", "B", "C"]), true),
    ).toBe("North star: A · B");
    expect(resolveNorthstarText("plain goal", false)).toBe("北极星：plain goal");
  });
});
