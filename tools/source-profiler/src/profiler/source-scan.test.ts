import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scanFile } from "./source-scan";

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../fixtures/sample-app",
);

function readFixture(name: string): string {
  return readFileSync(path.join(fixturesDir, name), "utf8");
}

describe("scanFile — SQL DDL", () => {
  it("parses tables, columns, and foreign keys", () => {
    const objects = scanFile("schema.sql", readFixture("schema.sql"));
    const deals = objects.find((o) => o.name === "deals");
    expect(deals).toBeDefined();
    expect(deals?.kind).toBe("sql_table");
    const fieldNames = deals?.fields.map((f) => f.name);
    expect(fieldNames).toEqual(
      expect.arrayContaining(["id", "name", "amount", "stage", "company_id", "due_date"]),
    );
    expect(deals?.associations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fromField: "company_id", toObject: "companies" }),
      ]),
    );
    expect(deals?.fields.find((f) => f.name === "amount")?.dataType).toBe("decimal");
    expect(deals?.fields.find((f) => f.name === "due_date")?.dataType).toBe("timestamp");
  });
});

describe("scanFile — Prisma", () => {
  it("parses models, scalar fields, and relations", () => {
    const objects = scanFile("companies.prisma", readFixture("companies.prisma"));
    const contact = objects.find((o) => o.name === "Contact");
    expect(contact?.kind).toBe("orm_model");
    expect(contact?.fields.map((f) => f.name)).toEqual(
      expect.arrayContaining(["fullName", "email", "phone", "companyId"]),
    );
    // Relation field `company` is captured as an association, not a scalar field.
    expect(contact?.fields.some((f) => f.name === "company")).toBe(false);
    expect(contact?.associations).toEqual(
      expect.arrayContaining([expect.objectContaining({ toObject: "Company" })]),
    );
  });
});

describe("scanFile — OpenAPI JSON", () => {
  it("parses component schemas into api_resource objects", () => {
    const objects = scanFile("openapi.json", readFixture("openapi.json"));
    const meeting = objects.find((o) => o.name === "Meeting");
    expect(meeting?.kind).toBe("api_resource");
    expect(meeting?.fields.map((f) => f.name)).toEqual(
      expect.arrayContaining(["title", "startTime", "contactId", "companyId"]),
    );
    // `title` is required → not nullable; `contactId` not required → nullable.
    expect(meeting?.fields.find((f) => f.name === "title")?.nullable).toBe(false);
    expect(meeting?.fields.find((f) => f.name === "contactId")?.nullable).toBe(true);
  });
});
