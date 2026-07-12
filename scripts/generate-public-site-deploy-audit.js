const fs = require('fs');
const path = require('path');
const { loadLocalEnv } = require('./load-env');

const root = path.resolve(__dirname, '..');
const jsonPath = path.join(root, 'docs/public-site-deploy-audit.json');
const markdownPath = path.join(root, 'docs/public-site-deploy-audit.md');

loadLocalEnv();

const manifest = readJson('docs/public-site-manifest.json');
const appJson = require('../app.json').expo;
const expectedLocales = ['zh-Hans', 'zh-Hant', 'en', 'fr', 'it', 'de', 'es-ES', 'ko', 'pl', 'pt-BR'];
const expectedKinds = ['landing', 'support', 'privacy', 'licenses'];
const expectedControlFiles = ['site/robots.txt', 'site/_headers', 'site/_redirects'];
const githubPagesWorkflowPath = '.github/workflows/deploy-site.yml';
const expectedWorkflowSnippets = [
  'workflow_dispatch:',
  'pages: write',
  'id-token: write',
  'actions/configure-pages@v6',
  'actions/upload-pages-artifact@v5',
  'path: site',
  'actions/deploy-pages@v5',
];
const baseUrl = trimTrailingSlash(cleanEnv('APP_STORE_BASE_URL'));
const supportUrl = cleanEnv('APP_STORE_SUPPORT_URL') ?? joinUrl(baseUrl, 'support');
const privacyUrl = cleanEnv('APP_STORE_PRIVACY_URL') ?? joinUrl(baseUrl, 'privacy');
const openSourceNoticesUrl = joinUrl(baseUrl, 'licenses');
const marketingUrl = cleanEnv('APP_STORE_MARKETING_URL') ?? baseUrl;
const localizedUrls = Object.fromEntries(
  expectedLocales.map((locale) => [
    locale,
    {
      marketingUrl: joinUrl(baseUrl, locale),
      supportUrl: joinUrl(baseUrl, `${locale}/support`),
      privacyUrl: joinUrl(baseUrl, `${locale}/privacy`),
      openSourceNoticesUrl: joinUrl(baseUrl, `${locale}/licenses`),
    },
  ]),
);

const pages = manifest.pages ?? [];
const missingFiles = pages.filter((page) => !fs.existsSync(path.join(root, page.path))).map((page) => page.path);
const controlFiles = expectedControlFiles.map(fileInfo);
const missingControlFiles = controlFiles.filter((file) => !file.exists).map((file) => file.path);
const githubPagesWorkflow = fileInfo(githubPagesWorkflowPath);
const githubPagesWorkflowContents = githubPagesWorkflow.exists
  ? fs.readFileSync(path.join(root, githubPagesWorkflow.path), 'utf8')
  : '';
const githubPagesWorkflowReady =
  githubPagesWorkflow.exists &&
  expectedWorkflowSnippets.every((snippet) => githubPagesWorkflowContents.includes(snippet));
const hasProductionBaseUrl = isProductionHttpsUrl(baseUrl);
const sitemap = fileInfo('site/sitemap.xml');
const sitemapExpectedUrls = hasProductionBaseUrl
  ? pages.map((page) => joinUrl(baseUrl, page.route.replace(/^\/+/, '')) ?? baseUrl)
  : [];
const sitemapContents = sitemap.exists ? fs.readFileSync(path.join(root, sitemap.path), 'utf8') : '';
const sitemapReady =
  hasProductionBaseUrl &&
  sitemap.exists &&
  sitemapExpectedUrls.every((url) => sitemapContents.includes(`<loc>${escapeXml(url)}</loc>`));
const hostingControlFilesReady = missingControlFiles.length === 0;
const localReady =
  manifest.schemaVersion === 1 &&
  manifest.root === 'site' &&
  manifest.pageCount === pages.length &&
  sameSet(manifest.locales ?? [], expectedLocales) &&
  sameSet([...new Set(pages.map((page) => page.kind))], expectedKinds) &&
  missingFiles.length === 0 &&
  hostingControlFilesReady &&
  githubPagesWorkflowReady &&
  (!hasProductionBaseUrl || sitemapReady) &&
  everyLocaleHasAllPageKinds(pages);
const supportUrlReady = isProductionHttpsUrl(supportUrl);
const privacyUrlReady = isProductionHttpsUrl(privacyUrl);
const openSourceNoticesUrlReady = isProductionHttpsUrl(openSourceNoticesUrl);
const marketingUrlReady = !marketingUrl || isProductionHttpsUrl(marketingUrl);
const hostingReady = supportUrlReady && privacyUrlReady && marketingUrlReady;

