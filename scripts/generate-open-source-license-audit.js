const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const jsonPath = path.join(root, 'docs/open-source-license-audit.json');
const markdownPath = path.join(root, 'docs/open-source-license-audit.md');

const permissiveLicenses = new Set([
  '0BSD',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'BlueOak-1.0.0',
  'ISC',
  'MIT',
  'Python-2.0',
]);
const noticeLicenses = new Set([
  'CC-BY-4.0',
  'CC0-1.0',
  'Unlicense',
]);
const weakCopyleftNoticeLicenses = new Set([
  'MPL-2.0',
]);
const prohibitedLicenses = new Set([
  'AGPL-1.0',
  'AGPL-1.0-only',
  'AGPL-1.0-or-later',
  'AGPL-3.0',
  'AGPL-3.0-only',
  'AGPL-3.0-or-later',
  'GPL-1.0',
  'GPL-1.0-only',
  'GPL-1.0-or-later',
  'GPL-2.0',
  'GPL-2.0-only',
  'GPL-2.0-or-later',
  'GPL-3.0',
  'GPL-3.0-only',
  'GPL-3.0-or-later',
  'LGPL-2.0',
  'LGPL-2.0-only',
  'LGPL-2.0-or-later',
  'LGPL-2.1',
  'LGPL-2.1-only',
  'LGPL-2.1-or-later',
  'LGPL-3.0',
  'LGPL-3.0-only',
  'LGPL-3.0-or-later',
  'SSPL-1.0',
  'BUSL-1.1',
  'UNLICENSED',
]);

const packageJson = readJson('package.json');
const packageLock = readJson('package-lock.json');
const contentRightsAudit = readOptionalJson('docs/content-rights-audit.json') ?? {};
const runtimeAssetManifest = readOptionalJson('docs/runtime-asset-manifest.json') ?? {};
const packages = packageLock.packages ?? {};
const productionDependencies = Object.keys(packageJson.dependencies ?? {});
const devDependencies = Object.keys(packageJson.devDependencies ?? {});
const packageEntries = Object.entries(packages)
  .filter(([packagePath]) => packagePath.startsWith('node_modules/'))
  .map(([packagePath, entry]) => normalizePackageEntry(packagePath, entry));
const runtimePackagePaths = collectRuntimePackagePaths(productionDependencies);
const runtimeEntries = packageEntries.filter((entry) => runtimePackagePaths.has(entry.path));
const allClassified = packageEntries.map(classifyEntry);
const runtimeClassified = runtimeEntries.map(classifyEntry);
const unknownRuntime = runtimeClassified.filter((entry) => entry.classification === 'unknown');
const prohibitedRuntime = runtimeClassified.filter((entry) => entry.classification === 'prohibited');
const unknownAll = allClassified.filter((entry) => entry.classification === 'unknown');
const prohibitedAll = allClassified.filter((entry) => entry.classification === 'prohibited');
const reviewRuntime = runtimeClassified.filter((entry) => entry.reviewRequired);
const directRuntime = productionDependencies.map((name) => {
  const packagePath = `node_modules/${name}`;
  const entry = runtimeClassified.find((candidate) => candidate.path === packagePath);

  return {
    name,
    path: packagePath,
    version: entry?.version ?? packages[packagePath]?.version ?? null,
    license: entry?.license ?? packages[packagePath]?.license ?? 'UNKNOWN',
    classification: entry?.classification ?? 'missing',
  };
});
const licenseDistribution = countBy(allClassified, 'license');
const runtimeLicenseDistribution = countBy(runtimeClassified, 'license');
const localAssetsReady =
  contentRightsAudit.summary?.risk === 'PASS' &&
  runtimeAssetManifest.summary?.audioCount === 3 &&
  runtimeAssetManifest.summary?.pngCount === 6;
const localReady =
  packageLock.lockfileVersion === 3 &&
  productionDependencies.length > 0 &&
  unknownRuntime.length === 0 &&
  prohibitedRuntime.length === 0 &&
  unknownAll.length === 0 &&
  prohibitedAll.length === 0 &&
  directRuntime.every((entry) => entry.classification !== 'missing') &&
  localAssetsReady;
