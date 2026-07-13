const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const { loadLocalEnv } = require('./load-env');

const root = path.resolve(__dirname, '..');
loadLocalEnv();

const strictMode = process.argv.includes('--strict');
const jsonMode = process.argv.includes('--json');
const expectedLocales = ['zh-Hans', 'zh-Hant', 'en', 'fr', 'it', 'de', 'es-ES', 'ko', 'pl', 'pt-BR'];
const expectedJlptLevels = ['N5', 'N4', 'N3', 'N2', 'N1'];
const admobAppIdPattern = /^ca-app-pub-\d{16}~\d{10}$/;
const admobUnitIdPattern = /^ca-app-pub-\d{16}\/\d{10}$/;
const admobPlaceholderPattern = /^ca-app-pub-0{16}[~/]0{10}$/;
const admobDemoPublisherPattern = /^ca-app-pub-3940256099942544[~/]/;
const confirmationKeys = [
  'APP_STORE_BUNDLE_ID_CONFIRMED',
  'APP_STORE_CONNECT_RECORD_READY',
  'EAS_REMOTE_VERSION_INITIALIZED',
  'APP_STORE_PRIVACY_ANSWERS_REVIEWED',
  'ADMOB_PRIVACY_MESSAGES_CONFIGURED',
  'PRODUCTION_DEVICE_TESTED',
];
const reviewKeys = [
  'APP_STORE_REVIEW_FIRST_NAME',
  'APP_STORE_REVIEW_LAST_NAME',
  'APP_STORE_REVIEW_EMAIL',
  'APP_STORE_REVIEW_PHONE',
];
const adKeys = [
  'EXPO_PUBLIC_ADMOB_IOS_APP_ID',
  'EXPO_PUBLIC_ADMOB_ANDROID_APP_ID',
  'EXPO_PUBLIC_ADMOB_REWARDED_IOS_UNIT_ID',
  'EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_UNIT_ID',
];
const hasAnyAdEnv = adKeys.some((key) => Boolean(env(key)));
const rows = [];

addLocalEvidenceRows();
addPublicUrlRows();
addReviewRows();
addAdRows();
addConfirmationRows();

const summary = {
  ok: rows.filter((row) => row.status === 'OK').length,
  todo: rows.filter((row) => row.status === 'TODO').length,
  bad: rows.filter((row) => row.status === 'BAD').length,
  info: rows.filter((row) => row.status === 'INFO').length,
  categories: summarizeCategories(rows),
};

if (jsonMode) {
  console.log(JSON.stringify({ summary, rows }, null, 2));
} else {
  printRows();
}

if (strictMode && (summary.todo > 0 || summary.bad > 0)) {
  process.exit(1);
}

function addPublicUrlRows() {
  const baseUrl = trimTrailingSlash(env('APP_STORE_BASE_URL'));
  const supportUrl = env('APP_STORE_SUPPORT_URL') || joinUrl(baseUrl, 'support');
  const privacyUrl = env('APP_STORE_PRIVACY_URL') || joinUrl(baseUrl, 'privacy');
  const marketingUrl = env('APP_STORE_MARKETING_URL') || baseUrl;

  addUrlRow('Public support URL', supportUrl, 'Host site/ over HTTPS or set APP_STORE_SUPPORT_URL.', { requireLiveHosting: true });
  addUrlRow('Public privacy URL', privacyUrl, 'Host site/ over HTTPS or set APP_STORE_PRIVACY_URL.', { requireLiveHosting: true });

  if (marketingUrl) {
    addUrlRow('Public marketing URL', marketingUrl, 'Use APP_STORE_MARKETING_URL or APP_STORE_BASE_URL.');
  } else {
    add('INFO', 'Public marketing URL', 'Optional unless you want App Store metadata to include it.');
  }
}

function addReviewRows() {
  const hasReviewName = Boolean(env('APP_STORE_REVIEW_FIRST_NAME') && env('APP_STORE_REVIEW_LAST_NAME'));
  const hasReviewEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env('APP_STORE_REVIEW_EMAIL') ?? '');
  const hasReviewPhone = digits(env('APP_STORE_REVIEW_PHONE')).length >= 7;
  const missing = reviewKeys.filter((key) => !env(key));
  const invalid = [];

  if (env('APP_STORE_REVIEW_EMAIL') && !hasReviewEmail) invalid.push('APP_STORE_REVIEW_EMAIL');
  if (env('APP_STORE_REVIEW_PHONE') && !hasReviewPhone) invalid.push('APP_STORE_REVIEW_PHONE');

  if (invalid.length > 0) {
    add('BAD', 'App Store review contact', `Invalid: ${invalid.join(', ')}`);
    return;
  }

  add(hasReviewName && hasReviewEmail && hasReviewPhone, 'App Store review contact', missing.length > 0 ? `Missing: ${missing.join(', ')}` : 'Review contact fields look usable.');
}

