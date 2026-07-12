const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const jsonPath = path.join(root, 'docs/runtime-ui-flow-audit.json');
const markdownPath = path.join(root, 'docs/runtime-ui-flow-audit.md');
const expectedLocales = ['zh-Hans', 'zh-Hant', 'en', 'fr', 'it', 'de', 'es-ES', 'ko', 'pl', 'pt-BR'];
const expectedLevels = ['N5', 'N4', 'N3', 'N2', 'N1'];
const expectedModes = ['mix', 'kana', 'vocab', 'lines', 'grammar'];

const sourcePaths = [
  'App.tsx',
  'src/i18n.ts',
  'src/gameData.ts',
  'src/grammarData.ts',
  'src/gameEngine.ts',
  'src/storage.ts',
  'src/bgm.ts',
  'src/ads.ts',
  'src/ads.native.ts',
  'src/ads.web.ts',
];
const sources = Object.fromEntries(
  sourcePaths.map((relativePath) => [relativePath, fs.readFileSync(path.join(root, relativePath), 'utf8')]),
);
const appSource = sources['App.tsx'];
const i18n = loadTsModule('src/i18n.ts');
const gameData = loadTsModule('src/gameData.ts');
const gameEngine = loadTsModule('src/gameEngine.ts');

const locales = (i18n.LOCALE_OPTIONS ?? []).map((option) => option.locale);
const levels = gameData.JLPT_LEVELS ?? [];
const modeChoices = expectedModes.filter((mode) => appSource.includes(`mode: '${mode}' as const`));
const bgmTracks = Array.from(sources['src/bgm.ts'].matchAll(/id:\s*'([^']+)'/g)).map((match) => match[1]);
const phases = Array.from(appSource.match(/type Phase = ([^;]+);/)?.[1]?.matchAll(/'([^']+)'/g) ?? []).map((match) => match[1]);

