import { describe, expect, it } from "vitest";
import { executeProductTool } from "./tool-executor";
import { listProductTools } from "./tool-registry";

describe("product tool bilingual copy", () => {
  it("keeps the default tool registry copy in Chinese", () => {
    const tools = listProductTools();

    expect(tools[0]?.description).toContain("读取联系人");
    expect(tools[1]?.description).toContain("生成动作预览");
  });

  it("returns English tool registry copy for English locale", () => {
    const tools = listProductTools("en-US");

    expect(tools[0]?.description).toBe(
      "Read structured context for contacts, companies, opportunities, and meetings.",
    );
    expect(tools[1]?.description).toBe(
      "Generate an action preview without executing it directly.",
    );
    expect(tools.map((tool) => tool.description).join(" ")).not.toMatch(/[\u4E00-\u9FFF]/);
  });

  it("localizes executor not-implemented and missing-tool messages", async () => {
    await expect(executeProductTool("missing", {}, "en-US")).rejects.toThrow(
      "Product tool was not found",
    );

    const result = await executeProductTool("draft_action_preview", {}, "en-US");

    expect(result.message).toBe(
      "Phase 1 only reserves the product tool bus entry point. Real execution remains controlled by the product flow and approval engine.",
    );
    expect(result.message).not.toMatch(/[\u4E00-\u9FFF]/);
  });
});
