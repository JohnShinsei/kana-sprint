const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const jsonPath = path.join(root, 'docs/account-service-preflight.json');
const markdownPath = path.join(root, 'docs/account-service-preflight.md');
const liveMode = process.argv.includes('--live');
const appJson = readJson('app.json').expo;
const easJson = readJson('eas.json');
const packageJson = readJson('package.json');
const releaseStatus = readReleaseStatus();
const storeSubmissionInputPack = readOptionalJson('docs/store-submission-input-pack.json') ?? {};
const externalRows = (releaseStatus.rows ?? []).filter((row) => row.category === 'external');
const externalBlockingRows = externalRows.filter((row) => row.status === 'TODO' || row.status === 'BAD');
const requiredEasEnvKeys = (storeSubmissionInputPack.easProductionCommands ?? []).map((entry) => entry.key);
const liveProbes = liveMode ? runLiveProbes() : [];

const checks = [
  check({
    id: 'expo-account-login',
    system: 'Expo account',
    owner: 'Expo/EAS',
    command: 'npx eas-cli whoami',
    liveProbeId: 'eas-whoami',
    evidence: 'The command prints the Expo account that owns or can access the EAS project.',
    releaseStatusLabels: ['EAS_REMOTE_VERSION_INITIALIZED'],
    nextAction: 'Log in with npx eas-cli login, then rerun npm run account:preflight -- --live.',
    officialReference: 'https://docs.expo.dev/eas/cli/',
  }),
  check({
    id: 'eas-project-link',
    system: 'EAS project linkage',
    owner: 'Expo/EAS',
    command: 'npx eas-cli project:info',
    liveProbeId: 'eas-project-info',
    evidence: `The project is linked to slug ${appJson.slug} and bundle identifier ${appJson.ios?.bundleIdentifier}.`,
    releaseStatusLabels: ['APP_STORE_BUNDLE_ID_CONFIRMED'],
    nextAction: 'If the project is not linked, run npx eas-cli project:init and confirm the project ID before building.',
    officialReference: 'https://docs.expo.dev/eas/cli/',
  }),
  check({
    id: 'eas-production-env',
    system: 'EAS production environment',
    owner: 'Expo/EAS',
    command: 'npx eas-cli env:list production --format long --scope project',
    liveProbeId: 'eas-production-env-list',
    evidence: `${requiredEasEnvKeys.length} required production build keys exist in the EAS production environment: ${requiredEasEnvKeys.join(', ')}.`,
    releaseStatusLabels: ['Live AdMob IDs', 'Public support URL', 'Public privacy URL'],
    nextAction: 'Use docs/store-submission-input-pack.md to create or update the production EAS environment variables.',
    officialReference: 'https://docs.expo.dev/eas/environment-variables/',
  }),
  check({
    id: 'eas-remote-version',
    system: 'Remote app version',
    owner: 'Expo/EAS',
    command: 'npx eas-cli build:version:get --platform ios --profile production --json --non-interactive',
    liveProbeId: 'eas-build-version-get',
    evidence: 'The production iOS app has remote version state initialized before the first store build.',
    releaseStatusLabels: ['EAS_REMOTE_VERSION_INITIALIZED'],
    nextAction: 'Run npx eas-cli build:version:set after the final bundle ID and EAS project are confirmed.',
    officialReference: 'https://docs.expo.dev/eas/cli/',
  }),
  check({
    id: 'app-store-connect-record',
    system: 'App Store Connect',
    owner: 'Apple',
    command: 'npm run metadata:ios',
    evidence: `The App Store Connect app record exists for ${appJson.ios?.bundleIdentifier}, and EAS Metadata can push store.config.js.`,
    releaseStatusLabels: ['APP_STORE_CONNECT_RECORD_READY', 'App Store review contact', 'Public support URL', 'Public privacy URL'],
    nextAction: 'Create the App Store Connect record, fill review contact fields, then run npm run metadata:ios after release:store-ready passes.',
    officialReference: 'https://docs.expo.dev/submit/ios/',
  }),
  check({
    id: 'admob-production',
    system: 'AdMob production account',
    owner: 'Google AdMob',
    command: 'npm run ads:audit',
    evidence: 'Production app IDs, rewarded-unit IDs, and Privacy & messaging are configured for the submitted build.',
    releaseStatusLabels: ['Live AdMob IDs', 'ADMOB_PRIVACY_MESSAGES_CONFIGURED'],
    nextAction: 'Create real AdMob apps and rewarded units, configure Privacy & messaging, then fill .env.local and EAS production env values.',
    officialReference: 'https://developers.google.com/admob/ios/privacy',
  }),
  check({
    id: 'public-hosting',
    system: 'Public HTTPS hosting',
    owner: 'Hosting provider',
    command: 'npm run site:verify-hosting',
    evidence: 'Support, privacy, license, localized pages, and sitemap routes open over production HTTPS without auth.',
    releaseStatusLabels: ['Public support URL', 'Public privacy URL', 'Public marketing URL'],
    nextAction: 'Host the site/ directory, set APP_STORE_BASE_URL or explicit support/privacy URLs, then rerun site verification.',
    officialReference: 'https://docs.expo.dev/eas/environment-variables/',
  }),
  check({
    id: 'ios-production-build',
    system: 'iOS production build',
    owner: 'Expo/EAS + Apple Developer',
    command: packageJson.scripts?.['build:ios'],
    evidence: 'EAS Build produces a store-distribution iOS archive for the final bundle ID.',
    releaseStatusLabels: ['APP_STORE_BUNDLE_ID_CONFIRMED', 'EAS_REMOTE_VERSION_INITIALIZED'],
    nextAction: 'After all external TODOs are clear, run npm run release:store-ready and npm run build:ios.',
    officialReference: 'https://docs.expo.dev/build/setup/',
  }),
  check({
    id: 'testflight-device-smoke',
    system: 'TestFlight or physical iPhone',
    owner: 'Apple/TestFlight',
    command: 'docs/production-device-smoke-test.md',
    evidence: 'The exact production/TestFlight build passes first launch, N5-N1 gameplay, Settings links, BGM, and rewarded-ad continue checks.',
    releaseStatusLabels: ['PRODUCTION_DEVICE_TESTED'],
    nextAction: 'Install the submitted build through TestFlight or on a real iPhone and complete the smoke checklist.',
    officialReference: 'https://docs.expo.dev/submit/introduction/',
  }),
  check({
    id: 'ios-submit',
    system: 'EAS Submit to App Store Connect',
    owner: 'Expo/EAS + Apple',
    command: packageJson.scripts?.['submit:ios'],
    evidence: 'The latest production build is submitted to App Store Connect through EAS Submit.',
    releaseStatusLabels: ['APP_STORE_CONNECT_RECORD_READY', 'PRODUCTION_DEVICE_TESTED'],
    nextAction: 'Run npm run submit:ios only after release:store-ready and production device testing pass.',
    officialReference: 'https://docs.expo.dev/submit/introduction/',
  }),
];

