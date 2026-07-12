const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const jsonPath = path.join(root, 'docs/study-content-localization-audit.json');
const markdownPath = path.join(root, 'docs/study-content-localization-audit.md');

const expectedLocales = ['zh-Hans', 'zh-Hant', 'en', 'fr', 'it', 'de', 'es-ES', 'ko', 'pl', 'pt-BR'];
const expectedLevels = ['N5', 'N4', 'N3', 'N2', 'N1'];
const contentTranslationLocales = ['fr', 'it', 'de', 'es-ES', 'pl', 'pt-BR'];
const gameDataSource = readText('src/gameData.ts');
const i18nSource = readText('src/i18n.ts');
const gameData = loadTsModule('src/gameData.ts');

const studyTextKeys = collectStudyTextKeys(gameDataSource, 'src/gameData.ts');
const contentTranslations = collectContentTranslations(i18nSource, 'src/i18n.ts');
const allItems = gameData.ALL_ITEMS ?? [];
const meaningItems = gameData.MEANING_ITEMS ?? [];
const levels = gameData.JLPT_LEVELS ?? [];
const failures = [];

const missingTranslationEntries = [];
const emptyTranslationEntries = [];
for (const key of studyTextKeys) {
  const translations = contentTranslations.get(key);

  for (const locale of contentTranslationLocales) {
    const value = translations?.get(locale);
    if (!translations?.has(locale)) {
      missingTranslationEntries.push({ key, locale });
    } else if (!hasText(value)) {
      emptyTranslationEntries.push({ key, locale });
    }
  }
}

const missingLocalizedFields = [];
for (const item of allItems) {
  for (const field of ['meaning', 'topic']) {
    for (const locale of expectedLocales) {
      if (!hasText(item[field]?.[locale])) {
        missingLocalizedFields.push({ id: item.id, level: item.level, kind: item.kind, field, locale });
      }
    }
  }
}

const missingLevels = expectedLevels.filter((level) => !levels.includes(level));
const extraLevels = levels.filter((level) => !expectedLevels.includes(level));
const expectedLocalizedFields = allItems.length * 2 * expectedLocales.length;
const localizedFieldsReady = expectedLocalizedFields - missingLocalizedFields.length;
const expectedContentTranslationEntries = studyTextKeys.size * contentTranslationLocales.length;
const contentTranslationEntriesReady =
  expectedContentTranslationEntries - missingTranslationEntries.length - emptyTranslationEntries.length;

if (missingLevels.length > 0) failures.push(`missing JLPT levels: ${missingLevels.join(', ')}`);
if (extraLevels.length > 0) failures.push(`unexpected JLPT levels: ${extraLevels.join(', ')}`);
if (missingTranslationEntries.length > 0) failures.push(`missing content translation entries: ${missingTranslationEntries.length}`);
if (emptyTranslationEntries.length > 0) failures.push(`empty content translation entries: ${emptyTranslationEntries.length}`);
if (missingLocalizedFields.length > 0) failures.push(`missing localized study fields: ${missingLocalizedFields.length}`);

