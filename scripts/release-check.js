const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ts = require('typescript');
const { spawnSync } = require('child_process');
const { loadLocalEnv } = require('./load-env');

const root = path.resolve(__dirname, '..');
loadLocalEnv();

const expectedLocales = ['zh-Hans', 'zh-Hant', 'en', 'fr', 'it', 'de', 'es-ES', 'ko', 'pl', 'pt-BR'];
const strictMode = process.argv.includes('--strict') || process.env.RELEASE_STRICT === '1';
const failures = [];
const warnings = [];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function warn(condition, message) {
  if (!condition) warnings.push(message);
}

function requireForStore(condition, message) {
  if (condition) return;

  if (strictMode) {
    failures.push(`[store-ready] ${message}`);
  } else {
    warnings.push(message);
  }
}

function normalizeAssetPath(value) {
  return String(value ?? '').replace(/\\/g, '/').replace(/^\.\//, '');
}

const pngInfoCache = new Map();

function readPngInfo(relativePath) {
  if (pngInfoCache.has(relativePath)) return pngInfoCache.get(relativePath);

  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) {
    assert(false, `Missing PNG asset: ${relativePath}`);
    pngInfoCache.set(relativePath, null);
    return null;
  }

  const buffer = fs.readFileSync(filePath);
  const isPng = buffer.length >= 33 && buffer.subarray(0, 8).toString('hex') === '89504e470d0a1a0a';
  assert(isPng, `${relativePath} must be a PNG file`);

  if (!isPng) {
    pngInfoCache.set(relativePath, null);
    return null;
  }

  const info = {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    bitDepth: buffer[24],
    colorType: buffer[25],
    size: buffer.length,
  };

  info.hasAlphaChannel = info.colorType === 4 || info.colorType === 6;
  pngInfoCache.set(relativePath, info);
  return info;
}

function assertPngAsset(configPath, label, expectedPath, expectedWidth, expectedHeight, options = {}) {
  assert(Boolean(configPath), `${label} path is missing`);
  if (!configPath) return;

  const relativePath = normalizeAssetPath(configPath);
  assert(relativePath === expectedPath, `${label} should point to ${expectedPath}`);

  const info = readPngInfo(relativePath);
  if (!info) return;

  assert(info.width === expectedWidth, `${label} width should be ${expectedWidth}px, got ${info.width}px`);
  assert(info.height === expectedHeight, `${label} height should be ${expectedHeight}px, got ${info.height}px`);
  assert(info.bitDepth === 8, `${label} should use 8-bit PNG channels, got bit depth ${info.bitDepth}`);

  if (options.noAlpha) {
    assert(!info.hasAlphaChannel, `${label} must not include an alpha channel`);
  }

  if (options.requireAlpha) {
    assert(info.hasAlphaChannel, `${label} should include an alpha channel for transparent icon masking`);
  }

  return info;
}

function fileSha256(relativePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(root, relativePath))).digest('hex');
}

function readWavInfo(relativePath) {
  const buffer = fs.readFileSync(path.join(root, relativePath));
  assert(buffer.subarray(0, 4).toString('ascii') === 'RIFF', `${relativePath} must start with RIFF`);
  assert(buffer.subarray(8, 12).toString('ascii') === 'WAVE', `${relativePath} must be a WAVE file`);

  const formatOffset = findWavChunk(buffer, 'fmt ');
  const dataOffset = findWavChunk(buffer, 'data');
  assert(formatOffset > 0, `${relativePath} is missing fmt chunk`);
  assert(dataOffset > 0, `${relativePath} is missing data chunk`);

  const fmtStart = formatOffset + 8;
  const dataBytes = buffer.readUInt32LE(dataOffset + 4);
  const byteRate = buffer.readUInt32LE(fmtStart + 8);

  return {
    formatCode: buffer.readUInt16LE(fmtStart),
    channels: buffer.readUInt16LE(fmtStart + 2),
    sampleRate: buffer.readUInt32LE(fmtStart + 4),
    bitsPerSample: buffer.readUInt16LE(fmtStart + 14),
    dataBytes,
    durationSeconds: Number((dataBytes / byteRate).toFixed(2)),
  };
}

function findWavChunk(buffer, id) {
  let offset = 12;

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.subarray(offset, offset + 4).toString('ascii');
    const chunkSize = buffer.readUInt32LE(offset + 4);

    if (chunkId === id) return offset;

    offset += 8 + chunkSize + (chunkSize % 2);
  }

  return -1;
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

function sameSet(actual, expected, label) {
  const missing = expected.filter((item) => !actual.includes(item));
  const extra = actual.filter((item) => !expected.includes(item));
  assert(missing.length === 0, `${label} missing: ${missing.join(', ')}`);
  assert(extra.length === 0, `${label} extra: ${extra.join(', ')}`);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function requireFresh(modulePath) {
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

function findPlugin(config, pluginName) {
  return (config.plugins ?? []).find((plugin) => (Array.isArray(plugin) ? plugin[0] : plugin) === pluginName);
}

function splitKeywords(value) {
  return String(value ?? '')
    .split(',')
    .map((keyword) => keyword.trim())
    .filter(Boolean);
}

function findTermHits(sources, terms) {
  const hits = [];

  for (const [sourceName, sourceValue] of Object.entries(sources)) {
    const rawSource = String(sourceValue ?? '');
    const source = rawSource.toLocaleLowerCase();

    for (const term of terms) {
      const normalizedTerm = term.toLocaleLowerCase();
      const asciiTerm = /^[a-z0-9][a-z0-9 -]*[a-z0-9]$/i.test(term);
      const found = asciiTerm
        ? new RegExp(`(^|[^a-z0-9])${escapeRegExp(term)}([^a-z0-9]|$)`, 'i').test(rawSource)
        : source.includes(normalizedTerm);

      if (found) {
        hits.push(`${sourceName}: ${term}`);
      }
    }
  }

  return hits;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isRealAdMobId(value, pattern) {
  return pattern.test(value ?? '') && !admobPlaceholderPattern.test(value ?? '') && !admobDemoPublisherPattern.test(value ?? '');
}

function tsPropertyName(name) {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
  return undefined;
}

function collectStudyTextKeys(source, filename) {
  const sourceFile = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true);
  const keys = new Set();

  function visit(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'text') {
      const firstArg = node.arguments[0];
      if (firstArg && ts.isStringLiteralLike(firstArg)) {
        keys.add(firstArg.text);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return keys;
}

function collectContentTranslations(source, filename) {
  const sourceFile = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true);
  const entries = new Map();

  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'contentTranslations' &&
      node.initializer &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      for (const property of node.initializer.properties) {
        if (!ts.isPropertyAssignment(property)) continue;

        const key = tsPropertyName(property.name);
        if (!key || !ts.isObjectLiteralExpression(property.initializer)) continue;

        const translations = new Map();
        for (const localeProperty of property.initializer.properties) {
          if (!ts.isPropertyAssignment(localeProperty)) continue;

          const locale = tsPropertyName(localeProperty.name);
          if (locale && ts.isStringLiteralLike(localeProperty.initializer)) {
            translations.set(locale, localeProperty.initializer.text);
          }
        }

        entries.set(key, translations);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return entries;
}

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
const fakeStoreEnv = {
  APP_STORE_BASE_URL: 'https://kana-sprint.app',
  APP_STORE_MARKETING_URL: undefined,
  APP_STORE_SUPPORT_URL: undefined,
  APP_STORE_PRIVACY_URL: undefined,
};
const clearedAdEnv = Object.fromEntries(adEnvKeys.map((key) => [key, undefined]));
const admobAppIdPattern = /^ca-app-pub-\d{16}~\d{10}$/;
const admobUnitIdPattern = /^ca-app-pub-\d{16}\/\d{10}$/;
const admobPlaceholderPattern = /^ca-app-pub-0{16}[~/]0{10}$/;
const admobDemoPublisherPattern = /^ca-app-pub-3940256099942544[~/]/;
const staticAppJson = readJson('app.json').expo;
const dynamicConfigPath = path.join(root, 'app.config.js');
const storeConfigPath = path.join(root, 'store.config.js');
const resolveAppConfig = fs.existsSync(dynamicConfigPath) ? require(dynamicConfigPath) : null;
const storeConfig = fs.existsSync(storeConfigPath) ? require(storeConfigPath) : null;
const storeConfigWithStoreUrls = fs.existsSync(storeConfigPath)
  ? withEnv(fakeStoreEnv, () => requireFresh(storeConfigPath))
  : null;
const appJson = resolveAppConfig ? resolveAppConfig({ config: clone(staticAppJson) }) : staticAppJson;
const appConfigWithoutAds = resolveAppConfig
  ? withEnv(clearedAdEnv, () => resolveAppConfig({ config: clone(staticAppJson) }))
  : staticAppJson;
const appConfigWithAds = resolveAppConfig
  ? withEnv(fakeAdEnv, () => resolveAppConfig({ config: clone(staticAppJson) }))
  : staticAppJson;
const appConfigWithPlaceholderAds = resolveAppConfig
  ? withEnv(fakePlaceholderAdEnv, () => resolveAppConfig({ config: clone(staticAppJson) }))
  : staticAppJson;
const appConfigWithDemoAds = resolveAppConfig
  ? withEnv(fakeDemoAdEnv, () => resolveAppConfig({ config: clone(staticAppJson) }))
  : staticAppJson;
const appConfigWithStoreUrls = resolveAppConfig
  ? withEnv(fakeStoreEnv, () => resolveAppConfig({ config: clone(staticAppJson) }))
  : staticAppJson;
const metadata = readJson('docs/app-store-localizations.json');
const screenshotManifest = readJson('docs/app-store-screenshot-manifest.json');
const screenshotQaAudit = readJson('docs/screenshot-qa-audit.json');
const metadataPreview = readJson('docs/app-store-metadata-preview.json');
const appStoreCopyAudit = readJson('docs/app-store-copy-audit.json');
const metadataUploadPacket = readJson('docs/app-store-metadata-upload-packet.json');
const runtimeAssetManifest = readJson('docs/runtime-asset-manifest.json');
const publicSiteManifest = readJson('docs/public-site-manifest.json');
const publicSiteDeployAudit = readJson('docs/public-site-deploy-audit.json');
const publicSiteHostingHandoff = readJson('docs/public-site-hosting-handoff.json');
const publicSiteHostingVerification = readJson('docs/public-site-hosting-verification.json');
const localizationAudit = readJson('docs/localization-audit.json');
const reviewGuide = readJson('docs/app-store-review-guide.json');
const ageRatingAudit = readJson('docs/app-store-age-rating-audit.json');
const studyBankDepthAudit = readJson('docs/study-bank-depth-audit.json');
const studyContentLocalizationAudit = readJson('docs/study-content-localization-audit.json');
const contentRightsAudit = readJson('docs/content-rights-audit.json');
const openSourceLicenseAudit = readJson('docs/open-source-license-audit.json');
const privacyManifestAudit = readJson('docs/privacy-manifest-audit.json');
const privacyAnswers = readJson('docs/app-store-privacy-answers.json');
const privacyReviewPacket = readJson('docs/privacy-review-packet.json');
const admobReleaseAudit = readJson('docs/admob-release-audit.json');
const admobSetupHandoff = readJson('docs/admob-setup-handoff.json');
const dataFlowPrivacyAudit = readJson('docs/data-flow-privacy-audit.json');
const runtimeUiFlowAudit = readJson('docs/runtime-ui-flow-audit.json');
const productionSmokeTest = readJson('docs/production-device-smoke-test.json');
const externalReadiness = readJson('docs/external-readiness.json');
const externalTodoTracker = readJson('docs/external-todo-tracker.json');
const easEnvChecklist = readJson('docs/eas-env-checklist.json');
const storeSubmissionInputPack = readJson('docs/store-submission-input-pack.json');
const accountServicePreflight = readJson('docs/account-service-preflight.json');
const easBuildPreflight = readJson('docs/eas-build-preflight.json');
const appStoreConnectChecklist = readJson('docs/app-store-connect-checklist.json');
const releasePacket = readJson('docs/release-packet.json');
const easSubmissionChecklist = readJson('docs/eas-submission-checklist.json');
const finalLaunchRunbook = readJson('docs/final-launch-runbook.json');
const appStoreHandoffBundle = readJson('docs/app-store-handoff-bundle.json');
const runtimeUiFlowRatio = `${runtimeUiFlowAudit.summary?.passedChecks}/${runtimeUiFlowAudit.summary?.checks}`;
const easJson = readJson('eas.json');
const packageJson = readJson('package.json');
const appSource = fs.readFileSync(path.join(root, 'App.tsx'), 'utf8');
const envExampleSource = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
const i18nSource = fs.readFileSync(path.join(root, 'src/i18n.ts'), 'utf8');
const screenshotSource = fs.readFileSync(path.join(root, 'scripts/generate-store-screenshots.py'), 'utf8');
const releaseVerifySource = fs.readFileSync(path.join(root, 'scripts/release-verify.js'), 'utf8');
const gameDataSource = fs.readFileSync(path.join(root, 'src/gameData.ts'), 'utf8');
const grammarDataSource = fs.readFileSync(path.join(root, 'src/grammarData.ts'), 'utf8');
const gameEngineSource = fs.readFileSync(path.join(root, 'src/gameEngine.ts'), 'utf8');
const gameplayContractSource = fs.readFileSync(path.join(root, 'scripts/check-gameplay-contract.js'), 'utf8');
const adsFallbackSource = fs.readFileSync(path.join(root, 'src/ads.ts'), 'utf8');
const adsNativeSource = fs.readFileSync(path.join(root, 'src/ads.native.ts'), 'utf8');
const adsWebSource = fs.readFileSync(path.join(root, 'src/ads.web.ts'), 'utf8');
const privacyDoc = fs.readFileSync(path.join(root, 'docs/privacy.md'), 'utf8');
const supportDoc = fs.readFileSync(path.join(root, 'docs/support.md'), 'utf8');
const runtimeAssetManifestDoc = fs.readFileSync(path.join(root, 'docs/runtime-asset-manifest.md'), 'utf8');
const publicSiteDeployAuditDoc = fs.readFileSync(path.join(root, 'docs/public-site-deploy-audit.md'), 'utf8');
const publicSiteHostingHandoffDoc = fs.readFileSync(path.join(root, 'docs/public-site-hosting-handoff.md'), 'utf8');
const publicSiteHostingVerificationDoc = fs.readFileSync(path.join(root, 'docs/public-site-hosting-verification.md'), 'utf8');
const screenshotQaAuditDoc = fs.readFileSync(path.join(root, 'docs/screenshot-qa-audit.md'), 'utf8');
const appStoreCopyAuditDoc = fs.readFileSync(path.join(root, 'docs/app-store-copy-audit.md'), 'utf8');
const metadataUploadPacketDoc = fs.readFileSync(path.join(root, 'docs/app-store-metadata-upload-packet.md'), 'utf8');
const localizationAuditDoc = fs.readFileSync(path.join(root, 'docs/localization-audit.md'), 'utf8');
const reviewGuideDoc = fs.readFileSync(path.join(root, 'docs/app-store-review-guide.md'), 'utf8');
const ageRatingAuditDoc = fs.readFileSync(path.join(root, 'docs/app-store-age-rating-audit.md'), 'utf8');
const studyBankDepthAuditDoc = fs.readFileSync(path.join(root, 'docs/study-bank-depth-audit.md'), 'utf8');
const studyContentLocalizationAuditDoc = fs.readFileSync(path.join(root, 'docs/study-content-localization-audit.md'), 'utf8');
const contentRightsAuditDoc = fs.readFileSync(path.join(root, 'docs/content-rights-audit.md'), 'utf8');
const openSourceLicenseAuditDoc = fs.readFileSync(path.join(root, 'docs/open-source-license-audit.md'), 'utf8');
const privacyManifestAuditDoc = fs.readFileSync(path.join(root, 'docs/privacy-manifest-audit.md'), 'utf8');
const privacyReviewPacketDoc = fs.readFileSync(path.join(root, 'docs/privacy-review-packet.md'), 'utf8');
const admobReleaseAuditDoc = fs.readFileSync(path.join(root, 'docs/admob-release-audit.md'), 'utf8');
const admobSetupHandoffDoc = fs.readFileSync(path.join(root, 'docs/admob-setup-handoff.md'), 'utf8');
const dataFlowPrivacyAuditDoc = fs.readFileSync(path.join(root, 'docs/data-flow-privacy-audit.md'), 'utf8');
const runtimeUiFlowAuditDoc = fs.readFileSync(path.join(root, 'docs/runtime-ui-flow-audit.md'), 'utf8');
const productionSmokeTestDoc = fs.readFileSync(path.join(root, 'docs/production-device-smoke-test.md'), 'utf8');
const externalReadinessDoc = fs.readFileSync(path.join(root, 'docs/external-readiness.md'), 'utf8');
const externalTodoTrackerDoc = fs.readFileSync(path.join(root, 'docs/external-todo-tracker.md'), 'utf8');
const easEnvChecklistDoc = fs.readFileSync(path.join(root, 'docs/eas-env-checklist.md'), 'utf8');
const storeSubmissionInputPackDoc = fs.readFileSync(path.join(root, 'docs/store-submission-input-pack.md'), 'utf8');
const storeSubmissionEnvTemplateDoc = fs.existsSync(path.join(root, 'docs/store-submission.env.template'))
  ? fs.readFileSync(path.join(root, 'docs/store-submission.env.template'), 'utf8')
  : '';
const accountServicePreflightDoc = fs.readFileSync(path.join(root, 'docs/account-service-preflight.md'), 'utf8');
const easBuildPreflightDoc = fs.readFileSync(path.join(root, 'docs/eas-build-preflight.md'), 'utf8');
const appStoreConnectChecklistDoc = fs.readFileSync(path.join(root, 'docs/app-store-connect-checklist.md'), 'utf8');
const releasePacketDoc = fs.readFileSync(path.join(root, 'docs/release-packet.md'), 'utf8');
const easSubmissionChecklistDoc = fs.readFileSync(path.join(root, 'docs/eas-submission-checklist.md'), 'utf8');
const finalLaunchRunbookDoc = fs.readFileSync(path.join(root, 'docs/final-launch-runbook.md'), 'utf8');
const appStoreHandoffBundleDoc = fs.readFileSync(path.join(root, 'docs/app-store-handoff-bundle.md'), 'utf8');
const releaseHandoffDoc = fs.readFileSync(path.join(root, 'docs/release-handoff.md'), 'utf8');
const readmeDoc = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
const easIgnoreSource = fs.existsSync(path.join(root, '.easignore')) ? fs.readFileSync(path.join(root, '.easignore'), 'utf8') : '';
const appConfigSource = fs.readFileSync(path.join(root, 'app.config.js'), 'utf8');
const storeConfigSource = fs.readFileSync(path.join(root, 'store.config.js'), 'utf8');
const loadEnvSource = fs.readFileSync(path.join(root, 'scripts/load-env.js'), 'utf8');
const releaseStatusSource = fs.readFileSync(path.join(root, 'scripts/release-status.js'), 'utf8');
const admobReleaseAuditGeneratorSource = fs.readFileSync(path.join(root, 'scripts/generate-admob-release-audit.js'), 'utf8');
const admobSetupHandoffSource = fs.readFileSync(path.join(root, 'scripts/generate-admob-setup-handoff.js'), 'utf8');
const publicSiteHostingVerifierSource = fs.readFileSync(path.join(root, 'scripts/verify-public-site-hosting.js'), 'utf8');
const publicSiteHostingHandoffSource = fs.readFileSync(path.join(root, 'scripts/generate-public-site-hosting-handoff.js'), 'utf8');
const releaseVerifyWorkflowSource = fs.existsSync(path.join(root, '.github/workflows/release-verify.yml'))
  ? fs.readFileSync(path.join(root, '.github/workflows/release-verify.yml'), 'utf8')
  : '';
const appStorePrivacyAnswersDocPath = 'docs/app-store-privacy-answers.md';
const appStorePrivacyAnswersDoc = fs.existsSync(path.join(root, appStorePrivacyAnswersDocPath))
  ? fs.readFileSync(path.join(root, appStorePrivacyAnswersDocPath), 'utf8')
  : '';
const publicSitePages = {
  'site/index.html': ['Kana Sprint', 'JLPT N5-N1', 'Support', 'Privacy Policy', 'Open Source'],
  'site/support/index.html': ['Kana Sprint Support', 'does not require sign-in', 'original study material'],
  'site/privacy/index.html': ['Privacy Policy', 'does not collect personal data', 'daily goal progress', 'Google Mobile Ads', 'non-personalized ads'],
  'site/licenses/index.html': ['Open Source Notices', 'Runtime packages', 'Direct Runtime Dependencies'],
};
for (const locale of expectedLocales) {
  publicSitePages[`site/${locale}/index.html`] = ['Kana Sprint', 'JLPT N5-N1'];
  publicSitePages[`site/${locale}/support/index.html`] = ['Kana Sprint', 'JLPT N5-N1'];
  publicSitePages[`site/${locale}/privacy/index.html`] = ['Kana Sprint', 'Google Mobile Ads'];
  publicSitePages[`site/${locale}/licenses/index.html`] = ['Kana Sprint', 'Runtime packages'];
}
const publicSiteSources = Object.fromEntries(
  Object.keys(publicSitePages).map((pagePath) => [
    pagePath,
    fs.existsSync(path.join(root, pagePath)) ? fs.readFileSync(path.join(root, pagePath), 'utf8') : '',
  ]),
);
const localizedSiteExpectations = {
  'zh-Hans': {
    language: '简体中文',
    supportLabel: '支持',
    privacyLabel: '隐私政策',
    supportTitle: 'Kana Sprint 支持',
    privacyTitle: '隐私政策',
    supportSnippet: '是否需要账号？',
    privacySnippet: '本地数据',
    localDataSnippet: '每日目标进度',
  },
  'zh-Hant': {
    language: '繁體中文',
    supportLabel: '支援',
    privacyLabel: '隱私政策',
    supportTitle: 'Kana Sprint 支援',
    privacyTitle: '隱私政策',
    supportSnippet: '是否需要帳號？',
    privacySnippet: '本地資料',
    localDataSnippet: '每日目標進度',
  },
  en: {
    language: 'English',
    supportLabel: 'Support',
    privacyLabel: 'Privacy Policy',
    supportTitle: 'Kana Sprint Support',
    privacyTitle: 'Privacy Policy',
    supportSnippet: 'Does the app require an account?',
    privacySnippet: 'Local Data',
    localDataSnippet: 'daily goal progress',
  },
  fr: {
    language: 'Français',
    supportLabel: 'Assistance',
    privacyLabel: 'Confidentialité',
    supportTitle: 'Assistance Kana Sprint',
    privacyTitle: 'Politique de confidentialité',
    supportSnippet: "L'app nécessite-t-elle un compte ?",
    privacySnippet: 'Données locales',
    localDataSnippet: "progression de l'objectif du jour",
  },
  it: {
    language: 'Italiano',
    supportLabel: 'Supporto',
    privacyLabel: 'Privacy',
    supportTitle: 'Supporto Kana Sprint',
    privacyTitle: 'Informativa sulla privacy',
    supportSnippet: "L'app richiede un account?",
    privacySnippet: 'Dati locali',
    localDataSnippet: "progressi dell'obiettivo giornaliero",
  },
  de: {
    language: 'Deutsch',
    supportLabel: 'Hilfe',
    privacyLabel: 'Datenschutz',
    supportTitle: 'Kana Sprint Hilfe',
    privacyTitle: 'Datenschutzerklärung',
    supportSnippet: 'Benötigt die App ein Konto?',
    privacySnippet: 'Lokale Daten',
    localDataSnippet: 'Tagesziel-Fortschritt',
  },
  'es-ES': {
    language: 'Español',
    supportLabel: 'Soporte',
    privacyLabel: 'Privacidad',
    supportTitle: 'Soporte de Kana Sprint',
    privacyTitle: 'Política de privacidad',
    supportSnippet: '¿La app requiere una cuenta?',
    privacySnippet: 'Datos locales',
    localDataSnippet: 'progreso del objetivo diario',
  },
  ko: {
    language: '한국어',
    supportLabel: '지원',
    privacyLabel: '개인정보 처리방침',
    supportTitle: 'Kana Sprint 지원',
    privacyTitle: '개인정보 처리방침',
    supportSnippet: '계정이 필요한가요?',
    privacySnippet: '로컬 데이터',
    localDataSnippet: '오늘 목표 진행도',
  },
  pl: {
    language: 'Polski',
    supportLabel: 'Pomoc',
    privacyLabel: 'Prywatność',
    supportTitle: 'Pomoc Kana Sprint',
    privacyTitle: 'Polityka prywatności',
    supportSnippet: 'Czy aplikacja wymaga konta?',
    privacySnippet: 'Dane lokalne',
    localDataSnippet: 'postęp celu dziennego',
  },
  'pt-BR': {
    language: 'Português BR',
    supportLabel: 'Suporte',
    privacyLabel: 'Privacidade',
    supportTitle: 'Suporte do Kana Sprint',
    privacyTitle: 'Política de privacidade',
    supportSnippet: 'O app exige uma conta?',
    privacySnippet: 'Dados locais',
    localDataSnippet: 'progresso da meta diária',
  },
};
const localizedEnglishFallbackMarkers = [
  'Does the app require an account?',
  'Where is progress stored?',
  'Why are ads unavailable?',
  'Does the app quote real anime?',
  'Privacy Policy',
  'Local Data',
  'No Account or Tracking',
  'Rewarded Ads',
  'Progress and settings stay on the device.',
  'The app follows the system language',
  'Anime-style lines do not quote protected',
];
const expectedJlptLevels = ['N5', 'N4', 'N3', 'N2', 'N1'];
const expectedSdkVersions = {
  node: '>=22.13.0',
  expo: '~56.0.15',
  expoAsset: '~56.0.19',
  expoBuildProperties: '~56.0.22',
  expoConstants: '~56.0.20',
  expoMetroRuntime: '~56.0.16',
  expoSpeech: '~56.0.3',
  expoSplashScreen: '~56.0.12',
  react: '19.2.3',
  reactDom: '19.2.3',
  reactNative: '0.85.3',
  reactNativeWeb: '^0.21.2',
};
const expectedNativeBuildProperties = {
  iosDeploymentTarget: '16.4',
  androidCompileSdkVersion: 36,
  androidTargetSdkVersion: 36,
  androidMinSdkVersion: 24,
  androidBuildToolsVersion: '36.0.0',
};
const expectedAppleLocales = {
  'zh-Hans': 'zh-Hans',
  'zh-Hant': 'zh-Hant',
  en: 'en-US',
  fr: 'fr-FR',
  it: 'it',
  de: 'de-DE',
  'es-ES': 'es-ES',
  ko: 'ko',
  pl: 'pl',
  'pt-BR': 'pt-BR',
};
const expectedContentTranslationLocales = ['fr', 'it', 'de', 'es-ES', 'pl', 'pt-BR'];
const expectedBgmFiles = [
  'assets/bgm/dojo_rush_loop.wav',
  'assets/bgm/neon_focus_loop.wav',
  'assets/bgm/starline_night_loop.wav',
];
const expectedStoreScreenshots = {
  'assets/store/ios/iphone-6.9': { width: 1320, height: 2868 },
  'assets/store/ios/iphone-6.5': { width: 1242, height: 2688 },
  'assets/store/ios/iphone-5.5': { width: 1242, height: 2208 },
  'assets/store/ios/ipad-13': { width: 2048, height: 2732 },
};
const localizedStoreScreenshotRoot = 'assets/store/ios-localized';
const expectedStoreScreenshotFiles = [
  '01-ready.png',
  '02-playing.png',
  '03-levels.png',
  '04-settings.png',
];
const expectedStoreScreenshotScenes = [
  'Ready screen',
  'Active round with rewarded-ad continue entry',
  'JLPT N5-N1 level selection',
  'Settings, language, BGM, local data, support, privacy',
];
const expectedEasIgnoreEntries = [
  'node_modules/',
  '.expo/',
  '.release-web-check/',
  '.env*.local',
  '/ios',
  '/android',
  '/assets/store',
  '/site',
  '/docs',
];
const blockedAndroidPermissions = [
  'android.permission.RECORD_AUDIO',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
];
const expectedReviewEnvKeys = [
  'APP_STORE_REVIEW_FIRST_NAME',
  'APP_STORE_REVIEW_LAST_NAME',
  'APP_STORE_REVIEW_EMAIL',
  'APP_STORE_REVIEW_PHONE',
];
const requiredStoreConfirmationEnv = {
  ADMOB_PRIVACY_MESSAGES_CONFIGURED: 'Set ADMOB_PRIVACY_MESSAGES_CONFIGURED=1 after configuring AdMob Privacy & messaging and confirming UMP canRequestAds in a production build.',
  APP_STORE_BUNDLE_ID_CONFIRMED: 'Set APP_STORE_BUNDLE_ID_CONFIRMED=1 after confirming app.json iOS bundleIdentifier and Android package match the final store records.',
  APP_STORE_CONNECT_RECORD_READY: 'Set APP_STORE_CONNECT_RECORD_READY=1 after creating the App Store Connect app record for the final bundle ID.',
  EAS_REMOTE_VERSION_INITIALIZED: 'Set EAS_REMOTE_VERSION_INITIALIZED=1 after running npx eas-cli build:version:set for the production iOS app.',
  PRODUCTION_DEVICE_TESTED: 'Set PRODUCTION_DEVICE_TESTED=1 after testing the production build on a physical iPhone or TestFlight.',
};
const expectedPrivacyReasons = {
  NSPrivacyAccessedAPICategoryUserDefaults: 'CA92.1',
  NSPrivacyAccessedAPICategoryFileTimestamp: 'C617.1',
};
const originalityMarkers = {
  'zh-Hans': '原创',
  'zh-Hant': '原創',
  en: 'original',
  fr: 'originales',
  it: 'originali',
  de: 'originale',
  'es-ES': 'originales',
  ko: '오리지널',
  pl: 'oryginalne',
  'pt-BR': 'originais',
};
const liveAdPrivacyDisclosures = [
  'Google Mobile Ads',
  'IP address',
  'Device ID',
  'advertising data',
  'performance data',
  'product interaction',
  'non-personalized ads',
  'rewarded-ad',
  'Ad privacy',
];
const riskyAnimeKeywordTerms = ['anime lines', '动漫台词', '動漫台詞'];
const protectedAnimeIpTerms = [
  'attack on titan',
  'demon slayer',
  'dragon ball',
  'ghibli',
  'goku',
  'luffy',
  'my hero academia',
  'naruto',
  'one piece',
  'pikachu',
  'pokemon',
  'pokémon',
  'sailor moon',
  'totoro',
  '나루토',
  '루피',
  '세일러문',
  '원피스',
  '포켓몬',
  '피카츄',
  'ジブリ',
  'トトロ',
  'ナルト',
  'ピカチュウ',
  'ポケモン',
  'ルフィ',
  'ワンピース',
  '僕のヒーローアカデミア',
  '悟空',
  '我的英雄学院',
  '海贼王',
  '海賊王',
  '進击的巨人',
  '進撃の巨人',
  '鬼滅',
  '鬼灭',
];
const appShellColor = '#10151F';
const levelMinimums = {
  N5: { vocab: 130, lines: 40 },
  N4: { vocab: 90, lines: 24 },
  N3: { vocab: 90, lines: 24 },
  N2: { vocab: 90, lines: 24 },
  N1: { vocab: 90, lines: 24 },
};

sameSet(Object.keys(appJson.locales ?? {}), expectedLocales, 'app.json locales');
sameSet(Object.keys(metadata), expectedLocales, 'App Store metadata locales');
assert(!(appJson.locales ?? {}).ja, 'Japanese must not be exposed as an app UI language');
assert(!Object.prototype.hasOwnProperty.call(metadata, 'ja'), 'Japanese App Store localization should stay removed');
assert(appJson.userInterfaceStyle === 'dark', 'Top-level userInterfaceStyle should stay dark to match the game shell');
assert(appJson.backgroundColor === appShellColor, `Top-level backgroundColor should be ${appShellColor}`);
assert(appJson.primaryColor === '#FFB23F', 'Top-level primaryColor should match the app accent');
assert(appJson.ios?.userInterfaceStyle === 'dark', 'iOS userInterfaceStyle should stay dark');
assert(appJson.ios?.backgroundColor === appShellColor, `iOS backgroundColor should be ${appShellColor}`);
assert(appJson.android?.userInterfaceStyle === 'dark', 'Android userInterfaceStyle should stay dark');
assert(appJson.android?.backgroundColor === appShellColor, `Android backgroundColor should be ${appShellColor}`);
assert((appJson.description ?? '').includes('JLPT N5-N1'), 'App description should mention JLPT N5-N1 vocabulary');
assert(privacyDoc.includes('itself does not collect personal data'), 'Privacy policy draft should distinguish app-owned local data from ad SDK data');
assert(privacyDoc.includes('daily goal progress'), 'Privacy policy draft should disclose local daily goal progress storage');
assert(supportDoc.includes('Kana Sprint Support'), 'Support page draft should include a clear support heading');
assert(supportDoc.includes('does not require sign-in'), 'Support page draft should mention no account requirement');
assert(supportDoc.includes('daily goal progress'), 'Support page draft should disclose local daily goal progress storage');

for (const snippet of liveAdPrivacyDisclosures) {
  assert(privacyDoc.includes(snippet), `Privacy policy draft missing live-ad disclosure: ${snippet}`);
  assert((publicSiteSources['site/privacy/index.html'] ?? '').includes(snippet), `Public privacy page missing live-ad disclosure: ${snippet}`);
}

const copyrightScanSources = {
  'app.json': JSON.stringify(staticAppJson),
  'docs/app-store-localizations.json': JSON.stringify(metadata),
  'docs/app-store-notes.md': fs.readFileSync(path.join(root, 'docs/app-store-notes.md'), 'utf8'),
  'README.md': readmeDoc,
  'src/gameData.ts': gameDataSource,
  ...publicSiteSources,
};
const protectedIpHits = findTermHits(copyrightScanSources, protectedAnimeIpTerms);
assert(
  protectedIpHits.length === 0,
  `Protected anime/IP references should not appear in study data, store metadata, or public pages: ${protectedIpHits.join(', ')}`,
);

for (const [pagePath, requiredSnippets] of Object.entries(publicSitePages)) {
  const absolutePagePath = path.join(root, pagePath);
  assert(fs.existsSync(absolutePagePath), `Missing deployable public site page: ${pagePath}`);

  if (fs.existsSync(absolutePagePath)) {
    const pageHtml = fs.readFileSync(absolutePagePath, 'utf8');
    assert(pageHtml.includes('<!doctype html>'), `${pagePath} should be a standalone HTML page`);
    assert(!/example\.(com|org|net)/i.test(pageHtml), `${pagePath} should not contain example domains`);

    for (const snippet of requiredSnippets) {
      assert(pageHtml.includes(snippet), `${pagePath} missing required content: ${snippet}`);
    }
  }
}

sameSet(Object.keys(localizedSiteExpectations), expectedLocales, 'Localized public site expectations');

for (const [locale, expectation] of Object.entries(localizedSiteExpectations)) {
  const landingPath = `site/${locale}/index.html`;
  const supportPath = `site/${locale}/support/index.html`;
  const privacyPath = `site/${locale}/privacy/index.html`;
  const landingHtml = publicSiteSources[landingPath] ?? '';
  const supportHtml = publicSiteSources[supportPath] ?? '';
  const privacyHtml = publicSiteSources[privacyPath] ?? '';
  const combinedLocalizedHtml = [landingHtml, supportHtml, privacyHtml].join('\n');

  assert(landingHtml.includes(`<html lang="${locale}">`), `${landingPath} should declare html lang="${locale}"`);
  assert(supportHtml.includes(`<html lang="${locale}">`), `${supportPath} should declare html lang="${locale}"`);
  assert(privacyHtml.includes(`<html lang="${locale}">`), `${privacyPath} should declare html lang="${locale}"`);
  assert(landingHtml.includes(`>${expectation.supportLabel}</a>`), `${landingPath} should use localized support label: ${expectation.supportLabel}`);
  assert(landingHtml.includes(`>${expectation.privacyLabel}</a>`), `${landingPath} should use localized privacy label: ${expectation.privacyLabel}`);
  assert(landingHtml.includes(`<p class="locale-note">${expectation.language}</p>`), `${landingPath} should show the localized language name`);
  assert(supportHtml.includes(`<title>${expectation.supportTitle}</title>`), `${supportPath} should use localized support title: ${expectation.supportTitle}`);
  assert(supportHtml.includes(`<h1>${expectation.supportTitle}</h1>`), `${supportPath} should render localized support heading: ${expectation.supportTitle}`);
  assert(supportHtml.includes(expectation.supportSnippet), `${supportPath} missing localized support body snippet: ${expectation.supportSnippet}`);
  assert(privacyHtml.includes(`<title>${expectation.privacyTitle}</title>`), `${privacyPath} should use localized privacy title: ${expectation.privacyTitle}`);
  assert(privacyHtml.includes(`<h1>${expectation.privacyTitle}</h1>`), `${privacyPath} should render localized privacy heading: ${expectation.privacyTitle}`);
  assert(privacyHtml.includes(expectation.privacySnippet), `${privacyPath} missing localized privacy body snippet: ${expectation.privacySnippet}`);
  assert(privacyHtml.includes(expectation.localDataSnippet), `${privacyPath} missing localized local-data storage snippet: ${expectation.localDataSnippet}`);

  if (locale !== 'en') {
    for (const marker of localizedEnglishFallbackMarkers) {
      assert(!combinedLocalizedHtml.includes(marker), `${locale} localized public pages should not contain English fallback marker: ${marker}`);
    }
  }
}

verifyPublicSiteManifest();
verifyPublicSiteDeployAudit();
verifyPublicSiteHostingHandoff();

assert(easJson.cli?.appVersionSource === 'remote', 'eas.json should use cli.appVersionSource remote to avoid duplicate store build numbers');
assert(easJson.build?.production?.autoIncrement === true, 'EAS production builds should auto-increment developer-facing build versions');
assert(easJson.build?.production?.environment === 'production', 'EAS production builds should use the EAS production environment variables');
assert(Boolean(easJson.submit?.production), 'EAS production submit profile is missing');
assert(easJson.submit?.production?.ios?.metadataPath === './store.config.js', 'EAS Submit should point iOS metadataPath at ./store.config.js');
assertPngAsset(appJson.icon, 'Top-level app icon', 'assets/icon.png', 1024, 1024, { noAlpha: true });
assertPngAsset(appJson.web?.favicon, 'Web favicon', 'assets/favicon.png', 48, 48);

const splashPlugin = findPlugin(appJson, 'expo-splash-screen');
assert(Boolean(splashPlugin), 'expo-splash-screen config plugin is missing');
assert(splashPlugin?.[1]?.backgroundColor === appShellColor, `Splash screen backgroundColor should be ${appShellColor}`);
assert(splashPlugin?.[1]?.resizeMode === 'contain', 'Splash screen resizeMode should stay contain');
assert(splashPlugin?.[1]?.imageWidth === 220, 'Splash screen imageWidth should stay 220 for balanced first launch');
assertPngAsset(splashPlugin?.[1]?.image, 'Splash screen image', 'assets/splash-icon.png', 1024, 1024);

const adaptiveIcon = appJson.android?.adaptiveIcon;
assert(Boolean(adaptiveIcon), 'Android adaptiveIcon configuration is missing');
assert(adaptiveIcon?.backgroundColor === appShellColor, `Android adaptiveIcon backgroundColor should be ${appShellColor}`);
assertPngAsset(adaptiveIcon?.foregroundImage, 'Android adaptive foreground icon', 'assets/android-icon-foreground.png', 1024, 1024, { requireAlpha: true });
assertPngAsset(adaptiveIcon?.backgroundImage, 'Android adaptive background icon', 'assets/android-icon-background.png', 1024, 1024, { noAlpha: true });
assertPngAsset(adaptiveIcon?.monochromeImage, 'Android monochrome icon', 'assets/android-icon-monochrome.png', 1024, 1024, { requireAlpha: true });
verifyRuntimeAssetManifest();

assert(Boolean(resolveAppConfig), 'app.config.js is missing; AdMob native plugin must be guarded by env-aware dynamic config');
assert(!findPlugin(staticAppJson, 'react-native-google-mobile-ads'), 'react-native-google-mobile-ads must not be unconditional in app.json without valid AdMob app IDs');
assert(!findPlugin(appConfigWithoutAds, 'react-native-google-mobile-ads'), 'AdMob native plugin should be disabled when AdMob IDs are missing');
assert(appConfigWithoutAds.extra?.admob?.liveAdsEnabled === false, 'extra.admob.liveAdsEnabled should be false without valid AdMob IDs');
assert(!findPlugin(appConfigWithPlaceholderAds, 'react-native-google-mobile-ads'), 'AdMob native plugin should be disabled for placeholder AdMob IDs');
assert(appConfigWithPlaceholderAds.extra?.admob?.liveAdsEnabled === false, 'extra.admob.liveAdsEnabled should be false for placeholder AdMob IDs');
assert(!findPlugin(appConfigWithDemoAds, 'react-native-google-mobile-ads'), 'AdMob native plugin should be disabled for Google demo AdMob IDs');
assert(appConfigWithDemoAds.extra?.admob?.liveAdsEnabled === false, 'extra.admob.liveAdsEnabled should be false for Google demo AdMob IDs');
const adMobPluginWithAds = findPlugin(appConfigWithAds, 'react-native-google-mobile-ads');
assert(Array.isArray(adMobPluginWithAds), 'AdMob native plugin should be enabled when all AdMob IDs are valid');
assert(adMobPluginWithAds?.[1]?.iosAppId === fakeAdEnv.EXPO_PUBLIC_ADMOB_IOS_APP_ID, 'AdMob iOS app ID is not injected from env');
assert(adMobPluginWithAds?.[1]?.androidAppId === fakeAdEnv.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID, 'AdMob Android app ID is not injected from env');
assert(adMobPluginWithAds?.[1]?.delayAppMeasurementInit === true, 'AdMob app measurement initialization should be delayed');
assert((adMobPluginWithAds?.[1]?.skAdNetworkItems ?? []).length >= 40, 'AdMob SKAdNetwork identifiers are missing or too small');
assert(appConfigWithAds.extra?.admob?.liveAdsEnabled === true, 'extra.admob.liveAdsEnabled should be true with valid AdMob IDs');
assert(Boolean(appJson.extra?.storeUrls), 'extra.storeUrls should exist so the app can expose support and privacy links');
assert(appConfigWithStoreUrls.extra?.storeUrls?.marketingUrl === fakeStoreEnv.APP_STORE_BASE_URL, 'extra.storeUrls.marketingUrl should derive from APP_STORE_BASE_URL');
assert(appConfigWithStoreUrls.extra?.storeUrls?.supportUrl === `${fakeStoreEnv.APP_STORE_BASE_URL}/support`, 'extra.storeUrls.supportUrl should derive from APP_STORE_BASE_URL/support');
assert(appConfigWithStoreUrls.extra?.storeUrls?.privacyPolicyUrl === `${fakeStoreEnv.APP_STORE_BASE_URL}/privacy`, 'extra.storeUrls.privacyPolicyUrl should derive from APP_STORE_BASE_URL/privacy');
assert(appConfigWithStoreUrls.extra?.storeUrls?.localized?.['zh-Hans']?.supportUrl === `${fakeStoreEnv.APP_STORE_BASE_URL}/zh-Hans/support`, 'extra.storeUrls.localized.zh-Hans.supportUrl should derive from APP_STORE_BASE_URL/zh-Hans/support');
assert(appConfigWithStoreUrls.extra?.storeUrls?.localized?.ko?.privacyPolicyUrl === `${fakeStoreEnv.APP_STORE_BASE_URL}/ko/privacy`, 'extra.storeUrls.localized.ko.privacyPolicyUrl should derive from APP_STORE_BASE_URL/ko/privacy');

assert(Boolean(storeConfig), 'store.config.js is missing; App Store metadata should be managed with EAS Metadata');
assert(Boolean(storeConfigWithStoreUrls), 'store.config.js should resolve with APP_STORE_BASE_URL for localized URL checks');
assert(storeConfig?.configVersion === 0, 'store.config.js configVersion should be 0');
assert(storeConfig?.apple?.version === appJson.version, 'EAS Metadata apple.version should match app.json version');
assert((storeConfig?.apple?.copyright ?? '').includes('Kana Sprint'), 'EAS Metadata copyright should name Kana Sprint');
assert(JSON.stringify(storeConfig?.apple?.categories ?? []) === JSON.stringify([['GAMES', 'GAMES_WORD'], 'EDUCATION']), 'EAS Metadata categories should be Games/Word plus Education');
assert(storeConfig?.apple?.release?.automaticRelease === false, 'EAS Metadata release should use manual App Store release');
assert(storeConfig?.apple?.release?.phasedRelease === false, 'EAS Metadata phased release should be disabled for v1');

const advisory = storeConfig?.apple?.advisory ?? {};
for (const advisoryKey of [
  'alcoholTobaccoOrDrugUseOrReferences',
  'contests',
  'gamblingSimulated',
  'horrorOrFearThemes',
  'matureOrSuggestiveThemes',
  'medicalOrTreatmentInformation',
  'profanityOrCrudeHumor',
  'sexualContentGraphicAndNudity',
  'sexualContentOrNudity',
  'violenceCartoonOrFantasy',
  'violenceRealistic',
  'violenceRealisticProlongedGraphicOrSadistic',
]) {
  assert(advisory[advisoryKey] === 'NONE', `EAS Metadata advisory ${advisoryKey} should be NONE`);
}

assert(advisory.gambling === false, 'EAS Metadata advisory gambling should be false');
assert(advisory.unrestrictedWebAccess === false, 'EAS Metadata advisory unrestrictedWebAccess should be false');
assert(advisory.kidsAgeBand === null, 'EAS Metadata advisory kidsAgeBand should be null because the app is not in Kids category');
assert(advisory.ageRatingOverride === 'NONE', 'EAS Metadata advisory ageRatingOverride should be NONE');
assert(advisory.koreaAgeRatingOverride === 'NONE', 'EAS Metadata advisory koreaAgeRatingOverride should be NONE');

const appleInfo = storeConfig?.apple?.info ?? {};
const appleInfoWithStoreUrls = storeConfigWithStoreUrls?.apple?.info ?? {};
sameSet(Object.keys(appleInfo), Object.values(expectedAppleLocales), 'EAS Metadata Apple locales');

for (const [locale, appleLocale] of Object.entries(expectedAppleLocales)) {
  const localeMetadata = metadata[locale];
  const appleMetadata = appleInfo[appleLocale];

  assert(Boolean(appleMetadata), `Missing EAS Metadata info for ${appleLocale}`);
  assert(appleMetadata?.title === localeMetadata?.name, `EAS Metadata title mismatch for ${appleLocale}`);
  assert(appleMetadata?.subtitle === localeMetadata?.subtitle, `EAS Metadata subtitle mismatch for ${appleLocale}`);
  assert(appleMetadata?.description === localeMetadata?.description, `EAS Metadata description mismatch for ${appleLocale}`);
  assert(appleMetadata?.promoText === localeMetadata?.promotionalText, `EAS Metadata promoText mismatch for ${appleLocale}`);
  assert(JSON.stringify(appleMetadata?.keywords ?? []) === JSON.stringify(splitKeywords(localeMetadata?.keywords)), `EAS Metadata keywords mismatch for ${appleLocale}`);
  assert((appleMetadata?.title ?? '').length >= 2 && (appleMetadata?.title ?? '').length <= 30, `EAS Metadata title length invalid for ${appleLocale}`);
  assert((appleMetadata?.subtitle ?? '').length <= 30, `EAS Metadata subtitle too long for ${appleLocale}`);
  assert((appleMetadata?.promoText ?? '').length <= 170, `EAS Metadata promoText too long for ${appleLocale}`);
  assert((appleMetadata?.description ?? '').length >= 10 && (appleMetadata?.description ?? '').length <= 4000, `EAS Metadata description length invalid for ${appleLocale}`);
  assert((appleMetadata?.keywords ?? []).every((keyword) => keyword.length <= 100), `EAS Metadata keyword too long for ${appleLocale}`);

  const localizedAppleMetadata = appleInfoWithStoreUrls[appleLocale];
  assert(localizedAppleMetadata?.supportUrl === `${fakeStoreEnv.APP_STORE_BASE_URL}/${locale}/support`, `EAS Metadata supportUrl should be localized for ${appleLocale}`);
  assert(localizedAppleMetadata?.privacyPolicyUrl === `${fakeStoreEnv.APP_STORE_BASE_URL}/${locale}/privacy`, `EAS Metadata privacyPolicyUrl should be localized for ${appleLocale}`);

  for (const urlKey of ['marketingUrl', 'supportUrl', 'privacyPolicyUrl']) {
    const urlValue = appleMetadata?.[urlKey];
    if (!urlValue) continue;

    assert(isProductionHttpsUrl(urlValue), `EAS Metadata ${urlKey} for ${appleLocale} should use a production HTTPS URL`);
  }
}

verifyMetadataPreview(appleInfo);

const metadataLocales = Object.values(expectedAppleLocales);
const hasAllSupportUrls = metadataLocales.every((appleLocale) => Boolean(appleInfo[appleLocale]?.supportUrl));
const hasAllPrivacyUrls = metadataLocales.every((appleLocale) => Boolean(appleInfo[appleLocale]?.privacyPolicyUrl));
const hasReviewEnv = expectedReviewEnvKeys.every((key) => Boolean(process.env[key]?.trim()));
const hasValidReviewEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(process.env.APP_STORE_REVIEW_EMAIL ?? '');
const hasValidReviewPhone = digits(process.env.APP_STORE_REVIEW_PHONE).length >= 7;
const reviewInfo = storeConfig?.apple?.review;

requireForStore(hasAllSupportUrls, 'APP_STORE_SUPPORT_URL or APP_STORE_BASE_URL is not set; EAS Metadata supportUrl is missing.');
requireForStore(hasAllPrivacyUrls, 'APP_STORE_PRIVACY_URL or APP_STORE_BASE_URL is not set; EAS Metadata privacyPolicyUrl is missing.');
requireForStore(hasReviewEnv && Boolean(reviewInfo), 'App Store review contact env vars are not set; EAS Metadata review contact is missing.');
requireForStore(!process.env.APP_STORE_REVIEW_EMAIL || hasValidReviewEmail, 'APP_STORE_REVIEW_EMAIL is set but does not look like a valid email address.');
requireForStore(!process.env.APP_STORE_REVIEW_PHONE || hasValidReviewPhone, 'APP_STORE_REVIEW_PHONE is set but does not include enough digits for a review phone number.');

if (reviewInfo) {
  assert(reviewInfo.demoRequired === false, 'EAS Metadata review demoRequired should be false because the app has no login');
  assert((reviewInfo.notes ?? '').includes('does not require sign-in'), 'EAS Metadata review notes should mention no sign-in requirement');
}

assert(packageJson.scripts?.['metadata:ios'] === 'npx eas-cli metadata:push', 'metadata:ios script should run EAS Metadata push');
assert(packageJson.scripts?.['metadata:preview'] === 'node scripts/generate-store-metadata-preview.js', 'metadata:preview script should generate a reviewable App Store metadata preview');
assert(packageJson.scripts?.['metadata:copy-audit'] === 'node scripts/generate-app-store-copy-audit.js', 'metadata:copy-audit script should generate the App Store copy audit');
assert(packageJson.scripts?.['metadata:upload-packet'] === 'node scripts/generate-app-store-metadata-upload-packet.js', 'metadata:upload-packet script should generate the App Store metadata upload packet');
assert(packageJson.scripts?.['screenshots:qa'] === 'node scripts/generate-screenshot-qa-audit.js', 'screenshots:qa script should generate the screenshot QA audit');
assert(packageJson.scripts?.['site:deploy-audit'] === 'node scripts/generate-public-site-deploy-audit.js', 'site:deploy-audit script should generate the public site deploy audit');
assert(packageJson.scripts?.['site:hosting-handoff'] === 'node scripts/generate-public-site-hosting-handoff.js', 'site:hosting-handoff script should generate the public site hosting handoff');
assert(packageJson.scripts?.['site:verify-hosting'] === 'node scripts/verify-public-site-hosting.js', 'site:verify-hosting script should verify the public site over HTTPS');
assert(packageJson.scripts?.['localization:audit'] === 'node scripts/generate-localization-audit.js', 'localization:audit script should generate the localization audit');
assert(packageJson.scripts?.['age:rating'] === 'node scripts/generate-age-rating-audit.js', 'age:rating script should generate the App Store age rating audit');
assert(packageJson.scripts?.['study:depth'] === 'node scripts/generate-study-bank-depth-audit.js', 'study:depth script should generate the study bank depth audit');
assert(packageJson.scripts?.['study:localization'] === 'node scripts/generate-study-content-localization-audit.js', 'study:localization script should generate the study content localization audit');
assert(packageJson.scripts?.['content:rights'] === 'node scripts/generate-content-rights-audit.js', 'content:rights script should generate the content rights audit');
assert(packageJson.scripts?.['legal:licenses'] === 'node scripts/generate-open-source-license-audit.js', 'legal:licenses script should generate the open source license audit');
assert(packageJson.scripts?.['privacy:manifest'] === 'node scripts/generate-privacy-manifest-audit.js', 'privacy:manifest script should generate the privacy manifest audit');
assert(packageJson.scripts?.['privacy:answers'] === 'node scripts/generate-app-store-privacy-answers.js', 'privacy:answers script should generate the App Store privacy answer pack');
assert(packageJson.scripts?.['ads:audit'] === 'node scripts/generate-admob-release-audit.js', 'ads:audit script should generate the AdMob release audit');
assert(packageJson.scripts?.['ads:handoff'] === 'node scripts/generate-admob-setup-handoff.js', 'ads:handoff script should generate the AdMob setup handoff');
assert(packageJson.scripts?.['privacy:data-flow'] === 'node scripts/generate-data-flow-privacy-audit.js', 'privacy:data-flow script should generate the data flow privacy audit');
assert(packageJson.scripts?.['privacy:review-packet'] === 'node scripts/generate-privacy-review-packet.js', 'privacy:review-packet script should generate the privacy review packet');
assert(packageJson.scripts?.['runtime:ui-flow'] === 'node scripts/generate-runtime-ui-flow-audit.js', 'runtime:ui-flow script should generate the runtime UI flow audit');
assert(packageJson.scripts?.['review:guide'] === 'node scripts/generate-review-guide.js', 'review:guide script should generate the App Store review guide');
assert(packageJson.scripts?.['device:smoke'] === 'node scripts/generate-production-device-smoke-test.js', 'device:smoke script should generate the production device smoke test checklist');
assert(packageJson.scripts?.['external:readiness'] === 'node scripts/generate-external-readiness.js', 'external:readiness script should generate the external readiness checklist');
assert(packageJson.scripts?.['external:todo-tracker'] === 'node scripts/generate-external-todo-tracker.js', 'external:todo-tracker script should generate the external TODO tracker');
assert(packageJson.scripts?.['eas:env-checklist'] === 'node scripts/generate-eas-env-checklist.js', 'eas:env-checklist script should generate the EAS environment checklist');
assert(packageJson.scripts?.['store:input-pack'] === 'node scripts/generate-store-submission-input-pack.js', 'store:input-pack script should generate the store submission input pack');
assert(packageJson.scripts?.['account:preflight'] === 'node scripts/generate-account-service-preflight.js', 'account:preflight script should generate the account and service preflight');
assert(packageJson.scripts?.['eas:build-preflight'] === 'node scripts/generate-eas-build-preflight.js', 'eas:build-preflight script should generate the EAS build preflight');
assert(packageJson.scripts?.['appstore:checklist'] === 'node scripts/generate-app-store-connect-checklist.js', 'appstore:checklist script should generate the App Store Connect checklist');
assert(packageJson.scripts?.['launch:runbook'] === 'node scripts/generate-final-launch-runbook.js', 'launch:runbook script should generate the final launch runbook');
assert(packageJson.scripts?.['release:packet'] === 'node scripts/generate-release-packet.js', 'release:packet script should generate the final release packet');
assert(packageJson.scripts?.['submission:checklist'] === 'node scripts/generate-eas-submission-checklist.js', 'submission:checklist script should generate the EAS submission checklist');
assert(packageJson.scripts?.['handoff:bundle'] === 'node scripts/generate-app-store-handoff-bundle.js', 'handoff:bundle script should generate the App Store handoff bundle');
assert(packageJson.scripts?.['assets:manifest'] === 'node scripts/generate-runtime-asset-manifest.js', 'assets:manifest script should generate the runtime asset manifest');
assert(packageJson.scripts?.['release:status'] === 'node scripts/release-status.js', 'release:status script should run the release status checklist');
assert(releaseStatusSource.includes('APP_STORE_BASE_URL') && releaseStatusSource.includes('isProductionHttpsUrl'), 'release-status should check production HTTPS store URLs');
assert(releaseStatusSource.includes('publicSiteHostingReady') && releaseStatusSource.includes('docs/public-site-hosting-verification.json'), 'release-status should require live public site verification for support and privacy URLs');
assert(releaseStatusSource.includes('EXPO_PUBLIC_ADMOB_IOS_APP_ID') && releaseStatusSource.includes('APP_STORE_PRIVACY_ANSWERS_REVIEWED'), 'release-status should check AdMob IDs and manual privacy confirmations');
assert(releaseStatusSource.includes('isRealAdMobId') && releaseStatusSource.includes('admobPlaceholderPattern'), 'release-status should reject placeholder AdMob IDs');
assert(releaseStatusSource.includes('admobDemoPublisherPattern'), 'release-status should reject Google demo AdMob IDs');
assert(admobReleaseAuditGeneratorSource.includes('admobPlaceholderPattern'), 'AdMob release audit generator should reject placeholder AdMob IDs');
assert(admobReleaseAuditGeneratorSource.includes('admobDemoPublisherPattern'), 'AdMob release audit generator should reject Google demo AdMob IDs');
assert(admobReleaseAuditGeneratorSource.includes('appConfigWithPlaceholderAds'), 'AdMob release audit generator should test placeholder IDs against Expo config');
assert(admobReleaseAuditGeneratorSource.includes('appConfigWithDemoAds'), 'AdMob release audit generator should test Google demo IDs against Expo config');
assert(admobSetupHandoffSource.includes('docs/admob-setup-handoff.json') && admobSetupHandoffSource.includes('eas env:create'), 'AdMob setup handoff generator should write JSON evidence and EAS env commands');
assert(admobSetupHandoffSource.includes('ADMOB_PRIVACY_MESSAGES_CONFIGURED') && admobSetupHandoffSource.includes('PRODUCTION_DEVICE_TESTED'), 'AdMob setup handoff generator should track manual AdMob and device confirmations');
assert(releaseStatusSource.includes('addLocalEvidenceRows') && releaseStatusSource.includes('JLPT N5-N1 study bank'), 'release-status should summarize local release evidence');
assert(releaseStatusSource.includes('Release CI workflow') && releaseStatusSource.includes('.github/workflows/release-verify.yml'), 'release-status should summarize the release CI workflow');
assert(releaseStatusSource.includes('Study bank depth audit') && releaseStatusSource.includes('docs/study-bank-depth-audit.json'), 'release-status should summarize the study bank depth audit');
assert(releaseStatusSource.includes('Study content localization') && releaseStatusSource.includes('docs/study-content-localization-audit.json'), 'release-status should summarize the study content localization audit');
assert(releaseStatusSource.includes('Public site deploy audit') && releaseStatusSource.includes('docs/public-site-deploy-audit.json'), 'release-status should summarize the public site deploy audit');
assert(releaseStatusSource.includes('Public site hosting handoff') && releaseStatusSource.includes('docs/public-site-hosting-handoff.json'), 'release-status should summarize the public site hosting handoff');
assert(releaseStatusSource.includes('App Store screenshot QA') && releaseStatusSource.includes('docs/screenshot-qa-audit.json'), 'release-status should summarize the screenshot QA audit');
assert(releaseStatusSource.includes('App Store copy audit') && releaseStatusSource.includes('docs/app-store-copy-audit.json'), 'release-status should summarize the App Store copy audit');
assert(releaseStatusSource.includes('App Store metadata upload packet') && releaseStatusSource.includes('docs/app-store-metadata-upload-packet.json'), 'release-status should summarize the App Store metadata upload packet');
assert(releaseStatusSource.includes('App Store privacy answer pack') && releaseStatusSource.includes('docs/app-store-privacy-answers.json'), 'release-status should summarize the App Store privacy answer pack');
assert(releaseStatusSource.includes('Privacy review packet') && releaseStatusSource.includes('docs/privacy-review-packet.json'), 'release-status should summarize the privacy review packet');
assert(releaseStatusSource.includes('AdMob release audit') && releaseStatusSource.includes('docs/admob-release-audit.json'), 'release-status should summarize the AdMob release audit');
assert(releaseStatusSource.includes('AdMob setup handoff') && releaseStatusSource.includes('docs/admob-setup-handoff.json'), 'release-status should summarize the AdMob setup handoff');
assert(releaseStatusSource.includes('Data flow privacy audit') && releaseStatusSource.includes('docs/data-flow-privacy-audit.json'), 'release-status should summarize the data flow privacy audit');
assert(releaseStatusSource.includes('Runtime UI flow audit') && releaseStatusSource.includes('docs/runtime-ui-flow-audit.json'), 'release-status should summarize the runtime UI flow audit');
assert(releaseStatusSource.includes('Open source license audit') && releaseStatusSource.includes('docs/open-source-license-audit.json'), 'release-status should summarize the open source license audit');
assert(releaseStatusSource.includes('Store submission input pack') && releaseStatusSource.includes('docs/store-submission-input-pack.json'), 'release-status should summarize the store submission input pack');
assert(releaseStatusSource.includes('External TODO tracker') && releaseStatusSource.includes('docs/external-todo-tracker.json'), 'release-status should summarize the external TODO tracker');
assert(releaseStatusSource.includes('Account and service preflight') && releaseStatusSource.includes('docs/account-service-preflight.json'), 'release-status should summarize the account and service preflight');
assert(releaseStatusSource.includes('Final launch runbook') && releaseStatusSource.includes('docs/final-launch-runbook.json'), 'release-status should summarize the final launch runbook');
assert(releaseStatusSource.includes('App Store handoff bundle') && releaseStatusSource.includes('docs/app-store-handoff-bundle.json'), 'release-status should summarize the App Store handoff bundle');
assert(releaseStatusSource.includes('EAS production preflight') && releaseStatusSource.includes('docs/eas-build-preflight.json'), 'release-status should summarize the EAS build preflight');
assert(releaseStatusSource.includes("category = 'external'") && releaseStatusSource.includes('Local release evidence'), 'release-status should categorize local and external rows');
for (const snippet of [
  'name: Release verification',
  'workflow_dispatch:',
  'pull_request:',
  'actions/checkout@v5',
  'actions/setup-node@v6',
  'node-version: 22.13.0',
  'cache: npm',
  'npm ci',
  'npm run typecheck',
  'npm run gameplay-check',
  'npm run release:verify',
]) {
  assert(releaseVerifyWorkflowSource.includes(snippet), `Release verification workflow missing: ${snippet}`);
}
assert(publicSiteHostingVerifierSource.includes('APP_STORE_BASE_URL') && publicSiteHostingVerifierSource.includes('fetch(endpoint.url'), 'Public site hosting verifier should fetch production store URLs');
assert(publicSiteHostingVerifierSource.includes('docs/public-site-hosting-verification.json'), 'Public site hosting verifier should write JSON evidence');
assert(publicSiteHostingVerifierSource.includes('--strict'), 'Public site hosting verifier should support a strict mode');
assert(publicSiteHostingHandoffSource.includes('docs/public-site-hosting-handoff.json'), 'Public site hosting handoff generator should write JSON evidence');
assert(publicSiteHostingHandoffSource.includes('GitHub Pages') && publicSiteHostingHandoffSource.includes('Cloudflare Pages'), 'Public site hosting handoff should describe static hosting options');
assert(releaseVerifySource.includes("run('Public site hosting handoff'"), 'release:verify should regenerate the public site hosting handoff');
assert(releaseHandoffDoc.includes('npm run release:status'), 'Release handoff should include release:status in the final command order');
assert(releaseHandoffDoc.includes('docs/release-packet.md'), 'Release handoff should mention the generated release packet');
assert(releaseHandoffDoc.includes('docs/runtime-asset-manifest.md'), 'Release handoff should mention the runtime asset manifest');
assert(releaseHandoffDoc.includes('docs/public-site-deploy-audit.md'), 'Release handoff should mention the public site deploy audit');
assert(releaseHandoffDoc.includes('docs/public-site-hosting-handoff.md'), 'Release handoff should mention the public site hosting handoff');
assert(releaseHandoffDoc.includes('docs/public-site-hosting-verification.md'), 'Release handoff should mention the public site hosting verification');
assert(releaseHandoffDoc.includes('docs/screenshot-qa-audit.md'), 'Release handoff should mention the screenshot QA audit');
assert(releaseHandoffDoc.includes('docs/app-store-copy-audit.md'), 'Release handoff should mention the App Store copy audit');
assert(releaseHandoffDoc.includes('docs/app-store-metadata-upload-packet.md'), 'Release handoff should mention the App Store metadata upload packet');
assert(releaseHandoffDoc.includes('docs/localization-audit.md'), 'Release handoff should mention the localization audit');
assert(releaseHandoffDoc.includes('docs/app-store-age-rating-audit.md'), 'Release handoff should mention the App Store age rating audit');
assert(releaseHandoffDoc.includes('docs/study-bank-depth-audit.md'), 'Release handoff should mention the study bank depth audit');
assert(releaseHandoffDoc.includes('docs/study-content-localization-audit.md'), 'Release handoff should mention the study content localization audit');
assert(releaseHandoffDoc.includes('docs/content-rights-audit.md'), 'Release handoff should mention the content rights audit');
assert(releaseHandoffDoc.includes('docs/open-source-license-audit.md'), 'Release handoff should mention the open source license audit');
assert(releaseHandoffDoc.includes('docs/privacy-manifest-audit.md'), 'Release handoff should mention the privacy manifest audit');
assert(releaseHandoffDoc.includes('docs/app-store-privacy-answers.md'), 'Release handoff should mention the App Store privacy answer pack');
assert(releaseHandoffDoc.includes('docs/privacy-review-packet.md'), 'Release handoff should mention the privacy review packet');
assert(releaseHandoffDoc.includes('docs/admob-release-audit.md'), 'Release handoff should mention the AdMob release audit');
assert(releaseHandoffDoc.includes('npm run ads:handoff') && releaseHandoffDoc.includes('docs/admob-setup-handoff.md'), 'Release handoff should mention the AdMob setup handoff');
assert(releaseHandoffDoc.includes('docs/data-flow-privacy-audit.md'), 'Release handoff should mention the data flow privacy audit');
assert(releaseHandoffDoc.includes('docs/runtime-ui-flow-audit.md'), 'Release handoff should mention the runtime UI flow audit');
assert(releaseHandoffDoc.includes('docs/production-device-smoke-test.md'), 'Release handoff should mention the production device smoke test checklist');
assert(releaseHandoffDoc.includes('docs/external-readiness.md'), 'Release handoff should mention the external readiness checklist');
assert(releaseHandoffDoc.includes('docs/external-todo-tracker.md'), 'Release handoff should mention the external TODO tracker');
assert(releaseHandoffDoc.includes('docs/eas-env-checklist.md'), 'Release handoff should mention the EAS environment checklist');
assert(releaseHandoffDoc.includes('docs/store-submission-input-pack.md'), 'Release handoff should mention the store submission input pack');
assert(releaseHandoffDoc.includes('docs/store-submission.env.template'), 'Release handoff should mention the standalone store submission env template');
assert(releaseHandoffDoc.includes('docs/account-service-preflight.md'), 'Release handoff should mention the account and service preflight');
assert(releaseHandoffDoc.includes('docs/final-launch-runbook.md'), 'Release handoff should mention the final launch runbook');
assert(releaseHandoffDoc.includes('docs/eas-build-preflight.md'), 'Release handoff should mention the EAS build preflight');
assert(releaseHandoffDoc.includes('docs/app-store-connect-checklist.md'), 'Release handoff should mention the App Store Connect checklist');
assert(releaseHandoffDoc.includes('docs/eas-submission-checklist.md'), 'Release handoff should mention the EAS submission checklist');
assert(releaseHandoffDoc.includes('docs/app-store-handoff-bundle.md'), 'Release handoff should mention the App Store handoff bundle');
assert(readmeDoc.includes('.github/workflows/release-verify.yml') && readmeDoc.includes('npm run release:verify'), 'README should document the release verification workflow');
assert(readmeDoc.includes('npm run release:packet') && readmeDoc.includes('docs/release-packet.md'), 'README should document the release packet command and output');
assert(readmeDoc.includes('npm run assets:manifest') && readmeDoc.includes('docs/runtime-asset-manifest.md'), 'README should document the runtime asset manifest command and output');
assert(readmeDoc.includes('npm run site:deploy-audit') && readmeDoc.includes('docs/public-site-deploy-audit.md'), 'README should document the public site deploy audit command and output');
assert(readmeDoc.includes('npm run site:hosting-handoff') && readmeDoc.includes('docs/public-site-hosting-handoff.md'), 'README should document the public site hosting handoff command and output');
assert(readmeDoc.includes('npm run site:verify-hosting') && readmeDoc.includes('docs/public-site-hosting-verification.md'), 'README should document the public site hosting verification command and output');
assert(readmeDoc.includes('npm run screenshots:qa') && readmeDoc.includes('docs/screenshot-qa-audit.md'), 'README should document the screenshot QA command and output');
assert(readmeDoc.includes('npm run metadata:copy-audit') && readmeDoc.includes('docs/app-store-copy-audit.md'), 'README should document the App Store copy audit command and output');
assert(readmeDoc.includes('npm run metadata:upload-packet') && readmeDoc.includes('docs/app-store-metadata-upload-packet.md'), 'README should document the App Store metadata upload packet command and output');
assert(readmeDoc.includes('npm run localization:audit') && readmeDoc.includes('docs/localization-audit.md'), 'README should document the localization audit command and output');
assert(readmeDoc.includes('npm run age:rating') && readmeDoc.includes('docs/app-store-age-rating-audit.md'), 'README should document the App Store age rating audit command and output');
assert(readmeDoc.includes('npm run study:depth') && readmeDoc.includes('docs/study-bank-depth-audit.md'), 'README should document the study bank depth audit command and output');
assert(readmeDoc.includes('npm run study:localization') && readmeDoc.includes('docs/study-content-localization-audit.md'), 'README should document the study content localization audit command and output');
assert(readmeDoc.includes('npm run content:rights') && readmeDoc.includes('docs/content-rights-audit.md'), 'README should document the content rights audit command and output');
assert(readmeDoc.includes('npm run legal:licenses') && readmeDoc.includes('docs/open-source-license-audit.md'), 'README should document the open source license audit command and output');
assert(readmeDoc.includes('npm run privacy:manifest') && readmeDoc.includes('docs/privacy-manifest-audit.md'), 'README should document the privacy manifest audit command and output');
assert(readmeDoc.includes('npm run privacy:answers') && readmeDoc.includes('docs/app-store-privacy-answers.md'), 'README should document the App Store privacy answer pack command and output');
assert(readmeDoc.includes('npm run ads:audit') && readmeDoc.includes('docs/admob-release-audit.md'), 'README should document the AdMob release audit command and output');
assert(readmeDoc.includes('npm run ads:handoff') && readmeDoc.includes('docs/admob-setup-handoff.md'), 'README should document the AdMob setup handoff command and output');
assert(readmeDoc.includes('npm run privacy:data-flow') && readmeDoc.includes('docs/data-flow-privacy-audit.md'), 'README should document the data flow privacy audit command and output');
assert(readmeDoc.includes('npm run privacy:review-packet') && readmeDoc.includes('docs/privacy-review-packet.md'), 'README should document the privacy review packet command and output');
assert(readmeDoc.includes('npm run runtime:ui-flow') && readmeDoc.includes('docs/runtime-ui-flow-audit.md'), 'README should document the runtime UI flow audit command and output');
assert(readmeDoc.includes('npm run device:smoke') && readmeDoc.includes('docs/production-device-smoke-test.md'), 'README should document the production device smoke test command and output');
assert(readmeDoc.includes('npm run external:readiness') && readmeDoc.includes('docs/external-readiness.md'), 'README should document the external readiness command and output');
assert(readmeDoc.includes('npm run external:todo-tracker') && readmeDoc.includes('docs/external-todo-tracker.md'), 'README should document the external TODO tracker command and output');
assert(readmeDoc.includes('npm run eas:env-checklist') && readmeDoc.includes('docs/eas-env-checklist.md'), 'README should document the EAS environment checklist command and output');
assert(readmeDoc.includes('npm run store:input-pack') && readmeDoc.includes('docs/store-submission-input-pack.md') && readmeDoc.includes('docs/store-submission.env.template'), 'README should document the store submission input pack command and outputs');
assert(readmeDoc.includes('npm run account:preflight') && readmeDoc.includes('docs/account-service-preflight.md'), 'README should document the account and service preflight command and output');
assert(readmeDoc.includes('npm run eas:build-preflight') && readmeDoc.includes('docs/eas-build-preflight.md'), 'README should document the EAS build preflight command and output');
assert(readmeDoc.includes('npm run appstore:checklist') && readmeDoc.includes('docs/app-store-connect-checklist.md'), 'README should document the App Store Connect checklist command and output');
assert(readmeDoc.includes('npm run launch:runbook') && readmeDoc.includes('docs/final-launch-runbook.md'), 'README should document the final launch runbook command and output');
assert(readmeDoc.includes('npm run submission:checklist') && readmeDoc.includes('docs/eas-submission-checklist.md'), 'README should document the EAS submission checklist command and output');
assert(readmeDoc.includes('npm run handoff:bundle') && readmeDoc.includes('docs/app-store-handoff-bundle.md'), 'README should document the App Store handoff bundle command and output');
assert(releaseVerifySource.includes("run('App Store metadata preview'"), 'release:verify should regenerate the App Store metadata preview before release-check');
assert(releaseVerifySource.includes("run('App Store copy audit'"), 'release:verify should regenerate the App Store copy audit before release-check');
assert(releaseVerifySource.includes("run('App Store metadata upload packet'"), 'release:verify should regenerate the App Store metadata upload packet before release-check');
assert(releaseVerifySource.includes("run('App Store screenshot QA audit'"), 'release:verify should regenerate the screenshot QA audit before release-check');
assert(releaseVerifySource.includes("run('Public site deploy audit'"), 'release:verify should regenerate the public site deploy audit before release-check');
assert(releaseVerifySource.includes("run('Public site hosting verification'"), 'release:verify should regenerate the public site hosting verification before release-check');
assert(releaseVerifySource.includes("run('Localization audit'"), 'release:verify should regenerate the localization audit before release-check');
assert(releaseVerifySource.includes("run('App Store age rating audit'"), 'release:verify should regenerate the App Store age rating audit before release-check');
assert(releaseVerifySource.includes("run('Study bank depth audit'"), 'release:verify should regenerate the study bank depth audit before release-check');
assert(releaseVerifySource.includes("run('Content rights audit'"), 'release:verify should regenerate the content rights audit before release-check');
assert(releaseVerifySource.includes("run('Open source license audit'"), 'release:verify should regenerate the open source license audit before release-check');
assert(releaseVerifySource.includes("run('Privacy manifest audit'"), 'release:verify should regenerate the privacy manifest audit before release-check');
assert(releaseVerifySource.includes("run('App Store privacy answers'"), 'release:verify should regenerate the App Store privacy answer pack before release-check');
assert(releaseVerifySource.includes("run('AdMob release audit'"), 'release:verify should regenerate the AdMob release audit before release-check');
assert(releaseVerifySource.includes("run('AdMob setup handoff'"), 'release:verify should regenerate the AdMob setup handoff before release-check');
assert(releaseVerifySource.includes("run('Data flow privacy audit'"), 'release:verify should regenerate the data flow privacy audit before release-check');
assert(releaseVerifySource.includes("run('Privacy review packet'"), 'release:verify should regenerate the privacy review packet before release-check');
assert(releaseVerifySource.includes("run('Runtime UI flow audit'"), 'release:verify should regenerate the runtime UI flow audit before release-check');
assert(releaseVerifySource.includes("run('App Store review guide'"), 'release:verify should regenerate the App Store review guide before release-check');
assert(releaseVerifySource.includes("run('Production device smoke test checklist'"), 'release:verify should regenerate the production device smoke test checklist before release-check');
assert(releaseVerifySource.includes("run('External readiness checklist'"), 'release:verify should regenerate the external readiness checklist before release-check');
assert(releaseVerifySource.includes("run('External TODO tracker'"), 'release:verify should regenerate the external TODO tracker before release-check');
assert(releaseVerifySource.includes("run('EAS environment checklist'"), 'release:verify should regenerate the EAS environment checklist before release-check');
assert(releaseVerifySource.includes("run('Store submission input pack'"), 'release:verify should regenerate the store submission input pack before release-check');
assert(releaseVerifySource.includes("run('Account and service preflight'"), 'release:verify should regenerate the account and service preflight before release-check');
assert(releaseVerifySource.includes("run('EAS build preflight'"), 'release:verify should regenerate the EAS build preflight before release-check');
assert(releaseVerifySource.includes("run('App Store Connect checklist'"), 'release:verify should regenerate the App Store Connect checklist before release-check');
assert(releaseVerifySource.includes("run('Release packet'"), 'release:verify should regenerate the release packet before release-check');
assert(releaseVerifySource.includes("run('EAS submission checklist'"), 'release:verify should regenerate the EAS submission checklist before release-check');
assert(releaseVerifySource.includes("run('Final launch runbook'"), 'release:verify should regenerate the final launch runbook before release-check');
assert(releaseVerifySource.includes("run('App Store handoff bundle'"), 'release:verify should regenerate the App Store handoff bundle before release-check');
assert(releaseVerifySource.includes("run('Runtime asset manifest'"), 'release:verify should regenerate the runtime asset manifest before release-check');

assert((appJson.plugins ?? []).includes('expo-system-ui'), 'expo-system-ui config plugin is missing');
const localizationPlugin = (appJson.plugins ?? []).find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-localization');
assert(Boolean(localizationPlugin), 'expo-localization config plugin is missing');

const buildPropertiesPlugin = findPlugin(appJson, 'expo-build-properties');
const buildProperties = buildPropertiesPlugin?.[1];
assert(Boolean(buildPropertiesPlugin), 'expo-build-properties config plugin is missing');
assert(buildProperties?.ios?.deploymentTarget === expectedNativeBuildProperties.iosDeploymentTarget, `iOS deploymentTarget should be ${expectedNativeBuildProperties.iosDeploymentTarget} for Expo SDK 56`);
assert(buildProperties?.android?.compileSdkVersion === expectedNativeBuildProperties.androidCompileSdkVersion, `Android compileSdkVersion should be ${expectedNativeBuildProperties.androidCompileSdkVersion} for Expo SDK 56`);
assert(buildProperties?.android?.targetSdkVersion === expectedNativeBuildProperties.androidTargetSdkVersion, `Android targetSdkVersion should be ${expectedNativeBuildProperties.androidTargetSdkVersion} for Expo SDK 56`);
assert(buildProperties?.android?.minSdkVersion === expectedNativeBuildProperties.androidMinSdkVersion, `Android minSdkVersion should be ${expectedNativeBuildProperties.androidMinSdkVersion} for Expo SDK 56`);
assert(buildProperties?.android?.buildToolsVersion === expectedNativeBuildProperties.androidBuildToolsVersion, `Android buildToolsVersion should be ${expectedNativeBuildProperties.androidBuildToolsVersion} for Expo SDK 56`);

const audioPlugin = (appJson.plugins ?? []).find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-audio');
assert(Boolean(audioPlugin), 'expo-audio config plugin is missing');
assert(audioPlugin?.[1]?.microphonePermission === false, 'expo-audio microphonePermission must be disabled because the app only plays BGM');
assert(audioPlugin?.[1]?.recordAudioAndroid === false, 'expo-audio recordAudioAndroid must be disabled because the app does not record audio');
assert(audioPlugin?.[1]?.enableBackgroundPlayback === false, 'expo-audio background playback must stay disabled for simple in-game BGM');
assert(audioPlugin?.[1]?.enableBackgroundRecording === false, 'expo-audio background recording must stay disabled');
assert(appSource.includes("state !== 'active'") && appSource.includes('bgmPlayer.pause();'), 'BGM should pause when the app leaves the foreground');

const supportedLocales = localizationPlugin?.[1]?.supportedLocales;
sameSet(supportedLocales?.ios ?? [], expectedLocales, 'iOS supportedLocales');
sameSet(supportedLocales?.android ?? [], expectedLocales, 'Android supportedLocales');

const privacyManifests = appJson.ios?.privacyManifests;
assert(Boolean(privacyManifests), 'iOS privacyManifests is missing');
assert(privacyManifests?.NSPrivacyTracking === false, 'iOS privacy manifest must declare NSPrivacyTracking as false until an ad SDK changes this behavior');
assert(Array.isArray(privacyManifests?.NSPrivacyCollectedDataTypes), 'iOS privacy manifest collected data declaration is missing');
assert((privacyManifests?.NSPrivacyCollectedDataTypes ?? []).length === 0, 'iOS privacy manifest should not declare collected data before live ads or analytics are enabled');
assert(Boolean(appStorePrivacyAnswersDoc), `${appStorePrivacyAnswersDocPath} is missing`);
assert(appStorePrivacyAnswersDoc.includes('No Live AdMob IDs'), `${appStorePrivacyAnswersDocPath} should document the no-live-ads App Store privacy state`);
assert(appStorePrivacyAnswersDoc.includes('Live AdMob IDs Enabled'), `${appStorePrivacyAnswersDocPath} should document the live-ads App Store privacy state`);
assert(appStorePrivacyAnswersDoc.includes('https://developer.apple.com/app-store/app-privacy-details/'), `${appStorePrivacyAnswersDocPath} should link Apple app privacy details`);
assert(appStorePrivacyAnswersDoc.includes('https://developers.google.com/admob/ios/privacy/data-disclosure'), `${appStorePrivacyAnswersDocPath} should link Google Mobile Ads data disclosure guidance`);

const privacyReasons = new Map(
  (privacyManifests?.NSPrivacyAccessedAPITypes ?? []).map((entry) => [
    entry.NSPrivacyAccessedAPIType,
    entry.NSPrivacyAccessedAPITypeReasons ?? [],
  ]),
);

for (const [category, reason] of Object.entries(expectedPrivacyReasons)) {
  assert(privacyReasons.has(category), `iOS privacy manifest missing required API category: ${category}`);
  assert((privacyReasons.get(category) ?? []).includes(reason), `iOS privacy manifest ${category} missing reason: ${reason}`);
}

for (const staleUiText of [
  "ready: 'Ready'",
  "sprint: 'Sprint'",
  "daily: 'Daily'",
  'Beginner vocabulary',
  '入门高频词',
  '入門高頻詞',
  "good: ['いいね'",
  "bad: ['もう一回'",
]) {
  const occurrences = i18nSource.split(staleUiText).length - 1;
  const allowed = staleUiText === "ready: 'Ready'" || staleUiText === "sprint: 'Sprint'" || staleUiText === "daily: 'Daily'" ? 1 : 0;
  assert(occurrences <= allowed, `Unexpected stale UI localization remains: ${staleUiText}`);
}

const studyTextKeys = collectStudyTextKeys(gameDataSource, 'src/gameData.ts');
const contentTranslations = collectContentTranslations(i18nSource, 'src/i18n.ts');
assert(studyTextKeys.size > 0, 'No study text keys were found in gameData.ts');
assert(contentTranslations.size >= studyTextKeys.size, 'contentTranslations should cover all study text keys');

for (const studyTextKey of studyTextKeys) {
  const translations = contentTranslations.get(studyTextKey);
  assert(Boolean(translations), `Missing contentTranslations entry for study text: ${studyTextKey}`);

  for (const locale of expectedContentTranslationLocales) {
    assert(Boolean(translations?.get(locale)), `Missing ${locale} content translation for study text: ${studyTextKey}`);
  }
}

sameSet(
  [...(gameDataSource.match(/'N[1-5]'/g) ?? [])].map((level) => level.slice(1, -1)).filter((level, index, all) => all.indexOf(level) === index),
  expectedJlptLevels,
  'JLPT levels in study data',
);

const studyItemIds = [...gameDataSource.matchAll(/\b(vocab|line)\('([^']+)'/g)].map((match) => `${match[1]}-${match[2]}`);
const duplicateStudyItemIds = studyItemIds.filter((id, index, all) => all.indexOf(id) !== index);
assert(duplicateStudyItemIds.length === 0, `Duplicate study item IDs found: ${[...new Set(duplicateStudyItemIds)].join(', ')}`);

for (const [level, minimum] of Object.entries(levelMinimums)) {
  const vocabCount = countLevelEntries('vocab')[level] ?? 0;
  const lineCount = countLevelEntries('line')[level] ?? 0;

  assert(vocabCount >= minimum.vocab, `${level} vocabulary too small: ${vocabCount}/${minimum.vocab}`);
  assert(lineCount >= minimum.lines, `${level} line bank too small: ${lineCount}/${minimum.lines}`);
  assert(i18nSource.includes(`level${level}:`), `Missing UI label for ${level}`);
}

assert(gameDataSource.includes('export function getLevelStudyStats'), 'Study data should expose per-level stats for the JLPT selector');
assert(appSource.includes('getLevelStudyStats(nextLevel)'), 'Level selector should display real per-level study-bank counts');
assert(i18nSource.includes('levelKanaShort:') && i18nSource.includes('levelWordsShort:') && i18nSource.includes('levelLinesShort:'), 'UI localization missing level bank count labels');
assert(gameEngineSource.includes('LEVEL_DIFFICULTY_PROFILES'), 'Game engine should define explicit N5-N1 difficulty profiles');
assert(gameEngineSource.includes('meaningToWordWeight'), 'Game engine should make higher levels require more reverse Japanese recall');
assert(gameEngineSource.includes('topicDistractorBias') && gameEngineSource.includes('lengthDistractorBias'), 'Game engine should make high-level distractors more similar');
assert(gameplayContractSource.includes('validateDifficultyProfiles') && gameplayContractSource.includes('validateAnswerOptions'), 'Gameplay contract should verify N5-N1 difficulty separation');

for (const locale of expectedLocales) {
  const languagePath = appJson.locales[locale];
  assert(fs.existsSync(path.join(root, languagePath)), `Missing native locale file for ${locale}: ${languagePath}`);

  const localeMetadata = metadata[locale];
  const localeMetadataText = [
    localeMetadata?.subtitle,
    localeMetadata?.promotionalText,
    localeMetadata?.description,
    localeMetadata?.keywords,
  ].join('\n');

  assert(
    localeMetadataText.includes(originalityMarkers[locale]),
    `App Store metadata should explicitly say the anime-style lines are original for ${locale}`,
  );
  assert(
    findTermHits({ [locale]: localeMetadata?.keywords }, riskyAnimeKeywordTerms).length === 0,
    `App Store keywords should avoid implying real anime quotes for ${locale}`,
  );

  for (const key of ['name', 'subtitle', 'promotionalText', 'description', 'keywords']) {
    assert(Boolean(localeMetadata?.[key]), `Missing App Store ${key} for ${locale}`);
  }

  assert((localeMetadata?.subtitle ?? '').length <= 30, `Subtitle too long for ${locale}`);
  assert((localeMetadata?.keywords ?? '').length <= 100, `Keywords too long for ${locale}`);
  assert((localeMetadata?.description ?? '').includes('JLPT'), `App Store description should mention JLPT coverage for ${locale}`);
}

assert(packageJson.scripts?.typecheck === 'tsc --noEmit', 'typecheck script is missing');
assert(packageJson.engines?.node === expectedSdkVersions.node, `package.json engines.node should be ${expectedSdkVersions.node} for Expo SDK 56`);
assert(packageJson.dependencies?.expo === expectedSdkVersions.expo, `expo dependency should stay on ${expectedSdkVersions.expo}`);
assert(packageJson.dependencies?.['expo-asset'] === expectedSdkVersions.expoAsset, `expo-asset dependency should stay on ${expectedSdkVersions.expoAsset}`);
assert(packageJson.dependencies?.['expo-build-properties'] === expectedSdkVersions.expoBuildProperties, `expo-build-properties dependency should stay on ${expectedSdkVersions.expoBuildProperties}`);
assert(packageJson.dependencies?.['expo-constants'] === expectedSdkVersions.expoConstants, `expo-constants dependency should stay on ${expectedSdkVersions.expoConstants}`);
assert(packageJson.dependencies?.['@expo/metro-runtime'] === expectedSdkVersions.expoMetroRuntime, `@expo/metro-runtime dependency should stay on ${expectedSdkVersions.expoMetroRuntime}`);
assert(packageJson.dependencies?.['expo-speech'] === expectedSdkVersions.expoSpeech, `expo-speech dependency should stay on ${expectedSdkVersions.expoSpeech}`);
assert(packageJson.dependencies?.['expo-splash-screen'] === expectedSdkVersions.expoSplashScreen, `expo-splash-screen dependency should stay on ${expectedSdkVersions.expoSplashScreen}`);
assert(packageJson.dependencies?.react === expectedSdkVersions.react, `react dependency should stay on ${expectedSdkVersions.react}`);
assert(packageJson.dependencies?.['react-dom'] === expectedSdkVersions.reactDom, `react-dom dependency should stay on ${expectedSdkVersions.reactDom}`);
assert(packageJson.dependencies?.['react-native'] === expectedSdkVersions.reactNative, `react-native dependency should stay on ${expectedSdkVersions.reactNative}`);
assert(packageJson.dependencies?.['react-native-web'] === expectedSdkVersions.reactNativeWeb, `react-native-web dependency should stay on ${expectedSdkVersions.reactNativeWeb}`);
assert(packageJson.scripts?.['gameplay-check'] === 'node scripts/check-gameplay-contract.js', 'gameplay-check script is missing');
assert(Boolean(packageJson.scripts?.doctor), 'doctor script is missing');
assert(packageJson.scripts?.['site:localized'] === 'node scripts/generate-localized-site.js', 'site:localized script is missing');
assert(packageJson.scripts?.['site:manifest'] === 'node scripts/generate-site-manifest.js', 'site:manifest script should generate the public support/privacy/license site manifest');
assert(packageJson.scripts?.['site:deploy-audit'] === 'node scripts/generate-public-site-deploy-audit.js', 'site:deploy-audit script should generate the public site deploy audit');
assert(packageJson.scripts?.['site:hosting-handoff'] === 'node scripts/generate-public-site-hosting-handoff.js', 'site:hosting-handoff script should generate the public site hosting handoff');
assert(packageJson.scripts?.['site:verify-hosting'] === 'node scripts/verify-public-site-hosting.js', 'site:verify-hosting script should verify the public site over HTTPS');
assert(packageJson.scripts?.['assets:manifest'] === 'node scripts/generate-runtime-asset-manifest.js', 'assets:manifest script should generate the runtime asset manifest');
assert(Boolean(packageJson.scripts?.['release-check']), 'release-check script is missing');
assert(packageJson.scripts?.['release:verify'] === 'node scripts/release-verify.js', 'release:verify script should run the full local release verifier');
assert(packageJson.scripts?.['release:store-ready'] === 'npm run release:verify && node scripts/release-check.js --strict', 'release:store-ready script should run the strict final App Store gate');
assert(packageJson.scripts?.['screenshots:ios'] === 'python scripts/generate-store-screenshots.py', 'screenshots:ios script is missing');
assert(packageJson.scripts?.['screenshots:manifest'] === 'node scripts/generate-screenshot-manifest.js', 'screenshots:manifest script should generate the App Store screenshot upload manifest');
assert(packageJson.scripts?.['screenshots:qa'] === 'node scripts/generate-screenshot-qa-audit.js', 'screenshots:qa script should generate the screenshot QA audit');
assert(packageJson.scripts?.['metadata:upload-packet'] === 'node scripts/generate-app-store-metadata-upload-packet.js', 'metadata:upload-packet script should generate the App Store metadata upload packet');
assert(packageJson.scripts?.['localization:audit'] === 'node scripts/generate-localization-audit.js', 'localization:audit script should generate the localization audit');
assert(packageJson.scripts?.['age:rating'] === 'node scripts/generate-age-rating-audit.js', 'age:rating script should generate the App Store age rating audit');
assert(packageJson.scripts?.['study:depth'] === 'node scripts/generate-study-bank-depth-audit.js', 'study:depth script should generate the study bank depth audit');
assert(packageJson.scripts?.['study:localization'] === 'node scripts/generate-study-content-localization-audit.js', 'study:localization script should generate the study content localization audit');
assert(packageJson.scripts?.['content:rights'] === 'node scripts/generate-content-rights-audit.js', 'content:rights script should generate the content rights audit');
assert(packageJson.scripts?.['legal:licenses'] === 'node scripts/generate-open-source-license-audit.js', 'legal:licenses script should generate the open source license audit');
assert(packageJson.scripts?.['privacy:manifest'] === 'node scripts/generate-privacy-manifest-audit.js', 'privacy:manifest script should generate the privacy manifest audit');
assert(packageJson.scripts?.['privacy:answers'] === 'node scripts/generate-app-store-privacy-answers.js', 'privacy:answers script should generate the App Store privacy answer pack');
assert(packageJson.scripts?.['ads:audit'] === 'node scripts/generate-admob-release-audit.js', 'ads:audit script should generate the AdMob release audit');
assert(packageJson.scripts?.['ads:handoff'] === 'node scripts/generate-admob-setup-handoff.js', 'ads:handoff script should generate the AdMob setup handoff');
assert(packageJson.scripts?.['privacy:data-flow'] === 'node scripts/generate-data-flow-privacy-audit.js', 'privacy:data-flow script should generate the data flow privacy audit');
assert(packageJson.scripts?.['privacy:review-packet'] === 'node scripts/generate-privacy-review-packet.js', 'privacy:review-packet script should generate the privacy review packet');
assert(packageJson.scripts?.['runtime:ui-flow'] === 'node scripts/generate-runtime-ui-flow-audit.js', 'runtime:ui-flow script should generate the runtime UI flow audit');
assert(packageJson.scripts?.['release:packet'] === 'node scripts/generate-release-packet.js', 'release:packet script should generate the release packet');
assert(packageJson.scripts?.['submission:checklist'] === 'node scripts/generate-eas-submission-checklist.js', 'submission:checklist script should generate the EAS submission checklist');
assert(packageJson.scripts?.['handoff:bundle'] === 'node scripts/generate-app-store-handoff-bundle.js', 'handoff:bundle script should generate the App Store handoff bundle');
assert(packageJson.scripts?.['eas:env-checklist'] === 'node scripts/generate-eas-env-checklist.js', 'eas:env-checklist script should generate the EAS environment checklist');
assert(packageJson.scripts?.['eas:build-preflight'] === 'node scripts/generate-eas-build-preflight.js', 'eas:build-preflight script should generate the EAS build preflight');
assert(releaseVerifySource.includes("run('Public site manifest'"), 'release:verify should regenerate the public site manifest after localized pages');
assert(releaseVerifySource.includes("run('Public site deploy audit'"), 'release:verify should regenerate the public site deploy audit before release-check');
assert(releaseVerifySource.includes("run('Public site hosting verification'"), 'release:verify should regenerate the public site hosting verification before release-check');
assert(releaseVerifySource.includes("run('Runtime asset manifest'"), 'release:verify should regenerate the runtime asset manifest before release-check');
assert(releaseVerifySource.includes("run('App Store screenshot manifest'"), 'release:verify should regenerate the screenshot manifest after screenshots');
assert(releaseVerifySource.includes("run('App Store screenshot QA audit'"), 'release:verify should regenerate the screenshot QA audit after the screenshot manifest');
assert(releaseVerifySource.includes("run('App Store metadata upload packet'"), 'release:verify should regenerate the App Store metadata upload packet before release-check');
assert(releaseVerifySource.includes("run('Localization audit'"), 'release:verify should regenerate the localization audit before release-check');
assert(releaseVerifySource.includes("run('App Store age rating audit'"), 'release:verify should regenerate the App Store age rating audit before release-check');
assert(releaseVerifySource.includes("run('Study bank depth audit'"), 'release:verify should regenerate the study bank depth audit before release-check');
assert(releaseVerifySource.includes("run('Study content localization audit'"), 'release:verify should regenerate the study content localization audit before release-check');
assert(releaseVerifySource.includes("run('Content rights audit'"), 'release:verify should regenerate the content rights audit before release-check');
assert(releaseVerifySource.includes("run('Open source license audit'"), 'release:verify should regenerate the open source license audit before release-check');
assert(releaseVerifySource.includes("run('Privacy manifest audit'"), 'release:verify should regenerate the privacy manifest audit before release-check');
assert(releaseVerifySource.includes("run('App Store privacy answers'"), 'release:verify should regenerate the App Store privacy answer pack before release-check');
assert(releaseVerifySource.includes("run('AdMob release audit'"), 'release:verify should regenerate the AdMob release audit before release-check');
assert(releaseVerifySource.includes("run('AdMob setup handoff'"), 'release:verify should regenerate the AdMob setup handoff before release-check');
assert(releaseVerifySource.includes("run('Data flow privacy audit'"), 'release:verify should regenerate the data flow privacy audit before release-check');
assert(releaseVerifySource.includes("run('Privacy review packet'"), 'release:verify should regenerate the privacy review packet before release-check');
assert(releaseVerifySource.includes("run('Runtime UI flow audit'"), 'release:verify should regenerate the runtime UI flow audit before release-check');
assert(releaseVerifySource.includes("run('EAS environment checklist'"), 'release:verify should regenerate the EAS environment checklist before release-check');
assert(releaseVerifySource.includes("run('EAS build preflight'"), 'release:verify should regenerate the EAS build preflight before release-check');
assert(releaseVerifySource.includes("run('Release packet'"), 'release:verify should regenerate the release packet before release-check');
assert(releaseVerifySource.includes("run('EAS submission checklist'"), 'release:verify should regenerate the EAS submission checklist before release-check');
assert(releaseVerifySource.includes("run('App Store handoff bundle'"), 'release:verify should regenerate the App Store handoff bundle before release-check');
assert(Boolean(packageJson.scripts?.['build:ios']), 'build:ios script is missing');
assert(Boolean(packageJson.scripts?.['submit:ios']), 'submit:ios script is missing');
for (const ignoredEntry of expectedEasIgnoreEntries) {
  assert(easIgnoreSource.includes(ignoredEntry), `.easignore should include ${ignoredEntry} to keep EAS Build uploads lean`);
}
assert(!easIgnoreSource.includes('/assets/bgm'), '.easignore must not exclude BGM runtime assets from native builds');
assert(readmeDoc.includes('`.easignore` excludes App Store screenshots'), 'README should document the EAS Build upload trim policy');
assert(loadEnvSource.includes("const envFiles = ['.env.local', '.env.production', '.env'];"), 'scripts/load-env.js should load local release env files in priority order');
assert(loadEnvSource.includes('originalKeys.has(key)'), 'scripts/load-env.js should not override shell or EAS environment variables');
assert(appConfigSource.includes("require('./scripts/load-env')") && appConfigSource.includes('loadLocalEnv();'), 'app.config.js should load .env.local for local release config resolution');
assert(storeConfigSource.includes("require('./scripts/load-env')") && storeConfigSource.includes('loadLocalEnv();'), 'store.config.js should load .env.local for EAS Metadata generation');
assert(i18nSource.includes('export function makeText') && i18nSource.includes('_jaText: string'), 'makeText should keep Japanese as study reference input, not a UI locale');
assert(!i18nSource.includes('ja:') && !i18nSource.includes("'ja':"), 'i18n messages should not expose Japanese as a UI locale');
assert(readmeDoc.includes('Node.js 22.13 or newer'), 'README should document the Expo SDK 56 Node.js version requirement');
assert(readmeDoc.includes('iOS deployment target 16.4') && readmeDoc.includes('Android compile/target SDK 36'), 'README should document native build baseline pinning');
assert(readmeDoc.includes('automatically read `.env.local`'), 'README should document automatic .env.local loading');
assert(releaseHandoffDoc.includes('load `.env.local`'), 'Release handoff should document automatic .env.local loading');
assert(Boolean(packageJson.dependencies?.['expo-system-ui']), 'expo-system-ui dependency is missing');
assert(Boolean(packageJson.dependencies?.['expo-constants']), 'expo-constants dependency is missing for runtime store URL access');
assert(Boolean(packageJson.dependencies?.['react-native-google-mobile-ads']), 'react-native-google-mobile-ads dependency is missing');
assert(appSource.includes("import Constants from 'expo-constants'"), 'App should read support/privacy/license URLs from Expo constants');
assert(appSource.includes('Linking.openURL'), 'App settings should open configured support/privacy/license links');
assert(appSource.includes('storeUrls.localized?.[locale]'), 'App settings should prefer localized support/privacy/license URLs for the selected UI language');
assert(appSource.includes('openComplianceLink') && appSource.includes('localCompliancePanel'), 'App settings should expose local support/privacy/license fallback panels when public URLs are pending');
assert(appSource.includes("openComplianceLink(activeSupportUrl, 'support')"), 'Support entry should open configured URL or local support fallback');
assert(appSource.includes("openComplianceLink(activePrivacyPolicyUrl, 'privacy')"), 'Privacy entry should open configured URL or local privacy fallback');
assert(appSource.includes("openComplianceLink(activeOpenSourceNoticesUrl, 'openSource')"), 'Open source entry should open configured URL or local notice fallback');
assert(appSource.includes('levelMasteryRows') && appSource.includes('ALL_ITEMS.filter') && appSource.includes('levelProgressPanel'), 'Ready screen should expose N5-N1 local mastery progress rows');
assert(appSource.includes('resetLocalProgress') && appSource.includes('isResetProgressArmed') && appSource.includes('saveProgress(next)'), 'Settings should expose a two-tap local progress reset');
assert((appSource.match(/accessibilityRole="button"/g) ?? []).length >= 18, 'Primary game controls should expose button roles for accessibility');
assert(appSource.includes("accessibilityLabel={`${t(locale, 'answer')}: ${option}`}"), 'Answer options should expose localized accessibility labels');
assert(appSource.includes('accessibilityState={{ disabled: isLocked, selected }}'), 'Answer options should expose locked and selected accessibility state');
assert(appSource.includes('accessibilityState={{ selected }}'), 'Selectable mode, level, language, and BGM controls should expose selected state');
assert((appSource.match(/aria-pressed=\{selected\}/g) ?? []).length >= 5, 'Selectable controls should expose aria-pressed for web accessibility');
assert(appSource.includes('aria-pressed={isBgmEnabled}'), 'Music toggle should expose aria-pressed for web accessibility');
assert(!appSource.includes('disabled={!activeSupportUrl}'), 'Support link should stay usable by showing a local fallback while release links are pending');
assert(!appSource.includes('disabled={!activePrivacyPolicyUrl}'), 'Privacy link should stay usable by showing a local fallback while release links are pending');
assert(!appSource.includes('disabled={!activeOpenSourceNoticesUrl}'), 'Open source notice link should stay usable by showing a local fallback while release links are pending');
assert(appSource.includes("t(locale, 'supportPrivacy')"), 'Settings should expose a support/privacy section');
assert(i18nSource.includes('supportPrivacy:'), 'UI localization missing supportPrivacy key');
assert(i18nSource.includes('levelProgress:'), 'UI localization missing levelProgress key');
for (const key of ['localData', 'resetProgress', 'confirmResetProgress', 'progressResetArmed', 'progressResetDone']) {
  assert(i18nSource.includes(`${key}:`), `UI localization missing ${key} key`);
}
assert(i18nSource.includes('privacyPolicy:'), 'UI localization missing privacyPolicy key');
assert(i18nSource.includes('openSourceNotices:'), 'UI localization missing openSourceNotices key');
assert(i18nSource.includes('adPrivacyOptions:'), 'UI localization missing adPrivacyOptions key');
assert(i18nSource.includes('adPrivacyUnavailable:'), 'UI localization missing adPrivacyUnavailable key');
assert(i18nSource.includes('linksPending:'), 'UI localization missing linksPending key');
for (const key of ['localSupportTitle', 'localSupportBody', 'localPrivacyTitle', 'localPrivacyBody', 'localOpenSourceTitle', 'localOpenSourceBody']) {
  assert(i18nSource.includes(`${key}:`), `UI localization missing ${key} key`);
}
assert(screenshotSource.includes('Support & Privacy'), 'Settings App Store screenshot should show the support/privacy entry');
assert(screenshotSource.includes('Local data') && screenshotSource.includes('Reset progress'), 'Settings App Store screenshot should show the local data reset entry');
assert(screenshotSource.includes('Open source'), 'Settings App Store screenshot should show the open source entry');
assert(screenshotSource.includes('Ad privacy'), 'Settings App Store screenshot should show the ad privacy entry');
assert(screenshotSource.includes('Milestones') && screenshotSource.includes('20 mastered'), 'Ready App Store screenshot should show local milestone badges');
assert(screenshotSource.includes('Daily goal') && screenshotSource.includes('Finish 3 runs today'), 'Ready App Store screenshot should show the daily goal card');
assert(screenshotSource.includes('LOCALIZED_OUT_DIR'), 'Screenshot generator should create localized App Store screenshot packs');
assert(screenshotSource.includes('has_cjk') && screenshotSource.includes('has_hangul'), 'Screenshot generator should use CJK/Hangul font fallback');
assert(appSource.includes('await prepareRewardedAds()') && appSource.includes('await isAdPrivacyOptionsRequired()'), 'App should prepare rewarded-ad consent state and privacy-options visibility on launch');
assert(appSource.includes('openAdPrivacyOptions') && appSource.includes("t(locale, 'adPrivacyOptions')"), 'Settings should expose a UMP ad privacy options entry when required');
assert(adsNativeSource.includes("import('react-native-google-mobile-ads')"), 'AdMob SDK should be loaded with a guarded dynamic import in src/ads.native.ts');
assert(adsNativeSource.includes('RewardedAd.createForAdRequest'), 'Rewarded ad entry point is not wired to the native SDK');
assert(adsNativeSource.includes('AdsConsent.requestInfoUpdate'), 'Native ads should request updated UMP consent information before ads');
assert(adsNativeSource.includes('loadAndShowConsentFormIfRequired'), 'Native ads should present required UMP consent forms before ads');
assert(adsNativeSource.includes('canRequestAds'), 'Native ads should check UMP canRequestAds before loading rewarded ads');
assert(adsNativeSource.includes('AdsConsentPrivacyOptionsRequirementStatus.REQUIRED'), 'Native ads should check whether UMP privacy options are required');
assert(adsNativeSource.includes('showPrivacyOptionsForm'), 'Native ads should present the UMP privacy options form from Settings');
assert(adsNativeSource.includes('requestNonPersonalizedAdsOnly: true'), 'Rewarded ad requests should default to non-personalized ads');
assert(adsNativeSource.includes('MaxAdContentRating.PG'), 'Ad request configuration should cap content rating for broad App Store suitability');
assert(adsNativeSource.includes('isRealAdMobId'), 'Native ads should use the same real AdMob ID guard as release checks');
assert(adsNativeSource.includes('admobPlaceholderPattern'), 'Native ads should reject placeholder AdMob IDs at runtime');
assert(adsNativeSource.includes('admobDemoPublisherPattern'), 'Native ads should reject Google demo AdMob IDs at runtime');
assert(!adsFallbackSource.includes('react-native-google-mobile-ads'), 'Default ads module should stay web-safe and must not import the native ads SDK');
assert(!adsWebSource.includes('react-native-google-mobile-ads'), 'Web ads module should not import the native ads SDK');
assert(adsWebSource.includes('native-sdk-unavailable'), 'Web ads module should return a native-sdk-unavailable result');
assert(adsFallbackSource.includes('prepareRewardedAds') && adsWebSource.includes('prepareRewardedAds'), 'Web/default ads modules should expose a prepareRewardedAds stub');
assert(adsFallbackSource.includes('openAdPrivacyOptions') && adsWebSource.includes('openAdPrivacyOptions'), 'Web/default ads modules should expose an openAdPrivacyOptions stub');
assert(releaseHandoffDoc.includes('ADMOB_PRIVACY_MESSAGES_CONFIGURED'), 'docs/release-handoff.md should document AdMob Privacy & messaging confirmation');

for (const permission of blockedAndroidPermissions) {
  assert((appJson.android?.blockedPermissions ?? []).includes(permission), `Android blockedPermissions missing: ${permission}`);
}

for (const bgmFile of expectedBgmFiles) {
  const bgmPath = path.join(root, bgmFile);
  assert(fs.existsSync(bgmPath), `Missing BGM asset: ${bgmFile}`);

  if (fs.existsSync(bgmPath)) {
    assert(fs.statSync(bgmPath).size > 10000, `BGM asset looks too small: ${bgmFile}`);
  }
}

for (const [folder, dimensions] of Object.entries(expectedStoreScreenshots)) {
  for (const filename of expectedStoreScreenshotFiles) {
    const screenshotPath = `${folder}/${filename}`;
    const info = assertPngAsset(screenshotPath, `App Store screenshot ${screenshotPath}`, screenshotPath, dimensions.width, dimensions.height, { noAlpha: true });

    if (info) {
      assert(info.size > 25000, `App Store screenshot looks too small: ${screenshotPath}`);
    }
  }
}

for (const locale of expectedLocales) {
  for (const [folder, dimensions] of Object.entries(expectedStoreScreenshots)) {
    const deviceFolder = folder.split('/').pop();

    for (const filename of expectedStoreScreenshotFiles) {
      const screenshotPath = `${localizedStoreScreenshotRoot}/${locale}/${deviceFolder}/${filename}`;
      const info = assertPngAsset(screenshotPath, `Localized App Store screenshot ${screenshotPath}`, screenshotPath, dimensions.width, dimensions.height, { noAlpha: true });

      if (info) {
        assert(info.size > 25000, `Localized App Store screenshot looks too small: ${screenshotPath}`);
      }
    }
  }
}

verifyScreenshotManifest();
verifyScreenshotQaAudit();
verifyAppStoreCopyAudit();
verifyAppStoreMetadataUploadPacket();
verifyLocalizationAudit();
verifyPublicSiteHostingVerification();
verifyReviewGuide();
verifyAgeRatingAudit();
verifyStudyBankDepthAudit();
verifyStudyContentLocalizationAudit();
verifyContentRightsAudit();
verifyOpenSourceLicenseAudit();
verifyPrivacyManifestAudit();
verifyAppStorePrivacyAnswers();
verifyAdMobReleaseAudit();
verifyAdMobSetupHandoff();
verifyDataFlowPrivacyAudit();
verifyPrivacyReviewPacket();
verifyRuntimeUiFlowAudit();
verifyProductionDeviceSmokeTest();
verifyExternalReadiness();
verifyEasEnvChecklist();
verifyStoreSubmissionInputPack();
verifyAccountServicePreflight();
verifyExternalTodoTracker();
verifyEasBuildPreflight();
verifyAppStoreConnectChecklist();
verifyReleasePacket();
verifyEasSubmissionChecklist();
verifyFinalLaunchRunbook();
verifyAppStoreHandoffBundle();

const currentAdEnv = Object.fromEntries(adEnvKeys.map((key) => [key, process.env[key] ?? '']));
const hasAnyAdEnv = Object.values(currentAdEnv).some(Boolean);
const hasValidCurrentAdEnv =
  isRealAdMobId(currentAdEnv.EXPO_PUBLIC_ADMOB_IOS_APP_ID, admobAppIdPattern) &&
  isRealAdMobId(currentAdEnv.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID, admobAppIdPattern) &&
  isRealAdMobId(currentAdEnv.EXPO_PUBLIC_ADMOB_REWARDED_IOS_UNIT_ID, admobUnitIdPattern) &&
  isRealAdMobId(currentAdEnv.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_UNIT_ID, admobUnitIdPattern);
const privacyAnswersReviewed = process.env.APP_STORE_PRIVACY_ANSWERS_REVIEWED === '1';

if (hasAnyAdEnv) {
  assert(isRealAdMobId(currentAdEnv.EXPO_PUBLIC_ADMOB_IOS_APP_ID, admobAppIdPattern), 'EXPO_PUBLIC_ADMOB_IOS_APP_ID format is invalid, demo, or still a placeholder');
  assert(isRealAdMobId(currentAdEnv.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID, admobAppIdPattern), 'EXPO_PUBLIC_ADMOB_ANDROID_APP_ID format is invalid, demo, or still a placeholder');
  assert(isRealAdMobId(currentAdEnv.EXPO_PUBLIC_ADMOB_REWARDED_IOS_UNIT_ID, admobUnitIdPattern), 'EXPO_PUBLIC_ADMOB_REWARDED_IOS_UNIT_ID format is invalid, demo, or still a placeholder');
  assert(isRealAdMobId(currentAdEnv.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_UNIT_ID, admobUnitIdPattern), 'EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_UNIT_ID format is invalid, demo, or still a placeholder');
}

requireForStore(hasValidCurrentAdEnv, 'Valid AdMob app and rewarded-unit IDs are not set; live rewarded ads are disabled for this build.');
requireForStore(!hasValidCurrentAdEnv || findPlugin(appJson, 'react-native-google-mobile-ads'), 'AdMob env vars are valid but the native plugin was not added to the resolved Expo config.');
requireForStore(privacyAnswersReviewed, 'Set APP_STORE_PRIVACY_ANSWERS_REVIEWED=1 after updating App Store Connect privacy answers with docs/app-store-privacy-answers.md.');

for (const [key, message] of Object.entries(requiredStoreConfirmationEnv)) {
  assert(envExampleSource.includes(`${key}=0`), `.env.example should document ${key}`);
  assert(releaseHandoffDoc.includes(key), `docs/release-handoff.md should document ${key}`);
  requireForStore(process.env[key] === '1', message);
}

if (failures.length > 0) {
  console.error('Release check failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

if (warnings.length > 0) {
  console.warn('Release check warnings:');
  for (const warning of warnings) {
    console.warn(`- ${warning}`);
  }
}

console.log(`Release check passed for ${expectedLocales.length} locales${strictMode ? ' in strict store-ready mode' : ''}.`);

function countLevelEntries(factoryName, source = gameDataSource) {
  const counts = Object.fromEntries(expectedJlptLevels.map((level) => [level, 0]));

  for (const sourceLine of source.split(/\r?\n/)) {
    const line = sourceLine.trim();
    if (!line.startsWith(`${factoryName}(`)) continue;

    const explicitLevel = factoryName === 'grammar'
      ? line.match(/^grammar\([^,]+,\s*'(N[1-5])'/)?.[1]
      : line.match(/,\s*'(N[1-5])'\),?$/)?.[1];
    counts[explicitLevel ?? 'N5'] += 1;
  }

  return counts;
}

function verifyRuntimeAssetManifest() {
  const expectedPngAssets = {
    'app-icon': { path: 'assets/icon.png', width: 1024, height: 1024, alpha: false },
    'splash-image': { path: 'assets/splash-icon.png', width: 1024, height: 1024 },
    'android-adaptive-foreground': { path: 'assets/android-icon-foreground.png', width: 1024, height: 1024, alpha: true },
    'android-adaptive-background': { path: 'assets/android-icon-background.png', width: 1024, height: 1024, alpha: false },
    'android-adaptive-monochrome': { path: 'assets/android-icon-monochrome.png', width: 1024, height: 1024, alpha: true },
    'web-favicon': { path: 'assets/favicon.png', width: 48, height: 48 },
  };
  const expectedAudioAssets = {
    'bgm-rush': 'assets/bgm/dojo_rush_loop.wav',
    'bgm-focus': 'assets/bgm/neon_focus_loop.wav',
    'bgm-night': 'assets/bgm/starline_night_loop.wav',
  };

  assert(runtimeAssetManifest.schemaVersion === 1, 'Runtime asset manifest schemaVersion should be 1');
  assert(runtimeAssetManifest.source === 'scripts/generate-runtime-asset-manifest.js', 'Runtime asset manifest should name its generator');
  assert(runtimeAssetManifest.app?.name === appJson.name, 'Runtime asset manifest app name should match app.json');
  assert(runtimeAssetManifest.app?.version === appJson.version, 'Runtime asset manifest app version should match app.json');
  assert(runtimeAssetManifest.summary?.pngCount === Object.keys(expectedPngAssets).length, 'Runtime asset manifest PNG count should match expected runtime PNG assets');
  assert(runtimeAssetManifest.summary?.audioCount === Object.keys(expectedAudioAssets).length, 'Runtime asset manifest audio count should match expected BGM assets');
  sameSet((runtimeAssetManifest.pngAssets ?? []).map((asset) => asset.role), Object.keys(expectedPngAssets), 'Runtime PNG asset roles');
  sameSet((runtimeAssetManifest.audioAssets ?? []).map((asset) => asset.role), Object.keys(expectedAudioAssets), 'Runtime audio asset roles');

  let totalBytes = 0;

  for (const [role, expected] of Object.entries(expectedPngAssets)) {
    const entry = (runtimeAssetManifest.pngAssets ?? []).find((asset) => asset.role === role);
    assert(Boolean(entry), `Runtime asset manifest missing PNG role: ${role}`);
    if (!entry) continue;

    const info = readPngInfo(expected.path);
    const bytes = fs.statSync(path.join(root, expected.path)).size;
    totalBytes += bytes;

    assert(entry.path === expected.path, `Runtime asset manifest ${role} path mismatch`);
    assert(entry.file?.path === expected.path, `Runtime asset manifest ${role} file path mismatch`);
    assert(entry.file?.bytes === bytes, `Runtime asset manifest ${role} byte size mismatch`);
    assert(entry.file?.sha256 === fileSha256(expected.path), `Runtime asset manifest ${role} sha256 mismatch`);
    assert(entry.png?.width === expected.width, `Runtime asset manifest ${role} width mismatch`);
    assert(entry.png?.height === expected.height, `Runtime asset manifest ${role} height mismatch`);
    assert(entry.png?.width === info.width && entry.png?.height === info.height, `Runtime asset manifest ${role} dimensions should match current PNG file`);
    assert(entry.png?.bitDepth === 8, `Runtime asset manifest ${role} bitDepth should be 8`);

    if (typeof expected.alpha === 'boolean') {
      assert(entry.png?.hasAlphaChannel === expected.alpha, `Runtime asset manifest ${role} alpha mismatch`);
    }
  }

  for (const [role, expectedPath] of Object.entries(expectedAudioAssets)) {
    const entry = (runtimeAssetManifest.audioAssets ?? []).find((asset) => asset.role === role);
    assert(Boolean(entry), `Runtime asset manifest missing audio role: ${role}`);
    if (!entry) continue;

    const info = readWavInfo(expectedPath);
    const bytes = fs.statSync(path.join(root, expectedPath)).size;
    totalBytes += bytes;

    assert(entry.path === expectedPath, `Runtime asset manifest ${role} path mismatch`);
    assert(entry.file?.path === expectedPath, `Runtime asset manifest ${role} file path mismatch`);
    assert(entry.file?.bytes === bytes, `Runtime asset manifest ${role} byte size mismatch`);
    assert(entry.file?.sha256 === fileSha256(expectedPath), `Runtime asset manifest ${role} sha256 mismatch`);
    assert(entry.wav?.format === 'PCM', `Runtime asset manifest ${role} should be PCM`);
    assert(info.formatCode === 1, `${expectedPath} should be PCM WAV`);
    assert(entry.wav?.channels === 1 && info.channels === 1, `Runtime asset manifest ${role} should be mono`);
    assert(entry.wav?.sampleRate === 44100 && info.sampleRate === 44100, `Runtime asset manifest ${role} sample rate should be 44100 Hz`);
    assert(entry.wav?.bitsPerSample === 16 && info.bitsPerSample === 16, `Runtime asset manifest ${role} should be 16-bit`);
    assert(entry.wav?.dataBytes === info.dataBytes, `Runtime asset manifest ${role} data bytes mismatch`);
    assert(entry.wav?.durationSeconds === info.durationSeconds, `Runtime asset manifest ${role} duration mismatch`);
    assert(entry.wav?.durationSeconds >= 15, `Runtime asset manifest ${role} duration should be long enough for a BGM loop`);
  }

  assert(runtimeAssetManifest.summary?.totalBytes === totalBytes, 'Runtime asset manifest total byte count should match current files');

  for (const snippet of [
    '# Runtime Asset Manifest',
    'PNG assets: 6',
    'Audio assets: 3',
    'app-icon',
    'bgm-night',
  ]) {
    assert(runtimeAssetManifestDoc.includes(snippet), `Runtime asset manifest markdown missing: ${snippet}`);
  }
}

function verifyScreenshotManifest() {
  const expectedDefaultPaths = screenshotPathsForRoot('assets/store/ios');
  const totalExpectedCount = expectedDefaultPaths.length + expectedLocales.length * expectedDefaultPaths.length;

  assert(screenshotManifest.schemaVersion === 1, 'App Store screenshot manifest schemaVersion should be 1');
  assert(screenshotManifest.platform === 'ios', 'App Store screenshot manifest platform should be ios');
  assert(screenshotManifest.source === 'scripts/generate-store-screenshots.py', 'App Store screenshot manifest should name the screenshot generator');
  assert(Boolean(screenshotManifest.defaultPack), 'App Store screenshot manifest missing defaultPack');
  assert(Array.isArray(screenshotManifest.localizedPacks), 'App Store screenshot manifest localizedPacks should be an array');
  assert(screenshotManifest.localizedPacks?.length === expectedLocales.length, `App Store screenshot manifest should include ${expectedLocales.length} localized packs`);

  verifyScreenshotPack(screenshotManifest.defaultPack, 'en', expectedAppleLocales.en, 'assets/store/ios');
  sameSet(
    (screenshotManifest.localizedPacks ?? []).map((pack) => pack.locale),
    expectedLocales,
    'App Store screenshot manifest localized locales',
  );

  for (const locale of expectedLocales) {
    verifyScreenshotPack(
      (screenshotManifest.localizedPacks ?? []).find((pack) => pack.locale === locale),
      locale,
      expectedAppleLocales[locale],
      `assets/store/ios-localized/${locale}`,
    );
  }

  const totalManifestCount =
    (screenshotManifest.defaultPack?.screenshots ?? []).length +
    (screenshotManifest.localizedPacks ?? []).reduce((sum, pack) => sum + (pack.screenshots ?? []).length, 0);
  assert(totalManifestCount === totalExpectedCount, `App Store screenshot manifest should list ${totalExpectedCount} screenshots, got ${totalManifestCount}`);
}

function verifyScreenshotQaAudit() {
  const totalExpectedCount = screenshotManifestEntryCount();
  const expectedCheckIds = [
    'manifest-complete',
    'files-present',
    'png-upload-safety',
    'visual-variance',
    'scene-coverage',
    'english-default-sync',
    'localized-copy-distinct',
    'duplicate-policy',
    'generator-copy-markers',
    'localization-audit-sync',
  ];
  const expectedMarkerIds = [
    'zh-n5-n1-copy',
    'en-n5-n1-copy',
    'en-progress-copy',
    'zh-level-count-copy',
    'en-level-count-copy',
    'zh-daily-streak-copy',
    'en-daily-streak-copy',
    'zh-daily-goal-copy',
    'en-daily-goal-copy',
    'en-daily-goal-progress-copy',
    'zh-milestone-copy',
    'en-milestone-copy',
    'en-achievement-badge-copy',
    'rewarded-ad-copy',
    'ad-privacy-copy',
    'support-privacy-copy',
    'local-data-reset-copy',
    'bgm-copy',
    'localized-pack-loop',
    'cjk-font-fallback',
    'hangul-font-fallback',
  ];
  const screenshotRows = screenshotQaAudit.screenshots ?? [];
  const rowByPath = new Map(screenshotRows.map((entry) => [entry.path, entry]));
  const manifestEntries = [
    ...(screenshotManifest.defaultPack?.screenshots ?? []),
    ...(screenshotManifest.localizedPacks ?? []).flatMap((pack) => pack.screenshots ?? []),
  ];

  assert(screenshotQaAudit.schemaVersion === 1, 'Screenshot QA audit schemaVersion should be 1');
  assert(screenshotQaAudit.source === 'scripts/generate-screenshot-qa-audit.js', 'Screenshot QA audit should name its generator');
  assert(screenshotQaAudit.generatedFrom?.screenshotManifest === 'docs/app-store-screenshot-manifest.json', 'Screenshot QA audit should reference screenshot manifest');
  assert(screenshotQaAudit.generatedFrom?.localizationAudit === 'docs/localization-audit.json', 'Screenshot QA audit should reference localization audit');
  assert(screenshotQaAudit.generatedFrom?.screenshotGenerator === 'scripts/generate-store-screenshots.py', 'Screenshot QA audit should reference screenshot generator');
  assert(screenshotQaAudit.summary?.risk === 'PASS', 'Screenshot QA audit should pass before release');
  assert(screenshotQaAudit.summary?.totalScreenshots === totalExpectedCount, 'Screenshot QA audit screenshot count should match manifest');
  assert(screenshotQaAudit.summary?.defaultEntries === expectedStoreScreenshotFiles.length * Object.keys(expectedStoreScreenshots).length, 'Screenshot QA audit default entry count mismatch');
  assert(screenshotQaAudit.summary?.localizedEntries === expectedLocales.length * expectedStoreScreenshotFiles.length * Object.keys(expectedStoreScreenshots).length, 'Screenshot QA audit localized entry count mismatch');
  assert(screenshotQaAudit.summary?.locales === expectedLocales.length, 'Screenshot QA audit locale count mismatch');
  assert(screenshotQaAudit.summary?.devices === Object.keys(expectedStoreScreenshots).length, 'Screenshot QA audit device count mismatch');
  assert(screenshotQaAudit.summary?.scenes === expectedStoreScreenshotFiles.length, 'Screenshot QA audit scene count mismatch');
  assert(screenshotQaAudit.summary?.missingFiles === 0, 'Screenshot QA audit should not report missing files');
  assert(screenshotQaAudit.summary?.dimensionFailures === 0, 'Screenshot QA audit should not report dimension failures');
  assert(screenshotQaAudit.summary?.alphaFailures === 0, 'Screenshot QA audit should not report alpha-channel failures');
  assert(screenshotQaAudit.summary?.smallFiles === 0, 'Screenshot QA audit should not report undersized files');
  assert(screenshotQaAudit.summary?.lowVarianceFiles === 0, 'Screenshot QA audit should not report low-variance screenshots');
  assert(screenshotQaAudit.summary?.allScreenshotsReady === true, 'Screenshot QA audit should mark all screenshots ready');
  assert(screenshotQaAudit.summary?.expectedDefaultEnglishDuplicateGroups === expectedStoreScreenshotFiles.length * Object.keys(expectedStoreScreenshots).length, 'Screenshot QA audit default/en duplicate count mismatch');
  assert(screenshotQaAudit.summary?.unexpectedDuplicateGroups === 0, 'Screenshot QA audit should not report unexpected duplicate screenshots');
  assert(screenshotQaAudit.summary?.defaultEnglishPackMatchesLocalizedEnglish === true, 'Screenshot QA audit should confirm default and localized English packs match');
  assert(screenshotQaAudit.summary?.localizedNonEnglishDistinctFromDefault === true, 'Screenshot QA audit should confirm non-English packs differ from default');
  assert(screenshotQaAudit.summary?.sceneCoverageReady === true, 'Screenshot QA audit should mark scene coverage ready');
  assert(screenshotQaAudit.summary?.generatorCopyReady === true, 'Screenshot QA audit should mark generator copy ready');
  assert(screenshotQaAudit.summary?.fontFallbackReady === true, 'Screenshot QA audit should mark font fallback ready');
  assert(screenshotQaAudit.summary?.localizationRowsReady === true, 'Screenshot QA audit should agree with localization audit rows');
  assert(screenshotQaAudit.qualityThresholds?.minBytes >= 40000, 'Screenshot QA audit should enforce a meaningful PNG byte-size floor');
  assert(screenshotQaAudit.qualityThresholds?.minLuminanceRange >= 35, 'Screenshot QA audit should enforce visual range checks');
  assert(screenshotQaAudit.qualityThresholds?.minLuminanceVariance >= 80, 'Screenshot QA audit should enforce visual variance checks');
  assert(screenshotQaAudit.qualityThresholds?.minUniqueSampledColors >= 4, 'Screenshot QA audit should enforce sampled color diversity checks');
  sameSet((screenshotQaAudit.checks ?? []).map((check) => check.id), expectedCheckIds, 'Screenshot QA audit check ids');
  assert((screenshotQaAudit.checks ?? []).every((check) => check.status === 'PASS'), 'Screenshot QA audit checks should all pass');
  sameSet((screenshotQaAudit.generatorMarkers ?? []).map((marker) => marker.id), expectedMarkerIds, 'Screenshot QA audit generator marker ids');
  assert((screenshotQaAudit.generatorMarkers ?? []).every((marker) => marker.found === true), 'Screenshot QA audit generator markers should all be present');
  assert((screenshotQaAudit.findings ?? []).length === 0, 'Screenshot QA audit should have no findings in the release-ready state');
  assert((screenshotQaAudit.unexpectedDuplicateGroups ?? []).length === 0, 'Screenshot QA audit unexpected duplicate group list should be empty');
  assert((screenshotQaAudit.duplicateGroups ?? []).length === expectedStoreScreenshotFiles.length * Object.keys(expectedStoreScreenshots).length, 'Screenshot QA audit should only duplicate default screenshots with localized English screenshots');
  assert(screenshotRows.length === totalExpectedCount, 'Screenshot QA audit should include every screenshot row');

  for (const manifestEntry of manifestEntries) {
    const row = rowByPath.get(manifestEntry.path);
    assert(Boolean(row), `Screenshot QA audit missing row for ${manifestEntry.path}`);
    if (!row) continue;

    assert(row.ready === true, `Screenshot QA audit row should be ready for ${manifestEntry.path}`);
    assert(row.sha256 === manifestEntry.sha256, `Screenshot QA audit hash mismatch for ${manifestEntry.path}`);
    assert(row.bytes === manifestEntry.bytes, `Screenshot QA audit byte size mismatch for ${manifestEntry.path}`);
    assert(row.png?.width === manifestEntry.width, `Screenshot QA audit width mismatch for ${manifestEntry.path}`);
    assert(row.png?.height === manifestEntry.height, `Screenshot QA audit height mismatch for ${manifestEntry.path}`);
    assert(row.png?.hasAlphaChannel === false, `Screenshot QA audit should mark no alpha channel for ${manifestEntry.path}`);
    assert(row.visualQuality?.ready === true, `Screenshot QA audit visual quality should pass for ${manifestEntry.path}`);
  }

  const defaultPack = (screenshotQaAudit.packSummaries ?? []).find((pack) => pack.kind === 'default');
  const localizedPacks = (screenshotQaAudit.packSummaries ?? []).filter((pack) => pack.kind === 'localized');
  assert(Boolean(defaultPack), 'Screenshot QA audit should include a default pack summary');
  assert(localizedPacks.length === expectedLocales.length, 'Screenshot QA audit localized pack summary count mismatch');

  for (const pack of [defaultPack, ...localizedPacks].filter(Boolean)) {
    assert(pack.screenshots === expectedStoreScreenshotFiles.length * Object.keys(expectedStoreScreenshots).length, `Screenshot QA audit pack count mismatch for ${pack.locale}`);
    assert(pack.readyScreenshots === pack.screenshots, `Screenshot QA audit ready count mismatch for ${pack.locale}`);
    assert(pack.ready === true, `Screenshot QA audit pack should be ready for ${pack.locale}`);
    sameSet(pack.devices ?? [], Object.keys(expectedStoreScreenshots).map((folder) => folder.split('/').pop()), `Screenshot QA audit devices for ${pack.locale}`);
    sameSet(pack.scenes ?? [], expectedStoreScreenshotScenes, `Screenshot QA audit scenes for ${pack.locale}`);

    if (pack.kind === 'localized' && pack.locale === 'en') {
      assert(pack.matchesDefaultCount === pack.screenshots, 'Screenshot QA audit localized English should match default screenshots');
    }

    if (pack.kind === 'localized' && pack.locale !== 'en') {
      assert(pack.distinctFromDefaultCount === pack.screenshots, `Screenshot QA audit ${pack.locale} should differ from default screenshots`);
    }
  }

  for (const snippet of [
    '# Screenshot QA Audit',
    'Risk: PASS',
    'Total screenshots: 176',
    'Localized screenshots: 160',
    'English default pack matches localized English: Yes',
    'Non-English localized packs differ from default: Yes',
    'Generator copy ready: Yes',
    'Font fallback ready: Yes',
    'npm run screenshots:qa',
  ]) {
    assert(screenshotQaAuditDoc.includes(snippet), `Screenshot QA audit markdown missing: ${snippet}`);
  }
}

function verifyAppStoreCopyAudit() {
  assert(appStoreCopyAudit.schemaVersion === 1, 'App Store copy audit schemaVersion should be 1');
  assert(appStoreCopyAudit.source === 'scripts/generate-app-store-copy-audit.js', 'App Store copy audit should name its generator');
  assert(appStoreCopyAudit.generatedFrom?.localizations === 'docs/app-store-localizations.json', 'App Store copy audit should reference localization source');
  assert(appStoreCopyAudit.generatedFrom?.metadataPreview === 'docs/app-store-metadata-preview.json', 'App Store copy audit should reference metadata preview');
  assert(appStoreCopyAudit.generatedFrom?.screenshotManifest === 'docs/app-store-screenshot-manifest.json', 'App Store copy audit should reference screenshot manifest');
  assert(appStoreCopyAudit.generatedFrom?.contentRightsAudit === 'docs/content-rights-audit.json', 'App Store copy audit should reference content rights audit');
  assert(appStoreCopyAudit.generatedFrom?.privacyAnswers === 'docs/app-store-privacy-answers.json', 'App Store copy audit should reference privacy answers');
  assert(appStoreCopyAudit.generatedFrom?.admobReleaseAudit === 'docs/admob-release-audit.json', 'App Store copy audit should reference AdMob release audit');
  assert(appStoreCopyAudit.summary?.risk === 'PASS', 'App Store copy audit should pass before release');
  assert(appStoreCopyAudit.summary?.locales === expectedLocales.length, 'App Store copy audit locale count should match expected locales');
  assert(appStoreCopyAudit.summary?.readyLocales === expectedLocales.length, 'App Store copy audit should mark every locale ready');
  assert(appStoreCopyAudit.summary?.titleLimitReady === true, 'App Store copy audit should mark titles within limit');
  assert(appStoreCopyAudit.summary?.subtitleLimitReady === true, 'App Store copy audit should mark subtitles within limit');
  assert(appStoreCopyAudit.summary?.promotionalTextLimitReady === true, 'App Store copy audit should mark promotional text within limit');
  assert(appStoreCopyAudit.summary?.descriptionLimitReady === true, 'App Store copy audit should mark descriptions within limit');
  assert(appStoreCopyAudit.summary?.keywordsByteLimitReady === true, 'App Store copy audit should mark keywords within byte limit');
  assert(appStoreCopyAudit.summary?.keywordFormatReady === true, 'App Store copy audit should mark keyword formatting ready');
  assert(appStoreCopyAudit.summary?.noForbiddenClaims === true, 'App Store copy audit should reject forbidden ad/privacy claims');
  assert(appStoreCopyAudit.summary?.noProtectedTermHits === true, 'App Store copy audit should reject protected IP terms');
  assert(appStoreCopyAudit.summary?.coreFeatureClaimsReady === true, 'App Store copy audit should confirm JLPT/original-line claims');
  assert(appStoreCopyAudit.summary?.screenshotPacksReady === true, 'App Store copy audit should confirm screenshot packs');
  assert(appStoreCopyAudit.summary?.contentRightsRisk === contentRightsAudit.summary?.risk, 'App Store copy audit content rights risk should match content rights audit');
  assert(appStoreCopyAudit.summary?.privacyAnswerState === privacyAnswers.summary?.currentState, 'App Store copy audit privacy state should match privacy answers');
  assert(appStoreCopyAudit.summary?.admobState === admobReleaseAudit.summary?.currentState, 'App Store copy audit AdMob state should match AdMob audit');

  sameSet(appStoreCopyAudit.expectedLocales ?? [], expectedLocales, 'App Store copy audit expected locales');
  for (const reference of [
    'https://developer.apple.com/app-store/search/',
    'https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information/',
  ]) {
    assert((appStoreCopyAudit.officialReferences ?? []).some((entry) => entry.url === reference), `App Store copy audit should link ${reference}`);
  }

  for (const locale of expectedLocales) {
    const row = (appStoreCopyAudit.rows ?? []).find((entry) => entry.locale === locale);
    const preview = (metadataPreview.locales ?? []).find((entry) => entry.sourceLocale === locale);

    assert(Boolean(row), `App Store copy audit missing row for ${locale}`);
    if (!row) continue;

    assert(row.appStoreLocale === expectedAppleLocales[locale], `App Store copy audit App Store locale mismatch for ${locale}`);
    assert(row.previewLocale === expectedAppleLocales[locale], `App Store copy audit preview locale mismatch for ${locale}`);
    assert(row.title === metadata[locale]?.name, `App Store copy audit title mismatch for ${locale}`);
    assert(row.subtitle === metadata[locale]?.subtitle, `App Store copy audit subtitle mismatch for ${locale}`);
    assert(row.limits?.title?.value === preview?.lengths?.title, `App Store copy audit title length mismatch for ${locale}`);
    assert(row.limits?.subtitle?.value === preview?.lengths?.subtitle, `App Store copy audit subtitle length mismatch for ${locale}`);
    assert(row.limits?.promotionalText?.value === preview?.lengths?.promoText, `App Store copy audit promo length mismatch for ${locale}`);
    assert(row.limits?.description?.value === preview?.lengths?.description, `App Store copy audit description length mismatch for ${locale}`);
    assert(row.limits?.keywordsBytes?.value === Buffer.byteLength(metadata[locale]?.keywords ?? '', 'utf8'), `App Store copy audit keyword byte length mismatch for ${locale}`);
    assert(row.limits?.title?.ready === true, `App Store copy audit title should be ready for ${locale}`);
    assert(row.limits?.subtitle?.ready === true, `App Store copy audit subtitle should be ready for ${locale}`);
    assert(row.limits?.promotionalText?.ready === true, `App Store copy audit promotional text should be ready for ${locale}`);
    assert(row.limits?.description?.ready === true, `App Store copy audit description should be ready for ${locale}`);
    assert(row.limits?.keywordsBytes?.ready === true, `App Store copy audit keywords should fit App Store byte limit for ${locale}`);
    assert(row.keywordChecks?.ready === true, `App Store copy audit keyword checks should be ready for ${locale}`);
    assert(row.keywordChecks?.hasJlpt === true, `App Store copy audit keywords should include JLPT for ${locale}`);
    assert((row.keywordChecks?.duplicatedSearchTerms ?? []).length === 0, `App Store copy audit keywords should avoid title/subtitle duplicates for ${locale}`);
    assert(row.claimChecks?.coreFeatureClaimsReady === true, `App Store copy audit core feature claims should be ready for ${locale}`);
    assert((row.claimChecks?.forbiddenClaims ?? []).length === 0, `App Store copy audit should not find forbidden claims for ${locale}`);
    assert((row.claimChecks?.protectedTermHits ?? []).length === 0, `App Store copy audit should not find protected terms for ${locale}`);
    assert(row.screenshotPackReady === true, `App Store copy audit screenshot pack should be ready for ${locale}`);
    assert(row.screenshotCount === Object.keys(expectedStoreScreenshots).length * expectedStoreScreenshotFiles.length, `App Store copy audit screenshot count mismatch for ${locale}`);
    assert(row.ready === true, `App Store copy audit row should be ready for ${locale}`);
  }

  for (const snippet of [
    '# App Store Copy Audit',
    'Risk: PASS',
    'Ready locales: 10',
    'Keywords byte limit ready: Yes',
    'Keyword format ready: Yes',
    'No protected IP term hits: Yes',
    'Core JLPT/original-line claims ready: Yes',
  ]) {
    assert(appStoreCopyAuditDoc.includes(snippet), `App Store copy audit markdown missing: ${snippet}`);
  }
}

function verifyAppStoreMetadataUploadPacket() {
  const appStoreLocales = Object.values(expectedAppleLocales);
  const supportReadyLocales = (metadataPreview.locales ?? []).filter((entry) => entry.urls?.supportReady).length;
  const privacyReadyLocales = (metadataPreview.locales ?? []).filter((entry) => entry.urls?.privacyReady).length;
  const marketingReadyLocales = (metadataPreview.locales ?? []).filter((entry) => entry.urls?.marketingUrl).length;

  assert(metadataUploadPacket.schemaVersion === 1, 'App Store metadata upload packet schemaVersion should be 1');
  assert(metadataUploadPacket.source === 'scripts/generate-app-store-metadata-upload-packet.js', 'App Store metadata upload packet should name its generator');
  assert(metadataUploadPacket.generatedFrom?.storeConfig === 'store.config.js', 'App Store metadata upload packet should reference store config');
  assert(metadataUploadPacket.generatedFrom?.metadataPreview === 'docs/app-store-metadata-preview.json', 'App Store metadata upload packet should reference metadata preview');
  assert(metadataUploadPacket.generatedFrom?.appStoreCopyAudit === 'docs/app-store-copy-audit.json', 'App Store metadata upload packet should reference App Store copy audit');
  assert(metadataUploadPacket.generatedFrom?.screenshotManifest === 'docs/app-store-screenshot-manifest.json', 'App Store metadata upload packet should reference screenshot manifest');
  assert(metadataUploadPacket.generatedFrom?.publicSiteHostingVerification === 'docs/public-site-hosting-verification.json', 'App Store metadata upload packet should reference public site hosting verification');
  assert(metadataUploadPacket.app?.name === appJson.name, 'App Store metadata upload packet app name should match app.json');
  assert(metadataUploadPacket.app?.version === appJson.version, 'App Store metadata upload packet app version should match app.json');
  assert(metadataUploadPacket.app?.bundleIdentifier === appJson.ios?.bundleIdentifier, 'App Store metadata upload packet bundle ID should match app.json');
  assert(metadataUploadPacket.app?.buildNumber === appJson.ios?.buildNumber, 'App Store metadata upload packet build number should match app.json');
  assert(JSON.stringify(metadataUploadPacket.app?.categories ?? []) === JSON.stringify(storeConfig.apple?.categories ?? []), 'App Store metadata upload packet categories should match store config');
  assert(metadataUploadPacket.summary?.risk === 'PASS', 'App Store metadata upload packet should pass locally');
  assert(metadataUploadPacket.summary?.localReady === true, 'App Store metadata upload packet should mark local metadata ready');
  assert(metadataUploadPacket.summary?.externalUrlsReady === (supportReadyLocales === appStoreLocales.length && privacyReadyLocales === appStoreLocales.length), 'App Store metadata upload packet external URL readiness should match preview URLs');
  assert(metadataUploadPacket.summary?.reviewContactReady === Boolean(storeConfig.apple?.review), 'App Store metadata upload packet review contact readiness should match store config');
  assert(metadataUploadPacket.summary?.locales === appStoreLocales.length, 'App Store metadata upload packet locale count should match App Store locales');
  assert(metadataUploadPacket.summary?.fieldReadyLocales === appStoreLocales.length, 'App Store metadata upload packet should have every locale field-ready');
  assert(metadataUploadPacket.summary?.screenshotReadyLocales === appStoreLocales.length, 'App Store metadata upload packet should have every locale screenshot-ready');
  assert(metadataUploadPacket.summary?.supportUrlReadyLocales === supportReadyLocales, 'App Store metadata upload packet support URL count should match metadata preview');
  assert(metadataUploadPacket.summary?.privacyUrlReadyLocales === privacyReadyLocales, 'App Store metadata upload packet privacy URL count should match metadata preview');
  assert(metadataUploadPacket.summary?.marketingUrlReadyLocales === marketingReadyLocales, 'App Store metadata upload packet marketing URL count should match metadata preview');
  assert(metadataUploadPacket.summary?.copyAuditRisk === appStoreCopyAudit.summary?.risk, 'App Store metadata upload packet copy audit risk should match App Store copy audit');
  assert(metadataUploadPacket.summary?.hostingVerificationStatus === publicSiteHostingVerification.summary?.status, 'App Store metadata upload packet hosting verification status should match hosting audit');
  assert(metadataUploadPacket.summary?.failures === 0, 'App Store metadata upload packet should have zero local failures');
  assert(metadataUploadPacket.limits?.title === 30, 'App Store metadata upload packet title limit should be 30');
  assert(metadataUploadPacket.limits?.subtitle === 30, 'App Store metadata upload packet subtitle limit should be 30');
  assert(metadataUploadPacket.limits?.promoText === 170, 'App Store metadata upload packet promo limit should be 170');
  assert(metadataUploadPacket.limits?.keywords === 100, 'App Store metadata upload packet keyword limit should be 100');
  assert(metadataUploadPacket.limits?.descriptionMax === 4000, 'App Store metadata upload packet description limit should be 4000');
  assert((metadataUploadPacket.failures ?? []).length === 0, 'App Store metadata upload packet failures should be empty');
  sameSet((metadataUploadPacket.locales ?? []).map((entry) => entry.appStoreLocale), appStoreLocales, 'App Store metadata upload packet locales');

  for (const appStoreLocale of appStoreLocales) {
    const row = (metadataUploadPacket.locales ?? []).find((entry) => entry.appStoreLocale === appStoreLocale);
    const preview = (metadataPreview.locales ?? []).find((entry) => entry.appStoreLocale === appStoreLocale);
    const storeInfo = storeConfig.apple?.info?.[appStoreLocale] ?? {};
    const screenshotPack =
      (screenshotManifest.localizedPacks ?? []).find((pack) => pack.appStoreLocale === appStoreLocale) ??
      (appStoreLocale === 'en-US' ? screenshotManifest.defaultPack : undefined);

    assert(Boolean(row), `App Store metadata upload packet missing locale: ${appStoreLocale}`);
    if (!row) continue;

    assert(row.sourceLocale === preview?.sourceLocale, `App Store metadata upload packet source locale mismatch for ${appStoreLocale}`);
    assert(row.fieldLimitsReady === true, `App Store metadata upload packet fields should be ready for ${appStoreLocale}`);
    assert(row.screenshotPackReady === true, `App Store metadata upload packet screenshots should be ready for ${appStoreLocale}`);
    assert(row.fields?.title === storeInfo.title, `App Store metadata upload packet title mismatch for ${appStoreLocale}`);
    assert(row.fields?.subtitle === storeInfo.subtitle, `App Store metadata upload packet subtitle mismatch for ${appStoreLocale}`);
    assert(row.fields?.promotionalText === storeInfo.promoText, `App Store metadata upload packet promo text mismatch for ${appStoreLocale}`);
    assert(row.fields?.description === storeInfo.description, `App Store metadata upload packet description mismatch for ${appStoreLocale}`);
    assert(row.fields?.keywords === (storeInfo.keywords ?? []).join(','), `App Store metadata upload packet keywords mismatch for ${appStoreLocale}`);
    assert(row.fields?.releaseNotes === storeInfo.releaseNotes, `App Store metadata upload packet release notes mismatch for ${appStoreLocale}`);
    assert(row.fieldLengths?.title === preview?.lengths?.title, `App Store metadata upload packet title length mismatch for ${appStoreLocale}`);
    assert(row.fieldLengths?.subtitle === preview?.lengths?.subtitle, `App Store metadata upload packet subtitle length mismatch for ${appStoreLocale}`);
    assert(row.fieldLengths?.promoText === preview?.lengths?.promoText, `App Store metadata upload packet promo length mismatch for ${appStoreLocale}`);
    assert(row.fieldLengths?.description === preview?.lengths?.description, `App Store metadata upload packet description length mismatch for ${appStoreLocale}`);
    assert(row.fieldLengths?.keywords === preview?.lengths?.keywords, `App Store metadata upload packet keyword length mismatch for ${appStoreLocale}`);
    assert(row.urls?.marketingUrl === (preview?.urls?.marketingUrl ?? null), `App Store metadata upload packet marketing URL mismatch for ${appStoreLocale}`);
    assert(row.urls?.supportUrl === (preview?.urls?.supportUrl ?? null), `App Store metadata upload packet support URL mismatch for ${appStoreLocale}`);
    assert(row.urls?.privacyPolicyUrl === (preview?.urls?.privacyPolicyUrl ?? null), `App Store metadata upload packet privacy URL mismatch for ${appStoreLocale}`);
    assert(row.urls?.supportReady === preview?.urls?.supportReady, `App Store metadata upload packet support URL readiness mismatch for ${appStoreLocale}`);
    assert(row.urls?.privacyReady === preview?.urls?.privacyReady, `App Store metadata upload packet privacy URL readiness mismatch for ${appStoreLocale}`);
    assert(row.screenshots?.root === preview?.screenshots?.root, `App Store metadata upload packet screenshot root mismatch for ${appStoreLocale}`);
    assert(row.screenshots?.count === Object.keys(expectedStoreScreenshots).length * expectedStoreScreenshotFiles.length, `App Store metadata upload packet screenshot count mismatch for ${appStoreLocale}`);
    sameSet(row.screenshots?.devices ?? [], Object.keys(expectedStoreScreenshots).map((folder) => folder.split('/').pop()), `App Store metadata upload packet devices for ${appStoreLocale}`);
    sameSet(row.screenshots?.scenes ?? [], expectedStoreScreenshotScenes, `App Store metadata upload packet scenes for ${appStoreLocale}`);
    sameSet(row.screenshots?.files ?? [], (screenshotPack?.screenshots ?? []).map((entry) => entry.path), `App Store metadata upload packet screenshot files for ${appStoreLocale}`);
  }

  for (const snippet of [
    '# App Store Metadata Upload Packet',
    'Risk: PASS',
    'Local metadata ready: Yes',
    `Field-ready locales: ${appStoreLocales.length}/${appStoreLocales.length}`,
    `Screenshot-ready locales: ${appStoreLocales.length}/${appStoreLocales.length}`,
    `Copy audit risk: ${appStoreCopyAudit.summary?.risk}`,
    'Locale Summary',
    'Locale Field Packets',
    '### en-US',
    'Release Notes',
  ]) {
    assert(metadataUploadPacketDoc.includes(snippet), `App Store metadata upload packet markdown missing: ${snippet}`);
  }
}

function verifyLocalizationAudit() {
  const expectedDevices = Object.keys(expectedStoreScreenshots).map((folder) => folder.split('/').pop());

  assert(localizationAudit.schemaVersion === 1, 'Localization audit schemaVersion should be 1');
  assert(localizationAudit.source === 'scripts/generate-localization-audit.js', 'Localization audit should name its generator');
  assert(localizationAudit.generatedFrom?.appConfig === 'app.json', 'Localization audit should reference app.json');
  assert(localizationAudit.generatedFrom?.i18nSource === 'src/i18n.ts', 'Localization audit should reference src/i18n.ts');
  assert(localizationAudit.generatedFrom?.metadataPreview === 'docs/app-store-metadata-preview.json', 'Localization audit should reference metadata preview');
  assert(localizationAudit.generatedFrom?.screenshotManifest === 'docs/app-store-screenshot-manifest.json', 'Localization audit should reference screenshot manifest');
  assert(localizationAudit.generatedFrom?.publicSiteManifest === 'docs/public-site-manifest.json', 'Localization audit should reference public site manifest');
  assert(localizationAudit.generatedFrom?.studyContentLocalizationAudit === 'docs/study-content-localization-audit.json', 'Localization audit should reference study content localization audit');
  assert(localizationAudit.summary?.risk === 'PASS', 'Localization audit should pass before release');
  assert(localizationAudit.summary?.uiLocales === expectedLocales.length, 'Localization audit UI locale count should match expected locales');
  assert(localizationAudit.summary?.appStoreLocales === expectedLocales.length, 'Localization audit App Store locale count should match expected locales');
  assert(localizationAudit.summary?.uiCopyKeys >= 60, 'Localization audit should cover the current UI copy key set');
  assert(localizationAudit.summary?.languageFilesReady === true, 'Localization audit should mark language files ready');
  assert(localizationAudit.summary?.uiCopyReady === true, 'Localization audit should mark UI copy ready');
  assert(localizationAudit.summary?.appStoreMetadataReady === true, 'Localization audit should mark App Store metadata ready');
  assert(localizationAudit.summary?.screenshotPacksReady === true, 'Localization audit should mark screenshot packs ready');
  assert(localizationAudit.summary?.localizedScreenshotEntries === expectedLocales.length * Object.keys(expectedStoreScreenshots).length * expectedStoreScreenshotFiles.length, 'Localization audit localized screenshot count should match expected upload packs');
  assert(localizationAudit.summary?.publicSiteReady === true, 'Localization audit should mark public site ready');
  assert(localizationAudit.summary?.publicSitePages === publicSiteManifest.pageCount, 'Localization audit public site page count should match manifest');
  assert(localizationAudit.summary?.studyContentLocalizationRisk === 'PASS', 'Localization audit should record passing study content localization risk');
  assert(localizationAudit.summary?.studyContentLocalizationReady === true, 'Localization audit should mark study content localization ready');
  assert(localizationAudit.summary?.studyContentLocalizedFields === studyContentLocalizationAudit.summary?.localizedFieldsReady, 'Localization audit study content field count should match study content audit');
  assert(localizationAudit.summary?.studyContentExpectedFields === studyContentLocalizationAudit.summary?.expectedLocalizedFields, 'Localization audit expected study content field count should match study content audit');
  assert(localizationAudit.summary?.studyContentTranslationEntries === studyContentLocalizationAudit.summary?.contentTranslationEntriesReady, 'Localization audit study content translation count should match study content audit');
  assert(localizationAudit.summary?.studyContentExpectedTranslationEntries === studyContentLocalizationAudit.summary?.expectedContentTranslationEntries, 'Localization audit expected study content translation count should match study content audit');
  assert(localizationAudit.summary?.studyContentTextKeys === studyContentLocalizationAudit.summary?.studyTextKeys, 'Localization audit study content text key count should match study content audit');
  assert(localizationAudit.summary?.runtimeSignalsReady === true, 'Localization audit should mark runtime language signals ready');
  assert(localizationAudit.summary?.japaneseUiLocaleRemoved === true, 'Localization audit should record that Japanese UI locale is removed');

  sameSet(localizationAudit.expectedLocales ?? [], expectedLocales, 'Localization audit expected locales');
  sameSet(localizationAudit.appLocales ?? [], expectedLocales, 'Localization audit app locales');
  sameSet(localizationAudit.pluginSupportedLocales?.ios ?? [], expectedLocales, 'Localization audit iOS supported locales');
  sameSet(localizationAudit.pluginSupportedLocales?.android ?? [], expectedLocales, 'Localization audit Android supported locales');
  sameSet(localizationAudit.localeOptions ?? [], expectedLocales, 'Localization audit settings locale options');

  for (const locale of expectedLocales) {
    const languageFile = (localizationAudit.languageFiles ?? []).find((entry) => entry.locale === locale);
    assert(languageFile?.ready === true, `Localization audit language file should be ready for ${locale}`);
    assert(languageFile?.configuredPath === `languages/${locale}.json`, `Localization audit language file path mismatch for ${locale}`);
    assert(languageFile?.iosDisplayName === 'Kana Sprint', `Localization audit iOS display name mismatch for ${locale}`);
    assert(languageFile?.androidAppName === 'Kana Sprint', `Localization audit Android app name mismatch for ${locale}`);

    const uiCopy = (localizationAudit.uiCopy ?? []).find((entry) => entry.locale === locale);
    assert(uiCopy?.ready === true, `Localization audit UI copy should be ready for ${locale}`);
    assert(uiCopy?.keys === localizationAudit.summary?.uiCopyKeys, `Localization audit UI copy key count mismatch for ${locale}`);
    assert(uiCopy?.nonEmpty === localizationAudit.summary?.uiCopyKeys, `Localization audit UI copy should be non-empty for ${locale}`);

    const metadataRow = (localizationAudit.appStoreRows ?? []).find((entry) => entry.locale === locale);
    assert(metadataRow?.ready === true, `Localization audit App Store metadata should be ready for ${locale}`);
    assert(metadataRow?.appStoreLocale === expectedAppleLocales[locale], `Localization audit App Store locale mismatch for ${locale}`);
    assert(metadataRow?.mentionsJlpt === true, `Localization audit App Store metadata should mention JLPT for ${locale}`);

    const screenshotRow = (localizationAudit.screenshotRows ?? []).find((entry) => entry.locale === locale);
    assert(screenshotRow?.ready === true, `Localization audit screenshot pack should be ready for ${locale}`);
    assert(screenshotRow?.screenshots === Object.keys(expectedStoreScreenshots).length * expectedStoreScreenshotFiles.length, `Localization audit screenshot count mismatch for ${locale}`);
    sameSet(screenshotRow?.devices ?? [], expectedDevices, `Localization audit screenshot devices for ${locale}`);
    sameSet(screenshotRow?.scenes ?? [], expectedStoreScreenshotScenes, `Localization audit screenshot scenes for ${locale}`);

    const siteRow = (localizationAudit.publicSiteRows ?? []).find((entry) => entry.locale === locale);
    assert(siteRow?.ready === true, `Localization audit public site pages should be ready for ${locale}`);
    assert(siteRow?.pages === 4, `Localization audit public site page count mismatch for ${locale}`);
    sameSet(siteRow?.kinds ?? [], ['landing', 'support', 'privacy', 'licenses'], `Localization audit public site page kinds for ${locale}`);
  }

  assert(localizationAudit.runtimeSignals?.systemLanguageDetection === true, 'Localization audit should record system language detection');
  assert(localizationAudit.runtimeSignals?.settingsLanguageSwitch === true, 'Localization audit should record Settings language switching');
  assert(localizationAudit.runtimeSignals?.languageSwitchInSettings === true, 'Localization audit should record language switch placement in Settings');
  assert(localizationAudit.runtimeSignals?.japaneseUiLocaleRemoved === true, 'Localization audit should record no Japanese UI locale');

  for (const reference of [
    'https://docs.expo.dev/versions/v56.0.0/',
    'https://docs.expo.dev/versions/v56.0.0/sdk/localization/',
  ]) {
    assert((localizationAudit.officialReferences ?? []).some((entry) => entry.url === reference), `Localization audit should link ${reference}`);
  }

  for (const snippet of [
    '# Localization Audit',
    'Risk: PASS',
    'UI locales: 10',
    'App Store locales: 10',
    'Localized screenshot entries: 160',
    'Public site pages: 44',
    'Study content localization: PASS',
    `Study content text keys: ${studyContentLocalizationAudit.summary?.studyTextKeys}`,
    'Japanese UI locale removed: Yes',
    'System language detection uses `expo-localization`: Yes',
  ]) {
    assert(localizationAuditDoc.includes(snippet), `Localization audit markdown missing: ${snippet}`);
  }
}

function verifyReviewGuide() {
  const totalScreenshotEntries =
    (screenshotManifest.defaultPack?.screenshots ?? []).length +
    (screenshotManifest.localizedPacks ?? []).reduce((sum, pack) => sum + (pack.screenshots?.length ?? 0), 0);

  assert(reviewGuide.schemaVersion === 1, 'App Store review guide schemaVersion should be 1');
  assert(reviewGuide.app?.name === appJson.name, 'App Store review guide app name should match app.json');
  assert(reviewGuide.app?.version === appJson.version, 'App Store review guide app version should match app.json');
  assert(reviewGuide.app?.bundleIdentifier === appJson.ios?.bundleIdentifier, 'App Store review guide bundle ID should match app.json');
  sameSet(reviewGuide.app?.locales ?? [], expectedLocales, 'App Store review guide locales');
  assert(reviewGuide.review?.demoAccountRequired === false, 'App Store review guide should state that no demo account is required');
  assert(reviewGuide.review?.signInRequired === false, 'App Store review guide should state that sign-in is not required');
  assert(reviewGuide.review?.reviewContactReady === Boolean(storeConfig?.apple?.review), 'App Store review guide reviewContactReady should match EAS Metadata');
  assert((reviewGuide.review?.reviewNotes ?? '').includes('does not require sign-in'), 'App Store review guide notes should mention no sign-in');
  assert((reviewGuide.walkthrough ?? []).some((step) => step.includes('Start Practice')), 'App Store review guide should explain how to start a practice run');
  assert((reviewGuide.walkthrough ?? []).some((step) => step.includes('N5-N1')), 'App Store review guide should explain N5-N1 difficulty verification');
  assert((reviewGuide.walkthrough ?? []).some((step) => step.includes('Settings')), 'App Store review guide should point reviewers to Settings');
  assert((reviewGuide.walkthrough ?? []).some((step) => step.includes('rewarded-ad continue')), 'App Store review guide should explain the rewarded-ad continue entry point');
  assert((reviewGuide.privacy?.account ?? '').includes('No account'), 'App Store review guide should describe no-account data posture');
  assert((reviewGuide.privacy?.localData ?? '').includes('stay on device'), 'App Store review guide should describe local-only progress data');
  assert((reviewGuide.privacy?.localData ?? '').includes('daily goal progress'), 'App Store review guide should disclose local daily goal progress');
  assert((reviewGuide.privacy?.privacyEntry ?? '').includes('Ad privacy'), 'App Store review guide should mention the ad privacy entry');
  assert(reviewGuide.privacyManifest?.auditPath === 'docs/privacy-manifest-audit.md', 'App Store review guide should reference the privacy manifest audit');
  assert(reviewGuide.privacyManifest?.risk === privacyManifestAudit.summary?.risk, 'App Store review guide privacy manifest risk should match audit');
  assert(reviewGuide.privacyManifest?.tracking === privacyManifestAudit.summary?.tracking, 'App Store review guide tracking status should match privacy audit');
  assert(reviewGuide.privacyManifest?.collectedDataTypes === privacyManifestAudit.summary?.collectedDataTypes, 'App Store review guide collected data count should match privacy audit');
  assert(reviewGuide.privacyManifest?.requiredReasonApisReady === privacyManifestAudit.summary?.requiredReasonApisReady, 'App Store review guide required reason API status should match privacy audit');
  assert(reviewGuide.contentRights?.auditPath === 'docs/content-rights-audit.md', 'App Store review guide should reference the content rights audit');
  assert(reviewGuide.contentRights?.risk === contentRightsAudit.summary?.risk, 'App Store review guide content rights risk should match audit');
  assert(reviewGuide.contentRights?.protectedIpTermHits === contentRightsAudit.summary?.protectedIpTermHits, 'App Store review guide protected-IP hit count should match audit');
  assert(reviewGuide.contentRights?.originalAnimeStyleLinePrompts === contentRightsAudit.summary?.originalAnimeStyleLinePrompts, 'App Store review guide line count should match content rights audit');
  assert(reviewGuide.evidence?.appStoreLocales === expectedLocales.length, 'App Store review guide should record App Store locale count');
  assert(reviewGuide.evidence?.screenshotEntries === totalScreenshotEntries, 'App Store review guide should record screenshot entry count');
  assert(reviewGuide.evidence?.publicSitePages === publicSiteManifest.pageCount, 'App Store review guide should record public site page count');
  assert(reviewGuide.evidence?.runtimeUiFlowAudit === 'docs/runtime-ui-flow-audit.md', 'App Store review guide should reference runtime UI flow audit');
  assert(reviewGuide.evidence?.runtimeUiFlowReady === true, 'App Store review guide should record runtime UI flow readiness');
  assert(reviewGuide.evidence?.runtimeUiFlowChecks === runtimeUiFlowAudit.summary?.checks, 'App Store review guide runtime UI flow check count should match audit');
  assert(reviewGuide.evidence?.runtimeUiFlowPassedChecks === runtimeUiFlowAudit.summary?.passedChecks, 'App Store review guide runtime UI flow passed count should match audit');

  for (const snippet of [
    '# App Store Review Guide',
    'Demo account required: No',
    'Sign-in required: No',
    'Start Practice',
    'N5-N1',
    'Ad privacy',
    'daily goal progress',
    'Privacy Manifest',
    'Required reason APIs ready: Yes',
    'Content Rights',
    'Protected IP term hits: 0',
    'App Store screenshot entries: 176',
    'Public support/privacy/license pages: 44',
    'Runtime UI flow audit: docs/runtime-ui-flow-audit.md',
    'Runtime UI flow ready: Yes',
  ]) {
    assert(reviewGuideDoc.includes(snippet), `App Store review guide markdown missing: ${snippet}`);
  }
}

function verifyAgeRatingAudit() {
  const advisory = storeConfig?.apple?.advisory ?? {};
  const frequencyAnswers = ageRatingAudit.questionnaire?.frequencyAnswers ?? [];
  const capabilityAnswers = ageRatingAudit.questionnaire?.capabilityAnswers ?? [];

  assert(ageRatingAudit.schemaVersion === 1, 'App Store age rating audit schemaVersion should be 1');
  assert(ageRatingAudit.source === 'scripts/generate-age-rating-audit.js', 'App Store age rating audit should name its generator');
  assert(ageRatingAudit.generatedFrom?.appConfig === 'app.json', 'App Store age rating audit should reference app.json');
  assert(ageRatingAudit.generatedFrom?.storeConfig === 'store.config.js', 'App Store age rating audit should reference store.config.js');
  assert(ageRatingAudit.generatedFrom?.appSource === 'App.tsx', 'App Store age rating audit should reference App.tsx');
  assert(ageRatingAudit.summary?.risk === 'PASS', 'App Store age rating audit should pass before release');
  assert(ageRatingAudit.summary?.suggestedAppleGlobalRating === '4+ candidate', 'App Store age rating audit should suggest a 4+ candidate rating');
  assert(ageRatingAudit.summary?.finalRatingSource === 'App Store Connect age rating questionnaire', 'App Store age rating audit should point to App Store Connect as final rating source');
  assert(ageRatingAudit.summary?.allFrequencyAnswersNone === true, 'App Store age rating audit should confirm all frequency answers are NONE');
  assert(ageRatingAudit.summary?.frequencyQuestions === 12, 'App Store age rating audit should cover 12 frequency questions');
  assert(ageRatingAudit.summary?.frequencyNoneAnswers === 12, 'App Store age rating audit should record 12 NONE frequency answers');
  assert(ageRatingAudit.summary?.capabilitiesReady === true, 'App Store age rating audit should mark capabilities ready');
  assert(ageRatingAudit.summary?.sourceReady === true, 'App Store age rating audit should mark source posture ready');
  assert(ageRatingAudit.summary?.kidsCategory === false, 'App Store age rating audit should record that Kids category is not selected');
  assert(ageRatingAudit.summary?.unrestrictedWebAccess === false, 'App Store age rating audit should record no unrestricted web access');
  assert(ageRatingAudit.summary?.gambling === false, 'App Store age rating audit should record no gambling');
  assert(ageRatingAudit.summary?.overrides === 0, 'App Store age rating audit should record no rating overrides');
  assert(ageRatingAudit.app?.name === appJson.name, 'App Store age rating audit app name should match app.json');
  assert(ageRatingAudit.app?.version === appJson.version, 'App Store age rating audit app version should match app.json');
  assert(ageRatingAudit.app?.bundleIdentifier === appJson.ios?.bundleIdentifier, 'App Store age rating audit bundle ID should match app.json');
  assert((ageRatingAudit.posture?.statement ?? '').includes('language-learning matching game'), 'App Store age rating audit should describe the safe content posture');
  assert((ageRatingAudit.posture?.limitation ?? '').includes('App Store Connect'), 'App Store age rating audit should state that final ratings come from App Store Connect');

  for (const key of [
    'alcoholTobaccoOrDrugUseOrReferences',
    'contests',
    'gamblingSimulated',
    'horrorOrFearThemes',
    'matureOrSuggestiveThemes',
    'medicalOrTreatmentInformation',
    'profanityOrCrudeHumor',
    'sexualContentGraphicAndNudity',
    'sexualContentOrNudity',
    'violenceCartoonOrFantasy',
    'violenceRealistic',
    'violenceRealisticProlongedGraphicOrSadistic',
  ]) {
    const answer = frequencyAnswers.find((entry) => entry.key === key);
    assert(Boolean(answer), `App Store age rating audit missing frequency answer: ${key}`);
    assert(answer?.answer === advisory[key], `App Store age rating audit ${key} should match store.config.js`);
    assert(answer?.expected === 'NONE', `App Store age rating audit ${key} expected answer should be NONE`);
    assert(answer?.ready === true, `App Store age rating audit ${key} should be ready`);
  }

  for (const [key, expectedValue] of Object.entries({
    gambling: false,
    unrestrictedWebAccess: false,
    kidsAgeBand: null,
    ageRatingOverride: 'NONE',
    koreaAgeRatingOverride: 'NONE',
  })) {
    const answer = capabilityAnswers.find((entry) => entry.key === key);
    assert(Boolean(answer), `App Store age rating audit missing capability answer: ${key}`);
    assert(JSON.stringify(answer?.answer) === JSON.stringify(expectedValue), `App Store age rating audit ${key} should match the expected value`);
    assert(answer?.ready === true, `App Store age rating audit ${key} should be ready`);
  }

  assert(ageRatingAudit.sourceSignals?.hasTextInput === false, 'App Store age rating audit should record no text input / UGC surface');
  assert(ageRatingAudit.sourceSignals?.hasWebViewDependency === false, 'App Store age rating audit should record no WebView dependency');
  assert(ageRatingAudit.sourceSignals?.hasInAppPurchaseDependency === false, 'App Store age rating audit should record no IAP dependency');
  assert(ageRatingAudit.sourceSignals?.hasAuthDependency === false, 'App Store age rating audit should record no auth dependency');
  assert(ageRatingAudit.sourceSignals?.settingsUsesFixedExternalLinks === true, 'App Store age rating audit should record fixed support/privacy/license links');

  for (const reference of [
    'https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating/',
    'https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions/',
  ]) {
    assert((ageRatingAudit.officialReferences ?? []).some((entry) => entry.url === reference), `App Store age rating audit should link ${reference}`);
  }

  for (const snippet of [
    '# App Store Age Rating Audit',
    'Risk: PASS',
    'Suggested Apple global rating: 4+ candidate',
    'Final rating source: App Store Connect age rating questionnaire',
    'Frequency answers set to NONE: 12/12',
    'Unrestricted web access: No',
    'Gambling: No',
    'This audit is a static preparation aid',
  ]) {
    assert(ageRatingAuditDoc.includes(snippet), `App Store age rating audit markdown missing: ${snippet}`);
  }
}

function verifyContentRightsAudit() {
  const vocabCounts = countLevelEntries('vocab');
  const lineCounts = countLevelEntries('line');
  const grammarCounts = countLevelEntries('grammar', grammarDataSource);
  const totalVocab = Object.values(vocabCounts).reduce((sum, count) => sum + count, 0);
  const totalLines = Object.values(lineCounts).reduce((sum, count) => sum + count, 0);
  const totalGrammar = Object.values(grammarCounts).reduce((sum, count) => sum + count, 0);
  const expectedTotalStudyItems = 92 + totalVocab + totalLines + totalGrammar;

  assert(contentRightsAudit.schemaVersion === 1, 'Content rights audit schemaVersion should be 1');
  assert(contentRightsAudit.source === 'scripts/generate-content-rights-audit.js', 'Content rights audit should name its generator');
  assert(contentRightsAudit.generatedFrom?.gameData === 'src/gameData.ts', 'Content rights audit should reference gameData');
  assert(contentRightsAudit.generatedFrom?.appStoreLocalizations === 'docs/app-store-localizations.json', 'Content rights audit should reference App Store localizations');
  assert(contentRightsAudit.posture?.statement?.includes('original anime-style study lines'), 'Content rights audit should state the original anime-style line posture');
  assert(contentRightsAudit.posture?.limitation?.includes('not a legal opinion'), 'Content rights audit should include the legal limitation');
  assert(contentRightsAudit.summary?.risk === 'PASS', 'Content rights audit should pass before release');
  assert(contentRightsAudit.summary?.totalStudyItems === expectedTotalStudyItems, 'Content rights audit total study item count should match game data');
  assert(contentRightsAudit.summary?.kanaPrompts === 92, 'Content rights audit should record 92 kana prompts');
  assert(contentRightsAudit.summary?.vocabularyPrompts === totalVocab, 'Content rights audit vocabulary count should match game data');
  assert(contentRightsAudit.summary?.originalAnimeStyleLinePrompts === totalLines, 'Content rights audit line count should match game data');
  assert(contentRightsAudit.summary?.grammarPrompts === totalGrammar, 'Content rights audit grammar count should match game data');
  assert(contentRightsAudit.summary?.protectedIpTerms >= 35, 'Content rights audit should scan a broad protected-IP term list');
  assert(contentRightsAudit.summary?.protectedIpTermHits === 0, 'Content rights audit should have zero protected-IP hits');
  assert(contentRightsAudit.summary?.duplicateLineDisplays === 0, 'Content rights audit should have zero duplicate line displays');
  assert(contentRightsAudit.summary?.duplicateLineMeanings === 0, 'Content rights audit should have zero duplicate line meanings');
  assert(contentRightsAudit.summary?.metadataOriginalityLocales === expectedLocales.length, 'Content rights audit should confirm originality claims in every App Store locale');
  assert((contentRightsAudit.protectedIpHits ?? []).length === 0, 'Content rights audit protectedIpHits should be empty');
  assert((contentRightsAudit.duplicateLineDisplays ?? []).length === 0, 'Content rights audit duplicateLineDisplays should be empty');
  assert((contentRightsAudit.duplicateLineMeanings ?? []).length === 0, 'Content rights audit duplicateLineMeanings should be empty');
  sameSet((contentRightsAudit.metadataOriginality ?? []).map((entry) => entry.locale), expectedLocales, 'Content rights audit originality locales');
  assert((contentRightsAudit.metadataOriginality ?? []).every((entry) => entry.hasOriginalityClaim), 'Content rights audit should confirm every locale has an originality claim');

  for (const level of expectedJlptLevels) {
    assert(contentRightsAudit.levels?.[level]?.vocabulary === vocabCounts[level], `Content rights audit ${level} vocabulary count mismatch`);
    assert(contentRightsAudit.levels?.[level]?.linePrompts === lineCounts[level], `Content rights audit ${level} line count mismatch`);
    assert(contentRightsAudit.levels?.[level]?.grammarPrompts === grammarCounts[level], `Content rights audit ${level} grammar count mismatch`);
    assert((contentRightsAudit.levels?.[level]?.sampleLineIds ?? []).length > 0, `Content rights audit ${level} should include sample line IDs`);
  }

  for (const expectedGroup of ['Naruto', 'One Piece', 'Dragon Ball', 'Pokemon', 'Studio Ghibli']) {
    assert((contentRightsAudit.scannedProtectedIpGroups ?? []).some((entry) => entry.label === expectedGroup), `Content rights audit should scan ${expectedGroup}`);
  }

  for (const snippet of [
    '# Content Rights Audit',
    'Original anime-style line prompts',
    'Protected IP term hits: 0',
    'No protected IP term hits were found',
    'not a legal opinion',
    'N5',
    'N1',
  ]) {
    assert(contentRightsAuditDoc.includes(snippet), `Content rights audit markdown missing: ${snippet}`);
  }
}

function verifyOpenSourceLicenseAudit() {
  const packageLock = readJson('package-lock.json');
  const runtimeDistributionTotal = Object.values(openSourceLicenseAudit.runtimeLicenseDistribution ?? {})
    .reduce((sum, count) => sum + count, 0);
  const allDistributionTotal = Object.values(openSourceLicenseAudit.licenseDistribution ?? {})
    .reduce((sum, count) => sum + count, 0);

  assert(openSourceLicenseAudit.schemaVersion === 1, 'Open source license audit schemaVersion should be 1');
  assert(openSourceLicenseAudit.source === 'scripts/generate-open-source-license-audit.js', 'Open source license audit should name its generator');
  assert(openSourceLicenseAudit.generatedFrom?.packageJson === 'package.json', 'Open source license audit should reference package.json');
  assert(openSourceLicenseAudit.generatedFrom?.packageLock === 'package-lock.json', 'Open source license audit should reference package-lock.json');
  assert(openSourceLicenseAudit.generatedFrom?.contentRightsAudit === 'docs/content-rights-audit.json', 'Open source license audit should reference content rights audit');
  assert(openSourceLicenseAudit.generatedFrom?.runtimeAssetManifest === 'docs/runtime-asset-manifest.json', 'Open source license audit should reference runtime asset manifest');
  assert(openSourceLicenseAudit.posture?.limitation?.includes('not legal advice'), 'Open source license audit should include the legal limitation');
  assert(openSourceLicenseAudit.summary?.risk === 'PASS', 'Open source license audit should pass before release');
  assert(openSourceLicenseAudit.summary?.localReady === true, 'Open source license audit should mark local readiness');
  assert(openSourceLicenseAudit.summary?.lockfileVersion === packageLock.lockfileVersion, 'Open source license audit lockfile version should match package-lock');
  assert(openSourceLicenseAudit.summary?.directRuntimeDependencies === Object.keys(packageJson.dependencies ?? {}).length, 'Open source license audit direct runtime dependency count should match package.json');
  assert(openSourceLicenseAudit.summary?.directDevDependencies === Object.keys(packageJson.devDependencies ?? {}).length, 'Open source license audit dev dependency count should match package.json');
  assert(openSourceLicenseAudit.summary?.runtimePackages > openSourceLicenseAudit.summary?.directRuntimeDependencies, 'Open source license audit should include transitive runtime packages');
  assert(openSourceLicenseAudit.summary?.totalPackages >= openSourceLicenseAudit.summary?.runtimePackages, 'Open source license audit total package count should include runtime packages');
  assert(openSourceLicenseAudit.summary?.unknownRuntimeLicenses === 0, 'Open source license audit should have zero unknown runtime licenses');
  assert(openSourceLicenseAudit.summary?.prohibitedRuntimeLicenses === 0, 'Open source license audit should have zero prohibited runtime licenses');
  assert(openSourceLicenseAudit.summary?.unknownAllLicenses === 0, 'Open source license audit should have zero unknown lockfile licenses');
  assert(openSourceLicenseAudit.summary?.prohibitedAllLicenses === 0, 'Open source license audit should have zero prohibited lockfile licenses');
  assert(openSourceLicenseAudit.summary?.contentRightsRisk === 'PASS', 'Open source license audit should record passing content rights risk');
  assert(openSourceLicenseAudit.summary?.runtimeAudioAssets === runtimeAssetManifest.summary?.audioCount, 'Open source license audit audio count should match runtime asset manifest');
  assert(openSourceLicenseAudit.summary?.runtimePngAssets === runtimeAssetManifest.summary?.pngCount, 'Open source license audit PNG count should match runtime asset manifest');
  assert(runtimeDistributionTotal === openSourceLicenseAudit.summary?.runtimePackages, 'Open source license audit runtime license distribution should total runtime packages');
  assert(allDistributionTotal === openSourceLicenseAudit.summary?.totalPackages, 'Open source license audit license distribution should total all packages');
  sameSet(
    (openSourceLicenseAudit.directRuntime ?? []).map((entry) => entry.name),
    Object.keys(packageJson.dependencies ?? {}),
    'Open source license audit direct runtime dependencies',
  );
  assert((openSourceLicenseAudit.runtimeUnknownPackages ?? []).length === 0, 'Open source license audit runtime unknown package list should be empty');
  assert((openSourceLicenseAudit.runtimeProhibitedPackages ?? []).length === 0, 'Open source license audit runtime prohibited package list should be empty');
  assert((openSourceLicenseAudit.acceptedLicenseFamilies?.permissive ?? []).includes('MIT'), 'Open source license audit should list MIT as permissive');
  assert((openSourceLicenseAudit.acceptedLicenseFamilies?.prohibitedWithoutPermissiveAlternative ?? []).includes('GPL-2.0'), 'Open source license audit should flag GPL-2.0 without a permissive alternative');

  for (const snippet of [
    '# Open Source License Audit',
    'Risk: PASS',
    'Runtime packages:',
    'Unknown runtime licenses: 0',
    'Prohibited runtime licenses: 0',
    'Direct Runtime Dependencies',
    'Runtime License Distribution',
    'not legal advice',
  ]) {
    assert(openSourceLicenseAuditDoc.includes(snippet), `Open source license audit markdown missing: ${snippet}`);
  }
}

function verifyStudyBankDepthAudit() {
  const vocabCounts = countLevelEntries('vocab');
  const lineCounts = countLevelEntries('line');
  const grammarCounts = countLevelEntries('grammar', grammarDataSource);
  const totalVocab = Object.values(vocabCounts).reduce((sum, count) => sum + count, 0);
  const totalLines = Object.values(lineCounts).reduce((sum, count) => sum + count, 0);
  const totalGrammar = Object.values(grammarCounts).reduce((sum, count) => sum + count, 0);
  const expectedTotalStudyItems = 92 + totalVocab + totalLines + totalGrammar;
  const progressionRows = studyBankDepthAudit.difficultyProgression?.rows ?? [];

  assert(studyBankDepthAudit.schemaVersion === 1, 'Study bank depth audit schemaVersion should be 1');
  assert(studyBankDepthAudit.source === 'scripts/generate-study-bank-depth-audit.js', 'Study bank depth audit should name its generator');
  assert(studyBankDepthAudit.generatedFrom?.gameData === 'src/gameData.ts', 'Study bank depth audit should reference gameData');
  assert(studyBankDepthAudit.generatedFrom?.gameEngine === 'src/gameEngine.ts', 'Study bank depth audit should reference gameEngine');
  assert(studyBankDepthAudit.generatedFrom?.gameplayContract === 'scripts/check-gameplay-contract.js', 'Study bank depth audit should reference the gameplay contract');
  assert(studyBankDepthAudit.posture?.statement?.includes('N5-N1 study bank'), 'Study bank depth audit should state the N5-N1 posture');
  assert(studyBankDepthAudit.posture?.difficultyModel?.includes('Difficulty increases'), 'Study bank depth audit should describe the difficulty model');
  assert(studyBankDepthAudit.summary?.risk === 'PASS', 'Study bank depth audit should pass before release');
  assert(studyBankDepthAudit.summary?.levels === expectedJlptLevels.length, 'Study bank depth audit should record five JLPT levels');
  sameSet(studyBankDepthAudit.summary?.expectedLevels ?? [], expectedJlptLevels, 'Study bank depth audit expected levels');
  assert(studyBankDepthAudit.summary?.totalStudyItems === expectedTotalStudyItems, 'Study bank depth audit total study item count should match game data');
  assert(studyBankDepthAudit.summary?.kanaPrompts === 92, 'Study bank depth audit should record 92 kana prompts');
  assert(studyBankDepthAudit.summary?.vocabularyPrompts === totalVocab, 'Study bank depth audit vocabulary count should match game data');
  assert(studyBankDepthAudit.summary?.originalAnimeStyleLinePrompts === totalLines, 'Study bank depth audit line count should match game data');
  assert(studyBankDepthAudit.summary?.grammarPrompts === totalGrammar, 'Study bank depth audit grammar count should match game data');
  assert(studyBankDepthAudit.summary?.playableMeaningPrompts === totalVocab + totalLines, 'Study bank depth audit playable meaning prompt count should match vocabulary plus lines');
  assert(studyBankDepthAudit.summary?.totalTopics >= 20, 'Study bank depth audit should report broad topic-family coverage');
  assert(studyBankDepthAudit.summary?.duplicateIds === 0, 'Study bank depth audit should have zero duplicate IDs');
  assert(studyBankDepthAudit.summary?.duplicateDisplaysByLevel === 0, 'Study bank depth audit should have zero duplicate level/kind displays');
  assert(studyBankDepthAudit.summary?.failures === 0, 'Study bank depth audit should have zero release gate failures');
  assert(studyBankDepthAudit.difficultyProgression?.passed === true, 'Study bank depth audit difficulty progression should pass');
  assert(progressionRows.length === expectedJlptLevels.length, 'Study bank depth audit should include one progression row per level');
  sameSet(Object.keys(studyBankDepthAudit.levels ?? {}), expectedJlptLevels, 'Study bank depth audit level entries');

  let previousOrder = 0;
  let previousLineWeight = 0;
  let previousGrammarWeight = 0;
  let previousMeaningToWordWeight = -1;
  let previousTopicBias = -1;
  let previousLengthBias = -1;
  let previousAverageKanaLength = 0;

  for (const level of expectedJlptLevels) {
    const levelAudit = studyBankDepthAudit.levels?.[level] ?? {};
    const minimum = studyBankDepthAudit.thresholds?.[level] ?? {};
    const progression = progressionRows.find((row) => row.level === level);
    const expectedKana = level === 'N5' ? 92 : 0;
    const expectedVocab = vocabCounts[level] ?? 0;
    const expectedLines = lineCounts[level] ?? 0;
    const expectedGrammar = grammarCounts[level] ?? 0;

    assert(levelAudit.counts?.kana === expectedKana, `Study bank depth audit ${level} kana count mismatch`);
    assert(levelAudit.counts?.vocabulary === expectedVocab, `Study bank depth audit ${level} vocabulary count mismatch`);
    assert(levelAudit.counts?.linePrompts === expectedLines, `Study bank depth audit ${level} line count mismatch`);
    assert(levelAudit.counts?.grammarPrompts === expectedGrammar, `Study bank depth audit ${level} grammar count mismatch`);
    assert(levelAudit.counts?.total === expectedKana + expectedVocab + expectedLines + expectedGrammar, `Study bank depth audit ${level} total count mismatch`);
    assert(levelAudit.coverage?.topics >= minimum.topics, `Study bank depth audit ${level} topic coverage below threshold`);
    assert(levelAudit.coverage?.vocabularyTopics >= minimum.vocabularyTopics, `Study bank depth audit ${level} vocabulary topic coverage below threshold`);
    assert(levelAudit.coverage?.lineTopics >= minimum.lineTopics, `Study bank depth audit ${level} line topic coverage below threshold`);
    assert(levelAudit.coverage?.localizedMeaningFields === (expectedVocab + expectedLines) * expectedLocales.length, `Study bank depth audit ${level} localized meaning field count mismatch`);
    assert(levelAudit.coverage?.localizedTopicFields === (expectedVocab + expectedLines) * expectedLocales.length, `Study bank depth audit ${level} localized topic field count mismatch`);
    assert((levelAudit.sampleVocabularyIds ?? []).length > 0, `Study bank depth audit ${level} should include sample vocabulary IDs`);
    assert((levelAudit.sampleLineIds ?? []).length > 0, `Study bank depth audit ${level} should include sample line IDs`);
    assert((levelAudit.sampleGrammarIds ?? []).length > 0, `Study bank depth audit ${level} should include sample grammar IDs`);
    assert((levelAudit.topicBreakdown ?? []).length === levelAudit.coverage?.topics, `Study bank depth audit ${level} topic breakdown count mismatch`);
    assert(Boolean(progression), `Study bank depth audit progression missing ${level}`);
    if (!progression) continue;

    assert(progression.order === levelAudit.mixProfile?.order, `Study bank depth audit ${level} progression order should match mix profile`);
    assert(progression.lineWeight === levelAudit.mixProfile?.lineWeight, `Study bank depth audit ${level} progression line weight should match mix profile`);
    assert(progression.grammarWeight === levelAudit.mixProfile?.grammarWeight, `Study bank depth audit ${level} progression grammar weight should match mix profile`);
    assert(progression.meaningToWordWeight === levelAudit.mixProfile?.meaningToWordWeight, `Study bank depth audit ${level} progression reverse recall weight should match mix profile`);
    assert(progression.topicDistractorBias === levelAudit.mixProfile?.topicDistractorBias, `Study bank depth audit ${level} progression topic bias should match mix profile`);
    assert(progression.lengthDistractorBias === levelAudit.mixProfile?.lengthDistractorBias, `Study bank depth audit ${level} progression length bias should match mix profile`);
    assert(progression.averageKanaLength === levelAudit.averages?.kanaLength, `Study bank depth audit ${level} progression average kana length should match level averages`);
    assert(progression.order > previousOrder, `Study bank depth audit ${level} order should increase`);
    assert(progression.lineWeight >= previousLineWeight, `Study bank depth audit ${level} line weight should not decrease`);
    assert(progression.grammarWeight >= previousGrammarWeight, `Study bank depth audit ${level} grammar weight should not decrease`);
    assert(progression.meaningToWordWeight >= previousMeaningToWordWeight, `Study bank depth audit ${level} reverse recall weight should not decrease`);
    assert(progression.topicDistractorBias >= previousTopicBias, `Study bank depth audit ${level} topic bias should not decrease`);
    assert(progression.lengthDistractorBias >= previousLengthBias, `Study bank depth audit ${level} length bias should not decrease`);
    assert(progression.averageKanaLength >= previousAverageKanaLength, `Study bank depth audit ${level} average kana length should not decrease`);
    assert(level === 'N5' ? progression.kanaWeight > 0 : progression.kanaWeight === 0, `Study bank depth audit ${level} kana weight should match level policy`);

    previousOrder = progression.order;
    previousLineWeight = progression.lineWeight;
    previousGrammarWeight = progression.grammarWeight;
    previousMeaningToWordWeight = progression.meaningToWordWeight;
    previousTopicBias = progression.topicDistractorBias;
    previousLengthBias = progression.lengthDistractorBias;
    previousAverageKanaLength = progression.averageKanaLength;
  }

  for (const snippet of [
    '# Study Bank Depth Audit',
    'Risk: PASS',
    `Vocabulary prompts: ${totalVocab}`,
    `Original anime-style line prompts: ${totalLines}`,
    `Grammar prompts: ${totalGrammar}`,
    'Topic families:',
    'Difficulty Progression',
    'N5',
    'N1',
    'Release Gate Issues',
    'None.',
  ]) {
    assert(studyBankDepthAuditDoc.includes(snippet), `Study bank depth audit markdown missing: ${snippet}`);
  }
}

function verifyStudyContentLocalizationAudit() {
  const studyTextKeys = collectStudyTextKeys(gameDataSource, 'src/gameData.ts');
  const contentTranslations = collectContentTranslations(i18nSource, 'src/i18n.ts');
  const expectedLocalizedFields = studyBankDepthAudit.summary?.totalStudyItems * 2 * expectedLocales.length;
  const expectedContentTranslationEntries = studyTextKeys.size * expectedContentTranslationLocales.length;

  assert(studyContentLocalizationAudit.schemaVersion === 1, 'Study content localization audit schemaVersion should be 1');
  assert(studyContentLocalizationAudit.source === 'scripts/generate-study-content-localization-audit.js', 'Study content localization audit should name its generator');
  assert(studyContentLocalizationAudit.generatedFrom?.gameData === 'src/gameData.ts', 'Study content localization audit should reference gameData');
  assert(studyContentLocalizationAudit.generatedFrom?.i18nSource === 'src/i18n.ts', 'Study content localization audit should reference i18n source');
  assert(studyContentLocalizationAudit.generatedFrom?.studyBankDepthAudit === 'docs/study-bank-depth-audit.json', 'Study content localization audit should reference study bank depth audit');
  assert(studyContentLocalizationAudit.generatedFrom?.localizationAudit === 'docs/localization-audit.json', 'Study content localization audit should reference localization audit');
  assert(studyContentLocalizationAudit.posture?.statement?.includes('JLPT N5-N1'), 'Study content localization audit should state the N5-N1 localization posture');
  assert(studyContentLocalizationAudit.summary?.risk === 'PASS', 'Study content localization audit should pass before release');
  assert(studyContentLocalizationAudit.summary?.expectedLocales === expectedLocales.length, 'Study content localization audit should record ten UI locales');
  assert(studyContentLocalizationAudit.summary?.levels === expectedJlptLevels.length, 'Study content localization audit should record five JLPT levels');
  assert(studyContentLocalizationAudit.summary?.totalStudyItems === studyBankDepthAudit.summary?.totalStudyItems, 'Study content localization audit total item count should match study depth audit');
  assert(studyContentLocalizationAudit.summary?.playableMeaningPrompts === studyBankDepthAudit.summary?.playableMeaningPrompts, 'Study content localization audit playable prompt count should match study depth audit');
  assert(studyContentLocalizationAudit.summary?.kanaPrompts === studyBankDepthAudit.summary?.kanaPrompts, 'Study content localization audit kana count should match study depth audit');
  assert(studyContentLocalizationAudit.summary?.vocabularyPrompts === studyBankDepthAudit.summary?.vocabularyPrompts, 'Study content localization audit vocabulary count should match study depth audit');
  assert(studyContentLocalizationAudit.summary?.originalAnimeStyleLinePrompts === studyBankDepthAudit.summary?.originalAnimeStyleLinePrompts, 'Study content localization audit line count should match study depth audit');
  assert(studyContentLocalizationAudit.summary?.grammarPrompts === studyBankDepthAudit.summary?.grammarPrompts, 'Study content localization audit grammar count should match study depth audit');
  assert(studyContentLocalizationAudit.summary?.studyTextKeys === studyTextKeys.size, 'Study content localization audit text key count should match game data');
  assert(studyContentLocalizationAudit.summary?.contentTranslationKeys === contentTranslations.size, 'Study content localization audit content translation key count should match i18n source');
  assert(studyContentLocalizationAudit.summary?.expectedLocalizedFields === expectedLocalizedFields, 'Study content localization audit expected localized field count mismatch');
  assert(studyContentLocalizationAudit.summary?.localizedFieldsReady === expectedLocalizedFields, 'Study content localization audit should have all localized fields ready');
  assert(studyContentLocalizationAudit.summary?.missingLocalizedFields === 0, 'Study content localization audit should have zero missing localized fields');
  assert(studyContentLocalizationAudit.summary?.expectedContentTranslationEntries === expectedContentTranslationEntries, 'Study content localization audit expected translation entry count mismatch');
  assert(studyContentLocalizationAudit.summary?.contentTranslationEntriesReady === expectedContentTranslationEntries, 'Study content localization audit should have all content translations ready');
  assert(studyContentLocalizationAudit.summary?.missingTranslationEntries === 0, 'Study content localization audit should have zero missing translation entries');
  assert(studyContentLocalizationAudit.summary?.emptyTranslationEntries === 0, 'Study content localization audit should have zero empty translation entries');
  assert(studyContentLocalizationAudit.summary?.sixLocaleTranslationReady === true, 'Study content localization audit should mark six-locale translations ready');
  assert(studyContentLocalizationAudit.summary?.fullStudyItemLocaleFieldsReady === true, 'Study content localization audit should mark all study item locale fields ready');
  assert(studyContentLocalizationAudit.summary?.englishFallbackRisks === 0, 'Study content localization audit should have zero English fallback risks');
  sameSet(studyContentLocalizationAudit.expectedLocales ?? [], expectedLocales, 'Study content localization audit expected locales');
  sameSet(studyContentLocalizationAudit.expectedLevels ?? [], expectedJlptLevels, 'Study content localization audit expected levels');
  sameSet(studyContentLocalizationAudit.contentTranslationLocales ?? [], expectedContentTranslationLocales, 'Study content localization audit content translation locales');
  assert((studyContentLocalizationAudit.localeCoverage ?? []).length === expectedLocales.length, 'Study content localization audit should include one row per locale');
  assert((studyContentLocalizationAudit.levelCoverage ?? []).length === expectedJlptLevels.length, 'Study content localization audit should include one row per JLPT level');
  assert((studyContentLocalizationAudit.missingTranslationEntries ?? []).length === 0, 'Study content localization audit missing translation sample should be empty');
  assert((studyContentLocalizationAudit.emptyTranslationEntries ?? []).length === 0, 'Study content localization audit empty translation sample should be empty');
  assert((studyContentLocalizationAudit.missingLocalizedFields ?? []).length === 0, 'Study content localization audit missing localized field sample should be empty');
  assert((studyContentLocalizationAudit.failures ?? []).length === 0, 'Study content localization audit failures should be empty');

  for (const locale of expectedLocales) {
    const localeAudit = (studyContentLocalizationAudit.localeCoverage ?? []).find((entry) => entry.locale === locale);
    assert(Boolean(localeAudit), `Study content localization audit missing locale row: ${locale}`);
    if (!localeAudit) continue;

    assert(localeAudit.studyFields === studyBankDepthAudit.summary?.totalStudyItems * 2, `Study content localization audit ${locale} study field count mismatch`);
    assert(localeAudit.localizedFields === localeAudit.studyFields, `Study content localization audit ${locale} should have all fields localized`);
    assert(localeAudit.missingFields === 0, `Study content localization audit ${locale} should have zero missing fields`);
    assert(localeAudit.ready === true, `Study content localization audit ${locale} should be ready`);

    if (expectedContentTranslationLocales.includes(locale)) {
      assert(localeAudit.requiredContentTranslations === studyTextKeys.size, `Study content localization audit ${locale} translation requirement mismatch`);
    } else {
      assert(localeAudit.requiredContentTranslations === 0, `Study content localization audit ${locale} should not require contentTranslation entries`);
    }

    assert(localeAudit.missingContentTranslations === 0, `Study content localization audit ${locale} should have zero missing translations`);
    assert(localeAudit.emptyContentTranslations === 0, `Study content localization audit ${locale} should have zero empty translations`);
  }

  for (const level of expectedJlptLevels) {
    const levelAudit = (studyContentLocalizationAudit.levelCoverage ?? []).find((entry) => entry.level === level);
    const depthLevel = studyBankDepthAudit.levels?.[level] ?? {};
    assert(Boolean(levelAudit), `Study content localization audit missing level row: ${level}`);
    if (!levelAudit) continue;

    assert(levelAudit.items === depthLevel.counts?.total, `Study content localization audit ${level} item count should match study depth`);
    assert(levelAudit.kana === depthLevel.counts?.kana, `Study content localization audit ${level} kana count should match study depth`);
    assert(levelAudit.vocabulary === depthLevel.counts?.vocabulary, `Study content localization audit ${level} vocabulary count should match study depth`);
    assert(levelAudit.linePrompts === depthLevel.counts?.linePrompts, `Study content localization audit ${level} line count should match study depth`);
    assert(levelAudit.grammarPrompts === depthLevel.counts?.grammarPrompts, `Study content localization audit ${level} grammar count should match study depth`);
    assert(levelAudit.localizedFields === levelAudit.items * 2 * expectedLocales.length, `Study content localization audit ${level} localized field count mismatch`);
    assert(levelAudit.missingLocalizedFields === 0, `Study content localization audit ${level} should have zero missing localized fields`);
    assert(levelAudit.auditedTextKeys > 0, `Study content localization audit ${level} should include text keys`);
    assert(levelAudit.missingTranslationEntries === 0, `Study content localization audit ${level} should have zero missing translation entries`);
    assert(levelAudit.ready === true, `Study content localization audit ${level} should be ready`);
  }

  for (const snippet of [
    '# Study Content Localization Audit',
    'Risk: PASS',
    'UI locales: 10',
    'JLPT levels: 5',
    `Total study items: ${studyBankDepthAudit.summary?.totalStudyItems}`,
    `Study text keys: ${studyTextKeys.size}`,
    'Six-locale translation ready: Yes',
    'Full study item locale fields ready: Yes',
    'Locale Coverage',
    'JLPT Level Coverage',
    'N5',
    'N1',
    'Release Gate Issues',
    'None.',
  ]) {
    assert(studyContentLocalizationAuditDoc.includes(snippet), `Study content localization audit markdown missing: ${snippet}`);
  }
}

function verifyPrivacyManifestAudit() {
  const privacyManifest = staticAppJson.ios?.privacyManifests ?? {};
  const accessedApiTypes = privacyManifest.NSPrivacyAccessedAPITypes ?? [];
  const auditApis = privacyManifestAudit.iosPrivacyManifest?.accessedApiTypes ?? [];
  const audioPluginConfig = (appJson.plugins ?? []).find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-audio')?.[1] ?? {};

  assert(privacyManifestAudit.schemaVersion === 1, 'Privacy manifest audit schemaVersion should be 1');
  assert(privacyManifestAudit.source === 'scripts/generate-privacy-manifest-audit.js', 'Privacy manifest audit should name its generator');
  assert(privacyManifestAudit.generatedFrom?.appConfig === 'app.json', 'Privacy manifest audit should reference app.json');
  assert(privacyManifestAudit.generatedFrom?.dynamicExpoConfig === 'app.config.js', 'Privacy manifest audit should reference app.config.js');
  assert(privacyManifestAudit.generatedFrom?.privacyAnswers === 'docs/app-store-privacy-answers.md', 'Privacy manifest audit should reference privacy answers');
  assert(privacyManifestAudit.generatedFrom?.privacyPolicy === 'docs/privacy.md', 'Privacy manifest audit should reference privacy policy');
  assert(privacyManifestAudit.summary?.risk === 'PASS', 'Privacy manifest audit should pass before release');
  assert(privacyManifestAudit.app?.name === appJson.name, 'Privacy manifest audit app name should match app.json');
  assert(privacyManifestAudit.app?.version === appJson.version, 'Privacy manifest audit version should match app.json');
  assert(privacyManifestAudit.app?.bundleIdentifier === appJson.ios?.bundleIdentifier, 'Privacy manifest audit bundle ID should match app.json');
  assert(privacyManifestAudit.iosPrivacyManifest?.tracking === false, 'Privacy manifest audit should record no tracking');
  assert(privacyManifestAudit.summary?.tracking === false, 'Privacy manifest audit summary should record no tracking');
  assert((privacyManifestAudit.iosPrivacyManifest?.trackingDomains ?? []).length === 0, 'Privacy manifest audit should record no tracking domains');
  assert((privacyManifestAudit.iosPrivacyManifest?.collectedDataTypes ?? []).length === 0, 'Privacy manifest audit should record no collected data types');
  assert(privacyManifestAudit.summary?.collectedDataTypes === 0, 'Privacy manifest audit summary should record zero collected data types');
  assert(privacyManifestAudit.summary?.accessedApiTypes === accessedApiTypes.length, 'Privacy manifest audit accessed API count should match app.json');
  assert(privacyManifestAudit.summary?.requiredReasonApisReady === true, 'Privacy manifest audit should mark required reason APIs ready');
  assert(privacyManifestAudit.platformPosture?.usesNonExemptEncryption === false, 'Privacy manifest audit should record no non-exempt encryption');
  assert(privacyManifestAudit.summary?.nonExemptEncryption === false, 'Privacy manifest audit summary should record no non-exempt encryption');
  assert(privacyManifestAudit.platformPosture?.microphonePermission === false, 'Privacy manifest audit should record disabled microphone permission');
  assert(privacyManifestAudit.platformPosture?.recordAudioAndroid === false, 'Privacy manifest audit should record disabled Android audio recording');
  assert(privacyManifestAudit.platformPosture?.audioBackgroundRecording === false, 'Privacy manifest audit should record disabled background recording');
  assert(privacyManifestAudit.summary?.microphoneDisabled === true, 'Privacy manifest audit summary should record microphone disabled');
  sameSet(privacyManifestAudit.platformPosture?.androidBlockedPermissions ?? [], blockedAndroidPermissions, 'Privacy manifest audit Android blocked permissions');
  assert(privacyManifestAudit.adMobPosture?.dependencyPresent === true, 'Privacy manifest audit should record Google Mobile Ads dependency');
  assert(privacyManifestAudit.adMobPosture?.liveAdsEnabled === Boolean(appJson.extra?.admob?.liveAdsEnabled), 'Privacy manifest audit live ads state should match resolved Expo config');
  assert(privacyManifestAudit.adMobPosture?.umpConsentFlowPresent === true, 'Privacy manifest audit should record UMP consent flow');
  assert(privacyManifestAudit.adMobPosture?.nonPersonalizedDefault === true, 'Privacy manifest audit should record non-personalized ad default');
  assert(privacyManifestAudit.documents?.privacyAnswersMentionsApple === true, 'Privacy manifest audit should confirm Apple privacy answer docs');
  assert(privacyManifestAudit.documents?.privacyAnswersMentionsGoogleMobileAds === true, 'Privacy manifest audit should confirm Google Mobile Ads docs');
  assert(privacyManifestAudit.documents?.privacyPolicyMentionsNoAccount === true, 'Privacy manifest audit should confirm no-account privacy policy wording');
  assert(privacyManifestAudit.documents?.privacyPolicyMentionsLocalData === true, 'Privacy manifest audit should confirm local-data privacy policy wording');

  for (const [category, reason] of Object.entries(expectedPrivacyReasons)) {
    const api = auditApis.find((entry) => entry.category === category);
    assert(Boolean(api), `Privacy manifest audit missing required reason API: ${category}`);
    assert(api?.ready === true, `Privacy manifest audit should mark ${category} ready`);
    assert((api?.actualReasons ?? []).includes(reason), `Privacy manifest audit ${category} should include ${reason}`);
  }

  assert(audioPluginConfig.microphonePermission === false, 'expo-audio microphone permission should stay disabled');
  assert(audioPluginConfig.recordAudioAndroid === false, 'expo-audio Android recording should stay disabled');

  for (const reference of [
    'https://developer.apple.com/documentation/bundleresources/privacy-manifest-files',
    'https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api',
    'https://developer.apple.com/app-store/app-privacy-details/',
  ]) {
    assert((privacyManifestAudit.officialReferences ?? []).some((entry) => entry.url === reference), `Privacy manifest audit should link ${reference}`);
  }

  for (const snippet of [
    '# Privacy Manifest Audit',
    'Risk: PASS',
    'iOS tracking: No',
    'Collected data types: 0',
    'Required reason APIs ready: Yes',
    'NSPrivacyAccessedAPICategoryUserDefaults',
    'NSPrivacyAccessedAPICategoryFileTimestamp',
    'Android blocked permissions',
    'Google Mobile Ads dependency present: Yes',
    'not legal advice',
  ]) {
    assert(privacyManifestAuditDoc.includes(snippet), `Privacy manifest audit markdown missing: ${snippet}`);
  }
}

function verifyAppStorePrivacyAnswers() {
  assert(privacyAnswers.schemaVersion === 1, 'App Store privacy answer pack schemaVersion should be 1');
  assert(privacyAnswers.source === 'scripts/generate-app-store-privacy-answers.js', 'App Store privacy answer pack should name its generator');
  assert(privacyAnswers.generatedFrom?.appConfig === 'app.json + app.config.js', 'App Store privacy answer pack should reference Expo config sources');
  assert(privacyAnswers.generatedFrom?.privacyManifestAudit === 'docs/privacy-manifest-audit.json', 'App Store privacy answer pack should reference the privacy manifest audit');
  assert(privacyAnswers.generatedFrom?.contentRightsAudit === 'docs/content-rights-audit.json', 'App Store privacy answer pack should reference the content rights audit');
  assert(privacyAnswers.generatedFrom?.officialApplePrivacy === 'https://developer.apple.com/app-store/app-privacy-details/', 'App Store privacy answer pack should reference Apple privacy details');
  assert(privacyAnswers.generatedFrom?.officialGoogleAdMobDisclosure === 'https://developers.google.com/admob/ios/privacy/data-disclosure', 'App Store privacy answer pack should reference Google AdMob disclosure docs');
  assert(privacyAnswers.app?.name === appJson.name, 'App Store privacy answer pack app name should match app config');
  assert(privacyAnswers.app?.version === appJson.version, 'App Store privacy answer pack app version should match app config');
  assert(privacyAnswers.app?.bundleIdentifier === appJson.ios?.bundleIdentifier, 'App Store privacy answer pack bundle ID should match app config');
  assert(privacyAnswers.currentBuild?.state === (appJson.extra?.admob?.liveAdsEnabled ? 'LIVE_ADMOB' : 'NO_LIVE_ADS'), 'App Store privacy answer pack state should match resolved AdMob config');
  assert(privacyAnswers.currentBuild?.liveAdsEnabled === Boolean(appJson.extra?.admob?.liveAdsEnabled), 'App Store privacy answer pack liveAdMob state should match app config');
  assert(privacyAnswers.currentBuild?.privacyManifestRisk === privacyManifestAudit.summary?.risk, 'App Store privacy answer pack should record privacy manifest risk');
  assert(privacyAnswers.currentBuild?.privacyManifestCollectedDataTypes === privacyManifestAudit.summary?.collectedDataTypes, 'App Store privacy answer pack collected data count should match privacy audit');
  assert(privacyAnswers.currentBuild?.originalAnimeStyleLinePrompts === contentRightsAudit.summary?.originalAnimeStyleLinePrompts, 'App Store privacy answer pack should record line-prompt count');
  assert(privacyAnswers.summary?.risk === 'PASS', 'App Store privacy answer pack should pass while local privacy audit passes');
  assert(privacyAnswers.summary?.confirmationEnv === 'APP_STORE_PRIVACY_ANSWERS_REVIEWED', 'App Store privacy answer pack should name the final privacy confirmation env');
  assert(privacyAnswers.summary?.appCodeCollectsPersonalData === false, 'App Store privacy answer pack should record no app-code personal data collection');
  assert(privacyAnswers.summary?.accountRequired === false, 'App Store privacy answer pack should record no account requirement');
  assert(privacyAnswers.summary?.trackingDeclaredByAppCode === false, 'App Store privacy answer pack should record no app-code tracking');
  assert(privacyAnswers.summary?.finalAppStoreConnectReviewRequired === true, 'App Store privacy answer pack should keep final App Store Connect review required');

  const noLiveAnswers = privacyAnswers.noLiveAdsAnswers?.appStoreConnect ?? [];
  assert(noLiveAnswers.length >= 10, 'App Store privacy answer pack should include no-live-ads App Store rows');
  assert(noLiveAnswers.some((row) => row.field === 'Data collected by this app' && row.suggestedAnswer === 'No'), 'App Store privacy answer pack should include no-data-collected answer for no-live-ads state');
  assert(noLiveAnswers.some((row) => row.field === 'Tracking' && row.suggestedAnswer === 'No'), 'App Store privacy answer pack should include no-tracking answer for no-live-ads state');
  assert((privacyAnswers.noLiveAdsAnswers?.reviewerExplanation ?? '').includes('daily goal progress'), 'App Store privacy answer pack should disclose local daily goal progress in the no-live-ads state');

  const liveRows = privacyAnswers.liveAdMobAnswers?.likelyGoogleMobileAdsDataTypes ?? [];
  sameSet(
    liveRows.map((row) => row.appleDataType),
    ['Coarse Location', 'Crash Data', 'Performance Data', 'Device ID', 'Advertising Data', 'Product Interaction'],
    'App Store privacy answer pack live-AdMob disclosure rows',
  );
  assert((privacyAnswers.liveAdMobAnswers?.requiredBeforeSubmission ?? []).some((item) => item.includes('UMP canRequestAds')), 'App Store privacy answer pack should require UMP device verification');
  assert((privacyAnswers.liveAdMobAnswers?.requiredBeforeSubmission ?? []).some((item) => item.includes('APP_STORE_PRIVACY_ANSWERS_REVIEWED=1')), 'App Store privacy answer pack should gate final privacy confirmation');
  assert((privacyAnswers.liveAdMobAnswers?.reviewerNoteAddition ?? '').includes('Rewarded ads are available only through the continue-run entry point'), 'App Store privacy answer pack should include reviewer note addition for live ads');

  for (const reference of [
    'https://developer.apple.com/app-store/app-privacy-details/',
    'https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/',
    'https://developers.google.com/admob/ios/privacy/data-disclosure',
    'https://developers.google.com/admob/ios/privacy/strategies',
  ]) {
    assert((privacyAnswers.officialReferences ?? []).some((entry) => entry.url === reference), `App Store privacy answer pack should link ${reference}`);
  }

  for (const snippet of [
    '# App Store Privacy Answers',
    'Current Build State',
    'No Live AdMob IDs',
    'Live AdMob IDs Enabled',
    'Likely Google Mobile Ads disclosure rows to review',
    'Final confirmation env: `APP_STORE_PRIVACY_ANSWERS_REVIEWED`',
    'daily goal progress',
    'Google Mobile Ads iOS Data Disclosure',
    'npm run privacy:answers',
  ]) {
    assert(appStorePrivacyAnswersDoc.includes(snippet), `App Store privacy answers markdown missing: ${snippet}`);
  }
}

function verifyAdMobReleaseAudit() {
  assert(admobReleaseAudit.schemaVersion === 1, 'AdMob release audit schemaVersion should be 1');
  assert(admobReleaseAudit.source === 'scripts/generate-admob-release-audit.js', 'AdMob release audit should name its generator');
  assert(admobReleaseAudit.generatedFrom?.appConfig === 'app.json + app.config.js', 'AdMob release audit should reference Expo config sources');
  assert(admobReleaseAudit.generatedFrom?.adsNative === 'src/ads.native.ts', 'AdMob release audit should reference native ad implementation');
  assert(admobReleaseAudit.generatedFrom?.adsWeb === 'src/ads.web.ts', 'AdMob release audit should reference web ad implementation');
  assert(admobReleaseAudit.generatedFrom?.privacyAnswers === 'docs/app-store-privacy-answers.json', 'AdMob release audit should reference privacy answers');
  assert(admobReleaseAudit.generatedFrom?.externalReadiness === 'docs/external-readiness.json', 'AdMob release audit should reference external readiness');
  assert(admobReleaseAudit.app?.name === appJson.name, 'AdMob release audit app name should match app config');
  assert(admobReleaseAudit.app?.version === appJson.version, 'AdMob release audit app version should match app config');
  assert(admobReleaseAudit.app?.googleMobileAdsPackage === packageJson.dependencies?.['react-native-google-mobile-ads'], 'AdMob release audit should record the Google Mobile Ads package version');
  assert(admobReleaseAudit.summary?.risk === 'PASS', 'AdMob release audit should pass when local integration is complete');
  assert(admobReleaseAudit.summary?.localReady === true, 'AdMob release audit should mark local integration ready');
  assert(['NO_LIVE_ADS', 'LIVE_ADMOB', 'INVALID_OR_PARTIAL_ADMOB_ENV'].includes(admobReleaseAudit.summary?.currentState), 'AdMob release audit should record a known current state');
  assert(admobReleaseAudit.summary?.liveAdsReady === Boolean(appJson.extra?.admob?.liveAdsEnabled), 'AdMob release audit liveAdsReady should match resolved Expo config');
  assert(admobReleaseAudit.summary?.googleMobileAdsPluginInjected === Boolean(findPlugin(appJson, 'react-native-google-mobile-ads')), 'AdMob release audit plugin state should match resolved Expo config');
  assert(admobReleaseAudit.summary?.externalReady === (admobReleaseAudit.externalActions ?? []).every((entry) => entry.ready), 'AdMob release audit externalReady should match external actions');
  assert(admobReleaseAudit.summary?.externalBlockingItems === (admobReleaseAudit.externalActions ?? []).filter((entry) => !entry.ready).length, 'AdMob release audit external blocker count should match external actions');
  assert((admobReleaseAudit.environment?.keys ?? []).length === adEnvKeys.length, 'AdMob release audit should list all AdMob env keys');
  sameSet((admobReleaseAudit.environment?.keys ?? []).map((entry) => entry.key), adEnvKeys, 'AdMob release audit env keys');
  assert(admobReleaseAudit.environment?.state === admobReleaseAudit.summary?.currentState, 'AdMob release audit environment state should match summary state');
  assert(admobReleaseAudit.nativeConfig?.pluginAbsentWithoutIds === true, 'AdMob release audit should confirm plugin is absent without IDs');
  assert(admobReleaseAudit.nativeConfig?.pluginInjectedWithValidIds === true, 'AdMob release audit should confirm plugin is injected with valid IDs');
  assert(admobReleaseAudit.nativeConfig?.pluginAbsentWithPlaceholderIds === true, 'AdMob release audit should confirm plugin is absent with placeholder IDs');
  assert(admobReleaseAudit.nativeConfig?.pluginAbsentWithDemoIds === true, 'AdMob release audit should confirm plugin is absent with Google demo IDs');
  assert(admobReleaseAudit.nativeConfig?.delayAppMeasurementInit === true, 'AdMob release audit should confirm delayed app measurement init');
  assert(admobReleaseAudit.nativeConfig?.skAdNetworkItems >= 40, 'AdMob release audit should record SKAdNetwork items');
  assert(admobReleaseAudit.nativeConfig?.liveAdsEnabledWithoutIds === false, 'AdMob release audit should keep live ads disabled without IDs');
  assert(admobReleaseAudit.nativeConfig?.liveAdsEnabledWithPlaceholderIds === false, 'AdMob release audit should keep live ads disabled with placeholder IDs');
  assert(admobReleaseAudit.nativeConfig?.liveAdsEnabledWithDemoIds === false, 'AdMob release audit should keep live ads disabled with Google demo IDs');
  assert(admobReleaseAudit.nativeConfig?.liveAdsEnabledWithValidIds === true, 'AdMob release audit should enable live ads with valid IDs');
  assert(admobReleaseAudit.runtimeFlow?.uiEntryReady === true, 'AdMob release audit should verify rewarded-ad UI entry');
  assert(admobReleaseAudit.runtimeFlow?.settingsPrivacyReady === true, 'AdMob release audit should verify Settings ad privacy entry');
  assert(admobReleaseAudit.runtimeFlow?.nativeConsentReady === true, 'AdMob release audit should verify native UMP consent flow');
  assert(admobReleaseAudit.runtimeFlow?.nativeRewardReady === true, 'AdMob release audit should verify native rewarded lifecycle');
  assert(admobReleaseAudit.runtimeFlow?.nativeRuntimeGuardReady === true, 'AdMob release audit should verify native runtime AdMob ID guard');
  assert(admobReleaseAudit.runtimeFlow?.requestConfigReady === true, 'AdMob release audit should verify request configuration');
  assert(admobReleaseAudit.runtimeFlow?.webExportGuardReady === true, 'AdMob release audit should verify web export guard');
  assert(admobReleaseAudit.runtimeFlow?.developmentRewardGuarded === true, 'AdMob release audit should verify development-only reward guard');
  assert(admobReleaseAudit.privacy?.privacyConfirmationEnv === 'APP_STORE_PRIVACY_ANSWERS_REVIEWED', 'AdMob release audit should carry privacy confirmation env');
  assert(admobReleaseAudit.privacy?.liveAdMobDisclosureRows === (privacyAnswers.liveAdMobAnswers?.likelyGoogleMobileAdsDataTypes ?? []).length, 'AdMob release audit live-AdMob disclosure rows should match privacy answers');
  assert(admobReleaseAudit.privacy?.privacyManifestRisk === privacyManifestAudit.summary?.risk, 'AdMob release audit privacy manifest risk should match privacy audit');
  assert(admobReleaseAudit.privacy?.appCodeCollectsPersonalData === false, 'AdMob release audit should record no app-code personal data collection');
  assert((admobReleaseAudit.localChecks ?? []).length >= 10, 'AdMob release audit should include local checks');
  assert((admobReleaseAudit.localChecks ?? []).every((entry) => entry.passed === true), 'AdMob release audit local checks should pass');
  sameSet((admobReleaseAudit.externalActions ?? []).map((entry) => entry.label), ['Live AdMob IDs', 'ADMOB_PRIVACY_MESSAGES_CONFIGURED'], 'AdMob release audit external actions');
  assert((admobReleaseAudit.commands ?? []).includes('npm run ads:audit'), 'AdMob release audit should list its own command');
  assert((admobReleaseAudit.commands ?? []).includes('npm run release:store-ready'), 'AdMob release audit should list the strict store gate');

  for (const reference of [
    'https://docs.expo.dev/versions/v56.0.0/',
    'https://developers.google.com/admob/ios/privacy/data-disclosure',
    'https://developers.google.com/admob/ios/test-ads',
    'https://developers.google.com/admob/android/test-ads',
    'https://developer.apple.com/app-store/app-privacy-details/',
  ]) {
    assert((admobReleaseAudit.officialReferences ?? []).some((entry) => entry.url === reference), `AdMob release audit should link ${reference}`);
  }

  for (const snippet of [
    '# AdMob Release Audit',
    'Local ad integration ready: Yes',
    `Current state: ${admobReleaseAudit.summary?.currentState}`,
    'Plugin absent without IDs: Yes',
    'Plugin injected with valid IDs: Yes',
    'Plugin absent with placeholder IDs: Yes',
    'Plugin absent with Google demo IDs: Yes',
    'native-consent',
    'native-id-guard',
    'web-guard',
    'External Actions',
    'Live AdMob IDs',
    'ADMOB_PRIVACY_MESSAGES_CONFIGURED',
    'npm run ads:audit',
  ]) {
    assert(admobReleaseAuditDoc.includes(snippet), `AdMob release audit markdown missing: ${snippet}`);
  }
}

function verifyAdMobSetupHandoff() {
  const manualConfirmationKeys = [
    'ADMOB_PRIVACY_MESSAGES_CONFIGURED',
    'APP_STORE_PRIVACY_ANSWERS_REVIEWED',
    'PRODUCTION_DEVICE_TESTED',
  ];
  const expectedVerificationCommands = [
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
  ];
  const envPlan = admobSetupHandoff.envPlan ?? [];
  const manualConfirmations = admobSetupHandoff.manualConfirmations ?? [];
  const allProductionIdsValid = envPlan.every((entry) => entry.validProductionFormat === true);
  const externalReady =
    allProductionIdsValid &&
    admobSetupHandoff.summary?.liveAdsReady === true &&
    manualConfirmations.every((entry) => entry.ready === true);

  assert(admobSetupHandoff.schemaVersion === 1, 'AdMob setup handoff schemaVersion should be 1');
  assert(admobSetupHandoff.source === 'scripts/generate-admob-setup-handoff.js', 'AdMob setup handoff should name its generator');
  assert(admobSetupHandoff.generatedFrom?.admobReleaseAudit === 'docs/admob-release-audit.json', 'AdMob setup handoff should reference the AdMob release audit');
  assert(admobSetupHandoff.generatedFrom?.privacyAnswers === 'docs/app-store-privacy-answers.json', 'AdMob setup handoff should reference App Store privacy answers');
  assert(admobSetupHandoff.generatedFrom?.privacyReviewPacket === 'docs/privacy-review-packet.json', 'AdMob setup handoff should reference the privacy review packet');
  assert(admobSetupHandoff.generatedFrom?.productionDeviceSmokeTest === 'docs/production-device-smoke-test.json', 'AdMob setup handoff should reference the production device smoke test');
  assert(admobSetupHandoff.generatedFrom?.releaseStatus === 'scripts/release-status.js --json', 'AdMob setup handoff should reference release-status');
  assert(admobSetupHandoff.generatedFrom?.envTemplate === '.env.example', 'AdMob setup handoff should reference the env template');
  assert(admobSetupHandoff.generatedFrom?.appConfig === 'app.json + app.config.js', 'AdMob setup handoff should reference Expo config sources');
  assert(admobSetupHandoff.app?.name === appJson.name, 'AdMob setup handoff app name should match app config');
  assert(admobSetupHandoff.app?.version === appJson.version, 'AdMob setup handoff app version should match app config');
  assert(admobSetupHandoff.app?.bundleIdentifier === appJson.ios?.bundleIdentifier, 'AdMob setup handoff bundle ID should match app config');
  assert(admobSetupHandoff.app?.packageName === appJson.android?.package, 'AdMob setup handoff package name should match app config');
  assert(admobSetupHandoff.app?.googleMobileAdsPackage === packageJson.dependencies?.['react-native-google-mobile-ads'], 'AdMob setup handoff should record the Google Mobile Ads package version');
  assert(admobSetupHandoff.summary?.risk === 'PASS', 'AdMob setup handoff should pass when local AdMob integration is ready');
  assert(admobSetupHandoff.summary?.localReady === true, 'AdMob setup handoff should mark local AdMob integration ready');
  assert(admobSetupHandoff.summary?.currentState === admobReleaseAudit.summary?.currentState, 'AdMob setup handoff state should match the AdMob release audit');
  assert(admobSetupHandoff.summary?.liveAdsReady === admobReleaseAudit.summary?.liveAdsReady, 'AdMob setup handoff liveAdsReady should match the AdMob release audit');
  assert(admobSetupHandoff.summary?.googleMobileAdsPluginInjected === admobReleaseAudit.summary?.googleMobileAdsPluginInjected, 'AdMob setup handoff plugin state should match the AdMob release audit');
  assert(admobSetupHandoff.summary?.allProductionIdsValid === allProductionIdsValid, 'AdMob setup handoff production-ID summary should match env plan');
  assert(admobSetupHandoff.summary?.externalReady === externalReady, 'AdMob setup handoff externalReady should match IDs, live state, and manual confirmations');
  assert(admobSetupHandoff.summary?.externalPending === !externalReady, 'AdMob setup handoff externalPending should invert externalReady');
  assert(admobSetupHandoff.summary?.privacyMessagingConfirmed === (process.env.ADMOB_PRIVACY_MESSAGES_CONFIGURED === '1'), 'AdMob setup handoff privacy messaging confirmation should match env');
  assert(admobSetupHandoff.summary?.appStorePrivacyReviewed === (process.env.APP_STORE_PRIVACY_ANSWERS_REVIEWED === '1'), 'AdMob setup handoff privacy review confirmation should match env');
  assert(admobSetupHandoff.summary?.productionDeviceTested === (process.env.PRODUCTION_DEVICE_TESTED === '1'), 'AdMob setup handoff device test confirmation should match env');
  assert(admobSetupHandoff.summary?.liveAdMobDisclosureRows === (privacyAnswers.liveAdMobAnswers?.likelyGoogleMobileAdsDataTypes ?? []).length, 'AdMob setup handoff disclosure row count should match privacy answers');
  assert(admobSetupHandoff.summary?.smokeTestSections === (productionSmokeTest.sections ?? []).length, 'AdMob setup handoff smoke-test section count should match production smoke test');

  assert(envPlan.length === adEnvKeys.length, 'AdMob setup handoff should list all AdMob env keys');
  sameSet(envPlan.map((entry) => entry.key), adEnvKeys, 'AdMob setup handoff env keys');
  for (const entry of envPlan) {
    assert(entry.visibility === 'sensitive', `AdMob setup handoff should mark ${entry.key} as sensitive`);
    assert((entry.easCommand ?? '').includes(`eas env:create --name ${entry.key}`), `AdMob setup handoff EAS command missing key: ${entry.key}`);
    assert((entry.easCommand ?? '').includes('--environment production'), `AdMob setup handoff EAS command should target production: ${entry.key}`);
    assert((entry.easCommand ?? '').includes('--visibility sensitive'), `AdMob setup handoff EAS command should use sensitive visibility: ${entry.key}`);
  }

  sameSet(manualConfirmations.map((entry) => entry.key), manualConfirmationKeys, 'AdMob setup handoff manual confirmations');
  for (const entry of manualConfirmations) {
    assert(entry.expectedValue === '1', `AdMob setup handoff manual confirmation should use value 1: ${entry.key}`);
    assert(typeof entry.evidence === 'string' && entry.evidence.length > 20, `AdMob setup handoff manual confirmation needs evidence text: ${entry.key}`);
  }

  assert((admobSetupHandoff.adMobConsolePlan ?? []).length >= 6, 'AdMob setup handoff should include AdMob console steps');
  assert((admobSetupHandoff.appStorePrivacyPlan ?? []).length >= 4, 'AdMob setup handoff should include App Store privacy steps');
  assert((admobSetupHandoff.productionTestPlan ?? []).length >= 5, 'AdMob setup handoff should include production test steps');
  sameSet(admobSetupHandoff.verificationOrder ?? [], expectedVerificationCommands, 'AdMob setup handoff verification order');

  for (const reference of [
    'https://docs.expo.dev/versions/v56.0.0/',
    'https://developers.google.com/admob/ios/privacy/data-disclosure',
    'https://developers.google.com/admob/ios/test-ads',
    'https://developers.google.com/admob/android/test-ads',
  ]) {
    assert((admobSetupHandoff.officialReferences ?? []).some((entry) => entry.url === reference), `AdMob setup handoff should link ${reference}`);
  }

  for (const snippet of [
    '# AdMob Setup Handoff',
    'Local ad integration ready: Yes',
    'Required AdMob Values',
    'Manual Confirmations',
    'AdMob Console Plan',
    'App Store Privacy Plan',
    'Production Test Plan',
    'APP_STORE_PRIVACY_ANSWERS_REVIEWED',
    'ADMOB_PRIVACY_MESSAGES_CONFIGURED',
    'PRODUCTION_DEVICE_TESTED',
    'eas env:create',
    'npm run ads:handoff',
  ]) {
    assert(admobSetupHandoffDoc.includes(snippet), `AdMob setup handoff markdown missing: ${snippet}`);
  }
}

function verifyDataFlowPrivacyAudit() {
  assert(dataFlowPrivacyAudit.schemaVersion === 1, 'Data flow privacy audit schemaVersion should be 1');
  assert(dataFlowPrivacyAudit.source === 'scripts/generate-data-flow-privacy-audit.js', 'Data flow privacy audit should name its generator');
  assert(dataFlowPrivacyAudit.generatedFrom?.appConfig === 'app.json + app.config.js', 'Data flow privacy audit should reference Expo config sources');
  assert(dataFlowPrivacyAudit.generatedFrom?.packageJson === 'package.json', 'Data flow privacy audit should reference package.json');
  assert(dataFlowPrivacyAudit.generatedFrom?.storage === 'src/storage.ts', 'Data flow privacy audit should reference storage module');
  assert(dataFlowPrivacyAudit.generatedFrom?.privacyManifestAudit === 'docs/privacy-manifest-audit.json', 'Data flow privacy audit should reference privacy manifest audit');
  assert(dataFlowPrivacyAudit.generatedFrom?.privacyAnswers === 'docs/app-store-privacy-answers.json', 'Data flow privacy audit should reference privacy answers');
  assert(dataFlowPrivacyAudit.generatedFrom?.admobReleaseAudit === 'docs/admob-release-audit.json', 'Data flow privacy audit should reference AdMob release audit');
  sameSet(dataFlowPrivacyAudit.generatedFrom?.runtimeSources ?? [], [
    'App.tsx',
    'src/ads.native.ts',
    'src/ads.ts',
    'src/ads.web.ts',
    'src/bgm.ts',
    'src/gameData.ts',
    'src/grammarData.ts',
    'src/gameEngine.ts',
    'src/i18n.ts',
    'src/storage.ts',
  ], 'Data flow privacy audit runtime sources');
  assert(dataFlowPrivacyAudit.app?.name === appJson.name, 'Data flow privacy audit app name should match app config');
  assert(dataFlowPrivacyAudit.app?.version === appJson.version, 'Data flow privacy audit app version should match app config');
  assert(dataFlowPrivacyAudit.app?.bundleIdentifier === appJson.ios?.bundleIdentifier, 'Data flow privacy audit bundle ID should match app config');
  assert(dataFlowPrivacyAudit.summary?.risk === 'PASS', 'Data flow privacy audit should pass when runtime privacy posture is clean');
  assert(dataFlowPrivacyAudit.summary?.localReady === true, 'Data flow privacy audit should mark local posture ready');
  assert(dataFlowPrivacyAudit.summary?.appOwnedNetworkRequests === 0, 'Data flow privacy audit should find no app-owned network requests');
  assert(dataFlowPrivacyAudit.summary?.analyticsSdkCount === 0, 'Data flow privacy audit should find no analytics SDK');
  assert(dataFlowPrivacyAudit.summary?.authSdkCount === 0, 'Data flow privacy audit should find no auth SDK');
  assert(dataFlowPrivacyAudit.summary?.userContentEntryCount === 0, 'Data flow privacy audit should find no user-content entry');
  assert(dataFlowPrivacyAudit.summary?.sensitiveDependencyCount === 0, 'Data flow privacy audit should find no sensitive dependency');
  assert(dataFlowPrivacyAudit.summary?.localStorageKeys === 2, 'Data flow privacy audit should record two storage keys');
  assert(dataFlowPrivacyAudit.summary?.externalLinkEntryCount === 1, 'Data flow privacy audit should record one external link entry point');
  assert(dataFlowPrivacyAudit.summary?.appCodeCollectsPersonalData === false, 'Data flow privacy audit should record no app-code personal data collection');
  assert(dataFlowPrivacyAudit.summary?.accountRequired === false, 'Data flow privacy audit should record no account requirement');
  assert(dataFlowPrivacyAudit.summary?.userGeneratedContent === false, 'Data flow privacy audit should record no user-generated content');
  assert(dataFlowPrivacyAudit.summary?.analyticsEnabled === false, 'Data flow privacy audit should record no analytics');
  assert(dataFlowPrivacyAudit.summary?.localFailures === 0, 'Data flow privacy audit should have no local failures');
  assert((dataFlowPrivacyAudit.localFailures ?? []).length === 0, 'Data flow privacy audit localFailures should be empty');
  assert(dataFlowPrivacyAudit.dataFlow?.storage?.library === '@react-native-async-storage/async-storage', 'Data flow privacy audit should record AsyncStorage library');
  sameSet(dataFlowPrivacyAudit.dataFlow?.storage?.keys ?? [], ['@kana-sprint/progress-v1', '@kana-sprint/settings-v1'], 'Data flow privacy audit storage keys');
  sameSet(dataFlowPrivacyAudit.dataFlow?.storage?.operations ?? [], ['AsyncStorage.getItem', 'AsyncStorage.setItem', 'AsyncStorage.getItem', 'AsyncStorage.setItem'], 'Data flow privacy audit storage operations');
  assert(dataFlowPrivacyAudit.dataFlow?.storage?.localOnly === true, 'Data flow privacy audit should mark storage local-only');
  assert(dataFlowPrivacyAudit.dataFlow?.storage?.progressResetAvailable === true, 'Data flow privacy audit should record the Settings local progress reset control');
  assert((dataFlowPrivacyAudit.dataFlow?.network?.appOwnedHits ?? []).length === 0, 'Data flow privacy audit should have no app-owned network hits');
  assert(dataFlowPrivacyAudit.dataFlow?.network?.appOwnedNetworkReady === true, 'Data flow privacy audit app-owned network boundary should be ready');
  assert((dataFlowPrivacyAudit.dataFlow?.network?.userInitiatedExternalLinks ?? []).length === 1, 'Data flow privacy audit should record one user-initiated external link');
  assert(dataFlowPrivacyAudit.dataFlow?.network?.supportPrivacyLicenseLinksOnly === true, 'Data flow privacy audit should limit external links to support/privacy/licenses');
  assert(dataFlowPrivacyAudit.dataFlow?.ads?.currentState === admobReleaseAudit.summary?.currentState, 'Data flow privacy audit ad state should match AdMob audit');
  assert(dataFlowPrivacyAudit.dataFlow?.ads?.localAdIntegrationReady === true, 'Data flow privacy audit should record local ad integration readiness');
  assert(dataFlowPrivacyAudit.dataFlow?.ads?.externalAdSetupReady === admobReleaseAudit.summary?.externalReady, 'Data flow privacy audit external ad setup readiness should match AdMob audit');
  assert(dataFlowPrivacyAudit.capabilities?.accountFeatureReady === true, 'Data flow privacy audit should record no account feature');
  assert(dataFlowPrivacyAudit.capabilities?.analyticsReady === true, 'Data flow privacy audit should record no analytics feature');
  assert(dataFlowPrivacyAudit.capabilities?.userContentReady === true, 'Data flow privacy audit should record no user-content feature');
  assert(dataFlowPrivacyAudit.capabilities?.sensitiveApiReady === true, 'Data flow privacy audit should record sensitive APIs blocked or absent');
  assert((dataFlowPrivacyAudit.capabilities?.dependencies?.analyticsHits ?? []).length === 0, 'Data flow privacy audit analytics dependency hits should be empty');
  assert((dataFlowPrivacyAudit.capabilities?.dependencies?.authHits ?? []).length === 0, 'Data flow privacy audit auth dependency hits should be empty');
  assert((dataFlowPrivacyAudit.capabilities?.dependencies?.sensitiveDependencyHits ?? []).length === 0, 'Data flow privacy audit sensitive dependency hits should be empty');
  assert(dataFlowPrivacyAudit.capabilities?.androidBlockedPermissions?.includes('android.permission.RECORD_AUDIO'), 'Data flow privacy audit should record RECORD_AUDIO blocked');
  assert(dataFlowPrivacyAudit.capabilities?.microphonePermission === false, 'Data flow privacy audit should record microphone permission disabled');
  assert(dataFlowPrivacyAudit.capabilities?.recordAudioAndroid === false, 'Data flow privacy audit should record Android audio recording disabled');
  assert(dataFlowPrivacyAudit.privacyEvidence?.privacyManifestRisk === privacyManifestAudit.summary?.risk, 'Data flow privacy audit privacy manifest risk should match privacy audit');
  assert(dataFlowPrivacyAudit.privacyEvidence?.privacyManifestTracking === false, 'Data flow privacy audit should record no privacy manifest tracking');
  assert(dataFlowPrivacyAudit.privacyEvidence?.privacyManifestCollectedDataTypes === 0, 'Data flow privacy audit should record zero privacy manifest data types');
  assert(dataFlowPrivacyAudit.privacyEvidence?.privacyAnswersRisk === privacyAnswers.summary?.risk, 'Data flow privacy audit privacy answer risk should match privacy answers');
  assert(dataFlowPrivacyAudit.privacyEvidence?.privacyAnswersCurrentState === privacyAnswers.summary?.currentState, 'Data flow privacy audit privacy state should match privacy answers');
  assert(dataFlowPrivacyAudit.privacyEvidence?.appCodeCollectsPersonalData === false, 'Data flow privacy audit should record no app-code personal data collection evidence');
  assert(dataFlowPrivacyAudit.privacyEvidence?.accountRequired === false, 'Data flow privacy audit should record no account requirement evidence');
  assert(dataFlowPrivacyAudit.privacyEvidence?.trackingDeclaredByAppCode === false, 'Data flow privacy audit should record no app-code tracking evidence');
  assert((dataFlowPrivacyAudit.checks ?? []).length >= 9, 'Data flow privacy audit should include checks');
  assert((dataFlowPrivacyAudit.checks ?? []).some((entry) => entry.id === 'local-progress-reset' && entry.passed === true), 'Data flow privacy audit should include a passing local-progress-reset check');
  assert((dataFlowPrivacyAudit.checks ?? []).every((entry) => entry.passed === true), 'Data flow privacy audit checks should pass');
  assert((dataFlowPrivacyAudit.commands ?? []).includes('npm run privacy:data-flow'), 'Data flow privacy audit should list its own command');
  assert((dataFlowPrivacyAudit.commands ?? []).includes('npm run release:verify'), 'Data flow privacy audit should list release verification command');

  for (const reference of [
    'https://developer.apple.com/app-store/app-privacy-details/',
    'https://developer.apple.com/documentation/bundleresources/privacy-manifest-files',
    'https://docs.expo.dev/versions/v56.0.0/',
  ]) {
    assert((dataFlowPrivacyAudit.officialReferences ?? []).some((entry) => entry.url === reference), `Data flow privacy audit should link ${reference}`);
  }

  for (const snippet of [
    '# Data Flow Privacy Audit',
    'Local data-flow posture ready: Yes',
    'App-owned network request hits: 0',
    'Analytics SDK hits: 0',
    'Auth/account SDK hits: 0',
    'User-content entry hits: 0',
    'Local Storage',
    '@kana-sprint/progress-v1',
    '@kana-sprint/settings-v1',
    'Network Boundary',
    'Ads Boundary',
    'npm run privacy:data-flow',
  ]) {
    assert(dataFlowPrivacyAuditDoc.includes(snippet), `Data flow privacy audit markdown missing: ${snippet}`);
  }
}

function verifyPrivacyReviewPacket() {
  assert(privacyReviewPacket.schemaVersion === 1, 'Privacy review packet schemaVersion should be 1');
  assert(privacyReviewPacket.source === 'scripts/generate-privacy-review-packet.js', 'Privacy review packet should name its generator');
  assert(privacyReviewPacket.generatedFrom?.appConfig === 'app.json', 'Privacy review packet should reference app.json');
  assert(privacyReviewPacket.generatedFrom?.packageJson === 'package.json', 'Privacy review packet should reference package.json');
  assert(privacyReviewPacket.generatedFrom?.privacyAnswers === 'docs/app-store-privacy-answers.json', 'Privacy review packet should reference privacy answers');
  assert(privacyReviewPacket.generatedFrom?.privacyManifestAudit === 'docs/privacy-manifest-audit.json', 'Privacy review packet should reference privacy manifest audit');
  assert(privacyReviewPacket.generatedFrom?.dataFlowPrivacyAudit === 'docs/data-flow-privacy-audit.json', 'Privacy review packet should reference data flow privacy audit');
  assert(privacyReviewPacket.generatedFrom?.admobReleaseAudit === 'docs/admob-release-audit.json', 'Privacy review packet should reference AdMob release audit');
  assert(privacyReviewPacket.generatedFrom?.officialApplePrivacy === 'https://developer.apple.com/app-store/app-privacy-details/', 'Privacy review packet should link Apple app privacy details');
  assert(privacyReviewPacket.generatedFrom?.officialGoogleAdMobDisclosure === 'https://developers.google.com/admob/ios/privacy/data-disclosure', 'Privacy review packet should link Google AdMob data disclosure docs');
  assert(privacyReviewPacket.app?.name === appJson.name, 'Privacy review packet app name should match app config');
  assert(privacyReviewPacket.app?.version === appJson.version, 'Privacy review packet app version should match app config');
  assert(privacyReviewPacket.app?.bundleIdentifier === appJson.ios?.bundleIdentifier, 'Privacy review packet bundle ID should match app config');
  assert(privacyReviewPacket.app?.expo === packageJson.dependencies?.expo, 'Privacy review packet should record Expo package version');
  assert(privacyReviewPacket.app?.googleMobileAdsPackage === packageJson.dependencies?.['react-native-google-mobile-ads'], 'Privacy review packet should record Google Mobile Ads package version');

  assert(privacyReviewPacket.summary?.risk === 'PASS', 'Privacy review packet should pass when local privacy evidence is clean');
  assert(privacyReviewPacket.summary?.localReady === true, 'Privacy review packet should mark local evidence ready');
  assert(privacyReviewPacket.summary?.currentState === privacyAnswers.summary?.currentState, 'Privacy review packet current state should match privacy answers');
  assert(privacyReviewPacket.summary?.confirmationEnv === 'APP_STORE_PRIVACY_ANSWERS_REVIEWED', 'Privacy review packet should record privacy confirmation env');
  assert(privacyReviewPacket.summary?.finalReviewConfirmed === (process.env.APP_STORE_PRIVACY_ANSWERS_REVIEWED === '1'), 'Privacy review packet final confirmation should match env');
  assert(privacyReviewPacket.summary?.noLiveAdsSuggestedRows === (privacyAnswers.noLiveAdsAnswers?.appStoreConnect ?? []).length, 'Privacy review packet no-live row count should match privacy answers');
  assert(privacyReviewPacket.summary?.liveAdMobDisclosureRows === (privacyAnswers.liveAdMobAnswers?.likelyGoogleMobileAdsDataTypes ?? []).length, 'Privacy review packet live-AdMob row count should match privacy answers');
  assert(privacyReviewPacket.summary?.appCodeCollectsPersonalData === false, 'Privacy review packet should record no app-code personal data collection');
  assert(privacyReviewPacket.summary?.accountRequired === false, 'Privacy review packet should record no account requirement');
  assert(privacyReviewPacket.summary?.trackingDeclaredByAppCode === false, 'Privacy review packet should record no app-code tracking');
  assert(privacyReviewPacket.summary?.privacyManifestTracking === false, 'Privacy review packet should record no privacy manifest tracking');
  assert(privacyReviewPacket.summary?.privacyManifestCollectedDataTypes === 0, 'Privacy review packet should record zero privacy manifest collected data types');
  assert(privacyReviewPacket.summary?.requiredReasonApisReady === true, 'Privacy review packet should record required reason APIs ready');
  assert(privacyReviewPacket.summary?.appOwnedNetworkRequests === 0, 'Privacy review packet should record zero app-owned network requests');
  assert(privacyReviewPacket.summary?.analyticsSdkCount === 0, 'Privacy review packet should record zero analytics SDK hits');
  assert(privacyReviewPacket.summary?.authSdkCount === 0, 'Privacy review packet should record zero auth SDK hits');
  assert(privacyReviewPacket.summary?.userContentEntryCount === 0, 'Privacy review packet should record zero user-content entries');
  assert(privacyReviewPacket.summary?.admobCurrentState === admobReleaseAudit.summary?.currentState, 'Privacy review packet AdMob state should match AdMob audit');
  assert(privacyReviewPacket.summary?.liveAdsReady === admobReleaseAudit.summary?.liveAdsReady, 'Privacy review packet live ads readiness should match AdMob audit');
  assert(privacyReviewPacket.summary?.externalAdSetupReady === admobReleaseAudit.summary?.externalReady, 'Privacy review packet external AdMob readiness should match AdMob audit');
  assert(privacyReviewPacket.summary?.localFailures === 0, 'Privacy review packet should have zero local failures');

  assert(privacyReviewPacket.noLiveAdsSubmission?.applicable === (privacyAnswers.summary?.currentState === 'NO_LIVE_ADS'), 'Privacy review packet no-live applicability should match current state');
  assert((privacyReviewPacket.noLiveAdsSubmission?.suggestedAppStoreConnectRows ?? []).length === (privacyAnswers.noLiveAdsAnswers?.appStoreConnect ?? []).length, 'Privacy review packet should include all no-live privacy rows');
  assert((privacyReviewPacket.noLiveAdsSubmission?.reviewerExplanation ?? '').includes('daily goal progress'), 'Privacy review packet should include no-live daily goal progress explanation');
  assert(privacyReviewPacket.liveAdMobSubmission?.manualReviewRequired === true, 'Privacy review packet should require manual live-AdMob review');
  sameSet(
    (privacyReviewPacket.liveAdMobSubmission?.likelyGoogleMobileAdsDataTypes ?? []).map((row) => row.appleDataType),
    ['Coarse Location', 'Crash Data', 'Performance Data', 'Device ID', 'Advertising Data', 'Product Interaction'],
    'Privacy review packet live-AdMob disclosure rows',
  );
  assert((privacyReviewPacket.checks ?? []).length >= 7, 'Privacy review packet should include local checks');
  assert((privacyReviewPacket.checks ?? []).every((entry) => entry.passed === true), 'Privacy review packet local checks should pass');
  for (const evidencePath of [
    'docs/app-store-privacy-answers.md',
    'docs/privacy-manifest-audit.md',
    'docs/data-flow-privacy-audit.md',
    'docs/admob-release-audit.md',
    'docs/external-readiness.md',
  ]) {
    assert((privacyReviewPacket.evidenceFiles ?? []).some((entry) => entry.path === evidencePath && entry.exists === true), `Privacy review packet missing evidence: ${evidencePath}`);
  }

  for (const snippet of [
    '# Privacy Review Packet',
    'Local privacy evidence ready: Yes',
    `Current build state: ${privacyAnswers.summary?.currentState}`,
    'Final App Store privacy review confirmed:',
    'App Store Connect Privacy Answers',
    'Current no-live-ads posture',
    'Live AdMob Build Review',
    'Likely Google Mobile Ads rows',
    'APP_STORE_PRIVACY_ANSWERS_REVIEWED',
    'npm run privacy:review-packet',
  ]) {
    assert(privacyReviewPacketDoc.includes(snippet), `Privacy review packet markdown missing: ${snippet}`);
  }
}

function verifyRuntimeUiFlowAudit() {
  const requiredCheckIds = [
    'first-playable-screen',
    'difficulty-selector',
    'level-mastery-map',
    'weak-review-retention',
    'next-step-guidance',
    'achievement-milestones',
    'session-mission-retention',
    'daily-goal-retention',
    'mode-selector',
    'playing-loop',
    'answer-study-hint',
    'exit-run',
    'finish-loop',
    'finish-learning-recap',
    'settings-language',
    'settings-local-data-reset',
    'settings-compliance-links',
    'settings-audio',
    'rewarded-ad-entry',
    'daily-streak-retention',
    'release-runtime-boundary',
  ];

  assert(runtimeUiFlowAudit.schemaVersion === 1, 'Runtime UI flow audit schemaVersion should be 1');
  assert(runtimeUiFlowAudit.source === 'scripts/generate-runtime-ui-flow-audit.js', 'Runtime UI flow audit should name its generator');
  sameSet(runtimeUiFlowAudit.generatedFrom?.runtimeSources ?? [], [
    'App.tsx',
    'src/ads.native.ts',
    'src/ads.ts',
    'src/ads.web.ts',
    'src/bgm.ts',
    'src/gameData.ts',
    'src/grammarData.ts',
    'src/gameEngine.ts',
    'src/i18n.ts',
    'src/storage.ts',
  ], 'Runtime UI flow audit runtime sources');
  assert(runtimeUiFlowAudit.generatedFrom?.gameplayContract === 'scripts/check-gameplay-contract.js', 'Runtime UI flow audit should reference gameplay contract');
  assert(runtimeUiFlowAudit.generatedFrom?.releaseStatus === 'scripts/release-status.js', 'Runtime UI flow audit should reference release status');
  assert(runtimeUiFlowAudit.posture?.statement?.includes('playable game surface'), 'Runtime UI flow audit should state the playable first-surface posture');
  assert(runtimeUiFlowAudit.posture?.releaseAction?.includes('submitting for review'), 'Runtime UI flow audit should include a release action');
  assert(runtimeUiFlowAudit.summary?.risk === 'PASS', 'Runtime UI flow audit should pass before release');
  assert(runtimeUiFlowAudit.summary?.localReady === true, 'Runtime UI flow audit should mark local runtime UI ready');
  assert(runtimeUiFlowAudit.summary?.locales === expectedLocales.length, 'Runtime UI flow audit locale count should match expected locales');
  assert(runtimeUiFlowAudit.summary?.levels === expectedJlptLevels.length, 'Runtime UI flow audit level count should match expected levels');
  assert(runtimeUiFlowAudit.summary?.modes === 5, 'Runtime UI flow audit should record five game modes');
  assert(runtimeUiFlowAudit.summary?.phases === 3, 'Runtime UI flow audit should record three runtime phases');
  assert(runtimeUiFlowAudit.summary?.bgmTracks === 3, 'Runtime UI flow audit should record three BGM tracks');
  assert(runtimeUiFlowAudit.summary?.hasJapaneseUiLocale === false, 'Runtime UI flow audit should record no Japanese UI locale');
  assert(runtimeUiFlowAudit.summary?.checks === requiredCheckIds.length, 'Runtime UI flow audit check count should match required flows');
  assert(runtimeUiFlowAudit.summary?.passedChecks === requiredCheckIds.length, 'Runtime UI flow audit should pass all required flows');
  assert(runtimeUiFlowAudit.summary?.requiredFlowFailures === 0, 'Runtime UI flow audit should have zero required flow failures');
  assert(runtimeUiFlowAudit.app?.firstScreen === 'ready', 'Runtime UI flow audit first screen should be ready');
  sameSet(runtimeUiFlowAudit.app?.phases ?? [], ['ready', 'playing', 'finished'], 'Runtime UI flow audit phases');
  sameSet(runtimeUiFlowAudit.app?.locales ?? [], expectedLocales, 'Runtime UI flow audit locales');
  sameSet(runtimeUiFlowAudit.app?.levels ?? [], expectedJlptLevels, 'Runtime UI flow audit levels');
  sameSet(runtimeUiFlowAudit.app?.modes ?? [], ['mix', 'kana', 'vocab', 'lines', 'grammar'], 'Runtime UI flow audit modes');
  sameSet(runtimeUiFlowAudit.app?.bgmTracks ?? [], ['rush', 'focus', 'night'], 'Runtime UI flow audit BGM tracks');
  assert(runtimeUiFlowAudit.app?.noAccountRequired === true, 'Runtime UI flow audit should record no account requirement');
  assert(runtimeUiFlowAudit.app?.dailyGoalAvailable === true, 'Runtime UI flow audit should record daily run goal availability');
  assert(runtimeUiFlowAudit.app?.sessionMissionAvailable === true, 'Runtime UI flow audit should record run mission availability');
  assert(runtimeUiFlowAudit.app?.weakReviewAvailable === true, 'Runtime UI flow audit should record weak-item review availability');
  assert(runtimeUiFlowAudit.app?.settingsOwnsLanguageSwitching === true, 'Runtime UI flow audit should record Settings owns language switching');
  assert(runtimeUiFlowAudit.app?.localProgressResetAvailable === true, 'Runtime UI flow audit should record Settings local progress reset availability');
  sameSet((runtimeUiFlowAudit.checks ?? []).map((entry) => entry.id), requiredCheckIds, 'Runtime UI flow audit check ids');
  assert((runtimeUiFlowAudit.checks ?? []).every((entry) => entry.passed === true), 'Runtime UI flow audit checks should pass');
  assert((runtimeUiFlowAudit.failures ?? []).length === 0, 'Runtime UI flow audit failures should be empty');
  assert((runtimeUiFlowAudit.commands ?? []).includes('npm run runtime:ui-flow'), 'Runtime UI flow audit should list its own command');
  assert((runtimeUiFlowAudit.commands ?? []).includes('npm run gameplay-check'), 'Runtime UI flow audit should list gameplay contract command');
  assert((runtimeUiFlowAudit.commands ?? []).includes('npm run release:verify'), 'Runtime UI flow audit should list release verification command');

  for (const snippet of [
    '# Runtime UI Flow Audit',
    'Local runtime UI ready: Yes',
    'Japanese UI locale present: No',
    'Language switching owned by Settings: Yes',
    'first-playable-screen',
    'level-mastery-map',
    'weak-review-retention',
    'next-step-guidance',
    'achievement-milestones',
    'session-mission-retention',
    'daily-goal-retention',
    'Daily run goal available: Yes',
    'Run missions available: Yes',
    'answer-study-hint',
    'Weak-item review available: Yes',
    'finish-learning-recap',
    'settings-language',
    'settings-local-data-reset',
    'settings-compliance-links',
    'rewarded-ad-entry',
    'daily-streak-retention',
    'release-runtime-boundary',
    'npm run runtime:ui-flow',
  ]) {
    assert(runtimeUiFlowAuditDoc.includes(snippet), `Runtime UI flow audit markdown missing: ${snippet}`);
  }
}

function verifyProductionDeviceSmokeTest() {
  const totalScreenshotEntries =
    (screenshotManifest.defaultPack?.screenshots ?? []).length +
    (screenshotManifest.localizedPacks ?? []).reduce((sum, pack) => sum + (pack.screenshots?.length ?? 0), 0);
  const sections = productionSmokeTest.sections ?? [];
  const items = sections.flatMap((section) => section.items ?? []);
  const currentStatus = readReleaseStatusJson();
  const productionDeviceRow = (currentStatus.rows ?? []).find((row) => row.label === 'PRODUCTION_DEVICE_TESTED');

  assert(productionSmokeTest.schemaVersion === 1, 'Production device smoke test schemaVersion should be 1');
  assert(productionSmokeTest.source === 'scripts/generate-production-device-smoke-test.js', 'Production device smoke test should name its generator');
  assert(productionSmokeTest.generatedFrom?.releaseStatus === 'scripts/release-status.js --json', 'Production device smoke test should record release-status source');
  assert(productionSmokeTest.app?.name === appJson.name, 'Production device smoke test app name should match app.json');
  assert(productionSmokeTest.app?.version === appJson.version, 'Production device smoke test app version should match app.json');
  assert(productionSmokeTest.app?.bundleIdentifier === appJson.ios?.bundleIdentifier, 'Production device smoke test bundle ID should match app.json');
  assert(productionSmokeTest.app?.buildNumber === appJson.ios?.buildNumber, 'Production device smoke test build number should match app.json');
  sameSet(productionSmokeTest.evidence?.uiLocales ?? [], expectedLocales, 'Production device smoke test UI locales');
  sameSet(productionSmokeTest.evidence?.appStoreLocales ?? [], Object.values(expectedAppleLocales), 'Production device smoke test App Store locales');
  assert(productionSmokeTest.evidence?.japaneseUiLocaleRemoved === true, 'Production device smoke test should record that Japanese UI locale is removed');
  assert(productionSmokeTest.evidence?.screenshotEntries === totalScreenshotEntries, 'Production device smoke test screenshot entry count should match manifest');
  assert(productionSmokeTest.evidence?.publicSitePages === publicSiteManifest.pageCount, 'Production device smoke test public site count should match manifest');
  assert(productionSmokeTest.evidence?.runtimePngAssets === runtimeAssetManifest.summary?.pngCount, 'Production device smoke test runtime PNG count should match manifest');
  assert(productionSmokeTest.evidence?.bgmTracks === runtimeAssetManifest.summary?.audioCount, 'Production device smoke test BGM count should match manifest');
  assert(productionSmokeTest.evidence?.demoAccountRequired === false, 'Production device smoke test should state no demo account is required');
  assert(productionSmokeTest.evidence?.signInRequired === false, 'Production device smoke test should state sign-in is not required');
  assert(productionSmokeTest.evidence?.productionDeviceStatus === productionDeviceRow?.status, 'Production device smoke test should mirror PRODUCTION_DEVICE_TESTED status');
  assert(productionSmokeTest.finalConfirmation?.env === 'PRODUCTION_DEVICE_TESTED', 'Production device smoke test final confirmation env should be PRODUCTION_DEVICE_TESTED');
  assert(productionSmokeTest.finalConfirmation?.setTo === '1', 'Production device smoke test final confirmation value should be 1');
  assert((productionSmokeTest.prerequisites ?? []).includes('Run npm run release:verify on the same workspace state that will be built.'), 'Production device smoke test should require release:verify');
  assert(sections.length >= 7, 'Production device smoke test should include the main test sections');
  assert(items.length >= 25, 'Production device smoke test should include a substantial manual checklist');
  assert(items.filter((item) => item.priority === 'P0').length >= 15, 'Production device smoke test should include enough P0 checks');

  for (const expectedSection of ['install-launch', 'localization', 'gameplay', 'settings-assets', 'ads-privacy', 'offline-restart', 'store-review']) {
    assert(sections.some((section) => section.id === expectedSection), `Production device smoke test missing section: ${expectedSection}`);
  }

  for (const expectedItem of ['exit-run', 'answer-study-hint', 'run-mission', 'next-step-guidance', 'achievement-milestones', 'finish-learning-recap', 'all-levels', 'settings-language-switch', 'bgm-toggle', 'ad-enabled-build', 'offline-practice', 'content-rights']) {
    assert(items.some((item) => item.id === expectedItem), `Production device smoke test missing item: ${expectedItem}`);
  }

  for (const snippet of [
    '# Production Device Smoke Test',
    'Current device-test status',
    'Install And First Launch',
    'Localization',
    'Gameplay Loop',
    'Rewarded Ads And Privacy',
    'daily goal progress',
    'Set `PRODUCTION_DEVICE_TESTED=1` only after',
  ]) {
    assert(productionSmokeTestDoc.includes(snippet), `Production device smoke test markdown missing: ${snippet}`);
  }
}

function verifyExternalReadiness() {
  const currentStatus = readReleaseStatusJson();
  const externalRows = (currentStatus.rows ?? []).filter((row) => row.category === 'external');
  const items = externalReadiness.items ?? [];
  const blockingItems = items.filter((item) => item.blocking);

  assert(externalReadiness.schemaVersion === 1, 'External readiness schemaVersion should be 1');
  assert(externalReadiness.source === 'scripts/generate-external-readiness.js', 'External readiness should name its generator');
  assert(externalReadiness.generatedFrom?.releaseStatus === 'scripts/release-status.js --json', 'External readiness should record the release-status source');
  assert(externalReadiness.generatedFrom?.envTemplate === '.env.example', 'External readiness should reference .env.example');
  assert(externalReadiness.summary?.total === items.length, 'External readiness total should match items length');
  assert(externalReadiness.summary?.ok === items.filter((item) => item.status === 'OK').length, 'External readiness OK count should match item rows');
  assert(externalReadiness.summary?.todo === items.filter((item) => item.status === 'TODO').length, 'External readiness TODO count should match item rows');
  assert(externalReadiness.summary?.bad === items.filter((item) => item.status === 'BAD').length, 'External readiness BAD count should match item rows');
  assert(externalReadiness.summary?.info === items.filter((item) => item.status === 'INFO').length, 'External readiness INFO count should match item rows');
  assert(externalReadiness.summary?.blocking === blockingItems.length, 'External readiness blocking count should match item rows');
  assert(externalReadiness.summary?.blocking === externalRows.filter((row) => row.status === 'TODO' || row.status === 'BAD').length, 'External readiness blocking count should match current external release-status rows');
  sameSet(items.map((item) => item.label), externalRows.map((row) => row.label), 'External readiness labels');

  for (const item of items) {
    const statusRow = externalRows.find((row) => row.label === item.label);

    assert(Boolean(statusRow), `External readiness item is not backed by release-status: ${item.label}`);
    assert(item.status === statusRow?.status, `External readiness status mismatch for ${item.label}`);
    assert(item.detail === statusRow?.detail, `External readiness detail mismatch for ${item.label}`);
    assert(typeof item.id === 'string' && item.id.length > 0, `External readiness item ${item.label} should have an id`);
    assert(typeof item.system === 'string' && item.system.length > 0, `External readiness item ${item.label} should name the external system`);
    assert(Array.isArray(item.env) && item.env.length > 0, `External readiness item ${item.label} should list env keys`);
    assert(typeof item.action === 'string' && item.action.length > 30, `External readiness item ${item.label} should describe the required action`);
    assert(typeof item.evidence === 'string' && item.evidence.length > 20, `External readiness item ${item.label} should describe evidence`);
    assert(Array.isArray(item.verification) && item.verification.length > 0, `External readiness item ${item.label} should list verification commands`);

    if (item.label === 'Public support URL' || item.label === 'Public privacy URL') {
      assert(item.verification.includes('npm run site:deploy-audit'), `${item.label} should verify the public site deploy audit`);
      assert(item.verification.includes('npm run site:verify-hosting'), `${item.label} should verify live public site hosting`);
    }
  }

  for (const snippet of [
    '# External Readiness Checklist',
    'Blocking external items',
    'Public support URL',
    'npm run site:deploy-audit',
    'npm run site:verify-hosting',
    'Live AdMob IDs',
    'APP_STORE_PRIVACY_ANSWERS_REVIEWED',
    'PRODUCTION_DEVICE_TESTED',
    'npm run release:store-ready',
  ]) {
    assert(externalReadinessDoc.includes(snippet), `External readiness markdown missing: ${snippet}`);
  }
}

function verifyEasEnvChecklist() {
  const envKeys = envExampleKeys();
  const keys = easEnvChecklist.keys ?? [];
  const keyByName = Object.fromEntries(keys.map((item) => [item.key, item]));
  const currentStatusByLabel = Object.fromEntries((readReleaseStatusJson().rows ?? []).map((row) => [row.label, row]));
  const expectedProductionKeys = [
    'EXPO_PUBLIC_ADMOB_IOS_APP_ID',
    'EXPO_PUBLIC_ADMOB_ANDROID_APP_ID',
    'EXPO_PUBLIC_ADMOB_REWARDED_IOS_UNIT_ID',
    'EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_UNIT_ID',
    'APP_STORE_BASE_URL',
    'APP_STORE_SUPPORT_URL',
    'APP_STORE_PRIVACY_URL',
  ];
  const expectedSensitiveKeys = [
    ...adEnvKeys,
    ...expectedReviewEnvKeys,
  ];
  const expectedPlaintextKeys = envKeys.filter((key) => !expectedSensitiveKeys.includes(key));
  const expectedManualKeys = [
    'APP_STORE_PRIVACY_ANSWERS_REVIEWED',
    ...Object.keys(requiredStoreConfirmationEnv),
  ];

  assert(easEnvChecklist.schemaVersion === 1, 'EAS environment checklist schemaVersion should be 1');
  assert(easEnvChecklist.source === 'scripts/generate-eas-env-checklist.js', 'EAS environment checklist should name its generator');
  assert(easEnvChecklist.generatedFrom?.envTemplate === '.env.example', 'EAS environment checklist should reference .env.example');
  assert(easEnvChecklist.generatedFrom?.easJson === 'eas.json', 'EAS environment checklist should reference eas.json');
  assert(easEnvChecklist.generatedFrom?.releaseStatus === 'scripts/release-status.js --json', 'EAS environment checklist should reference release-status');
  assert(easEnvChecklist.generatedFrom?.expoDocs === 'https://docs.expo.dev/eas/environment-variables/', 'EAS environment checklist should reference Expo EAS environment docs');
  assert(easEnvChecklist.eas?.productionBuildProfile?.environment === 'production', 'EAS environment checklist should record the production build environment');
  assert(easEnvChecklist.eas?.productionBuildProfile?.ready === true, 'EAS environment checklist production profile should be ready');
  assert(easEnvChecklist.eas?.productionBuildProfile?.autoIncrement === true, 'EAS environment checklist should record production autoIncrement');
  assert(easEnvChecklist.summary?.totalKeys === envKeys.length, 'EAS environment checklist total key count should match .env.example');
  assert(easEnvChecklist.summary?.requiredForEasProduction === expectedProductionKeys.length, 'EAS environment checklist production key count should match expected build-time keys');
  assert(easEnvChecklist.summary?.clientVisible === 8, 'EAS environment checklist client-visible key count should include AdMob and public URL keys');
  assert(easEnvChecklist.summary?.sensitive === expectedSensitiveKeys.length, 'EAS environment checklist sensitive key count should match AdMob and review contact keys');
  assert(easEnvChecklist.summary?.plaintext === expectedPlaintextKeys.length, 'EAS environment checklist plaintext key count should match public URL and manual flag keys');
  assert(easEnvChecklist.summary?.missingDefinitions === 0, 'EAS environment checklist should define every .env.example key');
  assert(easEnvChecklist.summary?.productionProfileEnvironmentReady === true, 'EAS environment checklist should report production profile ready');
  sameSet(keys.map((item) => item.key), envKeys, 'EAS environment checklist keys');
  sameSet(keys.filter((item) => item.requiredForEasProduction).map((item) => item.key), expectedProductionKeys, 'EAS environment production keys');
  sameSet(keys.filter((item) => item.visibility === 'sensitive').map((item) => item.key), expectedSensitiveKeys, 'EAS environment sensitive keys');
  sameSet(keys.filter((item) => item.visibility === 'plaintext').map((item) => item.key), expectedPlaintextKeys, 'EAS environment plaintext keys');
  sameSet(keys.filter((item) => item.group === 'Manual release confirmations').map((item) => item.key), expectedManualKeys, 'EAS environment manual confirmation keys');

  for (const item of keys) {
    assert(typeof item.group === 'string' && item.group.length > 0, `EAS environment key ${item.key} should have a group`);
    assert(typeof item.easLocation === 'string' && item.easLocation.length > 0, `EAS environment key ${item.key} should describe where to set it`);
    assert(['plaintext', 'sensitive'].includes(item.visibility), `EAS environment key ${item.key} should use plaintext or sensitive visibility`);
    assert(Array.isArray(item.usedBy) && item.usedBy.length > 0, `EAS environment key ${item.key} should list usage sites`);
    assert(Array.isArray(item.releaseStatuses) && item.releaseStatuses.length > 0, `EAS environment key ${item.key} should link release-status rows`);

    for (const row of item.releaseStatuses) {
      const current = currentStatusByLabel[row.label];

      assert(Boolean(current), `EAS environment key ${item.key} references missing release-status row: ${row.label}`);
      assert(row.status === current?.status, `EAS environment status mismatch for ${item.key} / ${row.label}`);
      assert(row.detail === current?.detail, `EAS environment detail mismatch for ${item.key} / ${row.label}`);
    }
  }

  for (const key of adEnvKeys) {
    assert(keyByName[key]?.visibility === 'sensitive', `${key} should use sensitive EAS visibility`);
    assert(keyByName[key]?.clientVisible === true, `${key} should be documented as client-visible after bundling`);
    assert(keyByName[key]?.validation?.includes('ca-app-pub-0000000000000000'), `${key} should document the AdMob ID format`);
  }

  for (const key of expectedReviewEnvKeys) {
    assert(keyByName[key]?.visibility === 'sensitive', `${key} should use sensitive EAS visibility`);
    assert(keyByName[key]?.clientVisible === false, `${key} should not be documented as client-visible`);
  }

  for (const key of expectedManualKeys) {
    assert(keyByName[key]?.visibility === 'plaintext', `${key} should use plaintext visibility because it is a non-secret release gate`);
    assert(keyByName[key]?.validation?.includes('Set to 1 only after'), `${key} should explain the manual confirmation rule`);
  }

  assert((easEnvChecklist.officialReferences ?? []).some((entry) => entry.url === 'https://docs.expo.dev/versions/v56.0.0/'), 'EAS environment checklist should link the Expo SDK 56 docs');
  assert((easEnvChecklist.officialReferences ?? []).some((entry) => entry.url === 'https://docs.expo.dev/eas/environment-variables/'), 'EAS environment checklist should link EAS environment variable docs');

  for (const snippet of [
    '# EAS Environment Checklist',
    'build.production.environment',
    'Required for EAS production build',
    'Client-visible values should not use EAS secret visibility',
    'eas env:create',
    'EXPO_PUBLIC_ADMOB_IOS_APP_ID',
    'APP_STORE_BASE_URL',
    'PRODUCTION_DEVICE_TESTED',
  ]) {
    assert(easEnvChecklistDoc.includes(snippet), `EAS environment checklist markdown missing: ${snippet}`);
  }
}

function verifyStoreSubmissionInputPack() {
  const envKeys = envExampleKeys();
  const template = storeSubmissionInputPack.envLocalTemplate ?? [];
  const templateKeys = template.map((item) => item.key);
  const templateByName = Object.fromEntries(template.map((item) => [item.key, item]));
  const expectedEnvTemplateText = `${renderExpectedEnvTemplate(template)}\n`;
  const duplicateTemplateKeys = templateKeys.filter((key, index, all) => all.indexOf(key) !== index);
  const currentStatus = readReleaseStatusJson();
  const currentStatusByLabel = Object.fromEntries((currentStatus.rows ?? []).map((row) => [row.label, row]));
  const generatedStatusLabels = ['Store submission input pack', 'Final launch runbook', 'App Store handoff bundle'];
  const localRows = (currentStatus.rows ?? []).filter(
    (row) => row.category === 'local' && !generatedStatusLabels.includes(row.label),
  );
  const expectedProductionKeys = (easEnvChecklist.keys ?? [])
    .filter((item) => item.requiredForEasProduction)
    .map((item) => item.key);
  const expectedManualKeys = (easEnvChecklist.keys ?? [])
    .filter((item) => item.group === 'Manual release confirmations')
    .map((item) => item.key);
  const expectedFieldLabels = [
    'Public support URL',
    'Public privacy URL',
    'Public marketing URL',
    'App Store review contact',
    'Live AdMob IDs',
  ];
  const productionCommands = storeSubmissionInputPack.easProductionCommands ?? [];
  const manualConfirmations = storeSubmissionInputPack.manualConfirmations ?? [];
  const appStoreConnectFields = storeSubmissionInputPack.appStoreConnectFields ?? [];
  const verificationCommands = storeSubmissionInputPack.verificationCommands ?? [];

  assert(storeSubmissionInputPack.schemaVersion === 1, 'Store submission input pack schemaVersion should be 1');
  assert(storeSubmissionInputPack.source === 'scripts/generate-store-submission-input-pack.js', 'Store submission input pack should name its generator');
  assert(storeSubmissionInputPack.generatedFrom?.envTemplate === '.env.example', 'Store submission input pack should reference .env.example');
  assert(storeSubmissionInputPack.generatedFrom?.externalReadiness === 'docs/external-readiness.json', 'Store submission input pack should reference external readiness');
  assert(storeSubmissionInputPack.generatedFrom?.easEnvironmentChecklist === 'docs/eas-env-checklist.json', 'Store submission input pack should reference EAS environment checklist');
  assert(storeSubmissionInputPack.generatedFrom?.releaseStatus === 'scripts/release-status.js --json', 'Store submission input pack should reference release-status');
  assert(storeSubmissionInputPack.outputs?.envLocalTemplate === 'docs/store-submission.env.template', 'Store submission input pack should expose standalone env template output');
  assert(storeSubmissionInputPack.envLocalTemplateFile?.path === 'docs/store-submission.env.template', 'Store submission input pack standalone env template path mismatch');
  assert(storeSubmissionInputPack.envLocalTemplateFile?.bytes === Buffer.byteLength(expectedEnvTemplateText), 'Store submission env template byte size mismatch');
  assert(storeSubmissionInputPack.envLocalTemplateFile?.sha256 === crypto.createHash('sha256').update(expectedEnvTemplateText).digest('hex'), 'Store submission env template hash mismatch');
  assert(storeSubmissionEnvTemplateDoc === expectedEnvTemplateText, 'Store submission standalone env template should match generated env block');
  assert(storeSubmissionInputPack.summary?.envKeys === envKeys.length, 'Store submission input pack env key count should match .env.example');
  assert(storeSubmissionInputPack.summary?.fillableEnvKeys === template.length, 'Store submission input pack fillable count should match template entries');
  assert(storeSubmissionInputPack.summary?.externalItems === externalReadiness.summary?.total, 'Store submission input pack external item count should match external readiness');
  assert(storeSubmissionInputPack.summary?.blockingExternalItems === externalReadiness.summary?.blocking, 'Store submission input pack blocker count should match external readiness');
  assert(storeSubmissionInputPack.summary?.easProductionKeys === easEnvChecklist.summary?.requiredForEasProduction, 'Store submission input pack EAS production key count should match EAS env checklist');
  assert(storeSubmissionInputPack.summary?.manualConfirmationKeys === expectedManualKeys.length, 'Store submission input pack manual confirmation count should match EAS env checklist');
  assert(storeSubmissionInputPack.summary?.localReady === (localRows.length > 0 && localRows.every((row) => row.status === 'OK')), 'Store submission input pack local readiness should match release-status');
  assert(duplicateTemplateKeys.length === 0, `Store submission input pack duplicate env keys: ${duplicateTemplateKeys.join(', ')}`);
  sameSet(templateKeys, envKeys, 'Store submission input pack env template keys');
  sameSet(productionCommands.map((item) => item.key), expectedProductionKeys, 'Store submission input pack EAS production command keys');
  sameSet(manualConfirmations.map((item) => item.key), expectedManualKeys, 'Store submission input pack manual confirmation keys');
  sameSet(appStoreConnectFields.map((item) => item.label), expectedFieldLabels, 'Store submission input pack App Store field labels');

  for (const entry of template) {
    const checklistEntry = (easEnvChecklist.keys ?? []).find((item) => item.key === entry.key);

    assert(Boolean(checklistEntry), `Store submission input pack key is not backed by EAS env checklist: ${entry.key}`);
    assert(entry.group === checklistEntry?.group, `Store submission input pack group mismatch for ${entry.key}`);
    assert(entry.requiredForEasProduction === Boolean(checklistEntry?.requiredForEasProduction), `Store submission input pack EAS production flag mismatch for ${entry.key}`);
    assert(entry.visibility === checklistEntry?.visibility, `Store submission input pack visibility mismatch for ${entry.key}`);
    assert(entry.validation === checklistEntry?.validation, `Store submission input pack validation mismatch for ${entry.key}`);
    assert(typeof entry.placeholder === 'string' && entry.placeholder.length > 0, `Store submission input pack ${entry.key} should include a placeholder`);
    assert(Array.isArray(entry.releaseStatuses), `Store submission input pack ${entry.key} should include releaseStatuses`);

    if (entry.group === 'Manual release confirmations') {
      assert(entry.value === '0', `Store submission input pack ${entry.key} should default manual confirmations to 0`);
    }
  }

  for (const command of productionCommands) {
    const templateEntry = templateByName[command.key];

    assert(Boolean(templateEntry), `Store submission input pack EAS command key missing from template: ${command.key}`);
    assert(command.visibility === templateEntry?.visibility, `Store submission input pack command visibility mismatch for ${command.key}`);
    assert(command.command === `eas env:create --name ${command.key} --environment production --visibility ${command.visibility}`, `Store submission input pack command mismatch for ${command.key}`);
    assert(command.command.includes('--environment production'), `Store submission input pack command should target production for ${command.key}`);
    assert(!command.command.includes('--value'), `Store submission input pack should not put production values directly in shell commands for ${command.key}`);
  }

  for (const confirmation of manualConfirmations) {
    const status = currentStatusByLabel[confirmation.key];

    assert(confirmation.setTo === '1', `Store submission input pack ${confirmation.key} should set manual confirmations to 1 only after completion`);
    assert(Boolean(status), `Store submission input pack manual confirmation missing release-status row: ${confirmation.key}`);
    assert(confirmation.currentStatus === status?.status, `Store submission input pack manual status mismatch for ${confirmation.key}`);
    assert(typeof confirmation.action === 'string' && confirmation.action.length > 20, `Store submission input pack ${confirmation.key} should describe the required action`);
    assert(typeof confirmation.evidence === 'string' && confirmation.evidence.length > 20, `Store submission input pack ${confirmation.key} should describe evidence`);
  }

  for (const fieldEntry of appStoreConnectFields) {
    const readinessItem = (externalReadiness.items ?? []).find((item) => item.label === fieldEntry.label);

    assert(Boolean(readinessItem), `Store submission input pack field is not backed by external readiness: ${fieldEntry.label}`);
    assert(fieldEntry.currentStatus === readinessItem?.status, `Store submission input pack field status mismatch for ${fieldEntry.label}`);
    assert(fieldEntry.detail === readinessItem?.detail, `Store submission input pack field detail mismatch for ${fieldEntry.label}`);
    assert(Array.isArray(fieldEntry.keys) && fieldEntry.keys.every((key) => envKeys.includes(key)), `Store submission input pack field ${fieldEntry.label} should map to .env.example keys`);
  }

  for (const command of [
    'npm run store:input-pack',
    'npm run release:verify',
    'npm run release:store-ready',
    'npm run metadata:ios',
    'npm run build:ios',
    'npm run submit:ios',
  ]) {
    assert(verificationCommands.includes(command), `Store submission input pack verification commands missing ${command}`);
  }

  assert((storeSubmissionInputPack.officialReferences ?? []).some((entry) => entry.url === 'https://docs.expo.dev/versions/v56.0.0/'), 'Store submission input pack should link Expo SDK 56 docs');
  assert((storeSubmissionInputPack.officialReferences ?? []).some((entry) => entry.url === 'https://docs.expo.dev/eas/environment-variables/'), 'Store submission input pack should link EAS environment variable docs');

  for (const snippet of [
    '# Store Submission Input Pack',
    'Standalone env template',
    'docs/store-submission.env.template',
    'Fill .env.local',
    'Mirror To EAS Production',
    'App Store Connect Fields',
    'Manual Confirmations',
    'EXPO_PUBLIC_ADMOB_IOS_APP_ID',
    'APP_STORE_BASE_URL',
    'PRODUCTION_DEVICE_TESTED',
    'npm run release:store-ready',
  ]) {
    assert(storeSubmissionInputPackDoc.includes(snippet), `Store submission input pack markdown missing: ${snippet}`);
  }
}

function verifyAccountServicePreflight() {
  const expectedCheckIds = [
    'expo-account-login',
    'eas-project-link',
    'eas-production-env',
    'eas-remote-version',
    'app-store-connect-record',
    'admob-production',
    'public-hosting',
    'ios-production-build',
    'testflight-device-smoke',
    'ios-submit',
  ];
  const expectedProductionKeys = (storeSubmissionInputPack.easProductionCommands ?? []).map((entry) => entry.key);
  const currentStatusByLabel = Object.fromEntries((readReleaseStatusJson().rows ?? []).map((row) => [row.label, row]));
  const externalBlockingRows = (readReleaseStatusJson().rows ?? [])
    .filter((row) => row.category === 'external' && (row.status === 'TODO' || row.status === 'BAD'));
  const checks = accountServicePreflight.checks ?? [];

  assert(accountServicePreflight.schemaVersion === 1, 'Account and service preflight schemaVersion should be 1');
  assert(accountServicePreflight.source === 'scripts/generate-account-service-preflight.js', 'Account and service preflight should name its generator');
  assert(accountServicePreflight.generatedFrom?.appConfig === 'app.json', 'Account and service preflight should reference app.json');
  assert(accountServicePreflight.generatedFrom?.easJson === 'eas.json', 'Account and service preflight should reference eas.json');
  assert(accountServicePreflight.generatedFrom?.packageJson === 'package.json', 'Account and service preflight should reference package.json');
  assert(accountServicePreflight.generatedFrom?.releaseStatus === 'scripts/release-status.js --json', 'Account and service preflight should reference release-status');
  assert(accountServicePreflight.generatedFrom?.storeSubmissionInputPack === 'docs/store-submission-input-pack.json', 'Account and service preflight should reference store submission input pack');
  assert(accountServicePreflight.mode === 'manual', 'Account and service preflight should default to manual mode for release verification');
  assert(accountServicePreflight.summary?.planReady === true, 'Account and service preflight should mark the plan ready');
  assert(accountServicePreflight.summary?.liveMode === false, 'Account and service preflight release artifact should not run live probes by default');
  assert(accountServicePreflight.summary?.checks === expectedCheckIds.length, 'Account and service preflight check count should match expected remote checks');
  assert(accountServicePreflight.summary?.commandsReady === true, 'Account and service preflight commands should be ready');
  assert(accountServicePreflight.summary?.externalBlockingItems === externalBlockingRows.length, 'Account and service preflight blocker count should match release-status');
  assert(accountServicePreflight.summary?.manualOrTodoChecks === checks.filter((entry) => entry.status === 'MANUAL' || entry.status === 'TODO').length, 'Account and service preflight manual/TODO count should match checks');
  assert(accountServicePreflight.app?.slug === appJson.slug, 'Account and service preflight app slug should match app.json');
  assert(accountServicePreflight.app?.bundleIdentifier === appJson.ios?.bundleIdentifier, 'Account and service preflight bundle ID should match app.json');
  assert(accountServicePreflight.app?.packageName === appJson.android?.package, 'Account and service preflight package name should match app.json');
  assert(accountServicePreflight.app?.easAppVersionSource === easJson.cli?.appVersionSource, 'Account and service preflight appVersionSource should match eas.json');
  assert(accountServicePreflight.commands?.manual === 'npm run account:preflight', 'Account and service preflight manual command mismatch');
  assert(accountServicePreflight.commands?.live === 'npm run account:preflight -- --live', 'Account and service preflight live command mismatch');
  assert(accountServicePreflight.commands?.finalGate === packageJson.scripts?.['release:store-ready'], 'Account and service preflight final gate should match package.json');
  assert(accountServicePreflight.commands?.metadata === packageJson.scripts?.['metadata:ios'], 'Account and service preflight metadata command should match package.json');
  assert(accountServicePreflight.commands?.build === packageJson.scripts?.['build:ios'], 'Account and service preflight build command should match package.json');
  assert(accountServicePreflight.commands?.submit === packageJson.scripts?.['submit:ios'], 'Account and service preflight submit command should match package.json');
  sameSet(accountServicePreflight.requiredEasProductionEnv ?? [], expectedProductionKeys, 'Account and service preflight required EAS env keys');
  sameSet(checks.map((entry) => entry.id), expectedCheckIds, 'Account and service preflight check IDs');

  for (const entry of checks) {
    assert(['MANUAL', 'TODO', 'OK'].includes(entry.status), `Account and service preflight ${entry.id} should use a known status`);
    assert(typeof entry.system === 'string' && entry.system.length > 0, `Account and service preflight ${entry.id} should name the remote system`);
    assert(typeof entry.owner === 'string' && entry.owner.length > 0, `Account and service preflight ${entry.id} should name the owner`);
    assert(typeof entry.command === 'string' && entry.command.length > 0, `Account and service preflight ${entry.id} should include a verification command`);
    assert(typeof entry.evidence === 'string' && entry.evidence.length > 20, `Account and service preflight ${entry.id} should describe evidence`);
    assert(typeof entry.nextAction === 'string' && entry.nextAction.length > 20, `Account and service preflight ${entry.id} should describe next action`);
    assert(typeof entry.officialReference === 'string' && entry.officialReference.startsWith('https://'), `Account and service preflight ${entry.id} should link an official reference`);

    for (const row of entry.releaseStatuses ?? []) {
      const current = currentStatusByLabel[row.label];

      assert(Boolean(current), `Account and service preflight ${entry.id} references missing release-status row: ${row.label}`);
      assert(row.status === current?.status, `Account and service preflight status mismatch for ${entry.id} / ${row.label}`);
      assert(row.detail === current?.detail, `Account and service preflight detail mismatch for ${entry.id} / ${row.label}`);
    }
  }

  for (const command of [
    'npx eas-cli whoami',
    'npx eas-cli project:info',
    'npx eas-cli env:list production --format long --scope project',
    'npx eas-cli build:version:get --platform ios --profile production --json --non-interactive',
    'npm run metadata:ios',
    packageJson.scripts?.['build:ios'],
    packageJson.scripts?.['submit:ios'],
  ]) {
    assert(checks.some((entry) => entry.command === command), `Account and service preflight missing command: ${command}`);
  }

  assert((accountServicePreflight.liveProbes ?? []).length === 0, 'Account and service preflight should not contain live probe output in default release verification');
  for (const url of [
    'https://docs.expo.dev/versions/v56.0.0/',
    'https://docs.expo.dev/build/setup/',
    'https://docs.expo.dev/eas/cli/',
    'https://docs.expo.dev/eas/environment-variables/',
    'https://docs.expo.dev/submit/introduction/',
  ]) {
    assert((accountServicePreflight.officialReferences ?? []).some((entry) => entry.url === url), `Account and service preflight should link ${url}`);
  }

  for (const snippet of [
    '# Account And Service Preflight',
    'Run live EAS probes',
    'Required EAS Production Env',
    'Remote Checks',
    'Live Probe Output',
    'npx eas-cli whoami',
    'npx eas-cli project:info',
    'npx eas-cli env:list production',
    'npm run build:ios',
    'npm run submit:ios',
  ]) {
    assert(accountServicePreflightDoc.includes(snippet), `Account and service preflight markdown missing: ${snippet}`);
  }
}

function verifyExternalTodoTracker() {
  const currentStatus = readReleaseStatusJson();
  const externalRows = (currentStatus.rows ?? []).filter((row) => row.category === 'external');
  const blockingRows = externalRows.filter((row) => row.status === 'TODO' || row.status === 'BAD');
  const items = externalTodoTracker.items ?? [];
  const itemByLabel = Object.fromEntries(items.map((item) => [item.label, item]));

  assert(externalTodoTracker.schemaVersion === 1, 'External TODO tracker schemaVersion should be 1');
  assert(externalTodoTracker.source === 'scripts/generate-external-todo-tracker.js', 'External TODO tracker should name its generator');
  assert(externalTodoTracker.generatedFrom?.releaseStatus === 'scripts/release-status.js --json', 'External TODO tracker should reference release-status');
  assert(externalTodoTracker.generatedFrom?.externalReadiness === 'docs/external-readiness.json', 'External TODO tracker should reference external readiness');
  assert(externalTodoTracker.generatedFrom?.storeSubmissionInputPack === 'docs/store-submission-input-pack.json', 'External TODO tracker should reference store submission input pack');
  assert(externalTodoTracker.generatedFrom?.accountServicePreflight === 'docs/account-service-preflight.json', 'External TODO tracker should reference account service preflight');
  assert(externalTodoTracker.summary?.externalItems === externalRows.length, 'External TODO tracker external item count should match release-status');
  assert(externalTodoTracker.summary?.trackedItems === items.length, 'External TODO tracker tracked count should match items');
  assert(externalTodoTracker.summary?.blockingItems === blockingRows.length, 'External TODO tracker blocker count should match release-status');
  assert(externalTodoTracker.summary?.optionalItems === externalRows.filter((row) => row.status === 'INFO').length, 'External TODO tracker optional item count should match release-status');
  assert(externalTodoTracker.summary?.todoItems === items.filter((item) => item.status === 'TODO').length, 'External TODO tracker TODO count should match items');
  assert(externalTodoTracker.summary?.badItems === items.filter((item) => item.status === 'BAD').length, 'External TODO tracker BAD count should match items');
  assert(externalTodoTracker.summary?.infoItems === items.filter((item) => item.status === 'INFO').length, 'External TODO tracker INFO count should match items');
  sameSet(items.map((item) => item.label), externalRows.map((row) => row.label), 'External TODO tracker labels');

  for (const row of externalRows) {
    const item = itemByLabel[row.label];
    const readiness = (externalReadiness.items ?? []).find((entry) => entry.label === row.label);

    assert(Boolean(item), `External TODO tracker missing item: ${row.label}`);
    assert(item.status === row.status, `External TODO tracker status mismatch for ${row.label}`);
    assert(item.detail === row.detail, `External TODO tracker detail mismatch for ${row.label}`);
    assert(item.blocking === (row.status === 'TODO' || row.status === 'BAD'), `External TODO tracker blocking mismatch for ${row.label}`);
    assert(typeof item.phase === 'string' && item.phase.length > 0, `External TODO tracker ${row.label} should have a phase`);
    assert(typeof item.system === 'string' && item.system.length > 0, `External TODO tracker ${row.label} should have a system`);
    assert(typeof item.action === 'string' && item.action.length > 20, `External TODO tracker ${row.label} should describe action`);
    assert(typeof item.evidence === 'string' && item.evidence.length > 20, `External TODO tracker ${row.label} should describe evidence`);
    assert(Array.isArray(item.verification) && item.verification.length > 0, `External TODO tracker ${row.label} should list verification commands`);
    assert(typeof item.completionRule === 'string' && item.completionRule.length > 20, `External TODO tracker ${row.label} should include a completion rule`);

    if (readiness) {
      sameSet(item.env ?? [], readiness.env ?? [], `External TODO tracker env keys for ${row.label}`);
    }

    if (item.blocking) {
      for (const command of ['npm run release:store-ready', 'npm run metadata:ios', 'npm run build:ios', 'npm run submit:ios']) {
        assert((item.blocks ?? []).includes(command), `External TODO tracker ${row.label} should block ${command}`);
      }
    }
  }

  for (const command of ['npm run release:store-ready', 'npm run metadata:ios', 'npm run build:ios', 'npm run submit:ios']) {
    assert((externalTodoTracker.finalCommandsBlockedUntilClear ?? []).includes(command), `External TODO tracker final blocked commands missing ${command}`);
  }

  for (const snippet of [
    '# External TODO Tracker',
    'Final Commands Blocked Until Clear',
    'Items By Phase',
    'Live AdMob IDs',
    'PRODUCTION_DEVICE_TESTED',
    'npm run release:store-ready',
    'npm run submit:ios',
  ]) {
    assert(externalTodoTrackerDoc.includes(snippet), `External TODO tracker markdown missing: ${snippet}`);
  }
}

function verifyFinalLaunchRunbook() {
  const expectedPhaseIds = [
    'refresh-local-evidence',
    'external-inputs',
    'account-service-preflight',
    'strict-store-gate',
    'metadata-ios',
    'build-ios',
    'testflight-smoke',
    'submit-ios',
    'app-store-review',
  ];
  const currentStatus = readReleaseStatusJson();
  const generatedSelfLabels = ['Final launch runbook', 'App Store handoff bundle'];
  const readinessRows = (currentStatus.rows ?? []).filter((row) => !generatedSelfLabels.includes(row.label));
  const localRows = readinessRows.filter((row) => row.category === 'local');
  const externalRows = (currentStatus.rows ?? []).filter((row) => row.category === 'external');
  const externalBlockingRows = externalRows.filter((row) => row.status === 'TODO' || row.status === 'BAD');
  const blockingRows = readinessRows.filter((row) => row.status === 'TODO' || row.status === 'BAD');
  const phases = finalLaunchRunbook.phases ?? [];

  assert(finalLaunchRunbook.schemaVersion === 1, 'Final launch runbook schemaVersion should be 1');
  assert(finalLaunchRunbook.source === 'scripts/generate-final-launch-runbook.js', 'Final launch runbook should name its generator');
  assert(finalLaunchRunbook.generatedFrom?.appConfig === 'app.json', 'Final launch runbook should reference app.json');
  assert(finalLaunchRunbook.generatedFrom?.packageJson === 'package.json', 'Final launch runbook should reference package.json');
  assert(finalLaunchRunbook.generatedFrom?.releaseStatus === 'scripts/release-status.js --json', 'Final launch runbook should reference release-status');
  assert(finalLaunchRunbook.generatedFrom?.externalReadiness === 'docs/external-readiness.json', 'Final launch runbook should reference external readiness');
  assert(finalLaunchRunbook.generatedFrom?.storeSubmissionInputPack === 'docs/store-submission-input-pack.json', 'Final launch runbook should reference store submission input pack');
  assert(finalLaunchRunbook.generatedFrom?.accountServicePreflight === 'docs/account-service-preflight.json', 'Final launch runbook should reference account service preflight');
  assert(finalLaunchRunbook.generatedFrom?.easSubmissionChecklist === 'docs/eas-submission-checklist.json', 'Final launch runbook should reference EAS submission checklist');
  assert(finalLaunchRunbook.generatedFrom?.releasePacket === 'docs/release-packet.json', 'Final launch runbook should reference release packet');
  assert(finalLaunchRunbook.app?.name === appJson.name, 'Final launch runbook app name should match app.json');
  assert(finalLaunchRunbook.app?.version === appJson.version, 'Final launch runbook version should match app.json');
  assert(finalLaunchRunbook.app?.bundleIdentifier === appJson.ios?.bundleIdentifier, 'Final launch runbook bundle ID should match app.json');
  assert(finalLaunchRunbook.app?.packageName === appJson.android?.package, 'Final launch runbook package name should match app.json');
  assert(finalLaunchRunbook.app?.locales === expectedLocales.length, 'Final launch runbook locale count should match release packet');
  assert(finalLaunchRunbook.summary?.localReady === (localRows.length > 0 && localRows.every((row) => row.status === 'OK')), 'Final launch runbook localReady should match release-status');
  assert(finalLaunchRunbook.summary?.externalReady === (externalBlockingRows.length === 0), 'Final launch runbook externalReady should match release-status');
  assert(finalLaunchRunbook.summary?.strictGateReady === (blockingRows.length === 0), 'Final launch runbook strictGateReady should match release-status');
  assert(finalLaunchRunbook.summary?.readyToRunMetadataBuildSubmit === finalLaunchRunbook.summary?.strictGateReady, 'Final launch runbook remote command readiness should match strict gate');
  assert(finalLaunchRunbook.summary?.phaseCount === expectedPhaseIds.length, 'Final launch runbook phase count should match expected phases');
  assert(finalLaunchRunbook.summary?.readyPhases === phases.filter((entry) => entry.status === 'READY').length, 'Final launch runbook ready phase count mismatch');
  assert(finalLaunchRunbook.summary?.todoPhases === phases.filter((entry) => entry.status === 'TODO').length, 'Final launch runbook TODO phase count mismatch');
  assert(finalLaunchRunbook.summary?.blockedPhases === phases.filter((entry) => entry.status === 'BLOCKED').length, 'Final launch runbook blocked phase count mismatch');
  assert(finalLaunchRunbook.summary?.externalBlockingItems === externalBlockingRows.length, 'Final launch runbook external blocker count should match release-status');
  assert(finalLaunchRunbook.summary?.localEvidenceRows === localRows.length, 'Final launch runbook local row count should match release-status');
  assert(finalLaunchRunbook.summary?.externalRows === externalRows.length, 'Final launch runbook external row count should match release-status');
  assert(finalLaunchRunbook.evidence?.externalReadinessBlocking === externalReadiness.summary?.blocking, 'Final launch runbook external readiness blocker count should match external readiness');
  assert(finalLaunchRunbook.evidence?.envInputs === storeSubmissionInputPack.summary?.fillableEnvKeys, 'Final launch runbook env input count should match store input pack');
  assert(finalLaunchRunbook.evidence?.easProductionEnvKeys === storeSubmissionInputPack.summary?.easProductionKeys, 'Final launch runbook EAS env count should match store input pack');
  assert(finalLaunchRunbook.evidence?.accountServiceChecks === accountServicePreflight.summary?.checks, 'Final launch runbook account check count should match account preflight');
  sameSet(finalLaunchRunbook.evidence?.easSubmissionSequence ?? [], (easSubmissionChecklist.sequence ?? []).map((entry) => entry.command), 'Final launch runbook EAS submission sequence');
  sameSet(phases.map((entry) => entry.id), expectedPhaseIds, 'Final launch runbook phase IDs');
  sameSet((finalLaunchRunbook.blockers ?? []).map((row) => row.label), blockingRows.map((row) => row.label), 'Final launch runbook blockers');

  for (const phaseEntry of phases) {
    assert(['READY', 'TODO', 'BLOCKED', 'REVIEW'].includes(phaseEntry.status), `Final launch runbook phase ${phaseEntry.id} has an unknown status`);
    assert(typeof phaseEntry.title === 'string' && phaseEntry.title.length > 0, `Final launch runbook phase ${phaseEntry.id} should have a title`);
    assert(typeof phaseEntry.action === 'string' && phaseEntry.action.length > 20, `Final launch runbook phase ${phaseEntry.id} should describe its action`);
    assert(phaseEntry.commandReady === Boolean(phaseEntry.command), `Final launch runbook phase ${phaseEntry.id} commandReady mismatch`);
    assert(Array.isArray(phaseEntry.evidence) && phaseEntry.evidence.length > 0, `Final launch runbook phase ${phaseEntry.id} should include evidence files`);
    assert(Array.isArray(phaseEntry.requiredBefore), `Final launch runbook phase ${phaseEntry.id} should include requiredBefore`);
  }

  for (const command of [
    'npm run release:verify',
    'npm run account:preflight -- --live',
    'npm run release:store-ready',
    'npm run metadata:ios',
    'npm run build:ios',
    'npm run submit:ios',
  ]) {
    assert((finalLaunchRunbook.finalCommands ?? []).includes(command), `Final launch runbook final commands missing ${command}`);
  }

  for (const url of [
    'https://docs.expo.dev/versions/v56.0.0/',
    'https://docs.expo.dev/build/setup/',
    'https://docs.expo.dev/eas/cli/',
    'https://docs.expo.dev/submit/introduction/',
  ]) {
    assert((finalLaunchRunbook.officialReferences ?? []).some((entry) => entry.url === url), `Final launch runbook should link ${url}`);
  }

  for (const snippet of [
    '# Final Launch Runbook',
    'Ready to run metadata/build/submit',
    'Phase Plan',
    'Final Command Order',
    'Current Blockers',
    'npm run account:preflight -- --live',
    'npm run release:store-ready',
    'npm run build:ios',
    'npm run submit:ios',
  ]) {
    assert(finalLaunchRunbookDoc.includes(snippet), `Final launch runbook markdown missing: ${snippet}`);
  }
}

function verifyEasBuildPreflight() {
  const currentStatus = readReleaseStatusJson();
  const externalBlockingRows = (currentStatus.rows ?? []).filter((row) => row.category === 'external' && ['TODO', 'BAD'].includes(row.status));
  const requiredEntries = easBuildPreflight.uploadPolicy?.requiredEntries ?? [];
  const forbiddenEntries = easBuildPreflight.uploadPolicy?.forbiddenEntries ?? [];

  assert(easBuildPreflight.schemaVersion === 1, 'EAS build preflight schemaVersion should be 1');
  assert(easBuildPreflight.source === 'scripts/generate-eas-build-preflight.js', 'EAS build preflight should name its generator');
  assert(easBuildPreflight.generatedFrom?.appConfig === 'app.json + app.config.js', 'EAS build preflight should reference app config');
  assert(easBuildPreflight.generatedFrom?.easJson === 'eas.json', 'EAS build preflight should reference eas.json');
  assert(easBuildPreflight.generatedFrom?.packageJson === 'package.json', 'EAS build preflight should reference package.json');
  assert(easBuildPreflight.generatedFrom?.easIgnore === '.easignore', 'EAS build preflight should reference .easignore');
  assert(easBuildPreflight.generatedFrom?.easEnvironmentChecklist === 'docs/eas-env-checklist.json', 'EAS build preflight should reference EAS env checklist');
  assert(easBuildPreflight.generatedFrom?.externalReadiness === 'docs/external-readiness.json', 'EAS build preflight should reference external readiness');
  assert(easBuildPreflight.generatedFrom?.releaseStatus === 'scripts/release-status.js --json', 'EAS build preflight should reference release-status');
  assert((easBuildPreflight.officialReferences ?? []).some((entry) => entry.url === 'https://docs.expo.dev/versions/v56.0.0/'), 'EAS build preflight should link Expo SDK 56 docs');
  assert((easBuildPreflight.officialReferences ?? []).some((entry) => entry.url === 'https://docs.expo.dev/build/eas-json/'), 'EAS build preflight should link EAS Build eas.json docs');
  assert((easBuildPreflight.officialReferences ?? []).some((entry) => entry.url === 'https://docs.expo.dev/submit/eas-json/'), 'EAS build preflight should link EAS Submit eas.json docs');

  assert(easBuildPreflight.summary?.risk === 'PASS', 'EAS build preflight should pass for local configuration');
  assert(easBuildPreflight.summary?.localReady === true, 'EAS build preflight should mark local EAS setup ready');
  assert(easBuildPreflight.summary?.externalReady === (externalBlockingRows.length === 0), 'EAS build preflight externalReady should match release-status blockers');
  assert(easBuildPreflight.summary?.strictGateReady === (externalBlockingRows.length === 0), 'EAS build preflight strictGateReady should match release-status blockers');
  assert(easBuildPreflight.summary?.externalBlockingItems === externalBlockingRows.length, 'EAS build preflight blocker count should match release-status');
  assert(easBuildPreflight.summary?.localFailures === 0, 'EAS build preflight should not have local failures');
  assert((easBuildPreflight.localFailures ?? []).length === 0, 'EAS build preflight localFailures should be empty');

  assert(easBuildPreflight.app?.name === appJson.name, 'EAS build preflight app name should match app.json');
  assert(easBuildPreflight.app?.version === appJson.version, 'EAS build preflight app version should match app.json');
  assert(easBuildPreflight.app?.slug === appJson.slug, 'EAS build preflight app slug should match app.json');
  assert(easBuildPreflight.app?.bundleIdentifier === appJson.ios?.bundleIdentifier, 'EAS build preflight bundle ID should match app.json');
  assert(easBuildPreflight.app?.buildNumber === appJson.ios?.buildNumber, 'EAS build preflight iOS build number should match app.json');
  assert(easBuildPreflight.app?.packageName === appJson.android?.package, 'EAS build preflight Android package should match app.json');
  assert(easBuildPreflight.app?.versionCode === appJson.android?.versionCode, 'EAS build preflight Android version code should match app.json');
  assert(easBuildPreflight.app?.supportsTablet === true, 'EAS build preflight should record tablet support');
  assert(easBuildPreflight.app?.nonExemptEncryption === false, 'EAS build preflight should record no non-exempt encryption');
  assert(easBuildPreflight.app?.privacyTracking === false, 'EAS build preflight should record no privacy tracking');

  assert(easBuildPreflight.eas?.cliVersion === easJson.cli?.version, 'EAS build preflight CLI requirement should match eas.json');
  assert(easBuildPreflight.eas?.appVersionSource === 'remote', 'EAS build preflight should record remote app version source');
  assert(easBuildPreflight.eas?.productionBuildProfile?.autoIncrement === true, 'EAS build preflight should record production autoIncrement');
  assert(easBuildPreflight.eas?.productionBuildProfile?.environment === 'production', 'EAS build preflight should record production environment');
  assert(easBuildPreflight.eas?.productionBuildProfile?.developmentClient === false, 'EAS build preflight production build should not be a development client');
  assert(easBuildPreflight.eas?.productionBuildProfile?.distribution === 'store', 'EAS build preflight production distribution should be store');
  assert(easBuildPreflight.eas?.productionBuildProfile?.ready === true, 'EAS build preflight production profile should be ready');
  assert(easBuildPreflight.eas?.productionSubmitProfile?.metadataPath === './store.config.js', 'EAS build preflight submit metadata path should match eas.json');
  assert(easBuildPreflight.eas?.productionSubmitProfile?.ready === true, 'EAS build preflight submit profile should be ready');

  assert(easBuildPreflight.commands?.metadata === packageJson.scripts?.['metadata:ios'], 'EAS build preflight metadata command should match package.json');
  assert(easBuildPreflight.commands?.build === packageJson.scripts?.['build:ios'], 'EAS build preflight build command should match package.json');
  assert(easBuildPreflight.commands?.submit === packageJson.scripts?.['submit:ios'], 'EAS build preflight submit command should match package.json');
  assert(easBuildPreflight.commands?.remoteVersion === 'npx eas-cli build:version:set', 'EAS build preflight should record remote version command');
  assert(easBuildPreflight.commands?.strictGate === packageJson.scripts?.['release:store-ready'], 'EAS build preflight strict gate command should match package.json');
  assert(easBuildPreflight.commands?.ready === true, 'EAS build preflight command contract should be ready');

  sameSet(requiredEntries.map((entry) => entry.entry), expectedEasIgnoreEntries, 'EAS build preflight required .easignore entries');
  assert(requiredEntries.every((entry) => entry.present === true), 'EAS build preflight required .easignore entries should all be present');
  sameSet(forbiddenEntries.map((entry) => entry.entry), ['/assets', '/assets/bgm', '/assets/icon.png', '/assets/splash-icon.png'], 'EAS build preflight forbidden .easignore entries');
  assert(forbiddenEntries.every((entry) => entry.absent === true), 'EAS build preflight forbidden .easignore entries should all be absent');
  assert(easBuildPreflight.uploadPolicy?.easIgnorePresent === true, 'EAS build preflight should confirm .easignore exists');
  assert(easBuildPreflight.uploadPolicy?.keepsRuntimeAssets === true, 'EAS build preflight should keep runtime assets in EAS upload');
  assert(easBuildPreflight.uploadPolicy?.excludesStoreArtifacts === true, 'EAS build preflight should exclude store/handoff artifacts from EAS upload');
  assert(easBuildPreflight.uploadPolicy?.ready === true, 'EAS build preflight upload policy should be ready');

  assert(easBuildPreflight.environment?.checklist === 'docs/eas-env-checklist.md', 'EAS build preflight should reference EAS env checklist markdown');
  assert(easBuildPreflight.environment?.productionProfileEnvironmentReady === easEnvChecklist.summary?.productionProfileEnvironmentReady, 'EAS build preflight env readiness should match EAS env checklist');
  assert(easBuildPreflight.environment?.requiredForEasProduction === easEnvChecklist.summary?.requiredForEasProduction, 'EAS build preflight production env count should match EAS env checklist');
  assert(easBuildPreflight.environment?.clientVisible === easEnvChecklist.summary?.clientVisible, 'EAS build preflight client-visible count should match EAS env checklist');
  assert(easBuildPreflight.externalGate?.checklist === 'docs/external-readiness.md', 'EAS build preflight should reference external readiness markdown');
  assert(easBuildPreflight.externalGate?.readinessItems === externalReadiness.summary?.total, 'EAS build preflight readiness item count should match external readiness');
  assert(easBuildPreflight.externalGate?.blockingItems === externalBlockingRows.length, 'EAS build preflight external blocker count should match release-status');
  sameSet((easBuildPreflight.externalGate?.blockers ?? []).map((row) => row.label), externalBlockingRows.map((row) => row.label), 'EAS build preflight external blocker labels');

  for (const snippet of [
    '# EAS Build Preflight',
    'Risk: PASS',
    'Local EAS setup ready: Yes',
    `External gate ready: ${externalBlockingRows.length === 0 ? 'Yes' : 'No'}`,
    'App version source: remote',
    'Production auto-increment: Yes',
    'Submit metadata path: ./store.config.js',
    'Runtime assets kept: Yes',
    'Store/handoff artifacts excluded: Yes',
    'npx eas-cli build --platform ios --profile production',
    'https://docs.expo.dev/build/eas-json/',
    'https://docs.expo.dev/submit/eas-json/',
  ]) {
    assert(easBuildPreflightDoc.includes(snippet), `EAS build preflight markdown missing: ${snippet}`);
  }
}

function verifyAppStoreConnectChecklist() {
  const sections = appStoreConnectChecklist.sections ?? [];
  const fields = sections.flatMap((section) => section.fields ?? []);
  const rowByLabel = Object.fromEntries((readReleaseStatusJson().rows ?? []).map((row) => [row.label, row]));

  assert(appStoreConnectChecklist.schemaVersion === 1, 'App Store Connect checklist schemaVersion should be 1');
  assert(appStoreConnectChecklist.source === 'scripts/generate-app-store-connect-checklist.js', 'App Store Connect checklist should name its generator');
  assert(appStoreConnectChecklist.generatedFrom?.storeConfig === 'store.config.js', 'App Store Connect checklist should reference store.config.js');
  assert(appStoreConnectChecklist.generatedFrom?.metadataPreview === 'docs/app-store-metadata-preview.json', 'App Store Connect checklist should reference metadata preview');
  assert(appStoreConnectChecklist.generatedFrom?.appStoreCopyAudit === 'docs/app-store-copy-audit.json', 'App Store Connect checklist should reference App Store copy audit');
  assert(appStoreConnectChecklist.generatedFrom?.metadataUploadPacket === 'docs/app-store-metadata-upload-packet.json', 'App Store Connect checklist should reference metadata upload packet');
  assert(appStoreConnectChecklist.generatedFrom?.localizationAudit === 'docs/localization-audit.json', 'App Store Connect checklist should reference localization audit');
  assert(appStoreConnectChecklist.generatedFrom?.screenshotQaAudit === 'docs/screenshot-qa-audit.json', 'App Store Connect checklist should reference screenshot QA audit');
  assert(appStoreConnectChecklist.generatedFrom?.publicSiteDeployAudit === 'docs/public-site-deploy-audit.json', 'App Store Connect checklist should reference public site deploy audit');
  assert(appStoreConnectChecklist.generatedFrom?.publicSiteHostingVerification === 'docs/public-site-hosting-verification.json', 'App Store Connect checklist should reference public site hosting verification');
  assert(appStoreConnectChecklist.generatedFrom?.ageRatingAudit === 'docs/app-store-age-rating-audit.json', 'App Store Connect checklist should reference age rating audit');
  assert(appStoreConnectChecklist.generatedFrom?.studyBankDepthAudit === 'docs/study-bank-depth-audit.json', 'App Store Connect checklist should reference study bank depth audit');
  assert(appStoreConnectChecklist.generatedFrom?.studyContentLocalizationAudit === 'docs/study-content-localization-audit.json', 'App Store Connect checklist should reference study content localization audit');
  assert(appStoreConnectChecklist.generatedFrom?.contentRightsAudit === 'docs/content-rights-audit.json', 'App Store Connect checklist should reference content rights audit');
  assert(appStoreConnectChecklist.generatedFrom?.privacyManifestAudit === 'docs/privacy-manifest-audit.json', 'App Store Connect checklist should reference privacy manifest audit');
  assert(appStoreConnectChecklist.generatedFrom?.privacyAnswers === 'docs/app-store-privacy-answers.json', 'App Store Connect checklist should reference privacy answer pack');
  assert(appStoreConnectChecklist.generatedFrom?.privacyReviewPacket === 'docs/privacy-review-packet.json', 'App Store Connect checklist should reference privacy review packet');
  assert(appStoreConnectChecklist.generatedFrom?.admobReleaseAudit === 'docs/admob-release-audit.json', 'App Store Connect checklist should reference AdMob release audit');
  assert(appStoreConnectChecklist.generatedFrom?.dataFlowPrivacyAudit === 'docs/data-flow-privacy-audit.json', 'App Store Connect checklist should reference data flow privacy audit');
  assert(appStoreConnectChecklist.generatedFrom?.runtimeUiFlowAudit === 'docs/runtime-ui-flow-audit.json', 'App Store Connect checklist should reference runtime UI flow audit');
  assert(appStoreConnectChecklist.generatedFrom?.externalReadiness === 'docs/external-readiness.json', 'App Store Connect checklist should reference external readiness');
  assert(appStoreConnectChecklist.app?.name === appJson.name, 'App Store Connect checklist app name should match app.json');
  assert(appStoreConnectChecklist.app?.version === appJson.version, 'App Store Connect checklist version should match app.json');
  assert(appStoreConnectChecklist.app?.bundleIdentifier === appJson.ios?.bundleIdentifier, 'App Store Connect checklist bundle ID should match app.json');
  assert(appStoreConnectChecklist.app?.buildNumber === appJson.ios?.buildNumber, 'App Store Connect checklist build number should match app.json');
  assert(appStoreConnectChecklist.app?.encryption === 'No non-exempt encryption declared', 'App Store Connect checklist should record the encryption posture from app.json');
  sameSet(appStoreConnectChecklist.metadata?.locales ?? [], Object.values(expectedAppleLocales), 'App Store Connect checklist App Store locales');
  assert(appStoreConnectChecklist.metadata?.categories?.[0]?.[0] === 'GAMES', 'App Store Connect checklist should include Games as primary category');
  assert(appStoreConnectChecklist.metadata?.categories?.[1] === 'EDUCATION', 'App Store Connect checklist should include Education as secondary category');
  assert(appStoreConnectChecklist.metadata?.screenshotEntries === screenshotManifestEntryCount(), 'App Store Connect checklist screenshot count should match manifest');
  assert(appStoreConnectChecklist.metadata?.screenshotQaAudit === 'docs/screenshot-qa-audit.md', 'App Store Connect checklist should expose the screenshot QA audit path');
  assert(appStoreConnectChecklist.metadata?.screenshotQaRisk === 'PASS', 'App Store Connect checklist should record passing screenshot QA risk');
  assert(appStoreConnectChecklist.metadata?.screenshotQaReady === true, 'App Store Connect checklist should record screenshot QA readiness');
  assert(appStoreConnectChecklist.metadata?.screenshotQaLocalizedDistinct === true, 'App Store Connect checklist should record localized screenshot distinction');
  assert(appStoreConnectChecklist.metadata?.screenshotQaUnexpectedDuplicateGroups === 0, 'App Store Connect checklist should record zero unexpected screenshot duplicates');
  assert(appStoreConnectChecklist.metadata?.appStoreCopyAudit === 'docs/app-store-copy-audit.md', 'App Store Connect checklist should expose the App Store copy audit path');
  assert(appStoreConnectChecklist.metadata?.appStoreCopyRisk === appStoreCopyAudit.summary?.risk, 'App Store Connect checklist should record App Store copy risk');
  assert(appStoreConnectChecklist.metadata?.appStoreCopyReadyLocales === appStoreCopyAudit.summary?.readyLocales, 'App Store Connect checklist should record App Store copy ready locale count');
  assert(appStoreConnectChecklist.metadata?.appStoreCopyKeywordFormatReady === appStoreCopyAudit.summary?.keywordFormatReady, 'App Store Connect checklist should record App Store copy keyword format readiness');
  assert(appStoreConnectChecklist.metadata?.appStoreCopyKeywordsByteLimitReady === appStoreCopyAudit.summary?.keywordsByteLimitReady, 'App Store Connect checklist should record App Store copy keyword byte readiness');
  assert(appStoreConnectChecklist.metadata?.appStoreCopyNoProtectedTerms === appStoreCopyAudit.summary?.noProtectedTermHits, 'App Store Connect checklist should record App Store copy protected-term readiness');
  assert(appStoreConnectChecklist.metadata?.metadataUploadPacket === 'docs/app-store-metadata-upload-packet.md', 'App Store Connect checklist should expose the metadata upload packet path');
  assert(appStoreConnectChecklist.metadata?.metadataUploadPacketRisk === metadataUploadPacket.summary?.risk, 'App Store Connect checklist should record metadata upload packet risk');
  assert(appStoreConnectChecklist.metadata?.metadataUploadPacketLocalReady === true, 'App Store Connect checklist should record metadata upload packet local readiness');
  assert(appStoreConnectChecklist.metadata?.metadataUploadPacketFieldReadyLocales === metadataUploadPacket.summary?.fieldReadyLocales, 'App Store Connect checklist should record metadata upload packet field-ready locales');
  assert(appStoreConnectChecklist.metadata?.metadataUploadPacketScreenshotReadyLocales === metadataUploadPacket.summary?.screenshotReadyLocales, 'App Store Connect checklist should record metadata upload packet screenshot-ready locales');
  assert(appStoreConnectChecklist.metadata?.metadataUploadPacketSupportUrlReadyLocales === metadataUploadPacket.summary?.supportUrlReadyLocales, 'App Store Connect checklist should record metadata upload packet support URL locales');
  assert(appStoreConnectChecklist.metadata?.metadataUploadPacketPrivacyUrlReadyLocales === metadataUploadPacket.summary?.privacyUrlReadyLocales, 'App Store Connect checklist should record metadata upload packet privacy URL locales');
  assert(appStoreConnectChecklist.metadata?.localizationAudit === 'docs/localization-audit.md', 'App Store Connect checklist should expose the localization audit path');
  assert(appStoreConnectChecklist.metadata?.localizationRisk === 'PASS', 'App Store Connect checklist should record passing localization risk');
  assert(appStoreConnectChecklist.metadata?.localizationUiLocales === expectedLocales.length, 'App Store Connect checklist should record UI locale count');
  assert(appStoreConnectChecklist.metadata?.localizationAppStoreLocales === expectedLocales.length, 'App Store Connect checklist should record App Store locale count');
  assert(appStoreConnectChecklist.metadata?.localizationScreenshotEntries === expectedLocales.length * Object.keys(expectedStoreScreenshots).length * expectedStoreScreenshotFiles.length, 'App Store Connect checklist should record localized screenshot count');
  assert(appStoreConnectChecklist.metadata?.publicSiteDeployAudit === 'docs/public-site-deploy-audit.md', 'App Store Connect checklist should expose the public site deploy audit path');
  assert(appStoreConnectChecklist.metadata?.publicSiteDeployRisk === publicSiteDeployAudit.summary?.risk, 'App Store Connect checklist should record public site deploy audit risk');
  assert(appStoreConnectChecklist.metadata?.publicSiteLocalReady === true, 'App Store Connect checklist should record local public site readiness');
  assert(appStoreConnectChecklist.metadata?.publicSiteHostingReady === publicSiteDeployAudit.summary?.hostingReady, 'App Store Connect checklist should record public site hosting readiness');
  assert(appStoreConnectChecklist.metadata?.publicSiteHostingVerification === 'docs/public-site-hosting-verification.md', 'App Store Connect checklist should expose public site hosting verification path');
  assert(appStoreConnectChecklist.metadata?.publicSiteHostingVerificationStatus === publicSiteHostingVerification.summary?.status, 'App Store Connect checklist should record public site hosting verification status');
  assert(appStoreConnectChecklist.metadata?.publicSiteHostingVerificationReady === publicSiteHostingVerification.summary?.ready, 'App Store Connect checklist should record public site hosting verification readiness');
  assert(appStoreConnectChecklist.metadata?.publicSiteHostingVerificationCheckedUrls === publicSiteHostingVerification.summary?.checkedUrls, 'App Store Connect checklist should record public site hosting checked URL count');
  assert(appStoreConnectChecklist.metadata?.publicSiteHostingVerificationPassedUrls === publicSiteHostingVerification.summary?.passedUrls, 'App Store Connect checklist should record public site hosting passed URL count');
  assert(appStoreConnectChecklist.metadata?.publicSiteHostingVerificationFailedUrls === publicSiteHostingVerification.summary?.failedUrls, 'App Store Connect checklist should record public site hosting failed URL count');
  assert(appStoreConnectChecklist.metadata?.ageRatingAudit === 'docs/app-store-age-rating-audit.md', 'App Store Connect checklist should expose the age rating audit path');
  assert(appStoreConnectChecklist.metadata?.ageRatingRisk === 'PASS', 'App Store Connect checklist should record passing age rating risk');
  assert(appStoreConnectChecklist.metadata?.ageRatingSuggestedAppleGlobalRating === '4+ candidate', 'App Store Connect checklist should record suggested Apple global rating');
  assert(appStoreConnectChecklist.metadata?.ageRatingFrequencyNoneAnswers === 12, 'App Store Connect checklist should record age rating NONE answers');
  assert(appStoreConnectChecklist.metadata?.ageRatingFrequencyQuestions === 12, 'App Store Connect checklist should record age rating question count');
  assert(appStoreConnectChecklist.metadata?.studyBankDepthAudit === 'docs/study-bank-depth-audit.md', 'App Store Connect checklist should expose the study bank depth audit path');
  assert(appStoreConnectChecklist.metadata?.studyBankDepthRisk === 'PASS', 'App Store Connect checklist should record passing study bank depth risk');
  assert(appStoreConnectChecklist.metadata?.studyBankDepthLevels === expectedJlptLevels.length, 'App Store Connect checklist should record study bank level count');
  assert(appStoreConnectChecklist.metadata?.studyBankDepthTopics === studyBankDepthAudit.summary?.totalTopics, 'App Store Connect checklist should record study bank topic families');
  assert(appStoreConnectChecklist.metadata?.studyBankDepthProgression === true, 'App Store Connect checklist should record passing study bank progression');
  assert(appStoreConnectChecklist.metadata?.studyContentLocalizationAudit === 'docs/study-content-localization-audit.md', 'App Store Connect checklist should expose the study content localization audit path');
  assert(appStoreConnectChecklist.metadata?.studyContentLocalizationRisk === 'PASS', 'App Store Connect checklist should record passing study content localization risk');
  assert(appStoreConnectChecklist.metadata?.studyContentLocalizationLocales === expectedLocales.length, 'App Store Connect checklist should record study content locale count');
  assert(appStoreConnectChecklist.metadata?.studyContentLocalizationItems === studyContentLocalizationAudit.summary?.totalStudyItems, 'App Store Connect checklist should record study content item count');
  assert(appStoreConnectChecklist.metadata?.studyContentLocalizationTextKeys === studyContentLocalizationAudit.summary?.studyTextKeys, 'App Store Connect checklist should record study content text key count');
  assert(appStoreConnectChecklist.metadata?.studyContentLocalizedFields === studyContentLocalizationAudit.summary?.localizedFieldsReady, 'App Store Connect checklist should record localized study field count');
  assert(appStoreConnectChecklist.metadata?.studyContentExpectedFields === studyContentLocalizationAudit.summary?.expectedLocalizedFields, 'App Store Connect checklist should record expected study field count');
  assert(appStoreConnectChecklist.metadata?.studyContentTranslationEntries === studyContentLocalizationAudit.summary?.contentTranslationEntriesReady, 'App Store Connect checklist should record study translation entry count');
  assert(appStoreConnectChecklist.metadata?.studyContentExpectedTranslationEntries === studyContentLocalizationAudit.summary?.expectedContentTranslationEntries, 'App Store Connect checklist should record expected study translation entry count');
  assert(appStoreConnectChecklist.metadata?.studyContentMissingLocalizedFields === 0, 'App Store Connect checklist should record zero missing study fields');
  assert(appStoreConnectChecklist.metadata?.studyContentMissingTranslationEntries === 0, 'App Store Connect checklist should record zero missing study translations');
  assert(appStoreConnectChecklist.metadata?.contentRightsAudit === 'docs/content-rights-audit.md', 'App Store Connect checklist should expose the content rights audit path');
  assert(appStoreConnectChecklist.metadata?.protectedIpTermHits === 0, 'App Store Connect checklist should expose zero protected-IP hits');
  assert(appStoreConnectChecklist.metadata?.privacyManifestAudit === 'docs/privacy-manifest-audit.md', 'App Store Connect checklist should expose the privacy manifest audit path');
  assert(appStoreConnectChecklist.metadata?.privacyManifestRisk === 'PASS', 'App Store Connect checklist should record passing privacy manifest risk');
  assert(appStoreConnectChecklist.metadata?.privacyManifestTracking === false, 'App Store Connect checklist should record no tracking in privacy manifest');
  assert(appStoreConnectChecklist.metadata?.privacyManifestCollectedDataTypes === 0, 'App Store Connect checklist should record zero collected data types in privacy manifest');
  assert(appStoreConnectChecklist.metadata?.privacyAnswers === 'docs/app-store-privacy-answers.md', 'App Store Connect checklist should expose the privacy answer pack path');
  assert(appStoreConnectChecklist.metadata?.privacyAnswersRisk === privacyAnswers.summary?.risk, 'App Store Connect checklist should record privacy answer pack risk');
  assert(appStoreConnectChecklist.metadata?.privacyAnswersCurrentState === privacyAnswers.summary?.currentState, 'App Store Connect checklist should record privacy answer current state');
  assert(appStoreConnectChecklist.metadata?.privacyAnswersAppCodeCollectsPersonalData === false, 'App Store Connect checklist should record no app-code personal data collection');
  assert(appStoreConnectChecklist.metadata?.privacyReviewPacket === 'docs/privacy-review-packet.md', 'App Store Connect checklist should expose the privacy review packet path');
  assert(appStoreConnectChecklist.metadata?.privacyReviewPacketRisk === privacyReviewPacket.summary?.risk, 'App Store Connect checklist should record privacy review packet risk');
  assert(appStoreConnectChecklist.metadata?.privacyReviewPacketLocalReady === true, 'App Store Connect checklist should record privacy review packet local readiness');
  assert(appStoreConnectChecklist.metadata?.privacyReviewPacketCurrentState === privacyReviewPacket.summary?.currentState, 'App Store Connect checklist should record privacy review packet current state');
  assert(appStoreConnectChecklist.metadata?.privacyReviewPacketFinalReviewConfirmed === privacyReviewPacket.summary?.finalReviewConfirmed, 'App Store Connect checklist should record privacy review final confirmation');
  assert(appStoreConnectChecklist.metadata?.privacyReviewPacketNoLiveAdsSuggestedRows === privacyReviewPacket.summary?.noLiveAdsSuggestedRows, 'App Store Connect checklist should record no-live privacy row count');
  assert(appStoreConnectChecklist.metadata?.privacyReviewPacketLiveAdMobDisclosureRows === privacyReviewPacket.summary?.liveAdMobDisclosureRows, 'App Store Connect checklist should record live-AdMob disclosure row count');
  assert(appStoreConnectChecklist.metadata?.admobReleaseAudit === 'docs/admob-release-audit.md', 'App Store Connect checklist should expose the AdMob release audit path');
  assert(appStoreConnectChecklist.metadata?.admobReleaseRisk === admobReleaseAudit.summary?.risk, 'App Store Connect checklist should record AdMob release audit risk');
  assert(appStoreConnectChecklist.metadata?.admobReleaseCurrentState === admobReleaseAudit.summary?.currentState, 'App Store Connect checklist should record AdMob release state');
  assert(appStoreConnectChecklist.metadata?.admobReleaseLocalReady === true, 'App Store Connect checklist should record local AdMob readiness');
  assert(appStoreConnectChecklist.metadata?.admobReleaseLiveAdsReady === admobReleaseAudit.summary?.liveAdsReady, 'App Store Connect checklist should record live ad readiness');
  assert(appStoreConnectChecklist.metadata?.admobReleaseExternalReady === admobReleaseAudit.summary?.externalReady, 'App Store Connect checklist should record external AdMob readiness');
  assert(appStoreConnectChecklist.metadata?.dataFlowPrivacyAudit === 'docs/data-flow-privacy-audit.md', 'App Store Connect checklist should expose the data flow privacy audit path');
  assert(appStoreConnectChecklist.metadata?.dataFlowPrivacyRisk === dataFlowPrivacyAudit.summary?.risk, 'App Store Connect checklist should record data flow privacy risk');
  assert(appStoreConnectChecklist.metadata?.dataFlowPrivacyLocalReady === true, 'App Store Connect checklist should record local data-flow privacy readiness');
  assert(appStoreConnectChecklist.metadata?.dataFlowAppOwnedNetworkRequests === 0, 'App Store Connect checklist should record zero app-owned network hits');
  assert(appStoreConnectChecklist.metadata?.dataFlowAnalyticsSdkCount === 0, 'App Store Connect checklist should record zero analytics SDK hits');
  assert(appStoreConnectChecklist.metadata?.dataFlowAuthSdkCount === 0, 'App Store Connect checklist should record zero auth SDK hits');
  assert(appStoreConnectChecklist.metadata?.runtimeUiFlowAudit === 'docs/runtime-ui-flow-audit.md', 'App Store Connect checklist should expose the runtime UI flow audit path');
  assert(appStoreConnectChecklist.metadata?.runtimeUiFlowRisk === 'PASS', 'App Store Connect checklist should record passing runtime UI flow risk');
  assert(appStoreConnectChecklist.metadata?.runtimeUiFlowReady === true, 'App Store Connect checklist should record runtime UI flow readiness');
  assert(appStoreConnectChecklist.metadata?.runtimeUiFlowChecks === runtimeUiFlowAudit.summary?.checks, 'App Store Connect checklist runtime UI flow check count should match audit');
  assert(appStoreConnectChecklist.metadata?.runtimeUiFlowPassedChecks === runtimeUiFlowAudit.summary?.passedChecks, 'App Store Connect checklist runtime UI flow passed count should match audit');
  assert(appStoreConnectChecklist.metadata?.runtimeUiFlowRequiredFailures === 0, 'App Store Connect checklist should record zero runtime UI flow failures');
  assert((appStoreConnectChecklist.suggestedAnswers?.appInformation?.studyBankDepth ?? '').includes('N5-N1 local study bank'), 'App Store Connect checklist study bank answer should mention N5-N1 local study bank');
  assert((appStoreConnectChecklist.suggestedAnswers?.appInformation?.studyContentLocalization ?? '').includes('Study content localization'), 'App Store Connect checklist should include study content localization suggested answer');
  assert((appStoreConnectChecklist.suggestedAnswers?.appInformation?.contentRights ?? '').includes('original anime-style study lines'), 'App Store Connect checklist content rights answer should mention original anime-style lines');
  assert(appStoreConnectChecklist.suggestedAnswers?.ageRating?.auditPath === 'docs/app-store-age-rating-audit.md', 'App Store Connect checklist age rating answer should reference the age rating audit');
  assert(appStoreConnectChecklist.suggestedAnswers?.ageRating?.risk === 'PASS', 'App Store Connect checklist age rating answer should record passing risk');
  assert((appStoreConnectChecklist.suggestedAnswers?.ageRating?.expected ?? '').includes('4+ candidate'), 'App Store Connect checklist age rating answer should include suggested rating');
  assert(appStoreConnectChecklist.suggestedAnswers?.privacy?.privacyManifestAudit === 'docs/privacy-manifest-audit.md', 'App Store Connect checklist privacy answer should reference the privacy manifest audit');
  assert(appStoreConnectChecklist.suggestedAnswers?.privacy?.privacyManifestRisk === 'PASS', 'App Store Connect checklist privacy answer should record passing privacy manifest risk');
  assert(appStoreConnectChecklist.suggestedAnswers?.privacy?.privacyAnswers === 'docs/app-store-privacy-answers.md', 'App Store Connect checklist privacy answer should reference the privacy answer pack');
  assert(appStoreConnectChecklist.suggestedAnswers?.privacy?.privacyAnswersRisk === privacyAnswers.summary?.risk, 'App Store Connect checklist privacy answer should record privacy answer pack risk');
  assert(appStoreConnectChecklist.suggestedAnswers?.privacy?.privacyReviewPacket === 'docs/privacy-review-packet.md', 'App Store Connect checklist privacy answer should reference the privacy review packet');
  assert(appStoreConnectChecklist.suggestedAnswers?.privacy?.privacyReviewPacketRisk === privacyReviewPacket.summary?.risk, 'App Store Connect checklist privacy answer should record privacy review packet risk');
  assert(appStoreConnectChecklist.suggestedAnswers?.privacy?.currentBuildState === privacyAnswers.summary?.currentState, 'App Store Connect checklist privacy answer should record current privacy state');
  assert(appStoreConnectChecklist.suggestedAnswers?.privacy?.admobReleaseAudit === 'docs/admob-release-audit.md', 'App Store Connect checklist privacy answer should reference AdMob release audit');
  assert(appStoreConnectChecklist.suggestedAnswers?.privacy?.admobReleaseRisk === admobReleaseAudit.summary?.risk, 'App Store Connect checklist privacy answer should record AdMob release risk');
  assert(appStoreConnectChecklist.suggestedAnswers?.privacy?.dataFlowPrivacyAudit === 'docs/data-flow-privacy-audit.md', 'App Store Connect checklist privacy answer should reference data flow privacy audit');
  assert(appStoreConnectChecklist.suggestedAnswers?.privacy?.dataFlowPrivacyRisk === dataFlowPrivacyAudit.summary?.risk, 'App Store Connect checklist privacy answer should record data flow privacy risk');
  assert(appStoreConnectChecklist.suggestedAnswers?.ageRating?.finalSource === 'App Store Connect age rating questionnaire', 'App Store Connect checklist should point age rating to the questionnaire');
  assert(appStoreConnectChecklist.suggestedAnswers?.privacy?.finalConfirmationEnv === 'APP_STORE_PRIVACY_ANSWERS_REVIEWED', 'App Store Connect checklist should include the privacy confirmation env');
  assert(appStoreConnectChecklist.suggestedAnswers?.review?.contactStatus === rowByLabel['App Store review contact']?.status, 'App Store Connect checklist review contact status should match release-status');
  assert(appStoreConnectChecklist.suggestedAnswers?.review?.productionDeviceStatus === rowByLabel.PRODUCTION_DEVICE_TESTED?.status, 'App Store Connect checklist production device status should match release-status');
  assert(appStoreConnectChecklist.suggestedAnswers?.review?.runtimeUiFlowAudit === 'docs/runtime-ui-flow-audit.md', 'App Store Connect checklist review answer should reference runtime UI flow audit');
  assert(appStoreConnectChecklist.suggestedAnswers?.review?.runtimeUiFlowReady === true, 'App Store Connect checklist review answer should record runtime UI flow readiness');
  assert(sections.length >= 5, 'App Store Connect checklist should include the main manual sections');
  assert(fields.length >= 20, 'App Store Connect checklist should include enough manual fields');
  assert((appStoreConnectChecklist.officialReferences ?? []).some((entry) => entry.url === 'https://developer.apple.com/app-store/app-privacy-details/'), 'App Store Connect checklist should link Apple App Privacy Details');
  assert((appStoreConnectChecklist.officialReferences ?? []).some((entry) => entry.url === 'https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating/'), 'App Store Connect checklist should link Apple age rating setup');

  for (const expectedSection of ['app-record', 'app-information', 'pricing-availability', 'privacy-compliance', 'review-submission']) {
    assert(sections.some((section) => section.id === expectedSection), `App Store Connect checklist missing section: ${expectedSection}`);
  }

  const contentRightsField = fields.find((field) => field.label === 'Content rights');
  assert(contentRightsField?.status === 'READY', 'App Store Connect content rights field should be READY after the audit passes');
  assert((contentRightsField?.note ?? '').includes('docs/content-rights-audit.md'), 'App Store Connect content rights field should point to the audit');
  const ageRatingField = fields.find((field) => field.label === 'Age rating questionnaire');
  assert(ageRatingField?.status === 'READY', 'App Store Connect age rating field should be READY after the audit passes');
  assert((ageRatingField?.note ?? '').includes('docs/app-store-age-rating-audit.md'), 'App Store Connect age rating field should point to the audit');
  const studyDepthField = fields.find((field) => field.label === 'JLPT study depth');
  assert(studyDepthField?.status === 'READY', 'App Store Connect study depth field should be READY after the audit passes');
  assert((studyDepthField?.note ?? '').includes('docs/study-bank-depth-audit.md'), 'App Store Connect study depth field should point to the audit');
  const metadataUploadPacketField = fields.find((field) => field.label === 'Metadata upload packet');
  assert(metadataUploadPacketField?.status === 'READY', 'App Store Connect metadata upload packet field should be READY after the packet passes');
  assert((metadataUploadPacketField?.note ?? '').includes('docs/app-store-metadata-upload-packet.md'), 'App Store Connect metadata upload packet field should point to the packet');
  const studyContentLocalizationField = fields.find((field) => field.label === 'Study content localization');
  assert(studyContentLocalizationField?.status === 'READY', 'App Store Connect study content localization field should be READY after the audit passes');
  assert((studyContentLocalizationField?.note ?? '').includes('docs/study-content-localization-audit.md'), 'App Store Connect study content localization field should point to the audit');
  const runtimeUiFlowField = fields.find((field) => field.label === 'Runtime UI flow audit');
  assert(runtimeUiFlowField?.status === 'READY', 'App Store Connect runtime UI flow field should be READY after the audit passes');
  assert((runtimeUiFlowField?.value ?? '').includes(`${runtimeUiFlowRatio} runtime flows ready`), 'App Store Connect runtime UI flow field should expose passed runtime flow count');
  assert((runtimeUiFlowField?.note ?? '').includes('docs/runtime-ui-flow-audit.md'), 'App Store Connect runtime UI flow field should point to the audit');
  const privacyManifestField = fields.find((field) => field.label === 'Privacy manifest');
  assert(privacyManifestField?.status === 'READY', 'App Store Connect privacy manifest field should be READY after the audit passes');
  assert((privacyManifestField?.note ?? '').includes('docs/privacy-manifest-audit.md'), 'App Store Connect privacy manifest field should point to the audit');
  const privacyReviewPacketField = fields.find((field) => field.label === 'Privacy review packet');
  assert(privacyReviewPacketField?.status === 'READY', 'App Store Connect privacy review packet field should be READY after the packet passes');
  assert((privacyReviewPacketField?.note ?? '').includes('docs/privacy-review-packet.md'), 'App Store Connect privacy review packet field should point to the packet');
  const adMobReleaseField = fields.find((field) => field.label === 'AdMob release audit');
  assert(adMobReleaseField?.status === 'READY', 'App Store Connect AdMob release audit field should be READY after the audit passes');
  assert((adMobReleaseField?.note ?? '').includes('docs/admob-release-audit.md'), 'App Store Connect AdMob release audit field should point to the audit');
  const dataFlowField = fields.find((field) => field.label === 'Data flow privacy audit');
  assert(dataFlowField?.status === 'READY', 'App Store Connect data flow privacy audit field should be READY after the audit passes');
  assert((dataFlowField?.note ?? '').includes('docs/data-flow-privacy-audit.md'), 'App Store Connect data flow privacy audit field should point to the audit');
  const publicSiteHostingField = fields.find((field) => field.label === 'Public site hosting verification');
  assert(Boolean(publicSiteHostingField), 'App Store Connect checklist should include public site hosting verification field');
  assert((publicSiteHostingField?.note ?? '').includes('docs/public-site-hosting-verification.md'), 'App Store Connect public site hosting field should point to the verification');
  assert((publicSiteHostingField?.value ?? '').includes(`Status ${publicSiteHostingVerification.summary?.status}`), 'App Store Connect public site hosting field should expose verification status');
  const screenshotsField = fields.find((field) => field.label === 'Screenshots');
  assert(screenshotsField?.status === 'READY', 'App Store Connect screenshots field should be READY after screenshot QA passes');
  assert((screenshotsField?.value ?? '').includes('QA risk PASS'), 'App Store Connect screenshots field should expose screenshot QA risk');
  assert((screenshotsField?.note ?? '').includes('docs/screenshot-qa-audit.md'), 'App Store Connect screenshots field should point to screenshot QA audit');

  for (const expectedField of ['Age rating questionnaire', 'App Store copy audit', 'Metadata upload packet', 'Runtime UI flow audit', 'JLPT study depth', 'Study content localization', 'Content rights', 'Privacy manifest', 'Privacy review packet', 'AdMob release audit', 'Data flow privacy audit', 'Privacy Policy URL', 'Public site hosting verification', 'App Privacy details', 'Export compliance', 'Screenshots', 'Production device test']) {
    assert(fields.some((field) => field.label === expectedField), `App Store Connect checklist missing field: ${expectedField}`);
  }

  for (const snippet of [
    '# App Store Connect Checklist',
    'Apple App Privacy Details',
    'Localization audit',
    'docs/localization-audit.md',
    'Runtime UI flow audit',
    'docs/runtime-ui-flow-audit.md',
    'Runtime UI flow risk: PASS',
    'Runtime UI flow ready: Yes',
    `Runtime UI flow checks: ${runtimeUiFlowRatio}`,
    'Screenshot QA audit',
    'docs/screenshot-qa-audit.md',
    'Screenshot QA risk: PASS',
    'App Store copy audit',
    'docs/app-store-copy-audit.md',
    'App Store copy risk: PASS',
    'Metadata upload packet',
    'docs/app-store-metadata-upload-packet.md',
    'Metadata upload packet risk: PASS',
    'Public site deploy audit',
    'docs/public-site-deploy-audit.md',
    'Public site hosting verification',
    'docs/public-site-hosting-verification.md',
    `Public site hosting verification status: ${publicSiteHostingVerification.summary?.status}`,
    'Age rating questionnaire',
    'docs/app-store-age-rating-audit.md',
    '4+ candidate',
    'Study bank depth audit',
    'docs/study-bank-depth-audit.md',
    'JLPT study depth',
    'Study content localization',
    'docs/study-content-localization-audit.md',
    'Study content localization risk: PASS',
    'Content rights',
    'docs/content-rights-audit.md',
    'Privacy manifest',
    'docs/privacy-manifest-audit.md',
    'App Store privacy answers',
    'docs/app-store-privacy-answers.md',
    'Privacy answer current state',
    'Privacy review packet',
    'docs/privacy-review-packet.md',
    'Privacy review packet risk: PASS',
    'AdMob release audit',
    'docs/admob-release-audit.md',
    'Data flow privacy audit',
    'docs/data-flow-privacy-audit.md',
    'App-owned network request hits: 0',
    'Export compliance',
    'APP_STORE_PRIVACY_ANSWERS_REVIEWED',
    'npm run release:store-ready',
  ]) {
    assert(appStoreConnectChecklistDoc.includes(snippet), `App Store Connect checklist markdown missing: ${snippet}`);
  }
}

function screenshotManifestEntryCount() {
  return (
    (screenshotManifest.defaultPack?.screenshots ?? []).length +
    (screenshotManifest.localizedPacks ?? []).reduce((sum, pack) => sum + (pack.screenshots?.length ?? 0), 0)
  );
}

function verifyReleasePacket() {
  const totalScreenshotEntries =
    (screenshotManifest.defaultPack?.screenshots ?? []).length +
    (screenshotManifest.localizedPacks ?? []).reduce((sum, pack) => sum + (pack.screenshots?.length ?? 0), 0);
  const vocabCounts = countLevelEntries('vocab');
  const lineCounts = countLevelEntries('line');
  const grammarCounts = countLevelEntries('grammar', grammarDataSource);
  const packetRows = releasePacket.releaseStatus?.rows ?? [];
  const packetSummary = releasePacket.releaseStatus?.summary ?? {};
  const packetLocalRows = packetRows.filter((row) => row.category === 'local');
  const packetExternalRows = packetRows.filter((row) => row.category === 'external' && (row.status === 'TODO' || row.status === 'BAD'));

  assert(releasePacket.schemaVersion === 1, 'Release packet schemaVersion should be 1');
  assert(releasePacket.source === 'scripts/generate-release-packet.js', 'Release packet should name its generator');
  assert(releasePacket.app?.name === appJson.name, 'Release packet app name should match app.json');
  assert(releasePacket.app?.version === appJson.version, 'Release packet app version should match app.json');
  assert(releasePacket.app?.bundleIdentifier === appJson.ios?.bundleIdentifier, 'Release packet iOS bundle ID should match app.json');
  assert(releasePacket.app?.packageName === appJson.android?.package, 'Release packet Android package should match app.json');
  assert(releasePacket.app?.expo === packageJson.dependencies?.expo, 'Release packet Expo dependency should match package.json');
  assert(releasePacket.app?.reactNative === packageJson.dependencies?.['react-native'], 'Release packet React Native dependency should match package.json');
  sameSet(releasePacket.localization?.appLocales ?? [], expectedLocales, 'Release packet app locales');
  sameSet(releasePacket.localization?.appStoreLocales ?? [], Object.values(expectedAppleLocales), 'Release packet App Store locales');
  assert(releasePacket.localization?.japaneseUiLocaleRemoved === true, 'Release packet should record that Japanese UI localization is removed');

  assert(releasePacket.content?.studyBank?.kana === 92, 'Release packet should record 92 kana prompts');
  assert(releasePacket.content?.studyBank?.totalVocabulary === Object.values(vocabCounts).reduce((sum, count) => sum + count, 0), 'Release packet total vocabulary count should match study data');
  assert(releasePacket.content?.studyBank?.totalLines === Object.values(lineCounts).reduce((sum, count) => sum + count, 0), 'Release packet total line count should match study data');
  assert(releasePacket.content?.studyBank?.totalGrammar === Object.values(grammarCounts).reduce((sum, count) => sum + count, 0), 'Release packet total grammar count should match study data');
  sameSet(releasePacket.content?.modes ?? [], ['mix', 'kana', 'vocab', 'lines', 'grammar'], 'Release packet game modes');
  sameSet(Object.keys(releasePacket.content?.studyBank?.levels ?? {}), expectedJlptLevels, 'Release packet JLPT level stats');

  for (const level of expectedJlptLevels) {
    const stats = releasePacket.content?.studyBank?.levels?.[level] ?? {};
    assert(stats.kana === (level === 'N5' ? 92 : 0), `Release packet ${level} kana count mismatch`);
    assert(stats.vocab === (vocabCounts[level] ?? 0), `Release packet ${level} vocabulary count mismatch`);
    assert(stats.lines === (lineCounts[level] ?? 0), `Release packet ${level} line count mismatch`);
    assert(stats.grammar === (grammarCounts[level] ?? 0), `Release packet ${level} grammar count mismatch`);
  }

  assert(releasePacket.content?.originalAnimeStyleLines === true, 'Release packet should record original anime-style line posture');
  assert(releasePacket.content?.studyBankDepthVerified === true, 'Release packet should record passing study-bank depth verification');
  assert(releasePacket.content?.studyContentLocalizationVerified === true, 'Release packet should record passing study-content localization verification');
  assert(releasePacket.content?.noKnownProtectedIpReferences === true, 'Release packet should record protected-IP scan posture');
  assert(releasePacket.artifacts?.runtimeAssetManifest?.pngAssets === runtimeAssetManifest.summary?.pngCount, 'Release packet runtime PNG asset count should match manifest');
  assert(releasePacket.artifacts?.runtimeAssetManifest?.audioAssets === runtimeAssetManifest.summary?.audioCount, 'Release packet runtime audio asset count should match manifest');
  assert(releasePacket.artifacts?.runtimeAssetManifest?.bytes === runtimeAssetManifest.summary?.totalBytes, 'Release packet runtime asset byte count should match manifest');
  assert(releasePacket.artifacts?.runtimeUiFlowAudit?.path === 'docs/runtime-ui-flow-audit.md', 'Release packet should reference the runtime UI flow audit');
  assert(releasePacket.artifacts?.runtimeUiFlowAudit?.risk === 'PASS', 'Release packet should record passing runtime UI flow risk');
  assert(releasePacket.artifacts?.runtimeUiFlowAudit?.localReady === true, 'Release packet should record runtime UI flow readiness');
  assert(releasePacket.artifacts?.runtimeUiFlowAudit?.checks === runtimeUiFlowAudit.summary?.checks, 'Release packet runtime UI flow check count should match audit');
  assert(releasePacket.artifacts?.runtimeUiFlowAudit?.passedChecks === runtimeUiFlowAudit.summary?.passedChecks, 'Release packet runtime UI flow passed count should match audit');
  assert(releasePacket.artifacts?.runtimeUiFlowAudit?.requiredFlowFailures === 0, 'Release packet should record zero runtime UI flow failures');
  assert(releasePacket.artifacts?.runtimeUiFlowAudit?.locales === expectedLocales.length, 'Release packet runtime UI flow locale count should match expected locales');
  assert(releasePacket.artifacts?.runtimeUiFlowAudit?.levels === expectedJlptLevels.length, 'Release packet runtime UI flow level count should match expected levels');
  assert(releasePacket.artifacts?.runtimeUiFlowAudit?.modes === 5, 'Release packet runtime UI flow mode count should match the app modes');
  assert(releasePacket.artifacts?.publicSiteManifest?.pages === publicSiteManifest.pageCount, 'Release packet public site count should match manifest');
  assert(releasePacket.artifacts?.publicSiteDeployAudit?.path === 'docs/public-site-deploy-audit.md', 'Release packet should reference the public site deploy audit');
  assert(releasePacket.artifacts?.publicSiteDeployAudit?.risk === publicSiteDeployAudit.summary?.risk, 'Release packet should record public site deploy audit risk');
  assert(releasePacket.artifacts?.publicSiteDeployAudit?.localReady === true, 'Release packet should record local public site deploy readiness');
  assert(releasePacket.artifacts?.publicSiteDeployAudit?.hostingReady === publicSiteDeployAudit.summary?.hostingReady, 'Release packet should record public site hosting readiness');
  assert(releasePacket.artifacts?.publicSiteDeployAudit?.routes === publicSiteManifest.pageCount, 'Release packet should record public site deploy route count');
  assert(releasePacket.artifacts?.publicSiteDeployAudit?.supportUrlReady === publicSiteDeployAudit.summary?.supportUrlReady, 'Release packet should record support URL readiness');
  assert(releasePacket.artifacts?.publicSiteDeployAudit?.privacyUrlReady === publicSiteDeployAudit.summary?.privacyUrlReady, 'Release packet should record privacy URL readiness');
  assert(releasePacket.artifacts?.publicSiteHostingVerification?.path === 'docs/public-site-hosting-verification.md', 'Release packet should reference public site hosting verification');
  assert(releasePacket.artifacts?.publicSiteHostingVerification?.status === publicSiteHostingVerification.summary?.status, 'Release packet should record public site hosting verification status');
  assert(releasePacket.artifacts?.publicSiteHostingVerification?.ready === publicSiteHostingVerification.summary?.ready, 'Release packet should record public site hosting verification readiness');
  assert(releasePacket.artifacts?.publicSiteHostingVerification?.checkedUrls === publicSiteHostingVerification.summary?.checkedUrls, 'Release packet should record public site hosting checked URL count');
  assert(releasePacket.artifacts?.publicSiteHostingVerification?.passedUrls === publicSiteHostingVerification.summary?.passedUrls, 'Release packet should record public site hosting passed URL count');
  assert(releasePacket.artifacts?.publicSiteHostingVerification?.failedUrls === publicSiteHostingVerification.summary?.failedUrls, 'Release packet should record public site hosting failed URL count');
  assert(releasePacket.artifacts?.publicSiteHostingVerification?.hasProductionBaseUrl === publicSiteHostingVerification.summary?.hasProductionBaseUrl, 'Release packet should record public site production base URL state');
  assert(releasePacket.artifacts?.screenshotManifest?.entries === totalScreenshotEntries, 'Release packet screenshot count should match manifest');
  assert(releasePacket.artifacts?.screenshotQaAudit?.path === 'docs/screenshot-qa-audit.md', 'Release packet should reference the screenshot QA audit');
  assert(releasePacket.artifacts?.screenshotQaAudit?.risk === 'PASS', 'Release packet should record passing screenshot QA risk');
  assert(releasePacket.artifacts?.screenshotQaAudit?.entries === totalScreenshotEntries, 'Release packet screenshot QA count should match manifest');
  assert(releasePacket.artifacts?.screenshotQaAudit?.allScreenshotsReady === true, 'Release packet should record screenshot QA readiness');
  assert(releasePacket.artifacts?.screenshotQaAudit?.localizedNonEnglishDistinctFromDefault === true, 'Release packet should record localized screenshot distinction');
  assert(releasePacket.artifacts?.screenshotQaAudit?.unexpectedDuplicateGroups === 0, 'Release packet should record zero unexpected screenshot duplicates');
  assert(releasePacket.artifacts?.metadataPreview?.locales === metadataPreview.locales?.length, 'Release packet metadata locale count should match preview');
  assert(releasePacket.artifacts?.appStoreCopyAudit?.path === 'docs/app-store-copy-audit.md', 'Release packet should reference the App Store copy audit');
  assert(releasePacket.artifacts?.appStoreCopyAudit?.risk === appStoreCopyAudit.summary?.risk, 'Release packet App Store copy audit risk should match copy audit');
  assert(releasePacket.artifacts?.appStoreCopyAudit?.readyLocales === appStoreCopyAudit.summary?.readyLocales, 'Release packet App Store copy ready locale count should match copy audit');
  assert(releasePacket.artifacts?.appStoreCopyAudit?.keywordsByteLimitReady === true, 'Release packet should record App Store copy keyword byte readiness');
  assert(releasePacket.artifacts?.appStoreCopyAudit?.noProtectedTermHits === true, 'Release packet should record App Store copy protected-term readiness');
  assert(releasePacket.artifacts?.metadataUploadPacket?.path === 'docs/app-store-metadata-upload-packet.md', 'Release packet should reference the App Store metadata upload packet');
  assert(releasePacket.artifacts?.metadataUploadPacket?.risk === metadataUploadPacket.summary?.risk, 'Release packet metadata upload packet risk should match packet');
  assert(releasePacket.artifacts?.metadataUploadPacket?.localReady === true, 'Release packet should record metadata upload packet local readiness');
  assert(releasePacket.artifacts?.metadataUploadPacket?.locales === metadataUploadPacket.summary?.locales, 'Release packet metadata upload packet locale count should match packet');
  assert(releasePacket.artifacts?.metadataUploadPacket?.fieldReadyLocales === metadataUploadPacket.summary?.fieldReadyLocales, 'Release packet metadata upload packet field-ready count should match packet');
  assert(releasePacket.artifacts?.metadataUploadPacket?.screenshotReadyLocales === metadataUploadPacket.summary?.screenshotReadyLocales, 'Release packet metadata upload packet screenshot-ready count should match packet');
  assert(releasePacket.artifacts?.metadataUploadPacket?.supportUrlReadyLocales === metadataUploadPacket.summary?.supportUrlReadyLocales, 'Release packet metadata upload packet support URL count should match packet');
  assert(releasePacket.artifacts?.metadataUploadPacket?.privacyUrlReadyLocales === metadataUploadPacket.summary?.privacyUrlReadyLocales, 'Release packet metadata upload packet privacy URL count should match packet');
  assert(releasePacket.artifacts?.metadataUploadPacket?.copyAuditRisk === appStoreCopyAudit.summary?.risk, 'Release packet metadata upload packet copy audit risk should match copy audit');
  assert(releasePacket.artifacts?.localizationAudit?.path === 'docs/localization-audit.md', 'Release packet should reference the localization audit');
  assert(releasePacket.artifacts?.localizationAudit?.risk === 'PASS', 'Release packet should record passing localization audit risk');
  assert(releasePacket.artifacts?.localizationAudit?.uiLocales === expectedLocales.length, 'Release packet should record localization UI locale count');
  assert(releasePacket.artifacts?.localizationAudit?.appStoreLocales === expectedLocales.length, 'Release packet should record localization App Store locale count');
  assert(releasePacket.artifacts?.localizationAudit?.localizedScreenshotEntries === expectedLocales.length * Object.keys(expectedStoreScreenshots).length * expectedStoreScreenshotFiles.length, 'Release packet should record localized screenshot entries');
  assert(releasePacket.artifacts?.localizationAudit?.publicSitePages === publicSiteManifest.pageCount, 'Release packet should record localized public site pages');
  assert(releasePacket.artifacts?.localizationAudit?.japaneseUiLocaleRemoved === true, 'Release packet should record Japanese UI locale removal');
  assert(releasePacket.artifacts?.reviewGuide?.demoAccountRequired === false, 'Release packet should state no demo account is required');
  assert(releasePacket.artifacts?.reviewGuide?.signInRequired === false, 'Release packet should state sign-in is not required');
  assert(releasePacket.artifacts?.ageRatingAudit?.path === 'docs/app-store-age-rating-audit.md', 'Release packet should reference the age rating audit');
  assert(releasePacket.artifacts?.ageRatingAudit?.risk === 'PASS', 'Release packet should record passing age rating audit risk');
  assert(releasePacket.artifacts?.ageRatingAudit?.suggestedAppleGlobalRating === '4+ candidate', 'Release packet should record suggested Apple global age rating');
  assert(releasePacket.artifacts?.ageRatingAudit?.frequencyNoneAnswers === 12, 'Release packet should record age rating NONE answers');
  assert(releasePacket.artifacts?.ageRatingAudit?.frequencyQuestions === 12, 'Release packet should record age rating question count');
  assert(releasePacket.artifacts?.ageRatingAudit?.finalRatingSource === 'App Store Connect age rating questionnaire', 'Release packet should record age rating final source');
  assert(releasePacket.artifacts?.studyBankDepthAudit?.path === 'docs/study-bank-depth-audit.md', 'Release packet should reference the study bank depth audit');
  assert(releasePacket.artifacts?.studyBankDepthAudit?.risk === 'PASS', 'Release packet should record passing study bank depth audit risk');
  assert(releasePacket.artifacts?.studyBankDepthAudit?.levels === expectedJlptLevels.length, 'Release packet should record study bank depth level count');
  assert(releasePacket.artifacts?.studyBankDepthAudit?.topicFamilies === studyBankDepthAudit.summary?.totalTopics, 'Release packet should record study bank topic families');
  assert(releasePacket.artifacts?.studyBankDepthAudit?.playableMeaningPrompts === studyBankDepthAudit.summary?.playableMeaningPrompts, 'Release packet should record playable meaning prompts');
  assert(releasePacket.artifacts?.studyBankDepthAudit?.difficultyProgressionPassed === true, 'Release packet should record passing difficulty progression');
  assert(releasePacket.artifacts?.studyContentLocalizationAudit?.path === 'docs/study-content-localization-audit.md', 'Release packet should reference the study content localization audit');
  assert(releasePacket.artifacts?.studyContentLocalizationAudit?.risk === 'PASS', 'Release packet should record passing study content localization risk');
  assert(releasePacket.artifacts?.studyContentLocalizationAudit?.locales === expectedLocales.length, 'Release packet should record study content locale count');
  assert(releasePacket.artifacts?.studyContentLocalizationAudit?.studyItems === studyContentLocalizationAudit.summary?.totalStudyItems, 'Release packet should record study content item count');
  assert(releasePacket.artifacts?.studyContentLocalizationAudit?.studyTextKeys === studyContentLocalizationAudit.summary?.studyTextKeys, 'Release packet should record study content text key count');
  assert(releasePacket.artifacts?.studyContentLocalizationAudit?.localizedFieldsReady === studyContentLocalizationAudit.summary?.localizedFieldsReady, 'Release packet should record localized study field count');
  assert(releasePacket.artifacts?.studyContentLocalizationAudit?.expectedLocalizedFields === studyContentLocalizationAudit.summary?.expectedLocalizedFields, 'Release packet should record expected localized study field count');
  assert(releasePacket.artifacts?.studyContentLocalizationAudit?.contentTranslationEntriesReady === studyContentLocalizationAudit.summary?.contentTranslationEntriesReady, 'Release packet should record content translation entry count');
  assert(releasePacket.artifacts?.studyContentLocalizationAudit?.expectedContentTranslationEntries === studyContentLocalizationAudit.summary?.expectedContentTranslationEntries, 'Release packet should record expected content translation entry count');
  assert(releasePacket.artifacts?.studyContentLocalizationAudit?.missingLocalizedFields === 0, 'Release packet should record zero missing localized fields');
  assert(releasePacket.artifacts?.studyContentLocalizationAudit?.missingTranslationEntries === 0, 'Release packet should record zero missing content translations');
  assert(releasePacket.artifacts?.contentRightsAudit?.path === 'docs/content-rights-audit.md', 'Release packet should reference the content rights audit');
  assert(releasePacket.artifacts?.contentRightsAudit?.risk === 'PASS', 'Release packet should record passing content rights audit risk');
  assert(releasePacket.artifacts?.contentRightsAudit?.protectedIpTermHits === 0, 'Release packet should record zero protected-IP hits');
  assert(releasePacket.artifacts?.contentRightsAudit?.originalAnimeStyleLinePrompts === contentRightsAudit.summary?.originalAnimeStyleLinePrompts, 'Release packet content rights line count should match audit');
  assert(releasePacket.artifacts?.openSourceLicenseAudit?.path === 'docs/open-source-license-audit.md', 'Release packet should reference the open source license audit');
  assert(releasePacket.artifacts?.openSourceLicenseAudit?.risk === openSourceLicenseAudit.summary?.risk, 'Release packet open source license risk should match audit');
  assert(releasePacket.artifacts?.openSourceLicenseAudit?.runtimePackages === openSourceLicenseAudit.summary?.runtimePackages, 'Release packet open source runtime package count should match audit');
  assert(releasePacket.artifacts?.openSourceLicenseAudit?.unknownRuntimeLicenses === 0, 'Release packet should record zero unknown runtime licenses');
  assert(releasePacket.artifacts?.openSourceLicenseAudit?.prohibitedRuntimeLicenses === 0, 'Release packet should record zero prohibited runtime licenses');
  assert(releasePacket.artifacts?.openSourceLicenseAudit?.reviewRuntimeLicenses === openSourceLicenseAudit.summary?.reviewRuntimeLicenses, 'Release packet open source review count should match audit');
  assert(releasePacket.artifacts?.privacyManifestAudit?.path === 'docs/privacy-manifest-audit.md', 'Release packet should reference the privacy manifest audit');
  assert(releasePacket.artifacts?.privacyManifestAudit?.risk === 'PASS', 'Release packet should record passing privacy manifest audit risk');
  assert(releasePacket.artifacts?.privacyManifestAudit?.tracking === false, 'Release packet should record no tracking in privacy manifest audit');
  assert(releasePacket.artifacts?.privacyManifestAudit?.collectedDataTypes === 0, 'Release packet should record zero collected data types in privacy manifest audit');
  assert(releasePacket.artifacts?.privacyManifestAudit?.requiredReasonApisReady === true, 'Release packet should record required reason APIs ready');
  assert(releasePacket.artifacts?.privacyAnswers?.path === 'docs/app-store-privacy-answers.md', 'Release packet should reference the App Store privacy answer pack');
  assert(releasePacket.artifacts?.privacyAnswers?.risk === privacyAnswers.summary?.risk, 'Release packet should record privacy answer pack risk');
  assert(releasePacket.artifacts?.privacyAnswers?.currentState === privacyAnswers.summary?.currentState, 'Release packet should record privacy answer current state');
  assert(releasePacket.artifacts?.privacyAnswers?.appCodeCollectsPersonalData === false, 'Release packet should record no app-code personal data collection');
  assert(releasePacket.artifacts?.privacyAnswers?.noLiveAdsRows === (privacyAnswers.noLiveAdsAnswers?.appStoreConnect ?? []).length, 'Release packet should record no-live-ads privacy row count');
  assert(releasePacket.artifacts?.privacyAnswers?.liveAdMobDisclosureRows === (privacyAnswers.liveAdMobAnswers?.likelyGoogleMobileAdsDataTypes ?? []).length, 'Release packet should record live-AdMob disclosure row count');
  assert(releasePacket.artifacts?.privacyAnswers?.confirmationEnv === 'APP_STORE_PRIVACY_ANSWERS_REVIEWED', 'Release packet should record privacy answer confirmation env');
  assert(releasePacket.artifacts?.privacyReviewPacket?.path === 'docs/privacy-review-packet.md', 'Release packet should reference the privacy review packet');
  assert(releasePacket.artifacts?.privacyReviewPacket?.risk === privacyReviewPacket.summary?.risk, 'Release packet should record privacy review packet risk');
  assert(releasePacket.artifacts?.privacyReviewPacket?.localReady === true, 'Release packet should record privacy review packet readiness');
  assert(releasePacket.artifacts?.privacyReviewPacket?.currentState === privacyReviewPacket.summary?.currentState, 'Release packet should record privacy review packet current state');
  assert(releasePacket.artifacts?.privacyReviewPacket?.finalReviewConfirmed === privacyReviewPacket.summary?.finalReviewConfirmed, 'Release packet should record privacy review final confirmation');
  assert(releasePacket.artifacts?.privacyReviewPacket?.noLiveAdsSuggestedRows === privacyReviewPacket.summary?.noLiveAdsSuggestedRows, 'Release packet should record privacy review no-live row count');
  assert(releasePacket.artifacts?.privacyReviewPacket?.liveAdMobDisclosureRows === privacyReviewPacket.summary?.liveAdMobDisclosureRows, 'Release packet should record privacy review live-AdMob row count');
  assert(releasePacket.artifacts?.privacyReviewPacket?.appOwnedNetworkRequests === 0, 'Release packet should record zero privacy review app-owned network hits');
  assert(releasePacket.artifacts?.privacyReviewPacket?.analyticsSdkCount === 0, 'Release packet should record zero privacy review analytics SDK hits');
  assert(releasePacket.artifacts?.privacyReviewPacket?.authSdkCount === 0, 'Release packet should record zero privacy review auth SDK hits');
  assert(releasePacket.artifacts?.privacyReviewPacket?.userContentEntryCount === 0, 'Release packet should record zero privacy review user-content entries');
  assert(releasePacket.artifacts?.admobReleaseAudit?.path === 'docs/admob-release-audit.md', 'Release packet should reference the AdMob release audit');
  assert(releasePacket.artifacts?.admobReleaseAudit?.risk === admobReleaseAudit.summary?.risk, 'Release packet should record AdMob release audit risk');
  assert(releasePacket.artifacts?.admobReleaseAudit?.currentState === admobReleaseAudit.summary?.currentState, 'Release packet should record AdMob release state');
  assert(releasePacket.artifacts?.admobReleaseAudit?.localReady === true, 'Release packet should record local AdMob readiness');
  assert(releasePacket.artifacts?.admobReleaseAudit?.liveAdsReady === admobReleaseAudit.summary?.liveAdsReady, 'Release packet should record live ads readiness');
  assert(releasePacket.artifacts?.admobReleaseAudit?.externalReady === admobReleaseAudit.summary?.externalReady, 'Release packet should record external AdMob setup readiness');
  assert(releasePacket.artifacts?.admobReleaseAudit?.externalBlockingItems === admobReleaseAudit.summary?.externalBlockingItems, 'Release packet should record AdMob external blocker count');
  assert(releasePacket.artifacts?.dataFlowPrivacyAudit?.path === 'docs/data-flow-privacy-audit.md', 'Release packet should reference the data flow privacy audit');
  assert(releasePacket.artifacts?.dataFlowPrivacyAudit?.risk === dataFlowPrivacyAudit.summary?.risk, 'Release packet should record data flow privacy audit risk');
  assert(releasePacket.artifacts?.dataFlowPrivacyAudit?.localReady === true, 'Release packet should record local data-flow privacy readiness');
  assert(releasePacket.artifacts?.dataFlowPrivacyAudit?.appOwnedNetworkRequests === 0, 'Release packet should record zero app-owned network hits');
  assert(releasePacket.artifacts?.dataFlowPrivacyAudit?.analyticsSdkCount === 0, 'Release packet should record zero analytics SDKs');
  assert(releasePacket.artifacts?.dataFlowPrivacyAudit?.authSdkCount === 0, 'Release packet should record zero auth SDKs');
  assert(releasePacket.artifacts?.dataFlowPrivacyAudit?.userContentEntryCount === 0, 'Release packet should record zero user-content entries');
  assert(releasePacket.artifacts?.dataFlowPrivacyAudit?.localStorageKeys === 2, 'Release packet should record two local storage keys');
  assert(releasePacket.artifacts?.productionSmokeTest?.path === 'docs/production-device-smoke-test.md', 'Release packet should reference the production device smoke test checklist');
  assert(releasePacket.artifacts?.productionSmokeTest?.sections === (productionSmokeTest.sections ?? []).length, 'Release packet production smoke section count should match checklist');
  assert(releasePacket.artifacts?.productionSmokeTest?.items === (productionSmokeTest.sections ?? []).reduce((sum, section) => sum + (section.items?.length ?? 0), 0), 'Release packet production smoke item count should match checklist');
  assert(releasePacket.artifacts?.productionSmokeTest?.finalConfirmation === 'PRODUCTION_DEVICE_TESTED', 'Release packet should record the production smoke final confirmation env');
  assert(releasePacket.artifacts?.externalReadiness?.path === 'docs/external-readiness.md', 'Release packet should reference the external readiness checklist');
  assert(releasePacket.artifacts?.externalReadiness?.items === externalReadiness.summary?.total, 'Release packet external readiness item count should match checklist');
  assert(releasePacket.artifacts?.externalReadiness?.blocking === externalReadiness.summary?.blocking, 'Release packet external readiness blocking count should match checklist');
  assert(releasePacket.artifacts?.easEnvironment?.path === 'docs/eas-env-checklist.md', 'Release packet should reference the EAS environment checklist');
  assert(releasePacket.artifacts?.easEnvironment?.keys === easEnvChecklist.summary?.totalKeys, 'Release packet EAS environment key count should match checklist');
  assert(releasePacket.artifacts?.easEnvironment?.requiredForEasProduction === easEnvChecklist.summary?.requiredForEasProduction, 'Release packet EAS production key count should match checklist');
  assert(releasePacket.artifacts?.easEnvironment?.productionProfileEnvironment === 'production', 'Release packet should record the EAS production environment');
  assert(releasePacket.artifacts?.easBuildPreflight?.path === 'docs/eas-build-preflight.md', 'Release packet should reference the EAS build preflight');
  assert(releasePacket.artifacts?.easBuildPreflight?.risk === 'PASS', 'Release packet should record passing EAS build preflight risk');
  assert(releasePacket.artifacts?.easBuildPreflight?.localReady === true, 'Release packet should record local EAS readiness');
  assert(releasePacket.artifacts?.easBuildPreflight?.externalReady === easBuildPreflight.summary?.externalReady, 'Release packet should record EAS external readiness');
  assert(releasePacket.artifacts?.easBuildPreflight?.productionProfileReady === true, 'Release packet should record production profile readiness');
  assert(releasePacket.artifacts?.easBuildPreflight?.submitProfileReady === true, 'Release packet should record submit profile readiness');
  assert(releasePacket.artifacts?.easBuildPreflight?.uploadPolicyReady === true, 'Release packet should record EAS upload policy readiness');
  assert(releasePacket.artifacts?.easBuildPreflight?.externalBlockingItems === easBuildPreflight.summary?.externalBlockingItems, 'Release packet should record EAS external blocker count');
  assert(releasePacket.artifacts?.appStoreConnectChecklist?.path === 'docs/app-store-connect-checklist.md', 'Release packet should reference the App Store Connect checklist');
  assert(releasePacket.artifacts?.appStoreConnectChecklist?.sections === (appStoreConnectChecklist.sections ?? []).length, 'Release packet App Store Connect section count should match checklist');
  assert(releasePacket.artifacts?.appStoreConnectChecklist?.fields === (appStoreConnectChecklist.sections ?? []).reduce((sum, section) => sum + (section.fields?.length ?? 0), 0), 'Release packet App Store Connect field count should match checklist');

  assert(packetSummary.ok === packetRows.filter((row) => row.status === 'OK').length, 'Release packet OK count should match status rows');
  assert(packetSummary.todo === packetRows.filter((row) => row.status === 'TODO').length, 'Release packet TODO count should match status rows');
  assert(packetSummary.bad === packetRows.filter((row) => row.status === 'BAD').length, 'Release packet BAD count should match status rows');
  assert(packetSummary.info === packetRows.filter((row) => row.status === 'INFO').length, 'Release packet INFO count should match status rows');
  assert(packetSummary.categories?.local?.ok === packetLocalRows.filter((row) => row.status === 'OK').length, 'Release packet local OK count should match local status rows');
  assert((releasePacket.localEvidence ?? []).length === packetLocalRows.length, 'Release packet local evidence should match local status rows');
  assert((releasePacket.localBlockers ?? []).length === packetLocalRows.filter((row) => row.status === 'TODO' || row.status === 'BAD').length, 'Release packet local blockers should match local status rows');
  assert((releasePacket.externalBlockers ?? []).length === packetExternalRows.length, 'Release packet external blockers should match TODO/BAD rows');
  assert(releasePacket.commands?.verify === 'npm run release:verify', 'Release packet should include release:verify command');
  assert(releasePacket.commands?.strictGate === 'npm run release:store-ready', 'Release packet should include release:store-ready command');

  for (const snippet of [
    '# Kana Sprint Release Packet',
    'Japanese UI locale removed: Yes',
    `Runtime assets: ${runtimeAssetManifest.summary?.pngCount} PNG / ${runtimeAssetManifest.summary?.audioCount} audio`,
    `Runtime UI flow audit: PASS, ready=yes, checks=${runtimeUiFlowRatio}, failures=0`,
    `Public site pages: ${publicSiteManifest.pageCount}`,
    `Public site deploy audit: ${publicSiteDeployAudit.summary?.risk}`,
    `Public site hosting verification: ${publicSiteHostingVerification.summary?.status}`,
    `App Store screenshots: ${totalScreenshotEntries}`,
    'Screenshot QA audit: PASS, ready=yes, localized distinct=yes',
    'App Store copy audit: PASS, 10/10 locales',
    'App Store metadata upload packet: PASS',
    `fields=${metadataUploadPacket.summary?.fieldReadyLocales}/${metadataUploadPacket.summary?.locales}`,
    'Localization audit: PASS, 10 UI locales / 10 App Store locales / 160 localized screenshots',
    'Age rating audit: PASS, 4+ candidate, 12/12 NONE answers',
    `Study bank depth audit: ${studyBankDepthAudit.summary?.risk}`,
    `Study content localization audit: ${studyContentLocalizationAudit.summary?.risk}`,
    `fields=${studyContentLocalizationAudit.summary?.localizedFieldsReady}/${studyContentLocalizationAudit.summary?.expectedLocalizedFields}`,
    `translations=${studyContentLocalizationAudit.summary?.contentTranslationEntriesReady}/${studyContentLocalizationAudit.summary?.expectedContentTranslationEntries}`,
    'Content rights audit: PASS, 0 protected-IP hits',
    `Open source license audit: ${openSourceLicenseAudit.summary?.risk}`,
    'Privacy manifest audit: PASS, tracking=no, collected data types=0',
    `App Store privacy answers: PASS, state=${privacyAnswers.summary?.currentState}`,
    `Privacy review packet: PASS, ready=yes, state=${privacyReviewPacket.summary?.currentState}`,
    `AdMob release audit: ${admobReleaseAudit.summary?.risk}`,
    `Data flow privacy audit: ${dataFlowPrivacyAudit.summary?.risk}`,
    'Production device smoke test:',
    `External readiness: ${externalReadiness.summary?.total} items / ${externalReadiness.summary?.blocking} blocking`,
    `EAS environment: ${easEnvChecklist.summary?.totalKeys} keys / ${easEnvChecklist.summary?.requiredForEasProduction} production-build values`,
    `EAS build preflight: ${easBuildPreflight.summary?.risk}`,
    'App Store Connect checklist:',
    'Local Release Evidence',
    'JLPT N5-N1 study bank',
    'External Items Before Store Submission',
    'Final Command Order',
  ]) {
    assert(releasePacketDoc.includes(snippet), `Release packet markdown missing: ${snippet}`);
  }
}

function verifyEasSubmissionChecklist() {
  const totalScreenshotEntries =
    (screenshotManifest.defaultPack?.screenshots ?? []).length +
    (screenshotManifest.localizedPacks ?? []).reduce((sum, pack) => sum + (pack.screenshots?.length ?? 0), 0);
  const rows = easSubmissionChecklist.blockers ?? [];
  const summary = easSubmissionChecklist.status ?? {};
  const localEvidence = easSubmissionChecklist.localEvidence ?? [];

  assert(easSubmissionChecklist.schemaVersion === 1, 'EAS submission checklist schemaVersion should be 1');
  assert(easSubmissionChecklist.source === 'scripts/generate-eas-submission-checklist.js', 'EAS submission checklist should name its generator');
  assert(easSubmissionChecklist.app?.name === appJson.name, 'EAS submission checklist app name should match app.json');
  assert(easSubmissionChecklist.app?.version === appJson.version, 'EAS submission checklist app version should match app.json');
  assert(easSubmissionChecklist.app?.bundleIdentifier === appJson.ios?.bundleIdentifier, 'EAS submission checklist bundle ID should match app.json');
  assert(easSubmissionChecklist.app?.buildNumber === appJson.ios?.buildNumber, 'EAS submission checklist iOS build number should match app.json');
  assert(easSubmissionChecklist.app?.packageName === appJson.android?.package, 'EAS submission checklist Android package should match app.json');
  assert(easSubmissionChecklist.eas?.cliVersion === easJson.cli?.version, 'EAS submission checklist CLI version should match eas.json');
  assert(easSubmissionChecklist.eas?.appVersionSource === 'remote', 'EAS submission checklist should record remote appVersionSource');
  assert(easSubmissionChecklist.eas?.productionBuild?.autoIncrement === true, 'EAS submission checklist should record production autoIncrement');
  assert(easSubmissionChecklist.eas?.productionBuild?.environment === 'production', 'EAS submission checklist should record production environment');
  assert(easSubmissionChecklist.eas?.productionBuild?.command === packageJson.scripts?.['build:ios'], 'EAS submission checklist build command should match package.json');
  assert(easSubmissionChecklist.eas?.productionSubmit?.metadataPath === './store.config.js', 'EAS submission checklist metadata path should match eas.json');
  assert(easSubmissionChecklist.eas?.productionSubmit?.command === packageJson.scripts?.['submit:ios'], 'EAS submission checklist submit command should match package.json');
  assert(easSubmissionChecklist.eas?.metadataCommand === packageJson.scripts?.['metadata:ios'], 'EAS submission checklist metadata command should match package.json');
  assert(easSubmissionChecklist.eas?.remoteVersionCommand === 'npx eas-cli build:version:set', 'EAS submission checklist should include the remote version initialization command');
  assert(easSubmissionChecklist.eas?.buildPreflight?.path === 'docs/eas-build-preflight.md', 'EAS submission checklist should reference EAS build preflight in EAS section');
  assert(easSubmissionChecklist.eas?.buildPreflight?.risk === easBuildPreflight.summary?.risk, 'EAS submission checklist build preflight risk should match audit');
  assert(easSubmissionChecklist.eas?.buildPreflight?.localReady === easBuildPreflight.summary?.localReady, 'EAS submission checklist local EAS readiness should match audit');
  assert(easSubmissionChecklist.eas?.buildPreflight?.externalReady === easBuildPreflight.summary?.externalReady, 'EAS submission checklist external EAS readiness should match audit');
  assert(easSubmissionChecklist.eas?.buildPreflight?.uploadPolicyReady === easBuildPreflight.uploadPolicy?.ready, 'EAS submission checklist upload policy readiness should match audit');
  assert(easSubmissionChecklist.eas?.buildPreflight?.externalBlockingItems === easBuildPreflight.summary?.externalBlockingItems, 'EAS submission checklist external blocker count should match audit');
  assert(easSubmissionChecklist.evidence?.releasePacket === 'docs/release-packet.json', 'EAS submission checklist should reference release packet evidence');
  assert(easSubmissionChecklist.evidence?.runtimeAssetManifest === 'docs/runtime-asset-manifest.json', 'EAS submission checklist should reference runtime asset manifest evidence');
  assert(easSubmissionChecklist.evidence?.runtimeUiFlowAudit === 'docs/runtime-ui-flow-audit.md', 'EAS submission checklist should reference runtime UI flow audit evidence');
  assert(easSubmissionChecklist.evidence?.metadataPreview === 'docs/app-store-metadata-preview.json', 'EAS submission checklist should reference metadata preview evidence');
  assert(easSubmissionChecklist.evidence?.appStoreCopyAudit === 'docs/app-store-copy-audit.md', 'EAS submission checklist should reference App Store copy audit evidence');
  assert(easSubmissionChecklist.evidence?.metadataUploadPacket === 'docs/app-store-metadata-upload-packet.md', 'EAS submission checklist should reference metadata upload packet evidence');
  assert(easSubmissionChecklist.evidence?.localizationAudit === 'docs/localization-audit.md', 'EAS submission checklist should reference localization audit evidence');
  assert(easSubmissionChecklist.evidence?.publicSiteDeployAudit === 'docs/public-site-deploy-audit.md', 'EAS submission checklist should reference public site deploy audit evidence');
  assert(easSubmissionChecklist.evidence?.publicSiteHostingVerification === 'docs/public-site-hosting-verification.md', 'EAS submission checklist should reference public site hosting verification evidence');
  assert(easSubmissionChecklist.evidence?.reviewGuide === 'docs/app-store-review-guide.md', 'EAS submission checklist should reference review guide evidence');
  assert(easSubmissionChecklist.evidence?.ageRatingAudit === 'docs/app-store-age-rating-audit.md', 'EAS submission checklist should reference age rating audit evidence');
  assert(easSubmissionChecklist.evidence?.studyBankDepthAudit === 'docs/study-bank-depth-audit.md', 'EAS submission checklist should reference study bank depth audit evidence');
  assert(easSubmissionChecklist.evidence?.studyContentLocalizationAudit === 'docs/study-content-localization-audit.md', 'EAS submission checklist should reference study content localization audit evidence');
  assert(easSubmissionChecklist.evidence?.contentRightsAudit === 'docs/content-rights-audit.md', 'EAS submission checklist should reference content rights audit evidence');
  assert(easSubmissionChecklist.evidence?.privacyManifestAudit === 'docs/privacy-manifest-audit.md', 'EAS submission checklist should reference privacy manifest audit evidence');
  assert(easSubmissionChecklist.evidence?.privacyAnswers === 'docs/app-store-privacy-answers.md', 'EAS submission checklist should reference privacy answer pack evidence');
  assert(easSubmissionChecklist.evidence?.privacyReviewPacket === 'docs/privacy-review-packet.md', 'EAS submission checklist should reference privacy review packet evidence');
  assert(easSubmissionChecklist.evidence?.admobReleaseAudit === 'docs/admob-release-audit.md', 'EAS submission checklist should reference AdMob release audit evidence');
  assert(easSubmissionChecklist.evidence?.dataFlowPrivacyAudit === 'docs/data-flow-privacy-audit.md', 'EAS submission checklist should reference data flow privacy audit evidence');
  assert(easSubmissionChecklist.evidence?.productionSmokeTest === 'docs/production-device-smoke-test.md', 'EAS submission checklist should reference production smoke evidence');
  assert(easSubmissionChecklist.evidence?.externalReadiness === 'docs/external-readiness.md', 'EAS submission checklist should reference external readiness evidence');
  assert(easSubmissionChecklist.evidence?.easEnvironment === 'docs/eas-env-checklist.md', 'EAS submission checklist should reference EAS environment evidence');
  assert(easSubmissionChecklist.evidence?.easBuildPreflight === 'docs/eas-build-preflight.md', 'EAS submission checklist should reference EAS build preflight evidence');
  assert(easSubmissionChecklist.evidence?.appStoreConnectChecklist === 'docs/app-store-connect-checklist.md', 'EAS submission checklist should reference App Store Connect checklist evidence');
  assert(easSubmissionChecklist.evidence?.screenshotManifest === 'docs/app-store-screenshot-manifest.json', 'EAS submission checklist should reference screenshot manifest evidence');
  assert(easSubmissionChecklist.evidence?.screenshotQaAudit === 'docs/screenshot-qa-audit.md', 'EAS submission checklist should reference screenshot QA evidence');
  assert(easSubmissionChecklist.evidence?.appStoreLocales === metadataPreview.locales?.length, 'EAS submission checklist App Store locale count should match metadata preview');
  assert(easSubmissionChecklist.evidence?.screenshotEntries === totalScreenshotEntries, 'EAS submission checklist screenshot count should match manifest');
  assert(easSubmissionChecklist.evidence?.screenshotQaRisk === 'PASS', 'EAS submission checklist should record passing screenshot QA risk');
  assert(easSubmissionChecklist.evidence?.screenshotQaReady === true, 'EAS submission checklist should record screenshot QA readiness');
  assert(easSubmissionChecklist.evidence?.screenshotQaLocalizedDistinct === true, 'EAS submission checklist should record localized screenshot distinction');
  assert(easSubmissionChecklist.evidence?.screenshotQaUnexpectedDuplicateGroups === 0, 'EAS submission checklist should record zero unexpected screenshot duplicates');
  assert(easSubmissionChecklist.evidence?.runtimeUiFlowRisk === 'PASS', 'EAS submission checklist should record passing runtime UI flow risk');
  assert(easSubmissionChecklist.evidence?.runtimeUiFlowReady === true, 'EAS submission checklist should record runtime UI flow readiness');
  assert(easSubmissionChecklist.evidence?.runtimeUiFlowChecks === runtimeUiFlowAudit.summary?.checks, 'EAS submission checklist runtime UI flow check count should match audit');
  assert(easSubmissionChecklist.evidence?.runtimeUiFlowPassedChecks === runtimeUiFlowAudit.summary?.passedChecks, 'EAS submission checklist runtime UI flow passed count should match audit');
  assert(easSubmissionChecklist.evidence?.runtimeUiFlowRequiredFailures === 0, 'EAS submission checklist should record zero runtime UI flow failures');
  assert(easSubmissionChecklist.evidence?.appStoreCopyRisk === appStoreCopyAudit.summary?.risk, 'EAS submission checklist should record App Store copy audit risk');
  assert(easSubmissionChecklist.evidence?.appStoreCopyReadyLocales === appStoreCopyAudit.summary?.readyLocales, 'EAS submission checklist should record App Store copy ready locale count');
  assert(easSubmissionChecklist.evidence?.appStoreCopyKeywordFormatReady === appStoreCopyAudit.summary?.keywordFormatReady, 'EAS submission checklist should record App Store copy keyword format readiness');
  assert(easSubmissionChecklist.evidence?.appStoreCopyKeywordsByteLimitReady === appStoreCopyAudit.summary?.keywordsByteLimitReady, 'EAS submission checklist should record App Store copy keyword byte readiness');
  assert(easSubmissionChecklist.evidence?.appStoreCopyNoProtectedTerms === appStoreCopyAudit.summary?.noProtectedTermHits, 'EAS submission checklist should record App Store copy protected-term readiness');
  assert(easSubmissionChecklist.evidence?.metadataUploadPacketRisk === metadataUploadPacket.summary?.risk, 'EAS submission checklist should record metadata upload packet risk');
  assert(easSubmissionChecklist.evidence?.metadataUploadPacketLocalReady === true, 'EAS submission checklist should record metadata upload packet local readiness');
  assert(easSubmissionChecklist.evidence?.metadataUploadPacketFieldReadyLocales === metadataUploadPacket.summary?.fieldReadyLocales, 'EAS submission checklist should record metadata upload packet field-ready locales');
  assert(easSubmissionChecklist.evidence?.metadataUploadPacketScreenshotReadyLocales === metadataUploadPacket.summary?.screenshotReadyLocales, 'EAS submission checklist should record metadata upload packet screenshot-ready locales');
  assert(easSubmissionChecklist.evidence?.metadataUploadPacketSupportUrlReadyLocales === metadataUploadPacket.summary?.supportUrlReadyLocales, 'EAS submission checklist should record metadata upload packet support URL locales');
  assert(easSubmissionChecklist.evidence?.metadataUploadPacketPrivacyUrlReadyLocales === metadataUploadPacket.summary?.privacyUrlReadyLocales, 'EAS submission checklist should record metadata upload packet privacy URL locales');
  assert(easSubmissionChecklist.evidence?.localizationRisk === 'PASS', 'EAS submission checklist should record passing localization risk');
  assert(easSubmissionChecklist.evidence?.localizationUiLocales === expectedLocales.length, 'EAS submission checklist should record localization UI locale count');
  assert(easSubmissionChecklist.evidence?.localizationAppStoreLocales === expectedLocales.length, 'EAS submission checklist should record localization App Store locale count');
  assert(easSubmissionChecklist.evidence?.localizationScreenshotEntries === expectedLocales.length * Object.keys(expectedStoreScreenshots).length * expectedStoreScreenshotFiles.length, 'EAS submission checklist should record localized screenshot count');
  assert(easSubmissionChecklist.evidence?.localizationPublicSitePages === publicSiteManifest.pageCount, 'EAS submission checklist should record localization public site pages');
  assert(easSubmissionChecklist.evidence?.localizationJapaneseUiRemoved === true, 'EAS submission checklist should record Japanese UI locale removal');
  assert(easSubmissionChecklist.evidence?.publicSiteDeployRisk === publicSiteDeployAudit.summary?.risk, 'EAS submission checklist should record public site deploy risk');
  assert(easSubmissionChecklist.evidence?.publicSiteDeployLocalReady === true, 'EAS submission checklist should record local public site deploy readiness');
  assert(easSubmissionChecklist.evidence?.publicSiteDeployHostingReady === publicSiteDeployAudit.summary?.hostingReady, 'EAS submission checklist should record public site hosting readiness');
  assert(easSubmissionChecklist.evidence?.publicSiteDeployRoutes === publicSiteManifest.pageCount, 'EAS submission checklist should record public site deploy route count');
  assert(easSubmissionChecklist.evidence?.publicSiteHostingVerificationStatus === publicSiteHostingVerification.summary?.status, 'EAS submission checklist should record public site hosting verification status');
  assert(easSubmissionChecklist.evidence?.publicSiteHostingVerificationReady === publicSiteHostingVerification.summary?.ready, 'EAS submission checklist should record public site hosting verification readiness');
  assert(easSubmissionChecklist.evidence?.publicSiteHostingVerificationCheckedUrls === publicSiteHostingVerification.summary?.checkedUrls, 'EAS submission checklist should record public site hosting checked URL count');
  assert(easSubmissionChecklist.evidence?.publicSiteHostingVerificationPassedUrls === publicSiteHostingVerification.summary?.passedUrls, 'EAS submission checklist should record public site hosting passed URL count');
  assert(easSubmissionChecklist.evidence?.publicSiteHostingVerificationFailedUrls === publicSiteHostingVerification.summary?.failedUrls, 'EAS submission checklist should record public site hosting failed URL count');
  assert(easSubmissionChecklist.evidence?.reviewContactReady === Boolean(metadataPreview.app?.reviewContactReady), 'EAS submission checklist review contact readiness should match metadata preview');
  assert(easSubmissionChecklist.evidence?.demoAccountRequired === false, 'EAS submission checklist should state no demo account is required');
  assert(easSubmissionChecklist.evidence?.signInRequired === false, 'EAS submission checklist should state sign-in is not required');
  assert(easSubmissionChecklist.evidence?.ageRatingRisk === 'PASS', 'EAS submission checklist should record passing age rating risk');
  assert(easSubmissionChecklist.evidence?.ageRatingSuggestedAppleGlobalRating === '4+ candidate', 'EAS submission checklist should record suggested age rating');
  assert(easSubmissionChecklist.evidence?.ageRatingFrequencyNoneAnswers === 12, 'EAS submission checklist should record age rating NONE answers');
  assert(easSubmissionChecklist.evidence?.ageRatingFrequencyQuestions === 12, 'EAS submission checklist should record age rating question count');
  assert(easSubmissionChecklist.evidence?.ageRatingFinalSource === 'App Store Connect age rating questionnaire', 'EAS submission checklist should record age rating final source');
  assert(easSubmissionChecklist.evidence?.studyBankDepthRisk === 'PASS', 'EAS submission checklist should record passing study bank depth risk');
  assert(easSubmissionChecklist.evidence?.studyBankDepthLevels === expectedJlptLevels.length, 'EAS submission checklist should record study bank level count');
  assert(easSubmissionChecklist.evidence?.studyBankDepthTotalItems === studyBankDepthAudit.summary?.totalStudyItems, 'EAS submission checklist should record study bank total item count');
  assert(easSubmissionChecklist.evidence?.studyBankDepthTopicFamilies === studyBankDepthAudit.summary?.totalTopics, 'EAS submission checklist should record study bank topic families');
  assert(easSubmissionChecklist.evidence?.studyBankDepthProgressionPassed === true, 'EAS submission checklist should record passing study bank progression');
  assert(easSubmissionChecklist.evidence?.studyContentLocalizationRisk === 'PASS', 'EAS submission checklist should record passing study content localization risk');
  assert(easSubmissionChecklist.evidence?.studyContentLocalizationLocales === expectedLocales.length, 'EAS submission checklist should record study content locale count');
  assert(easSubmissionChecklist.evidence?.studyContentLocalizationItems === studyContentLocalizationAudit.summary?.totalStudyItems, 'EAS submission checklist should record study content item count');
  assert(easSubmissionChecklist.evidence?.studyContentLocalizationTextKeys === studyContentLocalizationAudit.summary?.studyTextKeys, 'EAS submission checklist should record study content text key count');
  assert(easSubmissionChecklist.evidence?.studyContentLocalizedFields === studyContentLocalizationAudit.summary?.localizedFieldsReady, 'EAS submission checklist should record localized study field count');
  assert(easSubmissionChecklist.evidence?.studyContentExpectedFields === studyContentLocalizationAudit.summary?.expectedLocalizedFields, 'EAS submission checklist should record expected localized study field count');
  assert(easSubmissionChecklist.evidence?.studyContentTranslationEntries === studyContentLocalizationAudit.summary?.contentTranslationEntriesReady, 'EAS submission checklist should record content translation entry count');
  assert(easSubmissionChecklist.evidence?.studyContentExpectedTranslationEntries === studyContentLocalizationAudit.summary?.expectedContentTranslationEntries, 'EAS submission checklist should record expected content translation entry count');
  assert(easSubmissionChecklist.evidence?.studyContentMissingLocalizedFields === 0, 'EAS submission checklist should record zero missing study fields');
  assert(easSubmissionChecklist.evidence?.studyContentMissingTranslationEntries === 0, 'EAS submission checklist should record zero missing study translations');
  assert(easSubmissionChecklist.evidence?.contentRightsRisk === 'PASS', 'EAS submission checklist should record passing content rights risk');
  assert(easSubmissionChecklist.evidence?.protectedIpTermHits === 0, 'EAS submission checklist should record zero protected-IP hits');
  assert(easSubmissionChecklist.evidence?.originalAnimeStyleLinePrompts === contentRightsAudit.summary?.originalAnimeStyleLinePrompts, 'EAS submission checklist line count should match content rights audit');
  assert(easSubmissionChecklist.evidence?.privacyManifestRisk === 'PASS', 'EAS submission checklist should record passing privacy manifest risk');
  assert(easSubmissionChecklist.evidence?.privacyManifestTracking === false, 'EAS submission checklist should record no privacy manifest tracking');
  assert(easSubmissionChecklist.evidence?.privacyManifestCollectedDataTypes === 0, 'EAS submission checklist should record zero privacy manifest collected data types');
  assert(easSubmissionChecklist.evidence?.requiredReasonApisReady === true, 'EAS submission checklist should record required reason APIs ready');
  assert(easSubmissionChecklist.evidence?.privacyAnswersRisk === privacyAnswers.summary?.risk, 'EAS submission checklist should record privacy answer risk');
  assert(easSubmissionChecklist.evidence?.privacyAnswersCurrentState === privacyAnswers.summary?.currentState, 'EAS submission checklist should record privacy answer current state');
  assert(easSubmissionChecklist.evidence?.privacyAnswersAppCodeCollectsPersonalData === false, 'EAS submission checklist should record no app-code personal data collection');
  assert(easSubmissionChecklist.evidence?.privacyAnswersLiveAdMobDisclosureRows === (privacyAnswers.liveAdMobAnswers?.likelyGoogleMobileAdsDataTypes ?? []).length, 'EAS submission checklist should record live-AdMob disclosure row count');
  assert(easSubmissionChecklist.evidence?.privacyReviewPacketRisk === privacyReviewPacket.summary?.risk, 'EAS submission checklist should record privacy review packet risk');
  assert(easSubmissionChecklist.evidence?.privacyReviewPacketLocalReady === true, 'EAS submission checklist should record privacy review packet readiness');
  assert(easSubmissionChecklist.evidence?.privacyReviewPacketCurrentState === privacyReviewPacket.summary?.currentState, 'EAS submission checklist should record privacy review packet current state');
  assert(easSubmissionChecklist.evidence?.privacyReviewPacketFinalReviewConfirmed === privacyReviewPacket.summary?.finalReviewConfirmed, 'EAS submission checklist should record privacy review final confirmation');
  assert(easSubmissionChecklist.evidence?.privacyReviewPacketNoLiveAdsSuggestedRows === privacyReviewPacket.summary?.noLiveAdsSuggestedRows, 'EAS submission checklist should record privacy review no-live row count');
  assert(easSubmissionChecklist.evidence?.privacyReviewPacketLiveAdMobDisclosureRows === privacyReviewPacket.summary?.liveAdMobDisclosureRows, 'EAS submission checklist should record privacy review live-AdMob row count');
  assert(easSubmissionChecklist.evidence?.privacyReviewPacketAppOwnedNetworkRequests === 0, 'EAS submission checklist should record zero privacy review app-owned network hits');
  assert(easSubmissionChecklist.evidence?.privacyReviewPacketAnalyticsSdkCount === 0, 'EAS submission checklist should record zero privacy review analytics SDK hits');
  assert(easSubmissionChecklist.evidence?.privacyReviewPacketAuthSdkCount === 0, 'EAS submission checklist should record zero privacy review auth SDK hits');
  assert(easSubmissionChecklist.evidence?.admobReleaseRisk === admobReleaseAudit.summary?.risk, 'EAS submission checklist should record AdMob release risk');
  assert(easSubmissionChecklist.evidence?.admobReleaseCurrentState === admobReleaseAudit.summary?.currentState, 'EAS submission checklist should record AdMob release state');
  assert(easSubmissionChecklist.evidence?.admobReleaseLocalReady === true, 'EAS submission checklist should record local AdMob readiness');
  assert(easSubmissionChecklist.evidence?.admobReleaseLiveAdsReady === admobReleaseAudit.summary?.liveAdsReady, 'EAS submission checklist should record live AdMob readiness');
  assert(easSubmissionChecklist.evidence?.admobReleaseExternalReady === admobReleaseAudit.summary?.externalReady, 'EAS submission checklist should record external AdMob readiness');
  assert(easSubmissionChecklist.evidence?.admobReleaseExternalBlockingItems === admobReleaseAudit.summary?.externalBlockingItems, 'EAS submission checklist should record AdMob external blocker count');
  assert(easSubmissionChecklist.evidence?.dataFlowPrivacyRisk === dataFlowPrivacyAudit.summary?.risk, 'EAS submission checklist should record data flow privacy risk');
  assert(easSubmissionChecklist.evidence?.dataFlowPrivacyLocalReady === true, 'EAS submission checklist should record data flow privacy readiness');
  assert(easSubmissionChecklist.evidence?.dataFlowAppOwnedNetworkRequests === 0, 'EAS submission checklist should record zero app-owned network hits');
  assert(easSubmissionChecklist.evidence?.dataFlowAnalyticsSdkCount === 0, 'EAS submission checklist should record zero analytics SDK hits');
  assert(easSubmissionChecklist.evidence?.dataFlowAuthSdkCount === 0, 'EAS submission checklist should record zero auth SDK hits');
  assert(easSubmissionChecklist.evidence?.dataFlowUserContentEntryCount === 0, 'EAS submission checklist should record zero user-content entries');
  assert(easSubmissionChecklist.evidence?.dataFlowLocalStorageKeys === 2, 'EAS submission checklist should record two local storage keys');
  assert(easSubmissionChecklist.evidence?.productionSmokeSections === (productionSmokeTest.sections ?? []).length, 'EAS submission checklist production smoke section count should match checklist');
  assert(easSubmissionChecklist.evidence?.productionSmokeItems === (productionSmokeTest.sections ?? []).reduce((sum, section) => sum + (section.items?.length ?? 0), 0), 'EAS submission checklist production smoke item count should match checklist');
  assert(easSubmissionChecklist.evidence?.externalReadinessItems === externalReadiness.summary?.total, 'EAS submission checklist external readiness item count should match checklist');
  assert(easSubmissionChecklist.evidence?.externalReadinessBlocking === externalReadiness.summary?.blocking, 'EAS submission checklist external readiness blocking count should match checklist');
  assert(easSubmissionChecklist.evidence?.easEnvironmentKeys === easEnvChecklist.summary?.totalKeys, 'EAS submission checklist EAS env key count should match checklist');
  assert(easSubmissionChecklist.evidence?.easEnvironmentRequiredForBuild === easEnvChecklist.summary?.requiredForEasProduction, 'EAS submission checklist EAS production env count should match checklist');
  assert(easSubmissionChecklist.evidence?.easProductionProfileReady === true, 'EAS submission checklist should record production profile readiness');
  assert(easSubmissionChecklist.evidence?.appStoreConnectSections === (appStoreConnectChecklist.sections ?? []).length, 'EAS submission checklist App Store Connect section count should match checklist');
  assert(easSubmissionChecklist.evidence?.appStoreConnectFields === (appStoreConnectChecklist.sections ?? []).reduce((sum, section) => sum + (section.fields?.length ?? 0), 0), 'EAS submission checklist App Store Connect field count should match checklist');
  assert(localEvidence.length > 0, 'EAS submission checklist should include local release evidence rows');
  assert(localEvidence.every((row) => row.category === 'local'), 'EAS submission checklist local evidence rows should be categorized as local');
  assert(summary.todo === rows.filter((row) => row.status === 'TODO').length, 'EAS submission checklist TODO count should match blocker rows');
  assert(summary.bad === rows.filter((row) => row.status === 'BAD').length, 'EAS submission checklist BAD count should match blocker rows');
  assert((easSubmissionChecklist.sequence ?? []).length === 5, 'EAS submission checklist should include the five final commands');
  assert((easSubmissionChecklist.sequence ?? [])[0]?.command === 'npm run release:verify', 'EAS submission checklist should start with release:verify');
  assert((easSubmissionChecklist.sequence ?? [])[1]?.command === 'npm run release:store-ready', 'EAS submission checklist should run strict gate before EAS actions');
  assert((easSubmissionChecklist.sequence ?? [])[2]?.command === packageJson.scripts?.['metadata:ios'], 'EAS submission checklist metadata command sequence mismatch');
  assert((easSubmissionChecklist.sequence ?? [])[3]?.command === packageJson.scripts?.['build:ios'], 'EAS submission checklist build command sequence mismatch');
  assert((easSubmissionChecklist.sequence ?? [])[4]?.command === packageJson.scripts?.['submit:ios'], 'EAS submission checklist submit command sequence mismatch');

  for (const snippet of [
    '# EAS Submission Checklist',
    'App version source: remote',
    'Production auto-increment: Yes',
    'Production environment: production',
    'Submit metadata path: ./store.config.js',
    'Runtime UI flow audit: docs/runtime-ui-flow-audit.md',
    'Runtime UI flow risk: PASS',
    'Runtime UI flow ready: Yes',
    `Runtime UI flow checks: ${runtimeUiFlowRatio}`,
    'Localization audit: docs/localization-audit.md',
    'Localization risk: PASS',
    'Localization screenshot entries: 160',
    'Screenshot QA audit: docs/screenshot-qa-audit.md',
    'Screenshot QA risk: PASS',
    'Screenshot QA ready: Yes',
    'Screenshot QA localized distinct: Yes',
    'Screenshot QA unexpected duplicate groups: 0',
    'App Store copy audit: docs/app-store-copy-audit.md',
    'App Store copy risk: PASS',
    'App Store copy ready locales: 10/10',
    'App Store copy keyword byte limit ready: Yes',
    'Metadata upload packet: docs/app-store-metadata-upload-packet.md',
    'Metadata upload packet risk: PASS',
    'Metadata upload packet local ready: Yes',
    'Public site deploy audit: docs/public-site-deploy-audit.md',
    'Public site local package ready: Yes',
    'Public site hosting verification: docs/public-site-hosting-verification.md',
    `Public site hosting verification status: ${publicSiteHostingVerification.summary?.status}`,
    'Age rating audit: docs/app-store-age-rating-audit.md',
    'Age rating risk: PASS',
    'Age rating NONE answers: 12/12',
    'Study bank depth audit: docs/study-bank-depth-audit.md',
    'Study bank depth risk: PASS',
    'Study bank progression passed: Yes',
    'Study content localization audit: docs/study-content-localization-audit.md',
    'Study content localization risk: PASS',
    `Study content localized fields: ${studyContentLocalizationAudit.summary?.localizedFieldsReady}/${studyContentLocalizationAudit.summary?.expectedLocalizedFields}`,
    `Study content translation entries: ${studyContentLocalizationAudit.summary?.contentTranslationEntriesReady}/${studyContentLocalizationAudit.summary?.expectedContentTranslationEntries}`,
    'Content rights audit: docs/content-rights-audit.md',
    'Content rights risk: PASS',
    'Protected IP term hits: 0',
    'Privacy manifest audit: docs/privacy-manifest-audit.md',
    'Privacy manifest risk: PASS',
    'Privacy manifest collected data types: 0',
    'Required reason APIs ready: Yes',
    'App Store privacy answers: docs/app-store-privacy-answers.md',
    `Privacy answer current state: ${privacyAnswers.summary?.currentState}`,
    'App-code personal data collection: No',
    'Privacy review packet: docs/privacy-review-packet.md',
    'Privacy review packet risk: PASS',
    'Privacy review packet local ready: Yes',
    `Privacy review packet current state: ${privacyReviewPacket.summary?.currentState}`,
    'Privacy review app-owned network hits: 0',
    'AdMob release audit: docs/admob-release-audit.md',
    `AdMob release current state: ${admobReleaseAudit.summary?.currentState}`,
    'AdMob local integration ready: Yes',
    'Data flow privacy audit: docs/data-flow-privacy-audit.md',
    'App-owned network request hits: 0',
    'Analytics SDK hits: 0',
    'Auth SDK hits: 0',
    'Production device smoke test: docs/production-device-smoke-test.md',
    'Production smoke items:',
    'External readiness: docs/external-readiness.md',
    'EAS environment checklist: docs/eas-env-checklist.md',
    `EAS environment keys: ${easEnvChecklist.summary?.totalKeys}`,
    'EAS build preflight: docs/eas-build-preflight.md',
    'EAS build preflight risk: PASS',
    'EAS local setup ready: Yes',
    'App Store Connect checklist: docs/app-store-connect-checklist.md',
    'App Store Connect fields:',
    `Blocking external items: ${externalReadiness.summary?.blocking}`,
    'Local Release Evidence',
    'JLPT N5-N1 study bank',
    'npm run release:store-ready',
    'npx eas-cli build --platform ios --profile production',
    'npx eas-cli submit --platform ios --profile production',
  ]) {
    assert(easSubmissionChecklistDoc.includes(snippet), `EAS submission checklist markdown missing: ${snippet}`);
  }
}

function verifyAppStoreHandoffBundle() {
  const expectedGroupIds = ['public-site', 'screenshots', 'metadata', 'review-compliance', 'eas-submit', 'source-config'];
  const screenshotEntries =
    (screenshotManifest.defaultPack?.screenshots ?? []).length +
    (screenshotManifest.localizedPacks ?? []).reduce((sum, pack) => sum + (pack.screenshots?.length ?? 0), 0);
  const localizedScreenshotEntries = (screenshotManifest.localizedPacks ?? []).reduce(
    (sum, pack) => sum + (pack.screenshots?.length ?? 0),
    0,
  );
  const groups = appStoreHandoffBundle.groups ?? [];
  const files = groups.flatMap((group) => group.files ?? []);
  const uniquePaths = [...new Set(files.map((file) => file.path))];
  const externalBlockers = (appStoreHandoffBundle.releaseStatus?.rows ?? []).filter(
    (row) => row.category === 'external' && (row.status === 'TODO' || row.status === 'BAD'),
  );

  assert(appStoreHandoffBundle.schemaVersion === 1, 'App Store handoff bundle schemaVersion should be 1');
  assert(appStoreHandoffBundle.source === 'scripts/generate-app-store-handoff-bundle.js', 'App Store handoff bundle should name its generator');
  assert(appStoreHandoffBundle.generatedFrom?.releaseStatus === 'scripts/release-status.js --json', 'App Store handoff bundle should reference release-status');
  assert(appStoreHandoffBundle.generatedFrom?.publicSiteManifest === 'docs/public-site-manifest.json', 'App Store handoff bundle should reference public site manifest');
  assert(appStoreHandoffBundle.generatedFrom?.screenshotManifest === 'docs/app-store-screenshot-manifest.json', 'App Store handoff bundle should reference screenshot manifest');
  assert(appStoreHandoffBundle.generatedFrom?.metadataPreview === 'docs/app-store-metadata-preview.json', 'App Store handoff bundle should reference metadata preview');
  assert(appStoreHandoffBundle.generatedFrom?.releasePacket === 'docs/release-packet.json', 'App Store handoff bundle should reference release packet');
  assert(appStoreHandoffBundle.generatedFrom?.easSubmissionChecklist === 'docs/eas-submission-checklist.json', 'App Store handoff bundle should reference EAS submission checklist');
  assert(appStoreHandoffBundle.app?.name === appJson.name, 'App Store handoff bundle app name should match app.json');
  assert(appStoreHandoffBundle.app?.version === appJson.version, 'App Store handoff bundle app version should match app.json');
  assert(appStoreHandoffBundle.app?.bundleIdentifier === appJson.ios?.bundleIdentifier, 'App Store handoff bundle bundle ID should match app.json');
  assert(appStoreHandoffBundle.app?.packageName === appJson.android?.package, 'App Store handoff bundle package name should match app.json');
  assert(appStoreHandoffBundle.summary?.risk === 'PASS', 'App Store handoff bundle should pass locally');
  assert(appStoreHandoffBundle.summary?.localReady === true, 'App Store handoff bundle should mark local handoff ready');
  assert(appStoreHandoffBundle.summary?.externalReady === (externalBlockers.length === 0), 'App Store handoff bundle externalReady should match release-status blockers');
  assert(appStoreHandoffBundle.summary?.missingFiles === 0, 'App Store handoff bundle should have no missing files');
  assert(appStoreHandoffBundle.summary?.totalFiles === uniquePaths.length, 'App Store handoff bundle total file count should match unique inventory paths');
  assert(appStoreHandoffBundle.summary?.totalBytes === filesByPath(files).reduce((sum, file) => sum + (file.bytes ?? 0), 0), 'App Store handoff bundle total bytes should match inventory files');
  assert(appStoreHandoffBundle.summary?.publicSitePages === publicSiteManifest.pageCount, 'App Store handoff bundle public site page count should match manifest');
  assert(appStoreHandoffBundle.summary?.publicSiteRoutes === publicSiteDeployAudit.summary?.routeCount, 'App Store handoff bundle route count should match deploy audit');
  assert(appStoreHandoffBundle.summary?.screenshotEntries === screenshotEntries, 'App Store handoff bundle screenshot count should match manifest');
  assert(appStoreHandoffBundle.summary?.localizedScreenshotEntries === localizedScreenshotEntries, 'App Store handoff bundle localized screenshot count should match manifest');
  assert(appStoreHandoffBundle.summary?.appStoreLocales === metadataPreview.locales?.length, 'App Store handoff bundle App Store locale count should match metadata preview');
  assert(appStoreHandoffBundle.summary?.externalBlockingItems === externalBlockers.length, 'App Store handoff bundle external blocker count should match release-status rows');
  sameSet(groups.map((group) => group.id), expectedGroupIds, 'App Store handoff bundle groups');
  sameSet(
    appStoreHandoffBundle.commands ?? [],
    ['npm run release:verify', 'npm run handoff:bundle', 'npm run release:store-ready', 'npm run metadata:ios', 'npm run build:ios', 'npm run submit:ios'],
    'App Store handoff bundle commands',
  );

  for (const group of groups) {
    const groupFiles = group.files ?? [];
    assert(group.summary?.files === groupFiles.length, `App Store handoff bundle ${group.id} file count mismatch`);
    assert(group.summary?.missingFiles === groupFiles.filter((file) => !file.exists).length, `App Store handoff bundle ${group.id} missing count mismatch`);
    assert(group.summary?.bytes === groupFiles.reduce((sum, file) => sum + (file.bytes ?? 0), 0), `App Store handoff bundle ${group.id} bytes mismatch`);
  }

  for (const requiredPath of [
    'site/index.html',
    'site/licenses/index.html',
    'site/zh-Hans/licenses/index.html',
    'docs/public-site-manifest.json',
    'docs/public-site-deploy-audit.md',
    'docs/public-site-hosting-handoff.md',
    'docs/public-site-hosting-handoff.json',
    'docs/public-site-hosting-verification.md',
    'docs/public-site-hosting-verification.json',
    '.github/workflows/deploy-site.yml',
    '.github/workflows/release-verify.yml',
    'assets/store/ios/iphone-6.9/04-settings.png',
    'assets/store/ios-localized/ko/iphone-6.9/04-settings.png',
    'store.config.js',
    'docs/app-store-metadata-upload-packet.md',
    'docs/app-store-metadata-upload-packet.json',
    'docs/release-packet.json',
    'docs/eas-submission-checklist.json',
    'docs/store-submission.env.template',
    'docs/store-submission-input-pack.md',
    'docs/store-submission-input-pack.json',
    'docs/account-service-preflight.md',
    'docs/account-service-preflight.json',
    'docs/external-todo-tracker.md',
    'docs/external-todo-tracker.json',
    'docs/final-launch-runbook.md',
    'docs/final-launch-runbook.json',
    'docs/study-content-localization-audit.md',
    'docs/study-content-localization-audit.json',
    'docs/app-store-privacy-answers.md',
    'docs/privacy-review-packet.md',
    'docs/privacy-review-packet.json',
    'docs/admob-release-audit.md',
    'docs/admob-setup-handoff.md',
    'docs/admob-setup-handoff.json',
    'docs/runtime-ui-flow-audit.md',
    'eas.json',
    '.env.example',
    'app.json',
    'package-lock.json',
  ]) {
    assert(uniquePaths.includes(requiredPath), `App Store handoff bundle missing required path: ${requiredPath}`);
  }

  for (const file of files) {
    assert(file.exists === true, `App Store handoff bundle should mark ${file.path} as existing`);
    const absolutePath = path.join(root, file.path);
    assert(fs.existsSync(absolutePath), `App Store handoff bundle file is missing: ${file.path}`);
    if (!fs.existsSync(absolutePath)) continue;

    const buffer = fs.readFileSync(absolutePath);
    assert(file.bytes === buffer.length, `App Store handoff bundle byte mismatch for ${file.path}`);
    assert(file.sha256 === crypto.createHash('sha256').update(buffer).digest('hex'), `App Store handoff bundle SHA-256 mismatch for ${file.path}`);
  }

  for (const snippet of [
    '# App Store Handoff Bundle',
    'Local handoff ready: Yes',
    'Public site pages: 44',
    'Screenshot entries: 176',
    'App Store locales: 10',
    'Public support/privacy/license website',
    'App Store screenshot upload packs',
    'Review, privacy, ads, and content evidence',
    'npm run release:store-ready',
  ]) {
    assert(appStoreHandoffBundleDoc.includes(snippet), `App Store handoff bundle markdown missing: ${snippet}`);
  }
}

function filesByPath(files) {
  return [...new Map(files.map((file) => [file.path, file])).values()];
}

function renderExpectedEnvTemplate(items) {
  const lines = [];
  let currentGroup = null;

  for (const item of items) {
    if (item.group !== currentGroup) {
      if (lines.length > 0) lines.push('');
      lines.push(`# ${item.group}`);
      currentGroup = item.group;
    }

    const value = item.value || `<${item.placeholder}>`;
    lines.push(`${item.key}=${value}`);
  }

  return lines.join('\n');
}

function readReleaseStatusJson() {
  const result = spawnSync('node', ['scripts/release-status.js', '--json'], {
    cwd: root,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });

  if (result.error) {
    assert(false, `release-status --json failed: ${result.error.message}`);
    return { rows: [] };
  }

  if (result.status !== 0) {
    assert(false, `release-status --json exited with status ${result.status}`);
    return { rows: [] };
  }

  return JSON.parse(result.stdout.replace(/^\uFEFF/, '').trim());
}

function envExampleKeys() {
  return envExampleSource
    .split(/\r?\n/)
    .map((line) => line.match(/^([A-Z0-9_]+)=/)?.[1])
    .filter(Boolean);
}

function verifyMetadataPreview(appleInfo) {
  const previewLocales = metadataPreview.locales ?? [];
  const expectedScreenshotCount = Object.keys(expectedStoreScreenshots).length * expectedStoreScreenshotFiles.length;
  const expectedDevices = Object.keys(expectedStoreScreenshots).map((folder) => folder.split('/').pop());

  assert(metadataPreview.schemaVersion === 1, 'App Store metadata preview schemaVersion should be 1');
  assert(metadataPreview.source === 'store.config.js', 'App Store metadata preview should be generated from store.config.js');
  assert(metadataPreview.generatedFrom?.metadata === 'docs/app-store-localizations.json', 'App Store metadata preview should reference the localization source');
  assert(metadataPreview.generatedFrom?.screenshots === 'docs/app-store-screenshot-manifest.json', 'App Store metadata preview should reference the screenshot manifest');
  assert(metadataPreview.app?.version === appJson.version, 'App Store metadata preview version should match app.json');
  assert(JSON.stringify(metadataPreview.app?.categories ?? []) === JSON.stringify(storeConfig?.apple?.categories ?? []), 'App Store metadata preview categories should match EAS Metadata');
  assert(metadataPreview.app?.automaticRelease === storeConfig?.apple?.release?.automaticRelease, 'App Store metadata preview automaticRelease should match EAS Metadata');
  assert(metadataPreview.app?.phasedRelease === storeConfig?.apple?.release?.phasedRelease, 'App Store metadata preview phasedRelease should match EAS Metadata');
  assert(metadataPreview.app?.reviewContactReady === Boolean(storeConfig?.apple?.review), 'App Store metadata preview reviewContactReady should match EAS Metadata');
  sameSet(
    previewLocales.map((entry) => entry.appStoreLocale),
    Object.values(expectedAppleLocales),
    'App Store metadata preview locales',
  );

  for (const [locale, appleLocale] of Object.entries(expectedAppleLocales)) {
    const preview = previewLocales.find((entry) => entry.appStoreLocale === appleLocale);
    const appleMetadata = appleInfo[appleLocale];

    assert(Boolean(preview), `App Store metadata preview missing ${appleLocale}`);
    if (!preview) continue;

    assert(preview.sourceLocale === locale, `App Store metadata preview sourceLocale mismatch for ${appleLocale}`);
    assert(preview.title === appleMetadata?.title, `App Store metadata preview title mismatch for ${appleLocale}`);
    assert(preview.subtitle === appleMetadata?.subtitle, `App Store metadata preview subtitle mismatch for ${appleLocale}`);
    assert(preview.promoText === appleMetadata?.promoText, `App Store metadata preview promoText mismatch for ${appleLocale}`);
    assert(preview.description === appleMetadata?.description, `App Store metadata preview description mismatch for ${appleLocale}`);
    assert(preview.releaseNotes === appleMetadata?.releaseNotes, `App Store metadata preview releaseNotes mismatch for ${appleLocale}`);
    assert(JSON.stringify(preview.keywords ?? []) === JSON.stringify(appleMetadata?.keywords ?? []), `App Store metadata preview keywords mismatch for ${appleLocale}`);
    assert(preview.lengths?.title === countCharacters(appleMetadata?.title), `App Store metadata preview title length mismatch for ${appleLocale}`);
    assert(preview.lengths?.subtitle === countCharacters(appleMetadata?.subtitle), `App Store metadata preview subtitle length mismatch for ${appleLocale}`);
    assert(preview.lengths?.promoText === countCharacters(appleMetadata?.promoText), `App Store metadata preview promoText length mismatch for ${appleLocale}`);
    assert(preview.lengths?.description === countCharacters(appleMetadata?.description), `App Store metadata preview description length mismatch for ${appleLocale}`);
    assert(preview.lengths?.keywords === (appleMetadata?.keywords ?? []).join(',').length, `App Store metadata preview keyword length mismatch for ${appleLocale}`);
    assert(preview.urls?.marketingUrl === (appleMetadata?.marketingUrl ?? null), `App Store metadata preview marketingUrl mismatch for ${appleLocale}`);
    assert(preview.urls?.supportUrl === (appleMetadata?.supportUrl ?? null), `App Store metadata preview supportUrl mismatch for ${appleLocale}`);
    assert(preview.urls?.privacyPolicyUrl === (appleMetadata?.privacyPolicyUrl ?? null), `App Store metadata preview privacyPolicyUrl mismatch for ${appleLocale}`);
    assert(preview.urls?.supportReady === Boolean(appleMetadata?.supportUrl), `App Store metadata preview supportReady mismatch for ${appleLocale}`);
    assert(preview.urls?.privacyReady === Boolean(appleMetadata?.privacyPolicyUrl), `App Store metadata preview privacyReady mismatch for ${appleLocale}`);
    assert(preview.screenshots?.root === `assets/store/ios-localized/${locale}`, `App Store metadata preview screenshot root mismatch for ${appleLocale}`);
    assert(preview.screenshots?.count === expectedScreenshotCount, `App Store metadata preview screenshot count mismatch for ${appleLocale}`);
    sameSet(preview.screenshots?.devices ?? [], expectedDevices, `App Store metadata preview screenshot devices for ${appleLocale}`);
    assert((preview.screenshots?.scenes ?? []).length === expectedStoreScreenshotFiles.length, `App Store metadata preview screenshot scene count mismatch for ${appleLocale}`);
  }
}

function verifyPublicSiteManifest() {
  const expectedPages = [
    ...sitePageExpectationsForLocale('en', 'site', true),
    ...expectedLocales.flatMap((locale) => sitePageExpectationsForLocale(locale, `site/${locale}`, false)),
  ];
  const pages = publicSiteManifest.pages ?? [];

  assert(publicSiteManifest.schemaVersion === 1, 'Public site manifest schemaVersion should be 1');
  assert(publicSiteManifest.source === 'scripts/generate-localized-site.js', 'Public site manifest should name the site generator');
  assert(publicSiteManifest.root === 'site', 'Public site manifest root should be site');
  assert(publicSiteManifest.pageCount === expectedPages.length, `Public site manifest pageCount should be ${expectedPages.length}`);
  sameSet(publicSiteManifest.locales ?? [], expectedLocales, 'Public site manifest locales');
  sameSet(
    pages.map((entry) => entry.path),
    expectedPages.map((entry) => entry.path),
    'Public site manifest paths',
  );

  for (const expectedPage of expectedPages) {
    const entry = pages.find((page) => page.path === expectedPage.path);
    const absolutePath = path.join(root, expectedPage.path);

    assert(Boolean(entry), `Public site manifest missing page: ${expectedPage.path}`);
    if (!entry) continue;

    assert(entry.route === expectedPage.route, `Public site manifest route mismatch for ${expectedPage.path}`);
    assert(entry.locale === expectedPage.locale, `Public site manifest locale mismatch for ${expectedPage.path}`);
    assert(entry.kind === expectedPage.kind, `Public site manifest kind mismatch for ${expectedPage.path}`);
    assert(entry.default === expectedPage.defaultPage, `Public site manifest default flag mismatch for ${expectedPage.path}`);
    assert(entry.htmlLang === expectedPage.locale, `Public site manifest htmlLang mismatch for ${expectedPage.path}`);
    assert(fs.existsSync(absolutePath), `Public site manifest references missing file: ${expectedPage.path}`);

    if (fs.existsSync(absolutePath)) {
      const html = fs.readFileSync(absolutePath, 'utf8');
      const buffer = Buffer.from(html);
      const currentHash = crypto.createHash('sha256').update(buffer).digest('hex');

      assert(entry.title === extractHtmlTag(html, 'title'), `Public site manifest title mismatch for ${expectedPage.path}`);
      assert(entry.description === extractMetaDescription(html), `Public site manifest description mismatch for ${expectedPage.path}`);
      assert(entry.bytes === buffer.length, `Public site manifest byte size mismatch for ${expectedPage.path}`);
      assert(entry.sha256 === currentHash, `Public site manifest sha256 mismatch for ${expectedPage.path}`);
    }
  }
}

function verifyPublicSiteDeployAudit() {
  const routes = publicSiteDeployAudit.routes ?? [];
  const checks = publicSiteDeployAudit.checks ?? [];
  const routeByPath = Object.fromEntries(routes.map((route) => [route.path, route]));
  const expectedControlFiles = ['site/robots.txt', 'site/_headers', 'site/_redirects'];
  const githubPagesWorkflowPath = '.github/workflows/deploy-site.yml';
  const requiredCheckIds = ['site-folder', 'hosting-control-files', 'github-pages-workflow', 'sitemap', 'https', 'support-url', 'privacy-url', 'localized-routes', 'metadata-sync'];

  assert(publicSiteDeployAudit.schemaVersion === 1, 'Public site deploy audit schemaVersion should be 1');
  assert(publicSiteDeployAudit.source === 'scripts/generate-public-site-deploy-audit.js', 'Public site deploy audit should name its generator');
  assert(publicSiteDeployAudit.generatedFrom?.publicSiteManifest === 'docs/public-site-manifest.json', 'Public site deploy audit should reference public site manifest');
  assert(publicSiteDeployAudit.generatedFrom?.localizedSiteGenerator === 'scripts/generate-localized-site.js', 'Public site deploy audit should reference localized site generator');
  assert(publicSiteDeployAudit.generatedFrom?.siteManifestGenerator === 'scripts/generate-site-manifest.js', 'Public site deploy audit should reference site manifest generator');
  assert(publicSiteDeployAudit.generatedFrom?.hostingControlFiles === 'scripts/generate-localized-site.js', 'Public site deploy audit should reference the hosting control file generator');
  assert(publicSiteDeployAudit.generatedFrom?.hostingVerification === 'scripts/verify-public-site-hosting.js', 'Public site deploy audit should reference the public site hosting verifier');
  assert(publicSiteDeployAudit.generatedFrom?.envTemplate === '.env.example', 'Public site deploy audit should reference env template');
  assert(publicSiteDeployAudit.generatedFrom?.appConfig === 'app.json + app.config.js', 'Public site deploy audit should reference app config');
  assert(publicSiteDeployAudit.generatedFrom?.storeConfig === 'store.config.js', 'Public site deploy audit should reference store config');
  assert(publicSiteDeployAudit.generatedFrom?.githubPagesWorkflow === githubPagesWorkflowPath, 'Public site deploy audit should reference the GitHub Pages workflow');
  assert(publicSiteDeployAudit.app?.name === appJson.name, 'Public site deploy audit app name should match app config');
  assert(publicSiteDeployAudit.app?.version === appJson.version, 'Public site deploy audit app version should match app config');
  assert(publicSiteDeployAudit.summary?.risk === 'PASS', 'Public site deploy audit should pass when local site package is complete');
  assert(publicSiteDeployAudit.summary?.localReady === true, 'Public site deploy audit should mark local deploy package ready');
  assert(publicSiteDeployAudit.summary?.routeCount === publicSiteManifest.pageCount, 'Public site deploy audit route count should match public site manifest');
  assert(publicSiteDeployAudit.summary?.locales === expectedLocales.length, 'Public site deploy audit locale count should match expected locales');
  assert(publicSiteDeployAudit.summary?.missingFiles === 0, 'Public site deploy audit should not report missing files');
  assert(publicSiteDeployAudit.summary?.hostingControlFilesReady === true, 'Public site deploy audit should mark hosting control files ready');
  assert(publicSiteDeployAudit.summary?.githubPagesWorkflowReady === true, 'Public site deploy audit should mark GitHub Pages workflow ready');
  assert(publicSiteDeployAudit.summary?.missingControlFiles === 0, 'Public site deploy audit should not report missing hosting control files');
  assert(publicSiteDeployAudit.deployRoot?.path === 'site', 'Public site deploy audit deploy root should be site');
  sameSet(publicSiteDeployAudit.deployRoot?.requiredLocales ?? [], expectedLocales, 'Public site deploy audit locales');
  sameSet(publicSiteDeployAudit.deployRoot?.requiredPageKinds ?? [], ['landing', 'support', 'privacy', 'licenses'], 'Public site deploy audit page kinds');
  sameSet(publicSiteDeployAudit.deployRoot?.requiredControlFiles ?? [], expectedControlFiles, 'Public site deploy audit control files');
  assert(publicSiteDeployAudit.deployRoot?.deploymentWorkflow === githubPagesWorkflowPath, 'Public site deploy audit should expose the GitHub Pages workflow path');
  sameSet(routes.map((route) => route.path), (publicSiteManifest.pages ?? []).map((page) => page.path), 'Public site deploy audit route paths');
  sameSet(checks.map((entry) => entry.id), requiredCheckIds, 'Public site deploy audit check ids');
  assert((publicSiteDeployAudit.commands ?? []).includes('npm run site:deploy-audit'), 'Public site deploy audit should list its own command');
  assert((publicSiteDeployAudit.commands ?? []).includes('npm run site:verify-hosting'), 'Public site deploy audit should list the hosting verification command');
  assert((publicSiteDeployAudit.commands ?? []).includes('npm run release:store-ready'), 'Public site deploy audit should list the strict final gate');

  sameSet((publicSiteDeployAudit.controlFiles ?? []).map((file) => file.path), expectedControlFiles, 'Public site deploy audit generated control files');
  for (const file of publicSiteDeployAudit.controlFiles ?? []) {
    const absoluteFilePath = path.join(root, file.path);
    assert(fs.existsSync(absoluteFilePath), `Public site control file missing: ${file.path}`);
    if (!fs.existsSync(absoluteFilePath)) continue;

    const buffer = fs.readFileSync(absoluteFilePath);
    assert(file.exists === true, `Public site deploy audit should mark ${file.path} as existing`);
    assert(file.bytes === buffer.length, `Public site deploy audit byte size mismatch for ${file.path}`);
    assert(file.sha256 === crypto.createHash('sha256').update(buffer).digest('hex'), `Public site deploy audit hash mismatch for ${file.path}`);
  }

  const workflow = publicSiteDeployAudit.deploymentWorkflow ?? {};
  const absoluteWorkflowPath = path.join(root, githubPagesWorkflowPath);
  assert(workflow.path === githubPagesWorkflowPath, 'Public site deploy audit deployment workflow path mismatch');
  assert(workflow.exists === true, 'Public site deploy audit should mark GitHub Pages workflow as existing');
  assert(workflow.ready === true, 'Public site deploy audit should mark GitHub Pages workflow as ready');
  assert(fs.existsSync(absoluteWorkflowPath), 'GitHub Pages workflow file is missing');
  if (fs.existsSync(absoluteWorkflowPath)) {
    const workflowBuffer = fs.readFileSync(absoluteWorkflowPath);
    const workflowSource = workflowBuffer.toString('utf8');
    assert(workflow.bytes === workflowBuffer.length, 'Public site deploy audit workflow byte size mismatch');
    assert(workflow.sha256 === crypto.createHash('sha256').update(workflowBuffer).digest('hex'), 'Public site deploy audit workflow hash mismatch');
    for (const snippet of ['workflow_dispatch:', 'pages: write', 'actions/configure-pages@v6', 'actions/upload-pages-artifact@v5', 'path: site', 'actions/deploy-pages@v5']) {
      assert(workflowSource.includes(snippet), `GitHub Pages workflow missing: ${snippet}`);
      assert((workflow.requiredSnippets ?? []).includes(snippet), `Public site deploy audit missing workflow snippet requirement: ${snippet}`);
    }
  }

  const robotsTxt = fs.readFileSync(path.join(root, 'site/robots.txt'), 'utf8');
  const headersTxt = fs.readFileSync(path.join(root, 'site/_headers'), 'utf8');
  const redirectsTxt = fs.readFileSync(path.join(root, 'site/_redirects'), 'utf8');
  assert(robotsTxt.includes('User-agent: *') && robotsTxt.includes('Allow: /'), 'robots.txt should allow public indexing of the support/privacy/license site');
  assert(headersTxt.includes('X-Content-Type-Options: nosniff'), '_headers should include X-Content-Type-Options');
  assert(headersTxt.includes('Referrer-Policy: strict-origin-when-cross-origin'), '_headers should include Referrer-Policy');
  assert(headersTxt.includes("Content-Security-Policy: default-src 'self'"), '_headers should include a self-only Content-Security-Policy baseline');
  assert(redirectsTxt.includes('/support /support/ 301'), '_redirects should normalize the default support route');
  assert(redirectsTxt.includes('/licenses /licenses/ 301'), '_redirects should normalize the default license route');
  assert(redirectsTxt.includes('/zh-Hans/support /zh-Hans/support/ 301'), '_redirects should normalize localized support routes');
  assert(redirectsTxt.includes('/zh-Hans/licenses /zh-Hans/licenses/ 301'), '_redirects should normalize localized license routes');

  for (const page of publicSiteManifest.pages ?? []) {
    const route = routeByPath[page.path];

    assert(Boolean(route), `Public site deploy audit missing route for ${page.path}`);
    if (!route) continue;

    assert(route.route === page.route, `Public site deploy audit route mismatch for ${page.path}`);
    assert(route.locale === page.locale, `Public site deploy audit locale mismatch for ${page.path}`);
    assert(route.kind === page.kind, `Public site deploy audit kind mismatch for ${page.path}`);
    assert(route.sha256 === page.sha256, `Public site deploy audit hash mismatch for ${page.path}`);
    assert(route.bytes === page.bytes, `Public site deploy audit byte size mismatch for ${page.path}`);
  }

  if (publicSiteDeployAudit.summary?.hostingReady) {
    assert(publicSiteDeployAudit.summary?.supportUrlReady === true, 'Public site deploy audit hostingReady should include support URL');
    assert(publicSiteDeployAudit.summary?.privacyUrlReady === true, 'Public site deploy audit hostingReady should include privacy URL');
    assert(isProductionHttpsUrl(publicSiteDeployAudit.urls?.supportUrl), 'Public site deploy audit support URL should be production HTTPS when ready');
    assert(isProductionHttpsUrl(publicSiteDeployAudit.urls?.privacyUrl), 'Public site deploy audit privacy URL should be production HTTPS when ready');
  } else {
    assert(publicSiteDeployAudit.summary?.externalHostingPending === true, 'Public site deploy audit should mark external hosting pending until production URLs are set');
  }

  if (publicSiteDeployAudit.sitemap?.required) {
    assert(publicSiteDeployAudit.sitemap?.ready === true, 'Public site sitemap should be ready when APP_STORE_BASE_URL is production HTTPS');
    assert(publicSiteDeployAudit.sitemap?.urlCount === publicSiteManifest.pageCount, 'Public site sitemap URL count should match public page count');
  } else {
    assert(publicSiteDeployAudit.summary?.sitemapReady === false, 'Public site sitemap should stay pending until APP_STORE_BASE_URL is production HTTPS');
  }

  for (const snippet of [
    '# Public Site Deploy Audit',
    'Local deploy package ready: Yes',
    'Hosting control files ready: Yes',
    'GitHub Pages workflow ready: Yes',
    'Deployment Workflow',
    'Hosting Control Files',
    'External hosting pending',
    'Support URL',
    'Privacy URL',
    'npm run site:deploy-audit',
    'docs/public-site-deploy-audit.json',
  ]) {
    assert(publicSiteDeployAuditDoc.includes(snippet), `Public site deploy audit markdown missing: ${snippet}`);
  }
}

function verifyPublicSiteHostingHandoff() {
  const optionIds = (publicSiteHostingHandoff.hostingOptions ?? []).map((option) => option.id);
  const envKeys = (publicSiteHostingHandoff.envPlan ?? []).map((item) => item.key);
  const routeSample = publicSiteHostingHandoff.deployPackage?.routeSample ?? [];

  assert(publicSiteHostingHandoff.schemaVersion === 1, 'Public site hosting handoff schemaVersion should be 1');
  assert(publicSiteHostingHandoff.source === 'scripts/generate-public-site-hosting-handoff.js', 'Public site hosting handoff should name its generator');
  assert(publicSiteHostingHandoff.generatedFrom?.publicSiteManifest === 'docs/public-site-manifest.json', 'Public site hosting handoff should reference public site manifest');
  assert(publicSiteHostingHandoff.generatedFrom?.publicSiteDeployAudit === 'docs/public-site-deploy-audit.json', 'Public site hosting handoff should reference public site deploy audit');
  assert(publicSiteHostingHandoff.generatedFrom?.publicSiteHostingVerification === 'docs/public-site-hosting-verification.json', 'Public site hosting handoff should reference public site hosting verification');
  assert(publicSiteHostingHandoff.generatedFrom?.githubPagesWorkflow === '.github/workflows/deploy-site.yml', 'Public site hosting handoff should reference the GitHub Pages workflow');
  assert(publicSiteHostingHandoff.generatedFrom?.envTemplate === '.env.example', 'Public site hosting handoff should reference env template');
  assert(publicSiteHostingHandoff.app?.name === appJson.name, 'Public site hosting handoff app name should match app config');
  assert(publicSiteHostingHandoff.app?.version === appJson.version, 'Public site hosting handoff app version should match app config');
  assert(publicSiteHostingHandoff.summary?.risk === 'PASS', 'Public site hosting handoff should pass when local hosting package is ready');
  assert(publicSiteHostingHandoff.summary?.localReady === true, 'Public site hosting handoff should mark local deploy package ready');
  assert(publicSiteHostingHandoff.summary?.routeCount === publicSiteManifest.pageCount, 'Public site hosting handoff route count should match public site manifest');
  assert(publicSiteHostingHandoff.summary?.locales === expectedLocales.length, 'Public site hosting handoff locale count should match expected locales');
  assert(publicSiteHostingHandoff.summary?.githubPagesWorkflowReady === publicSiteDeployAudit.summary?.githubPagesWorkflowReady, 'Public site hosting handoff GitHub Pages readiness should match deploy audit');
  assert(publicSiteHostingHandoff.summary?.hostingControlFilesReady === publicSiteDeployAudit.summary?.hostingControlFilesReady, 'Public site hosting handoff control-file readiness should match deploy audit');
  assert(publicSiteHostingHandoff.summary?.hostingVerificationStatus === publicSiteHostingVerification.summary?.status, 'Public site hosting handoff verification status should match live verification');
  assert(publicSiteHostingHandoff.deployPackage?.root === 'site', 'Public site hosting handoff deploy root should be site');
  assert(publicSiteHostingHandoff.deployPackage?.pageCount === publicSiteManifest.pageCount, 'Public site hosting handoff page count should match manifest');
  sameSet(publicSiteHostingHandoff.deployPackage?.locales ?? [], expectedLocales, 'Public site hosting handoff locales');
  sameSet(publicSiteHostingHandoff.deployPackage?.pageKinds ?? [], ['landing', 'support', 'privacy', 'licenses'], 'Public site hosting handoff page kinds');
  sameSet((publicSiteHostingHandoff.deployPackage?.controlFiles ?? []).map((file) => file.path), ['site/robots.txt', 'site/_headers', 'site/_redirects'], 'Public site hosting handoff control files');
  assert(publicSiteHostingHandoff.deployPackage?.workflow?.path === '.github/workflows/deploy-site.yml', 'Public site hosting handoff workflow path should point to GitHub Pages workflow');
  assert(publicSiteHostingHandoff.deployPackage?.workflow?.exists === true, 'Public site hosting handoff should record the GitHub Pages workflow as existing');
  sameSet(optionIds, ['github-pages', 'netlify-drop', 'cloudflare-pages', 'generic-static-host'], 'Public site hosting handoff hosting options');
  sameSet(envKeys, ['APP_STORE_BASE_URL', 'APP_STORE_SUPPORT_URL', 'APP_STORE_PRIVACY_URL', 'APP_STORE_MARKETING_URL'], 'Public site hosting handoff env keys');
  assert((publicSiteHostingHandoff.easEnvCommands ?? []).some((command) => command.includes('APP_STORE_BASE_URL')), 'Public site hosting handoff should include the EAS APP_STORE_BASE_URL command');
  assert((publicSiteHostingHandoff.verificationOrder ?? []).includes('npm run site:hosting-handoff'), 'Public site hosting handoff should include its own command in the verification order');
  assert((publicSiteHostingHandoff.verificationOrder ?? []).includes('npm run site:verify-hosting'), 'Public site hosting handoff should include live hosting verification');
  assert((publicSiteHostingHandoff.verificationOrder ?? []).includes('npm run release:store-ready'), 'Public site hosting handoff should include the strict store gate');
  assert(routeSample.length > 0, 'Public site hosting handoff should include a route sample');
  assert(routeSample.some((route) => route.route === '/privacy/'), 'Public site hosting handoff route sample should include the default privacy route');

  if (publicSiteHostingHandoff.summary?.urlConfigurationReady) {
    assert(
      isProductionHttpsUrl(publicSiteHostingHandoff.urls?.baseUrl) ||
        (isProductionHttpsUrl(publicSiteHostingHandoff.urls?.supportUrl) && isProductionHttpsUrl(publicSiteHostingHandoff.urls?.privacyUrl)),
      'Public site hosting handoff URL-ready state should be backed by production HTTPS URLs',
    );
  }

  for (const snippet of [
    '# Public Site Hosting Handoff',
    'Local deploy package ready: Yes',
    'GitHub Pages workflow ready: Yes',
    'Hosting Options',
    'Environment Values',
    'EAS production env commands',
    'Verification Order',
    'npm run site:hosting-handoff',
    'npm run site:verify-hosting',
    'APP_STORE_BASE_URL',
  ]) {
    assert(publicSiteHostingHandoffDoc.includes(snippet), `Public site hosting handoff markdown missing: ${snippet}`);
  }
}

function verifyPublicSiteHostingVerification() {
  const endpoints = publicSiteHostingVerification.endpoints ?? [];
  const results = publicSiteHostingVerification.results ?? [];
  const failedResults = results.filter((result) => !result.passed);
  const supportPrivacyUrlsConfigured =
    publicSiteHostingVerification.summary?.urlConfigurationReady === true ||
    (hasAllSupportUrls && hasAllPrivacyUrls);

  assert(publicSiteHostingVerification.schemaVersion === 1, 'Public site hosting verification schemaVersion should be 1');
  assert(publicSiteHostingVerification.source === 'scripts/verify-public-site-hosting.js', 'Public site hosting verification should name its generator');
  assert(publicSiteHostingVerification.generatedFrom?.publicSiteManifest === 'docs/public-site-manifest.json', 'Public site hosting verification should reference public site manifest');
  assert(publicSiteHostingVerification.generatedFrom?.envTemplate === '.env.example', 'Public site hosting verification should reference env template');
  assert(publicSiteHostingVerification.generatedFrom?.appConfig === 'app.json + app.config.js', 'Public site hosting verification should reference app config');
  assert(publicSiteHostingVerification.generatedFrom?.localSiteGenerator === 'scripts/generate-localized-site.js', 'Public site hosting verification should reference localized site generator');
  assert(publicSiteHostingVerification.app?.name === appJson.name, 'Public site hosting verification app name should match app config');
  assert(publicSiteHostingVerification.app?.version === appJson.version, 'Public site hosting verification app version should match app config');
  assert(publicSiteHostingVerification.summary?.expectedPageRoutes === publicSiteManifest.pageCount, 'Public site hosting verification expected route count should match manifest');
  assert(publicSiteHostingVerification.summary?.expectedLocales === expectedLocales.length, 'Public site hosting verification locale count should match expected locales');
  assert(publicSiteHostingVerification.summary?.checkedUrls === results.length, 'Public site hosting verification checked URL count should match results');
  assert(publicSiteHostingVerification.summary?.passedUrls === results.filter((result) => result.passed).length, 'Public site hosting verification passed URL count should match results');
  assert(publicSiteHostingVerification.summary?.failedUrls === failedResults.length, 'Public site hosting verification failed URL count should match results');
  assert(publicSiteHostingVerification.summary?.timeoutMs > 0, 'Public site hosting verification should record a timeout');
  assert((publicSiteHostingVerification.commands ?? []).includes('npm run site:verify-hosting'), 'Public site hosting verification should list its own command');
  assert((publicSiteHostingVerification.commands ?? []).includes('npm run release:store-ready'), 'Public site hosting verification should list the strict store gate');

  if (publicSiteHostingVerification.summary?.hasProductionBaseUrl) {
    assert(publicSiteHostingVerification.summary?.checkedUrls === publicSiteManifest.pageCount + 1, 'Public site hosting verification should check every page plus sitemap when APP_STORE_BASE_URL is set');
    assert(endpoints.some((endpoint) => endpoint.id === 'sitemap'), 'Public site hosting verification should check sitemap when APP_STORE_BASE_URL is set');
    assert(publicSiteHostingVerification.summary?.ready === true, 'Public site hosting verification should be ready when production base URL checks pass');
    assert(publicSiteHostingVerification.summary?.status === 'PASS', 'Public site hosting verification should pass when production base URL checks pass');
  } else if (!publicSiteHostingVerification.summary?.urlConfigurationReady) {
    assert(publicSiteHostingVerification.summary?.status === 'PENDING', 'Public site hosting verification should be pending until production URLs are configured');
    assert(publicSiteHostingVerification.summary?.ready === false, 'Public site hosting verification should not be ready without production URLs');
    assert(publicSiteHostingVerification.summary?.checkedUrls === 0, 'Public site hosting verification should avoid live requests without production URLs');
  }

  if (supportPrivacyUrlsConfigured) {
    requireForStore(publicSiteHostingVerification.summary?.ready === true, 'Public support/privacy URLs are configured but docs/public-site-hosting-verification.md has not passed live HTTPS checks.');
  }

  for (const result of results) {
    assert(typeof result.id === 'string' && result.id.length > 0, 'Public site hosting verification result should include an id');
    assert(typeof result.url === 'string' && result.url.startsWith('https://'), `Public site hosting verification result should use HTTPS: ${result.id}`);
    assert(typeof result.durationMs === 'number', `Public site hosting verification result should record duration: ${result.id}`);
    if (result.passed) {
      assert(result.status >= 200 && result.status < 400, `Public site hosting verification passed result should have a successful status: ${result.id}`);
      assert(result.bytes > 0, `Public site hosting verification passed result should have bytes: ${result.id}`);
    }
  }

  for (const snippet of [
    '# Public Site Hosting Verification',
    'Status:',
    'URL configuration ready:',
    'Checked URLs:',
    'npm run site:verify-hosting',
    'npm run release:store-ready',
  ]) {
    assert(publicSiteHostingVerificationDoc.includes(snippet), `Public site hosting verification markdown missing: ${snippet}`);
  }
}

function sitePageExpectationsForLocale(locale, rootPath, defaultPage) {
  const routePrefix = defaultPage ? '' : `/${locale}`;

  return [
    { path: `${rootPath}/index.html`, route: `${routePrefix}/`, locale, kind: 'landing', defaultPage },
    { path: `${rootPath}/support/index.html`, route: `${routePrefix}/support/`, locale, kind: 'support', defaultPage },
    { path: `${rootPath}/privacy/index.html`, route: `${routePrefix}/privacy/`, locale, kind: 'privacy', defaultPage },
    { path: `${rootPath}/licenses/index.html`, route: `${routePrefix}/licenses/`, locale, kind: 'licenses', defaultPage },
  ];
}

function verifyScreenshotPack(pack, locale, appStoreLocale, expectedRoot) {
  assert(Boolean(pack), `App Store screenshot manifest missing pack for ${locale}`);
  if (!pack) return;

  const expectedPaths = screenshotPathsForRoot(expectedRoot);
  assert(pack.locale === locale, `App Store screenshot manifest pack locale mismatch for ${locale}`);
  assert(pack.appStoreLocale === appStoreLocale, `App Store screenshot manifest App Store locale mismatch for ${locale}`);
  assert(pack.root === expectedRoot, `App Store screenshot manifest root mismatch for ${locale}`);
  assert(Array.isArray(pack.screenshots), `App Store screenshot manifest screenshots missing for ${locale}`);
  assert((pack.screenshots ?? []).length === expectedPaths.length, `App Store screenshot manifest ${locale} should list ${expectedPaths.length} screenshots`);
  sameSet(
    (pack.screenshots ?? []).map((entry) => entry.path),
    expectedPaths,
    `App Store screenshot manifest ${locale} paths`,
  );

  for (const entry of pack.screenshots ?? []) {
    const expectedDevice = screenshotDeviceForPath(entry.path);
    const dimensions = expectedDevice ? screenshotDimensionsForDevice(expectedDevice.device) : null;
    const absolutePath = path.join(root, entry.path);

    assert(Boolean(expectedDevice), `App Store screenshot manifest has unexpected path: ${entry.path}`);
    assert(fs.existsSync(absolutePath), `App Store screenshot manifest references missing file: ${entry.path}`);
    assert(expectedStoreScreenshotFiles.includes(path.basename(entry.path)), `App Store screenshot manifest has unexpected filename: ${entry.path}`);
    assert(entry.device === expectedDevice?.device, `App Store screenshot manifest device mismatch for ${entry.path}`);
    assert(typeof entry.scene === 'string' && entry.scene.length > 0, `App Store screenshot manifest scene missing for ${entry.path}`);
    assert(entry.width === dimensions?.width, `App Store screenshot manifest width mismatch for ${entry.path}`);
    assert(entry.height === dimensions?.height, `App Store screenshot manifest height mismatch for ${entry.path}`);

    if (fs.existsSync(absolutePath)) {
      const buffer = fs.readFileSync(absolutePath);
      const currentHash = crypto.createHash('sha256').update(buffer).digest('hex');

      assert(entry.bytes === buffer.length, `App Store screenshot manifest byte size mismatch for ${entry.path}`);
      assert(entry.sha256 === currentHash, `App Store screenshot manifest sha256 mismatch for ${entry.path}`);
    }
  }
}

function screenshotPathsForRoot(rootPath) {
  return Object.keys(expectedStoreScreenshots).flatMap((folder) => {
    const device = folder.split('/').pop();
    return expectedStoreScreenshotFiles.map((filename) => `${rootPath}/${device}/${filename}`);
  });
}

function screenshotDeviceForPath(screenshotPath) {
  const device = Object.keys(expectedStoreScreenshots)
    .map((folder) => ({ device: folder.split('/').pop() }))
    .find((entry) => screenshotPath.includes(`/${entry.device}/`));

  return device ?? null;
}

function screenshotDimensionsForDevice(device) {
  const entry = Object.entries(expectedStoreScreenshots).find(([folder]) => folder.endsWith(`/${device}`));
  return entry?.[1] ?? null;
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

function digits(value) {
  return String(value ?? '').replace(/\D/g, '');
}

function countCharacters(value) {
  return Array.from(String(value ?? '')).length;
}

function extractHtmlTag(html, tagName) {
  const match = html.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i'));
  return decodeHtml(match?.[1]?.trim() ?? '');
}

function extractMetaDescription(html) {
  const meta = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i)?.[1] ?? '';
  return decodeHtml(meta);
}

function decodeHtml(value) {
  return String(value)
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');
}
