const fs = require('fs');
const path = require('path');
const { loadLocalEnv } = require('./load-env');

const root = path.resolve(__dirname, '..');
const jsonPath = path.join(root, 'docs/app-store-privacy-answers.json');
const markdownPath = path.join(root, 'docs/app-store-privacy-answers.md');

loadLocalEnv();

const staticAppJson = require('../app.json').expo;
const resolveAppConfig = require('../app.config.js');
const packageJson = require('../package.json');
const privacyManifestAudit = readJson('docs/privacy-manifest-audit.json') ?? {};
const contentRightsAudit = readJson('docs/content-rights-audit.json') ?? {};

const appConfig = resolveAppConfig({ config: clone(staticAppJson) });
const liveAdsEnabled = Boolean(appConfig.extra?.admob?.liveAdsEnabled);
const currentState = liveAdsEnabled ? 'LIVE_ADMOB' : 'NO_LIVE_ADS';
const confirmationEnv = 'APP_STORE_PRIVACY_ANSWERS_REVIEWED';

const answers = {
  schemaVersion: 1,
  source: 'scripts/generate-app-store-privacy-answers.js',
  generatedFrom: {
    appConfig: 'app.json + app.config.js',
    privacyManifestAudit: 'docs/privacy-manifest-audit.json',
    contentRightsAudit: 'docs/content-rights-audit.json',
    packageJson: 'package.json',
    officialApplePrivacy: 'https://developer.apple.com/app-store/app-privacy-details/',
    officialGoogleAdMobDisclosure: 'https://developers.google.com/admob/ios/privacy/data-disclosure',
  },
  app: {
    name: appConfig.name,
    version: appConfig.version,
    bundleIdentifier: appConfig.ios?.bundleIdentifier,
    packageName: appConfig.android?.package,
    expo: packageJson.dependencies?.expo,
    googleMobileAdsPackage: packageJson.dependencies?.['react-native-google-mobile-ads'] ?? null,
  },
  currentBuild: {
    state: currentState,
    liveAdsEnabled,
    googleMobileAdsPluginInjected: hasPlugin(appConfig, 'react-native-google-mobile-ads'),
    privacyManifestRisk: privacyManifestAudit.summary?.risk ?? 'UNKNOWN',
    privacyManifestTracking: Boolean(privacyManifestAudit.summary?.tracking),
    privacyManifestCollectedDataTypes: privacyManifestAudit.summary?.collectedDataTypes ?? 0,
    originalAnimeStyleLinePrompts: contentRightsAudit.summary?.originalAnimeStyleLinePrompts ?? 0,
  },
  summary: {
    risk: privacyManifestAudit.summary?.risk === 'PASS' ? 'PASS' : 'REVIEW',
    currentState,
    noLiveAdsReady: !liveAdsEnabled,
    liveAdMobRequiresManualReview: liveAdsEnabled,
    confirmationEnv,
    appCodeCollectsPersonalData: false,
    accountRequired: false,
    trackingDeclaredByAppCode: false,
    finalAppStoreConnectReviewRequired: true,
  },
  appCodePractices: [
    practice('Account creation', 'No', 'Kana Sprint has no sign-in, account creation, server sync, or user profile feature.'),
    practice('Gameplay progress', 'Local only', 'Scores, mastery, daily goal progress, settings, selected language, music, and difficulty are stored on device.'),
    practice('User content', 'No', 'The app has no free-text submission, upload, chat, or user-generated content surface.'),
    practice('Analytics', 'No', 'No analytics SDK or custom analytics endpoint is integrated.'),
    practice('Sensitive device APIs', 'No', 'No camera, contacts, location, microphone recording, or push notification feature is present.'),
    practice('Ads entry', liveAdsEnabled ? 'Live AdMob enabled' : 'Entry wired, live ads disabled', liveAdsEnabled
      ? 'Rewarded ads can run through Google Mobile Ads after UMP consent preparation.'
      : 'The rewarded-ad gameplay entry is present, but live ads remain disabled until valid production AdMob IDs are provided.'),
  ],
  noLiveAdsAnswers: {
    useWhen: 'Use when extra.admob.liveAdsEnabled is false in npx expo config --json.',
    appStoreConnect: [
      answer('Data collected by this app', 'No', 'The app code stores progress, daily goal progress, and settings locally and does not transmit user data off device.'),
      answer('Tracking', 'No', 'No tracking SDK is initialized in this build state.'),
      answer('Account creation', 'No', 'No account, login, or demo account is required.'),
      answer('Analytics', 'No', 'No analytics SDK or analytics endpoint is present.'),
      answer('Location', 'No', 'No location permission or location API is used by app code.'),
      answer('Contacts', 'No', 'No contacts permission or contacts API is used.'),
      answer('User content', 'No', 'No user upload, chat, or free-form content submission exists.'),
      answer('Purchases', 'No', 'No in-app purchases or subscriptions exist.'),
      answer('Camera', 'No', 'No camera permission or camera API is used.'),
      answer('Microphone', 'No', 'The audio plugin is configured without microphone recording.'),
      answer('Push notifications', 'No', 'No push notification SDK or permission path exists.'),
    ],
    reviewerExplanation:
      'Kana Sprint stores progress, daily goal progress, and settings locally on the device. The app has no account system, no analytics SDK, no server sync, no user-generated content, and no live ad SDK initialization in this build.',
  },
  liveAdMobAnswers: {
    useWhen: 'Use when all four production AdMob IDs are valid and extra.admob.liveAdsEnabled is true.',
    appCodeStillLocalOnly: true,
    requiredBeforeSubmission: [
      'Confirm react-native-google-mobile-ads is present in the resolved Expo plugins for the production archive.',
      'Open the final iOS privacy report for the archived build and compare Google Mobile Ads SDK declarations.',
      'Review the current Google Mobile Ads SDK data disclosure page for the SDK version in the submitted build.',
      'Configure AdMob Privacy & messaging for the release regions and verify UMP canRequestAds on device.',
      'Decide the App Tracking Transparency and IDFA answer based on final ad configuration, mediation, and regional consent behavior.',
      `Set ${confirmationEnv}=1 only after App Store Connect privacy answers match the exact submitted build.`,
    ],
    likelyGoogleMobileAdsDataTypes: [
      disclosure('Coarse Location', 'IP address may be used to estimate general device location.', ['Third-Party Advertising', 'Analytics', 'App Functionality']),
      disclosure('Crash Data', 'Non-user related crash logs may be used to diagnose problems and improve the SDK.', ['App Functionality', 'Analytics']),
      disclosure('Performance Data', 'Performance data such as launch time, hang rate, or energy use may be collected.', ['App Functionality', 'Analytics', 'Third-Party Advertising']),
      disclosure('Device ID', 'Advertising identifier or other device-level IDs may be used by the ad SDK.', ['Third-Party Advertising', 'Analytics']),
      disclosure('Advertising Data', 'Information about advertisements the user has seen may be used for ads and analytics features.', ['Third-Party Advertising', 'Analytics']),
      disclosure('Product Interaction', 'Ad views, app launches, taps, and video views may be used to improve advertising performance.', ['Third-Party Advertising', 'Analytics']),
    ],
    reviewerNoteAddition:
      'Rewarded ads are available only through the continue-run entry point. Ad requests are configured for non-personalized ads by default. The app itself has no account, analytics, location, contacts, camera, microphone, or user-generated content features, and gameplay progress remains on device. When UMP says privacy options are required, Settings includes an Ad privacy entry that opens the privacy options form.',
  },
  officialReferences: [
    {
      title: 'Apple App Privacy Details',
      url: 'https://developer.apple.com/app-store/app-privacy-details/',
      reason: 'Apple requires privacy answers to include the app and integrated third-party partners.',
    },
    {
      title: 'Apple Manage App Privacy',
      url: 'https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/',
      reason: 'Privacy Policy URL and App Privacy details are maintained in App Store Connect.',
    },
    {
      title: 'Google Mobile Ads iOS Data Disclosure',
      url: 'https://developers.google.com/admob/ios/privacy/data-disclosure',
      reason: 'Google lists Mobile Ads SDK data types that may need App Store disclosure.',
    },
    {
      title: 'Google Mobile Ads iOS Privacy Strategies',
      url: 'https://developers.google.com/admob/ios/privacy/strategies',
      reason: 'AdMob privacy and consent behavior must match the production ad setup.',
    },
  ],
  localVerification: [
    'npm run privacy:manifest',
    'npm run privacy:answers',
    'npm run release:verify',
    'npm run release:store-ready',
  ],
};

