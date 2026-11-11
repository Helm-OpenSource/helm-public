import { describe, expect, it } from "vitest";
import { type FinanceGrantOperatorError, parseFinanceGrantArgs } from "./finance-grant-operator";

const code = (argv: string[]) => { try { parseFinanceGrantArgs(argv); } catch (error) { return (error as FinanceGrantOperatorError).code; } return null; };

describe("finance grant operator arguments", () => {
  it("accepts each command's own flags once; list never writes", () => {
    expect(parseFinanceGrantArgs(["grant", "--user-id=u1", "--role=maker", "--apply"])).toMatchObject({ command: "grant", apply: true });
    expect(parseFinanceGrantArgs(["revoke", "--grant-id=g1"])).toMatchObject({ apply: false });
    expect(code(["list", "--apply"])).toBe("usage:flag:--apply");
    expect(code(["grant", "--role=maker", "--role=checker"])).toBe("usage:flag:--role");
    expect(code(["revoke", "--role=maker"])).toBe("usage:flag:--role");
    expect(code(["grant", "--apply=yes"])).toBe("usage:flag:--apply");
    expect(code(["bootstrap"])).toBe("usage:command");
  });
});
