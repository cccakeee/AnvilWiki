/**
 * slugify.ts — the Unicode-aware slug helper behind bulk-new-posts. Extracted
 * verbatim from scripts/bulk-new-posts.ts so other scripts can reuse it.
 * (lib/apply-rewrites.ts has an ASCII-only slugify with different semantics —
 * the two are intentionally separate.)
 */

/** Unicode-aware slug: keeps letters/numbers of ANY script (CJK included) so
 * `新手攻略` stays a usable slug — Astro percent-encodes it in URLs. */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
