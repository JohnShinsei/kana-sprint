const fs = require('fs');
const path = require('path');
const { loadLocalEnv } = require('./load-env');

const root = path.resolve(__dirname, '..');
const jsonPath = path.join(root, 'docs/privacy-manifest-audit.json');
const markdownPath = path.join(root, 'docs/privacy-manifest-audit.md');

loadLocalEnv();

const staticAppJson = require('../app.json').expo;
const packageJson = require('../package.json');
const appConfigFactory = require('../app.config.js');
const appConfig = appConfigFactory({ config: clone(staticAppJson) });
const privacyAnswersDoc = readText('docs/app-store-privacy-answers.md');
const privacyDoc = readText('docs/privacy.md');
const adsNativeSource = readText('src/ads.native.ts');

const privacyManifest = staticAppJson.ios?.privacyManifests ?? {};
const infoPlist = staticAppJson.ios?.infoPlist ?? {};
const android = staticAppJson.android ?? {};
const plugins = staticAppJson.plugins ?? [];
const audioPlugin = plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-audio')?.[1] ?? {};
const accessedApiTypes = privacyManifest.NSPrivacyAccessedAPITypes ?? [];
const expectedReasonApis = [
  {
    category: 'NSPrivacyAccessedAPICategoryUserDefaults',
    reasons: ['CA92.1'],
    reason: 'App-specific progress, scores, language, music, and settings are stored locally.',
  },
  {
    category: 'NSPrivacyAccessedAPICategoryFileTimestamp',
    reasons: ['C617.1'],
    reason: 'React Native and Expo dependencies may inspect bundled asset file timestamps.',
  },
];
const reasonApiRows = expectedReasonApis.map((expected) => {
  const actual = accessedApiTypes.find((entry) => entry.NSPrivacyAccessedAPIType === expected.category);
  const actualReasons = actual?.NSPrivacyAccessedAPITypeReasons ?? [];

  return {
    ...expected,
    present: Boolean(actual),
    actualReasons,
    ready: Boolean(actual) && expected.reasons.every((reason) => actualReasons.includes(reason)),
  };
});
const blockedPermissions = android.blockedPermissions ?? [];
const adMobLiveAdsEnabled = Boolean(appConfig.extra?.admob?.liveAdsEnabled);
const adMobPluginConfigured = Boolean(findPlugin(appConfig, 'react-native-google-mobile-ads'));
const audit = {
  schemaVersion: 1,
  source: 'scripts/generate-privacy-manifest-audit.js',
  generatedFrom: {
    appConfig: 'app.json',
    dynamicExpoConfig: 'app.config.js',
    privacyAnswers: 'docs/app-store-privacy-answers.md',
    privacyPolicy: 'docs/privacy.md',
    adsNative: 'src/ads.native.ts',
  },
  officialReferences: [
    {
      label: 'Apple Privacy Manifest Files',
      url: 'https://developer.apple.com/documentation/bundleresources/privacy-manifest-files',
    },
    {
      label: 'Apple Describing Data Use In Privacy Manifests',
      url: 'https://developer.apple.com/documentation/bundleresources/describing-data-use-in-privacy-manifests',
    },
    {
      label: 'Apple Describing Use Of Required Reason API',
      url: 'https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api',
    },
    {
      label: 'Apple App Privacy Details',
      url: 'https://developer.apple.com/app-store/app-privacy-details/',
    },
  ],
  app: {
    name: staticAppJson.name,
    version: staticAppJson.version,
    bundleIdentifier: staticAppJson.ios?.bundleIdentifier,
    packageName: staticAppJson.android?.package,
  },
  iosPrivacyManifest: {
    tracking: privacyManifest.NSPrivacyTracking,
    trackingDomains: privacyManifest.NSPrivacyTrackingDomains ?? [],
    collectedDataTypes: privacyManifest.NSPrivacyCollectedDataTypes ?? [],
    accessedApiTypes: reasonApiRows,
    rawAccessedApiTypeCount: accessedApiTypes.length,
  },
  platformPosture: {
    usesNonExemptEncryption: infoPlist.ITSAppUsesNonExemptEncryption,
    microphonePermission: audioPlugin.microphonePermission,
    audioBackgroundPlayback: audioPlugin.enableBackgroundPlayback,
    audioBackgroundRecording: audioPlugin.enableBackgroundRecording,
    recordAudioAndroid: audioPlugin.recordAudioAndroid,
    androidBlockedPermissions: blockedPermissions,
  },
  adMobPosture: {
    dependencyPresent: Boolean(packageJson.dependencies?.['react-native-google-mobile-ads']),
    liveAdsEnabled: adMobLiveAdsEnabled,
    nativePluginConfigured: adMobPluginConfigured,
    umpConsentFlowPresent:
      adsNativeSource.includes('AdsConsent.requestInfoUpdate') &&
      adsNativeSource.includes('loadAndShowConsentFormIfRequired') &&
      adsNativeSource.includes('canRequestAds'),
    nonPersonalizedDefault: adsNativeSource.includes('requestNonPersonalizedAdsOnly: true'),
    finalPrivacyAnswersEnv: 'APP_STORE_PRIVACY_ANSWERS_REVIEWED',
  },
  documents: {
    privacyAnswersMentionsApple: privacyAnswersDoc.includes('Apple App Privacy Details'),
    privacyAnswersMentionsGoogleMobileAds: privacyAnswersDoc.includes('Google Mobile Ads'),
    privacyPolicyMentionsNoAccount:
      /no account/i.test(privacyDoc) ||
      /account login/i.test(privacyDoc) ||
      /does not use[^.]*account/i.test(privacyDoc),
    privacyPolicyMentionsLocalData: privacyDoc.includes('Local') || privacyDoc.includes('local'),
  },
};
audit.summary = {
  risk: privacyRisk(audit),
  tracking: audit.iosPrivacyManifest.tracking === true,
  trackingDomains: audit.iosPrivacyManifest.trackingDomains.length,
  collectedDataTypes: audit.iosPrivacyManifest.collectedDataTypes.length,
  accessedApiTypes: audit.iosPrivacyManifest.rawAccessedApiTypeCount,
  requiredReasonApisReady: reasonApiRows.every((entry) => entry.ready),
  nonExemptEncryption: audit.platformPosture.usesNonExemptEncryption !== false,
  androidBlockedPermissionCount: blockedPermissions.length,
  microphoneDisabled:
    audioPlugin.microphonePermission === false &&
    audioPlugin.recordAudioAndroid === false &&
    audioPlugin.enableBackgroundRecording === false,
  liveAdsEnabled: adMobLiveAdsEnabled,
  adMobPrivacyReviewRequired: adMobLiveAdsEnabled,
};

