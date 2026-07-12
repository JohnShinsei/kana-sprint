const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const jsonPath = path.join(root, 'docs/production-device-smoke-test.json');
const markdownPath = path.join(root, 'docs/production-device-smoke-test.md');

const appJson = require('../app.json').expo;
const packageJson = require('../package.json');
const metadataPreview = require('../docs/app-store-metadata-preview.json');
const screenshotManifest = require('../docs/app-store-screenshot-manifest.json');
const runtimeAssetManifest = require('../docs/runtime-asset-manifest.json');
const publicSiteManifest = require('../docs/public-site-manifest.json');
const reviewGuide = require('../docs/app-store-review-guide.json');
const releaseStatus = readReleaseStatus();
const productionDeviceRow = (releaseStatus.rows ?? []).find((row) => row.label === 'PRODUCTION_DEVICE_TESTED');
const locales = Object.keys(appJson.locales ?? {});
const screenshotEntries =
  (screenshotManifest.defaultPack?.screenshots ?? []).length +
  (screenshotManifest.localizedPacks ?? []).reduce((sum, pack) => sum + (pack.screenshots?.length ?? 0), 0);

const checklist = {
  schemaVersion: 1,
  source: 'scripts/generate-production-device-smoke-test.js',
  generatedFrom: {
    appConfig: 'app.json',
    packageJson: 'package.json',
    reviewGuide: 'docs/app-store-review-guide.json',
    metadataPreview: 'docs/app-store-metadata-preview.json',
    screenshotManifest: 'docs/app-store-screenshot-manifest.json',
    runtimeAssetManifest: 'docs/runtime-asset-manifest.json',
    publicSiteManifest: 'docs/public-site-manifest.json',
    releaseStatus: 'scripts/release-status.js --json',
  },
  app: {
    name: appJson.name,
    version: appJson.version,
    bundleIdentifier: appJson.ios?.bundleIdentifier,
    buildNumber: appJson.ios?.buildNumber,
    packageName: appJson.android?.package,
    expo: packageJson.dependencies?.expo,
    reactNative: packageJson.dependencies?.['react-native'],
    supportsTablet: Boolean(appJson.ios?.supportsTablet),
  },
  evidence: {
    uiLocales: locales,
    appStoreLocales: metadataPreview.locales?.map((entry) => entry.appStoreLocale) ?? [],
    japaneseUiLocaleRemoved: !locales.includes('ja'),
    screenshotEntries,
    publicSitePages: publicSiteManifest.pageCount,
    runtimePngAssets: runtimeAssetManifest.summary?.pngCount ?? 0,
    bgmTracks: runtimeAssetManifest.summary?.audioCount ?? 0,
    demoAccountRequired: reviewGuide.review?.demoAccountRequired,
    signInRequired: reviewGuide.review?.signInRequired,
    productionDeviceStatus: productionDeviceRow?.status ?? 'UNKNOWN',
    productionDeviceDetail: productionDeviceRow?.detail ?? 'release-status did not report PRODUCTION_DEVICE_TESTED.',
  },
  resultTemplate: {
    tester: '',
    date: '',
    deviceModel: '',
    iosVersion: '',
    buildSource: 'TestFlight or production archive',
    buildNumber: appJson.ios?.buildNumber,
    appVersion: appJson.version,
    notes: '',
  },
  prerequisites: [
    'Run npm run release:verify on the same workspace state that will be built.',
    'Clear npm run release:store-ready by filling the real public URLs, review contact, AdMob IDs, and external confirmation flags.',
    'Build the production archive with npm run build:ios and install the exact build through TestFlight or an equivalent physical-device flow.',
    'Use a real iPhone. Keep network available for support/privacy/open-source/ad checks, then repeat the offline fallback checks with network disabled.',
  ],
  sections: [
    section('install-launch', 'Install And First Launch', [
      item('install-production-build', 'P0', 'Install the production/TestFlight build and confirm the app name, icon, splash, version, and bundle identifier match the release packet.', 'The app launches without crash or missing assets, and no development client UI appears.'),
      item('no-login-first-screen', 'P0', 'Open the app from a fresh install and confirm the first screen is playable without login, account creation, tracking prompts, or onboarding gates.', 'Start Practice and Daily Challenge are reachable immediately after local storage finishes loading.'),
      item('background-resume', 'P1', 'Send the app to the background during the ready screen, return to foreground, and confirm the UI remains stable.', 'No timer starts by itself, no sound unexpectedly plays, and controls stay responsive.'),
    ]),
    section('localization', 'Localization', [
      item('system-language', 'P0', `Set the device to one supported language and confirm the UI follows system language by default. Supported UI locales: ${locales.join(', ')}.`, 'The top-level game screen, settings labels, buttons, and review-facing links use the expected language.'),
      item('settings-language-switch', 'P0', 'Open Settings and manually switch at least Simplified Chinese, English, Korean, and one European locale.', 'The app updates text without restart, the language switch stays inside Settings, and Japanese is not offered as a UI language.'),
      item('text-fit', 'P1', 'Inspect ready, playing, finished, and settings screens in the longest tested localization.', 'Buttons, level labels, score text, and settings choices fit without overlap or clipped critical text.'),
    ]),
    section('gameplay', 'Gameplay Loop', [
      item('n5-standard-run', 'P0', 'Start an N5 practice run and answer several kana, vocabulary, line, and grammar prompts.', 'Timer, score, combo, hearts, feedback, and four-choice answers update correctly.'),
      item('answer-study-hint', 'P0', 'Answer one question correctly and one question incorrectly.', 'The answer reveal stays visible long enough to read the correct answer, kana/romaji reading, and localized meaning without blocking the next question.'),
      item('run-mission', 'P0', 'Before a run, note the visible run mission, then play until the finish screen.', 'The mission target appears before play, live mission progress appears during play, and the finish screen clearly shows mission completion or retry state.'),
      item('next-step-guidance', 'P1', 'After creating at least one weak item or clearing a level, return to the ready screen and tap the Next step recommendation.', 'The recommendation prioritizes weak review, otherwise current-level practice, next-level advancement, or Daily when all levels are cleared.'),
      item('achievement-milestones', 'P1', 'Return to the ready screen after a few runs and inspect the milestone badges.', 'First run, 3-day streak, 20 mastered, and N1 spark badges reflect local progress and never require an account or network sync.'),
      item('all-levels', 'P0', 'Before starting runs, select N5, N4, N3, N2, and N1 once each and confirm the active question label matches the selected level.', 'N5 includes kana foundations; N4-N1 stay in their level banks and progressively feel harder.'),
      item('all-modes', 'P1', 'Switch Mix, Kana, Vocabulary, Lines, and Grammar modes where available, then start a short run in each.', 'Questions match the selected mode and the app never presents empty options.'),
      item('wrong-answer-life', 'P0', 'Tap at least one wrong answer during a run.', 'Feedback shows the correction, combo resets, hearts decrease, and the run ends cleanly when hearts are exhausted.'),
      item('exit-run', 'P0', 'While playing, tap the in-game exit control.', 'The app returns to the ready screen without losing stored best score or freezing the timer.'),
      item('daily-challenge', 'P1', 'Start Daily Challenge twice for the same level on the same day.', 'The daily path is repeatable, daily best is saved, and regular practice remains separate.'),
      item('finished-screen', 'P0', 'Let a run finish normally.', 'Final score, best score, daily best, Play Again, and Switch Mode flows are coherent.'),
      item('finish-learning-recap', 'P1', 'Finish a run with at least one correct answer and one missed answer.', 'The finish screen shows new mastered count, misses, weak-review count, and a direct review action when misses are available.'),
    ]),
    section('settings-assets', 'Settings, Music, And Links', [
      item('settings-open-close', 'P0', 'Open and close Settings from ready and playing states.', 'Settings opens as a modal panel, closes cleanly, and does not corrupt the current run.'),
      item('bgm-toggle', 'P1', 'Enable music, switch Rush, Focus, and Night, then disable music.', 'Music starts only after opt-in, track changes work, volume behavior is comfortable, and music stops when disabled.'),
      item('settings-persistence', 'P0', 'Change level, language, music enabled state, and BGM track, then force close and reopen the app.', 'Settings and progress restore from local storage.'),
      item('support-link', 'P0', 'Tap Support from Settings with production URLs configured.', 'The localized HTTPS support page opens and matches the app language when localized URLs are available.'),
      item('privacy-link', 'P0', 'Tap Privacy from Settings with production URLs configured.', 'The localized HTTPS privacy page opens and matches the final App Store privacy answers.'),
      item('ad-privacy-link', 'P1', 'Tap Ad privacy options when the UMP privacy options entry is required, or confirm the unavailable state when it is not required.', 'The app either opens the Google privacy options form or explains that ad privacy options are unavailable.'),
    ]),
    section('ads-privacy', 'Rewarded Ads And Privacy', [
      item('ad-disabled-build', 'P0', 'If production AdMob IDs are not configured, tap Continue with ad during a run.', 'The app shows an unavailable message and never crashes.'),
      item('ad-enabled-build', 'P0', 'If production AdMob IDs are configured, complete UMP consent/privacy flow if shown, then tap Continue with ad during a run.', 'A rewarded ad loads only after ads are allowed, grants one continue reward, and does not request personalized ads by default.'),
      item('single-reward-limit', 'P1', 'After one rewarded continue, try the rewarded-ad continue control again in the same run.', 'The second attempt is disabled or rejected with a clear message.'),
      item('no-sensitive-permissions', 'P0', 'On first launch and during play, watch for system prompts.', 'No camera, microphone, contacts, location, push notification, or account permission prompt appears.'),
    ]),
    section('offline-restart', 'Offline And Restart', [
      item('offline-practice', 'P1', 'Disable network and start a normal practice run.', 'Local study content, timer, scoring, Settings, and BGM still work.'),
      item('offline-links-ads', 'P1', 'With network disabled, tap Support, Privacy, and rewarded ad entry points.', 'External actions fail gracefully without blocking the local game loop.'),
      item('cold-restart-progress', 'P0', 'After scoring points, advance the daily goal once, force close the app, and relaunch.', 'Best score, daily streaks, daily goal progress, learned counts, selected level, language, and music settings remain stored locally.'),
    ]),
    section('store-review', 'Store Review Readiness', [
      item('review-notes-match', 'P0', 'Compare the tested flow with docs/app-store-review-guide.md.', 'No demo account is needed, and the reviewer can reproduce the listed path from first launch.'),
      item('screenshots-match', 'P1', 'Compare the production UI against the generated App Store screenshot scenes.', `The app still matches the ${screenshotEntries} screenshot entries well enough for App Review.`),
      item('content-rights', 'P0', 'Play Lines mode and inspect several anime-style prompts.', 'The prompts are original learning lines and do not quote protected anime scripts or character names.'),
    ]),
  ],
  finalConfirmation: {
    env: 'PRODUCTION_DEVICE_TESTED',
    setTo: '1',
    onlyAfter: 'Every P0 item passes on the exact build intended for App Store review, with P1 exceptions documented in the result notes.',
  },
};