const checks = [
  check(
    'first-playable-screen',
    'First screen is a playable ready state with practice and daily challenge entry points',
    allPresent(appSource, ["useState<Phase>('ready')", "phase === 'ready'", 'startGame(false)', 'startGame(true)', 'heroPanel']),
    ['App.tsx initializes phase to ready and renders practice/daily buttons from the ready body.'],
  ),
  check(
    'difficulty-selector',
    'N5-N1 difficulty selector is sourced from the study-bank level list and shows real counts',
    sameSet(levels, expectedLevels) &&
      appSource.includes('JLPT_LEVELS.map') &&
      appSource.includes('getLevelStudyStats(nextLevel)') &&
      sourceContainsAllLevelLabels(),
    [`${levels.length} JLPT levels exposed: ${levels.join(', ')}.`],
  ),
  check(
    'level-mastery-map',
    'Ready screen shows local mastery progress for every JLPT level',
    sourceContainsAll(appSource, [
      'levelMasteryRows',
      'ALL_ITEMS.filter',
      'progress.mastery',
      'levelProgressPanel',
      'levelProgressTrack',
      "t(locale, 'levelProgress')",
    ]) &&
      sourceContainsAll(sources['src/i18n.ts'], ['levelProgress:', 'mastered:']),
    ['The ready screen renders N5-N1 progress rows from the local mastery store.'],
  ),
  check(
    'weak-review-retention',
    'Ready screen exposes a local weak-item review loop from recent mistakes',
    sourceContainsAll(appSource, [
      'weakReviewItems',
      'progress.reviewQueue',
      'progress.mistakes',
      'makeQuestionFromItems',
      'sessionMistakes',
      'mistakeHits',
      'weakReviewLabel',
      'weakReviewDone',
    ]) &&
      sourceContainsAll(sources['src/storage.ts'], [
        'mistakes',
        'reviewQueue',
        'mistakeHits',
        'moveToReviewFront',
      ]) &&
      sources['src/gameEngine.ts'].includes('makeQuestionFromItems'),
    ['Recent wrong answers are persisted locally, filtered by mode/level, and replayed through a dedicated weak-review entry.'],
  ),
  check(
    'next-step-guidance',
    'Ready screen recommends the next local learning action from weak items and JLPT mastery',
    sourceContainsAll(appSource, [
      'type NextStepAdvice',
      'createNextStepAdvice',
      'nextStepAdvice',
      'followNextStep',
      'nextStepCard',
      'nextStepActionPill',
      "t(locale, 'nextStep')",
      "t(locale, 'nextLevel')",
    ]) &&
      sourceContainsAll(sources['src/i18n.ts'], [
        'nextStep:',
        'nextStepReview:',
        'nextStepPractice:',
        'nextStepAdvance:',
        'nextStepComplete:',
        'allLevelsCleared:',
      ]),
    ['The ready screen turns local mastery and mistake data into a tappable next-step recommendation.'],
  ),
  check(
    'achievement-milestones',
    'Ready screen shows local achievement milestones from runs, streaks, mastery, and N1 progress',
    sourceContainsAll(appSource, [
      'type AchievementBadge',
      'achievementBadges',
      'createAchievementBadges',
      'badgePanel',
      'badgeGrid',
      "t(locale, 'milestones')",
      'progress.totalSessions',
      'progress.dailyStreak',
      'progress.mastery',
    ]) &&
      sourceContainsAll(sources['src/i18n.ts'], [
        'milestones:',
        'unlocked:',
        'locked:',
        'badgeFirstRun:',
        'badgeStreak:',
        'badgeMastery:',
        'badgeN1:',
      ]),
    ['The ready screen adds compact local achievement badges without accounts, analytics, or server sync.'],
  ),
  check(
    'session-mission-retention',
    'Each run has a visible local mission target, live progress text, and finish-state result',
    sourceContainsAll(appSource, [
      'type SessionGoal',
      'createSessionGoal',
      'sessionGoalTargetText',
      'sessionGoalProgressText',
      'isSessionGoalComplete',
      'missionCard',
      'missionResultCard',
      "t(locale, 'mission')",
      "t(locale, 'missionProgress')",
      "t(locale, 'missionComplete')",
      "t(locale, 'missionKeepGoing')",
    ]) &&
      sourceContainsAll(sources['src/i18n.ts'], [
        'mission:',
        'missionPreview:',
        'missionScore:',
        'missionCombo:',
        'missionAccuracy:',
        'missionProgress:',
        'missionComplete:',
        'missionKeepGoing:',
      ]),
    ['A lightweight run mission is generated from mode/level/daily-review context, shown before play, updated during play, and resolved on the finish screen.'],
  ),
  check(
    'daily-goal-retention',
    'Ready screen shows a persisted daily run goal that advances after every finished run',
    sourceContainsAll(appSource, [
      'dailyGoalRuns',
      'dailyGoalTarget',
      'dailyGoalProgress',
      'dailyGoalPercent',
      'isDailyGoalComplete',
      'dailyGoalDate: todayDateKey',
      'dailyGoalCard',
      "t(locale, 'dailyGoal')",
      "t(locale, 'dailyGoalBody')",
      "t(locale, 'dailyGoalComplete')",
    ]) &&
      sourceContainsAll(sources['src/storage.ts'], [
        'DAILY_GOAL_TARGET',
        'dailyGoal',
        'dailyGoalDate',
        'mergeDailyGoal',
        'normalizeDailyGoal',
      ]) &&
      sourceContainsAll(sources['src/i18n.ts'], [
        'dailyGoal:',
        'dailyGoalBody:',
        'dailyGoalComplete:',
      ]),
    ['The ready screen renders today\'s local run target and storage advances/resets it by date without accounts or server sync.'],
  ),
  check(
    'mode-selector',
    'Five game modes are exposed before a run: mix, kana, words, lines, and grammar',
    sameSet(modeChoices, expectedModes) &&
      sourceContainsAll(appSource, ['modeMix', 'modeKana', 'modeVocab', 'modeLines', 'modeGrammar']),
    [`${modeChoices.length} modes found in App.tsx: ${modeChoices.join(', ')}.`],
  ),
  check(
    'playing-loop',
    'Playing state contains timer, score, combo/lives, prompt, four options, feedback, and answer handling',
    sourceContainsAll(appSource, [
      "phase === 'playing'",
      'scoreStrip',
      'timerTrack',
      'questionPanel',
      'optionGrid',
      'answerQuestion(option)',
      'feedbackBar',
      'timeLeft',
      'scoreForAnswer',
    ]),
    ['The playing branch wires score/timer UI to answerQuestion and scoreForAnswer.'],
  ),
  check(
    'answer-study-hint',
    'Answered questions reveal a compact study hint with the correct answer, reading, and meaning',
    sourceContainsAll(appSource, [
      'type AnswerStudyHint',
      'getAnswerStudyHint',
      'answerStudyHint',
      'answerHintCard',
      'answerHintDetail',
      'revealDelayMs',
      'localize(item.meaning, locale)',
    ]) &&
      sources['App.tsx'].includes("feedback?.tone === 'bad' && styles.answerHintCardBad"),
    ['The playing branch keeps the answer reveal visible long enough to show reading, romaji, and localized meaning after each answer.'],
  ),
  check(
    'exit-run',
    'A visible in-game exit button returns from an active run to the ready screen',
    sourceContainsAll(appSource, [
      "phase === 'playing'",
      "accessibilityLabel={t(locale, 'exitRun')}",
      'onPress={goHome}',
      'headerExitButton',
      "setPhase('ready')",
    ]),
    ['The playing header uses the localized exitRun button and the goHome handler resets to ready.'],
  ),
  check(
    'finish-loop',
    'Finished state lets the player play again or switch mode without restarting the app',
    sourceContainsAll(appSource, [
      "phase === 'finished'",
      'playAgain',
      'switchMode',
      'startGame(Boolean(dailyKey), isWeakReview)',
      "setPhase('ready')",
      'finishScore',
    ]),
    ['The finished branch exposes play-again and switch-mode flows.'],
  ),
  check(
    'finish-learning-recap',
    'Finished state summarizes new mastery and mistakes, then links back into weak review',
    sourceContainsAll(appSource, [
      'sessionMasteredThisRun',
      'sessionMistakeTotal',
      'runRecap',
      'recapPanel',
      'recapReviewButton',
      "t(locale, 'reviewNow')",
      'startGame(false, true)',
    ]) &&
      sourceContainsAll(sources['src/i18n.ts'], [
        'runRecap:',
        'newMastered:',
        'misses:',
        'reviewNow:',
        'noMissesThisRun:',
      ]),
    ['The finish screen turns the just-finished run into a learning recap and a direct review path for misses.'],
  ),
  check(
    'settings-language',
    'Language switching lives inside Settings, follows the system by default, and excludes Japanese as a UI locale',
    sameSet(locales, expectedLocales) &&
      !locales.includes('ja') &&
      appSource.indexOf('LOCALE_OPTIONS.map') > appSource.indexOf('{isSettingsOpen ? (') &&
      sourceContainsAll(appSource, ['followSystemLocale', 'changeLocale(option.locale)', 'systemLanguage']),
    [`${locales.length} settings locales found; Japanese UI locale present: ${locales.includes('ja') ? 'yes' : 'no'}.`],
  ),
  check(
    'settings-local-data-reset',
    'Settings exposes a two-tap local progress reset without accounts or server sync',
    sourceContainsAll(appSource, [
      'resetLocalProgress',
      'isResetProgressArmed',
      'createDefaultProgress()',
      'saveProgress(next)',
      "t(locale, 'localData')",
      "t(locale, isResetProgressArmed ? 'confirmResetProgress' : 'resetProgress')",
      'progressResetNotice',
    ]) &&
      sourceContainsAll(sources['src/i18n.ts'], [
        'localData:',
        'resetProgress:',
        'confirmResetProgress:',
        'progressResetArmed:',
        'progressResetDone:',
      ]),
    ['The Settings modal resets only the local progress object after an explicit confirmation tap.'],
  ),
  check(
    'settings-compliance-links',
    'Settings exposes support, privacy, open-source notices, and ad privacy options when available',
    sourceContainsAll(appSource, [
      'activeSupportUrl',
      'activePrivacyPolicyUrl',
      'activeOpenSourceNoticesUrl',
      "openComplianceLink(activeSupportUrl, 'support')",
      "openComplianceLink(activePrivacyPolicyUrl, 'privacy')",
      "openComplianceLink(activeOpenSourceNoticesUrl, 'openSource')",
      'localCompliancePanel',
      'showAdPrivacyOptions',
      'supportPrivacy',
      'localPrivacyBody',
    ]),
    ['Support, privacy, open-source, local fallback information, and UMP ad privacy entries are only in Settings.'],
  ),
  check(
    'settings-audio',
    'Settings exposes BGM enablement and track selection without adding recording permissions',
    bgmTracks.length === 3 &&
      sourceContainsAll(appSource, ['BGM_TRACKS.map', 'toggleBgm', 'selectBgmTrack(track.id)', 'musicOn', 'musicOff']) &&
      sources['src/bgm.ts'].includes('require('),
    [`${bgmTracks.length} BGM tracks configured: ${bgmTracks.join(', ')}.`],
  ),
  check(
    'rewarded-ad-entry',
    'Rewarded-ad continue entry is wired from gameplay UI to native/web ad boundaries',
    sourceContainsAll(appSource, ['claimAdReward', 'showRewardedContinueAd', 'shouldGrantDevelopmentReward', 'adContinue', 'adRewardUsed']) &&
      sources['src/ads.native.ts'].includes('RewardedAd') &&
      sources['src/ads.web.ts'].includes('showRewardedContinueAd'),
    ['The gameplay ad button calls claimAdReward; native and web ad boundary files exist.'],
  ),
  check(
    'daily-streak-retention',
    'Daily challenge and streak state are retained locally across sessions',
    sourceContainsAll(appSource, ['getDailyKey()', 'dailyStreakCount', 'dailyKey', 'startGame(true)', 'mergeSession']) &&
      sourceContainsAll(sources['src/storage.ts'], ['dailyStreak', 'lastDailyDate', 'saveProgress', 'loadProgress']),
    ['Daily challenge keys are level-aware in App.tsx and streak state is persisted by storage.ts.'],
  ),
  check(
    'release-runtime-boundary',
    'Runtime flow stays no-account/local-first while still exposing review-ready links and ad entry points',
    sourceContainsAll(appSource, ['loadSettings', 'saveSettings', 'loadProgress', 'saveProgress']) &&
      !/\bTextInput\b/.test(appSource) &&
      !/\bsignIn\b|\blogIn\b|\bAuthSession\b/.test(appSource) &&
      gameEngine.LEVEL_DIFFICULTY_PROFILES?.N1?.order === 5,
    ['No TextInput, sign-in, or auth entry appears in App.tsx; progress/settings stay local.'],
  ),
];
const failures = checks.filter((entry) => !entry.passed).map((entry) => entry.id);

