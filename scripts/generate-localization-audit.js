const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const jsonPath = path.join(root, 'docs/localization-audit.json');
const markdownPath = path.join(root, 'docs/localization-audit.md');

const expectedLocales = ['zh-Hans', 'zh-Hant', 'en', 'fr', 'it', 'de', 'es-ES', 'ko', 'pl', 'pt-BR'];
const expectedAppleLocales = {
  'zh-Hans': 'zh-Hans',
  'zh-Hant': 'zh-Hant',
  en: 'en-US',
  fr: 'fr-FR',
  it: 'it',
  de: 'de-DE',
  'es-ES': 'es-ES',
  ko: 'ko',
  pl: 'pl',
  'pt-BR': 'pt-BR',
};
const expectedScreenshotScenes = [
  'Ready screen',
  'Active round with rewarded-ad continue entry',
  'JLPT N5-N1 level selection',
  'Settings, language, BGM, local data, support, privacy',
];
const expectedScreenshotDevices = ['iphone-6.9', 'iphone-6.5', 'iphone-5.5', 'ipad-13'];

const appJson = require('../app.json').expo;
const i18nSource = readText('src/i18n.ts');
const appSource = readText('App.tsx');
const i18n = loadTsModule('src/i18n.ts');
const appStoreLocalizations = require('../docs/app-store-localizations.json');
const metadataPreview = require('../docs/app-store-metadata-preview.json');
const screenshotManifest = require('../docs/app-store-screenshot-manifest.json');
const publicSiteManifest = require('../docs/public-site-manifest.json');
const studyContentLocalizationAudit = readJson('docs/study-content-localization-audit.json') ?? {};

