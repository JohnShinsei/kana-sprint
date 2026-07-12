# Kana Sprint Release Packet

## App

- Name: Kana Sprint
- Version: 1.0.0
- SDK packages: Expo ~56.0.15, React Native 0.85.3
- iOS bundle ID: com.john.kanasprint
- Android package: com.john.kanasprint
- UI locales: zh-Hans, zh-Hant, en, fr, it, de, es-ES, ko, pl, pt-BR
- App Store locales: zh-Hans, zh-Hant, en-US, fr-FR, it, de-DE, es-ES, ko, pl, pt-BR
- Japanese UI locale removed: Yes

## Content

- Modes: mix, kana, vocab, lines, grammar
- Kana prompts: 92
- Vocabulary prompts: 513
- Original anime-style line prompts: 148
- Grammar prompts: 100

| Level | Kana | Vocabulary | Lines | Grammar |
| --- | ---: | ---: | ---: | ---: |
| N5 | 92 | 137 | 44 | 20 |
| N4 | 0 | 94 | 26 | 20 |
| N3 | 0 | 94 | 26 | 20 |
| N2 | 0 | 94 | 26 | 20 |
| N1 | 0 | 94 | 26 | 20 |

## Release Artifacts

- Public site pages: 44 (docs/public-site-manifest.json)
- Public site deploy audit: PASS, local ready=yes, control files ready=yes, sitemap ready=yes, hosting ready=yes (docs/public-site-deploy-audit.md)
- Public site hosting verification: PASS, ready=yes, checks=45/45, failures=0 (docs/public-site-hosting-verification.md)
- Runtime assets: 6 PNG / 3 audio (docs/runtime-asset-manifest.json)
- Runtime UI flow audit: PASS, ready=yes, checks=21/21, failures=0 (docs/runtime-ui-flow-audit.md)
- App Store screenshots: 176 (docs/app-store-screenshot-manifest.json)
- Screenshot QA audit: PASS, ready=yes, localized distinct=yes (docs/screenshot-qa-audit.md)
- Metadata locales: 10 (docs/app-store-metadata-preview.json)
- App Store copy audit: PASS, 10/10 locales, keyword format=ready, protected terms=clear (docs/app-store-copy-audit.md)
- App Store metadata upload packet: PASS, fields=10/10, screenshots=10/10, support URLs=10/10, privacy URLs=10/10 (docs/app-store-metadata-upload-packet.md)
- Localization audit: PASS, 10 UI locales / 10 App Store locales / 160 localized screenshots (docs/localization-audit.md)
- Review guide: docs/app-store-review-guide.md
- Demo account required: No
- Sign-in required: No
- Age rating audit: PASS, 4+ candidate, 12/12 NONE answers (docs/app-store-age-rating-audit.md)
- Study bank depth audit: PASS, 5 levels / 26 topic families / progression=pass (docs/study-bank-depth-audit.md)
- Study content localization audit: PASS, 853 items / 685 text keys / fields=17060/17060 / translations=4110/4110 (docs/study-content-localization-audit.md)
- Content rights audit: PASS, 0 protected-IP hits (docs/content-rights-audit.md)
- Open source license audit: PASS, 515 runtime packages, unknown=0, prohibited=0, notice/review=13 (docs/open-source-license-audit.md)
- Privacy manifest audit: PASS, tracking=no, collected data types=0 (docs/privacy-manifest-audit.md)
- App Store privacy answers: PASS, state=NO_LIVE_ADS, app-code data collection=no (docs/app-store-privacy-answers.md)
- Privacy review packet: PASS, ready=yes, state=NO_LIVE_ADS, final review confirmed=no, network=0, analytics=0, auth=0 (docs/privacy-review-packet.md)
- AdMob release audit: PASS, state=NO_LIVE_ADS, live ads ready=no (docs/admob-release-audit.md)
- Data flow privacy audit: PASS, app-owned network=0, analytics SDKs=0, auth SDKs=0 (docs/data-flow-privacy-audit.md)
- Production device smoke test: 34 items / 7 sections (docs/production-device-smoke-test.md)
- External readiness: 11 items / 7 blocking (docs/external-readiness.md)
- EAS environment: 18 keys / 7 production-build values (docs/eas-env-checklist.md)
- EAS build preflight: PASS, local ready=yes, external ready=no (docs/eas-build-preflight.md)
- App Store Connect checklist: 34 fields / 5 sections (docs/app-store-connect-checklist.md)

## Current Release Status

- OK: 36
- TODO: 7
- BAD: 0
- INFO: 0

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

## Local Items Before Store Submission

- None.

## External Items Before Store Submission

- [TODO] App Store review contact: Missing: APP_STORE_REVIEW_FIRST_NAME, APP_STORE_REVIEW_LAST_NAME, APP_STORE_REVIEW_EMAIL, APP_STORE_REVIEW_PHONE
- [TODO] Live AdMob IDs: No production AdMob IDs are set; live rewarded ads remain disabled.
- [TODO] APP_STORE_BUNDLE_ID_CONFIRMED: Set to 1 only after the real external action is complete.
- [TODO] APP_STORE_CONNECT_RECORD_READY: Set to 1 only after the real external action is complete.
- [TODO] APP_STORE_PRIVACY_ANSWERS_REVIEWED: Set to 1 only after the real external action is complete.
- [TODO] ADMOB_PRIVACY_MESSAGES_CONFIGURED: Set to 1 only after the real external action is complete.
- [TODO] PRODUCTION_DEVICE_TESTED: Set to 1 only after the real external action is complete.

## Final Command Order

1. npm run release:verify
2. npm run release:store-ready
3. npm run metadata:ios
4. npm run build:ios
5. npm run submit:ios
