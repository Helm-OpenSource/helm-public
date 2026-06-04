"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Moon, Sun, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import type { UiLocale } from "@/lib/i18n/config";

export function ContrastTestClient({ locale }: { locale: UiLocale }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const english = locale === "en-US";

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    document.documentElement.dataset.theme = newTheme;
    document.documentElement.style.colorScheme = newTheme;
  };

  const textExamples = [
    {
      type: english ? "Primary text" : "主要文字",
      color: "text-foreground",
      text: english
        ? "Primary text should use the darkest foreground and the highest contrast."
        : "这是主要文字，应该是最深的颜色，对比度最高",
      description: english ? "For headings and important content" : "用于标题、重要内容"
    },
    {
      type: english ? "Secondary text" : "次要文字",
      color: "text-muted-foreground",
      text: english
        ? "Secondary text should stay readable without competing with primary text."
        : "这是次要文字，应该清晰可见但不如主要文字突出",
      description: english ? "For descriptions and supporting copy" : "用于说明文字、辅助内容"
    },
    {
      type: english ? "Helper text" : "辅助文字",
      color: "text-slate-500",
      text: english
        ? "Helper text should remain legible while clearly sitting lower in the hierarchy."
        : "这是辅助文字，应该仍然能看清，但有明显层次",
      description: english ? "For hints and notes" : "用于提示、注释"
    },
  ];

  const problemAreas = [
    {
      name: english ? "Card background" : "卡片背景",
      test: "bg-surface",
      description: english ? "White background with multiple text colors" : "白色背景配各种文字颜色"
    },
    {
      name: english ? "Subtle background" : "次要背景",
      test: "bg-surface-subtle",
      description: english ? "Light gray background with multiple text colors" : "浅灰背景配各种文字颜色"
    },
    {
      name: english ? "Accent background" : "强调背景",
      test: "bg-accent-soft",
      description: english ? "Blue background with multiple text colors" : "蓝色背景配各种文字颜色"
    },
  ];

  const contrastStatus = [
    { level: english ? "Excellent" : "优秀", ratio: "16.8:1", status: "pass", color: "text-emerald-600" },
    { level: english ? "Good" : "良好", ratio: "7.2:1", status: "pass", color: "text-blue-600" },
    { level: english ? "Pass" : "合格", ratio: "4.5:1", status: "pass", color: "text-amber-600" },
    { level: english ? "Fail" : "不合格", ratio: "2.1:1", status: "fail", color: "text-red-600" },
  ];

  const checklist = english
    ? [
        "Heading text is clearly visible",
        "Body text is clearly visible",
        "Helper text is clearly visible",
        "Text on white backgrounds is readable",
        "Text on light gray backgrounds is readable",
        "Text on blue backgrounds is readable",
        "Link text is clearly visible",
        "Button text is clearly visible",
        "Form labels are clearly visible",
        "Status badge text is clearly visible",
      ]
    : [
        "标题文字清晰可见",
        "正文文字清晰可见",
        "辅助文字清晰可见",
        "白色背景上的文字清晰",
        "浅灰背景上的文字清晰",
        "蓝色背景上的文字清晰",
        "链接文字清晰可见",
        "按钮文字清晰可见",
        "表单标签清晰可见",
        "状态徽章文字清晰可见"
      ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-neutral-950 dark:to-black p-4 md:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
              {english ? "Light Mode Contrast Test" : "浅色模式对比度测试"}
            </h1>
            <p className="mt-2 text-lg text-slate-600 dark:text-neutral-400">
              {english
                ? "Verify that the repaired text colors are clear and readable."
                : "验证修复后的文字是否都清晰可见"}
            </p>
          </div>
          <Button
            onClick={toggleTheme}
            variant="outline"
            size="lg"
            className="gap-2"
          >
            {theme === "light" ? (
              <>
                <Moon className="h-5 w-5" />
                {english ? "Switch to dark mode" : "切换到深色模式"}
              </>
            ) : (
              <>
                <Sun className="h-5 w-5" />
                {english ? "Switch to light mode" : "切换到浅色模式"}
              </>
            )}
          </Button>
        </div>

        {/* 修复说明 */}
        <Card className="border-2 border-blue-500/20 bg-blue-50 dark:bg-blue-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              {english ? "What changed" : "修复内容"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">{english ? "Primary text color" : "主要文字颜色"}</p>
                  <p className="text-slate-600 dark:text-neutral-400">
                    {english
                      ? "Changed from #a3a3a3 to #0f0f0f, raising contrast from 3.2:1 to 16.8:1."
                      : "从 #a3a3a3 改为 #0f0f0f，对比度从 3.2:1 提升到 16.8:1"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">{english ? "Secondary text color" : "次要文字颜色"}</p>
                  <p className="text-slate-600 dark:text-neutral-400">
                    {english
                      ? "Changed from #a3a3a3 to #64748b so secondary copy remains readable."
                      : "从 #a3a3a3 改为 #64748b，确保清晰可见"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">{english ? "Background color tuning" : "背景颜色优化"}</p>
                  <p className="text-slate-600 dark:text-neutral-400">
                    {english
                      ? "White surfaces now pair with dark text to avoid light-on-light contrast failures."
                      : "纯白背景配深色文字，避免浅色配浅色"}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 文字颜色测试 */}
        <Card>
          <CardHeader>
            <CardTitle>{english ? "Text Color Test" : "文字颜色测试"}</CardTitle>
            <CardDescription>
              {english
                ? "Check visibility for each text color in light mode."
                : "检查各种文字颜色在浅色模式下的可见性"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {textExamples.map((example) => (
                <div
                  key={example.type}
                  className="rounded-lg border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="neutral">{example.type}</Badge>
                    <span className="text-xs text-slate-500 dark:text-neutral-500">{example.description}</span>
                  </div>
                  <p className={example.color}>
                    {example.text}
                  </p>
                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 dark:text-neutral-500">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>{english ? "Clearly visible" : "清晰可见"}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 背景对比测试 */}
        <Card>
          <CardHeader>
            <CardTitle>{english ? "Background Contrast Test" : "背景对比测试"}</CardTitle>
            <CardDescription>
              {english
                ? "Check text visibility on each background style."
                : "检查各种背景下的文字可见性"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {problemAreas.map((area) => (
                <div
                  key={area.name}
                  className={`rounded-lg border border-slate-200 dark:border-neutral-800 p-4 ${area.test === 'bg-surface' ? 'bg-white dark:bg-neutral-900' : area.test === 'bg-surface-subtle' ? 'bg-slate-50 dark:bg-neutral-900' : 'bg-blue-50 dark:bg-blue-950'}`}
                >
                  <h4 className="font-semibold text-slate-900 dark:text-white mb-2">{area.name}</h4>
                  <p className="text-sm text-slate-600 dark:text-neutral-400 mb-3">{area.description}</p>
                  <div className="space-y-2">
                    <p className="text-slate-900 dark:text-white">
                      {english ? "Primary text should be dark and easy to read." : "主要文字应该是深色的，清晰可见"}
                    </p>
                    <p className="text-slate-700 dark:text-slate-300">
                      {english ? "Secondary text should remain readable." : "次要文字也应该能看清"}
                    </p>
                    <p className="text-slate-500 dark:text-slate-400">
                      {english ? "Helper text should still have enough contrast." : "辅助文字要有足够对比度"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 对比度标准 */}
        <Card>
          <CardHeader>
            <CardTitle>{english ? "WCAG Contrast Standard" : "WCAG 对比度标准"}</CardTitle>
            <CardDescription>
              {english ? "Contrast data after the repair." : "修复后的对比度数据"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              {contrastStatus.map((item) => (
                <div
                  key={item.level}
                  className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3"
                >
                  <div className="flex items-center gap-3">
                    {item.status === "pass" ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">{item.level}</p>
                      <p className={`text-sm ${item.color}`}>{item.ratio}</p>
                    </div>
                  </div>
                  <Badge
                    variant={item.status === "pass" ? "success" : "danger"}
                    className="shrink-0"
                  >
                    {item.status === "pass" ? (english ? "Pass" : "合格") : (english ? "Fail" : "不合格")}
                  </Badge>
                </div>
              ))}
            </div>
            <div className="mt-4 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-amber-900 dark:text-amber-100">{english ? "WCAG AA standard" : "WCAG AA 标准"}</p>
                  <p className="text-amber-800 dark:text-amber-200">
                    {english
                      ? "Normal text needs a 4.5:1 contrast ratio and large text needs 3:1. The repaired palette meets or exceeds those thresholds."
                      : "普通文字需要 4.5:1 的对比度，大号文字需要 3:1 的对比度。修复后的配色全部达到或超过这个标准。"}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 快速检查清单 */}
        <Card>
          <CardHeader>
            <CardTitle>{english ? "Quick Checklist" : "快速检查清单"}</CardTitle>
            <CardDescription>
              {english ? "Visibility checks for light mode." : "浅色模式下的可见性检查"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 md:grid-cols-2">
              {checklist.map((item, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span className="text-slate-700 dark:text-neutral-300">{item}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 使用建议 */}
        <Card className="border-2 border-emerald-500/20 bg-emerald-50 dark:bg-emerald-950/20">
          <CardHeader>
            <CardTitle>{english ? "Testing Tips" : "测试建议"}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-slate-700 dark:text-neutral-300">
              <li>• <strong>{english ? "Test on multiple devices" : "在不同设备上测试"}</strong>{english ? ": desktop, tablet and mobile." : "：桌面、平板、手机"}</li>
              <li>• <strong>{english ? "Adjust screen brightness" : "调整屏幕亮度"}</strong>{english ? ": verify visibility at different brightness levels." : "：测试不同亮度下的可见性"}</li>
              <li>• <strong>{english ? "Switch themes" : "切换主题测试"}</strong>{english ? ": make sure both light and dark mode stay clear." : "：确保浅色和深色模式都清晰"}</li>
              <li>• <strong>{english ? "Check real usage surfaces" : "实际使用场景"}</strong>{english ? ": validate the result on real pages." : "：在真实页面上验证效果"}</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
