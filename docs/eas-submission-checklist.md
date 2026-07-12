# EAS Submission Checklist

## App

- Name: Kana Sprint
- Version: 1.0.0
- iOS bundle ID: com.john.kanasprint
- iOS build number in app.json: 1
- Android package: com.john.kanasprint
- Tablet support: Yes

## EAS Profiles

- EAS CLI requirement: >= 16.0.0
- App version source: remote
- Production auto-increment: Yes
- Production environment: production
- Submit metadata path: ./store.config.js

## Generated Evidence

- Release packet: docs/release-packet.json
- Runtime asset manifest: docs/runtime-asset-manifest.json
- Runtime UI flow audit: docs/runtime-ui-flow-audit.md
- Metadata preview: docs/app-store-metadata-preview.json
- App Store copy audit: docs/app-store-copy-audit.md
- Metadata upload packet: docs/app-store-metadata-upload-packet.md
- Localization audit: docs/localization-audit.md
- Public site deploy audit: docs/public-site-deploy-audit.md
- Public site hosting verification: docs/public-site-hosting-verification.md
- Review guide: docs/app-store-review-guide.md
- Age rating audit: docs/app-store-age-rating-audit.md
- Study bank depth audit: docs/study-bank-depth-audit.md
- Study content localization audit: docs/study-content-localization-audit.md
- Content rights audit: docs/content-rights-audit.md
- Privacy manifest audit: docs/privacy-manifest-audit.md
- App Store privacy answers: docs/app-store-privacy-answers.md
- Privacy review packet: docs/privacy-review-packet.md
- Production device smoke test: docs/production-device-smoke-test.md
- External readiness: docs/external-readiness.md
- EAS environment checklist: docs/eas-env-checklist.md
- EAS build preflight: docs/eas-build-preflight.md
- App Store Connect checklist: docs/app-store-connect-checklist.md
- Screenshot manifest: docs/app-store-screenshot-manifest.json
- Screenshot QA audit: docs/screenshot-qa-audit.md
- App Store locales: 10
- Screenshot entries: 176
- Screenshot QA risk: PASS
- Screenshot QA ready: Yes
- Screenshot QA localized distinct: Yes
- Screenshot QA unexpected duplicate groups: 0
- Runtime UI flow risk: PASS
- Runtime UI flow ready: Yes
- Runtime UI flow checks: 21/21
- Runtime UI flow failures: 0
- App Store copy risk: PASS
- App Store copy ready locales: 10/10
- App Store copy keyword format ready: Yes
- App Store copy keyword byte limit ready: Yes
- App Store copy protected terms clear: Yes
- Metadata upload packet risk: PASS
- Metadata upload packet local ready: Yes
- Metadata upload packet fields: 10/10
- Metadata upload packet screenshots: 10/10
- Metadata upload packet support URLs: 10/10
- Metadata upload packet privacy URLs: 10/10
- Localization risk: PASS
- Localization UI locales: 10
- Localization App Store locales: 10
- Localization screenshot entries: 160
- Localization public site pages: 44
- Japanese UI locale removed: Yes
- Public site deploy risk: PASS
- Public site local package ready: Yes
- Public site external hosting ready: Yes
- Public site deploy routes: 44
- Public site hosting verification status: PASS
- Public site hosting verification ready: Yes
- Public site hosting verification checks: 45/45
- Public site hosting verification failures: 0
- Review contact ready: No
- Demo account required: No
- Sign-in required: No
- Age rating risk: PASS
- Age rating suggested Apple global rating: 4+ candidate
- Age rating NONE answers: 12/12
- Age rating final source: App Store Connect age rating questionnaire
- Study bank depth risk: PASS
- Study bank levels: 5
- Study bank total items: 853
- Study bank topic families: 26
- Study bank progression passed: Yes
- Study content localization risk: PASS
- Study content localization locales: 10
- Study content localization items: 853
- Study content localization text keys: 685
- Study content localized fields: 17060/17060
- Study content translation entries: 4110/4110
- Study content missing fields: 0
- Study content missing translations: 0
- Content rights risk: PASS
- Protected IP term hits: 0
- Original anime-style line prompts: 148
- Privacy manifest risk: PASS
- Privacy manifest tracking: No
- Privacy manifest collected data types: 0
- Required reason APIs ready: Yes
- Privacy answer risk: PASS
- Privacy answer current state: NO_LIVE_ADS
- App-code personal data collection: No
- Live-AdMob disclosure rows: 6
- Privacy review packet risk: PASS
- Privacy review packet local ready: Yes
- Privacy review packet current state: NO_LIVE_ADS
- Privacy review final confirmation: No
- Privacy review no-live rows: 11
- Privacy review live-AdMob rows: 6
- Privacy review app-owned network hits: 0
- Privacy review analytics SDK hits: 0
- Privacy review auth SDK hits: 0
- AdMob release audit: docs/admob-release-audit.md
- AdMob release risk: PASS
- AdMob release current state: NO_LIVE_ADS
- AdMob local integration ready: Yes
- AdMob live ads ready: No
- AdMob external setup ready: No
- AdMob external blocking items: 2
- Data flow privacy audit: docs/data-flow-privacy-audit.md
- Data flow privacy risk: PASS
- Data flow local posture ready: Yes
- App-owned network request hits: 0
- Analytics SDK hits: 0
- Auth SDK hits: 0
- User-content entry hits: 0
- Local storage keys: 2
- Production smoke sections: 7
- Production smoke items: 34
- External readiness items: 11
- Blocking external items: 7
- EAS environment keys: 18
- EAS production build env values: 7
- EAS production profile ready: Yes
- EAS build preflight: docs/eas-build-preflight.md
- EAS build preflight risk: PASS
- EAS local setup ready: Yes
- EAS external gate ready: No
- EAS upload policy ready: Yes
- App Store Connect sections: 5
- App Store Connect fields: 34

