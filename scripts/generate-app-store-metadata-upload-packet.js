const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const jsonPath = path.join(root, 'docs/app-store-metadata-upload-packet.json');
const markdownPath = path.join(root, 'docs/app-store-metadata-upload-packet.md');

const appJson = require('../app.json').expo;
const storeConfig = require('../store.config.js');
const metadataPreview = require('../docs/app-store-metadata-preview.json');
const screenshotManifest = require('../docs/app-store-screenshot-manifest.json');
const appStoreCopyAudit = readJson('docs/app-store-copy-audit.json') ?? {};
const publicSiteHostingVerification = readJson('docs/public-site-hosting-verification.json') ?? {};

const expectedAppleLocales = ['zh-Hans', 'zh-Hant', 'en-US', 'fr-FR', 'it', 'de-DE', 'es-ES', 'ko', 'pl', 'pt-BR'];
const expectedScreenshotDevices = ['iphone-6.9', 'iphone-6.5', 'iphone-5.5', 'ipad-13'];
const expectedScreenshotScenes = [
  'Ready screen',
  'Active round with rewarded-ad continue entry',
  'JLPT N5-N1 level selection',
  'Settings, language, BGM, local data, support, privacy',
];
const appleInfo = storeConfig.apple?.info ?? {};
const localizedPacks = new Map(
  (screenshotManifest.localizedPacks ?? []).map((pack) => [pack.appStoreLocale, pack]),
);
const localeRows = expectedAppleLocales.map((appStoreLocale) => buildLocaleRow(appStoreLocale));
const failures = [];

if (metadataPreview.source !== 'store.config.js') failures.push('metadata preview must come from store.config.js');
if (appStoreCopyAudit.summary?.risk !== 'PASS') failures.push('App Store copy audit must pass before generating the upload packet');
for (const row of localeRows) {
  if (!row.fieldLimitsReady) failures.push(`${row.appStoreLocale} metadata fields exceed App Store limits`);
  if (!row.screenshotPackReady) failures.push(`${row.appStoreLocale} screenshot pack is incomplete`);
}

const packet = {
  schemaVersion: 1,
  source: 'scripts/generate-app-store-metadata-upload-packet.js',
  generatedFrom: {
    storeConfig: 'store.config.js',
    metadataPreview: 'docs/app-store-metadata-preview.json',
    appStoreCopyAudit: 'docs/app-store-copy-audit.json',
    screenshotManifest: 'docs/app-store-screenshot-manifest.json',
    publicSiteHostingVerification: 'docs/public-site-hosting-verification.json',
  },
  purpose:
    'Manual App Store Connect field packet and EAS Metadata fallback for the exact current Kana Sprint release.',
  app: {
    name: appJson.name,
    version: appJson.version,
    bundleIdentifier: appJson.ios?.bundleIdentifier,
    buildNumber: appJson.ios?.buildNumber,
    categories: storeConfig.apple?.categories ?? [],
    automaticRelease: storeConfig.apple?.release?.automaticRelease ?? null,
    phasedRelease: storeConfig.apple?.release?.phasedRelease ?? null,
  },
  summary: {
    risk: failures.length === 0 ? 'PASS' : 'REVIEW',
    localReady: failures.length === 0,
    externalUrlsReady: localeRows.every((row) => row.urls.supportReady && row.urls.privacyReady),
    reviewContactReady: Boolean(storeConfig.apple?.review),
    locales: localeRows.length,
    fieldReadyLocales: localeRows.filter((row) => row.fieldLimitsReady).length,
    screenshotReadyLocales: localeRows.filter((row) => row.screenshotPackReady).length,
    supportUrlReadyLocales: localeRows.filter((row) => row.urls.supportReady).length,
    privacyUrlReadyLocales: localeRows.filter((row) => row.urls.privacyReady).length,
    marketingUrlReadyLocales: localeRows.filter((row) => row.urls.marketingReady).length,
    copyAuditRisk: appStoreCopyAudit.summary?.risk ?? 'UNKNOWN',
    hostingVerificationStatus: publicSiteHostingVerification.summary?.status ?? 'UNKNOWN',
    failures: failures.length,
  },
  limits: {
    title: 30,
    subtitle: 30,
    promoText: 170,
    keywords: 100,
    descriptionMax: 4000,
  },
  locales: localeRows,
  failures,
};

fs.writeFileSync(jsonPath, `${JSON.stringify(packet, null, 2)}\n`);
fs.writeFileSync(markdownPath, renderMarkdown(packet));

