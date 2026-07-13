# EAS Environment Checklist

This checklist maps `.env.example` to EAS production environment variables, local release gates, and App Store metadata usage.

## EAS Production Profile

- `build.production.environment`: production
- Production profile ready: Yes
- Production auto-increment: Yes
- App version source: remote

## Summary

- Env keys: 18
- Required for EAS production build: 1
- Client-visible after bundling: 8
- Sensitive visibility: 8
- Plaintext visibility: 10

Client-visible values should not use EAS secret visibility, because values embedded in the app bundle are readable by anyone running the app. Use sensitive visibility for AdMob IDs and review contact fields to reduce log exposure, but still treat bundled values as public.

## Commands

- `eas env:create --name EXPO_PUBLIC_ADMOB_IOS_APP_ID --environment production --visibility sensitive`
- `eas env:create --name APP_STORE_BASE_URL --environment production --visibility plaintext`
- `eas env:pull --environment production`
- `npm run release:status`

## Keys

| Key | Group | EAS production | Visibility | Where to set | Current release status | Validation |
| --- | --- | --- | --- | --- | --- | --- |
| `EXPO_PUBLIC_ADMOB_IOS_APP_ID` | AdMob | No | sensitive | local .env.local + EAS production | Live AdMob IDs: INFO | AdMob app ID: ca-app-pub-0000000000000000~0000000000 |
| `EXPO_PUBLIC_ADMOB_ANDROID_APP_ID` | AdMob | No | sensitive | local .env.local + EAS production | Live AdMob IDs: INFO | AdMob app ID: ca-app-pub-0000000000000000~0000000000 |
| `EXPO_PUBLIC_ADMOB_REWARDED_IOS_UNIT_ID` | AdMob | No | sensitive | local .env.local + EAS production | Live AdMob IDs: INFO | Rewarded ad unit ID: ca-app-pub-0000000000000000/0000000000 |
| `EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_UNIT_ID` | AdMob | No | sensitive | local .env.local + EAS production | Live AdMob IDs: INFO | Rewarded ad unit ID: ca-app-pub-0000000000000000/0000000000 |
| `APP_STORE_BASE_URL` | Public store URLs | Yes | plaintext | local .env.local + EAS production | Public support URL: OK<br>Public privacy URL: OK<br>Public marketing URL: OK | Production HTTPS root URL; can generate /support and /privacy URLs |
| `APP_STORE_MARKETING_URL` | Public store URLs | No | plaintext | optional local .env.local + EAS production when used | Public marketing URL: OK | Optional production HTTPS marketing URL |
| `APP_STORE_SUPPORT_URL` | Public store URLs | No | plaintext | optional override in local .env.local + EAS production | Public support URL: OK | Production HTTPS support URL; APP_STORE_BASE_URL can derive it |
| `APP_STORE_PRIVACY_URL` | Public store URLs | No | plaintext | optional override in local .env.local + EAS production | Public privacy URL: OK | Production HTTPS privacy policy URL; APP_STORE_BASE_URL can derive it |
| `APP_STORE_REVIEW_FIRST_NAME` | App Store review contact | No | sensitive | local gate + CI/EAS workflow if metadata is automated | App Store review contact: TODO | Non-empty first name for App Review contact |
| `APP_STORE_REVIEW_LAST_NAME` | App Store review contact | No | sensitive | local gate + CI/EAS workflow if metadata is automated | App Store review contact: TODO | Non-empty last name for App Review contact |
| `APP_STORE_REVIEW_EMAIL` | App Store review contact | No | sensitive | local gate + CI/EAS workflow if metadata is automated | App Store review contact: TODO | Reachable email address |
| `APP_STORE_REVIEW_PHONE` | App Store review contact | No | sensitive | local gate + CI/EAS workflow if metadata is automated | App Store review contact: TODO | Reachable phone number with at least 7 digits |
| `APP_STORE_PRIVACY_ANSWERS_REVIEWED` | Manual release confirmations | No | plaintext | local gate + CI/EAS workflow | APP_STORE_PRIVACY_ANSWERS_REVIEWED: TODO | Set to 1 only after App Store privacy answers match the final build |
| `ADMOB_PRIVACY_MESSAGES_CONFIGURED` | Manual release confirmations | No | plaintext | local gate + CI/EAS workflow | ADMOB_PRIVACY_MESSAGES_CONFIGURED: INFO | Set to 1 only after AdMob Privacy & messaging is configured and tested |
| `APP_STORE_BUNDLE_ID_CONFIRMED` | Manual release confirmations | No | plaintext | local gate + CI/EAS workflow | APP_STORE_BUNDLE_ID_CONFIRMED: TODO | Set to 1 only after final bundle ID/package records are confirmed |
| `APP_STORE_CONNECT_RECORD_READY` | Manual release confirmations | No | plaintext | local gate + CI/EAS workflow | APP_STORE_CONNECT_RECORD_READY: TODO | Set to 1 only after the App Store Connect record exists |
| `EAS_REMOTE_VERSION_INITIALIZED` | Manual release confirmations | No | plaintext | local gate + CI/EAS workflow | EAS_REMOTE_VERSION_INITIALIZED: OK | Set to 1 only after npx eas-cli build:version:set is complete |
| `PRODUCTION_DEVICE_TESTED` | Manual release confirmations | No | plaintext | local gate + CI/EAS workflow | PRODUCTION_DEVICE_TESTED: TODO | Set to 1 only after the exact production/TestFlight build passes device smoke |

## Official References

- Expo SDK 56 reference: https://docs.expo.dev/versions/v56.0.0/
- EAS environment variables: https://docs.expo.dev/eas/environment-variables/
