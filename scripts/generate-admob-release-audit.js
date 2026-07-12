const fs = require('fs');
const path = require('path');
const { loadLocalEnv } = require('./load-env');

const root = path.resolve(__dirname, '..');
const jsonPath = path.join(root, 'docs/admob-release-audit.json');
const markdownPath = path.join(root, 'docs/admob-release-audit.md');

loadLocalEnv();

const staticAppJson = readJson('app.json').expo;
const resolveAppConfig = require('../app.config.js');
const packageJson = readJson('package.json');
const privacyAnswers = readOptionalJson('docs/app-store-privacy-answers.json') ?? {};
const privacyManifestAudit = readOptionalJson('docs/privacy-manifest-audit.json') ?? {};
const externalReadiness = readOptionalJson('docs/external-readiness.json') ?? {};
const easEnvChecklist = readOptionalJson('docs/eas-env-checklist.json') ?? {};
const appSource = readSource('App.tsx');
const nativeAdsSource = readSource('src/ads.native.ts');
const webAdsSource = readSource('src/ads.web.ts');
const fallbackAdsSource = readSource('src/ads.ts');
const appConfigSource = readSource('app.config.js');
const envExampleSource = readSource('.env.example');
const releaseVerifySource = readSource('scripts/release-verify.js');
const privacyDoc = readSource('docs/privacy.md');
const supportDoc = readSource('docs/support.md');

const adEnvKeys = [
  'EXPO_PUBLIC_ADMOB_IOS_APP_ID',
  'EXPO_PUBLIC_ADMOB_ANDROID_APP_ID',
  'EXPO_PUBLIC_ADMOB_REWARDED_IOS_UNIT_ID',
  'EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_UNIT_ID',
];
const fakeAdEnv = {
  EXPO_PUBLIC_ADMOB_IOS_APP_ID: 'ca-app-pub-1234567890123456~1234567890',
  EXPO_PUBLIC_ADMOB_ANDROID_APP_ID: 'ca-app-pub-1234567890123456~0987654321',
  EXPO_PUBLIC_ADMOB_REWARDED_IOS_UNIT_ID: 'ca-app-pub-1234567890123456/1234567890',
  EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_UNIT_ID: 'ca-app-pub-1234567890123456/0987654321',
};
const fakePlaceholderAdEnv = {
  EXPO_PUBLIC_ADMOB_IOS_APP_ID: 'ca-app-pub-0000000000000000~0000000000',
  EXPO_PUBLIC_ADMOB_ANDROID_APP_ID: 'ca-app-pub-0000000000000000~0000000000',
  EXPO_PUBLIC_ADMOB_REWARDED_IOS_UNIT_ID: 'ca-app-pub-0000000000000000/0000000000',
  EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_UNIT_ID: 'ca-app-pub-0000000000000000/0000000000',
};
const fakeDemoAdEnv = {
  EXPO_PUBLIC_ADMOB_IOS_APP_ID: 'ca-app-pub-3940256099942544~1458002511',
  EXPO_PUBLIC_ADMOB_ANDROID_APP_ID: 'ca-app-pub-3940256099942544~3347511713',
  EXPO_PUBLIC_ADMOB_REWARDED_IOS_UNIT_ID: 'ca-app-pub-3940256099942544/1712485313',
  EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_UNIT_ID: 'ca-app-pub-3940256099942544/5224354917',
};
const clearedAdEnv = Object.fromEntries(adEnvKeys.map((key) => [key, undefined]));
const admobAppIdPattern = /^ca-app-pub-\d{16}~\d{10}$/;
const admobUnitIdPattern = /^ca-app-pub-\d{16}\/\d{10}$/;
const admobPlaceholderPattern = /^ca-app-pub-0{16}[~/]0{10}$/;
const admobDemoPublisherPattern = /^ca-app-pub-3940256099942544[~/]/;

