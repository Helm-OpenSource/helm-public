type InfoProps = {
  label: string;
  value: string;
};

export function Info({ label, value }: InfoProps) {
  return (
    <div className="workspace-panel rounded-2xl px-4 py-3">
      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
        {label}
      </p>
      <p className="mt-2 break-words text-sm font-medium text-[color:var(--foreground)]">
        {value}
      </p>
    </div>
  );
}

type RoleGuideProps = {
  title: string;
  description: string;
};

export function RoleGuide({ title, description }: RoleGuideProps) {
  return (
    <div className="theme-surface-panel rounded-2xl px-4 py-4">
      <p className="font-medium text-[color:var(--foreground)]">{title}</p>
      <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
        {description}
      </p>
    </div>
  );
}

type StatusHintProps = {
  title: string;
  body: string;
  tone: "success" | "warning";
};

export function StatusHint({ title, body, tone }: StatusHintProps) {
  return (
    <div
      className={`rounded-2xl border px-4 py-4 ${tone === "success" ? "border-[color:var(--status-success-border)] bg-[color:var(--status-success-bg)]" : "border-[color:var(--status-warning-border)] bg-[color:var(--status-warning-bg)]"}`}
    >
      <p className="text-sm font-semibold text-[color:var(--foreground)]">
        {title}
      </p>
      <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
        {body}
      </p>
    </div>
  );
}