if (packet.summary.risk !== 'PASS') {
  console.error(`App Store metadata upload packet requires review: ${failures.length} issue(s)`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`generated ${path.relative(root, markdownPath)} and ${path.relative(root, jsonPath)}`);

function buildLocaleRow(appStoreLocale) {
  const values = appleInfo[appStoreLocale] ?? {};
  const preview = (metadataPreview.locales ?? []).find((entry) => entry.appStoreLocale === appStoreLocale) ?? {};
  const screenshotPack =
    localizedPacks.get(appStoreLocale) ??
    (appStoreLocale === 'en-US' ? screenshotManifest.defaultPack : undefined);
  const screenshots = screenshotPack?.screenshots ?? [];
  const devices = unique(screenshots.map((entry) => entry.device));
  const scenes = unique(screenshots.map((entry) => entry.scene));
  const keywords = values.keywords ?? [];
  const fieldLengths = {
    title: countCharacters(values.title),
    subtitle: countCharacters(values.subtitle),
    promoText: countCharacters(values.promoText),
    description: countCharacters(values.description),
    keywords: keywords.join(',').length,
  };
  const fieldLimitsReady =
    hasText(values.title) &&
    hasText(values.subtitle) &&
    hasText(values.promoText) &&
    hasText(values.description) &&
    keywords.length > 0 &&
    fieldLengths.title <= 30 &&
    fieldLengths.subtitle <= 30 &&
    fieldLengths.promoText <= 170 &&
    fieldLengths.description <= 4000 &&
    fieldLengths.keywords <= 100;

  return {
    appStoreLocale,
    sourceLocale: preview.sourceLocale ?? appStoreLocale,
    fieldLimitsReady,
    screenshotPackReady:
      screenshots.length === expectedScreenshotDevices.length * expectedScreenshotScenes.length &&
      sameSet(devices, expectedScreenshotDevices) &&
      sameSet(scenes, expectedScreenshotScenes),
    fields: {
      title: values.title ?? '',
      subtitle: values.subtitle ?? '',
      promotionalText: values.promoText ?? '',
      description: values.description ?? '',
      keywords: keywords.join(','),
      releaseNotes: values.releaseNotes ?? '',
    },
    fieldLengths,
    urls: {
      marketingUrl: values.marketingUrl ?? null,
      supportUrl: values.supportUrl ?? null,
      privacyPolicyUrl: values.privacyPolicyUrl ?? null,
      marketingReady: Boolean(values.marketingUrl),
      supportReady: Boolean(values.supportUrl),
      privacyReady: Boolean(values.privacyPolicyUrl),
    },
    screenshots: {
      root: screenshotPack?.root ?? null,
      count: screenshots.length,
      devices,
      scenes,
      files: screenshots.map((entry) => entry.path),
    },
  };
}

function renderMarkdown(packet) {
  const localeSummaryRows = packet.locales
    .map((row) => `| ${row.appStoreLocale} | ${row.sourceLocale} | ${row.fieldLimitsReady ? 'Ready' : 'Review'} | ${row.screenshotPackReady ? 'Ready' : 'Review'} | ${row.urls.supportReady ? 'Yes' : 'No'} | ${row.urls.privacyReady ? 'Yes' : 'No'} | ${row.screenshots.count} |`)
    .join('\n');
  const localeBlocks = packet.locales.map(renderLocaleBlock).join('\n\n');
  const failureRows = packet.failures.length > 0
    ? packet.failures.map((failure) => `- ${failure}`).join('\n')
    : '- None.';

  return `# App Store Metadata Upload Packet

${packet.purpose}

## Summary

- Risk: ${packet.summary.risk}
- Local metadata ready: ${packet.summary.localReady ? 'Yes' : 'No'}
- External URLs ready: ${packet.summary.externalUrlsReady ? 'Yes' : 'No'}
- Review contact ready: ${packet.summary.reviewContactReady ? 'Yes' : 'No'}
- App Store locales: ${packet.summary.locales}
- Field-ready locales: ${packet.summary.fieldReadyLocales}/${packet.summary.locales}
- Screenshot-ready locales: ${packet.summary.screenshotReadyLocales}/${packet.summary.locales}
- Support URL ready locales: ${packet.summary.supportUrlReadyLocales}/${packet.summary.locales}
- Privacy URL ready locales: ${packet.summary.privacyUrlReadyLocales}/${packet.summary.locales}
- Copy audit risk: ${packet.summary.copyAuditRisk}
- Public site hosting verification: ${packet.summary.hostingVerificationStatus}

## Locale Summary

| App Store locale | Source locale | Fields | Screenshots | Support URL | Privacy URL | Screenshots |
| --- | --- | --- | --- | --- | --- | ---: |
${localeSummaryRows}

## Release Gate Issues

${failureRows}

## Locale Field Packets

${localeBlocks}
`;
}

function renderLocaleBlock(row) {
  return `### ${row.appStoreLocale}

- Source locale: ${row.sourceLocale}
- Field limits ready: ${row.fieldLimitsReady ? 'Yes' : 'No'}
- Screenshot pack ready: ${row.screenshotPackReady ? 'Yes' : 'No'}
- Screenshot root: ${row.screenshots.root ?? 'missing'}
- Support URL: ${row.urls.supportUrl ?? 'missing'}
- Privacy URL: ${row.urls.privacyPolicyUrl ?? 'missing'}

#### Title (${row.fieldLengths.title}/30)

\`\`\`text
${row.fields.title}
\`\`\`

#### Subtitle (${row.fieldLengths.subtitle}/30)

\`\`\`text
${row.fields.subtitle}
\`\`\`

#### Promotional Text (${row.fieldLengths.promoText}/170)

\`\`\`text
${row.fields.promotionalText}
\`\`\`

#### Description (${row.fieldLengths.description}/4000)

\`\`\`text
${row.fields.description}
\`\`\`

#### Keywords (${row.fieldLengths.keywords}/100)

\`\`\`text
${row.fields.keywords}
\`\`\`

#### Release Notes

\`\`\`text
${row.fields.releaseNotes}
\`\`\``;
}

function countCharacters(value) {
  return Array.from(String(value ?? '')).length;
}

function hasText(value) {
  return String(value ?? '').trim().length > 0;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function sameSet(actual, expected) {
  return (
    Array.isArray(actual) &&
    actual.length === expected.length &&
    expected.every((item) => actual.includes(item))
  );
}

function readJson(relativePath) {
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) return null;

  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}
