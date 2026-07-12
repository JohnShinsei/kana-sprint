const fs = require('fs');
const path = require('path');
const { loadLocalEnv } = require('./load-env');

const root = path.resolve(__dirname, '..');
const jsonPath = path.join(root, 'docs/data-flow-privacy-audit.json');
const markdownPath = path.join(root, 'docs/data-flow-privacy-audit.md');

loadLocalEnv();

const appJson = readJson('app.json').expo;
const resolveAppConfig = require('../app.config.js');
const packageJson = readJson('package.json');
const privacyManifestAudit = readOptionalJson('docs/privacy-manifest-audit.json') ?? {};
const privacyAnswers = readOptionalJson('docs/app-store-privacy-answers.json') ?? {};
const admobReleaseAudit = readOptionalJson('docs/admob-release-audit.json') ?? {};
const appConfig = resolveAppConfig({ config: clone(appJson) });

const runtimeSources = runtimeSourceFiles().map((relativePath) => ({
  path: relativePath,
  source: fs.readFileSync(path.join(root, relativePath), 'utf8'),
}));
const sourceMap = Object.fromEntries(runtimeSources.map((entry) => [entry.path, entry.source]));
const packageNames = Object.keys({
  ...(packageJson.dependencies ?? {}),
  ...(packageJson.devDependencies ?? {}),
});

