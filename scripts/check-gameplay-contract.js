const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const cache = new Map();
const failures = [];

const modes = ['kana', 'vocab', 'lines', 'grammar', 'mix'];
const samplesPerCombination = 18;
const levelMinimums = {
  N5: { vocab: 130, lines: 40, grammar: 20 },
  N4: { vocab: 90, lines: 24, grammar: 20 },
  N3: { vocab: 90, lines: 24, grammar: 20 },
  N2: { vocab: 90, lines: 24, grammar: 20 },
  N1: { vocab: 90, lines: 24, grammar: 20 },
};

const gameData = loadTsModule('src/gameData.ts');
const gameEngine = loadTsModule('src/gameEngine.ts');
const i18n = loadTsModule('src/i18n.ts');
const storage = loadTsModule('src/storage.ts');
const appSource = fs.readFileSync(path.join(root, 'App.tsx'), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

const locales = i18n.LOCALE_OPTIONS.map((option) => option.locale);
const levels = gameData.JLPT_LEVELS;
const validModeLevelCombinations = levels.flatMap((level) => modes
  .filter((mode) => mode !== 'kana' || level === 'N5')
  .map((mode) => ({ level, mode })));

validateLevelBanks();
validateLineContentQuality();
validateGrammarBankIntegrity();
validateDifficultyProfiles();
validateChineseKanaRecall();
validateListeningCoverage();
validateAnswerRevealTiming();
validatePronunciationUiContract();
validateListeningUiContract();
validateRewardedContinueUiContract();
validateRunStartStorageGate();
validateKanaLevelUiContract();

for (const locale of locales) {
  for (const { level, mode } of validModeLevelCombinations) {
    const recentIds = [];

    for (let index = 0; index < samplesPerCombination; index += 1) {
      const question = gameEngine.makeQuestion(mode, index, recentIds, locale, level, `contract-${level}`);
      validateQuestion(question, { locale, level, mode, index });
      recentIds.unshift(question.itemId);
      recentIds.splice(6);
    }
  }
}

validateDailyDeterminism();
validateModeLevelCoverage();
validateDailyStreakProgress();
validateDailyGoalProgress();
validateGrammarProgressStorage();
validateSettingsModePersistence();

if (failures.length > 0) {
  console.error('Gameplay contract failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(
  `Gameplay contract passed for ${locales.length} locales, ${levels.length} JLPT levels, ${modes.length} modes, ${validModeLevelCombinations.length} valid mode/level combinations, and ${locales.length * validModeLevelCombinations.length * samplesPerCombination} generated questions.`,
);

function validateQuestion(question, context) {
  const label = `${context.locale}/${context.level}/${context.mode}#${context.index}`;

  assert(Boolean(question), `${label}: question missing`);
  if (!question) return;

  for (const field of ['id', 'itemId', 'kind', 'prompt', 'promptMeta', 'answer', 'accent']) {
    assert(typeof question[field] === 'string' && question[field].trim().length > 0, `${label}: ${field} should be a non-empty string`);
    assert(!String(question[field]).includes('undefined'), `${label}: ${field} contains undefined`);
    assert(!String(question[field]).includes('[object Object]'), `${label}: ${field} contains object text`);
  }

  assert(/^#[0-9A-F]{6}$/i.test(question.accent), `${label}: accent should be a hex color`);
  assert(Array.isArray(question.options), `${label}: options should be an array`);
  assert(question.options.length === 4, `${label}: expected 4 options, got ${question.options.length}`);
  assert(new Set(question.options).size === question.options.length, `${label}: options should be unique`);
  assert(question.options.includes(question.answer), `${label}: options should include the answer`);

  for (const option of question.options) {
    assert(typeof option === 'string' && option.trim().length > 0, `${label}: option should be a non-empty string`);
    assert(!option.includes('undefined'), `${label}: option contains undefined`);
  }

  if (context.mode === 'vocab') {
    assert(question.item.kind === 'vocab', `${label}: vocab mode should only use vocab items`);
    assert(question.item.level === context.level, `${label}: vocab mode should stay inside ${context.level}`);
  }

  if (context.mode === 'lines') {
    assert(question.item.kind === 'line', `${label}: lines mode should only use line items`);
    assert(question.item.level === context.level, `${label}: lines mode should stay inside ${context.level}`);
  }

  if (context.mode === 'grammar') {
    assert(question.item.kind === 'grammar', `${label}: grammar mode should only use grammar items`);
    assert(question.item.level === context.level, `${label}: grammar mode should stay inside ${context.level}`);
  }

  if (context.mode === 'kana') {
    assert(context.level === 'N5', `${label}: kana mode should use its fixed foundation difficulty instead of N1-N4`);
    assert(question.item.kind === 'hiragana' || question.item.kind === 'katakana', `${label}: kana mode should only use kana items`);
  }

  if (context.mode === 'mix' && context.level !== 'N5') {
    assert(
      question.item.kind === 'vocab' || question.item.kind === 'line' || question.item.kind === 'grammar',
      `${label}: N4-N1 mix should use level study items`,
    );
    assert(question.item.level === context.level, `${label}: mix mode should stay inside ${context.level}`);
  }

  validateAnswerOptions(question, context, label);
  validateGrammarQuestion(question, context, label);
}

function validateLevelBanks() {
  assert(gameData.KANA_ITEMS.length >= 92, `Kana bank should include hiragana and katakana basics, got ${gameData.KANA_ITEMS.length}`);

  for (const level of levels) {
    const vocabCount = gameData.VOCAB_ITEMS.filter((item) => item.level === level).length;
    const lineCount = gameData.LINE_ITEMS.filter((item) => item.level === level).length;
    const grammarCount = gameData.GRAMMAR_ITEMS.filter((item) => item.level === level).length;
    const minimum = levelMinimums[level];

    assert(Boolean(minimum), `${level}: missing minimum content contract`);
    assert(vocabCount >= minimum.vocab, `${level}: vocabulary bank too small: ${vocabCount}/${minimum.vocab}`);
    assert(lineCount >= minimum.lines, `${level}: line bank too small: ${lineCount}/${minimum.lines}`);
    assert(grammarCount >= minimum.grammar, `${level}: grammar bank too small: ${grammarCount}/${minimum.grammar}`);
  }
}

function validateLineContentQuality() {
  const ids = new Set();
  const displays = new Set();
  const kanjiPattern = /[\u3400-\u4dbf\u4e00-\u9fff]/u;
  const rejectedDisplays = new Set([
    '希望を離さない',
    '怖くない心',
    '答えは中にある',
    '料理の匂いで帰ろう',
    '失敗の理由を明日に変える',
    '活動の中で見つかる',
    '回復した心で走る',
    '主要な道を選ぶ',
    '反応より一歩先へ',
    '手段より守りたいものがある',
    '基準を越えて挑め',
    '維持する勇気を忘れない',
    '推進する手を離さない',
    '忘却の先に残像が残る',
    '経緯を抱いて推移を見守る',
    '一連の記憶が境界を結ぶ',
  ]);
  const rejectedEnglishMeanings = new Set([
    'Turn the reason for failure into tomorrow',
    'It is found through action',
    'I run with a recovered heart',
    'Choose the main path',
    'Move one step ahead of reaction',
    'There is something I want to protect more than the method',
    'Go beyond the standard and challenge it',
    'Do not forget the courage to maintain it',
    'An afterimage remains beyond oblivion',
    'Hold the circumstances and watch the transition',
    'A sequence of memories ties the boundary',
  ]);

  for (const item of gameData.LINE_ITEMS) {
    const label = `${item.level}/${item.id}`;

    assert(!ids.has(item.id), `${label}: line id should be unique`);
    assert(!displays.has(item.display), `${label}: line display should be unique`);
    assert(!rejectedDisplays.has(item.display), `${label}: rejected unnatural line should not return`);
    assert(!rejectedEnglishMeanings.has(item.meaning.en), `${label}: rejected mismatched meaning should not return`);
    assert(!kanjiPattern.test(item.kana), `${label}: kana reading should not contain kanji`);
    assert(/^[\x20-\x7E]+$/.test(item.romaji), `${label}: romaji should remain ASCII`);

    for (const locale of locales) {
      assert(Boolean(item.meaning?.[locale]?.trim()), `${label}: ${locale} meaning should be present`);
    }

    ids.add(item.id);
    displays.add(item.display);
  }
}

function validateGrammarBankIntegrity() {
  const ids = new Set();
  const prompts = new Set();
  const rejectedDistractors = new Set([
    'わけになりました',
    'に違いなく',
    'ないわけでした',
    'かねませんでした',
    'べくありません',
    'ものをしません',
  ]);

  for (const item of gameData.GRAMMAR_ITEMS) {
    const label = `${item.level}/${item.id}`;
    const grammar = item.grammar;
    const blankCount = (item.display.match(/＿+/g) ?? []).length;

    assert(!ids.has(item.id), `${label}: grammar id should be unique`);
    assert(!prompts.has(item.display), `${label}: grammar prompt should be unique`);
    assert(blankCount === 1, `${label}: grammar prompt should contain exactly one blank`);
    assert(Boolean(grammar), `${label}: grammar payload should exist`);

    ids.add(item.id);
    prompts.add(item.display);

    if (!grammar) continue;

    assert(!grammar.completedSentence.includes('＿'), `${label}: completed sentence should not contain a blank`);
    assert(item.kana === grammar.completedSentence, `${label}: pronunciation text should use the completed sentence`);
    assert(grammar.options.length === 4, `${label}: grammar item should provide four options`);
    assert(new Set(grammar.options).size === 4, `${label}: grammar item options should be unique`);
    assert(grammar.options.includes(grammar.answer), `${label}: grammar item options should include the answer`);
    assert(
      grammar.options.every((option) => !rejectedDistractors.has(option)),
      `${label}: grammar options should not include rejected unnatural distractors`,
    );
  }
}

function validateDifficultyProfiles() {
  const profiles = gameEngine.LEVEL_DIFFICULTY_PROFILES;
  assert(Boolean(profiles), 'LEVEL_DIFFICULTY_PROFILES should be exported from gameEngine');

  let previousOrder = 0;
  let previousLineWeight = 0;
  let previousMeaningToWordWeight = -1;
  let previousListeningWeight = -1;
  let previousTopicBias = -1;
  let previousGrammarWeight = -1;

  for (const level of levels) {
    const profile = profiles?.[level];
    assert(Boolean(profile), `${level}: missing difficulty profile`);
    if (!profile) continue;

    const weights = profile.mixWeights ?? {};
    const weightSum = (weights.kana ?? 0) + (weights.vocab ?? 0) + (weights.lines ?? 0) + (weights.grammar ?? 0);

    assert(Math.abs(weightSum - 1) < 0.001, `${level}: mix weights should total 1, got ${weightSum}`);
    assert(
      typeof profile.meaningToWordWeight === 'number' && profile.meaningToWordWeight >= 0 && profile.meaningToWordWeight <= 1,
      `${level}: meaningToWordWeight should be a 0-1 probability`,
    );
    assert(
      typeof profile.listeningWeight === 'number' && profile.listeningWeight > 0 && profile.listeningWeight < 0.5,
      `${level}: listeningWeight should be a focused 0-0.5 probability`,
    );
    assert(profile.order > previousOrder, `${level}: difficulty order should increase from N5 to N1`);
    assert((weights.lines ?? 0) >= previousLineWeight, `${level}: line weight should not drop as difficulty rises`);
    assert(profile.meaningToWordWeight >= previousMeaningToWordWeight, `${level}: reverse Japanese recall weight should not drop as difficulty rises`);
    assert(profile.listeningWeight >= previousListeningWeight, `${level}: listening weight should not drop as difficulty rises`);
    assert(profile.topicDistractorBias >= previousTopicBias, `${level}: same-topic distractor bias should not drop as difficulty rises`);
    assert((weights.grammar ?? 0) >= previousGrammarWeight, `${level}: grammar weight should not drop as difficulty rises`);

    if (level === 'N5') {
      assert((weights.kana ?? 0) > 0, 'N5 mix should include kana fundamentals');
    } else {
      assert((weights.kana ?? 0) === 0, `${level}: mix should not include kana-only fundamentals`);
    }

    previousOrder = profile.order;
    previousLineWeight = weights.lines ?? 0;
    previousMeaningToWordWeight = profile.meaningToWordWeight;
    previousListeningWeight = profile.listeningWeight;
    previousTopicBias = profile.topicDistractorBias;
    previousGrammarWeight = weights.grammar ?? 0;
  }
}

function validateGrammarQuestion(question, context, label) {
  if (question.item.kind !== 'grammar') return;

  const grammar = question.item.grammar;
  assert(question.kind === 'grammarCloze', `${label}: grammar items should use grammar cloze questions`);
  assert(Boolean(grammar), `${label}: grammar payload should exist`);
  if (!grammar) return;

  assert(question.prompt.includes('＿'), `${label}: grammar prompt should visibly contain a blank`);
  assert(question.answer === grammar.answer, `${label}: grammar answer should match its payload`);
  assert(grammar.completedSentence.includes(grammar.answer.replace(/^(?:に|を|と|で|へ|が|は|も|の)/, '').slice(0, 2)) || grammar.answer.length <= 2, `${label}: completed grammar sentence should reflect the answer`);
  assert(grammar.options.length === 4, `${label}: grammar payload should have four options`);
  assert(new Set(grammar.options).size === 4, `${label}: grammar payload options should be unique`);
  assert(grammar.options.includes(grammar.answer), `${label}: grammar payload options should include the answer`);
  assert(question.options.every((option) => grammar.options.includes(option)), `${label}: generated grammar options should come from the item payload`);
  assert(Boolean(i18n.t(context.locale, 'promptChooseGrammar')), `${label}: grammar prompt instruction should be localized`);
}

function validateAnswerOptions(question, context, label) {
  if (!['wordToMeaning', 'meaningToWord', 'kanaToMeaning', 'meaningToKana', 'listeningToMeaning'].includes(question.kind)) return;
  if (question.item.kind !== 'vocab' && question.item.kind !== 'line') return;

  const sourcePool = question.item.kind === 'line' ? gameData.LINE_ITEMS : gameData.VOCAB_ITEMS;

  for (const option of question.options) {
    const optionItems = sourcePool.filter((item) => valueForKind(item, question.kind, context.locale) === option);
    assert(
      optionItems.some((item) => item.level === question.item.level && item.kind === question.item.kind),
      `${label}: option "${option}" should come from the ${question.item.level} ${question.item.kind} bank`,
    );
  }

  if (levelRank(context.level) < 3) return;

  const sameTopicCandidates = sourcePool.filter((item) => (
    item.id !== question.item.id
    && item.level === question.item.level
    && item.kind === question.item.kind
    && item.topic.en === question.item.topic.en
    && valueForKind(item, question.kind, context.locale) !== question.answer
  ));

  if (sameTopicCandidates.length === 0) return;

  const hasSameTopicDistractor = question.options.some((option) => (
    option !== question.answer
    && sameTopicCandidates.some((item) => valueForKind(item, question.kind, context.locale) === option)
  ));

  assert(hasSameTopicDistractor, `${label}: ${context.level} options should include a same-topic distractor when available`);
}

function valueForKind(item, kind, locale) {
  if (kind === 'wordToMeaning' || kind === 'kanaToMeaning' || kind === 'listeningToMeaning') return i18n.localize(item.meaning, locale);
  if (kind === 'meaningToWord') return item.display;
  if (kind === 'meaningToKana') return item.kana;
  if (kind === 'kanaToRomaji') return item.romaji;
  return item.display;
}

function validateChineseKanaRecall() {
  const chineseLocales = ['zh-Hans', 'zh-Hant'];
  const studyModes = ['vocab', 'lines'];
  const kanjiPattern = /[\u3400-\u4dbf\u4e00-\u9fff]/u;

  for (const locale of chineseLocales) {
    for (const level of levels) {
      const baselineWeights = gameEngine.getStudyQuestionWeights(level, 'en');
      const chineseWeights = gameEngine.getStudyQuestionWeights(level, locale);

      assert(
        chineseWeights.listeningWeight > baselineWeights.listeningWeight,
        `${locale}/${level}: Chinese study questions should increase listening weight`,
      );
      assert(
        chineseWeights.reverseRecallWeight > baselineWeights.reverseRecallWeight,
        `${locale}/${level}: Chinese study questions should increase reverse recall weight`,
      );

      for (const mode of studyModes) {
        const seenKinds = new Set();
        const distributionSeed = `chinese-difficulty-${level}-${mode}`;
        const sampleCount = 240;
        const baselineQuestions = Array.from({ length: sampleCount }, (_, index) => (
          gameEngine.makeQuestion(mode, index, [], 'en', level, distributionSeed)
        ));
        const baselineListeningCount = baselineQuestions.filter((question) => question.kind === 'listeningToMeaning').length;
        const baselineReverseRecallCount = baselineQuestions.filter((question) => question.kind === 'meaningToWord').length;
        let chineseListeningCount = 0;
        let chineseReverseRecallCount = 0;

        for (let index = 0; index < sampleCount; index += 1) {
          const question = gameEngine.makeQuestion(mode, index, [], locale, level, distributionSeed);
          const label = `${locale}/${level}/${mode} anti-kanji#${index}`;

          seenKinds.add(question.kind);
          if (question.kind === 'listeningToMeaning') chineseListeningCount += 1;
          if (question.kind === 'meaningToKana') chineseReverseRecallCount += 1;
          assert(
            question.kind === 'kanaToMeaning' || question.kind === 'meaningToKana' || question.kind === 'listeningToMeaning',
            `${label}: Chinese study questions should use kana or listening recall`,
          );
          assert(!kanjiPattern.test(question.item.kana), `${label}: kana field should not expose kanji`);

          if (question.kind === 'kanaToMeaning') {
            assert(question.prompt === question.item.kana, `${label}: reading prompt should use kana instead of kanji display`);
          }

          if (question.kind === 'meaningToKana') {
            assert(question.answer === question.item.kana, `${label}: reverse recall answer should use kana`);
            assert(question.options.every((option) => !kanjiPattern.test(option)), `${label}: reverse recall options should not expose kanji`);
          }

          if (question.kind === 'listeningToMeaning') {
            assert(question.prompt === i18n.t(locale, 'listeningCue'), `${label}: listening prompt should hide the written Japanese`);
            assert(question.answer === i18n.localize(question.item.meaning, locale), `${label}: listening answer should use the localized meaning`);
          }
        }

        assert(seenKinds.has('kanaToMeaning'), `${locale}/${level}/${mode}: should generate kana-to-meaning questions`);
        assert(seenKinds.has('meaningToKana'), `${locale}/${level}/${mode}: should generate meaning-to-kana questions`);
        assert(seenKinds.has('listeningToMeaning'), `${locale}/${level}/${mode}: should generate listening questions`);
        assert(
          chineseListeningCount > baselineListeningCount,
          `${locale}/${level}/${mode}: Chinese output should contain more listening questions than the baseline`,
        );
        assert(
          chineseReverseRecallCount > baselineReverseRecallCount,
          `${locale}/${level}/${mode}: Chinese output should contain more reverse-recall questions than the baseline`,
        );
      }
    }
  }
}

function validateListeningCoverage() {
  for (const level of levels) {
    for (const mode of ['vocab', 'lines']) {
      const questions = Array.from({ length: 160 }, (_, index) => (
        gameEngine.makeQuestion(mode, index, [], 'en', level, `listening-${level}-${mode}`)
      ));
      const listeningQuestions = questions.filter((question) => question.kind === 'listeningToMeaning');

      assert(listeningQuestions.length > 0, `${level}/${mode}: should generate listening questions`);

      for (const question of listeningQuestions) {
        assert(question.prompt === i18n.t('en', 'listeningCue'), `${level}/${mode}: listening prompt should hide written Japanese`);
        assert(question.promptMeta.includes(i18n.t('en', 'promptListen')), `${level}/${mode}: listening instruction should be localized`);
        assert(question.answer === i18n.localize(question.item.meaning, 'en'), `${level}/${mode}: listening answer should be the localized meaning`);
      }
    }
  }
}

function validateAnswerRevealTiming() {
  const n5Vocab = gameData.VOCAB_ITEMS.find((item) => item.level === 'N5');
  const n1Vocab = gameData.VOCAB_ITEMS.find((item) => item.level === 'N1');
  const n5Line = gameData.LINE_ITEMS.find((item) => item.level === 'N5');
  const n1Line = gameData.LINE_ITEMS.find((item) => item.level === 'N1');
  const n5Grammar = gameData.GRAMMAR_ITEMS.find((item) => item.level === 'N5');
  const n1Grammar = gameData.GRAMMAR_ITEMS.find((item) => item.level === 'N1');

  for (const item of [n5Vocab, n1Vocab, n5Line, n1Line, n5Grammar, n1Grammar]) {
    assert(Boolean(item), 'Answer reveal timing fixtures should exist');
    if (!item) continue;

    const correctDelay = gameEngine.getAnswerRevealDelayMs(item, true);
    const wrongDelay = gameEngine.getAnswerRevealDelayMs(item, false);
    assert(correctDelay >= 700, `${item.id}: correct reveal should remain readable`);
    assert(wrongDelay >= 1450, `${item.id}: wrong reveal should remain readable`);
    assert(wrongDelay > correctDelay, `${item.id}: wrong answers should reveal longer than correct answers`);
  }

  assert(
    gameEngine.getAnswerRevealDelayMs(n1Vocab, false) > gameEngine.getAnswerRevealDelayMs(n5Vocab, false),
    'N1 vocabulary should reveal longer than N5 vocabulary',
  );
  assert(
    gameEngine.getAnswerRevealDelayMs(n1Line, false) > gameEngine.getAnswerRevealDelayMs(n1Vocab, false),
    'N1 lines should reveal longer than N1 vocabulary',
  );
  assert(
    gameEngine.getAnswerRevealDelayMs(n1Grammar, false) > gameEngine.getAnswerRevealDelayMs(n5Grammar, false),
    'N1 grammar should reveal longer than N5 grammar',
  );
}

function validatePronunciationUiContract() {
  assert(packageJson.dependencies?.['expo-speech'] === '~56.0.3', 'Expo Speech should match the SDK 56 recommended version');
  assert(appSource.includes("import * as Speech from 'expo-speech'"), 'App should import Expo Speech');
  assert(appSource.includes('Speech.speak(utterance'), 'Question panel should speak the current Japanese reading');
  assert(appSource.includes("language: 'ja-JP'"), 'Pronunciation should request a Japanese voice');
  assert(appSource.includes('question.item.kana || question.item.display'), 'Pronunciation should prefer kana over kanji display text');
  assert(appSource.includes('speechSynthesis?: unknown'), 'Web pronunciation should detect browser speech support synchronously');
  assert(appSource.includes("t(locale, 'pronunciationUnavailable')"), 'Unavailable pronunciation should provide localized feedback');
  assert(appSource.includes("t(locale, 'playPronunciation')"), 'Pronunciation button should use a localized accessibility label');
  assert(appSource.includes('accessibilityState={{ selected: isPronunciationPlaying }}'), 'Pronunciation button should expose speaking state');
  assert(appSource.includes('stopPronunciation();') && appSource.includes('[question.id, stopPronunciation]'), 'Pronunciation should stop when the question changes');
  assert(appSource.includes("question.item.kind !== 'grammar' || isLocked"), 'Grammar pronunciation should stay hidden until the answer is revealed');

  for (const locale of locales) {
    assert(Boolean(i18n.t(locale, 'playPronunciation')), `${locale}: pronunciation accessibility label should be localized`);
    assert(Boolean(i18n.t(locale, 'pronunciationUnavailable')), `${locale}: pronunciation unavailable feedback should be localized`);
  }
}

function validateListeningUiContract() {
  assert(appSource.includes("question.kind === 'listeningToMeaning'"), 'App should render listening questions separately');
  assert(appSource.includes('setTimeout(playPronunciation, 220)'), 'Listening questions should automatically play Japanese audio');
  assert(/isLocked\s+\? question\.item\.display/.test(appSource), 'Listening questions should reveal written Japanese after answering');
  assert(/isPronunciationAvailable === false\s+\? question\.item\.kana/.test(appSource), 'Listening questions should fall back to kana when speech is unavailable');
  assert(appSource.includes("question.kind !== 'listeningToMeaning'"), 'Automatic pronunciation should only run for listening questions');

  for (const locale of locales) {
    assert(Boolean(i18n.t(locale, 'promptListen')), `${locale}: listening instruction should be localized`);
    assert(Boolean(i18n.t(locale, 'listeningCue')), `${locale}: listening cue should be localized`);
  }
}

function validateRewardedContinueUiContract() {
  assert(appSource.includes('const [isAwaitingContinue, setIsAwaitingContinue] = useState(false)'), 'App should track the rewarded continue decision state');
  assert(appSource.includes("phase !== 'playing' || isLocked || isAwaitingContinue"), 'Game timer should pause while the continue decision is open');
  assert(appSource.includes('canOfferAdContinue && !adRewardUsed'), 'Rescue should only be offered when a reward is available and unused');
  assert(appSource.includes("phase !== 'playing' || !isAwaitingContinue || adRewardUsed"), 'Reward claim should only work from the rescue state');
  assert(appSource.includes('Math.max(15, Math.min(GAME_SECONDS, value + 15))'), 'Rewarded continue should restore at least 15 seconds');
  assert(appSource.includes('Math.max(1, Math.min(MAX_LIVES, value + 1))'), 'Rewarded continue should restore at least one life');
  assert(appSource.includes("t(locale, 'continueTitle')"), 'Rescue panel should have a localized title');
  assert(appSource.includes("t(locale, 'continueBody')"), 'Rescue panel should explain the reward');
  assert(appSource.includes("t(locale, 'finishRun')"), 'Rescue panel should allow ending the run');
  assert(appSource.includes("t(locale, 'adLoading')"), 'Rewarded continue should expose a localized loading state');
  assert(appSource.includes('const [isAdLoading, setIsAdLoading] = useState(false)'), 'Rewarded continue should track an in-flight ad request');
  assert(appSource.includes('if (isAdLoading) return;'), 'Rewarded continue should reject duplicate ad requests');
  assert(/finally\s*{\s*setIsAdLoading\(false\);/.test(appSource), 'Rewarded continue should always clear its loading state');
  assert(appSource.includes('accessibilityState={{ busy: isAdLoading, disabled: isAdLoading }}'), 'Rewarded continue should expose loading and disabled accessibility state');
  assert(appSource.includes("accessibilityLabel={t(locale, 'exitRun')}") && appSource.includes('accessibilityState={{ disabled: isAdLoading }}'), 'Run exit actions should lock while a rewarded ad is in flight');
  assert(/stopPronunciation\(\);\s+setPhase\('ready'\)/.test(appSource), 'Leaving a run should stop Japanese pronunciation');

  const adContinueOccurrences = (appSource.match(/t\(locale, 'adContinue'\)/g) ?? []).length;
  assert(adContinueOccurrences === 2, `Rewarded continue copy should only appear in the rescue button and its accessibility label, got ${adContinueOccurrences}`);

  for (const locale of locales) {
    for (const key of ['continueTitle', 'continueBody', 'finishRun', 'adLoading']) {
      assert(Boolean(i18n.t(locale, key)), `${locale}: ${key} should be localized`);
    }
  }
}

function validateRunStartStorageGate() {
  assert(/\(daily: boolean, weakReview = false\) => \{\s+if \(!isStorageReady\) return;/.test(appSource), 'Every run start should wait for stored progress to load');
  assert((appSource.match(/accessibilityState=\{\{ disabled: !isStorageReady \}\}/g) ?? []).length >= 2, 'Practice and daily buttons should expose their loading-disabled state');
  assert((appSource.match(/disabled=\{!isStorageReady\}/g) ?? []).length >= 2, 'Practice and daily buttons should be disabled until progress is ready');
  assert(appSource.includes('[bgmPlayer, gameplayLevel, isBgmEnabled, isStorageReady, locale, mode, weakReviewItems]'), 'Run start callback should react to storage readiness and the effective gameplay level');
}

function validateKanaLevelUiContract() {
  assert(appSource.includes("const gameplayLevel: JlptLevel = mode === 'kana' ? 'N5' : level"), 'Kana mode should use a fixed foundation difficulty internally');
  assert((appSource.match(/mode !== 'kana' \? \(/g) ?? []).length >= 3, 'Kana mode should hide JLPT selection, next-step, and JLPT progress UI');
  assert(appSource.includes("mode === 'kana' ? t(locale, 'modeKana') : level"), 'Kana mission preview should not show an N-level');
  assert(appSource.includes("mode === 'kana' ? null : `${gameplayLevel} / `"), 'Kana question labels should not show an N-level');
  assert(appSource.includes("mode === 'kana' ? achievementBadges.filter((badge) => badge.id !== 'n1-spark')"), 'Kana ready screen should hide the N1-specific achievement badge');
}

function levelRank(level) {
  return gameEngine.LEVEL_DIFFICULTY_PROFILES?.[level]?.order ?? 0;
}

function validateDailyDeterminism() {
  const left = gameEngine.makeQuestion('mix', 12, ['x', 'y'], 'en', 'N2', '2026-06-17-N2');
  const right = gameEngine.makeQuestion('mix', 12, ['x', 'y'], 'en', 'N2', '2026-06-17-N2');

  assert(JSON.stringify(left) === JSON.stringify(right), 'Daily challenge question generation should be deterministic for the same inputs');
}

function validateModeLevelCoverage() {
  const coverage = Object.fromEntries(levels.map((level) => [level, { vocab: false, line: false, grammar: false }]));

  for (const level of levels) {
    for (let index = 0; index < 48; index += 1) {
      const question = gameEngine.makeQuestion('mix', index, [], 'en', level, `coverage-${level}`);
      if (question.item.kind === 'vocab') coverage[level].vocab = true;
      if (question.item.kind === 'line') coverage[level].line = true;
      if (question.item.kind === 'grammar') coverage[level].grammar = true;
    }

    assert(coverage[level].vocab, `${level}: mix mode should be able to produce vocabulary questions`);
    assert(coverage[level].line, `${level}: mix mode should be able to produce line questions`);
    assert(coverage[level].grammar, `${level}: mix mode should be able to produce grammar questions`);
  }
}

function validateDailyStreakProgress() {
  const session = {
    mode: 'mix',
    score: 240,
    bestCombo: 3,
    correct: 2,
    total: 3,
    masteryHits: {},
  };

  const start = storage.createDefaultProgress();
  assert(start.dailyStreak.current === 0, 'Default daily streak should start at 0');
  assert(start.dailyStreak.best === 0, 'Default best daily streak should start at 0');

  const dayOne = storage.mergeSession(start, { ...session, dailyKey: '2026-06-15-N5' });
  assert(dayOne.dailyStreak.current === 1, 'First daily challenge should start the streak');
  assert(dayOne.dailyStreak.best === 1, 'First daily challenge should set best streak to 1');
  assert(dayOne.dailyStreak.lastDailyDate === '2026-06-15', 'Daily streak should store a date-only key');

  const sameDay = storage.mergeSession(dayOne, { ...session, dailyKey: '2026-06-15-N1' });
  assert(sameDay.dailyStreak.current === 1, 'Second daily challenge on the same date should not increase streak');
  assert(sameDay.dailyStreak.best === 1, 'Same-date daily challenge should not increase best streak');

  const practice = storage.mergeSession(sameDay, { ...session });
  assert(practice.dailyStreak.current === 1, 'Regular practice should not change the daily streak');

  const nextDay = storage.mergeSession(practice, { ...session, dailyKey: '2026-06-16-N5' });
  assert(nextDay.dailyStreak.current === 2, 'Next-day daily challenge should increase the streak');
  assert(nextDay.dailyStreak.best === 2, 'Next-day daily challenge should increase best streak');

  const gapDay = storage.mergeSession(nextDay, { ...session, dailyKey: '2026-06-18-N5' });
  assert(gapDay.dailyStreak.current === 1, 'Daily streak should reset after a missed day');
  assert(gapDay.dailyStreak.best === 2, 'Best streak should survive a missed day');

  const legacyProgress = { ...storage.createDefaultProgress(), dailyStreak: undefined };
  const migrated = storage.mergeSession(legacyProgress, { ...session, dailyKey: '2026-06-19-N5' });
  assert(migrated.dailyStreak.current === 1, 'Legacy progress without dailyStreak should migrate safely');
}

function validateDailyGoalProgress() {
  const session = {
    mode: 'mix',
    score: 240,
    bestCombo: 3,
    correct: 2,
    total: 3,
    masteryHits: {},
  };

  const start = storage.createDefaultProgress();
  assert(start.dailyGoal.runs === 0, 'Default daily goal should start at 0 runs');
  assert(start.dailyGoal.target === storage.DAILY_GOAL_TARGET, 'Default daily goal should use the exported target');
  assert(start.dailyGoal.completed === false, 'Default daily goal should not start completed');

  const firstRun = storage.mergeSession(start, { ...session, dailyGoalDate: '2026-06-15' });
  assert(firstRun.dailyGoal.date === '2026-06-15', 'Daily goal should store a date-only key');
  assert(firstRun.dailyGoal.runs === 1, 'First run should advance the daily goal');
  assert(firstRun.dailyGoal.completed === false, 'Daily goal should remain open before target');
  assert(firstRun.dailyStreak.current === 0, 'Regular runs should not change the daily challenge streak when counting the daily goal');

  const secondRun = storage.mergeSession(firstRun, { ...session, dailyGoalDate: '2026-06-15' });
  const thirdRun = storage.mergeSession(secondRun, { ...session, dailyGoalDate: '2026-06-15' });
  assert(thirdRun.dailyGoal.runs === storage.DAILY_GOAL_TARGET, 'Daily goal should count same-day runs up to the target');
  assert(thirdRun.dailyGoal.completed === true, 'Daily goal should complete at the target');

  const extraRun = storage.mergeSession(thirdRun, { ...session, dailyGoalDate: '2026-06-15' });
  assert(extraRun.dailyGoal.runs === storage.DAILY_GOAL_TARGET + 1, 'Daily goal should keep counting extra same-day runs');
  assert(extraRun.dailyGoal.completed === true, 'Daily goal should stay completed after extra same-day runs');

  const nextDay = storage.mergeSession(extraRun, { ...session, dailyGoalDate: '2026-06-16' });
  assert(nextDay.dailyGoal.date === '2026-06-16', 'Daily goal should roll to the next day');
  assert(nextDay.dailyGoal.runs === 1, 'Daily goal should reset run count on a new day');
  assert(nextDay.dailyGoal.completed === false, 'Daily goal should reopen on a new day');

  const legacyProgress = { ...storage.createDefaultProgress(), dailyGoal: undefined };
  const migrated = storage.mergeSession(legacyProgress, { ...session, dailyGoalDate: '2026-06-17' });
  assert(migrated.dailyGoal.runs === 1, 'Legacy progress without dailyGoal should migrate safely');
}

function validateGrammarProgressStorage() {
  const start = storage.createDefaultProgress();
  assert(Boolean(start.records.grammar), 'Default progress should include a grammar mode record');

  const grammarItem = gameData.GRAMMAR_ITEMS[0];
  assert(Boolean(grammarItem), 'Grammar progress fixture should exist');
  if (!grammarItem) return;

  const next = storage.mergeSession(start, {
    mode: 'grammar',
    score: 320,
    bestCombo: 4,
    correct: 3,
    total: 4,
    masteryHits: { [grammarItem.id]: 3 },
    mistakeHits: { [grammarItem.id]: 1 },
  });

  assert(next.records.grammar.runs === 1, 'Grammar sessions should update the grammar record');
  assert(next.records.grammar.bestScore === 320, 'Grammar sessions should preserve their best score');
  assert(next.mastery[grammarItem.id] === 3, 'Grammar answers should contribute to mastery');
  assert(!next.reviewQueue.includes(grammarItem.id), 'Three correct grammar hits should clear one stored mistake');

  for (const locale of locales) {
    for (const key of ['modeGrammar', 'modeGrammarLabel', 'promptChooseGrammar', 'levelGrammarShort']) {
      assert(Boolean(i18n.t(locale, key)), `${locale}: ${key} should be localized`);
    }
  }

  assert(appSource.includes('withCjkBreaks(visibleQuestionPrompt)'), 'Japanese question prompts should allow CJK line breaks on narrow screens');
  assert(appSource.includes("question.item.kind === 'grammar' && styles.grammarQuestionText"), 'Grammar prompts should use a compact long-sentence style');
  assert(/setIsLocked\(false\);\s+setFeedback\(null\);/.test(appSource), 'Moving to the next question should clear the previous answer feedback');
}

function validateSettingsModePersistence() {
  const validModes = ['mix', 'kana', 'vocab', 'lines', 'grammar'];
  const base = {
    isManualLocale: false,
    isBgmEnabled: false,
    bgmTrackId: 'rush',
    level: 'N5',
  };

  assert(storage.createDefaultSettings().mode === 'mix', 'Default settings should start in mix mode');
  assert(storage.normalizeSettings(base).mode === 'mix', 'Legacy settings without mode should migrate to mix');
  assert(storage.normalizeSettings({ ...base, mode: 'invalid' }).mode === 'mix', 'Unknown saved modes should migrate to mix');

  for (const mode of validModes) {
    assert(storage.normalizeSettings({ ...base, mode }).mode === mode, `${mode}: saved mode should survive settings normalization`);
  }

  assert(appSource.includes('setMode(settings.mode);'), 'Loaded settings should restore the selected game mode');
  assert(/saveSettings\(\{[\s\S]*?level,\s+mode,/.test(appSource), 'Saved settings should include the selected game mode');
  assert(appSource.includes('[bgmTrackId, isBgmEnabled, isManualLocale, level, locale, mode]'), 'Changing mode should trigger settings persistence');
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function loadTsModule(relativePath) {
  return loadTsFile(path.join(root, relativePath));
}

function loadTsFile(filePath) {
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
    if (request === '@react-native-async-storage/async-storage') {
      return {
        getItem: async () => null,
        setItem: async () => undefined,
      };
    }

    if (request === 'expo-localization') {
      return { getLocales: () => [{ languageCode: 'en', languageTag: 'en-US' }] };
    }

    if (request.startsWith('.')) {
      return loadTsFile(path.resolve(path.dirname(absolutePath), request));
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
