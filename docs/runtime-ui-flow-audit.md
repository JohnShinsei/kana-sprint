# Runtime UI Flow Audit

Kana Sprint starts on the playable game surface and keeps N5-N1 mastery progress, daily run goals, run missions, weak-item review, local data reset, language, music, support/privacy, rewarded-ad, daily challenge, and exit controls reachable from runtime UI.

## Summary

- Risk: PASS
- Local runtime UI ready: Yes
- UI locales: 10
- Japanese UI locale present: No
- JLPT levels: 5
- Game modes: 5
- Runtime phases: 3
- BGM tracks: 3
- Checks passed: 22/22
- Required flow failures: 0

## Runtime Surface

- First screen: ready
- Phases: ready, playing, finished
- Modes: mix, kana, vocab, lines, grammar
- Levels: N5, N4, N3, N2, N1
- Locales: zh-Hans, zh-Hant, en, fr, it, de, es-ES, ko, pl, pt-BR
- BGM tracks: rush, focus, night
- No account required: Yes
- Daily run goal available: Yes
- Run missions available: Yes
- Weak-item review available: Yes
- Language switching owned by Settings: Yes
- Local progress reset in Settings: Yes

## Checks

| Check | Passed | Evidence |
| --- | --- | --- |
| first-playable-screen | Yes | First screen is a playable ready state with practice and daily challenge entry points |
| difficulty-selector | Yes | N5-N1 difficulty selector is sourced from the study-bank level list and shows real counts for JLPT study modes |
| kana-foundation-mode | Yes | Kana practice is a standalone foundation mode and never presents itself as N1-N4 study |
| level-mastery-map | Yes | Ready screen shows local mastery progress for every JLPT level |
| weak-review-retention | Yes | Ready screen exposes a local weak-item review loop from recent mistakes |
| next-step-guidance | Yes | Ready screen recommends the next local learning action from weak items and JLPT mastery |
| achievement-milestones | Yes | Ready screen shows local achievement milestones from runs, streaks, mastery, and N1 progress |
| session-mission-retention | Yes | Each run has a visible local mission target, live progress text, and finish-state result |
| daily-goal-retention | Yes | Ready screen shows a persisted daily run goal that advances after every finished run |
| mode-selector | Yes | Five game modes are exposed before a run: mix, kana, words, lines, and grammar |
| playing-loop | Yes | Playing state contains timer, score, combo/lives, prompt, four options, feedback, and answer handling |
| answer-study-hint | Yes | Answered questions reveal a compact study hint with the correct answer, reading, and meaning |
| exit-run | Yes | A visible in-game exit button returns from an active run to the ready screen |
| finish-loop | Yes | Finished state lets the player play again or switch mode without restarting the app |
| finish-learning-recap | Yes | Finished state summarizes new mastery and mistakes, then links back into weak review |
| settings-language | Yes | Language switching lives inside Settings, follows the system by default, and excludes Japanese as a UI locale |
| settings-local-data-reset | Yes | Settings exposes a two-tap local progress reset without accounts or server sync |
| settings-compliance-links | Yes | Settings exposes support, privacy, open-source notices, and ad privacy options when available |
| settings-audio | Yes | Settings exposes BGM enablement and track selection without adding recording permissions |
| rewarded-ad-entry | Yes | Rewarded-ad continue entry is wired from gameplay UI to native/web ad boundaries |
| daily-streak-retention | Yes | Daily challenge and streak state are retained locally across sessions |
| release-runtime-boundary | Yes | Runtime flow stays no-account/local-first while still exposing review-ready links and ad entry points |

## Flow Failures

- None.

## Commands

- `npm run runtime:ui-flow`
- `npm run gameplay-check`
- `npm run release:verify`

If this audit fails, fix the runtime App.tsx flow before regenerating screenshots or submitting for review.
