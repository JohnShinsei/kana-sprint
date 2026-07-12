# AdMob Release Audit

This audit checks the rewarded-ad release path without marking external AdMob account work as complete.

## Summary

- Risk: PASS
- Local ad integration ready: Yes
- Current state: NO_LIVE_ADS
- Live AdMob ready: No
- Google Mobile Ads plugin injected in current config: No
- External privacy messaging ready: No
- External blocking items: 2
- Local failures: 0

## Environment

| Key | Configured | Valid production format | Client visible |
| --- | --- | --- | --- |
| `EXPO_PUBLIC_ADMOB_IOS_APP_ID` | No | No | Yes |
| `EXPO_PUBLIC_ADMOB_ANDROID_APP_ID` | No | No | Yes |
| `EXPO_PUBLIC_ADMOB_REWARDED_IOS_UNIT_ID` | No | No | Yes |
| `EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_UNIT_ID` | No | No | Yes |

## Native Config

- Plugin absent without IDs: Yes
- Plugin injected with valid IDs: Yes
- Plugin absent with placeholder IDs: Yes
- Plugin absent with Google demo IDs: Yes
- Current plugin injected: No
- Delay app measurement init: Yes
- SKAdNetwork items: 50
- Live ads enabled without IDs: No
- Live ads enabled with placeholder IDs: No
- Live ads enabled with Google demo IDs: No
- Live ads enabled with valid IDs: Yes
- Live ads enabled in current config: No

## Runtime Flow

| Check | Passed | Evidence |
| --- | --- | --- |
| ui-entry | Yes | Rewarded-ad continue entry exists in gameplay UI |
| settings-privacy | Yes | Settings exposes ad privacy options when UMP requires them |
| native-consent | Yes | Native ad flow requests UMP consent info before ads load |
| native-reward | Yes | Native rewarded ad lifecycle grants reward only after earned reward event |
| native-id-guard | Yes | Native runtime rejects placeholder and Google demo AdMob IDs |
| request-config | Yes | Native ad request config limits ad content and uses non-personalized ad requests |
| web-guard | Yes | Web export is guarded from the native Google Mobile Ads SDK |
| config-guard | Yes | Expo config injects Google Mobile Ads only when all production IDs are valid |
| env-template | Yes | .env.example documents every AdMob and privacy confirmation key |
| privacy-evidence | Yes | Privacy answer pack and policy document no-live/live-AdMob states |
| external-checklists | Yes | External readiness and EAS env checklists include AdMob release actions |

## Privacy Evidence

- App Store privacy answer state: NO_LIVE_ADS
- Privacy confirmation env: `APP_STORE_PRIVACY_ANSWERS_REVIEWED`
- Live-AdMob disclosure rows: 6
- Privacy manifest risk: PASS
- App-code personal data collection: No
- AdMob Privacy & messaging confirmed: No

## External Actions

- [TODO] Live AdMob IDs: Create production AdMob app IDs and rewarded ad-unit IDs, then set all four EXPO_PUBLIC_ADMOB_* values.
- [TODO] ADMOB_PRIVACY_MESSAGES_CONFIGURED: Configure AdMob Privacy & messaging for release regions and verify UMP canRequestAds in a production build before setting this to 1.

## Commands

- `npm run ads:audit`
- `npm run privacy:answers`
- `npm run eas:env-checklist`
- `npm run release:verify`
- `npm run release:store-ready`

## Official References

- Expo SDK 56 reference: https://docs.expo.dev/versions/v56.0.0/
- React Native Google Mobile Ads: https://docs.page/invertase/react-native-google-mobile-ads
- Google Mobile Ads iOS privacy disclosure: https://developers.google.com/admob/ios/privacy/data-disclosure
- Google Mobile Ads iOS test ads: https://developers.google.com/admob/ios/test-ads
- Google Mobile Ads Android test ads: https://developers.google.com/admob/android/test-ads
- Apple App Privacy Details: https://developer.apple.com/app-store/app-privacy-details/
