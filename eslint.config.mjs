import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import helmDesignTokens from "./eslint-rules/no-raw-tailwind-color.mjs";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Helm-local design token guards.
  //
  // The rule fires at "warn" severity so the existing 0-error pipeline
  // keeps passing. CI strict mode (`npm run lint:strict`) and the
  // husky/lint-staged pre-commit hook treat warnings as failures, which is
  // how new raw-color regressions get blocked.
  //
  // Two intentional ignore zones:
  //   - app/contrast-test/** and app/dark-mode-test/** are color-system
  //     showcase pages that *must* render the raw Tailwind palette.
  //   - eslint-rules/** carries the rule's own test fixtures, which
  //     deliberately include raw colors as inputs to the rule.
  {
    files: ["**/*.{ts,tsx}"],
    ignores: [
      "app/contrast-test/**",
      "app/dark-mode-test/**",
      "eslint-rules/**",
    ],
    plugins: {
      "helm-design-tokens": helmDesignTokens,
    },
    rules: {
      "helm-design-tokens/no-raw-tailwind-color": "warn",
    },
  },
  // Treat underscore-prefixed identifiers as intentionally unused, per the
  // standard convention. This lets us mark "intentionally-unused parameters
  // in placeholder/stub implementations" without lint noise (e.g. local
  // `_state`, `_code` in WIP connectors).
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "**/.next/**",
    "node_modules/**",
    "**/node_modules/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "helm/.next/**",
    "helm/node_modules/**",
    "helm/test-results/**",
    "helm/tsconfig.tsbuildinfo",
  ]),
]);

export default eslintConfig;