const audit = {
  schemaVersion: 1,
  source: 'scripts/generate-public-site-deploy-audit.js',
  generatedFrom: {
    publicSiteManifest: 'docs/public-site-manifest.json',
    localizedSiteGenerator: 'scripts/generate-localized-site.js',
    siteManifestGenerator: 'scripts/generate-site-manifest.js',
    hostingControlFiles: 'scripts/generate-localized-site.js',
    hostingVerification: 'scripts/verify-public-site-hosting.js',
    envTemplate: '.env.example',
    appConfig: 'app.json + app.config.js',
    storeConfig: 'store.config.js',
    githubPagesWorkflow: githubPagesWorkflowPath,
  },
  app: {
    name: appJson.name,
    version: appJson.version,
    bundleIdentifier: appJson.ios?.bundleIdentifier,
    packageName: appJson.android?.package,
  },
  summary: {
    risk: localReady ? 'PASS' : 'REVIEW',
    localReady,
    hostingReady,
    externalHostingPending: !hostingReady,
    routeCount: pages.length,
    locales: manifest.locales?.length ?? 0,
    supportUrlReady,
    privacyUrlReady,
    openSourceNoticesUrlReady,
    marketingUrlReady,
    hostingControlFilesReady,
    githubPagesWorkflowReady,
    sitemapReady,
    sitemapRequired: hasProductionBaseUrl,
    missingFiles: missingFiles.length,
    missingControlFiles: missingControlFiles.length,
  },
  deployRoot: {
    path: 'site',
    requiredPages: pages.length,
    requiredLocales: expectedLocales,
    requiredPageKinds: expectedKinds,
    requiredControlFiles: expectedControlFiles,
    deploymentWorkflow: githubPagesWorkflowPath,
  },
  deploymentWorkflow: {
    ...githubPagesWorkflow,
    ready: githubPagesWorkflowReady,
    requiredSnippets: expectedWorkflowSnippets,
  },
  urls: {
    baseUrl: baseUrl ?? null,
    marketingUrl: marketingUrl ?? null,
    supportUrl: supportUrl ?? null,
    privacyUrl: privacyUrl ?? null,
    openSourceNoticesUrl: openSourceNoticesUrl ?? null,
    localized: localizedUrls,
  },
  routes: pages.map((page) => ({
    path: page.path,
    route: page.route,
    locale: page.locale,
    kind: page.kind,
    default: page.default,
    hostedUrl: baseUrl ? joinUrl(baseUrl, page.route.replace(/^\/+/, '')) ?? baseUrl : null,
    sha256: page.sha256,
    bytes: page.bytes,
  })),
  controlFiles,
  sitemap: {
    path: sitemap.path,
    exists: sitemap.exists,
    required: hasProductionBaseUrl,
    ready: sitemapReady,
    urlCount: sitemapReady ? sitemapExpectedUrls.length : 0,
    expectedUrlCount: sitemapExpectedUrls.length,
    sha256: sitemap.sha256,
    bytes: sitemap.bytes,
  },
  checks: [
    check('site-folder', 'Host the entire site/ folder as the web root.', localReady, 'The deploy root must preserve nested support/privacy/license routes.'),
    check('hosting-control-files', 'Upload robots.txt, _headers, and _redirects with the site root.', hostingControlFilesReady, 'These files are generated beside index.html.'),
    check('github-pages-workflow', 'Use the GitHub Pages workflow to publish site/ when this repo is hosted on GitHub.', githubPagesWorkflowReady, 'The workflow uploads site/ with the official Pages artifact and deploy actions.'),
    check('sitemap', 'Set APP_STORE_BASE_URL and rerun the site commands to generate sitemap.xml.', sitemapReady, 'The sitemap is generated only for a production HTTPS base URL.'),
    check('https', 'Use a production HTTPS origin, not localhost, .test, .local, .example, or example.com.', hostingReady, 'App Store support and privacy URLs must be public.'),
    check('support-url', 'Confirm the Support URL opens without auth.', supportUrlReady, 'Use APP_STORE_BASE_URL or APP_STORE_SUPPORT_URL.'),
    check('privacy-url', 'Confirm the Privacy Policy URL opens without auth.', privacyUrlReady, 'Use APP_STORE_BASE_URL or APP_STORE_PRIVACY_URL.'),
    check('localized-routes', 'Confirm localized /<locale>/support/, /<locale>/privacy/, and /<locale>/licenses/ routes are served.', localReady, 'Settings uses localized links when APP_STORE_BASE_URL is set.'),
    check('metadata-sync', 'Rerun metadata preview after setting production URLs.', hostingReady, 'store.config.js injects the same URL state into EAS Metadata.'),
  ],
  commands: [
    'npm run site:localized',
    'npm run site:manifest',
    'npm run site:deploy-audit',
    'npm run site:verify-hosting',
    'GitHub Actions: Deploy public site',
    'npm run metadata:preview',
    'npm run release:status',
    'npm run release:store-ready',
  ],
};

fs.writeFileSync(jsonPath, `${JSON.stringify(audit, null, 2)}\n`);
fs.writeFileSync(markdownPath, renderMarkdown(audit));
console.log(`generated ${path.relative(root, markdownPath)} and ${path.relative(root, jsonPath)}`);