function addAdRows() {
  const values = Object.fromEntries(adKeys.map((key) => [key, env(key)]));
  const valid = {
    EXPO_PUBLIC_ADMOB_IOS_APP_ID: isRealAdMobId(values.EXPO_PUBLIC_ADMOB_IOS_APP_ID, admobAppIdPattern),
    EXPO_PUBLIC_ADMOB_ANDROID_APP_ID: isRealAdMobId(values.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID, admobAppIdPattern),
    EXPO_PUBLIC_ADMOB_REWARDED_IOS_UNIT_ID: isRealAdMobId(values.EXPO_PUBLIC_ADMOB_REWARDED_IOS_UNIT_ID, admobUnitIdPattern),
    EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_UNIT_ID: isRealAdMobId(values.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_UNIT_ID, admobUnitIdPattern),
  };
  const invalid = Object.entries(valid)
    .filter(([, isValid]) => !isValid)
    .map(([key]) => key);

  if (!hasAnyAdEnv) {
    add('INFO', 'Live AdMob IDs', 'Optional for the NO_LIVE_ADS launch; rewarded ads stay disabled until all four production IDs are set.');
    return;
  }

  add(invalid.length === 0 ? 'OK' : 'BAD', 'Live AdMob IDs', invalid.length === 0 ? 'All four AdMob IDs match production ID formats.' : `Invalid, placeholder, demo, or missing: ${invalid.join(', ')}`);
}

function expectedEasProductionKeyCount() {
  const values = Object.fromEntries(adKeys.map((key) => [key, env(key)]));
  const liveAdsEnabled =
    isRealAdMobId(values.EXPO_PUBLIC_ADMOB_IOS_APP_ID, admobAppIdPattern) &&
    isRealAdMobId(values.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID, admobAppIdPattern) &&
    isRealAdMobId(values.EXPO_PUBLIC_ADMOB_REWARDED_IOS_UNIT_ID, admobUnitIdPattern) &&
    isRealAdMobId(values.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_UNIT_ID, admobUnitIdPattern);

  return liveAdsEnabled ? 7 : 3;
}

function addConfirmationRows() {
  for (const key of confirmationKeys) {
    if (key === 'ADMOB_PRIVACY_MESSAGES_CONFIGURED' && !hasAnyAdEnv) {
      add('INFO', key, 'Not required for the NO_LIVE_ADS launch; required before enabling production AdMob.');
      continue;
    }

    add(process.env[key] === '1', key, process.env[key] === '1' ? 'Confirmed.' : 'Set to 1 only after the real external action is complete.');
  }
}