const audit = {
  schemaVersion: 1,
  source: 'scripts/generate-study-content-localization-audit.js',
  generatedFrom: {
    gameData: 'src/gameData.ts',
    i18nSource: 'src/i18n.ts',
    studyBankDepthAudit: 'docs/study-bank-depth-audit.json',
    localizationAudit: 'docs/localization-audit.json',
  },
  posture: {
    statement: 'Kana Sprint keeps JLPT N5-N1 study meanings and topics available in every supported non-Japanese UI language.',
    releaseAction: 'If this audit fails, add the missing study text translations before regenerating App Store screenshots or metadata.',
  },
  expectedLocales,
  expectedLevels,
  contentTranslationLocales,
  summary: {
    risk: failures.length === 0 ? 'PASS' : 'REVIEW',
    expectedLocales: expectedLocales.length,
    levels: levels.length,
    totalStudyItems: allItems.length,
    playableMeaningPrompts: meaningItems.length,
    kanaPrompts: gameData.KANA_ITEMS?.length ?? 0,
    vocabularyPrompts: gameData.VOCAB_ITEMS?.length ?? 0,
    originalAnimeStyleLinePrompts: gameData.LINE_ITEMS?.length ?? 0,
    grammarPrompts: gameData.GRAMMAR_ITEMS?.length ?? 0,
    studyTextKeys: studyTextKeys.size,
    contentTranslationKeys: contentTranslations.size,
    expectedLocalizedFields,
    localizedFieldsReady,
    missingLocalizedFields: missingLocalizedFields.length,
    expectedContentTranslationEntries,
    contentTranslationEntriesReady,
    missingTranslationEntries: missingTranslationEntries.length,
    emptyTranslationEntries: emptyTranslationEntries.length,
    sixLocaleTranslationReady: missingTranslationEntries.length === 0 && emptyTranslationEntries.length === 0,
    fullStudyItemLocaleFieldsReady: missingLocalizedFields.length === 0,
    englishFallbackRisks: missingTranslationEntries.length,
    failures: failures.length,
  },
  localeCoverage: expectedLocales.map(auditLocale),
  levelCoverage: expectedLevels.map(auditLevel),
  missingTranslationEntries: missingTranslationEntries.slice(0, 50),
  emptyTranslationEntries: emptyTranslationEntries.slice(0, 50),
  missingLocalizedFields: missingLocalizedFields.slice(0, 50),
  failures,
};

fs.writeFileSync(jsonPath, `${JSON.stringify(audit, null, 2)}\n`);
fs.writeFileSync(markdownPath, renderMarkdown(audit));

