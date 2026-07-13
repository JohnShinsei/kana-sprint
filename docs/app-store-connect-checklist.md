# App Store Connect Checklist

Use this file while filling App Store Connect fields that are not fully automated by EAS Metadata. Final answers must match the exact submitted build.

## App

- Name: Kana Sprint
- Version: 1.0.0
- Bundle ID: com.john.kanasprint
- Build number: 1
- Expo: ~56.0.15
- React Native: 0.85.3
- Encryption: No non-exempt encryption declared

## Metadata Snapshot

- Locales: zh-Hans, zh-Hant, en-US, fr-FR, it, de-DE, es-ES, ko, pl, pt-BR
- Default locale: en-US
- Categories: [["GAMES","GAMES_WORD"],"EDUCATION"]
- Copyright: 2026 Kana Sprint
- Review contact ready: No
- Support URLs ready: Yes
- Privacy URLs ready: Yes
- Screenshot entries: 176
- Screenshot QA audit: docs/screenshot-qa-audit.md
- Screenshot QA risk: PASS
- Screenshot QA ready: Yes
- Screenshot QA localized distinct: Yes
- Screenshot QA unexpected duplicate groups: 0
- App Store copy audit: docs/app-store-copy-audit.md
- App Store copy risk: PASS
- App Store copy ready locales: 10/10
- App Store copy keyword format ready: Yes
- App Store copy keyword byte limit ready: Yes
- App Store copy protected terms clear: Yes
- Metadata upload packet: docs/app-store-metadata-upload-packet.md
- Metadata upload packet risk: PASS
- Metadata upload packet local ready: Yes
- Metadata upload packet fields: 10/10
- Metadata upload packet screenshots: 10/10
- Metadata upload packet support URLs: 10/10
- Metadata upload packet privacy URLs: 10/10
- Localization audit: docs/localization-audit.md
- Localization risk: PASS
- Localization UI locales: 10
- Localization App Store locales: 10
- Localization screenshot entries: 160
- Runtime UI flow audit: docs/runtime-ui-flow-audit.md
- Runtime UI flow risk: PASS
- Runtime UI flow ready: Yes
- Runtime UI flow checks: 22/22
- Runtime UI flow failures: 0
- Public site deploy audit: docs/public-site-deploy-audit.md
- Public site deploy risk: PASS
- Public site local package ready: Yes
- Public site external hosting ready: Yes
- Public site hosting verification: docs/public-site-hosting-verification.md
- Public site hosting verification status: PASS
- Public site hosting verification ready: Yes
- Public site hosting verification checks: 45/45
- Public site hosting verification failures: 0
- Age rating audit: docs/app-store-age-rating-audit.md
- Age rating risk: PASS
- Age rating suggested Apple global rating: 4+ candidate
- Age rating NONE answers: 12/12
- Study bank depth audit: docs/study-bank-depth-audit.md
- Study bank depth risk: PASS
- Study bank levels: 5
- Study bank topic families: 26
- Study bank progression passed: Yes
- Study content localization audit: docs/study-content-localization-audit.md
- Study content localization risk: PASS
- Study content localization locales: 10
- Study content localization items: 853
- Study content localization text keys: 685
- Study content localized fields: 17060/17060
- Study content translation entries: 4110/4110
- Study content missing fields: 0
- Study content missing translations: 0
- Content rights audit: docs/content-rights-audit.md
- Protected IP term hits: 0
- Privacy manifest audit: docs/privacy-manifest-audit.md
- Privacy manifest risk: PASS
- Privacy manifest tracking: No
- Privacy manifest collected data types: 0
- App Store privacy answers: docs/app-store-privacy-answers.md
- Privacy answer risk: PASS
- Privacy answer current state: NO_LIVE_ADS
- App-code personal data collection: No
- Privacy review packet: docs/privacy-review-packet.md
- Privacy review packet risk: PASS
- Privacy review packet local ready: Yes
- Privacy review packet current state: NO_LIVE_ADS
- Privacy review final confirmation: No
- Privacy review no-live rows: 11
- Privacy review live-AdMob rows: 6
- AdMob release audit: docs/admob-release-audit.md
- AdMob release risk: PASS
- AdMob release current state: NO_LIVE_ADS
- AdMob local integration ready: Yes
- AdMob live ads ready: No
- AdMob external setup ready: No
- Data flow privacy audit: docs/data-flow-privacy-audit.md
- Data flow privacy risk: PASS
- Data flow local posture ready: Yes
- App-owned network request hits: 0
- Analytics SDK hits: 0
- Auth SDK hits: 0

