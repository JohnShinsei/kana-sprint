const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const root = path.resolve(__dirname, '..');
const jsonPath = path.join(root, 'docs/screenshot-qa-audit.json');
const markdownPath = path.join(root, 'docs/screenshot-qa-audit.md');
const screenshotManifest = readJson('docs/app-store-screenshot-manifest.json');
const localizationAudit = readOptionalJson('docs/localization-audit.json') ?? {};
const generatorPath = 'scripts/generate-store-screenshots.py';
const generatorSource = fs.readFileSync(path.join(root, generatorPath), 'utf8');

const expectedLocales = ['zh-Hans', 'zh-Hant', 'en', 'fr', 'it', 'de', 'es-ES', 'ko', 'pl', 'pt-BR'];
const expectedDevices = {
  'iphone-6.9': { width: 1320, height: 2868 },
  'iphone-6.5': { width: 1242, height: 2688 },
  'iphone-5.5': { width: 1242, height: 2208 },
  'ipad-13': { width: 2048, height: 2732 },
};
const expectedScenes = {
  '01-ready.png': 'Ready screen',
  '02-playing.png': 'Active round with rewarded-ad continue entry',
  '03-levels.png': 'JLPT N5-N1 level selection',
  '04-settings.png': 'Settings, language, BGM, local data, support, privacy',
};
const qualityThresholds = {
  minBytes: 40000,
  minLuminanceRange: 35,
  minLuminanceVariance: 80,
  minUniqueSampledColors: 4,
};
const requiredGeneratorMarkers = [
  { id: 'zh-n5-n1-copy', text: 'N5 到 N1' },
  { id: 'en-n5-n1-copy', text: 'N5 to N1' },
  { id: 'en-progress-copy', text: 'N5-N1 local progress' },
  { id: 'zh-level-count-copy', text: '133 词 / 42 句' },
  { id: 'en-level-count-copy', text: '133 words / 42 lines' },
  { id: 'zh-daily-streak-copy', text: '连续' },
  { id: 'en-daily-streak-copy', text: 'Streak' },
  { id: 'zh-daily-goal-copy', text: '每日目标' },
  { id: 'en-daily-goal-copy', text: 'Daily goal' },
  { id: 'en-daily-goal-progress-copy', text: 'Finish 3 runs today' },
  { id: 'zh-milestone-copy', text: '成就徽章' },
  { id: 'en-milestone-copy', text: 'Milestones' },
  { id: 'en-achievement-badge-copy', text: '20 mastered' },
  { id: 'rewarded-ad-copy', text: 'Watch ad to continue' },
  { id: 'ad-privacy-copy', text: 'Ad privacy' },
  { id: 'support-privacy-copy', text: 'Support & Privacy' },
  { id: 'local-data-reset-copy', text: 'Reset progress' },
  { id: 'bgm-copy', text: 'Classic BGM off by default' },
  { id: 'localized-pack-loop', text: 'LOCALES = [' },
  { id: 'cjk-font-fallback', text: 'has_cjk' },
  { id: 'hangul-font-fallback', text: 'has_hangul' },
];

