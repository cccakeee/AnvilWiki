import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import { OpsError } from '../core/errors.js';
import { submitLockPath } from '../core/gitops.js';
import { loadSiteConfig } from '../core/site.js';

export type OffloadMessage =
  | { kind: 'audit'; cwd: string }
  | { kind: 'insights'; cwd: string; days: number }
  | { kind: 'submit'; cwd: string; title?: string; base?: string };

/** The CLI command equivalent to each offloaded tool run, for error guidance. */
const cliEquivalent: Record<OffloadMessage['kind'], string> = {
  audit: 'anvil-ops audit',
  insights: 'anvil-ops insights',
  submit: 'anvil-ops submit',
};

export type OffloadResult = { ok: true; text: string } | { ok: false; errorText: string };

const workerUrl = new URL('./worker.js', import.meta.url);

/**
 * True when the compiled worker exists (i.e. running from dist/). In source
 * form (vitest) there is no worker.js — callers fall back to in-process runs,
 * which also keeps injected test deps (opts.run) effective.
 */
export function canOffload(): boolean {
  return existsSync(fileURLToPath(workerUrl));
}

/**
 * Main-thread watchdog budget. Budget relationship with the inner core: each
 * spawned step gets 15 min (defaultRun timeout) and a submit runs several
 * steps, so the theoretical inner worst case is 15min x N. The outer watchdog
 * is deliberately TIGHTER (10 min): a healthy submit of the three-gate
 * validation chain finishes well inside it in practice, while a hung worker
 * must fail loudly instead of holding the MCP stdio loop's promise forever.
 */
export const OFFLOAD_TIMEOUT_MS = 10 * 60_000;

/** Thrown by withWatchdog when the budget expires (callers distinguish it from task errors via instanceof). */
export class WatchdogTimeout extends Error {
  constructor(ms: number) {
    super(`offloaded work did not finish within ${Math.round(ms / 1000)}s`);
    this.name = 'WatchdogTimeout';
  }
}

/**
 * Race `task` against a watchdog timer. Extracted as pure promise plumbing so
 * it is unit-testable — real worker integration is NOT (canOffload() is false
 * under vitest, a known constraint). The losing side is never cancelled: the
 * task keeps running to completion; onTimeout just lets the caller clean up
 * while the caller stops waiting.
 */
export async function withWatchdog<T>(task: Promise<T>, timeoutMs: number, onTimeout: () => void = () => {}): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const guard = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      onTimeout();
      reject(new WatchdogTimeout(timeoutMs));
    }, timeoutMs);
  });
  try {
    return await Promise.race([task, guard]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Path of the submit lock a timed-out submit may have left behind, phrased
 * for the self-rescue instruction in watchdogTimeoutFix below. Resolves the
 * site root the same way the worker's submit did (loadSiteConfig walks up
 * from cwd), so the surfaced path is the exact file acquireSubmitLock
 * created — a stale hint would send the user to delete a file that is not
 * the lock.
 */
function leftoverSubmitLockPath(cwd: string): string {
  try {
    return submitLockPath(loadSiteConfig(cwd).root);
  } catch {
    return submitLockPath(cwd);
  }
}

/**
 * The fix text for a watchdog timeout, extracted as a pure function so the
 * self-rescue guidance stays unit-testable (offload() itself cannot run
 * under vitest — canOffload() is false in source form).
 *
 * Why the lock mention exists at all: worker.terminate() hard-kills the
 * worker mid-submit, so submit's `finally` lock release never runs. Worker
 * threads share the server process's pid, which is exactly what the lock's
 * stale-owner probe checks — pidAlive stays true forever, so the "dead
 * owner" reclaim never fires either, and for 30 minutes every retry reports
 * "Another submit is already running" with the MCP server's own pid.
 */
export function watchdogTimeoutFix(kind: OffloadMessage['kind'], cwd: string): string {
  const base =
    'The underlying work may still have partially run in the repo — check for a leftover ops/submit-* branch before re-running.';
  if (kind !== 'submit') return base;
  return (
    `${base} If a retry then reports "Another submit is already running" with this server's own pid, ` +
    `the timeout left the submit lock behind (worker threads share the server's pid, so the stale-owner ` +
    `probe cannot see it) — delete ${leftoverSubmitLockPath(cwd)} or restart this MCP server.`
  );
}

/**
 * Run the spawn-heavy tools (audit / insights / submit_pr) in a worker thread.
 *
 * Why: the core runs `pnpm build` etc. through spawnSync, which blocks the
 * Node event loop for the whole run — on the MCP stdio server that freezes
 * EVERY request (including keepalive pings) for minutes, and clients with
 * ~60s timeouts cancel the call even though the work is progressing. A
 * worker thread keeps the loop responsive with zero changes to the (sync,
 * well-tested) core. The watchdog above bounds the wait: a worker that never
 * posts back is terminated and surfaces as a loud OpsError instead of a
 * forever-pending promise.
 */
export async function offload(msg: OffloadMessage): Promise<OffloadResult> {
  const worker = new Worker(workerUrl, { workerData: msg });
  try {
    return await withWatchdog(
      new Promise<OffloadResult>((resolve, reject) => {
        let settled = false;
        worker.once('message', (result: OffloadResult) => {
          settled = true;
          void worker.terminate();
          resolve(result);
        });
        worker.once('error', (err) => {
          settled = true;
          reject(err);
        });
        // A worker that dies via a hard non-zero process.exit emits neither
        // 'message' nor 'error' — without this hook the promise would pend
        // until the watchdog fires and report a misleading timeout instead
        // of the real crash.
        worker.once('exit', (code) => {
          if (!settled) {
            settled = true;
            reject(
              new OpsError(
                `The ${msg.kind} worker exited unexpectedly (exit code ${code}) without returning a result.`,
                `Re-run the tool. If it reproduces, run the equivalent CLI command (\`${cliEquivalent[msg.kind]}\`) to see the raw error.`,
              ),
            );
          }
        });
      }),
      OFFLOAD_TIMEOUT_MS,
      () => {
        void worker.terminate();
      },
    );
  } catch (e) {
    void worker.terminate();
    if (e instanceof WatchdogTimeout) {
      throw new OpsError(
        `The ${msg.kind} worker did not return within ${Math.round(OFFLOAD_TIMEOUT_MS / 60_000)} minutes and was terminated.`,
        `${watchdogTimeoutFix(msg.kind, msg.cwd)} If this recurs, run the equivalent CLI command (\`${cliEquivalent[msg.kind]}\`) to see where it stalls.`,
      );
    }
    throw e;
  }
}
