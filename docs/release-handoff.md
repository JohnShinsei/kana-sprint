# Release Handoff

Use this file for the final App Store handoff after `npm run release:verify` passes locally.

## Required external values

Fill `.env.local` from `.env.example`. `app.config.js`, `store.config.js`, and `scripts/release-check.js` load `.env.local`, `.env.production`, and `.env` automatically, while shell or EAS environment variables take priority.
For EAS cloud builds, set build-time values in the EAS `production` environment as well. The production build profile in `eas.json` uses `environment: "production"`, and `docs/eas-env-checklist.md` lists the recommended visibility for each key.
Use `docs/store-submission-input-pack.md` as the fillable input sheet and `docs/store-submission.env.template` as the copy-ready `.env.local` template for EAS production env commands, App Store Connect fields, and manual confirmation evidence.
Use `docs/external-todo-tracker.md` to track each external blocker by phase, env key, account check, completion rule, and final commands blocked until clear.
Use `docs/account-service-preflight.md` to verify Expo/EAS login, EAS project linkage, production env values, remote version state, App Store Connect, AdMob, public hosting, TestFlight, iOS build, and EAS Submit readiness.
Use `docs/final-launch-runbook.md` as the final phase-by-phase execution map from local verification through App Review submission.

- `APP_STORE_BASE_URL` or both `APP_STORE_SUPPORT_URL` and `APP_STORE_PRIVACY_URL`
- `APP_STORE_REVIEW_FIRST_NAME`
- `APP_STORE_REVIEW_LAST_NAME`
- `APP_STORE_REVIEW_EMAIL`
- `APP_STORE_REVIEW_PHONE`
- `EXPO_PUBLIC_ADMOB_IOS_APP_ID`
- `EXPO_PUBLIC_ADMOB_ANDROID_APP_ID`
- `EXPO_PUBLIC_ADMOB_REWARDED_IOS_UNIT_ID`
- `EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_UNIT_ID`

## Manual confirmations

Set each value to `1` only after the real action is complete.

- `APP_STORE_BUNDLE_ID_CONFIRMED`: final iOS bundle ID and Android package are correct for the store records.
- `APP_STORE_CONNECT_RECORD_READY`: App Store Connect app record exists for the final bundle ID.
- `EAS_REMOTE_VERSION_INITIALIZED`: `npx eas-cli build:version:set` has been run once for the production iOS app.
- `APP_STORE_PRIVACY_ANSWERS_REVIEWED`: App Store Connect privacy answers match the final build and AdMob state.
- `ADMOB_PRIVACY_MESSAGES_CONFIGURED`: AdMob Privacy & messaging contains the required user messages for the release regions, and a production build has confirmed ads only load after UMP reports `canRequestAds`.
- `PRODUCTION_DEVICE_TESTED`: the production build has been tested on a physical iPhone or TestFlight.

## Final command order

```bash
npm run release:status
npm run store:input-pack
npm run external:todo-tracker
npm run account:preflight
npm run site:hosting-handoff
npm run ads:handoff
npm run launch:runbook
npm run release:verify
npm run handoff:bundle
npm run release:store-ready
npm run metadata:ios
npm run build:ios
npm run submit:ios
```