## Official References

- Apple App Privacy Details: https://developer.apple.com/app-store/app-privacy-details/
  Reason: Privacy answers must include the app and integrated third-party SDK practices.
- Apple Manage App Privacy: https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/
  Reason: Privacy Policy URL is entered in App Store Connect App Privacy.
- Apple Set An App Age Rating: https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating/
  Reason: Age rating is determined by the App Store Connect questionnaire.
- Apple Age Rating Values And Definitions: https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions/
  Reason: Final age rating is shown after questionnaire answers are submitted.

## Suggested Answers

- Study bank depth: N5-N1 local study bank: 513 vocabulary prompts, 148 original anime-style line prompts, 26 topic families. Audit risk: PASS.
- Study content localization: Study content localization: 853 study items and 685 study text keys are available across 10 UI locales. Audit risk: PASS.
- Content rights: Kana Sprint uses original anime-style study lines and does not include known protected anime quotes, characters, titles, or third-party story worlds. Audit risk: PASS.
- Expected age rating: 4+ candidate; final global and region-specific ratings are calculated by App Store Connect
- Age rating audit: docs/app-store-age-rating-audit.md (PASS)
- No-live-ads privacy state: No data collected by this app; no tracking; no account; progress and settings stay local.
- Privacy manifest audit: docs/privacy-manifest-audit.md (PASS)
- Privacy answers: docs/app-store-privacy-answers.md (PASS, NO_LIVE_ADS)
- Privacy review packet: docs/privacy-review-packet.md (PASS)
- AdMob release audit: docs/admob-release-audit.md (PASS)
- Data flow privacy audit: docs/data-flow-privacy-audit.md (PASS)
- Runtime UI flow audit: docs/runtime-ui-flow-audit.md (ready)
- Live-AdMob privacy state: Review Google Mobile Ads SDK privacy report and disclose ad SDK data collection before APP_STORE_PRIVACY_ANSWERS_REVIEWED=1.
- Export compliance: ITSAppUsesNonExemptEncryption=false
- Tracking / IDFA: No tracking by app code; final IDFA/tracking answer must match live AdMob SDK behavior and ATT decision.

## Fields

### App Record And Identity

| Field | Value | Status | Note |
| --- | --- | --- | --- |
| Bundle ID | com.john.kanasprint | TODO | Must match Apple Developer and App Store Connect app record. |
| SKU | kana-sprint-ios-v1 | MANUAL | Suggested stable SKU for the first iOS app record; set once in App Store Connect. |
| Version | 1.0.0 | READY | Matches app.json and EAS metadata. |
| Build number | 1 | READY | EAS remote versioning should be initialized before production build. |
| Copyright | 2026 Kana Sprint | READY | Generated in store.config.js. |

### App Information

| Field | Value | Status | Note |
| --- | --- | --- | --- |
| Primary category | Games | READY | store.config.js categories include GAMES / GAMES_WORD. |
| Secondary category | Education | READY | Matches learning-game positioning. |
| Age rating questionnaire | Risk PASS; 12/12 advisory frequency answers are NONE; suggested 4+ candidate. | READY | Use docs/app-store-age-rating-audit.md while answering App Store Connect; confirm the calculated global and region-specific ratings before review. |
| App Store copy audit | Risk PASS; 10/10 locales ready; keywords byte limit=pass. | READY | See docs/app-store-copy-audit.md before editing App Store titles, subtitles, keywords, or descriptions. |
| Metadata upload packet | Risk PASS; fields=10/10; screenshots=10/10; support URLs=10/10; privacy URLs=10/10. | READY | Use docs/app-store-metadata-upload-packet.md as the manual App Store Connect fallback if EAS Metadata cannot push fields. |
| Runtime UI flow audit | Risk PASS; 22/22 runtime flows ready; failures=0. | READY | See docs/runtime-ui-flow-audit.md before confirming first screen, Settings language, exit, daily challenge, BGM, support/privacy links, and rewarded-ad entry. |
| JLPT study depth | 5 JLPT levels, 853 study items, 26 topic families, progression=pass. | READY | See docs/study-bank-depth-audit.md before changing the N5-N1 content bank. |
| Study content localization | 853 study items, 685 text keys, 10 UI locales, missing fields=0, missing translations=0. | READY | See docs/study-content-localization-audit.md before adding vocabulary, line prompts, or supported languages. |
| Content rights | Original study data, 148 original anime-style lines, game-style BGM assets, app-owned generated screenshots. | READY | See docs/content-rights-audit.md; confirm no protected anime quote, character, title, brand, or third-party asset is used. |
| Kids category | No | READY | The app is for general learners, not submitted as a Kids category app. |

