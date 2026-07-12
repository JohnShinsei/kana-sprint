const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const jsonPath = path.join(root, 'docs/study-bank-depth-audit.json');
const markdownPath = path.join(root, 'docs/study-bank-depth-audit.md');
const gameData = loadTsModule('src/gameData.ts');
const gameEngine = loadTsModule('src/gameEngine.ts');

const expectedLevels = ['N5', 'N4', 'N3', 'N2', 'N1'];
const minimums = {
  N5: { kana: 92, vocabulary: 130, linePrompts: 40, grammarPrompts: 12, topics: 16, vocabularyTopics: 12, lineTopics: 5 },
  N4: { kana: 0, vocabulary: 90, linePrompts: 24, grammarPrompts: 12, topics: 12, vocabularyTopics: 8, lineTopics: 6 },
  N3: { kana: 0, vocabulary: 90, linePrompts: 24, grammarPrompts: 12, topics: 12, vocabularyTopics: 8, lineTopics: 6 },
  N2: { kana: 0, vocabulary: 90, linePrompts: 24, grammarPrompts: 12, topics: 10, vocabularyTopics: 8, lineTopics: 5 },
  N1: { kana: 0, vocabulary: 90, linePrompts: 24, grammarPrompts: 12, topics: 10, vocabularyTopics: 8, lineTopics: 5 },
};
const failures = [];

const levels = gameData.JLPT_LEVELS ?? [];
const levelAudits = Object.fromEntries(expectedLevels.map((level) => [level, auditLevel(level)]));
const progression = auditDifficultyProgression(levelAudits);
const duplicateIds = duplicateValues(gameData.ALL_ITEMS.map((item) => item.id));
const duplicateDisplaysByLevel = duplicateValues(
  gameData.MEANING_ITEMS.map((item) => `${item.level}:${item.kind}:${normalizeText(item.display)}`),
);
const missingLevels = expectedLevels.filter((level) => !levels.includes(level));
const extraLevels = levels.filter((level) => !expectedLevels.includes(level));

if (missingLevels.length > 0) failures.push(`missing JLPT levels: ${missingLevels.join(', ')}`);
if (extraLevels.length > 0) failures.push(`unexpected JLPT levels: ${extraLevels.join(', ')}`);
if (duplicateIds.length > 0) failures.push(`duplicate study item IDs: ${duplicateIds.join(', ')}`);
if (duplicateDisplaysByLevel.length > 0) failures.push(`duplicate level/kind displays: ${duplicateDisplaysByLevel.join(', ')}`);

for (const [level, audit] of Object.entries(levelAudits)) {
  const minimum = minimums[level];
  for (const [key, required] of Object.entries(minimum)) {
    const actual = audit.counts[key] ?? audit.coverage[key] ?? 0;
    if (actual < required) failures.push(`${level} ${key} below depth target: ${actual}/${required}`);
  }
}

for (const issue of progression.issues) failures.push(issue);

const audit = {
  schemaVersion: 1,
  source: 'scripts/generate-study-bank-depth-audit.js',
  generatedFrom: {
    gameData: 'src/gameData.ts',
    gameEngine: 'src/gameEngine.ts',
    gameplayContract: 'scripts/check-gameplay-contract.js',
  },
  posture: {
    statement: 'Kana Sprint ships a local N5-N1 study bank with separate vocabulary and original anime-style line prompts for each JLPT level.',
    difficultyModel: 'Difficulty increases through level-specific content, higher line-prompt weight, more reverse Japanese recall, same-topic distractors, and longer average kana readings.',
    releaseAction: 'If this audit fails, expand or rebalance the study bank before generating App Store assets again.',
  },
  thresholds: minimums,
  summary: {
    risk: failures.length === 0 ? 'PASS' : 'REVIEW',
    levels: levels.length,
    expectedLevels,
    totalStudyItems: gameData.ALL_ITEMS.length,
    kanaPrompts: gameData.KANA_ITEMS.length,
    vocabularyPrompts: gameData.VOCAB_ITEMS.length,
    originalAnimeStyleLinePrompts: gameData.LINE_ITEMS.length,
    grammarPrompts: gameData.GRAMMAR_ITEMS.length,
    playableMeaningPrompts: gameData.MEANING_ITEMS.length,
    totalTopics: unique(gameData.MEANING_ITEMS.map((item) => item.topic.en)).length,
    duplicateIds: duplicateIds.length,
    duplicateDisplaysByLevel: duplicateDisplaysByLevel.length,
    failures: failures.length,
  },
  difficultyProgression: progression,
  levels: levelAudits,
  failures,
};

