const { loadLocalEnv } = require('./scripts/load-env');

loadLocalEnv();

const admobAppIdPattern = /^ca-app-pub-\d{16}~\d{10}$/;
const admobUnitIdPattern = /^ca-app-pub-\d{16}\/\d{10}$/;
const admobPlaceholderPattern = /^ca-app-pub-0{16}[~/]0{10}$/;
const admobDemoPublisherPattern = /^ca-app-pub-3940256099942544[~/]/;
const supportedLocales = ['zh-Hans', 'zh-Hant', 'en', 'fr', 'it', 'de', 'es-ES', 'ko', 'pl', 'pt-BR'];

const skAdNetworkItems = [
  'cstr6suwn9.skadnetwork',
  '4fzdc2evr5.skadnetwork',
  '2fnua5tdw4.skadnetwork',
  'ydx93a7ass.skadnetwork',
  'p78axxw29g.skadnetwork',
  'v72qych5uu.skadnetwork',
  'ludvb6z3bs.skadnetwork',
  'cp8zw746q7.skadnetwork',
  '3sh42y64q3.skadnetwork',
  'c6k4g5qg8m.skadnetwork',
  's39g8k73mm.skadnetwork',
  'wg4vff78zm.skadnetwork',
  '3qy4746246.skadnetwork',
  'f38h382jlk.skadnetwork',
  'hs6bdukanm.skadnetwork',
  'mlmmfzh3r3.skadnetwork',
  'v4nxqhlyqp.skadnetwork',
  'wzmmz9fp6w.skadnetwork',
  'su67r6k2v3.skadnetwork',
  'yclnxrl5pm.skadnetwork',
  't38b2kh725.skadnetwork',
  '7ug5zh24hu.skadnetwork',
  'gta9lk7p23.skadnetwork',
  'vutu7akeur.skadnetwork',
  'y5ghdn5j9k.skadnetwork',
  'v9wttpbfk9.skadnetwork',
  'n38lu8286q.skadnetwork',
  '47vhws6wlr.skadnetwork',
  'kbd757ywx3.skadnetwork',
  '9t245vhmpl.skadnetwork',
  'a2p9lx4jpn.skadnetwork',
  '22mmun2rn5.skadnetwork',
  '44jx6755aq.skadnetwork',
  'k674qkevps.skadnetwork',
  '4468km3ulz.skadnetwork',
  '2u9pt9hc89.skadnetwork',
  '8s468mfl3y.skadnetwork',
  'klf5c3l5u5.skadnetwork',
  'ppxm28t8ap.skadnetwork',
  'kbmxgpxpgc.skadnetwork',
  'uw77j35x4d.skadnetwork',
  '578prtvx9j.skadnetwork',
  '4dzt52r2t5.skadnetwork',
  'tl55sbb4fm.skadnetwork',
  'c3frkrj4fj.skadnetwork',
  'e5fvkxwrpn.skadnetwork',
  '8c4e2ghe7u.skadnetwork',
  '3rd42ekr43.skadnetwork',
  '97r2b46745.skadnetwork',
  '3qcr597p9d.skadnetwork',
];

function normalizeUrl(value) {
  const cleaned = value?.trim();
  return cleaned ? cleaned : undefined;
}

function trimTrailingSlash(value) {
  return normalizeUrl(value)?.replace(/\/+$/, '');
}

function joinUrl(root, path) {
  return root ? `${root}/${path}` : undefined;
}

function localizedStoreUrls(baseUrl) {
  if (!baseUrl) return undefined;

  return Object.fromEntries(
    supportedLocales.map((locale) => [
      locale,
      {
        marketingUrl: joinUrl(baseUrl, locale),
        supportUrl: joinUrl(baseUrl, `${locale}/support`),
        privacyPolicyUrl: joinUrl(baseUrl, `${locale}/privacy`),
        openSourceNoticesUrl: joinUrl(baseUrl, `${locale}/licenses`),
      },
    ]),
  );
}

function hasValidAdMobConfig() {
  const values = [
    [process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID, admobAppIdPattern],
    [process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID, admobAppIdPattern],
    [process.env.EXPO_PUBLIC_ADMOB_REWARDED_IOS_UNIT_ID, admobUnitIdPattern],
    [process.env.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_UNIT_ID, admobUnitIdPattern],
  ];

  return values.every(([value, pattern]) => pattern.test(value ?? '') && !isPlaceholderAdMobId(value));
}

function isPlaceholderAdMobId(value) {
  return admobPlaceholderPattern.test(value ?? '') || admobDemoPublisherPattern.test(value ?? '');
}

module.exports = ({ config }) => {
  const plugins = [...(config.plugins ?? [])];
  const extra = { ...(config.extra ?? {}) };
  const baseUrl = trimTrailingSlash(process.env.APP_STORE_BASE_URL);

  extra.admob = {
    liveAdsEnabled: hasValidAdMobConfig(),
  };
  extra.storeUrls = {
    marketingUrl: normalizeUrl(process.env.APP_STORE_MARKETING_URL) ?? baseUrl,
    supportUrl: normalizeUrl(process.env.APP_STORE_SUPPORT_URL) ?? joinUrl(baseUrl, 'support'),
    privacyPolicyUrl: normalizeUrl(process.env.APP_STORE_PRIVACY_URL) ?? joinUrl(baseUrl, 'privacy'),
    openSourceNoticesUrl: joinUrl(baseUrl, 'licenses'),
    localized: localizedStoreUrls(baseUrl),
  };

  if (extra.admob.liveAdsEnabled) {
    plugins.push([
      'react-native-google-mobile-ads',
      {
        iosAppId: process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID,
        androidAppId: process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID,
        delayAppMeasurementInit: true,
        skAdNetworkItems,
      },
    ]);
  }

  return {
    ...config,
    extra,
    plugins,
  };
};
