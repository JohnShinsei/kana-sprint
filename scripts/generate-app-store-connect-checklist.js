const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const jsonPath = path.join(root, 'docs/app-store-connect-checklist.json');
const markdownPath = path.join(root, 'docs/app-store-connect-checklist.md');

const appJson = require('../app.json').expo;
const packageJson = require('../package.json');
const storeConfig = require('../store.config.js');
const metadataPreview = require('../docs/app-store-metadata-preview.json');
const appStoreCopyAudit = require('../docs/app-store-copy-audit.json');
const metadataUploadPacket = require('../docs/app-store-metadata-upload-packet.json');
const localizationAudit = require('../docs/localization-audit.json');
const screenshotQaAudit = readOptionalJson('docs/screenshot-qa-audit.json') ?? {};
const publicSiteDeployAudit = require('../docs/public-site-deploy-audit.json');
const publicSiteHostingVerification = readOptionalJson('docs/public-site-hosting-verification.json') ?? {};
const reviewGuide = require('../docs/app-store-review-guide.json');
const ageRatingAudit = require('../docs/app-store-age-rating-audit.json');
const studyBankDepthAudit = require('../docs/study-bank-depth-audit.json');
const studyContentLocalizationAudit = require('../docs/study-content-localization-audit.json');
const contentRightsAudit = require('../docs/content-rights-audit.json');
const privacyManifestAudit = require('../docs/privacy-manifest-audit.json');
const privacyAnswers = require('../docs/app-store-privacy-answers.json');
const privacyReviewPacket = readOptionalJson('docs/privacy-review-packet.json') ?? {};
const admobReleaseAudit = readOptionalJson('docs/admob-release-audit.json') ?? {};
const dataFlowPrivacyAudit = readOptionalJson('docs/data-flow-privacy-audit.json') ?? {};
const runtimeUiFlowAudit = readOptionalJson('docs/runtime-ui-flow-audit.json') ?? {};
const externalReadiness = require('../docs/external-readiness.json');
const productionSmokeTest = require('../docs/production-device-smoke-test.json');
const releaseStatus = readReleaseStatus();

