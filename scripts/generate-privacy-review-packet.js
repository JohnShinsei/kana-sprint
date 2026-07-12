const fs = require('fs');
const path = require('path');
const { loadLocalEnv } = require('./load-env');

const root = path.resolve(__dirname, '..');
const jsonPath = path.join(root, 'docs/privacy-review-packet.json');
const markdownPath = path.join(root, 'docs/privacy-review-packet.md');

loadLocalEnv();

const appJson = require('../app.json').expo;
const packageJson = require('../package.json');
const privacyAnswers = readJson('docs/app-store-privacy-answers.json') ?? {};
const privacyManifestAudit = readJson('docs/privacy-manifest-audit.json') ?? {};
const dataFlowPrivacyAudit = readJson('docs/data-flow-privacy-audit.json') ?? {};
const admobReleaseAudit = readJson('docs/admob-release-audit.json') ?? {};
const externalReadiness = readJson('docs/external-readiness.json') ?? {};

const confirmationEnv = privacyAnswers.summary?.confirmationEnv ?? 'APP_STORE_PRIVACY_ANSWERS_REVIEWED';
const noLiveAdsRows = privacyAnswers.noLiveAdsAnswers?.appStoreConnect ?? [];
const liveAdMobRows = privacyAnswers.liveAdMobAnswers?.likelyGoogleMobileAdsDataTypes ?? [];
const requiredBeforeLiveAdMob = privacyAnswers.liveAdMobAnswers?.requiredBeforeSubmission ?? [];
const finalReviewConfirmed = process.env[confirmationEnv] === '1';
const localFailures = privacyChecks().filter((check) => !check.passed);
const localReady = localFailures.length === 0;

const packet = {
  schemaVersion: 1,
  source: 'scripts/generate-privacy-review-packet.js',
  generatedFrom: {
    appConfig: 'app.json',
    packageJson: 'package.json',
    privacyAnswers: 'docs/app-store-privacy-answers.json',
    privacyManifestAudit: 'docs/privacy-manifest-audit.json',
    dataFlowPrivacyAudit: 'docs/data-flow-privacy-audit.json',
    admobReleaseAudit: 'docs/admob-release-audit.json',
    externalReadiness: 'docs/external-readiness.json',
    officialApplePrivacy: 'https://developer.apple.com/app-store/app-privacy-details/',
    officialGoogleAdMobDisclosure: 'https://developers.google.com/admob/ios/privacy/data-disclosure',
  },
  app: {
    name: appJson.name,
    version: appJson.version,
    bundleIdentifier: appJson.ios?.bundleIdentifier,
    packageName: appJson.android?.package,
    expo: packageJson.dependencies?.expo,
    googleMobileAdsPackage: packageJson.dependencies?.['react-native-google-mobile-ads'] ?? null,
  },
  summary: {
    risk: localReady ? 'PASS' : 'REVIEW',
    localReady,
    currentState: privacyAnswers.summary?.currentState ?? 'UNKNOWN',
    confirmationEnv,
    finalReviewConfirmed,
    noLiveAdsSuggestedRows: noLiveAdsRows.length,
    liveAdMobDisclosureRows: liveAdMobRows.length,
    appCodeCollectsPersonalData: Boolean(privacyAnswers.summary?.appCodeCollectsPersonalData),
    accountRequired: Boolean(privacyAnswers.summary?.accountRequired),
    trackingDeclaredByAppCode: Boolean(privacyAnswers.summary?.trackingDeclaredByAppCode),
    privacyManifestTracking: Boolean(privacyManifestAudit.summary?.tracking),
    privacyManifestCollectedDataTypes: privacyManifestAudit.summary?.collectedDataTypes ?? null,
    requiredReasonApisReady: Boolean(privacyManifestAudit.summary?.requiredReasonApisReady),
    appOwnedNetworkRequests: dataFlowPrivacyAudit.summary?.appOwnedNetworkRequests ?? null,
    analyticsSdkCount: dataFlowPrivacyAudit.summary?.analyticsSdkCount ?? null,
    authSdkCount: dataFlowPrivacyAudit.summary?.authSdkCount ?? null,
    userContentEntryCount: dataFlowPrivacyAudit.summary?.userContentEntryCount ?? null,
    admobCurrentState: admobReleaseAudit.summary?.currentState ?? 'UNKNOWN',
    liveAdsReady: Boolean(admobReleaseAudit.summary?.liveAdsReady),
    externalAdSetupReady: Boolean(admobReleaseAudit.summary?.externalReady),
    externalPrivacyMessagingReady: Boolean(admobReleaseAudit.summary?.externalPrivacyMessagingReady),
    externalBlockingItems: externalReadiness.summary?.blocking ?? null,
    localFailures: localFailures.length,
  },
  noLiveAdsSubmission: {
    applicable: privacyAnswers.summary?.currentState === 'NO_LIVE_ADS',
    suggestedAppStoreConnectRows: noLiveAdsRows,
    reviewerExplanation: privacyAnswers.noLiveAdsAnswers?.reviewerExplanation ?? null,
    evidence: [
      'docs/app-store-privacy-answers.md',
      'docs/privacy-manifest-audit.md',
      'docs/data-flow-privacy-audit.md',
      'docs/admob-release-audit.md',
    ],
  },
  liveAdMobSubmission: {
    applicable: privacyAnswers.summary?.currentState === 'LIVE_ADMOB',
    manualReviewRequired: true,
    requiredBeforeSubmission: requiredBeforeLiveAdMob,
    likelyGoogleMobileAdsDataTypes: liveAdMobRows,
    reviewerNoteAddition: privacyAnswers.liveAdMobAnswers?.reviewerNoteAddition ?? null,
  },
  checks: privacyChecks(),
  evidenceFiles: [
    evidence('App Store privacy answers', 'docs/app-store-privacy-answers.md', privacyAnswers.summary?.risk),
    evidence('iOS privacy manifest audit', 'docs/privacy-manifest-audit.md', privacyManifestAudit.summary?.risk),
    evidence('Data flow privacy audit', 'docs/data-flow-privacy-audit.md', dataFlowPrivacyAudit.summary?.risk),
    evidence('AdMob release audit', 'docs/admob-release-audit.md', admobReleaseAudit.summary?.risk),
    evidence('External readiness checklist', 'docs/external-readiness.md', externalReadiness.summary?.blocking === 0 ? 'PASS' : 'TODO'),
  ],
};