const findings = [];
const checks = [];
const screenshots = [];
const duplicateMap = new Map();
const expectedPackCount = Object.keys(expectedDevices).length * Object.keys(expectedScenes).length;
const defaultByTail = new Map(
  (screenshotManifest.defaultPack?.screenshots ?? []).map((entry) => [
    tailForRoot(entry.path, screenshotManifest.defaultPack.root),
    entry,
  ]),
);
const packSummaries = [
  analyzePack(screenshotManifest.defaultPack, {
    kind: 'default',
    locale: 'en',
    root: 'assets/store/ios',
    expectedEnglishMatch: false,
  }),
  ...(screenshotManifest.localizedPacks ?? []).map((pack) =>
    analyzePack(pack, {
      kind: 'localized',
      locale: pack.locale,
      root: `assets/store/ios-localized/${pack.locale}`,
      expectedEnglishMatch: pack.locale === 'en',
    }),
  ),
];
const duplicateGroups = collectDuplicateGroups();
const unexpectedDuplicateGroups = duplicateGroups.filter((group) => !isExpectedDefaultEnglishDuplicate(group));
const expectedDefaultEnglishDuplicateGroups = duplicateGroups.filter(isExpectedDefaultEnglishDuplicate);
const defaultEnglishPack = packSummaries.find((pack) => pack.kind === 'localized' && pack.locale === 'en');
const nonEnglishPacks = packSummaries.filter((pack) => pack.kind === 'localized' && pack.locale !== 'en');
const generatorMarkers = requiredGeneratorMarkers.map((marker) => ({
  ...marker,
  found: generatorSource.includes(marker.text),
}));
const sceneCoverageReady = packSummaries.every((pack) =>
  sameSet(pack.scenes, Object.values(expectedScenes)),
);
const localizationRowsReady =
  localizationAudit.summary?.localizedScreenshotEntries === expectedLocales.length * expectedPackCount &&
  localizationAudit.summary?.appStoreLocales === expectedLocales.length;
const allScreenshotsReady = screenshots.every((entry) => entry.ready);
const missingFiles = screenshots.filter((entry) => entry.failures.includes('missing-file')).length;
const dimensionFailures = screenshots.filter((entry) => entry.failures.includes('dimension-mismatch')).length;
const alphaFailures = screenshots.filter((entry) => entry.failures.includes('alpha-channel')).length;
const smallFiles = screenshots.filter((entry) => entry.failures.includes('small-file')).length;
const lowVarianceFiles = screenshots.filter((entry) => entry.failures.includes('low-visual-variance')).length;
const defaultEnglishPackMatchesLocalizedEnglish =
  Boolean(defaultEnglishPack) && defaultEnglishPack.matchesDefaultCount === expectedPackCount;
const localizedNonEnglishDistinctFromDefault =
  nonEnglishPacks.length === expectedLocales.length - 1 &&
  nonEnglishPacks.every((pack) => pack.distinctFromDefaultCount === expectedPackCount);
const generatorCopyReady = generatorMarkers.every((marker) => marker.found);
const fontFallbackReady = generatorMarkers
  .filter((marker) => marker.id === 'cjk-font-fallback' || marker.id === 'hangul-font-fallback')
  .every((marker) => marker.found);

recordCheck(
  'manifest-complete',
  screenshotManifest.schemaVersion === 1 &&
    screenshotManifest.platform === 'ios' &&
    screenshotManifest.source === generatorPath &&
    (screenshotManifest.defaultPack?.screenshots ?? []).length === expectedPackCount &&
    (screenshotManifest.localizedPacks ?? []).length === expectedLocales.length,
  `${countScreenshots(screenshotManifest)} screenshot entries across default and localized packs.`,
);
recordCheck(
  'files-present',
  missingFiles === 0,
  missingFiles === 0 ? 'Every screenshot path exists.' : `${missingFiles} screenshot files are missing.`,
);
recordCheck(
  'png-upload-safety',
  dimensionFailures === 0 && alphaFailures === 0 && smallFiles === 0,
  `${dimensionFailures} dimension failures, ${alphaFailures} alpha-channel failures, ${smallFiles} undersized files.`,
);
recordCheck(
  'visual-variance',
  lowVarianceFiles === 0,
  `${screenshots.length - lowVarianceFiles}/${screenshots.length} screenshots pass sampled visual variance thresholds.`,
);
recordCheck(
  'scene-coverage',
  sceneCoverageReady,
  `${Object.values(expectedScenes).length} expected App Store scenes covered per pack.`,
);
recordCheck(
  'english-default-sync',
  defaultEnglishPackMatchesLocalizedEnglish,
  defaultEnglishPackMatchesLocalizedEnglish
    ? 'Localized English pack matches the default upload pack exactly.'
    : 'Localized English pack does not match the default upload pack.',
);
recordCheck(
  'localized-copy-distinct',
  localizedNonEnglishDistinctFromDefault,
  localizedNonEnglishDistinctFromDefault
    ? 'Every non-English localized pack differs from the default English screenshots.'
    : 'At least one non-English localized pack matches default screenshots unexpectedly.',
);
recordCheck(
  'duplicate-policy',
  unexpectedDuplicateGroups.length === 0,
  `${expectedDefaultEnglishDuplicateGroups.length} expected default/en duplicate groups; ${unexpectedDuplicateGroups.length} unexpected groups.`,
);
recordCheck(
  'generator-copy-markers',
  generatorCopyReady && fontFallbackReady,
  `${generatorMarkers.filter((marker) => marker.found).length}/${generatorMarkers.length} screenshot generator copy and font markers found.`,
);
recordCheck(
  'localization-audit-sync',
  localizationRowsReady,
  localizationRowsReady
    ? 'Localization audit agrees with screenshot locale and upload-pack counts.'
    : 'Localization audit screenshot counts do not match the generated screenshot manifest.',
);

