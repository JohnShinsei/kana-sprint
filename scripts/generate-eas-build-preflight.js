const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const jsonPath = path.join(root, 'docs/eas-build-preflight.json');
const markdownPath = path.join(root, 'docs/eas-build-preflight.md');
const appJson = readJson('app.json').expo;
const easJson = readJson('eas.json');
const packageJson = readJson('package.json');
const easEnvChecklist = readOptionalJson('docs/eas-env-checklist.json') ?? {};
const externalReadiness = readOptionalJson('docs/external-readiness.json') ?? {};
const releaseStatus = readReleaseStatus();
const easIgnore = fs.existsSync(path.join(root, '.easignore'))
  ? fs.readFileSync(path.join(root, '.easignore'), 'utf8')
  : '';
const easIgnoreEntries = easIgnore
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'));

const requiredEasIgnoreEntries = [
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
const forbiddenEasIgnoreEntries = [
  '/assets',
  '/assets/bgm',
  '/assets/icon.png',
  '/assets/splash-icon.png',
];
const externalBlockingRows = (releaseStatus.rows ?? []).filter((row) => row.category === 'external' && ['TODO', 'BAD'].includes(row.status));
const liveAdsEnabled = (releaseStatus.rows ?? []).some((row) => row.label === 'Live AdMob IDs' && row.status === 'OK');
const expectedProductionEnvKeys = liveAdsEnabled ? 7 : 3;
const localFailures = [];

const buildProfile = easJson.build?.production ?? {};
const submitProfile = easJson.submit?.production?.ios ?? {};
const productionProfileReady =
  easJson.cli?.appVersionSource === 'remote' &&
  buildProfile.autoIncrement === true &&
  buildProfile.environment === 'production' &&
  buildProfile.developmentClient !== true &&
  buildProfile.distribution !== 'internal';
const submitProfileReady = submitProfile.metadataPath === './store.config.js';
const scriptReady =
  packageJson.scripts?.['metadata:ios'] === 'npx eas-cli metadata:push' &&
  packageJson.scripts?.['build:ios'] === 'npx eas-cli build --platform ios --profile production' &&
  packageJson.scripts?.['submit:ios'] === 'npx eas-cli submit --platform ios --profile production';
const uploadPolicyReady =
  requiredEasIgnoreEntries.every((entry) => easIgnoreEntries.includes(entry)) &&
  forbiddenEasIgnoreEntries.every((entry) => !easIgnoreEntries.includes(entry));
const nativeConfigReady =
  /^([a-z][a-z0-9]*)(\.[a-z][a-z0-9]*){2,}$/.test(appJson.ios?.bundleIdentifier ?? '') &&
  appJson.android?.package === appJson.ios?.bundleIdentifier &&
  String(appJson.ios?.buildNumber ?? '').length > 0 &&
  Number.isInteger(appJson.android?.versionCode) &&
  appJson.ios?.infoPlist?.ITSAppUsesNonExemptEncryption === false &&
  appJson.ios?.privacyManifests?.NSPrivacyTracking === false &&
  appJson.ios?.supportsTablet === true;
const envChecklistReady =
  easEnvChecklist.summary?.productionProfileEnvironmentReady === true &&
  easEnvChecklist.summary?.requiredForEasProduction === expectedProductionEnvKeys;
const localReady = productionProfileReady && submitProfileReady && scriptReady && uploadPolicyReady && nativeConfigReady && envChecklistReady;

if (!productionProfileReady) localFailures.push('EAS production build profile is not ready for a store build.');
if (!submitProfileReady) localFailures.push('EAS submit production profile does not point to ./store.config.js.');
if (!scriptReady) localFailures.push('package.json EAS metadata/build/submit scripts do not match the release command contract.');
if (!uploadPolicyReady) localFailures.push('.easignore does not match the EAS upload policy.');
if (!nativeConfigReady) localFailures.push('app.json native identifiers or privacy/build fields do not match the release contract.');
if (!envChecklistReady) localFailures.push('EAS environment checklist is missing or not ready.');

const preflight = {
  schemaVersion: 1,
  source: 'scripts/generate-eas-build-preflight.js',
  generatedFrom: {
    appConfig: 'app.json + app.config.js',
    easJson: 'eas.json',
    packageJson: 'package.json',
    easIgnore: '.easignore',
    easEnvironmentChecklist: 'docs/eas-env-checklist.json',
    externalReadiness: 'docs/external-readiness.json',
    releaseStatus: 'scripts/release-status.js --json',
  },
  officialReferences: [
    {
      label: 'Expo SDK 56 reference',
      url: 'https://docs.expo.dev/versions/v56.0.0/',
    },
    {
      label: 'EAS Build eas.json',
      url: 'https://docs.expo.dev/build/eas-json/',
    },
    {
      label: 'EAS Submit eas.json',
      url: 'https://docs.expo.dev/submit/eas-json/',
    },
  ],
  summary: {
    risk: localFailures.length === 0 ? 'PASS' : 'REVIEW',
    localReady,
    externalReady: externalBlockingRows.length === 0,
    strictGateReady: externalBlockingRows.length === 0,
    externalBlockingItems: externalBlockingRows.length,
    localFailures: localFailures.length,
  },
  app: {
    name: appJson.name,
    version: appJson.version,
    slug: appJson.slug,
    bundleIdentifier: appJson.ios?.bundleIdentifier,
    buildNumber: appJson.ios?.buildNumber,
    packageName: appJson.android?.package,
    versionCode: appJson.android?.versionCode,
    supportsTablet: Boolean(appJson.ios?.supportsTablet),
    nonExemptEncryption: appJson.ios?.infoPlist?.ITSAppUsesNonExemptEncryption !== false,
    privacyTracking: Boolean(appJson.ios?.privacyManifests?.NSPrivacyTracking),
  },
  eas: {
    cliVersion: easJson.cli?.version,
    appVersionSource: easJson.cli?.appVersionSource,
    productionBuildProfile: {
      autoIncrement: buildProfile.autoIncrement,
      environment: buildProfile.environment ?? null,
      developmentClient: Boolean(buildProfile.developmentClient),
      distribution: buildProfile.distribution ?? 'store',
      ready: productionProfileReady,
    },
    productionSubmitProfile: {
      metadataPath: submitProfile.metadataPath ?? null,
      ready: submitProfileReady,
    },
  },
  commands: {
    metadata: packageJson.scripts?.['metadata:ios'],
    build: packageJson.scripts?.['build:ios'],
    submit: packageJson.scripts?.['submit:ios'],
    remoteVersion: 'npx eas-cli build:version:set',
    strictGate: packageJson.scripts?.['release:store-ready'],
    ready: scriptReady,
  },
  uploadPolicy: {
    easIgnorePresent: Boolean(easIgnore),
    requiredEntries: requiredEasIgnoreEntries.map((entry) => ({
      entry,
      present: easIgnoreEntries.includes(entry),
    })),
    forbiddenEntries: forbiddenEasIgnoreEntries.map((entry) => ({
      entry,
      absent: !easIgnoreEntries.includes(entry),
    })),
    keepsRuntimeAssets: !easIgnoreEntries.includes('/assets') && !easIgnoreEntries.includes('/assets/bgm'),
    excludesStoreArtifacts: easIgnoreEntries.includes('/assets/store') && easIgnoreEntries.includes('/site') && easIgnoreEntries.includes('/docs'),
    ready: uploadPolicyReady,
  },
  environment: {
    checklist: 'docs/eas-env-checklist.md',
    releaseTrack: liveAdsEnabled ? 'LIVE_ADMOB' : 'NO_LIVE_ADS',
    productionProfileEnvironmentReady: Boolean(easEnvChecklist.summary?.productionProfileEnvironmentReady),
    requiredForEasProduction: easEnvChecklist.summary?.requiredForEasProduction ?? 0,
    clientVisible: easEnvChecklist.summary?.clientVisible ?? 0,
  },
  externalGate: {
    checklist: 'docs/external-readiness.md',
    readinessItems: externalReadiness.summary?.total ?? 0,
    blockingItems: externalBlockingRows.length,
    blockers: externalBlockingRows.map((row) => ({
      label: row.label,
      status: row.status,
      detail: row.detail,
    })),
  },
  localFailures,
};

fs.writeFileSync(jsonPath, `${JSON.stringify(preflight, null, 2)}\n`);
fs.writeFileSync(markdownPath, renderMarkdown(preflight));

if (preflight.summary.risk !== 'PASS') {
  console.error(`EAS build preflight requires review: ${localFailures.length} local issue(s)`);
  for (const failure of localFailures) console.error(`- ${failure}`);
  process.exit(1);
}

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
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function readOptionalJson(relativePath) {
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) return null;

  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function renderMarkdown(values) {
  const requiredRows = values.uploadPolicy.requiredEntries
    .map((entry) => `| \`${entry.entry}\` | ${entry.present ? 'Yes' : 'No'} |`)
    .join('\n');
  const forbiddenRows = values.uploadPolicy.forbiddenEntries
    .map((entry) => `| \`${entry.entry}\` | ${entry.absent ? 'Yes' : 'No'} |`)
    .join('\n');
  const blockers = values.externalGate.blockers.length > 0
    ? values.externalGate.blockers.map((row) => `- [${row.status}] ${row.label}: ${row.detail}`).join('\n')
    : '- None.';
  const references = values.officialReferences.map((entry) => `- ${entry.label}: ${entry.url}`).join('\n');

  return `# EAS Build Preflight

This preflight checks the local EAS production build and submit setup before App Store metadata, build, and submit commands run.

## Summary

- Risk: ${values.summary.risk}
- Local EAS setup ready: ${values.summary.localReady ? 'Yes' : 'No'}
- External gate ready: ${values.summary.externalReady ? 'Yes' : 'No'}
- Strict store-ready gate ready: ${values.summary.strictGateReady ? 'Yes' : 'No'}
- Blocking external items: ${values.summary.externalBlockingItems}
- Local failures: ${values.summary.localFailures}

## App

- Name: ${values.app.name}
- Version: ${values.app.version}
- iOS bundle ID: ${values.app.bundleIdentifier}
- iOS build number: ${values.app.buildNumber}
- Android package: ${values.app.packageName}
- Android version code: ${values.app.versionCode}
- Tablet support: ${values.app.supportsTablet ? 'Yes' : 'No'}
- Non-exempt encryption: ${values.app.nonExemptEncryption ? 'Yes' : 'No'}
- iOS privacy tracking: ${values.app.privacyTracking ? 'Yes' : 'No'}

## EAS Profiles

- CLI requirement: ${values.eas.cliVersion}
- App version source: ${values.eas.appVersionSource}
- Production auto-increment: ${values.eas.productionBuildProfile.autoIncrement ? 'Yes' : 'No'}
- Production environment: ${values.eas.productionBuildProfile.environment ?? 'missing'}
- Production distribution: ${values.eas.productionBuildProfile.distribution}
- Production profile ready: ${values.eas.productionBuildProfile.ready ? 'Yes' : 'No'}
- Submit metadata path: ${values.eas.productionSubmitProfile.metadataPath}
- Submit profile ready: ${values.eas.productionSubmitProfile.ready ? 'Yes' : 'No'}

## Commands

- Metadata: \`${values.commands.metadata}\`
- Build: \`${values.commands.build}\`
- Submit: \`${values.commands.submit}\`
- Remote version init: \`${values.commands.remoteVersion}\`
- Strict gate: \`${values.commands.strictGate}\`

## Upload Policy

- \`.easignore\` present: ${values.uploadPolicy.easIgnorePresent ? 'Yes' : 'No'}
- Runtime assets kept: ${values.uploadPolicy.keepsRuntimeAssets ? 'Yes' : 'No'}
- Store/handoff artifacts excluded: ${values.uploadPolicy.excludesStoreArtifacts ? 'Yes' : 'No'}

| Required entry | Present |
| --- | --- |
${requiredRows}

| Forbidden broad exclusion | Absent |
| --- | --- |
${forbiddenRows}

## Environment

- EAS env checklist: ${values.environment.checklist}
- Production environment ready: ${values.environment.productionProfileEnvironmentReady ? 'Yes' : 'No'}
- Required production build env values: ${values.environment.requiredForEasProduction}
- Client-visible values: ${values.environment.clientVisible}

## External Gate

- External readiness checklist: ${values.externalGate.checklist}
- Readiness items: ${values.externalGate.readinessItems}
- Blocking items: ${values.externalGate.blockingItems}

${blockers}

## Official References

${references}
`;
}
