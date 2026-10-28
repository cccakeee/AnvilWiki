/**
 * Adsterra direct-mount contract (src/lib/adsterra.ts + AdsterraSlot.astro).
 *
 * Background: Adsterra warned that "placing an ad code inside an iframe is not
 * permitted". The old mount wrapped every unit in our own sandboxed iframe;
 * units are now inlined verbatim. These tests pin the properties that make that
 * safe and keep the wrapper from creeping back.
 */
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import {
  claimSlot,
  extractSnippet,
  gateByViewport,
  isMidAdAnchor,
  loadSlotSnippet,
  pickMidAdAnchor,
  setMidAdAnchor,
  slotEnvKey,
  toScriptStringLiteral,
} from '../src/lib/adsterra';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');
/** Source with comments removed — contract scans must ignore explanatory prose. */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/<!--[\s\S]*?-->/g, '');

const BANNER = `<script>
  atOptions = { 'key' : 'abc', 'format' : 'iframe', 'height' : 90, 'width' : 728, 'params' : {} };
</script>
<script src="https://example.test/abc/invoke.js"></script>`;

describe('slotEnvKey', () => {
  test('hyphens → underscores, upper-cased', () => {
    expect(slotEnvKey('sidebar-300x250')).toBe('PUBLIC_ADSTERRA_SLOT_SIDEBAR_300X250');
    expect(slotEnvKey('native-banner')).toBe('PUBLIC_ADSTERRA_SLOT_NATIVE_BANNER');
    expect(slotEnvKey('incontent-468x60')).toBe('PUBLIC_ADSTERRA_SLOT_INCONTENT_468X60');
  });
});

describe('extractSnippet', () => {
  test('takes only the <body> content of a unit page', () => {
    const page = `<!doctype html><html><head><style>body{margin:0}</style></head><body>\n${BANNER}\n</body></html>`;
    expect(extractSnippet(page)).toBe(BANNER);
  });
  test('accepts a bare snippet (no <body>) and drops HTML comments', () => {
    expect(extractSnippet(`<!-- paste from dashboard -->\n${BANNER}\n`)).toBe(BANNER);
  });
  test('empty page → empty string', () => {
    expect(extractSnippet('<html><body>  </body></html>')).toBe('');
  });
});

describe('loadSlotSnippet', () => {
  const dir = mkdtempSync(join(tmpdir(), 'aw-ads-'));
  mkdirSync(join(dir, 'public', 'ads'), { recursive: true });
  writeFileSync(join(dir, 'public', 'ads', 'unit-1.html'), `<html><body>${BANNER}</body></html>`);
  writeFileSync(join(dir, 'public', 'ads', 'blank.html'), '<html><body></body></html>');

  test('reads public/ads/<name>.html', () => {
    expect(loadSlotSnippet('unit-1', dir)).toBe(BANNER);
  });
  test('missing or empty file → null (caller warns, renders nothing)', () => {
    expect(loadSlotSnippet('nope', dir)).toBeNull();
    expect(loadSlotSnippet('blank', dir)).toBeNull();
  });
  test('names outside the slug alphabet never resolve (no path traversal)', () => {
    expect(loadSlotSnippet('../unit-1', dir)).toBeNull();
    expect(loadSlotSnippet('a/b', dir)).toBeNull();
    expect(loadSlotSnippet('UNIT', dir)).toBeNull();
  });
});

describe('gateByViewport', () => {
  test('literal is safe inside an inline <script>', () => {
    const lit = toScriptStringLiteral('<script>x</script><!-- y -->\u2028');
    expect(lit).not.toContain('</');
    expect(lit).not.toContain('<!--');
    expect(lit).not.toContain('\u2028');
  });

  const out = gateByViewport(BANNER, 768);
  const body = /^<script>([\s\S]*)<\/script>$/.exec(out)?.[1] ?? '';
  const run = (matches: boolean, hasMatchMedia = true) => {
    const written: string[] = [];
    const win = hasMatchMedia ? { matchMedia: (q: string) => ({ matches, q }) } : {};
    new Function('window', 'document', body)(win, { write: (s: string) => written.push(s) });
    return written;
  };

  test('emits exactly one self-contained script element', () => {
    expect(body).not.toBe('');
    expect(body).not.toContain('</script>');
    expect(body).toContain('(min-width:768px)');
  });
  test('wide viewport: writes the snippet verbatim (parser-inserted → document order)', () => {
    expect(run(true)).toEqual([BANNER]);
  });
  test('narrow viewport or no matchMedia: writes NOTHING — no request, no phantom impression', () => {
    expect(run(false)).toEqual([]);
    expect(run(true, false)).toEqual([]);
  });
});

