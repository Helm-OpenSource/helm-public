import { afterEach, describe, expect, it, vi } from "vitest";
import { getWorkspaceChoices } from "./workspace-choices";

const member = (workspaceId: string, name: string, status = "ACTIVE") => ({
  workspaceId, role: "MEMBER" as const, status,
  workspace: { name, slug: workspaceId },
});
afterEach(() => vi.unstubAllEnvs());
describe("workspace choices", () => {
  it("lists active memberships before invitations and excludes revoked or unknown statuses", () => {
    const rows = [member("invite", "A", "INVITED"), member("b", "B"), member("a", "A"), member("revoked", "Revoked", "INACTIVE"), member("unknown", "Unknown", "OTHER")];
    const result = getWorkspaceChoices(rows, "en-US");
    expect(result.map((choice) => choice.workspaceId)).toEqual(["a", "b", "invite"]);
    expect(rows[0].workspaceId).toBe("invite");
    expect(result[0]).toEqual({ workspaceId: "a", workspaceName: "A", roleLabel: "Member", status: "ACTIVE" });
  });
  it("excludes memberships outside the deployment allowlist", () => {
    vi.stubEnv("HELM_DEPLOYMENT_ENTRY_PROFILE", "tenant");
    vi.stubEnv("HELM_DEPLOYMENT_ENTRY_HOME_PATH", "/workspace");
    vi.stubEnv("HELM_DEPLOYMENT_ALLOWED_WORKSPACE_SLUGS", "allowed");
    const result = getWorkspaceChoices([member("allowed", "Allowed"), member("other", "Other")], "zh-CN");
    expect(result).toEqual([{ workspaceId: "allowed", workspaceName: "Allowed", roleLabel: "成员", status: "ACTIVE" }]);
  });
  it("does not expose membership details beyond the choice fields", () => {
    const row = { ...member("a", "A"), privateNotes: "internal", user: { email: "member@example.com" } };
    expect(Object.keys(getWorkspaceChoices([row], "zh-CN")[0]).sort()).toEqual(["roleLabel", "status", "workspaceId", "workspaceName"]);
  });
});
