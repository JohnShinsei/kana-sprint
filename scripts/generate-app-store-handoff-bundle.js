const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const jsonPath = path.join(root, 'docs/app-store-handoff-bundle.json');
const markdownPath = path.join(root, 'docs/app-store-handoff-bundle.md');

const appJson = readJson('app.json').expo;
const publicSiteManifest = readJson('docs/public-site-manifest.json');
const screenshotManifest = readJson('docs/app-store-screenshot-manifest.json');
const metadataPreview = readJson('docs/app-store-metadata-preview.json');
const screenshotQaAudit = readJson('docs/screenshot-qa-audit.json');
const publicSiteDeployAudit = readJson('docs/public-site-deploy-audit.json');
const releaseStatus = readReleaseStatusWithoutSelf();

const screenshotPaths = [
  ...(screenshotManifest.defaultPack?.screenshots ?? []).map((entry) => entry.path),
  ...(screenshotManifest.localizedPacks ?? []).flatMap((pack) => (pack.screenshots ?? []).map((entry) => entry.path)),
];
const publicSitePaths = [
  ...((publicSiteManifest.pages ?? []).map((page) => page.path)),
  'site/robots.txt',
  'site/_headers',
  'site/_redirects',
  ...(fs.existsSync(path.join(root, 'site/sitemap.xml')) ? ['site/sitemap.xml'] : []),
  'docs/public-site-manifest.json',
  'docs/public-site-deploy-audit.md',
  'docs/public-site-deploy-audit.json',
  'docs/public-site-hosting-handoff.md',
  'docs/public-site-hosting-handoff.json',
  'docs/public-site-hosting-verification.md',
  'docs/public-site-hosting-verification.json',
  '.github/workflows/deploy-site.yml',
];
const groups = [
  group('public-site', 'Public support/privacy/license website', publicSitePaths),
  group('screenshots', 'App Store screenshot upload packs', screenshotPaths),
  group('metadata', 'App Store metadata sources', [
    'store.config.js',
    'docs/app-store-localizations.json',
    'docs/app-store-metadata-preview.json',
    'docs/app-store-metadata-upload-packet.md',
    'docs/app-store-metadata-upload-packet.json',
    'docs/app-store-copy-audit.md',
    'docs/app-store-copy-audit.json',
  ]),
  group('review-compliance', 'Review, privacy, ads, and content evidence', [
    'docs/release-packet.md',
    'docs/release-packet.json',
    'docs/app-store-review-guide.md',
    'docs/app-store-review-guide.json',
    'docs/app-store-connect-checklist.md',
    'docs/app-store-connect-checklist.json',
    'docs/app-store-age-rating-audit.md',
    'docs/app-store-age-rating-audit.json',
    'docs/study-bank-depth-audit.md',
    'docs/study-bank-depth-audit.json',
    'docs/study-content-localization-audit.md',
    'docs/study-content-localization-audit.json',
    'docs/content-rights-audit.md',
    'docs/content-rights-audit.json',
    'docs/open-source-license-audit.md',
    'docs/open-source-license-audit.json',
    'docs/privacy-manifest-audit.md',
    'docs/privacy-manifest-audit.json',
    'docs/app-store-privacy-answers.md',
    'docs/app-store-privacy-answers.json',
    'docs/privacy-review-packet.md',
    'docs/privacy-review-packet.json',
    'docs/admob-release-audit.md',
    'docs/admob-release-audit.json',
    'docs/admob-setup-handoff.md',
    'docs/admob-setup-handoff.json',
    'docs/data-flow-privacy-audit.md',
    'docs/data-flow-privacy-audit.json',
    'docs/runtime-ui-flow-audit.md',
    'docs/runtime-ui-flow-audit.json',
  ]),
  group('eas-submit', 'EAS build and submit handoff', [
    'eas.json',
    '.easignore',
    '.env.example',
    'docs/eas-env-checklist.md',
    'docs/eas-env-checklist.json',
    'docs/store-submission.env.template',
    'docs/store-submission-input-pack.md',
    'docs/store-submission-input-pack.json',
    'docs/account-service-preflight.md',
    'docs/account-service-preflight.json',
    'docs/eas-build-preflight.md',
    'docs/eas-build-preflight.json',
    'docs/eas-submission-checklist.md',
    'docs/eas-submission-checklist.json',
    'docs/final-launch-runbook.md',
    'docs/final-launch-runbook.json',
    'docs/production-device-smoke-test.md',
    'docs/production-device-smoke-test.json',
    'docs/external-readiness.md',
    'docs/external-readiness.json',
    'docs/external-todo-tracker.md',
    'docs/external-todo-tracker.json',
  ]),
  group('source-config', 'Source and runtime configuration snapshot', [
    '.github/workflows/release-verify.yml',
    'README.md',
    'docs/release-handoff.md',
    'app.json',
    'app.config.js',
    'package.json',
    'package-lock.json',
    'src/gameData.ts',
    'src/i18n.ts',
    'App.tsx',
  ]),
];

