# App Store Notes

## Product positioning

Kana Sprint is a lightweight Japanese learning game for kana and JLPT N5-N1 vocabulary practice. The core loop is short and repeatable: answer as many kana, vocabulary, and original anime-style line prompts as possible in 60 seconds, build combos, replay the daily challenge, and revisit recent mistakes through the local weak-item review entry.

Current study bank: N5 has 133 vocabulary prompts and 42 original line prompts; N4, N3, N2, and N1 each have 90 vocabulary prompts and 24 original line prompts.

The anime-style content is original study material and does not quote or reference protected anime scripts, characters, brands, or titles. The release check scans study data, App Store metadata, and public support/privacy/license pages for common protected anime IP terms so this stays true over time.

## Suggested metadata

- Name: Kana Sprint
- Subtitle: Japanese speed-learning game
- Category: Games / Educational
- Age rating: 4+
- Keywords: Japanese, kana, hiragana, katakana, vocabulary, anime-style lines, JLPT, language game

## Supported languages

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

## Review notes

The app does not require login, user-generated content, purchases, location, contacts, camera, microphone, background audio, or push notifications. Progress is stored locally on device through AsyncStorage.

The iOS privacy manifest is configured in `app.json` for the current dependency set. It declares no tracking, no collected data, and required-reason entries for UserDefaults and file timestamps used by React Native/Expo dependencies.

Rewarded ads are wired for the continue-run entry point through `react-native-google-mobile-ads`. Before enabling production ads, provide AdMob app IDs and rewarded-unit IDs through environment variables, confirm `extra.admob.liveAdsEnabled` is true in `npx expo config --json`, and update App Store privacy answers for the Google Mobile Ads SDK behavior.

See `docs/admob-setup.md` for the exact IDs and SDK wiring steps.
Run `npm run privacy:answers` and see `docs/app-store-privacy-answers.md` before filling the App Store Connect privacy form. After the form matches the final build, set `APP_STORE_PRIVACY_ANSWERS_REVIEWED=1` for the strict store-ready gate.

`store.config.js` generates EAS Metadata from `docs/app-store-localizations.json`. Before pushing metadata, set `APP_STORE_BASE_URL` or explicit `APP_STORE_SUPPORT_URL` and `APP_STORE_PRIVACY_URL`, plus the `APP_STORE_REVIEW_*` contact fields from `.env.example`. Local release scripts and config files read `.env.local`, `.env.production`, and `.env`; shell or EAS environment values still take priority.

The deployable support and privacy pages are in `site/`. Run `npm run site:localized`, host that folder over HTTPS, then point `APP_STORE_BASE_URL` at the hosted root so `/support`, `/privacy`, and `/<locale>/support` / `/<locale>/privacy` resolve.
Those URL values are exposed to the runtime app through Expo `extra.storeUrls`; the Settings panel opens localized Support, Privacy, and Open source pages for the selected UI language when `APP_STORE_BASE_URL` is set.

## Current pre-submission checklist

- Replace `com.john.kanasprint` with the final bundle ID if needed.
- Create an App Store Connect app record with the same bundle ID.
- Create AdMob iOS and Android app records and rewarded placements if ads are going live in v1.
- Fill `.env.local` from `.env.example`; the local release gate reads it directly.
- Run `npm run site:localized` before hosting `site/` so all App Store languages have support/privacy/license pages.
- Run `npm run site:manifest` before hosting `site/`; `docs/public-site-manifest.json` lists every deployable route, language, title, byte size, and hash.
- Run `npm run site:deploy-audit` before hosting `site/`; `docs/public-site-deploy-audit.md` checks the local deploy package and lists the public URL verification steps.
- Host the `site/` folder over HTTPS and confirm `/support` and `/privacy` are public.
- Confirm the localized support/privacy/license pages such as `/zh-Hans/support`, `/en/privacy`, and `/ko/licenses` are public.
- Confirm Settings opens the hosted Support, Privacy, and Open source pages in the release build.
- Log in to Expo and initialize EAS remote app versioning with `npx eas-cli build:version:set` once for iOS before the first store build.
- Run `npm run metadata:ios` after the App Store Connect record exists and the public support/privacy URLs are live.
- Run `npm run metadata:preview` before metadata upload if you want a local JSON preview of every App Store locale, field length, public URL status, and screenshot-pack count.
- Run `npm run localization:audit` before metadata upload if you want one generated check covering the 10 UI locales, App Store locales, localized screenshot packs, and localized public pages.
- Run `npm run age:rating` before filling App Store Connect age rating; `docs/app-store-age-rating-audit.md` keeps the all-NONE questionnaire posture tied to current app features, but App Store Connect remains the final rating source.
- Run `npm run privacy:answers` before filling App Store Connect privacy details; `docs/app-store-privacy-answers.md` records the current no-live-ads or live-AdMob state and the rows that need manual review.
- Run `npm run review:guide` before submission to regenerate the App Review walkthrough and no-login/privacy/ad-entry explanation.
- Run `npm run assets:manifest` before handoff if you want a standalone generated summary of runtime icon, splash, adaptive icon, favicon, and BGM file properties and hashes.
- Run `npm run release:packet` before handoff if you want a standalone generated summary of app versions, locales, study-bank counts, screenshot/site/metadata artifacts, and remaining external blockers.
- Run `npm run submission:checklist` before handoff if you want a standalone generated summary of the EAS metadata/build/submit profiles, evidence files, blockers, and final command sequence.
- Confirm `npx expo config --json` includes the `react-native-google-mobile-ads` plugin only when valid AdMob IDs are set.
- Run `npm run typecheck`.
- Run `npm run doctor`.
- Run `npm run release-check`; this checks app metadata, assets, screenshots, ads wiring, N5-N1 study-bank minimums, copyright-safe original anime-style wording, and non-English study-content translation coverage.
- Run `npm run release:verify` for the full local gate, including runtime asset manifest generation, screenshot regeneration, release packet generation, EAS submission checklist generation, Expo config resolution, and production Web export.
- Run `npm run release:store-ready` after filling final external values; this fails until support/privacy URLs, review contact fields, real AdMob IDs, App Store privacy answer confirmation, bundle ID confirmation, App Store Connect record creation, EAS remote version initialization, and physical-device/TestFlight validation are present.
- Generate App Store screenshots with `npm run screenshots:ios`; default English folders are `assets/store/ios/iphone-6.9`, `assets/store/ios/iphone-6.5`, `assets/store/ios/iphone-5.5`, and `assets/store/ios/ipad-13`.
- Generate `docs/app-store-screenshot-manifest.json` with `npm run screenshots:manifest`; it records the expected file path, App Store locale, device size, byte size, and hash for each screenshot.
- Upload localized screenshot packs from `assets/store/ios-localized/<locale>/...` for each App Store localization when possible, so the screenshots match the localized metadata instead of only showing English.
- Build with `npm run build:ios`.
- Test the production build on a physical iPhone before submission.
- After physical-device or TestFlight validation, set `PRODUCTION_DEVICE_TESTED=1` for the strict store-ready gate.
- Upload the generated 6.9-inch, 6.5-inch, and 5.5-inch iPhone screenshots, plus the 13-inch iPad screenshots while tablet support remains enabled.