const appConfigCurrent = resolveAppConfig({ config: clone(staticAppJson) });
const appConfigWithoutAds = withEnv(clearedAdEnv, () => resolveAppConfig({ config: clone(staticAppJson) }));
const appConfigWithAds = withEnv(fakeAdEnv, () => resolveAppConfig({ config: clone(staticAppJson) }));
const appConfigWithPlaceholderAds = withEnv(fakePlaceholderAdEnv, () => resolveAppConfig({ config: clone(staticAppJson) }));
const appConfigWithDemoAds = withEnv(fakeDemoAdEnv, () => resolveAppConfig({ config: clone(staticAppJson) }));
const pluginWithAds = findPlugin(appConfigWithAds, 'react-native-google-mobile-ads');
const pluginCurrent = findPlugin(appConfigCurrent, 'react-native-google-mobile-ads');
const envValues = Object.fromEntries(adEnvKeys.map((key) => [key, process.env[key]?.trim() ?? '']));
const envStatus = adEnvKeys.map((key) => ({
  key,
  configured: Boolean(envValues[key]),
  valid: isValidAdMobValue(key, envValues[key]),
  clientVisible: key.startsWith('EXPO_PUBLIC_'),
}));
const hasAnyAdMobEnv = envStatus.some((entry) => entry.configured);
const validAdMobIdsConfigured = envStatus.every((entry) => entry.valid);
const liveAdsReady = validAdMobIdsConfigured && Boolean(pluginCurrent) && appConfigCurrent.extra?.admob?.liveAdsEnabled === true;
const currentState = liveAdsReady ? 'LIVE_ADMOB' : hasAnyAdMobEnv ? 'INVALID_OR_PARTIAL_ADMOB_ENV' : 'NO_LIVE_ADS';

const uiEntryReady =
  appSource.includes('showRewardedContinueAd') &&
  appSource.includes('adContinue') &&
  appSource.includes('adRewarded') &&
  appSource.includes('adUnavailable') &&
  appSource.includes('shouldGrantDevelopmentReward');
const settingsPrivacyReady =
  appSource.includes('openAdPrivacyOptions') &&
  appSource.includes('isAdPrivacyOptionsRequired') &&
  appSource.includes('adPrivacyOptions') &&
  appSource.includes('adPrivacyUnavailable');
const nativeConsentReady =
  nativeAdsSource.includes("import('react-native-google-mobile-ads')") &&
  nativeAdsSource.includes('AdsConsent.requestInfoUpdate') &&
  nativeAdsSource.includes('loadAndShowConsentFormIfRequired') &&
  nativeAdsSource.includes('canRequestAds') &&
  nativeAdsSource.includes('AdsConsent.showPrivacyOptionsForm');
const nativeRewardReady =
  nativeAdsSource.includes('RewardedAd.createForAdRequest') &&
  nativeAdsSource.includes('requestNonPersonalizedAdsOnly: true') &&
  nativeAdsSource.includes('RewardedAdEventType.EARNED_REWARD') &&
  nativeAdsSource.includes('removeAllListeners') &&
  nativeAdsSource.includes('rewardedLoadTimeoutMs') &&
  nativeAdsSource.includes('rewardedShowTimeoutMs');
const nativeRuntimeGuardReady =
  nativeAdsSource.includes('isRealAdMobId') &&
  nativeAdsSource.includes('admobPlaceholderPattern') &&
  nativeAdsSource.includes('admobDemoPublisherPattern');
const requestConfigReady =
  nativeAdsSource.includes('setRequestConfiguration') &&
  nativeAdsSource.includes('MaxAdContentRating.PG') &&
  nativeAdsSource.includes('tagForChildDirectedTreatment: false') &&
  nativeAdsSource.includes('tagForUnderAgeOfConsent: false');
const webExportGuardReady =
  !webAdsSource.includes('react-native-google-mobile-ads') &&
  !fallbackAdsSource.includes('react-native-google-mobile-ads') &&
  releaseVerifySource.includes('Web export should not bundle the native Google Mobile Ads SDK');
