import { describe, expect, it } from "vitest";
import { Linter } from "eslint";
import pluginModule from "./no-raw-tailwind-color.mjs";

// The local rule is plain ESM without strict ESLint Plugin types; cast
// through unknown so the test stays type-safe at the assertion layer.
const plugin = pluginModule as unknown;

function makeLinter() {
  const linter = new Linter({ configType: "flat" });
  const config = [
    {
      files: ["**/*.{ts,tsx,js,jsx}"],
      languageOptions: {
        parserOptions: {
          ecmaVersion: 2022,
          sourceType: "module",
          ecmaFeatures: { jsx: true },
        },
      },
      plugins: { "helm-design-tokens": plugin },
      rules: {
        "helm-design-tokens/no-raw-tailwind-color": "error",
      },
    },
  ] as unknown as Parameters<Linter["verify"]>[1];
  return {
    lint(code: string, filename = "fixture.tsx") {
      return linter.verify(code, config, filename);
    },
  };
}

describe("no-raw-tailwind-color", () => {
  const linter = makeLinter();

  it("reports raw text-slate-* in a JSX className literal", () => {
    const messages = linter.lint(
      `const Foo = () => <div className="text-slate-600">x</div>;`,
    );
    expect(messages).toHaveLength(1);
    expect(messages[0]?.messageId).toBe("rawColor");
    expect(messages[0]?.message).toContain("text-slate-600");
  });

  it("reports raw bg-amber-50 inside a tailwind class string", () => {
    const messages = linter.lint(
      `const cls = "rounded bg-amber-50 px-3";`,
    );
    expect(messages).toHaveLength(1);
    expect(messages[0]?.message).toContain("bg-amber-50");
  });

  it("reports raw ring-rose-200 in a template literal", () => {
    const messages = linter.lint(
      "const cls = `ring-1 ring-rose-200`;",
    );
    expect(messages).toHaveLength(1);
    expect(messages[0]?.message).toContain("ring-rose-200");
  });

  it("catches raw colors guarded by Tailwind variants (dark:, hover:, md:)", () => {
    const messages = linter.lint(
      `const cls = "dark:text-slate-100 hover:bg-emerald-700";`,
    );
    expect(messages.length).toBeGreaterThanOrEqual(1);
    expect(messages.some((m) => m.message.includes("text-slate-100"))).toBe(true);
  });

  it("does not report CSS var-based color tokens", () => {
    const messages = linter.lint(
      `const cls = "text-[color:var(--foreground)] bg-[color:var(--surface-subtle)] ring-[color:var(--status-info-border)]";`,
    );
    expect(messages).toHaveLength(0);
  });

  it("does not report unrelated text containing similar substrings", () => {
    const messages = linter.lint(
      `const note = "Slate workshop met-700 attendees, but it is just prose.";`,
    );
    expect(messages).toHaveLength(0);
  });

  it("does not match unrelated 600 numbers in arbitrary text", () => {
    const messages = linter.lint(
      `const id = "task-text-input-600";`,
    );
    expect(messages).toHaveLength(0);
  });

  it("reports gradient stop colors (from-/to-/via-)", () => {
    const messages = linter.lint(
      `const cls = "bg-gradient-to-r from-emerald-500 to-emerald-600";`,
    );
    expect(messages.length).toBeGreaterThanOrEqual(1);
    expect(messages.some((m) => m.message.includes("from-emerald-500"))).toBe(
      true,
    );
  });
});
