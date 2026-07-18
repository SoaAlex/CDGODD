// Writes dist/sitemap.xml after `expo export`, combining the static routes
// with one /item/<seg> URL per entry in the generated item manifest.
// public/sitemap.xml stays committed as a static-routes-only fallback (it is
// copied into dist/ first, then overwritten here). Fail-soft: a sitemap
// problem must never break a build.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SITE = 'https://cestdegaucheoudedroite.com';
const MANIFEST = fileURLToPath(
  new URL('../src/generated/item-manifest.json', import.meta.url),
);
const OUT = fileURLToPath(new URL('../dist/sitemap.xml', import.meta.url));

const STATIC_ROUTES = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/solo', changefreq: 'weekly', priority: '0.9' },
  { path: '/items', changefreq: 'weekly', priority: '0.8' },
  { path: '/multiplayer', changefreq: 'monthly', priority: '0.7' },
  { path: '/search', changefreq: 'monthly', priority: '0.6' },
  { path: '/privacy', changefreq: 'yearly', priority: '0.3' },
  { path: '/credits', changefreq: 'yearly', priority: '0.3' },
];

try {
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  const lastmod = manifest.generatedAt
    ? `\n    <lastmod>${manifest.generatedAt.slice(0, 10)}</lastmod>`
    : '';

  const urls = [
    ...STATIC_ROUTES.map(
      (r) => `  <url>
    <loc>${SITE}${r.path === '/' ? '' : r.path}</loc>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority}</priority>
  </url>`,
    ),
    ...manifest.items.map(
      (i) => `  <url>
    <loc>${SITE}/item/${i.seg}</loc>${lastmod}
    <changefreq>weekly</changefreq>
    <priority>0.5</priority>
  </url>`,
    ),
  ];

  writeFileSync(
    OUT,
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`,
  );
  console.log(
    `sitemap: ${STATIC_ROUTES.length} static + ${manifest.items.length} item URLs`,
  );
} catch (err) {
  console.warn(`sitemap: generation failed (${err?.message ?? err}); keeping the static fallback.`);
}