const audit = {
  schemaVersion: 1,
  source: 'scripts/generate-screenshot-qa-audit.js',
  generatedFrom: {
    screenshotManifest: 'docs/app-store-screenshot-manifest.json',
    localizationAudit: 'docs/localization-audit.json',
    screenshotGenerator: generatorPath,
  },
  summary: {
    risk: checks.every((check) => check.status === 'PASS') && findings.length === 0 ? 'PASS' : 'REVIEW',
    totalScreenshots: screenshots.length,
    defaultEntries: screenshotManifest.defaultPack?.screenshots?.length ?? 0,
    localizedEntries: (screenshotManifest.localizedPacks ?? []).reduce((sum, pack) => sum + (pack.screenshots?.length ?? 0), 0),
    locales: screenshotManifest.localizedPacks?.length ?? 0,
    devices: Object.keys(expectedDevices).length,
    scenes: Object.keys(expectedScenes).length,
    missingFiles,
    dimensionFailures,
    alphaFailures,
    smallFiles,
    lowVarianceFiles,
    allScreenshotsReady,
    expectedDefaultEnglishDuplicateGroups: expectedDefaultEnglishDuplicateGroups.length,
    unexpectedDuplicateGroups: unexpectedDuplicateGroups.length,
    defaultEnglishPackMatchesLocalizedEnglish,
    localizedNonEnglishDistinctFromDefault,
    sceneCoverageReady,
    generatorCopyReady,
    fontFallbackReady,
    localizationRowsReady,
  },
  qualityThresholds,
  expected: {
    locales: expectedLocales,
    devices: expectedDevices,
    scenes: expectedScenes,
    entriesPerPack: expectedPackCount,
  },
  checks,
  packSummaries,
  duplicateGroups,
  unexpectedDuplicateGroups,
  generatorMarkers,
  screenshots,
  findings,
  commands: ['npm run screenshots:qa', 'npm run release:verify'],
};

fs.writeFileSync(jsonPath, `${JSON.stringify(audit, null, 2)}\n`);
fs.writeFileSync(markdownPath, renderMarkdown(audit));
console.log(`generated ${path.relative(root, markdownPath)} and ${path.relative(root, jsonPath)}`);

