const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const jsonPath = path.join(root, 'docs/eas-env-checklist.json');
const markdownPath = path.join(root, 'docs/eas-env-checklist.md');
const envExamplePath = path.join(root, '.env.example');
const easJson = readJson('eas.json');
const envKeys = readEnvTemplateKeys();
const releaseStatus = readReleaseStatus();
const statusByLabel = Object.fromEntries((releaseStatus.rows ?? []).map((row) => [row.label, row]));
const liveAdsEnabled = statusByLabel['Live AdMob IDs']?.status === 'OK';

const definitions = {
  EXPO_PUBLIC_ADMOB_IOS_APP_ID: {
    group: 'AdMob',
    easLocation: 'local .env.local + EAS production',
    requiredForEasProduction: liveAdsEnabled,
    visibility: 'sensitive',
    validation: 'AdMob app ID: ca-app-pub-0000000000000000~0000000000',
    usedBy: ['app.config.js native plugin injection', 'Expo extra.admob', 'production iOS build'],
    releaseStatusLabels: ['Live AdMob IDs'],
    clientVisible: true,
  },
  EXPO_PUBLIC_ADMOB_ANDROID_APP_ID: {
    group: 'AdMob',
    easLocation: 'local .env.local + EAS production',
    requiredForEasProduction: liveAdsEnabled,
    visibility: 'sensitive',
    validation: 'AdMob app ID: ca-app-pub-0000000000000000~0000000000',
    usedBy: ['app.config.js native plugin injection', 'Expo extra.admob', 'production Android build'],
    releaseStatusLabels: ['Live AdMob IDs'],
    clientVisible: true,
  },
  EXPO_PUBLIC_ADMOB_REWARDED_IOS_UNIT_ID: {
    group: 'AdMob',
    easLocation: 'local .env.local + EAS production',
    requiredForEasProduction: liveAdsEnabled,
    visibility: 'sensitive',
    validation: 'Rewarded ad unit ID: ca-app-pub-0000000000000000/0000000000',
    usedBy: ['src/ads.native.ts rewarded ad unit', 'Expo extra.admob', 'production iOS build'],
    releaseStatusLabels: ['Live AdMob IDs'],
    clientVisible: true,
  },
  EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_UNIT_ID: {
    group: 'AdMob',
    easLocation: 'local .env.local + EAS production',
    requiredForEasProduction: liveAdsEnabled,
    visibility: 'sensitive',
    validation: 'Rewarded ad unit ID: ca-app-pub-0000000000000000/0000000000',
    usedBy: ['src/ads.native.ts rewarded ad unit', 'Expo extra.admob', 'production Android build'],
    releaseStatusLabels: ['Live AdMob IDs'],
    clientVisible: true,
  },
  APP_STORE_BASE_URL: {
    group: 'Public store URLs',
    easLocation: 'local .env.local + EAS production',
    requiredForEasProduction: true,
    visibility: 'plaintext',
    validation: 'Production HTTPS root URL; can generate /support and /privacy URLs',
    usedBy: ['app.config.js store URLs', 'store.config.js localized App Store URLs', 'release-check'],
    releaseStatusLabels: ['Public support URL', 'Public privacy URL', 'Public marketing URL'],
    clientVisible: true,
  },
  APP_STORE_MARKETING_URL: {
    group: 'Public store URLs',
    easLocation: 'optional local .env.local + EAS production when used',
    requiredForEasProduction: false,
    visibility: 'plaintext',
    validation: 'Optional production HTTPS marketing URL',
    usedBy: ['app.config.js store URLs', 'store.config.js App Store marketingUrl'],
    releaseStatusLabels: ['Public marketing URL'],
    clientVisible: true,
  },
  APP_STORE_SUPPORT_URL: {
    group: 'Public store URLs',
    easLocation: 'optional override in local .env.local + EAS production',
    requiredForEasProduction: false,
    visibility: 'plaintext',
    validation: 'Production HTTPS support URL; APP_STORE_BASE_URL can derive it',
    usedBy: ['app.config.js Settings support link', 'store.config.js supportUrl', 'release-check'],
    releaseStatusLabels: ['Public support URL'],
    clientVisible: true,
  },
  APP_STORE_PRIVACY_URL: {
    group: 'Public store URLs',
    easLocation: 'optional override in local .env.local + EAS production',
    requiredForEasProduction: false,
    visibility: 'plaintext',
    validation: 'Production HTTPS privacy policy URL; APP_STORE_BASE_URL can derive it',
    usedBy: ['app.config.js Settings privacy link', 'store.config.js privacyPolicyUrl', 'release-check'],
    releaseStatusLabels: ['Public privacy URL'],
    clientVisible: true,
  },
  APP_STORE_REVIEW_FIRST_NAME: {
    group: 'App Store review contact',
    easLocation: 'local gate + CI/EAS workflow if metadata is automated',
    requiredForEasProduction: false,
    visibility: 'sensitive',
    validation: 'Non-empty first name for App Review contact',
    usedBy: ['store.config.js apple.review', 'metadata preview', 'release-check'],
    releaseStatusLabels: ['App Store review contact'],
    clientVisible: false,
  },
  APP_STORE_REVIEW_LAST_NAME: {
    group: 'App Store review contact',
    easLocation: 'local gate + CI/EAS workflow if metadata is automated',
    requiredForEasProduction: false,
    visibility: 'sensitive',
    validation: 'Non-empty last name for App Review contact',
    usedBy: ['store.config.js apple.review', 'metadata preview', 'release-check'],
    releaseStatusLabels: ['App Store review contact'],
    clientVisible: false,
  },
  APP_STORE_REVIEW_EMAIL: {
    group: 'App Store review contact',
    easLocation: 'local gate + CI/EAS workflow if metadata is automated',
    requiredForEasProduction: false,
    visibility: 'sensitive',
    validation: 'Reachable email address',
    usedBy: ['store.config.js apple.review', 'metadata preview', 'release-check'],
    releaseStatusLabels: ['App Store review contact'],
    clientVisible: false,
  },
  APP_STORE_REVIEW_PHONE: {
    group: 'App Store review contact',
    easLocation: 'local gate + CI/EAS workflow if metadata is automated',
    requiredForEasProduction: false,
    visibility: 'sensitive',
    validation: 'Reachable phone number with at least 7 digits',
    usedBy: ['store.config.js apple.review', 'metadata preview', 'release-check'],
    releaseStatusLabels: ['App Store review contact'],
    clientVisible: false,
  },
  APP_STORE_PRIVACY_ANSWERS_REVIEWED: {
    group: 'Manual release confirmations',
    easLocation: 'local gate + CI/EAS workflow',
    requiredForEasProduction: false,
    visibility: 'plaintext',
    validation: 'Set to 1 only after App Store privacy answers match the final build',
    usedBy: ['release-check --strict', 'release-status'],
    releaseStatusLabels: ['APP_STORE_PRIVACY_ANSWERS_REVIEWED'],
    clientVisible: false,
  },
  ADMOB_PRIVACY_MESSAGES_CONFIGURED: {
    group: 'Manual release confirmations',
    easLocation: 'local gate + CI/EAS workflow',
    requiredForEasProduction: false,
    visibility: 'plaintext',
    validation: 'Set to 1 only after AdMob Privacy & messaging is configured and tested',
    usedBy: ['release-check --strict', 'release-status'],
    releaseStatusLabels: ['ADMOB_PRIVACY_MESSAGES_CONFIGURED'],
    clientVisible: false,
  },
  APP_STORE_BUNDLE_ID_CONFIRMED: {
    group: 'Manual release confirmations',
    easLocation: 'local gate + CI/EAS workflow',
    requiredForEasProduction: false,
    visibility: 'plaintext',
    validation: 'Set to 1 only after final bundle ID/package records are confirmed',
    usedBy: ['release-check --strict', 'release-status'],
    releaseStatusLabels: ['APP_STORE_BUNDLE_ID_CONFIRMED'],
    clientVisible: false,
  },
  APP_STORE_CONNECT_RECORD_READY: {
    group: 'Manual release confirmations',
    easLocation: 'local gate + CI/EAS workflow',
    requiredForEasProduction: false,
    visibility: 'plaintext',
    validation: 'Set to 1 only after the App Store Connect record exists',
    usedBy: ['release-check --strict', 'release-status'],
    releaseStatusLabels: ['APP_STORE_CONNECT_RECORD_READY'],
    clientVisible: false,
  },
  EAS_REMOTE_VERSION_INITIALIZED: {
    group: 'Manual release confirmations',
    easLocation: 'local gate + CI/EAS workflow',
    requiredForEasProduction: false,
    visibility: 'plaintext',
    validation: 'Set to 1 only after npx eas-cli build:version:set is complete',
    usedBy: ['release-check --strict', 'release-status'],
    releaseStatusLabels: ['EAS_REMOTE_VERSION_INITIALIZED'],
    clientVisible: false,
  },
  PRODUCTION_DEVICE_TESTED: {
    group: 'Manual release confirmations',
    easLocation: 'local gate + CI/EAS workflow',
    requiredForEasProduction: false,
    visibility: 'plaintext',
    validation: 'Set to 1 only after the exact production/TestFlight build passes device smoke',
    usedBy: ['release-check --strict', 'release-status', 'docs/production-device-smoke-test.md'],
    releaseStatusLabels: ['PRODUCTION_DEVICE_TESTED'],
    clientVisible: false,
  },
};

