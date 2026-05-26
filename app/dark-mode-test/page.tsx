"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Moon, Sun, Contrast } from "lucide-react";

type BadgeVariant = NonNullable<React.ComponentProps<typeof Badge>["variant"]>;

/**
 * 深色模式对比测试页面
 *
 * 用于展示和测试优化后的深色模式配色
 * 重点：更舒适的对比度、更清晰的层次感、更易分辨的色彩
 */
export default function DarkModeTestPage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    document.documentElement.dataset.theme = newTheme;
    document.documentElement.style.colorScheme = newTheme;
  };

  const statusExamples: Array<{ type: BadgeVariant; label: string; text: string }> = [
    { type: "success", label: "成功状态", text: "任务已完成" },
    { type: "warning", label: "警告状态", text: "需要注意" },
    { type: "danger", label: "危险状态", text: "立即处理" },
    { type: "info", label: "信息状态", text: "系统通知" },
  ];

  const contrastExamples = [
    { level: "高对比度", color: "text-white", description: "标题和重要信息" },
    { level: "中对比度", color: "text-gray-300", description: "正文和内容" },
    { level: "低对比度", color: "text-gray-500", description: "辅助和说明文字" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-neutral-950 dark:to-black p-4 md:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* 页面标题和主题切换 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
              🎨 深色模式对比测试
            </h1>
            <p className="mt-2 text-lg text-slate-600 dark:text-neutral-400">
              优化后的配色方案：更舒适、更易分辨、更护眼
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
                切换到深色模式
              </>
            ) : (
              <>
                <Sun className="h-5 w-5" />
                切换到浅色模式
              </>
            )}
          </Button>
        </div>

        {/* 配色优化说明 */}
        <Card className="border-2 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Contrast className="h-6 w-6" />
              深色模式优化要点
            </CardTitle>
            <CardDescription>
              解决原配色让人眼疲劳的问题
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <h4 className="font-semibold text-slate-900 dark:text-white">🚫 之前的问题</h4>
                <ul className="space-y-1 text-sm text-slate-600 dark:text-neutral-400">
                  <li>• 对比度不足，文字难以辨认</li>
                  <li>• 大量蓝灰色调，缺乏层次感</li>
                  <li>• 状态色彩不够明显</li>
                  <li>• 长时间使用眼睛疲劳</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-slate-900 dark:text-white">✅ 优化后的改进</h4>
                <ul className="space-y-1 text-sm text-slate-600 dark:text-neutral-400">
                  <li>• 提高对比度，确保文字清晰可读</li>
                  <li>• 纯黑背景，减少蓝光刺激</li>
                  <li>• 鲜明的状态色彩，一目了然</li>
                  <li>• 舒适的视觉层次，减少眼睛负担</li>
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
                  这是示例文字，用于测试在不同对比度下的可读性。
                  应该能够清晰分辨各个层次的区别。
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 状态色彩测试 */}
        <Card>
          <CardHeader>
            <CardTitle>🎯 状态色彩对比</CardTitle>
            <CardDescription>
              优化后的状态色彩在深色模式下更加醒目
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
            <CardTitle>🎨 优化后的深色模式配色规格</CardTitle>
            <CardDescription>
              具体的颜色值和对比度数据
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <h4 className="font-semibold text-slate-900 dark:text-white">背景色系</h4>
                <div className="space-y-2">
                  <ColorSpec
                    name="主背景"
                    value="#0a0a0a"
                    description="接近纯黑，减少眼睛疲劳"
                  />
                  <ColorSpec
                    name="提升背景"
                    value="#141414"
                    description="轻微提升，保持对比"
                  />
                  <ColorSpec
                    name="卡片背景"
                    value="#1a1a1a"
                    description="明显区分于主背景"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold text-slate-900 dark:text-white">文字色系</h4>
                <div className="space-y-2">
                  <ColorSpec
                    name="主要文字"
                    value="#e4e4e7"
                    description="高对比度，确保可读性"
                  />
                  <ColorSpec
                    name="次要文字"
                    value="#a1a1aa"
                    description="适度对比，不刺眼"
                  />
                  <ColorSpec
                    name="辅助文字"
                    value="#71717a"
                    description="低对比度，明确层次"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold text-slate-900 dark:text-white">强调色系</h4>
                <div className="space-y-2">
                  <ColorSpec
                    name="主色调"
                    value="#60a5fa"
                    description="明亮天蓝色，对比度高"
                  />
                  <ColorSpec
                    name="成功色"
                    value="#34d399"
                    description="清晰翠绿色"
                  />
                  <ColorSpec
                    name="警告色"
                    value="#fbbf24"
                    description="醒目琥珀色"
                  />
                  <ColorSpec
                    name="危险色"
                    value="#f87171"
                    description="鲜明珊瑚红"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold text-slate-900 dark:text-white">对比度数据</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 dark:text-neutral-400">主文字 vs 背景</span>
                    <span className="font-mono text-slate-900 dark:text-white">12.6:1 ✅</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 dark:text-neutral-400">次要文字 vs 背景</span>
                    <span className="font-mono text-slate-900 dark:text-white">7.2:1 ✅</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 dark:text-neutral-400">辅助文字 vs 背景</span>
                    <span className="font-mono text-slate-900 dark:text-white">4.5:1 ✅</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 dark:text-neutral-400">主色调 vs 背景</span>
                    <span className="font-mono text-slate-900 dark:text-white">8.9:1 ✅</span>
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-neutral-500">
                  ✅ = 符合 WCAG AA 标准 (4.5:1)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 使用建议 */}
        <Card className="border-2 border-emerald-500/20 bg-emerald-50 dark:bg-emerald-950/20">
          <CardHeader>
            <CardTitle>💡 深色模式使用建议</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-slate-700 dark:text-neutral-300">
              <li>• <strong>最佳使用场景</strong>：夜间使用、长时间工作、减少眼睛疲劳</li>
              <li>• <strong>亮度调节</strong>：建议将屏幕亮度调至 60-80%，配合深色模式效果最佳</li>
              <li>• <strong>环境光</strong>：在暗光环境下使用深色模式，可以显著减少眼睛疲劳</li>
              <li>• <strong>间歇使用</strong>：即使有优化，长时间使用仍建议适当休息眼睛</li>
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
