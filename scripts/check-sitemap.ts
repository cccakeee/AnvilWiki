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

/** Rewrite an absolute sitemap URL to the server currently under test. */
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

async function fetchSitemapUrls(baseUrl: string): Promise<string[]> {
  const sitemapUrl = `${baseUrl}/sitemap.xml`;
  try {
    const res = await fetch(sitemapUrl);
    if (!res.ok) {
      throw new Error(`received HTTP ${res.status}`);
    }
    const xml = await res.text();
    return Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g)).map((m) => m[1].trim());
  } catch (error) {
    const detail = error instanceof Error ? ` (${error.message})` : '';
    throw new Error(`Could not fetch sitemap.xml from ${baseUrl}${detail}. Is the site running?`);
  }
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

  const urls = await fetchSitemapUrls(BASE_URL);

  if (urls.length === 0) {
    console.error('❌ Sitemap contained no URLs.');
    process.exit(1);
  }

  console.log(`Found ${urls.length} URLs. Checking...\n`);

  const results: Result[] = [];
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
