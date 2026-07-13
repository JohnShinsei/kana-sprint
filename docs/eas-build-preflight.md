# EAS Build Preflight

This preflight checks the local EAS production build and submit setup before App Store metadata, build, and submit commands run.

## Summary

- Risk: PASS
- Local EAS setup ready: Yes
- External gate ready: No
- Strict store-ready gate ready: No
- Blocking external items: 5
- Local failures: 0

## App

- Name: Kana Sprint
- Version: 1.0.0
- iOS bundle ID: com.john.kanasprint
- iOS build number: 1
- Android package: com.john.kanasprint
- Android version code: 1
- Tablet support: Yes
- Non-exempt encryption: No
- iOS privacy tracking: No

## EAS Profiles

- CLI requirement: >= 16.0.0
- App version source: remote
- Production auto-increment: Yes
- Production environment: production
- Production distribution: store
- Production profile ready: Yes
- Submit metadata path: ./store.config.js
- Submit profile ready: Yes

## Commands

- Metadata: `npx eas-cli metadata:push`
- Build: `npx eas-cli build --platform ios --profile production`
- Submit: `npx eas-cli submit --platform ios --profile production`
- Remote version init: `npx eas-cli build:version:set`
- Strict gate: `npm run release:verify && node scripts/release-check.js --strict`

## Upload Policy

- `.easignore` present: Yes
- Runtime assets kept: Yes
- Store/handoff artifacts excluded: Yes

| Required entry | Present |
| --- | --- |
| `node_modules/` | Yes |
| `.expo/` | Yes |
| `.release-web-check/` | Yes |
| `.env*.local` | Yes |
| `/ios` | Yes |
| `/android` | Yes |
| `/assets/store` | Yes |
| `/site` | Yes |
| `/docs` | Yes |

| Forbidden broad exclusion | Absent |
| --- | --- |
| `/assets` | Yes |
| `/assets/bgm` | Yes |
| `/assets/icon.png` | Yes |
| `/assets/splash-icon.png` | Yes |

## Environment

- EAS env checklist: docs/eas-env-checklist.md
- Production environment ready: Yes
- Required production build env values: 1
- Client-visible values: 8

## External Gate

- External readiness checklist: docs/external-readiness.md
- Readiness items: 11
- Blocking items: 5

- [TODO] App Store review contact: Missing: APP_STORE_REVIEW_FIRST_NAME, APP_STORE_REVIEW_LAST_NAME, APP_STORE_REVIEW_EMAIL, APP_STORE_REVIEW_PHONE
- [TODO] APP_STORE_BUNDLE_ID_CONFIRMED: Set to 1 only after the real external action is complete.
- [TODO] APP_STORE_CONNECT_RECORD_READY: Set to 1 only after the real external action is complete.
- [TODO] APP_STORE_PRIVACY_ANSWERS_REVIEWED: Set to 1 only after the real external action is complete.
- [TODO] PRODUCTION_DEVICE_TESTED: Set to 1 only after the real external action is complete.

## Official References

- Expo SDK 56 reference: https://docs.expo.dev/versions/v56.0.0/
- EAS Build eas.json: https://docs.expo.dev/build/eas-json/
- EAS Submit eas.json: https://docs.expo.dev/submit/eas-json/