function addLocalEvidenceRows() {
  addExpoBaselineRow();
  addReleaseCiWorkflowRow();
  addLocaleCoverageRow();
  addStudyBankRow();
  addManifestRow(
    'Study bank depth audit',
    'docs/study-bank-depth-audit.json',
    (manifest) =>
      manifest.summary?.risk === 'PASS' &&
      manifest.summary?.levels === expectedJlptLevels.length &&
      manifest.summary?.totalStudyItems >= 573 &&
      manifest.summary?.vocabularyPrompts >= 343 &&
      manifest.summary?.originalAnimeStyleLinePrompts >= 138 &&
      manifest.summary?.grammarPrompts >= 60 &&
      manifest.difficultyProgression?.passed === true &&
      manifest.summary?.duplicateIds === 0 &&
      manifest.summary?.duplicateDisplaysByLevel === 0,
    (manifest) =>
      `${manifest.summary?.totalStudyItems ?? 0} items, ${manifest.summary?.totalTopics ?? 0} topic families, N5-N1 progression verified.`,
  );
  addManifestRow(
    'Study content localization',
    'docs/study-content-localization-audit.json',
    (manifest) =>
      manifest.summary?.risk === 'PASS' &&
      manifest.summary?.expectedLocales === expectedLocales.length &&
      manifest.summary?.levels === expectedJlptLevels.length &&
      manifest.summary?.totalStudyItems >= 623 &&
      manifest.summary?.grammarPrompts >= 60 &&
      manifest.summary?.studyTextKeys >= 555 &&
      manifest.summary?.missingLocalizedFields === 0 &&
      manifest.summary?.missingTranslationEntries === 0 &&
      manifest.summary?.emptyTranslationEntries === 0 &&
      manifest.summary?.sixLocaleTranslationReady === true &&
      manifest.summary?.fullStudyItemLocaleFieldsReady === true,
    (manifest) =>
      `${manifest.summary?.totalStudyItems ?? 0} study items and ${manifest.summary?.studyTextKeys ?? 0} study text keys localized for ${manifest.summary?.expectedLocales ?? 0} UI locales.`,
  );
  addManifestRow(
    'Runtime assets',
    'docs/runtime-asset-manifest.json',
    (manifest) =>
      manifest.summary?.pngCount === 6 &&
      manifest.summary?.audioCount === 3 &&
      manifest.summary?.pronunciationCount === 853 &&
      manifest.pronunciationPack?.voiceCredit === 'VOICEVOX:四国めたん',
    (manifest) =>
      `${manifest.summary?.pngCount ?? 0} PNG assets, ${manifest.summary?.audioCount ?? 0} BGM tracks, and ${manifest.summary?.pronunciationCount ?? 0} offline pronunciations recorded.`,
  );
  addManifestRow(
    'Public support/privacy/license site',
    'docs/public-site-manifest.json',
    (manifest) => manifest.pageCount === 44 && sameSet(manifest.locales ?? [], expectedLocales),
    (manifest) => `${manifest.pageCount ?? 0} generated pages for ${manifest.locales?.length ?? 0} UI locales.`,
  );
  addManifestRow(
    'Public site deploy audit',
    'docs/public-site-deploy-audit.json',
    (manifest) =>
      manifest.summary?.risk === 'PASS' &&
      manifest.summary?.localReady === true &&
      manifest.summary?.routeCount === 44 &&
      manifest.summary?.locales === expectedLocales.length &&
      manifest.summary?.hostingControlFilesReady === true &&
      manifest.summary?.githubPagesWorkflowReady === true &&
      manifest.summary?.missingControlFiles === 0 &&
      manifest.deployRoot?.path === 'site',
    (manifest) =>
      `${manifest.summary?.routeCount ?? 0} routes plus hosting control files packaged; GitHub Pages workflow ready=${manifest.summary?.githubPagesWorkflowReady ? 'yes' : 'no'}, sitemap ready=${manifest.summary?.sitemapReady ? 'yes' : 'no'}, external hosting ready=${manifest.summary?.hostingReady ? 'yes' : 'no'}.`,
  );
  addManifestRow(
    'Public site hosting handoff',
    'docs/public-site-hosting-handoff.json',
    (manifest) =>
      manifest.summary?.risk === 'PASS' &&
      manifest.summary?.localReady === true &&
      manifest.summary?.routeCount === 44 &&
      manifest.summary?.locales === expectedLocales.length &&
      manifest.summary?.githubPagesWorkflowReady === true &&
      manifest.summary?.hostingControlFilesReady === true,
    (manifest) =>
      `${manifest.summary?.routeCount ?? 0} routes mapped to ${manifest.hostingOptions?.length ?? 0} hosting options; external hosting verified=${manifest.summary?.externalReady ? 'yes' : 'no'}.`,
  );
  addManifestRow(
    'App Store screenshots',
    'docs/app-store-screenshot-manifest.json',
    (manifest) => countScreenshots(manifest) === 176 && (manifest.localizedPacks ?? []).length === expectedLocales.length,
    (manifest) => `${countScreenshots(manifest)} screenshots across default and localized iOS packs.`,
  );
  addManifestRow(
    'App Store screenshot QA',
    'docs/screenshot-qa-audit.json',
    (manifest) =>
      manifest.summary?.risk === 'PASS' &&
      manifest.summary?.totalScreenshots === 176 &&
      manifest.summary?.allScreenshotsReady === true &&
      manifest.summary?.defaultEnglishPackMatchesLocalizedEnglish === true &&
      manifest.summary?.localizedNonEnglishDistinctFromDefault === true &&
      manifest.summary?.unexpectedDuplicateGroups === 0,
    (manifest) =>
      `${manifest.summary?.totalScreenshots ?? 0} screenshots QA-passed across ${manifest.summary?.locales ?? 0} localized upload packs.`,
  );
  addManifestRow(
    'App Store metadata preview',
    'docs/app-store-metadata-preview.json',
    (manifest) => (manifest.locales ?? []).length === expectedLocales.length,
    (manifest) => `${manifest.locales?.length ?? 0} App Store locales previewed.`,
  );
  addManifestRow(
    'App Store copy audit',
    'docs/app-store-copy-audit.json',
    (manifest) =>
      manifest.summary?.risk === 'PASS' &&
      manifest.summary?.locales === expectedLocales.length &&
      manifest.summary?.keywordsByteLimitReady === true &&
      manifest.summary?.keywordFormatReady === true &&
      manifest.summary?.noForbiddenClaims === true &&
      manifest.summary?.noProtectedTermHits === true &&
      manifest.summary?.coreFeatureClaimsReady === true,
    (manifest) =>
      `${manifest.summary?.readyLocales ?? 0}/${manifest.summary?.locales ?? 0} locales pass App Store copy, keyword, and claim checks.`,
  );
  addManifestRow(
    'App Store metadata upload packet',
    'docs/app-store-metadata-upload-packet.json',
    (manifest) =>
      manifest.summary?.risk === 'PASS' &&
      manifest.summary?.localReady === true &&
      manifest.summary?.locales === expectedLocales.length &&
      manifest.summary?.fieldReadyLocales === expectedLocales.length &&
      manifest.summary?.screenshotReadyLocales === expectedLocales.length &&
      manifest.summary?.copyAuditRisk === 'PASS',
    (manifest) =>
      `${manifest.summary?.fieldReadyLocales ?? 0}/${manifest.summary?.locales ?? 0} locales have copy-ready fields and screenshot upload packs; support URLs ready=${manifest.summary?.supportUrlReadyLocales ?? 0}/${manifest.summary?.locales ?? 0}.`,
  );
  addManifestRow(
    'Localization QA audit',
    'docs/localization-audit.json',
    (manifest) =>
      manifest.summary?.risk === 'PASS' &&
      manifest.summary?.uiLocales === expectedLocales.length &&
      manifest.summary?.appStoreLocales === expectedLocales.length &&
      manifest.summary?.localizedScreenshotEntries === 160 &&
      manifest.summary?.publicSitePages === 44 &&
      manifest.summary?.japaneseUiLocaleRemoved === true,
    (manifest) =>
      `${manifest.summary?.uiLocales ?? 0} UI locales, ${manifest.summary?.appStoreLocales ?? 0} App Store locales, and ${manifest.summary?.localizedScreenshotEntries ?? 0} localized screenshots verified.`,
  );
  addManifestRow(
    'App Store age rating audit',
    'docs/app-store-age-rating-audit.json',
    (manifest) =>
      manifest.summary?.risk === 'PASS' &&
      manifest.summary?.allFrequencyAnswersNone === true &&
      manifest.summary?.capabilitiesReady === true &&
      manifest.summary?.sourceReady === true,
    (manifest) =>
      `${manifest.summary?.frequencyNoneAnswers ?? 0}/${manifest.summary?.frequencyQuestions ?? 0} advisory answers are NONE; final rating comes from App Store Connect.`,
  );
  addManifestRow(
    'Open source license audit',
    'docs/open-source-license-audit.json',
    (manifest) =>
      manifest.summary?.risk === 'PASS' &&
      manifest.summary?.localReady === true &&
      manifest.summary?.unknownRuntimeLicenses === 0 &&
      manifest.summary?.prohibitedRuntimeLicenses === 0 &&
      manifest.summary?.unknownAllLicenses === 0 &&
      manifest.summary?.prohibitedAllLicenses === 0,
    (manifest) =>
      `${manifest.summary?.runtimePackages ?? 0} runtime packages checked; ${manifest.summary?.unknownRuntimeLicenses ?? 0} unknown and ${manifest.summary?.prohibitedRuntimeLicenses ?? 0} prohibited runtime licenses.`,
  );
  addManifestRow(
    'App Store review guide',
    'docs/app-store-review-guide.json',
    (manifest) =>
      manifest.review?.demoAccountRequired === false &&
      manifest.review?.signInRequired === false &&
      manifest.evidence?.screenshotEntries === 176,
    (manifest) =>
      `No demo account or sign-in required; ${manifest.evidence?.screenshotEntries ?? 0} screenshot entries referenced.`,
  );
  addManifestRow(
    'Privacy manifest audit',
    'docs/privacy-manifest-audit.json',
    (manifest) =>
      manifest.summary?.risk === 'PASS' &&
      manifest.summary?.tracking === false &&
      manifest.summary?.collectedDataTypes === 0 &&
      manifest.summary?.requiredReasonApisReady === true,
    (manifest) =>
      `iOS privacy manifest has ${manifest.summary?.accessedApiTypes ?? 0} required-reason API categories, no tracking, and no collected data.`,
  );
  addManifestRow(
    'App Store privacy answer pack',
    'docs/app-store-privacy-answers.json',
    (manifest) =>
      manifest.summary?.risk === 'PASS' &&
      ['NO_LIVE_ADS', 'LIVE_ADMOB'].includes(manifest.summary?.currentState) &&
      manifest.summary?.appCodeCollectsPersonalData === false &&
      manifest.summary?.accountRequired === false &&
      manifest.summary?.trackingDeclaredByAppCode === false &&
      manifest.summary?.confirmationEnv === 'APP_STORE_PRIVACY_ANSWERS_REVIEWED' &&
      (manifest.noLiveAdsAnswers?.appStoreConnect ?? []).length >= 10 &&
      (manifest.liveAdMobAnswers?.likelyGoogleMobileAdsDataTypes ?? []).length >= 6,
    (manifest) =>
      `${manifest.summary?.currentState ?? 'UNKNOWN'} state documented; no-account local app practices and live-AdMob disclosure review steps ready.`,
  );
  addManifestRow(
    'Privacy review packet',
    'docs/privacy-review-packet.json',
    (manifest) =>
      manifest.summary?.risk === 'PASS' &&
      manifest.summary?.localReady === true &&
      ['NO_LIVE_ADS', 'LIVE_ADMOB'].includes(manifest.summary?.currentState) &&
      manifest.summary?.confirmationEnv === 'APP_STORE_PRIVACY_ANSWERS_REVIEWED' &&
      manifest.summary?.appCodeCollectsPersonalData === false &&
      manifest.summary?.accountRequired === false &&
      manifest.summary?.trackingDeclaredByAppCode === false &&
      manifest.summary?.privacyManifestTracking === false &&
      manifest.summary?.privacyManifestCollectedDataTypes === 0 &&
      manifest.summary?.requiredReasonApisReady === true &&
      manifest.summary?.appOwnedNetworkRequests === 0 &&
      manifest.summary?.analyticsSdkCount === 0 &&
      manifest.summary?.authSdkCount === 0 &&
      manifest.summary?.userContentEntryCount === 0 &&
      manifest.summary?.noLiveAdsSuggestedRows >= 10 &&
      manifest.summary?.liveAdMobDisclosureRows >= 6,
    (manifest) =>
      `${manifest.summary?.currentState ?? 'UNKNOWN'} privacy packet ready; local evidence=${manifest.summary?.localReady ? 'yes' : 'no'}, final review confirmed=${manifest.summary?.finalReviewConfirmed ? 'yes' : 'no'}.`,
  );
  addManifestRow(
    'AdMob release audit',
    'docs/admob-release-audit.json',
    (manifest) =>
      manifest.summary?.risk === 'PASS' &&
      manifest.summary?.localReady === true &&
      manifest.runtimeFlow?.uiEntryReady === true &&
      manifest.runtimeFlow?.nativeConsentReady === true &&
      manifest.runtimeFlow?.webExportGuardReady === true &&
      manifest.nativeConfig?.pluginInjectedWithValidIds === true,
    (manifest) =>
      `${manifest.summary?.currentState ?? 'UNKNOWN'} state audited; live ads ready=${manifest.summary?.liveAdsReady ? 'yes' : 'no'}, external ad setup ready=${manifest.summary?.externalReady ? 'yes' : 'no'}.`,
  );
  addManifestRow(
    'AdMob setup handoff',
    'docs/admob-setup-handoff.json',
    (manifest) =>
      manifest.summary?.risk === 'PASS' &&
      manifest.summary?.localReady === true &&
      ['NO_LIVE_ADS', 'LIVE_ADMOB', 'INVALID_OR_PARTIAL_ADMOB_ENV'].includes(manifest.summary?.currentState) &&
      (manifest.envPlan ?? []).length === adKeys.length &&
      (manifest.manualConfirmations ?? []).length === 3 &&
      (manifest.verificationOrder ?? []).includes('npm run ads:handoff'),
    (manifest) =>
      `${manifest.envPlan?.length ?? 0} AdMob env values and ${manifest.manualConfirmations?.length ?? 0} manual confirmations mapped; external AdMob ready=${manifest.summary?.externalReady ? 'yes' : 'no'}.`,
  );
  addManifestRow(
    'Data flow privacy audit',
    'docs/data-flow-privacy-audit.json',
    (manifest) =>
      manifest.summary?.risk === 'PASS' &&
      manifest.summary?.localReady === true &&
      manifest.summary?.appOwnedNetworkRequests === 0 &&
      manifest.summary?.analyticsSdkCount === 0 &&
      manifest.summary?.authSdkCount === 0 &&
      manifest.summary?.userContentEntryCount === 0 &&
      manifest.summary?.localStorageKeys === 2,
    (manifest) =>
      `local-only storage with ${manifest.summary?.appOwnedNetworkRequests ?? 0} app-owned network hits, ${manifest.summary?.analyticsSdkCount ?? 0} analytics SDKs, and ${manifest.summary?.authSdkCount ?? 0} auth SDKs.`,
  );
  addManifestRow(
    'Runtime UI flow audit',
    'docs/runtime-ui-flow-audit.json',
    (manifest) =>
      manifest.summary?.risk === 'PASS' &&
      manifest.summary?.localReady === true &&
      manifest.summary?.locales === expectedLocales.length &&
      manifest.summary?.levels === expectedJlptLevels.length &&
      manifest.summary?.modes === 5 &&
      manifest.summary?.phases === 3 &&
      manifest.summary?.bgmTracks === 3 &&
      manifest.summary?.hasJapaneseUiLocale === false &&
      manifest.summary?.requiredFlowFailures === 0,
    (manifest) =>
      `${manifest.summary?.passedChecks ?? 0}/${manifest.summary?.checks ?? 0} runtime UI flows verified across ${manifest.summary?.locales ?? 0} locales and ${manifest.summary?.levels ?? 0} JLPT levels.`,
  );
  addManifestRow(
    'Store submission input pack',
    'docs/store-submission-input-pack.json',
    (manifest) =>
      manifest.summary?.localReady === true &&
      manifest.summary?.envKeys === envTemplateKeyCount() &&
      manifest.summary?.fillableEnvKeys === envTemplateKeyCount() &&
      manifest.summary?.externalItems >= 11 &&
      manifest.summary?.easProductionKeys === expectedEasProductionKeyCount() &&
      manifest.summary?.manualConfirmationKeys === confirmationKeys.length &&
      manifest.outputs?.envLocalTemplate === 'docs/store-submission.env.template' &&
      fs.existsSync(path.join(root, 'docs/store-submission.env.template')) &&
      (manifest.verificationCommands ?? []).includes('npm run release:store-ready'),
    (manifest) =>
      `${manifest.summary?.fillableEnvKeys ?? 0} env inputs, ${manifest.summary?.easProductionKeys ?? 0} EAS production keys, ${manifest.summary?.manualConfirmationKeys ?? 0} manual confirmations, standalone env template ready; external blockers=${manifest.summary?.blockingExternalItems ?? 0}.`,
  );
  addManifestRow(
    'External TODO tracker',
    'docs/external-todo-tracker.json',
    (manifest) =>
      manifest.summary?.trackedItems === manifest.summary?.externalItems &&
      manifest.summary?.blockingItems === (manifest.items ?? []).filter((item) => item.blocking).length &&
      manifest.summary?.blockedFinalCommands >= 4 &&
      (manifest.finalCommandsBlockedUntilClear ?? []).includes('npm run release:store-ready') &&
      (manifest.items ?? []).some((item) => item.label === 'Live AdMob IDs') &&
      (manifest.items ?? []).some((item) => item.label === 'PRODUCTION_DEVICE_TESTED'),
    (manifest) =>
      `${manifest.summary?.trackedItems ?? 0} external items tracked, ${manifest.summary?.blockingItems ?? 0} blocking, ${manifest.summary?.blockedFinalCommands ?? 0} final commands blocked.`,
  );
  addManifestRow(
    'Account and service preflight',
    'docs/account-service-preflight.json',
    (manifest) =>
      manifest.summary?.planReady === true &&
      manifest.summary?.commandsReady === true &&
      manifest.summary?.checks >= 10 &&
      manifest.mode === 'manual' &&
      (manifest.requiredEasProductionEnv ?? []).length === expectedEasProductionKeyCount() &&
      manifest.commands?.finalGate === 'npm run release:verify && node scripts/release-check.js --strict',
    (manifest) =>
      `${manifest.summary?.checks ?? 0} remote-service checks prepared, ${manifest.requiredEasProductionEnv?.length ?? 0} EAS env keys tracked; external blockers=${manifest.summary?.externalBlockingItems ?? 0}.`,
  );
  addManifestRow(
    'Final launch runbook',
    'docs/final-launch-runbook.json',
    (manifest) =>
      manifest.summary?.localReady === true &&
      manifest.summary?.phaseCount >= 9 &&
      manifest.summary?.externalBlockingItems === manifest.blockers?.length &&
      (manifest.finalCommands ?? []).includes('npm run release:store-ready') &&
      (manifest.finalCommands ?? []).includes('npm run build:ios') &&
      (manifest.finalCommands ?? []).includes('npm run submit:ios'),
    (manifest) =>
      `${manifest.summary?.phaseCount ?? 0} launch phases mapped, metadata/build/submit ready=${manifest.summary?.readyToRunMetadataBuildSubmit ? 'yes' : 'no'}; external blockers=${manifest.summary?.externalBlockingItems ?? 0}.`,
  );
  addManifestRow(
    'EAS production preflight',
    'docs/eas-build-preflight.json',
    (manifest) =>
      manifest.summary?.risk === 'PASS' &&
      manifest.summary?.localReady === true &&
      manifest.eas?.productionBuildProfile?.ready === true &&
      manifest.eas?.productionSubmitProfile?.ready === true &&
      manifest.uploadPolicy?.ready === true &&
      manifest.commands?.ready === true,
    (manifest) =>
      `production profile ready, submit metadata path=${manifest.eas?.productionSubmitProfile?.metadataPath ?? 'missing'}, strict gate ready=${manifest.summary?.strictGateReady ? 'yes' : 'no'}.`,
  );
  addManifestRow(
    'App Store handoff bundle',
    'docs/app-store-handoff-bundle.json',
    (manifest) =>
      manifest.summary?.risk === 'PASS' &&
      manifest.summary?.localReady === true &&
      manifest.summary?.missingFiles === 0 &&
      manifest.summary?.publicSitePages === 44 &&
      manifest.summary?.screenshotEntries === 176 &&
      manifest.summary?.appStoreLocales === expectedLocales.length,
    (manifest) =>
      `${manifest.summary?.totalFiles ?? 0} handoff files indexed with hashes; external blockers=${manifest.summary?.externalBlockingItems ?? 0}.`,
  );
}