function analyzePack(pack, expectation) {
  const packFindings = [];
  const packScreenshots = pack?.screenshots ?? [];
  const packSummary = {
    kind: expectation.kind,
    locale: pack?.locale ?? expectation.locale,
    appStoreLocale: pack?.appStoreLocale ?? null,
    root: pack?.root ?? null,
    screenshots: packScreenshots.length,
    readyScreenshots: 0,
    matchesDefaultCount: 0,
    distinctFromDefaultCount: 0,
    devices: unique(packScreenshots.map((entry) => entry.device)),
    scenes: unique(packScreenshots.map((entry) => entry.scene)),
    minBytes: packScreenshots.length > 0 ? Math.min(...packScreenshots.map((entry) => entry.bytes ?? 0)) : 0,
    minLuminanceRange: null,
    minLuminanceVariance: null,
    minUniqueSampledColors: null,
    ready: false,
    findings: packFindings,
  };

  if (!pack) {
    addFinding('missing-pack', `Missing screenshot pack for ${expectation.locale}`);
    packFindings.push('missing-pack');
    return packSummary;
  }

  if (pack.root !== expectation.root) {
    addFinding('pack-root', `${pack.locale} screenshot pack root should be ${expectation.root}, got ${pack.root}`);
    packFindings.push('pack-root');
  }

  if (packScreenshots.length !== expectedPackCount) {
    addFinding('pack-count', `${pack.locale} screenshot pack should contain ${expectedPackCount} screenshots, got ${packScreenshots.length}`);
    packFindings.push('pack-count');
  }

  for (const entry of packScreenshots) {
    const result = analyzeScreenshot(entry, pack.root, expectation.kind, pack.locale);
    screenshots.push(result);
    packSummary.readyScreenshots += result.ready ? 1 : 0;

    if (expectation.kind === 'localized') {
      const defaultEntry = defaultByTail.get(tailForRoot(entry.path, pack.root));
      if (defaultEntry?.sha256 === entry.sha256) {
        packSummary.matchesDefaultCount += 1;
      } else {
        packSummary.distinctFromDefaultCount += 1;
      }
    }

    if (result.visualQuality) {
      packSummary.minLuminanceRange = minNullable(packSummary.minLuminanceRange, result.visualQuality.luminanceRange);
      packSummary.minLuminanceVariance = minNullable(packSummary.minLuminanceVariance, result.visualQuality.luminanceVariance);
      packSummary.minUniqueSampledColors = minNullable(packSummary.minUniqueSampledColors, result.visualQuality.uniqueSampledColors);
    }
  }

  if (expectation.expectedEnglishMatch && packSummary.matchesDefaultCount !== expectedPackCount) {
    addFinding('english-pack-mismatch', 'Localized English screenshot pack should exactly match the default upload pack.');
    packFindings.push('english-pack-mismatch');
  }

  if (!expectation.expectedEnglishMatch && expectation.kind === 'localized' && packSummary.distinctFromDefaultCount !== expectedPackCount) {
    addFinding('localized-pack-not-distinct', `${pack.locale} screenshot pack should differ from the default English pack.`);
    packFindings.push('localized-pack-not-distinct');
  }

  packSummary.ready =
    packFindings.length === 0 &&
    packSummary.readyScreenshots === expectedPackCount &&
    sameSet(packSummary.devices, Object.keys(expectedDevices)) &&
    sameSet(packSummary.scenes, Object.values(expectedScenes));

  return packSummary;
}

