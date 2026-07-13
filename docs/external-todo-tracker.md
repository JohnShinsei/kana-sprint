# External TODO Tracker

This tracker keeps the remaining external App Store, EAS, AdMob, hosting, and device-test work tied to release-status, input fields, account checks, and final blocked commands.

## Summary

- External items: 11
- Blocking items: 5
- Optional info items: 2
- Env / confirmation keys: 18
- Related account checks: 10
- Blocked final commands: 5

## Final Commands Blocked Until Clear

- `npm run release:store-ready`
- `npm run metadata:ios`
- `npm run build:ios`
- `npm run submit:ios`

## Items By Phase

### Hosting

| Status | Item | Env / confirmation keys | Account checks | Completion rule |
| --- | --- | --- | --- | --- |
| OK | Public support URL | `APP_STORE_BASE_URL`, `APP_STORE_SUPPORT_URL` | `npx eas-cli env:list production --format long --scope project`<br>`npm run metadata:ios`<br>`npm run site:verify-hosting` | Fill APP_STORE_BASE_URL, APP_STORE_SUPPORT_URL, rerun the listed verification commands, and confirm release:status reports Public support URL as OK. |
| OK | Public privacy URL | `APP_STORE_BASE_URL`, `APP_STORE_PRIVACY_URL` | `npx eas-cli env:list production --format long --scope project`<br>`npm run metadata:ios`<br>`npm run site:verify-hosting` | Fill APP_STORE_BASE_URL, APP_STORE_PRIVACY_URL, rerun the listed verification commands, and confirm release:status reports Public privacy URL as OK. |

### Apple

| Status | Item | Env / confirmation keys | Account checks | Completion rule |
| --- | --- | --- | --- | --- |
| TODO | App Store review contact | `APP_STORE_REVIEW_FIRST_NAME`, `APP_STORE_REVIEW_LAST_NAME`, `APP_STORE_REVIEW_EMAIL`, `APP_STORE_REVIEW_PHONE` | `npm run metadata:ios` | Fill APP_STORE_REVIEW_FIRST_NAME, APP_STORE_REVIEW_LAST_NAME, APP_STORE_REVIEW_EMAIL, APP_STORE_REVIEW_PHONE, rerun the listed verification commands, and confirm release:status reports App Store review contact as OK. |
| TODO | APP_STORE_BUNDLE_ID_CONFIRMED | `APP_STORE_BUNDLE_ID_CONFIRMED` | `npx eas-cli project:info`<br>`npx eas-cli build --platform ios --profile production` | Set APP_STORE_BUNDLE_ID_CONFIRMED=1 only after the real action is complete, then rerun npm run release:status. |
| TODO | APP_STORE_CONNECT_RECORD_READY | `APP_STORE_CONNECT_RECORD_READY` | `npm run metadata:ios`<br>`npx eas-cli submit --platform ios --profile production` | Set APP_STORE_CONNECT_RECORD_READY=1 only after the real action is complete, then rerun npm run release:status. |
| TODO | APP_STORE_PRIVACY_ANSWERS_REVIEWED | `APP_STORE_PRIVACY_ANSWERS_REVIEWED` | Manual | Set APP_STORE_PRIVACY_ANSWERS_REVIEWED=1 only after the real action is complete, then rerun npm run release:status. |
| INFO | ADMOB_PRIVACY_MESSAGES_CONFIGURED | `ADMOB_PRIVACY_MESSAGES_CONFIGURED` | `npm run ads:audit` | Set ADMOB_PRIVACY_MESSAGES_CONFIGURED=1 only after the real action is complete, then rerun npm run release:status. |

### Admob

| Status | Item | Env / confirmation keys | Account checks | Completion rule |
| --- | --- | --- | --- | --- |
| INFO | Live AdMob IDs | `EXPO_PUBLIC_ADMOB_IOS_APP_ID`, `EXPO_PUBLIC_ADMOB_ANDROID_APP_ID`, `EXPO_PUBLIC_ADMOB_REWARDED_IOS_UNIT_ID`, `EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_UNIT_ID` | `npx eas-cli env:list production --format long --scope project`<br>`npm run ads:audit` | Fill EXPO_PUBLIC_ADMOB_IOS_APP_ID, EXPO_PUBLIC_ADMOB_ANDROID_APP_ID, EXPO_PUBLIC_ADMOB_REWARDED_IOS_UNIT_ID, EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_UNIT_ID, rerun the listed verification commands, and confirm release:status reports Live AdMob IDs as OK. |

### Expo

| Status | Item | Env / confirmation keys | Account checks | Completion rule |
| --- | --- | --- | --- | --- |
| OK | EAS_REMOTE_VERSION_INITIALIZED | `EAS_REMOTE_VERSION_INITIALIZED` | `npx eas-cli whoami`<br>`npx eas-cli build:version:get --platform ios --profile production --json --non-interactive`<br>`npx eas-cli build --platform ios --profile production` | Set EAS_REMOTE_VERSION_INITIALIZED=1 only after the real action is complete, then rerun npm run release:status. |

### Device

| Status | Item | Env / confirmation keys | Account checks | Completion rule |
| --- | --- | --- | --- | --- |
| TODO | PRODUCTION_DEVICE_TESTED | `PRODUCTION_DEVICE_TESTED` | `docs/production-device-smoke-test.md`<br>`npx eas-cli submit --platform ios --profile production` | Set PRODUCTION_DEVICE_TESTED=1 only after the real action is complete, then rerun npm run release:status. |

### Optional

| Status | Item | Env / confirmation keys | Account checks | Completion rule |
| --- | --- | --- | --- | --- |
| OK | Public marketing URL | `APP_STORE_BASE_URL`, `APP_STORE_MARKETING_URL` | `npm run site:verify-hosting` | Fill APP_STORE_BASE_URL, APP_STORE_MARKETING_URL, rerun the listed verification commands, and confirm release:status reports Public marketing URL as OK. |
