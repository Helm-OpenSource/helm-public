import { describe, it, expect } from "vitest";
import { scanFile } from "./source-scan";
import { proposeMappings } from "./mapping-proposer";

const DEALS_DDL = `
CREATE TABLE deals (
  id INTEGER PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  amount DECIMAL(12,2),
  stage VARCHAR(64),
  company_id INTEGER REFERENCES companies(id),
  owner_id INTEGER,
  due_date TIMESTAMP
);
`;

describe("proposeMappings", () => {
  it("maps a deals table to an Opportunity / advancement candidate", () => {
    const [deals] = scanFile("schema.sql", DEALS_DDL);
    const candidates = proposeMappings(deals);
    const opp = candidates.find((c) => c.targetEntity === "Opportunity");
    expect(opp).toBeDefined();
    expect(opp?.signalFamily).toBe("advancement");
    expect(opp?.origin).toBe("deterministic");
    expect(opp?.state).toBe("candidate");
    expect(opp?.confidence).toBeGreaterThanOrEqual(70);
    const targets = opp?.fieldMappings.map((m) => m.targetField);
    expect(targets).toEqual(
      expect.arrayContaining(["amount", "stageLabel", "title", "companyExternalIds"]),
    );
  });

  it("does not fire Opportunity without amount+stage", () => {
    const [t] = scanFile(
      "x.sql",
      "CREATE TABLE notes (id INTEGER PRIMARY KEY, body TEXT);",
    );
    const candidates = proposeMappings(t);
    expect(candidates.some((c) => c.targetEntity === "Opportunity")).toBe(false);
  });

  it("always emits candidate state and never accepts on its own", () => {
    const [deals] = scanFile("schema.sql", DEALS_DDL);
    const candidates = proposeMappings(deals);
    expect(candidates.every((c) => c.state === "candidate")).toBe(true);
  });

  it("suppresses Meeting/Task noise for a clear Opportunity table (G1)", () => {
    const [deals] = scanFile("schema.sql", DEALS_DDL);
    const entities = proposeMappings(deals).map((c) => c.targetEntity);
    expect(entities).toContain("Opportunity");
    // amount+stage present → not a Meeting and not a Task.
    expect(entities).not.toContain("Meeting");
    expect(entities).not.toContain("Task");
  });

  it("caps mapping confidence at the object's parse confidence", () => {
    const objects = scanFile(
      "openapi.json",
      JSON.stringify({
        openapi: "3.0.0",
        components: {
          schemas: {
            Deal: {
              type: "object",
              required: ["amount", "stage"],
              properties: {
                amount: { type: "number" },
                stage: { type: "string" },
                companyId: { type: "integer" },
              },
            },
          },
        },
      }),
    );
    const opp = objects.flatMap(proposeMappings).find((c) => c.targetEntity === "Opportunity");
    // api_resource parseConfidence is 85, so the mapping cannot exceed it.
    expect(opp?.confidence).toBeLessThanOrEqual(85);
  });
});