const missingDefinitions = envKeys.filter((key) => !definitions[key]);
const extraDefinitions = Object.keys(definitions).filter((key) => !envKeys.includes(key));

if (missingDefinitions.length > 0 || extraDefinitions.length > 0) {
  throw new Error(`EAS env definitions mismatch. Missing: ${missingDefinitions.join(', ') || 'none'}; extra: ${extraDefinitions.join(', ') || 'none'}`);
}

const keys = envKeys.map((key) => {
  const definition = definitions[key];
  const releaseStatuses = definition.releaseStatusLabels.map((label) => {
    const row = statusByLabel[label];
    return {
      label,
      status: row?.status ?? 'UNKNOWN',
      detail: row?.detail ?? 'No release-status row found.',
    };
  });

  return {
    key,
    ...definition,
    releaseStatuses,
  };
});

const productionBuildProfile = easJson.build?.production ?? {};
const checklist = {
  schemaVersion: 1,
  source: 'scripts/generate-eas-env-checklist.js',
  generatedFrom: {
    envTemplate: '.env.example',
    easJson: 'eas.json',
    releaseStatus: 'scripts/release-status.js --json',
    expoDocs: 'https://docs.expo.dev/eas/environment-variables/',
  },
  eas: {
    cliVersion: easJson.cli?.version,
    appVersionSource: easJson.cli?.appVersionSource,
    productionBuildProfile: {
      autoIncrement: productionBuildProfile.autoIncrement,
      environment: productionBuildProfile.environment ?? null,
      ready: productionBuildProfile.environment === 'production',
    },
  },
  summary: {
    totalKeys: keys.length,
    requiredForEasProduction: keys.filter((item) => item.requiredForEasProduction).length,
    clientVisible: keys.filter((item) => item.clientVisible).length,
    sensitive: keys.filter((item) => item.visibility === 'sensitive').length,
    plaintext: keys.filter((item) => item.visibility === 'plaintext').length,
    missingDefinitions: missingDefinitions.length,
    productionProfileEnvironmentReady: productionBuildProfile.environment === 'production',
  },
  officialReferences: [
    {
      title: 'Expo SDK 56 reference',
      url: 'https://docs.expo.dev/versions/v56.0.0/',
    },
    {
      title: 'EAS environment variables',
      url: 'https://docs.expo.dev/eas/environment-variables/',
    },
  ],
  commands: [
    'eas env:create --name EXPO_PUBLIC_ADMOB_IOS_APP_ID --environment production --visibility sensitive',
    'eas env:create --name APP_STORE_BASE_URL --environment production --visibility plaintext',
    'eas env:pull --environment production',
    'npm run release:status',
  ],
  keys,
};

