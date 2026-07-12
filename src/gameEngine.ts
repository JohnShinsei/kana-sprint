import { GRAMMAR_ITEMS, JlptLevel, KANA_ITEMS, LINE_ITEMS, StudyItem, VOCAB_ITEMS } from './gameData';
import { AppLocale, localize, t } from './i18n';

export const GAME_SECONDS = 60;
export const MAX_LIVES = 3;

export type GameMode = 'kana' | 'vocab' | 'lines' | 'grammar' | 'mix';

export type QuestionKind =
  | 'kanaToRomaji'
  | 'romajiToKana'
  | 'wordToMeaning'
  | 'meaningToWord'
  | 'kanaToMeaning'
  | 'meaningToKana'
  | 'listeningToMeaning'
  | 'grammarCloze';

export type GameQuestion = {
  id: string;
  itemId: string;
  kind: QuestionKind;
  item: StudyItem;
  prompt: string;
  promptMeta: string;
  answer: string;
  options: string[];
  accent: string;
};

const accents = ['#FFB23F', '#31C6A7', '#EF5D60', '#7A80FF', '#F15BB5', '#45B7D1'];

type LevelDifficultyProfile = {
  order: number;
  mixWeights: {
    kana: number;
    vocab: number;
    lines: number;
    grammar: number;
  };
  meaningToWordWeight: number;
  listeningWeight: number;
  topicDistractorBias: number;
  lengthDistractorBias: number;
};

export const LEVEL_DIFFICULTY_PROFILES: Record<JlptLevel, LevelDifficultyProfile> = {
  N5: {
    order: 1,
    mixWeights: { kana: 0.28, vocab: 0.34, lines: 0.18, grammar: 0.2 },
    meaningToWordWeight: 0.32,
    listeningWeight: 0.12,
    topicDistractorBias: 0,
    lengthDistractorBias: 0,
  },
  N4: {
    order: 2,
    mixWeights: { kana: 0, vocab: 0.46, lines: 0.26, grammar: 0.28 },
    meaningToWordWeight: 0.4,
    listeningWeight: 0.16,
    topicDistractorBias: 1,
    lengthDistractorBias: 0,
  },
  N3: {
    order: 3,
    mixWeights: { kana: 0, vocab: 0.4, lines: 0.29, grammar: 0.31 },
    meaningToWordWeight: 0.48,
    listeningWeight: 0.2,
    topicDistractorBias: 2,
    lengthDistractorBias: 0,
  },
  N2: {
    order: 4,
    mixWeights: { kana: 0, vocab: 0.34, lines: 0.32, grammar: 0.34 },
    meaningToWordWeight: 0.56,
    listeningWeight: 0.24,
    topicDistractorBias: 3,
    lengthDistractorBias: 1,
  },
  N1: {
    order: 5,
    mixWeights: { kana: 0, vocab: 0.28, lines: 0.35, grammar: 0.37 },
    meaningToWordWeight: 0.64,
    listeningWeight: 0.28,
    topicDistractorBias: 4,
    lengthDistractorBias: 2,
  },
};

const CHINESE_LISTENING_BOOST = 0.08;
const CHINESE_REVERSE_RECALL_BOOST = 0.16;

export function getStudyQuestionWeights(level: JlptLevel, locale: AppLocale) {
  const profile = LEVEL_DIFFICULTY_PROFILES[level];
  const isChineseLocale = locale === 'zh-Hans' || locale === 'zh-Hant';

  return {
    listeningWeight: Math.min(0.48, profile.listeningWeight + (isChineseLocale ? CHINESE_LISTENING_BOOST : 0)),
    reverseRecallWeight: Math.min(0.9, profile.meaningToWordWeight + (isChineseLocale ? CHINESE_REVERSE_RECALL_BOOST : 0)),
  };
}

