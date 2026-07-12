const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const jsonPath = path.join(root, 'docs/app-store-age-rating-audit.json');
const markdownPath = path.join(root, 'docs/app-store-age-rating-audit.md');

const appJson = require('../app.json').expo;
const packageJson = require('../package.json');
const storeConfig = require('../store.config.js');
const appSource = readText('App.tsx');
const appStoreNotes = readText('docs/app-store-notes.md');

const advisory = storeConfig.apple?.advisory ?? {};
const frequencyQuestions = [
  ['alcoholTobaccoOrDrugUseOrReferences', 'Alcohol, tobacco, drug use, or references', 'No alcohol, tobacco, or drug references are used in the study bank or gameplay.'],
  ['contests', 'Contests', 'No contest, sweepstakes, or prize competition mechanics exist.'],
  ['gamblingSimulated', 'Simulated gambling', 'Gameplay is answer matching only, with no gambling simulation.'],
  ['horrorOrFearThemes', 'Horror or fear themes', 'Original anime-style study lines are motivational language-learning prompts, not horror content.'],
  ['matureOrSuggestiveThemes', 'Mature or suggestive themes', 'The app contains no mature, dating, or suggestive material.'],
  ['medicalOrTreatmentInformation', 'Medical or treatment information', 'The app is a language-learning game and does not provide medical information.'],
  ['profanityOrCrudeHumor', 'Profanity or crude humor', 'Study content avoids profanity and crude humor.'],
  ['sexualContentGraphicAndNudity', 'Graphic sexual content and nudity', 'No graphic sexual content or nudity exists.'],
  ['sexualContentOrNudity', 'Sexual content or nudity', 'No sexual content or nudity exists.'],
  ['violenceCartoonOrFantasy', 'Cartoon or fantasy violence', 'The app has hearts/lives for scoring, but no depicted violence.'],
  ['violenceRealistic', 'Realistic violence', 'No realistic violence exists.'],
  ['violenceRealisticProlongedGraphicOrSadistic', 'Prolonged graphic or sadistic realistic violence', 'No graphic or sadistic violence exists.'],
];
const capabilityQuestions = [
  ['gambling', 'Gambling', false, 'No real-money gambling or gambling services exist.'],
  ['unrestrictedWebAccess', 'Unrestricted web access', false, 'The app opens fixed Support, Privacy, and Open source URLs only; it has no browser or arbitrary URL input.'],
  ['kidsAgeBand', 'Made for Kids age band', null, 'The app is not submitted in the Kids category.'],
  ['ageRatingOverride', 'Override to higher age rating', 'NONE', 'No higher rating override is selected locally; App Store Connect remains the final source.'],
  ['koreaAgeRatingOverride', 'Korea age rating override', 'NONE', 'No Korea-specific GRAC override is selected locally.'],
];

const frequencyAnswers = frequencyQuestions.map(([key, label, evidence]) => ({
  key,
  label,
  answer: advisory[key],
  expected: 'NONE',
  ready: advisory[key] === 'NONE',
  evidence,
}));
const capabilityAnswers = capabilityQuestions.map(([key, label, expected, evidence]) => ({
  key,
  label,
  answer: advisory[key] ?? null,
  expected,
  ready: valuesEqual(advisory[key] ?? null, expected),
  evidence,
}));
const sourceSignals = {
  hasTextInput: /\bTextInput\b/.test(appSource),
  hasWebViewDependency: Boolean(packageJson.dependencies?.['react-native-webview']),
  hasInAppPurchaseDependency: Object.keys(packageJson.dependencies ?? {}).some((name) => /iap|purchase|revenuecat|storekit/i.test(name)),
  hasAuthDependency: Object.keys(packageJson.dependencies ?? {}).some((name) => /auth|signin|login/i.test(name)),
  reviewNotesMentionNoLogin: /does not require login/i.test(appStoreNotes) || /does not require sign-in/i.test(appStoreNotes),
  notesMentionNoUserGeneratedContent: /user-generated content/i.test(appStoreNotes),
  notesMentionNoPurchases: /purchases/i.test(appStoreNotes),
  settingsUsesFixedExternalLinks:
    appSource.includes('Linking.openURL') &&
    appSource.includes('activeSupportUrl') &&
    appSource.includes('activePrivacyPolicyUrl') &&
    appSource.includes('activeOpenSourceNoticesUrl'),
};
const allFrequencyAnswersNone = frequencyAnswers.every((entry) => entry.ready);
const allCapabilitiesReady = capabilityAnswers.every((entry) => entry.ready);
const sourceReady =
  !sourceSignals.hasTextInput &&
  !sourceSignals.hasWebViewDependency &&
  !sourceSignals.hasInAppPurchaseDependency &&
  !sourceSignals.hasAuthDependency &&
  sourceSignals.reviewNotesMentionNoLogin &&
  sourceSignals.notesMentionNoUserGeneratedContent &&
  sourceSignals.notesMentionNoPurchases &&
  sourceSignals.settingsUsesFixedExternalLinks;
