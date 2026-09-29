/**
 * atomic.ts — same-directory temp-file write + rename, shared by the CLIs
 * (single source; previously each script carried its own copy).
 *
 * A process killed mid-write (Ctrl-C, CI timeout) leaves a `.<name>.tmp`
 * breadcrumb, never a truncated site.ts / wrangler.toml / locale JSON — same
 * pattern sync-codes.ts uses for MDX pages. rename within one directory is
 * atomic on POSIX and Windows.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Write `content` to `target` (relative to `root`, absolute paths pass
 * through) atomically: same-directory temp file first, then rename.
 */
export function writeAtomic(target: string, content: string, root = process.cwd()): void {
  const abs = path.resolve(root, target);
  const tmp = path.join(path.dirname(abs), `.${path.basename(abs)}.tmp`);
  try {
    fs.writeFileSync(tmp, content, 'utf8');
    fs.renameSync(tmp, abs);
  } catch (err) {
    try {
      fs.rmSync(tmp, { force: true });
    } catch {
      // best-effort cleanup — the original error matters more
    }
    throw err;
  }
}
