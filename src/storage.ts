import AsyncStorage from '@react-native-async-storage/async-storage';

import { BgmTrackId } from './bgm';
import { JlptLevel } from './gameData';
import { GameMode } from './gameEngine';
import { AppLocale } from './i18n';

const STORAGE_KEY = '@kana-sprint/progress-v1';
const SETTINGS_STORAGE_KEY = '@kana-sprint/settings-v1';
export const DAILY_GOAL_TARGET = 3;

export type ModeRecord = {
  bestScore: number;
  bestCombo: number;
  runs: number;
  correct: number;
  total: number;
  dailyBest: Record<string, number>;
};

export type DailyStreak = {
  current: number;
  best: number;
  lastDailyDate?: string;
};

export type DailyGoal = {
  date?: string;
  runs: number;
  target: number;
  completed: boolean;
};

export type GameProgress = {
  records: Record<GameMode, ModeRecord>;
  mastery: Record<string, number>;
  mistakes: Record<string, number>;
  reviewQueue: string[];
  dailyStreak: DailyStreak;
  dailyGoal: DailyGoal;
  totalSessions: number;
  updatedAt?: string;
};

export type AppSettings = {
  locale?: AppLocale;
  isManualLocale: boolean;
  isBgmEnabled: boolean;
  bgmTrackId: BgmTrackId;
  level: JlptLevel;
  mode: GameMode;
};

export type SessionResult = {
  mode: GameMode;
  score: number;
  bestCombo: number;
  correct: number;
  total: number;
  dailyKey?: string;
  dailyGoalDate?: string;
  masteryHits: Record<string, number>;
  mistakeHits?: Record<string, number>;
};

export function createDefaultProgress(): GameProgress {
  return {
    records: {
      kana: createEmptyRecord(),
      vocab: createEmptyRecord(),
      lines: createEmptyRecord(),
      grammar: createEmptyRecord(),
      mix: createEmptyRecord(),
    },
    mastery: {},
    mistakes: {},
    reviewQueue: [],
    dailyStreak: createEmptyDailyStreak(),
    dailyGoal: createEmptyDailyGoal(),
    totalSessions: 0,
  };
}

export function createDefaultSettings(): AppSettings {
  return {
    isManualLocale: false,
    isBgmEnabled: false,
    bgmTrackId: 'rush',
    level: 'N5',
    mode: 'mix',
  };
}

export async function loadProgress() {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return createDefaultProgress();
  }

  try {
    return normalizeProgress(JSON.parse(raw));
  } catch {
    return createDefaultProgress();
  }
}

export async function saveProgress(progress: GameProgress) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

export async function loadSettings() {
  const raw = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);

  if (!raw) {
    return createDefaultSettings();
  }

  try {
    return normalizeSettings(JSON.parse(raw));
  } catch {
    return createDefaultSettings();
  }
}

