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
});
