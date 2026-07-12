# Privacy Review Packet

Use this packet while filling App Store Connect App Privacy. It summarizes the generated privacy answers, iOS privacy manifest, runtime data-flow audit, and AdMob release audit for the exact current build state.

## Summary

- Risk: PASS
- Local privacy evidence ready: Yes
- Current build state: NO_LIVE_ADS
- Final App Store privacy review confirmed: No
- Confirmation env: `APP_STORE_PRIVACY_ANSWERS_REVIEWED`
- App-code personal data collection: No
- Account required: No
- Tracking declared by app code: No
- Privacy manifest tracking: No
- Privacy manifest collected data types: 0
- App-owned network requests: 0
- Analytics SDK hits: 0
- Auth SDK hits: 0
- User-content entry hits: 0
- AdMob state: NO_LIVE_ADS
- Live ads ready: No
- External AdMob setup ready: No

## App Store Connect Privacy Answers

Current no-live-ads posture:

| Field | Suggested answer | Rationale |
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

## Local Checks

| Check | Status |
| --- | --- |
| App Store privacy answer pack passes locally | Pass |
| Privacy answer pack identifies no-live-ads or live-AdMob state | Pass |
| No-live-ads and live-AdMob answer rows are populated | Pass |
| App code does not collect personal data, require accounts, or declare tracking | Pass |
| Privacy manifest has no tracking, no collected data types, and required-reason APIs ready | Pass |
| Runtime data flow has no app-owned network, analytics, auth, or user-content entries | Pass |
| AdMob integration boundary passes locally and records external setup state | Pass |

## Live AdMob Build Review

Before enabling live AdMob for the submitted archive:

- Confirm react-native-google-mobile-ads is present in the resolved Expo plugins for the production archive.
- Open the final iOS privacy report for the archived build and compare Google Mobile Ads SDK declarations.
- Review the current Google Mobile Ads SDK data disclosure page for the SDK version in the submitted build.
- Configure AdMob Privacy & messaging for the release regions and verify UMP canRequestAds on device.
- Decide the App Tracking Transparency and IDFA answer based on final ad configuration, mediation, and regional consent behavior.
- Set APP_STORE_PRIVACY_ANSWERS_REVIEWED=1 only after App Store Connect privacy answers match the exact submitted build.

Likely Google Mobile Ads rows to review against the final SDK privacy report:

| Apple data type | Likely purposes | Linked to user | Tracking |
| --- | --- | --- | --- |
| Coarse Location | Third-Party Advertising, Analytics, App Functionality | Review final Google Mobile Ads SDK privacy report and App Store Connect wording. | Review final ATT, mediation, and ad personalization configuration. |
| Crash Data | App Functionality, Analytics | Review final Google Mobile Ads SDK privacy report and App Store Connect wording. | Review final ATT, mediation, and ad personalization configuration. |
| Performance Data | App Functionality, Analytics, Third-Party Advertising | Review final Google Mobile Ads SDK privacy report and App Store Connect wording. | Review final ATT, mediation, and ad personalization configuration. |
| Device ID | Third-Party Advertising, Analytics | Review final Google Mobile Ads SDK privacy report and App Store Connect wording. | Review final ATT, mediation, and ad personalization configuration. |
| Advertising Data | Third-Party Advertising, Analytics | Review final Google Mobile Ads SDK privacy report and App Store Connect wording. | Review final ATT, mediation, and ad personalization configuration. |
| Product Interaction | Third-Party Advertising, Analytics | Review final Google Mobile Ads SDK privacy report and App Store Connect wording. | Review final ATT, mediation, and ad personalization configuration. |

## Evidence Files

| Evidence | Path | Risk | Exists |
| --- | --- | --- | --- |
| App Store privacy answers | docs/app-store-privacy-answers.md | PASS | Yes |
| iOS privacy manifest audit | docs/privacy-manifest-audit.md | PASS | Yes |
| Data flow privacy audit | docs/data-flow-privacy-audit.md | PASS | Yes |
| AdMob release audit | docs/admob-release-audit.md | PASS | Yes |
| External readiness checklist | docs/external-readiness.md | TODO | Yes |

## Local Verification

- `npm run privacy:review-packet`
- `npm run release:verify`

## Remaining External Confirmation

- Set `APP_STORE_PRIVACY_ANSWERS_REVIEWED=1` only after App Store Connect App Privacy matches the submitted build and third-party SDK behavior.
- Keep no-live-ads answers only while `extra.admob.liveAdsEnabled` is false.
- If live AdMob IDs are enabled, review Google Mobile Ads SDK disclosures, AdMob Privacy & messaging, UMP consent behavior, ATT/IDFA decisions, and the final Xcode privacy report before submission.
