const fs = require('fs');
const path = require('path');
const { loadLocalEnv } = require('./load-env');

const root = path.resolve(__dirname, '..');
const jsonPath = path.join(root, 'docs/admob-setup-handoff.json');
const markdownPath = path.join(root, 'docs/admob-setup-handoff.md');

loadLocalEnv();

const appJson = require('../app.json').expo;
const packageJson = readJson('package.json');
const admobReleaseAudit = readJson('docs/admob-release-audit.json');
const privacyAnswers = readJson('docs/app-store-privacy-answers.json');
const privacyReviewPacket = readJson('docs/privacy-review-packet.json');
const productionSmokeTest = readJson('docs/production-device-smoke-test.json');
const releaseStatus = readReleaseStatus();

const admobAppIdPattern = /^ca-app-pub-\d{16}~\d{10}$/;
const admobUnitIdPattern = /^ca-app-pub-\d{16}\/\d{10}$/;
const admobPlaceholderPattern = /^ca-app-pub-0{16}[~/]0{10}$/;
const admobDemoPublisherPattern = /^ca-app-pub-3940256099942544[~/]/;
const adEnvKeys = [
  ['EXPO_PUBLIC_ADMOB_IOS_APP_ID', 'iOS AdMob app ID', 'ca-app-pub-0000000000000000~0000000000', admobAppIdPattern],
  ['EXPO_PUBLIC_ADMOB_ANDROID_APP_ID', 'Android AdMob app ID', 'ca-app-pub-0000000000000000~0000000000', admobAppIdPattern],
  ['EXPO_PUBLIC_ADMOB_REWARDED_IOS_UNIT_ID', 'iOS rewarded ad-unit ID', 'ca-app-pub-0000000000000000/0000000000', admobUnitIdPattern],
  ['EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_UNIT_ID', 'Android rewarded ad-unit ID', 'ca-app-pub-0000000000000000/0000000000', admobUnitIdPattern],
];
const envPlan = adEnvKeys.map(([key, label, valueHint, pattern]) => {
  const value = cleanEnv(key);
  return {
    key,
    label,
    valueHint,
    configured: Boolean(value),
    validProductionFormat: isRealAdMobValue(value, pattern),
    visibility: 'sensitive',
    easCommand: `eas env:create --name ${key} --environment production --visibility sensitive`,
  };
});
const manualConfirmations = [
  {
    key: 'ADMOB_PRIVACY_MESSAGES_CONFIGURED',
    expectedValue: '1',
    ready: process.env.ADMOB_PRIVACY_MESSAGES_CONFIGURED === '1',
    evidence: 'AdMob Privacy & messaging is configured for release regions and UMP canRequestAds is verified in a production/TestFlight build.',
  },
  {
    key: 'APP_STORE_PRIVACY_ANSWERS_REVIEWED',
    expectedValue: '1',
    ready: process.env.APP_STORE_PRIVACY_ANSWERS_REVIEWED === '1',
    evidence: 'App Store Connect privacy answers match the submitted build and final live-AdMob state.',
  },
  {
    key: 'PRODUCTION_DEVICE_TESTED',
    expectedValue: '1',
    ready: process.env.PRODUCTION_DEVICE_TESTED === '1',
    evidence: 'The exact production/TestFlight build passes docs/production-device-smoke-test.md including rewarded-ad continue and ad privacy paths.',
  },
];
const liveAdMobRow = (releaseStatus.rows ?? []).find((row) => row.label === 'Live AdMob IDs');
const privacyMessagingRow = (releaseStatus.rows ?? []).find((row) => row.label === 'ADMOB_PRIVACY_MESSAGES_CONFIGURED');
const localReady = admobReleaseAudit.summary?.localReady === true && admobReleaseAudit.summary?.risk === 'PASS';
const allProductionIdsValid = envPlan.every((entry) => entry.validProductionFormat);
const externalReady =
  allProductionIdsValid &&
  admobReleaseAudit.summary?.liveAdsReady === true &&
  manualConfirmations.every((entry) => entry.ready);

