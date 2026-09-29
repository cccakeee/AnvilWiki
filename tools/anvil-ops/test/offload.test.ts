import { describe, expect, it, vi } from 'vitest';
import { canOffload, OFFLOAD_TIMEOUT_MS, WatchdogTimeout, watchdogTimeoutFix, withWatchdog } from '../src/mcp/offload.js';
import { submitLockPath } from '../src/core/gitops.js';
import { loadSiteConfig } from '../src/core/site.js';

describe('offload watchdog', () => {
  it('passes the task result through when it wins the race', async () => {
    const onTimeout = vi.fn();
    await expect(withWatchdog(Promise.resolve('done'), 5_000, onTimeout)).resolves.toBe('done');
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('propagates task rejection untouched (not a WatchdogTimeout)', async () => {
    await expect(withWatchdog(Promise.reject(new Error('boom')), 5_000, () => {})).rejects.toThrow('boom');
  });

  it('fires onTimeout and rejects with WatchdogTimeout when the task never settles', async () => {
    const onTimeout = vi.fn();
    await expect(withWatchdog(new Promise(() => {}), 5, onTimeout)).rejects.toBeInstanceOf(WatchdogTimeout);
    expect(onTimeout).toHaveBeenCalledOnce();
  });

  it('watchdog budget is the documented 10-minute constant', () => {
    // Deliberately tighter than the inner 15min-per-step spawn budget: a hung
    // worker must fail loudly instead of holding the stdio loop's promise.
    expect(OFFLOAD_TIMEOUT_MS).toBe(10 * 60_000);
  });

  it('canOffload is false under vitest (source form, no dist worker) — the known constraint keeping offload itself integration-untested', () => {
    expect(canOffload()).toBe(false);
  });
});

describe('watchdog timeout self-rescue guidance', () => {
  // worker.terminate() hard-kills the worker mid-submit, so submit's finally
  // lock release never runs — and worker threads share the server pid, which
  // is exactly what the lock's stale-owner probe checks, so the leftover lock
  // is stuck for the full 30-minute stale window and every retry reports
  // "Another submit is already running" with the server's own pid. The
  // timeout error must hand the user the exact lock file path.
  it('submit guidance names the exact leftover lock path for the site', () => {
    const cwd = process.cwd();
    const fix = watchdogTimeoutFix('submit', cwd);
    expect(fix).toMatch(/lock/i);
    // The path in the message must be THE lock path acquireSubmitLock
    // created for this site — a stale hint would point at a non-lock file.
    expect(fix).toContain(submitLockPath(loadSiteConfig(cwd).root));
  });

  it('audit guidance stays lock-free (audit never takes the submit lock)', () => {
    expect(watchdogTimeoutFix('audit', process.cwd())).not.toMatch(/lock/i);
  });

  it('insights guidance stays lock-free and names its own CLI equivalent', () => {
    // insights is offloaded like audit but never takes the submit lock; the
    // watchdog / exit guidance must point at `anvil-ops insights`, not the
    // audit/submit pair.
    expect(watchdogTimeoutFix('insights', process.cwd())).not.toMatch(/lock/i);
  });
});
