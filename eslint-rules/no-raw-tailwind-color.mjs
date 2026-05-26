/**
 * Helm custom ESLint rule: no-raw-tailwind-color
 *
 * Disallows raw Tailwind palette tokens (e.g. `text-slate-600`, `bg-amber-50`,
 * `ring-rose-200`) inside string literals, JSX attribute values, and template
 * strings. Per DESIGN.md §5.1.1, all colors must go through CSS vars defined
 * in `app/globals.css` so light/dark theming and brand drift stay in one
 * place.
 *
 * The rule reports the first forbidden token it finds in any given string,
 * which is enough to surface intent without spamming when a className contains
 * multiple violations.
 */

const COLOR_FAMILIES = [
  "slate",
  "amber",
  "sky",
  "rose",
  "red",
  "emerald",
  "blue",
  "indigo",
  "orange",
  "green",
  "yellow",
  "gray",
  "neutral",
  "stone",
  "fuchsia",
  "violet",
  "teal",
  "cyan",
  "lime",
  "pink",
];

const COLOR_SHADES = [
  "50",
  "100",
  "200",
  "300",
  "400",
  "500",
  "600",
  "700",
  "800",
  "900",
  "950",
];

// Tailwind class prefixes that take a color value.
const CLASS_PREFIXES = [
  "text",
  "bg",
  "border",
  "border-x",
  "border-y",
  "border-t",
  "border-b",
  "border-l",
  "border-r",
  "ring",
  "ring-offset",
  "outline",
  "fill",
  "stroke",
  "from",
  "via",
  "to",
  "placeholder",
  "caret",
  "accent",
  "decoration",
  "divide",
  "shadow",
];

const PREFIX_GROUP = CLASS_PREFIXES.map((p) => p.replace(/-/g, "\\-")).join("|");
const FAMILY_GROUP = COLOR_FAMILIES.join("|");
const SHADE_GROUP = COLOR_SHADES.join("|");

// Word-boundary pattern that catches `text-slate-600`, `dark:bg-rose-500`,
// `hover:text-emerald-700` etc. Variant prefixes (dark:, hover:, md:) are
// allowed because the offending token is the color portion itself.
const RAW_COLOR_PATTERN = new RegExp(
  String.raw`(?<![\w-])(${PREFIX_GROUP})-(${FAMILY_GROUP})-(${SHADE_GROUP})(?![\w-])`,
);

function checkString(context, node, raw) {
  if (typeof raw !== "string" || raw.length === 0) return;
  const match = raw.match(RAW_COLOR_PATTERN);
  if (!match) return;
  context.report({
    node,
    messageId: "rawColor",
    data: { token: match[0] },
  });
}

const rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow raw Tailwind palette tokens; use CSS var tokens defined in app/globals.css. See DESIGN.md §5.1.1 for the migration map.",
    },
    schema: [],
    messages: {
      rawColor:
        "Avoid raw Tailwind color '{{token}}'. Use a CSS var token (e.g. text-[color:var(--foreground)], bg-[color:var(--status-warning-bg)]). See DESIGN.md §5.1.1.",
    },
  },
  create(context) {
    return {
      Literal(node) {
        if (typeof node.value === "string") {
          checkString(context, node, node.value);
        }
      },
      TemplateElement(node) {
        const cooked = node.value && node.value.cooked;
        if (typeof cooked === "string") {
          checkString(context, node, cooked);
        }
      },
    };
  },
};

const plugin = {
  rules: {
    "no-raw-tailwind-color": rule,
  },
};

export default plugin;
