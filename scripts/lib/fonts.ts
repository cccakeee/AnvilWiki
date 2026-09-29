/**
 * fonts.ts — shared Noto CJK download source for the asset generators
 * (gen-covers + gen-assets). The URL is pinned to a noto-cjk RELEASE TAG, not
 * the mutable `main` branch: a move/rename upstream would otherwise break
 * regeneration of an existing project months later. Both scripts also accept
 * pre-downloaded OTFs (--fonts-dir / scripts/fonts/), so the pin only affects
 * fresh downloads; files under a tag are immutable. Tag pinned & all four
 * OTF paths verified 2026-09-27 (Sans2.004: sc/jp × Regular/Bold → HTTP 200).
 */

/** notofonts/noto-cjk release tag the download URLs are pinned to. */
export const NOTO_CJK_TAG = 'Sans2.004';

/** Base URL of the merged per-region OTFs: `${NOTO_BASE}/<Region>/<file>`,
 * e.g. `${NOTO_BASE}/SimplifiedChinese/NotoSansCJKsc-Regular.otf`. */
export const NOTO_BASE = `https://raw.githubusercontent.com/notofonts/noto-cjk/${NOTO_CJK_TAG}/Sans/OTF`;