const configGuardReady =
  !findPlugin(staticAppJson, 'react-native-google-mobile-ads') &&
  !findPlugin(appConfigWithoutAds, 'react-native-google-mobile-ads') &&
  appConfigWithoutAds.extra?.admob?.liveAdsEnabled === false &&
  !findPlugin(appConfigWithPlaceholderAds, 'react-native-google-mobile-ads') &&
  appConfigWithPlaceholderAds.extra?.admob?.liveAdsEnabled === false &&
  !findPlugin(appConfigWithDemoAds, 'react-native-google-mobile-ads') &&
  appConfigWithDemoAds.extra?.admob?.liveAdsEnabled === false &&
  Array.isArray(pluginWithAds) &&
  pluginWithAds?.[1]?.iosAppId === fakeAdEnv.EXPO_PUBLIC_ADMOB_IOS_APP_ID &&
  pluginWithAds?.[1]?.androidAppId === fakeAdEnv.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID &&
  pluginWithAds?.[1]?.delayAppMeasurementInit === true &&
  (pluginWithAds?.[1]?.skAdNetworkItems ?? []).length >= 40 &&
  appConfigWithAds.extra?.admob?.liveAdsEnabled === true &&
  appConfigSource.includes('hasValidAdMobConfig()');
const envTemplateReady =
  adEnvKeys.every((key) => envExampleSource.includes(`${key}=`)) &&
  envExampleSource.includes('ADMOB_PRIVACY_MESSAGES_CONFIGURED=0') &&
  envExampleSource.includes('App IDs use "~"; ad unit IDs use "/"');
const privacyEvidenceReady =
  privacyAnswers.summary?.confirmationEnv === 'APP_STORE_PRIVACY_ANSWERS_REVIEWED' &&
  (privacyAnswers.liveAdMobAnswers?.likelyGoogleMobileAdsDataTypes ?? []).length >= 6 &&
  privacyDoc.includes('Google Mobile Ads') &&
  supportDoc.includes('production AdMob app IDs') &&
  privacyManifestAudit.summary?.risk === 'PASS';
const externalChecklistReady =
  (externalReadiness.items ?? []).some((entry) => entry.label === 'Live AdMob IDs') &&
  (externalReadiness.items ?? []).some((entry) => entry.label === 'ADMOB_PRIVACY_MESSAGES_CONFIGURED') &&
  (easEnvChecklist.keys ?? []).filter((entry) => adEnvKeys.includes(entry.key)).length === adEnvKeys.length;

const localChecks = [
  check('ui-entry', 'Rewarded-ad continue entry exists in gameplay UI', uiEntryReady),
  check('settings-privacy', 'Settings exposes ad privacy options when UMP requires them', settingsPrivacyReady),
  check('native-consent', 'Native ad flow requests UMP consent info before ads load', nativeConsentReady),
  check('native-reward', 'Native rewarded ad lifecycle grants reward only after earned reward event', nativeRewardReady),
  check('native-id-guard', 'Native runtime rejects placeholder and Google demo AdMob IDs', nativeRuntimeGuardReady),
  check('request-config', 'Native ad request config limits ad content and uses non-personalized ad requests', requestConfigReady),
  check('web-guard', 'Web export is guarded from the native Google Mobile Ads SDK', webExportGuardReady),
  check('config-guard', 'Expo config injects Google Mobile Ads only when all production IDs are valid', configGuardReady),
  check('env-template', '.env.example documents every AdMob and privacy confirmation key', envTemplateReady),
  check('privacy-evidence', 'Privacy answer pack and policy document no-live/live-AdMob states', privacyEvidenceReady),
  check('external-checklists', 'External readiness and EAS env checklists include AdMob release actions', externalChecklistReady),
];
const localFailures = localChecks.filter((entry) => !entry.passed).map((entry) => entry.label);
const externalActions = [
  externalAction(
    'Live AdMob IDs',
    liveAdsReady,
    liveAdsReady
      ? 'All four production AdMob IDs are valid and the native plugin is enabled.'
      : 'Create production AdMob app IDs and rewarded ad-unit IDs, then set all four EXPO_PUBLIC_ADMOB_* values.',
  ),
  externalAction(
    'ADMOB_PRIVACY_MESSAGES_CONFIGURED',
    process.env.ADMOB_PRIVACY_MESSAGES_CONFIGURED === '1',
    process.env.ADMOB_PRIVACY_MESSAGES_CONFIGURED === '1'
      ? 'Manual AdMob Privacy & messaging confirmation is set.'
      : 'Configure AdMob Privacy & messaging for release regions and verify UMP canRequestAds in a production build before setting this to 1.',
  ),
];

