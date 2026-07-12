# Data Flow Privacy Audit

This audit checks whether the code supports the App Store privacy posture: no account, no app-owned network upload, no analytics SDK, no user-generated content, and local-only progress/settings storage.

## Summary

- Risk: PASS
- Local data-flow posture ready: Yes
- App-owned network request hits: 0
- Analytics SDK hits: 0
- Auth/account SDK hits: 0
- User-content entry hits: 0
- Sensitive dependency hits: 0
- Local storage keys: 2
- External link entries: 1
- App-code personal data collection: No
- Account required: No
- User-generated content: No
- Analytics enabled: No

## Checks

| Check | Passed | Evidence |
| --- | --- | --- |
| app-owned-network | Yes | No app-owned fetch/XHR/WebSocket/beacon/GraphQL client is present in runtime app code |
| account-auth | Yes | No account, login, auth, cloud-sync, or profile SDK is included |
| analytics | Yes | No analytics, crash analytics, telemetry, or event tracking SDK is included |
| user-content | Yes | No free-text, upload, camera, image, document, or form-data user-content entry exists |
| sensitive-apis | Yes | Camera, contacts, location, notification, microphone recording, and media picker capabilities are absent or blocked |
| local-storage | Yes | Progress and settings use only the two documented AsyncStorage keys |
| local-progress-reset | Yes | Settings exposes a local-only progress reset that rewrites only the progress store |
| external-links | Yes | Support, privacy, and open source notice pages are user-initiated external links from Settings only |
| ad-boundary | Yes | Google Mobile Ads is isolated behind the rewarded-ad gate and AdMob release audit |
| privacy-docs | Yes | Privacy manifest and App Store privacy answer pack match the no-account local-data posture |

## Local Storage

- Library: @react-native-async-storage/async-storage
- Local only: Yes
- Local progress reset available: Yes

- `@kana-sprint/progress-v1`
- `@kana-sprint/settings-v1`

## Network Boundary

- App-owned network ready: Yes
- Support/privacy/license links only: Yes

- None.

## Ads Boundary

- Google Mobile Ads dependency: ^16.3.4
- AdMob state: NO_LIVE_ADS
- Local ad integration ready: Yes
- Live ads ready: No
- External ad setup ready: No

## Capability Scan

- None.

## Privacy Evidence

- Privacy manifest risk: PASS
- Privacy manifest tracking: No
- Privacy manifest collected data types: 0
- Privacy answer risk: PASS
- Privacy answer current state: NO_LIVE_ADS
- App-code personal data collection: No
- Account required: No
- Tracking declared by app code: No

## Commands

- `npm run privacy:data-flow`
- `npm run privacy:manifest`
- `npm run privacy:answers`
- `npm run ads:audit`
- `npm run release:verify`

## Official References

- Apple App Privacy Details: https://developer.apple.com/app-store/app-privacy-details/
- Apple Privacy Manifest Files: https://developer.apple.com/documentation/bundleresources/privacy-manifest-files
- Expo SDK 56 reference: https://docs.expo.dev/versions/v56.0.0/
