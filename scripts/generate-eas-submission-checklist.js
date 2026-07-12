const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const jsonPath = path.join(root, 'docs/eas-submission-checklist.json');
const markdownPath = path.join(root, 'docs/eas-submission-checklist.md');
const appJson = require('../app.json').expo;
const easJson = require('../eas.json');
const packageJson = require('../package.json');
const metadataPreview = require('../docs/app-store-metadata-preview.json');
const appStoreCopyAudit = readJson('docs/app-store-copy-audit.json') ?? {};
const metadataUploadPacket = readJson('docs/app-store-metadata-upload-packet.json') ?? {};
const screenshotManifest = require('../docs/app-store-screenshot-manifest.json');
const screenshotQaAudit = readJson('docs/screenshot-qa-audit.json') ?? {};
const releasePacket = require('../docs/release-packet.json');
const reviewGuide = require('../docs/app-store-review-guide.json');
const localizationAudit = readJson('docs/localization-audit.json') ?? {};
const publicSiteDeployAudit = readJson('docs/public-site-deploy-audit.json') ?? {};
const publicSiteHostingVerification = readJson('docs/public-site-hosting-verification.json') ?? {};
const ageRatingAudit = readJson('docs/app-store-age-rating-audit.json') ?? {};
const studyBankDepthAudit = readJson('docs/study-bank-depth-audit.json') ?? {};
const studyContentLocalizationAudit = readJson('docs/study-content-localization-audit.json') ?? {};
const contentRightsAudit = readJson('docs/content-rights-audit.json') ?? {};
const privacyManifestAudit = readJson('docs/privacy-manifest-audit.json') ?? {};
const privacyAnswers = readJson('docs/app-store-privacy-answers.json') ?? {};
const privacyReviewPacket = readJson('docs/privacy-review-packet.json') ?? {};
const admobReleaseAudit = readJson('docs/admob-release-audit.json') ?? {};
const dataFlowPrivacyAudit = readJson('docs/data-flow-privacy-audit.json') ?? {};
const runtimeUiFlowAudit = readJson('docs/runtime-ui-flow-audit.json') ?? {};
const productionSmokeTest = readJson('docs/production-device-smoke-test.json') ?? {};
const externalReadiness = readJson('docs/external-readiness.json') ?? {};
const easEnvChecklist = readJson('docs/eas-env-checklist.json') ?? {};
const easBuildPreflight = readJson('docs/eas-build-preflight.json') ?? {};
const appStoreConnectChecklist = readJson('docs/app-store-connect-checklist.json') ?? {};
const releaseStatus = readReleaseStatus();

const screenshotEntries =
  (screenshotManifest.defaultPack?.screenshots ?? []).length +
  (screenshotManifest.localizedPacks ?? []).reduce((sum, pack) => sum + (pack.screenshots?.length ?? 0), 0);
const hardBlockers = releaseStatus.rows.filter((row) => row.status === 'TODO' || row.status === 'BAD');
const localEvidence = releaseStatus.rows.filter((row) => row.category === 'local');