export async function saveSettings(settings: AppSettings) {
  await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

export function mergeSession(progress: GameProgress, result: SessionResult): GameProgress {
  const currentRecord = progress.records[result.mode] ?? createEmptyRecord();
  const dailyBest = { ...currentRecord.dailyBest };
  const dailyStreak = result.dailyKey
    ? mergeDailyStreak(progress.dailyStreak, result.dailyKey)
    : normalizeDailyStreak(progress.dailyStreak);
  const dailyGoal = result.dailyGoalDate
    ? mergeDailyGoal(progress.dailyGoal, result.dailyGoalDate)
    : normalizeDailyGoal(progress.dailyGoal);

  if (result.dailyKey) {
    dailyBest[result.dailyKey] = Math.max(dailyBest[result.dailyKey] ?? 0, result.score);
  }

  const mastery = { ...progress.mastery };
  const mistakes = normalizeMistakes(progress.mistakes);
  const reviewQueue = Array.isArray(progress.reviewQueue) ? [...progress.reviewQueue] : [];

  for (const [itemId, hits] of Object.entries(result.mistakeHits ?? {})) {
    if (hits <= 0) continue;
    mistakes[itemId] = (mistakes[itemId] ?? 0) + hits;
    moveToReviewFront(reviewQueue, itemId);
  }

  for (const [itemId, hits] of Object.entries(result.masteryHits)) {
    mastery[itemId] = (mastery[itemId] ?? 0) + hits;

    if (mistakes[itemId]) {
      mistakes[itemId] = Math.max(0, mistakes[itemId] - hits);
      if (mistakes[itemId] === 0) delete mistakes[itemId];
    }
  }

  return {
    ...progress,
    records: {
      ...progress.records,
      [result.mode]: {
        bestScore: Math.max(currentRecord.bestScore, result.score),
        bestCombo: Math.max(currentRecord.bestCombo, result.bestCombo),
        runs: currentRecord.runs + 1,
        correct: currentRecord.correct + result.correct,
        total: currentRecord.total + result.total,
        dailyBest,
      },
    },
    mastery,
    mistakes,
    reviewQueue: reviewQueue.filter((itemId) => (mistakes[itemId] ?? 0) > 0).slice(0, 40),
    dailyStreak,
    dailyGoal,
    totalSessions: progress.totalSessions + 1,
    updatedAt: new Date().toISOString(),
  };
}

function createEmptyRecord(): ModeRecord {
  return {
    bestScore: 0,
    bestCombo: 0,
    runs: 0,
    correct: 0,
    total: 0,
    dailyBest: {},
  };
}

function createEmptyDailyStreak(): DailyStreak {
  return {
    current: 0,
    best: 0,
  };
}

function createEmptyDailyGoal(): DailyGoal {
  return {
    runs: 0,
    target: DAILY_GOAL_TARGET,
    completed: false,
  };
}

function normalizeProgress(value: Partial<GameProgress>): GameProgress {
  const fallback = createDefaultProgress();
  const source = value && typeof value === 'object' ? value : {};

  return {
    records: {
      kana: normalizeRecord(source.records?.kana),
      vocab: normalizeRecord(source.records?.vocab),
      lines: normalizeRecord(source.records?.lines),
      grammar: normalizeRecord(source.records?.grammar),
      mix: normalizeRecord(source.records?.mix),
    },
    mastery: normalizeCountRecord(source.mastery, fallback.mastery),
    mistakes: normalizeMistakes(source.mistakes),
    reviewQueue: normalizeReviewQueue(source.reviewQueue, source.mistakes),
    dailyStreak: normalizeDailyStreak(source.dailyStreak),
    dailyGoal: normalizeDailyGoal(source.dailyGoal),
    totalSessions: typeof source.totalSessions === 'number' ? source.totalSessions : fallback.totalSessions,
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : undefined,
  };
}

function normalizeRecord(value?: Partial<ModeRecord>) {
  const fallback = createEmptyRecord();

  return {
    bestScore: typeof value?.bestScore === 'number' ? value.bestScore : fallback.bestScore,
    bestCombo: typeof value?.bestCombo === 'number' ? value.bestCombo : fallback.bestCombo,
    runs: typeof value?.runs === 'number' ? value.runs : fallback.runs,
    correct: typeof value?.correct === 'number' ? value.correct : fallback.correct,
    total: typeof value?.total === 'number' ? value.total : fallback.total,
    dailyBest: value?.dailyBest && typeof value.dailyBest === 'object' ? value.dailyBest : fallback.dailyBest,
  };
}

function normalizeDailyStreak(value?: Partial<DailyStreak>) {
  const fallback = createEmptyDailyStreak();
  const current = Math.max(0, Math.floor(typeof value?.current === 'number' ? value.current : fallback.current));
  const bestValue = Math.max(0, Math.floor(typeof value?.best === 'number' ? value.best : fallback.best));
  const lastDailyDate = isDailyDateKey(value?.lastDailyDate) ? value?.lastDailyDate : undefined;

  return {
    current,
    best: Math.max(bestValue, current),
    lastDailyDate,
  };
}

function normalizeDailyGoal(value?: Partial<DailyGoal>) {
  const fallback = createEmptyDailyGoal();
  const runs = Math.max(0, Math.floor(typeof value?.runs === 'number' ? value.runs : fallback.runs));
  const target = Math.max(1, Math.floor(typeof value?.target === 'number' ? value.target : fallback.target));
  const date = isDailyDateKey(value?.date) ? value?.date : undefined;

  return {
    date,
    runs,
    target,
    completed: typeof value?.completed === 'boolean' ? value.completed || runs >= target : runs >= target,
  };
}

function normalizeCountRecord(value: unknown, fallback: Record<string, number> = {}) {
  if (!value || typeof value !== 'object') return fallback;

  const result: Record<string, number> = {};
  for (const [key, count] of Object.entries(value)) {
    const nextCount = Math.max(0, Math.floor(typeof count === 'number' ? count : 0));
    if (nextCount > 0) result[key] = nextCount;
  }
  return result;
}

function normalizeMistakes(value: unknown) {
  return normalizeCountRecord(value);
}

function normalizeReviewQueue(value: unknown, mistakeSource: unknown) {
  const mistakes = normalizeMistakes(mistakeSource);
  const rawQueue = Array.isArray(value) ? value.filter((itemId): itemId is string => typeof itemId === 'string') : [];
  const missingMistakeIds = Object.keys(mistakes).filter((itemId) => !rawQueue.includes(itemId));

  return [...rawQueue, ...missingMistakeIds]
    .filter((itemId, index, items) => items.indexOf(itemId) === index && (mistakes[itemId] ?? 0) > 0)
    .slice(0, 40);
}

function moveToReviewFront(queue: string[], itemId: string) {
  const currentIndex = queue.indexOf(itemId);
  if (currentIndex >= 0) queue.splice(currentIndex, 1);
  queue.unshift(itemId);
}

function mergeDailyStreak(value: DailyStreak | undefined, dailyKey: string) {
  const current = normalizeDailyStreak(value);
  const dailyDate = dailyDateFromKey(dailyKey);

  if (!dailyDate || dailyDate === current.lastDailyDate) {
    return current;
  }

  const previousDay = dayNumber(current.lastDailyDate);
  const nextDay = dayNumber(dailyDate);

  if (previousDay !== undefined && nextDay !== undefined && nextDay <= previousDay) {
    return current;
  }

  const nextCurrent = previousDay !== undefined && nextDay !== undefined && nextDay - previousDay === 1
    ? current.current + 1
    : 1;

  return {
    current: nextCurrent,
    best: Math.max(current.best, nextCurrent),
    lastDailyDate: dailyDate,
  };
}

function mergeDailyGoal(value: DailyGoal | undefined, dailyGoalDate: string) {
  const current = normalizeDailyGoal(value);
  const dailyDate = isDailyDateKey(dailyGoalDate) ? dailyGoalDate : dailyDateFromKey(dailyGoalDate);

  if (!dailyDate) {
    return current;
  }

  const target = current.date === dailyDate ? current.target : DAILY_GOAL_TARGET;
  const runs = (current.date === dailyDate ? current.runs : 0) + 1;

  return {
    date: dailyDate,
    runs,
    target,
    completed: runs >= target,
  };
}

function dailyDateFromKey(dailyKey: string) {
  const candidate = dailyKey.slice(0, 10);
  return isDailyDateKey(candidate) ? candidate : undefined;
}

function isDailyDateKey(value?: string): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function dayNumber(value?: string) {
  if (!isDailyDateKey(value)) return undefined;
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return Number.isNaN(parsed) ? undefined : Math.floor(parsed / 86400000);
}

export function normalizeSettings(value: Partial<AppSettings>): AppSettings {
  const fallback = createDefaultSettings();
  const validLocales: AppLocale[] = ['zh-Hans', 'zh-Hant', 'en', 'fr', 'it', 'de', 'es-ES', 'ko', 'pl', 'pt-BR'];
  const migratedTracks: Record<string, BgmTrackId> = {
    ode: 'rush',
    sakura: 'focus',
    moonlight: 'night',
  };
  const validTracks: BgmTrackId[] = ['rush', 'focus', 'night'];
  const validLevels: JlptLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1'];
  const validModes: GameMode[] = ['mix', 'kana', 'vocab', 'lines', 'grammar'];
  const locale = validLocales.includes(value.locale as AppLocale) ? value.locale : undefined;
  const bgmTrackId = value.bgmTrackId && migratedTracks[value.bgmTrackId]
    ? migratedTracks[value.bgmTrackId]
    : value.bgmTrackId;

  return {
    locale,
    isManualLocale: typeof value.isManualLocale === 'boolean' ? value.isManualLocale : fallback.isManualLocale,
    isBgmEnabled: typeof value.isBgmEnabled === 'boolean' ? value.isBgmEnabled : fallback.isBgmEnabled,
    bgmTrackId: validTracks.includes(bgmTrackId as BgmTrackId) ? bgmTrackId as BgmTrackId : fallback.bgmTrackId,
    level: validLevels.includes(value.level as JlptLevel) ? value.level as JlptLevel : fallback.level,
    mode: validModes.includes(value.mode as GameMode) ? value.mode as GameMode : fallback.mode,
  };
}
