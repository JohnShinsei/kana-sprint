const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const siteRoot = path.join(root, 'site');
const outputPath = path.join(root, 'docs/public-site-manifest.json');
const locales = ['zh-Hans', 'zh-Hant', 'en', 'fr', 'it', 'de', 'es-ES', 'ko', 'pl', 'pt-BR'];
const pageKinds = [
  { kind: 'landing', file: 'index.html', route: '/' },
  { kind: 'support', file: 'support/index.html', route: '/support/' },
  { kind: 'privacy', file: 'privacy/index.html', route: '/privacy/' },
  { kind: 'licenses', file: 'licenses/index.html', route: '/licenses/' },
];

const pages = [
  ...pageKinds.map((page) => makePage('en', `site/${page.file}`, page.route, page.kind, true)),
  ...locales.flatMap((locale) =>
    pageKinds.map((page) =>
      makePage(locale, `site/${locale}/${page.file}`, `/${locale}${page.route}`, page.kind, false),
    ),
  ),
];

const manifest = {
  schemaVersion: 1,
  source: 'scripts/generate-localized-site.js',
  root: 'site',
  pageCount: pages.length,
  locales,
  pages,
};

fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`generated ${path.relative(root, outputPath)} with ${pages.length} public pages`);

function makePage(locale, relativePath, route, kind, defaultPage) {
  const absolutePath = path.join(root, relativePath);
  const html = fs.readFileSync(absolutePath, 'utf8');
  const buffer = Buffer.from(html);

  return {
    path: relativePath,
    route,
    locale,
    kind,
    default: defaultPage,
    htmlLang: extractAttribute(html, 'html', 'lang'),
    title: extractTag(html, 'title'),
    description: extractMetaDescription(html),
    bytes: buffer.length,
    sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
  };
}

function extractTag(html, tagName) {
  const match = html.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i'));
  return decodeHtml(match?.[1]?.trim() ?? '');
}

function extractAttribute(html, tagName, attributeName) {
  const tag = html.match(new RegExp(`<${tagName}\\b[^>]*>`, 'i'))?.[0] ?? '';
  const attr = tag.match(new RegExp(`${attributeName}="([^"]*)"`, 'i'))?.[1] ?? '';
  return decodeHtml(attr);
}

function extractMetaDescription(html) {
  const meta = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i)?.[1] ?? '';
  return decodeHtml(meta);
}

function decodeHtml(value) {
  return String(value)
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');
}
