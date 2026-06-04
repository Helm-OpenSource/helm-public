import { AlertTriangle, Wifi, Home, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Database connection error banner.
 *
 * Renders a bilingual, judgement-first message when the database
 * is unreachable: tells the user what is wrong, what they can try,
 * and that the app is now in offline mode (no writes will fire).
 */
export function DatabaseConnectionBanner({
  error,
  english = false,
}: {
  error: string;
  english?: boolean;
}) {
  const isNetworkError =
    error.includes("Can't reach database server") ||
    error.includes("connect ECONNREFUSED") ||
    error.includes("connect ETIMEDOUT");

  const headline = isNetworkError
    ? english
      ? "Database is unreachable"
      : "数据库连接失败"
    : english
      ? "Database error"
      : "数据库错误";

  const summary = isNetworkError
    ? english
      ? "We can't reach the database server. You may be off the corporate network — connect to the office VPN, or wait while we retry."
      : "无法连接到数据库服务器。你可能不在公司网络里——先连上公司VPN，或者稍候我们会再试一次。"
    : english
      ? "The database returned an error. Please retry in a moment."
      : "数据库连接出现问题，请稍后重试。";

  const offlineNote = english
    ? "App is running in offline mode. No external writes are firing."
    : "应用正在离线模式下运行，不会向外写入任何内容。";

  const tipsTitle = english ? "What to try" : "可以这样试";
  const tips = english
    ? [
        ["VPN", "If you're working from home, connect to the company VPN first."],
        ["Network", "Confirm your network connection is active."],
        ["Retry", "The database may be temporarily unavailable; try again in a moment."],
        ["Support", "If the issue persists, contact technical support."],
      ]
    : [
        ["VPN连接", "如果你在家工作，请先连接公司VPN。"],
        ["网络检查", "确认网络连接正常。"],
        ["稍后重试", "数据库可能暂时不可用，稍候再试一次。"],
        ["联系支持", "如果问题持续存在，请联系技术支持。"],
      ];

  return (
    <div className="border-b border-[color:var(--status-warning-border)] bg-[color:var(--status-warning-bg)] dark:border-[color:var(--status-warning-border)] dark:bg-[color:var(--accent-warm)]/20">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--status-warning-bg)] dark:bg-[color:var(--accent-warm)]/50">
              {isNetworkError ? (
                <Wifi className="h-5 w-5 text-[color:var(--accent-warm)] dark:text-[color:var(--status-warning-text)]" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-[color:var(--accent-warm)] dark:text-[color:var(--status-warning-text)]" />
              )}
            </div>
            <div>
              <h3 className="text-base font-semibold text-[color:var(--status-warning-text)] dark:text-[color:var(--status-warning-text)]">
                {headline}
              </h3>
              <p className="mt-1 text-sm text-[color:var(--status-warning-text)] dark:text-[color:var(--status-warning-text)]">
                {summary}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              {english ? "Retry" : "重新连接"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => (window.location.href = "/")}
              className="gap-2"
            >
              <Home className="h-4 w-4" />
              {english ? "Back home" : "返回首页"}
            </Button>
          </div>
        </div>

        <div className="mt-4 rounded-lg bg-[color:var(--status-warning-bg)] dark:bg-[color:var(--accent-warm)]/30 p-4">
          <h4 className="text-sm font-semibold text-[color:var(--status-warning-text)] dark:text-[color:var(--status-warning-text)] mb-2">
            {tipsTitle}
          </h4>
          <ul className="space-y-1 text-sm text-[color:var(--status-warning-text)] dark:text-[color:var(--status-warning-text)]">
            {tips.map(([label, body]) => (
              <li key={label}>
                · <strong>{label}</strong>
                {english ? " — " : "："}
                {body}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-3 flex items-center gap-2 text-xs text-[color:var(--status-warning-text)] dark:text-[color:var(--status-warning-text)]">
          <div className="h-2 w-2 rounded-full bg-[color:var(--accent-warm)] animate-pulse" />
          <span>{offlineNote}</span>
        </div>
      </div>
    </div>
  );
}
