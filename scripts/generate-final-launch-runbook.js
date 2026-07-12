const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const jsonPath = path.join(root, 'docs/final-launch-runbook.json');
const markdownPath = path.join(root, 'docs/final-launch-runbook.md');

const appJson = readJson('app.json').expo;
const packageJson = readJson('package.json');
const releaseStatus = readReleaseStatus();
const externalReadiness = readJson('docs/external-readiness.json');
const storeSubmissionInputPack = readJson('docs/store-submission-input-pack.json');
const accountServicePreflight = readJson('docs/account-service-preflight.json');
const easSubmissionChecklist = readJson('docs/eas-submission-checklist.json');
const releasePacket = readJson('docs/release-packet.json');
const generatedSelfLabels = new Set(['Final launch runbook', 'App Store handoff bundle']);

const readinessRows = (releaseStatus.rows ?? []).filter((row) => !generatedSelfLabels.has(row.label));
const localRows = readinessRows.filter((row) => row.category === 'local');
const externalRows = (releaseStatus.rows ?? []).filter((row) => row.category === 'external');
const blockingRows = readinessRows.filter((row) => row.status === 'TODO' || row.status === 'BAD');
const externalBlockingRows = externalRows.filter((row) => row.status === 'TODO' || row.status === 'BAD');
const localReady = localRows.length > 0 && localRows.every((row) => row.status === 'OK');
const externalReady = externalBlockingRows.length === 0;
const strictGateReady = blockingRows.length === 0;

const phases = [
  phase({
    id: 'refresh-local-evidence',
    title: 'Refresh local release evidence',
    status: localReady ? 'READY' : 'REVIEW',
    command: packageJson.scripts?.['release:verify'] ? 'npm run release:verify' : null,
    evidence: ['docs/release-packet.md', 'docs/app-store-handoff-bundle.md', 'docs/final-launch-runbook.md'],
    requiredBefore: ['external-inputs', 'strict-store-gate'],
    action: 'Run the full local verification chain on the exact workspace state that will be submitted.',
  }),
  phase({
    id: 'external-inputs',
    title: 'Fill external inputs',
    status: externalReady ? 'READY' : 'TODO',
    command: 'npm run store:input-pack',
    evidence: ['docs/store-submission-input-pack.md', 'docs/external-readiness.md'],
    blockers: externalBlockingRows.map((row) => row.label),
    requiredBefore: ['strict-store-gate'],
    action: 'Fill .env.local, EAS production env values, public URLs, App Store review contact, AdMob IDs, and manual confirmations.',
  }),
  phase({
    id: 'account-service-preflight',
    title: 'Verify accounts and remote services',
    status: externalReady ? 'READY' : 'TODO',
    command: 'npm run account:preflight -- --live',
    evidence: ['docs/account-service-preflight.md'],
    blockers: accountServicePreflight.checks?.filter((entry) => entry.status !== 'OK').map((entry) => entry.system) ?? [],
    requiredBefore: ['strict-store-gate', 'build-ios'],
    action: 'Check signed-in Expo/EAS state, project linkage, EAS production env values, remote version state, App Store Connect, AdMob, public hosting, and TestFlight path.',
  }),
  phase({
    id: 'strict-store-gate',
    title: 'Run strict store-ready gate',
    status: strictGateReady ? 'READY' : 'BLOCKED',
    command: 'npm run release:store-ready',
    evidence: ['docs/release-packet.md', 'docs/eas-submission-checklist.md'],
    blockers: blockingRows.map((row) => row.label),
    requiredBefore: ['metadata-ios', 'build-ios', 'submit-ios'],
    action: 'Run the strict local gate only after every TODO/BAD release-status row is cleared.',
  }),
  phase({
    id: 'metadata-ios',
    title: 'Push App Store metadata',
    status: strictGateReady ? 'READY' : 'BLOCKED',
    command: 'npm run metadata:ios',
    evidence: ['store.config.js', 'docs/app-store-metadata-upload-packet.md'],
    blockers: blockingRows.map((row) => row.label),
    requiredBefore: ['build-ios'],
    action: 'Push localized App Store metadata after public URLs and review contact values are valid.',
  }),
  phase({
    id: 'build-ios',
    title: 'Build iOS production archive',
    status: strictGateReady ? 'READY' : 'BLOCKED',
    command: 'npm run build:ios',
    evidence: ['docs/eas-build-preflight.md', 'docs/account-service-preflight.md'],
    blockers: blockingRows.map((row) => row.label),
    requiredBefore: ['testflight-smoke', 'submit-ios'],
    action: 'Create the App Store distribution archive with EAS Build for the final bundle identifier.',
  }),
  phase({
    id: 'testflight-smoke',
    title: 'Run TestFlight or physical-device smoke',
    status: releaseStatus.rows?.find((row) => row.label === 'PRODUCTION_DEVICE_TESTED')?.status === 'OK' ? 'READY' : 'TODO',
    command: 'docs/production-device-smoke-test.md',
    evidence: ['docs/production-device-smoke-test.md'],
    blockers: ['PRODUCTION_DEVICE_TESTED'],
    requiredBefore: ['submit-ios', 'app-store-review'],
    action: 'Install the exact production/TestFlight build and complete the first-launch, N5-N1, Settings, BGM, links, and rewarded-ad smoke path.',
  }),
  phase({
    id: 'submit-ios',
    title: 'Submit iOS build',
    status: strictGateReady ? 'READY' : 'BLOCKED',
    command: 'npm run submit:ios',
    evidence: ['docs/eas-submission-checklist.md'],
    blockers: blockingRows.map((row) => row.label),
    requiredBefore: ['app-store-review'],
    action: 'Submit the production build to App Store Connect through EAS Submit.',
  }),
  phase({
    id: 'app-store-review',
    title: 'Send for App Review',
    status: strictGateReady ? 'READY' : 'BLOCKED',
    command: 'App Store Connect',
    evidence: ['docs/app-store-connect-checklist.md', 'docs/app-store-review-guide.md'],
    blockers: blockingRows.map((row) => row.label),
    requiredBefore: [],
    action: 'In App Store Connect, confirm privacy, age rating, export compliance, pricing, availability, screenshots, review notes, and submit for review.',
  }),
];

