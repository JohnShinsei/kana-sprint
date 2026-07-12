const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const jsonPath = path.join(root, 'docs/store-submission-input-pack.json');
const markdownPath = path.join(root, 'docs/store-submission-input-pack.md');
const envLocalTemplateRelativePath = 'docs/store-submission.env.template';
const envLocalTemplatePath = path.join(root, envLocalTemplateRelativePath);
const envExamplePath = path.join(root, '.env.example');

const envTemplate = fs.readFileSync(envExamplePath, 'utf8');
const envKeys = readEnvTemplateKeys();
const externalReadiness = readJson('docs/external-readiness.json');
const easEnvChecklist = readJson('docs/eas-env-checklist.json');
const releaseStatus = readReleaseStatus();
const releaseStatusByLabel = Object.fromEntries((releaseStatus.rows ?? []).map((row) => [row.label, row]));
const easKeyByName = Object.fromEntries((easEnvChecklist.keys ?? []).map((item) => [item.key, item]));
const externalItemsByEnv = externalEnvMap(externalReadiness.items ?? []);
const generatedStatusLabels = new Set([
  'Store submission input pack',
  'Final launch runbook',
  'App Store handoff bundle',
]);
const localRows = (releaseStatus.rows ?? []).filter(
  (row) => row.category === 'local' && !generatedStatusLabels.has(row.label),
);

const envLocalTemplate = envKeys.map((key) => {
  const checklistEntry = easKeyByName[key] ?? {};
  const externalItems = externalItemsByEnv.get(key) ?? [];

  return {
    key,
    group: checklistEntry.group ?? 'Unclassified',
    value: defaultValueFor(key, checklistEntry),
    placeholder: placeholderFor(key, checklistEntry),
    requiredForEasProduction: Boolean(checklistEntry.requiredForEasProduction),
    visibility: checklistEntry.visibility ?? 'plaintext',
    validation: checklistEntry.validation ?? '',
    clientVisible: Boolean(checklistEntry.clientVisible),
    releaseStatuses: checklistEntry.releaseStatuses ?? [],
    externalItems: externalItems.map((item) => ({
      id: item.id,
      label: item.label,
      status: item.status,
      action: item.action,
      evidence: item.evidence,
    })),
  };
});

const easProductionCommands = envLocalTemplate
  .filter((item) => item.requiredForEasProduction)
  .map((item) => ({
    key: item.key,
    visibility: item.visibility,
    command: `eas env:create --name ${item.key} --environment production --visibility ${item.visibility}`,
    valueHint: item.validation,
  }));

const manualConfirmations = envLocalTemplate
  .filter((item) => item.group === 'Manual release confirmations')
  .map((item) => {
    const status = firstStatus(item);
    const externalItem = item.externalItems[0];

    return {
      key: item.key,
      setTo: '1',
      currentStatus: status?.status ?? 'UNKNOWN',
      detail: status?.detail ?? 'No release-status row found.',
      action: externalItem?.action ?? item.validation,
      evidence: externalItem?.evidence ?? item.validation,
    };
  });

const appStoreConnectFields = [
  field('Public support URL', ['APP_STORE_BASE_URL', 'APP_STORE_SUPPORT_URL'], 'App Store Connect support URL and Settings support link.'),
  field('Public privacy URL', ['APP_STORE_BASE_URL', 'APP_STORE_PRIVACY_URL'], 'App Store Connect privacy policy URL and Settings privacy link.'),
  field('Public marketing URL', ['APP_STORE_BASE_URL', 'APP_STORE_MARKETING_URL'], 'Optional App Store Connect marketing URL.'),
  field('App Store review contact', [
    'APP_STORE_REVIEW_FIRST_NAME',
    'APP_STORE_REVIEW_LAST_NAME',
    'APP_STORE_REVIEW_EMAIL',
    'APP_STORE_REVIEW_PHONE',
  ], 'App Review contact block in App Store Connect or EAS Metadata.'),
  field('Live AdMob IDs', [
    'EXPO_PUBLIC_ADMOB_IOS_APP_ID',
    'EXPO_PUBLIC_ADMOB_ANDROID_APP_ID',
    'EXPO_PUBLIC_ADMOB_REWARDED_IOS_UNIT_ID',
    'EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_UNIT_ID',
  ], 'Google AdMob app IDs and rewarded ad unit IDs for the submitted build.'),
];

const verificationCommands = unique([
  'npm run store:input-pack',
  'npm run release:status',
  ...(externalReadiness.items ?? []).flatMap((item) => item.verification ?? []),
  ...(externalReadiness.finalCommands ?? []),
  'npm run release:verify',
  'npm run release:store-ready',
  'npm run metadata:ios',
  'npm run build:ios',
  'npm run submit:ios',
]);
const envLocalTemplateText = `${renderEnvBlock(envLocalTemplate)}\n`;