fs.writeFileSync(jsonPath, `${JSON.stringify(audit, null, 2)}\n`);
fs.writeFileSync(markdownPath, renderMarkdown(audit));

if (audit.summary.risk !== 'PASS') {
  console.error(`privacy manifest audit requires review: ${audit.summary.risk}`);
  process.exit(1);
}

console.log(`generated ${path.relative(root, markdownPath)} and ${path.relative(root, jsonPath)}`);

function privacyRisk(values) {
  const manifestReady =
    values.iosPrivacyManifest.tracking === false &&
    values.iosPrivacyManifest.trackingDomains.length === 0 &&
    values.iosPrivacyManifest.collectedDataTypes.length === 0 &&
    values.iosPrivacyManifest.accessedApiTypes.every((entry) => entry.ready);
  const platformReady =
    values.platformPosture.usesNonExemptEncryption === false &&
    values.platformPosture.microphonePermission === false &&
    values.platformPosture.recordAudioAndroid === false &&
    values.platformPosture.audioBackgroundRecording === false &&
    values.platformPosture.androidBlockedPermissions.includes('android.permission.RECORD_AUDIO');
  const docsReady =
    values.documents.privacyAnswersMentionsApple &&
    values.documents.privacyAnswersMentionsGoogleMobileAds &&
    values.documents.privacyPolicyMentionsNoAccount &&
    values.documents.privacyPolicyMentionsLocalData;
  const adsReady =
    values.adMobPosture.umpConsentFlowPresent &&
    values.adMobPosture.nonPersonalizedDefault &&
    (!values.adMobPosture.liveAdsEnabled || values.adMobPosture.nativePluginConfigured);

  return manifestReady && platformReady && docsReady && adsReady ? 'PASS' : 'REVIEW';
}

