type ActivityTrendChartProps = {
  english?: boolean;
  series: Array<{
    label: string;
    executed: number;
    meetings: number;
    approvals: number;
  }>;
};

function buildLine(points: number[], width: number, height: number, maxValue: number) {
  return points
    .map((value, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * width;
      const y = height - (value / maxValue) * height;
      return `${x},${y}`;
    })
    .join(" ");
}

export function ActivityTrendChart({ series, english = false }: ActivityTrendChartProps) {
  const width = 520;
  const height = 160;
  const maxValue = Math.max(
    1,
    ...series.flatMap((point) => [point.executed, point.meetings, point.approvals]),
  );

  const executedLine = buildLine(series.map((point) => point.executed), width, height, maxValue);
  const meetingLine = buildLine(series.map((point) => point.meetings), width, height, maxValue);
  const approvalLine = buildLine(series.map((point) => point.approvals), width, height, maxValue);

  return (
    <div className="space-y-4">
      <svg viewBox={`0 0 ${width} ${height + 24}`} className="w-full overflow-visible">
        {Array.from({ length: maxValue + 1 }).map((_, index) => {
          const y = height - (index / maxValue) * height;
          return <line key={index} x1="0" y1={y} x2={width} y2={y} stroke="rgba(148,163,184,0.18)" strokeDasharray="4 6" />;
        })}
        <polyline fill="none" stroke="#194650" strokeWidth="3" points={executedLine} />
        <polyline fill="none" stroke="#2563eb" strokeWidth="3" points={meetingLine} />
        <polyline fill="none" stroke="#6366f1" strokeWidth="3" points={approvalLine} />

        {series.map((point, index) => {
          const x = (index / Math.max(series.length - 1, 1)) * width;
          return (
            <text key={point.label} x={x} y={height + 18} textAnchor="middle" fontSize="12" fill="currentColor" opacity="0.65">
              {point.label}
            </text>
          );
        })}
      </svg>
      <div className="grid gap-3 md:grid-cols-3">
        <Legend label={english ? "Executed actions" : "已执行动作"} color="#194650" />
        <Legend label={english ? "Meetings" : "会议数量"} color="#2563eb" />
        <Legend label={english ? "New approvals" : "新审批动作"} color="#6366f1" />
      </div>
    </div>
  );
}

function Legend({ label, color }: { label: string; color: string }) {
  return (
    <div className="theme-surface-panel flex items-center gap-2 rounded-2xl px-3 py-3 text-sm text-[color:var(--muted)]">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </div>
  );
}
