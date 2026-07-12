import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  hasLiveAdConfig,
  isAdPrivacyOptionsRequired,
  openAdPrivacyOptions,
  prepareRewardedAds,
  shouldGrantDevelopmentReward,
  showRewardedContinueAd,
} from './src/ads';
import { BGM_TRACKS, BgmTrackId } from './src/bgm';
import { ALL_ITEMS, JLPT_LEVELS, JlptLevel, StudyItem, getLevelStudyStats } from './src/gameData';
import {
  GAME_SECONDS,
  GameMode,
  GameQuestion,
  MAX_LIVES,
  getDailyKey,
  getAnswerRevealDelayMs,
  getMasteryCount,
  makeQuestion,
  makeQuestionFromItems,
  scoreForAnswer,
} from './src/gameEngine';
import { AppLocale, LOCALE_OPTIONS, detectLocale, feedbackFor, localize, t } from './src/i18n';
import {
  DAILY_GOAL_TARGET,
  GameProgress,
  createDefaultProgress,
  loadProgress,
  loadSettings,
  mergeSession,
  saveProgress,
  saveSettings,
} from './src/storage';

type Phase = 'ready' | 'playing' | 'finished';

type Feedback = {
  tone: 'good' | 'bad';
  text: string;
};

type SessionGoalKind = 'score' | 'combo' | 'accuracy';

type SessionGoal = {
  kind: SessionGoalKind;
  target: number;
};

type AnswerStudyHint = {
  answer: string;
  detail: string;
};

type LevelMasteryRow = {
  level: JlptLevel;
  mastered: number;
  total: number;
  percent: number;
  color: string;
};

type NextStepAction = 'review' | 'practice' | 'advance' | 'daily';

type NextStepAdvice = {
  title: string;
  body: string;
  actionLabel: string;
  action: NextStepAction;
  nextLevel?: JlptLevel;
};

type AchievementBadge = {
  id: string;
  title: string;
  progress: string;
  unlocked: boolean;
};

type SettingsNoticeKey =
  | 'adPrivacyOpened'
  | 'adPrivacyUnavailable'
  | 'progressResetArmed'
  | 'progressResetDone';
type LocalCompliancePanel = 'support' | 'privacy' | 'openSource';

const initialLocale = detectLocale();
const initialLevel: JlptLevel = 'N5';

void SystemUI.setBackgroundColorAsync('#10151F');

const levelAccentColors: Record<JlptLevel, string> = {
  N5: '#31C6A7',
  N4: '#FFB23F',
  N3: '#45B7D1',
  N2: '#7A80FF',
  N1: '#EF5D60',
};

const missionScoreTargets: Record<JlptLevel, number> = {
  N5: 900,
  N4: 1050,
  N3: 1200,
  N2: 1350,
  N1: 1500,
};

const missionComboTargets: Record<JlptLevel, number> = {
  N5: 6,
  N4: 7,
  N3: 8,
  N2: 9,
  N1: 10,
};

const missionAccuracyTargets: Record<JlptLevel, number> = {
  N5: 70,
  N4: 74,
  N3: 78,
  N2: 82,
  N1: 86,
};

const modeMissionOffsets: Record<GameMode, number> = {
  mix: 0,
  kana: 1,
  vocab: 2,
  lines: 3,
  grammar: 4,
};

type StoreUrls = {
  supportUrl?: string;
  privacyPolicyUrl?: string;
  openSourceNoticesUrl?: string;
  localized?: Partial<Record<AppLocale, {
    supportUrl?: string;
    privacyPolicyUrl?: string;
    openSourceNoticesUrl?: string;
  }>>;
};

const storeUrls = (Constants.expoConfig?.extra?.storeUrls ?? {}) as StoreUrls;

