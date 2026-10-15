import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatRoleDetailDisplayText } from "@/lib/presentation/role-detail-display-copy";

export type RelatedObjectLink = {
  label: string;
  href: string;
  variant?: "default" | "secondary" | "ghost";
};

/**
 * The links the folded chain shell used to show in its header, kept on the
 * object side of the page so the next hop (review request, handoff, linked
 * contact or meeting) stays one click away while the shell itself is folded.
 */
export function RelatedObjectLinks({
  links,
  english,
}: {
  links: readonly RelatedObjectLink[];
  english: boolean;
}) {
  if (!links.length) return null;

  return (
    <nav
      data-related-object-links="true"
      aria-label={english ? "Related pages" : "相关页面"}
      className="flex flex-wrap gap-2"
    >
      {links.map((link, index) => (
        <Button
          key={`${link.href}-${index}`}
          variant={link.variant === "default" ? "default" : "secondary"}
          size="sm"
          asChild
        >
          <Link href={link.href}>
            {formatRoleDetailDisplayText(link.label, english)}
          </Link>
        </Button>
      ))}
    </nav>
  );
}
