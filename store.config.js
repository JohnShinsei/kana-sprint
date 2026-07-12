const { loadLocalEnv } = require('./scripts/load-env');
const appJson = require('./app.json').expo;
const localizations = require('./docs/app-store-localizations.json');

loadLocalEnv();

const appleLocaleMap = {
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
const supportedLocales = Object.keys(appleLocaleMap);

const baseUrl = trimTrailingSlash(process.env.APP_STORE_BASE_URL);
const marketingUrl = normalizeUrl(process.env.APP_STORE_MARKETING_URL) ?? baseUrl;
const supportUrl = normalizeUrl(process.env.APP_STORE_SUPPORT_URL) ?? joinUrl(baseUrl, 'support');
const privacyPolicyUrl = normalizeUrl(process.env.APP_STORE_PRIVACY_URL) ?? joinUrl(baseUrl, 'privacy');
const review = makeReviewInfo();

module.exports = cleanObject({
  configVersion: 0,
  apple: {
    version: appJson.version,
    copyright: `${new Date().getFullYear()} Kana Sprint`,
    advisory: {
      alcoholTobaccoOrDrugUseOrReferences: 'NONE',
      contests: 'NONE',
      gamblingSimulated: 'NONE',
      horrorOrFearThemes: 'NONE',
      matureOrSuggestiveThemes: 'NONE',
      medicalOrTreatmentInformation: 'NONE',
      profanityOrCrudeHumor: 'NONE',
      sexualContentGraphicAndNudity: 'NONE',
      sexualContentOrNudity: 'NONE',
      violenceCartoonOrFantasy: 'NONE',
      violenceRealistic: 'NONE',
      violenceRealisticProlongedGraphicOrSadistic: 'NONE',
      gambling: false,
      unrestrictedWebAccess: false,
      kidsAgeBand: null,
      ageRatingOverride: 'NONE',
      koreaAgeRatingOverride: 'NONE',
    },
    categories: [['GAMES', 'GAMES_WORD'], 'EDUCATION'],
    release: {
      automaticRelease: false,
      phasedRelease: false,
    },
    review,
    info: makeLocalizedInfo(),
  },
});

function makeLocalizedInfo() {
  return Object.fromEntries(
    Object.entries(localizations).map(([locale, values]) => [
      appleLocaleMap[locale] ?? locale,
      cleanObject({
        title: values.name,
        subtitle: values.subtitle,
        description: values.description,
        keywords: splitKeywords(values.keywords),
        promoText: values.promotionalText,
        releaseNotes: 'Initial release.',
        marketingUrl: localizedMarketingUrl(locale),
        supportUrl: localizedSupportUrl(locale),
        privacyPolicyUrl: localizedPrivacyPolicyUrl(locale),
      }),
    ]),
  );
}

function localizedMarketingUrl(locale) {
  if (process.env.APP_STORE_MARKETING_URL) return marketingUrl;
  if (!baseUrl) return undefined;
  return supportedLocales.includes(locale) ? joinUrl(baseUrl, locale) : marketingUrl;
}

function localizedSupportUrl(locale) {
  if (process.env.APP_STORE_SUPPORT_URL) return supportUrl;
  if (!baseUrl) return undefined;
  return supportedLocales.includes(locale) ? joinUrl(baseUrl, `${locale}/support`) : supportUrl;
}

function localizedPrivacyPolicyUrl(locale) {
  if (process.env.APP_STORE_PRIVACY_URL) return privacyPolicyUrl;
  if (!baseUrl) return undefined;
  return supportedLocales.includes(locale) ? joinUrl(baseUrl, `${locale}/privacy`) : privacyPolicyUrl;
}

function makeReviewInfo() {
  const firstName = cleanEnv('APP_STORE_REVIEW_FIRST_NAME');
  const lastName = cleanEnv('APP_STORE_REVIEW_LAST_NAME');
  const email = cleanEnv('APP_STORE_REVIEW_EMAIL');
  const phone = cleanEnv('APP_STORE_REVIEW_PHONE');

  if (!firstName || !lastName || !email || !phone) return undefined;

  return {
    firstName,
    lastName,
    email,
    phone,
    demoRequired: false,
    notes:
      'Kana Sprint does not require sign-in. Reviewers can start a practice run directly, switch N5-N1 difficulty, open Settings for language and music, and use the rewarded-ad continue entry point when production AdMob IDs are configured.',
  };
}

function splitKeywords(value) {
  return String(value ?? '')
    .split(',')
    .map((keyword) => keyword.trim())
    .filter(Boolean);
}

function cleanEnv(key) {
  const value = process.env[key]?.trim();
  return value ? value : undefined;
}

function normalizeUrl(value) {
  const cleaned = value?.trim();
  return cleaned ? cleaned : undefined;
}

function trimTrailingSlash(value) {
  const cleaned = normalizeUrl(value);
  return cleaned?.replace(/\/+$/, '');
}

function joinUrl(root, path) {
  return root ? `${root}/${path}` : undefined;
}

function cleanObject(value) {
  if (Array.isArray(value)) return value.map(cleanObject);

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entryValue]) => entryValue !== undefined)
        .map(([entryKey, entryValue]) => [entryKey, cleanObject(entryValue)]),
    );
  }

  return value;
}
