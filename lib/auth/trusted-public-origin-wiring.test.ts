import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import { resolveTrustedPublicOrigin } from "./trusted-public-origin";

// Execute the actual action prefix from its AST (not a copied implementation).
// All dependencies beyond the origin boundary are forbidden in this failure test.
function action(file: string, name: string, bindings: Record<string, unknown>) {
  const text = readFileSync(resolve(process.cwd(), file), "utf8");
  const tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const fn = tree.statements.find(s => ts.isFunctionDeclaration(s) && s.name?.text === name);
  if (!fn || !ts.isFunctionDeclaration(fn)) throw Error("missing action");
  const source = fn.getText(tree).replace(/^export\s+/, "");
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return vm.runInNewContext(`${compiled}\n${name}`, bindings);
}
describe("public origin is checked before action side effects", () => {
  it.each([
    ["features/participant-portal/actions.ts", "issueParticipantPortalAccessAction"],
    ["features/programs/actions.ts", "issueProgramApplicationInviteAction"],
    ["features/settings/actions.ts", "addOrganizationMemberAction"],
  ])("%s rejects configuration before session, token or persistence", async (file, name) => {
    const session = vi.fn(() => { throw Error("session boundary reached before origin"); });
    const origin = vi.fn(resolveTrustedPublicOrigin);
    const fn = action(file, name, { headers: async () => new Headers(), process: { env: { NODE_ENV: "production" } }, resolveTrustedPublicOrigin: origin, requireCurrentUser: session });
    await expect(fn({})).rejects.toThrow("public_origin_invalid");
    const malformed = action(file, name, { headers: async () => new Headers({host:"localhost:3000"}), process: {env:{NODE_ENV:"production",APP_URL:"malformed"}}, resolveTrustedPublicOrigin: origin, requireCurrentUser: session });
    await expect(malformed({})).rejects.toThrow("public_origin_invalid");
    expect(origin).toHaveBeenCalledTimes(2);
    expect(session).not.toHaveBeenCalled();
  });
});
