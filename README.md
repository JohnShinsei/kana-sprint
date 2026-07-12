# Kana Sprint

Kana Sprint is a 60-second Japanese learning game built with Expo and React Native.

Players match hiragana, katakana, romaji, JLPT N5-N1 vocabulary, original anime-style Japanese lines, and N5-N1 grammar under time pressure. Grammar uses sentence gaps, particles, and pattern distinctions; N5 keeps kana fundamentals in the mix, while N4-N1 stay inside their level banks with progressively harder prompts and closer distractors. Correct answers build combo score, mistakes cost hearts, and the daily challenge uses a fixed question sequence for repeatable score chasing.
The ready screen also shows local mastery progress for every JLPT level plus a weak-item review entry fed by recent mistakes. Settings includes a two-tap local progress reset so players can restart from N5 without an account or server sync.

## Run locally

Expo SDK 56 requires Node.js 22.13 or newer. Use the same Node major version locally and in EAS/CI so dependency validation matches release builds.
Native build baselines are pinned with `expo-build-properties`: iOS deployment target 16.4, Android compile/target SDK 36, and Android min SDK 24.

```bash
npm install
npm run start
```

## Useful commands

```bash
npm run typecheck
npm run gameplay-check
npm run study:depth
npm run study:localization
npm run doctor
npm run site:localized
npm run site:deploy-audit
npm run assets:manifest
npm run release-check
npm run release:verify
npm run device:smoke
npm run external:readiness
npm run external:todo-tracker
npm run eas:env-checklist
npm run store:input-pack
npm run account:preflight
npm run eas:build-preflight
npm run appstore:checklist
npm run launch:runbook
npm run release:packet
npm run submission:checklist
npm run release:store-ready
npm run screenshots:ios
npm run metadata:copy-audit
npm run metadata:upload-packet
npm run localization:audit
npm run age:rating
npm run content:rights
npm run legal:licenses
npm run privacy:manifest
npm run privacy:answers
npm run privacy:data-flow
npm run privacy:review-packet
npm run ads:audit
npx eas-cli build:version:set
npm run metadata:ios
npm run build:ios
npm run submit:ios
```

## Localization

The app detects the device system language through `expo-localization` and supports:

- Simplified Chinese
- Traditional Chinese
- English
- French
- Italian
- German
- Spanish (Spain)
- Korean
- Polish
- Portuguese (Brazil)

Language follows the device system language by default. Manual language selection lives in Settings, so the top bar stays focused on the game.

## Music

The app includes three game-style BGM loops under `assets/bgm`: Rush, Focus, and Night. Music is off by default and can be enabled or changed in Settings.

## Ads

The gameplay has a rewarded-ad entry point for continuing a run. Production ads stay disabled until valid AdMob app IDs and rewarded-unit IDs are provided in environment variables. When all IDs are valid, `app.config.js` injects the `react-native-google-mobile-ads` native plugin for EAS builds.

```bash
cp .env.example .env.local
```

The local release scripts and Expo config automatically read `.env.local`, `.env.production`, and `.env` when present. Shell or EAS environment variables still win over local files.
For cloud production builds, mirror the build-time values into the EAS `production` environment. `eas.json` maps the production build profile to `environment: "production"`, and `npm run eas:env-checklist` generates `docs/eas-env-checklist.md` with recommended visibility for each key.
Run `npm run store:input-pack` after the readiness and EAS env checklists are current to generate `docs/store-submission-input-pack.md` and `docs/store-submission.env.template`, a fillable `.env.local` template plus EAS production env commands and manual confirmation actions.
Run `npm run account:preflight` to generate `docs/account-service-preflight.md`, the account and remote-service checklist for Expo login, EAS project linkage, EAS production env, remote version state, App Store Connect, AdMob, hosting, TestFlight, build, and submit. Use `npm run account:preflight -- --live` only when you want to probe the signed-in machine.

See `docs/admob-setup.md` before enabling live ads.
Use `docs/app-store-privacy-answers.md` when filling App Store Connect privacy answers, especially after enabling production AdMob IDs.

## App Store direction

- Category: Games / Education
- Content: Japanese kana, JLPT N5-N1 vocabulary, original anime-style lines, and 60 N5-N1 grammar prompts
- Data: local-only progress/settings storage, no account, iOS privacy manifest included
- Monetization: rewarded ads after AdMob IDs are configured