function renderMarkdown(values) {
  const reasonRows = values.iosPrivacyManifest.accessedApiTypes
    .map((entry) => `| ${entry.category} | ${entry.actualReasons.join(', ')} | ${entry.ready ? 'Ready' : 'Review'} | ${entry.reason} |`)
    .join('\n');
  const blockedRows = values.platformPosture.androidBlockedPermissions
    .map((permission) => `- \`${permission}\``)
    .join('\n');
  const references = values.officialReferences
    .map((entry) => `- ${entry.label}: ${entry.url}`)
    .join('\n');

  return `# Privacy Manifest Audit

## Summary

- Risk: ${values.summary.risk}
- iOS tracking: ${values.summary.tracking ? 'Yes' : 'No'}
- Tracking domains: ${values.summary.trackingDomains}
- Collected data types: ${values.summary.collectedDataTypes}
- Required reason API categories: ${values.summary.accessedApiTypes}
- Required reason APIs ready: ${values.summary.requiredReasonApisReady ? 'Yes' : 'No'}
- Non-exempt encryption: ${values.summary.nonExemptEncryption ? 'Yes' : 'No'}
- Android blocked permissions: ${values.summary.androidBlockedPermissionCount}
- Microphone disabled: ${values.summary.microphoneDisabled ? 'Yes' : 'No'}
- Live AdMob enabled in resolved Expo config: ${values.summary.liveAdsEnabled ? 'Yes' : 'No'}

## iOS Privacy Manifest

| Required reason API | Declared reasons | Status | Why it is declared |
| --- | --- | --- | --- |
${reasonRows}

## Platform Posture

- \`ITSAppUsesNonExemptEncryption=false\`: ${values.platformPosture.usesNonExemptEncryption === false ? 'Yes' : 'No'}
- \`expo-audio\` microphone permission disabled: ${values.platformPosture.microphonePermission === false ? 'Yes' : 'No'}
- Android blocked permissions:
${blockedRows}

## AdMob Privacy Posture

- Google Mobile Ads dependency present: ${values.adMobPosture.dependencyPresent ? 'Yes' : 'No'}
- Live ads enabled: ${values.adMobPosture.liveAdsEnabled ? 'Yes' : 'No'}
- Native AdMob plugin configured: ${values.adMobPosture.nativePluginConfigured ? 'Yes' : 'No'}
- UMP consent flow present: ${values.adMobPosture.umpConsentFlowPresent ? 'Yes' : 'No'}
- Rewarded ad requests default to non-personalized: ${values.adMobPosture.nonPersonalizedDefault ? 'Yes' : 'No'}
- Final App Store privacy answer confirmation: \`${values.adMobPosture.finalPrivacyAnswersEnv}=1\`

## Documents

- Privacy answers mention Apple App Privacy Details: ${values.documents.privacyAnswersMentionsApple ? 'Yes' : 'No'}
- Privacy answers mention Google Mobile Ads: ${values.documents.privacyAnswersMentionsGoogleMobileAds ? 'Yes' : 'No'}
- Privacy policy mentions no account: ${values.documents.privacyPolicyMentionsNoAccount ? 'Yes' : 'No'}
- Privacy policy mentions local data: ${values.documents.privacyPolicyMentionsLocalData ? 'Yes' : 'No'}

## Official References

${references}

This audit is a static release check and not legal advice. Re-run \`npm run privacy:manifest\` and \`npm run release:verify\` after changing native dependencies, AdMob settings, privacy policy text, or App Store privacy answers.
`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function findPlugin(config, pluginName) {
  return (config.plugins ?? []).find((plugin) => (Array.isArray(plugin) ? plugin[0] : plugin) === pluginName);
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}
