const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const jsonPath = path.join(root, 'docs/app-store-copy-audit.json');
const markdownPath = path.join(root, 'docs/app-store-copy-audit.md');

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
const protectedTerms = [
  'naruto',
  'one piece',
  'dragon ball',
  'pokemon',
  'pokémon',
  'demon slayer',
  'kimetsu',
  'jujutsu',
  'ghibli',
  'totoro',
  'sailor moon',
  'attack on titan',
  'evangelion',
  'bleach',
  'spy x family',
];
const forbiddenClaims = [
  'ad-free',
  'no ads',
  'without ads',
  'sans publicité',
  'sin anuncios',
  'sem anúncios',
  'keine werbung',
  'reklamsız',
  '광고 없음',
  '无广告',
  '無廣告',
];

const localizations = require('../docs/app-store-localizations.json');
const metadataPreview = require('../docs/app-store-metadata-preview.json');
const screenshotManifest = require('../docs/app-store-screenshot-manifest.json');
const contentRightsAudit = require('../docs/content-rights-audit.json');
const privacyAnswers = require('../docs/app-store-privacy-answers.json');
const admobReleaseAudit = require('../docs/admob-release-audit.json');

const previewBySourceLocale = Object.fromEntries(
  (metadataPreview.locales ?? []).map((entry) => [entry.sourceLocale, entry]),
);
const localizedPacks = new Map((screenshotManifest.localizedPacks ?? []).map((pack) => [pack.locale, pack]));

const localeRows = expectedLocales.map((locale) => makeLocaleRow(locale));
const audit = {
  schemaVersion: 1,
  source: 'scripts/generate-app-store-copy-audit.js',
  generatedFrom: {
    localizations: 'docs/app-store-localizations.json',
    metadataPreview: 'docs/app-store-metadata-preview.json',
    screenshotManifest: 'docs/app-store-screenshot-manifest.json',
    contentRightsAudit: 'docs/content-rights-audit.json',
    privacyAnswers: 'docs/app-store-privacy-answers.json',
    admobReleaseAudit: 'docs/admob-release-audit.json',
  },
  officialReferences: [
    {
      label: 'Apple App Store search keywords',
      url: 'https://developer.apple.com/app-store/search/',
    },
    {
      label: 'Apple App Store Connect platform version information',
      url: 'https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information/',
    },
  ],
  expectedLocales,
  expectedAppleLocales,
  copyRules: {
    titleCharactersMax: 30,
    subtitleCharactersMax: 30,
    promotionalTextCharactersMax: 170,
    descriptionCharactersMax: 4000,
    keywordsBytesMax: 100,
    reviewNotesBytesMax: 4000,
  },
  rows: localeRows,
  releasePosture: {
    contentRightsRisk: contentRightsAudit.summary?.risk ?? 'UNKNOWN',
    protectedIpTermHits: contentRightsAudit.summary?.protectedIpTermHits ?? null,
    privacyAnswerState: privacyAnswers.summary?.currentState ?? 'UNKNOWN',
    admobState: admobReleaseAudit.summary?.currentState ?? 'UNKNOWN',
    liveAdsReady: Boolean(admobReleaseAudit.summary?.liveAdsReady),
  },
};

audit.summary = {
  risk: localeRows.every((entry) => entry.ready) && audit.releasePosture.contentRightsRisk === 'PASS' ? 'PASS' : 'REVIEW',
  locales: localeRows.length,
  readyLocales: localeRows.filter((entry) => entry.ready).length,
  titleLimitReady: localeRows.every((entry) => entry.limits.title.ready),
  subtitleLimitReady: localeRows.every((entry) => entry.limits.subtitle.ready),
  promotionalTextLimitReady: localeRows.every((entry) => entry.limits.promotionalText.ready),
  descriptionLimitReady: localeRows.every((entry) => entry.limits.description.ready),
  keywordsByteLimitReady: localeRows.every((entry) => entry.limits.keywordsBytes.ready),
  keywordFormatReady: localeRows.every((entry) => entry.keywordChecks.ready),
  noForbiddenClaims: localeRows.every((entry) => entry.claimChecks.forbiddenClaims.length === 0),
  noProtectedTermHits: localeRows.every((entry) => entry.claimChecks.protectedTermHits.length === 0),
  coreFeatureClaimsReady: localeRows.every((entry) => entry.claimChecks.coreFeatureClaimsReady),
  screenshotPacksReady: localeRows.every((entry) => entry.screenshotPackReady),
  contentRightsRisk: audit.releasePosture.contentRightsRisk,
  privacyAnswerState: audit.releasePosture.privacyAnswerState,
  admobState: audit.releasePosture.admobState,
};

