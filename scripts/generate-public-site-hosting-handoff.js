const fs = require('fs');
const path = require('path');
const { loadLocalEnv } = require('./load-env');

const root = path.resolve(__dirname, '..');
const jsonPath = path.join(root, 'docs/public-site-hosting-handoff.json');
const markdownPath = path.join(root, 'docs/public-site-hosting-handoff.md');

loadLocalEnv();

const appJson = require('../app.json').expo;
const publicSiteManifest = readJson('docs/public-site-manifest.json');
const publicSiteDeployAudit = readJson('docs/public-site-deploy-audit.json');
const publicSiteHostingVerification = readJson('docs/public-site-hosting-verification.json');
const expectedLocales = ['zh-Hans', 'zh-Hant', 'en', 'fr', 'it', 'de', 'es-ES', 'ko', 'pl', 'pt-BR'];
const baseUrl = trimTrailingSlash(cleanEnv('APP_STORE_BASE_URL'));
const explicitSupportUrl = cleanEnv('APP_STORE_SUPPORT_URL');
const explicitPrivacyUrl = cleanEnv('APP_STORE_PRIVACY_URL');
const explicitMarketingUrl = cleanEnv('APP_STORE_MARKETING_URL');
const supportUrl = explicitSupportUrl ?? joinUrl(baseUrl, 'support');
const privacyUrl = explicitPrivacyUrl ?? joinUrl(baseUrl, 'privacy');
const marketingUrl = explicitMarketingUrl ?? baseUrl;
const openSourceNoticesUrl = joinUrl(baseUrl, 'licenses');
const hasProductionBaseUrl = isProductionHttpsUrl(baseUrl);
const siteRoot = fileInfo('site');
const workflow = fileInfo('.github/workflows/deploy-site.yml');
const controlFiles = ['site/robots.txt', 'site/_headers', 'site/_redirects'].map(fileInfo);
const publicSitePages = publicSiteManifest.pages ?? [];
const localReady =
  publicSiteDeployAudit.summary?.localReady === true &&
  publicSiteDeployAudit.summary?.githubPagesWorkflowReady === true &&
  publicSiteDeployAudit.summary?.hostingControlFilesReady === true &&
  publicSiteManifest.pageCount === 44 &&
  sameSet(publicSiteManifest.locales ?? [], expectedLocales) &&
  controlFiles.every((file) => file.exists);
const verificationReady = publicSiteHostingVerification.summary?.ready === true;
const urlConfigurationReady =
  hasProductionBaseUrl ||
  (isProductionHttpsUrl(supportUrl) && isProductionHttpsUrl(privacyUrl));

