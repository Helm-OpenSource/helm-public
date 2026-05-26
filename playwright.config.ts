import { defineConfig } from "@playwright/test";

const playwrightDistDir = ".tmp/playwright/.next";
const playwrightPort = Number(process.env.PLAYWRIGHT_SERVER_PORT ?? "3100");
const playwrightBaseUrl = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${playwrightPort}`;
const reuseExistingServer = process.env.PLAYWRIGHT_REUSE_SERVER === "1";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  workers: 1,
  expect: {
    timeout: 30_000,
  },
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: playwrightBaseUrl,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  webServer: reuseExistingServer
    ? undefined
    : {
        command: `ALIYUN_MAIL_SYSTEM_PASSWORD='' ALIYUN_MAIL_FOUNDER_PASSWORD='' NEXT_DIST_DIR='${playwrightDistDir}' PLAYWRIGHT_BASE_URL='${playwrightBaseUrl}' PLAYWRIGHT_SERVER_PORT='${playwrightPort}' HELM_ALLOW_VERIFICATION_CODE_PREVIEW='1' npm run build && ALIYUN_MAIL_SYSTEM_PASSWORD='' ALIYUN_MAIL_FOUNDER_PASSWORD='' NEXT_DIST_DIR='${playwrightDistDir}' PLAYWRIGHT_BASE_URL='${playwrightBaseUrl}' PLAYWRIGHT_SERVER_PORT='${playwrightPort}' HELM_ALLOW_VERIFICATION_CODE_PREVIEW='1' npm run start -- --hostname 127.0.0.1 --port ${playwrightPort}`,
        cwd: __dirname,
        url: playwrightBaseUrl,
        // Browser e2e stays on an isolated production bundle so local dev-only
        // dependency resolution does not skew the runtime contract under test.
        reuseExistingServer,
        timeout: 240_000,
      },
});
