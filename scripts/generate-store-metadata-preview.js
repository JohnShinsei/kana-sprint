const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const outputPath = path.join(root, 'docs/app-store-metadata-preview.json');
const storeConfig = require('../store.config.js');
const screenshotManifest = require('../docs/app-store-screenshot-manifest.json');
const sourceLocales = {
  'zh-Hans': 'zh-Hans',
  'zh-Hant': 'zh-Hant',
  'en-US': 'en',
  'fr-FR': 'fr',
  it: 'it',
  'de-DE': 'de',
  'es-ES': 'es-ES',
  ko: 'ko',
  pl: 'pl',
  'pt-BR': 'pt-BR',
};

const appleInfo = storeConfig.apple?.info ?? {};
const localizedScreenshotPacks = new Map(
  (screenshotManifest.localizedPacks ?? []).map((pack) => [pack.appStoreLocale, pack]),
);

const preview = {
  schemaVersion: 1,
  source: 'store.config.js',
  generatedFrom: {
    metadata: 'docs/app-store-localizations.json',
    screenshots: 'docs/app-store-screenshot-manifest.json',
  },
  app: {
    version: storeConfig.apple?.version,
    copyright: storeConfig.apple?.copyright,
    categories: storeConfig.apple?.categories ?? [],
    automaticRelease: storeConfig.apple?.release?.automaticRelease ?? null,
    phasedRelease: storeConfig.apple?.release?.phasedRelease ?? null,
    reviewContactReady: Boolean(storeConfig.apple?.review),
    reviewNotes: storeConfig.apple?.review?.notes,
  },
  locales: Object.entries(appleInfo).map(([appStoreLocale, values]) =>
    makeLocalePreview(appStoreLocale, values),
  ),
};

fs.writeFileSync(outputPath, `${JSON.stringify(preview, null, 2)}\n`);
console.log(`generated ${path.relative(root, outputPath)} with ${preview.locales.length} App Store locales`);

function makeLocalePreview(appStoreLocale, values) {
  const screenshotPack =
    localizedScreenshotPacks.get(appStoreLocale) ??
    (appStoreLocale === 'en-US' ? screenshotManifest.defaultPack : undefined);
  const keywords = values.keywords ?? [];

  return {
    appStoreLocale,
    sourceLocale: sourceLocales[appStoreLocale] ?? appStoreLocale,
    title: values.title,
    subtitle: values.subtitle,
    promoText: values.promoText,
    description: values.description,
    keywords,
    releaseNotes: values.releaseNotes,
    lengths: {
      title: countCharacters(values.title),
      subtitle: countCharacters(values.subtitle),
      promoText: countCharacters(values.promoText),
      description: countCharacters(values.description),
      keywords: keywords.join(',').length,
    },
    urls: {
      marketingUrl: values.marketingUrl ?? null,
      supportUrl: values.supportUrl ?? null,
      privacyPolicyUrl: values.privacyPolicyUrl ?? null,
      supportReady: Boolean(values.supportUrl),
      privacyReady: Boolean(values.privacyPolicyUrl),
    },
    screenshots: {
      root: screenshotPack?.root ?? null,
      count: screenshotPack?.screenshots?.length ?? 0,
      devices: unique((screenshotPack?.screenshots ?? []).map((entry) => entry.device)),
      scenes: unique((screenshotPack?.screenshots ?? []).map((entry) => entry.scene)),
    },
  };
}

function countCharacters(value) {
  return Array.from(String(value ?? '')).length;
}

function unique(values) {
  return [...new Set(values)];
}