const audit = {
  schemaVersion: 1,
  source: 'scripts/generate-open-source-license-audit.js',
  generatedFrom: {
    packageJson: 'package.json',
    packageLock: 'package-lock.json',
    contentRightsAudit: 'docs/content-rights-audit.json',
    runtimeAssetManifest: 'docs/runtime-asset-manifest.json',
  },
  posture: {
    statement: 'Kana Sprint keeps a reproducible local dependency license audit before App Store submission.',
    limitation: 'This is an automated dependency and local-asset license screen, not legal advice.',
    actionIfHit: 'Replace or review flagged packages before submission, then rerun npm run legal:licenses and npm run release:verify.',
  },
  summary: {
    risk: localReady ? 'PASS' : 'REVIEW',
    localReady,
    lockfileVersion: packageLock.lockfileVersion,
    totalPackages: packageEntries.length,
    runtimePackages: runtimeClassified.length,
    devOnlyPackages: packageEntries.length - runtimeClassified.length,
    directRuntimeDependencies: productionDependencies.length,
    directDevDependencies: devDependencies.length,
    distinctLicenses: Object.keys(licenseDistribution).length,
    runtimeDistinctLicenses: Object.keys(runtimeLicenseDistribution).length,
    unknownRuntimeLicenses: unknownRuntime.length,
    prohibitedRuntimeLicenses: prohibitedRuntime.length,
    unknownAllLicenses: unknownAll.length,
    prohibitedAllLicenses: prohibitedAll.length,
    reviewRuntimeLicenses: reviewRuntime.length,
    contentRightsRisk: contentRightsAudit.summary?.risk ?? 'UNKNOWN',
    runtimeAudioAssets: runtimeAssetManifest.summary?.audioCount ?? 0,
    runtimePngAssets: runtimeAssetManifest.summary?.pngCount ?? 0,
  },
  acceptedLicenseFamilies: {
    permissive: [...permissiveLicenses],
    noticeRequired: [...noticeLicenses],
    weakCopyleftAllowedWithNotice: [...weakCopyleftNoticeLicenses],
    prohibitedWithoutPermissiveAlternative: [...prohibitedLicenses],
  },
  directRuntime,
  licenseDistribution,
  runtimeLicenseDistribution,
  runtimeReviewPackages: reviewRuntime.map(publicEntry),
  runtimeUnknownPackages: unknownRuntime.map(publicEntry),
  runtimeProhibitedPackages: prohibitedRuntime.map(publicEntry),
  allUnknownPackages: unknownAll.map(publicEntry),
  allProhibitedPackages: prohibitedAll.map(publicEntry),
};

fs.writeFileSync(jsonPath, `${JSON.stringify(audit, null, 2)}\n`);
fs.writeFileSync(markdownPath, renderMarkdown(audit));

if (audit.summary.risk !== 'PASS') {
  console.error(`open-source license audit requires review: ${unknownRuntime.length} unknown runtime licenses, ${prohibitedRuntime.length} prohibited runtime licenses`);
  process.exit(1);
}

console.log(`generated ${path.relative(root, markdownPath)} and ${path.relative(root, jsonPath)}`);

function normalizePackageEntry(packagePath, entry) {
  return {
    path: packagePath,
    name: packageNameFromPath(packagePath),
    version: entry.version ?? null,
    license: normalizeLicense(entry.license ?? entry.licenses ?? licenseFromInstalledPackage(packagePath)),
    dependencies: {
      ...(entry.dependencies ?? {}),
      ...(entry.optionalDependencies ?? {}),
    },
  };
}

function classifyEntry(entry) {
  const tokens = licenseTokens(entry.license);
  const hasOr = /\bOR\b/i.test(entry.license);
  const hasPermissive = tokens.some((token) => permissiveLicenses.has(token) || noticeLicenses.has(token));
  const hasWeakCopyleftNotice = tokens.some((token) => weakCopyleftNoticeLicenses.has(token));
  const hasProhibited = tokens.some((token) => prohibitedLicenses.has(token));

  if (!entry.license || entry.license === 'UNKNOWN') {
    return { ...entry, classification: 'unknown', reviewRequired: true };
  }

  if (hasProhibited && !(hasOr && hasPermissive)) {
    return { ...entry, classification: 'prohibited', reviewRequired: true };
  }

  if (hasProhibited && hasOr && hasPermissive) {
    return { ...entry, classification: 'dual-license-permissive-option', reviewRequired: true };
  }

  if (hasWeakCopyleftNotice) {
    return { ...entry, classification: 'weak-copyleft-notice', reviewRequired: true };
  }

  if (hasPermissive) {
    return { ...entry, classification: 'permissive', reviewRequired: false };
  }

  return { ...entry, classification: 'unknown', reviewRequired: true };
}

function collectRuntimePackagePaths(dependencyNames) {
  const seen = new Set();
  const queue = dependencyNames
    .map((name) => `node_modules/${name}`)
    .filter((packagePath) => packages[packagePath]);

  while (queue.length > 0) {
    const packagePath = queue.shift();
    if (seen.has(packagePath)) continue;

    seen.add(packagePath);
    const entry = packages[packagePath] ?? {};
    const dependencies = {
      ...(entry.dependencies ?? {}),
      ...(entry.optionalDependencies ?? {}),
    };

    for (const dependencyName of Object.keys(dependencies)) {
      const dependencyPath = resolveDependencyPath(packagePath, dependencyName);
      if (dependencyPath && !seen.has(dependencyPath)) queue.push(dependencyPath);
    }
  }

  return seen;
}

