import { listProductTools } from "@/lib/tools/tool-registry";
import type { UiLocale } from "@/lib/i18n/config";
import { isEnglishLocale } from "@/lib/i18n/config";

export async function executeProductTool(
  toolName: string,
  input: Record<string, unknown>,
  locale?: UiLocale,
) {
  const english = locale ? isEnglishLocale(locale) : false;
  const tool = listProductTools(locale).find((item) => item.name === toolName);

  if (!tool) {
    throw new Error(english ? "Product tool was not found" : "未找到对应工具");
  }

  return {
    tool,
    input,
    status: "NOT_IMPLEMENTED",
    message: english
      ? "Phase 1 only reserves the product tool bus entry point. Real execution remains controlled by the product flow and approval engine."
      : "第一阶段仅预留工具总线入口，真实执行仍由产品主流程和审批引擎控制。",
  };
}