function addReleaseCiWorkflowRow() {
  const workflowPath = '.github/workflows/release-verify.yml';
  const workflowSource = readOptionalText(workflowPath);
  const requiredSnippets = [
    'workflow_dispatch:',
    'pull_request:',
    'actions/setup-node@v6',
    'node-version: 22.13.0',
    'npm ci',
    'npm run typecheck',
    'npm run gameplay-check',
    'npm run release:verify',
  ];
  const missingSnippets = requiredSnippets.filter((snippet) => !workflowSource.includes(snippet));

  add(
    workflowSource.length > 0 && missingSnippets.length === 0,
    'Release CI workflow',
    missingSnippets.length === 0
      ? 'GitHub Actions release verification runs Node 22.13.0 with typecheck, gameplay contract, and release:verify.'
      : `Missing workflow evidence: ${missingSnippets.join(', ')}`,
    'local',
  );
}

function addExpoBaselineRow() {
  const packageJson = readJson('package.json');
  const appJson = readJson('app.json')?.expo;
  const dependencies = packageJson?.dependencies ?? {};
  const expoPlugin = findPlugin(appJson, 'expo-build-properties');
  const buildProperties = Array.isArray(expoPlugin) ? expoPlugin[1] ?? {} : {};
  const ok =
    packageJson?.engines?.node === '>=22.13.0' &&
    dependencies['@expo/metro-runtime'] === '~56.0.16' &&
    dependencies.expo === '~56.0.15' &&
    dependencies['expo-asset'] === '~56.0.19' &&
    dependencies['expo-build-properties'] === '~56.0.22' &&
    dependencies['expo-constants'] === '~56.0.20' &&
    dependencies['expo-speech'] === '~56.0.3' &&
    dependencies['expo-splash-screen'] === '~56.0.12' &&
    dependencies.react === '19.2.3' &&
    dependencies['react-native'] === '0.85.3' &&
    buildProperties.ios?.deploymentTarget === '16.4' &&
    buildProperties.android?.compileSdkVersion === 36 &&
    buildProperties.android?.targetSdkVersion === 36;

  add(
    ok ? 'OK' : 'BAD',
    'Expo SDK 56 baseline',
    ok
      ? 'Expo 56, React 19.2.3, React Native 0.85.3, Node >=22.13.0, iOS 16.4, Android SDK 36.'
      : 'package.json or app.json no longer matches the Expo SDK 56 release baseline.',
    'local',
  );
}

