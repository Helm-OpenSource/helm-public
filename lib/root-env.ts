import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

type ReadRootEnvVarOptions = {
  projectRoot?: string;
  fileNames?: string[];
};

export function readEnvVarFromRootFiles(
  name: string,
  options: ReadRootEnvVarOptions = {},
) {
  const projectRoot = options.projectRoot ?? /* turbopackIgnore: true */ process.cwd();
  const fileNames = options.fileNames ?? [".env.local", ".env"];

  for (const fileName of fileNames) {
    const filePath = path.resolve(/* turbopackIgnore: true */ projectRoot, fileName);
    if (!existsSync(/* turbopackIgnore: true */ filePath)) {
      continue;
    }

    const lines = readFileSync(/* turbopackIgnore: true */ filePath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const [key, ...rest] = trimmed.split("=");
      if (key !== name || rest.length === 0) {
        continue;
      }

      return rest.join("=").trim().replace(/^['"]|['"]$/g, "");
    }
  }

  return undefined;
}