const handoff = {
  schemaVersion: 1,
  source: 'scripts/generate-public-site-hosting-handoff.js',
  generatedFrom: {
    publicSiteManifest: 'docs/public-site-manifest.json',
    publicSiteDeployAudit: 'docs/public-site-deploy-audit.json',
    publicSiteHostingVerification: 'docs/public-site-hosting-verification.json',
    githubPagesWorkflow: '.github/workflows/deploy-site.yml',
    envTemplate: '.env.example',
    appConfig: 'app.json + app.config.js',
    storeConfig: 'store.config.js',
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
    externalReady: verificationReady,
    externalPending: !verificationReady,
    urlConfigurationReady,
    hasProductionBaseUrl,
    routeCount: publicSiteManifest.pageCount ?? 0,
    locales: publicSiteManifest.locales?.length ?? 0,
    hostingVerificationStatus: publicSiteHostingVerification.summary?.status ?? 'UNKNOWN',
    hostingVerificationCheckedUrls: publicSiteHostingVerification.summary?.checkedUrls ?? 0,
    hostingVerificationPassedUrls: publicSiteHostingVerification.summary?.passedUrls ?? 0,
    hostingVerificationFailedUrls: publicSiteHostingVerification.summary?.failedUrls ?? 0,
    githubPagesWorkflowReady: publicSiteDeployAudit.summary?.githubPagesWorkflowReady === true,
    hostingControlFilesReady: publicSiteDeployAudit.summary?.hostingControlFilesReady === true,
    sitemapReady: publicSiteDeployAudit.summary?.sitemapReady === true,
    sitemapRequired: publicSiteDeployAudit.summary?.sitemapRequired === true,
  },
  deployPackage: {
    root: siteRoot.path,
    exists: siteRoot.exists,
    pageCount: publicSiteManifest.pageCount ?? 0,
    locales: publicSiteManifest.locales ?? [],
    pageKinds: [...new Set(publicSitePages.map((page) => page.kind))],
    controlFiles,
    workflow,
    routeSample: publicSitePages.slice(0, 16).map((page) => ({
      route: page.route,
      path: page.path,
      locale: page.locale,
      kind: page.kind,
    })),
  },
  urls: {
    baseUrl: baseUrl ?? null,
    supportUrl: supportUrl ?? null,
    privacyUrl: privacyUrl ?? null,
    marketingUrl: marketingUrl ?? null,
    openSourceNoticesUrl: openSourceNoticesUrl ?? null,
    localizedExamples: expectedLocales.slice(0, 4).map((locale) => ({
      locale,
      supportUrl: joinUrl(baseUrl, `${locale}/support`),
      privacyUrl: joinUrl(baseUrl, `${locale}/privacy`),
      licensesUrl: joinUrl(baseUrl, `${locale}/licenses`),
    })),
  },
  hostingOptions: [
    hostingOption('github-pages', 'GitHub Pages', publicSiteDeployAudit.summary?.githubPagesWorkflowReady === true, [
      'Commit the repository with the generated site/ folder and .github/workflows/deploy-site.yml.',
      'In GitHub repository settings, enable Pages with GitHub Actions as the source.',
      'Run the Deploy public site workflow manually, or let it run after pushing to main.',
      'Use the deployed HTTPS origin as APP_STORE_BASE_URL.',
    ]),
    hostingOption('netlify-drop', 'Netlify static deploy', localReady, [
      'Drag and drop the site/ folder, or configure the project publish directory as site.',
      'Do not add a build command; the generated site/ folder is already the deploy root.',
      'Preserve nested locale routes and the generated _headers file.',
      'Use the production HTTPS site URL as APP_STORE_BASE_URL.',
    ]),
    hostingOption('cloudflare-pages', 'Cloudflare Pages', localReady, [
      'Create a Pages project with the repository or direct upload flow.',
      'Set the output directory to site and leave the build command empty unless your provider requires one.',
      'Preserve robots.txt, _headers, _redirects, and every locale subdirectory.',
      'Use the production HTTPS Pages URL as APP_STORE_BASE_URL.',
    ]),
    hostingOption('generic-static-host', 'Any static HTTPS host', localReady, [
      'Upload the full site/ directory as the web root, not as a nested /site path.',
      'Confirm /support/, /privacy/, /licenses/, and locale routes such as /zh-Hans/privacy/ resolve without auth.',
      'If the host ignores _redirects, configure trailing-slash redirects for support, privacy, licenses, and locale routes.',
      'Use APP_STORE_BASE_URL when every generated route is hosted under one origin; otherwise set explicit support and privacy URLs.',
    ]),
  ],
  envPlan: [
    envItem('APP_STORE_BASE_URL', '<production HTTPS origin>', 'Preferred. Enables localized support/privacy/license links and sitemap generation.'),
    envItem('APP_STORE_SUPPORT_URL', '<production HTTPS support URL>', 'Only needed if support is not APP_STORE_BASE_URL/support.'),
    envItem('APP_STORE_PRIVACY_URL', '<production HTTPS privacy URL>', 'Only needed if privacy is not APP_STORE_BASE_URL/privacy.'),
    envItem('APP_STORE_MARKETING_URL', '<production HTTPS marketing URL>', 'Optional App Store marketing URL. APP_STORE_BASE_URL can fill it.'),
  ],
  easEnvCommands: [
    'eas env:create --name APP_STORE_BASE_URL --environment production --visibility plaintext',
    'eas env:create --name APP_STORE_SUPPORT_URL --environment production --visibility plaintext',
    'eas env:create --name APP_STORE_PRIVACY_URL --environment production --visibility plaintext',
  ],
  verificationOrder: [
    'npm run site:localized',
    'npm run site:manifest',
    'npm run site:deploy-audit',
    'npm run site:hosting-handoff',
    'Host the site/ directory on the selected provider',
    'Set APP_STORE_BASE_URL or explicit APP_STORE_SUPPORT_URL and APP_STORE_PRIVACY_URL',
    'npm run site:verify-hosting',
    'npm run metadata:preview',
    'npm run release:status',
    'npm run release:store-ready',
  ],
};

fs.writeFileSync(jsonPath, `${JSON.stringify(handoff, null, 2)}\n`);
fs.writeFileSync(markdownPath, renderMarkdown(handoff));

if (!handoff.summary.localReady) {
  console.error('public site hosting handoff requires review: local deploy package is not ready');
  process.exit(1);
}

console.log(`generated ${path.relative(root, markdownPath)} and ${path.relative(root, jsonPath)}`);

function hostingOption(id, label, ready, steps) {
  return { id, label, ready: Boolean(ready), steps };
}

function envItem(key, valueHint, note) {
  return {
    key,
    currentValue: cleanEnv(key) ?? null,
    valueHint,
    ready: key === 'APP_STORE_MARKETING_URL' ? !cleanEnv(key) || isProductionHttpsUrl(cleanEnv(key)) : isProductionHttpsUrl(cleanEnv(key)),
    note,
  };
}