fs.writeFileSync(jsonPath, `${JSON.stringify(answers, null, 2)}\n`);
fs.writeFileSync(markdownPath, renderMarkdown(answers));
console.log(`generated ${path.relative(root, markdownPath)} and ${path.relative(root, jsonPath)}`);

function practice(label, value, rationale) {
  return { label, value, rationale };
}

function answer(field, suggestedAnswer, rationale) {
  return { field, suggestedAnswer, rationale };
}

function disclosure(appleDataType, basis, purposes) {
  return {
    appleDataType,
    basis,
    purposes,
    linkedToUser: 'Review final Google Mobile Ads SDK privacy report and App Store Connect wording.',
    tracking: 'Review final ATT, mediation, and ad personalization configuration.',
  };
}

function renderMarkdown(values) {
  const practices = values.appCodePractices
    .map((entry) => `| ${escapeCell(entry.label)} | ${escapeCell(entry.value)} | ${escapeCell(entry.rationale)} |`)
    .join('\n');
  const noLiveAdsRows = values.noLiveAdsAnswers.appStoreConnect
    .map((entry) => `| ${escapeCell(entry.field)} | ${escapeCell(entry.suggestedAnswer)} | ${escapeCell(entry.rationale)} |`)
    .join('\n');
  const liveAdMobRows = values.liveAdMobAnswers.likelyGoogleMobileAdsDataTypes
    .map((entry) => `| ${escapeCell(entry.appleDataType)} | ${escapeCell(entry.basis)} | ${escapeCell(entry.purposes.join(', '))} | ${escapeCell(entry.linkedToUser)} | ${escapeCell(entry.tracking)} |`)
    .join('\n');
  const required = values.liveAdMobAnswers.requiredBeforeSubmission.map((item) => `- ${item}`).join('\n');
  const refs = values.officialReferences
    .map((entry) => `- ${entry.title}: ${entry.url}\n  Reason: ${entry.reason}`)
    .join('\n');
  const verify = values.localVerification.map((command) => `- \`${command}\``).join('\n');

  return `# App Store Privacy Answers

Use this file as a submission checklist, not as legal advice. Final App Store Connect answers must match the exact submitted build and any third-party SDKs included in that build.

## Current Build State

- State: ${values.currentBuild.state}
- Live AdMob enabled: ${values.currentBuild.liveAdsEnabled ? 'Yes' : 'No'}
- Google Mobile Ads plugin injected: ${values.currentBuild.googleMobileAdsPluginInjected ? 'Yes' : 'No'}
- Privacy manifest risk: ${values.currentBuild.privacyManifestRisk}
- Privacy manifest tracking: ${values.currentBuild.privacyManifestTracking ? 'Yes' : 'No'}
- Privacy manifest collected data types: ${values.currentBuild.privacyManifestCollectedDataTypes}
- Final confirmation env: \`${values.summary.confirmationEnv}\`

## App Code Practices

| Area | Current answer | Rationale |
| --- | --- | --- |
${practices}

## No Live AdMob IDs

Use this state only when the four \`EXPO_PUBLIC_ADMOB_*\` variables are empty or invalid and \`npx expo config --json\` reports \`extra.admob.liveAdsEnabled\` as \`false\`.

| App Store Connect field | Suggested answer | Rationale |
| --- | --- | --- |
${noLiveAdsRows}

Reviewer-facing explanation:

${values.noLiveAdsAnswers.reviewerExplanation}

## Live AdMob IDs Enabled

Use this state when all four AdMob environment variables are valid and \`npx expo config --json\` reports \`extra.admob.liveAdsEnabled\` as \`true\`.

Kana Sprint's own gameplay data remains local-only in this state: progress, settings, high scores, daily streaks, daily goal progress, selected difficulty, and learned counts stay on device. The data disclosures change because the Google Mobile Ads SDK is integrated for optional rewarded ads.

Before submission:

${required}

Likely Google Mobile Ads disclosure rows to review:

| Apple data type | Basis | Likely purposes | Linked to user | Tracking |
| --- | --- | --- | --- | --- |
${liveAdMobRows}

Suggested reviewer note addition:

${values.liveAdMobAnswers.reviewerNoteAddition}

## Official References

${refs}

## Local Verification

${verify}
`;
}

function escapeCell(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function hasPlugin(config, pluginName) {
  return (config.plugins ?? []).some((plugin) => (Array.isArray(plugin) ? plugin[0] : plugin) === pluginName);
}

function readJson(relativePath) {
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) return null;

  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