### Pricing And Availability

| Field | Value | Status | Note |
| --- | --- | --- | --- |
| Price | Free recommended | MANUAL | Rewarded ads are the monetization path; choose the final App Store price tier manually. |
| Availability | All intended App Store countries/regions | MANUAL | Confirm regions match ad privacy messaging and localization coverage. |
| In-app purchases | None | READY | No purchase or subscription code exists in the app. |
| Phased release | No | READY | store.config.js controls EAS metadata release settings. |

### Privacy And Compliance

| Field | Value | Status | Note |
| --- | --- | --- | --- |
| Privacy Policy URL | https://johnshinsei.github.io/kana-sprint-site/privacy | OK | Host site/ over HTTPS or set APP_STORE_PRIVACY_URL / APP_STORE_BASE_URL. |
| Support URL | https://johnshinsei.github.io/kana-sprint-site/support | OK | Host site/ over HTTPS or set APP_STORE_SUPPORT_URL / APP_STORE_BASE_URL. |
| Public site hosting verification | Status PASS; 45/45 URLs passed; failures=0. | READY | After hosting site/ over production HTTPS, run npm run site:verify-hosting and confirm docs/public-site-hosting-verification.md is PASS. |
| Privacy manifest | Risk PASS; tracking=no; collected data types=0. | READY | See docs/privacy-manifest-audit.md; rerun after native dependency or AdMob changes. |
| App Privacy details | Use docs/app-store-privacy-answers.md; current build state NO_LIVE_ADS. | TODO | Must include third-party SDK practices for the submitted build. |
| Privacy review packet | Risk PASS; local ready=yes; current state=NO_LIVE_ADS; no-live rows=11; live-AdMob rows=6. | READY | Use docs/privacy-review-packet.md as the compact App Store Connect privacy-form checklist before setting APP_STORE_PRIVACY_ANSWERS_REVIEWED=1. |
| AdMob release audit | Risk PASS; state NO_LIVE_ADS; live ads ready=no. | READY | See docs/admob-release-audit.md before enabling or submitting live rewarded ads. |
| Data flow privacy audit | Risk PASS; app-owned network hits=0; analytics SDKs=0; auth SDKs=0. | READY | See docs/data-flow-privacy-audit.md before confirming no data collection, no account, no analytics, and no user-generated content. |
| Tracking / IDFA | Match final AdMob SDK behavior and ATT decision. | MANUAL | The app requests non-personalized rewarded ads by default, but final App Store answers must match the production SDK report. |
| Export compliance | ITSAppUsesNonExemptEncryption=false | READY | app.json declares no non-exempt encryption. Recheck if native dependencies change. |

### Review And Submission

| Field | Value | Status | Note |
| --- | --- | --- | --- |
| Review contact | Missing: APP_STORE_REVIEW_FIRST_NAME, APP_STORE_REVIEW_LAST_NAME, APP_STORE_REVIEW_EMAIL, APP_STORE_REVIEW_PHONE | TODO | Fill APP_STORE_REVIEW_* values before metadata push. |
| Review notes | Kana Sprint does not require sign-in. Reviewers can start a practice run directly, switch N5-N1 difficulty, open Settings for language and music, and use the rewarded-ad continue entry point when production AdMob IDs are configured. | READY | No login or demo account required. |
| Screenshots | 176 generated screenshot entries; QA risk PASS | READY | Upload localized screenshot packs from assets/store/ios-localized; see docs/screenshot-qa-audit.md before uploading. |
| Production device test | Set to 1 only after the real external action is complete. | TODO | Complete docs/production-device-smoke-test.md on the exact submitted build. |
| Final strict gate | npm run release:store-ready | TODO | Must pass before metadata push, production build, and submit. |

## Final Command Order

1. npm run release:verify
2. npm run release:store-ready
3. npm run metadata:ios
4. npm run build:ios
5. npm run submit:ios
