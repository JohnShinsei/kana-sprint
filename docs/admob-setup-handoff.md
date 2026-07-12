# AdMob Setup Handoff

Use this handoff after local ad integration passes and before enabling live rewarded ads in the production App Store build.

## Summary

- Risk: PASS
- Local ad integration ready: Yes
- External AdMob ready: No
- External AdMob pending: Yes
- Current state: NO_LIVE_ADS
- Live ads ready: No
- All production IDs valid: No
- Google Mobile Ads plugin injected: No
- AdMob Privacy & messaging confirmed: No
- App Store privacy reviewed: No
- Production device tested: No
- Live-AdMob disclosure rows: 6

## Required AdMob Values

| Key | Meaning | Configured | Valid production format | Format hint |
| --- | --- | --- | --- | --- |
| `EXPO_PUBLIC_ADMOB_IOS_APP_ID` | iOS AdMob app ID | No | No | `ca-app-pub-0000000000000000~0000000000` |
| `EXPO_PUBLIC_ADMOB_ANDROID_APP_ID` | Android AdMob app ID | No | No | `ca-app-pub-0000000000000000~0000000000` |
| `EXPO_PUBLIC_ADMOB_REWARDED_IOS_UNIT_ID` | iOS rewarded ad-unit ID | No | No | `ca-app-pub-0000000000000000/0000000000` |
| `EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_UNIT_ID` | Android rewarded ad-unit ID | No | No | `ca-app-pub-0000000000000000/0000000000` |

EAS production env commands:

- `eas env:create --name EXPO_PUBLIC_ADMOB_IOS_APP_ID --environment production --visibility sensitive`
- `eas env:create --name EXPO_PUBLIC_ADMOB_ANDROID_APP_ID --environment production --visibility sensitive`
- `eas env:create --name EXPO_PUBLIC_ADMOB_REWARDED_IOS_UNIT_ID --environment production --visibility sensitive`
- `eas env:create --name EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_UNIT_ID --environment production --visibility sensitive`

## Manual Confirmations

| Key | Value | Status | Required evidence |
| --- | --- | --- | --- |
| `ADMOB_PRIVACY_MESSAGES_CONFIGURED` | `1` | Pending | AdMob Privacy & messaging is configured for release regions and UMP canRequestAds is verified in a production/TestFlight build. |
| `APP_STORE_PRIVACY_ANSWERS_REVIEWED` | `1` | Pending | App Store Connect privacy answers match the submitted build and final live-AdMob state. |
| `PRODUCTION_DEVICE_TESTED` | `1` | Pending | The exact production/TestFlight build passes docs/production-device-smoke-test.md including rewarded-ad continue and ad privacy paths. |

## AdMob Console Plan

1. Create or confirm the Google AdMob account owned by the publisher that will receive app revenue.
2. Create iOS and Android AdMob app records for com.john.kanasprint and com.john.kanasprint.
3. Create one rewarded ad unit for iOS and one rewarded ad unit for Android.
4. Copy only production AdMob app IDs and rewarded ad-unit IDs; do not use placeholder IDs or Google demo IDs for release builds.
5. Configure AdMob Privacy & messaging for the release regions and verify UMP canRequestAds before requesting rewarded ads.
6. Review App Store Connect App Privacy after enabling live AdMob, using docs/app-store-privacy-answers.md and docs/privacy-review-packet.md.

## App Store Privacy Plan

- Use the NO_LIVE_ADS privacy answers only while liveAdsEnabled is false.
- After all production AdMob IDs are valid, rerun npm run privacy:answers and npm run privacy:review-packet.
- Review Google Mobile Ads data disclosure rows and the final Xcode privacy report for the submitted build.
- Set APP_STORE_PRIVACY_ANSWERS_REVIEWED=1 only after App Store Connect matches the exact submitted archive.

## Production Test Plan

- Build a production/TestFlight archive after the four AdMob IDs are set in local and EAS production environments.
- Complete UMP consent or privacy messaging if shown before attempting rewarded ads.
- Tap the rewarded-ad continue entry during gameplay and verify the reward is granted once only after the earned-reward event.
- Open Settings and verify the Ad privacy options entry opens UMP privacy options when required, or explains unavailable state when not required.
- Complete docs/production-device-smoke-test.md before setting PRODUCTION_DEVICE_TESTED=1.

## Verification Order

1. npm run ads:audit
1. npm run privacy:answers
1. npm run privacy:data-flow
1. npm run privacy:review-packet
1. npm run device:smoke
1. npm run ads:handoff
1. npm run eas:env-checklist
1. npm run release:verify
1. npm run release:store-ready
1. npm run build:ios
1. npm run submit:ios

## Official References

- Expo SDK 56 reference: https://docs.expo.dev/versions/v56.0.0/
- React Native Google Mobile Ads: https://docs.page/invertase/react-native-google-mobile-ads
- Google Mobile Ads iOS privacy disclosure: https://developers.google.com/admob/ios/privacy/data-disclosure
- Google Mobile Ads iOS test ads: https://developers.google.com/admob/ios/test-ads
- Google Mobile Ads Android test ads: https://developers.google.com/admob/android/test-ads
- Apple App Privacy Details: https://developer.apple.com/app-store/app-privacy-details/