function analyzeScreenshot(entry, packRoot, packKind, locale) {
  const failures = [];
  const expectedDevice = expectedDevices[entry.device];
  const expectedScene = expectedScenes[path.basename(entry.path)];
  const absolutePath = path.join(root, entry.path);
  let png = null;
  let visualQuality = null;
  let currentBytes = 0;
  let currentSha256 = null;

  if (!entry.path.startsWith(`${packRoot}/`)) failures.push('root-mismatch');
  if (!expectedDevice) failures.push('unexpected-device');
  if (!expectedScene || entry.scene !== expectedScene) failures.push('scene-mismatch');
  if (!fs.existsSync(absolutePath)) failures.push('missing-file');

  if (fs.existsSync(absolutePath)) {
    const buffer = fs.readFileSync(absolutePath);
    currentBytes = buffer.length;
    currentSha256 = crypto.createHash('sha256').update(buffer).digest('hex');

    if (entry.bytes !== currentBytes) failures.push('byte-mismatch');
    if (entry.sha256 !== currentSha256) failures.push('hash-mismatch');
    if (currentBytes < qualityThresholds.minBytes) failures.push('small-file');

    try {
      const inspected = inspectPng(buffer);
      png = inspected.png;
      visualQuality = inspected.visualQuality;

      if (expectedDevice && (png.width !== expectedDevice.width || png.height !== expectedDevice.height)) {
        failures.push('dimension-mismatch');
      }

      if (entry.width !== png.width || entry.height !== png.height) failures.push('manifest-dimension-mismatch');
      if (png.hasAlphaChannel) failures.push('alpha-channel');
      if (!visualQuality.ready) failures.push('low-visual-variance');
    } catch (error) {
      failures.push('png-read-failed');
      addFinding('png-read-failed', `${entry.path}: ${error.message}`);
    }
  }

  if (failures.length > 0) {
    addFinding('screenshot-quality', `${entry.path}: ${failures.join(', ')}`);
  }

  const result = {
    path: entry.path,
    packKind,
    locale,
    device: entry.device,
    scene: entry.scene,
    bytes: currentBytes || entry.bytes,
    sha256: currentSha256 ?? entry.sha256,
    png,
    visualQuality,
    ready: failures.length === 0,
    failures,
  };

  if (result.sha256) {
    const group = duplicateMap.get(result.sha256) ?? [];
    group.push(result.path);
    duplicateMap.set(result.sha256, group);
  }

  return result;
}

function inspectPng(buffer) {
  const signature = buffer.subarray(0, 8).toString('hex');
  if (signature !== '89504e470d0a1a0a') {
    throw new Error('not a PNG file');
  }

  const idatChunks = [];
  let png = null;
  let offset = 8;

  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;

    if (dataEnd + 4 > buffer.length) {
      throw new Error(`PNG chunk ${type} is truncated`);
    }

    if (type === 'IHDR') {
      png = {
        width: buffer.readUInt32BE(dataStart),
        height: buffer.readUInt32BE(dataStart + 4),
        bitDepth: buffer[dataStart + 8],
        colorType: buffer[dataStart + 9],
        compressionMethod: buffer[dataStart + 10],
        filterMethod: buffer[dataStart + 11],
        interlaceMethod: buffer[dataStart + 12],
      };
      png.hasAlphaChannel = png.colorType === 4 || png.colorType === 6;
    } else if (type === 'IDAT') {
      idatChunks.push(buffer.subarray(dataStart, dataEnd));
    }

    offset = dataEnd + 4;
  }

  if (!png) throw new Error('missing IHDR chunk');
  if (idatChunks.length === 0) throw new Error('missing IDAT chunk');

  return {
    png,
    visualQuality: sampleVisualQuality(png, Buffer.concat(idatChunks)),
  };
}