function addLocaleCoverageRow() {
  const appJson = readJson('app.json')?.expo;
  const appLocales = Object.keys(appJson?.locales ?? {});
  const localizationPlugin = findPlugin(appJson, 'expo-localization');
  const pluginLocales = Array.isArray(localizationPlugin) ? localizationPlugin[1]?.supportedLocales ?? {} : {};
  const ok =
    sameSet(appLocales, expectedLocales) &&
    sameSet(pluginLocales.ios ?? [], expectedLocales) &&
    sameSet(pluginLocales.android ?? [], expectedLocales) &&
    !appLocales.includes('ja');

  add(
    ok ? 'OK' : 'BAD',
    'UI locale coverage',
    ok
      ? `${appLocales.length} UI locales configured from system language; Japanese UI locale omitted.`
      : 'App locales or expo-localization supportedLocales do not match the required non-Japanese UI locale set.',
    'local',
  );
}

function addStudyBankRow() {
  try {
    const gameData = loadTsModule('src/gameData.ts');
    const levels = gameData.JLPT_LEVELS ?? [];
    const levelStats = Object.fromEntries(levels.map((level) => [level, gameData.getLevelStudyStats(level)]));
    const totalVocabulary = gameData.VOCAB_ITEMS?.length ?? 0;
    const totalLines = gameData.LINE_ITEMS?.length ?? 0;
    const totalGrammar = gameData.GRAMMAR_ITEMS?.length ?? 0;
    const hasExpectedLevels = sameSet(levels, expectedJlptLevels);
    const hasExpectedDepth = expectedJlptLevels.every((level) => {
      const stats = levelStats[level] ?? {};
      if (level === 'N5') return stats.kana >= 92 && stats.vocab >= 100 && stats.lines >= 40 && stats.grammar >= 12;
      return stats.kana === 0 && stats.vocab >= 60 && stats.lines >= 24 && stats.grammar >= 12;
    });

    add(
      hasExpectedLevels && hasExpectedDepth ? 'OK' : 'BAD',
      'JLPT N5-N1 study bank',
      hasExpectedLevels && hasExpectedDepth
        ? `${gameData.KANA_ITEMS?.length ?? 0} kana, ${totalVocabulary} vocabulary, ${totalLines} original anime-style line prompts, ${totalGrammar} grammar prompts.`
        : 'Study bank no longer meets the N5-N1 level-depth contract.',
      'local',
    );
  } catch (error) {
    add('BAD', 'JLPT N5-N1 study bank', `Could not load src/gameData.ts: ${error.message}`, 'local');
  }
}

