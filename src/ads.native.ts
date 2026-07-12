import { Platform } from 'react-native';

type GoogleMobileAdsModule = typeof import('react-native-google-mobile-ads');

export type RewardedAdResult =
  | { ok: true; source: 'mock' | 'live' }
  | { ok: false; reason: 'missing-admob-ids' | 'native-sdk-unavailable' | 'unavailable' | 'not-rewarded' };

const admobAppIdPattern = /^ca-app-pub-\d{16}~\d{10}$/;
const admobUnitIdPattern = /^ca-app-pub-\d{16}\/\d{10}$/;
const admobPlaceholderPattern = /^ca-app-pub-0{16}[~/]0{10}$/;
const admobDemoPublisherPattern = /^ca-app-pub-3940256099942544[~/]/;
const rewardedLoadTimeoutMs = 12000;
const rewardedShowTimeoutMs = 45000;

let mobileAdsInitialization: Promise<void> | null = null;
let adsConsentPreparation: Promise<boolean> | null = null;

export function hasLiveAdConfig() {
  return Boolean(
    isRealAdMobId(process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID, admobAppIdPattern) &&
      isRealAdMobId(process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID, admobAppIdPattern) &&
      isRealAdMobId(process.env.EXPO_PUBLIC_ADMOB_REWARDED_IOS_UNIT_ID, admobUnitIdPattern) &&
      isRealAdMobId(process.env.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_UNIT_ID, admobUnitIdPattern),
  );
}

function isRealAdMobId(value: string | undefined, pattern: RegExp) {
  return pattern.test(value ?? '') && !admobPlaceholderPattern.test(value ?? '') && !admobDemoPublisherPattern.test(value ?? '');
}