fs.writeFileSync(jsonPath, `${JSON.stringify(checklist, null, 2)}\n`);
fs.writeFileSync(markdownPath, renderMarkdown(checklist));
console.log(`generated ${path.relative(root, markdownPath)} and ${path.relative(root, jsonPath)}`);

function readEnvTemplateKeys() {
  return fs.readFileSync(envExamplePath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.match(/^([A-Z0-9_]+)=/)?.[1])
    .filter(Boolean);
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

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function renderMarkdown(values) {
  const rows = values.keys.map((item) => {
    const releaseStatus = item.releaseStatuses.map((row) => `${row.label}: ${row.status}`).join('<br>');
    return [
      `\`${item.key}\``,
      item.group,
      item.requiredForEasProduction ? 'Yes' : 'No',
      item.visibility,
      item.easLocation,
      releaseStatus,
      item.validation,
    ].map(escapeTable).join(' | ');
  }).map((row) => `| ${row} |`).join('\n');
  const commands = values.commands.map((command) => `- \`${command}\``).join('\n');
  const references = values.officialReferences.map((reference) => `- ${reference.title}: ${reference.url}`).join('\n');

  return `# EAS Environment Checklist

This checklist maps \`.env.example\` to EAS production environment variables, local release gates, and App Store metadata usage.

## EAS Production Profile

- \`build.production.environment\`: ${values.eas.productionBuildProfile.environment ?? 'missing'}
- Production profile ready: ${values.eas.productionBuildProfile.ready ? 'Yes' : 'No'}
- Production auto-increment: ${values.eas.productionBuildProfile.autoIncrement ? 'Yes' : 'No'}
- App version source: ${values.eas.appVersionSource}

## Summary

- Env keys: ${values.summary.totalKeys}
- Required for EAS production build: ${values.summary.requiredForEasProduction}
- Client-visible after bundling: ${values.summary.clientVisible}
- Sensitive visibility: ${values.summary.sensitive}
- Plaintext visibility: ${values.summary.plaintext}

Client-visible values should not use EAS secret visibility, because values embedded in the app bundle are readable by anyone running the app. Use sensitive visibility for AdMob IDs and review contact fields to reduce log exposure, but still treat bundled values as public.

## Commands

${commands}

## Keys

| Key | Group | EAS production | Visibility | Where to set | Current release status | Validation |
| --- | --- | --- | --- | --- | --- | --- |
${rows}

## Official References

${references}
`;
}

function escapeTable(value) {
  return String(value ?? '').replace(/\|/g, '\\|');
}
