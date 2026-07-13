const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const outputDir = path.join(root, 'assets', 'pronunciation');
const generatedModulePath = path.join(root, 'src', 'pronunciation.generated.ts');
const baseUrl = process.env.VOICEVOX_BASE_URL || 'http://127.0.0.1:50021';
const speakerId = Number(process.env.VOICEVOX_SPEAKER_ID || 2);
const bitrateKbps = 48;
const voiceCredit = 'VOICEVOX:四国めたん';
const force = process.argv.includes('--force');
const limitArg = process.argv.find((value) => value.startsWith('--limit='));
const limit = limitArg ? Math.max(1, Number(limitArg.split('=')[1]) || 1) : undefined;
const gameData = loadTsModule('src/gameData.ts');
const allItems = gameData.ALL_ITEMS ?? [];

async function main() {
  assert(allItems.length > 0, 'Study bank is empty.');
  fs.mkdirSync(outputDir, { recursive: true });

  await ensureVoicevoxEngine();
  const engineVersion = String(await requestJson('/version'));
  const speaker = await resolveSpeaker();
  const ffmpegPath = findFfmpeg();
  const items = limit ? allItems.slice(0, limit) : allItems;
  const generated = [];
  const skipped = [];
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kana-sprint-pronunciation-'));

  try {
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      const fileName = `${safeFileName(item.id)}.mp3`;
      const outputPath = path.join(outputDir, fileName);

      if (!force && fs.existsSync(outputPath) && fs.statSync(outputPath).size > 1000) {
        skipped.push(item.id);
      } else {
        const wavPath = path.join(tempDir, `${safeFileName(item.id)}.wav`);
        const wav = await synthesize(item.kana || item.display, item.kind);
        fs.writeFileSync(wavPath, wav);
        encodeMp3(ffmpegPath, wavPath, outputPath);
        fs.unlinkSync(wavPath);
        generated.push(item.id);
      }

      if ((index + 1) % 25 === 0 || index + 1 === items.length) {
        process.stdout.write(`\rPronunciation audio ${index + 1}/${items.length}`);
      }
    }
  } finally {
    if (fs.existsSync(tempDir) && fs.readdirSync(tempDir).length === 0) fs.rmdirSync(tempDir);
  }

  if (!limit) {
    writeGeneratedModule(allItems, engineVersion, speaker);
  }

  process.stdout.write('\n');
  console.log(
    `VOICEVOX ${engineVersion}, ${speaker.name}/${speaker.style}, generated=${generated.length}, skipped=${skipped.length}`,
  );
  if (limit) console.log('Sample mode did not replace src/pronunciation.generated.ts.');
}

