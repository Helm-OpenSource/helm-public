// Test-only cleanup of the exact ChildProcess the fixture created; no process search or group-wide signals.
export function childHasExited(child) {
  return child.exitCode !== null || child.signalCode !== null;
}
function signalAndWait(child, signal, timeoutMs) {
  return new Promise(resolve => {
    if (childHasExited(child)) { resolve(true); return; }
    let settled = false;
    let timer;
    const finish = closed => {
      if (settled) return;
      settled = true; clearTimeout(timer); child.off('exit', onExit); resolve(closed);
    };
    const onExit = () => finish(childHasExited(child));
    // Register before kill. Check again after registration to cover an already-delivered terminal state.
    child.once('exit', onExit);
    timer = setTimeout(() => finish(childHasExited(child)), timeoutMs);
    if (childHasExited(child)) { finish(true); return; }
    try { child.kill(signal); } catch { finish(childHasExited(child)); }
  });
}
export async function closeOwnedChild(child, { termMs = 5000, killMs = 2000 } = {}) {
  for (const value of [termMs, killMs]) {
    if (!Number.isInteger(value) || value < 1 || value > 30000) throw new Error('owned_child_cleanup_budget_invalid');
  }
  if (childHasExited(child)) return { closed: true, escalated: false };
  if (await signalAndWait(child, 'SIGTERM', termMs)) return { closed: true, escalated: false };
  return { closed: await signalAndWait(child, 'SIGKILL', killMs), escalated: true };
}