function renderMarkdown(values) {
  const urlRows = [
    ['Base URL', values.urls.baseUrl, values.urls.baseUrl ? isProductionHttpsUrl(values.urls.baseUrl) : false],
    ['Marketing URL', values.urls.marketingUrl, !values.urls.marketingUrl || isProductionHttpsUrl(values.urls.marketingUrl)],
    ['Support URL', values.urls.supportUrl, values.summary.supportUrlReady],
    ['Privacy URL', values.urls.privacyUrl, values.summary.privacyUrlReady],
    ['Open source notices URL', values.urls.openSourceNoticesUrl, values.summary.openSourceNoticesUrlReady],
  ]
    .map(([label, url, ready]) => `| ${label} | ${url ?? 'pending'} | ${ready ? 'Ready' : 'Pending'} |`)
    .join('\n');
  const checkRows = values.checks
    .map((entry) => `| ${entry.id} | ${entry.status} | ${entry.action} | ${entry.evidence} |`)
    .join('\n');
  const controlRows = values.controlFiles
    .map((entry) => `| \`${entry.path}\` | ${entry.exists ? 'Ready' : 'Missing'} | ${entry.bytes ?? 0} | ${entry.sha256 ?? 'n/a'} |`)
    .join('\n');
  const routeRows = values.routes
    .slice(0, 20)
    .map((entry) => `| ${entry.locale} | ${entry.kind} | \`${entry.route}\` | \`${entry.path}\` | ${entry.hostedUrl ?? 'pending'} |`)
    .join('\n');
  const commands = values.commands.map((command) => `- \`${command}\``).join('\n');

  return `# Public Site Deploy Audit

This audit prepares the generated \`site/\` folder for public HTTPS hosting. It does not replace hosting; it verifies that the local deploy package is complete and lists the exact URL checks needed before App Store submission.

## Summary

- Risk: ${values.summary.risk}
- Local deploy package ready: ${values.summary.localReady ? 'Yes' : 'No'}
- External hosting ready: ${values.summary.hostingReady ? 'Yes' : 'No'}
- External hosting pending: ${values.summary.externalHostingPending ? 'Yes' : 'No'}
- Hosting control files ready: ${values.summary.hostingControlFilesReady ? 'Yes' : 'No'}
- GitHub Pages workflow ready: ${values.summary.githubPagesWorkflowReady ? 'Yes' : 'No'}
- Sitemap ready: ${values.summary.sitemapReady ? 'Yes' : 'No'}
- Sitemap required now: ${values.summary.sitemapRequired ? 'Yes' : 'No'}
- Routes: ${values.summary.routeCount}
- Locales: ${values.summary.locales}
- Missing files: ${values.summary.missingFiles}
- Missing control files: ${values.summary.missingControlFiles}

## URL State

| URL | Value | Status |
| --- | --- | --- |
${urlRows}

## Deployment Checks

| Check | Status | Action | Evidence |
| --- | --- | --- | --- |
${checkRows}

## Hosting Control Files

| File | Status | Bytes | SHA-256 |
| --- | --- | ---: | --- |
${controlRows}

## Deployment Workflow

- File: \`${values.deploymentWorkflow.path}\`
- Ready: ${values.deploymentWorkflow.ready ? 'Yes' : 'No'}
- Bytes: ${values.deploymentWorkflow.bytes ?? 0}
- SHA-256: ${values.deploymentWorkflow.sha256 ?? 'n/a'}

Sitemap: \`${values.sitemap.path}\`, ${values.sitemap.ready ? 'ready' : 'pending'}, ${values.sitemap.urlCount}/${values.sitemap.expectedUrlCount} URLs.

## Route Sample

| Locale | Kind | Route | File | Hosted URL |
| --- | --- | --- | --- | --- |
${routeRows}

The full route inventory is in \`docs/public-site-deploy-audit.json\`.

## Commands

${commands}
`;
}

function check(id, action, ready, evidence) {
  return {
    id,
    action,
    status: ready ? 'READY' : 'PENDING',
    evidence,
  };
}

function fileInfo(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    return {
      path: relativePath,
      exists: false,
      bytes: null,
      sha256: null,
    };
  }

  const buffer = fs.readFileSync(absolutePath);
  return {
    path: relativePath,
    exists: true,
    bytes: buffer.length,
    sha256: require('crypto').createHash('sha256').update(buffer).digest('hex'),
  };
}

function everyLocaleHasAllPageKinds(pagesValue) {
  return expectedLocales.every((locale) => {
    const kinds = pagesValue.filter((page) => page.locale === locale).map((page) => page.kind);
    return expectedKinds.every((kind) => kinds.includes(kind));
  });
}

function sameSet(actual, expected) {
  return (
    Array.isArray(actual) &&
    actual.length === expected.length &&
    expected.every((item) => actual.includes(item))
  );
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
  const cleanedRoute = String(route ?? '').replace(/^\/+/, '');
  return cleanedRoute ? `${rootUrl}/${cleanedRoute}` : rootUrl;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
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

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}
