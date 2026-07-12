# App Store Handoff Bundle

This file is the local upload and reviewer-evidence manifest. It indexes the generated public website, screenshots, metadata, review notes, privacy/ad evidence, EAS configuration, and source configuration snapshot.

## Summary

- Risk: PASS
- Local handoff ready: Yes
- External store ready: No
- Files indexed: 301
- Missing files: 0
- Total bytes: 18419553
- Public site pages: 44
- Public site routes: 44
- Screenshot entries: 176
- Localized screenshot entries: 160
- App Store locales: 10
- External blocking items: 7

## Groups

| Group | Files | Missing | Bytes |
| --- | ---: | ---: | ---: |
| Public support/privacy/license website | 56 | 0 | 358111 |
| App Store screenshot upload packs | 176 | 0 | 16869189 |
| App Store metadata sources | 7 | 0 | 95673 |
| Review, privacy, ads, and content evidence | 30 | 0 | 213230 |
| EAS build and submit handoff | 22 | 0 | 195108 |
| Source and runtime configuration snapshot | 10 | 0 | 688242 |

## Upload Plan

1. Host the full site/ directory over production HTTPS, preserving nested locale routes and control files; use .github/workflows/deploy-site.yml when publishing from GitHub Pages.
2. Upload App Store screenshots from assets/store/ios and assets/store/ios-localized according to docs/app-store-screenshot-manifest.json.
3. Push metadata with npm run metadata:ios after public support/privacy URLs and review contact values are set.
4. Fill App Store Connect privacy, age rating, export compliance, pricing, and review fields using the docs/ evidence files in this handoff.
5. Run npm run release:store-ready, then npm run build:ios and npm run submit:ios.

## External Blockers

| Status | Item | Detail |
| --- | --- | --- |
| TODO | App Store review contact | Missing: APP_STORE_REVIEW_FIRST_NAME, APP_STORE_REVIEW_LAST_NAME, APP_STORE_REVIEW_EMAIL, APP_STORE_REVIEW_PHONE |
| TODO | Live AdMob IDs | No production AdMob IDs are set; live rewarded ads remain disabled. |
| TODO | APP_STORE_BUNDLE_ID_CONFIRMED | Set to 1 only after the real external action is complete. |
| TODO | APP_STORE_CONNECT_RECORD_READY | Set to 1 only after the real external action is complete. |
| TODO | APP_STORE_PRIVACY_ANSWERS_REVIEWED | Set to 1 only after the real external action is complete. |
| TODO | ADMOB_PRIVACY_MESSAGES_CONFIGURED | Set to 1 only after the real external action is complete. |
| TODO | PRODUCTION_DEVICE_TESTED | Set to 1 only after the real external action is complete. |

## Commands

- `npm run release:verify`
- `npm run handoff:bundle`
- `npm run release:store-ready`
- `npm run metadata:ios`
- `npm run build:ios`
- `npm run submit:ios`

The full file inventory with SHA-256 hashes is in `docs/app-store-handoff-bundle.json`.
