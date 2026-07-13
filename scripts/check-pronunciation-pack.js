const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const generatedPath = path.join(root, 'src', 'pronunciation.generated.ts');
const generatedSource = fs.readFileSync(generatedPath, 'utf8');
const gameData = loadTsModule('src/gameData.ts');
const allItems = gameData.ALL_ITEMS ?? [];
const matches = [...generatedSource.matchAll(/'([^']+)': require\('\.\.\/assets\/pronunciation\/([^']+\.mp3)'\)/g)];
const mapped = new Map(matches.map((match) => [match[1], match[2]]));
const expectedIds = new Set(allItems.map((item) => item.id));
const expectedTextDigest = crypto.createHash('sha256')
  .update(allItems.map((item) => `${item.id}\t${item.kana || item.display}`).join('\n'))
  .digest('hex');
const assetFiles = fs.readdirSync(path.join(root, 'assets', 'pronunciation'))
  .filter((fileName) => fileName.endsWith('.mp3'));
let totalBytes = 0;
let maxBytes = 0;

assert(mapped.size === allItems.length, `Expected ${allItems.length} pronunciation mappings, got ${mapped.size}.`);
assert(generatedSource.includes(`itemCount: ${allItems.length}`), 'Pronunciation metadata item count is stale.');
assert(
  generatedSource.includes(`studyTextSha256: '${expectedTextDigest}'`),
  'Pronunciation audio is stale for the current Japanese study text. Regenerate the pack.',
);
assert(generatedSource.includes("voiceCredit: 'VOICEVOX:四国めたん'"), 'VOICEVOX voice credit is missing.');
assert(generatedSource.includes("format: 'mp3'"), 'Pronunciation pack must use MP3 assets.');
assert(assetFiles.length === mapped.size, `Expected ${mapped.size} MP3 files, got ${assetFiles.length}.`);

for (const [itemId, fileName] of mapped) {
  assert(expectedIds.has(itemId), `Unexpected pronunciation mapping: ${itemId}`);
  const filePath = path.join(root, 'assets', 'pronunciation', fileName);
  assert(fs.existsSync(filePath), `Missing pronunciation asset: ${fileName}`);
  const buffer = fs.readFileSync(filePath);
  const isMp3 = buffer.subarray(0, 3).toString('ascii') === 'ID3' || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0);
  assert(isMp3, `Pronunciation asset is not an MP3: ${fileName}`);
  assert(buffer.length > 1000, `Pronunciation asset is too small: ${fileName}`);
  assert(buffer.length < 300000, `Pronunciation asset is unexpectedly large: ${fileName}`);
  totalBytes += buffer.length;
  maxBytes = Math.max(maxBytes, buffer.length);
}

for (const item of allItems) {
  assert(mapped.has(item.id), `Missing pronunciation mapping for ${item.id}`);
}

assert(totalBytes < 20 * 1024 * 1024, `Pronunciation pack exceeds 20 MiB: ${totalBytes} bytes.`);
console.log(
  `Pronunciation pack passed: ${mapped.size} items, ${(totalBytes / 1024 / 1024).toFixed(2)} MiB, max ${maxBytes} bytes.`,
);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function loadTsModule(relativePath) {
  const cache = new Map();
  return loadTsFile(path.join(root, relativePath), cache);
}

function loadTsFile(filePath, cache) {
  const absolutePath = fs.existsSync(filePath) ? filePath : `${filePath}.ts`;
  if (cache.has(absolutePath)) return cache.get(absolutePath).exports;
  const source = fs.readFileSync(absolutePath, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: absolutePath,
  }).outputText;
  const module = { exports: {} };
  cache.set(absolutePath, module);
  const localRequire = (request) => {
    if (request === 'expo-localization') {
      return { getLocales: () => [{ languageCode: 'en', languageTag: 'en-US' }] };
    }
    return request.startsWith('.')
      ? loadTsFile(path.resolve(path.dirname(absolutePath), request), cache)
      : require(request);
  };
  new Function('require', 'module', 'exports', '__dirname', '__filename', output)(
    localRequire, module, module.exports, path.dirname(absolutePath), absolutePath,
  );
  return module.exports;
}