const runbook = {
  schemaVersion: 1,
  source: 'scripts/generate-final-launch-runbook.js',
  generatedFrom: {
    appConfig: 'app.json',
    packageJson: 'package.json',
    releaseStatus: 'scripts/release-status.js --json',
    externalReadiness: 'docs/external-readiness.json',
    storeSubmissionInputPack: 'docs/store-submission-input-pack.json',
    accountServicePreflight: 'docs/account-service-preflight.json',
    easSubmissionChecklist: 'docs/eas-submission-checklist.json',
    releasePacket: 'docs/release-packet.json',
  },
  app: {
    name: appJson.name,
    version: appJson.version,
    bundleIdentifier: appJson.ios?.bundleIdentifier,
    packageName: appJson.android?.package,
    locales: releasePacket.localization?.appLocales?.length ?? 0,
  },
  summary: {
    localReady,
    externalReady,
    strictGateReady,
    readyToRunMetadataBuildSubmit: strictGateReady,
    phaseCount: phases.length,
    readyPhases: phases.filter((entry) => entry.status === 'READY').length,
    todoPhases: phases.filter((entry) => entry.status === 'TODO').length,
    blockedPhases: phases.filter((entry) => entry.status === 'BLOCKED').length,
    reviewPhases: phases.filter((entry) => entry.status === 'REVIEW').length,
    localEvidenceRows: localRows.length,
    externalRows: externalRows.length,
    externalBlockingItems: externalBlockingRows.length,
  },
  currentStatus: releaseStatus.summary,
  finalCommands: [
    'npm run release:verify',
    'npm run account:preflight -- --live',
    'npm run release:store-ready',
    'npm run metadata:ios',
    'npm run build:ios',
    'npm run submit:ios',
  ].filter(Boolean),
  evidence: {
    externalReadinessBlocking: externalReadiness.summary?.blocking ?? 0,
    envInputs: storeSubmissionInputPack.summary?.fillableEnvKeys ?? 0,
    easProductionEnvKeys: storeSubmissionInputPack.summary?.easProductionKeys ?? 0,
    accountServiceChecks: accountServicePreflight.summary?.checks ?? 0,
    easSubmissionSequence: (easSubmissionChecklist.sequence ?? []).map((entry) => entry.command),
  },
  blockers: blockingRows,
  phases,
  officialReferences: [
    { title: 'Expo SDK 56 reference', url: 'https://docs.expo.dev/versions/v56.0.0/' },
    { title: 'EAS Build setup', url: 'https://docs.expo.dev/build/setup/' },
    { title: 'EAS CLI reference', url: 'https://docs.expo.dev/eas/cli/' },
    { title: 'EAS Submit', url: 'https://docs.expo.dev/submit/introduction/' },
  ],
};