fs.writeFileSync(jsonPath, `${JSON.stringify(audit, null, 2)}\n`);
fs.writeFileSync(markdownPath, renderMarkdown(audit));

if (audit.summary.risk !== 'PASS') {
  console.error(`study bank depth audit requires review: ${failures.length} issue(s)`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`generated ${path.relative(root, markdownPath)} and ${path.relative(root, jsonPath)}`);

function auditLevel(level) {
  const vocabulary = gameData.VOCAB_ITEMS.filter((item) => item.level === level);
  const lines = gameData.LINE_ITEMS.filter((item) => item.level === level);
  const kana = level === 'N5' ? gameData.KANA_ITEMS : [];
  const grammar = gameData.GRAMMAR_ITEMS.filter((item) => item.level === level);
  const meaningItems = [...vocabulary, ...lines];
  const profile = gameEngine.LEVEL_DIFFICULTY_PROFILES?.[level] ?? {};
  const topicCounts = countBy(meaningItems, (item) => item.topic.en);
  const vocabularyTopicCounts = countBy(vocabulary, (item) => item.topic.en);
  const lineTopicCounts = countBy(lines, (item) => item.topic.en);
  const allLevelItems = [...kana, ...meaningItems, ...grammar];

  return {
    counts: {
      kana: kana.length,
      vocabulary: vocabulary.length,
      linePrompts: lines.length,
      grammarPrompts: grammar.length,
      total: allLevelItems.length,
    },
    coverage: {
      topics: Object.keys(topicCounts).length,
      vocabularyTopics: Object.keys(vocabularyTopicCounts).length,
      lineTopics: Object.keys(lineTopicCounts).length,
      localizedMeaningFields: countLocalizedFields(meaningItems, 'meaning'),
      localizedTopicFields: countLocalizedFields(meaningItems, 'topic'),
    },
    averages: {
      kanaLength: round(average(meaningItems.map((item) => item.kana.length)), 2),
      displayLength: round(average(meaningItems.map((item) => Array.from(item.display).length)), 2),
      romajiWords: round(average(meaningItems.map((item) => item.romaji.split(/\s+/).filter(Boolean).length)), 2),
    },
    mixProfile: {
      order: profile.order ?? null,
      kanaWeight: profile.mixWeights?.kana ?? null,
      vocabularyWeight: profile.mixWeights?.vocab ?? null,
      lineWeight: profile.mixWeights?.lines ?? null,
      grammarWeight: profile.mixWeights?.grammar ?? null,
      meaningToWordWeight: profile.meaningToWordWeight ?? null,
      topicDistractorBias: profile.topicDistractorBias ?? null,
      lengthDistractorBias: profile.lengthDistractorBias ?? null,
    },
    topicBreakdown: renderTopicCounts(topicCounts),
    sampleVocabularyIds: vocabulary.slice(0, 8).map((item) => item.id),
    sampleLineIds: lines.slice(0, 8).map((item) => item.id),
    sampleGrammarIds: grammar.slice(0, 8).map((item) => item.id),
  };
}

function auditDifficultyProgression(levelAudits) {
  const issues = [];
  const rows = expectedLevels.map((level) => ({
    level,
    order: levelAudits[level].mixProfile.order,
    kanaWeight: levelAudits[level].mixProfile.kanaWeight,
    vocabularyWeight: levelAudits[level].mixProfile.vocabularyWeight,
    lineWeight: levelAudits[level].mixProfile.lineWeight,
    grammarWeight: levelAudits[level].mixProfile.grammarWeight,
    meaningToWordWeight: levelAudits[level].mixProfile.meaningToWordWeight,
    topicDistractorBias: levelAudits[level].mixProfile.topicDistractorBias,
    lengthDistractorBias: levelAudits[level].mixProfile.lengthDistractorBias,
    averageKanaLength: levelAudits[level].averages.kanaLength,
  }));

  for (let index = 0; index < rows.length; index += 1) {
    const current = rows[index];
    const previous = rows[index - 1];
    const weightSum = [current.kanaWeight, current.vocabularyWeight, current.lineWeight, current.grammarWeight]
      .reduce((sum, value) => sum + Number(value ?? 0), 0);

    if (Math.abs(weightSum - 1) > 0.001) issues.push(`${current.level} mix weights should total 1, got ${round(weightSum, 3)}`);
    if (current.level === 'N5' && !(current.kanaWeight > 0)) issues.push('N5 mix should include kana fundamentals');
    if (current.level !== 'N5' && current.kanaWeight !== 0) issues.push(`${current.level} mix should not include kana-only fundamentals`);

    if (!previous) continue;

    if (!(current.order > previous.order)) issues.push(`${current.level} difficulty order should be higher than ${previous.level}`);
    if (!(current.lineWeight >= previous.lineWeight)) issues.push(`${current.level} line-prompt mix weight should not drop below ${previous.level}`);
    if (!(current.grammarWeight >= previous.grammarWeight)) issues.push(`${current.level} grammar mix weight should not drop below ${previous.level}`);
    if (!(current.meaningToWordWeight >= previous.meaningToWordWeight)) issues.push(`${current.level} reverse Japanese recall weight should not drop below ${previous.level}`);
    if (!(current.topicDistractorBias >= previous.topicDistractorBias)) issues.push(`${current.level} topic distractor bias should not drop below ${previous.level}`);
    if (!(current.lengthDistractorBias >= previous.lengthDistractorBias)) issues.push(`${current.level} length distractor bias should not drop below ${previous.level}`);
    if (!(current.averageKanaLength >= previous.averageKanaLength)) issues.push(`${current.level} average kana length should not be shorter than ${previous.level}`);
  }

  return {
    passed: issues.length === 0,
    rows,
    issues,
  };
}

function countLocalizedFields(items, field) {
  return items.reduce((sum, item) => sum + Object.values(item[field] ?? {}).filter(Boolean).length, 0);
}

function countBy(items, getKey) {
  const counts = {};

  for (const item of items) {
    const key = getKey(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }

  return counts;
}

function renderTopicCounts(counts) {
  return Object.entries(counts)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([topic, count]) => ({ topic, count }));
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function average(values) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value, digits) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function normalizeText(value) {
  return String(value ?? '').trim().toLocaleLowerCase();
}

function duplicateValues(values) {
  const seen = new Set();
  const duplicates = new Set();

  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }

  return [...duplicates];
}