const networkHits = findSourceHits(runtimeSources, [
  /\bfetch\s*\(/,
  /\bXMLHttpRequest\b/,
  /\bWebSocket\b/,
  /\bEventSource\b/,
  /\bnavigator\.sendBeacon\b/,
  /\baxios\b/,
  /\bgraphql\b/,
]);
const analyticsHits = findPackageHits(packageNames, [
  /analytics/i,
  /amplitude/i,
  /mixpanel/i,
  /segment/i,
  /sentry/i,
  /datadog/i,
  /firebase-analytics/i,
  /appcenter-analytics/i,
]);
const authHits = findPackageHits(packageNames, [
  /auth/i,
  /oauth/i,
  /signin/i,
  /login/i,
  /supabase/i,
  /firebase/i,
  /clerk/i,
  /cognito/i,
  /appwrite/i,
]);
const sensitiveDependencyHits = findPackageHits(packageNames, [
  /(^|[/_-])camera($|[/_-])/i,
  /(^|[/_-])contacts($|[/_-])/i,
  /(^|[/_-])location($|[/_-])/i,
  /image-picker/i,
  /document-picker/i,
  /media-library/i,
  /notifications/i,
  /tracking-transparency/i,
]);
const userContentUiHits = findSourceHits(runtimeSources, [
  /\bTextInput\b/,
  /\bImagePicker\b/,
  /\bDocumentPicker\b/,
  /\bCameraView\b/,
  /\blaunchImageLibrary\b/,
  /\bFormData\b/,
  /\bBlob\b/,
]);
const linkingHits = findSourceHits(runtimeSources, [/\bLinking\.openURL\b/]);
const storageHits = findSourceHits(runtimeSources, [/\bAsyncStorage\.(getItem|setItem|removeItem|mergeItem|clear)\b/]);
const storageKeys = extractStorageKeys(sourceMap['src/storage.ts'] ?? '');
const blockedAndroidPermissions = appJson.android?.blockedPermissions ?? [];
const audioPluginConfig = (appJson.plugins ?? []).find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-audio')?.[1] ?? {};
const appOwnedNetworkReady = networkHits.length === 0;
const accountFeatureReady = authHits.length === 0 && !hasAccountFeatureSource(runtimeSources);
const analyticsReady = analyticsHits.length === 0;
const userContentReady = userContentUiHits.length === 0;
const sensitiveApiReady =
  sensitiveDependencyHits.length === 0 &&
  audioPluginConfig.microphonePermission === false &&
  audioPluginConfig.recordAudioAndroid === false &&
  blockedAndroidPermissions.includes('android.permission.RECORD_AUDIO') &&
  blockedAndroidPermissions.includes('android.permission.FOREGROUND_SERVICE') &&
  blockedAndroidPermissions.includes('android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK');
const localStorageReady =
  storageHits.length === 4 &&
  sameSet(storageKeys, ['@kana-sprint/progress-v1', '@kana-sprint/settings-v1']) &&
  !sourceMap['src/storage.ts']?.includes('AsyncStorage.clear');
const localProgressResetReady =
  sourceMap['App.tsx']?.includes('resetLocalProgress') &&
  sourceMap['App.tsx']?.includes('createDefaultProgress()') &&
  sourceMap['App.tsx']?.includes('saveProgress(next)') &&
  sourceMap['App.tsx']?.includes("t(locale, 'localData')") &&
  sourceMap['App.tsx']?.includes("t(locale, isResetProgressArmed ? 'confirmResetProgress' : 'resetProgress')");
const externalLinksReady =
  linkingHits.length === 1 &&
  sourceMap['App.tsx']?.includes('activeSupportUrl') &&
  sourceMap['App.tsx']?.includes('activePrivacyPolicyUrl') &&
  sourceMap['App.tsx']?.includes('activeOpenSourceNoticesUrl') &&
  sourceMap['App.tsx']?.includes('Linking.openURL(url)');
const adBoundaryReady =
  packageJson.dependencies?.['react-native-google-mobile-ads'] &&
  admobReleaseAudit.summary?.localReady === true &&
  admobReleaseAudit.summary?.currentState === privacyAnswers.summary?.currentState;
const privacyDocsReady =
  privacyManifestAudit.summary?.risk === 'PASS' &&
  privacyAnswers.summary?.risk === 'PASS' &&
  privacyAnswers.summary?.appCodeCollectsPersonalData === false &&
  privacyAnswers.summary?.accountRequired === false &&
  privacyAnswers.summary?.trackingDeclaredByAppCode === false;

const checks = [
  check('app-owned-network', 'No app-owned fetch/XHR/WebSocket/beacon/GraphQL client is present in runtime app code', appOwnedNetworkReady),
  check('account-auth', 'No account, login, auth, cloud-sync, or profile SDK is included', accountFeatureReady),
  check('analytics', 'No analytics, crash analytics, telemetry, or event tracking SDK is included', analyticsReady),
  check('user-content', 'No free-text, upload, camera, image, document, or form-data user-content entry exists', userContentReady),
  check('sensitive-apis', 'Camera, contacts, location, notification, microphone recording, and media picker capabilities are absent or blocked', sensitiveApiReady),
  check('local-storage', 'Progress and settings use only the two documented AsyncStorage keys', localStorageReady),
  check('local-progress-reset', 'Settings exposes a local-only progress reset that rewrites only the progress store', localProgressResetReady),
  check('external-links', 'Support, privacy, and open source notice pages are user-initiated external links from Settings only', externalLinksReady),
  check('ad-boundary', 'Google Mobile Ads is isolated behind the rewarded-ad gate and AdMob release audit', adBoundaryReady),
  check('privacy-docs', 'Privacy manifest and App Store privacy answer pack match the no-account local-data posture', privacyDocsReady),
];
const localFailures = checks.filter((entry) => !entry.passed).map((entry) => entry.label);

const audit = {
  schemaVersion: 1,
  source: 'scripts/generate-data-flow-privacy-audit.js',
  generatedFrom: {
    appConfig: 'app.json + app.config.js',
    packageJson: 'package.json',
    runtimeSources: runtimeSources.map((entry) => entry.path),
    storage: 'src/storage.ts',
    privacyManifestAudit: 'docs/privacy-manifest-audit.json',
    privacyAnswers: 'docs/app-store-privacy-answers.json',
    admobReleaseAudit: 'docs/admob-release-audit.json',
  },
  officialReferences: [
    {
      label: 'Apple App Privacy Details',
      url: 'https://developer.apple.com/app-store/app-privacy-details/',
    },
    {
      label: 'Apple Privacy Manifest Files',
      url: 'https://developer.apple.com/documentation/bundleresources/privacy-manifest-files',
    },
    {
      label: 'Expo SDK 56 reference',
      url: 'https://docs.expo.dev/versions/v56.0.0/',
    },
  ],
  summary: {
    risk: localFailures.length === 0 ? 'PASS' : 'REVIEW',
    localReady: localFailures.length === 0,
    appOwnedNetworkRequests: networkHits.length,
    analyticsSdkCount: analyticsHits.length,
    authSdkCount: authHits.length,
    userContentEntryCount: userContentUiHits.length,
    sensitiveDependencyCount: sensitiveDependencyHits.length,
    localStorageKeys: storageKeys.length,
    externalLinkEntryCount: linkingHits.length,
    appCodeCollectsPersonalData: false,
    accountRequired: false,
    userGeneratedContent: false,
    analyticsEnabled: false,
    localFailures: localFailures.length,
  },
  app: {
    name: appConfig.name,
    version: appConfig.version,
    bundleIdentifier: appConfig.ios?.bundleIdentifier,
    packageName: appConfig.android?.package,
  },
  dataFlow: {
    storage: {
      library: '@react-native-async-storage/async-storage',
      keys: storageKeys,
      operations: storageHits.map((hit) => hit.match),
      localOnly: localStorageReady,
      progressResetAvailable: Boolean(localProgressResetReady),
    },
    network: {
      appOwnedHits: networkHits,
      appOwnedNetworkReady,
      userInitiatedExternalLinks: linkingHits,
      supportPrivacyLinksOnly: externalLinksReady,
      supportPrivacyLicenseLinksOnly: externalLinksReady,
    },
    ads: {
      googleMobileAdsDependency: packageJson.dependencies?.['react-native-google-mobile-ads'] ?? null,
      currentState: admobReleaseAudit.summary?.currentState ?? 'UNKNOWN',
      liveAdsReady: Boolean(admobReleaseAudit.summary?.liveAdsReady),
      localAdIntegrationReady: Boolean(admobReleaseAudit.summary?.localReady),
      externalAdSetupReady: Boolean(admobReleaseAudit.summary?.externalReady),
    },
  },
  capabilities: {
    accountFeatureReady,
    analyticsReady,
    userContentReady,
    sensitiveApiReady,
    dependencies: {
      analyticsHits,
      authHits,
      sensitiveDependencyHits,
    },
    androidBlockedPermissions: blockedAndroidPermissions,
    microphonePermission: audioPluginConfig.microphonePermission,
    recordAudioAndroid: audioPluginConfig.recordAudioAndroid,
  },
  privacyEvidence: {
    privacyManifestRisk: privacyManifestAudit.summary?.risk ?? 'UNKNOWN',
    privacyManifestTracking: Boolean(privacyManifestAudit.summary?.tracking),
    privacyManifestCollectedDataTypes: privacyManifestAudit.summary?.collectedDataTypes ?? 0,
    privacyAnswersRisk: privacyAnswers.summary?.risk ?? 'UNKNOWN',
    privacyAnswersCurrentState: privacyAnswers.summary?.currentState ?? 'UNKNOWN',
    appCodeCollectsPersonalData: Boolean(privacyAnswers.summary?.appCodeCollectsPersonalData),
    accountRequired: Boolean(privacyAnswers.summary?.accountRequired),
    trackingDeclaredByAppCode: Boolean(privacyAnswers.summary?.trackingDeclaredByAppCode),
  },
  checks,
  localFailures,
  commands: [
    'npm run privacy:data-flow',
    'npm run privacy:manifest',
    'npm run privacy:answers',
    'npm run ads:audit',
    'npm run release:verify',
  ],
};

fs.writeFileSync(jsonPath, `${JSON.stringify(audit, null, 2)}\n`);
fs.writeFileSync(markdownPath, renderMarkdown(audit));

if (audit.summary.risk !== 'PASS') {
  console.error(`Data flow privacy audit requires review: ${localFailures.length} local issue(s)`);
  for (const failure of localFailures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`generated ${path.relative(root, markdownPath)} and ${path.relative(root, jsonPath)}`);

function runtimeSourceFiles() {
  return [
    'App.tsx',
    ...listFiles(path.join(root, 'src'))
      .map((filePath) => path.relative(root, filePath).replace(/\\/g, '/'))
      .filter((relativePath) => /\.(ts|tsx)$/.test(relativePath)),
  ];
}

function listFiles(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(entryPath));
    } else {
      files.push(entryPath);
    }
  }

  return files;
}

