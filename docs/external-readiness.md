# External Readiness Checklist

This checklist maps the external `release:status` rows to the exact account or store actions needed before App Store submission.

## Summary

- OK: 4
- TODO: 7
- BAD: 0
- INFO: 0
- Blocking external items: 7

## Items

### Public support URL

- Status: OK
- System: Public HTTPS hosting + App Store Connect metadata
- Env: `APP_STORE_BASE_URL`, `APP_STORE_SUPPORT_URL`
- Current detail: https://johnshinsei.github.io/kana-sprint-site/support
- Action: Host site/ over HTTPS and expose the support page. APP_STORE_BASE_URL can generate /support automatically, or APP_STORE_SUPPORT_URL can point to a custom production HTTPS URL.
- Evidence: The support URL opens without auth, redirects, localhost, .test, .local, or example domains, and docs/public-site-hosting-verification.md reports a live PASS.
- Verify with: `npm run site:localized`, `npm run site:manifest`, `npm run site:deploy-audit`, `npm run site:verify-hosting`, `npm run release:status`

### Public privacy URL

- Status: OK
- System: Public HTTPS hosting + App Store Connect metadata
- Env: `APP_STORE_BASE_URL`, `APP_STORE_PRIVACY_URL`
- Current detail: https://johnshinsei.github.io/kana-sprint-site/privacy
- Action: Host site/ over HTTPS and expose the privacy policy page. APP_STORE_BASE_URL can generate /privacy automatically, or APP_STORE_PRIVACY_URL can point to a custom production HTTPS URL.
- Evidence: The privacy URL opens without auth, matches docs/app-store-privacy-answers.md plus the final AdMob state, and docs/public-site-hosting-verification.md reports a live PASS.
- Verify with: `npm run site:localized`, `npm run site:manifest`, `npm run site:deploy-audit`, `npm run site:verify-hosting`, `npm run release:status`

### Public marketing URL

- Status: OK
- System: Public HTTPS hosting + App Store Connect metadata
- Env: `APP_STORE_BASE_URL`, `APP_STORE_MARKETING_URL`
- Current detail: https://johnshinsei.github.io/kana-sprint-site
- Action: Optional. Set APP_STORE_MARKETING_URL or APP_STORE_BASE_URL if the App Store listing should include a marketing URL.
- Evidence: A production HTTPS marketing URL is available, or this optional field is intentionally left blank.
- Verify with: `npm run release:status`

### App Store review contact

- Status: TODO
- System: App Store Connect
- Env: `APP_STORE_REVIEW_FIRST_NAME`, `APP_STORE_REVIEW_LAST_NAME`, `APP_STORE_REVIEW_EMAIL`, `APP_STORE_REVIEW_PHONE`
- Current detail: Missing: APP_STORE_REVIEW_FIRST_NAME, APP_STORE_REVIEW_LAST_NAME, APP_STORE_REVIEW_EMAIL, APP_STORE_REVIEW_PHONE
- Action: Add the review contact that Apple can use during App Review. Use a monitored email address and a reachable phone number.
- Evidence: store.config.js resolves apple.review, metadata preview shows reviewContactReady=true, and release:status reports the contact OK.
- Verify with: `npm run metadata:preview`, `npm run release:status`

### Live AdMob IDs

- Status: TODO
- System: Google AdMob + EAS Build env
- Env: `EXPO_PUBLIC_ADMOB_IOS_APP_ID`, `EXPO_PUBLIC_ADMOB_ANDROID_APP_ID`, `EXPO_PUBLIC_ADMOB_REWARDED_IOS_UNIT_ID`, `EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_UNIT_ID`
- Current detail: No production AdMob IDs are set; live rewarded ads remain disabled.
- Action: Create production AdMob apps and rewarded ad units, then put the real app IDs and ad unit IDs into .env.local and the EAS production environment.
- Evidence: App IDs use ca-app-pub-0000000000000000~0000000000, ad unit IDs use ca-app-pub-0000000000000000/0000000000, and app.config.js enables liveAdsEnabled.
- Verify with: `npm run release:status`, `npx expo config --json`

