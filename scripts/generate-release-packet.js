const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const jsonPath = path.join(root, 'docs/release-packet.json');
const markdownPath = path.join(root, 'docs/release-packet.md');
const appJson = require('../app.json').expo;
const packageJson = require('../package.json');
const metadataPreview = require('../docs/app-store-metadata-preview.json');
const runtimeAssetManifest = require('../docs/runtime-asset-manifest.json');
const screenshotManifest = require('../docs/app-store-screenshot-manifest.json');
const screenshotQaAudit = readJson('docs/screenshot-qa-audit.json') ?? {};
const appStoreCopyAudit = readJson('docs/app-store-copy-audit.json') ?? {};
const metadataUploadPacket = readJson('docs/app-store-metadata-upload-packet.json') ?? {};
const publicSiteManifest = require('../docs/public-site-manifest.json');
const publicSiteDeployAudit = readJson('docs/public-site-deploy-audit.json') ?? {};
const publicSiteHostingVerification = readJson('docs/public-site-hosting-verification.json') ?? {};
const reviewGuide = require('../docs/app-store-review-guide.json');
const localizationAudit = readJson('docs/localization-audit.json') ?? {};
const ageRatingAudit = readJson('docs/app-store-age-rating-audit.json') ?? {};
const studyBankDepthAudit = readJson('docs/study-bank-depth-audit.json') ?? {};
const studyContentLocalizationAudit = readJson('docs/study-content-localization-audit.json') ?? {};
const contentRightsAudit = readJson('docs/content-rights-audit.json') ?? {};
const openSourceLicenseAudit = readJson('docs/open-source-license-audit.json') ?? {};
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
const gameData = loadTsModule('src/gameData.ts');
const releaseStatus = readReleaseStatus();

const screenshotEntries =
  (screenshotManifest.defaultPack?.screenshots ?? []).length +
  (screenshotManifest.localizedPacks ?? []).reduce((sum, pack) => sum + (pack.screenshots?.length ?? 0), 0);
const levels = gameData.JLPT_LEVELS;
const studyBank = {
  kana: gameData.KANA_ITEMS.length,
  totalVocabulary: gameData.VOCAB_ITEMS.length,
  totalLines: gameData.LINE_ITEMS.length,
  totalGrammar: gameData.GRAMMAR_ITEMS.length,
  levels: Object.fromEntries(levels.map((level) => [level, gameData.getLevelStudyStats(level)])),
};
const localEvidence = releaseStatus.rows.filter((row) => row.category === 'local');
const localBlockers = localEvidence.filter(isBlockingRow);
const externalItems = releaseStatus.rows.filter((row) => row.category === 'external' && isBlockingRow(row));