const checklist = {
  schemaVersion: 1,
  source: 'scripts/generate-eas-submission-checklist.js',
  app: {
    name: appJson.name,
    version: appJson.version,
    slug: appJson.slug,
    bundleIdentifier: appJson.ios?.bundleIdentifier,
    buildNumber: appJson.ios?.buildNumber,
    supportsTablet: Boolean(appJson.ios?.supportsTablet),
    packageName: appJson.android?.package,
  },
  eas: {
    cliVersion: easJson.cli?.version,
    appVersionSource: easJson.cli?.appVersionSource,
    productionBuild: {
      autoIncrement: easJson.build?.production?.autoIncrement,
      environment: easJson.build?.production?.environment ?? null,
      command: packageJson.scripts?.['build:ios'],
    },
    productionSubmit: {
      metadataPath: easJson.submit?.production?.ios?.metadataPath,
      command: packageJson.scripts?.['submit:ios'],
    },
    metadataCommand: packageJson.scripts?.['metadata:ios'],
    remoteVersionCommand: 'npx eas-cli build:version:set',
    buildPreflight: {
      path: 'docs/eas-build-preflight.md',
      risk: easBuildPreflight.summary?.risk ?? 'UNKNOWN',
      localReady: Boolean(easBuildPreflight.summary?.localReady),
      externalReady: Boolean(easBuildPreflight.summary?.externalReady),
      uploadPolicyReady: Boolean(easBuildPreflight.uploadPolicy?.ready),
      externalBlockingItems: easBuildPreflight.summary?.externalBlockingItems ?? 0,
    },
  },
  evidence: {
    releasePacket: 'docs/release-packet.json',
    runtimeAssetManifest: releasePacket.artifacts?.runtimeAssetManifest?.path,
    runtimeUiFlowAudit: 'docs/runtime-ui-flow-audit.md',
    metadataPreview: 'docs/app-store-metadata-preview.json',
    appStoreCopyAudit: 'docs/app-store-copy-audit.md',
    metadataUploadPacket: 'docs/app-store-metadata-upload-packet.md',
    localizationAudit: 'docs/localization-audit.md',
    publicSiteDeployAudit: 'docs/public-site-deploy-audit.md',
    publicSiteHostingVerification: 'docs/public-site-hosting-verification.md',
    reviewGuide: 'docs/app-store-review-guide.md',
    ageRatingAudit: 'docs/app-store-age-rating-audit.md',
    studyBankDepthAudit: 'docs/study-bank-depth-audit.md',
    studyContentLocalizationAudit: 'docs/study-content-localization-audit.md',
    contentRightsAudit: 'docs/content-rights-audit.md',
    privacyManifestAudit: 'docs/privacy-manifest-audit.md',
    privacyAnswers: 'docs/app-store-privacy-answers.md',
    privacyReviewPacket: 'docs/privacy-review-packet.md',
    admobReleaseAudit: 'docs/admob-release-audit.md',
    dataFlowPrivacyAudit: 'docs/data-flow-privacy-audit.md',
    productionSmokeTest: 'docs/production-device-smoke-test.md',
    externalReadiness: 'docs/external-readiness.md',
    easEnvironment: 'docs/eas-env-checklist.md',
    easBuildPreflight: 'docs/eas-build-preflight.md',
    appStoreConnectChecklist: 'docs/app-store-connect-checklist.md',
    screenshotManifest: 'docs/app-store-screenshot-manifest.json',
    screenshotQaAudit: 'docs/screenshot-qa-audit.md',
    appStoreLocales: metadataPreview.locales?.length ?? 0,
    screenshotEntries,
    screenshotQaRisk: screenshotQaAudit.summary?.risk ?? 'UNKNOWN',
    screenshotQaReady: Boolean(screenshotQaAudit.summary?.allScreenshotsReady),
    screenshotQaLocalizedDistinct: Boolean(screenshotQaAudit.summary?.localizedNonEnglishDistinctFromDefault),
    screenshotQaUnexpectedDuplicateGroups: screenshotQaAudit.summary?.unexpectedDuplicateGroups ?? 0,
    runtimeUiFlowRisk: runtimeUiFlowAudit.summary?.risk ?? 'UNKNOWN',
    runtimeUiFlowReady: Boolean(runtimeUiFlowAudit.summary?.localReady),
    runtimeUiFlowChecks: runtimeUiFlowAudit.summary?.checks ?? 0,
    runtimeUiFlowPassedChecks: runtimeUiFlowAudit.summary?.passedChecks ?? 0,
    runtimeUiFlowRequiredFailures: runtimeUiFlowAudit.summary?.requiredFlowFailures ?? 0,
    appStoreCopyRisk: appStoreCopyAudit.summary?.risk ?? 'UNKNOWN',
    appStoreCopyReadyLocales: appStoreCopyAudit.summary?.readyLocales ?? 0,
    appStoreCopyLocales: appStoreCopyAudit.summary?.locales ?? 0,
    appStoreCopyKeywordFormatReady: Boolean(appStoreCopyAudit.summary?.keywordFormatReady),
    appStoreCopyKeywordsByteLimitReady: Boolean(appStoreCopyAudit.summary?.keywordsByteLimitReady),
    appStoreCopyNoProtectedTerms: Boolean(appStoreCopyAudit.summary?.noProtectedTermHits),
    metadataUploadPacketRisk: metadataUploadPacket.summary?.risk ?? 'UNKNOWN',
    metadataUploadPacketLocalReady: Boolean(metadataUploadPacket.summary?.localReady),
    metadataUploadPacketFieldReadyLocales: metadataUploadPacket.summary?.fieldReadyLocales ?? 0,
    metadataUploadPacketScreenshotReadyLocales: metadataUploadPacket.summary?.screenshotReadyLocales ?? 0,
    metadataUploadPacketSupportUrlReadyLocales: metadataUploadPacket.summary?.supportUrlReadyLocales ?? 0,
    metadataUploadPacketPrivacyUrlReadyLocales: metadataUploadPacket.summary?.privacyUrlReadyLocales ?? 0,
    localizationRisk: localizationAudit.summary?.risk ?? 'UNKNOWN',
    localizationUiLocales: localizationAudit.summary?.uiLocales ?? 0,
    localizationAppStoreLocales: localizationAudit.summary?.appStoreLocales ?? 0,
    localizationScreenshotEntries: localizationAudit.summary?.localizedScreenshotEntries ?? 0,
    localizationPublicSitePages: localizationAudit.summary?.publicSitePages ?? 0,
    localizationJapaneseUiRemoved: Boolean(localizationAudit.summary?.japaneseUiLocaleRemoved),
    publicSiteDeployRisk: publicSiteDeployAudit.summary?.risk ?? 'UNKNOWN',
    publicSiteDeployLocalReady: Boolean(publicSiteDeployAudit.summary?.localReady),
    publicSiteDeployHostingReady: Boolean(publicSiteDeployAudit.summary?.hostingReady),
    publicSiteDeployRoutes: publicSiteDeployAudit.summary?.routeCount ?? 0,
    publicSiteHostingVerificationStatus: publicSiteHostingVerification.summary?.status ?? 'UNKNOWN',
    publicSiteHostingVerificationReady: Boolean(publicSiteHostingVerification.summary?.ready),
    publicSiteHostingVerificationCheckedUrls: publicSiteHostingVerification.summary?.checkedUrls ?? 0,
    publicSiteHostingVerificationPassedUrls: publicSiteHostingVerification.summary?.passedUrls ?? 0,
    publicSiteHostingVerificationFailedUrls: publicSiteHostingVerification.summary?.failedUrls ?? 0,
    reviewContactReady: Boolean(metadataPreview.app?.reviewContactReady),
    demoAccountRequired: reviewGuide.review?.demoAccountRequired,
    signInRequired: reviewGuide.review?.signInRequired,
    ageRatingRisk: ageRatingAudit.summary?.risk ?? 'UNKNOWN',
    ageRatingSuggestedAppleGlobalRating: ageRatingAudit.summary?.suggestedAppleGlobalRating ?? 'UNKNOWN',
    ageRatingFrequencyNoneAnswers: ageRatingAudit.summary?.frequencyNoneAnswers ?? 0,
    ageRatingFrequencyQuestions: ageRatingAudit.summary?.frequencyQuestions ?? 0,
    ageRatingFinalSource: ageRatingAudit.summary?.finalRatingSource ?? 'UNKNOWN',
    studyBankDepthRisk: studyBankDepthAudit.summary?.risk ?? 'UNKNOWN',
    studyBankDepthLevels: studyBankDepthAudit.summary?.levels ?? 0,
    studyBankDepthTotalItems: studyBankDepthAudit.summary?.totalStudyItems ?? 0,
    studyBankDepthTopicFamilies: studyBankDepthAudit.summary?.totalTopics ?? 0,
    studyBankDepthProgressionPassed: Boolean(studyBankDepthAudit.difficultyProgression?.passed),
    studyContentLocalizationRisk: studyContentLocalizationAudit.summary?.risk ?? 'UNKNOWN',
    studyContentLocalizationLocales: studyContentLocalizationAudit.summary?.expectedLocales ?? 0,
    studyContentLocalizationItems: studyContentLocalizationAudit.summary?.totalStudyItems ?? 0,
    studyContentLocalizationTextKeys: studyContentLocalizationAudit.summary?.studyTextKeys ?? 0,
    studyContentLocalizedFields: studyContentLocalizationAudit.summary?.localizedFieldsReady ?? 0,
    studyContentExpectedFields: studyContentLocalizationAudit.summary?.expectedLocalizedFields ?? 0,
    studyContentTranslationEntries: studyContentLocalizationAudit.summary?.contentTranslationEntriesReady ?? 0,
    studyContentExpectedTranslationEntries: studyContentLocalizationAudit.summary?.expectedContentTranslationEntries ?? 0,
    studyContentMissingLocalizedFields: studyContentLocalizationAudit.summary?.missingLocalizedFields ?? 0,
    studyContentMissingTranslationEntries: studyContentLocalizationAudit.summary?.missingTranslationEntries ?? 0,
    contentRightsRisk: contentRightsAudit.summary?.risk ?? 'UNKNOWN',
    protectedIpTermHits: contentRightsAudit.summary?.protectedIpTermHits ?? 0,
    originalAnimeStyleLinePrompts: contentRightsAudit.summary?.originalAnimeStyleLinePrompts ?? 0,
    privacyManifestRisk: privacyManifestAudit.summary?.risk ?? 'UNKNOWN',
    privacyManifestTracking: Boolean(privacyManifestAudit.summary?.tracking),
    privacyManifestCollectedDataTypes: privacyManifestAudit.summary?.collectedDataTypes ?? 0,
    requiredReasonApisReady: Boolean(privacyManifestAudit.summary?.requiredReasonApisReady),
    privacyAnswersRisk: privacyAnswers.summary?.risk ?? 'UNKNOWN',
    privacyAnswersCurrentState: privacyAnswers.summary?.currentState ?? 'UNKNOWN',
    privacyAnswersAppCodeCollectsPersonalData: Boolean(privacyAnswers.summary?.appCodeCollectsPersonalData),
    privacyAnswersLiveAdMobDisclosureRows: privacyAnswers.liveAdMobAnswers?.likelyGoogleMobileAdsDataTypes?.length ?? 0,
    privacyReviewPacketRisk: privacyReviewPacket.summary?.risk ?? 'UNKNOWN',
    privacyReviewPacketLocalReady: Boolean(privacyReviewPacket.summary?.localReady),
    privacyReviewPacketCurrentState: privacyReviewPacket.summary?.currentState ?? 'UNKNOWN',
    privacyReviewPacketFinalReviewConfirmed: Boolean(privacyReviewPacket.summary?.finalReviewConfirmed),
    privacyReviewPacketNoLiveAdsSuggestedRows: privacyReviewPacket.summary?.noLiveAdsSuggestedRows ?? 0,
    privacyReviewPacketLiveAdMobDisclosureRows: privacyReviewPacket.summary?.liveAdMobDisclosureRows ?? 0,
    privacyReviewPacketAppOwnedNetworkRequests: privacyReviewPacket.summary?.appOwnedNetworkRequests ?? 0,
    privacyReviewPacketAnalyticsSdkCount: privacyReviewPacket.summary?.analyticsSdkCount ?? 0,
    privacyReviewPacketAuthSdkCount: privacyReviewPacket.summary?.authSdkCount ?? 0,
    admobReleaseRisk: admobReleaseAudit.summary?.risk ?? 'UNKNOWN',
    admobReleaseCurrentState: admobReleaseAudit.summary?.currentState ?? 'UNKNOWN',
    admobReleaseLocalReady: Boolean(admobReleaseAudit.summary?.localReady),
    admobReleaseLiveAdsReady: Boolean(admobReleaseAudit.summary?.liveAdsReady),
    admobReleaseExternalReady: Boolean(admobReleaseAudit.summary?.externalReady),
    admobReleaseExternalBlockingItems: admobReleaseAudit.summary?.externalBlockingItems ?? 0,
    dataFlowPrivacyRisk: dataFlowPrivacyAudit.summary?.risk ?? 'UNKNOWN',
    dataFlowPrivacyLocalReady: Boolean(dataFlowPrivacyAudit.summary?.localReady),
    dataFlowAppOwnedNetworkRequests: dataFlowPrivacyAudit.summary?.appOwnedNetworkRequests ?? 0,
    dataFlowAnalyticsSdkCount: dataFlowPrivacyAudit.summary?.analyticsSdkCount ?? 0,
    dataFlowAuthSdkCount: dataFlowPrivacyAudit.summary?.authSdkCount ?? 0,
    dataFlowUserContentEntryCount: dataFlowPrivacyAudit.summary?.userContentEntryCount ?? 0,
    dataFlowLocalStorageKeys: dataFlowPrivacyAudit.summary?.localStorageKeys ?? 0,
    productionSmokeSections: productionSmokeTest.sections?.length ?? 0,
    productionSmokeItems: (productionSmokeTest.sections ?? []).reduce((sum, section) => sum + (section.items?.length ?? 0), 0),
    externalReadinessItems: externalReadiness.summary?.total ?? 0,
    externalReadinessBlocking: externalReadiness.summary?.blocking ?? 0,
    easEnvironmentKeys: easEnvChecklist.summary?.totalKeys ?? 0,
    easEnvironmentRequiredForBuild: easEnvChecklist.summary?.requiredForEasProduction ?? 0,
    easProductionProfileReady: Boolean(easEnvChecklist.summary?.productionProfileEnvironmentReady),
    appStoreConnectSections: appStoreConnectChecklist.sections?.length ?? 0,
    appStoreConnectFields: (appStoreConnectChecklist.sections ?? []).reduce((sum, section) => sum + (section.fields?.length ?? 0), 0),
  },
  status: releaseStatus.summary,
  localEvidence,
  blockers: hardBlockers,
  sequence: [
    {
      step: 'Verify local release evidence',
      command: 'npm run release:verify',
      requiresClearedBlockers: false,
    },
    {
      step: 'Run strict store-ready gate',
      command: 'npm run release:store-ready',
      requiresClearedBlockers: true,
    },
    {
      step: 'Push App Store metadata',
      command: packageJson.scripts?.['metadata:ios'],
      requiresClearedBlockers: true,
    },
    {
      step: 'Build iOS production archive',
      command: packageJson.scripts?.['build:ios'],
      requiresClearedBlockers: true,
    },
    {
      step: 'Submit iOS build',
      command: packageJson.scripts?.['submit:ios'],
      requiresClearedBlockers: true,
    },
  ],
};