export async function showRewardedContinueAd(): Promise<RewardedAdResult> {
  const adUnitId = rewardedAdUnitId();

  if (!hasLiveAdConfig() || !adUnitId) {
    return { ok: false, reason: 'missing-admob-ids' };
  }

  const googleMobileAds = await loadGoogleMobileAds();
  if (!googleMobileAds) {
    return { ok: false, reason: 'native-sdk-unavailable' };
  }

  try {
    const canRequestAds = await prepareAdsConsent(googleMobileAds);
    if (!canRequestAds) {
      return { ok: false, reason: 'unavailable' };
    }

    await initializeMobileAds(googleMobileAds);
    return await showRewardedAd(googleMobileAds, adUnitId);
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}

export async function prepareRewardedAds() {
  if (!hasLiveAdConfig()) return false;

  const googleMobileAds = await loadGoogleMobileAds();
  if (!googleMobileAds) return false;

  return prepareAdsConsent(googleMobileAds);
}

export async function isAdPrivacyOptionsRequired() {
  if (!hasLiveAdConfig()) return false;

  const googleMobileAds = await loadGoogleMobileAds();
  if (!googleMobileAds) return false;

  try {
    return await getAdPrivacyOptionsRequired(googleMobileAds);
  } catch {
    return false;
  }
}

export async function openAdPrivacyOptions() {
  if (!hasLiveAdConfig()) return false;

  const googleMobileAds = await loadGoogleMobileAds();
  if (!googleMobileAds) return false;

  try {
    const isRequired = await getAdPrivacyOptionsRequired(googleMobileAds);
    if (!isRequired) return false;

    const consentInfo = await googleMobileAds.AdsConsent.showPrivacyOptionsForm();
    adsConsentPreparation = Promise.resolve(consentInfo.canRequestAds);
    return true;
  } catch {
    return false;
  }
}

export function shouldGrantDevelopmentReward() {
  return !hasLiveAdConfig() && process.env.NODE_ENV !== 'production';
}

async function loadGoogleMobileAds(): Promise<GoogleMobileAdsModule | null> {
  try {
    return await import('react-native-google-mobile-ads');
  } catch {
    return null;
  }
}

function prepareAdsConsent(googleMobileAds: GoogleMobileAdsModule) {
  if (!adsConsentPreparation) {
    adsConsentPreparation = googleMobileAds.AdsConsent.requestInfoUpdate({
      tagForUnderAgeOfConsent: false,
    })
      .then(() => googleMobileAds.AdsConsent.loadAndShowConsentFormIfRequired())
      .then((consentInfo) => consentInfo.canRequestAds)
      .catch(async () => {
        adsConsentPreparation = null;
        try {
          const consentInfo = await googleMobileAds.AdsConsent.getConsentInfo();
          return consentInfo.canRequestAds;
        } catch {
          return false;
        }
      });
  }

  return adsConsentPreparation;
}

async function getAdPrivacyOptionsRequired(googleMobileAds: GoogleMobileAdsModule) {
  await prepareAdsConsent(googleMobileAds);
  const consentInfo = await googleMobileAds.AdsConsent.getConsentInfo();

  return (
    consentInfo.privacyOptionsRequirementStatus ===
    googleMobileAds.AdsConsentPrivacyOptionsRequirementStatus.REQUIRED
  );
}

function initializeMobileAds(googleMobileAds: GoogleMobileAdsModule) {
  if (!mobileAdsInitialization) {
    mobileAdsInitialization = googleMobileAds
      .default()
      .setRequestConfiguration({
        maxAdContentRating: googleMobileAds.MaxAdContentRating.PG,
        tagForChildDirectedTreatment: false,
        tagForUnderAgeOfConsent: false,
      })
      .then(() => googleMobileAds.default().initialize())
      .then(() => undefined)
      .catch((error) => {
        mobileAdsInitialization = null;
        throw error;
      });
  }

  return mobileAdsInitialization;
}

function showRewardedAd(googleMobileAds: GoogleMobileAdsModule, adUnitId: string) {
  return new Promise<RewardedAdResult>((resolve) => {
    const rewardedAd = googleMobileAds.RewardedAd.createForAdRequest(adUnitId, {
      requestNonPersonalizedAdsOnly: true,
      keywords: ['education', 'language learning', 'japanese'],
    });
    let hasFinished = false;
    let hasEarnedReward = false;
    let showTimer: ReturnType<typeof setTimeout> | null = null;

    const finish = (result: RewardedAdResult) => {
      if (hasFinished) return;
      hasFinished = true;
      clearTimeout(loadTimer);
      if (showTimer) clearTimeout(showTimer);
      unsubscribeLoaded();
      unsubscribeEarnedReward();
      unsubscribeClosed();
      unsubscribeError();
      rewardedAd.removeAllListeners();
      resolve(result);
    };

    const loadTimer = setTimeout(() => {
      finish({ ok: false, reason: 'unavailable' });
    }, rewardedLoadTimeoutMs);

    const unsubscribeLoaded = rewardedAd.addAdEventListener(googleMobileAds.RewardedAdEventType.LOADED, () => {
      clearTimeout(loadTimer);
      showTimer = setTimeout(() => {
        finish({ ok: false, reason: 'unavailable' });
      }, rewardedShowTimeoutMs);

      void rewardedAd.show().catch(() => {
        finish({ ok: false, reason: 'unavailable' });
      });
    });

    const unsubscribeEarnedReward = rewardedAd.addAdEventListener(
      googleMobileAds.RewardedAdEventType.EARNED_REWARD,
      () => {
        hasEarnedReward = true;
      },
    );

    const unsubscribeClosed = rewardedAd.addAdEventListener(googleMobileAds.AdEventType.CLOSED, () => {
      finish(hasEarnedReward ? { ok: true, source: 'live' } : { ok: false, reason: 'not-rewarded' });
    });

    const unsubscribeError = rewardedAd.addAdEventListener(googleMobileAds.AdEventType.ERROR, () => {
      finish({ ok: false, reason: 'unavailable' });
    });

    rewardedAd.load();
  });
}

function rewardedAdUnitId() {
  if (Platform.OS === 'ios') return process.env.EXPO_PUBLIC_ADMOB_REWARDED_IOS_UNIT_ID;
  if (Platform.OS === 'android') return process.env.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_UNIT_ID;
  return undefined;
}