const preflight = {
  schemaVersion: 1,
  source: 'scripts/generate-account-service-preflight.js',
  generatedFrom: {
    appConfig: 'app.json',
    easJson: 'eas.json',
    packageJson: 'package.json',
    releaseStatus: 'scripts/release-status.js --json',
    storeSubmissionInputPack: 'docs/store-submission-input-pack.json',
  },
  mode: liveMode ? 'live' : 'manual',
  app: {
    name: appJson.name,
    slug: appJson.slug,
    bundleIdentifier: appJson.ios?.bundleIdentifier,
    packageName: appJson.android?.package,
    version: appJson.version,
    easAppVersionSource: easJson.cli?.appVersionSource,
  },
  summary: {
    planReady: true,
    liveMode,
    checks: checks.length,
    liveProbes: liveProbes.length,
    commandsReady: checks.every((entry) => Boolean(entry.command)),
    externalBlockingItems: externalBlockingRows.length,
    manualOrTodoChecks: checks.filter((entry) => entry.status === 'MANUAL' || entry.status === 'TODO').length,
    okChecks: checks.filter((entry) => entry.status === 'OK').length,
  },
  commands: {
    manual: 'npm run account:preflight',
    live: 'npm run account:preflight -- --live',
    finalGate: packageJson.scripts?.['release:store-ready'],
    metadata: packageJson.scripts?.['metadata:ios'],
    build: packageJson.scripts?.['build:ios'],
    submit: packageJson.scripts?.['submit:ios'],
  },
  requiredEasProductionEnv: requiredEasEnvKeys,
  externalBlockingRows,
  checks,
  liveProbes,
  officialReferences: [
    { title: 'Expo SDK 56 reference', url: 'https://docs.expo.dev/versions/v56.0.0/' },
    { title: 'EAS Build setup', url: 'https://docs.expo.dev/build/setup/' },
    { title: 'EAS CLI reference', url: 'https://docs.expo.dev/eas/cli/' },
    { title: 'EAS environment variables', url: 'https://docs.expo.dev/eas/environment-variables/' },
    { title: 'EAS Submit', url: 'https://docs.expo.dev/submit/introduction/' },
  ],
};

fs.writeFileSync(jsonPath, `${JSON.stringify(preflight, null, 2)}\n`);
fs.writeFileSync(markdownPath, renderMarkdown(preflight));
console.log(`generated ${path.relative(root, markdownPath)} and ${path.relative(root, jsonPath)}`);

