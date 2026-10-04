import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { childHasExited, closeOwnedChild } from './caio-http-child-lifecycle.mjs';
async function launch(code) {
  const child = spawn(process.execPath, ['-e', code], { stdio: ['ignore', 'pipe', 'pipe'] });
  await once(child, 'spawn'); return child;
}
async function bounded(promise) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('owned_cleanup_did_not_settle')), 2500); })]); }
  finally { clearTimeout(timer); }
}
async function cleanupAfterFailure(child) {
  if (child.exitCode === null && child.signalCode === null) {
    const done = once(child, 'exit'); child.kill('SIGKILL'); await bounded(done);
  }
  child.stdout?.destroy(); child.stderr?.destroy();
}
test('already normal-exited owned child closes without waiting for a second exit event', async () => {
 const child = await launch('process.exit(0)');
 try { await once(child, 'exit'); const result = await bounded(closeOwnedChild(child, { termMs: 50, killMs: 1000 }));
  assert.equal(result.closed, true); assert.equal(childHasExited(child), true); assert.equal(child.exitCode, 0); }
 finally { await cleanupAfterFailure(child); }
});
test('already signal-exited owned child is terminal even though exitCode is null', async () => {
 const child = await launch('setInterval(() => {}, 1000)');
 try { const done = once(child, 'exit'); child.kill('SIGTERM'); const [code, signal] = await done;
  assert.equal(code, null); assert.equal(signal, 'SIGTERM');
  const result = await bounded(closeOwnedChild(child, { termMs: 50, killMs: 1000 }));
  assert.equal(result.closed, true); assert.equal(childHasExited(child), true); }
 finally { await cleanupAfterFailure(child); }
});
test('live owned child signal exit is observed by a listener registered before termination', async () => {
 const child = await launch('setInterval(() => {}, 1000)');
 try { const result = await bounded(closeOwnedChild(child, { termMs: 1000, killMs: 1000 }));
  assert.equal(result.closed, true); assert.equal(child.signalCode, 'SIGTERM'); assert.equal(result.escalated, false); }
 finally { await cleanupAfterFailure(child); }
});
test('TERM timeout escalates only the owned child to bounded KILL and confirms its real terminal state', async () => {
 const child = await launch('process.on("SIGTERM", () => {}); console.log("ready"); setInterval(() => {}, 1000)');
 try { await once(child.stdout, 'data'); const result = await bounded(closeOwnedChild(child, { termMs: 50, killMs: 1000 }));
  assert.equal(result.closed, true); assert.equal(result.escalated, true); assert.equal(child.signalCode, 'SIGKILL'); }
 finally { await cleanupAfterFailure(child); }
});