fs.writeFileSync(jsonPath, `${JSON.stringify(packet, null, 2)}\n`);
fs.writeFileSync(markdownPath, renderMarkdown(packet));

if (packet.summary.risk !== 'PASS') {
  console.error(`privacy review packet requires review: ${packet.summary.localFailures} local failures`);
  process.exit(1);
}

console.log(`generated ${path.relative(root, markdownPath)} and ${path.relative(root, jsonPath)}`);

function privacyChecks() {
  return [
    check('privacy-answers-risk', 'App Store privacy answer pack passes locally', privacyAnswers.summary?.risk === 'PASS'),
    check('privacy-build-state', 'Privacy answer pack identifies no-live-ads or live-AdMob state', ['NO_LIVE_ADS', 'LIVE_ADMOB'].includes(privacyAnswers.summary?.currentState)),
    check('privacy-answer-rows', 'No-live-ads and live-AdMob answer rows are populated', noLiveAdsRows.length >= 10 && liveAdMobRows.length >= 6),
    check('app-code-data', 'App code does not collect personal data, require accounts, or declare tracking', privacyAnswers.summary?.appCodeCollectsPersonalData === false && privacyAnswers.summary?.accountRequired === false && privacyAnswers.summary?.trackingDeclaredByAppCode === false),
    check('privacy-manifest', 'Privacy manifest has no tracking, no collected data types, and required-reason APIs ready', privacyManifestAudit.summary?.risk === 'PASS' && privacyManifestAudit.summary?.tracking === false && privacyManifestAudit.summary?.collectedDataTypes === 0 && privacyManifestAudit.summary?.requiredReasonApisReady === true),
    check('data-flow', 'Runtime data flow has no app-owned network, analytics, auth, or user-content entries', dataFlowPrivacyAudit.summary?.risk === 'PASS' && dataFlowPrivacyAudit.summary?.localReady === true && dataFlowPrivacyAudit.summary?.appOwnedNetworkRequests === 0 && dataFlowPrivacyAudit.summary?.analyticsSdkCount === 0 && dataFlowPrivacyAudit.summary?.authSdkCount === 0 && dataFlowPrivacyAudit.summary?.userContentEntryCount === 0),
    check('admob-boundary', 'AdMob integration boundary passes locally and records external setup state', admobReleaseAudit.summary?.risk === 'PASS' && admobReleaseAudit.summary?.localReady === true && admobReleaseAudit.summary?.currentState === privacyAnswers.summary?.currentState),
  ];
}

function check(id, label, passed) {
  return { id, label, passed: Boolean(passed) };
}

