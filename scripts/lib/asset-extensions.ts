/**
 * asset-extensions.ts — the single allowlist of static-asset extensions
 * shared by the content/link gates.
 *
 * Why: check-content.ts (rule 4/5 exemptions) and check-links.ts (skip list)
 * each kept their own extension list and had drifted — mp4 was exempt from
 * the content shape rules but still audited as a page by check-links, so a
 * direct /media/clip.mp4 link was reported broken. The union lives here,
 * each member adjudicated:
 *
 *   - images:        png jpg jpeg gif webp avif svg ico (in both old lists)
 *   - video:         mp4 (check-content only) + webm (adjudicated in: same
 *                    direct-link target, real games ship both)
 *   - docs/archives: pdf zip (adjudicated in: real direct-link targets a
 *                    wiki links to; requiring a trailing slash on them —
 *                    check-content's old behavior — was itself the bug)
 *   - data:          json xml txt webmanifest (webmanifest was check-links only)
 *   - code:          css js mjs (mjs was check-links only)
 *   - fonts:         woff woff2 (in both old lists)
 *
 * Adding an extension here means: content shape rules (trailing slash,
 * locale prefix) don't apply to it — assets are locale-less by design,
 * public/ is shared — and check-links won't audit it as a page. Never add
 * an extension that could be a rendered page.
 */

export const ASSET_EXTENSIONS = [
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'avif',
  'svg',
  'ico',
  'mp4',
  'webm',
  'pdf',
  'zip',
  'json',
  'xml',
  'txt',
  'webmanifest',
  'css',
  'js',
  'mjs',
  'woff',
  'woff2',
] as const;

const ASSET_RE = new RegExp(`\\.(${ASSET_EXTENSIONS.join('|')})$`, 'i');

/** True when `path` ends with a known static-asset extension (case-insensitive). */
export function isAssetPath(path: string): boolean {
  return ASSET_RE.test(path);
}
