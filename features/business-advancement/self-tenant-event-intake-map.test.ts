import { existsSync, readFileSync } from "fs";
import { describe, expect, it } from "vitest";

import {
  SELF_TENANT_EVENT_INTAKE_MAP_RULE_VERSION,
  SELF_TENANT_EVENT_INTAKE_ROUTES,
  getSelfTenantEventIntakeRoute,
  listSelfTenantIntakeGaps,
} from "./self-tenant-event-intake-map";
import { SELF_TENANT_EVENT_CLASSES } from "./self-tenant-minimal-live-gate";

describe("self-tenant event intake map", () => {
  it("pins the rule version", () => {
    expect(SELF_TENANT_EVENT_INTAKE_MAP_RULE_VERSION).toBe(
      "business-advancement-self-tenant-event-intake-map/v1",
    );
  });

  it("covers every approved event class exactly once with review-first posture", () => {
    expect(SELF_TENANT_EVENT_INTAKE_ROUTES.map((route) => route.eventClass)).toEqual(
      [...SELF_TENANT_EVENT_CLASSES],
    );
    expect(listSelfTenantIntakeGaps()).toEqual([]);
    for (const route of SELF_TENANT_EVENT_INTAKE_ROUTES) {
      expect(route.reviewPosture).toBe("review_first");
      expect(route.existingSurfaces.length).toBeGreaterThan(0);
      expect(route.existingEntryPoints.length).toBeGreaterThan(0);
      expect(route.boundaryNote.length).toBeGreaterThan(0);
    }
  });

  it("resolves each event class to its route", () => {
    for (const eventClass of SELF_TENANT_EVENT_CLASSES) {
      expect(getSelfTenantEventIntakeRoute(eventClass).eventClass).toBe(
        eventClass,
      );
    }
  });

  it("references only entry points that actually exist in source", () => {
    for (const route of SELF_TENANT_EVENT_INTAKE_ROUTES) {
      for (const entryPoint of route.existingEntryPoints) {
        const [filePath, exportedName] = entryPoint.split("#");
        expect(existsSync(filePath), `missing file: ${filePath}`).toBe(true);
        const source = readFileSync(filePath, "utf8");
        expect(
          source.includes(exportedName),
          `missing export ${exportedName} in ${filePath}`,
        ).toBe(true);
      }
    }
  });

  it("references only surfaces that exist as app routes", () => {
    for (const route of SELF_TENANT_EVENT_INTAKE_ROUTES) {
      for (const surface of route.existingSurfaces) {
        const routeDir = surface.split("?")[0];
        expect(existsSync(routeDir), `missing surface dir: ${routeDir}`).toBe(
          true,
        );
      }
    }
  });

  it("references only Prisma models that exist in the schema", () => {
    const schema = readFileSync("prisma/schema.prisma", "utf8");
    for (const route of SELF_TENANT_EVENT_INTAKE_ROUTES) {
      for (const model of route.targetModels) {
        const modelName = model.split(" ")[0];
        if (modelName === "AuditLog") {
          expect(schema).toContain("model AuditLog");
          continue;
        }
        expect(
          schema.includes(`model ${modelName} `) ||
            schema.includes(`model ${modelName}\n`),
          `missing prisma model: ${modelName}`,
        ).toBe(true);
      }
    }
  });

  it("does not import production query, mobile, app, db, prisma, fs or network modules", () => {
    const source = readFileSync(
      "features/business-advancement/self-tenant-event-intake-map.ts",
      "utf8",
    );
    const importLines = source
      .split("\n")
      .filter((line) => line.trim().startsWith("import "));
    expect(importLines.join("\n")).not.toContain("@/");
    expect(importLines.join("\n")).not.toContain("data/queries");
    expect(importLines.join("\n")).not.toContain("prisma");
    expect(importLines.join("\n")).not.toContain('from "fs"');
    expect(source).not.toContain("fetch(");
  });
});
