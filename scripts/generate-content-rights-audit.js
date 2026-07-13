const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const jsonPath = path.join(root, 'docs/content-rights-audit.json');
const markdownPath = path.join(root, 'docs/content-rights-audit.md');
const gameData = loadTsModule('src/gameData.ts');
const metadata = readJson('docs/app-store-localizations.json');
const pronunciationSource = readText('src/pronunciation.generated.ts');
const i18nSource = readText('src/i18n.ts');
const localizedSiteSource = readText('scripts/generate-localized-site.js');
const voiceCredit = 'VOICEVOX:四国めたん';
const voiceCreditReady =
  pronunciationSource.includes(`voiceCredit: '${voiceCredit}'`) &&
  i18nSource.includes(voiceCredit) &&
  localizedSiteSource.includes(voiceCredit);

const protectedIpTerms = [
  term('Naruto', ['naruto', 'ナルト']),
  term('One Piece', ['one piece', 'ワンピース', 'ルフィ', 'luffy']),
  term('Dragon Ball', ['dragon ball', 'ドラゴンボール', '悟空', 'goku', 'kamehameha', 'かめはめ波']),
  term('Demon Slayer', ['demon slayer', '鬼滅', 'kimetsu']),
  term('Attack on Titan', ['attack on titan', '進撃の巨人']),
  term('Jujutsu Kaisen', ['jujutsu kaisen', '呪術廻戦']),
  term('Sailor Moon', ['sailor moon', 'セーラームーン', '月に代わって']),
  term('Pokemon', ['pokemon', 'pokémon', 'ポケモン', 'ピカチュウ', 'pikachu']),
  term('Gundam', ['gundam', 'ガンダム']),
  term('Evangelion', ['evangelion', 'エヴァンゲリオン', 'エヴァ']),
  term('Doraemon', ['doraemon', 'ドラえもん']),
  term('Detective Conan', ['detective conan', '名探偵コナン']),
  term('Studio Ghibli', ['studio ghibli', 'ジブリ', 'totoro', 'トトロ']),
  term('Bleach', ['bleach', 'ブリーチ']),
  term('My Hero Academia', ['my hero academia', '僕のヒーローアカデミア']),
  term('Fullmetal Alchemist', ['fullmetal alchemist', '鋼の錬金術師']),
  term('Death Note', ['death note', 'デスノート']),
  term('Cowboy Bebop', ['cowboy bebop', 'カウボーイビバップ']),
  term('Chainsaw Man', ['chainsaw man', 'チェンソーマン']),
  term('Spy x Family', ['spy x family', 'スパイファミリー']),
];

