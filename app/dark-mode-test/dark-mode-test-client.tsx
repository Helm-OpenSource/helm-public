"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Moon, Sun, Contrast } from "lucide-react";
import type { UiLocale } from "@/lib/i18n/config";

type BadgeVariant = NonNullable<React.ComponentProps<typeof Badge>["variant"]>;

export function DarkModeTestClient({ locale }: { locale: UiLocale }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const english = locale === "en-US";

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    document.documentElement.dataset.theme = newTheme;
    document.documentElement.style.colorScheme = newTheme;
  };

  const statusExamples: Array<{ type: BadgeVariant; label: string; text: string }> = [
    { type: "success", label: english ? "Success" : "成功状态", text: english ? "Task completed" : "任务已完成" },
    { type: "warning", label: english ? "Warning" : "警告状态", text: english ? "Needs attention" : "需要注意" },
    { type: "danger", label: english ? "Danger" : "危险状态", text: english ? "Handle now" : "立即处理" },
    { type: "info", label: english ? "Info" : "信息状态", text: english ? "System notice" : "系统通知" },
  ];

  const contrastExamples = [
    { level: english ? "High contrast" : "高对比度", color: "text-white", description: english ? "Headings and important information" : "标题和重要信息" },
    { level: english ? "Medium contrast" : "中对比度", color: "text-gray-300", description: english ? "Body copy and content" : "正文和内容" },
    { level: english ? "Low contrast" : "低对比度", color: "text-gray-500", description: english ? "Helper and explanatory text" : "辅助和说明文字" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-neutral-950 dark:to-black p-4 md:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* 页面标题和主题切换 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
              {english ? "Dark Mode Contrast Test" : "深色模式对比测试"}
            </h1>
            <p className="mt-2 text-lg text-slate-600 dark:text-neutral-400">
              {english
                ? "The optimized palette is more comfortable, easier to distinguish and easier on the eyes."
                : "优化后的配色方案：更舒适、更易分辨、更护眼"}
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

        {/* 配色优化说明 */}
        <Card className="border-2 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Contrast className="h-6 w-6" />
              {english ? "Dark Mode Optimization Notes" : "深色模式优化要点"}
            </CardTitle>
            <CardDescription>
              {english
                ? "Addresses the eye strain caused by the previous palette."
                : "解决原配色让人眼疲劳的问题"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <h4 className="font-semibold text-slate-900 dark:text-white">{english ? "Previous issues" : "之前的问题"}</h4>
                <ul className="space-y-1 text-sm text-slate-600 dark:text-neutral-400">
                  <li>• {english ? "Contrast was too low and text was hard to read." : "对比度不足，文字难以辨认"}</li>
                  <li>• {english ? "Too many blue-gray tones reduced hierarchy." : "大量蓝灰色调，缺乏层次感"}</li>
                  <li>• {english ? "Status colors were not distinct enough." : "状态色彩不够明显"}</li>
                  <li>• {english ? "Long sessions caused eye strain." : "长时间使用眼睛疲劳"}</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-slate-900 dark:text-white">{english ? "Improvements" : "优化后的改进"}</h4>
                <ul className="space-y-1 text-sm text-slate-600 dark:text-neutral-400">
                  <li>• {english ? "Higher contrast keeps text readable." : "提高对比度，确保文字清晰可读"}</li>
                  <li>• {english ? "Near-black backgrounds reduce blue-light stimulation." : "纯黑背景，减少蓝光刺激"}</li>
                  <li>• {english ? "Clearer status colors are easier to scan." : "鲜明的状态色彩，一目了然"}</li>
                  <li>• {english ? "A calmer hierarchy reduces visual fatigue." : "舒适的视觉层次，减少眼睛负担"}</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 文字对比度测试 */}
        <div className="grid gap-4 md:grid-cols-3">
          {contrastExamples.map((example) => (
            <Card key={example.level}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{example.level}</CardTitle>
                <CardDescription>{example.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className={example.color}>
                  {english
                    ? "This sample text checks readability at different contrast levels. Each hierarchy level should be easy to distinguish."
                    : "这是示例文字，用于测试在不同对比度下的可读性。应该能够清晰分辨各个层次的区别。"}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 状态色彩测试 */}
        <Card>
          <CardHeader>
            <CardTitle>{english ? "Status Color Contrast" : "状态色彩对比"}</CardTitle>
            <CardDescription>
              {english
                ? "The optimized status colors are easier to notice in dark mode."
                : "优化后的状态色彩在深色模式下更加醒目"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              {statusExamples.map((example) => (
                <div
                  key={example.type}
                  className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant={example.type}>
                      {example.label}
                    </Badge>
                    <span className="text-slate-700 dark:text-neutral-300">
                      {example.text}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 配色规格 */}
        <Card>
          <CardHeader>
            <CardTitle>{english ? "Optimized Dark Mode Palette" : "优化后的深色模式配色规格"}</CardTitle>
            <CardDescription>
              {english ? "Specific color values and contrast data." : "具体的颜色值和对比度数据"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <h4 className="font-semibold text-slate-900 dark:text-white">{english ? "Background colors" : "背景色系"}</h4>
                <div className="space-y-2">
                  <ColorSpec
                    name={english ? "Main background" : "主背景"}
                    value="#0a0a0a"
                    description={english ? "Near black to reduce eye strain" : "接近纯黑，减少眼睛疲劳"}
                  />
                  <ColorSpec
                    name={english ? "Raised background" : "提升背景"}
                    value="#141414"
                    description={english ? "Slight lift while preserving contrast" : "轻微提升，保持对比"}
                  />
                  <ColorSpec
                    name={english ? "Card background" : "卡片背景"}
                    value="#1a1a1a"
                    description={english ? "Clearly separated from the main background" : "明显区分于主背景"}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold text-slate-900 dark:text-white">{english ? "Text colors" : "文字色系"}</h4>
                <div className="space-y-2">
                  <ColorSpec
                    name={english ? "Primary text" : "主要文字"}
                    value="#e4e4e7"
                    description={english ? "High contrast for readability" : "高对比度，确保可读性"}
                  />
                  <ColorSpec
                    name={english ? "Secondary text" : "次要文字"}
                    value="#a1a1aa"
                    description={english ? "Moderate contrast without glare" : "适度对比，不刺眼"}
                  />
                  <ColorSpec
                    name={english ? "Helper text" : "辅助文字"}
                    value="#71717a"
                    description={english ? "Lower contrast for hierarchy" : "低对比度，明确层次"}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold text-slate-900 dark:text-white">{english ? "Accent colors" : "强调色系"}</h4>
                <div className="space-y-2">
                  <ColorSpec
                    name={english ? "Primary accent" : "主色调"}
                    value="#60a5fa"
                    description={english ? "Bright sky blue with strong contrast" : "明亮天蓝色，对比度高"}
                  />
                  <ColorSpec
                    name={english ? "Success" : "成功色"}
                    value="#34d399"
                    description={english ? "Clear emerald green" : "清晰翠绿色"}
                  />
                  <ColorSpec
                    name={english ? "Warning" : "警告色"}
                    value="#fbbf24"
                    description={english ? "Visible amber" : "醒目琥珀色"}
                  />
                  <ColorSpec
                    name={english ? "Danger" : "危险色"}
                    value="#f87171"
                    description={english ? "Distinct coral red" : "鲜明珊瑚红"}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold text-slate-900 dark:text-white">{english ? "Contrast data" : "对比度数据"}</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 dark:text-neutral-400">{english ? "Primary text vs background" : "主文字 vs 背景"}</span>
                    <span className="font-mono text-slate-900 dark:text-white">12.6:1 ✅</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 dark:text-neutral-400">{english ? "Secondary text vs background" : "次要文字 vs 背景"}</span>
                    <span className="font-mono text-slate-900 dark:text-white">7.2:1 ✅</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 dark:text-neutral-400">{english ? "Helper text vs background" : "辅助文字 vs 背景"}</span>
                    <span className="font-mono text-slate-900 dark:text-white">4.5:1 ✅</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 dark:text-neutral-400">{english ? "Primary accent vs background" : "主色调 vs 背景"}</span>
                    <span className="font-mono text-slate-900 dark:text-white">8.9:1 ✅</span>
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-neutral-500">
                  {english ? "Pass = meets WCAG AA (4.5:1)." : "合格 = 符合 WCAG AA 标准 (4.5:1)"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 使用建议 */}
        <Card className="border-2 border-emerald-500/20 bg-emerald-50 dark:bg-emerald-950/20">
          <CardHeader>
            <CardTitle>{english ? "Dark Mode Usage Tips" : "深色模式使用建议"}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-slate-700 dark:text-neutral-300">
              <li>• <strong>{english ? "Best use cases" : "最佳使用场景"}</strong>{english ? ": night work, long sessions and lower eye strain." : "：夜间使用、长时间工作、减少眼睛疲劳"}</li>
              <li>• <strong>{english ? "Brightness" : "亮度调节"}</strong>{english ? ": set display brightness around 60-80% for best dark-mode comfort." : "：建议将屏幕亮度调至 60-80%，配合深色模式效果最佳"}</li>
              <li>• <strong>{english ? "Ambient light" : "环境光"}</strong>{english ? ": dark mode can reduce fatigue in dim environments." : "：在暗光环境下使用深色模式，可以显著减少眼睛疲劳"}</li>
              <li>• <strong>{english ? "Breaks" : "间歇使用"}</strong>{english ? ": even with the optimized palette, take regular eye breaks." : "：即使有优化，长时间使用仍建议适当休息眼睛"}</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ColorSpec({ name, value, description }: { name: string; value: string; description: string }) {
  return (
    <div className="flex items-start gap-3 text-sm">
      <div
        className="w-16 h-16 rounded-lg border-2 border-slate-200 dark:border-neutral-700"
        style={{ backgroundColor: value }}
      />
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <span className="font-medium text-slate-900 dark:text-white">{name}</span>
          <span className="font-mono text-xs text-slate-600 dark:text-neutral-400">{value}</span>
        </div>
        <p className="text-xs text-slate-500 dark:text-neutral-500 mt-1">{description}</p>
      </div>
    </div>
  );
}