const audit = {
  schemaVersion: 1,
  source: 'scripts/generate-admob-release-audit.js',
  generatedFrom: {
    appConfig: 'app.json + app.config.js',
    appSource: 'App.tsx',
    adsNative: 'src/ads.native.ts',
    adsWeb: 'src/ads.web.ts',
    adsFallback: 'src/ads.ts',
    envTemplate: '.env.example',
    privacyAnswers: 'docs/app-store-privacy-answers.json',
    privacyManifestAudit: 'docs/privacy-manifest-audit.json',
    externalReadiness: 'docs/external-readiness.json',
    easEnvironmentChecklist: 'docs/eas-env-checklist.json',
  },
  officialReferences: [
    {
      label: 'Expo SDK 56 reference',
      url: 'https://docs.expo.dev/versions/v56.0.0/',
    },
    {
      label: 'React Native Google Mobile Ads',
      url: 'https://docs.page/invertase/react-native-google-mobile-ads',
    },
    {
      label: 'Google Mobile Ads iOS privacy disclosure',
      url: 'https://developers.google.com/admob/ios/privacy/data-disclosure',
    },
    {
      label: 'Google Mobile Ads iOS test ads',
      url: 'https://developers.google.com/admob/ios/test-ads',
    },
    {
      label: 'Google Mobile Ads Android test ads',
      url: 'https://developers.google.com/admob/android/test-ads',
    },
    {
      label: 'Apple App Privacy Details',
      url: 'https://developer.apple.com/app-store/app-privacy-details/',
    },
  ],
  summary: {
    risk: localFailures.length === 0 ? 'PASS' : 'REVIEW',
    localReady: localFailures.length === 0,
    currentState,
    liveAdsReady,
    validAdMobIdsConfigured,
    googleMobileAdsPluginInjected: Boolean(pluginCurrent),
    externalPrivacyMessagingReady: process.env.ADMOB_PRIVACY_MESSAGES_CONFIGURED === '1',
    externalReady: externalActions.every((entry) => entry.ready),
    localFailures: localFailures.length,
    externalBlockingItems: externalActions.filter((entry) => !entry.ready).length,
  },
  app: {
    name: appConfigCurrent.name,
    version: appConfigCurrent.version,
    bundleIdentifier: appConfigCurrent.ios?.bundleIdentifier,
    packageName: appConfigCurrent.android?.package,
    googleMobileAdsPackage: packageJson.dependencies?.['react-native-google-mobile-ads'] ?? null,
  },
  environment: {
    keys: envStatus,
    state: currentState,
    allProductionIdsValid: validAdMobIdsConfigured,
    hasAnyAdMobValue: hasAnyAdMobEnv,
  },
  nativeConfig: {
    pluginAbsentWithoutIds: !findPlugin(appConfigWithoutAds, 'react-native-google-mobile-ads'),
    pluginInjectedWithValidIds: Array.isArray(pluginWithAds),
    pluginAbsentWithPlaceholderIds: !findPlugin(appConfigWithPlaceholderAds, 'react-native-google-mobile-ads'),
    pluginAbsentWithDemoIds: !findPlugin(appConfigWithDemoAds, 'react-native-google-mobile-ads'),
    currentPluginInjected: Boolean(pluginCurrent),
    delayAppMeasurementInit: Boolean(pluginWithAds?.[1]?.delayAppMeasurementInit),
    skAdNetworkItems: pluginWithAds?.[1]?.skAdNetworkItems?.length ?? 0,
    liveAdsEnabledWithoutIds: Boolean(appConfigWithoutAds.extra?.admob?.liveAdsEnabled),
    liveAdsEnabledWithPlaceholderIds: Boolean(appConfigWithPlaceholderAds.extra?.admob?.liveAdsEnabled),
    liveAdsEnabledWithDemoIds: Boolean(appConfigWithDemoAds.extra?.admob?.liveAdsEnabled),
    liveAdsEnabledWithValidIds: Boolean(appConfigWithAds.extra?.admob?.liveAdsEnabled),
    liveAdsEnabledCurrent: Boolean(appConfigCurrent.extra?.admob?.liveAdsEnabled),
  },
  runtimeFlow: {
    uiEntryReady,
    settingsPrivacyReady,
    nativeConsentReady,
    nativeRewardReady,
    nativeRuntimeGuardReady,
    requestConfigReady,
    webExportGuardReady,
    developmentRewardGuarded: nativeAdsSource.includes('process.env.NODE_ENV') && appSource.includes('shouldGrantDevelopmentReward'),
  },
  privacy: {
    appStorePrivacyAnswerState: privacyAnswers.summary?.currentState ?? 'UNKNOWN',
    privacyConfirmationEnv: privacyAnswers.summary?.confirmationEnv ?? 'UNKNOWN',
    liveAdMobDisclosureRows: privacyAnswers.liveAdMobAnswers?.likelyGoogleMobileAdsDataTypes?.length ?? 0,
    privacyManifestRisk: privacyManifestAudit.summary?.risk ?? 'UNKNOWN',
    appCodeCollectsPersonalData: Boolean(privacyAnswers.summary?.appCodeCollectsPersonalData),
    externalPrivacyMessagingReady: process.env.ADMOB_PRIVACY_MESSAGES_CONFIGURED === '1',
  },
  localChecks,
  externalActions,
  commands: [
    'npm run ads:audit',
    'npm run privacy:answers',
    'npm run eas:env-checklist',
    'npm run release:verify',
    'npm run release:store-ready',
  ],
};