function addManifestRow(label, relativePath, isReady, describe) {
  const manifest = readJson(relativePath);

  if (!manifest) {
    add('BAD', label, `Missing or invalid ${relativePath}; run npm run release:verify.`, 'local');
    return;
  }

  const ok = isReady(manifest);
  add(ok ? 'OK' : 'BAD', label, ok ? describe(manifest) : `${relativePath} does not match the release contract.`, 'local');
}

function addUrlRow(label, value, todoMessage, options = {}) {
  if (!value) {
    add('TODO', label, todoMessage);
    return;
  }

  if (!isProductionHttpsUrl(value)) {
    add('BAD', label, `${value} is not a production HTTPS URL.`);
    return;
  }

  if (options.requireLiveHosting && !publicSiteHostingReady()) {
    add('BAD', label, `${value} is configured, but docs/public-site-hosting-verification.md has not passed live HTTPS checks.`);
    return;
  }

  add('OK', label, value);
}

function add(statusOrCondition, label, detail, category = 'external') {
  const status =
    typeof statusOrCondition === 'boolean'
      ? statusOrCondition
        ? 'OK'
        : 'TODO'
      : statusOrCondition;

  rows.push({ status, category, label, detail });
}

function printRows() {
  console.log('Kana Sprint release status');
  console.log(`OK ${summary.ok} | TODO ${summary.todo} | BAD ${summary.bad} | INFO ${summary.info}`);
  console.log('');

  for (const group of [
    { category: 'local', title: 'Local release evidence' },
    { category: 'external', title: 'External store setup' },
  ]) {
    const groupRows = rows.filter((row) => row.category === group.category);
    if (groupRows.length === 0) continue;

    console.log(group.title);
    for (const row of groupRows) {
      console.log(`[${row.status}] ${row.label}: ${row.detail}`);
    }
    console.log('');
  }

  console.log('Final command order after all TODO/BAD items are cleared:');
  console.log('npm run release:verify');
  console.log('npm run release:store-ready');
  console.log('npm run metadata:ios');
  console.log('npm run build:ios');
  console.log('npm run submit:ios');
}

