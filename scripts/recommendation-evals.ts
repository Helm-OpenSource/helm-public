import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { DEFAULT_MYSQL_DATABASE_URL } from "@/lib/db-url";
import { runRecommendationGoldenEval } from "@/lib/evals/recommendation-evals";

function parseEnvFile(relativePath: string) {
  const fullPath = path.join(process.cwd(), relativePath);
  if (!existsSync(fullPath)) {
    return {};
  }

  const content = readFileSync(fullPath, "utf8");
  return Object.fromEntries(
    content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const [key, ...rest] = line.split("=");
        const rawValue = rest.join("=").trim();
        return [key.trim(), rawValue.replace(/^"(.*)"$/, "$1")];
      }),
  );
}

if (!process.env.DATABASE_URL) {
  const merged = {
    ...parseEnvFile(".env.example"),
    ...parseEnvFile(".env"),
  };

  process.env.DATABASE_URL = String(merged.DATABASE_URL || DEFAULT_MYSQL_DATABASE_URL);
}

async function main() {
  const summary = await runRecommendationGoldenEval();

  console.log(JSON.stringify(summary, null, 2));

  if (summary.passedCases !== summary.totalCases) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
