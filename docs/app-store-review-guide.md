# App Store Review Guide

## App

- Name: Kana Sprint
- Version: 1.0.0
- Bundle ID: com.john.kanasprint
- Tablet support: Yes
- UI localizations: zh-Hans, zh-Hant, en, fr, it, de, es-ES, ko, pl, pt-BR

## Reviewer Notes

Kana Sprint does not require sign-in. Reviewers can start a practice run directly, switch N5-N1 difficulty, open Settings for language and music, and use the rewarded-ad continue entry point when production AdMob IDs are configured.

- Demo account required: No
- Sign-in required: No
- Review contact ready in EAS Metadata: No

## Walkthrough

1. Launch the app. The first screen is the playable practice screen, not a marketing page.
2. Tap Start Practice to begin a 60-second round.
3. Answer four-choice kana, vocabulary, and original anime-style line prompts.
4. Use the N5-N1 difficulty selector before starting a run to verify level separation.
5. Open Settings to change UI language, music, local progress reset, support/privacy/open-source links, and ad privacy options when UMP requires them.
6. When a run ends, use the rewarded-ad continue entry point if live AdMob IDs are configured for the production build.

## Privacy And Data Use

- No account, login, cloud sync, analytics, location, contacts, camera, microphone, push notifications, or user-generated content.
- Progress, high scores, daily streaks, daily goal progress, learned counts, selected difficulty, language, and music settings stay on device, and progress can be reset from Settings.
- Rewarded ads are optional and only used for continuing a run. Ad requests are configured as non-personalized by default.
- Settings exposes Support, Privacy, Open source notices, and Ad privacy when Google UMP says privacy options are required.

## Privacy Manifest

- Privacy manifest audit: docs/privacy-manifest-audit.md
- Audit risk: PASS
- iOS tracking: No
- Collected data types: 0
- Required reason APIs ready: Yes
- Required reason API categories: 4
- Microphone disabled: Yes

## Content Rights

- Kana Sprint uses original anime-style study lines and does not include known protected anime quotes, characters, titles, or third-party story worlds.
- Content rights audit: docs/content-rights-audit.md
- Audit risk: PASS
- Protected IP term hits: 0
- Original anime-style line prompts: 148
- App Store locales with originality claim: 10

## Local Verification Evidence

- App Store locales in metadata preview: 10
- App Store screenshot entries: 176
- Public support/privacy/license pages: 44
- Runtime UI flow audit: docs/runtime-ui-flow-audit.md
- Runtime UI flow ready: Yes (21/21 checks)
- Final commands: npm run release:status -> npm run release:verify -> npm run release:store-ready
