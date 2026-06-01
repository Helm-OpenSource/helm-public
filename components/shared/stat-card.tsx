import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  detail,
  href,
  onClick,
  active = false,
}: {
  label: string;
  value: string | number;
  detail?: string;
  href?: string;
  onClick?: () => void;
  active?: boolean;
}) {
  const cardClassName = cn(
    "workspace-kpi-card transition",
    href || onClick
      ? "block text-left hover:-translate-y-0.5 hover:border-[color:color-mix(in_oklab,var(--border)_56%,var(--accent)_44%)] hover:shadow-[0_22px_40px_-26px_rgba(15,23,42,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
      : "",
    active
      ? "border-[color:color-mix(in_oklab,var(--border)_48%,var(--accent)_52%)] shadow-[0_22px_40px_-26px_rgba(25,70,80,0.45)]"
      : "",
  );

  const content = (
    <CardContent className="space-y-3 py-5">
      <p className="workspace-kpi-label">{label}</p>
      <p className="text-[2rem] font-semibold tracking-tight text-[color:var(--foreground)]">
        {value}
      </p>
      {detail ? (
        <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">{detail}</p>
      ) : null}
    </CardContent>
  );

  if (href) {
    return (
      <Link href={href}>
        <Card className={cardClassName}>{content}</Card>
      </Link>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="block w-full text-left"
      >
        <Card className={cardClassName}>{content}</Card>
      </button>
    );
  }

  return <Card className={cardClassName}>{content}</Card>;
}
