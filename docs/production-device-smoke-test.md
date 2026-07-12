# Production Device Smoke Test

Use this checklist on the exact production archive or TestFlight build intended for App Store review. It does not replace `release:store-ready`; it is the manual evidence required before setting `PRODUCTION_DEVICE_TESTED=1`.

## App

- Name: Kana Sprint
- Version: 1.0.0
- iOS bundle ID: com.john.kanasprint
- iOS build number: 1
- Expo: ~56.0.15
- React Native: 0.85.3
- UI locales: zh-Hans, zh-Hant, en, fr, it, de, es-ES, ko, pl, pt-BR
- App Store locales: zh-Hans, zh-Hant, en-US, fr-FR, it, de-DE, es-ES, ko, pl, pt-BR
- Screenshots: 176
- Public site pages: 44
- BGM tracks: 3
- Current device-test status: TODO - Set to 1 only after the real external action is complete.

## Result Capture

- Tester:
- Date:
- Device model:
- iOS version:
- Build source: TestFlight or production archive
- Build number: 1
- App version: 1.0.0
- Notes:

## Prerequisites

- [ ] Run npm run release:verify on the same workspace state that will be built.
- [ ] Clear npm run release:store-ready by filling the real public URLs, review contact, AdMob IDs, and external confirmation flags.
- [ ] Build the production archive with npm run build:ios and install the exact build through TestFlight or an equivalent physical-device flow.
- [ ] Use a real iPhone. Keep network available for support/privacy/open-source/ad checks, then repeat the offline fallback checks with network disabled.

## Checklist

### Install And First Launch

- [ ] P0 Install the production/TestFlight build and confirm the app name, icon, splash, version, and bundle identifier match the release packet.
  Expected: The app launches without crash or missing assets, and no development client UI appears.
- [ ] P0 Open the app from a fresh install and confirm the first screen is playable without login, account creation, tracking prompts, or onboarding gates.
  Expected: Start Practice and Daily Challenge are reachable immediately after local storage finishes loading.
- [ ] P1 Send the app to the background during the ready screen, return to foreground, and confirm the UI remains stable.
  Expected: No timer starts by itself, no sound unexpectedly plays, and controls stay responsive.

### Localization

- [ ] P0 Set the device to one supported language and confirm the UI follows system language by default. Supported UI locales: zh-Hans, zh-Hant, en, fr, it, de, es-ES, ko, pl, pt-BR.
  Expected: The top-level game screen, settings labels, buttons, and review-facing links use the expected language.
- [ ] P0 Open Settings and manually switch at least Simplified Chinese, English, Korean, and one European locale.
  Expected: The app updates text without restart, the language switch stays inside Settings, and Japanese is not offered as a UI language.
- [ ] P1 Inspect ready, playing, finished, and settings screens in the longest tested localization.
  Expected: Buttons, level labels, score text, and settings choices fit without overlap or clipped critical text.

### Gameplay Loop

- [ ] P0 Start an N5 practice run and answer several kana, vocabulary, line, and grammar prompts.
  Expected: Timer, score, combo, hearts, feedback, and four-choice answers update correctly.
- [ ] P0 Answer one question correctly and one question incorrectly.
  Expected: The answer reveal stays visible long enough to read the correct answer, kana/romaji reading, and localized meaning without blocking the next question.
- [ ] P0 Before a run, note the visible run mission, then play until the finish screen.
  Expected: The mission target appears before play, live mission progress appears during play, and the finish screen clearly shows mission completion or retry state.
- [ ] P1 After creating at least one weak item or clearing a level, return to the ready screen and tap the Next step recommendation.
  Expected: The recommendation prioritizes weak review, otherwise current-level practice, next-level advancement, or Daily when all levels are cleared.
- [ ] P1 Return to the ready screen after a few runs and inspect the milestone badges.
  Expected: First run, 3-day streak, 20 mastered, and N1 spark badges reflect local progress and never require an account or network sync.
