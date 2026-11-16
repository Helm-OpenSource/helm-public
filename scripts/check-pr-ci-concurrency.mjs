// PR-only cancellation is a cost control, never a replacement for a check.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const group = "  group: ${{ github.workflow }}-${{ github.event_name }}-${{ github.event.pull_request.number || github.run_id }}-${{ github.event_name != 'pull_request' && github.run_attempt || 0 }}";
const cancel = "  cancel-in-progress: ${{ github.event_name == 'pull_request' }}";
for (const file of ['ci.yml', 'd2-docker-smoke.yml']) {
  const source = readFileSync(new URL(`../.github/workflows/${file}`, import.meta.url), 'utf8');
  assert.equal((source.match(/^concurrency:$/gm) || []).length, 1, file);
  assert.ok(source.includes(`concurrency:\n${group}\n${cancel}\n`), file);
}
// Mirror the expression's event partition: only same-workflow/same-PR collides.
const key = (workflow, event, pr, run, attempt) =>
  `${workflow}-${event}-${pr || run}-${event !== 'pull_request' ? attempt : 0}`;
assert.equal(key('CI', 'pull_request', 7, 1, 1), key('CI', 'pull_request', 7, 2, 1));
assert.notEqual(key('CI', 'pull_request', 7, 1, 1), key('CI', 'pull_request', 8, 2, 1));
assert.notEqual(key('CI', 'pull_request', 7, 1, 1), key('D2 Docker Smoke', 'pull_request', 7, 1, 1));
for (const event of ['push', 'workflow_dispatch', 'merge_group', 'schedule']) {
  assert.notEqual(key('CI', event, null, 1, 1), key('CI', event, null, 2, 1));
  assert.notEqual(key('CI', event, null, 1, 1), key('CI', event, null, 1, 2));
}
console.log('PR concurrency guard passed: same PR only; other runs and attempts isolated.');