function evidence(label, pathValue, risk) {
  return {
    label,
    path: pathValue,
    risk: risk ?? 'UNKNOWN',
    exists: fs.existsSync(path.join(root, pathValue)),
  };
}

function renderMarkdown(values) {
  const checks = values.checks
    .map((entry) => `| ${escapeCell(entry.label)} | ${entry.passed ? 'Pass' : 'Review'} |`)
    .join('\n');
  const noLiveRows = values.noLiveAdsSubmission.suggestedAppStoreConnectRows
    .map((entry) => `| ${escapeCell(entry.field)} | ${escapeCell(entry.suggestedAnswer)} | ${escapeCell(entry.rationale)} |`)
    .join('\n');
  const liveRows = values.liveAdMobSubmission.likelyGoogleMobileAdsDataTypes
    .map((entry) => `| ${escapeCell(entry.appleDataType)} | ${escapeCell(entry.purposes?.join(', '))} | ${escapeCell(entry.linkedToUser)} | ${escapeCell(entry.tracking)} |`)
    .join('\n');
  const required = values.liveAdMobSubmission.requiredBeforeSubmission.map((item) => `- ${item}`).join('\n');
  const evidenceRows = values.evidenceFiles
    .map((entry) => `| ${escapeCell(entry.label)} | ${escapeCell(entry.path)} | ${escapeCell(entry.risk)} | ${entry.exists ? 'Yes' : 'No'} |`)
    .join('\n');

  return `# Privacy Review Packet

Use this packet while filling App Store Connect App Privacy. It summarizes the generated privacy answers, iOS privacy manifest, runtime data-flow audit, and AdMob release audit for the exact current build state.

## Summary

- Risk: ${values.summary.risk}
- Local privacy evidence ready: ${values.summary.localReady ? 'Yes' : 'No'}
- Current build state: ${values.summary.currentState}
- Final App Store privacy review confirmed: ${values.summary.finalReviewConfirmed ? 'Yes' : 'No'}
- Confirmation env: \`${values.summary.confirmationEnv}\`
- App-code personal data collection: ${values.summary.appCodeCollectsPersonalData ? 'Yes' : 'No'}
- Account required: ${values.summary.accountRequired ? 'Yes' : 'No'}
- Tracking declared by app code: ${values.summary.trackingDeclaredByAppCode ? 'Yes' : 'No'}
- Privacy manifest tracking: ${values.summary.privacyManifestTracking ? 'Yes' : 'No'}
- Privacy manifest collected data types: ${values.summary.privacyManifestCollectedDataTypes}
- App-owned network requests: ${values.summary.appOwnedNetworkRequests}
- Analytics SDK hits: ${values.summary.analyticsSdkCount}
- Auth SDK hits: ${values.summary.authSdkCount}
- User-content entry hits: ${values.summary.userContentEntryCount}
- AdMob state: ${values.summary.admobCurrentState}
- Live ads ready: ${values.summary.liveAdsReady ? 'Yes' : 'No'}
- External AdMob setup ready: ${values.summary.externalAdSetupReady ? 'Yes' : 'No'}

## App Store Connect Privacy Answers

Current no-live-ads posture:

| Field | Suggested answer | Rationale |
| --- | --- | --- |
${noLiveRows}

Reviewer-facing explanation:

${values.noLiveAdsSubmission.reviewerExplanation}

## Local Checks

| Check | Status |
| --- | --- |
${checks}

## Live AdMob Build Review

Before enabling live AdMob for the submitted archive:

${required}

Likely Google Mobile Ads rows to review against the final SDK privacy report:

| Apple data type | Likely purposes | Linked to user | Tracking |
| --- | --- | --- | --- |
${liveRows}

## Evidence Files

| Evidence | Path | Risk | Exists |
| --- | --- | --- | --- |
${evidenceRows}

## Local Verification

- \`npm run privacy:review-packet\`
- \`npm run release:verify\`

## Remaining External Confirmation

- Set \`${values.summary.confirmationEnv}=1\` only after App Store Connect App Privacy matches the submitted build and third-party SDK behavior.
- Keep no-live-ads answers only while \`extra.admob.liveAdsEnabled\` is false.
- If live AdMob IDs are enabled, review Google Mobile Ads SDK disclosures, AdMob Privacy & messaging, UMP consent behavior, ATT/IDFA decisions, and the final Xcode privacy report before submission.
`;
}

function escapeCell(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function readJson(relativePath) {
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) return null;

  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}
