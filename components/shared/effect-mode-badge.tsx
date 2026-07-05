import { Badge } from "@/components/ui/badge";
import { resolveEffectModeBadge } from "@/lib/design-language/effect-mode-badge-copy";

/**
 * Effect-mode corner mark (NPA-pack design language, Core port).
 *
 * Marks an item as suggestion / shadow suggestion / human action / receipt so
 * recommendation-vs-commitment stays visually unmistakable. Unknown modes
 * render as an explicit danger badge instead of a silent default.
 */
export function EffectModeBadge({
  mode,
  english,
  className,
}: {
  mode: string;
  english: boolean;
  className?: string;
}) {
  const presentation = resolveEffectModeBadge(mode, english);
  return (
    <Badge
      variant={presentation.variant}
      className={className}
      data-effect-mode={presentation.known ? mode : "unknown"}
    >
      {presentation.label}
    </Badge>
  );
}