fs.writeFileSync(jsonPath, `${JSON.stringify(checklist, null, 2)}\n`);
fs.writeFileSync(markdownPath, renderMarkdown(checklist));
console.log(`generated ${path.relative(root, markdownPath)} and ${path.relative(root, jsonPath)}`);

function section(id, title, items) {
  return { id, title, items };
}

function item(id, priority, action, expected) {
  return { id, priority, action, expected };
}

function readReleaseStatus() {
  const result = spawnSync('node', ['scripts/release-status.js', '--json'], {
    cwd: root,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`release-status --json exited with status ${result.status}`);
  }

  return JSON.parse(result.stdout.replace(/^\uFEFF/, '').trim());
}

function renderMarkdown(values) {
  const prerequisites = values.prerequisites.map((entry) => `- [ ] ${entry}`).join('\n');
  const sections = values.sections.map(renderSection).join('\n\n');

  return `# Production Device Smoke Test

Use this checklist on the exact production archive or TestFlight build intended for App Store review. It does not replace \`release:store-ready\`; it is the manual evidence required before setting \`${values.finalConfirmation.env}=1\`.

## App

- Name: ${values.app.name}
- Version: ${values.app.version}
- iOS bundle ID: ${values.app.bundleIdentifier}
- iOS build number: ${values.app.buildNumber}
- Expo: ${values.app.expo}
- React Native: ${values.app.reactNative}
- UI locales: ${values.evidence.uiLocales.join(', ')}
- App Store locales: ${values.evidence.appStoreLocales.join(', ')}
- Screenshots: ${values.evidence.screenshotEntries}
- Public site pages: ${values.evidence.publicSitePages}
- BGM tracks: ${values.evidence.bgmTracks}
- Current device-test status: ${values.evidence.productionDeviceStatus} - ${values.evidence.productionDeviceDetail}

## Result Capture

- Tester:
- Date:
- Device model:
- iOS version:
- Build source: ${values.resultTemplate.buildSource}
- Build number: ${values.resultTemplate.buildNumber}
- App version: ${values.resultTemplate.appVersion}
- Notes:

## Prerequisites

${prerequisites}

## Checklist

${sections}

## Final Confirmation

Set \`${values.finalConfirmation.env}=${values.finalConfirmation.setTo}\` only after: ${values.finalConfirmation.onlyAfter}
`;
}

function renderSection(sectionValue) {
  const rows = sectionValue.items
    .map((entry) => `- [ ] ${entry.priority} ${entry.action}\n  Expected: ${entry.expected}`)
    .join('\n');

  return `### ${sectionValue.title}

${rows}`;
}
