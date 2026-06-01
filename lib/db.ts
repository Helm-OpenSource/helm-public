import { PrismaClient } from ".prisma/client";
import { readEnvVarFromRootFiles } from "@/lib/root-env";

declare global {
  var __prisma: PrismaClient | undefined;
}

const databaseUrl =
  process.env.DATABASE_URL ??
  readEnvVarFromRootFiles("DATABASE_URL", {
    fileNames: [".env.local", ".env"],
  });

if (databaseUrl) {
  process.env.DATABASE_URL = databaseUrl;
}

export const db =
  global.__prisma ??
  new PrismaClient({
    ...(databaseUrl
      ? {
          datasources: {
            db: {
              url: databaseUrl,
            },
          },
        }
      : {}),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__prisma = db;
}