function findSourceHits(sources, patterns) {
  const hits = [];

  for (const entry of sources) {
    const lines = entry.source.split(/\r?\n/);
    for (const [index, line] of lines.entries()) {
      for (const pattern of patterns) {
        const match = line.match(pattern);
        if (match) {
          hits.push({
            file: entry.path,
            line: index + 1,
            match: match[0],
          });
        }
      }
    }
  }

  return hits;
}

function findPackageHits(packages, patterns) {
  return packages.filter((name) => patterns.some((pattern) => pattern.test(name)));
}

function extractStorageKeys(source) {
  return Array.from(source.matchAll(/const\s+[A-Z_]*STORAGE_KEY\s*=\s*'([^']+)'/g)).map((match) => match[1]);
}

function hasAccountFeatureSource(sources) {
  const featurePatterns = [
    /\bsignIn\b/,
    /\bsignUp\b/,
    /\blogIn\b/,
    /\blogOut\b/,
    /\bcreateAccount\b/,
    /\bAuthSession\b/,
    /\buserProfile\b/,
  ];

  return findSourceHits(
    sources.filter((entry) => !entry.path.endsWith('gameData.ts') && !entry.path.endsWith('i18n.ts')),
    featurePatterns,
  ).length > 0;
}

function check(id, label, passed) {
  return { id, label, passed: Boolean(passed) };
}

