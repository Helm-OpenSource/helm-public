// Test-only runner: build and exercise real Next HTTP solely on a confirmed disposable DB.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export function isolatedHttpEnvironment(input) {
  const value = input.STAGE1_OWNER_LOOP_DATABASE_URL;
  let url;
  try { url = new URL(value); } catch { throw new Error('isolated_http_database_required'); }
  const database = decodeURIComponent(url.pathname.slice(1));
  const socket = url.searchParams.get('socket');
  if (input.HELM_CAIO_HTTP_MYSQL_ISOLATED !== '1' || value !== input.DATABASE_URL ||
      url.protocol !== 'mysql:' || !/^helm_caio_stage1_[a-zA-Z0-9_]+$/.test(database) ||
      input.STAGE1_OWNER_LOOP_TEST_DATABASE_NAME !== database ||
      !(url.hostname === '127.0.0.1' && !socket || url.hostname === 'localhost' && socket?.startsWith('/') && !socket.includes('..'))) {
    throw new Error('isolated_http_database_required');
  }
  const env = Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'SYSTEMROOT'].filter(k => input[k]).map(k => [k, input[k]]));
  return { ...env, DATABASE_URL: value, STAGE1_OWNER_LOOP_DATABASE_URL: value,
    STAGE1_OWNER_LOOP_TEST_DATABASE_NAME: database, HELM_CAIO_HTTP_MYSQL_ISOLATED: '1',
    NEXT_TELEMETRY_DISABLED: '1', NEXT_DIST_DIR: '.next', LLM_ENABLED: 'false',
    ENGINEERING_REVIEW_CRON_ENABLED: 'false', LIGHT_CHAIN_FOLLOW_THROUGH_CRON_ENABLED: 'false',
    SIGNAL_COLLECTION_SCHEDULER_ENABLED: 'false', HELM_AUTH_EMAIL_ENTRY_ENABLED: 'false',
    VITEST_HOOK_TIMEOUT_MS: '60000' };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let env;
  try { env = isolatedHttpEnvironment(process.env); } catch { console.error('isolated_http_database_required'); process.exit(2); }
  for (const [args, timeout] of [
    [['node_modules/next/dist/bin/next', 'build'], 1200000],
    [['node_modules/vitest/vitest.mjs', 'run', 'lib/caio-inference/judgement-decision-candidate.http.mysql.test.ts', '--config', 'vitest.public.config.ts', '--fileParallelism=false'], 240000],
  ]) {
    const result = spawnSync(process.execPath, args, { env, stdio: 'inherit', timeout });
    if (result.error || result.status !== 0) process.exit(result.status ?? 1);
  }
}
