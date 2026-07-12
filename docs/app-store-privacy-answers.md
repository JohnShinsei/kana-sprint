# App Store Privacy Answers

Use this file as a submission checklist, not as legal advice. Final App Store Connect answers must match the exact submitted build and any third-party SDKs included in that build.

## Current Build State

- State: NO_LIVE_ADS
- Live AdMob enabled: No
- Google Mobile Ads plugin injected: No
- Privacy manifest risk: PASS
- Privacy manifest tracking: No
- Privacy manifest collected data types: 0
- Final confirmation env: `APP_STORE_PRIVACY_ANSWERS_REVIEWED`

## App Code Practices

| Area | Current answer | Rationale |
| --- | --- | --- |
| Account creation | No | Kana Sprint has no sign-in, account creation, server sync, or user profile feature. |
| Gameplay progress | Local only | Scores, mastery, daily goal progress, settings, selected language, music, and difficulty are stored on device. |
| User content | No | The app has no free-text submission, upload, chat, or user-generated content surface. |
| Analytics | No | No analytics SDK or custom analytics endpoint is integrated. |
| Sensitive device APIs | No | No camera, contacts, location, microphone recording, or push notification feature is present. |
| Ads entry | Entry wired, live ads disabled | The rewarded-ad gameplay entry is present, but live ads remain disabled until valid production AdMob IDs are provided. |

## No Live AdMob IDs

Use this state only when the four `EXPO_PUBLIC_ADMOB_*` variables are empty or invalid and `npx expo config --json` reports `extra.admob.liveAdsEnabled` as `false`.

| App Store Connect field | Suggested answer | Rationale |
| --- | --- | --- |
| Data collected by this app | No | The app code stores progress, daily goal progress, and settings locally and does not transmit user data off device. |
| Tracking | No | No tracking SDK is initialized in this build state. |
| Account creation | No | No account, login, or demo account is required. |
| Analytics | No | No analytics SDK or analytics endpoint is present. |
| Location | No | No location permission or location API is used by app code. |
| Contacts | No | No contacts permission or contacts API is used. |
| User content | No | No user upload, chat, or free-form content submission exists. |
| Purchases | No | No in-app purchases or subscriptions exist. |
| Camera | No | No camera permission or camera API is used. |
| Microphone | No | The audio plugin is configured without microphone recording. |
| Push notifications | No | No push notification SDK or permission path exists. |

Reviewer-facing explanation:

Kana Sprint stores progress, daily goal progress, and settings locally on the device. The app has no account system, no analytics SDK, no server sync, no user-generated content, and no live ad SDK initialization in this build.

## Live AdMob IDs Enabled

Use this state when all four AdMob environment variables are valid and `npx expo config --json` reports `extra.admob.liveAdsEnabled` as `true`.

Kana Sprint's own gameplay data remains local-only in this state: progress, settings, high scores, daily streaks, daily goal progress, selected difficulty, and learned counts stay on device. The data disclosures change because the Google Mobile Ads SDK is integrated for optional rewarded ads.

Before submission:

- Confirm react-native-google-mobile-ads is present in the resolved Expo plugins for the production archive.
- Open the final iOS privacy report for the archived build and compare Google Mobile Ads SDK declarations.
- Review the current Google Mobile Ads SDK data disclosure page for the SDK version in the submitted build.
- Configure AdMob Privacy & messaging for the release regions and verify UMP canRequestAds on device.
- Decide the App Tracking Transparency and IDFA answer based on final ad configuration, mediation, and regional consent behavior.
- Set APP_STORE_PRIVACY_ANSWERS_REVIEWED=1 only after App Store Connect privacy answers match the exact submitted build.

Likely Google Mobile Ads disclosure rows to review:

| Apple data type | Basis | Likely purposes | Linked to user | Tracking |
| --- | --- | --- | --- | --- |
| Coarse Location | IP address may be used to estimate general device location. | Third-Party Advertising, Analytics, App Functionality | Review final Google Mobile Ads SDK privacy report and App Store Connect wording. | Review final ATT, mediation, and ad personalization configuration. |
| Crash Data | Non-user related crash logs may be used to diagnose problems and improve the SDK. | App Functionality, Analytics | Review final Google Mobile Ads SDK privacy report and App Store Connect wording. | Review final ATT, mediation, and ad personalization configuration. |
| Performance Data | Performance data such as launch time, hang rate, or energy use may be collected. | App Functionality, Analytics, Third-Party Advertising | Review final Google Mobile Ads SDK privacy report and App Store Connect wording. | Review final ATT, mediation, and ad personalization configuration. |
| Device ID | Advertising identifier or other device-level IDs may be used by the ad SDK. | Third-Party Advertising, Analytics | Review final Google Mobile Ads SDK privacy report and App Store Connect wording. | Review final ATT, mediation, and ad personalization configuration. |
| Advertising Data | Information about advertisements the user has seen may be used for ads and analytics features. | Third-Party Advertising, Analytics | Review final Google Mobile Ads SDK privacy report and App Store Connect wording. | Review final ATT, mediation, and ad personalization configuration. |
| Product Interaction | Ad views, app launches, taps, and video views may be used to improve advertising performance. | Third-Party Advertising, Analytics | Review final Google Mobile Ads SDK privacy report and App Store Connect wording. | Review final ATT, mediation, and ad personalization configuration. |

Suggested reviewer note addition:

Rewarded ads are available only through the continue-run entry point. Ad requests are configured for non-personalized ads by default. The app itself has no account, analytics, location, contacts, camera, microphone, or user-generated content features, and gameplay progress remains on device. When UMP says privacy options are required, Settings includes an Ad privacy entry that opens the privacy options form.

## Official References

- Apple App Privacy Details: https://developer.apple.com/app-store/app-privacy-details/
  Reason: Apple requires privacy answers to include the app and integrated third-party partners.
- Apple Manage App Privacy: https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/
  Reason: Privacy Policy URL and App Privacy details are maintained in App Store Connect.
- Google Mobile Ads iOS Data Disclosure: https://developers.google.com/admob/ios/privacy/data-disclosure
  Reason: Google lists Mobile Ads SDK data types that may need App Store disclosure.
- Google Mobile Ads iOS Privacy Strategies: https://developers.google.com/admob/ios/privacy/strategies
  Reason: AdMob privacy and consent behavior must match the production ad setup.

## Local Verification

- `npm run privacy:manifest`
- `npm run privacy:answers`
- `npm run release:verify`
- `npm run release:store-ready`
