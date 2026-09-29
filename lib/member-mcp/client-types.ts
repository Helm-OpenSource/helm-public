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
