type PipelineMixChartProps = {
  english?: boolean;
  items: Array<{
    label: string;
    total: number;
    low: number;
    medium: number;
    high: number;
    critical: number;
  }>;
};

const segmentPalette = {
  low: "bg-[color:var(--status-success-bg)]0",
  medium: "bg-[color:var(--status-warning-bg)]0",
  high: "bg-[color:var(--status-warning-bg)]0",
  critical: "bg-[color:var(--status-danger-bg)]0",
};

export function PipelineMixChart({ items, english = false }: PipelineMixChartProps) {
  const maxValue = Math.max(1, ...items.map((item) => item.total));

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.label} className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-[color:var(--foreground)]">{item.label}</p>
            <p className="text-xs text-[color:var(--muted-foreground)]">{english ? `${item.total} items` : `${item.total} 条`}</p>
          </div>
          <div className="theme-surface-track flex h-3 overflow-hidden rounded-full">
            {(["low", "medium", "high", "critical"] as const).map((segment) => {
              const count = item[segment];
              const width = item.total ? `${(count / maxValue) * 100}%` : "0%";
              if (!count) return null;

              return <span key={segment} className={`block h-full ${segmentPalette[segment]}`} style={{ width }} />;
            })}
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-[color:var(--muted-foreground)]">
            <span>{english ? "Low risk" : "低风险"} {item.low}</span>
            <span>{english ? "Medium risk" : "中风险"} {item.medium}</span>
            <span>{english ? "High risk" : "高风险"} {item.high}</span>
            <span>{english ? "Critical risk" : "关键风险"} {item.critical}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
