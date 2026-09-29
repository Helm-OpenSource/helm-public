import { describe, expect, it } from "vitest";

import {
  formatAuditActorType,
  pickAuditDisplayLabel,
  resolveAuditLogDisplayLabels,
} from "@/lib/audit/display-labels";

const registered = {
  actionTypes: { "demo.case.assignment.applied": { zh: "案件分配", en: "Case assignment" } },
  targetTypes: { "demo.case": { zh: "案件", en: "Case" } },
  actors: { "demo.router.v1": { zh: "演示路由", en: "Demo router" } },
  sourcePages: { "demo/assignment": { zh: "分配任务", en: "Assignment job" } },
};

describe("audit display label resolution", () => {
  it("resolves only the labels whose stored code matches exactly", () => {
    expect(
      resolveAuditLogDisplayLabels(
        {
          actionType: "demo.case.assignment.applied",
          targetType: "demo.case",
          actor: "demo.router.v1",
          sourcePage: "demo/assignment",
        },
        registered,
      ),
    ).toEqual({
      action: { zh: "案件分配", en: "Case assignment" },
      targetType: { zh: "案件", en: "Case" },
      actor: { zh: "演示路由", en: "Demo router" },
      sourcePage: { zh: "分配任务", en: "Assignment job" },
    });

    expect(
      resolveAuditLogDisplayLabels(
        { actionType: "DEMO.CASE.ASSIGNMENT.APPLIED", targetType: null, actor: "someone" },
        registered,
      ),
    ).toEqual({});
  });

  it("does not resolve inherited object keys as labels", () => {
    expect(
      resolveAuditLogDisplayLabels(
        { actionType: "toString", targetType: "constructor", actor: "__proto__" },
        registered,
      ),
    ).toEqual({});
  });

  it("picks by locale and labels the Core actor type enum", () => {
    expect(pickAuditDisplayLabel({ zh: "案件", en: "Case" }, false)).toBe("案件");
    expect(pickAuditDisplayLabel({ zh: "案件", en: "Case" }, true)).toBe("Case");
    expect(pickAuditDisplayLabel(undefined, false)).toBeNull();
    expect(formatAuditActorType("SYSTEM", false)).toBe("系统");
    expect(formatAuditActorType("USER", true)).toBe("User");
    expect(formatAuditActorType("ROBOT", false)).toBeNull();
    expect(formatAuditActorType(null, false)).toBeNull();
  });
});
