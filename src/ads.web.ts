export type RewardedAdResult =
  | { ok: true; source: 'mock' | 'live' }
  | { ok: false; reason: 'missing-admob-ids' | 'native-sdk-unavailable' | 'unavailable' | 'not-rewarded' };

export function hasLiveAdConfig() {
  return false;
}

export async function showRewardedContinueAd(): Promise<RewardedAdResult> {
  return { ok: false, reason: 'native-sdk-unavailable' };
}

export async function prepareRewardedAds() {
  return false;
}

export async function isAdPrivacyOptionsRequired() {
  return false;
}

export async function openAdPrivacyOptions() {
  return false;
}

export function shouldGrantDevelopmentReward() {
  return process.env.NODE_ENV !== 'production';
}