const uniqueFiles = new Map();
for (const currentGroup of groups) {
  for (const file of currentGroup.files) uniqueFiles.set(file.path, file);
}
const allFiles = [...uniqueFiles.values()];
const missingFiles = allFiles.filter((file) => !file.exists);
const localStatusReady =
  (releaseStatus.rows ?? [])
    .filter((row) => row.category === 'local')
    .every((row) => row.status === 'OK');
const externalBlockingRows = (releaseStatus.rows ?? []).filter(
  (row) => row.category === 'external' && (row.status === 'TODO' || row.status === 'BAD'),
);
const localReady =
  missingFiles.length === 0 &&
  localStatusReady &&
  publicSiteManifest.pageCount === 44 &&
  screenshotPaths.length === 176 &&
  (metadataPreview.locales ?? []).length === 10 &&
  screenshotQaAudit.summary?.risk === 'PASS' &&
  publicSiteDeployAudit.summary?.localReady === true;
const bundle = {
  schemaVersion: 1,
  source: 'scripts/generate-app-store-handoff-bundle.js',
  generatedFrom: {
    releaseStatus: 'scripts/release-status.js --json',
    publicSiteManifest: 'docs/public-site-manifest.json',
    screenshotManifest: 'docs/app-store-screenshot-manifest.json',
    metadataPreview: 'docs/app-store-metadata-preview.json',
    releasePacket: 'docs/release-packet.json',
    easSubmissionChecklist: 'docs/eas-submission-checklist.json',
  },
  app: {
    name: appJson.name,
    version: appJson.version,
    bundleIdentifier: appJson.ios?.bundleIdentifier,
    packageName: appJson.android?.package,
  },
  summary: {
    risk: localReady ? 'PASS' : 'REVIEW',
    localReady,
    externalReady: externalBlockingRows.length === 0,
    totalFiles: allFiles.length,
    missingFiles: missingFiles.length,
    totalBytes: allFiles.reduce((sum, file) => sum + (file.bytes ?? 0), 0),
    publicSitePages: publicSiteManifest.pageCount,
    publicSiteRoutes: publicSiteDeployAudit.summary?.routeCount ?? 0,
    screenshotEntries: screenshotPaths.length,
    localizedScreenshotEntries: (screenshotManifest.localizedPacks ?? []).reduce(
      (sum, pack) => sum + (pack.screenshots?.length ?? 0),
      0,
    ),
    appStoreLocales: metadataPreview.locales?.length ?? 0,
    externalBlockingItems: externalBlockingRows.length,
  },
  uploadPlan: [
    step(1, 'Host the full site/ directory over production HTTPS, preserving nested locale routes and control files; use .github/workflows/deploy-site.yml when publishing from GitHub Pages.'),
    step(2, 'Upload App Store screenshots from assets/store/ios and assets/store/ios-localized according to docs/app-store-screenshot-manifest.json.'),
    step(3, 'Push metadata with npm run metadata:ios after public support/privacy URLs and review contact values are set.'),
    step(4, 'Fill App Store Connect privacy, age rating, export compliance, pricing, and review fields using the docs/ evidence files in this handoff.'),
    step(5, 'Run npm run release:store-ready, then npm run build:ios and npm run submit:ios.'),
  ],
  groups,
  missingFiles: missingFiles.map((file) => file.path),
  releaseStatus,
  commands: [
    'npm run release:verify',
    'npm run handoff:bundle',
    'npm run release:store-ready',
    'npm run metadata:ios',
    'npm run build:ios',
    'npm run submit:ios',
  ],
};

fs.writeFileSync(jsonPath, `${JSON.stringify(bundle, null, 2)}\n`);
fs.writeFileSync(markdownPath, renderMarkdown(bundle));