const audit = {
  schemaVersion: 1,
  source: 'scripts/generate-age-rating-audit.js',
  generatedFrom: {
    appConfig: 'app.json',
    storeConfig: 'store.config.js',
    appSource: 'App.tsx',
    appStoreNotes: 'docs/app-store-notes.md',
  },
  officialReferences: [
    {
      label: 'Apple Set An App Age Rating',
      url: 'https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating/',
    },
    {
      label: 'Apple Age Rating Values And Definitions',
      url: 'https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions/',
    },
  ],
  app: {
    name: appJson.name,
    version: appJson.version,
    bundleIdentifier: appJson.ios?.bundleIdentifier,
    primaryCategory: 'Games',
    secondaryCategory: 'Education',
  },
  posture: {
    statement: 'Kana Sprint is a language-learning matching game with no account, no user-generated content, no purchases, no chat, and no gambling.',
    limitation: 'The final global and region-specific ratings must be saved in App Store Connect after answering the live questionnaire.',
  },
  questionnaire: {
    expectedFrequencyAnswer: 'NONE',
    frequencyAnswers,
    capabilityAnswers,
    finalSource: 'App Store Connect age rating questionnaire',
    suggestedAppleGlobalRating: '4+ candidate',
    ageSuitabilityUrl: 'Optional public support or marketing URL after hosting site/.',
  },
  sourceSignals,
};
audit.summary = {
  risk: allFrequencyAnswersNone && allCapabilitiesReady && sourceReady ? 'PASS' : 'REVIEW',
  suggestedAppleGlobalRating: audit.questionnaire.suggestedAppleGlobalRating,
  finalRatingSource: audit.questionnaire.finalSource,
  frequencyQuestions: frequencyAnswers.length,
  frequencyNoneAnswers: frequencyAnswers.filter((entry) => entry.answer === 'NONE').length,
  capabilitiesReady: allCapabilitiesReady,
  sourceReady,
  allFrequencyAnswersNone,
  kidsCategory: advisory.kidsAgeBand !== null,
  unrestrictedWebAccess: advisory.unrestrictedWebAccess === true,
  gambling: advisory.gambling === true,
  overrides: [advisory.ageRatingOverride, advisory.koreaAgeRatingOverride].filter((value) => value && value !== 'NONE').length,
};

fs.writeFileSync(jsonPath, `${JSON.stringify(audit, null, 2)}\n`);
fs.writeFileSync(markdownPath, renderMarkdown(audit));

if (audit.summary.risk !== 'PASS') {
  console.error(`age rating audit requires review: ${audit.summary.risk}`);
  process.exit(1);
}

console.log(`generated ${path.relative(root, markdownPath)} and ${path.relative(root, jsonPath)}`);

function renderMarkdown(values) {
  const frequencyRows = values.questionnaire.frequencyAnswers
    .map((entry) => `| ${entry.label} | ${entry.answer} | ${entry.ready ? 'Ready' : 'Review'} | ${entry.evidence} |`)
    .join('\n');
  const capabilityRows = values.questionnaire.capabilityAnswers
    .map((entry) => `| ${entry.label} | ${formatAnswer(entry.answer)} | ${formatAnswer(entry.expected)} | ${entry.ready ? 'Ready' : 'Review'} | ${entry.evidence} |`)
    .join('\n');
  const sourceRows = Object.entries(values.sourceSignals)
    .map(([key, value]) => `| ${key} | ${value ? 'Yes' : 'No'} |`)
    .join('\n');
  const references = values.officialReferences
    .map((entry) => `- ${entry.label}: ${entry.url}`)
    .join('\n');

  return `# App Store Age Rating Audit

## Summary

- Risk: ${values.summary.risk}
- Suggested Apple global rating: ${values.summary.suggestedAppleGlobalRating}
- Final rating source: ${values.summary.finalRatingSource}
- Frequency answers set to NONE: ${values.summary.frequencyNoneAnswers}/${values.summary.frequencyQuestions}
- Capabilities ready: ${values.summary.capabilitiesReady ? 'Yes' : 'No'}
- Source posture ready: ${values.summary.sourceReady ? 'Yes' : 'No'}
- Kids category: ${values.summary.kidsCategory ? 'Yes' : 'No'}
- Unrestricted web access: ${values.summary.unrestrictedWebAccess ? 'Yes' : 'No'}
- Gambling: ${values.summary.gambling ? 'Yes' : 'No'}
- Rating overrides: ${values.summary.overrides}

## Questionnaire Frequency Answers

| App Store Connect field | Local answer | Status | Evidence |
| --- | --- | --- | --- |
${frequencyRows}

## In-App Controls And Capabilities

| App Store Connect field | Local answer | Expected | Status | Evidence |
| --- | --- | --- | --- | --- |
${capabilityRows}

## Source Signals

| Signal | Present |
| --- | --- |
${sourceRows}

## Official References

${references}

This audit is a static preparation aid, not the final rating. Submit and save the age rating questionnaire in App Store Connect, then confirm the displayed Apple global and region-specific ratings before review.
`;
}

function formatAnswer(value) {
  if (value === null) return 'null';
  return String(value);
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function valuesEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}
