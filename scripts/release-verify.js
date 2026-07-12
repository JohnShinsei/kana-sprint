const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const npmBin = 'npm';
const npxBin = 'npx';
const useShell = process.platform === 'win32';
const webExportDir = path.join(root, '.release-web-check');
const commonEnv = {
  ...process.env,
  EXPO_NO_TELEMETRY: '1',
};

try {
  run('TypeScript', npmBin, ['run', 'typecheck']);
  run('Gameplay contract', npmBin, ['run', 'gameplay-check']);
  run('Study bank depth audit', npmBin, ['run', 'study:depth']);
  run('Study content localization audit', npmBin, ['run', 'study:localization']);
  run('Expo Doctor', npmBin, ['run', 'doctor']);
  run('Runtime asset manifest', npmBin, ['run', 'assets:manifest']);
  run('Content rights audit', npmBin, ['run', 'content:rights']);
  run('Open source license audit', npmBin, ['run', 'legal:licenses']);
  run('Localized public site generation', npmBin, ['run', 'site:localized']);
  run('Public site manifest', npmBin, ['run', 'site:manifest']);
  run('Public site deploy audit', npmBin, ['run', 'site:deploy-audit']);
  run('Public site hosting verification', npmBin, ['run', 'site:verify-hosting']);
  run('Public site hosting handoff', npmBin, ['run', 'site:hosting-handoff']);
  run('iOS screenshot generation', npmBin, ['run', 'screenshots:ios']);
  run('App Store screenshot manifest', npmBin, ['run', 'screenshots:manifest']);
  run('App Store screenshot QA audit', npmBin, ['run', 'screenshots:qa']);
  run('App Store metadata preview', npmBin, ['run', 'metadata:preview']);
  run('Localization audit', npmBin, ['run', 'localization:audit']);
  run('App Store age rating audit', npmBin, ['run', 'age:rating']);
  run('Privacy manifest audit', npmBin, ['run', 'privacy:manifest']);
  run('App Store privacy answers', npmBin, ['run', 'privacy:answers']);
  run('AdMob release audit', npmBin, ['run', 'ads:audit']);
  run('App Store copy audit', npmBin, ['run', 'metadata:copy-audit']);
  run('App Store metadata upload packet', npmBin, ['run', 'metadata:upload-packet']);
  run('Data flow privacy audit', npmBin, ['run', 'privacy:data-flow']);
  run('Privacy review packet', npmBin, ['run', 'privacy:review-packet']);
  run('Runtime UI flow audit', npmBin, ['run', 'runtime:ui-flow']);
  run('App Store review guide', npmBin, ['run', 'review:guide']);
  run('Production device smoke test checklist', npmBin, ['run', 'device:smoke']);
  run('AdMob setup handoff', npmBin, ['run', 'ads:handoff']);
  run('External readiness checklist', npmBin, ['run', 'external:readiness']);
  run('EAS environment checklist', npmBin, ['run', 'eas:env-checklist']);
  run('Store submission input pack', npmBin, ['run', 'store:input-pack']);
  run('Account and service preflight', npmBin, ['run', 'account:preflight']);
  run('External TODO tracker', npmBin, ['run', 'external:todo-tracker']);
  run('EAS build preflight', npmBin, ['run', 'eas:build-preflight']);
  run('App Store Connect checklist', npmBin, ['run', 'appstore:checklist']);
  run('Release packet', npmBin, ['run', 'release:packet']);
  run('EAS submission checklist', npmBin, ['run', 'submission:checklist']);
  run('Final launch runbook', npmBin, ['run', 'launch:runbook']);
  run('App Store handoff bundle', npmBin, ['run', 'handoff:bundle']);
  run('Release asset and metadata checks', npmBin, ['run', 'release-check']);
  verifyExpoConfig();
  verifyWebExport();
  console.log('\nRelease verification passed.');
} catch (error) {
  console.error(`\nRelease verification failed: ${error.message}`);
  process.exit(1);
}

function run(label, command, args) {
  console.log(`\n> ${label}`);
  const result = spawnSync(command, args, {
    cwd: root,
    env: commonEnv,
    shell: useShell,
    stdio: 'inherit',
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${label} exited with status ${result.status}`);
  }
}

function capture(label, command, args) {
  console.log(`\n> ${label}`);
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    env: commonEnv,
    shell: useShell,
    stdio: ['ignore', 'pipe', 'inherit'],
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${label} exited with status ${result.status}`);
  }

  return result.stdout.replace(/^\uFEFF/, '').trim();
}

function verifyExpoConfig() {
  const output = capture('Expo config resolution', npxBin, ['expo', 'config', '--json']);
  const config = JSON.parse(output);
  const locales = Object.keys(config.locales ?? {});

  assert(config.sdkVersion === '56.0.0', `Expected Expo SDK 56.0.0, got ${config.sdkVersion}`);
  assert(locales.length === 10, `Expected 10 app locales, got ${locales.length}`);
  assert(!locales.includes('ja'), 'Japanese should not be exposed as a UI locale');
  assert(typeof config.extra?.admob?.liveAdsEnabled === 'boolean', 'extra.admob.liveAdsEnabled should be a boolean');

  console.log(
    `Expo config OK: ${config.name} ${config.version}, ${locales.length} locales, liveAdsEnabled=${config.extra.admob.liveAdsEnabled}`,
  );
}

function verifyWebExport() {
  fs.rmSync(webExportDir, { recursive: true, force: true });
  run('Production web export', npxBin, ['expo', 'export', '--platform', 'web', '--output-dir', webExportDir]);

  const files = listFiles(webExportDir);
  const relativeFiles = files.map((file) => path.relative(webExportDir, file).replace(/\\/g, '/'));
  const jsFiles = files.filter((file) => file.endsWith('.js'));

  assert(relativeFiles.includes('index.html'), 'Web export missing index.html');
  assert(jsFiles.length > 0, 'Web export missing JavaScript bundle');

  const bundledJs = jsFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
  assert(
    !bundledJs.includes('react-native-google-mobile-ads'),
    'Web export should not bundle the native Google Mobile Ads SDK',
  );

  fs.rmSync(webExportDir, { recursive: true, force: true });
  console.log(`Web export OK: ${relativeFiles.length} files checked.`);
}

function listFiles(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(entryPath));
    } else {
      files.push(entryPath);
    }
  }

  return files;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
