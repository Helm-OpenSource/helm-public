import type { UiLocale } from "@/lib/i18n/config";
import { isEnglishLocale } from "@/lib/i18n/config";

export type ProductToolDefinition = {
  name: string;
  description: string;
  riskLevel: "read" | "draft" | "write";
};

type ProductToolCopy = Omit<ProductToolDefinition, "description"> & {
  description: {
    zh: string;
    en: string;
  };
};

const registry: ProductToolCopy[] = [
  {
    name: "read_object_context",
    description: {
      zh: "读取联系人、公司、机会、会议的结构化上下文。",
      en: "Read structured context for contacts, companies, opportunities, and meetings.",
    },
    riskLevel: "read",
  },
  {
    name: "draft_action_preview",
    description: {
      zh: "生成动作预览，但不直接执行。",
      en: "Generate an action preview without executing it directly.",
    },
    riskLevel: "draft",
  },
];

export function listProductTools(locale?: UiLocale): ProductToolDefinition[] {
  const english = locale ? isEnglishLocale(locale) : false;
  return registry.map((tool) => ({
    name: tool.name,
    description: english ? tool.description.en : tool.description.zh,
    riskLevel: tool.riskLevel,
  }));
}
