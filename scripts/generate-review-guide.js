const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const markdownPath = path.join(root, 'docs/app-store-review-guide.md');
const jsonPath = path.join(root, 'docs/app-store-review-guide.json');
const appJson = require('../app.json').expo;
const storeConfig = require('../store.config.js');
const metadataPreview = require('../docs/app-store-metadata-preview.json');
const screenshotManifest = require('../docs/app-store-screenshot-manifest.json');
const publicSiteManifest = require('../docs/public-site-manifest.json');
const contentRightsAudit = require('../docs/content-rights-audit.json');
const privacyManifestAudit = require('../docs/privacy-manifest-audit.json');
const runtimeUiFlowAudit = require('../docs/runtime-ui-flow-audit.json');

const guide = {
  schemaVersion: 1,
  app: {
    name: appJson.name,
    version: appJson.version,
    bundleIdentifier: appJson.ios?.bundleIdentifier,
    supportsTablet: Boolean(appJson.ios?.supportsTablet),
    locales: Object.keys(appJson.locales ?? {}),
  },
  review: {
    demoAccountRequired: false,
    signInRequired: false,
    reviewContactReady: Boolean(storeConfig.apple?.review),
    reviewNotes:
      storeConfig.apple?.review?.notes ??
      'Kana Sprint does not require sign-in. Reviewers can start a practice run directly, switch N5-N1 difficulty, open Settings for language and music, and use the rewarded-ad continue entry point when production AdMob IDs are configured.',
  },
  walkthrough: [
    'Launch the app. The first screen is the playable practice screen, not a marketing page.',
    'Tap Start Practice to begin a 60-second round.',
    'Answer four-choice kana, vocabulary, and original anime-style line prompts.',
    'Use the N5-N1 difficulty selector before starting a run to verify level separation.',
    'Open Settings to change UI language, music, local progress reset, support/privacy/open-source links, and ad privacy options when UMP requires them.',
    'When a run ends, use the rewarded-ad continue entry point if live AdMob IDs are configured for the production build.',
  ],
  privacy: {
    account: 'No account, login, cloud sync, analytics, location, contacts, camera, microphone, push notifications, or user-generated content.',
    localData: 'Progress, high scores, daily streaks, daily goal progress, learned counts, selected difficulty, language, and music settings stay on device, and progress can be reset from Settings.',
    ads: 'Rewarded ads are optional and only used for continuing a run. Ad requests are configured as non-personalized by default.',
    privacyEntry: 'Settings exposes Support, Privacy, Open source notices, and Ad privacy when Google UMP says privacy options are required.',
  },
  privacyManifest: {
    auditPath: 'docs/privacy-manifest-audit.md',
    risk: privacyManifestAudit.summary?.risk,
    tracking: privacyManifestAudit.summary?.tracking,
    collectedDataTypes: privacyManifestAudit.summary?.collectedDataTypes,
    requiredReasonApisReady: privacyManifestAudit.summary?.requiredReasonApisReady,
    accessedApiTypes: privacyManifestAudit.summary?.accessedApiTypes,
    microphoneDisabled: privacyManifestAudit.summary?.microphoneDisabled,
  },
  contentRights: {
    auditPath: 'docs/content-rights-audit.md',
    statement: contentRightsAudit.posture?.statement,
    risk: contentRightsAudit.summary?.risk,
    protectedIpTermHits: contentRightsAudit.summary?.protectedIpTermHits,
    originalAnimeStyleLinePrompts: contentRightsAudit.summary?.originalAnimeStyleLinePrompts,
    metadataOriginalityLocales: contentRightsAudit.summary?.metadataOriginalityLocales,
  },
  evidence: {
    appStoreLocales: metadataPreview.locales?.length ?? 0,
    screenshotEntries:
      (screenshotManifest.defaultPack?.screenshots ?? []).length +
      (screenshotManifest.localizedPacks ?? []).reduce((sum, pack) => sum + (pack.screenshots?.length ?? 0), 0),
    publicSitePages: publicSiteManifest.pageCount,
    runtimeUiFlowAudit: 'docs/runtime-ui-flow-audit.md',
    runtimeUiFlowReady: Boolean(runtimeUiFlowAudit.summary?.localReady),
    runtimeUiFlowChecks: runtimeUiFlowAudit.summary?.checks ?? 0,
    runtimeUiFlowPassedChecks: runtimeUiFlowAudit.summary?.passedChecks ?? 0,
    releaseCommands: ['npm run release:status', 'npm run release:verify', 'npm run release:store-ready'],
  },
};

fs.writeFileSync(jsonPath, `${JSON.stringify(guide, null, 2)}\n`);
fs.writeFileSync(markdownPath, renderMarkdown(guide));
console.log(`generated ${path.relative(root, markdownPath)} and ${path.relative(root, jsonPath)}`);

function renderMarkdown(values) {
  return `# App Store Review Guide

## App

- Name: ${values.app.name}
- Version: ${values.app.version}
- Bundle ID: ${values.app.bundleIdentifier}
- Tablet support: ${values.app.supportsTablet ? 'Yes' : 'No'}
- UI localizations: ${values.app.locales.join(', ')}

## Reviewer Notes

${values.review.reviewNotes}

- Demo account required: ${values.review.demoAccountRequired ? 'Yes' : 'No'}
- Sign-in required: ${values.review.signInRequired ? 'Yes' : 'No'}
- Review contact ready in EAS Metadata: ${values.review.reviewContactReady ? 'Yes' : 'No'}

## Walkthrough

${values.walkthrough.map((step, index) => `${index + 1}. ${step}`).join('\n')}

## Privacy And Data Use

- ${values.privacy.account}
- ${values.privacy.localData}
- ${values.privacy.ads}
- ${values.privacy.privacyEntry}

## Privacy Manifest

- Privacy manifest audit: ${values.privacyManifest.auditPath}
- Audit risk: ${values.privacyManifest.risk}
- iOS tracking: ${values.privacyManifest.tracking ? 'Yes' : 'No'}
- Collected data types: ${values.privacyManifest.collectedDataTypes}
- Required reason APIs ready: ${values.privacyManifest.requiredReasonApisReady ? 'Yes' : 'No'}
- Required reason API categories: ${values.privacyManifest.accessedApiTypes}
- Microphone disabled: ${values.privacyManifest.microphoneDisabled ? 'Yes' : 'No'}

## Content Rights

- ${values.contentRights.statement}
- Content rights audit: ${values.contentRights.auditPath}
- Audit risk: ${values.contentRights.risk}
- Protected IP term hits: ${values.contentRights.protectedIpTermHits}
- Original anime-style line prompts: ${values.contentRights.originalAnimeStyleLinePrompts}
- App Store locales with originality claim: ${values.contentRights.metadataOriginalityLocales}

## Local Verification Evidence

- App Store locales in metadata preview: ${values.evidence.appStoreLocales}
- App Store screenshot entries: ${values.evidence.screenshotEntries}
- Public support/privacy/license pages: ${values.evidence.publicSitePages}
- Runtime UI flow audit: ${values.evidence.runtimeUiFlowAudit}
- Runtime UI flow ready: ${values.evidence.runtimeUiFlowReady ? 'Yes' : 'No'} (${values.evidence.runtimeUiFlowPassedChecks}/${values.evidence.runtimeUiFlowChecks} checks)
- Final commands: ${values.evidence.releaseCommands.join(' -> ')}
`;
}