export function getDailyKey(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function makeQuestion(
  mode: GameMode,
  questionIndex: number,
  recentIds: string[],
  locale: AppLocale,
  level: JlptLevel,
  dailyKey?: string,
): GameQuestion {
  const random = dailyKey ? createRandom(hashText(`${dailyKey}:${mode}:${level}:${questionIndex}`)) : Math.random;
  const pool = getPool(mode, level, random);
  const available = pool.filter((item) => !recentIds.includes(item.id));
  const item = pick(available.length >= 8 ? available : pool, random);
  const kind = pickQuestionKind(item, level, locale, random);
  const answer = getAnswer(item, kind, locale);
  const options = makeQuestionOptions(item, kind, answer, locale, level, random);
  const accent = accents[Math.floor(random() * accents.length)] ?? accents[0];

  return {
    id: `${item.id}-${kind}-${questionIndex}`,
    itemId: item.id,
    kind,
    item,
    prompt: getPrompt(item, kind, locale),
    promptMeta: getPromptMeta(item, kind, locale),
    answer,
    options,
    accent,
  };
}

export function makeQuestionFromItems(
  items: StudyItem[],
  questionIndex: number,
  recentIds: string[],
  locale: AppLocale,
  level: JlptLevel,
): GameQuestion {
  const pool = items.length > 0 ? items : getPool('mix', level, Math.random);
  const available = pool.filter((item) => !recentIds.includes(item.id));
  const item = pick(available.length > 0 ? available : pool, Math.random);
  const kind = pickQuestionKind(item, item.level, locale, Math.random);
  const answer = getAnswer(item, kind, locale);
  const options = makeQuestionOptions(item, kind, answer, locale, item.level, Math.random);
  const accent = accents[Math.floor(Math.random() * accents.length)] ?? accents[0];

  return {
    id: `review-${item.id}-${kind}-${questionIndex}`,
    itemId: item.id,
    kind,
    item,
    prompt: getPrompt(item, kind, locale),
    promptMeta: getPromptMeta(item, kind, locale),
    answer,
    options,
    accent,
  };
}

export function scoreForAnswer(combo: number, timeLeft: number) {
  const comboBonus = Math.min(combo, 14) * 8;
  const speedBonus = timeLeft >= 45 ? 14 : timeLeft >= 25 ? 8 : 4;
  return 100 + comboBonus + speedBonus;
}

export function getAnswerRevealDelayMs(item: StudyItem, isCorrect: boolean) {
  const levelBoost = (LEVEL_DIFFICULTY_PROFILES[item.level].order - 1) * (isCorrect ? 50 : 100);
  const kindBoost = item.kind === 'line'
    ? isCorrect ? 500 : 900
    : item.kind === 'grammar'
      ? isCorrect ? 450 : 800
    : item.kind === 'vocab'
      ? isCorrect ? 200 : 350
      : 0;

  return (isCorrect ? 700 : 1450) + levelBoost + kindBoost;
}

export function getMasteryCount(mastery: Record<string, number>) {
  return Object.values(mastery).filter((count) => count >= 3).length;
}

function getPool(mode: GameMode, level: JlptLevel, random: () => number) {
  if (mode === 'kana') return KANA_ITEMS;
  if (mode === 'vocab') return byLevel(VOCAB_ITEMS, level);
  if (mode === 'lines') return byLevel(LINE_ITEMS, level);
  if (mode === 'grammar') return byLevel(GRAMMAR_ITEMS, level);

  const profile = LEVEL_DIFFICULTY_PROFILES[level];
  const roll = random();

  if (roll < profile.mixWeights.kana) return KANA_ITEMS;
  if (roll < profile.mixWeights.kana + profile.mixWeights.vocab) return byLevel(VOCAB_ITEMS, level);
  if (roll < profile.mixWeights.kana + profile.mixWeights.vocab + profile.mixWeights.lines) {
    return byLevel(LINE_ITEMS, level);
  }
  return byLevel(GRAMMAR_ITEMS, level);
}

function pickQuestionKind(item: StudyItem, level: JlptLevel, locale: AppLocale, random: () => number): QuestionKind {
  if (item.kind === 'grammar') return 'grammarCloze';

  if (item.kind === 'vocab' || item.kind === 'line') {
    const weights = getStudyQuestionWeights(level, locale);

    if (random() < weights.listeningWeight) {
      return 'listeningToMeaning';
    }

    const reverseRecall = random() < weights.reverseRecallWeight;

    if (locale === 'zh-Hans' || locale === 'zh-Hant') {
      return reverseRecall ? 'meaningToKana' : 'kanaToMeaning';
    }

    return reverseRecall ? 'meaningToWord' : 'wordToMeaning';
  }

  return random() < 0.62 ? 'kanaToRomaji' : 'romajiToKana';
}

function getPrompt(item: StudyItem, kind: QuestionKind, locale: AppLocale) {
  if (kind === 'grammarCloze') return item.display;
  if (kind === 'listeningToMeaning') return t(locale, 'listeningCue');
  if (kind === 'romajiToKana') return item.romaji;
  if (kind === 'meaningToWord' || kind === 'meaningToKana') return localize(item.meaning, locale);
  if (kind === 'kanaToMeaning') return item.kana;
  return item.display;
}

function getPromptMeta(item: StudyItem, kind: QuestionKind, locale: AppLocale) {
  if (kind === 'grammarCloze') return `${localize(item.topic, locale)} / ${t(locale, 'promptChooseGrammar')}`;
  if (kind === 'listeningToMeaning') return `${localize(item.topic, locale)} / ${t(locale, 'promptListen')}`;
  if (kind === 'kanaToRomaji') return `${localize(item.topic, locale)} / ${t(locale, 'promptReading')}`;
  if (kind === 'romajiToKana') return t(locale, 'promptFindKana');
  if (kind === 'wordToMeaning') return `${item.kana} / ${item.romaji}`;
  if (kind === 'kanaToMeaning') return `${localize(item.topic, locale)} / ${t(locale, 'promptFindMeaning')}`;
  if (kind === 'meaningToKana') return `${localize(item.topic, locale)} / ${t(locale, 'promptFindKana')}`;
  return `${localize(item.topic, locale)} / ${t(locale, 'promptFindJapanese')}`;
}

function getAnswer(item: StudyItem, kind: QuestionKind, locale: AppLocale) {
  if (kind === 'grammarCloze') return item.grammar?.answer ?? item.romaji;
  if (kind === 'kanaToRomaji') return item.romaji;
  if (kind === 'romajiToKana') return item.display;
  if (kind === 'wordToMeaning' || kind === 'kanaToMeaning' || kind === 'listeningToMeaning') return localize(item.meaning, locale);
  if (kind === 'meaningToKana') return item.kana;
  return item.display;
}

function makeQuestionOptions(
  item: StudyItem,
  kind: QuestionKind,
  answer: string,
  locale: AppLocale,
  level: JlptLevel,
  random: () => number,
) {
  if (kind === 'grammarCloze' && item.grammar) {
    return shuffle(item.grammar.options, random);
  }

  const optionPool = getOptionPool(kind, item, level);
  return makeOptions(answer, optionPool, (candidate) => getAnswer(candidate, kind, locale), item, level, random);
}

function getOptionPool(kind: QuestionKind, item: StudyItem, level: JlptLevel) {
  if (
    kind === 'wordToMeaning' ||
    kind === 'meaningToWord' ||
    kind === 'kanaToMeaning' ||
    kind === 'meaningToKana' ||
    kind === 'listeningToMeaning' ||
    kind === 'grammarCloze'
  ) {
    if (item.kind === 'grammar') return byLevel(GRAMMAR_ITEMS, item.level);
    if (item.kind === 'line') return byLevel(LINE_ITEMS, item.level);
    if (item.kind === 'vocab') return byLevel(VOCAB_ITEMS, item.level);
    return byLevel(VOCAB_ITEMS, level);
  }

  return KANA_ITEMS;
}

function byLevel(items: StudyItem[], level: JlptLevel) {
  const filtered = items.filter((item) => item.level === level);
  return filtered.length >= 4 ? filtered : items;
}

function makeOptions(
  answer: string,
  pool: StudyItem[],
  getValue: (item: StudyItem) => string,
  item: StudyItem,
  level: JlptLevel,
  random: () => number,
) {
  const seen = new Set([answer]);
  const candidates = shuffle(
    pool
      .map((candidate) => ({
        value: getValue(candidate),
        priority: getDistractorPriority(item, candidate, level),
      }))
      .filter((candidate) => candidate.value !== answer),
    random,
  ).sort((left, right) => right.priority - left.priority);
  const distractors: string[] = [];

  for (const candidate of candidates) {
    if (!seen.has(candidate.value)) {
      distractors.push(candidate.value);
      seen.add(candidate.value);
    }

    if (distractors.length === 3) break;
  }

  return shuffle([answer, ...distractors], random);
}

function getDistractorPriority(item: StudyItem, candidate: StudyItem, level: JlptLevel) {
  const profile = LEVEL_DIFFICULTY_PROFILES[level];
  let priority = 0;

  if (candidate.level === item.level) priority += 4;
  if (candidate.kind === item.kind) priority += 3;
  if (candidate.topic.en === item.topic.en) priority += profile.topicDistractorBias;
  if (Math.abs(candidate.display.length - item.display.length) <= 2) priority += profile.lengthDistractorBias;

  return priority;
}

function pick<T>(items: T[], random: () => number) {
  return items[Math.floor(random() * items.length)] ?? items[0];
}

function shuffle<T>(items: T[], random: () => number) {
  const result = [...items];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }

  return result;
}

function hashText(text: string) {
  let hash = 2166136261;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function createRandom(seed: number) {
  let value = seed;

  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}