const packet = {
  schemaVersion: 1,
  source: 'scripts/generate-release-packet.js',
  app: {
    name: appJson.name,
    version: appJson.version,
    slug: appJson.slug,
    scheme: appJson.scheme,
    bundleIdentifier: appJson.ios?.bundleIdentifier,
    packageName: appJson.android?.package,
    supportsTablet: Boolean(appJson.ios?.supportsTablet),
    node: packageJson.engines?.node,
    expo: packageJson.dependencies?.expo,
    reactNative: packageJson.dependencies?.['react-native'],
  },
  localization: {
    appLocales: Object.keys(appJson.locales ?? {}),
    appStoreLocales: metadataPreview.locales?.map((locale) => locale.appStoreLocale) ?? [],
    japaneseUiLocaleRemoved: !Object.prototype.hasOwnProperty.call(appJson.locales ?? {}, 'ja'),
  },
  content: {
    studyBank,
    modes: ['mix', 'kana', 'vocab', 'lines', 'grammar'],
    originalAnimeStyleLines: true,
    studyBankDepthVerified: studyBankDepthAudit.summary?.risk === 'PASS',
    studyContentLocalizationVerified: studyContentLocalizationAudit.summary?.risk === 'PASS',
    noKnownProtectedIpReferences: contentRightsAudit.summary?.protectedIpTermHits === 0,
  },
  artifacts: {
    runtimeAssetManifest: {
      path: 'docs/runtime-asset-manifest.json',
      pngAssets: runtimeAssetManifest.summary?.pngCount ?? 0,
      audioAssets: runtimeAssetManifest.summary?.audioCount ?? 0,
      bytes: runtimeAssetManifest.summary?.totalBytes ?? 0,
    },
    runtimeUiFlowAudit: {
      path: 'docs/runtime-ui-flow-audit.md',
      risk: runtimeUiFlowAudit.summary?.risk,
      localReady: runtimeUiFlowAudit.summary?.localReady,
      checks: runtimeUiFlowAudit.summary?.checks,
      passedChecks: runtimeUiFlowAudit.summary?.passedChecks,
      requiredFlowFailures: runtimeUiFlowAudit.summary?.requiredFlowFailures,
      locales: runtimeUiFlowAudit.summary?.locales,
      levels: runtimeUiFlowAudit.summary?.levels,
      modes: runtimeUiFlowAudit.summary?.modes,
    },
    publicSiteManifest: {
      path: 'docs/public-site-manifest.json',
      pages: publicSiteManifest.pageCount,
      locales: publicSiteManifest.locales ?? [],
    },
    publicSiteDeployAudit: {
      path: 'docs/public-site-deploy-audit.md',
      risk: publicSiteDeployAudit.summary?.risk,
      localReady: publicSiteDeployAudit.summary?.localReady,
      hostingReady: publicSiteDeployAudit.summary?.hostingReady,
      routes: publicSiteDeployAudit.summary?.routeCount,
      supportUrlReady: publicSiteDeployAudit.summary?.supportUrlReady,
      privacyUrlReady: publicSiteDeployAudit.summary?.privacyUrlReady,
      hostingControlFilesReady: publicSiteDeployAudit.summary?.hostingControlFilesReady,
      sitemapReady: publicSiteDeployAudit.summary?.sitemapReady,
    },
    publicSiteHostingVerification: {
      path: 'docs/public-site-hosting-verification.md',
      status: publicSiteHostingVerification.summary?.status,
      ready: publicSiteHostingVerification.summary?.ready,
      checkedUrls: publicSiteHostingVerification.summary?.checkedUrls,
      passedUrls: publicSiteHostingVerification.summary?.passedUrls,
      failedUrls: publicSiteHostingVerification.summary?.failedUrls,
      hasProductionBaseUrl: publicSiteHostingVerification.summary?.hasProductionBaseUrl,
    },
    screenshotManifest: {
      path: 'docs/app-store-screenshot-manifest.json',
      platform: screenshotManifest.platform,
      entries: screenshotEntries,
      localizedPacks: screenshotManifest.localizedPacks?.length ?? 0,
    },
    screenshotQaAudit: {
      path: 'docs/screenshot-qa-audit.md',
      risk: screenshotQaAudit.summary?.risk,
      entries: screenshotQaAudit.summary?.totalScreenshots,
      allScreenshotsReady: screenshotQaAudit.summary?.allScreenshotsReady,
      localizedNonEnglishDistinctFromDefault: screenshotQaAudit.summary?.localizedNonEnglishDistinctFromDefault,
      unexpectedDuplicateGroups: screenshotQaAudit.summary?.unexpectedDuplicateGroups,
    },
    metadataPreview: {
      path: 'docs/app-store-metadata-preview.json',
      locales: metadataPreview.locales?.length ?? 0,
      reviewContactReady: Boolean(metadataPreview.app?.reviewContactReady),
    },
    appStoreCopyAudit: {
      path: 'docs/app-store-copy-audit.md',
      risk: appStoreCopyAudit.summary?.risk,
      readyLocales: appStoreCopyAudit.summary?.readyLocales,
      locales: appStoreCopyAudit.summary?.locales,
      keywordFormatReady: appStoreCopyAudit.summary?.keywordFormatReady,
      keywordsByteLimitReady: appStoreCopyAudit.summary?.keywordsByteLimitReady,
      noProtectedTermHits: appStoreCopyAudit.summary?.noProtectedTermHits,
    },
    metadataUploadPacket: {
      path: 'docs/app-store-metadata-upload-packet.md',
      risk: metadataUploadPacket.summary?.risk,
      localReady: metadataUploadPacket.summary?.localReady,
      locales: metadataUploadPacket.summary?.locales,
      fieldReadyLocales: metadataUploadPacket.summary?.fieldReadyLocales,
      screenshotReadyLocales: metadataUploadPacket.summary?.screenshotReadyLocales,
      supportUrlReadyLocales: metadataUploadPacket.summary?.supportUrlReadyLocales,
      privacyUrlReadyLocales: metadataUploadPacket.summary?.privacyUrlReadyLocales,
      copyAuditRisk: metadataUploadPacket.summary?.copyAuditRisk,
    },
    localizationAudit: {
      path: 'docs/localization-audit.md',
      risk: localizationAudit.summary?.risk,
      uiLocales: localizationAudit.summary?.uiLocales,
      appStoreLocales: localizationAudit.summary?.appStoreLocales,
      localizedScreenshotEntries: localizationAudit.summary?.localizedScreenshotEntries,
      publicSitePages: localizationAudit.summary?.publicSitePages,
      japaneseUiLocaleRemoved: localizationAudit.summary?.japaneseUiLocaleRemoved,
    },
    reviewGuide: {
      path: 'docs/app-store-review-guide.md',
      demoAccountRequired: reviewGuide.review?.demoAccountRequired,
      signInRequired: reviewGuide.review?.signInRequired,
    },
    ageRatingAudit: {
      path: 'docs/app-store-age-rating-audit.md',
      risk: ageRatingAudit.summary?.risk,
      suggestedAppleGlobalRating: ageRatingAudit.summary?.suggestedAppleGlobalRating,
      frequencyNoneAnswers: ageRatingAudit.summary?.frequencyNoneAnswers,
      frequencyQuestions: ageRatingAudit.summary?.frequencyQuestions,
      finalRatingSource: ageRatingAudit.summary?.finalRatingSource,
    },
    studyBankDepthAudit: {
      path: 'docs/study-bank-depth-audit.md',
      risk: studyBankDepthAudit.summary?.risk,
      levels: studyBankDepthAudit.summary?.levels,
      topicFamilies: studyBankDepthAudit.summary?.totalTopics,
      playableMeaningPrompts: studyBankDepthAudit.summary?.playableMeaningPrompts,
      difficultyProgressionPassed: studyBankDepthAudit.difficultyProgression?.passed,
    },
    studyContentLocalizationAudit: {
      path: 'docs/study-content-localization-audit.md',
      risk: studyContentLocalizationAudit.summary?.risk,
      locales: studyContentLocalizationAudit.summary?.expectedLocales,
      studyItems: studyContentLocalizationAudit.summary?.totalStudyItems,
      studyTextKeys: studyContentLocalizationAudit.summary?.studyTextKeys,
      localizedFieldsReady: studyContentLocalizationAudit.summary?.localizedFieldsReady,
      expectedLocalizedFields: studyContentLocalizationAudit.summary?.expectedLocalizedFields,
      contentTranslationEntriesReady: studyContentLocalizationAudit.summary?.contentTranslationEntriesReady,
      expectedContentTranslationEntries: studyContentLocalizationAudit.summary?.expectedContentTranslationEntries,
      missingLocalizedFields: studyContentLocalizationAudit.summary?.missingLocalizedFields,
      missingTranslationEntries: studyContentLocalizationAudit.summary?.missingTranslationEntries,
    },
    contentRightsAudit: {
      path: 'docs/content-rights-audit.md',
      risk: contentRightsAudit.summary?.risk,
      protectedIpTermHits: contentRightsAudit.summary?.protectedIpTermHits ?? 0,
      originalAnimeStyleLinePrompts: contentRightsAudit.summary?.originalAnimeStyleLinePrompts ?? 0,
    },
    openSourceLicenseAudit: {
      path: 'docs/open-source-license-audit.md',
      risk: openSourceLicenseAudit.summary?.risk,
      runtimePackages: openSourceLicenseAudit.summary?.runtimePackages ?? 0,
      unknownRuntimeLicenses: openSourceLicenseAudit.summary?.unknownRuntimeLicenses ?? 0,
      prohibitedRuntimeLicenses: openSourceLicenseAudit.summary?.prohibitedRuntimeLicenses ?? 0,
      reviewRuntimeLicenses: openSourceLicenseAudit.summary?.reviewRuntimeLicenses ?? 0,
    },
    privacyManifestAudit: {
      path: 'docs/privacy-manifest-audit.md',
      risk: privacyManifestAudit.summary?.risk,
      tracking: privacyManifestAudit.summary?.tracking,
      collectedDataTypes: privacyManifestAudit.summary?.collectedDataTypes,
      requiredReasonApisReady: privacyManifestAudit.summary?.requiredReasonApisReady,
    },
    privacyAnswers: {
      path: 'docs/app-store-privacy-answers.md',
      risk: privacyAnswers.summary?.risk,
      currentState: privacyAnswers.summary?.currentState,
      appCodeCollectsPersonalData: privacyAnswers.summary?.appCodeCollectsPersonalData,
      noLiveAdsRows: privacyAnswers.noLiveAdsAnswers?.appStoreConnect?.length ?? 0,
      liveAdMobDisclosureRows: privacyAnswers.liveAdMobAnswers?.likelyGoogleMobileAdsDataTypes?.length ?? 0,
      confirmationEnv: privacyAnswers.summary?.confirmationEnv,
    },
    privacyReviewPacket: {
      path: 'docs/privacy-review-packet.md',
      risk: privacyReviewPacket.summary?.risk,
      localReady: privacyReviewPacket.summary?.localReady,
      currentState: privacyReviewPacket.summary?.currentState,
      finalReviewConfirmed: privacyReviewPacket.summary?.finalReviewConfirmed,
      noLiveAdsSuggestedRows: privacyReviewPacket.summary?.noLiveAdsSuggestedRows,
      liveAdMobDisclosureRows: privacyReviewPacket.summary?.liveAdMobDisclosureRows,
      appOwnedNetworkRequests: privacyReviewPacket.summary?.appOwnedNetworkRequests,
      analyticsSdkCount: privacyReviewPacket.summary?.analyticsSdkCount,
      authSdkCount: privacyReviewPacket.summary?.authSdkCount,
      userContentEntryCount: privacyReviewPacket.summary?.userContentEntryCount,
    },
    admobReleaseAudit: {
      path: 'docs/admob-release-audit.md',
      risk: admobReleaseAudit.summary?.risk,
      currentState: admobReleaseAudit.summary?.currentState,
      localReady: admobReleaseAudit.summary?.localReady,
      liveAdsReady: admobReleaseAudit.summary?.liveAdsReady,
      externalReady: admobReleaseAudit.summary?.externalReady,
      externalBlockingItems: admobReleaseAudit.summary?.externalBlockingItems,
    },
    dataFlowPrivacyAudit: {
      path: 'docs/data-flow-privacy-audit.md',
      risk: dataFlowPrivacyAudit.summary?.risk,
      localReady: dataFlowPrivacyAudit.summary?.localReady,
      appOwnedNetworkRequests: dataFlowPrivacyAudit.summary?.appOwnedNetworkRequests,
      analyticsSdkCount: dataFlowPrivacyAudit.summary?.analyticsSdkCount,
      authSdkCount: dataFlowPrivacyAudit.summary?.authSdkCount,
      userContentEntryCount: dataFlowPrivacyAudit.summary?.userContentEntryCount,
      localStorageKeys: dataFlowPrivacyAudit.summary?.localStorageKeys,
    },
    productionSmokeTest: {
      path: 'docs/production-device-smoke-test.md',
      sections: productionSmokeTest.sections?.length ?? 0,
      items: (productionSmokeTest.sections ?? []).reduce((sum, section) => sum + (section.items?.length ?? 0), 0),
      finalConfirmation: productionSmokeTest.finalConfirmation?.env,
    },
    externalReadiness: {
      path: 'docs/external-readiness.md',
      items: externalReadiness.summary?.total ?? 0,
      blocking: externalReadiness.summary?.blocking ?? 0,
    },
    easEnvironment: {
      path: 'docs/eas-env-checklist.md',
      keys: easEnvChecklist.summary?.totalKeys ?? 0,
      requiredForEasProduction: easEnvChecklist.summary?.requiredForEasProduction ?? 0,
      productionProfileEnvironment: easEnvChecklist.eas?.productionBuildProfile?.environment ?? null,
    },
    easBuildPreflight: {
      path: 'docs/eas-build-preflight.md',
      risk: easBuildPreflight.summary?.risk,
      localReady: easBuildPreflight.summary?.localReady,
      externalReady: easBuildPreflight.summary?.externalReady,
      productionProfileReady: easBuildPreflight.eas?.productionBuildProfile?.ready,
      submitProfileReady: easBuildPreflight.eas?.productionSubmitProfile?.ready,
      uploadPolicyReady: easBuildPreflight.uploadPolicy?.ready,
      externalBlockingItems: easBuildPreflight.summary?.externalBlockingItems,
    },
    appStoreConnectChecklist: {
      path: 'docs/app-store-connect-checklist.md',
      sections: appStoreConnectChecklist.sections?.length ?? 0,
      fields: (appStoreConnectChecklist.sections ?? []).reduce((sum, section) => sum + (section.fields?.length ?? 0), 0),
    },
  },
  releaseStatus,
  localEvidence,
  localBlockers,
  externalBlockers: externalItems.map((row) => ({
    status: row.status,
    category: row.category,
    label: row.label,
    detail: row.detail,
  })),
  commands: {
    verify: 'npm run release:verify',
    strictGate: 'npm run release:store-ready',
    metadata: 'npm run metadata:ios',
    build: 'npm run build:ios',
    submit: 'npm run submit:ios',
  },
};

