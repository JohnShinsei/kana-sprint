const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const outputJsonPath = path.join(root, 'docs/runtime-asset-manifest.json');
const outputMarkdownPath = path.join(root, 'docs/runtime-asset-manifest.md');
const appJson = require('../app.json').expo;
const bgmSource = fs.readFileSync(path.join(root, 'src/bgm.ts'), 'utf8');
const pronunciationSource = fs.readFileSync(path.join(root, 'src/pronunciation.generated.ts'), 'utf8');

const pngAssets = [
  {
    role: 'app-icon',
    platform: 'all',
    path: normalizeAssetPath(appJson.icon),
    expected: { width: 1024, height: 1024, alpha: false },
  },
  {
    role: 'splash-image',
    platform: 'all',
    path: normalizeAssetPath(findPlugin(appJson, 'expo-splash-screen')?.[1]?.image),
    expected: { width: 1024, height: 1024 },
  },
  {
    role: 'android-adaptive-foreground',
    platform: 'android',
    path: normalizeAssetPath(appJson.android?.adaptiveIcon?.foregroundImage),
    expected: { width: 1024, height: 1024, alpha: true },
  },
  {
    role: 'android-adaptive-background',
    platform: 'android',
    path: normalizeAssetPath(appJson.android?.adaptiveIcon?.backgroundImage),
    expected: { width: 1024, height: 1024, alpha: false },
  },
  {
    role: 'android-adaptive-monochrome',
    platform: 'android',
    path: normalizeAssetPath(appJson.android?.adaptiveIcon?.monochromeImage),
    expected: { width: 1024, height: 1024, alpha: true },
  },
  {
    role: 'web-favicon',
    platform: 'web',
    path: normalizeAssetPath(appJson.web?.favicon),
    expected: { width: 48, height: 48 },
  },
].map((asset) => ({
  ...asset,
  file: describeFile(asset.path),
  png: readPngInfo(asset.path),
}));

const audioAssets = extractBgmAssets().map((asset) => ({
  ...asset,
  file: describeFile(asset.path),
  wav: readWavInfo(asset.path),
}));
const pronunciationFiles = extractPronunciationAssets().map((asset) => describeFile(asset.path));
const pronunciationPack = {
  itemCount: pronunciationFiles.length,
  totalBytes: pronunciationFiles.reduce((sum, file) => sum + file.bytes, 0),
  averageBytes: pronunciationFiles.length > 0
    ? Math.round(pronunciationFiles.reduce((sum, file) => sum + file.bytes, 0) / pronunciationFiles.length)
    : 0,
  maxBytes: Math.max(0, ...pronunciationFiles.map((file) => file.bytes)),
  format: capturePronunciationMeta('format'),
  sampleRate: Number(capturePronunciationMeta('sampleRate')),
  bitrateKbps: Number(capturePronunciationMeta('bitrateKbps')),
  engine: capturePronunciationMeta('engine'),
  engineVersion: capturePronunciationMeta('engineVersion'),
  speaker: capturePronunciationMeta('speaker'),
  style: capturePronunciationMeta('style'),
  voiceCredit: capturePronunciationMeta('voiceCredit'),
  studyTextSha256: capturePronunciationMeta('studyTextSha256'),
};

const manifest = {
  schemaVersion: 1,
  source: 'scripts/generate-runtime-asset-manifest.js',
  app: {
    name: appJson.name,
    version: appJson.version,
    icon: normalizeAssetPath(appJson.icon),
  },
  pngAssets,
  audioAssets,
  pronunciationPack,
  summary: {
    pngCount: pngAssets.length,
    audioCount: audioAssets.length,
    pronunciationCount: pronunciationPack.itemCount,
    pronunciationBytes: pronunciationPack.totalBytes,
    totalBytes: [...pngAssets, ...audioAssets].reduce((sum, asset) => sum + asset.file.bytes, 0)
      + pronunciationPack.totalBytes,
  },
};

fs.writeFileSync(outputJsonPath, `${JSON.stringify(manifest, null, 2)}\n`);
fs.writeFileSync(outputMarkdownPath, renderMarkdown(manifest));
console.log(`generated ${path.relative(root, outputMarkdownPath)} and ${path.relative(root, outputJsonPath)}`);

function extractBgmAssets() {
  const matches = [...bgmSource.matchAll(/id: '([^']+)'[\s\S]*?titleKey: '([^']+)'[\s\S]*?require\('\.\.\/([^']+)'\)/g)];

  return matches.map((match) => ({
    role: `bgm-${match[1]}`,
    trackId: match[1],
    titleKey: match[2],
    platform: 'all',
    path: normalizeAssetPath(match[3]),
  }));
}

function extractPronunciationAssets() {
  const matches = [...pronunciationSource.matchAll(/'([^']+)': require\('\.\.\/([^']+\.mp3)'\)/g)];

  return matches.map((match) => ({
    itemId: match[1],
    path: normalizeAssetPath(match[2]),
  }));
}

function capturePronunciationMeta(key) {
  const match = pronunciationSource.match(new RegExp(`\\b${key}: (?:'([^']*)'|(\\d+))`));
  assert(match, `Pronunciation metadata is missing ${key}`);
  return match[1] ?? match[2];
}

