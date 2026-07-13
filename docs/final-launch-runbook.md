# Final Launch Runbook

This runbook is the last-mile execution map for moving Kana Sprint from local release evidence to App Store submission. Commands that can create remote state are marked BLOCKED until `release:status` has zero TODO/BAD rows.

## Summary

- Local evidence ready: Yes
- External setup ready: No
- Strict store gate ready: No
- Ready to run metadata/build/submit: No
- Phases: 9
- Ready phases: 1
- TODO phases: 3
- Blocked phases: 5
- External blocking items: 5

## Phase Plan

| Status | Phase | Command | Evidence | Current blockers |
| --- | --- | --- | --- | --- |
| READY | Refresh local release evidence | `npm run release:verify` | `docs/release-packet.md`, `docs/app-store-handoff-bundle.md`, `docs/final-launch-runbook.md` | None |
| TODO | Fill external inputs | `npm run store:input-pack` | `docs/store-submission-input-pack.md`, `docs/external-readiness.md` | App Store review contact, APP_STORE_BUNDLE_ID_CONFIRMED, APP_STORE_CONNECT_RECORD_READY, APP_STORE_PRIVACY_ANSWERS_REVIEWED, PRODUCTION_DEVICE_TESTED |
| TODO | Verify accounts and remote services | `npm run account:preflight -- --live` | `docs/account-service-preflight.md` | Expo account, EAS project linkage, EAS production environment, Remote app version, App Store Connect, AdMob production account, Public HTTPS hosting, iOS production build, TestFlight or physical iPhone, EAS Submit to App Store Connect |
| BLOCKED | Run strict store-ready gate | `npm run release:store-ready` | `docs/release-packet.md`, `docs/eas-submission-checklist.md` | App Store review contact, APP_STORE_BUNDLE_ID_CONFIRMED, APP_STORE_CONNECT_RECORD_READY, APP_STORE_PRIVACY_ANSWERS_REVIEWED, PRODUCTION_DEVICE_TESTED |
| BLOCKED | Push App Store metadata | `npm run metadata:ios` | `store.config.js`, `docs/app-store-metadata-upload-packet.md` | App Store review contact, APP_STORE_BUNDLE_ID_CONFIRMED, APP_STORE_CONNECT_RECORD_READY, APP_STORE_PRIVACY_ANSWERS_REVIEWED, PRODUCTION_DEVICE_TESTED |
| BLOCKED | Build iOS production archive | `npm run build:ios` | `docs/eas-build-preflight.md`, `docs/account-service-preflight.md` | App Store review contact, APP_STORE_BUNDLE_ID_CONFIRMED, APP_STORE_CONNECT_RECORD_READY, APP_STORE_PRIVACY_ANSWERS_REVIEWED, PRODUCTION_DEVICE_TESTED |
| TODO | Run TestFlight or physical-device smoke | `docs/production-device-smoke-test.md` | `docs/production-device-smoke-test.md` | PRODUCTION_DEVICE_TESTED |
| BLOCKED | Submit iOS build | `npm run submit:ios` | `docs/eas-submission-checklist.md` | App Store review contact, APP_STORE_BUNDLE_ID_CONFIRMED, APP_STORE_CONNECT_RECORD_READY, APP_STORE_PRIVACY_ANSWERS_REVIEWED, PRODUCTION_DEVICE_TESTED |
| BLOCKED | Send for App Review | `App Store Connect` | `docs/app-store-connect-checklist.md`, `docs/app-store-review-guide.md` | App Store review contact, APP_STORE_BUNDLE_ID_CONFIRMED, APP_STORE_CONNECT_RECORD_READY, APP_STORE_PRIVACY_ANSWERS_REVIEWED, PRODUCTION_DEVICE_TESTED |

## Final Command Order

1. `npm run release:verify`
2. `npm run account:preflight -- --live`
3. `npm run release:store-ready`
4. `npm run metadata:ios`
5. `npm run build:ios`
6. `npm run submit:ios`

## Current Blockers

- [TODO] App Store review contact: Missing: APP_STORE_REVIEW_FIRST_NAME, APP_STORE_REVIEW_LAST_NAME, APP_STORE_REVIEW_EMAIL, APP_STORE_REVIEW_PHONE
- [TODO] APP_STORE_BUNDLE_ID_CONFIRMED: Set to 1 only after the real external action is complete.
- [TODO] APP_STORE_CONNECT_RECORD_READY: Set to 1 only after the real external action is complete.
- [TODO] APP_STORE_PRIVACY_ANSWERS_REVIEWED: Set to 1 only after the real external action is complete.
- [TODO] PRODUCTION_DEVICE_TESTED: Set to 1 only after the real external action is complete.

## Evidence Counts

- Env inputs: 18
- EAS production env keys: 3
- Account/service checks: 10
- EAS submission sequence commands: 5

## Official References

- Expo SDK 56 reference: https://docs.expo.dev/versions/v56.0.0/
- EAS Build setup: https://docs.expo.dev/build/setup/
- EAS CLI reference: https://docs.expo.dev/eas/cli/
- EAS Submit: https://docs.expo.dev/submit/introduction/