const pack = {
  schemaVersion: 1,
  source: 'scripts/generate-store-submission-input-pack.js',
  generatedFrom: {
    envTemplate: '.env.example',
    externalReadiness: 'docs/external-readiness.json',
    easEnvironmentChecklist: 'docs/eas-env-checklist.json',
    releaseStatus: 'scripts/release-status.js --json',
  },
  outputs: {
    markdown: 'docs/store-submission-input-pack.md',
    json: 'docs/store-submission-input-pack.json',
    envLocalTemplate: envLocalTemplateRelativePath,
  },
  summary: {
    envKeys: envKeys.length,
    fillableEnvKeys: envLocalTemplate.length,
    externalItems: externalReadiness.summary?.total ?? 0,
    blockingExternalItems: externalReadiness.summary?.blocking ?? 0,
    easProductionKeys: easEnvChecklist.summary?.requiredForEasProduction ?? 0,
    manualConfirmationKeys: manualConfirmations.length,
    localReady: localRows.length > 0 && localRows.every((row) => row.status === 'OK'),
  },
  envLocalTemplateFile: {
    path: envLocalTemplateRelativePath,
    bytes: Buffer.byteLength(envLocalTemplateText),
    sha256: require('crypto').createHash('sha256').update(envLocalTemplateText).digest('hex'),
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
  envLocalTemplate,
  easProductionCommands,
  appStoreConnectFields,
  manualConfirmations,
  verificationCommands,
};

fs.writeFileSync(jsonPath, `${JSON.stringify(pack, null, 2)}\n`);
fs.writeFileSync(markdownPath, renderMarkdown(pack));
fs.writeFileSync(envLocalTemplatePath, envLocalTemplateText);
console.log(`generated ${path.relative(root, markdownPath)}, ${path.relative(root, jsonPath)}, and ${path.relative(root, envLocalTemplatePath)}`);

function readEnvTemplateKeys() {
  return envTemplate
    .split(/\r?\n/)
    .map((line) => line.match(/^([A-Z0-9_]+)=/)?.[1])
    .filter(Boolean);
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
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

function externalEnvMap(items) {
  const map = new Map();

  for (const item of items) {
    for (const key of item.env ?? []) {
      const current = map.get(key) ?? [];
      current.push(item);
      map.set(key, current);
    }
  }

  return map;
}

function defaultValueFor(key, checklistEntry) {
  if (checklistEntry.group === 'Manual release confirmations') return '0';
  if (key === 'APP_STORE_MARKETING_URL') return '';
  return '';
}

function placeholderFor(key, checklistEntry) {
  if (checklistEntry.group === 'Manual release confirmations') return '0';
  if (key.endsWith('_APP_ID')) return 'ca-app-pub-0000000000000000~0000000000';
  if (key.endsWith('_UNIT_ID')) return 'ca-app-pub-0000000000000000/0000000000';
  if (key.endsWith('_URL')) return 'production HTTPS URL';
  if (key.endsWith('_EMAIL')) return 'review email address';
  if (key.endsWith('_PHONE')) return 'review phone number';
  if (key.endsWith('_FIRST_NAME')) return 'review first name';
  if (key.endsWith('_LAST_NAME')) return 'review last name';
  return checklistEntry.validation || 'value';
}

function firstStatus(item) {
  for (const status of item.releaseStatuses ?? []) {
    const current = releaseStatusByLabel[status.label];
    if (current) return current;
  }

  return null;
}

function field(label, keys, destination) {
  const readinessItem = (externalReadiness.items ?? []).find((item) => item.label === label);

  return {
    label,
    keys,
    destination,
    currentStatus: readinessItem?.status ?? 'UNKNOWN',
    detail: readinessItem?.detail ?? '',
    action: readinessItem?.action ?? '',
    evidence: readinessItem?.evidence ?? '',
  };
}

function renderMarkdown(values) {
  const envBlock = renderEnvBlock(values.envLocalTemplate);
  const easCommands = values.easProductionCommands
    .map((entry) => `- \`${entry.command}\``)
    .join('\n');
  const fields = values.appStoreConnectFields
    .map((entry) => `| ${escapeTable(entry.label)} | ${entry.keys.map((key) => `\`${key}\``).join(', ')} | ${escapeTable(entry.currentStatus)} | ${escapeTable(entry.destination)} | ${escapeTable(entry.action)} |`)
    .join('\n');
  const confirmations = values.manualConfirmations
    .map((entry) => `| \`${entry.key}\` | ${escapeTable(entry.currentStatus)} | \`${entry.setTo}\` | ${escapeTable(entry.action)} |`)
    .join('\n');
  const verification = values.verificationCommands.map((command, index) => `${index + 1}. \`${command}\``).join('\n');
  const references = values.officialReferences.map((reference) => `- ${reference.title}: ${reference.url}`).join('\n');

  return `# Store Submission Input Pack

This pack is the fillable handoff for the remaining external App Store, EAS, AdMob, hosting, and device-test inputs. It is generated from \`.env.example\`, \`docs/external-readiness.json\`, \`docs/eas-env-checklist.json\`, and \`release:status\`.

## Summary

- Local evidence ready: ${values.summary.localReady ? 'Yes' : 'No'}
- Env keys to fill: ${values.summary.fillableEnvKeys}
- External readiness items: ${values.summary.externalItems}
- Blocking external items: ${values.summary.blockingExternalItems}
- EAS production build keys: ${values.summary.easProductionKeys}
- Manual confirmations: ${values.summary.manualConfirmationKeys}
- Standalone env template: \`${values.outputs.envLocalTemplate}\`

## Fill .env.local

Create or update \`.env.local\` from \`${values.outputs.envLocalTemplate}\` or with the values below. Keep manual confirmations at \`0\` until the real account, store, or device action is complete.

\`\`\`dotenv
${envBlock}
\`\`\`

## Mirror To EAS Production

Run these for the build-time values used by the EAS production profile. Paste values interactively instead of placing production secrets directly in shell history.

${easCommands}

## App Store Connect Fields

| Field | Env keys | Current status | Destination | Action |
| --- | --- | --- | --- | --- |
${fields}

## Manual Confirmations

| Env key | Current status | Set to | Required action |
| --- | --- | --- | --- |
${confirmations}

## Verification Order

${verification}

## Official References

${references}
`;
}

function renderEnvBlock(items) {
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

function escapeTable(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}