function resolveDependencyPath(fromPackagePath, dependencyName) {
  let scope = fromPackagePath;

  while (true) {
    const nested = scope ? `${scope}/node_modules/${dependencyName}` : `node_modules/${dependencyName}`;
    if (packages[nested]) return nested;

    const parentIndex = scope.lastIndexOf('/node_modules/');
    if (parentIndex >= 0) {
      scope = scope.slice(0, parentIndex);
      continue;
    }

    if (scope) {
      scope = '';
      continue;
    }

    return null;
  }
}

function packageNameFromPath(packagePath) {
  const segment = packagePath.split('node_modules/').filter(Boolean).pop() ?? packagePath;
  const parts = segment.split('/');

  return parts[0]?.startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0];
}

function licenseFromInstalledPackage(packagePath) {
  const packageJsonPath = path.join(root, packagePath, 'package.json');
  if (!fs.existsSync(packageJsonPath)) return null;

  try {
    return JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')).license;
  } catch {
    return null;
  }
}

function normalizeLicense(value) {
  if (!value) return 'UNKNOWN';
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === 'string' ? entry : entry.type ?? entry.name))
      .filter(Boolean)
      .join(' OR ') || 'UNKNOWN';
  }
  if (typeof value === 'object') return value.type ?? value.name ?? 'UNKNOWN';
  return String(value).trim() || 'UNKNOWN';
}

function licenseTokens(value) {
  return String(value)
    .replace(/[()]/g, ' ')
    .split(/\s+OR\s+|\s+AND\s+|\s+WITH\s+|\s+/i)
    .map((token) => token.trim())
    .filter((token) => token && !['OR', 'AND', 'WITH'].includes(token.toUpperCase()));
}

function countBy(entries, key) {
  return entries.reduce((counts, entry) => {
    const value = entry[key] ?? 'UNKNOWN';
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function publicEntry(entry) {
  return {
    name: entry.name,
    version: entry.version,
    path: entry.path,
    license: entry.license,
    classification: entry.classification,
  };
}

function renderMarkdown(values) {
  const directRows = values.directRuntime
    .map((entry) => `| ${entry.name} | ${entry.version ?? 'n/a'} | ${entry.license} | ${entry.classification} |`)
    .join('\n');
  const licenseRows = Object.entries(values.runtimeLicenseDistribution)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([license, count]) => `| ${license} | ${count} |`)
    .join('\n');
  const reviewRows = values.runtimeReviewPackages.length > 0
    ? values.runtimeReviewPackages.map((entry) => `| ${entry.name} | ${entry.version ?? 'n/a'} | ${entry.license} | ${entry.classification} |`).join('\n')
    : '| None | n/a | n/a | n/a |';

  return `# Open Source License Audit

${values.posture.statement}

${values.posture.limitation}

## Summary

- Risk: ${values.summary.risk}
- Local ready: ${values.summary.localReady ? 'Yes' : 'No'}
- Lockfile version: ${values.summary.lockfileVersion}
- Runtime packages: ${values.summary.runtimePackages}
- Total lockfile packages: ${values.summary.totalPackages}
- Dev-only packages: ${values.summary.devOnlyPackages}
- Direct runtime dependencies: ${values.summary.directRuntimeDependencies}
- Distinct runtime licenses: ${values.summary.runtimeDistinctLicenses}
- Unknown runtime licenses: ${values.summary.unknownRuntimeLicenses}
- Prohibited runtime licenses: ${values.summary.prohibitedRuntimeLicenses}
- Runtime packages needing notice/review: ${values.summary.reviewRuntimeLicenses}
- Content rights risk: ${values.summary.contentRightsRisk}
- Runtime assets: ${values.summary.runtimePngAssets} PNG / ${values.summary.runtimeAudioAssets} audio

## Runtime License Distribution

| License | Packages |
| --- | ---: |
${licenseRows}

## Direct Runtime Dependencies

| Package | Version | License | Classification |
| --- | --- | --- | --- |
${directRows}

## Runtime Notice Or Review Packages

| Package | Version | License | Classification |
| --- | --- | --- | --- |
${reviewRows}

If this audit fails, replace or review the flagged package before App Store submission.
`;
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function readOptionalJson(relativePath) {
  try {
    return readJson(relativePath);
  } catch {
    return null;
  }
}