fs.writeFileSync(jsonPath, `${JSON.stringify(checklist, null, 2)}\n`);
fs.writeFileSync(markdownPath, renderMarkdown(checklist));
console.log(`generated ${path.relative(root, markdownPath)} and ${path.relative(root, jsonPath)}`);

function readReleaseStatus() {
  const result = spawnSync('node', ['scripts/release-status.js', '--json'], {
    cwd: root,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`release-status --json exited with status ${result.status}`);
  }

  return JSON.parse(result.stdout.replace(/^\uFEFF/, '').trim());
}

function readJson(relativePath) {
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) return null;

  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function renderMarkdown(values) {
  const localEvidence = values.localEvidence.length > 0
    ? values.localEvidence.map((row) => `- [${row.status}] ${row.label}: ${row.detail}`).join('\n')
    : '- No local evidence rows were reported by release:status.';
  const blockers = values.blockers.length > 0
    ? values.blockers.map((row) => `- [${row.status}] ${row.label}: ${row.detail}`).join('\n')
    : '- None. EAS submission sequence can proceed after a fresh final verification.';
  const sequence = values.sequence.map((item, index) => (
    `${index + 1}. ${item.command} - ${item.step}${item.requiresClearedBlockers ? ' (requires zero TODO/BAD release-status rows)' : ''}`
  )).join('\n');

  return `# EAS Submission Checklist

## App

- Name: ${values.app.name}
- Version: ${values.app.version}
- iOS bundle ID: ${values.app.bundleIdentifier}
- iOS build number in app.json: ${values.app.buildNumber}
- Android package: ${values.app.packageName}
- Tablet support: ${values.app.supportsTablet ? 'Yes' : 'No'}

## EAS Profiles

- EAS CLI requirement: ${values.eas.cliVersion}
- App version source: ${values.eas.appVersionSource}
- Production auto-increment: ${values.eas.productionBuild.autoIncrement ? 'Yes' : 'No'}
- Production environment: ${values.eas.productionBuild.environment ?? 'missing'}
- Submit metadata path: ${values.eas.productionSubmit.metadataPath}

## Generated Evidence

- Release packet: ${values.evidence.releasePacket}
- Runtime asset manifest: ${values.evidence.runtimeAssetManifest}
- Runtime UI flow audit: ${values.evidence.runtimeUiFlowAudit}
- Metadata preview: ${values.evidence.metadataPreview}
- App Store copy audit: ${values.evidence.appStoreCopyAudit}
- Metadata upload packet: ${values.evidence.metadataUploadPacket}
- Localization audit: ${values.evidence.localizationAudit}
- Public site deploy audit: ${values.evidence.publicSiteDeployAudit}
- Public site hosting verification: ${values.evidence.publicSiteHostingVerification}
- Review guide: ${values.evidence.reviewGuide}
- Age rating audit: ${values.evidence.ageRatingAudit}
- Study bank depth audit: ${values.evidence.studyBankDepthAudit}
- Study content localization audit: ${values.evidence.studyContentLocalizationAudit}
- Content rights audit: ${values.evidence.contentRightsAudit}
- Privacy manifest audit: ${values.evidence.privacyManifestAudit}
- App Store privacy answers: ${values.evidence.privacyAnswers}
- Privacy review packet: ${values.evidence.privacyReviewPacket}
- Production device smoke test: ${values.evidence.productionSmokeTest}
- External readiness: ${values.evidence.externalReadiness}
- EAS environment checklist: ${values.evidence.easEnvironment}
- EAS build preflight: ${values.evidence.easBuildPreflight}
- App Store Connect checklist: ${values.evidence.appStoreConnectChecklist}
- Screenshot manifest: ${values.evidence.screenshotManifest}
- Screenshot QA audit: ${values.evidence.screenshotQaAudit}
- App Store locales: ${values.evidence.appStoreLocales}
- Screenshot entries: ${values.evidence.screenshotEntries}
- Screenshot QA risk: ${values.evidence.screenshotQaRisk}
- Screenshot QA ready: ${values.evidence.screenshotQaReady ? 'Yes' : 'No'}
- Screenshot QA localized distinct: ${values.evidence.screenshotQaLocalizedDistinct ? 'Yes' : 'No'}
- Screenshot QA unexpected duplicate groups: ${values.evidence.screenshotQaUnexpectedDuplicateGroups}
- Runtime UI flow risk: ${values.evidence.runtimeUiFlowRisk}
- Runtime UI flow ready: ${values.evidence.runtimeUiFlowReady ? 'Yes' : 'No'}
- Runtime UI flow checks: ${values.evidence.runtimeUiFlowPassedChecks}/${values.evidence.runtimeUiFlowChecks}
- Runtime UI flow failures: ${values.evidence.runtimeUiFlowRequiredFailures}
- App Store copy risk: ${values.evidence.appStoreCopyRisk}
- App Store copy ready locales: ${values.evidence.appStoreCopyReadyLocales}/${values.evidence.appStoreCopyLocales}
- App Store copy keyword format ready: ${values.evidence.appStoreCopyKeywordFormatReady ? 'Yes' : 'No'}
- App Store copy keyword byte limit ready: ${values.evidence.appStoreCopyKeywordsByteLimitReady ? 'Yes' : 'No'}
- App Store copy protected terms clear: ${values.evidence.appStoreCopyNoProtectedTerms ? 'Yes' : 'No'}
- Metadata upload packet risk: ${values.evidence.metadataUploadPacketRisk}
- Metadata upload packet local ready: ${values.evidence.metadataUploadPacketLocalReady ? 'Yes' : 'No'}
- Metadata upload packet fields: ${values.evidence.metadataUploadPacketFieldReadyLocales}/${values.evidence.appStoreLocales}
- Metadata upload packet screenshots: ${values.evidence.metadataUploadPacketScreenshotReadyLocales}/${values.evidence.appStoreLocales}
- Metadata upload packet support URLs: ${values.evidence.metadataUploadPacketSupportUrlReadyLocales}/${values.evidence.appStoreLocales}
- Metadata upload packet privacy URLs: ${values.evidence.metadataUploadPacketPrivacyUrlReadyLocales}/${values.evidence.appStoreLocales}
- Localization risk: ${values.evidence.localizationRisk}
- Localization UI locales: ${values.evidence.localizationUiLocales}
- Localization App Store locales: ${values.evidence.localizationAppStoreLocales}
- Localization screenshot entries: ${values.evidence.localizationScreenshotEntries}
- Localization public site pages: ${values.evidence.localizationPublicSitePages}
- Japanese UI locale removed: ${values.evidence.localizationJapaneseUiRemoved ? 'Yes' : 'No'}
- Public site deploy risk: ${values.evidence.publicSiteDeployRisk}
- Public site local package ready: ${values.evidence.publicSiteDeployLocalReady ? 'Yes' : 'No'}
- Public site external hosting ready: ${values.evidence.publicSiteDeployHostingReady ? 'Yes' : 'No'}
- Public site deploy routes: ${values.evidence.publicSiteDeployRoutes}
- Public site hosting verification status: ${values.evidence.publicSiteHostingVerificationStatus}
- Public site hosting verification ready: ${values.evidence.publicSiteHostingVerificationReady ? 'Yes' : 'No'}
- Public site hosting verification checks: ${values.evidence.publicSiteHostingVerificationPassedUrls}/${values.evidence.publicSiteHostingVerificationCheckedUrls}
- Public site hosting verification failures: ${values.evidence.publicSiteHostingVerificationFailedUrls}
- Review contact ready: ${values.evidence.reviewContactReady ? 'Yes' : 'No'}
- Demo account required: ${values.evidence.demoAccountRequired ? 'Yes' : 'No'}
- Sign-in required: ${values.evidence.signInRequired ? 'Yes' : 'No'}
- Age rating risk: ${values.evidence.ageRatingRisk}
- Age rating suggested Apple global rating: ${values.evidence.ageRatingSuggestedAppleGlobalRating}
- Age rating NONE answers: ${values.evidence.ageRatingFrequencyNoneAnswers}/${values.evidence.ageRatingFrequencyQuestions}
- Age rating final source: ${values.evidence.ageRatingFinalSource}
- Study bank depth risk: ${values.evidence.studyBankDepthRisk}
- Study bank levels: ${values.evidence.studyBankDepthLevels}
- Study bank total items: ${values.evidence.studyBankDepthTotalItems}
- Study bank topic families: ${values.evidence.studyBankDepthTopicFamilies}
- Study bank progression passed: ${values.evidence.studyBankDepthProgressionPassed ? 'Yes' : 'No'}
- Study content localization risk: ${values.evidence.studyContentLocalizationRisk}
- Study content localization locales: ${values.evidence.studyContentLocalizationLocales}
- Study content localization items: ${values.evidence.studyContentLocalizationItems}
- Study content localization text keys: ${values.evidence.studyContentLocalizationTextKeys}
- Study content localized fields: ${values.evidence.studyContentLocalizedFields}/${values.evidence.studyContentExpectedFields}
- Study content translation entries: ${values.evidence.studyContentTranslationEntries}/${values.evidence.studyContentExpectedTranslationEntries}
- Study content missing fields: ${values.evidence.studyContentMissingLocalizedFields}
- Study content missing translations: ${values.evidence.studyContentMissingTranslationEntries}
- Content rights risk: ${values.evidence.contentRightsRisk}
- Protected IP term hits: ${values.evidence.protectedIpTermHits}
- Original anime-style line prompts: ${values.evidence.originalAnimeStyleLinePrompts}
- Privacy manifest risk: ${values.evidence.privacyManifestRisk}
- Privacy manifest tracking: ${values.evidence.privacyManifestTracking ? 'Yes' : 'No'}
- Privacy manifest collected data types: ${values.evidence.privacyManifestCollectedDataTypes}
- Required reason APIs ready: ${values.evidence.requiredReasonApisReady ? 'Yes' : 'No'}
- Privacy answer risk: ${values.evidence.privacyAnswersRisk}
- Privacy answer current state: ${values.evidence.privacyAnswersCurrentState}
- App-code personal data collection: ${values.evidence.privacyAnswersAppCodeCollectsPersonalData ? 'Yes' : 'No'}
- Live-AdMob disclosure rows: ${values.evidence.privacyAnswersLiveAdMobDisclosureRows}
- Privacy review packet risk: ${values.evidence.privacyReviewPacketRisk}
- Privacy review packet local ready: ${values.evidence.privacyReviewPacketLocalReady ? 'Yes' : 'No'}
- Privacy review packet current state: ${values.evidence.privacyReviewPacketCurrentState}
- Privacy review final confirmation: ${values.evidence.privacyReviewPacketFinalReviewConfirmed ? 'Yes' : 'No'}
- Privacy review no-live rows: ${values.evidence.privacyReviewPacketNoLiveAdsSuggestedRows}
- Privacy review live-AdMob rows: ${values.evidence.privacyReviewPacketLiveAdMobDisclosureRows}
- Privacy review app-owned network hits: ${values.evidence.privacyReviewPacketAppOwnedNetworkRequests}
- Privacy review analytics SDK hits: ${values.evidence.privacyReviewPacketAnalyticsSdkCount}
- Privacy review auth SDK hits: ${values.evidence.privacyReviewPacketAuthSdkCount}
- AdMob release audit: ${values.evidence.admobReleaseAudit}
- AdMob release risk: ${values.evidence.admobReleaseRisk}
- AdMob release current state: ${values.evidence.admobReleaseCurrentState}
- AdMob local integration ready: ${values.evidence.admobReleaseLocalReady ? 'Yes' : 'No'}
- AdMob live ads ready: ${values.evidence.admobReleaseLiveAdsReady ? 'Yes' : 'No'}
- AdMob external setup ready: ${values.evidence.admobReleaseExternalReady ? 'Yes' : 'No'}
- AdMob external blocking items: ${values.evidence.admobReleaseExternalBlockingItems}
- Data flow privacy audit: ${values.evidence.dataFlowPrivacyAudit}
- Data flow privacy risk: ${values.evidence.dataFlowPrivacyRisk}
- Data flow local posture ready: ${values.evidence.dataFlowPrivacyLocalReady ? 'Yes' : 'No'}
- App-owned network request hits: ${values.evidence.dataFlowAppOwnedNetworkRequests}
- Analytics SDK hits: ${values.evidence.dataFlowAnalyticsSdkCount}
- Auth SDK hits: ${values.evidence.dataFlowAuthSdkCount}
- User-content entry hits: ${values.evidence.dataFlowUserContentEntryCount}
- Local storage keys: ${values.evidence.dataFlowLocalStorageKeys}
- Production smoke sections: ${values.evidence.productionSmokeSections}
- Production smoke items: ${values.evidence.productionSmokeItems}
- External readiness items: ${values.evidence.externalReadinessItems}
- Blocking external items: ${values.evidence.externalReadinessBlocking}
- EAS environment keys: ${values.evidence.easEnvironmentKeys}
- EAS production build env values: ${values.evidence.easEnvironmentRequiredForBuild}
- EAS production profile ready: ${values.evidence.easProductionProfileReady ? 'Yes' : 'No'}
- EAS build preflight: ${values.evidence.easBuildPreflight}
- EAS build preflight risk: ${values.eas.buildPreflight.risk}
- EAS local setup ready: ${values.eas.buildPreflight.localReady ? 'Yes' : 'No'}
- EAS external gate ready: ${values.eas.buildPreflight.externalReady ? 'Yes' : 'No'}
- EAS upload policy ready: ${values.eas.buildPreflight.uploadPolicyReady ? 'Yes' : 'No'}
- App Store Connect sections: ${values.evidence.appStoreConnectSections}
- App Store Connect fields: ${values.evidence.appStoreConnectFields}

## Local Release Evidence

${localEvidence}

## Current Blockers

- OK: ${values.status.ok}
- TODO: ${values.status.todo}
- BAD: ${values.status.bad}
- INFO: ${values.status.info}

${blockers}

## Command Sequence

${sequence}
`;
}
