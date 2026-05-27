import { describe } from "vitest";

export const mysqlRuntimeTestsEnabled =
  process.env.HELM_RUN_MYSQL_RUNTIME_TESTS === "1";

export const describeMySqlRuntime = mysqlRuntimeTestsEnabled
  ? describe
  : describe.skip;