fs.writeFileSync(jsonPath, `${JSON.stringify(audit, null, 2)}\n`);
fs.writeFileSync(markdownPath, renderMarkdown(audit));

if (audit.summary.risk !== 'PASS') {
  console.error(`App Store copy audit requires review: ${audit.summary.risk}`);
  process.exit(1);
}

console.log(`generated ${path.relative(root, markdownPath)} and ${path.relative(root, jsonPath)}`);

function makeLocaleRow(locale) {
  const source = localizations[locale] ?? {};
  const preview = previewBySourceLocale[locale] ?? {};
  const keywordsText = String(source.keywords ?? '');
  const keywordTerms = splitKeywords(keywordsText);
  const screenshotPack = localizedPacks.get(locale);
  const appStoreLocale = expectedAppleLocales[locale];
  const allCopy = [source.name, source.subtitle, source.promotionalText, source.description, source.keywords].join('\n');
  const normalizedTitleSubtitleTerms = new Set([
    ...tokenize(source.name),
    ...tokenize(source.subtitle),
    'games',
    'game',
    'education',
    'educational',
  ]);
  const duplicatedSearchTerms = keywordTerms.filter((keyword) =>
    tokenize(keyword).some((token) => normalizedTitleSubtitleTerms.has(token)),
  );
  const keywordChecks = {
    terms: keywordTerms.length,
    hasEmptyTerm: keywordTerms.some((keyword) => keyword.length === 0),
    hasCommaSpaces: /,\s+/.test(keywordsText),
    duplicatedSearchTerms,
    hasJlpt: keywordTerms.some((keyword) => keyword.toLocaleLowerCase().includes('jlpt')),
    ready:
      keywordTerms.length >= 5 &&
      !keywordTerms.some((keyword) => keyword.length === 0) &&
      !/,\s+/.test(keywordsText) &&
      duplicatedSearchTerms.length === 0 &&
      keywordTerms.some((keyword) => keyword.toLocaleLowerCase().includes('jlpt')),
  };
  const claimChecks = {
    mentionsJlpt: includesAny(allCopy, ['JLPT']),
    mentionsSixtySeconds: includesAny(allCopy, ['60']),
    mentionsOriginalLinePosture: includesAny(allCopy, ['original', '原创', '原創', 'originales', 'originali', 'originale', '오리지널', 'oryginalne', 'originais']),
    forbiddenClaims: findTerms(allCopy, forbiddenClaims),
    protectedTermHits: findTerms(allCopy, protectedTerms),
  };
  claimChecks.coreFeatureClaimsReady =
    claimChecks.mentionsJlpt && claimChecks.mentionsSixtySeconds && claimChecks.mentionsOriginalLinePosture;
  const limits = {
    title: limitRow(preview.lengths?.title, 30),
    subtitle: limitRow(preview.lengths?.subtitle, 30),
    promotionalText: limitRow(preview.lengths?.promoText, 170),
    description: limitRow(preview.lengths?.description, 4000, 80),
    keywordsBytes: limitRow(Buffer.byteLength(keywordsText, 'utf8'), 100),
  };
  const screenshotPackReady =
    screenshotPack?.appStoreLocale === appStoreLocale &&
    (screenshotPack?.screenshots ?? []).length >= 16;
  const ready =
    preview.appStoreLocale === appStoreLocale &&
    Object.values(limits).every((entry) => entry.ready) &&
    keywordChecks.ready &&
    claimChecks.coreFeatureClaimsReady &&
    claimChecks.forbiddenClaims.length === 0 &&
    claimChecks.protectedTermHits.length === 0 &&
    screenshotPackReady;

  return {
    locale,
    appStoreLocale,
    previewLocale: preview.appStoreLocale ?? null,
    title: source.name ?? null,
    subtitle: source.subtitle ?? null,
    limits,
    keywordChecks,
    claimChecks,
    screenshotPackReady,
    screenshotCount: screenshotPack?.screenshots?.length ?? 0,
    urls: {
      supportReady: Boolean(preview.urls?.supportReady),
      privacyReady: Boolean(preview.urls?.privacyReady),
    },
    ready,
  };
}