function renderMarkdown(values) {
  const urlRows = [
    ['Base URL', values.urls.baseUrl, values.summary.hasProductionBaseUrl],
    ['Support URL', values.urls.supportUrl, isProductionHttpsUrl(values.urls.supportUrl)],
    ['Privacy URL', values.urls.privacyUrl, isProductionHttpsUrl(values.urls.privacyUrl)],
    ['Marketing URL', values.urls.marketingUrl, !values.urls.marketingUrl || isProductionHttpsUrl(values.urls.marketingUrl)],
    ['Open source notices URL', values.urls.openSourceNoticesUrl, isProductionHttpsUrl(values.urls.openSourceNoticesUrl)],
  ].map(([label, url, ready]) => `| ${label} | ${url ?? 'pending'} | ${ready ? 'Ready' : 'Pending'} |`).join('\n');
  const providerRows = values.hostingOptions
    .map((option) => `| ${option.label} | ${option.ready ? 'Ready' : 'Review'} | ${option.steps.join(' ')} |`)
    .join('\n');
  const envRows = values.envPlan
    .map((item) => `| \`${item.key}\` | ${item.currentValue ?? item.valueHint} | ${item.ready ? 'Ready' : 'Pending'} | ${item.note} |`)
    .join('\n');
  const routeRows = values.deployPackage.routeSample
    .map((route) => `| ${route.locale} | ${route.kind} | \`${route.route}\` | \`${route.path}\` |`)
    .join('\n');
  const commands = values.verificationOrder.map((command) => `1. ${command}`).join('\n');
  const easCommands = values.easEnvCommands.map((command) => `- \`${command}\``).join('\n');

  return `# Public Site Hosting Handoff

Use this handoff to publish the generated support, privacy, license, and localized public pages before App Store metadata submission.

## Summary

- Risk: ${values.summary.risk}
- Local deploy package ready: ${values.summary.localReady ? 'Yes' : 'No'}
- External hosting verified: ${values.summary.externalReady ? 'Yes' : 'No'}
- External hosting pending: ${values.summary.externalPending ? 'Yes' : 'No'}
- URL configuration ready: ${values.summary.urlConfigurationReady ? 'Yes' : 'No'}
- GitHub Pages workflow ready: ${values.summary.githubPagesWorkflowReady ? 'Yes' : 'No'}
- Hosting control files ready: ${values.summary.hostingControlFilesReady ? 'Yes' : 'No'}
- Hosting verification status: ${values.summary.hostingVerificationStatus}
- Hosting verification checks: ${values.summary.hostingVerificationPassedUrls}/${values.summary.hostingVerificationCheckedUrls}
- Routes: ${values.summary.routeCount}
- Locales: ${values.summary.locales}

## What To Publish

- Deploy root: \`${values.deployPackage.root}\`
- Deploy as web root: Yes
- Page count: ${values.deployPackage.pageCount}
- Control files: ${values.deployPackage.controlFiles.map((file) => `\`${file.path}\``).join(', ')}
- GitHub Pages workflow: \`${values.deployPackage.workflow.path}\`

## URL Plan

| URL | Value | Status |
| --- | --- | --- |
${urlRows}

## Hosting Options

| Option | Local readiness | Steps |
| --- | --- | --- |
${providerRows}

## Environment Values

| Key | Value or hint | Status | Note |
| --- | --- | --- | --- |
${envRows}

EAS production env commands:

${easCommands}

## Route Sample

| Locale | Kind | Route | File |
| --- | --- | --- | --- |
${routeRows}

## Verification Order

${commands}
`;
}

function fileInfo(relativePath) {
  const absolutePath = path.join(root, relativePath);
  const exists = fs.existsSync(absolutePath);
  return {
    path: relativePath,
    exists,
    bytes: exists && fs.statSync(absolutePath).isFile() ? fs.statSync(absolutePath).size : null,
  };
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function cleanEnv(key) {
  const value = process.env[key]?.trim();
  return value ? value : undefined;
}

function trimTrailingSlash(value) {
  return value ? value.replace(/\/+$/, '') : undefined;
}

function joinUrl(base, route) {
  if (!base) return undefined;
  return `${trimTrailingSlash(base)}/${String(route ?? '').replace(/^\/+|\/+$/g, '')}`;
}

function isProductionHttpsUrl(value) {
  if (!value || !/^https:\/\//i.test(value)) return false;
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    return (
      url.protocol === 'https:' &&
      hostname !== 'localhost' &&
      !hostname.endsWith('.local') &&
      !hostname.endsWith('.test') &&
      !hostname.endsWith('.example') &&
      !['example.com', 'example.org', 'example.net'].includes(hostname)
    );
  } catch {
    return false;
  }
}

function sameSet(actual, expected) {
  return actual.length === expected.length && expected.every((item) => actual.includes(item));
}
