# Privacy Manifest Audit

## Summary

- Risk: PASS
- iOS tracking: No
- Tracking domains: 0
- Collected data types: 0
- Required reason API categories: 4
- Required reason APIs ready: Yes
- Non-exempt encryption: No
- Android blocked permissions: 3
- Microphone disabled: Yes
- Live AdMob enabled in resolved Expo config: No

## iOS Privacy Manifest

| Required reason API | Declared reasons | Status | Why it is declared |
| --- | --- | --- | --- |
| NSPrivacyAccessedAPICategoryUserDefaults | CA92.1 | Ready | App-specific progress, scores, language, music, and settings are stored locally. |
| NSPrivacyAccessedAPICategoryFileTimestamp | C617.1 | Ready | React Native and Expo dependencies may inspect bundled asset file timestamps. |
| NSPrivacyAccessedAPICategorySystemBootTime | 35F9.1 | Ready | React Native and Expo use elapsed-time APIs for in-app timers and event timing. |
| NSPrivacyAccessedAPICategoryDiskSpace | E174.1 | Ready | Expo file-system code checks available space before writing local files and assets. |

## Platform Posture

- `ITSAppUsesNonExemptEncryption=false`: Yes
- `expo-audio` microphone permission disabled: Yes
- Android blocked permissions:
- `android.permission.RECORD_AUDIO`
- `android.permission.FOREGROUND_SERVICE`
- `android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK`

## AdMob Privacy Posture

- Google Mobile Ads dependency present: Yes
- Live ads enabled: No
- Native AdMob plugin configured: No
- UMP consent flow present: Yes
- Rewarded ad requests default to non-personalized: Yes
- Final App Store privacy answer confirmation: `APP_STORE_PRIVACY_ANSWERS_REVIEWED=1`

## Documents

- Privacy answers mention Apple App Privacy Details: Yes
- Privacy answers mention Google Mobile Ads: Yes
- Privacy policy mentions no account: Yes
- Privacy policy mentions local data: Yes

## Official References

- Apple Privacy Manifest Files: https://developer.apple.com/documentation/bundleresources/privacy-manifest-files
- Apple Describing Data Use In Privacy Manifests: https://developer.apple.com/documentation/bundleresources/describing-data-use-in-privacy-manifests
- Apple Describing Use Of Required Reason API: https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api
- Apple App Privacy Details: https://developer.apple.com/app-store/app-privacy-details/

This audit is a static release check and not legal advice. Re-run `npm run privacy:manifest` and `npm run release:verify` after changing native dependencies, AdMob settings, privacy policy text, or App Store privacy answers.