const uiKeys = extractEnglishMessageKeys(i18nSource);
const localizationPlugin = findPlugin(appJson, 'expo-localization');
const pluginConfig = Array.isArray(localizationPlugin) ? localizationPlugin[1]?.supportedLocales ?? {} : {};
const appLocales = Object.keys(appJson.locales ?? {});
const localeOptions = (i18n.LOCALE_OPTIONS ?? []).map((entry) => entry.locale);
const languageFiles = expectedLocales.map((locale) => {
  const configuredPath = appJson.locales?.[locale]?.replace(/^\.\//, '') ?? null;
  const filePath = configuredPath ? path.join(root, configuredPath) : null;
  const values = filePath && fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : null;

  return {
    locale,
    configuredPath,
    exists: Boolean(filePath && fs.existsSync(filePath)),
    iosDisplayName: values?.ios?.CFBundleDisplayName ?? null,
    androidAppName: values?.android?.app_name ?? null,
    ready: Boolean(values?.ios?.CFBundleDisplayName && values?.android?.app_name),
  };
});
const uiCopy = expectedLocales.map((locale) => {
  const values = uiKeys.map((key) => i18n.t(locale, key));
  const englishValues = uiKeys.map((key) => i18n.t('en', key));
  const translatedFromEnglish = values.filter((value, index) => locale === 'en' || value !== englishValues[index]).length;

  return {
    locale,
    keys: uiKeys.length,
    nonEmpty: values.filter(Boolean).length,
    translatedFromEnglish,
    ready: values.every(Boolean) && (locale === 'en' || translatedFromEnglish >= Math.floor(uiKeys.length * 0.85)),
  };
});
const appStoreRows = expectedLocales.map((locale) => {
  const source = appStoreLocalizations[locale] ?? {};
  const preview = (metadataPreview.locales ?? []).find((entry) => entry.sourceLocale === locale);

  return {
    locale,
    appStoreLocale: expectedAppleLocales[locale],
    previewLocale: preview?.appStoreLocale ?? null,
    titleLength: preview?.lengths?.title ?? 0,
    subtitleLength: preview?.lengths?.subtitle ?? 0,
    promoTextLength: preview?.lengths?.promoText ?? 0,
    descriptionLength: preview?.lengths?.description ?? 0,
    keywordsLength: preview?.lengths?.keywords ?? 0,
    mentionsJlpt: String(source.description ?? '').includes('JLPT') && String(source.keywords ?? '').includes('JLPT'),
    ready:
      preview?.appStoreLocale === expectedAppleLocales[locale] &&
      Boolean(source.name && source.subtitle && source.promotionalText && source.description && source.keywords) &&
      (preview?.lengths?.title ?? 999) <= 30 &&
      (preview?.lengths?.subtitle ?? 999) <= 30 &&
      (preview?.lengths?.promoText ?? 999) <= 170 &&
      (preview?.lengths?.description ?? 0) >= 10 &&
      (preview?.lengths?.description ?? 9999) <= 4000 &&
      (preview?.lengths?.keywords ?? 999) <= 100 &&
      String(source.description ?? '').includes('JLPT') &&
      String(source.keywords ?? '').includes('JLPT'),
  };
});
const screenshotRows = expectedLocales.map((locale) => {
  const pack = (screenshotManifest.localizedPacks ?? []).find((entry) => entry.locale === locale);
  const devices = unique((pack?.screenshots ?? []).map((entry) => entry.device));
  const scenes = unique((pack?.screenshots ?? []).map((entry) => entry.scene));

  return {
    locale,
    appStoreLocale: expectedAppleLocales[locale],
    packLocale: pack?.appStoreLocale ?? null,
    root: pack?.root ?? null,
    screenshots: pack?.screenshots?.length ?? 0,
    devices,
    scenes,
    ready:
      pack?.appStoreLocale === expectedAppleLocales[locale] &&
      (pack?.screenshots?.length ?? 0) === expectedScreenshotDevices.length * expectedScreenshotScenes.length &&
      sameSet(devices, expectedScreenshotDevices) &&
      sameSet(scenes, expectedScreenshotScenes),
  };
});
const publicSiteRows = expectedLocales.map((locale) => {
  const pages = (publicSiteManifest.pages ?? []).filter((entry) => entry.locale === locale && !entry.default);
  const kinds = unique(pages.map((entry) => entry.kind));

  return {
    locale,
    pages: pages.length,
    kinds,
    ready: pages.length === 4 && sameSet(kinds, ['landing', 'support', 'privacy', 'licenses']),
  };
});
const runtimeSignals = {
  systemLanguageDetection: i18nSource.includes('getLocales()') && i18nSource.includes('languageCode') && i18nSource.includes('regionCode'),
  settingsLanguageSwitch: appSource.includes("t(locale, 'language')") && appSource.includes('changeLocale(option.locale)'),
  languageSwitchInSettings: appSource.indexOf("t(locale, 'language')") > appSource.indexOf('settingsContent'),
  japaneseUiLocaleRemoved: !appLocales.includes('ja') && !localeOptions.includes('ja'),
};
const audit = {
  schemaVersion: 1,
  source: 'scripts/generate-localization-audit.js',
  generatedFrom: {
    appConfig: 'app.json',
    i18nSource: 'src/i18n.ts',
    appSource: 'App.tsx',
    languageFiles: 'languages/*.json',
    appStoreLocalizations: 'docs/app-store-localizations.json',
    metadataPreview: 'docs/app-store-metadata-preview.json',
    screenshotManifest: 'docs/app-store-screenshot-manifest.json',
    publicSiteManifest: 'docs/public-site-manifest.json',
    studyContentLocalizationAudit: 'docs/study-content-localization-audit.json',
  },
  officialReferences: [
    {
      label: 'Expo SDK 56',
      url: 'https://docs.expo.dev/versions/v56.0.0/',
    },
    {
      label: 'Expo Localization',
      url: 'https://docs.expo.dev/versions/v56.0.0/sdk/localization/',
    },
  ],
  expectedLocales,
  expectedAppleLocales,
  appLocales,
  pluginSupportedLocales: {
    ios: pluginConfig.ios ?? [],
    android: pluginConfig.android ?? [],
  },
  localeOptions,
  languageFiles,
  uiCopy,
  appStoreRows,
  screenshotRows,
  publicSiteRows,
  runtimeSignals,
};
audit.summary = {
  risk: localizationRisk(audit),
  uiLocales: appLocales.length,
  appStoreLocales: metadataPreview.locales?.length ?? 0,
  uiCopyKeys: uiKeys.length,
  languageFilesReady: languageFiles.every((entry) => entry.ready),
  uiCopyReady: uiCopy.every((entry) => entry.ready),
  appStoreMetadataReady: appStoreRows.every((entry) => entry.ready),
  screenshotPacksReady: screenshotRows.every((entry) => entry.ready),
  localizedScreenshotEntries: screenshotRows.reduce((sum, entry) => sum + entry.screenshots, 0),
  publicSiteReady: publicSiteRows.every((entry) => entry.ready),
  publicSitePages: publicSiteManifest.pageCount ?? 0,
  studyContentLocalizationRisk: studyContentLocalizationAudit.summary?.risk ?? 'UNKNOWN',
  studyContentLocalizationReady: studyContentLocalizationAudit.summary?.risk === 'PASS',
  studyContentLocalizedFields: studyContentLocalizationAudit.summary?.localizedFieldsReady ?? 0,
  studyContentExpectedFields: studyContentLocalizationAudit.summary?.expectedLocalizedFields ?? 0,
  studyContentTranslationEntries: studyContentLocalizationAudit.summary?.contentTranslationEntriesReady ?? 0,
  studyContentExpectedTranslationEntries: studyContentLocalizationAudit.summary?.expectedContentTranslationEntries ?? 0,
  studyContentTextKeys: studyContentLocalizationAudit.summary?.studyTextKeys ?? 0,
  runtimeSignalsReady: Object.values(runtimeSignals).every(Boolean),
  japaneseUiLocaleRemoved: runtimeSignals.japaneseUiLocaleRemoved,
};

fs.writeFileSync(jsonPath, `${JSON.stringify(audit, null, 2)}\n`);
fs.writeFileSync(markdownPath, renderMarkdown(audit));

if (audit.summary.risk !== 'PASS') {
  console.error(`localization audit requires review: ${audit.summary.risk}`);
  process.exit(1);
}

console.log(`generated ${path.relative(root, markdownPath)} and ${path.relative(root, jsonPath)}`);

function renderMarkdown(values) {
  const uiRows = values.uiCopy
    .map((entry) => `| ${entry.locale} | ${entry.keys} | ${entry.nonEmpty} | ${entry.translatedFromEnglish} | ${entry.ready ? 'Ready' : 'Review'} |`)
    .join('\n');
  const storeRows = values.appStoreRows
    .map((entry) => `| ${entry.locale} | ${entry.appStoreLocale} | ${entry.titleLength} | ${entry.subtitleLength} | ${entry.promoTextLength} | ${entry.descriptionLength} | ${entry.keywordsLength} | ${entry.ready ? 'Ready' : 'Review'} |`)
    .join('\n');
  const screenshotRows = values.screenshotRows
    .map((entry) => `| ${entry.locale} | ${entry.appStoreLocale} | ${entry.screenshots} | ${entry.devices.join(', ')} | ${entry.ready ? 'Ready' : 'Review'} |`)
    .join('\n');
  const siteRows = values.publicSiteRows
    .map((entry) => `| ${entry.locale} | ${entry.pages} | ${entry.kinds.join(', ')} | ${entry.ready ? 'Ready' : 'Review'} |`)
    .join('\n');
  const references = values.officialReferences
    .map((entry) => `- ${entry.label}: ${entry.url}`)
    .join('\n');

  return `# Localization Audit

## Summary

- Risk: ${values.summary.risk}
- UI locales: ${values.summary.uiLocales}
- App Store locales: ${values.summary.appStoreLocales}
- UI copy keys per locale: ${values.summary.uiCopyKeys}
- Language files ready: ${values.summary.languageFilesReady ? 'Yes' : 'No'}
- UI copy ready: ${values.summary.uiCopyReady ? 'Yes' : 'No'}
- App Store metadata ready: ${values.summary.appStoreMetadataReady ? 'Yes' : 'No'}
- Localized screenshot entries: ${values.summary.localizedScreenshotEntries}
- Screenshot packs ready: ${values.summary.screenshotPacksReady ? 'Yes' : 'No'}
- Public site pages: ${values.summary.publicSitePages}
- Public site ready: ${values.summary.publicSiteReady ? 'Yes' : 'No'}
- Study content localization: ${values.summary.studyContentLocalizationRisk}
- Study content fields: ${values.summary.studyContentLocalizedFields}/${values.summary.studyContentExpectedFields}
- Study content translations: ${values.summary.studyContentTranslationEntries}/${values.summary.studyContentExpectedTranslationEntries}
- Study content text keys: ${values.summary.studyContentTextKeys}
- Runtime signals ready: ${values.summary.runtimeSignalsReady ? 'Yes' : 'No'}
- Japanese UI locale removed: ${values.summary.japaneseUiLocaleRemoved ? 'Yes' : 'No'}

## UI Copy

| Locale | Keys | Non-empty | Differ from English | Status |
| --- | ---: | ---: | ---: | --- |
${uiRows}

## App Store Metadata

| Locale | App Store locale | Title | Subtitle | Promo | Description | Keywords | Status |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
${storeRows}

## Localized Screenshots

| Locale | App Store locale | Screenshots | Devices | Status |
| --- | --- | ---: | --- | --- |
${screenshotRows}

## Public Site

| Locale | Pages | Kinds | Status |
| --- | ---: | --- | --- |
${siteRows}

## Runtime Signals

- System language detection uses \`expo-localization\`: ${values.runtimeSignals.systemLanguageDetection ? 'Yes' : 'No'}
- Manual language switch is in Settings: ${values.runtimeSignals.settingsLanguageSwitch && values.runtimeSignals.languageSwitchInSettings ? 'Yes' : 'No'}
- Japanese UI locale removed: ${values.runtimeSignals.japaneseUiLocaleRemoved ? 'Yes' : 'No'}

## Official References

${references}
`;
}

function localizationRisk(values) {
  const appConfigReady =
    sameSet(values.appLocales, expectedLocales) &&
    sameSet(values.pluginSupportedLocales.ios, expectedLocales) &&
    sameSet(values.pluginSupportedLocales.android, expectedLocales) &&
    sameSet(values.localeOptions, expectedLocales);

  return appConfigReady &&
    values.summaryReady !== false &&
    values.languageFiles.every((entry) => entry.ready) &&
    values.uiCopy.every((entry) => entry.ready) &&
    values.appStoreRows.every((entry) => entry.ready) &&
    values.screenshotRows.every((entry) => entry.ready) &&
    values.publicSiteRows.every((entry) => entry.ready) &&
    studyContentLocalizationAudit.summary?.risk === 'PASS' &&
    Object.values(values.runtimeSignals).every(Boolean)
    ? 'PASS'
    : 'REVIEW';
}

function extractEnglishMessageKeys(source) {
  const start = source.indexOf('const en = {');
  const end = source.indexOf('\n};', start);
  if (start < 0 || end < 0) return [];

  return [...source.slice(start, end).matchAll(/^\s+([A-Za-z0-9_]+):/gm)].map((match) => match[1]);
}

function loadTsModule(relativePath) {
  const filePath = path.join(root, relativePath);
  const source = fs.readFileSync(filePath, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: filePath,
  }).outputText;
  const module = { exports: {} };
  const localRequire = (request) => {
    if (request === 'expo-localization') {
      return { getLocales: () => [{ languageCode: 'en', languageTag: 'en-US', regionCode: 'US' }] };
    }

    if (request.startsWith('.')) {
      return require(path.resolve(path.dirname(filePath), request));
    }

    return require(request);
  };
  const wrapped = new Function('require', 'module', 'exports', '__dirname', '__filename', output);
  wrapped(localRequire, module, module.exports, path.dirname(filePath), filePath);
  return module.exports;
}

function findPlugin(config, pluginName) {
  return (config.plugins ?? []).find((plugin) => (Array.isArray(plugin) ? plugin[0] : plugin) === pluginName);
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function readJson(relativePath) {
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) return null;

  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sameSet(actual, expected) {
  return (
    Array.isArray(actual) &&
    actual.length === expected.length &&
    expected.every((item) => actual.includes(item))
  );
}

function unique(values) {
  return [...new Set(values)];
}