describe('claimSlot — one unit key per page', () => {
  test('second claim on the same page render is refused', () => {
    const page = {};
    expect(claimSlot(page, 'native-banner')).toBe(true);
    expect(claimSlot(page, 'native-banner')).toBe(false);
    expect(claimSlot(page, 'sidebar-160x600')).toBe(true);
  });
  test('pages are independent', () => {
    expect(claimSlot({}, 'native-banner')).toBe(true);
    expect(claimSlot({}, 'native-banner')).toBe(true);
  });
});

describe('mid-article anchor (before the SECOND H2)', () => {
  const h = (depth: number, slug: string) => ({ depth, slug });
  test('picks the 2nd depth-2 heading, ignoring other depths', () => {
    expect(pickMidAdAnchor([h(2, 'a'), h(3, 'a-1'), h(2, 'b'), h(2, 'c')])).toBe('b');
  });
  test('fewer than two H2s → no mid-article ad', () => {
    expect(pickMidAdAnchor([])).toBeNull();
    expect(pickMidAdAnchor([h(2, 'only'), h(3, 'sub')])).toBeNull();
  });
  test('anchor travels per page object; unrelated pages and ids never match', () => {
    const page = {};
    setMidAdAnchor(page, 'b');
    expect(isMidAdAnchor(page, 'b')).toBe(true);
    expect(isMidAdAnchor(page, 'a')).toBe(false);
    expect(isMidAdAnchor({}, 'b')).toBe(false);
    expect(isMidAdAnchor(page, undefined)).toBe(false);
    setMidAdAnchor(page, null);
    expect(isMidAdAnchor(page, 'b')).toBe(false);
  });
});

describe('no wrapper iframe (the compliance fix)', () => {
  test('AdsterraSlot.astro renders no <iframe> and no sandbox', () => {
    const code = stripComments(read('src/components/ads/AdsterraSlot.astro'));
    expect(code).not.toMatch(/<iframe/i);
    expect(code).not.toMatch(/sandbox/i);
    expect(code).not.toMatch(/loading=["']lazy["']/);
  });
  test('no ad component builds an iframe around Adsterra code', () => {
    for (const rel of ['TopStickyAd', 'MobileAnchorAd', 'AdsterraSlotPair']) {
      expect(stripComments(read(`src/components/ads/${rel}.astro`)), rel).not.toMatch(/<iframe/i);
    }
  });
  test('no ad CSS reaches into an iframe (it would resize/clip the ad)', () => {
    for (const rel of ['TopStickyAd', 'MobileAnchorAd']) {
      expect(stripComments(read(`src/components/ads/${rel}.astro`)), rel).not.toMatch(/iframe\s*\{/);
    }
  });
});

describe('floating cards never take flow space', () => {
  test('TopStickyAd is position:fixed, not sticky (sticky is in-flow and pushed <main> down)', () => {
    const code = stripComments(read('src/components/ads/TopStickyAd.astro'));
    expect(code).toMatch(/<aside[\s\S]*?class="[^"]*\bfixed\b/);
    expect(code).not.toMatch(/class="[^"]*\bsticky\b/);
  });
  test('TopStickyAd is mounted after <main> (parser-blocking script must not precede the article)', () => {
    const layout = read('src/components/layout/LocaleLayout.astro');
    expect(layout.indexOf('<TopStickyAd />')).toBeGreaterThan(layout.indexOf('</main>'));
  });
  test('both floating ads use an icon expand/collapse toggle, not a close/remove button', () => {
    for (const rel of ['TopStickyAd', 'MobileAnchorAd']) {
      const code = stripComments(read(`src/components/ads/${rel}.astro`));
      expect(code, rel).toContain('lucide:chevron-up');
      expect(code, rel).toContain('lucide:chevron-down');
      expect(code, rel).not.toContain('lucide:x');
      expect(code, rel).not.toMatch(/\.remove\(\)/); // nothing deletes the ad node
    }
  });
});

describe('public/ads unit files match what the inliner expects', () => {
  const files = readdirSync(join(root, 'public', 'ads')).filter((f) => f.endsWith('.html'));
  test('at least the demo units are present', () => {
    expect(files.length).toBeGreaterThan(0);
  });
  for (const f of files) {
    test(`${f}: has an embeddable snippet with exactly one invoke.js`, () => {
      const snippet = extractSnippet(read(`public/ads/${f}`));
      expect(snippet, f).not.toBe('');
      expect(snippet.match(/invoke\.js/g)?.length, f).toBe(1);
    });
    test(`${f}: a banner unit sets atOptions BEFORE its invoke.js (parser-order consumption)`, () => {
      const snippet = extractSnippet(read(`public/ads/${f}`));
      if (!snippet.includes('atOptions')) return; // native format: container-based, no atOptions
      expect(snippet.indexOf('atOptions')).toBeLessThan(snippet.indexOf('invoke.js'));
    });
  }
});