const audit = {
  schemaVersion: 1,
  source: 'scripts/generate-runtime-ui-flow-audit.js',
  generatedFrom: {
    runtimeSources: sourcePaths,
    gameplayContract: 'scripts/check-gameplay-contract.js',
    releaseStatus: 'scripts/release-status.js',
  },
  posture: {
    statement: 'Kana Sprint starts on the playable game surface and keeps N5-N1 mastery progress, daily run goals, run missions, weak-item review, local data reset, language, music, support/privacy, rewarded-ad, daily challenge, and exit controls reachable from runtime UI.',
    releaseAction: 'If this audit fails, fix the runtime App.tsx flow before regenerating screenshots or submitting for review.',
  },
  summary: {
    risk: failures.length === 0 ? 'PASS' : 'REVIEW',
    localReady: failures.length === 0,
    locales: locales.length,
    levels: levels.length,
    modes: modeChoices.length,
    phases: phases.length,
    bgmTracks: bgmTracks.length,
    hasJapaneseUiLocale: locales.includes('ja'),
    checks: checks.length,
    passedChecks: checks.filter((entry) => entry.passed).length,
    requiredFlowFailures: failures.length,
  },
  app: {
    firstScreen: 'ready',
    phases,
    locales,
    levels,
    modes: modeChoices,
    bgmTracks,
    noAccountRequired: true,
    settingsOwnsLanguageSwitching: true,
    localProgressResetAvailable: checks.some((entry) => entry.id === 'settings-local-data-reset' && entry.passed),
    dailyGoalAvailable: checks.some((entry) => entry.id === 'daily-goal-retention' && entry.passed),
    sessionMissionAvailable: checks.some((entry) => entry.id === 'session-mission-retention' && entry.passed),
    weakReviewAvailable: checks.some((entry) => entry.id === 'weak-review-retention' && entry.passed),
  },
  checks,
  failures,
  commands: [
    'npm run runtime:ui-flow',
    'npm run gameplay-check',
    'npm run release:verify',
  ],
};

