import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { isolatedHttpEnvironment } from './test-caio-http-mysql.mjs';
const value = 'mysql://synthetic@127.0.0.1/helm_caio_stage1_synthetic';
const env = { DATABASE_URL: value, STAGE1_OWNER_LOOP_DATABASE_URL: value,
 STAGE1_OWNER_LOOP_TEST_DATABASE_NAME: 'helm_caio_stage1_synthetic', HELM_CAIO_HTTP_MYSQL_ISOLATED: '1' };
test('requires the independent disposable DB sentinel before any build/connect', () => {
 assert.throws(() => isolatedHttpEnvironment({ ...env, HELM_CAIO_HTTP_MYSQL_ISOLATED: undefined }));
 const child = spawnSync(process.execPath, ['scripts/test-caio-http-mysql.mjs'], { env: { ...env, HELM_CAIO_HTTP_MYSQL_ISOLATED: undefined }, encoding: 'utf8', timeout: 3000 });
 assert.equal(child.status, 2); assert.equal(child.stdout, '');
 assert.equal(child.stderr.trim(), 'isolated_http_database_required');
});
test('refuses remote, production-name and mismatched database inputs without disclosing them', () => {
 for (const bad of ['mysql://synthetic@example.test/helm_caio_stage1_synthetic', 'mysql://synthetic@127.0.0.1/business']) {
  assert.throws(() => isolatedHttpEnvironment({ ...env, DATABASE_URL: bad, STAGE1_OWNER_LOOP_DATABASE_URL: bad }));
 }
 assert.throws(() => isolatedHttpEnvironment({ ...env, DATABASE_URL: 'different' }));
});
test('passes only the isolated DSN and disables background/provider paths, dropping inherited secret/code injection', () => {
 const child = isolatedHttpEnvironment({ ...env, OPENAI_API_KEY: 'synthetic', NODE_OPTIONS: '--import=bad', ENGINEERING_REVIEW_CRON_ENABLED: 'true' });
 assert.equal(child.OPENAI_API_KEY, undefined); assert.equal(child.NODE_OPTIONS, undefined);
 assert.equal(child.ENGINEERING_REVIEW_CRON_ENABLED, 'false'); assert.equal(child.DATABASE_URL, value);
});