function describeFile(relativePath) {
  assert(relativePath, 'Asset path is missing');
  const absolutePath = path.join(root, relativePath);
  assert(fs.existsSync(absolutePath), `Missing asset: ${relativePath}`);
  const buffer = fs.readFileSync(absolutePath);

  return {
    path: relativePath,
    bytes: buffer.length,
    sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
  };
}

function readPngInfo(relativePath) {
  const buffer = fs.readFileSync(path.join(root, relativePath));
  const isPng = buffer.length >= 33 && buffer.subarray(0, 8).toString('hex') === '89504e470d0a1a0a';
  assert(isPng, `${relativePath} must be a PNG file`);

  const colorType = buffer[25];

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    bitDepth: buffer[24],
    colorType,
    hasAlphaChannel: colorType === 4 || colorType === 6,
  };
}

function readWavInfo(relativePath) {
  const buffer = fs.readFileSync(path.join(root, relativePath));
  assert(buffer.subarray(0, 4).toString('ascii') === 'RIFF', `${relativePath} must start with RIFF`);
  assert(buffer.subarray(8, 12).toString('ascii') === 'WAVE', `${relativePath} must be a WAVE file`);

  const formatOffset = findChunk(buffer, 'fmt ');
  const dataOffset = findChunk(buffer, 'data');
  assert(formatOffset > 0, `${relativePath} is missing fmt chunk`);
  assert(dataOffset > 0, `${relativePath} is missing data chunk`);

  const fmtStart = formatOffset + 8;
  const dataBytes = buffer.readUInt32LE(dataOffset + 4);
  const audioFormat = buffer.readUInt16LE(fmtStart);
  const channels = buffer.readUInt16LE(fmtStart + 2);
  const sampleRate = buffer.readUInt32LE(fmtStart + 4);
  const byteRate = buffer.readUInt32LE(fmtStart + 8);
  const bitsPerSample = buffer.readUInt16LE(fmtStart + 14);

  return {
    format: audioFormat === 1 ? 'PCM' : `format-${audioFormat}`,
    channels,
    sampleRate,
    bitsPerSample,
    dataBytes,
    durationSeconds: Number((dataBytes / byteRate).toFixed(2)),
  };
}

function findChunk(buffer, id) {
  let offset = 12;

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.subarray(offset, offset + 4).toString('ascii');
    const chunkSize = buffer.readUInt32LE(offset + 4);

    if (chunkId === id) return offset;

    offset += 8 + chunkSize + (chunkSize % 2);
  }

  return -1;
}

function renderMarkdown(manifest) {
  const pngRows = manifest.pngAssets.map((asset) => (
    `| ${asset.role} | ${asset.path} | ${asset.png.width}x${asset.png.height} | ${asset.png.hasAlphaChannel ? 'Yes' : 'No'} | ${asset.file.bytes} | ${asset.file.sha256.slice(0, 12)} |`
  )).join('\n');
  const audioRows = manifest.audioAssets.map((asset) => (
    `| ${asset.role} | ${asset.path} | ${asset.wav.durationSeconds}s | ${asset.wav.sampleRate} Hz | ${asset.wav.channels} | ${asset.file.bytes} | ${asset.file.sha256.slice(0, 12)} |`
  )).join('\n');

  return `# Runtime Asset Manifest

## Summary

- App: ${manifest.app.name} ${manifest.app.version}
- PNG assets: ${manifest.summary.pngCount}
- Audio assets: ${manifest.summary.audioCount}
- Offline Japanese pronunciations: ${manifest.summary.pronunciationCount}
- Pronunciation pack bytes: ${manifest.summary.pronunciationBytes}
- Runtime asset bytes: ${manifest.summary.totalBytes}

## PNG Assets

| Role | Path | Dimensions | Alpha | Bytes | SHA-256 Prefix |
| --- | --- | ---: | --- | ---: | --- |
${pngRows}

## Audio Assets

| Role | Path | Duration | Sample Rate | Channels | Bytes | SHA-256 Prefix |
| --- | --- | ---: | ---: | ---: | ---: | --- |
${audioRows}

## Offline Japanese Pronunciation

- Coverage: ${manifest.pronunciationPack.itemCount} study items
- Voice: ${manifest.pronunciationPack.speaker} / ${manifest.pronunciationPack.style}
- Credit: ${manifest.pronunciationPack.voiceCredit}
- Engine: ${manifest.pronunciationPack.engine} ${manifest.pronunciationPack.engineVersion}
- Format: ${manifest.pronunciationPack.format}, ${manifest.pronunciationPack.sampleRate} Hz, ${manifest.pronunciationPack.bitrateKbps} kbps
- Total bytes: ${manifest.pronunciationPack.totalBytes}
- Average bytes: ${manifest.pronunciationPack.averageBytes}
- Maximum bytes: ${manifest.pronunciationPack.maxBytes}
- Study text SHA-256: ${manifest.pronunciationPack.studyTextSha256}
`;
}

function findPlugin(config, name) {
  return (config.plugins ?? []).find((plugin) => (
    Array.isArray(plugin) ? plugin[0] === name : plugin === name
  ));
}

function normalizeAssetPath(value) {
  return String(value ?? '').replace(/\\/g, '/').replace(/^\.\//, '');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
