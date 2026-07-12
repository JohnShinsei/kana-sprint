const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const outputPath = path.join(root, 'docs/app-store-screenshot-manifest.json');
const appleLocaleMap = {
  'zh-Hans': 'zh-Hans',
  'zh-Hant': 'zh-Hant',
  en: 'en-US',
  fr: 'fr-FR',
  it: 'it',
  de: 'de-DE',
  'es-ES': 'es-ES',
  ko: 'ko',
  pl: 'pl',
  'pt-BR': 'pt-BR',
};
const devices = {
  'iphone-6.9': {
    label: 'iPhone 6.9-inch Display',
    width: 1320,
    height: 2868,
  },
  'iphone-6.5': {
    label: 'iPhone 6.5-inch Display',
    width: 1242,
    height: 2688,
  },
  'iphone-5.5': {
    label: 'iPhone 5.5-inch Display',
    width: 1242,
    height: 2208,
  },
  'ipad-13': {
    label: 'iPad Pro 13-inch Display',
    width: 2048,
    height: 2732,
  },
};
const scenes = {
  '01-ready.png': 'Ready screen',
  '02-playing.png': 'Active round with rewarded-ad continue entry',
  '03-levels.png': 'JLPT N5-N1 level selection',
  '04-settings.png': 'Settings, language, BGM, local data, support, privacy',
};

const manifest = {
  schemaVersion: 1,
  platform: 'ios',
  source: 'scripts/generate-store-screenshots.py',
  defaultPack: makePack('en', 'assets/store/ios'),
  localizedPacks: Object.keys(appleLocaleMap).map((locale) =>
    makePack(locale, `assets/store/ios-localized/${locale}`),
  ),
};

fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);

const totalScreenshots =
  manifest.defaultPack.screenshots.length +
  manifest.localizedPacks.reduce((sum, pack) => sum + pack.screenshots.length, 0);
console.log(`generated ${path.relative(root, outputPath)} with ${totalScreenshots} screenshot entries`);

function makePack(locale, rootPath) {
  return {
    locale,
    appStoreLocale: appleLocaleMap[locale],
    root: rootPath,
    screenshots: Object.entries(devices).flatMap(([device, dimensions]) =>
      Object.entries(scenes).map(([filename, scene]) => {
        const screenshotPath = `${rootPath}/${device}/${filename}`;
        return {
          path: screenshotPath,
          device,
          scene,
          width: dimensions.width,
          height: dimensions.height,
          bytes: fileBytes(screenshotPath),
          sha256: fileHash(screenshotPath),
        };
      }),
    ),
  };
}

function fileBytes(relativePath) {
  return fs.statSync(path.join(root, relativePath)).size;
}

function fileHash(relativePath) {
  const buffer = fs.readFileSync(path.join(root, relativePath));
  return crypto.createHash('sha256').update(buffer).digest('hex');
}
