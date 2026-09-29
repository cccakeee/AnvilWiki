/**
 * link-scan.ts — shared Markdown link extraction for the content gates.
 *
 * Why: check-content.ts matched links with `(?<!!)\[[^\]]*\]\([^)]+\)` to
 * skip image syntax — but an image WRAPPED in a link
 * ([![img](a.webp)](/bosses/x/)) anchored the match at the OUTER `[` (no `!`
 * before it), consumed `![img](` as "link text", and captured the IMAGE's
 * URL as the href. The real page link (/bosses/x/) was invisible to the
 * trailing-slash and locale-prefix rules, while the asset URL — starting
 * with `/` — counted toward the ≥3-internal-links rule. Stripping image
 * syntax BEFORE extracting links fixes both: what remains are exactly the
 * page links.
 *
 * Known limit (accepted, same as the old per-line regex): a MALFORMED
 * unclosed image `![alt](/a.webp` followed later by a real link can swallow
 * the link into one stripped span. Well-formed Markdown is never affected.
 */

/** `![alt](src)` — stripped before link extraction so image URLs never
 *  masquerade as link hrefs (plain or wrapped in a link). */
const IMAGE_RE = /!\[[^\]]*\]\([^)]*\)/g;

/** `[text](href)` — plain Markdown inline links (image syntax is gone by
 *  the time this runs). */
const LINK_RE = /\[[^\]]*\]\([^)]*\)/g;

/** The href inside a link match — up to the first whitespace, so titled
 *  forms (`[t](/a/ "Title")`) keep the URL only. */
const HREF_RE = /\]\(([^)\s]+)/;

/**
 * All inline link hrefs on a line, image syntax excluded. Returns raw
 * hrefs (anchors/queries/titles still attached where written) — callers
 * strip and classify. Order follows the line; duplicates are kept.
 */
export function extractPageLinks(line: string): string[] {
  const withoutImages = line.replace(IMAGE_RE, '');
  const hrefs: string[] = [];
  for (const m of withoutImages.matchAll(LINK_RE)) {
    hrefs.push(m[0].match(HREF_RE)?.[1] ?? '');
  }
  return hrefs;
}
