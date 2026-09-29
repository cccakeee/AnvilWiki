/**
 * i18n smoke test — regression guard for the "hardcoded locale" bug class.
 *
 * In v1.1.0 five getStaticPaths implementations inlined `['ja']` while the
 * CLI accepted any locale list — forks adding a 3rd language got site-wide
 * 404s. This test greps the route/i18n sources for hardcoded locale arrays
 * so the bug class can't silently return.
 *
 * The route sweep WALKS src/pages/[locale]/ instead of whitelisting files:
 * a brand-new locale route file joins the assertions automatically — new
 * files were exactly the ones that used to skip locale derivation.
 */
import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOT = path.resolve(__dirname, '..');
const LOCALE_ROUTES_DIR = path.join(ROOT, 'src/pages/[locale]');

function localeRouteFiles(): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.astro')) files.push(full);
    }
  };
  walk(LOCALE_ROUTES_DIR);
  return files.sort();
}

// The route files above, plus the locale-derivation helper module itself.
const SWEEP_FILES = [...localeRouteFiles(), path.join(ROOT, 'src/i18n/content.ts')];

describe('i18n: no hardcoded locale arrays', () => {
  it('the route walk actually finds the locale route files (no silent empty scan)', () => {
    // index + faq + [...slug] + [legal] + recent + tags/index + tags/[tag].
    expect(localeRouteFiles().length).toBeGreaterThanOrEqual(7);
  });

  for (const file of SWEEP_FILES) {
    const rel = path.relative(ROOT, file);
    it(`${rel} derives locales from routing.ts (no inline ['xx'] arrays)`, () => {
      const src = fs.readFileSync(file, 'utf8');
      // Matches ['ja'], ['en'], ['ja','zh'] etc. — but NOT `locales` identifiers.
      const hardcoded = src.match(/\[\s*['"][a-z]{2}['"]\s*(,\s*['"][a-z]{2}['"]\s*)*\]/g);
      expect(hardcoded ?? [], `found hardcoded locale array in ${rel}: ${hardcoded?.join(', ')}`).toHaveLength(0);
    });
  }

  it('routing.ts locales array is parseable and non-empty', () => {
    const src = fs.readFileSync(path.resolve(ROOT, 'src/i18n/routing.ts'), 'utf8');
    const m = src.match(/export const locales = \[([^\]]+)\] as const;/);
    expect(m).toBeTruthy();
    const list = Array.from(m![1].matchAll(/['"]([^'"]+)['"]/g)).map((x) => x[1]);
    expect(list.length).toBeGreaterThan(0);
    expect(list).toContain('en');
  });
});
