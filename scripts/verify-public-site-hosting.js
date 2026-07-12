const fs = require('fs');
const path = require('path');
const { loadLocalEnv } = require('./load-env');

const root = path.resolve(__dirname, '..');
const jsonPath = path.join(root, 'docs/public-site-hosting-verification.json');
const markdownPath = path.join(root, 'docs/public-site-hosting-verification.md');
const timeoutMs = Number(process.env.PUBLIC_SITE_VERIFY_TIMEOUT_MS ?? 8000);
const strictMode = process.argv.includes('--strict');
const expectedLocales = ['zh-Hans', 'zh-Hant', 'en', 'fr', 'it', 'de', 'es-ES', 'ko', 'pl', 'pt-BR'];

loadLocalEnv();

main().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exit(1);
});

async function main() {
  const manifest = readJson('docs/public-site-manifest.json');
  const appJson = require('../app.json').expo;
  const baseUrl = trimTrailingSlash(cleanEnv('APP_STORE_BASE_URL'));
  const explicitSupportUrl = cleanEnv('APP_STORE_SUPPORT_URL');
  const explicitPrivacyUrl = cleanEnv('APP_STORE_PRIVACY_URL');
  const explicitMarketingUrl = cleanEnv('APP_STORE_MARKETING_URL');
  const supportUrl = explicitSupportUrl ?? joinUrl(baseUrl, 'support');
  const privacyUrl = explicitPrivacyUrl ?? joinUrl(baseUrl, 'privacy');
  const marketingUrl = explicitMarketingUrl ?? baseUrl;
  const hasProductionBaseUrl = isProductionHttpsUrl(baseUrl);
  const endpoints = hasProductionBaseUrl
    ? endpointsFromBaseUrl(manifest, baseUrl)
    : endpointsFromExplicitUrls({ supportUrl, privacyUrl, marketingUrl });
  const results = [];

  for (const endpoint of endpoints) {
    results.push(await verifyEndpoint(endpoint));
  }

  const failedResults = results.filter((result) => !result.passed);
  const urlConfigurationReady =
    hasProductionBaseUrl ||
    (isProductionHttpsUrl(supportUrl) && isProductionHttpsUrl(privacyUrl));
  const ready = urlConfigurationReady && endpoints.length > 0 && failedResults.length === 0;
  const verification = {
    schemaVersion: 1,
    source: 'scripts/verify-public-site-hosting.js',
    generatedFrom: {
      publicSiteManifest: 'docs/public-site-manifest.json',
      envTemplate: '.env.example',
      appConfig: 'app.json + app.config.js',
      localSiteGenerator: 'scripts/generate-localized-site.js',
    },
    app: {
      name: appJson.name,
      version: appJson.version,
      bundleIdentifier: appJson.ios?.bundleIdentifier,
      packageName: appJson.android?.package,
    },
    summary: {
      status: ready ? 'PASS' : urlConfigurationReady ? 'FAIL' : 'PENDING',
      ready,
      strictMode,
      urlConfigurationReady,
      hasProductionBaseUrl,
      checkedUrls: results.length,
      passedUrls: results.filter((result) => result.passed).length,
      failedUrls: failedResults.length,
      expectedPageRoutes: manifest.pages?.length ?? 0,
      expectedLocales: expectedLocales.length,
      timeoutMs,
    },
    urls: {
      baseUrl: baseUrl ?? null,
      supportUrl: supportUrl ?? null,
      privacyUrl: privacyUrl ?? null,
      marketingUrl: marketingUrl ?? null,
    },
    endpoints,
    results,
    commands: [
      'npm run site:localized',
      'npm run site:manifest',
      'npm run site:deploy-audit',
      'npm run site:verify-hosting',
      'npm run release:store-ready',
    ],
  };

  fs.writeFileSync(jsonPath, `${JSON.stringify(verification, null, 2)}\n`);
  fs.writeFileSync(markdownPath, renderMarkdown(verification));
  console.log(`generated ${path.relative(root, markdownPath)} and ${path.relative(root, jsonPath)}`);

  if (failedResults.length > 0 || (strictMode && !ready)) {
    process.exit(1);
  }
}

function endpointsFromBaseUrl(manifest, baseUrl) {
  const pageEndpoints = (manifest.pages ?? []).map((page) => ({
    id: `page-${slug(page.route)}`,
    kind: page.kind,
    locale: page.locale,
    route: page.route,
    url: joinRoute(baseUrl, page.route),
    requiredSnippets: snippetsForPage(page),
  }));

  return [
    ...pageEndpoints,
    {
      id: 'sitemap',
      kind: 'sitemap',
      locale: 'all',
      route: '/sitemap.xml',
      url: joinRoute(baseUrl, '/sitemap.xml'),
      requiredSnippets: ['<urlset', '<loc>', 'support', 'privacy'],
    },
  ];
}

function endpointsFromExplicitUrls({ supportUrl, privacyUrl, marketingUrl }) {
  const endpoints = [];

  if (isProductionHttpsUrl(marketingUrl)) {
    endpoints.push({
      id: 'marketing-url',
      kind: 'landing',
      locale: 'custom',
      route: null,
      url: marketingUrl,
      requiredSnippets: ['Kana Sprint'],
    });
  }

  if (isProductionHttpsUrl(supportUrl)) {
    endpoints.push({
      id: 'support-url',
      kind: 'support',
      locale: 'custom',
      route: null,
      url: supportUrl,
      requiredSnippets: ['Kana Sprint'],
    });
  }

  if (isProductionHttpsUrl(privacyUrl)) {
    endpoints.push({
      id: 'privacy-url',
      kind: 'privacy',
      locale: 'custom',
      route: null,
      url: privacyUrl,
      requiredSnippets: ['Kana Sprint'],
    });
  }

  return endpoints;
}

