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

describe("scanFile — edge cases (G2)", () => {
  it("SQL: skips comments, quoted identifiers, and composite PRIMARY KEY lines", () => {
    const ddl = [
      'CREATE TABLE "orders" (',
      '  "id" INTEGER NOT NULL,',
      "  -- the order total",
      '  "total" DECIMAL(10,2),',
      '  "stage" VARCHAR(20),',
      '  PRIMARY KEY ("id")',
      ");",
    ].join("\n");
    const [orders] = scanFile("orders.sql", ddl);
    const names = orders.fields.map((f) => f.name);
    expect(names).toEqual(["id", "total", "stage"]); // PK + comment lines excluded
    expect(orders.fields.find((f) => f.name === "id")?.nullable).toBe(false);
  });

  it("Prisma: enum-typed fields are scalar fields, not relations", () => {
    const prisma = [
      "enum Status { OPEN CLOSED }",
      "model Ticket {",
      "  id Int @id",
      "  status Status",
      "  owner User @relation(fields: [ownerId], references: [id])",
      "  ownerId Int",
      "}",
    ].join("\n");
    const [ticket] = scanFile("ticket.prisma", prisma);
    expect(ticket.fields.find((f) => f.name === "status")?.dataType).toBe("enum");
    expect(ticket.associations.some((a) => a.toObject === "User")).toBe(true);
    expect(ticket.fields.some((f) => f.name === "status")).toBe(true);
  });

  it("OpenAPI: tolerates array and $ref properties without crashing", () => {
    const doc = JSON.stringify({
      openapi: "3.0.0",
      components: {
        schemas: {
          Thing: {
            type: "object",
            required: ["tags"],
            properties: {
              tags: { type: "array", items: { type: "string" } },
              ref: { $ref: "#/components/schemas/Other" },
              name: { type: "string" },
            },
          },
        },
      },
    });
    const [thing] = scanFile("api.json", doc);
    expect(thing.fields.map((f) => f.name)).toEqual(
      expect.arrayContaining(["tags", "ref", "name"]),
    );
    expect(thing.fields.find((f) => f.name === "tags")?.nullable).toBe(false);
    expect(thing.fields.find((f) => f.name === "ref")?.nullable).toBe(true);
  });
});