async function synthesize(text, kind) {
  const query = await requestJson(`/audio_query?text=${encodeURIComponent(text)}&speaker=${speakerId}`, {
    method: 'POST',
  });

  query.speedScale = speedForKind(kind);
  query.pitchScale = 0;
  query.intonationScale = 1;
  query.volumeScale = 1;
  query.prePhonemeLength = 0.08;
  query.postPhonemeLength = 0.08;
  query.outputSamplingRate = 24000;
  query.outputStereo = false;

  return requestBytes(`/synthesis?speaker=${speakerId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(query),
  });
}

function speedForKind(kind) {
  if (kind === 'line') return 1;
  if (kind === 'grammar') return 0.96;
  if (kind === 'vocab') return 0.96;
  return 0.98;
}

async function resolveSpeaker() {
  const speakers = await requestJson('/speakers');

  for (const speaker of speakers) {
    const style = (speaker.styles ?? []).find((candidate) => Number(candidate.id) === speakerId);
    if (style) return { name: speaker.name, style: style.name };
  }

  throw new Error(`VOICEVOX speaker style id ${speakerId} was not found.`);
}

function encodeMp3(ffmpegPath, inputPath, outputPath) {
  const result = spawnSync(ffmpegPath, [
    '-hide_banner',
    '-loglevel', 'error',
    '-y',
    '-i', inputPath,
    '-map_metadata', '-1',
    '-ar', '24000',
    '-ac', '1',
    '-codec:a', 'libmp3lame',
    '-b:a', `${bitrateKbps}k`,
    outputPath,
  ], { encoding: 'utf8' });

  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`ffmpeg failed for ${path.basename(outputPath)}: ${result.stderr.trim()}`);
  assert(fs.existsSync(outputPath) && fs.statSync(outputPath).size > 1000, `Invalid MP3 output: ${outputPath}`);
}

async function ensureVoicevoxEngine() {
  if (await engineReady()) return;

  const enginePath = findVoicevoxEngine();
  assert(enginePath, 'VOICEVOX engine was not found. Install the local VOICEVOX CPU package first.');
  const child = spawn(enginePath, [], {
    cwd: path.dirname(enginePath),
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();

  for (let attempt = 0; attempt < 60; attempt += 1) {
    await delay(1000);
    if (await engineReady()) return;
  }

  throw new Error(`VOICEVOX engine did not become ready at ${baseUrl}.`);
}

async function engineReady() {
  try {
    await requestJson('/version', {}, 2500);
    return true;
  } catch {
    return false;
  }
}

function findVoicevoxEngine() {
  const candidates = [process.env.VOICEVOX_ENGINE_PATH];
  const localAppData = process.env.LOCALAPPDATA;

  if (localAppData) {
    const packages = path.join(localAppData, 'Microsoft', 'WinGet', 'Packages');
    if (fs.existsSync(packages)) {
      for (const entry of fs.readdirSync(packages)) {
        if (!entry.startsWith('HiroshibaKazuyuki.VOICEVOX')) continue;
        candidates.push(path.join(packages, entry, 'VOICEVOX', 'vv-engine', 'run.exe'));
      }
    }
  }

  return candidates.find((candidate) => candidate && fs.existsSync(candidate));
}

function findFfmpeg() {
  const candidates = [
    process.env.FFMPEG_PATH,
    'C:\\Program Files\\Wondershare\\Recoverit\\ffmpeg.exe',
  ];
  const where = spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', ['ffmpeg'], { encoding: 'utf8' });
  if (where.status === 0) candidates.unshift(where.stdout.split(/\r?\n/).find(Boolean));

  const candidate = candidates.find((value) => value && fs.existsSync(value));
  assert(candidate, 'ffmpeg was not found. Set FFMPEG_PATH to a local ffmpeg executable.');
  return candidate;
}

async function requestJson(route, options = {}, timeoutMs = 30000) {
  const response = await fetch(`${baseUrl}${route}`, { ...options, signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`VOICEVOX ${route} returned HTTP ${response.status}.`);
  return response.json();
}

async function requestBytes(route, options = {}) {
  const response = await fetch(`${baseUrl}${route}`, { ...options, signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error(`VOICEVOX ${route} returned HTTP ${response.status}.`);
  return Buffer.from(await response.arrayBuffer());
}

function writeGeneratedModule(items, engineVersion, speaker) {
  const rows = items.map((item) => (
    `  '${item.id}': require('../assets/pronunciation/${safeFileName(item.id)}.mp3'),`
  )).join('\n');
  const textDigest = crypto.createHash('sha256')
    .update(items.map((item) => `${item.id}\t${item.kana || item.display}`).join('\n'))
    .digest('hex');
  const source = `// Generated by scripts/generate-pronunciation-audio.js. Do not edit manually.\n` +
    `export const PRONUNCIATION_AUDIO: Record<string, number> = {\n${rows}\n};\n\n` +
    `export const PRONUNCIATION_PACK_META = {\n` +
    `  itemCount: ${items.length},\n` +
    `  engine: 'VOICEVOX',\n` +
    `  engineVersion: '${engineVersion}',\n` +
    `  speakerId: ${speakerId},\n` +
    `  speaker: '${speaker.name}',\n` +
    `  style: '${speaker.style}',\n` +
    `  voiceCredit: '${voiceCredit}',\n` +
    `  format: 'mp3',\n` +
    `  sampleRate: 24000,\n` +
    `  bitrateKbps: ${bitrateKbps},\n` +
    `  studyTextSha256: '${textDigest}',\n` +
    `} as const;\n`;

  fs.writeFileSync(generatedModulePath, source);
}

function safeFileName(value) {
  const result = String(value).replace(/[^a-zA-Z0-9_-]/g, '-');
  assert(result && result === value, `Study item id is not asset-safe: ${value}`);
  return result;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function loadTsModule(relativePath) {
  const cache = new Map();
  return loadTsFile(path.join(root, relativePath), cache);
}

function loadTsFile(filePath, cache) {
  const absolutePath = normalizeTsPath(filePath);
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
  const wrapped = new Function('require', 'module', 'exports', '__dirname', '__filename', output);
  wrapped(localRequire, module, module.exports, path.dirname(absolutePath), absolutePath);
  return module.exports;
}

function normalizeTsPath(filePath) {
  if (fs.existsSync(filePath)) return filePath;
  if (fs.existsSync(`${filePath}.ts`)) return `${filePath}.ts`;
  if (fs.existsSync(`${filePath}.tsx`)) return `${filePath}.tsx`;
  throw new Error(`Cannot resolve TypeScript module: ${filePath}`);
}

main().catch((error) => {
  console.error(`Pronunciation generation failed: ${error.message}`);
  process.exit(1);
});