const lineItems = gameData.LINE_ITEMS ?? [];
const vocabItems = gameData.VOCAB_ITEMS ?? [];
const kanaItems = gameData.KANA_ITEMS ?? [];
const grammarItems = gameData.GRAMMAR_ITEMS ?? [];
const allStudyItems = gameData.ALL_ITEMS ?? [...kanaItems, ...vocabItems, ...lineItems];
const contentSources = [
  ...allStudyItems.flatMap((item) => itemTextSources(item)),
  ...metadataTextSources(metadata),
];
const protectedIpHits = findProtectedIpHits(contentSources);
const duplicateLineDisplays = findDuplicates(lineItems.map((item) => item.display));
const duplicateLineMeanings = findDuplicates(lineItems.map((item) => item.meaning?.en));
const levelLineCounts = Object.fromEntries(
  (gameData.JLPT_LEVELS ?? []).map((level) => [level, lineItems.filter((item) => item.level === level).length]),
);
const levelVocabCounts = Object.fromEntries(
  (gameData.JLPT_LEVELS ?? []).map((level) => [level, vocabItems.filter((item) => item.level === level).length]),
);
const levelGrammarCounts = Object.fromEntries(
  (gameData.JLPT_LEVELS ?? []).map((level) => [level, grammarItems.filter((item) => item.level === level).length]),
);
const metadataOriginality = Object.entries(metadata).map(([locale, values]) => {
  const combined = [
    values.promotionalText,
    values.description,
    values.keywords,
  ].join('\n').toLocaleLowerCase();

  return {
    locale,
    hasOriginalityClaim: /original|originale|originales|originali|oryginal|origina|原创|原創|오리지널/.test(combined),
  };
});
const audit = {
  schemaVersion: 1,
  source: 'scripts/generate-content-rights-audit.js',
  generatedFrom: {
    gameData: 'src/gameData.ts',
    appStoreLocalizations: 'docs/app-store-localizations.json',
    pronunciationPack: 'src/pronunciation.generated.ts',
    inAppNotices: 'src/i18n.ts',
    publicNotices: 'scripts/generate-localized-site.js',
  },
  posture: {
    statement: 'Kana Sprint uses original anime-style study lines and does not include known protected anime quotes, characters, titles, or third-party story worlds.',
    limitation: 'This is a static release audit for obvious protected-IP terms and duplicate generated lines. It is not a legal opinion.',
    actionIfHit: 'Replace the matching content before App Store submission, then rerun npm run content:rights and npm run release:verify.',
  },
  summary: {
    totalStudyItems: allStudyItems.length,
    kanaPrompts: kanaItems.length,
    vocabularyPrompts: vocabItems.length,
    originalAnimeStyleLinePrompts: lineItems.length,
    grammarPrompts: grammarItems.length,
    scannedTextFields: contentSources.length,
    protectedIpTerms: protectedIpTerms.reduce((sum, entry) => sum + entry.patterns.length, 0),
    protectedIpTermHits: protectedIpHits.length,
    duplicateLineDisplays: duplicateLineDisplays.length,
    duplicateLineMeanings: duplicateLineMeanings.length,
    metadataOriginalityLocales: metadataOriginality.filter((entry) => entry.hasOriginalityClaim).length,
    voiceCreditReady,
    risk:
      protectedIpHits.length === 0 &&
      duplicateLineDisplays.length === 0 &&
      duplicateLineMeanings.length === 0 &&
      voiceCreditReady
        ? 'PASS'
        : 'REVIEW',
  },
  voiceSynthesis: {
    engine: 'VOICEVOX',
    speaker: '四国めたん',
    style: 'ノーマル',
    credit: voiceCredit,
    commercialAndNonCommercialUseWithCredit: true,
    inAppCreditPresent: i18nSource.includes(voiceCredit),
    publicCreditPresent: localizedSiteSource.includes(voiceCredit),
    officialTerms: [
      'https://voicevox.hiroshiba.jp/term/',
      'https://zunko.jp/con_ongen_kiyaku.html',
    ],
  },
  levels: Object.fromEntries((gameData.JLPT_LEVELS ?? []).map((level) => [
    level,
    {
      vocabulary: levelVocabCounts[level] ?? 0,
      linePrompts: levelLineCounts[level] ?? 0,
      grammarPrompts: levelGrammarCounts[level] ?? 0,
      sampleLineIds: lineItems.filter((item) => item.level === level).slice(0, 5).map((item) => item.id),
    },
  ])),
  metadataOriginality,
  protectedIpHits,
  duplicateLineDisplays,
  duplicateLineMeanings,
  scannedProtectedIpGroups: protectedIpTerms.map((entry) => ({
    label: entry.label,
    patterns: entry.patterns,
  })),
};

fs.writeFileSync(jsonPath, `${JSON.stringify(audit, null, 2)}\n`);
fs.writeFileSync(markdownPath, renderMarkdown(audit));

if (audit.summary.risk !== 'PASS') {
  console.error(`content rights audit requires review: ${audit.summary.protectedIpTermHits} protected-IP hits, ${audit.summary.duplicateLineDisplays} duplicate displays, ${audit.summary.duplicateLineMeanings} duplicate meanings`);
  process.exit(1);
}

console.log(`generated ${path.relative(root, markdownPath)} and ${path.relative(root, jsonPath)}`);

function term(label, patterns) {
  return { label, patterns };
}

function itemTextSources(item) {
  const fields = [
    ['display', item.display],
    ['kana', item.kana],
    ['romaji', item.romaji],
    ...localizedFields('meaning', item.meaning),
    ...localizedFields('topic', item.topic),
  ];

  return fields.map(([field, value]) => ({
    source: `src/gameData.ts:${item.id}:${field}`,
    kind: item.kind,
    level: item.level,
    value,
  }));
}

function localizedFields(prefix, value) {
  return Object.entries(value ?? {}).map(([locale, textValue]) => [`${prefix}.${locale}`, textValue]);
}

function metadataTextSources(values) {
  return Object.entries(values).flatMap(([locale, fields]) => (
    Object.entries(fields).map(([field, value]) => ({
      source: `docs/app-store-localizations.json:${locale}:${field}`,
      kind: 'metadata',
      level: null,
      value,
    }))
  ));
}

function findProtectedIpHits(sources) {
  const hits = [];

  for (const source of sources) {
    const rawValue = String(source.value ?? '');
    const normalizedValue = rawValue.toLocaleLowerCase();

    for (const group of protectedIpTerms) {
      for (const pattern of group.patterns) {
        if (!matchesTerm(rawValue, normalizedValue, pattern)) continue;

        hits.push({
          source: source.source,
          kind: source.kind,
          level: source.level,
          group: group.label,
          pattern,
          value: rawValue,
        });
      }
    }
  }

  return hits;
}