## Local Release Evidence

- [OK] Expo SDK 56 baseline: Expo 56, React 19.2.3, React Native 0.85.3, Node >=22.13.0, iOS 16.4, Android SDK 36.
- [OK] Release CI workflow: GitHub Actions release verification runs Node 22.13.0 with typecheck, gameplay contract, and release:verify.
- [OK] UI locale coverage: 10 UI locales configured from system language; Japanese UI locale omitted.
- [OK] JLPT N5-N1 study bank: 92 kana, 513 vocabulary, 148 original anime-style line prompts, 100 grammar prompts.
- [OK] Study bank depth audit: 853 items, 26 topic families, N5-N1 progression verified.
- [OK] Study content localization: 853 study items and 685 study text keys localized for 10 UI locales.
- [OK] Runtime assets: 6 PNG assets and 3 BGM tracks recorded.
- [OK] Public support/privacy/license site: 44 generated pages for 10 UI locales.
- [OK] Public site deploy audit: 44 routes plus hosting control files packaged; GitHub Pages workflow ready=yes, sitemap ready=yes, external hosting ready=yes.
- [OK] Public site hosting handoff: 44 routes mapped to 4 hosting options; external hosting verified=yes.
- [OK] App Store screenshots: 176 screenshots across default and localized iOS packs.
- [OK] App Store screenshot QA: 176 screenshots QA-passed across 10 localized upload packs.
- [OK] App Store metadata preview: 10 App Store locales previewed.
- [OK] App Store copy audit: 10/10 locales pass App Store copy, keyword, and claim checks.
- [OK] App Store metadata upload packet: 10/10 locales have copy-ready fields and screenshot upload packs; support URLs ready=10/10.
- [OK] Localization QA audit: 10 UI locales, 10 App Store locales, and 160 localized screenshots verified.
- [OK] App Store age rating audit: 12/12 advisory answers are NONE; final rating comes from App Store Connect.
- [OK] Open source license audit: 515 runtime packages checked; 0 unknown and 0 prohibited runtime licenses.
- [OK] App Store review guide: No demo account or sign-in required; 176 screenshot entries referenced.
- [OK] Privacy manifest audit: iOS privacy manifest has 2 required-reason API categories, no tracking, and no collected data.
- [OK] App Store privacy answer pack: NO_LIVE_ADS state documented; no-account local app practices and live-AdMob disclosure review steps ready.
- [OK] Privacy review packet: NO_LIVE_ADS privacy packet ready; local evidence=yes, final review confirmed=no.
- [OK] AdMob release audit: NO_LIVE_ADS state audited; live ads ready=no, external ad setup ready=no.
- [OK] AdMob setup handoff: 4 AdMob env values and 3 manual confirmations mapped; external AdMob ready=no.
- [OK] Data flow privacy audit: local-only storage with 0 app-owned network hits, 0 analytics SDKs, and 0 auth SDKs.
- [OK] Runtime UI flow audit: 21/21 runtime UI flows verified across 10 locales and 5 JLPT levels.
- [OK] Store submission input pack: 18 env inputs, 7 EAS production keys, 6 manual confirmations, standalone env template ready; external blockers=7.
- [OK] External TODO tracker: 11 external items tracked, 7 blocking, 5 final commands blocked.
- [OK] Account and service preflight: 10 remote-service checks prepared, 7 EAS env keys tracked; external blockers=7.
- [OK] Final launch runbook: 9 launch phases mapped, metadata/build/submit ready=no; external blockers=7.
- [OK] EAS production preflight: production profile ready, submit metadata path=./store.config.js, strict gate ready=no.
- [OK] App Store handoff bundle: 301 handoff files indexed with hashes; external blockers=7.

## Current Blockers

- OK: 36
- TODO: 7
- BAD: 0
- INFO: 0

- [TODO] App Store review contact: Missing: APP_STORE_REVIEW_FIRST_NAME, APP_STORE_REVIEW_LAST_NAME, APP_STORE_REVIEW_EMAIL, APP_STORE_REVIEW_PHONE
- [TODO] Live AdMob IDs: No production AdMob IDs are set; live rewarded ads remain disabled.
- [TODO] APP_STORE_BUNDLE_ID_CONFIRMED: Set to 1 only after the real external action is complete.
- [TODO] APP_STORE_CONNECT_RECORD_READY: Set to 1 only after the real external action is complete.
- [TODO] APP_STORE_PRIVACY_ANSWERS_REVIEWED: Set to 1 only after the real external action is complete.
- [TODO] ADMOB_PRIVACY_MESSAGES_CONFIGURED: Set to 1 only after the real external action is complete.
- [TODO] PRODUCTION_DEVICE_TESTED: Set to 1 only after the real external action is complete.

## Command Sequence

1. npm run release:verify - Verify local release evidence
2. npm run release:store-ready - Run strict store-ready gate (requires zero TODO/BAD release-status rows)
3. npx eas-cli metadata:push - Push App Store metadata (requires zero TODO/BAD release-status rows)
4. npx eas-cli build --platform ios --profile production - Build iOS production archive (requires zero TODO/BAD release-status rows)
5. npx eas-cli submit --platform ios --profile production - Submit iOS build (requires zero TODO/BAD release-status rows)
