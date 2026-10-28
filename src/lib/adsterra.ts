/**
 * Adsterra unit helpers — pure, build-time, unit-tested (tests/adsterra.test.ts).
 * Consumed by AdsterraSlot.astro.
 *
 * Why this exists: Adsterra's compliance notice says "placing an ad code inside
 * an iframe is not permitted" (more than one code per iframe/page, a wrapper
 * that shrinks/overlays the ad or delays loading, altered tracking …). The old
 * mount wrapped every unit in OUR OWN sandboxed `<iframe src="/ads/<name>.html">`
 * — exactly that pattern. Units are now inlined into the page verbatim, the
 * way the dashboard hands them out, and Adsterra's own script builds its own
 * ad frame (that frame is the ad, not a wrapper).
 *
 * The old reason for the wrapper — "units share `window.atOptions` and clobber
 * each other" — only bites when scripts run out of order. Each banner snippet
 * is `<script>atOptions = {…}</script><script src=…/invoke.js></script>`, and
 * invoke.js reads AND deletes `window.atOptions` the moment it executes.
 * Parser-inserted scripts execute strictly in document order, so every pair
 * consumes its own config before the next pair assigns a new one (checked in a
 * real Chromium: each unit's ad request carried its own `key=`).
 *
 * Hard rule that falls out of inlining: ONE unit key at most once per page.
 * (A second copy would also duplicate the native format's `container-<key>`
 * id.) `claimSlot` enforces it per page render.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** `sidebar-300x250` → `PUBLIC_ADSTERRA_SLOT_SIDEBAR_300X250`. */
export function slotEnvKey(name: string): string {
  return `PUBLIC_ADSTERRA_SLOT_${name.replace(/-/g, '_').toUpperCase()}`;
}

/**
 * The unit file's embeddable part: everything between <body> and </body>
 * (public/ads/<name>.html keeps the dashboard snippet inside a minimal page),
 * or the whole file when it is a bare snippet. HTML comments are dropped.
 * Returns '' when nothing is left.
 */
export function extractSnippet(html: string): string {
  const body = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(html);
  const raw = body ? body[1] : html;
  return raw.replace(/<!--[\s\S]*?-->/g, '').trim();
}

/**
 * Read `public/ads/<name>.html` and return its embeddable snippet, or null
 * when the file is missing/empty (the caller warns and renders nothing).
 * `name` is restricted to the slug alphabet — it comes from component props,
 * but the guard keeps a typo from ever resolving outside public/ads.
 */
export function loadSlotSnippet(name: string, root: string = process.cwd()): string | null {
  if (!/^[a-z0-9-]+$/.test(name)) return null;
  const file = join(root, 'public', 'ads', `${name}.html`);
  if (!existsSync(file)) return null;
  return extractSnippet(readFileSync(file, 'utf8')) || null;
}

/**
 * JSON string literal that is safe inside an inline <script>: `</script>`,
 * `<!--` and the two JS line terminators cannot terminate or confuse the host
 * script element.
 */
export function toScriptStringLiteral(value: string): string {
  return JSON.stringify(value)
    .replace(/<\//g, '<\\/')
    .replace(/<!--/g, '<\\!--')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/**
 * Mount the snippet only when the viewport is at least `minViewport` px wide.
 *
 * The snippet is written with document.write from an inline script, so it is
 * still parser-inserted and still runs in document order (no atOptions race,
 * and a unit that does not fit — e.g. a 728px banner on a phone — never even
 * requests an ad). CSS-hiding a mounted unit is NOT an option: the hidden unit
 * would still fire its ad request and book an impression nobody can see.
 *
 * Evaluated once at parse time; ES5 only (this runs untranspiled in old
 * webviews). No matchMedia support → the unit is skipped.
 */
export function gateByViewport(snippet: string, minViewport: number): string {
  const px = Math.max(1, Math.floor(minViewport));
  return (
    '<script>(function(){' +
    `if(window.matchMedia&&window.matchMedia("(min-width:${px}px)").matches){` +
    `document.write(${toScriptStringLiteral(snippet)});}` +
    '})();</script>'
  );
}

/**
 * Mid-article ad position = right before the SECOND H2, i.e. after the first
 * section. Returns that heading's slug, or null when the article has fewer than
 * two H2s (no mid-article ad then — a unit squeezed in after a lone section
 * would just be a second end-of-article ad).
 */
export function pickMidAdAnchor(headings: ReadonlyArray<{ depth: number; slug: string }>): string | null {
  const h2 = headings.filter((h) => h.depth === 2);
  return h2.length >= 2 ? h2[1].slug : null;
}

/**
 * Hand the anchor slug from ArticlePage to the MDX `h2` override
 * (ArticleH2.astro) without a render-order-dependent counter: both sides key
 * the same per-page object (Astro.request), so parallel page renders and the
 * override's own render order can never disagree.
 */
const midAnchors = new WeakMap<object, string>();
export function setMidAdAnchor(scope: object, slug: string | null): void {
  if (slug) midAnchors.set(scope, slug);
  else midAnchors.delete(scope);
}
export function isMidAdAnchor(scope: object, id: unknown): boolean {
  return typeof id === 'string' && midAnchors.get(scope) === id;
}

/**
 * One unit key, one mount per page. `scope` is any object that is stable for
 * the whole page render (Astro.request). Returns false for the second claim.
 */
const claimed = new WeakMap<object, Set<string>>();
export function claimSlot(scope: object, name: string): boolean {
  let set = claimed.get(scope);
  if (!set) {
    set = new Set();
    claimed.set(scope, set);
  }
  if (set.has(name)) return false;
  set.add(name);
  return true;
}
