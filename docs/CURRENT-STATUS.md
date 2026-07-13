# Kana Sprint - Current Status

Updated: 2026-07-12

## One-line status

The core Japanese-learning game is working, the rewarded-ad continue flow is complete, and the full local release verification is green.

## Product that already exists

- Expo 56 app for iOS, Android, and Web.
- Ten UI languages selected from the system language, with manual switching in Settings: Simplified Chinese, Traditional Chinese, English, French, Italian, German, Spanish (Spain), Korean, Polish, and Portuguese (Brazil).
- Japanese is intentionally not offered as a UI language.
- JLPT N5-N1 difficulty levels.
- Kana, vocabulary, original anime-style dialogue, grammar, and mixed modes.
- Study bank: 92 kana, 513 vocabulary entries, 148 original dialogue prompts, and 100 grammar prompts (853 total items).
- Grammar mode covers N5-N1 with 20 prompts per level, sentence gaps, particles, and grammar-pattern distinctions; mixed mode and weak review also include grammar.
- Chinese UI questions avoid giving away answers through familiar kanji: vocabulary and dialogue challenges use kana, receive an 8-point listening boost, and receive a 16-point meaning-to-kana recall boost.
- Vocabulary and dialogue rounds now include listening-to-meaning questions; their frequency rises from N5 to N1, written Japanese stays hidden until answer reveal, and unsupported speech environments fall back to kana.
- Answer reveal shows Japanese, kana/romaji, and localized meaning; wrong answers stay visible longer.
- Japanese pronunciation uses the system `ja-JP` voice through `expo-speech`.
- Three bundled BGM tracks, sound controls, settings screen, and an in-game exit action.
- Local progress and settings storage; no account or sign-in required.
- Selected game mode, difficulty, language, and audio settings persist across app restarts; legacy settings migrate to Mix mode safely.
- Practice and daily runs stay locked until saved progress has loaded, preventing an early-tap race from overwriting local progress.
- Rewarded-ad integration points and development reward behavior are present.
- Rewarded continue appears only after lives or time run out, restores one life and 15 seconds, and can be used once per run.
- App Store localization, screenshots, privacy/support pages, and release audit artifacts have been generated.
- EAS project `@johnshinsei/kana-sprint` is created and linked as project ID `ebb5cac4-3842-4be9-853e-8429fa421ef2`.
- EAS remote iOS version state is initialized with build number `1` for `com.john.kanasprint`.
- The public support and privacy site is deployed at `https://johnshinsei.github.io/kana-sprint-site/` from a site-only GitHub repository.

## Verified before shutdown

- `npm run typecheck`: PASS on 2026-07-12.
- `npm run gameplay-check`: PASS for 10 locales, 5 JLPT levels, 5 modes, 21 valid mode/level combinations, and 3,780 generated questions. Kana is a standalone foundation mode rather than an N1-N4 difficulty.
- Mobile browser test at 390x844: PASS for N5/N1 grammar, answer explanation, old-feedback clearing, rewarded continue, and zero horizontal overflow.
- Mobile browser listening test at 390x844: PASS for hidden Japanese prompt, automatic listening flow, written-answer reveal, zero horizontal overflow, and zero console errors or warnings.
- Browser runtime test: PASS for three-loss rescue, rewarded continue, second-run end action, and final results screen.
- Browser console: no runtime errors or warnings; only normal React development messages.
- `npm run release:verify`: PASS on 2026-07-12, including Expo Doctor 21/21 and production Web export.
- `npm run release:status`: `OK 32 | TODO 10 | BAD 0 | INFO 1`.
- Expo package baseline: Expo 56.0.15, React 19.2.3, React Native 0.85.3.
- Expo account `johnshinsei` is authenticated and `npx eas-cli project:info` resolves the linked Kana Sprint project.
- `npx eas-cli build:version:get --platform ios --profile production --json --non-interactive` returns build number `1`.
- No process is listening on local port 8081; the Expo dev server is stopped.

## Rewarded continue flow

Completed and verified:

- Normal gameplay no longer shows a permanent ad button.
- The timer pauses while the rescue choice is visible.
- The rescue panel provides localized `Continue` and `End run` actions in all ten UI languages.
- A rewarded continue restores at least one life and 15 seconds, capped by the normal game limits.
- The reward is limited to one use per run.
- Leaving a run stops any active Japanese pronunciation.
- Gameplay contract checks cover the rescue state, reward limits, action placement, and localization.

## External items required for App Store submission

These cannot be completed from local code alone:

- Add App Store review contact name, email, and phone.
- Create/confirm the real bundle ID and App Store Connect record.
- Add production AdMob app and rewarded-unit IDs.
- Configure AdMob privacy messaging and confirm the final privacy answers.
- Test the production build on a real device.

After those items are complete, run in this order:

```powershell
npm run release:verify
npm run release:store-ready
npm run metadata:ios
npm run build:ios
npm run submit:ios
```

## Repository warning

The repository currently has no tracked project files: `git status --short` reports the project as untracked. Do not delete or reset the working tree. The code is ready for a deliberate first commit once repository ownership and publication are confirmed.

## Resume command

```powershell
cd C:\Users\John\Documents\Game1
npm run typecheck
```

Then use `docs/external-todo-tracker.md` for the remaining App Store account, URL, AdMob, and physical-device work.