fs.writeFileSync(jsonPath, `${JSON.stringify(packet, null, 2)}\n`);
fs.writeFileSync(markdownPath, renderMarkdown(packet));
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

function renderMarkdown(values) {
  const localEvidence = values.localEvidence.length > 0
    ? values.localEvidence.map((row) => `- [${row.status}] ${row.label}: ${row.detail}`).join('\n')
    : '- No local evidence rows were reported by release:status.';
  const localBlockers = values.localBlockers.length > 0
    ? values.localBlockers.map((row) => `- [${row.status}] ${row.label}: ${row.detail}`).join('\n')
    : '- None.';
  const blockers = values.externalBlockers.length > 0
    ? values.externalBlockers.map((row) => `- [${row.status}] ${row.label}: ${row.detail}`).join('\n')
    : '- None. Strict store-ready gate can run.';
  const levelRows = Object.entries(values.content.studyBank.levels)
    .map(([level, stats]) => `| ${level} | ${stats.kana} | ${stats.vocab} | ${stats.lines} | ${stats.grammar} |`)
    .join('\n');

  return `# Kana Sprint Release Packet

## App

- Name: ${values.app.name}
- Version: ${values.app.version}
- SDK packages: Expo ${values.app.expo}, React Native ${values.app.reactNative}
- iOS bundle ID: ${values.app.bundleIdentifier}
- Android package: ${values.app.packageName}
- UI locales: ${values.localization.appLocales.join(', ')}
- App Store locales: ${values.localization.appStoreLocales.join(', ')}
- Japanese UI locale removed: ${values.localization.japaneseUiLocaleRemoved ? 'Yes' : 'No'}

## Content

- Modes: ${values.content.modes.join(', ')}
- Kana prompts: ${values.content.studyBank.kana}
- Vocabulary prompts: ${values.content.studyBank.totalVocabulary}
- Original anime-style line prompts: ${values.content.studyBank.totalLines}
- Grammar prompts: ${values.content.studyBank.totalGrammar}

| Level | Kana | Vocabulary | Lines | Grammar |
| --- | ---: | ---: | ---: | ---: |
${levelRows}

## Release Artifacts

- Public site pages: ${values.artifacts.publicSiteManifest.pages} (${values.artifacts.publicSiteManifest.path})
- Public site deploy audit: ${values.artifacts.publicSiteDeployAudit.risk}, local ready=${values.artifacts.publicSiteDeployAudit.localReady ? 'yes' : 'no'}, control files ready=${values.artifacts.publicSiteDeployAudit.hostingControlFilesReady ? 'yes' : 'no'}, sitemap ready=${values.artifacts.publicSiteDeployAudit.sitemapReady ? 'yes' : 'no'}, hosting ready=${values.artifacts.publicSiteDeployAudit.hostingReady ? 'yes' : 'no'} (${values.artifacts.publicSiteDeployAudit.path})
- Public site hosting verification: ${values.artifacts.publicSiteHostingVerification.status}, ready=${values.artifacts.publicSiteHostingVerification.ready ? 'yes' : 'no'}, checks=${values.artifacts.publicSiteHostingVerification.passedUrls}/${values.artifacts.publicSiteHostingVerification.checkedUrls}, failures=${values.artifacts.publicSiteHostingVerification.failedUrls} (${values.artifacts.publicSiteHostingVerification.path})
- Runtime assets: ${values.artifacts.runtimeAssetManifest.pngAssets} PNG / ${values.artifacts.runtimeAssetManifest.audioAssets} audio (${values.artifacts.runtimeAssetManifest.path})
- Runtime UI flow audit: ${values.artifacts.runtimeUiFlowAudit.risk}, ready=${values.artifacts.runtimeUiFlowAudit.localReady ? 'yes' : 'no'}, checks=${values.artifacts.runtimeUiFlowAudit.passedChecks}/${values.artifacts.runtimeUiFlowAudit.checks}, failures=${values.artifacts.runtimeUiFlowAudit.requiredFlowFailures} (${values.artifacts.runtimeUiFlowAudit.path})
- App Store screenshots: ${values.artifacts.screenshotManifest.entries} (${values.artifacts.screenshotManifest.path})
- Screenshot QA audit: ${values.artifacts.screenshotQaAudit.risk}, ready=${values.artifacts.screenshotQaAudit.allScreenshotsReady ? 'yes' : 'no'}, localized distinct=${values.artifacts.screenshotQaAudit.localizedNonEnglishDistinctFromDefault ? 'yes' : 'no'} (${values.artifacts.screenshotQaAudit.path})
- Metadata locales: ${values.artifacts.metadataPreview.locales} (${values.artifacts.metadataPreview.path})
- App Store copy audit: ${values.artifacts.appStoreCopyAudit.risk}, ${values.artifacts.appStoreCopyAudit.readyLocales}/${values.artifacts.appStoreCopyAudit.locales} locales, keyword format=${values.artifacts.appStoreCopyAudit.keywordFormatReady ? 'ready' : 'review'}, protected terms=${values.artifacts.appStoreCopyAudit.noProtectedTermHits ? 'clear' : 'review'} (${values.artifacts.appStoreCopyAudit.path})
- App Store metadata upload packet: ${values.artifacts.metadataUploadPacket.risk}, fields=${values.artifacts.metadataUploadPacket.fieldReadyLocales}/${values.artifacts.metadataUploadPacket.locales}, screenshots=${values.artifacts.metadataUploadPacket.screenshotReadyLocales}/${values.artifacts.metadataUploadPacket.locales}, support URLs=${values.artifacts.metadataUploadPacket.supportUrlReadyLocales}/${values.artifacts.metadataUploadPacket.locales}, privacy URLs=${values.artifacts.metadataUploadPacket.privacyUrlReadyLocales}/${values.artifacts.metadataUploadPacket.locales} (${values.artifacts.metadataUploadPacket.path})
- Localization audit: ${values.artifacts.localizationAudit.risk}, ${values.artifacts.localizationAudit.uiLocales} UI locales / ${values.artifacts.localizationAudit.appStoreLocales} App Store locales / ${values.artifacts.localizationAudit.localizedScreenshotEntries} localized screenshots (${values.artifacts.localizationAudit.path})
- Review guide: ${values.artifacts.reviewGuide.path}
- Demo account required: ${values.artifacts.reviewGuide.demoAccountRequired ? 'Yes' : 'No'}
- Sign-in required: ${values.artifacts.reviewGuide.signInRequired ? 'Yes' : 'No'}
- Age rating audit: ${values.artifacts.ageRatingAudit.risk}, ${values.artifacts.ageRatingAudit.suggestedAppleGlobalRating}, ${values.artifacts.ageRatingAudit.frequencyNoneAnswers}/${values.artifacts.ageRatingAudit.frequencyQuestions} NONE answers (${values.artifacts.ageRatingAudit.path})
- Study bank depth audit: ${values.artifacts.studyBankDepthAudit.risk}, ${values.artifacts.studyBankDepthAudit.levels} levels / ${values.artifacts.studyBankDepthAudit.topicFamilies} topic families / progression=${values.artifacts.studyBankDepthAudit.difficultyProgressionPassed ? 'pass' : 'review'} (${values.artifacts.studyBankDepthAudit.path})
- Study content localization audit: ${values.artifacts.studyContentLocalizationAudit.risk}, ${values.artifacts.studyContentLocalizationAudit.studyItems} items / ${values.artifacts.studyContentLocalizationAudit.studyTextKeys} text keys / fields=${values.artifacts.studyContentLocalizationAudit.localizedFieldsReady}/${values.artifacts.studyContentLocalizationAudit.expectedLocalizedFields} / translations=${values.artifacts.studyContentLocalizationAudit.contentTranslationEntriesReady}/${values.artifacts.studyContentLocalizationAudit.expectedContentTranslationEntries} (${values.artifacts.studyContentLocalizationAudit.path})
- Content rights audit: ${values.artifacts.contentRightsAudit.risk}, ${values.artifacts.contentRightsAudit.protectedIpTermHits} protected-IP hits (${values.artifacts.contentRightsAudit.path})
- Open source license audit: ${values.artifacts.openSourceLicenseAudit.risk}, ${values.artifacts.openSourceLicenseAudit.runtimePackages} runtime packages, unknown=${values.artifacts.openSourceLicenseAudit.unknownRuntimeLicenses}, prohibited=${values.artifacts.openSourceLicenseAudit.prohibitedRuntimeLicenses}, notice/review=${values.artifacts.openSourceLicenseAudit.reviewRuntimeLicenses} (${values.artifacts.openSourceLicenseAudit.path})
- Privacy manifest audit: ${values.artifacts.privacyManifestAudit.risk}, tracking=${values.artifacts.privacyManifestAudit.tracking ? 'yes' : 'no'}, collected data types=${values.artifacts.privacyManifestAudit.collectedDataTypes} (${values.artifacts.privacyManifestAudit.path})
- App Store privacy answers: ${values.artifacts.privacyAnswers.risk}, state=${values.artifacts.privacyAnswers.currentState}, app-code data collection=${values.artifacts.privacyAnswers.appCodeCollectsPersonalData ? 'yes' : 'no'} (${values.artifacts.privacyAnswers.path})
- Privacy review packet: ${values.artifacts.privacyReviewPacket.risk}, ready=${values.artifacts.privacyReviewPacket.localReady ? 'yes' : 'no'}, state=${values.artifacts.privacyReviewPacket.currentState}, final review confirmed=${values.artifacts.privacyReviewPacket.finalReviewConfirmed ? 'yes' : 'no'}, network=${values.artifacts.privacyReviewPacket.appOwnedNetworkRequests}, analytics=${values.artifacts.privacyReviewPacket.analyticsSdkCount}, auth=${values.artifacts.privacyReviewPacket.authSdkCount} (${values.artifacts.privacyReviewPacket.path})
- AdMob release audit: ${values.artifacts.admobReleaseAudit.risk}, state=${values.artifacts.admobReleaseAudit.currentState}, live ads ready=${values.artifacts.admobReleaseAudit.liveAdsReady ? 'yes' : 'no'} (${values.artifacts.admobReleaseAudit.path})
- Data flow privacy audit: ${values.artifacts.dataFlowPrivacyAudit.risk}, app-owned network=${values.artifacts.dataFlowPrivacyAudit.appOwnedNetworkRequests}, analytics SDKs=${values.artifacts.dataFlowPrivacyAudit.analyticsSdkCount}, auth SDKs=${values.artifacts.dataFlowPrivacyAudit.authSdkCount} (${values.artifacts.dataFlowPrivacyAudit.path})
- Production device smoke test: ${values.artifacts.productionSmokeTest.items} items / ${values.artifacts.productionSmokeTest.sections} sections (${values.artifacts.productionSmokeTest.path})
- External readiness: ${values.artifacts.externalReadiness.items} items / ${values.artifacts.externalReadiness.blocking} blocking (${values.artifacts.externalReadiness.path})
- EAS environment: ${values.artifacts.easEnvironment.keys} keys / ${values.artifacts.easEnvironment.requiredForEasProduction} production-build values (${values.artifacts.easEnvironment.path})
- EAS build preflight: ${values.artifacts.easBuildPreflight.risk}, local ready=${values.artifacts.easBuildPreflight.localReady ? 'yes' : 'no'}, external ready=${values.artifacts.easBuildPreflight.externalReady ? 'yes' : 'no'} (${values.artifacts.easBuildPreflight.path})
- App Store Connect checklist: ${values.artifacts.appStoreConnectChecklist.fields} fields / ${values.artifacts.appStoreConnectChecklist.sections} sections (${values.artifacts.appStoreConnectChecklist.path})

## Current Release Status

- OK: ${values.releaseStatus.summary.ok}
- TODO: ${values.releaseStatus.summary.todo}
- BAD: ${values.releaseStatus.summary.bad}
- INFO: ${values.releaseStatus.summary.info}

## Local Release Evidence

${localEvidence}

## Local Items Before Store Submission

${localBlockers}

## External Items Before Store Submission

${blockers}

## Final Command Order

1. ${values.commands.verify}
2. ${values.commands.strictGate}
3. ${values.commands.metadata}
4. ${values.commands.build}
5. ${values.commands.submit}
`;
}