if (bundle.summary.risk !== 'PASS') {
  console.error(`app store handoff bundle requires review: ${bundle.summary.missingFiles} missing files`);
  process.exit(1);
}

console.log(`generated ${path.relative(root, markdownPath)} and ${path.relative(root, jsonPath)}`);

function group(id, label, paths) {
  const files = [...new Set(paths)]
    .map(fileInfo)
    .sort((left, right) => left.path.localeCompare(right.path));

  return {
    id,
    label,
    files,
    summary: {
      files: files.length,
      missingFiles: files.filter((file) => !file.exists).length,
      bytes: files.reduce((sum, file) => sum + (file.bytes ?? 0), 0),
    },
  };
}

function fileInfo(relativePath) {
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) {
    return {
      path: relativePath,
      exists: false,
      bytes: null,
      sha256: null,
    };
  }

  const buffer = fs.readFileSync(filePath);
  return {
    path: relativePath,
    exists: true,
    bytes: buffer.length,
    sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
  };
}

function step(order, action) {
  return { order, action };
}

function readReleaseStatusWithoutSelf() {
  const result = spawnSync(process.execPath, ['scripts/release-status.js', '--json'], {
    cwd: root,
    encoding: 'utf8',
    shell: false,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`release-status exited with status ${result.status}`);
  }

  const parsed = JSON.parse(result.stdout.replace(/^\uFEFF/, '').trim());
  const rows = (parsed.rows ?? []).filter((row) => row.label !== 'App Store handoff bundle');
  return {
    summary: summarizeRows(rows),
    rows,
  };
}

function summarizeRows(rows) {
  return {
    ok: rows.filter((row) => row.status === 'OK').length,
    todo: rows.filter((row) => row.status === 'TODO').length,
    bad: rows.filter((row) => row.status === 'BAD').length,
    info: rows.filter((row) => row.status === 'INFO').length,
    categories: ['local', 'external'].reduce((categories, category) => {
      const categoryRows = rows.filter((row) => row.category === category);
      categories[category] = {
        ok: categoryRows.filter((row) => row.status === 'OK').length,
        todo: categoryRows.filter((row) => row.status === 'TODO').length,
        bad: categoryRows.filter((row) => row.status === 'BAD').length,
        info: categoryRows.filter((row) => row.status === 'INFO').length,
      };
      return categories;
    }, {}),
  };
}

function renderMarkdown(values) {
  const groupRows = values.groups
    .map((entry) => `| ${entry.label} | ${entry.summary.files} | ${entry.summary.missingFiles} | ${entry.summary.bytes} |`)
    .join('\n');
  const uploadSteps = values.uploadPlan
    .map((entry) => `${entry.order}. ${entry.action}`)
    .join('\n');
  const commands = values.commands.map((command) => `- \`${command}\``).join('\n');
  const blockerRows = values.releaseStatus.rows
    .filter((row) => row.category === 'external' && (row.status === 'TODO' || row.status === 'BAD'))
    .map((row) => `| ${row.status} | ${row.label} | ${row.detail} |`)
    .join('\n');

  return `# App Store Handoff Bundle

This file is the local upload and reviewer-evidence manifest. It indexes the generated public website, screenshots, metadata, review notes, privacy/ad evidence, EAS configuration, and source configuration snapshot.

## Summary

- Risk: ${values.summary.risk}
- Local handoff ready: ${values.summary.localReady ? 'Yes' : 'No'}
- External store ready: ${values.summary.externalReady ? 'Yes' : 'No'}
- Files indexed: ${values.summary.totalFiles}
- Missing files: ${values.summary.missingFiles}
- Total bytes: ${values.summary.totalBytes}
- Public site pages: ${values.summary.publicSitePages}
- Public site routes: ${values.summary.publicSiteRoutes}
- Screenshot entries: ${values.summary.screenshotEntries}
- Localized screenshot entries: ${values.summary.localizedScreenshotEntries}
- App Store locales: ${values.summary.appStoreLocales}
- External blocking items: ${values.summary.externalBlockingItems}

## Groups

| Group | Files | Missing | Bytes |
| --- | ---: | ---: | ---: |
${groupRows}

## Upload Plan

${uploadSteps}

## External Blockers

| Status | Item | Detail |
| --- | --- | --- |
${blockerRows || '| OK | None | External setup is complete. |'}

## Commands

${commands}

The full file inventory with SHA-256 hashes is in \`docs/app-store-handoff-bundle.json\`.
`;
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}
