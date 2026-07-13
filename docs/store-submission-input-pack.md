# Store Submission Input Pack

This pack is the fillable handoff for the remaining external App Store, EAS, AdMob, hosting, and device-test inputs. It is generated from `.env.example`, `docs/external-readiness.json`, `docs/eas-env-checklist.json`, and `release:status`.

## Summary

- Local evidence ready: Yes
- Env keys to fill: 18
- External readiness items: 11
- Blocking external items: 5
- EAS production build keys: 3
- Manual confirmations: 6
- Standalone env template: `docs/store-submission.env.template`

## Fill .env.local

Create or update `.env.local` from `docs/store-submission.env.template` or with the values below. Keep manual confirmations at `0` until the real account, store, or device action is complete.

```dotenv
# AdMob
EXPO_PUBLIC_ADMOB_IOS_APP_ID=<ca-app-pub-0000000000000000~0000000000>
EXPO_PUBLIC_ADMOB_ANDROID_APP_ID=<ca-app-pub-0000000000000000~0000000000>
EXPO_PUBLIC_ADMOB_REWARDED_IOS_UNIT_ID=<ca-app-pub-0000000000000000/0000000000>
EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_UNIT_ID=<ca-app-pub-0000000000000000/0000000000>

# Public store URLs
APP_STORE_BASE_URL=<production HTTPS URL>
APP_STORE_MARKETING_URL=<production HTTPS URL>
APP_STORE_SUPPORT_URL=<production HTTPS URL>
APP_STORE_PRIVACY_URL=<production HTTPS URL>

# App Store review contact
APP_STORE_REVIEW_FIRST_NAME=<review first name>
APP_STORE_REVIEW_LAST_NAME=<review last name>
APP_STORE_REVIEW_EMAIL=<review email address>
APP_STORE_REVIEW_PHONE=<review phone number>

# Manual release confirmations
APP_STORE_PRIVACY_ANSWERS_REVIEWED=0
ADMOB_PRIVACY_MESSAGES_CONFIGURED=0
APP_STORE_BUNDLE_ID_CONFIRMED=0
APP_STORE_CONNECT_RECORD_READY=0
EAS_REMOTE_VERSION_INITIALIZED=0
PRODUCTION_DEVICE_TESTED=0
```

## Mirror To EAS Production

Run these for the build-time values used by the EAS production profile. Paste values interactively instead of placing production secrets directly in shell history.

- `eas env:create --name APP_STORE_BASE_URL --environment production --visibility plaintext`
- `eas env:create --name APP_STORE_SUPPORT_URL --environment production --visibility plaintext`
- `eas env:create --name APP_STORE_PRIVACY_URL --environment production --visibility plaintext`

## App Store Connect Fields

| Field | Env keys | Current status | Destination | Action |
| --- | --- | --- | --- | --- |
| Public support URL | `APP_STORE_BASE_URL`, `APP_STORE_SUPPORT_URL` | OK | App Store Connect support URL and Settings support link. | Host site/ over HTTPS and expose the support page. APP_STORE_BASE_URL can generate /support automatically, or APP_STORE_SUPPORT_URL can point to a custom production HTTPS URL. |
| Public privacy URL | `APP_STORE_BASE_URL`, `APP_STORE_PRIVACY_URL` | OK | App Store Connect privacy policy URL and Settings privacy link. | Host site/ over HTTPS and expose the privacy policy page. APP_STORE_BASE_URL can generate /privacy automatically, or APP_STORE_PRIVACY_URL can point to a custom production HTTPS URL. |
| Public marketing URL | `APP_STORE_BASE_URL`, `APP_STORE_MARKETING_URL` | OK | Optional App Store Connect marketing URL. | Optional. Set APP_STORE_MARKETING_URL or APP_STORE_BASE_URL if the App Store listing should include a marketing URL. |
| App Store review contact | `APP_STORE_REVIEW_FIRST_NAME`, `APP_STORE_REVIEW_LAST_NAME`, `APP_STORE_REVIEW_EMAIL`, `APP_STORE_REVIEW_PHONE` | TODO | App Review contact block in App Store Connect or EAS Metadata. | Add the review contact that Apple can use during App Review. Use a monitored email address and a reachable phone number. |
| Live AdMob IDs | `EXPO_PUBLIC_ADMOB_IOS_APP_ID`, `EXPO_PUBLIC_ADMOB_ANDROID_APP_ID`, `EXPO_PUBLIC_ADMOB_REWARDED_IOS_UNIT_ID`, `EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_UNIT_ID` | INFO | Google AdMob app IDs and rewarded ad unit IDs for the submitted build. | Optional for a NO_LIVE_ADS launch. Before monetization, create production AdMob apps and rewarded ad units, then put all four real IDs into .env.local and the EAS production environment. |

## Manual Confirmations

| Env key | Current status | Set to | Required action |
| --- | --- | --- | --- |
| `APP_STORE_PRIVACY_ANSWERS_REVIEWED` | TODO | `1` | Fill App Store Connect privacy answers from docs/app-store-privacy-answers.md after deciding whether live AdMob IDs are enabled for the submitted build. |
| `ADMOB_PRIVACY_MESSAGES_CONFIGURED` | INFO | `1` | Required only for a LIVE_ADMOB build. Configure AdMob Privacy & messaging for release regions and verify UMP canRequestAds before requesting rewarded ads. |
| `APP_STORE_BUNDLE_ID_CONFIRMED` | TODO | `1` | Confirm app.json ios.bundleIdentifier and android.package are the final store identifiers before the first production build. |
| `APP_STORE_CONNECT_RECORD_READY` | TODO | `1` | Create the App Store Connect app record for the final bundle ID and fill the app category, age rating, pricing, availability, and required compliance fields. |
| `EAS_REMOTE_VERSION_INITIALIZED` | OK | `1` | Log in to Expo and run npx eas-cli build:version:set once for the production iOS app because eas.json uses remote app version management. |
| `PRODUCTION_DEVICE_TESTED` | TODO | `1` | Install the production archive or TestFlight build on a real iPhone and complete docs/production-device-smoke-test.md for first launch, language selection, N5-N1 game loop, settings, support/privacy/open-source links, BGM, and rewarded-ad continue path. |

## Verification Order

1. `npm run store:input-pack`
2. `npm run release:status`
3. `npm run site:localized`
4. `npm run site:manifest`
5. `npm run site:deploy-audit`
6. `npm run site:verify-hosting`
7. `npm run metadata:preview`
8. `npx expo config --json`
9. `npm run metadata:ios`
10. `npx eas-cli build:version:set`
11. `npm run release-check`
12. `physical iPhone or TestFlight ad-flow test`
13. `npm run release:store-ready`
14. `npm run build:ios`
15. `docs/production-device-smoke-test.md`
16. `npm run release:verify`
17. `npm run submit:ios`

## Official References

- Expo SDK 56 reference: https://docs.expo.dev/versions/v56.0.0/
- EAS environment variables: https://docs.expo.dev/eas/environment-variables/
