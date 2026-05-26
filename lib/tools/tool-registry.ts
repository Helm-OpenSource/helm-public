export type ProductToolDefinition = {
  name: string;
  description: string;
  riskLevel: "read" | "draft" | "write";
};

const registry: ProductToolDefinition[] = [
  {
    name: "read_object_context",
    description: "读取联系人、公司、机会、会议的结构化上下文。",
    riskLevel: "read",
  },
  {
    name: "draft_action_preview",
    description: "生成动作预览，但不直接执行。",
    riskLevel: "draft",
  },
];

export function listProductTools() {
  return registry;
}