function isBlockingRow(row) {
  return row.status === 'TODO' || row.status === 'BAD';
}

function readJson(relativePath) {
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) return null;

  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
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
  const cache = new Map([[filePath, module]]);
  const localRequire = (request) => {
    if (request === 'expo-localization') {
      return { getLocales: () => [{ languageCode: 'en', languageTag: 'en-US' }] };
    }

    if (request.startsWith('.')) {
      return loadTsFile(path.resolve(path.dirname(filePath), request), cache);
    }

    return require(request);
  };

  const wrapped = new Function('require', 'module', 'exports', '__dirname', '__filename', output);
  wrapped(localRequire, module, module.exports, path.dirname(filePath), filePath);
  return module.exports;
}

function loadTsFile(filePath, cache) {
  const absolutePath = normalizeTsPath(filePath);
  if (cache.has(absolutePath)) return cache.get(absolutePath).exports;

  const source = fs.readFileSync(absolutePath, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: absolutePath,
  }).outputText;
  const module = { exports: {} };
  cache.set(absolutePath, module);
  const localRequire = (request) => {
    if (request === 'expo-localization') {
      return { getLocales: () => [{ languageCode: 'en', languageTag: 'en-US' }] };
    }

    if (request.startsWith('.')) {
      return loadTsFile(path.resolve(path.dirname(absolutePath), request), cache);
    }

    return require(request);
  };

  const wrapped = new Function('require', 'module', 'exports', '__dirname', '__filename', output);
  wrapped(localRequire, module, module.exports, path.dirname(absolutePath), absolutePath);
  return module.exports;
}

function normalizeTsPath(filePath) {
  if (fs.existsSync(filePath)) return filePath;
  if (fs.existsSync(`${filePath}.ts`)) return `${filePath}.ts`;
  if (fs.existsSync(`${filePath}.tsx`)) return `${filePath}.tsx`;
  if (fs.existsSync(path.join(filePath, 'index.ts'))) return path.join(filePath, 'index.ts');

  throw new Error(`Cannot resolve TypeScript module: ${filePath}`);
}
