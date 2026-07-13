const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const jsonPath = path.join(root, 'docs/external-readiness.json');
const markdownPath = path.join(root, 'docs/external-readiness.md');
const releaseStatus = readReleaseStatus();

const definitions = {
  'Public support URL': {
    id: 'public-support-url',
    system: 'Public HTTPS hosting + App Store Connect metadata',
    env: ['APP_STORE_BASE_URL', 'APP_STORE_SUPPORT_URL'],
    action: 'Host site/ over HTTPS and expose the support page. APP_STORE_BASE_URL can generate /support automatically, or APP_STORE_SUPPORT_URL can point to a custom production HTTPS URL.',
    evidence: 'The support URL opens without auth, redirects, localhost, .test, .local, or example domains, and docs/public-site-hosting-verification.md reports a live PASS.',
    verification: ['npm run site:localized', 'npm run site:manifest', 'npm run site:deploy-audit', 'npm run site:verify-hosting', 'npm run release:status'],
  },
  'Public privacy URL': {
    id: 'public-privacy-url',
    system: 'Public HTTPS hosting + App Store Connect metadata',
    env: ['APP_STORE_BASE_URL', 'APP_STORE_PRIVACY_URL'],
    action: 'Host site/ over HTTPS and expose the privacy policy page. APP_STORE_BASE_URL can generate /privacy automatically, or APP_STORE_PRIVACY_URL can point to a custom production HTTPS URL.',
    evidence: 'The privacy URL opens without auth, matches docs/app-store-privacy-answers.md plus the final AdMob state, and docs/public-site-hosting-verification.md reports a live PASS.',
    verification: ['npm run site:localized', 'npm run site:manifest', 'npm run site:deploy-audit', 'npm run site:verify-hosting', 'npm run release:status'],
  },
  'Public marketing URL': {
    id: 'public-marketing-url',
    system: 'Public HTTPS hosting + App Store Connect metadata',
    env: ['APP_STORE_BASE_URL', 'APP_STORE_MARKETING_URL'],
    action: 'Optional. Set APP_STORE_MARKETING_URL or APP_STORE_BASE_URL if the App Store listing should include a marketing URL.',
    evidence: 'A production HTTPS marketing URL is available, or this optional field is intentionally left blank.',
    verification: ['npm run release:status'],
  },
  'App Store review contact': {
    id: 'app-store-review-contact',
    system: 'App Store Connect',
    env: [
      'APP_STORE_REVIEW_FIRST_NAME',
      'APP_STORE_REVIEW_LAST_NAME',
      'APP_STORE_REVIEW_EMAIL',
      'APP_STORE_REVIEW_PHONE',
    ],
    action: 'Add the review contact that Apple can use during App Review. Use a monitored email address and a reachable phone number.',
    evidence: 'store.config.js resolves apple.review, metadata preview shows reviewContactReady=true, and release:status reports the contact OK.',
    verification: ['npm run metadata:preview', 'npm run release:status'],
  },
  'Live AdMob IDs': {
    id: 'live-admob-ids',
    system: 'Google AdMob + EAS Build env',
    env: [
      'EXPO_PUBLIC_ADMOB_IOS_APP_ID',
      'EXPO_PUBLIC_ADMOB_ANDROID_APP_ID',
      'EXPO_PUBLIC_ADMOB_REWARDED_IOS_UNIT_ID',
      'EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_UNIT_ID',
    ],
    action: 'Optional for a NO_LIVE_ADS launch. Before monetization, create production AdMob apps and rewarded ad units, then put all four real IDs into .env.local and the EAS production environment.',
    evidence: 'A no-ID build stays in NO_LIVE_ADS state. A monetized build uses four production-format IDs and app.config.js enables liveAdsEnabled.',
    verification: ['npm run release:status', 'npx expo config --json'],
  },
  APP_STORE_BUNDLE_ID_CONFIRMED: {
    id: 'bundle-id-confirmed',
    system: 'Apple Developer + App Store Connect',
    env: ['APP_STORE_BUNDLE_ID_CONFIRMED'],
    action: 'Confirm app.json ios.bundleIdentifier and android.package are the final store identifiers before the first production build.',
    evidence: 'The identifiers in app.json match Apple Developer, App Store Connect, Google Play/AdMob records, and EAS project settings.',
    verification: ['npm run release:status', 'npx expo config --json'],
  },
  APP_STORE_CONNECT_RECORD_READY: {
    id: 'app-store-connect-record-ready',
    system: 'App Store Connect',
    env: ['APP_STORE_CONNECT_RECORD_READY'],
    action: 'Create the App Store Connect app record for the final bundle ID and fill the app category, age rating, pricing, availability, and required compliance fields.',
    evidence: 'The App Store Connect record exists for com.john.kanasprint, and metadata can be pushed with EAS Metadata after release:store-ready passes.',
    verification: ['npm run release:status', 'npm run metadata:ios'],
  },
  EAS_REMOTE_VERSION_INITIALIZED: {
    id: 'eas-remote-version-initialized',
    system: 'Expo EAS',
    env: ['EAS_REMOTE_VERSION_INITIALIZED'],
    action: 'Log in to Expo and run npx eas-cli build:version:set once for the production iOS app because eas.json uses remote app version management.',
    evidence: 'EAS remote version state exists for the production profile and app.json buildNumber no longer needs local manual increments.',
    verification: ['npx eas-cli build:version:set', 'npm run release:status'],
  },
  APP_STORE_PRIVACY_ANSWERS_REVIEWED: {
    id: 'privacy-answers-reviewed',
    system: 'App Store Connect privacy questionnaire',
    env: ['APP_STORE_PRIVACY_ANSWERS_REVIEWED'],
    action: 'Fill App Store Connect privacy answers from docs/app-store-privacy-answers.md after deciding whether live AdMob IDs are enabled for the submitted build.',
    evidence: 'The App Store privacy questionnaire matches the final build, optional rewarded ads, local-only progress storage, and iOS privacy manifest.',
    verification: ['npm run release-check', 'npm run release:status'],
  },
  ADMOB_PRIVACY_MESSAGES_CONFIGURED: {
    id: 'admob-privacy-messages-configured',
    system: 'Google AdMob Privacy & messaging',
    env: ['ADMOB_PRIVACY_MESSAGES_CONFIGURED'],
    action: 'Required only for a LIVE_ADMOB build. Configure AdMob Privacy & messaging for release regions and verify UMP canRequestAds before requesting rewarded ads.',
    evidence: 'NO_LIVE_ADS builds do not request ads. A monetized production/TestFlight build confirms privacy options and rewarded ads behave correctly with the real AdMob account.',
    verification: ['npm run release:status', 'physical iPhone or TestFlight ad-flow test'],
  },
  PRODUCTION_DEVICE_TESTED: {
    id: 'production-device-tested',
    system: 'Physical iPhone or TestFlight',
    env: ['PRODUCTION_DEVICE_TESTED'],
    action: 'Install the production archive or TestFlight build on a real iPhone and complete docs/production-device-smoke-test.md for first launch, language selection, N5-N1 game loop, settings, support/privacy/open-source links, BGM, and rewarded-ad continue path.',
    evidence: 'The exact production build that will be submitted has passed the manual smoke path on device.',
    verification: ['npm run release:store-ready', 'npm run build:ios', 'docs/production-device-smoke-test.md'],
  },
};