Before submission, replace the placeholder bundle identifier in `app.json` with the final Apple Developer Team identifier namespace.
The EAS config uses remote app version management with production auto-increment enabled; initialize it once with `npx eas-cli build:version:set` after logging in to Expo.
App Store metadata is generated from `docs/app-store-localizations.json` through `store.config.js`; set the `APP_STORE_*` values from `.env.example` before running `npm run metadata:ios`.
Run `npm run metadata:preview` to update `docs/app-store-metadata-preview.json`, a human-readable preview of all App Store locales, field lengths, URL readiness, and screenshot-pack counts.
Run `npm run metadata:copy-audit` to update `docs/app-store-copy-audit.md` and `.json`, which check App Store copy length limits, keyword byte limits, duplicated search terms, protected-IP terms, and ad/privacy wording risk for all 10 locales.
Run `npm run metadata:upload-packet` to update `docs/app-store-metadata-upload-packet.md` and `.json`, which collect each App Store locale's copy, field lengths, URL readiness, and screenshot pack paths for manual App Store Connect entry if EAS Metadata cannot push fields.
Run `npm run localization:audit` to update `docs/localization-audit.md` and `.json`, which check UI locale coverage, Settings language switching, App Store locale metadata, localized screenshot packs, and localized support/privacy/license pages.
Run `npm run age:rating` to update `docs/app-store-age-rating-audit.md` and `.json`, which map the all-NONE App Store age-rating questionnaire posture to current app features while keeping App Store Connect as the final rating source.
Run `npm run study:depth` to update `docs/study-bank-depth-audit.md` and `.json`, which verify N5-N1 study-bank counts, topic coverage, duplicate-free prompts, and difficulty progression.
Run `npm run study:localization` to update `docs/study-content-localization-audit.md` and `.json`, which verify that N5-N1 study meanings and topics are populated across all 10 supported UI languages and that the six extended content-translation locales do not fall back to English.
Run `npm run content:rights` to update `docs/content-rights-audit.md` and `.json`, which scan the study bank and App Store localization text for obvious protected anime IP terms, duplicate original line prompts, and per-locale originality claims.
Run `npm run legal:licenses` to update `docs/open-source-license-audit.md` and `.json`, which scan `package-lock.json` for runtime and full-lockfile license risk before App Store submission.
Run `npm run privacy:manifest` to update `docs/privacy-manifest-audit.md` and `.json`, which check the iOS privacy manifest, required-reason API declarations, encryption flag, microphone/Android permissions, UMP flow, and privacy policy evidence.
Run `npm run privacy:answers` to update `docs/app-store-privacy-answers.md` and `.json`, which turn the App Store privacy questionnaire posture into a generated no-live-ads/live-AdMob answer pack tied to the current build state.
Run `npm run privacy:data-flow` to update `docs/data-flow-privacy-audit.md` and `.json`, which scan runtime code and dependencies for app-owned network requests, analytics/auth SDKs, user-content entry points, sensitive APIs, local storage keys, and support/privacy/license link boundaries.
Run `npm run privacy:review-packet` to update `docs/privacy-review-packet.md` and `.json`, which compress the privacy answer pack, iOS privacy manifest, runtime data-flow audit, and AdMob audit into a compact App Store Connect privacy-form checklist.
Run `npm run runtime:ui-flow` to update `docs/runtime-ui-flow-audit.md` and `.json`, which verify the playable first screen, weak-item review loop, Settings-owned language switching, local progress reset, in-game exit, daily challenge, BGM, support/privacy links, and rewarded-ad continue entry.
Run `npm run ads:audit` to update `docs/admob-release-audit.md` and `.json`, which verify the rewarded-ad UI entry, UMP consent flow, native/web SDK split, AdMob ID guardrails, and remaining external AdMob actions.
Run `npm run ads:handoff` to update `docs/admob-setup-handoff.md` and `.json`, which turn the remaining live-AdMob setup into EAS env commands, AdMob console steps, App Store privacy review checks, and production-device validation.
Run `npm run review:guide` to update `docs/app-store-review-guide.md` and `.json`, which summarize the App Review walkthrough, no-login posture, rewarded-ad entry point, and verification evidence.
Run `npm run device:smoke` to update `docs/production-device-smoke-test.md` and `.json`, the manual TestFlight/physical-iPhone checklist required before setting `PRODUCTION_DEVICE_TESTED=1`.
Run `npm run external:readiness` to update `docs/external-readiness.md` and `.json`, which map every external `release:status` row to its required App Store, AdMob, EAS, hosting, or device-test action.
Run `npm run external:todo-tracker` to update `docs/external-todo-tracker.md` and `.json`, which group every external TODO/INFO row by phase, env key, account check, completion rule, and final commands blocked until clear.
Run `npm run eas:env-checklist` to update `docs/eas-env-checklist.md` and `.json`, which map `.env.example` keys to local release gates, EAS production environment variables, client-visible values, and recommended EAS visibility.
Run `npm run store:input-pack` to update `docs/store-submission-input-pack.md`, `docs/store-submission-input-pack.json`, and `docs/store-submission.env.template`, which turn the remaining external TODOs into one fillable `.env.local` template, EAS production env commands, App Store Connect field list, manual confirmations, and verification order.
Run `npm run account:preflight` to update `docs/account-service-preflight.md` and `.json`, which map Expo/EAS login, project linkage, EAS production env, remote version state, App Store Connect, AdMob, public hosting, TestFlight, iOS build, and EAS Submit to their verification commands and evidence.
Run `npm run eas:build-preflight` to update `docs/eas-build-preflight.md` and `.json`, which verify the EAS production build profile, submit metadata path, final commands, `.easignore` upload policy, and remaining external gate before EAS build/submit.
Run `npm run appstore:checklist` to update `docs/app-store-connect-checklist.md` and `.json`, which maps App Store Connect manual fields such as age rating, content rights, privacy, encryption, pricing, availability, screenshots, and review notes to the current release evidence.
Run `npm run launch:runbook` to update `docs/final-launch-runbook.md` and `.json`, which combine local evidence, external blockers, account preflight, strict gate, metadata push, EAS build, TestFlight smoke, EAS submit, and App Review into one final execution map.
Run `npm run release:packet` to update `docs/release-packet.md` and `.json`, the final handoff summary that combines app versions, language coverage, study-bank counts, screenshot/site/metadata artifacts, and remaining external store blockers.
Run `npm run submission:checklist` to update `docs/eas-submission-checklist.md` and `.json`, which summarize the final EAS metadata/build/submit command sequence and the blockers that must clear before those commands run.
Run `npm run assets:manifest` to update `docs/runtime-asset-manifest.md` and `.json`, which record icon, splash, adaptive icon, favicon, and BGM byte sizes, dimensions/audio properties, and hashes.
App Store screenshots are generated under `assets/store/ios/` with `npm run screenshots:ios`; localized upload packs for all 10 UI languages are generated under `assets/store/ios-localized/<locale>/`.
Run `npm run screenshots:manifest` after screenshot generation to update `docs/app-store-screenshot-manifest.json`, which records every App Store screenshot path, locale, device size, byte size, and hash for upload QA.
Run `npm run screenshots:qa` after the screenshot manifest to update `docs/screenshot-qa-audit.md` and `.json`, which verify upload dimensions, non-alpha PNGs, nonblank visual variance, default/en duplicate policy, and non-English localized screenshot differences.
Deployable support, privacy, and open source license pages live under `site/`; run `npm run site:localized`, host that folder over HTTPS, and set `APP_STORE_BASE_URL` or explicit `APP_STORE_SUPPORT_URL` / `APP_STORE_PRIVACY_URL` before metadata submission. If this repo is published on GitHub, `.github/workflows/deploy-site.yml` can deploy `site/` through GitHub Pages after Pages is configured to use GitHub Actions. The site generator also refreshes `robots.txt`, `_headers`, and `_redirects`; when `APP_STORE_BASE_URL` is a production HTTPS URL, it also writes `sitemap.xml`.
Run `npm run site:manifest` after localized site generation to update `docs/public-site-manifest.json`, which records every deployable support/privacy/license page route, language, title, byte size, and hash.
Run `npm run site:deploy-audit` after the site manifest to update `docs/public-site-deploy-audit.md` and `.json`, which verify the local `site/` deploy package, hosting control files, GitHub Pages workflow, sitemap state, and exact public URL checks needed before App Store submission.
Run `npm run site:verify-hosting` after setting production HTTPS URLs to update `docs/public-site-hosting-verification.md` and `.json`; it performs live requests against support, privacy, license, localized, and sitemap routes when `APP_STORE_BASE_URL` is set.
Run `npm run site:hosting-handoff` to update `docs/public-site-hosting-handoff.md` and `.json`, which collect GitHub Pages, Netlify, Cloudflare Pages, and generic static-host steps plus the EAS URL env commands and post-hosting verification order.
When `APP_STORE_BASE_URL` is set, localized support/privacy/license pages are generated under `/<locale>/support/`, `/<locale>/privacy/`, and `/<locale>/licenses/`; the same URL values are injected into Expo `extra.storeUrls`, so Settings can open Support, Privacy, and Open source in the selected UI language when localized URLs are available.
`.easignore` excludes App Store screenshots, generated public-site pages, and handoff docs from EAS Build uploads while keeping runtime assets such as icons and BGM in the native build archive.
The final local gate reads `.env.local` directly, so filling that file is enough for `npm run release:store-ready`; you do not need to duplicate every value in the current PowerShell session.
Run `npm run release:status` for a fast checklist that separates local release evidence from external store setup. Local evidence covers the Expo SDK 56 baseline, 10 UI locales, JLPT N5-N1 study-bank depth, study content localization, runtime assets, public site pages, App Store screenshots, screenshot QA, metadata preview, App Store copy audit, metadata upload packet, privacy evidence, privacy review packet, AdMob release audit, AdMob setup handoff, review guide, store submission input pack, external TODO tracker, account/service preflight, final launch runbook, EAS preflight, and handoff bundle. External setup covers public HTTPS URLs, App Store review contact fields, AdMob ID formats, and manual confirmation flags.
`.github/workflows/release-verify.yml` runs the same release gate on GitHub Actions with Node 22.13.0: `npm ci`, `npm run typecheck`, `npm run gameplay-check`, and `npm run release:verify`. Use it as the pre-merge signal before changing gameplay, localization, metadata, screenshots, privacy, ads, or EAS release files.
Run `npm run handoff:bundle` after the release evidence is current to update `docs/app-store-handoff-bundle.md` and `.json`, which index the public site, screenshots, metadata, review/privacy/ad evidence, EAS files, and source configuration snapshot with SHA-256 hashes for the final App Store handoff.
`npm run release:verify` regenerates the release packet before the final release checks, so `docs/release-packet.md` should be the latest local handoff after a successful verification run.
`npm run release:verify` also regenerates `docs/screenshot-qa-audit.md`, so localized App Store screenshot upload packs stay checked for dimensions, visual readiness, duplicate policy, accurate N5-N1 counts, and N5-N1 scene/progress coverage.
`npm run release:verify` also regenerates `docs/public-site-deploy-audit.md`, so the local public site package, hosting control files, GitHub Pages workflow, sitemap state, and required HTTPS URL checks stay tied to the current release.
`npm run release:verify` also regenerates `docs/public-site-hosting-verification.md`, so production support/privacy URLs get live HTTPS checks as soon as they are configured.
`npm run release:verify` also regenerates `docs/public-site-hosting-handoff.md`, so the public-site publish steps, env commands, and verification order stay tied to the current `site/` package.
`npm run release:verify` also regenerates `docs/app-store-copy-audit.md`, so App Store copy limits, keyword byte limits, duplicate search terms, and claim safety stay tied to the current metadata.
`npm run release:verify` also regenerates `docs/localization-audit.md`, so the 10-language app, App Store metadata, screenshots, and public pages stay tied to the same release state.
`npm run release:verify` also regenerates `docs/app-store-age-rating-audit.md`, so the App Store age-rating questionnaire posture stays tied to current app features and store metadata.
`npm run release:verify` also regenerates `docs/study-bank-depth-audit.md`, so N5-N1 content depth and difficulty progression stay tied to the current study bank.
`npm run release:verify` also regenerates `docs/content-rights-audit.md`, so original anime-style line evidence stays tied to the current study bank and App Store metadata.
`npm run release:verify` also regenerates `docs/open-source-license-audit.md`, so dependency license risk stays tied to the current lockfile and runtime asset evidence.
`npm run release:verify` also regenerates `docs/privacy-manifest-audit.md`, so App Store privacy manifest evidence stays tied to the current app config, privacy policy, and AdMob state.
`npm run release:verify` also regenerates `docs/app-store-privacy-answers.md`, so App Store privacy questionnaire guidance stays tied to the current no-live-ads or live-AdMob build state.
`npm run release:verify` also regenerates `docs/admob-release-audit.md`, so the rewarded-ad SDK gate, UMP consent path, and external AdMob setup actions stay tied to the current build.
`npm run release:verify` also regenerates `docs/admob-setup-handoff.md`, so live AdMob IDs, EAS env commands, AdMob Privacy & messaging, App Store privacy review, and production-device ad validation stay tied to the current build.
`npm run release:verify` also regenerates `docs/data-flow-privacy-audit.md`, so no-account, no-analytics, no-user-content, and local-only storage claims stay tied to the current runtime code.
`npm run release:verify` also regenerates `docs/privacy-review-packet.md`, so the compact App Store Connect privacy-form checklist stays tied to the current privacy, data-flow, and AdMob evidence.
`npm run release:verify` also regenerates `docs/runtime-ui-flow-audit.md`, so playable first screen, weak-item review, Settings language switching, local progress reset, exit, daily challenge, BGM, support/privacy links, and rewarded-ad entry claims stay tied to the current runtime UI.
`npm run release:verify` also regenerates `docs/production-device-smoke-test.md`, so the final physical-device/TestFlight pass has a current checklist tied to the same app version and screenshots.
`npm run release:verify` also regenerates `docs/external-readiness.md`, so every external TODO has a current action, evidence, env-key, and verification checklist.
`npm run release:verify` also regenerates `docs/external-todo-tracker.md`, so every external TODO/INFO row stays grouped by phase, required input, account check, completion rule, and blocked final commands.
`npm run release:verify` also regenerates `docs/eas-env-checklist.md`, so EAS production environment variables stay tied to `.env.example`, `eas.json`, and the current release-status rows.
`npm run release:verify` also regenerates `docs/store-submission-input-pack.md` and `docs/store-submission.env.template`, so the fillable `.env.local` template, EAS production commands, manual confirmations, and verification order stay tied to the current external blockers.
`npm run release:verify` also regenerates `docs/account-service-preflight.md`, so Expo/EAS account checks, project linkage, EAS env, App Store Connect, AdMob, hosting, TestFlight, build, and submit evidence stay tied to the current external blockers.
`npm run release:verify` also regenerates `docs/eas-build-preflight.md`, so EAS production build/submit setup stays tied to the current release gates.
`npm run release:verify` also regenerates `docs/app-store-connect-checklist.md`, so manual App Store Connect fields stay tied to the current metadata, privacy, screenshots, and external blocker state.
`npm run release:verify` also regenerates `docs/final-launch-runbook.md`, so the final launch phase plan stays tied to the current blockers and generated evidence.
`npm run release:verify` also regenerates `docs/app-store-handoff-bundle.md`, so the upload and reviewer-evidence manifest stays tied to the current public site, screenshot, metadata, privacy, ad, and EAS evidence.
`npm run release:verify` also regenerates `docs/eas-submission-checklist.md`, so the final EAS metadata/build/submit sequence stays tied to the current `eas.json` and `package.json` scripts.
Run `npm run release:store-ready` as the final local gate before building for review; it fails until the public URLs, review contact, real AdMob IDs, and App Store privacy answer confirmation are present.
It also requires the manual confirmations in `.env.example` for the final bundle ID, App Store Connect app record, EAS remote version initialization, and physical-device/TestFlight validation.
Use `docs/release-handoff.md` as the final command checklist, `docs/release-packet.md` as the generated release evidence summary, `docs/app-store-handoff-bundle.md` as the upload/evidence file manifest, `docs/screenshot-qa-audit.md` for App Store screenshot upload readiness, `docs/public-site-deploy-audit.md` for support/privacy/license site hosting readiness and static hosting controls, `docs/public-site-hosting-handoff.md` for the provider publish steps and URL env handoff, `docs/public-site-hosting-verification.md` for live HTTPS support/privacy route checks, `docs/app-store-copy-audit.md` for App Store copy and keyword readiness, `docs/localization-audit.md` for multilingual release evidence, `docs/app-store-age-rating-audit.md` for App Store age-rating questionnaire evidence, `docs/content-rights-audit.md` for original anime-style content evidence, `docs/open-source-license-audit.md` for dependency license evidence, `docs/privacy-manifest-audit.md` for App Store privacy manifest evidence, `docs/app-store-privacy-answers.md` for App Store privacy questionnaire evidence, `docs/privacy-review-packet.md` for the compact App Store Connect privacy-form checklist, `docs/admob-release-audit.md` for rewarded-ad SDK readiness, `docs/admob-setup-handoff.md` for live AdMob setup and EAS env handoff, `docs/data-flow-privacy-audit.md` for runtime privacy/data-flow evidence, `docs/runtime-ui-flow-audit.md` for runtime UI flow evidence, `docs/eas-env-checklist.md` for EAS production variables, `docs/store-submission-input-pack.md` for filling the remaining store/EAS inputs, `docs/store-submission.env.template` for the copy-ready `.env.local` template, `docs/external-todo-tracker.md` for tracking external blockers to completion, `docs/account-service-preflight.md` for account and remote-service verification, `docs/final-launch-runbook.md` for final execution order, `docs/eas-build-preflight.md` for EAS production build setup, and `docs/eas-submission-checklist.md` for the final EAS metadata/build/submit handoff.