function env(key) {
  const value = process.env[key]?.trim();
  return value ? value : undefined;
}

function envTemplateKeyCount() {
  return fs.readFileSync(path.join(root, '.env.example'), 'utf8')
    .split(/\r?\n/)
    .filter((line) => /^([A-Z0-9_]+)=/.test(line))
    .length;
}

function trimTrailingSlash(value) {
  return value?.replace(/\/+$/, '');
}

function joinUrl(root, path) {
  return root ? `${root}/${path}` : undefined;
}

function isProductionHttpsUrl(value) {
  try {
    const parsed = new URL(value);
    const hostname = parsed.hostname.toLowerCase();

    return (
      parsed.protocol === 'https:' &&
      Boolean(hostname) &&
      hostname !== 'localhost' &&
      hostname !== '127.0.0.1' &&
      hostname !== '0.0.0.0' &&
      !hostname.endsWith('.local') &&
      !hostname.endsWith('.test') &&
      !hostname.endsWith('.example') &&
      !hostname.includes('example.com')
    );
  } catch {
    return false;
  }
}

function isRealAdMobId(value, pattern) {
  return pattern.test(value ?? '') && !admobPlaceholderPattern.test(value ?? '') && !admobDemoPublisherPattern.test(value ?? '');
}

function publicSiteHostingReady() {
  const verification = readJson('docs/public-site-hosting-verification.json');
  return verification?.summary?.ready === true && verification?.summary?.status === 'PASS';
}