- [ ] P0 Before starting runs, select N5, N4, N3, N2, and N1 once each and confirm the active question label matches the selected level.
  Expected: N5 includes kana foundations; N4-N1 stay in their level banks and progressively feel harder.
- [ ] P1 Switch Mix, Kana, Vocabulary, Lines, and Grammar modes where available, then start a short run in each.
  Expected: Questions match the selected mode and the app never presents empty options.
- [ ] P0 Tap at least one wrong answer during a run.
  Expected: Feedback shows the correction, combo resets, hearts decrease, and the run ends cleanly when hearts are exhausted.
- [ ] P0 While playing, tap the in-game exit control.
  Expected: The app returns to the ready screen without losing stored best score or freezing the timer.
- [ ] P1 Start Daily Challenge twice for the same level on the same day.
  Expected: The daily path is repeatable, daily best is saved, and regular practice remains separate.
- [ ] P0 Let a run finish normally.
  Expected: Final score, best score, daily best, Play Again, and Switch Mode flows are coherent.
- [ ] P1 Finish a run with at least one correct answer and one missed answer.
  Expected: The finish screen shows new mastered count, misses, weak-review count, and a direct review action when misses are available.

### Settings, Music, And Links

- [ ] P0 Open and close Settings from ready and playing states.
  Expected: Settings opens as a modal panel, closes cleanly, and does not corrupt the current run.
- [ ] P1 Enable music, switch Rush, Focus, and Night, then disable music.
  Expected: Music starts only after opt-in, track changes work, volume behavior is comfortable, and music stops when disabled.
- [ ] P0 Change level, language, music enabled state, and BGM track, then force close and reopen the app.
  Expected: Settings and progress restore from local storage.
- [ ] P0 Tap Support from Settings with production URLs configured.
  Expected: The localized HTTPS support page opens and matches the app language when localized URLs are available.
- [ ] P0 Tap Privacy from Settings with production URLs configured.
  Expected: The localized HTTPS privacy page opens and matches the final App Store privacy answers.
- [ ] P1 Tap Ad privacy options when the UMP privacy options entry is required, or confirm the unavailable state when it is not required.
  Expected: The app either opens the Google privacy options form or explains that ad privacy options are unavailable.

### Rewarded Ads And Privacy

- [ ] P0 If production AdMob IDs are not configured, tap Continue with ad during a run.
  Expected: The app shows an unavailable message and never crashes.
- [ ] P0 If production AdMob IDs are configured, complete UMP consent/privacy flow if shown, then tap Continue with ad during a run.
  Expected: A rewarded ad loads only after ads are allowed, grants one continue reward, and does not request personalized ads by default.
- [ ] P1 After one rewarded continue, try the rewarded-ad continue control again in the same run.
  Expected: The second attempt is disabled or rejected with a clear message.
- [ ] P0 On first launch and during play, watch for system prompts.
  Expected: No camera, microphone, contacts, location, push notification, or account permission prompt appears.

### Offline And Restart

- [ ] P1 Disable network and start a normal practice run.
  Expected: Local study content, timer, scoring, Settings, and BGM still work.
- [ ] P1 With network disabled, tap Support, Privacy, and rewarded ad entry points.
  Expected: External actions fail gracefully without blocking the local game loop.
- [ ] P0 After scoring points, advance the daily goal once, force close the app, and relaunch.
  Expected: Best score, daily streaks, daily goal progress, learned counts, selected level, language, and music settings remain stored locally.

### Store Review Readiness

- [ ] P0 Compare the tested flow with docs/app-store-review-guide.md.
  Expected: No demo account is needed, and the reviewer can reproduce the listed path from first launch.
- [ ] P1 Compare the production UI against the generated App Store screenshot scenes.
  Expected: The app still matches the 176 screenshot entries well enough for App Review.
- [ ] P0 Play Lines mode and inspect several anime-style prompts.
  Expected: The prompts are original learning lines and do not quote protected anime scripts or character names.

## Final Confirmation

Set `PRODUCTION_DEVICE_TESTED=1` only after: Every P0 item passes on the exact build intended for App Store review, with P1 exceptions documented in the result notes.