export default function App() {
  const [locale, setLocale] = useState<AppLocale>(initialLocale);
  const [isManualLocale, setIsManualLocale] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isBgmEnabled, setIsBgmEnabled] = useState(false);
  const [hasAudioGesture, setHasAudioGesture] = useState(Platform.OS !== 'web');
  const [isAdPrivacyOptionsVisible, setIsAdPrivacyOptionsVisible] = useState(false);
  const [bgmTrackId, setBgmTrackId] = useState<BgmTrackId>('rush');
  const [phase, setPhase] = useState<Phase>('ready');
  const [mode, setMode] = useState<GameMode>('mix');
  const [level, setLevel] = useState<JlptLevel>(initialLevel);
  const [progress, setProgress] = useState<GameProgress>(() => createDefaultProgress());
  const [question, setQuestion] = useState<GameQuestion>(() => makeQuestion('mix', 0, [], initialLocale, initialLevel));
  const [questionIndex, setQuestionIndex] = useState(0);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [timeLeft, setTimeLeft] = useState(GAME_SECONDS);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [lives, setLives] = useState(MAX_LIVES);
  const [correctCount, setCorrectCount] = useState(0);
  const [totalAnswers, setTotalAnswers] = useState(0);
  const [dailyKey, setDailyKey] = useState<string | undefined>();
  const [isWeakReview, setIsWeakReview] = useState(false);
  const [sessionMastery, setSessionMastery] = useState<Record<string, number>>({});
  const [sessionMistakes, setSessionMistakes] = useState<Record<string, number>>({});
  const [sessionGoal, setSessionGoal] = useState<SessionGoal>(() => createSessionGoal('mix', initialLevel, false, false));
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [settingsNoticeKey, setSettingsNoticeKey] = useState<SettingsNoticeKey | null>(null);
  const [isResetProgressArmed, setIsResetProgressArmed] = useState(false);
  const [localCompliancePanel, setLocalCompliancePanel] = useState<LocalCompliancePanel | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [isStorageReady, setIsStorageReady] = useState(false);
  const [adRewardUsed, setAdRewardUsed] = useState(false);
  const [isAwaitingContinue, setIsAwaitingContinue] = useState(false);
  const [isAdLoading, setIsAdLoading] = useState(false);
  const [isPronunciationPlaying, setIsPronunciationPlaying] = useState(false);
  const answerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishSavedRef = useRef(false);
  const settingsLoadedRef = useRef(false);
  const speechRunRef = useRef(0);
  const bgmPlayer = useAudioPlayer(null, { updateInterval: 1000 });
  const isPronunciationAvailable = Platform.OS !== 'web' || typeof (globalThis as { speechSynthesis?: unknown }).speechSynthesis !== 'undefined';

  const record = progress.records[mode];
  const todayDateKey = getDailyKey();
  const todayLevelKey = `${todayDateKey}-${level}`;
  const selectedBgmTrack = useMemo(
    () => BGM_TRACKS.find((track) => track.id === bgmTrackId) ?? BGM_TRACKS[0],
    [bgmTrackId],
  );
  const playBgmTrack = useCallback((trackId: BgmTrackId) => {
    const track = BGM_TRACKS.find((candidate) => candidate.id === trackId) ?? BGM_TRACKS[0];

    bgmPlayer.replace(track.source);
    bgmPlayer.loop = true;
    bgmPlayer.volume = 0.18;

    if (Platform.OS === 'web') {
      return;
    }

    try {
      const playResult = bgmPlayer.play() as unknown;
      const maybePromise = playResult as { catch?: (handler: () => void) => void };

      if (typeof maybePromise?.catch === 'function') {
        maybePromise.catch(() => bgmPlayer.pause());
      }
    } catch {
      bgmPlayer.pause();
    }
  }, [bgmPlayer]);
  const stopPronunciation = useCallback(() => {
    speechRunRef.current += 1;
    setIsPronunciationPlaying(false);
    void Speech.stop();
  }, []);
  const playPronunciation = useCallback(() => {
    if (isPronunciationAvailable === false) {
      setFeedback({ tone: 'bad', text: t(locale, 'pronunciationUnavailable') });
      return;
    }

    const utterance = question.item.kana || question.item.display;
    const runId = speechRunRef.current + 1;
    speechRunRef.current = runId;
    setIsPronunciationPlaying(true);

    void Speech.stop()
      .then(() => {
        if (speechRunRef.current !== runId) return;

        const finish = () => {
          if (speechRunRef.current === runId) setIsPronunciationPlaying(false);
        };

        Speech.speak(utterance, {
          language: 'ja-JP',
          pitch: 1,
          rate: question.item.kind === 'line' ? 0.78 : question.item.kind === 'vocab' ? 0.86 : 0.9,
          useApplicationAudioSession: false,
          onDone: finish,
          onStopped: finish,
          onError: finish,
        });
      })
      .catch(() => {
        if (speechRunRef.current === runId) setIsPronunciationPlaying(false);
      });
  }, [isPronunciationAvailable, locale, question.item.display, question.item.kana, question.item.kind]);
  const todaysBest = dailyKey ? record.dailyBest[dailyKey] ?? 0 : record.dailyBest[todayLevelKey] ?? 0;
  const accuracy = totalAnswers === 0 ? 0 : Math.round((correctCount / totalAnswers) * 100);
  const masteredCount = getMasteryCount(progress.mastery);
  const dailyStreakCount = progress.dailyStreak.current;
  const dailyGoalRuns = progress.dailyGoal.date === todayDateKey ? progress.dailyGoal.runs : 0;
  const dailyGoalTarget = progress.dailyGoal.date === todayDateKey ? progress.dailyGoal.target : DAILY_GOAL_TARGET;
  const dailyGoalProgress = Math.min(dailyGoalRuns, dailyGoalTarget);
  const dailyGoalPercent = Math.min(100, Math.round((dailyGoalProgress / dailyGoalTarget) * 100));
  const isDailyGoalComplete = dailyGoalRuns >= dailyGoalTarget;
  const timerPercent = Math.max(0, Math.min(100, (timeLeft / GAME_SECONDS) * 100));
  const readyGoal = useMemo(() => createSessionGoal(mode, level, false, false), [level, mode]);
  const sessionGoalComplete = isSessionGoalComplete(sessionGoal, score, bestCombo, correctCount, totalAnswers);
  const sessionGoalProgress = sessionGoalProgressText(sessionGoal, score, bestCombo, correctCount, totalAnswers);
  const answerStudyHint = isLocked ? getAnswerStudyHint(question, locale) : null;
  const visibleQuestionPrompt = question.kind === 'listeningToMeaning'
    ? isLocked
      ? question.item.display
      : isPronunciationAvailable === false
        ? question.item.kana
        : question.prompt
    : question.prompt;
  const visibleQuestionMeta = question.kind === 'listeningToMeaning' && isPronunciationAvailable === false
    ? `${localize(question.item.topic, locale)} / ${t(locale, 'promptFindMeaning')}`
    : question.promptMeta;
  const activeSupportUrl = storeUrls.localized?.[locale]?.supportUrl ?? storeUrls.supportUrl;
  const activePrivacyPolicyUrl = storeUrls.localized?.[locale]?.privacyPolicyUrl ?? storeUrls.privacyPolicyUrl;
  const activeOpenSourceNoticesUrl = storeUrls.localized?.[locale]?.openSourceNoticesUrl ?? storeUrls.openSourceNoticesUrl;
  const hasSupportLinks = Boolean(activeSupportUrl || activePrivacyPolicyUrl || activeOpenSourceNoticesUrl);
  const hasAdPrivacyOptionsEntry = hasLiveAdConfig() && isAdPrivacyOptionsVisible;
  const canOfferAdContinue = hasLiveAdConfig() || shouldGrantDevelopmentReward();
  const isProgressResetNotice = settingsNoticeKey === 'progressResetArmed' || settingsNoticeKey === 'progressResetDone';
  const isAdPrivacyNotice = settingsNoticeKey === 'adPrivacyOpened' || settingsNoticeKey === 'adPrivacyUnavailable';
  const progressResetNotice = isProgressResetNotice && settingsNoticeKey ? t(locale, settingsNoticeKey) : null;
  const adPrivacyNotice = isAdPrivacyNotice && settingsNoticeKey ? t(locale, settingsNoticeKey) : null;

  const modeChoices = useMemo(
    () => [
      { mode: 'mix' as const, title: t(locale, 'modeMix'), label: t(locale, 'modeMixLabel') },
      { mode: 'kana' as const, title: t(locale, 'modeKana'), label: t(locale, 'modeKanaLabel') },
      { mode: 'vocab' as const, title: t(locale, 'modeVocab'), label: t(locale, 'modeVocabLabel') },
      { mode: 'lines' as const, title: t(locale, 'modeLines'), label: t(locale, 'modeLinesLabel') },
      { mode: 'grammar' as const, title: t(locale, 'modeGrammar'), label: t(locale, 'modeGrammarLabel') },
    ],
    [locale],
  );

  const levelChoices = useMemo(
    () => JLPT_LEVELS.map((nextLevel) => {
      const stats = getLevelStudyStats(nextLevel);
      const statParts = [
        stats.kana > 0 ? `${stats.kana} ${t(locale, 'levelKanaShort')}` : null,
        `${stats.vocab} ${t(locale, 'levelWordsShort')}`,
        `${stats.lines} ${t(locale, 'levelLinesShort')}`,
        `${stats.grammar} ${t(locale, 'levelGrammarShort')}`,
      ].filter(Boolean);

      return {
        level: nextLevel,
        label: levelLabel(nextLevel, locale),
        stats: statParts.join(' / '),
      };
    }),
    [locale],
  );
  const levelMasteryRows = useMemo<LevelMasteryRow[]>(
    () => JLPT_LEVELS.map((nextLevel) => {
      const levelItems = ALL_ITEMS.filter((item) => item.level === nextLevel);
      const mastered = levelItems.filter((item) => (progress.mastery[item.id] ?? 0) >= 3).length;
      const total = levelItems.length;

      return {
        level: nextLevel,
        mastered,
        total,
        percent: total > 0 ? Math.round((mastered / total) * 100) : 0,
        color: levelAccentColors[nextLevel],
      };
    }),
    [progress.mastery],
  );
  const weakReviewItems = useMemo(() => {
    const itemsById = new Map(ALL_ITEMS.map((item) => [item.id, item]));

    return progress.reviewQueue
      .map((itemId) => itemsById.get(itemId))
      .filter((item): item is StudyItem => Boolean(item))
      .filter((item) => (progress.mistakes[item.id] ?? 0) > 0)
      .filter((item) => itemMatchesReviewScope(item, mode, level))
      .slice(0, 24);
  }, [level, mode, progress.mistakes, progress.reviewQueue]);
  const sessionMistakeTotal = useMemo(
    () => Object.values(sessionMistakes).reduce((sum, count) => sum + count, 0),
    [sessionMistakes],
  );
  const sessionMasteredThisRun = useMemo(
    () => Object.entries(sessionMastery).filter(([itemId, hits]) => {
      const currentMastery = progress.mastery[itemId] ?? 0;
      return hits > 0 && currentMastery >= 3 && currentMastery - hits < 3;
    }).length,
    [progress.mastery, sessionMastery],
  );
  const nextStepAdvice = useMemo(
    () => createNextStepAdvice(levelMasteryRows, level, weakReviewItems.length, locale),
    [level, levelMasteryRows, locale, weakReviewItems.length],
  );
  const achievementBadges = useMemo(
    () => createAchievementBadges(progress, masteredCount, locale),
    [locale, masteredCount, progress],
  );

  const hearts = useMemo(
    () => Array.from({ length: MAX_LIVES }, (_, index) => (index < lives ? '●' : '○')).join(' '),
    [lives],
  );

  useEffect(() => {
    void setAudioModeAsync({
      allowsRecording: false,
      interruptionMode: 'mixWithOthers',
      playsInSilentMode: false,
      shouldPlayInBackground: false,
      shouldRouteThroughEarpiece: false,
    });
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function prepareAds() {
      await prepareRewardedAds();
      const isRequired = await isAdPrivacyOptionsRequired();

      if (isMounted) {
        setIsAdPrivacyOptionsVisible(isRequired);
      }
    }

    void prepareAds();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    bgmPlayer.loop = true;
    bgmPlayer.volume = 0.18;

    if (Platform.OS !== 'web' || !isBgmEnabled) {
      bgmPlayer.replace(selectedBgmTrack.source);
    }

    if (!isBgmEnabled) {
      bgmPlayer.pause();
      return;
    }

    if (Platform.OS !== 'web' && hasAudioGesture) {
      playBgmTrack(selectedBgmTrack.id);
    }
  }, [bgmPlayer, hasAudioGesture, isBgmEnabled, playBgmTrack, selectedBgmTrack.id, selectedBgmTrack.source]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        bgmPlayer.pause();
        stopPronunciation();
        return;
      }

      if (Platform.OS !== 'web' && isBgmEnabled && hasAudioGesture) {
        playBgmTrack(selectedBgmTrack.id);
      }
    });

    return () => subscription.remove();
  }, [bgmPlayer, hasAudioGesture, isBgmEnabled, playBgmTrack, selectedBgmTrack.id, stopPronunciation]);

  useEffect(() => {
    stopPronunciation();
  }, [question.id, stopPronunciation]);

  useEffect(() => {
    if (
      phase !== 'playing'
      || isLocked
      || isAwaitingContinue
      || question.kind !== 'listeningToMeaning'
      || isPronunciationAvailable === false
    ) {
      return undefined;
    }

    const timer = setTimeout(playPronunciation, 220);
    return () => clearTimeout(timer);
  }, [isAwaitingContinue, isLocked, isPronunciationAvailable, phase, playPronunciation, question.id, question.kind]);

  useEffect(() => () => {
    speechRunRef.current += 1;
    void Speech.stop();
  }, []);

  useEffect(() => {
    let isMounted = true;

    loadProgress()
      .then((loaded) => {
        if (isMounted) {
          setProgress(loaded);
          setIsStorageReady(true);
        }
      })
      .catch(() => {
        if (isMounted) {
          setProgress(createDefaultProgress());
          setIsStorageReady(true);
        }
      });

    return () => {
      isMounted = false;
      if (answerTimerRef.current) {
        clearTimeout(answerTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    loadSettings()
      .then((settings) => {
        if (!isMounted) return;

        setIsManualLocale(settings.isManualLocale);
        setLocale(settings.isManualLocale && settings.locale ? settings.locale : detectLocale());
        setIsBgmEnabled(settings.isBgmEnabled);
        setBgmTrackId(settings.bgmTrackId);
        setLevel(settings.level);
        setMode(settings.mode);
        settingsLoadedRef.current = true;
      })
      .catch(() => {
        settingsLoadedRef.current = true;
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!settingsLoadedRef.current) return;

    void saveSettings({
      locale: isManualLocale ? locale : undefined,
      isManualLocale,
      isBgmEnabled,
      bgmTrackId,
      level,
      mode,
    });
  }, [bgmTrackId, isBgmEnabled, isManualLocale, level, locale, mode]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && !isManualLocale) {
        const nextLocale = detectLocale();
        setLocale(nextLocale);

        if (phase === 'playing') {
          setFeedback(null);
          setSelectedOption(null);
          setIsLocked(false);
          setQuestion(makeQuestion(mode, questionIndex, recentIds, nextLocale, level, dailyKey));
        }
      }
    });

    return () => subscription.remove();
  }, [dailyKey, isManualLocale, level, mode, phase, questionIndex, recentIds]);

  const finishGame = useCallback(() => {
    if (finishSavedRef.current) return;

    finishSavedRef.current = true;
    setIsAwaitingContinue(false);
    setIsAdLoading(false);
    stopPronunciation();
    setPhase('finished');

    setProgress((current) => {
      const next = mergeSession(current, {
        mode,
        score,
        bestCombo,
        correct: correctCount,
        total: totalAnswers,
        dailyKey,
        dailyGoalDate: todayDateKey,
        masteryHits: sessionMastery,
        mistakeHits: sessionMistakes,
      });

      void saveProgress(next);
      return next;
    });
  }, [bestCombo, correctCount, dailyKey, mode, score, sessionMastery, sessionMistakes, stopPronunciation, todayDateKey, totalAnswers]);

  useEffect(() => {
    if (phase !== 'playing' || isLocked || isAwaitingContinue) return undefined;

    if (timeLeft <= 0 || lives <= 0) {
      if (canOfferAdContinue && !adRewardUsed) {
        setFeedback(null);
        setIsAwaitingContinue(true);
        stopPronunciation();
      } else {
        finishGame();
      }
      return undefined;
    }

    const timer = setInterval(() => {
      setTimeLeft((value) => Math.max(0, value - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [adRewardUsed, canOfferAdContinue, finishGame, isAwaitingContinue, isLocked, lives, phase, stopPronunciation, timeLeft]);

  const startGame = useCallback(
    (daily: boolean, weakReview = false) => {
      if (!isStorageReady) return;

      if (Platform.OS !== 'web' && isBgmEnabled) {
        try {
          bgmPlayer.play();
        } catch {
          bgmPlayer.pause();
        }
      }

      const nextDailyKey = daily ? `${getDailyKey()}-${level}` : undefined;
      const useWeakReview = !daily && weakReview && weakReviewItems.length > 0;
      const nextGoal = createSessionGoal(mode, level, daily, useWeakReview);
      const firstQuestion = useWeakReview
        ? makeQuestionFromItems(weakReviewItems, 0, [], locale, level)
        : makeQuestion(mode, 0, [], locale, level, nextDailyKey);

      finishSavedRef.current = false;
      setPhase('playing');
      setDailyKey(nextDailyKey);
      setIsWeakReview(useWeakReview);
      setQuestion(firstQuestion);
      setQuestionIndex(0);
      setRecentIds([firstQuestion.itemId]);
      setTimeLeft(GAME_SECONDS);
      setScore(0);
      setCombo(0);
      setBestCombo(0);
      setLives(MAX_LIVES);
      setCorrectCount(0);
      setTotalAnswers(0);
      setSessionMastery({});
      setSessionMistakes({});
      setSessionGoal(nextGoal);
      setFeedback(null);
      setSelectedOption(null);
      setIsLocked(false);
      setAdRewardUsed(false);
      setIsAwaitingContinue(false);
      setIsAdLoading(false);
      void tapFeedback('start');
    },
    [bgmPlayer, isBgmEnabled, isStorageReady, level, locale, mode, weakReviewItems],
  );

  const followNextStep = useCallback(() => {
    if (nextStepAdvice.action === 'advance' && nextStepAdvice.nextLevel) {
      setLevel(nextStepAdvice.nextLevel);
      return;
    }

    if (nextStepAdvice.action === 'review') {
      startGame(false, true);
      return;
    }

    if (nextStepAdvice.action === 'daily') {
      startGame(true);
      return;
    }

    startGame(false);
  }, [nextStepAdvice, startGame]);

  const goHome = useCallback(() => {
    finishSavedRef.current = true;
    if (answerTimerRef.current) {
      clearTimeout(answerTimerRef.current);
      answerTimerRef.current = null;
    }
    stopPronunciation();
    setPhase('ready');
    setIsWeakReview(false);
    setFeedback(null);
    setSelectedOption(null);
    setIsLocked(false);
    setIsAwaitingContinue(false);
    setIsAdLoading(false);
  }, [stopPronunciation]);

  const openSettings = useCallback(() => {
    setSettingsNoticeKey(null);
    setIsResetProgressArmed(false);
    setLocalCompliancePanel(null);
    setIsSettingsOpen(true);
  }, []);

  const closeSettings = useCallback(() => {
    setSettingsNoticeKey(null);
    setIsResetProgressArmed(false);
    setLocalCompliancePanel(null);
    setIsSettingsOpen(false);
  }, []);

  const changeLocale = useCallback(
    (nextLocale: AppLocale) => {
      setIsManualLocale(true);
      setLocale(nextLocale);
      setFeedback(null);
      setSelectedOption(null);
      setIsLocked(false);
      setIsResetProgressArmed(false);

      if (phase === 'playing') {
        setQuestion(makeQuestion(mode, questionIndex, recentIds, nextLocale, level, dailyKey));
      }
    },
    [dailyKey, level, mode, phase, questionIndex, recentIds],
  );

  const followSystemLocale = useCallback(() => {
    const nextLocale = detectLocale();

    setIsManualLocale(false);
    setLocale(nextLocale);
    setFeedback(null);
    setSelectedOption(null);
    setIsLocked(false);
    setIsResetProgressArmed(false);

    if (phase === 'playing') {
      setQuestion(makeQuestion(mode, questionIndex, recentIds, nextLocale, level, dailyKey));
    }
  }, [dailyKey, level, mode, phase, questionIndex, recentIds]);

  const selectBgmTrack = useCallback((trackId: BgmTrackId) => {
    setHasAudioGesture(true);
    setBgmTrackId(trackId);
    setIsBgmEnabled(true);
    setIsResetProgressArmed(false);
    playBgmTrack(trackId);
  }, [playBgmTrack]);

  const toggleBgm = useCallback(() => {
    setIsResetProgressArmed(false);

    if (!isBgmEnabled) {
      setHasAudioGesture(true);
      playBgmTrack(bgmTrackId);
    }

    setIsBgmEnabled((value) => !value);
  }, [bgmTrackId, isBgmEnabled, playBgmTrack]);

  const openComplianceLink = useCallback((url: string | undefined, fallbackPanel: LocalCompliancePanel) => {
    setSettingsNoticeKey(null);
    setIsResetProgressArmed(false);

    if (!url) {
      setLocalCompliancePanel(fallbackPanel);
      return;
    }

    setLocalCompliancePanel(null);
    void Linking.openURL(url);
  }, []);

  const resetLocalProgress = useCallback(() => {
    setLocalCompliancePanel(null);

    if (!isResetProgressArmed) {
      setIsResetProgressArmed(true);
      setSettingsNoticeKey('progressResetArmed');
      return;
    }

    const next = createDefaultProgress();
    setProgress(next);
    void saveProgress(next);
    setIsResetProgressArmed(false);
    setSettingsNoticeKey('progressResetDone');
  }, [isResetProgressArmed]);

  const showAdPrivacyOptions = useCallback(async () => {
    setSettingsNoticeKey(null);
    setIsResetProgressArmed(false);
    const opened = await openAdPrivacyOptions();

    if (!opened) {
      setIsAdPrivacyOptionsVisible(false);
      setSettingsNoticeKey('adPrivacyUnavailable');
      return;
    }

    setSettingsNoticeKey('adPrivacyOpened');
    setIsAdPrivacyOptionsVisible(await isAdPrivacyOptionsRequired());
  }, []);

  const claimAdReward = useCallback(async () => {
    if (isAdLoading) return;

    if (phase !== 'playing' || !isAwaitingContinue || adRewardUsed) {
      setFeedback({ tone: 'bad', text: t(locale, 'adAlreadyUsed') });
      return;
    }

    setIsAdLoading(true);

    try {
      const result = await showRewardedContinueAd();
      const grantReward = result.ok || shouldGrantDevelopmentReward();

      if (!grantReward) {
        setFeedback({ tone: 'bad', text: t(locale, 'adUnavailable') });
        return;
      }

      setAdRewardUsed(true);
      setTimeLeft((value) => Math.max(15, Math.min(GAME_SECONDS, value + 15)));
      setLives((value) => Math.max(1, Math.min(MAX_LIVES, value + 1)));
      setIsAwaitingContinue(false);
      setSelectedOption(null);
      setIsLocked(false);
      setFeedback({ tone: 'good', text: t(locale, 'adRewarded') });
      void tapFeedback('success');
    } finally {
      setIsAdLoading(false);
    }
  }, [adRewardUsed, isAdLoading, isAwaitingContinue, locale, phase]);

  const answerQuestion = useCallback(
    (option: string) => {
      if (phase !== 'playing' || isLocked) return;

      const isCorrect = option === question.answer;
      const nextCombo = isCorrect ? combo + 1 : 0;
      const nextLives = isCorrect ? lives : Math.max(0, lives - 1);
      const nextRecentIds = [question.itemId, ...recentIds.filter((id) => id !== question.itemId)].slice(0, 6);
      const nextQuestionIndex = questionIndex + 1;
      const gained = isCorrect ? scoreForAnswer(combo, timeLeft) : 0;
      const nextQuestion = isWeakReview
        ? makeQuestionFromItems(weakReviewItems, nextQuestionIndex, nextRecentIds, locale, level)
        : makeQuestion(mode, nextQuestionIndex, nextRecentIds, locale, level, dailyKey);
      const feedbackSet = feedbackFor(locale, isCorrect ? 'good' : 'bad');
      const feedbackText = isCorrect
        ? feedbackSet[Math.min(nextCombo - 1, feedbackSet.length - 1)]
        : feedbackSet[Math.floor(Math.random() * feedbackSet.length)];

      setIsLocked(true);
      setSelectedOption(option);
      setTotalAnswers((value) => value + 1);
      setLives(nextLives);
      setCombo(nextCombo);
      setBestCombo((value) => Math.max(value, nextCombo));
      setFeedback({
        tone: isCorrect ? 'good' : 'bad',
        text: isCorrect ? `${feedbackText} +${gained}` : `${feedbackText} / ${t(locale, 'answer')}: ${question.answer}`,
      });

      if (isCorrect) {
        setScore((value) => value + gained);
        setCorrectCount((value) => value + 1);
        setSessionMastery((value) => ({
          ...value,
          [question.itemId]: (value[question.itemId] ?? 0) + 1,
        }));
      } else {
        setSessionMistakes((value) => ({
          ...value,
          [question.itemId]: (value[question.itemId] ?? 0) + 1,
        }));
      }

      void tapFeedback(isCorrect ? 'success' : 'error');

      if (answerTimerRef.current) {
        clearTimeout(answerTimerRef.current);
      }

      const revealDelayMs = getAnswerRevealDelayMs(question.item, isCorrect);

      answerTimerRef.current = setTimeout(() => {
        if (nextLives <= 0) {
          if (!canOfferAdContinue || adRewardUsed) {
            finishGame();
            return;
          }

          setQuestion(nextQuestion);
          setQuestionIndex(nextQuestionIndex);
          setRecentIds(nextRecentIds);
          setSelectedOption(null);
          setIsLocked(false);
          setFeedback(null);
          setIsAwaitingContinue(true);
          stopPronunciation();
          return;
        }

        setQuestion(nextQuestion);
        setQuestionIndex(nextQuestionIndex);
        setRecentIds(nextRecentIds);
        setSelectedOption(null);
        setIsLocked(false);
        setFeedback(null);
      }, revealDelayMs);
    },
    [
      combo,
      adRewardUsed,
      canOfferAdContinue,
      dailyKey,
      finishGame,
      isLocked,
      isWeakReview,
      level,
      lives,
      locale,
      mode,
      phase,
      question,
      questionIndex,
      recentIds,
      stopPronunciation,
      timeLeft,
      weakReviewItems,
    ],
  );

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <View style={styles.mark}>
          <Text style={styles.markText}>あ</Text>
        </View>
        <View style={styles.titleBlock}>
          <Text style={styles.appName}>Kana Sprint</Text>
          <Text adjustsFontSizeToFit numberOfLines={1} style={styles.subtitle}>{t(locale, 'subtitle')}</Text>
        </View>
        {phase === 'playing' ? (
          <Pressable
            accessibilityLabel={t(locale, 'exitRun')}
            accessibilityRole="button"
            accessibilityState={{ disabled: isAdLoading }}
            disabled={isAdLoading}
            onPress={goHome}
            style={[styles.headerExitButton, isAdLoading && styles.disabledButton]}
          >
            <Text adjustsFontSizeToFit numberOfLines={1} style={styles.headerExitText}>
              {t(locale, 'exitRun')}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityLabel={t(locale, 'settings')}
            accessibilityRole="button"
            onPress={openSettings}
            style={styles.settingsButton}
          >
            <Text style={styles.settingsButtonText}>⚙</Text>
          </Pressable>
        )}
      </View>

      {phase === 'ready' ? (
        <ScrollView contentContainerStyle={styles.readyBody} showsVerticalScrollIndicator={false}>
          <View style={styles.heroPanel}>
            <Text style={styles.kicker}>{t(locale, 'shortRound')}</Text>
            <Text adjustsFontSizeToFit minimumFontScale={0.78} numberOfLines={3} style={styles.heroTitle}>
              {withCjkBreaks(t(locale, 'heroTitle'))}
            </Text>
            <View style={styles.heroStats}>
              <Metric label={t(locale, 'bestScore')} value={`${record.bestScore}`} />
              <Metric label={t(locale, 'mastered')} value={`${masteredCount}`} />
              <Metric label={t(locale, 'today')} value={`${todaysBest}`} />
            </View>
          </View>

          <View style={styles.modeGrid}>
            {modeChoices.map((choice) => {
              const selected = choice.mode === mode;

              return (
                <Pressable
                  accessibilityLabel={`${t(locale, 'mode')}: ${choice.title}. ${choice.label}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  aria-pressed={selected}
                  key={choice.mode}
                  onPress={() => setMode(choice.mode)}
                  style={[styles.modeButton, selected && styles.modeButtonSelected]}
                >
                  <Text style={[styles.modeTitle, selected && styles.modeTitleSelected]}>{choice.title}</Text>
                  <Text style={[styles.modeLabel, selected && styles.modeLabelSelected]}>{choice.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.levelPanel}>
            <Text style={styles.sectionLabel}>{t(locale, 'difficulty')}</Text>
            <View style={styles.levelGrid}>
              {levelChoices.map((choice) => {
                const selected = choice.level === level;

                return (
                  <Pressable
                    accessibilityLabel={`${t(locale, 'difficulty')}: ${choice.level}. ${choice.label}. ${choice.stats}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    aria-pressed={selected}
                    key={choice.level}
                    onPress={() => setLevel(choice.level)}
                    style={[styles.levelButton, selected && styles.levelButtonSelected]}
                  >
                    <Text style={[styles.levelTitle, selected && styles.levelTitleSelected]}>{choice.level}</Text>
                    <Text adjustsFontSizeToFit numberOfLines={1} style={[styles.levelLabel, selected && styles.levelLabelSelected]}>
                      {choice.label}
                    </Text>
                    <Text adjustsFontSizeToFit numberOfLines={1} style={[styles.levelMeta, selected && styles.levelMetaSelected]}>
                      {choice.stats}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.actionRow}>
            <Pressable
              accessibilityLabel={t(locale, 'practice')}
              accessibilityRole="button"
              accessibilityState={{ disabled: !isStorageReady }}
              style={[styles.primaryButton, !isStorageReady && styles.disabledButton]}
              onPress={() => startGame(false)}
              disabled={!isStorageReady}
            >
              <Text adjustsFontSizeToFit numberOfLines={1} style={styles.primaryButtonText}>{t(locale, 'practice')}</Text>
            </Pressable>
            <Pressable
              accessibilityLabel={t(locale, 'dailyChallenge')}
              accessibilityRole="button"
              accessibilityState={{ disabled: !isStorageReady }}
              disabled={!isStorageReady}
              onPress={() => startGame(true)}
              style={[styles.secondaryButton, !isStorageReady && styles.disabledButton]}
            >
              <Text adjustsFontSizeToFit numberOfLines={1} style={styles.secondaryButtonText}>{t(locale, 'dailyChallenge')}</Text>
            </Pressable>
          </View>

          <View
            accessibilityLabel={`${t(locale, 'dailyGoal')}: ${dailyGoalProgress}/${dailyGoalTarget}. ${isDailyGoalComplete ? t(locale, 'dailyGoalComplete') : t(locale, 'dailyGoalBody')}`}
            style={[styles.dailyGoalCard, isDailyGoalComplete && styles.dailyGoalCardComplete]}
          >
            <View style={styles.dailyGoalHeader}>
              <View style={styles.dailyGoalCopy}>
                <Text style={[styles.dailyGoalEyebrow, isDailyGoalComplete && styles.dailyGoalEyebrowComplete]}>
                  {t(locale, 'dailyGoal')}
                </Text>
                <Text adjustsFontSizeToFit numberOfLines={1} style={styles.dailyGoalTitle}>
                  {isDailyGoalComplete ? t(locale, 'dailyGoalComplete') : t(locale, 'dailyGoalBody')}
                </Text>
              </View>
              <Text adjustsFontSizeToFit numberOfLines={1} style={styles.dailyGoalValue}>
                {dailyGoalProgress}/{dailyGoalTarget}
              </Text>
            </View>
            <View style={styles.dailyGoalTrack}>
              <View style={[styles.dailyGoalFill, { width: `${dailyGoalPercent}%` }]} />
            </View>
          </View>

          <View
            accessibilityLabel={`${t(locale, 'mission')}: ${sessionGoalTargetText(readyGoal, locale)}`}
            style={styles.missionCard}
          >
            <View style={styles.missionHeader}>
              <Text style={styles.missionEyebrow}>{t(locale, 'missionPreview')}</Text>
              <Text style={styles.missionLevelPill}>{level}</Text>
            </View>
            <Text adjustsFontSizeToFit numberOfLines={1} style={styles.missionTitle}>
              {sessionGoalTargetText(readyGoal, locale)}
            </Text>
          </View>

          <Pressable
            accessibilityLabel={`${t(locale, 'nextStep')}: ${nextStepAdvice.title}. ${nextStepAdvice.body}`}
            accessibilityRole="button"
            accessibilityState={{ disabled: !isStorageReady && nextStepAdvice.action !== 'advance' }}
            disabled={!isStorageReady && nextStepAdvice.action !== 'advance'}
            onPress={followNextStep}
            style={[
              styles.nextStepCard,
              nextStepAdvice.action === 'review' && styles.nextStepCardReview,
              (!isStorageReady && nextStepAdvice.action !== 'advance') && styles.disabledButton,
            ]}
          >
            <View style={styles.nextStepCopy}>
              <Text style={styles.nextStepEyebrow}>{t(locale, 'nextStep')}</Text>
              <Text adjustsFontSizeToFit numberOfLines={1} style={styles.nextStepTitle}>
                {nextStepAdvice.title}
              </Text>
              <Text adjustsFontSizeToFit numberOfLines={1} style={styles.nextStepBody}>
                {nextStepAdvice.body}
              </Text>
            </View>
            <View style={styles.nextStepActionPill}>
              <Text adjustsFontSizeToFit numberOfLines={1} style={styles.nextStepActionText}>
                {nextStepAdvice.actionLabel}
              </Text>
            </View>
          </Pressable>

          <Pressable
            accessibilityLabel={`${t(locale, 'weakReview')}: ${weakReviewItems.length} ${t(locale, 'weakItems')}`}
            accessibilityRole="button"
            accessibilityState={{ disabled: !isStorageReady || weakReviewItems.length === 0 }}
            disabled={!isStorageReady || weakReviewItems.length === 0}
            onPress={() => startGame(false, true)}
            style={[
              styles.reviewButton,
              (!isStorageReady || weakReviewItems.length === 0) && styles.disabledButton,
            ]}
          >
            <View style={styles.reviewCopy}>
              <Text adjustsFontSizeToFit numberOfLines={1} style={styles.reviewTitle}>{t(locale, 'weakReview')}</Text>
              <Text adjustsFontSizeToFit numberOfLines={1} style={styles.reviewLabel}>
                {weakReviewItems.length > 0 ? t(locale, 'weakReviewLabel') : t(locale, 'noWeakItems')}
              </Text>
            </View>
            <View style={styles.reviewCountPill}>
              <Text adjustsFontSizeToFit numberOfLines={1} style={styles.reviewCountText}>{weakReviewItems.length}</Text>
            </View>
          </Pressable>

          <View style={styles.snapshotRow}>
            <MiniStat label={t(locale, 'mode')} value={modeLabel(mode, locale)} />
            <MiniStat label={t(locale, 'difficulty')} value={level} />
            <MiniStat label={t(locale, 'dailyStreak')} value={`${dailyStreakCount}`} />
            <MiniStat label={t(locale, 'runs')} value={`${progress.totalSessions}`} />
          </View>

          <View style={styles.badgePanel}>
            <Text style={styles.sectionLabel}>{t(locale, 'milestones')}</Text>
            <View style={styles.badgeGrid}>
              {achievementBadges.map((badge) => (
                <View
                  accessibilityLabel={`${badge.title}: ${badge.unlocked ? t(locale, 'unlocked') : t(locale, 'locked')}. ${badge.progress}`}
                  key={badge.id}
                  style={[styles.badgeCard, badge.unlocked && styles.badgeCardUnlocked]}
                >
                  <Text adjustsFontSizeToFit numberOfLines={1} style={[styles.badgeStatus, badge.unlocked && styles.badgeStatusUnlocked]}>
                    {badge.unlocked ? t(locale, 'unlocked') : t(locale, 'locked')}
                  </Text>
                  <Text adjustsFontSizeToFit numberOfLines={1} style={styles.badgeTitle}>
                    {badge.title}
                  </Text>
                  <Text adjustsFontSizeToFit numberOfLines={1} style={styles.badgeProgress}>
                    {badge.progress}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.levelProgressPanel}>
            <Text style={styles.sectionLabel}>{t(locale, 'levelProgress')}</Text>
            {levelMasteryRows.map((row) => (
              <View
                accessibilityLabel={`${row.level} ${t(locale, 'mastered')}: ${row.mastered}/${row.total}`}
                key={row.level}
                style={styles.levelProgressRow}
              >
                <View style={styles.levelProgressHeader}>
                  <Text style={styles.levelProgressLevel}>{row.level}</Text>
                  <Text style={styles.levelProgressValue}>{row.mastered}/{row.total}</Text>
                </View>
                <View style={styles.levelProgressTrack}>
                  <View
                    style={[
                      styles.levelProgressFill,
                      { backgroundColor: row.color, width: `${row.percent}%` },
                    ]}
                  />
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      ) : null}

      {phase === 'playing' ? (
        <View style={styles.playBody}>
          <View style={styles.scoreStrip}>
            <Metric label={t(locale, 'time')} value={`${timeLeft}s`} compact />
            <Metric label={t(locale, 'score')} value={`${score}`} compact />
            <Metric label={t(locale, 'combo')} value={`${combo}`} compact />
            <Metric label={t(locale, 'hearts')} value={hearts} compact />
          </View>

          <View style={styles.timerTrack}>
            <View style={[styles.timerFill, { width: `${timerPercent}%`, backgroundColor: question.accent }]} />
          </View>

          {isAwaitingContinue ? (
            <View accessibilityRole="alert" style={styles.continuePanel}>
              <Text adjustsFontSizeToFit numberOfLines={2} style={styles.continueTitle}>
                {t(locale, 'continueTitle')}
              </Text>
              <Text style={styles.continueBody}>{t(locale, 'continueBody')}</Text>
              {feedback ? (
                <Text numberOfLines={3} style={styles.continueFeedback}>{feedback.text}</Text>
              ) : null}
              <View style={styles.continueActions}>
                <Pressable
                  accessibilityLabel={isAdLoading ? t(locale, 'adLoading') : t(locale, 'adContinue')}
                  accessibilityRole="button"
                  accessibilityState={{ busy: isAdLoading, disabled: isAdLoading }}
                  disabled={isAdLoading}
                  onPress={claimAdReward}
                  style={[styles.adButton, isAdLoading && styles.disabledButton]}
                >
                  {isAdLoading ? (
                    <View style={styles.adLoadingContent}>
                      <ActivityIndicator color="#FFF7E8" size="small" />
                      <Text adjustsFontSizeToFit numberOfLines={1} style={styles.adButtonText}>
                        {t(locale, 'adLoading')}
                      </Text>
                    </View>
                  ) : (
                    <Text adjustsFontSizeToFit numberOfLines={1} style={styles.adButtonText}>
                      {t(locale, 'adContinue')}
                    </Text>
                  )}
                </Pressable>
                <Pressable
                  accessibilityLabel={t(locale, 'finishRun')}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isAdLoading }}
                  disabled={isAdLoading}
                  onPress={finishGame}
                  style={[styles.finishRunButton, isAdLoading && styles.disabledButton]}
                >
                  <Text adjustsFontSizeToFit numberOfLines={1} style={styles.finishRunButtonText}>
                    {t(locale, 'finishRun')}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              <View style={[styles.questionPanel, { borderColor: question.accent }]}>
                {question.item.kind !== 'grammar' || isLocked ? (
                  <Pressable
                    accessibilityLabel={t(locale, 'playPronunciation')}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isPronunciationPlaying }}
                    aria-pressed={isPronunciationPlaying}
                    onPress={playPronunciation}
                    style={[styles.pronunciationButton, isPronunciationPlaying && styles.pronunciationButtonActive]}
                  >
                    <Text style={styles.pronunciationButtonText}>🔊</Text>
                  </Pressable>
                ) : null}
                <Text style={styles.questionMeta}>{visibleQuestionMeta}</Text>
                <Text
                  adjustsFontSizeToFit
                  minimumFontScale={0.62}
                  numberOfLines={question.item.kind === 'grammar' ? 3 : 2}
                  style={[styles.questionText, question.item.kind === 'grammar' && styles.grammarQuestionText]}
                >
                  {withCjkBreaks(visibleQuestionPrompt)}
                </Text>
                <Text style={styles.questionTopic}>
                  {level} / {modeLabel(mode, locale)} / {dailyKey ? t(locale, 'daily') : isWeakReview ? t(locale, 'weakReview') : t(locale, 'sprint')}
                </Text>
              </View>

              <View style={styles.optionGrid}>
                {question.options.map((option) => {
                  const selected = selectedOption === option;
                  const reveal = isLocked && option === question.answer;
                  const wrong = selected && option !== question.answer;

                  return (
                    <Pressable
                      accessibilityLabel={`${t(locale, 'answer')}: ${option}`}
                      accessibilityRole="button"
                      accessibilityState={{ disabled: isLocked, selected }}
                      aria-pressed={selected}
                      key={`${question.id}-${option}`}
                      onPress={() => answerQuestion(option)}
                      disabled={isLocked}
                      style={[
                        styles.optionButton,
                        reveal && styles.optionCorrect,
                        wrong && styles.optionWrong,
                      ]}
                    >
                      <Text adjustsFontSizeToFit numberOfLines={3} style={[styles.optionText, (reveal || wrong) && styles.optionTextActive]}>
                        {option}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.playActions}>
                {answerStudyHint ? (
                  <View
                    accessibilityLabel={`${t(locale, 'answer')}: ${answerStudyHint.answer}. ${answerStudyHint.detail}`}
                    style={[styles.answerHintCard, feedback?.tone === 'bad' && styles.answerHintCardBad]}
                  >
                    <Text numberOfLines={1} style={[styles.answerHintTitle, feedback?.tone === 'bad' && styles.feedbackBad]}>
                      {feedback ? feedback.text : `${t(locale, 'answer')}: ${answerStudyHint.answer}`}
                    </Text>
                    <Text adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={2} style={styles.answerHintDetail}>
                      {answerStudyHint.detail}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.feedbackBar}>
                    <Text numberOfLines={2} style={[styles.feedbackText, feedback?.tone === 'bad' && styles.feedbackBad]}>
                      {feedback ? feedback.text : `${t(locale, 'mission')}: ${sessionGoalTargetText(sessionGoal, locale)} · ${sessionGoalProgress}`}
                    </Text>
                  </View>
                )}
              </View>
            </>
          )}
        </View>
      ) : null}

      {phase === 'finished' ? (
        <ScrollView contentContainerStyle={styles.finishBody} showsVerticalScrollIndicator={false}>
          <View style={styles.finishPanel}>
            <Text style={styles.finishKicker}>{dailyKey ? t(locale, 'dailyDone') : isWeakReview ? t(locale, 'weakReviewDone') : t(locale, 'practiceDone')}</Text>
            <Text style={styles.finishScore}>{score}</Text>
            <Text style={styles.finishLabel}>
              {t(locale, 'bestScore')} {record.bestScore} / {t(locale, 'dailyBest')} {todaysBest}
            </Text>
          </View>

          <View style={styles.snapshotRow}>
            <MiniStat label={t(locale, 'correctRate')} value={`${accuracy}%`} />
            <MiniStat label={t(locale, 'bestCombo')} value={`${bestCombo}`} />
            <MiniStat label={t(locale, 'answers')} value={`${correctCount}/${totalAnswers}`} />
            <MiniStat label={t(locale, 'dailyStreak')} value={`${dailyStreakCount}`} />
          </View>

          <View
            accessibilityLabel={`${t(locale, 'mission')}: ${sessionGoalTargetText(sessionGoal, locale)}. ${t(locale, 'missionProgress')}: ${sessionGoalProgress}`}
            style={[styles.missionResultCard, sessionGoalComplete && styles.missionResultComplete]}
          >
            <Text style={[styles.missionResultTitle, sessionGoalComplete && styles.missionResultTitleComplete]}>
              {sessionGoalComplete ? t(locale, 'missionComplete') : t(locale, 'missionKeepGoing')}
            </Text>
            <Text style={[styles.missionResultBody, sessionGoalComplete && styles.missionResultBodyComplete]}>
              {sessionGoalTargetText(sessionGoal, locale)} · {t(locale, 'missionProgress')} {sessionGoalProgress}
            </Text>
          </View>

          <View
            accessibilityLabel={`${t(locale, 'runRecap')}: ${t(locale, 'newMastered')} ${sessionMasteredThisRun}. ${t(locale, 'misses')} ${sessionMistakeTotal}.`}
            style={styles.recapPanel}
          >
            <Text style={styles.recapTitle}>{t(locale, 'runRecap')}</Text>
            <View style={styles.recapStatsRow}>
              <View style={styles.recapStat}>
                <Text adjustsFontSizeToFit numberOfLines={1} style={styles.recapStatValue}>{sessionMasteredThisRun}</Text>
                <Text adjustsFontSizeToFit numberOfLines={1} style={styles.recapStatLabel}>{t(locale, 'newMastered')}</Text>
              </View>
              <View style={styles.recapStat}>
                <Text adjustsFontSizeToFit numberOfLines={1} style={styles.recapStatValue}>{sessionMistakeTotal}</Text>
                <Text adjustsFontSizeToFit numberOfLines={1} style={styles.recapStatLabel}>{t(locale, 'misses')}</Text>
              </View>
              <View style={styles.recapStat}>
                <Text adjustsFontSizeToFit numberOfLines={1} style={styles.recapStatValue}>{weakReviewItems.length}</Text>
                <Text adjustsFontSizeToFit numberOfLines={1} style={styles.recapStatLabel}>{t(locale, 'weakReview')}</Text>
              </View>
            </View>
            {sessionMistakeTotal > 0 ? (
              <Pressable
                accessibilityLabel={t(locale, 'reviewNow')}
                accessibilityRole="button"
                accessibilityState={{ disabled: weakReviewItems.length === 0 }}
                disabled={weakReviewItems.length === 0}
                onPress={() => startGame(false, true)}
                style={[styles.recapReviewButton, weakReviewItems.length === 0 && styles.disabledButton]}
              >
                <Text adjustsFontSizeToFit numberOfLines={1} style={styles.recapReviewButtonText}>{t(locale, 'reviewNow')}</Text>
              </Pressable>
            ) : (
              <Text style={styles.recapBody}>{t(locale, 'noMissesThisRun')}</Text>
            )}
          </View>

          <View style={styles.actionRow}>
            <Pressable
              accessibilityLabel={t(locale, 'playAgain')}
              accessibilityRole="button"
              onPress={() => startGame(Boolean(dailyKey), isWeakReview)}
              style={styles.primaryButton}
            >
              <Text adjustsFontSizeToFit numberOfLines={1} style={styles.primaryButtonText}>{t(locale, 'playAgain')}</Text>
            </Pressable>
            <Pressable
              accessibilityLabel={t(locale, 'switchMode')}
              accessibilityRole="button"
              onPress={goHome}
              style={styles.secondaryButton}
            >
              <Text adjustsFontSizeToFit numberOfLines={1} style={styles.secondaryButtonText}>{t(locale, 'switchMode')}</Text>
            </Pressable>
          </View>
        </ScrollView>
      ) : null}

      {isSettingsOpen ? (
        <View style={styles.settingsOverlay}>
          <Pressable
            accessibilityLabel={t(locale, 'close')}
            accessibilityRole="button"
            style={styles.settingsBackdrop}
            onPress={closeSettings}
          />
          <View style={styles.settingsPanel}>
            <View style={styles.settingsHeader}>
              <Text style={styles.settingsTitle}>{t(locale, 'settings')}</Text>
              <Pressable
                accessibilityLabel={t(locale, 'close')}
                accessibilityRole="button"
                onPress={closeSettings}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>{t(locale, 'close')}</Text>
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.settingsContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.settingsSectionLabel}>{t(locale, 'language')}</Text>
              <View style={styles.settingsGrid}>
                <Pressable
                  accessibilityLabel={t(locale, 'systemLanguage')}
                  accessibilityRole="button"
                  accessibilityState={{ selected: !isManualLocale }}
                  aria-pressed={!isManualLocale}
                  onPress={followSystemLocale}
                  style={[styles.settingChoice, !isManualLocale && styles.settingChoiceSelected]}
                >
                  <Text adjustsFontSizeToFit numberOfLines={1} style={[styles.settingChoiceText, !isManualLocale && styles.settingChoiceTextSelected]}>
                    {t(locale, 'systemLanguage')}
                  </Text>
                </Pressable>
                {LOCALE_OPTIONS.map((option) => {
                  const selected = isManualLocale && option.locale === locale;

                  return (
                    <Pressable
                      accessibilityLabel={option.label}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      aria-pressed={selected}
                      key={option.locale}
                      onPress={() => changeLocale(option.locale)}
                      style={[styles.settingChoice, selected && styles.settingChoiceSelected]}
                    >
                      <Text adjustsFontSizeToFit numberOfLines={1} style={[styles.settingChoiceText, selected && styles.settingChoiceTextSelected]}>
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.settingsSectionLabel}>{t(locale, 'music')}</Text>
              <View style={styles.musicRow}>
                <Pressable
                  accessibilityLabel={isBgmEnabled ? t(locale, 'musicOn') : t(locale, 'musicOff')}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isBgmEnabled }}
                  aria-pressed={isBgmEnabled}
                  onPress={toggleBgm}
                  style={[styles.musicToggle, isBgmEnabled && styles.musicToggleOn]}
                >
                  <Text style={[styles.musicToggleText, isBgmEnabled && styles.musicToggleTextOn]}>
                    {isBgmEnabled ? t(locale, 'musicOn') : t(locale, 'musicOff')}
                  </Text>
                </Pressable>
              </View>
              <View style={styles.settingsGrid}>
                {BGM_TRACKS.map((track) => {
                  const selected = track.id === bgmTrackId;

                  return (
                    <Pressable
                      accessibilityLabel={t(locale, track.titleKey)}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      aria-pressed={selected}
                      key={track.id}
                      onPress={() => selectBgmTrack(track.id)}
                      style={[styles.settingChoice, selected && styles.settingChoiceSelected]}
                    >
                      <Text adjustsFontSizeToFit numberOfLines={1} style={[styles.settingChoiceText, selected && styles.settingChoiceTextSelected]}>
                        {t(locale, track.titleKey)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.settingsSectionLabel}>{t(locale, 'localData')}</Text>
              <View style={styles.linkStack}>
                <Pressable
                  accessibilityLabel={t(locale, isResetProgressArmed ? 'confirmResetProgress' : 'resetProgress')}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isResetProgressArmed }}
                  aria-pressed={isResetProgressArmed}
                  onPress={resetLocalProgress}
                  style={[styles.resetButton, isResetProgressArmed && styles.resetButtonConfirm]}
                >
                  <Text
                    adjustsFontSizeToFit
                    numberOfLines={1}
                    style={[styles.resetButtonText, isResetProgressArmed && styles.resetButtonTextConfirm]}
                  >
                    {t(locale, isResetProgressArmed ? 'confirmResetProgress' : 'resetProgress')}
                  </Text>
                </Pressable>
                {progressResetNotice ? (
                  <Text style={styles.linkStatusText}>{progressResetNotice}</Text>
                ) : null}
              </View>

              <Text style={styles.settingsSectionLabel}>{t(locale, 'supportPrivacy')}</Text>
              <View style={styles.linkStack}>
                <View style={styles.linkRow}>
                  <Pressable
                    accessibilityLabel={t(locale, 'support')}
                    accessibilityRole="button"
                    onPress={() => openComplianceLink(activeSupportUrl, 'support')}
                    style={[styles.linkButton, !activeSupportUrl && styles.linkButtonLocal]}
                  >
                    <Text adjustsFontSizeToFit numberOfLines={1} style={styles.linkButtonText}>
                      {t(locale, 'support')}
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityLabel={t(locale, 'privacyPolicy')}
                    accessibilityRole="button"
                    onPress={() => openComplianceLink(activePrivacyPolicyUrl, 'privacy')}
                    style={[styles.linkButton, !activePrivacyPolicyUrl && styles.linkButtonLocal]}
                  >
                    <Text adjustsFontSizeToFit numberOfLines={1} style={styles.linkButtonText}>
                      {t(locale, 'privacyPolicy')}
                    </Text>
                  </Pressable>
                </View>
                <Pressable
                  accessibilityLabel={t(locale, 'openSourceNotices')}
                  accessibilityRole="button"
                  onPress={() => openComplianceLink(activeOpenSourceNoticesUrl, 'openSource')}
                  style={[styles.linkButtonWide, !activeOpenSourceNoticesUrl && styles.linkButtonLocal]}
                >
                  <Text adjustsFontSizeToFit numberOfLines={1} style={styles.linkButtonText}>
                    {t(locale, 'openSourceNotices')}
                  </Text>
                </Pressable>
                {hasAdPrivacyOptionsEntry ? (
                  <Pressable
                    accessibilityLabel={t(locale, 'adPrivacyOptions')}
                    accessibilityRole="button"
                    onPress={showAdPrivacyOptions}
                    style={styles.linkButtonWide}
                  >
                    <Text adjustsFontSizeToFit numberOfLines={1} style={styles.linkButtonText}>
                      {t(locale, 'adPrivacyOptions')}
                    </Text>
                  </Pressable>
                ) : null}
                {!hasSupportLinks ? (
                  <Text style={styles.linkStatusText}>{t(locale, 'linksPending')}</Text>
                ) : null}
                {localCompliancePanel ? (
                  <View style={styles.localCompliancePanel}>
                    <Text style={styles.localComplianceTitle}>
                      {t(
                        locale,
                        localCompliancePanel === 'support'
                          ? 'localSupportTitle'
                          : localCompliancePanel === 'privacy'
                            ? 'localPrivacyTitle'
                            : 'localOpenSourceTitle',
                      )}
                    </Text>
                    <Text style={styles.localComplianceBody}>
                      {t(
                        locale,
                        localCompliancePanel === 'support'
                          ? 'localSupportBody'
                          : localCompliancePanel === 'privacy'
                            ? 'localPrivacyBody'
                            : 'localOpenSourceBody',
                      )}
                    </Text>
                  </View>
                ) : null}
                {adPrivacyNotice ? (
                  <Text style={styles.linkStatusText}>{adPrivacyNotice}</Text>
                ) : null}
              </View>
            </ScrollView>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function Metric({ label, value, compact }: { label: string; value: string; compact?: boolean }) {
  return (
    <View style={[styles.metric, compact && styles.metricCompact]}>
      <Text adjustsFontSizeToFit numberOfLines={1} style={styles.metricLabel}>{label}</Text>
      <Text adjustsFontSizeToFit numberOfLines={1} style={styles.metricValue}>
        {value}
      </Text>
    </View>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.miniStat}>
      <Text adjustsFontSizeToFit numberOfLines={1} style={styles.miniStatValue}>{value}</Text>
      <Text adjustsFontSizeToFit numberOfLines={1} style={styles.miniStatLabel}>{label}</Text>
    </View>
  );
}

function modeLabel(mode: GameMode, locale: AppLocale) {
  if (mode === 'kana') return t(locale, 'modeKana');
  if (mode === 'vocab') return t(locale, 'modeVocab');
  if (mode === 'lines') return t(locale, 'modeLines');
  if (mode === 'grammar') return t(locale, 'modeGrammar');
  return t(locale, 'modeMix');
}

function levelLabel(level: JlptLevel, locale: AppLocale) {
  if (level === 'N5') return t(locale, 'levelN5');
  if (level === 'N4') return t(locale, 'levelN4');
  if (level === 'N3') return t(locale, 'levelN3');
  if (level === 'N2') return t(locale, 'levelN2');
  return t(locale, 'levelN1');
}

function withCjkBreaks(value: string) {
  return value.replace(/([\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF])(?=[\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF])/g, '$1\u200B');
}

function createSessionGoal(mode: GameMode, level: JlptLevel, daily: boolean, weakReview: boolean): SessionGoal {
  if (weakReview) {
    return { kind: 'accuracy', target: Math.min(92, missionAccuracyTargets[level] + 2) };
  }

  const goalKinds: SessionGoalKind[] = ['score', 'combo', 'accuracy'];
  const levelIndex = Math.max(0, JLPT_LEVELS.indexOf(level));
  const goalIndex = (levelIndex + modeMissionOffsets[mode] + (daily ? 1 : 0)) % goalKinds.length;
  const kind = goalKinds[goalIndex] ?? 'score';

  if (kind === 'score') {
    return { kind, target: missionScoreTargets[level] + (daily ? 150 : 0) };
  }

  if (kind === 'combo') {
    return { kind, target: missionComboTargets[level] + (daily ? 1 : 0) };
  }

  return { kind, target: Math.min(92, missionAccuracyTargets[level] + (daily ? 2 : 0)) };
}

function sessionGoalTargetText(goal: SessionGoal, locale: AppLocale) {
  if (goal.kind === 'score') return `${t(locale, 'missionScore')} ${goal.target}`;
  if (goal.kind === 'combo') return `${t(locale, 'missionCombo')} ${goal.target}`;
  return `${t(locale, 'missionAccuracy')} ${goal.target}%`;
}

function sessionGoalProgressText(goal: SessionGoal, score: number, bestCombo: number, correct: number, total: number) {
  if (goal.kind === 'score') return `${Math.min(score, goal.target)}/${goal.target}`;
  if (goal.kind === 'combo') return `${Math.min(bestCombo, goal.target)}/${goal.target}`;

  const accuracy = total === 0 ? 0 : Math.round((correct / total) * 100);
  return `${accuracy}%/${goal.target}%`;
}

function isSessionGoalComplete(goal: SessionGoal, score: number, bestCombo: number, correct: number, total: number) {
  if (goal.kind === 'score') return score >= goal.target;
  if (goal.kind === 'combo') return bestCombo >= goal.target;

  const accuracy = total === 0 ? 0 : Math.round((correct / total) * 100);
  return total >= 8 && accuracy >= goal.target;
}

function createNextStepAdvice(rows: LevelMasteryRow[], level: JlptLevel, weakCount: number, locale: AppLocale): NextStepAdvice {
  if (weakCount > 0) {
    return {
      title: t(locale, 'nextStepReview'),
      body: `${weakCount} ${t(locale, 'weakItems')} · ${t(locale, 'weakReviewLabel')}`,
      actionLabel: t(locale, 'weakReview'),
      action: 'review',
    };
  }

  const currentIndex = Math.max(0, JLPT_LEVELS.indexOf(level));
  const current = rows.find((row) => row.level === level) ?? rows[currentIndex];

  if (current && current.mastered < current.total) {
    return {
      title: t(locale, 'nextStepPractice'),
      body: `${level} · ${current.mastered}/${current.total} ${t(locale, 'mastered')}`,
      actionLabel: t(locale, 'practice'),
      action: 'practice',
    };
  }

  const nextLevel = JLPT_LEVELS[currentIndex + 1];

  if (nextLevel) {
    return {
      title: t(locale, 'nextStepAdvance'),
      body: `${level} ${t(locale, 'levelCleared')} · ${nextLevel}`,
      actionLabel: t(locale, 'nextLevel'),
      action: 'advance',
      nextLevel,
    };
  }

  return {
    title: t(locale, 'nextStepComplete'),
    body: t(locale, 'allLevelsCleared'),
    actionLabel: t(locale, 'dailyChallenge'),
    action: 'daily',
  };
}

function createAchievementBadges(progress: GameProgress, masteredCount: number, locale: AppLocale): AchievementBadge[] {
  const n1Mastered = ALL_ITEMS.filter((item) => item.level === 'N1' && (progress.mastery[item.id] ?? 0) >= 3).length;
  const bestDailyStreak = Math.max(progress.dailyStreak.current, progress.dailyStreak.best);

  return [
    {
      id: 'first-run',
      title: t(locale, 'badgeFirstRun'),
      progress: `${Math.min(progress.totalSessions, 1)}/1`,
      unlocked: progress.totalSessions >= 1,
    },
    {
      id: 'streak-3',
      title: t(locale, 'badgeStreak'),
      progress: `${Math.min(bestDailyStreak, 3)}/3`,
      unlocked: bestDailyStreak >= 3,
    },
    {
      id: 'mastery-20',
      title: t(locale, 'badgeMastery'),
      progress: `${Math.min(masteredCount, 20)}/20`,
      unlocked: masteredCount >= 20,
    },
    {
      id: 'n1-spark',
      title: t(locale, 'badgeN1'),
      progress: `${Math.min(n1Mastered, 1)}/1`,
      unlocked: n1Mastered >= 1,
    },
  ];
}

function getAnswerStudyHint(question: GameQuestion, locale: AppLocale): AnswerStudyHint {
  const item = question.item;
  const reading = [item.kana, item.romaji].filter(Boolean).join(' / ');
  const meaning = localize(item.meaning, locale);

  if (item.kind === 'grammar' && item.grammar) {
    return {
      answer: question.answer,
      detail: `${item.grammar.completedSentence} · ${meaning}`,
    };
  }

  if (item.kind === 'hiragana' || item.kind === 'katakana') {
    return {
      answer: question.answer,
      detail: `${item.display} / ${item.romaji}`,
    };
  }

  const detailParts = [item.display, reading];
  if (meaning !== item.display) detailParts.push(meaning);

  return {
    answer: question.answer,
    detail: detailParts.join(' · '),
  };
}

function itemMatchesReviewScope(item: StudyItem, mode: GameMode, level: JlptLevel) {
  if (mode === 'kana') return item.kind === 'hiragana' || item.kind === 'katakana';
  if (mode === 'vocab') return item.kind === 'vocab' && item.level === level;
  if (mode === 'lines') return item.kind === 'line' && item.level === level;
  if (mode === 'grammar') return item.kind === 'grammar' && item.level === level;
  if (level === 'N5') return item.level === 'N5';
  return item.level === level && (item.kind === 'vocab' || item.kind === 'line' || item.kind === 'grammar');
}

async function tapFeedback(kind: 'start' | 'success' | 'error') {
  if (Platform.OS === 'web') return;

  if (kind === 'start') {
    await Haptics.selectionAsync();
    return;
  }

  await Haptics.notificationAsync(kind === 'success' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#10151F',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  mark: {
    alignItems: 'center',
    backgroundColor: '#FFB23F',
    borderRadius: 18,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  markText: {
    color: '#10151F',
    fontSize: 30,
    fontWeight: '900',
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
  },
  appName: {
    color: '#FFF7E8',
    fontSize: 24,
    fontWeight: '900',
  },
  subtitle: {
    color: '#A7B0C4',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  settingsButton: {
    alignItems: 'center',
    backgroundColor: '#1D2635',
    borderColor: '#2E3A4E',
    borderRadius: 8,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  settingsButtonText: {
    color: '#8DEBD3',
    fontSize: 24,
    fontWeight: '900',
  },
  headerExitButton: {
    alignItems: 'center',
    backgroundColor: '#263248',
    borderColor: '#EF5D60',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 68,
    paddingHorizontal: 12,
  },
  headerExitText: {
    color: '#FFF7E8',
    fontSize: 14,
    fontWeight: '900',
  },
  readyBody: {
    gap: 16,
    padding: 20,
    paddingBottom: 30,
  },
  heroPanel: {
    backgroundColor: '#FFF7E8',
    borderRadius: 8,
    gap: 16,
    padding: 20,
    width: '100%',
  },
  kicker: {
    color: '#E84F5A',
    fontSize: 13,
    fontWeight: '900',
  },
  heroTitle: {
    color: '#10151F',
    flexShrink: 1,
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 34,
  },
  heroStats: {
    flexDirection: 'row',
    gap: 10,
    minWidth: 0,
  },
  metric: {
    backgroundColor: '#172131',
    borderRadius: 8,
    flex: 1,
    minHeight: 72,
    minWidth: 0,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  metricCompact: {
    minHeight: 62,
  },
  metricLabel: {
    color: '#A7B0C4',
    fontSize: 11,
    fontWeight: '800',
  },
  metricValue: {
    color: '#FFF7E8',
    fontSize: 21,
    fontWeight: '900',
    marginTop: 5,
  },
  modeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  modeButton: {
    backgroundColor: '#1D2635',
    borderColor: '#2E3A4E',
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: '48.5%',
    flexGrow: 1,
    minHeight: 84,
    minWidth: 0,
    padding: 14,
  },
  modeButtonSelected: {
    backgroundColor: '#31C6A7',
    borderColor: '#8DEBD3',
  },
  modeTitle: {
    color: '#FFF7E8',
    fontSize: 19,
    fontWeight: '900',
  },
  modeTitleSelected: {
    color: '#10151F',
  },
  modeLabel: {
    color: '#A7B0C4',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  modeLabelSelected: {
    color: '#16352E',
  },
  levelPanel: {
    gap: 8,
  },
  sectionLabel: {
    color: '#A7B0C4',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  levelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  levelButton: {
    alignItems: 'center',
    backgroundColor: '#1D2635',
    borderColor: '#2E3A4E',
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: '31%',
    flexGrow: 1,
    minHeight: 74,
    minWidth: 0,
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  levelButtonSelected: {
    backgroundColor: '#FFB23F',
    borderColor: '#FFD48B',
  },
  levelTitle: {
    color: '#FFF7E8',
    fontSize: 17,
    fontWeight: '900',
  },
  levelTitleSelected: {
    color: '#10151F',
  },
  levelLabel: {
    color: '#A7B0C4',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 2,
    textAlign: 'center',
  },
  levelLabelSelected: {
    color: '#4B2D00',
  },
  levelMeta: {
    color: '#78849A',
    fontSize: 9,
    fontWeight: '800',
    marginTop: 3,
    textAlign: 'center',
  },
  levelMetaSelected: {
    color: '#5C3A08',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#FFB23F',
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
    minHeight: 58,
    minWidth: 0,
    paddingHorizontal: 10,
  },
  disabledButton: {
    opacity: 0.55,
  },
  primaryButtonText: {
    color: '#10151F',
    fontSize: 17,
    fontWeight: '900',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#263248',
    borderColor: '#394964',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 58,
    minWidth: 0,
    paddingHorizontal: 10,
  },
  secondaryButtonText: {
    color: '#FFF7E8',
    fontSize: 17,
    fontWeight: '900',
  },
  dailyGoalCard: {
    backgroundColor: '#1D2635',
    borderColor: '#FFB23F',
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    minHeight: 84,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dailyGoalCardComplete: {
    borderColor: '#31C6A7',
  },
  dailyGoalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  dailyGoalCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  dailyGoalEyebrow: {
    color: '#FFB23F',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  dailyGoalEyebrowComplete: {
    color: '#8DEBD3',
  },
  dailyGoalTitle: {
    color: '#FFF7E8',
    fontSize: 18,
    fontWeight: '900',
  },
  dailyGoalValue: {
    color: '#FFF7E8',
    fontSize: 24,
    fontWeight: '900',
    minWidth: 56,
    textAlign: 'right',
  },
  dailyGoalTrack: {
    backgroundColor: '#263248',
    borderRadius: 5,
    height: 10,
    overflow: 'hidden',
  },
  dailyGoalFill: {
    backgroundColor: '#31C6A7',
    borderRadius: 5,
    height: '100%',
  },
  reviewButton: {
    alignItems: 'center',
    backgroundColor: '#1D2635',
    borderColor: '#45B7D1',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    minHeight: 68,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  reviewCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  reviewTitle: {
    color: '#FFF7E8',
    fontSize: 17,
    fontWeight: '900',
  },
  reviewLabel: {
    color: '#A7B0C4',
    fontSize: 12,
    fontWeight: '800',
  },
  reviewCountPill: {
    alignItems: 'center',
    backgroundColor: '#45B7D1',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 38,
    minWidth: 48,
    paddingHorizontal: 10,
  },
  reviewCountText: {
    color: '#10151F',
    fontSize: 18,
    fontWeight: '900',
  },
  missionCard: {
    backgroundColor: '#1D2635',
    borderColor: '#31C6A7',
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    minHeight: 72,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  missionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  missionEyebrow: {
    color: '#8DEBD3',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  missionLevelPill: {
    color: '#FFB23F',
    fontSize: 12,
    fontWeight: '900',
  },
  missionTitle: {
    color: '#FFF7E8',
    fontSize: 19,
    fontWeight: '900',
  },
  nextStepCard: {
    alignItems: 'center',
    backgroundColor: '#1D2635',
    borderColor: '#7A80FF',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    minHeight: 78,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  nextStepCardReview: {
    borderColor: '#EF5D60',
  },
  nextStepCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  nextStepEyebrow: {
    color: '#A9ADFF',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  nextStepTitle: {
    color: '#FFF7E8',
    fontSize: 18,
    fontWeight: '900',
  },
  nextStepBody: {
    color: '#A7B0C4',
    fontSize: 12,
    fontWeight: '800',
  },
  nextStepActionPill: {
    alignItems: 'center',
    backgroundColor: '#7A80FF',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 38,
    minWidth: 86,
    paddingHorizontal: 10,
  },
  nextStepActionText: {
    color: '#FFF7E8',
    fontSize: 13,
    fontWeight: '900',
  },
  snapshotRow: {
    flexDirection: 'row',
    gap: 10,
  },
  miniStat: {
    backgroundColor: '#1D2635',
    borderRadius: 8,
    flex: 1,
    minHeight: 74,
    minWidth: 0,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  miniStatValue: {
    color: '#FFF7E8',
    fontSize: 19,
    fontWeight: '900',
  },
  miniStatLabel: {
    color: '#A7B0C4',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 5,
  },
  badgePanel: {
    gap: 8,
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badgeCard: {
    backgroundColor: '#1D2635',
    borderColor: '#2E3A4E',
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: '48%',
    flexGrow: 1,
    minHeight: 76,
    minWidth: 0,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  badgeCardUnlocked: {
    borderColor: '#FFB23F',
  },
  badgeStatus: {
    color: '#78849A',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  badgeStatusUnlocked: {
    color: '#FFB23F',
  },
  badgeTitle: {
    color: '#FFF7E8',
    fontSize: 15,
    fontWeight: '900',
    marginTop: 5,
  },
  badgeProgress: {
    color: '#A7B0C4',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 4,
  },
  levelProgressPanel: {
    gap: 8,
  },
  levelProgressRow: {
    backgroundColor: '#1D2635',
    borderColor: '#2E3A4E',
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    minHeight: 54,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  levelProgressHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  levelProgressLevel: {
    color: '#FFF7E8',
    fontSize: 15,
    fontWeight: '900',
  },
  levelProgressValue: {
    color: '#A7B0C4',
    fontSize: 12,
    fontWeight: '900',
  },
  levelProgressTrack: {
    backgroundColor: '#263248',
    borderRadius: 5,
    height: 10,
    overflow: 'hidden',
  },
  levelProgressFill: {
    borderRadius: 5,
    height: '100%',
  },
  playBody: {
    flex: 1,
    gap: 12,
    minWidth: 0,
    padding: 20,
    paddingTop: 8,
  },
  scoreStrip: {
    flexDirection: 'row',
    gap: 8,
    minWidth: 0,
  },
  timerTrack: {
    backgroundColor: '#263248',
    borderRadius: 6,
    height: 10,
    overflow: 'hidden',
  },
  timerFill: {
    borderRadius: 6,
    height: '100%',
  },
  questionPanel: {
    alignItems: 'center',
    backgroundColor: '#FFF7E8',
    borderRadius: 8,
    borderWidth: 3,
    justifyContent: 'center',
    minHeight: 188,
    minWidth: 0,
    padding: 16,
  },
  questionMeta: {
    color: '#E84F5A',
    fontSize: 13,
    fontWeight: '900',
    paddingHorizontal: 44,
    textAlign: 'center',
  },
  pronunciationButton: {
    alignItems: 'center',
    backgroundColor: '#E8E0D2',
    borderRadius: 8,
    height: 40,
    justifyContent: 'center',
    position: 'absolute',
    right: 10,
    top: 10,
    width: 40,
  },
  pronunciationButtonActive: {
    backgroundColor: '#31C6A7',
  },
  pronunciationButtonText: {
    fontSize: 20,
  },
  questionText: {
    color: '#10151F',
    fontSize: 48,
    fontWeight: '900',
    lineHeight: 58,
    marginVertical: 10,
    maxWidth: '100%',
    textAlign: 'center',
  },
  grammarQuestionText: {
    fontSize: 32,
    lineHeight: 42,
  },
  questionTopic: {
    color: '#566073',
    fontSize: 13,
    fontWeight: '800',
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    minWidth: 0,
  },
  optionButton: {
    alignItems: 'center',
    backgroundColor: '#263248',
    borderColor: '#394964',
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: '48.5%',
    flexGrow: 1,
    height: 104,
    justifyContent: 'center',
    padding: 10,
  },
  optionCorrect: {
    backgroundColor: '#31C6A7',
    borderColor: '#8DEBD3',
  },
  optionWrong: {
    backgroundColor: '#EF5D60',
    borderColor: '#FFB0B0',
  },
  optionText: {
    color: '#FFF7E8',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  optionTextActive: {
    color: '#10151F',
  },
  playActions: {
    gap: 10,
  },
  feedbackBar: {
    alignItems: 'center',
    minHeight: 38,
    justifyContent: 'center',
  },
  feedbackText: {
    color: '#8DEBD3',
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  feedbackBad: {
    color: '#FFB0B0',
  },
  answerHintCard: {
    backgroundColor: '#182235',
    borderColor: '#31C6A7',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 64,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  answerHintCardBad: {
    borderColor: '#EF5D60',
  },
  answerHintTitle: {
    color: '#8DEBD3',
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
  },
  answerHintDetail: {
    color: '#D7DEEF',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 3,
    textAlign: 'center',
  },
  adButton: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#7A80FF',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 42,
    minWidth: 190,
    paddingHorizontal: 14,
  },
  adButtonText: {
    color: '#FFF7E8',
    fontSize: 15,
    fontWeight: '900',
  },
  adLoadingContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  continuePanel: {
    alignItems: 'center',
    backgroundColor: '#FFF7E8',
    borderColor: '#FFB23F',
    borderRadius: 8,
    borderWidth: 3,
    flex: 1,
    gap: 14,
    justifyContent: 'center',
    minHeight: 360,
    padding: 24,
  },
  continueTitle: {
    color: '#10151F',
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
  },
  continueBody: {
    color: '#566073',
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
    textAlign: 'center',
  },
  continueFeedback: {
    color: '#E84F5A',
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
  },
  continueActions: {
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  finishRunButton: {
    alignItems: 'center',
    borderColor: '#566073',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 42,
    minWidth: 190,
    paddingHorizontal: 14,
  },
  finishRunButtonText: {
    color: '#263248',
    fontSize: 15,
    fontWeight: '900',
  },
  finishBody: {
    gap: 16,
    padding: 20,
    paddingBottom: 30,
  },
  finishPanel: {
    alignItems: 'center',
    backgroundColor: '#FFF7E8',
    borderRadius: 8,
    padding: 24,
  },
  finishKicker: {
    color: '#E84F5A',
    fontSize: 14,
    fontWeight: '900',
  },
  finishScore: {
    color: '#10151F',
    fontSize: 72,
    fontWeight: '900',
    lineHeight: 82,
    marginTop: 6,
  },
  finishLabel: {
    color: '#566073',
    fontSize: 14,
    fontWeight: '900',
  },
  missionResultCard: {
    backgroundColor: '#1D2635',
    borderColor: '#394964',
    borderRadius: 8,
    borderWidth: 1,
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  missionResultComplete: {
    backgroundColor: '#31C6A7',
    borderColor: '#8DEBD3',
  },
  missionResultTitle: {
    color: '#FFF7E8',
    fontSize: 17,
    fontWeight: '900',
  },
  missionResultTitleComplete: {
    color: '#10151F',
  },
  missionResultBody: {
    color: '#A7B0C4',
    fontSize: 13,
    fontWeight: '800',
  },
  missionResultBodyComplete: {
    color: '#16352E',
  },
  recapPanel: {
    backgroundColor: '#1D2635',
    borderColor: '#2E3A4E',
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  recapTitle: {
    color: '#FFF7E8',
    fontSize: 17,
    fontWeight: '900',
  },
  recapStatsRow: {
    borderBottomColor: '#2E3A4E',
    borderBottomWidth: 1,
    borderTopColor: '#2E3A4E',
    borderTopWidth: 1,
    flexDirection: 'row',
  },
  recapStat: {
    flex: 1,
    minHeight: 54,
    justifyContent: 'center',
    paddingVertical: 8,
  },
  recapStatValue: {
    color: '#FFB23F',
    fontSize: 19,
    fontWeight: '900',
  },
  recapStatLabel: {
    color: '#A7B0C4',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 3,
  },
  recapReviewButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#45B7D1',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 38,
    minWidth: 140,
    paddingHorizontal: 12,
  },
  recapReviewButtonText: {
    color: '#10151F',
    fontSize: 14,
    fontWeight: '900',
  },
  recapBody: {
    color: '#8DEBD3',
    fontSize: 13,
    fontWeight: '800',
  },
  settingsOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
    zIndex: 10,
  },
  settingsBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(5, 8, 13, 0.68)',
  },
  settingsPanel: {
    backgroundColor: '#172131',
    borderTopColor: '#2E3A4E',
    borderTopWidth: 1,
    gap: 14,
    maxHeight: '82%',
    padding: 20,
  },
  settingsContent: {
    gap: 14,
    paddingBottom: 4,
  },
  settingsHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  settingsTitle: {
    color: '#FFF7E8',
    flex: 1,
    fontSize: 24,
    fontWeight: '900',
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: '#263248',
    borderColor: '#394964',
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 40,
    minWidth: 74,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  closeButtonText: {
    color: '#FFF7E8',
    fontSize: 14,
    fontWeight: '900',
  },
  settingsSectionLabel: {
    color: '#A7B0C4',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  settingsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  settingChoice: {
    alignItems: 'center',
    backgroundColor: '#263248',
    borderColor: '#394964',
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: '31%',
    flexGrow: 1,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 10,
  },
  settingChoiceSelected: {
    backgroundColor: '#31C6A7',
    borderColor: '#8DEBD3',
  },
  settingChoiceText: {
    color: '#FFF7E8',
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
  },
  settingChoiceTextSelected: {
    color: '#10151F',
  },
  musicRow: {
    flexDirection: 'row',
  },
  musicToggle: {
    alignItems: 'center',
    backgroundColor: '#263248',
    borderColor: '#394964',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 46,
  },
  musicToggleOn: {
    backgroundColor: '#FFB23F',
    borderColor: '#FFD48B',
  },
  musicToggleText: {
    color: '#FFF7E8',
    fontSize: 15,
    fontWeight: '900',
  },
  musicToggleTextOn: {
    color: '#10151F',
  },
  linkRow: {
    flexDirection: 'row',
    gap: 8,
  },
  linkStack: {
    gap: 8,
  },
  linkButton: {
    alignItems: 'center',
    backgroundColor: '#263248',
    borderColor: '#FFB23F',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 10,
  },
  linkButtonWide: {
    alignItems: 'center',
    backgroundColor: '#263248',
    borderColor: '#FFB23F',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 10,
  },
  linkButtonLocal: {
    borderColor: '#31C6A7',
  },
  resetButton: {
    alignItems: 'center',
    backgroundColor: '#263248',
    borderColor: '#45B7D1',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 10,
  },
  resetButtonConfirm: {
    backgroundColor: '#EF5D60',
    borderColor: '#FFB3B6',
  },
  resetButtonText: {
    color: '#FFF7E8',
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
  },
  resetButtonTextConfirm: {
    color: '#10151F',
  },
  linkButtonText: {
    color: '#FFF7E8',
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
  },
  linkStatusText: {
    color: '#A7B0C4',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  localCompliancePanel: {
    backgroundColor: '#182235',
    borderColor: '#31C6A7',
    borderRadius: 8,
    borderWidth: 1,
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  localComplianceTitle: {
    color: '#8DEBD3',
    fontSize: 13,
    fontWeight: '900',
  },
  localComplianceBody: {
    color: '#D7DEEF',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
});