`release:status` is a fast checklist that separates local release evidence from external store setup. Local evidence covers the Expo SDK 56 baseline, 10 UI locales, JLPT N5-N1 study-bank depth, study content localization, runtime assets, public site pages, public site hosting handoff, App Store screenshots, screenshot QA, metadata preview, App Store copy audit, metadata upload packet, localization QA, privacy evidence, privacy review packet, AdMob release audit, AdMob setup handoff, review guide, store submission input pack, external TODO tracker, account/service preflight, final launch runbook, EAS preflight, and handoff bundle. External setup covers public HTTPS URLs, App Store review contact fields, AdMob ID formats, and the manual confirmation flags. Use `npm run release:status -- --strict` if you want the status command to exit non-zero while any item is still pending.
`.github/workflows/release-verify.yml` runs the release gate on GitHub Actions with Node 22.13.0, `npm ci`, `npm run typecheck`, `npm run gameplay-check`, and `npm run release:verify`, so release evidence can be checked before merging app, metadata, screenshot, privacy, ad, or EAS changes.
`release:verify` regenerates `docs/public-site-manifest.json`, which is the deploy checklist for the hosted `site/` folder and all localized support/privacy/license routes.
`release:verify` also regenerates `docs/public-site-deploy-audit.md` and `.json`, which verify the local `site/` deploy package, hosting control files, GitHub Pages workflow, sitemap state, and the exact public HTTPS URL checks needed before App Store submission.
`release:verify` also regenerates `docs/public-site-hosting-verification.md` and `.json`, which perform live HTTPS checks for support, privacy, license, localized, and sitemap routes after production URLs are configured.
`release:verify` also regenerates `docs/public-site-hosting-handoff.md` and `.json`, which collect the static hosting options, EAS URL env commands, route sample, and exact verification order for publishing `site/`.
`release:verify` regenerates `docs/runtime-asset-manifest.md` and `.json`, which record runtime icon, splash, adaptive icon, favicon, and BGM file properties and hashes.
`release:verify` regenerates App Store screenshots and `docs/app-store-screenshot-manifest.json`. Use that manifest as the screenshot upload checklist for every App Store locale/device pack.
`release:verify` also regenerates `docs/screenshot-qa-audit.md` and `.json`, which verify screenshot dimensions, non-alpha PNG upload safety, visual variance, default/en duplicate policy, non-English localized differences, and N5-N1 scene coverage.
`release:verify` also regenerates `docs/app-store-metadata-preview.json`, which previews every App Store locale, field length, URL status, and screenshot-pack count before `npm run metadata:ios`.
`release:verify` also regenerates `docs/app-store-copy-audit.md` and `.json`, which check App Store copy length limits, keyword byte limits, duplicated search terms, protected-IP terms, and ad/privacy wording risk for all 10 locales.
`release:verify` also regenerates `docs/app-store-metadata-upload-packet.md` and `.json`, which collect each App Store locale's copy, field lengths, URL readiness, and screenshot pack paths for manual App Store Connect entry if EAS Metadata cannot push fields.
`release:verify` also regenerates `docs/localization-audit.md` and `.json`, which check UI locale coverage, Settings language switching, App Store locale metadata, localized screenshot packs, and localized support/privacy/license pages.
`release:verify` also regenerates `docs/app-store-age-rating-audit.md` and `.json`, which map the current all-NONE App Store age-rating questionnaire posture to app features and keep App Store Connect as the final rating source.
`release:verify` also regenerates `docs/study-bank-depth-audit.md` and `.json`, which verify N5-N1 study-bank counts, topic coverage, duplicate-free prompts, and difficulty progression.
`release:verify` also regenerates `docs/study-content-localization-audit.md` and `.json`, which verify that N5-N1 study meanings and topics are populated across all 10 supported UI languages and that the six extended content-translation locales do not fall back to English.
`release:verify` also regenerates `docs/content-rights-audit.md` and `.json`, which scan the study bank and App Store localization text for obvious protected anime IP terms, duplicate original line prompts, and per-locale originality claims.
`release:verify` also regenerates `docs/open-source-license-audit.md` and `.json`, which scan runtime and full-lockfile package licenses for App Store submission risk.
`release:verify` also regenerates `docs/privacy-manifest-audit.md` and `.json`, which check the iOS privacy manifest, required-reason API declarations, encryption flag, microphone/Android permissions, UMP flow, and privacy policy evidence.
`release:verify` also regenerates `docs/app-store-privacy-answers.md` and `.json`, which convert the App Store privacy questionnaire into a generated no-live-ads/live-AdMob answer pack tied to the current build state.
`release:verify` also regenerates `docs/admob-release-audit.md` and `.json`, which verify the rewarded-ad UI entry, UMP consent flow, native/web SDK split, AdMob ID guardrails, and remaining external AdMob actions.
`release:verify` also regenerates `docs/admob-setup-handoff.md` and `.json`, which map live AdMob IDs, EAS env commands, AdMob Privacy & messaging, App Store privacy review, and production-device ad validation to the current build state.
`release:verify` also regenerates `docs/data-flow-privacy-audit.md` and `.json`, which scan runtime code and dependencies for app-owned network requests, analytics/auth SDKs, user-content entry points, sensitive APIs, local storage keys, and support/privacy/license link boundaries.
`release:verify` also regenerates `docs/privacy-review-packet.md` and `.json`, which compress the privacy answer pack, iOS privacy manifest, runtime data-flow audit, and AdMob audit into a compact App Store Connect privacy-form checklist.
`release:verify` also regenerates `docs/runtime-ui-flow-audit.md` and `.json`, which verify the playable first screen, Settings-owned language switching, in-game exit, daily challenge, BGM, support/privacy links, and rewarded-ad continue entry.
`release:verify` also regenerates `docs/app-store-review-guide.md` and `.json`, which summarize the no-login review flow, N5-N1 difficulty path, Settings links, rewarded-ad entry point, privacy posture, and local verification evidence.
`release:verify` also regenerates `docs/production-device-smoke-test.md` and `.json`, which provide the manual TestFlight/physical-iPhone checklist required before setting `PRODUCTION_DEVICE_TESTED=1`.
`release:verify` also regenerates `docs/external-readiness.md` and `.json`, which map every external `release:status` row to the required hosting, App Store Connect, AdMob, EAS, or device-test action.
`release:verify` also regenerates `docs/external-todo-tracker.md` and `.json`, which group every external TODO/INFO row by phase, env key, account check, completion rule, and final commands blocked until clear.
`release:verify` also regenerates `docs/eas-env-checklist.md` and `.json`, which map `.env.example` keys to local release gates, EAS production environment variables, client-visible values, and recommended EAS visibility.
`release:verify` also regenerates `docs/store-submission-input-pack.md`, `docs/store-submission-input-pack.json`, and `docs/store-submission.env.template`, which turn the remaining external TODOs into one fillable `.env.local` template, EAS production env commands, App Store Connect field list, manual confirmations, and verification order.
`release:verify` also regenerates `docs/account-service-preflight.md` and `.json`, which map account and remote-service readiness to Expo/EAS, App Store Connect, AdMob, hosting, TestFlight, iOS build, and EAS Submit verification commands.
`release:verify` also regenerates `docs/eas-build-preflight.md` and `.json`, which verify the EAS production build profile, submit metadata path, final commands, `.easignore` upload policy, and remaining external gate before EAS build/submit.
`release:verify` also regenerates `docs/app-store-connect-checklist.md` and `.json`, which map App Store Connect manual fields such as age rating, content rights, privacy, encryption, pricing, availability, screenshots, and review notes to the current release evidence.
`release:verify` also regenerates `docs/release-packet.md` and `.json`, which combine the app version, language coverage, study-bank counts, generated release artifacts, `release:status` summary, and remaining external blockers into one handoff packet.
`release:verify` also regenerates `docs/eas-submission-checklist.md` and `.json`, which summarize the EAS metadata/build/submit profiles, evidence files, blockers, and final command sequence.
`release:verify` also regenerates `docs/final-launch-runbook.md` and `.json`, which combine local evidence, external blockers, account preflight, strict gate, metadata push, EAS build, TestFlight smoke, EAS submit, and App Review into one execution map.
`release:verify` also regenerates `docs/app-store-handoff-bundle.md` and `.json`, which index the public site, screenshots, metadata, review/privacy/ad evidence, EAS files, and source configuration snapshot with SHA-256 hashes for final App Store handoff.

`release:store-ready` is intentionally strict. It should fail until the external store setup and confirmations are complete.