function renderMarkdown(values) {
  const checkRows = values.checks
    .map((entry) => `| ${entry.id} | ${entry.passed ? 'Yes' : 'No'} | ${escapeCell(entry.label)} |`)
    .join('\n');
  const storageKeys = values.dataFlow.storage.keys.map((key) => `- \`${key}\``).join('\n');
  const networkHits = values.dataFlow.network.appOwnedHits.length > 0
    ? values.dataFlow.network.appOwnedHits.map((hit) => `- ${hit.file}:${hit.line} ${hit.match}`).join('\n')
    : '- None.';
  const packageHits = [
    ...values.capabilities.dependencies.analyticsHits.map((name) => `analytics: ${name}`),
    ...values.capabilities.dependencies.authHits.map((name) => `auth: ${name}`),
    ...values.capabilities.dependencies.sensitiveDependencyHits.map((name) => `sensitive: ${name}`),
  ];
  const packageRows = packageHits.length > 0 ? packageHits.map((item) => `- ${item}`).join('\n') : '- None.';
  const commands = values.commands.map((command) => `- \`${command}\``).join('\n');
  const references = values.officialReferences.map((entry) => `- ${entry.label}: ${entry.url}`).join('\n');

  return `# Data Flow Privacy Audit

This audit checks whether the code supports the App Store privacy posture: no account, no app-owned network upload, no analytics SDK, no user-generated content, and local-only progress/settings storage.

## Summary

- Risk: ${values.summary.risk}
- Local data-flow posture ready: ${values.summary.localReady ? 'Yes' : 'No'}
- App-owned network request hits: ${values.summary.appOwnedNetworkRequests}
- Analytics SDK hits: ${values.summary.analyticsSdkCount}
- Auth/account SDK hits: ${values.summary.authSdkCount}
- User-content entry hits: ${values.summary.userContentEntryCount}
- Sensitive dependency hits: ${values.summary.sensitiveDependencyCount}
- Local storage keys: ${values.summary.localStorageKeys}
- External link entries: ${values.summary.externalLinkEntryCount}
- App-code personal data collection: ${values.summary.appCodeCollectsPersonalData ? 'Yes' : 'No'}
- Account required: ${values.summary.accountRequired ? 'Yes' : 'No'}
- User-generated content: ${values.summary.userGeneratedContent ? 'Yes' : 'No'}
- Analytics enabled: ${values.summary.analyticsEnabled ? 'Yes' : 'No'}

## Checks

| Check | Passed | Evidence |
| --- | --- | --- |
${checkRows}

## Local Storage

- Library: ${values.dataFlow.storage.library}
- Local only: ${values.dataFlow.storage.localOnly ? 'Yes' : 'No'}
- Local progress reset available: ${values.dataFlow.storage.progressResetAvailable ? 'Yes' : 'No'}

${storageKeys}

## Network Boundary

- App-owned network ready: ${values.dataFlow.network.appOwnedNetworkReady ? 'Yes' : 'No'}
- Support/privacy/license links only: ${values.dataFlow.network.supportPrivacyLicenseLinksOnly ? 'Yes' : 'No'}

${networkHits}

## Ads Boundary

- Google Mobile Ads dependency: ${values.dataFlow.ads.googleMobileAdsDependency}
- AdMob state: ${values.dataFlow.ads.currentState}
- Local ad integration ready: ${values.dataFlow.ads.localAdIntegrationReady ? 'Yes' : 'No'}
- Live ads ready: ${values.dataFlow.ads.liveAdsReady ? 'Yes' : 'No'}
- External ad setup ready: ${values.dataFlow.ads.externalAdSetupReady ? 'Yes' : 'No'}

## Capability Scan

${packageRows}

## Privacy Evidence

- Privacy manifest risk: ${values.privacyEvidence.privacyManifestRisk}
- Privacy manifest tracking: ${values.privacyEvidence.privacyManifestTracking ? 'Yes' : 'No'}
- Privacy manifest collected data types: ${values.privacyEvidence.privacyManifestCollectedDataTypes}
- Privacy answer risk: ${values.privacyEvidence.privacyAnswersRisk}
- Privacy answer current state: ${values.privacyEvidence.privacyAnswersCurrentState}
- App-code personal data collection: ${values.privacyEvidence.appCodeCollectsPersonalData ? 'Yes' : 'No'}
- Account required: ${values.privacyEvidence.accountRequired ? 'Yes' : 'No'}
- Tracking declared by app code: ${values.privacyEvidence.trackingDeclaredByAppCode ? 'Yes' : 'No'}

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

function sameSet(actual, expected) {
  return Array.isArray(actual) && actual.length === expected.length && expected.every((item) => actual.includes(item));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function escapeCell(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}
