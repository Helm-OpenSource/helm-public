import { listProductTools } from "@/lib/tools/tool-registry";

export async function executeProductTool(toolName: string, input: Record<string, unknown>) {
  const tool = listProductTools().find((item) => item.name === toolName);

  if (!tool) {
    throw new Error("未找到对应工具");
  }

  return {
    tool,
    input,
    status: "NOT_IMPLEMENTED",
    message: "第一阶段仅预留工具总线入口，真实执行仍由产品主流程和审批引擎控制。",
  };
}