function sampleVisualQuality(png, idatBuffer) {
  const bytesPerPixel = bytesPerPixelForColorType(png.colorType);
  const supported = png.bitDepth === 8 && png.interlaceMethod === 0 && bytesPerPixel > 0;

  if (!supported) {
    return {
      supported: false,
      ready: false,
      reason: `unsupported PNG colorType=${png.colorType}, bitDepth=${png.bitDepth}, interlace=${png.interlaceMethod}`,
      sampledPixels: 0,
      luminanceRange: 0,
      luminanceVariance: 0,
      uniqueSampledColors: 0,
    };
  }

  const raw = zlib.inflateSync(idatBuffer);
  const rowBytes = png.width * bytesPerPixel;
  const expectedBytes = png.height * (rowBytes + 1);

  if (raw.length < expectedBytes) {
    throw new Error(`inflated PNG data is shorter than expected (${raw.length} < ${expectedBytes})`);
  }

  let previous = Buffer.alloc(rowBytes);
  let current = Buffer.alloc(rowBytes);
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let sumSquares = 0;
  let sampledPixels = 0;
  const uniqueColors = new Set();
  const xStep = Math.max(1, Math.floor(png.width / 12));
  const yStep = Math.max(1, Math.floor(png.height / 18));

  for (let y = 0; y < png.height; y += 1) {
    const rowOffset = y * (rowBytes + 1);
    const filter = raw[rowOffset];
    const scanline = raw.subarray(rowOffset + 1, rowOffset + 1 + rowBytes);
    unfilterScanline(filter, scanline, current, previous, bytesPerPixel);

    if (y % yStep === 0) {
      for (let x = 0; x < png.width; x += xStep) {
        const pixelOffset = x * bytesPerPixel;
        const [red, green, blue] = rgbAt(current, pixelOffset, png.colorType);
        const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;

        min = Math.min(min, luminance);
        max = Math.max(max, luminance);
        sum += luminance;
        sumSquares += luminance * luminance;
        sampledPixels += 1;
        uniqueColors.add(`${red >> 4},${green >> 4},${blue >> 4}`);
      }
    }

    const swap = previous;
    previous = current;
    current = swap;
  }

  const mean = sum / sampledPixels;
  const variance = Math.max(0, sumSquares / sampledPixels - mean * mean);
  const luminanceRange = max - min;
  const uniqueSampledColors = uniqueColors.size;

  return {
    supported: true,
    ready:
      luminanceRange >= qualityThresholds.minLuminanceRange &&
      variance >= qualityThresholds.minLuminanceVariance &&
      uniqueSampledColors >= qualityThresholds.minUniqueSampledColors,
    sampledPixels,
    luminanceRange: round(luminanceRange),
    luminanceVariance: round(variance),
    uniqueSampledColors,
  };
}

function unfilterScanline(filter, scanline, current, previous, bytesPerPixel) {
  for (let index = 0; index < scanline.length; index += 1) {
    const raw = scanline[index];
    const left = index >= bytesPerPixel ? current[index - bytesPerPixel] : 0;
    const up = previous[index] ?? 0;
    const upLeft = index >= bytesPerPixel ? previous[index - bytesPerPixel] : 0;
    let predictor = 0;

    if (filter === 1) predictor = left;
    if (filter === 2) predictor = up;
    if (filter === 3) predictor = Math.floor((left + up) / 2);
    if (filter === 4) predictor = paethPredictor(left, up, upLeft);
    if (filter < 0 || filter > 4) throw new Error(`unsupported PNG filter ${filter}`);

    current[index] = (raw + predictor) & 0xff;
  }
}

function paethPredictor(left, up, upLeft) {
  const estimate = left + up - upLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upLeftDistance = Math.abs(estimate - upLeft);

  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) return left;
  if (upDistance <= upLeftDistance) return up;
  return upLeft;
}

function bytesPerPixelForColorType(colorType) {
  if (colorType === 0) return 1;
  if (colorType === 2) return 3;
  if (colorType === 4) return 2;
  if (colorType === 6) return 4;
  return 0;
}

function rgbAt(row, offset, colorType) {
  if (colorType === 0) return [row[offset], row[offset], row[offset]];
  if (colorType === 2 || colorType === 6) return [row[offset], row[offset + 1], row[offset + 2]];
  if (colorType === 4) return [row[offset], row[offset], row[offset]];
  return [0, 0, 0];
}

function collectDuplicateGroups() {
  return Array.from(duplicateMap.entries())
    .filter(([, paths]) => paths.length > 1)
    .map(([sha256, paths]) => ({ sha256, paths: paths.sort() }));
}

function isExpectedDefaultEnglishDuplicate(group) {
  if (group.paths.length !== 2) return false;

  const defaultPath = group.paths.find((item) => item.startsWith('assets/store/ios/'));
  const englishPath = group.paths.find((item) => item.startsWith('assets/store/ios-localized/en/'));
  if (!defaultPath || !englishPath) return false;

  return defaultPath.replace('assets/store/ios/', '') === englishPath.replace('assets/store/ios-localized/en/', '');
}