if (audit.summary.risk !== 'PASS') {
  console.error(`study content localization audit requires review: ${failures.length} issue(s)`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`generated ${path.relative(root, markdownPath)} and ${path.relative(root, jsonPath)}`);

function auditLocale(locale) {
  const totalFields = allItems.length * 2;
  const missingFields = missingLocalizedFields.filter((entry) => entry.locale === locale).length;
  const requiredContentTranslations = contentTranslationLocales.includes(locale) ? studyTextKeys.size : 0;
  const missingContentTranslations = missingTranslationEntries.filter((entry) => entry.locale === locale).length;
  const emptyContentTranslations = emptyTranslationEntries.filter((entry) => entry.locale === locale).length;

  return {
    locale,
    studyFields: totalFields,
    localizedFields: totalFields - missingFields,
    missingFields,
    requiredContentTranslations,
    missingContentTranslations,
    emptyContentTranslations,
    ready: missingFields === 0 && missingContentTranslations === 0 && emptyContentTranslations === 0,
  };
}

function auditLevel(level) {
  const items = allItems.filter((item) => item.level === level);
  const literalTextKeys = unique(
    items
      .flatMap((item) => [item.meaning?.en, item.topic?.en])
      .filter((key) => studyTextKeys.has(key)),
  );
  const missingFields = missingLocalizedFields.filter((entry) => entry.level === level).length;
  const missingTranslations = literalTextKeys.flatMap((key) =>
    contentTranslationLocales
      .filter((locale) => !hasText(contentTranslations.get(key)?.get(locale)))
      .map((locale) => ({ key, locale })),
  );

  return {
    level,
    items: items.length,
    kana: level === 'N5' ? gameData.KANA_ITEMS?.length ?? 0 : 0,
    vocabulary: (gameData.VOCAB_ITEMS ?? []).filter((item) => item.level === level).length,
    linePrompts: (gameData.LINE_ITEMS ?? []).filter((item) => item.level === level).length,
    grammarPrompts: (gameData.GRAMMAR_ITEMS ?? []).filter((item) => item.level === level).length,
    localizedFields: items.length * 2 * expectedLocales.length - missingFields,
    missingLocalizedFields: missingFields,
    auditedTextKeys: literalTextKeys.length,
    missingTranslationEntries: missingTranslations.length,
    ready: missingFields === 0 && missingTranslations.length === 0,
  };
}

function renderMarkdown(values) {
  const localeRows = values.localeCoverage
    .map((entry) => `| ${entry.locale} | ${entry.localizedFields}/${entry.studyFields} | ${entry.requiredContentTranslations} | ${entry.missingContentTranslations} | ${entry.emptyContentTranslations} | ${entry.ready ? 'Ready' : 'Review'} |`)
    .join('\n');
  const levelRows = values.levelCoverage
    .map((entry) => `| ${entry.level} | ${entry.items} | ${entry.kana} | ${entry.vocabulary} | ${entry.linePrompts} | ${entry.grammarPrompts} | ${entry.localizedFields} | ${entry.missingLocalizedFields} | ${entry.auditedTextKeys} | ${entry.missingTranslationEntries} | ${entry.ready ? 'Ready' : 'Review'} |`)
    .join('\n');
  const failureRows = values.failures.length > 0
    ? values.failures.map((failure) => `- ${failure}`).join('\n')
    : '- None.';

  return `# Study Content Localization Audit

${values.posture.statement}

## Summary

- Risk: ${values.summary.risk}
- UI locales: ${values.summary.expectedLocales}
- JLPT levels: ${values.summary.levels}
- Total study items: ${values.summary.totalStudyItems}
- Kana prompts: ${values.summary.kanaPrompts}
- Vocabulary prompts: ${values.summary.vocabularyPrompts}
- Original anime-style line prompts: ${values.summary.originalAnimeStyleLinePrompts}
- Grammar prompts: ${values.summary.grammarPrompts}
- Study text keys: ${values.summary.studyTextKeys}
- Content translation keys: ${values.summary.contentTranslationKeys}
- Localized study fields: ${values.summary.localizedFieldsReady}/${values.summary.expectedLocalizedFields}
- Content translation entries: ${values.summary.contentTranslationEntriesReady}/${values.summary.expectedContentTranslationEntries}
- Missing localized fields: ${values.summary.missingLocalizedFields}
- Missing translation entries: ${values.summary.missingTranslationEntries}
- Empty translation entries: ${values.summary.emptyTranslationEntries}
- Six-locale translation ready: ${values.summary.sixLocaleTranslationReady ? 'Yes' : 'No'}
- Full study item locale fields ready: ${values.summary.fullStudyItemLocaleFieldsReady ? 'Yes' : 'No'}

## Locale Coverage

| Locale | Localized study fields | Required content translations | Missing translations | Empty translations | Status |
| --- | ---: | ---: | ---: | ---: | --- |
${localeRows}

## JLPT Level Coverage

| Level | Items | Kana | Vocabulary | Lines | Grammar | Localized fields | Missing fields | Text keys | Missing translations | Status |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
${levelRows}

## Release Gate Issues

${failureRows}

${values.posture.releaseAction}
`;
}

function collectStudyTextKeys(source, filename) {
  const sourceFile = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true);
  const keys = new Set();

  function visit(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'text') {
      const firstArg = node.arguments[0];
      if (firstArg && ts.isStringLiteralLike(firstArg)) {
        keys.add(firstArg.text);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return keys;
}

function collectContentTranslations(source, filename) {
  const sourceFile = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true);
  const entries = new Map();

  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'contentTranslations' &&
      node.initializer &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      for (const property of node.initializer.properties) {
        if (!ts.isPropertyAssignment(property)) continue;

        const key = tsPropertyName(property.name);
        if (!key || !ts.isObjectLiteralExpression(property.initializer)) continue;

        const translations = new Map();
        for (const localeProperty of property.initializer.properties) {
          if (!ts.isPropertyAssignment(localeProperty)) continue;

          const locale = tsPropertyName(localeProperty.name);
          if (locale && ts.isStringLiteralLike(localeProperty.initializer)) {
            translations.set(locale, localeProperty.initializer.text);
          }
        }

        entries.set(key, translations);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return entries;
}

function tsPropertyName(name) {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
  return undefined;
}

function hasText(value) {
  return String(value ?? '').trim().length > 0;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
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
      return { getLocales: () => [{ languageCode: 'en', languageTag: 'en-US', regionCode: 'US' }] };
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
