# AdMob Setup

Kana Sprint currently includes the rewarded-ad gameplay entry point:

- Button: "Watch ad to continue" / localized equivalent
- Reward: +15 seconds, +1 life, once per run
- Code: `src/ads.ts`
- Native SDK: `react-native-google-mobile-ads`
- Native plugin injection: `app.config.js`

The app is wired so local Web, Expo Go, and builds without valid IDs do not include the native Google Mobile Ads plugin. When all four AdMob IDs below are present and valid, `app.config.js` adds the native plugin automatically for EAS builds.

## Required IDs

Create separate iOS and Android apps in AdMob, then create rewarded ad units for both platforms.

Add these values to `.env.local`:

```bash
EXPO_PUBLIC_ADMOB_IOS_APP_ID=ca-app-pub-xxxxxxxxxxxxxxxx~yyyyyyyyyy
EXPO_PUBLIC_ADMOB_ANDROID_APP_ID=ca-app-pub-xxxxxxxxxxxxxxxx~yyyyyyyyyy
EXPO_PUBLIC_ADMOB_REWARDED_IOS_UNIT_ID=ca-app-pub-xxxxxxxxxxxxxxxx/yyyyyyyyyy
EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_UNIT_ID=ca-app-pub-xxxxxxxxxxxxxxxx/yyyyyyyyyy
```

## Production wiring

Use an EAS development build or production build. Expo Go cannot load this native SDK.

Do not submit with placeholder or test AdMob app IDs. The native Google Mobile Ads SDK requires valid platform App IDs, and invalid values can crash on launch or fail build validation.

Once IDs are available:

1. Add all four values to `.env.local` locally or to EAS environment variables for cloud builds.
2. Run `npx expo config --json` and confirm `extra.admob.liveAdsEnabled` is `true`.
3. Run `npm run typecheck`, `npm run doctor`, and `npm run release-check`.
4. Build with EAS and test rewarded ads on a physical device.
5. Configure AdMob Privacy & messaging for the release regions so UMP can show the required consent or privacy options forms.
6. Update App Store privacy answers for the Google Mobile Ads SDK behavior before submission.

## Current safe behavior

Without valid production IDs, release builds will not show live ads. Development builds grant the reward through a mock path so the gameplay flow can be tested without accidental policy issues.

Ad requests default to non-personalized ads in `src/ads.native.ts`, and app measurement initialization is delayed in the native plugin config. Before a rewarded ad loads, the app requests updated UMP consent information, presents any required consent form, and only requests ads when UMP reports `canRequestAds`. If UMP reports that a privacy options entry point is required, Settings shows an Ad privacy button that opens the UMP privacy options form.