function digits(value) {
  return String(value ?? '').replace(/\D/g, '');
}

function readJson(relativePath) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
  } catch {
    return null;
  }
}

function readOptionalText(relativePath) {
  try {
    return fs.readFileSync(path.join(root, relativePath), 'utf8');
  } catch {
    return '';
  }
}

function findPlugin(config, pluginName) {
  return (config?.plugins ?? []).find((plugin) => (Array.isArray(plugin) ? plugin[0] : plugin) === pluginName);
}

function sameSet(actual, expected) {
  return (
    Array.isArray(actual) &&
    actual.length === expected.length &&
    expected.every((item) => actual.includes(item))
  );
}

function countScreenshots(manifest) {
  return (
    (manifest.defaultPack?.screenshots ?? []).length +
    (manifest.localizedPacks ?? []).reduce((sum, pack) => sum + (pack.screenshots?.length ?? 0), 0)
  );
}

function summarizeCategories(values) {
  const categories = {};

  for (const row of values) {
    const category = row.category ?? 'external';
    const current = categories[category] ?? { ok: 0, todo: 0, bad: 0, info: 0 };
    current[row.status.toLowerCase()] += 1;
    categories[category] = current;
  }

  return categories;
}

function loadTsModule(relativePath) {
  const filePath = path.join(root, relativePath);
  const cache = new Map();

  return loadTsFile(filePath, cache);
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