fs.writeFileSync(jsonPath, `${JSON.stringify(audit, null, 2)}\n`);
fs.writeFileSync(markdownPath, renderMarkdown(audit));

if (audit.summary.risk !== 'PASS') {
  console.error(`AdMob release audit requires review: ${localFailures.length} local issue(s)`);
  for (const failure of localFailures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`generated ${path.relative(root, markdownPath)} and ${path.relative(root, jsonPath)}`);

function check(id, label, passed) {
  return { id, label, passed: Boolean(passed) };
}

function externalAction(label, ready, action) {
  return { label, ready: Boolean(ready), action };
}

function findPlugin(config, pluginName) {
  return (config?.plugins ?? []).find((plugin) => (Array.isArray(plugin) ? plugin[0] : plugin) === pluginName);
}

function isValidAdMobValue(key, value) {
  const pattern = key.includes('APP_ID') ? admobAppIdPattern : admobUnitIdPattern;
  return pattern.test(value ?? '') && !admobPlaceholderPattern.test(value ?? '') && !admobDemoPublisherPattern.test(value ?? '');
}

function withEnv(overrides, callback) {
  const previous = {};

  for (const [key, value] of Object.entries(overrides)) {
    previous[key] = process.env[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return callback();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

function renderMarkdown(values) {
  const localRows = values.localChecks
    .map((entry) => `| ${entry.id} | ${entry.passed ? 'Yes' : 'No'} | ${escapeCell(entry.label)} |`)
    .join('\n');
  const envRows = values.environment.keys
    .map((entry) => `| \`${entry.key}\` | ${entry.configured ? 'Yes' : 'No'} | ${entry.valid ? 'Yes' : 'No'} | ${entry.clientVisible ? 'Yes' : 'No'} |`)
    .join('\n');
  const actions = values.externalActions
    .map((entry) => `- [${entry.ready ? 'OK' : 'TODO'}] ${entry.label}: ${entry.action}`)
    .join('\n');
  const commands = values.commands.map((command) => `- \`${command}\``).join('\n');
  const references = values.officialReferences.map((entry) => `- ${entry.label}: ${entry.url}`).join('\n');

  return `# AdMob Release Audit

This audit checks the rewarded-ad release path without marking external AdMob account work as complete.

## Summary

- Risk: ${values.summary.risk}
- Local ad integration ready: ${values.summary.localReady ? 'Yes' : 'No'}
- Current state: ${values.summary.currentState}
- Live AdMob ready: ${values.summary.liveAdsReady ? 'Yes' : 'No'}
- Google Mobile Ads plugin injected in current config: ${values.summary.googleMobileAdsPluginInjected ? 'Yes' : 'No'}
- External privacy messaging ready: ${values.summary.externalPrivacyMessagingReady ? 'Yes' : 'No'}
- External blocking items: ${values.summary.externalBlockingItems}
- Local failures: ${values.summary.localFailures}

## Environment

| Key | Configured | Valid production format | Client visible |
| --- | --- | --- | --- |
${envRows}

## Native Config

- Plugin absent without IDs: ${values.nativeConfig.pluginAbsentWithoutIds ? 'Yes' : 'No'}
- Plugin injected with valid IDs: ${values.nativeConfig.pluginInjectedWithValidIds ? 'Yes' : 'No'}
- Plugin absent with placeholder IDs: ${values.nativeConfig.pluginAbsentWithPlaceholderIds ? 'Yes' : 'No'}
- Plugin absent with Google demo IDs: ${values.nativeConfig.pluginAbsentWithDemoIds ? 'Yes' : 'No'}
- Current plugin injected: ${values.nativeConfig.currentPluginInjected ? 'Yes' : 'No'}
- Delay app measurement init: ${values.nativeConfig.delayAppMeasurementInit ? 'Yes' : 'No'}
- SKAdNetwork items: ${values.nativeConfig.skAdNetworkItems}
- Live ads enabled without IDs: ${values.nativeConfig.liveAdsEnabledWithoutIds ? 'Yes' : 'No'}
- Live ads enabled with placeholder IDs: ${values.nativeConfig.liveAdsEnabledWithPlaceholderIds ? 'Yes' : 'No'}
- Live ads enabled with Google demo IDs: ${values.nativeConfig.liveAdsEnabledWithDemoIds ? 'Yes' : 'No'}
- Live ads enabled with valid IDs: ${values.nativeConfig.liveAdsEnabledWithValidIds ? 'Yes' : 'No'}
- Live ads enabled in current config: ${values.nativeConfig.liveAdsEnabledCurrent ? 'Yes' : 'No'}

## Runtime Flow

| Check | Passed | Evidence |
| --- | --- | --- |
${localRows}

## Privacy Evidence

- App Store privacy answer state: ${values.privacy.appStorePrivacyAnswerState}
- Privacy confirmation env: \`${values.privacy.privacyConfirmationEnv}\`
- Live-AdMob disclosure rows: ${values.privacy.liveAdMobDisclosureRows}
- Privacy manifest risk: ${values.privacy.privacyManifestRisk}
- App-code personal data collection: ${values.privacy.appCodeCollectsPersonalData ? 'Yes' : 'No'}
- AdMob Privacy & messaging confirmed: ${values.privacy.externalPrivacyMessagingReady ? 'Yes' : 'No'}

## External Actions

${actions}

## Commands

${commands}

## Official References

${references}
`;
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function readOptionalJson(relativePath) {
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) return null;

  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readSource(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function escapeCell(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}
