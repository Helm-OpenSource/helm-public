import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  __resetPackRegistryForTest,
  registerPackContributions,
} from "./registry-contract";
import { resolveAuditDisplayLabels } from "./registry";

beforeEach(() => __resetPackRegistryForTest());
afterEach(() => __resetPackRegistryForTest());

describe("audit display label registry (merge surface)", () => {
  it("is empty with no pack registered, so Core falls back to raw codes", () => {
    expect(resolveAuditDisplayLabels()).toEqual({
      actionTypes: {},
      targetTypes: {},
      actors: {},
      sourcePages: {},
    });
  });

  it("merges labels from several packs and keeps the first registration on collision", () => {
    registerPackContributions("demo-pack-a", {
      auditDisplayLabels: {
        actionTypes: {
          "demo.case.assignment.applied": { zh: "案件分配", en: "Case assignment" },
        },
        actors: { "demo.router.v1": { zh: "演示路由", en: "Demo router" } },
      },
    });
    registerPackContributions("demo-pack-b", {
      auditDisplayLabels: {
        actionTypes: {
          "demo.case.assignment.applied": { zh: "被覆盖", en: "Overridden" },
          "demo.case.stay.extended": { zh: "留案续期", en: "Case stay extended" },
        },
        targetTypes: { "demo.case": { zh: "案件", en: "Case" } },
        sourcePages: { "demo/assignment": { zh: "分配任务", en: "Assignment job" } },
      },
    });

    expect(resolveAuditDisplayLabels()).toEqual({
      actionTypes: {
        "demo.case.assignment.applied": { zh: "案件分配", en: "Case assignment" },
        "demo.case.stay.extended": { zh: "留案续期", en: "Case stay extended" },
      },
      targetTypes: { "demo.case": { zh: "案件", en: "Case" } },
      actors: { "demo.router.v1": { zh: "演示路由", en: "Demo router" } },
      sourcePages: { "demo/assignment": { zh: "分配任务", en: "Assignment job" } },
    });
  });

  it("ignores malformed or blank labels instead of rendering empty text", () => {
    registerPackContributions("demo-pack-bad", {
      auditDisplayLabels: {
        actionTypes: {
          "demo.blank": { zh: "  ", en: "Blank" },
          "  ": { zh: "空键", en: "Blank key" },
          "demo.missing": { zh: "缺英文" } as unknown as { zh: string; en: string },
          " demo.trimmed ": { zh: " 已裁剪 ", en: " Trimmed " },
        },
      },
    });

    expect(resolveAuditDisplayLabels().actionTypes).toEqual({
      "demo.trimmed": { zh: "已裁剪", en: "Trimmed" },
    });
  });

  it("is idempotent per pack id", () => {
    const contribution = {
      auditDisplayLabels: {
        actionTypes: { "demo.once": { zh: "一次", en: "Once" } },
      },
    };
    registerPackContributions("demo-pack-once", contribution);
    registerPackContributions("demo-pack-once", {
      auditDisplayLabels: {
        actionTypes: { "demo.twice": { zh: "两次", en: "Twice" } },
      },
    });
    expect(Object.keys(resolveAuditDisplayLabels().actionTypes)).toEqual([
      "demo.once",
    ]);
  });
});