const handoff = {
  schemaVersion: 1,
  source: 'scripts/generate-admob-setup-handoff.js',
  generatedFrom: {
    admobReleaseAudit: 'docs/admob-release-audit.json',
    privacyAnswers: 'docs/app-store-privacy-answers.json',
    privacyReviewPacket: 'docs/privacy-review-packet.json',
    productionDeviceSmokeTest: 'docs/production-device-smoke-test.json',
    releaseStatus: 'scripts/release-status.js --json',
    envTemplate: '.env.example',
    appConfig: 'app.json + app.config.js',
  },
  officialReferences: admobReleaseAudit.officialReferences ?? [],
  app: {
    name: appJson.name,
    version: appJson.version,
    bundleIdentifier: appJson.ios?.bundleIdentifier,
    packageName: appJson.android?.package,
    googleMobileAdsPackage: packageJson.dependencies?.['react-native-google-mobile-ads'] ?? null,
  },
  summary: {
    risk: localReady ? 'PASS' : 'REVIEW',
    localReady,
    externalReady,
    externalPending: !externalReady,
    currentState: admobReleaseAudit.summary?.currentState ?? 'UNKNOWN',
    liveAdsReady: admobReleaseAudit.summary?.liveAdsReady === true,
    allProductionIdsValid,
    googleMobileAdsPluginInjected: admobReleaseAudit.summary?.googleMobileAdsPluginInjected === true,
    privacyMessagingConfirmed: process.env.ADMOB_PRIVACY_MESSAGES_CONFIGURED === '1',
    appStorePrivacyReviewed: process.env.APP_STORE_PRIVACY_ANSWERS_REVIEWED === '1',
    productionDeviceTested: process.env.PRODUCTION_DEVICE_TESTED === '1',
    liveAdMobReleaseStatus: liveAdMobRow?.status ?? 'UNKNOWN',
    privacyMessagingReleaseStatus: privacyMessagingRow?.status ?? 'UNKNOWN',
    liveAdMobDisclosureRows: privacyAnswers.liveAdMobAnswers?.likelyGoogleMobileAdsDataTypes?.length ?? 0,
    smokeTestSections: productionSmokeTest.sections?.length ?? 0,
  },
  envPlan,
  manualConfirmations,
  adMobConsolePlan: [
    step(1, 'Create or confirm the Google AdMob account owned by the publisher that will receive app revenue.'),
    step(2, `Create iOS and Android AdMob app records for ${appJson.ios?.bundleIdentifier} and ${appJson.android?.package}.`),
    step(3, 'Create one rewarded ad unit for iOS and one rewarded ad unit for Android.'),
    step(4, 'Copy only production AdMob app IDs and rewarded ad-unit IDs; do not use placeholder IDs or Google demo IDs for release builds.'),
    step(5, 'Configure AdMob Privacy & messaging for the release regions and verify UMP canRequestAds before requesting rewarded ads.'),
    step(6, 'Review App Store Connect App Privacy after enabling live AdMob, using docs/app-store-privacy-answers.md and docs/privacy-review-packet.md.'),
  ],
  appStorePrivacyPlan: [
    'Use the NO_LIVE_ADS privacy answers only while liveAdsEnabled is false.',
    'After all production AdMob IDs are valid, rerun npm run privacy:answers and npm run privacy:review-packet.',
    'Review Google Mobile Ads data disclosure rows and the final Xcode privacy report for the submitted build.',
    'Set APP_STORE_PRIVACY_ANSWERS_REVIEWED=1 only after App Store Connect matches the exact submitted archive.',
  ],
  productionTestPlan: [
    'Build a production/TestFlight archive after the four AdMob IDs are set in local and EAS production environments.',
    'Complete UMP consent or privacy messaging if shown before attempting rewarded ads.',
    'Tap the rewarded-ad continue entry during gameplay and verify the reward is granted once only after the earned-reward event.',
    'Open Settings and verify the Ad privacy options entry opens UMP privacy options when required, or explains unavailable state when not required.',
    'Complete docs/production-device-smoke-test.md before setting PRODUCTION_DEVICE_TESTED=1.',
  ],
  verificationOrder: [
    'npm run ads:audit',
    'npm run privacy:answers',
    'npm run privacy:data-flow',
    'npm run privacy:review-packet',
    'npm run device:smoke',
    'npm run ads:handoff',
    'npm run eas:env-checklist',
    'npm run release:verify',
    'npm run release:store-ready',
    'npm run build:ios',
    'npm run submit:ios',
  ],
};