const appleInfo = storeConfig.apple ?? {};
const advisory = appleInfo.advisory ?? {};
const reviewContactRow = findRow('App Store review contact');
const supportUrlRow = findRow('Public support URL');
const privacyUrlRow = findRow('Public privacy URL');
const adMobRow = findRow('Live AdMob IDs');
const privacyAnswersRow = findRow('APP_STORE_PRIVACY_ANSWERS_REVIEWED');
const appRecordRow = findRow('APP_STORE_CONNECT_RECORD_READY');
const productionDeviceRow = findRow('PRODUCTION_DEVICE_TESTED');
const appStoreLocales = metadataPreview.locales ?? [];
const checklist = {
  schemaVersion: 1,
  source: 'scripts/generate-app-store-connect-checklist.js',
  generatedFrom: {
    appConfig: 'app.json',
    storeConfig: 'store.config.js',
    metadataPreview: 'docs/app-store-metadata-preview.json',
    appStoreCopyAudit: 'docs/app-store-copy-audit.json',
    metadataUploadPacket: 'docs/app-store-metadata-upload-packet.json',
    localizationAudit: 'docs/localization-audit.json',
    screenshotQaAudit: 'docs/screenshot-qa-audit.json',
    publicSiteDeployAudit: 'docs/public-site-deploy-audit.json',
    publicSiteHostingVerification: 'docs/public-site-hosting-verification.json',
    reviewGuide: 'docs/app-store-review-guide.json',
    ageRatingAudit: 'docs/app-store-age-rating-audit.json',
    studyBankDepthAudit: 'docs/study-bank-depth-audit.json',
    studyContentLocalizationAudit: 'docs/study-content-localization-audit.json',
    contentRightsAudit: 'docs/content-rights-audit.json',
    privacyManifestAudit: 'docs/privacy-manifest-audit.json',
    privacyAnswers: 'docs/app-store-privacy-answers.json',
    privacyReviewPacket: 'docs/privacy-review-packet.json',
    admobReleaseAudit: 'docs/admob-release-audit.json',
    dataFlowPrivacyAudit: 'docs/data-flow-privacy-audit.json',
    runtimeUiFlowAudit: 'docs/runtime-ui-flow-audit.json',
    externalReadiness: 'docs/external-readiness.json',
    productionDeviceSmokeTest: 'docs/production-device-smoke-test.json',
    releaseStatus: 'scripts/release-status.js --json',
  },
  officialReferences: [
    {
      label: 'Apple App Privacy Details',
      url: 'https://developer.apple.com/app-store/app-privacy-details/',
      reason: 'Privacy answers must include the app and integrated third-party SDK practices.',
    },
    {
      label: 'Apple Manage App Privacy',
      url: 'https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/',
      reason: 'Privacy Policy URL is entered in App Store Connect App Privacy.',
    },
    {
      label: 'Apple Set An App Age Rating',
      url: 'https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating/',
      reason: 'Age rating is determined by the App Store Connect questionnaire.',
    },
    {
      label: 'Apple Age Rating Values And Definitions',
      url: 'https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions/',
      reason: 'Final age rating is shown after questionnaire answers are submitted.',
    },
  ],
  app: {
    name: appJson.name,
    version: appJson.version,
    slug: appJson.slug,
    bundleIdentifier: appJson.ios?.bundleIdentifier,
    buildNumber: appJson.ios?.buildNumber,
    packageName: appJson.android?.package,
    expo: packageJson.dependencies?.expo,
    reactNative: packageJson.dependencies?.['react-native'],
    supportsTablet: Boolean(appJson.ios?.supportsTablet),
    encryption: appJson.ios?.infoPlist?.ITSAppUsesNonExemptEncryption === false ? 'No non-exempt encryption declared' : 'Review final encryption answer',
  },
  metadata: {
    locales: appStoreLocales.map((entry) => entry.appStoreLocale),
    defaultLocale: 'en-US',
    categories: appleInfo.categories ?? [],
    copyright: appleInfo.copyright,
    reviewContactReady: Boolean(appleInfo.review),
    supportReady: appStoreLocales.every((entry) => entry.urls?.supportReady),
    privacyReady: appStoreLocales.every((entry) => entry.urls?.privacyReady),
    screenshotEntries: productionSmokeTest.evidence?.screenshotEntries ?? 0,
    screenshotQaAudit: 'docs/screenshot-qa-audit.md',
    screenshotQaRisk: screenshotQaAudit.summary?.risk ?? 'UNKNOWN',
    screenshotQaReady: Boolean(screenshotQaAudit.summary?.allScreenshotsReady),
    screenshotQaLocalizedDistinct: Boolean(screenshotQaAudit.summary?.localizedNonEnglishDistinctFromDefault),
    screenshotQaUnexpectedDuplicateGroups: screenshotQaAudit.summary?.unexpectedDuplicateGroups ?? 0,
    appStoreCopyAudit: 'docs/app-store-copy-audit.md',
    appStoreCopyRisk: appStoreCopyAudit.summary?.risk ?? 'UNKNOWN',
    appStoreCopyReadyLocales: appStoreCopyAudit.summary?.readyLocales ?? 0,
    appStoreCopyLocales: appStoreCopyAudit.summary?.locales ?? 0,
    appStoreCopyKeywordFormatReady: Boolean(appStoreCopyAudit.summary?.keywordFormatReady),
    appStoreCopyKeywordsByteLimitReady: Boolean(appStoreCopyAudit.summary?.keywordsByteLimitReady),
    appStoreCopyNoProtectedTerms: Boolean(appStoreCopyAudit.summary?.noProtectedTermHits),
    metadataUploadPacket: 'docs/app-store-metadata-upload-packet.md',
    metadataUploadPacketRisk: metadataUploadPacket.summary?.risk ?? 'UNKNOWN',
    metadataUploadPacketLocalReady: Boolean(metadataUploadPacket.summary?.localReady),
    metadataUploadPacketFieldReadyLocales: metadataUploadPacket.summary?.fieldReadyLocales ?? 0,
    metadataUploadPacketScreenshotReadyLocales: metadataUploadPacket.summary?.screenshotReadyLocales ?? 0,
    metadataUploadPacketSupportUrlReadyLocales: metadataUploadPacket.summary?.supportUrlReadyLocales ?? 0,
    metadataUploadPacketPrivacyUrlReadyLocales: metadataUploadPacket.summary?.privacyUrlReadyLocales ?? 0,
    localizationAudit: 'docs/localization-audit.md',
    localizationRisk: localizationAudit.summary?.risk,
    localizationUiLocales: localizationAudit.summary?.uiLocales,
    localizationAppStoreLocales: localizationAudit.summary?.appStoreLocales,
    localizationScreenshotEntries: localizationAudit.summary?.localizedScreenshotEntries,
    runtimeUiFlowAudit: 'docs/runtime-ui-flow-audit.md',
    runtimeUiFlowRisk: runtimeUiFlowAudit.summary?.risk ?? 'UNKNOWN',
    runtimeUiFlowReady: Boolean(runtimeUiFlowAudit.summary?.localReady),
    runtimeUiFlowChecks: runtimeUiFlowAudit.summary?.checks ?? 0,
    runtimeUiFlowPassedChecks: runtimeUiFlowAudit.summary?.passedChecks ?? 0,
    runtimeUiFlowRequiredFailures: runtimeUiFlowAudit.summary?.requiredFlowFailures ?? 0,
    publicSiteDeployAudit: 'docs/public-site-deploy-audit.md',
    publicSiteDeployRisk: publicSiteDeployAudit.summary?.risk,
    publicSiteLocalReady: publicSiteDeployAudit.summary?.localReady,
    publicSiteHostingReady: publicSiteDeployAudit.summary?.hostingReady,
    publicSiteHostingVerification: 'docs/public-site-hosting-verification.md',
    publicSiteHostingVerificationStatus: publicSiteHostingVerification.summary?.status ?? 'UNKNOWN',
    publicSiteHostingVerificationReady: Boolean(publicSiteHostingVerification.summary?.ready),
    publicSiteHostingVerificationCheckedUrls: publicSiteHostingVerification.summary?.checkedUrls ?? 0,
    publicSiteHostingVerificationPassedUrls: publicSiteHostingVerification.summary?.passedUrls ?? 0,
    publicSiteHostingVerificationFailedUrls: publicSiteHostingVerification.summary?.failedUrls ?? 0,
    ageRatingAudit: 'docs/app-store-age-rating-audit.md',
    ageRatingRisk: ageRatingAudit.summary?.risk,
    ageRatingSuggestedAppleGlobalRating: ageRatingAudit.summary?.suggestedAppleGlobalRating,
    ageRatingFrequencyNoneAnswers: ageRatingAudit.summary?.frequencyNoneAnswers,
    ageRatingFrequencyQuestions: ageRatingAudit.summary?.frequencyQuestions,
    studyBankDepthAudit: 'docs/study-bank-depth-audit.md',
    studyBankDepthRisk: studyBankDepthAudit.summary?.risk,
    studyBankDepthLevels: studyBankDepthAudit.summary?.levels,
    studyBankDepthTopics: studyBankDepthAudit.summary?.totalTopics,
    studyBankDepthProgression: studyBankDepthAudit.difficultyProgression?.passed,
    studyContentLocalizationAudit: 'docs/study-content-localization-audit.md',
    studyContentLocalizationRisk: studyContentLocalizationAudit.summary?.risk,
    studyContentLocalizationLocales: studyContentLocalizationAudit.summary?.expectedLocales,
    studyContentLocalizationItems: studyContentLocalizationAudit.summary?.totalStudyItems,
    studyContentLocalizationTextKeys: studyContentLocalizationAudit.summary?.studyTextKeys,
    studyContentLocalizedFields: studyContentLocalizationAudit.summary?.localizedFieldsReady,
    studyContentExpectedFields: studyContentLocalizationAudit.summary?.expectedLocalizedFields,
    studyContentTranslationEntries: studyContentLocalizationAudit.summary?.contentTranslationEntriesReady,
    studyContentExpectedTranslationEntries: studyContentLocalizationAudit.summary?.expectedContentTranslationEntries,
    studyContentMissingLocalizedFields: studyContentLocalizationAudit.summary?.missingLocalizedFields,
    studyContentMissingTranslationEntries: studyContentLocalizationAudit.summary?.missingTranslationEntries,
    contentRightsAudit: 'docs/content-rights-audit.md',
    protectedIpTermHits: contentRightsAudit.summary?.protectedIpTermHits ?? 0,
    privacyManifestAudit: 'docs/privacy-manifest-audit.md',
    privacyManifestRisk: privacyManifestAudit.summary?.risk,
    privacyManifestTracking: privacyManifestAudit.summary?.tracking,
    privacyManifestCollectedDataTypes: privacyManifestAudit.summary?.collectedDataTypes,
    privacyAnswers: 'docs/app-store-privacy-answers.md',
    privacyAnswersRisk: privacyAnswers.summary?.risk,
    privacyAnswersCurrentState: privacyAnswers.summary?.currentState,
    privacyAnswersAppCodeCollectsPersonalData: privacyAnswers.summary?.appCodeCollectsPersonalData,
    privacyReviewPacket: 'docs/privacy-review-packet.md',
    privacyReviewPacketRisk: privacyReviewPacket.summary?.risk ?? 'UNKNOWN',
    privacyReviewPacketLocalReady: Boolean(privacyReviewPacket.summary?.localReady),
    privacyReviewPacketCurrentState: privacyReviewPacket.summary?.currentState ?? 'UNKNOWN',
    privacyReviewPacketFinalReviewConfirmed: Boolean(privacyReviewPacket.summary?.finalReviewConfirmed),
    privacyReviewPacketNoLiveAdsSuggestedRows: privacyReviewPacket.summary?.noLiveAdsSuggestedRows ?? 0,
    privacyReviewPacketLiveAdMobDisclosureRows: privacyReviewPacket.summary?.liveAdMobDisclosureRows ?? 0,
    admobReleaseAudit: 'docs/admob-release-audit.md',
    admobReleaseRisk: admobReleaseAudit.summary?.risk ?? 'UNKNOWN',
    admobReleaseCurrentState: admobReleaseAudit.summary?.currentState ?? 'UNKNOWN',
    admobReleaseLocalReady: Boolean(admobReleaseAudit.summary?.localReady),
    admobReleaseLiveAdsReady: Boolean(admobReleaseAudit.summary?.liveAdsReady),
    admobReleaseExternalReady: Boolean(admobReleaseAudit.summary?.externalReady),
    dataFlowPrivacyAudit: 'docs/data-flow-privacy-audit.md',
    dataFlowPrivacyRisk: dataFlowPrivacyAudit.summary?.risk ?? 'UNKNOWN',
    dataFlowPrivacyLocalReady: Boolean(dataFlowPrivacyAudit.summary?.localReady),
    dataFlowAppOwnedNetworkRequests: dataFlowPrivacyAudit.summary?.appOwnedNetworkRequests ?? 0,
    dataFlowAnalyticsSdkCount: dataFlowPrivacyAudit.summary?.analyticsSdkCount ?? 0,
    dataFlowAuthSdkCount: dataFlowPrivacyAudit.summary?.authSdkCount ?? 0,
  },
  suggestedAnswers: {
    appInformation: {
      primaryCategory: 'Games',
      secondaryCategory: 'Education',
      subcategory: 'Word',
      studyBankDepth: `N5-N1 local study bank: ${studyBankDepthAudit.summary?.vocabularyPrompts ?? 0} vocabulary prompts, ${studyBankDepthAudit.summary?.originalAnimeStyleLinePrompts ?? 0} original anime-style line prompts, ${studyBankDepthAudit.summary?.totalTopics ?? 0} topic families. Audit risk: ${studyBankDepthAudit.summary?.risk}.`,
      studyContentLocalization: `Study content localization: ${studyContentLocalizationAudit.summary?.totalStudyItems ?? 0} study items and ${studyContentLocalizationAudit.summary?.studyTextKeys ?? 0} study text keys are available across ${studyContentLocalizationAudit.summary?.expectedLocales ?? 0} UI locales. Audit risk: ${studyContentLocalizationAudit.summary?.risk}.`,
      contentRights: `${contentRightsAudit.posture?.statement} Audit risk: ${contentRightsAudit.summary?.risk}.`,
      kidsCategory: false,
      containsAds: true,
      inAppPurchases: false,
      userGeneratedContent: false,
      signInRequired: false,
      demoAccountRequired: false,
    },
    ageRating: {
      auditPath: 'docs/app-store-age-rating-audit.md',
      risk: ageRatingAudit.summary?.risk,
      expected: `${ageRatingAudit.summary?.suggestedAppleGlobalRating}; final global and region-specific ratings are calculated by App Store Connect`,
      finalSource: ageRatingAudit.summary?.finalRatingSource,
      frequencyNoneAnswers: ageRatingAudit.summary?.frequencyNoneAnswers,
      frequencyQuestions: ageRatingAudit.summary?.frequencyQuestions,
      advisory,
    },
    privacy: {
      privacyPolicyUrlStatus: privacyUrlRow?.status ?? 'UNKNOWN',
      supportUrlStatus: supportUrlRow?.status ?? 'UNKNOWN',
      privacyManifestAudit: 'docs/privacy-manifest-audit.md',
      privacyManifestRisk: privacyManifestAudit.summary?.risk,
      privacyAnswers: 'docs/app-store-privacy-answers.md',
      privacyAnswersRisk: privacyAnswers.summary?.risk,
      privacyReviewPacket: 'docs/privacy-review-packet.md',
      privacyReviewPacketRisk: privacyReviewPacket.summary?.risk ?? 'UNKNOWN',
      currentBuildState: privacyAnswers.summary?.currentState,
      admobReleaseAudit: 'docs/admob-release-audit.md',
      admobReleaseRisk: admobReleaseAudit.summary?.risk ?? 'UNKNOWN',
      dataFlowPrivacyAudit: 'docs/data-flow-privacy-audit.md',
      dataFlowPrivacyRisk: dataFlowPrivacyAudit.summary?.risk ?? 'UNKNOWN',
      noLiveAdsState: 'No data collected by this app; no tracking; no account; progress and settings stay local.',
      liveAdsState: 'Review Google Mobile Ads SDK privacy report and disclose ad SDK data collection before APP_STORE_PRIVACY_ANSWERS_REVIEWED=1.',
      finalConfirmationEnv: 'APP_STORE_PRIVACY_ANSWERS_REVIEWED',
    },
    review: {
      contactStatus: reviewContactRow?.status ?? 'UNKNOWN',
      notes: reviewGuide.review?.reviewNotes,
      noDemoAccount: reviewGuide.review?.demoAccountRequired === false,
      productionDeviceStatus: productionDeviceRow?.status ?? 'UNKNOWN',
      runtimeUiFlowAudit: 'docs/runtime-ui-flow-audit.md',
      runtimeUiFlowReady: Boolean(runtimeUiFlowAudit.summary?.localReady),
    },
    compliance: {
      exportCompliance: appJson.ios?.infoPlist?.ITSAppUsesNonExemptEncryption === false ? 'ITSAppUsesNonExemptEncryption=false' : 'Needs review',
      tracking: 'No tracking by app code; final IDFA/tracking answer must match live AdMob SDK behavior and ATT decision.',
      ads: adMobRow?.status === 'OK' ? 'Live rewarded ads configured' : `Rewarded ad entry exists; local AdMob integration ${admobReleaseAudit.summary?.localReady ? 'ready' : 'needs review'}; live ads disabled until production AdMob IDs are valid.`,
    },
  },
  sections: [
    section('app-record', 'App Record And Identity', [
      field('Bundle ID', appJson.ios?.bundleIdentifier, appRecordRow?.status ?? 'TODO', 'Must match Apple Developer and App Store Connect app record.'),
      field('SKU', 'kana-sprint-ios-v1', 'MANUAL', 'Suggested stable SKU for the first iOS app record; set once in App Store Connect.'),
      field('Version', appJson.version, 'READY', 'Matches app.json and EAS metadata.'),
      field('Build number', appJson.ios?.buildNumber, 'READY', 'EAS remote versioning should be initialized before production build.'),
      field('Copyright', appleInfo.copyright, 'READY', 'Generated in store.config.js.'),
    ]),
    section('app-information', 'App Information', [
      field('Primary category', 'Games', 'READY', 'store.config.js categories include GAMES / GAMES_WORD.'),
      field('Secondary category', 'Education', 'READY', 'Matches learning-game positioning.'),
      field('Age rating questionnaire', `Risk ${ageRatingAudit.summary?.risk}; ${ageRatingAudit.summary?.frequencyNoneAnswers ?? 0}/${ageRatingAudit.summary?.frequencyQuestions ?? 0} advisory frequency answers are NONE; suggested ${ageRatingAudit.summary?.suggestedAppleGlobalRating}.`, ageRatingAudit.summary?.risk === 'PASS' ? 'READY' : 'REVIEW', 'Use docs/app-store-age-rating-audit.md while answering App Store Connect; confirm the calculated global and region-specific ratings before review.'),
      field('App Store copy audit', `Risk ${appStoreCopyAudit.summary?.risk}; ${appStoreCopyAudit.summary?.readyLocales ?? 0}/${appStoreCopyAudit.summary?.locales ?? 0} locales ready; keywords byte limit=${appStoreCopyAudit.summary?.keywordsByteLimitReady ? 'pass' : 'review'}.`, appStoreCopyAudit.summary?.risk === 'PASS' ? 'READY' : 'REVIEW', 'See docs/app-store-copy-audit.md before editing App Store titles, subtitles, keywords, or descriptions.'),
      field('Metadata upload packet', `Risk ${metadataUploadPacket.summary?.risk ?? 'UNKNOWN'}; fields=${metadataUploadPacket.summary?.fieldReadyLocales ?? 0}/${metadataUploadPacket.summary?.locales ?? 0}; screenshots=${metadataUploadPacket.summary?.screenshotReadyLocales ?? 0}/${metadataUploadPacket.summary?.locales ?? 0}; support URLs=${metadataUploadPacket.summary?.supportUrlReadyLocales ?? 0}/${metadataUploadPacket.summary?.locales ?? 0}; privacy URLs=${metadataUploadPacket.summary?.privacyUrlReadyLocales ?? 0}/${metadataUploadPacket.summary?.locales ?? 0}.`, metadataUploadPacket.summary?.risk === 'PASS' ? 'READY' : 'REVIEW', 'Use docs/app-store-metadata-upload-packet.md as the manual App Store Connect fallback if EAS Metadata cannot push fields.'),
      field('Runtime UI flow audit', `Risk ${runtimeUiFlowAudit.summary?.risk ?? 'UNKNOWN'}; ${runtimeUiFlowAudit.summary?.passedChecks ?? 0}/${runtimeUiFlowAudit.summary?.checks ?? 0} runtime flows ready; failures=${runtimeUiFlowAudit.summary?.requiredFlowFailures ?? 0}.`, runtimeUiFlowAudit.summary?.risk === 'PASS' ? 'READY' : 'REVIEW', 'See docs/runtime-ui-flow-audit.md before confirming first screen, Settings language, exit, daily challenge, BGM, support/privacy links, and rewarded-ad entry.'),
      field('JLPT study depth', `${studyBankDepthAudit.summary?.levels ?? 0} JLPT levels, ${studyBankDepthAudit.summary?.totalStudyItems ?? 0} study items, ${studyBankDepthAudit.summary?.totalTopics ?? 0} topic families, progression=${studyBankDepthAudit.difficultyProgression?.passed ? 'pass' : 'review'}.`, studyBankDepthAudit.summary?.risk === 'PASS' ? 'READY' : 'REVIEW', 'See docs/study-bank-depth-audit.md before changing the N5-N1 content bank.'),
      field('Study content localization', `${studyContentLocalizationAudit.summary?.totalStudyItems ?? 0} study items, ${studyContentLocalizationAudit.summary?.studyTextKeys ?? 0} text keys, ${studyContentLocalizationAudit.summary?.expectedLocales ?? 0} UI locales, missing fields=${studyContentLocalizationAudit.summary?.missingLocalizedFields ?? 0}, missing translations=${studyContentLocalizationAudit.summary?.missingTranslationEntries ?? 0}.`, studyContentLocalizationAudit.summary?.risk === 'PASS' ? 'READY' : 'REVIEW', 'See docs/study-content-localization-audit.md before adding vocabulary, line prompts, or supported languages.'),
      field('Content rights', `Original study data, ${contentRightsAudit.summary?.originalAnimeStyleLinePrompts ?? 0} original anime-style lines, game-style BGM assets, app-owned generated screenshots.`, contentRightsAudit.summary?.risk === 'PASS' ? 'READY' : 'REVIEW', 'See docs/content-rights-audit.md; confirm no protected anime quote, character, title, brand, or third-party asset is used.'),
      field('Kids category', 'No', 'READY', 'The app is for general learners, not submitted as a Kids category app.'),
    ]),
    section('pricing-availability', 'Pricing And Availability', [
      field('Price', 'Free recommended', 'MANUAL', 'Rewarded ads are the monetization path; choose the final App Store price tier manually.'),
      field('Availability', 'All intended App Store countries/regions', 'MANUAL', 'Confirm regions match ad privacy messaging and localization coverage.'),
      field('In-app purchases', 'None', 'READY', 'No purchase or subscription code exists in the app.'),
      field('Phased release', appleInfo.release?.phasedRelease ? 'Yes' : 'No', 'READY', 'store.config.js controls EAS metadata release settings.'),
    ]),
    section('privacy-compliance', 'Privacy And Compliance', [
      field('Privacy Policy URL', privacyUrlRow?.detail ?? 'Missing', privacyUrlRow?.status ?? 'TODO', 'Host site/ over HTTPS or set APP_STORE_PRIVACY_URL / APP_STORE_BASE_URL.'),
      field('Support URL', supportUrlRow?.detail ?? 'Missing', supportUrlRow?.status ?? 'TODO', 'Host site/ over HTTPS or set APP_STORE_SUPPORT_URL / APP_STORE_BASE_URL.'),
      field('Public site hosting verification', `Status ${publicSiteHostingVerification.summary?.status ?? 'UNKNOWN'}; ${publicSiteHostingVerification.summary?.passedUrls ?? 0}/${publicSiteHostingVerification.summary?.checkedUrls ?? 0} URLs passed; failures=${publicSiteHostingVerification.summary?.failedUrls ?? 0}.`, publicSiteHostingVerification.summary?.ready ? 'READY' : 'TODO', 'After hosting site/ over production HTTPS, run npm run site:verify-hosting and confirm docs/public-site-hosting-verification.md is PASS.'),
      field('Privacy manifest', `Risk ${privacyManifestAudit.summary?.risk}; tracking=${privacyManifestAudit.summary?.tracking ? 'yes' : 'no'}; collected data types=${privacyManifestAudit.summary?.collectedDataTypes ?? 0}.`, privacyManifestAudit.summary?.risk === 'PASS' ? 'READY' : 'REVIEW', 'See docs/privacy-manifest-audit.md; rerun after native dependency or AdMob changes.'),
      field('App Privacy details', `Use docs/app-store-privacy-answers.md; current build state ${privacyAnswers.summary?.currentState}.`, privacyAnswersRow?.status ?? 'TODO', 'Must include third-party SDK practices for the submitted build.'),
      field('Privacy review packet', `Risk ${privacyReviewPacket.summary?.risk ?? 'UNKNOWN'}; local ready=${privacyReviewPacket.summary?.localReady ? 'yes' : 'no'}; current state=${privacyReviewPacket.summary?.currentState ?? 'UNKNOWN'}; no-live rows=${privacyReviewPacket.summary?.noLiveAdsSuggestedRows ?? 0}; live-AdMob rows=${privacyReviewPacket.summary?.liveAdMobDisclosureRows ?? 0}.`, privacyReviewPacket.summary?.risk === 'PASS' ? 'READY' : 'REVIEW', 'Use docs/privacy-review-packet.md as the compact App Store Connect privacy-form checklist before setting APP_STORE_PRIVACY_ANSWERS_REVIEWED=1.'),
      field('AdMob release audit', `Risk ${admobReleaseAudit.summary?.risk ?? 'UNKNOWN'}; state ${admobReleaseAudit.summary?.currentState ?? 'UNKNOWN'}; live ads ready=${admobReleaseAudit.summary?.liveAdsReady ? 'yes' : 'no'}.`, admobReleaseAudit.summary?.risk === 'PASS' ? 'READY' : 'REVIEW', 'See docs/admob-release-audit.md before enabling or submitting live rewarded ads.'),
      field('Data flow privacy audit', `Risk ${dataFlowPrivacyAudit.summary?.risk ?? 'UNKNOWN'}; app-owned network hits=${dataFlowPrivacyAudit.summary?.appOwnedNetworkRequests ?? 0}; analytics SDKs=${dataFlowPrivacyAudit.summary?.analyticsSdkCount ?? 0}; auth SDKs=${dataFlowPrivacyAudit.summary?.authSdkCount ?? 0}.`, dataFlowPrivacyAudit.summary?.risk === 'PASS' ? 'READY' : 'REVIEW', 'See docs/data-flow-privacy-audit.md before confirming no data collection, no account, no analytics, and no user-generated content.'),
      field('Tracking / IDFA', 'Match final AdMob SDK behavior and ATT decision.', 'MANUAL', 'The app requests non-personalized rewarded ads by default, but final App Store answers must match the production SDK report.'),
      field('Export compliance', 'ITSAppUsesNonExemptEncryption=false', 'READY', 'app.json declares no non-exempt encryption. Recheck if native dependencies change.'),
    ]),
    section('review-submission', 'Review And Submission', [
      field('Review contact', reviewContactRow?.detail ?? 'Missing', reviewContactRow?.status ?? 'TODO', 'Fill APP_STORE_REVIEW_* values before metadata push.'),
      field('Review notes', reviewGuide.review?.reviewNotes, 'READY', 'No login or demo account required.'),
      field('Screenshots', `${productionSmokeTest.evidence?.screenshotEntries ?? 0} generated screenshot entries; QA risk ${screenshotQaAudit.summary?.risk ?? 'UNKNOWN'}`, screenshotQaAudit.summary?.risk === 'PASS' ? 'READY' : 'REVIEW', 'Upload localized screenshot packs from assets/store/ios-localized; see docs/screenshot-qa-audit.md before uploading.'),
      field('Production device test', productionDeviceRow?.detail ?? 'Missing', productionDeviceRow?.status ?? 'TODO', 'Complete docs/production-device-smoke-test.md on the exact submitted build.'),
      field('Final strict gate', 'npm run release:store-ready', externalReadiness.summary?.blocking === 0 ? 'READY' : 'TODO', 'Must pass before metadata push, production build, and submit.'),
    ]),
  ],
  finalCommands: [
    'npm run release:verify',
    'npm run release:store-ready',
    'npm run metadata:ios',
    'npm run build:ios',
    'npm run submit:ios',
  ],
};

