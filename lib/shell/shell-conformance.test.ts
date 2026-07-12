import { describe, expect, it } from "vitest";
import {
  buildCoreDefaultMainline,
  validateMainlineReadout,
  type MainlineNode,
  type MainlineReadout,
} from "@/lib/shell/operating-mainline";
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

  it("rejects callback fields (read/navigate-only iron rule)", () => {
    const node = baseNode({}) as MainlineNode & { onClick?: unknown };
    node.onClick = () => {};
    expect(
      validateMainlineReadout(wrap([node])).some((i) =>
        i.issue.startsWith("callback_field:"),
      ),
    ).toBe(true);
  });

  it("rejects non-measured nodes carrying values", () => {
    expect(
      validateMainlineReadout(
        wrap([baseNode({ status: "pending_source", inFlightCount: 5 })]),
      ).some((i) => i.issue === "non_measured_carries_values"),
    ).toBe(true);
  });

  it("enforces blocked pair + ordering against asOf", () => {
    expect(
      validateMainlineReadout(
        wrap([baseNode({ oldestBlockedSince: ASOF, oldestBlockedRef: null })]),
      ).some((i) => i.issue === "blocked_pair_null_mismatch"),
    ).toBe(true);
    expect(
      validateMainlineReadout(
        wrap([
          baseNode({
            oldestBlockedSince: "2026-07-13T00:00:00.000Z",
            oldestBlockedRef: "r",
          }),
        ]),
      ).some((i) => i.issue === "blocked_since_after_asOf"),
    ).toBe(true);
  });

  it("rejects off-site hrefs and bad shapes", () => {
    expect(
      validateMainlineReadout(
        wrap([baseNode({ href: "https://evil.example" })]),
      ).some((i) => i.issue === "href_not_in_site"),
    ).toBe(true);
    expect(
      validateMainlineReadout(wrap([baseNode({ inFlightCount: -1 })])).some(
        (i) => i.issue === "negative_count",
      ),
    ).toBe(true);
    expect(
      validateMainlineReadout({ asOf: "not-a-time", nodes: [baseNode({})] }).some(
        (i) => i.issue === "asOf_not_iso8601",
      ),
    ).toBe(true);
    expect(
      validateMainlineReadout(wrap(Array.from({ length: 9 }, (_, i) => baseNode({ key: `k${i}` })))).some(
        (i) => i.issue === "node_count_out_of_range",
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
    expect(result.source).toBe("core_default");
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
    expect(ok.source).toBe("binding");

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
    expect(ineligible.conflictReceipt?.reason).toBe(
      "binding_provider_not_eligible",
    );

    const wrongSurface = selectSingleWinner({
      surfaceKey: "mainline",
      candidates: [candidate("a", 1)],
      binding: { surfaceKey: "attention", providerId: "a" },
    });
    expect(wrongSurface.winner).toBe("core_default");
  });
});

describe("role lens + destination catalog", () => {
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

  it("primary zone stays within 4 entries with in-site hrefs", () => {
    const lenses: RoleLens[] = [
      "control_tower",
      "advance_desk",
      "delivery_desk",
      "review_desk",
      "generic",
    ];
    for (const lens of lenses) {
      const catalog = getDestinationCatalog(lens);
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