fs.writeFileSync(jsonPath, `${JSON.stringify(runbook, null, 2)}\n`);
fs.writeFileSync(markdownPath, renderMarkdown(runbook));
console.log(`generated ${path.relative(root, markdownPath)} and ${path.relative(root, jsonPath)}`);

function phase(values) {
  return {
    ...values,
    commandReady: Boolean(values.command),
  };
}

function renderMarkdown(values) {
  const phases = values.phases
    .map((entry) => {
      const blockers = (entry.blockers ?? []).length > 0 ? entry.blockers.join(', ') : 'None';
      const evidence = entry.evidence.map((item) => `\`${item}\``).join(', ');

      return `| ${entry.status} | ${escapeTable(entry.title)} | \`${entry.command}\` | ${evidence} | ${escapeTable(blockers)} |`;
    })
    .join('\n');
  const commands = values.finalCommands.map((command, index) => `${index + 1}. \`${command}\``).join('\n');
  const blockers = values.blockers.length > 0
    ? values.blockers.map((row) => `- [${row.status}] ${row.label}: ${row.detail}`).join('\n')
    : '- None. The final metadata/build/submit sequence is unblocked.';
  const references = values.officialReferences.map((entry) => `- ${entry.title}: ${entry.url}`).join('\n');

  return `# Final Launch Runbook

This runbook is the last-mile execution map for moving Kana Sprint from local release evidence to App Store submission. Commands that can create remote state are marked BLOCKED until \`release:status\` has zero TODO/BAD rows.

## Summary

- Local evidence ready: ${values.summary.localReady ? 'Yes' : 'No'}
- External setup ready: ${values.summary.externalReady ? 'Yes' : 'No'}
- Strict store gate ready: ${values.summary.strictGateReady ? 'Yes' : 'No'}
- Ready to run metadata/build/submit: ${values.summary.readyToRunMetadataBuildSubmit ? 'Yes' : 'No'}
- Phases: ${values.summary.phaseCount}
- Ready phases: ${values.summary.readyPhases}
- TODO phases: ${values.summary.todoPhases}
- Blocked phases: ${values.summary.blockedPhases}
- External blocking items: ${values.summary.externalBlockingItems}

## Phase Plan

| Status | Phase | Command | Evidence | Current blockers |
| --- | --- | --- | --- | --- |
${phases}

## Final Command Order

${commands}

## Current Blockers

${blockers}

## Evidence Counts

- Env inputs: ${values.evidence.envInputs}
- EAS production env keys: ${values.evidence.easProductionEnvKeys}
- Account/service checks: ${values.evidence.accountServiceChecks}
- EAS submission sequence commands: ${values.evidence.easSubmissionSequence.length}

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

function escapeTable(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
}