fs.writeFileSync(jsonPath, `${JSON.stringify(handoff, null, 2)}\n`);
fs.writeFileSync(markdownPath, renderMarkdown(handoff));

if (!handoff.summary.localReady) {
  console.error('AdMob setup handoff requires review: local ad integration is not ready');
  process.exit(1);
}

console.log(`generated ${path.relative(root, markdownPath)} and ${path.relative(root, jsonPath)}`);

function step(order, action) {
  return { order, action };
}

function renderMarkdown(values) {
  const envRows = values.envPlan
    .map((entry) => `| \`${entry.key}\` | ${entry.label} | ${entry.configured ? 'Yes' : 'No'} | ${entry.validProductionFormat ? 'Yes' : 'No'} | \`${entry.valueHint}\` |`)
    .join('\n');
  const easCommands = values.envPlan.map((entry) => `- \`${entry.easCommand}\``).join('\n');
  const confirmationRows = values.manualConfirmations
    .map((entry) => `| \`${entry.key}\` | \`${entry.expectedValue}\` | ${entry.ready ? 'Ready' : 'Pending'} | ${entry.evidence} |`)
    .join('\n');
  const consoleSteps = values.adMobConsolePlan.map((entry) => `${entry.order}. ${entry.action}`).join('\n');
  const privacySteps = values.appStorePrivacyPlan.map((item) => `- ${item}`).join('\n');
  const testSteps = values.productionTestPlan.map((item) => `- ${item}`).join('\n');
  const verificationSteps = values.verificationOrder.map((item) => `1. ${item}`).join('\n');
  const references = values.officialReferences.map((entry) => `- ${entry.label}: ${entry.url}`).join('\n');

  return `# AdMob Setup Handoff

Use this handoff after local ad integration passes and before enabling live rewarded ads in the production App Store build.

## Summary

- Risk: ${values.summary.risk}
- Local ad integration ready: ${values.summary.localReady ? 'Yes' : 'No'}
- External AdMob ready: ${values.summary.externalReady ? 'Yes' : 'No'}
- External AdMob pending: ${values.summary.externalPending ? 'Yes' : 'No'}
- Current state: ${values.summary.currentState}
- Live ads ready: ${values.summary.liveAdsReady ? 'Yes' : 'No'}
- All production IDs valid: ${values.summary.allProductionIdsValid ? 'Yes' : 'No'}
- Google Mobile Ads plugin injected: ${values.summary.googleMobileAdsPluginInjected ? 'Yes' : 'No'}
- AdMob Privacy & messaging confirmed: ${values.summary.privacyMessagingConfirmed ? 'Yes' : 'No'}
- App Store privacy reviewed: ${values.summary.appStorePrivacyReviewed ? 'Yes' : 'No'}
- Production device tested: ${values.summary.productionDeviceTested ? 'Yes' : 'No'}
- Live-AdMob disclosure rows: ${values.summary.liveAdMobDisclosureRows}

## Required AdMob Values

| Key | Meaning | Configured | Valid production format | Format hint |
| --- | --- | --- | --- | --- |
${envRows}

EAS production env commands:

${easCommands}

## Manual Confirmations

| Key | Value | Status | Required evidence |
| --- | --- | --- | --- |
${confirmationRows}

## AdMob Console Plan

${consoleSteps}

## App Store Privacy Plan

${privacySteps}

## Production Test Plan

${testSteps}

## Verification Order

${verificationSteps}

## Official References

${references}
`;
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function readReleaseStatus() {
  const output = require('child_process').spawnSync('node', ['scripts/release-status.js', '--json'], {
    cwd: root,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });

  if (output.status !== 0) return { rows: [] };
  return JSON.parse(output.stdout);
}

function cleanEnv(key) {
  const value = process.env[key]?.trim();
  return value ? value : undefined;
}

function isRealAdMobValue(value, pattern) {
  return pattern.test(value ?? '') && !admobPlaceholderPattern.test(value ?? '') && !admobDemoPublisherPattern.test(value ?? '');
}
