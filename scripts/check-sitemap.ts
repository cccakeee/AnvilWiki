/**
 * check-sitemap.ts
 *
 * Fetches every URL in the site's sitemap and reports HTTP status codes.
 * Any non-200 response is printed with its status; the script exits with
 * code 1 if any URL failed, so it can gate CI or pre-deploy checks.
 *
 * Usage:
 *   pnpm check-sitemap                       # uses http://localhost:4321
 *   BASE_URL=https://example.com pnpm check-sitemap
 *   pnpm tsx scripts/check-sitemap.ts https://example.com
 */

const BASE_URL = (process.argv[2] || process.env.BASE_URL || 'http://localhost:4321').replace(
  /\/$/,
  '',
);

interface Result {
  url: string;
  status: number;
  ok: boolean;
}

interface SitemapFetch {
  urls: string[];
  /** Child sitemaps that could not be fetched — surfaced as failures by the
   *  caller so a partial outage cannot exit 0 while whole URL subtrees go
   *  unchecked (they used to be silently skipped). */
  failedChildren: string[];
}

/**
 * Rewrite the host of an absolute URL to match `baseUrl`, keeping the path.
 *
 * Why: @astrojs/sitemap emits child sitemap URLs as absolute URLs using the
 * configured `site` (e.g. https://anvilwiki.pages.dev/sitemap-0.xml). When
 * running this script against a local preview (http://localhost:4321), we
 * must fetch the local copy of the child sitemap, not the production one —
 * otherwise we'd be testing production URLs, and on offline/dev machines
 * the fetch fails entirely ("Sitemap contained no URLs").
 *
 * For relative URLs (already rooted at host), return as-is.
 */
function rewriteHost(url: string, baseUrl: string): string {
  try {
    const parsed = new URL(url);
    const base = new URL(baseUrl);
    parsed.protocol = base.protocol;
    parsed.host = base.host;
    return parsed.toString();
  } catch {
    // Not an absolute URL — return unchanged.
    return url;
  }
}

async function fetchSitemapUrls(baseUrl: string): Promise<SitemapFetch> {
  // Support both single sitemap.xml and sitemap-index.xml.
  const candidates = [`${baseUrl}/sitemap.xml`, `${baseUrl}/sitemap-index.xml`];

  for (const idx of candidates) {
    try {
      const res = await fetch(idx);
      if (!res.ok) continue;
      const xml = await res.text();

      // An index file references child sitemaps; a flat file references URLs.
      // Collect every <loc> value, then recursively expand child sitemaps.
      const locs = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g)).map((m) => m[1].trim());

      // If locs point to other .xml files, fetch those (rewriting host to baseUrl).
      const xmlLocs = locs.filter((u) => u.endsWith('.xml'));
      const urlLocs = locs.filter((u) => !u.endsWith('.xml'));

      if (xmlLocs.length === 0) {
        return { urls: locs, failedChildren: [] };
      }

      // Recursively gather from child sitemaps. A child that fails (HTTP
      // error or network error) is RECORDED, not skipped: its URLs never
      // enter the checked set, so silently dropping it would let a partial
      // outage pass with whole subtrees unchecked.
      const childUrls: string[] = [];
      const failedChildren: string[] = [];
      for (const child of xmlLocs) {
        try {
          const childRes = await fetch(rewriteHost(child, baseUrl));
          if (!childRes.ok) {
            failedChildren.push(child);
            continue;
          }
          const childXml = await childRes.text();
          const childLocs = Array.from(childXml.matchAll(/<loc>([^<]+)<\/loc>/g)).map((m) =>
            m[1].trim(),
          );
          childUrls.push(...childLocs);
        } catch {
          failedChildren.push(child);
        }
      }
      return { urls: [...urlLocs, ...childUrls], failedChildren };
    } catch {
      // Try the next candidate.
    }
  }

  throw new Error(
    `Could not fetch sitemap from ${baseUrl}. Tried sitemap.xml and sitemap-index.xml. Is the site running?`,
  );
}

async function checkUrl(url: string, baseUrl: string): Promise<Result> {
  // The build uses SITE_URL for entries, but local checks target baseUrl.
  const localUrl = rewriteHost(url, baseUrl);
  try {
    const res = await fetch(localUrl, { method: 'GET', redirect: 'follow' });
    return { url, status: res.status, ok: res.ok };
  } catch {
    return {
      url,
      status: 0,
      ok: false,
    };
  }
}

async function main() {
  console.log(`\n📋 Checking sitemap URLs against: ${BASE_URL}\n`);

  const { urls, failedChildren } = await fetchSitemapUrls(BASE_URL);

  if (urls.length === 0 && failedChildren.length === 0) {
    console.error('❌ Sitemap contained no URLs.');
    process.exit(1);
  }

  console.log(`Found ${urls.length} URLs. Checking...\n`);

  const results: Result[] = [];
  // Unfetched child sitemaps enter the result set as failures (status 0 =
  // network-level failure, same convention as checkUrl) so the run exits 1.
  for (const child of failedChildren) {
    results.push({ url: child, status: 0, ok: false });
    console.log(`  ❌  0  ${child} (child sitemap could not be fetched)`);
  }
  // Sequential to avoid hammering the server (and to keep logs readable).
  for (const url of urls) {
    const r = await checkUrl(url, BASE_URL);
    results.push(r);
    const mark = r.ok ? '✅' : '❌';
    console.log(`  ${mark}  ${r.status}  ${url}`);
  }

  const failed = results.filter((r) => !r.ok);
  const passed = results.filter((r) => r.ok);

  console.log(`\n── Result ──`);
  console.log(`  ✅ Passed: ${passed.length}`);
  console.log(`  ❌ Failed: ${failed.length}`);

  if (failed.length > 0) {
    console.log(`\nFailed URLs:`);
    for (const f of failed) {
      console.log(`  ${f.status}  ${f.url}`);
    }
    process.exit(1);
  }

  console.log('\n🎉 All sitemap URLs returned 200.');
}

main().catch((err) => {
  console.error('\n❌', err.message);
  process.exit(1);
});
