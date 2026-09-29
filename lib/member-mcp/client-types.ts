// Client-safe constants (no Prisma import) shared by the page and the contract.
export const MEMBER_MCP_CLIENT_TYPES = [
  "codex",
  "qwenwork",
  "claude_code",
  "workbuddy",
] as const;

export type MemberMcpClientType = (typeof MEMBER_MCP_CLIENT_TYPES)[number];

export const MEMBER_MCP_CLIENT_LABELS: Record<MemberMcpClientType, string> = {
  codex: "Codex（ChatGPT）",
  qwenwork: "QwenWork",
  claude_code: "Claude Code",
  workbuddy: "WorkBuddy",
};

// Clients whose vendor processes data outside mainland China. Shown to members
// and approvers so each approval is made knowing the prompt summary leaves the
// country (owner 2026-09-29: all four approved, per-token approval is the gate).
export const MEMBER_MCP_OVERSEAS_CLIENTS: readonly MemberMcpClientType[] = ["codex", "claude_code"];