function recordCheck(id, passed, detail) {
  checks.push({ id, status: passed ? 'PASS' : 'REVIEW', detail });
  if (!passed) addFinding(id, detail);
}

function addFinding(id, detail) {
  findings.push({ id, detail });
}

function renderMarkdown(values) {
  const checkRows = values.checks
    .map((check) => `| ${check.id} | ${check.status} | ${escapeCell(check.detail)} |`)
    .join('\n');
  const packRows = values.packSummaries
    .map(
      (pack) =>
        `| ${pack.kind} | ${pack.locale} | ${pack.screenshots} | ${pack.readyScreenshots} | ${pack.matchesDefaultCount} | ${pack.distinctFromDefaultCount} | ${pack.minBytes} | ${pack.ready ? 'PASS' : 'REVIEW'} |`,
    )
    .join('\n');
  const findings = values.findings.length > 0
    ? values.findings.map((finding) => `- ${finding.id}: ${finding.detail}`).join('\n')
    : '- None.';
  const markers = values.generatorMarkers
    .map((marker) => `- ${marker.found ? 'PASS' : 'REVIEW'} ${marker.id}: ${marker.text}`)
    .join('\n');

  return `# Screenshot QA Audit

Generated by \`${values.source}\` from \`${values.generatedFrom.screenshotManifest}\`.

## Summary

- Risk: ${values.summary.risk}
- Total screenshots: ${values.summary.totalScreenshots}
- Default screenshots: ${values.summary.defaultEntries}
- Localized screenshots: ${values.summary.localizedEntries}
- Locales: ${values.summary.locales}
- Devices: ${values.summary.devices}
- Scenes: ${values.summary.scenes}
- Missing files: ${values.summary.missingFiles}
- Dimension failures: ${values.summary.dimensionFailures}
- Alpha-channel failures: ${values.summary.alphaFailures}
- Small files: ${values.summary.smallFiles}
- Low-variance files: ${values.summary.lowVarianceFiles}
- English default pack matches localized English: ${values.summary.defaultEnglishPackMatchesLocalizedEnglish ? 'Yes' : 'No'}
- Non-English localized packs differ from default: ${values.summary.localizedNonEnglishDistinctFromDefault ? 'Yes' : 'No'}
- Scene coverage ready: ${values.summary.sceneCoverageReady ? 'Yes' : 'No'}
- Generator copy ready: ${values.summary.generatorCopyReady ? 'Yes' : 'No'}
- Font fallback ready: ${values.summary.fontFallbackReady ? 'Yes' : 'No'}
- Localization audit sync: ${values.summary.localizationRowsReady ? 'Yes' : 'No'}

## Checks

| Check | Status | Detail |
| --- | --- | --- |
${checkRows}

## Pack Summary

| Kind | Locale | Screenshots | Ready | Matches Default | Differs From Default | Min Bytes | Status |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
${packRows}

## Generator Markers

${markers}

## Findings

${findings}

## Commands

- npm run screenshots:qa
- npm run release:verify
`;
}

function tailForRoot(value, rootPath) {
  return String(value ?? '').replace(`${rootPath}/`, '');
}

function countScreenshots(manifest) {
  return (
    (manifest.defaultPack?.screenshots ?? []).length +
    (manifest.localizedPacks ?? []).reduce((sum, pack) => sum + (pack.screenshots?.length ?? 0), 0)
  );
}

function sameSet(actual, expected) {
  return (
    Array.isArray(actual) &&
    actual.length === expected.length &&
    expected.every((item) => actual.includes(item))
  );
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

function minNullable(current, value) {
  if (value === null || value === undefined) return current;
  if (current === null || current === undefined) return value;
  return Math.min(current, value);
}

function round(value) {
  return Number(value.toFixed(2));
}

function escapeCell(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function readOptionalJson(relativePath) {
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) return null;

  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}