fs.writeFileSync(jsonPath, `${JSON.stringify(checklist, null, 2)}\n`);
fs.writeFileSync(markdownPath, renderMarkdown(checklist));
console.log(`generated ${path.relative(root, markdownPath)} and ${path.relative(root, jsonPath)}`);

function section(id, title, fields) {
  return { id, title, fields };
}

function field(label, value, status, note) {
  return { label, value: value ?? null, status, note };
}

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

function findRow(label) {
  return (releaseStatus.rows ?? []).find((row) => row.label === label);
}

function readOptionalJson(relativePath) {
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) return null;

  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function renderMarkdown(values) {
  const references = values.officialReferences
    .map((entry) => `- ${entry.label}: ${entry.url}\n  Reason: ${entry.reason}`)
    .join('\n');
  const sections = values.sections.map(renderSection).join('\n\n');
  const commands = values.finalCommands.map((command, index) => `${index + 1}. ${command}`).join('\n');

  return `# App Store Connect Checklist

Use this file while filling App Store Connect fields that are not fully automated by EAS Metadata. Final answers must match the exact submitted build.

## App

- Name: ${values.app.name}
- Version: ${values.app.version}
- Bundle ID: ${values.app.bundleIdentifier}
- Build number: ${values.app.buildNumber}
- Expo: ${values.app.expo}
- React Native: ${values.app.reactNative}
- Encryption: ${values.app.encryption}

## Metadata Snapshot

- Locales: ${values.metadata.locales.join(', ')}
- Default locale: ${values.metadata.defaultLocale}
- Categories: ${JSON.stringify(values.metadata.categories)}
- Copyright: ${values.metadata.copyright}
- Review contact ready: ${values.metadata.reviewContactReady ? 'Yes' : 'No'}
- Support URLs ready: ${values.metadata.supportReady ? 'Yes' : 'No'}
- Privacy URLs ready: ${values.metadata.privacyReady ? 'Yes' : 'No'}
- Screenshot entries: ${values.metadata.screenshotEntries}
- Screenshot QA audit: ${values.metadata.screenshotQaAudit}
- Screenshot QA risk: ${values.metadata.screenshotQaRisk}
- Screenshot QA ready: ${values.metadata.screenshotQaReady ? 'Yes' : 'No'}
- Screenshot QA localized distinct: ${values.metadata.screenshotQaLocalizedDistinct ? 'Yes' : 'No'}
- Screenshot QA unexpected duplicate groups: ${values.metadata.screenshotQaUnexpectedDuplicateGroups}
- App Store copy audit: ${values.metadata.appStoreCopyAudit}
- App Store copy risk: ${values.metadata.appStoreCopyRisk}
- App Store copy ready locales: ${values.metadata.appStoreCopyReadyLocales}/${values.metadata.appStoreCopyLocales}
- App Store copy keyword format ready: ${values.metadata.appStoreCopyKeywordFormatReady ? 'Yes' : 'No'}
- App Store copy keyword byte limit ready: ${values.metadata.appStoreCopyKeywordsByteLimitReady ? 'Yes' : 'No'}
- App Store copy protected terms clear: ${values.metadata.appStoreCopyNoProtectedTerms ? 'Yes' : 'No'}
- Metadata upload packet: ${values.metadata.metadataUploadPacket}
- Metadata upload packet risk: ${values.metadata.metadataUploadPacketRisk}
- Metadata upload packet local ready: ${values.metadata.metadataUploadPacketLocalReady ? 'Yes' : 'No'}
- Metadata upload packet fields: ${values.metadata.metadataUploadPacketFieldReadyLocales}/${values.metadata.locales.length}
- Metadata upload packet screenshots: ${values.metadata.metadataUploadPacketScreenshotReadyLocales}/${values.metadata.locales.length}
- Metadata upload packet support URLs: ${values.metadata.metadataUploadPacketSupportUrlReadyLocales}/${values.metadata.locales.length}
- Metadata upload packet privacy URLs: ${values.metadata.metadataUploadPacketPrivacyUrlReadyLocales}/${values.metadata.locales.length}
- Localization audit: ${values.metadata.localizationAudit}
- Localization risk: ${values.metadata.localizationRisk}
- Localization UI locales: ${values.metadata.localizationUiLocales}
- Localization App Store locales: ${values.metadata.localizationAppStoreLocales}
- Localization screenshot entries: ${values.metadata.localizationScreenshotEntries}
- Runtime UI flow audit: ${values.metadata.runtimeUiFlowAudit}
- Runtime UI flow risk: ${values.metadata.runtimeUiFlowRisk}
- Runtime UI flow ready: ${values.metadata.runtimeUiFlowReady ? 'Yes' : 'No'}
- Runtime UI flow checks: ${values.metadata.runtimeUiFlowPassedChecks}/${values.metadata.runtimeUiFlowChecks}
- Runtime UI flow failures: ${values.metadata.runtimeUiFlowRequiredFailures}
- Public site deploy audit: ${values.metadata.publicSiteDeployAudit}
- Public site deploy risk: ${values.metadata.publicSiteDeployRisk}
- Public site local package ready: ${values.metadata.publicSiteLocalReady ? 'Yes' : 'No'}
- Public site external hosting ready: ${values.metadata.publicSiteHostingReady ? 'Yes' : 'No'}
- Public site hosting verification: ${values.metadata.publicSiteHostingVerification}
- Public site hosting verification status: ${values.metadata.publicSiteHostingVerificationStatus}
- Public site hosting verification ready: ${values.metadata.publicSiteHostingVerificationReady ? 'Yes' : 'No'}
- Public site hosting verification checks: ${values.metadata.publicSiteHostingVerificationPassedUrls}/${values.metadata.publicSiteHostingVerificationCheckedUrls}
- Public site hosting verification failures: ${values.metadata.publicSiteHostingVerificationFailedUrls}
- Age rating audit: ${values.metadata.ageRatingAudit}
- Age rating risk: ${values.metadata.ageRatingRisk}
- Age rating suggested Apple global rating: ${values.metadata.ageRatingSuggestedAppleGlobalRating}
- Age rating NONE answers: ${values.metadata.ageRatingFrequencyNoneAnswers}/${values.metadata.ageRatingFrequencyQuestions}
- Study bank depth audit: ${values.metadata.studyBankDepthAudit}
- Study bank depth risk: ${values.metadata.studyBankDepthRisk}
- Study bank levels: ${values.metadata.studyBankDepthLevels}
- Study bank topic families: ${values.metadata.studyBankDepthTopics}
- Study bank progression passed: ${values.metadata.studyBankDepthProgression ? 'Yes' : 'No'}
- Study content localization audit: ${values.metadata.studyContentLocalizationAudit}
- Study content localization risk: ${values.metadata.studyContentLocalizationRisk}
- Study content localization locales: ${values.metadata.studyContentLocalizationLocales}
- Study content localization items: ${values.metadata.studyContentLocalizationItems}
- Study content localization text keys: ${values.metadata.studyContentLocalizationTextKeys}
- Study content localized fields: ${values.metadata.studyContentLocalizedFields}/${values.metadata.studyContentExpectedFields}
- Study content translation entries: ${values.metadata.studyContentTranslationEntries}/${values.metadata.studyContentExpectedTranslationEntries}
- Study content missing fields: ${values.metadata.studyContentMissingLocalizedFields}
- Study content missing translations: ${values.metadata.studyContentMissingTranslationEntries}
- Content rights audit: ${values.metadata.contentRightsAudit}
- Protected IP term hits: ${values.metadata.protectedIpTermHits}
- Privacy manifest audit: ${values.metadata.privacyManifestAudit}
- Privacy manifest risk: ${values.metadata.privacyManifestRisk}
- Privacy manifest tracking: ${values.metadata.privacyManifestTracking ? 'Yes' : 'No'}
- Privacy manifest collected data types: ${values.metadata.privacyManifestCollectedDataTypes}
- App Store privacy answers: ${values.metadata.privacyAnswers}
- Privacy answer risk: ${values.metadata.privacyAnswersRisk}
- Privacy answer current state: ${values.metadata.privacyAnswersCurrentState}
- App-code personal data collection: ${values.metadata.privacyAnswersAppCodeCollectsPersonalData ? 'Yes' : 'No'}
- Privacy review packet: ${values.metadata.privacyReviewPacket}
- Privacy review packet risk: ${values.metadata.privacyReviewPacketRisk}
- Privacy review packet local ready: ${values.metadata.privacyReviewPacketLocalReady ? 'Yes' : 'No'}
- Privacy review packet current state: ${values.metadata.privacyReviewPacketCurrentState}
- Privacy review final confirmation: ${values.metadata.privacyReviewPacketFinalReviewConfirmed ? 'Yes' : 'No'}
- Privacy review no-live rows: ${values.metadata.privacyReviewPacketNoLiveAdsSuggestedRows}
- Privacy review live-AdMob rows: ${values.metadata.privacyReviewPacketLiveAdMobDisclosureRows}
- AdMob release audit: ${values.metadata.admobReleaseAudit}
- AdMob release risk: ${values.metadata.admobReleaseRisk}
- AdMob release current state: ${values.metadata.admobReleaseCurrentState}
- AdMob local integration ready: ${values.metadata.admobReleaseLocalReady ? 'Yes' : 'No'}
- AdMob live ads ready: ${values.metadata.admobReleaseLiveAdsReady ? 'Yes' : 'No'}
- AdMob external setup ready: ${values.metadata.admobReleaseExternalReady ? 'Yes' : 'No'}
- Data flow privacy audit: ${values.metadata.dataFlowPrivacyAudit}
- Data flow privacy risk: ${values.metadata.dataFlowPrivacyRisk}
- Data flow local posture ready: ${values.metadata.dataFlowPrivacyLocalReady ? 'Yes' : 'No'}
- App-owned network request hits: ${values.metadata.dataFlowAppOwnedNetworkRequests}
- Analytics SDK hits: ${values.metadata.dataFlowAnalyticsSdkCount}
- Auth SDK hits: ${values.metadata.dataFlowAuthSdkCount}

## Official References

${references}

## Suggested Answers

- Study bank depth: ${values.suggestedAnswers.appInformation.studyBankDepth}
- Study content localization: ${values.suggestedAnswers.appInformation.studyContentLocalization}
- Content rights: ${values.suggestedAnswers.appInformation.contentRights}
- Expected age rating: ${values.suggestedAnswers.ageRating.expected}
- Age rating audit: ${values.suggestedAnswers.ageRating.auditPath} (${values.suggestedAnswers.ageRating.risk})
- No-live-ads privacy state: ${values.suggestedAnswers.privacy.noLiveAdsState}
- Privacy manifest audit: ${values.suggestedAnswers.privacy.privacyManifestAudit} (${values.suggestedAnswers.privacy.privacyManifestRisk})
- Privacy answers: ${values.suggestedAnswers.privacy.privacyAnswers} (${values.suggestedAnswers.privacy.privacyAnswersRisk}, ${values.suggestedAnswers.privacy.currentBuildState})
- Privacy review packet: ${values.suggestedAnswers.privacy.privacyReviewPacket} (${values.suggestedAnswers.privacy.privacyReviewPacketRisk})
- AdMob release audit: ${values.suggestedAnswers.privacy.admobReleaseAudit} (${values.suggestedAnswers.privacy.admobReleaseRisk})
- Data flow privacy audit: ${values.suggestedAnswers.privacy.dataFlowPrivacyAudit} (${values.suggestedAnswers.privacy.dataFlowPrivacyRisk})
- Runtime UI flow audit: ${values.suggestedAnswers.review.runtimeUiFlowAudit} (${values.suggestedAnswers.review.runtimeUiFlowReady ? 'ready' : 'review'})
- Live-AdMob privacy state: ${values.suggestedAnswers.privacy.liveAdsState}
- Export compliance: ${values.suggestedAnswers.compliance.exportCompliance}
- Tracking / IDFA: ${values.suggestedAnswers.compliance.tracking}

## Fields

${sections}

## Final Command Order

${commands}
`;
}

function renderSection(sectionValue) {
  const rows = sectionValue.fields
    .map((entry) => `| ${escapeCell(entry.label)} | ${escapeCell(entry.value)} | ${escapeCell(entry.status)} | ${escapeCell(entry.note)} |`)
    .join('\n');

  return `### ${sectionValue.title}

| Field | Value | Status | Note |
| --- | --- | --- | --- |
${rows}`;
}

function escapeCell(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}