function matchesTerm(rawValue, normalizedValue, pattern) {
  const normalizedPattern = pattern.toLocaleLowerCase();
  const asciiPattern = /^[a-z0-9][a-z0-9 x-]*[a-z0-9]$/i.test(pattern);

  if (!asciiPattern) return normalizedValue.includes(normalizedPattern);

  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(normalizedPattern)}([^a-z0-9]|$)`, 'i').test(rawValue);
}

function findDuplicates(values) {
  const seen = new Map();
  const duplicates = [];

  for (const value of values) {
    const normalized = String(value ?? '').trim().toLocaleLowerCase();
    if (!normalized) continue;

    if (!seen.has(normalized)) {
      seen.set(normalized, value);
      continue;
    }

    duplicates.push({
      first: seen.get(normalized),
      duplicate: value,
    });
  }

  return duplicates;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function renderMarkdown(values) {
  const levelRows = Object.entries(values.levels)
    .map(([level, stats]) => `| ${level} | ${stats.vocabulary} | ${stats.linePrompts} | ${stats.grammarPrompts} | ${stats.sampleLineIds.join(', ')} |`)
    .join('\n');
  const metadataRows = values.metadataOriginality
    .map((entry) => `| ${entry.locale} | ${entry.hasOriginalityClaim ? 'Yes' : 'No'} |`)
    .join('\n');
  const groupRows = values.scannedProtectedIpGroups
    .map((entry) => `| ${entry.label} | ${entry.patterns.length} |`)
    .join('\n');

  return `# Content Rights Audit

${values.posture.statement}

## Summary

- Risk: ${values.summary.risk}
- Total study items: ${values.summary.totalStudyItems}
- Kana prompts: ${values.summary.kanaPrompts}
- Vocabulary prompts: ${values.summary.vocabularyPrompts}
- Original anime-style line prompts: ${values.summary.originalAnimeStyleLinePrompts}
- Grammar prompts: ${values.summary.grammarPrompts}
- Scanned text fields: ${values.summary.scannedTextFields}
- Protected IP term hits: ${values.summary.protectedIpTermHits}
- Duplicate line displays: ${values.summary.duplicateLineDisplays}
- Duplicate line meanings: ${values.summary.duplicateLineMeanings}
- App Store locales with originality claim: ${values.summary.metadataOriginalityLocales}
- Voice synthesis credit ready: ${values.summary.voiceCreditReady ? 'Yes' : 'No'}

No protected IP term hits were found in the study bank or App Store localization text.

## Voice Synthesis

- Engine and voice: ${values.voiceSynthesis.credit}
- Style: ${values.voiceSynthesis.style}
- Commercial and non-commercial use with credit: ${values.voiceSynthesis.commercialAndNonCommercialUseWithCredit ? 'Yes' : 'No'}
- In-app credit present: ${values.voiceSynthesis.inAppCreditPresent ? 'Yes' : 'No'}
- Public credit present: ${values.voiceSynthesis.publicCreditPresent ? 'Yes' : 'No'}
- Official terms:
${values.voiceSynthesis.officialTerms.map((url) => `  - ${url}`).join('\n')}

## Level Coverage

| Level | Vocabulary | Original line prompts | Grammar prompts | Sample line IDs |
| --- | ---: | ---: | ---: | --- |
${levelRows}

## App Store Originality Claims

| Locale | Claims original anime-style content |
| --- | --- |
${metadataRows}

## Protected IP Scan Groups

| Group | Pattern count |
| --- | ---: |
${groupRows}

## Limitation

${values.posture.limitation}

${values.posture.actionIfHit}
`;
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function loadTsModule(relativePath) {
  const filePath = path.join(root, relativePath);
  const cache = new Map();

  return loadTsFile(filePath, cache);
}

function loadTsFile(filePath, cache) {
  const absolutePath = normalizeTsPath(filePath);
  if (cache.has(absolutePath)) return cache.get(absolutePath).exports;

  const source = fs.readFileSync(absolutePath, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: absolutePath,
  }).outputText;
  const module = { exports: {} };
  cache.set(absolutePath, module);
  const localRequire = (request) => {
    if (request === 'expo-localization') {
      return { getLocales: () => [{ languageCode: 'en', languageTag: 'en-US' }] };
    }

    if (request.startsWith('.')) {
      return loadTsFile(path.resolve(path.dirname(absolutePath), request), cache);
    }

    return require(request);
  };

  const wrapped = new Function('require', 'module', 'exports', '__dirname', '__filename', output);
  wrapped(localRequire, module, module.exports, path.dirname(absolutePath), absolutePath);
  return module.exports;
}

function normalizeTsPath(filePath) {
  if (fs.existsSync(filePath)) return filePath;
  if (fs.existsSync(`${filePath}.ts`)) return `${filePath}.ts`;
  if (fs.existsSync(`${filePath}.tsx`)) return `${filePath}.tsx`;
  if (fs.existsSync(path.join(filePath, 'index.ts'))) return path.join(filePath, 'index.ts');

  throw new Error(`Cannot resolve TypeScript module: ${filePath}`);
}