async function verifyEndpoint(endpoint) {
  const startedAt = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(endpoint.url, {
      headers: { 'User-Agent': 'KanaSprintReleaseVerifier/1.0' },
      redirect: 'follow',
      signal: controller.signal,
    });
    const body = await response.text();
    clearTimeout(timeout);

    const missingSnippets = endpoint.requiredSnippets.filter((snippet) => !body.includes(snippet));
    const passed = response.ok && missingSnippets.length === 0;

    return {
      id: endpoint.id,
      url: endpoint.url,
      finalUrl: response.url,
      status: response.status,
      contentType: response.headers.get('content-type') ?? null,
      bytes: Buffer.byteLength(body),
      durationMs: Date.now() - startedAt,
      passed,
      missingSnippets,
      error: null,
    };
  } catch (error) {
    return {
      id: endpoint.id,
      url: endpoint.url,
      finalUrl: null,
      status: null,
      contentType: null,
      bytes: 0,
      durationMs: Date.now() - startedAt,
      passed: false,
      missingSnippets: [],
      error: error.name === 'AbortError' ? `Timed out after ${timeoutMs}ms` : error.message,
    };
  }
}

function snippetsForPage(page) {
  const snippets = ['Kana Sprint'];

  if (page.kind === 'landing' || page.kind === 'support') snippets.push('JLPT N5-N1');
  if (page.kind === 'privacy') snippets.push('Google Mobile Ads');
  if (page.kind === 'licenses') snippets.push('Runtime packages');

  return snippets;
}

function renderMarkdown(values) {
  const urlRows = [
    ['Base URL', values.urls.baseUrl],
    ['Support URL', values.urls.supportUrl],
    ['Privacy URL', values.urls.privacyUrl],
    ['Marketing URL', values.urls.marketingUrl],
  ].map(([label, url]) => `| ${label} | ${url ?? 'pending'} | ${isProductionHttpsUrl(url) ? 'Ready' : 'Pending'} |`).join('\n');
  const resultRows = values.results.length > 0
    ? values.results
      .map((result) => {
        const detail = result.error ?? (result.missingSnippets.join(', ') || 'ok');
        return `| ${result.id} | ${result.passed ? 'PASS' : 'FAIL'} | ${result.status ?? 'n/a'} | ${result.bytes} | ${result.durationMs} | ${detail} |`;
      })
      .join('\n')
    : '| n/a | PENDING | n/a | 0 | 0 | Set APP_STORE_BASE_URL or explicit support/privacy URLs. |';
  const commands = values.commands.map((command) => `- \`${command}\``).join('\n');

  return `# Public Site Hosting Verification

This verification performs live HTTPS requests after the public support/privacy site has been hosted. Without production URLs it records a pending state and stays non-blocking for local release verification.

## Summary

- Status: ${values.summary.status}
- Ready: ${values.summary.ready ? 'Yes' : 'No'}
- URL configuration ready: ${values.summary.urlConfigurationReady ? 'Yes' : 'No'}
- Production base URL: ${values.summary.hasProductionBaseUrl ? 'Yes' : 'No'}
- Checked URLs: ${values.summary.checkedUrls}
- Passed URLs: ${values.summary.passedUrls}
- Failed URLs: ${values.summary.failedUrls}
- Expected page routes: ${values.summary.expectedPageRoutes}
- Expected locales: ${values.summary.expectedLocales}
- Timeout: ${values.summary.timeoutMs}ms

## URL State

| URL | Value | Status |
| --- | --- | --- |
${urlRows}

## Results

| Endpoint | Result | HTTP | Bytes | Duration ms | Detail |
| --- | --- | ---: | ---: | ---: | --- |
${resultRows}

## Commands

${commands}
`;
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function cleanEnv(key) {
  const value = process.env[key]?.trim();
  return value ? value : undefined;
}

function trimTrailingSlash(value) {
  return value?.replace(/\/+$/, '');
}

function joinUrl(rootUrl, route) {
  if (!rootUrl) return undefined;
  const cleanedRoute = String(route ?? '').replace(/^\/+/, '').replace(/\/+$/, '');
  return cleanedRoute ? `${rootUrl}/${cleanedRoute}` : rootUrl;
}

function joinRoute(rootUrl, route) {
  if (!rootUrl) return undefined;
  if (route === '/') return `${rootUrl}/`;
  return `${rootUrl}/${String(route ?? '').replace(/^\/+/, '')}`;
}

function slug(value) {
  const normalized = String(value ?? 'root')
    .replace(/^\/+|\/+$/g, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'root';
}

function isProductionHttpsUrl(value) {
  try {
    const parsed = new URL(value);
    const hostname = parsed.hostname.toLowerCase();

    return (
      parsed.protocol === 'https:' &&
      Boolean(hostname) &&
      hostname !== 'localhost' &&
      hostname !== '127.0.0.1' &&
      hostname !== '0.0.0.0' &&
      !hostname.endsWith('.local') &&
      !hostname.endsWith('.test') &&
      !hostname.endsWith('.example') &&
      !hostname.includes('example.com')
    );
  } catch {
    return false;
  }
}