const externalRows = releaseStatus.rows.filter((row) => row.category === 'external');
const items = externalRows.map((row) => {
  const definition = definitions[row.label];

  if (!definition) {
    throw new Error(`Missing external readiness definition for release-status row: ${row.label}`);
  }

  return {
    ...definition,
    status: row.status,
    label: row.label,
    detail: row.detail,
    blocking: row.status === 'TODO' || row.status === 'BAD',
  };
});
const checklist = {
  schemaVersion: 1,
  source: 'scripts/generate-external-readiness.js',
  generatedFrom: {
    releaseStatus: 'scripts/release-status.js --json',
    envTemplate: '.env.example',
  },
  summary: {
    total: items.length,
    ok: items.filter((item) => item.status === 'OK').length,
    todo: items.filter((item) => item.status === 'TODO').length,
    bad: items.filter((item) => item.status === 'BAD').length,
    info: items.filter((item) => item.status === 'INFO').length,
    blocking: items.filter((item) => item.blocking).length,
  },
  finalCommands: [
    'npm run release:verify',
    'npm run release:store-ready',
    'npm run metadata:ios',
    'npm run build:ios',
    'npm run submit:ios',
  ],
  items,
};

fs.writeFileSync(jsonPath, `${JSON.stringify(checklist, null, 2)}\n`);
fs.writeFileSync(markdownPath, renderMarkdown(checklist));
console.log(`generated ${path.relative(root, markdownPath)} and ${path.relative(root, jsonPath)}`);

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
  const rows = values.items
    .map((item) => {
      const env = item.env.map((key) => `\`${key}\``).join(', ');
      const verify = item.verification.map((command) => `\`${command}\``).join(', ');

      return `### ${item.label}

- Status: ${item.status}
- System: ${item.system}
- Env: ${env}
- Current detail: ${item.detail}
- Action: ${item.action}
- Evidence: ${item.evidence}
- Verify with: ${verify}`;
    })
    .join('\n\n');
  const commands = values.finalCommands.map((command, index) => `${index + 1}. ${command}`).join('\n');

  return `# External Readiness Checklist

This checklist maps the external \`release:status\` rows to the exact account or store actions needed before App Store submission.

## Summary

- OK: ${values.summary.ok}
- TODO: ${values.summary.todo}
- BAD: ${values.summary.bad}
- INFO: ${values.summary.info}
- Blocking external items: ${values.summary.blocking}

## Items

${rows}

## Final Command Order

${commands}
`;
}