function renderMarkdown(values) {
  const levelRows = Object.entries(values.levels)
    .map(([level, entry]) => `| ${level} | ${entry.counts.kana} | ${entry.counts.vocabulary} | ${entry.counts.linePrompts} | ${entry.counts.grammarPrompts} | ${entry.coverage.topics} | ${entry.coverage.vocabularyTopics} | ${entry.coverage.lineTopics} | ${entry.averages.kanaLength} | ${entry.mixProfile.lineWeight} | ${entry.mixProfile.grammarWeight} | ${entry.mixProfile.meaningToWordWeight} |`)
    .join('\n');
  const progressionRows = values.difficultyProgression.rows
    .map((row) => `| ${row.level} | ${row.order} | ${row.kanaWeight} | ${row.vocabularyWeight} | ${row.lineWeight} | ${row.grammarWeight} | ${row.meaningToWordWeight} | ${row.topicDistractorBias} | ${row.lengthDistractorBias} | ${row.averageKanaLength} |`)
    .join('\n');
  const failureRows = values.failures.length > 0
    ? values.failures.map((failure) => `- ${failure}`).join('\n')
    : '- None.';

  return `# Study Bank Depth Audit

${values.posture.statement}

## Summary

- Risk: ${values.summary.risk}
- JLPT levels: ${values.summary.levels}
- Total study items: ${values.summary.totalStudyItems}
- Kana prompts: ${values.summary.kanaPrompts}
- Vocabulary prompts: ${values.summary.vocabularyPrompts}
- Original anime-style line prompts: ${values.summary.originalAnimeStyleLinePrompts}
- Grammar prompts: ${values.summary.grammarPrompts}
- Playable meaning prompts: ${values.summary.playableMeaningPrompts}
- Topic families: ${values.summary.totalTopics}
- Duplicate IDs: ${values.summary.duplicateIds}
- Duplicate displays by level/kind: ${values.summary.duplicateDisplaysByLevel}

## Level Depth

| Level | Kana | Vocabulary | Lines | Grammar | Topics | Vocab topics | Line topics | Avg kana length | Line mix weight | Grammar mix weight | Reverse recall weight |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${levelRows}

## Difficulty Progression

${values.posture.difficultyModel}

| Level | Order | Kana weight | Vocabulary weight | Line weight | Grammar weight | Reverse recall weight | Topic bias | Length bias | Avg kana length |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${progressionRows}

## Release Gate Issues

${failureRows}

${values.posture.releaseAction}
`;
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
