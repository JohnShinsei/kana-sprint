# Account And Service Preflight

This preflight keeps the external account and remote-service checks aligned with the current App Store handoff. Default mode is manual and does not contact EAS, Apple, AdMob, or hosting providers. Run live mode only when you are ready to test the signed-in machine state.

## Summary

- Mode: manual
- Checks: 10
- Commands ready: Yes
- External blocking items: 5
- Manual/TODO checks: 10
- OK checks: 0

## Commands

- Generate manual pack: `npm run account:preflight`
- Run live EAS probes: `npm run account:preflight -- --live`
- Final strict gate: `npm run release:verify && node scripts/release-check.js --strict`
- Metadata push: `npx eas-cli metadata:push`
- Build iOS: `npx eas-cli build --platform ios --profile production`
- Submit iOS: `npx eas-cli submit --platform ios --profile production`

## Required EAS Production Env

- `APP_STORE_BASE_URL`

## Remote Checks

| Status | System | Verification command | Next action |
| --- | --- | --- | --- |
| MANUAL | Expo account | `npx eas-cli whoami` | Log in with npx eas-cli login, then rerun npm run account:preflight -- --live. |
| MANUAL | EAS project linkage | `npx eas-cli project:info` | If the project is not linked, run npx eas-cli project:init and confirm the project ID before building. |
| MANUAL | EAS production environment | `npx eas-cli env:list production --format long --scope project` | Use docs/store-submission-input-pack.md to create or update the production EAS environment variables. |
| MANUAL | Remote app version | `npx eas-cli build:version:get --platform ios --profile production --json --non-interactive` | Run npx eas-cli build:version:set after the final bundle ID and EAS project are confirmed. |
| MANUAL | App Store Connect | `npm run metadata:ios` | Create the App Store Connect record, fill review contact fields, then run npm run metadata:ios after release:store-ready passes. |
| MANUAL | AdMob production account | `npm run ads:audit` | Create real AdMob apps and rewarded units, configure Privacy & messaging, then fill .env.local and EAS production env values. |
| MANUAL | Public HTTPS hosting | `npm run site:verify-hosting` | Host the site/ directory, set APP_STORE_BASE_URL or explicit support/privacy URLs, then rerun site verification. |
| MANUAL | iOS production build | `npx eas-cli build --platform ios --profile production` | After all external TODOs are clear, run npm run release:store-ready and npm run build:ios. |
| MANUAL | TestFlight or physical iPhone | `docs/production-device-smoke-test.md` | Install the submitted build through TestFlight or on a real iPhone and complete the smoke checklist. |
| MANUAL | EAS Submit to App Store Connect | `npx eas-cli submit --platform ios --profile production` | Run npm run submit:ios only after release:store-ready and production device testing pass. |

## Live Probe Output

| Status | Command | Detail |
| --- | --- | --- |
| MANUAL | `npm run account:preflight -- --live` | Live account checks were not run in default release verification. |

## External Blockers

| Status | Item | Detail |
| --- | --- | --- |
| TODO | App Store review contact | Missing: APP_STORE_REVIEW_FIRST_NAME, APP_STORE_REVIEW_LAST_NAME, APP_STORE_REVIEW_EMAIL, APP_STORE_REVIEW_PHONE |
| TODO | APP_STORE_BUNDLE_ID_CONFIRMED | Set to 1 only after the real external action is complete. |
| TODO | APP_STORE_CONNECT_RECORD_READY | Set to 1 only after the real external action is complete. |
| TODO | APP_STORE_PRIVACY_ANSWERS_REVIEWED | Set to 1 only after the real external action is complete. |
| TODO | PRODUCTION_DEVICE_TESTED | Set to 1 only after the real external action is complete. |

## Official References

- Expo SDK 56 reference: https://docs.expo.dev/versions/v56.0.0/
- EAS Build setup: https://docs.expo.dev/build/setup/
- EAS CLI reference: https://docs.expo.dev/eas/cli/
- EAS environment variables: https://docs.expo.dev/eas/environment-variables/
- EAS Submit: https://docs.expo.dev/submit/introduction/