fs.writeFileSync(jsonPath, `${JSON.stringify(audit, null, 2)}\n`);
fs.writeFileSync(markdownPath, renderMarkdown(audit));

if (audit.summary.risk !== 'PASS') {
  console.error(`Runtime UI flow audit requires review: ${failures.length} issue(s)`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`generated ${path.relative(root, markdownPath)} and ${path.relative(root, jsonPath)}`);

function check(id, label, passed, evidence) {
  return { id, label, passed: Boolean(passed), evidence };
}

function sourceContainsAll(source, snippets) {
  return snippets.every((snippet) => source.includes(snippet));
}

function allPresent(source, snippets) {
  return sourceContainsAll(source, snippets);
}

function sourceContainsAllLevelLabels() {
  return expectedLevels.every((level) => sources['src/i18n.ts'].includes(`level${level}:`));
}

function sameSet(actual, expected) {
  return Array.isArray(actual) && actual.length === expected.length && expected.every((item) => actual.includes(item));
}

function renderMarkdown(values) {
  const checkRows = values.checks
    .map((entry) => `| ${entry.id} | ${entry.passed ? 'Yes' : 'No'} | ${escapeCell(entry.label)} |`)
    .join('\n');
  const commands = values.commands.map((command) => `- \`${command}\``).join('\n');
  const failures = values.failures.length > 0 ? values.failures.map((failure) => `- ${failure}`).join('\n') : '- None.';

  return `# Runtime UI Flow Audit

${values.posture.statement}

## Summary

- Risk: ${values.summary.risk}
- Local runtime UI ready: ${values.summary.localReady ? 'Yes' : 'No'}
- UI locales: ${values.summary.locales}
- Japanese UI locale present: ${values.summary.hasJapaneseUiLocale ? 'Yes' : 'No'}
- JLPT levels: ${values.summary.levels}
- Game modes: ${values.summary.modes}
- Runtime phases: ${values.summary.phases}
- BGM tracks: ${values.summary.bgmTracks}
- Checks passed: ${values.summary.passedChecks}/${values.summary.checks}
- Required flow failures: ${values.summary.requiredFlowFailures}

## Runtime Surface

- First screen: ${values.app.firstScreen}
- Phases: ${values.app.phases.join(', ')}
- Modes: ${values.app.modes.join(', ')}
- Levels: ${values.app.levels.join(', ')}
- Locales: ${values.app.locales.join(', ')}
- BGM tracks: ${values.app.bgmTracks.join(', ')}
- No account required: ${values.app.noAccountRequired ? 'Yes' : 'No'}
- Daily run goal available: ${values.app.dailyGoalAvailable ? 'Yes' : 'No'}
- Run missions available: ${values.app.sessionMissionAvailable ? 'Yes' : 'No'}
- Weak-item review available: ${values.app.weakReviewAvailable ? 'Yes' : 'No'}
- Language switching owned by Settings: ${values.app.settingsOwnsLanguageSwitching ? 'Yes' : 'No'}
- Local progress reset in Settings: ${values.app.localProgressResetAvailable ? 'Yes' : 'No'}

## Checks

| Check | Passed | Evidence |
| --- | --- | --- |
${checkRows}

## Flow Failures

${failures}

## Commands

${commands}

${values.posture.releaseAction}
`;
}

function escapeCell(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
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

    if (request === '@react-native-async-storage/async-storage') {
      return {
        getItem: async () => null,
        setItem: async () => undefined,
      };
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
