const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const jsonPath = path.join(root, 'docs/external-todo-tracker.json');
const markdownPath = path.join(root, 'docs/external-todo-tracker.md');

const releaseStatus = readReleaseStatus();
const externalReadiness = readJson('docs/external-readiness.json');
const storeSubmissionInputPack = readJson('docs/store-submission-input-pack.json');
const accountServicePreflight = readJson('docs/account-service-preflight.json');

const externalRows = (releaseStatus.rows ?? []).filter((row) => row.category === 'external');
const blockingRows = externalRows.filter((row) => row.status === 'TODO' || row.status === 'BAD');
const optionalRows = externalRows.filter((row) => row.status === 'INFO');
const readinessByLabel = Object.fromEntries((externalReadiness.items ?? []).map((item) => [item.label, item]));
const inputFields = storeSubmissionInputPack.envLocalTemplate ?? [];
const accountChecks = accountServicePreflight.checks ?? [];

const items = externalRows.map((row) => {
  const readiness = readinessByLabel[row.label] ?? {};
  const envKeys = readiness.env ?? envKeysFor(row.label);
  const relatedInputs = inputFields.filter((entry) =>
    envKeys.includes(entry.key) ||
    (entry.releaseStatuses ?? []).some((status) => status.label === row.label) ||
    (entry.externalItems ?? []).some((item) => item.label === row.label),
  );
  const relatedAccountChecks = accountChecks.filter((entry) =>
    (entry.releaseStatuses ?? []).some((status) => status.label === row.label),
  );
  const blocking = row.status === 'TODO' || row.status === 'BAD';

  return {
    id: readiness.id ?? slug(row.label),
    label: row.label,
    status: row.status,
    blocking,
    phase: phaseFor(row.label),
    system: readiness.system ?? systemFor(row.label),
    detail: row.detail,
    env: envKeys,
    action: readiness.action ?? actionFor(row.label),
    evidence: readiness.evidence ?? row.detail,
    verification: readiness.verification ?? ['npm run release:status'],
    accountChecks: relatedAccountChecks.map((entry) => ({
      id: entry.id,
      system: entry.system,
      command: entry.command,
      status: entry.status,
    })),
    inputFields: relatedInputs.map((entry) => ({
      key: entry.key,
      group: entry.group,
      visibility: entry.visibility,
      requiredForEasProduction: Boolean(entry.requiredForEasProduction),
      placeholder: entry.placeholder,
    })),
    blocks: blocking ? [
      'npm run release:store-ready',
      'npm run metadata:ios',
      'npm run build:ios',
      'npm run submit:ios',
      'App Store Connect submit for review',
    ] : [],
    completionRule: completionRuleFor(row.label, envKeys),
  };
});

const tracker = {
  schemaVersion: 1,
  source: 'scripts/generate-external-todo-tracker.js',
  generatedFrom: {
    releaseStatus: 'scripts/release-status.js --json',
    externalReadiness: 'docs/external-readiness.json',
    storeSubmissionInputPack: 'docs/store-submission-input-pack.json',
    accountServicePreflight: 'docs/account-service-preflight.json',
  },
  summary: {
    externalItems: externalRows.length,
    blockingItems: blockingRows.length,
    optionalItems: optionalRows.length,
    trackedItems: items.length,
    readyItems: items.filter((item) => item.status === 'OK').length,
    badItems: items.filter((item) => item.status === 'BAD').length,
    todoItems: items.filter((item) => item.status === 'TODO').length,
    infoItems: items.filter((item) => item.status === 'INFO').length,
    envKeys: unique(items.flatMap((item) => item.env)).length,
    accountChecks: unique(items.flatMap((item) => item.accountChecks.map((check) => check.id))).length,
    blockedFinalCommands: unique(items.flatMap((item) => item.blocks)).length,
  },
  finalCommandsBlockedUntilClear: [
    'npm run release:store-ready',
    'npm run metadata:ios',
    'npm run build:ios',
    'npm run submit:ios',
  ],
  items,
};

fs.writeFileSync(jsonPath, `${JSON.stringify(tracker, null, 2)}\n`);
fs.writeFileSync(markdownPath, renderMarkdown(tracker));
console.log(`generated ${path.relative(root, markdownPath)} and ${path.relative(root, jsonPath)}`);

function renderMarkdown(values) {
  const phaseRows = ['hosting', 'apple', 'admob', 'expo', 'device', 'optional']
    .map((phase) => {
      const phaseItems = values.items.filter((item) => item.phase === phase);
      if (phaseItems.length === 0) return '';

      const rows = phaseItems.map((item) => {
        const env = item.env.length > 0 ? item.env.map((key) => `\`${key}\``).join(', ') : 'None';
        const checks = item.accountChecks.length > 0
          ? item.accountChecks.map((check) => `\`${check.command}\``).join('<br>')
          : 'Manual';

        return `| ${item.status} | ${escapeTable(item.label)} | ${env} | ${checks} | ${escapeTable(item.completionRule)} |`;
      }).join('\n');

      return `### ${titleCase(phase)}

| Status | Item | Env / confirmation keys | Account checks | Completion rule |
| --- | --- | --- | --- | --- |
${rows}`;
    })
    .filter(Boolean)
    .join('\n\n');
  const commands = values.finalCommandsBlockedUntilClear.map((command) => `- \`${command}\``).join('\n');

  return `# External TODO Tracker

This tracker keeps the remaining external App Store, EAS, AdMob, hosting, and device-test work tied to release-status, input fields, account checks, and final blocked commands.

## Summary

- External items: ${values.summary.externalItems}
- Blocking items: ${values.summary.blockingItems}
- Optional info items: ${values.summary.optionalItems}
- Env / confirmation keys: ${values.summary.envKeys}
- Related account checks: ${values.summary.accountChecks}
- Blocked final commands: ${values.summary.blockedFinalCommands}

## Final Commands Blocked Until Clear

${commands}

## Items By Phase

${phaseRows}
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

function envKeysFor(label) {
  if (/^[A-Z0-9_]+$/.test(label)) return [label];
  return [];
}

function phaseFor(label) {
  if (label.startsWith('Public ')) return label === 'Public marketing URL' ? 'optional' : 'hosting';
  if (label.includes('AdMob')) return 'admob';
  if (label.includes('EAS')) return 'expo';
  if (label.includes('PRODUCTION_DEVICE')) return 'device';
  return 'apple';
}

function systemFor(label) {
  if (label.startsWith('Public ')) return 'Public HTTPS hosting';
  if (label.includes('AdMob')) return 'Google AdMob';
  if (label.includes('EAS')) return 'Expo EAS';
  if (label.includes('PRODUCTION_DEVICE')) return 'Physical iPhone or TestFlight';
  return 'App Store Connect';
}

function actionFor(label) {
  if (/^[A-Z0-9_]+$/.test(label)) return `Complete the external action and set ${label}=1.`;
  return `Complete the external setup for ${label}.`;
}

function completionRuleFor(label, envKeys) {
  if (/^[A-Z0-9_]+$/.test(label)) {
    return `Set ${label}=1 only after the real action is complete, then rerun npm run release:status.`;
  }

  if (envKeys.length > 0) {
    return `Fill ${envKeys.join(', ')}, rerun the listed verification commands, and confirm release:status reports ${label} as OK.`;
  }

  return `Rerun the listed verification commands and confirm release:status reports ${label} as OK or INFO.`;
}

function titleCase(value) {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function escapeTable(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
}
