import { describe, expect, it } from "vitest";
import { getImportConfig, parseCsv, previewCsvImport } from "@/lib/imports";

describe("imports", () => {
  it("parses quoted multiline csv cells", () => {
    const parsed = parseCsv(`会议标题,纪要正文\n复盘会,"第一行\n第二行"`);

    expect(parsed.headers).toEqual(["会议标题", "纪要正文"]);
    expect(parsed.rows[0]).toEqual(["复盘会", "第一行\n第二行"]);
  });

  it("builds template config for contacts", () => {
    const config = getImportConfig("contacts");

    expect(config.fields.some((field) => field.key === "name")).toBe(true);
    expect(config.template).toContain("姓名,邮箱");
  });

  it("validates invalid opportunity stage during preview", () => {
    const preview = previewCsvImport({
      type: "opportunities",
      csvText: "标题,类型,当前阶段\nAcme,客户机会,错误阶段",
    });

    expect(preview.validation[0]).toContain("机会阶段无效");
  });
});
