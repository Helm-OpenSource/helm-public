// PR-only cancellation is a cost control, never a replacement for a check.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const group = "  group: ${{ github.workflow }}-${{ github.event_name }}-${{ github.event_name == 'pull_request' && github.run_attempt == 1 && format('pr-{0}', github.event.pull_request.number) || format('run-{0}-{1}', github.run_id, github.run_attempt) }}";
const cancel = "  cancel-in-progress: ${{ github.event_name == 'pull_request' && github.run_attempt == 1 }}";
for (const file of ['ci.yml', 'd2-docker-smoke.yml']) {
  const source = readFileSync(new URL(`../.github/workflows/${file}`, import.meta.url), 'utf8');
  assert.equal((source.match(/^concurrency:$/gm) || []).length, 1, file);
  assert.ok(source.includes(`concurrency:\n${group}\n${cancel}\n`), file);
}
// Mirror the expression's event partition: only same-workflow/same-PR collides.
const key = (workflow, event, pr, run, attempt) =>
  `${workflow}-${event}-${event === 'pull_request' && attempt === 1 ? `pr-${pr}` : `run-${run}-${attempt}`}`;
assert.equal(key('CI', 'pull_request', 7, 1, 1), key('CI', 'pull_request', 7, 2, 1));
assert.notEqual(key('CI', 'pull_request', 7, 1, 1), key('CI', 'pull_request', 8, 2, 1));
assert.notEqual(key('CI', 'pull_request', 7, 1, 1), key('D2 Docker Smoke', 'pull_request', 7, 1, 1));
// An old SHA rerun must neither cancel nor occupy the latest PR first-run group.
assert.notEqual(key('CI', 'pull_request', 7, 1, 2), key('CI', 'pull_request', 7, 2, 1));
assert.notEqual(key('CI', 'pull_request', 7, 1, 2), key('CI', 'pull_request', 7, 2, 2));
assert.notEqual(key('CI', 'pull_request', 7, 1, 2), key('CI', 'pull_request', 7, 1, 3));
for (const event of ['push', 'workflow_dispatch', 'merge_group', 'schedule']) {
  assert.notEqual(key('CI', event, null, 1, 1), key('CI', event, null, 2, 1));
  assert.notEqual(key('CI', event, null, 1, 1), key('CI', event, null, 1, 2));
}
const cancels = (event, attempt) => event === 'pull_request' && attempt === 1;
assert.equal(cancels('pull_request', 1), true);
for (const [event, attempt] of [['pull_request', 2], ['push', 1], ['workflow_dispatch', 1]]) {
  assert.equal(cancels(event, attempt), false);
}
console.log('PR concurrency guard passed: same PR only; other runs and attempts isolated.');