### APP_STORE_BUNDLE_ID_CONFIRMED

- Status: TODO
- System: Apple Developer + App Store Connect
- Env: `APP_STORE_BUNDLE_ID_CONFIRMED`
- Current detail: Set to 1 only after the real external action is complete.
- Action: Confirm app.json ios.bundleIdentifier and android.package are the final store identifiers before the first production build.
- Evidence: The identifiers in app.json match Apple Developer, App Store Connect, Google Play/AdMob records, and EAS project settings.
- Verify with: `npm run release:status`, `npx expo config --json`

### APP_STORE_CONNECT_RECORD_READY

- Status: TODO
- System: App Store Connect
- Env: `APP_STORE_CONNECT_RECORD_READY`
- Current detail: Set to 1 only after the real external action is complete.
- Action: Create the App Store Connect app record for the final bundle ID and fill the app category, age rating, pricing, availability, and required compliance fields.
- Evidence: The App Store Connect record exists for com.john.kanasprint, and metadata can be pushed with EAS Metadata after release:store-ready passes.
- Verify with: `npm run release:status`, `npm run metadata:ios`

### EAS_REMOTE_VERSION_INITIALIZED

- Status: OK
- System: Expo EAS
- Env: `EAS_REMOTE_VERSION_INITIALIZED`
- Current detail: Confirmed.
- Action: Log in to Expo and run npx eas-cli build:version:set once for the production iOS app because eas.json uses remote app version management.
- Evidence: EAS remote version state exists for the production profile and app.json buildNumber no longer needs local manual increments.
- Verify with: `npx eas-cli build:version:set`, `npm run release:status`

### APP_STORE_PRIVACY_ANSWERS_REVIEWED

- Status: TODO
- System: App Store Connect privacy questionnaire
- Env: `APP_STORE_PRIVACY_ANSWERS_REVIEWED`
- Current detail: Set to 1 only after the real external action is complete.
- Action: Fill App Store Connect privacy answers from docs/app-store-privacy-answers.md after deciding whether live AdMob IDs are enabled for the submitted build.
- Evidence: The App Store privacy questionnaire matches the final build, optional rewarded ads, local-only progress storage, and iOS privacy manifest.
- Verify with: `npm run release-check`, `npm run release:status`

### ADMOB_PRIVACY_MESSAGES_CONFIGURED

- Status: TODO
- System: Google AdMob Privacy & messaging
- Env: `ADMOB_PRIVACY_MESSAGES_CONFIGURED`
- Current detail: Set to 1 only after the real external action is complete.
- Action: Configure required AdMob Privacy & messaging flows for release regions and verify UMP canRequestAds before requesting rewarded ads.
- Evidence: A production/TestFlight build confirms privacy options and rewarded ads behave correctly with the real AdMob account.
- Verify with: `npm run release:status`, `physical iPhone or TestFlight ad-flow test`

### PRODUCTION_DEVICE_TESTED

- Status: TODO
- System: Physical iPhone or TestFlight
- Env: `PRODUCTION_DEVICE_TESTED`
- Current detail: Set to 1 only after the real external action is complete.
- Action: Install the production archive or TestFlight build on a real iPhone and complete docs/production-device-smoke-test.md for first launch, language selection, N5-N1 game loop, settings, support/privacy/open-source links, BGM, and rewarded-ad continue path.
- Evidence: The exact production build that will be submitted has passed the manual smoke path on device.
- Verify with: `npm run release:store-ready`, `npm run build:ios`, `docs/production-device-smoke-test.md`

## Final Command Order

1. npm run release:verify
2. npm run release:store-ready
3. npm run metadata:ios
4. npm run build:ios
5. npm run submit:ios