function check(values) {
  const probe = values.liveProbeId ? liveProbes.find((entry) => entry.id === values.liveProbeId) : null;
  const linkedRows = values.releaseStatusLabels
    .map((label) => externalRows.find((row) => row.label === label))
    .filter(Boolean);
  const blockingRows = linkedRows.filter((row) => row.status === 'TODO' || row.status === 'BAD');
  const liveOk = probe?.status === 'OK';
  const liveBad = probe && probe.status !== 'OK';
  const status = liveOk && blockingRows.length === 0
    ? 'OK'
    : liveBad
      ? 'TODO'
      : liveMode
        ? 'TODO'
        : 'MANUAL';

  return {
    ...values,
    status,
    liveProbe: probe
      ? {
        status: probe.status,
        detail: probe.detail,
      }
      : null,
    releaseStatuses: linkedRows.map((row) => ({
      label: row.label,
      status: row.status,
      detail: row.detail,
    })),
  };
}

function runLiveProbes() {
  return [
    probe('eas-whoami', ['eas-cli', 'whoami']),
    probe('eas-project-info', ['eas-cli', 'project:info']),
    probe('eas-production-env-list', ['eas-cli', 'env:list', 'production', '--format', 'long', '--scope', 'project']),
    probe('eas-build-version-get', ['eas-cli', 'build:version:get', '--platform', 'ios', '--profile', 'production', '--json', '--non-interactive']),
  ];
}

function probe(id, args) {
  const result = spawnSync('npx', args, {
    cwd: root,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    timeout: 30000,
  });
  const stdout = sanitize(result.stdout);
  const stderr = sanitize(result.stderr);
  const detail = stdout || stderr || result.error?.message || `exit ${result.status}`;

  return {
    id,
    command: `npx ${args.join(' ')}`,
    status: result.status === 0 ? 'OK' : 'TODO',
    exitCode: result.status,
    detail: detail.slice(0, 1000),
  };
}

function renderMarkdown(values) {
  const checkRows = values.checks
    .map((entry) => `| ${entry.status} | ${escapeTable(entry.system)} | \`${entry.command}\` | ${escapeTable(entry.nextAction)} |`)
    .join('\n');
  const blockerRows = values.externalBlockingRows
    .map((row) => `| ${row.status} | ${escapeTable(row.label)} | ${escapeTable(row.detail)} |`)
    .join('\n');
  const envKeys = values.requiredEasProductionEnv.map((key) => `- \`${key}\``).join('\n');
  const liveRows = values.liveProbes.length > 0
    ? values.liveProbes.map((entry) => `| ${entry.status} | \`${entry.command}\` | ${escapeTable(entry.detail)} |`).join('\n')
    : '| MANUAL | `npm run account:preflight -- --live` | Live account checks were not run in default release verification. |';
  const references = values.officialReferences.map((entry) => `- ${entry.title}: ${entry.url}`).join('\n');

  return `# Account And Service Preflight

This preflight keeps the external account and remote-service checks aligned with the current App Store handoff. Default mode is manual and does not contact EAS, Apple, AdMob, or hosting providers. Run live mode only when you are ready to test the signed-in machine state.

## Summary

- Mode: ${values.mode}
- Checks: ${values.summary.checks}
- Commands ready: ${values.summary.commandsReady ? 'Yes' : 'No'}
- External blocking items: ${values.summary.externalBlockingItems}
- Manual/TODO checks: ${values.summary.manualOrTodoChecks}
- OK checks: ${values.summary.okChecks}

## Commands

- Generate manual pack: \`${values.commands.manual}\`
- Run live EAS probes: \`${values.commands.live}\`
- Final strict gate: \`${values.commands.finalGate}\`
- Metadata push: \`${values.commands.metadata}\`
- Build iOS: \`${values.commands.build}\`
- Submit iOS: \`${values.commands.submit}\`

## Required EAS Production Env

${envKeys}

## Remote Checks

| Status | System | Verification command | Next action |
| --- | --- | --- | --- |
${checkRows}

## Live Probe Output

| Status | Command | Detail |
| --- | --- | --- |
${liveRows}

## External Blockers

| Status | Item | Detail |
| --- | --- | --- |
${blockerRows || '| OK | None | All external blockers are clear. |'}

## Official References

${references}
`;
}

function readReleaseStatus() {
  const result = spawnSync(process.execPath, ['scripts/release-status.js', '--json'], {
    cwd: root,
    encoding: 'utf8',
    shell: false,
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

function sanitize(value) {
  return String(value ?? '')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '<email>')
    .replace(/(token|password|secret|key)=\S+/gi, '$1=<redacted>');
}

function escapeTable(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
}