function limitRow(value, max, min = 1) {
  const current = Number(value ?? 0);
  return {
    value: current,
    min,
    max,
    ready: current >= min && current <= max,
  };
}

function splitKeywords(value) {
  return String(value ?? '')
    .split(',')
    .map((keyword) => keyword.trim())
    .filter(Boolean);
}

function tokenize(value) {
  return String(value ?? '')
    .toLocaleLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/[\s-]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
}

function includesAny(value, terms) {
  const lower = String(value ?? '').toLocaleLowerCase();
  return terms.some((term) => lower.includes(term.toLocaleLowerCase()));
}

function findTerms(value, terms) {
  const lower = String(value ?? '').toLocaleLowerCase();
  return terms.filter((term) => lower.includes(term.toLocaleLowerCase()));
}

function renderMarkdown(values) {
  const rows = values.rows
    .map(
      (entry) =>
        `| ${entry.locale} | ${entry.appStoreLocale} | ${entry.limits.title.value}/${entry.limits.title.max} | ${entry.limits.subtitle.value}/${entry.limits.subtitle.max} | ${entry.limits.promotionalText.value}/${entry.limits.promotionalText.max} | ${entry.limits.description.value}/${entry.limits.description.max} | ${entry.limits.keywordsBytes.value}/${entry.limits.keywordsBytes.max} | ${entry.keywordChecks.duplicatedSearchTerms.length} | ${entry.ready ? 'Ready' : 'Review'} |`,
    )
    .join('\n');
  const references = values.officialReferences.map((entry) => `- ${entry.label}: ${entry.url}`).join('\n');

  return `# App Store Copy Audit

## Summary

- Risk: ${values.summary.risk}
- Locales: ${values.summary.locales}
- Ready locales: ${values.summary.readyLocales}
- Title limit ready: ${values.summary.titleLimitReady ? 'Yes' : 'No'}
- Subtitle limit ready: ${values.summary.subtitleLimitReady ? 'Yes' : 'No'}
- Promotional text limit ready: ${values.summary.promotionalTextLimitReady ? 'Yes' : 'No'}
- Description limit ready: ${values.summary.descriptionLimitReady ? 'Yes' : 'No'}
- Keywords byte limit ready: ${values.summary.keywordsByteLimitReady ? 'Yes' : 'No'}
- Keyword format ready: ${values.summary.keywordFormatReady ? 'Yes' : 'No'}
- No forbidden ad/privacy claims: ${values.summary.noForbiddenClaims ? 'Yes' : 'No'}
- No protected IP term hits: ${values.summary.noProtectedTermHits ? 'Yes' : 'No'}
- Core JLPT/original-line claims ready: ${values.summary.coreFeatureClaimsReady ? 'Yes' : 'No'}
- Screenshot packs ready: ${values.summary.screenshotPacksReady ? 'Yes' : 'No'}
- Content rights risk: ${values.summary.contentRightsRisk}
- Privacy answer state: ${values.summary.privacyAnswerState}
- AdMob state: ${values.summary.admobState}

## Locale Rows

| Locale | App Store locale | Title | Subtitle | Promo | Description | Keywords bytes | Keyword duplicates | Status |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
${rows}

## Official References

${references}
`;
}
