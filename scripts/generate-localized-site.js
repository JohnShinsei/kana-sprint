const fs = require('fs');
const path = require('path');
const { loadLocalEnv } = require('./load-env');

const root = path.resolve(__dirname, '..');
const siteRoot = path.join(root, 'site');
loadLocalEnv();

const locales = ['zh-Hans', 'zh-Hant', 'en', 'fr', 'it', 'de', 'es-ES', 'ko', 'pl', 'pt-BR'];
const pageRoutes = [
  '/',
  '/support/',
  '/privacy/',
  '/licenses/',
  ...locales.flatMap((locale) => [`/${locale}/`, `/${locale}/support/`, `/${locale}/privacy/`, `/${locale}/licenses/`]),
];

const copy = {
  'zh-Hans': {
    language: '简体中文',
    title: 'Kana Sprint',
    tagline: '日语闪答训练',
    intro: 'Kana Sprint 是 60 秒日语学习游戏，训练假名、JLPT N5-N1 词汇和原创动漫感短句。',
    support: '支持',
    privacy: '隐私政策',
    licenses: '开源许可',
    facts: [
      ['无需账号', '进度和设置保存在设备本地。'],
      ['10 种 UI 语言', '默认跟随系统语言，也可以在设置中切换。'],
      ['原创学习内容', '动漫感短句不引用受保护剧本、角色、品牌或标题。'],
    ],
    supportTitle: 'Kana Sprint 支持',
    supportPanel: 'Kana Sprint 是一款日语学习游戏，包含假名、JLPT N5-N1 词汇和原创动漫感练习短句。',
    contactTitle: '联系',
    contactBody: '如需帮助、反馈问题或 App Store 审核沟通，请使用 App Store 页面公布的支持邮箱联系开发者。',
    accountTitle: '是否需要账号？',
    accountBody: '不需要。Kana Sprint 不要求登录、注册账号或云同步。',
    storageTitle: '进度保存在哪里？',
    storageBody: '进度、最高分、每日连续天数、每日目标进度、设置和已学项目数量保存在设备本地，可在设置里重置本机进度。',
    adsTitle: '为什么广告不可用？',
    adsBody: '只有发布构建配置了正式 AdMob App ID 和激励广告单元 ID 后，续局激励广告才会显示。',
    quoteTitle: '会引用真实动漫吗？',
    quoteBody: '不会。动漫感日语短句是原创学习材料，不引用受保护动漫脚本、角色、品牌或标题。',
    privacyTitle: '隐私政策',
    privacyPanel: 'Kana Sprint 本身不收集个人数据。',
    localDataTitle: '本地数据',
    localDataBody: '应用会在用户设备本地保存游戏进度、最高分、连击记录、每日连续天数、每日目标进度、已学项目数量、语言设置、音乐设置和所选难度。用户可在设置里重置本机进度。这些数据不会发送给开发者或云服务。',
    noTrackingTitle: '无账号或跟踪',
    noTrackingBody: 'Kana Sprint 不要求登录、账号创建、分析 SDK、位置、通讯录、相机、麦克风、后台音频、推送通知或用户生成内容。当前构建的 iOS 隐私清单声明无跟踪和无收集数据。',
    rewardedAdsTitle: '激励广告',
    rewardedAdsBody: 'Kana Sprint 包含可选的续局激励广告入口。只有正式发布构建配置有效 AdMob ID 后，Google Mobile Ads 才会启用。广告请求默认使用非个性化广告。',
    adPrivacyBody: '当 Google UMP 报告需要广告隐私选项时，应用会在设置中显示广告隐私入口，用于打开 UMP 隐私选项表单。',
    adDataBody: '启用 Google Mobile Ads 后，Google 的 SDK 可能接收广告相关数据，例如 IP 地址、由 IP 推断的大致位置、崩溃日志、性能数据、设备 ID 或广告标识符、广告数据以及广告展示或应用交互等产品交互数据。',
    changesTitle: '变更',
    changesBody: '如果未来版本的数据使用方式发生变化，此页面和 App Store 隐私信息应在发布前更新。',
    licensesTitle: '开源许可说明',
    licensesPanel: 'Kana Sprint 使用开源依赖构建。此页面汇总当前发布包的运行时依赖许可，便于用户和审核人员查看。',
    licensesSummaryTitle: '许可摘要',
    licensesDirectTitle: '直接运行时依赖',
    licensesReviewTitle: '需声明或复核的运行时包',
    licensesFallback: '运行 npm run legal:licenses 生成最新开源许可清单。',
    licensesGeneratedBody: '此页面根据当前 package-lock 许可审计生成。',
  },
  'zh-Hant': {
    language: '繁體中文',
    title: 'Kana Sprint',
    tagline: '日語閃答訓練',
    intro: 'Kana Sprint 是 60 秒日語學習遊戲，訓練假名、JLPT N5-N1 詞彙和原創動漫感短句。',
    support: '支援',
    privacy: '隱私政策',
    licenses: '開源授權',
    facts: [
      ['無需帳號', '進度和設定保存在裝置本地。'],
      ['10 種 UI 語言', '預設跟隨系統語言，也可以在設定中切換。'],
      ['原創學習內容', '動漫感短句不引用受保護劇本、角色、品牌或標題。'],
    ],
    supportTitle: 'Kana Sprint 支援',
    supportPanel: 'Kana Sprint 是一款日語學習遊戲，包含假名、JLPT N5-N1 詞彙和原創動漫感練習短句。',
    contactTitle: '聯絡',
    contactBody: '如需協助、回報問題或 App Store 審核溝通，請使用 App Store 頁面公布的支援信箱聯絡開發者。',
    accountTitle: '是否需要帳號？',
    accountBody: '不需要。Kana Sprint 不要求登入、註冊帳號或雲端同步。',
    storageTitle: '進度保存在哪裡？',
    storageBody: '進度、最高分、每日連續天數、每日目標進度、設定和已學項目數量保存在裝置本地，可在設定裡重置本機進度。',
    adsTitle: '為什麼廣告不可用？',
    adsBody: '只有發布構建配置正式 AdMob App ID 和激勵廣告單元 ID 後，續局激勵廣告才會顯示。',
    quoteTitle: '會引用真實動漫嗎？',
    quoteBody: '不會。動漫感日語短句是原創學習材料，不引用受保護動漫腳本、角色、品牌或標題。',
    privacyTitle: '隱私政策',
    privacyPanel: 'Kana Sprint 本身不收集個人資料。',
    localDataTitle: '本地資料',
    localDataBody: '應用會在使用者裝置本地保存遊戲進度、最高分、連擊記錄、每日連續天數、每日目標進度、已學項目數量、語言設定、音樂設定和所選難度。使用者可在設定裡重置本機進度。這些資料不會傳送給開發者或雲端服務。',
    noTrackingTitle: '無帳號或追蹤',
    noTrackingBody: 'Kana Sprint 不要求登入、帳號建立、分析 SDK、位置、通訊錄、相機、麥克風、背景音訊、推播通知或使用者產生內容。當前構建的 iOS 隱私清單聲明無追蹤和無收集資料。',
    rewardedAdsTitle: '激勵廣告',
    rewardedAdsBody: 'Kana Sprint 包含可選的續局激勵廣告入口。只有正式發布構建配置有效 AdMob ID 後，Google Mobile Ads 才會啟用。廣告請求預設使用非個人化廣告。',
    adPrivacyBody: '當 Google UMP 回報需要廣告隱私選項時，應用會在設定中顯示廣告隱私入口，用於開啟 UMP 隱私選項表單。',
    adDataBody: '啟用 Google Mobile Ads 後，Google 的 SDK 可能接收廣告相關資料，例如 IP 位址、由 IP 推斷的大致位置、崩潰日誌、效能資料、裝置 ID 或廣告識別碼、廣告資料以及廣告展示或應用互動等產品互動資料。',
    changesTitle: '變更',
    changesBody: '如果未來版本的資料使用方式發生變化，此頁面和 App Store 隱私資訊應在發布前更新。',
    licensesTitle: '開源授權說明',
    licensesPanel: 'Kana Sprint 使用開源依賴構建。此頁面彙總目前發布包的執行時依賴授權，方便使用者和審核人員查看。',
    licensesSummaryTitle: '授權摘要',
    licensesDirectTitle: '直接執行時依賴',
    licensesReviewTitle: '需聲明或複核的執行時套件',
    licensesFallback: '執行 npm run legal:licenses 生成最新開源授權清單。',
    licensesGeneratedBody: '此頁面根據目前 package-lock 授權審計生成。',
  },
  en: {
    language: 'English',
    title: 'Kana Sprint',
    tagline: 'Japanese speed-learning game',
    intro: 'Kana Sprint is a 60-second Japanese learning game for kana, JLPT N5-N1 vocabulary, and original anime-style practice lines.',
    support: 'Support',
    privacy: 'Privacy Policy',
    licenses: 'Open Source',
    facts: [
      ['No account', 'Progress and settings stay on the device.'],
      ['Ten UI languages', 'The app follows the system language and can be changed in Settings.'],
      ['Original study content', 'Anime-style lines do not quote protected scripts, characters, brands, or titles.'],
    ],
    supportTitle: 'Kana Sprint Support',
    supportPanel: 'Kana Sprint is a Japanese learning game for kana, JLPT N5-N1 vocabulary, and original anime-style practice lines.',
    contactTitle: 'Contact',
    contactBody: 'For help, bug reports, or App Store review questions, contact the developer through the support email published on the App Store listing.',
    accountTitle: 'Does the app require an account?',
    accountBody: 'No. Kana Sprint does not require sign-in, account creation, or cloud sync.',
    storageTitle: 'Where is progress stored?',
    storageBody: 'Progress, high scores, daily streaks, daily goal progress, settings, and learned-item counts are stored locally on the device. Local progress can be reset in Settings.',
    adsTitle: 'Why are ads unavailable?',
    adsBody: 'The continue-run rewarded ad only appears when production AdMob app IDs and rewarded ad-unit IDs are configured for the release build.',
    quoteTitle: 'Does the app quote real anime?',
    quoteBody: 'No. The anime-style Japanese lines are original study material and do not quote protected anime scripts, characters, brands, or titles.',
    privacyTitle: 'Privacy Policy',
    privacyPanel: 'Kana Sprint itself does not collect personal data.',
    localDataTitle: 'Local Data',
    localDataBody: "The app stores gameplay progress, high scores, combo records, daily streaks, daily goal progress, learned-item counts, language settings, music settings, and selected difficulty locally on the user's device. Users can reset local progress in Settings. This data is not transmitted to the developer or to a cloud service.",
    noTrackingTitle: 'No Account or Tracking',
    noTrackingBody: 'Kana Sprint does not require sign-in, account creation, analytics, location, contacts, camera, microphone, background audio, push notifications, or user-generated content. The iOS privacy manifest declares no tracking and no collected data for the current build.',
    rewardedAdsTitle: 'Rewarded Ads',
    rewardedAdsBody: 'Kana Sprint includes an optional rewarded-ad entry point for continuing a run. Live Google Mobile Ads are enabled only when valid AdMob app IDs and rewarded ad-unit IDs are configured for a release build. Ad requests default to non-personalized ads.',
    adPrivacyBody: 'When Google UMP reports that ad privacy options are required, the app shows an Ad privacy entry in Settings so users can open the UMP privacy options form.',
    adDataBody: "When live Google Mobile Ads are enabled, Google's Mobile Ads SDK may receive ad-related data such as IP address, approximate/general location derived from IP address, crash logs, performance data, Device ID or advertising identifiers, advertising data, and product interaction data such as ad views or app interaction events.",
    changesTitle: 'Changes',
    changesBody: "If the app's data use changes in a future version, this page and the App Store privacy details should be updated before release.",
    licensesTitle: 'Open Source Notices',
    licensesPanel: 'Kana Sprint is built with open source packages. This page summarizes the current release runtime dependency licenses for users and reviewers.',
    licensesSummaryTitle: 'License Summary',
    licensesDirectTitle: 'Direct Runtime Dependencies',
    licensesReviewTitle: 'Runtime Notice Or Review Packages',
    licensesFallback: 'Run npm run legal:licenses to generate the latest open source inventory.',
    licensesGeneratedBody: 'This page is generated from the current package-lock license audit.',
  },
};

const localizedCopy = {
  fr: {
    language: 'Français',
    tagline: 'Jeu rapide pour apprendre le japonais',
    intro: 'Kana Sprint entraîne kana, vocabulaire JLPT N5-N1 et phrases japonaises originales style anime en parties de 60 secondes.',
    support: 'Assistance',
    privacy: 'Confidentialité',
    licenses: 'Open source',
    licensesTitle: 'Mentions open source',
    facts: [
      ['Sans compte', "La progression et les réglages restent sur l'appareil."],
      ['10 langues UI', 'La langue suit le système et peut être changée dans les réglages.'],
      ['Contenu original', 'Les phrases style anime ne citent aucun script, personnage, marque ou titre protégé.'],
    ],
    supportTitle: 'Assistance Kana Sprint',
    supportPanel: 'Kana Sprint est un jeu pour apprendre le japonais avec kana, vocabulaire JLPT N5-N1 et phrases originales style anime.',
    contactTitle: 'Contact',
    contactBody: "Pour obtenir de l'aide, signaler un problème ou répondre à une question App Store, contactez le développeur via l'adresse publiée sur la fiche App Store.",
    accountTitle: "L'app nécessite-t-elle un compte ?",
    accountBody: 'Non. Kana Sprint ne demande ni connexion, ni création de compte, ni synchronisation cloud.',
    storageTitle: 'Où la progression est-elle stockée ?',
    storageBody: "La progression, les meilleurs scores, les séries quotidiennes, la progression de l'objectif du jour, les réglages et le nombre d'éléments appris sont stockés localement sur l'appareil. Les progrès locaux peuvent être réinitialisés dans les réglages.",
    adsTitle: 'Pourquoi les publicités sont-elles indisponibles ?',
    adsBody: "La publicité récompensée pour continuer une partie apparaît uniquement quand les IDs AdMob de production et l'unité récompensée sont configurés pour la build de sortie.",
    quoteTitle: "L'app cite-t-elle de vrais anime ?",
    quoteBody: "Non. Les phrases japonaises style anime sont du matériel d'étude original et ne citent aucun script, personnage, marque ou titre protégé.",
    privacyTitle: 'Politique de confidentialité',
    privacyPanel: 'Kana Sprint ne collecte pas directement de données personnelles.',
    localDataTitle: 'Données locales',
    localDataBody: "L'app conserve la progression, les meilleurs scores, les combos, les séries quotidiennes, la progression de l'objectif du jour, le nombre d'éléments appris, la langue, la musique et la difficulté choisie localement sur l'appareil. Les progrès locaux peuvent être réinitialisés dans les réglages. Ces données ne sont pas transmises au développeur ni à un service cloud.",
    noTrackingTitle: 'Aucun compte ni suivi',
    noTrackingBody: "Kana Sprint ne demande pas de connexion, création de compte, analytics, localisation, contacts, caméra, microphone, audio en arrière-plan, notifications push ou contenu généré par l'utilisateur. Le manifeste de confidentialité iOS de la build actuelle déclare aucun suivi et aucune donnée collectée.",
    rewardedAdsTitle: 'Publicités récompensées',
    rewardedAdsBody: 'Kana Sprint inclut une entrée optionnelle de publicité récompensée pour continuer une partie. Les Google Mobile Ads en direct ne sont activées que si des IDs AdMob valides sont configurés pour une build de sortie. Les requêtes publicitaires utilisent par défaut des annonces non personnalisées.',
    adPrivacyBody: "Lorsque Google UMP indique que les options de confidentialité publicitaire sont requises, l'app affiche une entrée de confidentialité publicitaire dans les réglages afin d'ouvrir le formulaire UMP.",
    adDataBody: "Quand Google Mobile Ads est activé, le SDK peut recevoir des données publicitaires comme l'adresse IP, la localisation approximative déduite de l'IP, les journaux de crash, les données de performance, l'ID de l'appareil ou identifiants publicitaires, les données publicitaires et les interactions produit comme les vues d'annonce ou événements dans l'app.",
    changesTitle: 'Modifications',
    changesBody: "Si l'utilisation des données change dans une future version, cette page et les informations de confidentialité App Store devront être mises à jour avant publication.",
  },
  it: {
    language: 'Italiano',
    tagline: 'Gioco rapido per imparare il giapponese',
    intro: 'Kana Sprint allena kana, vocabolario JLPT N5-N1 e frasi giapponesi originali in stile anime in partite da 60 secondi.',
    support: 'Supporto',
    privacy: 'Privacy',
    licenses: 'Open source',
    licensesTitle: 'Licenze open source',
    facts: [
      ['Nessun account', 'Progressi e impostazioni restano sul dispositivo.'],
      ['10 lingue UI', 'La lingua segue il sistema e può essere cambiata nelle impostazioni.'],
      ['Contenuti originali', 'Le frasi in stile anime non citano copioni, personaggi, marchi o titoli protetti.'],
    ],
    supportTitle: 'Supporto Kana Sprint',
    supportPanel: 'Kana Sprint è un gioco per imparare il giapponese con kana, vocabolario JLPT N5-N1 e frasi originali in stile anime.',
    contactTitle: 'Contatto',
    contactBody: "Per aiuto, segnalazioni o domande di revisione App Store, contatta lo sviluppatore tramite l'email di supporto pubblicata nella scheda App Store.",
    accountTitle: "L'app richiede un account?",
    accountBody: 'No. Kana Sprint non richiede accesso, creazione di account o sincronizzazione cloud.',
    storageTitle: 'Dove vengono salvati i progressi?',
    storageBody: "Progressi, punteggi migliori, serie giornaliere, progressi dell'obiettivo giornaliero, impostazioni e numero di elementi imparati vengono salvati localmente sul dispositivo. I progressi locali si possono azzerare nelle impostazioni.",
    adsTitle: 'Perché gli annunci non sono disponibili?',
    adsBody: "L'annuncio premiato per continuare una partita appare solo quando gli ID AdMob di produzione e l'unità premiata sono configurati per la build di rilascio.",
    quoteTitle: "L'app cita veri anime?",
    quoteBody: 'No. Le frasi giapponesi in stile anime sono materiale di studio originale e non citano copioni, personaggi, marchi o titoli protetti.',
    privacyTitle: 'Informativa sulla privacy',
    privacyPanel: 'Kana Sprint non raccoglie direttamente dati personali.',
    localDataTitle: 'Dati locali',
    localDataBody: "L'app salva progressi di gioco, punteggi migliori, combo, serie giornaliere, progressi dell'obiettivo giornaliero, numero di elementi imparati, lingua, musica e difficoltà scelta localmente sul dispositivo. I progressi locali si possono azzerare nelle impostazioni. Questi dati non vengono inviati allo sviluppatore o a un servizio cloud.",
    noTrackingTitle: 'Nessun account o tracciamento',
    noTrackingBody: "Kana Sprint non richiede accesso, creazione di account, analytics, posizione, contatti, fotocamera, microfono, audio in background, notifiche push o contenuti generati dall'utente. Il manifesto privacy iOS della build attuale dichiara nessun tracciamento e nessun dato raccolto.",
    rewardedAdsTitle: 'Annunci premiati',
    rewardedAdsBody: 'Kana Sprint include un ingresso opzionale per annunci premiati che permette di continuare una partita. Google Mobile Ads live è abilitato solo quando ID AdMob validi sono configurati per una build di rilascio. Le richieste usano per impostazione predefinita annunci non personalizzati.',
    adPrivacyBody: "Quando Google UMP segnala che le opzioni di privacy pubblicitaria sono richieste, l'app mostra una voce nelle impostazioni per aprire il modulo UMP.",
    adDataBody: "Quando Google Mobile Ads live è abilitato, il relativo SDK può ricevere dati pubblicitari come indirizzo IP, posizione approssimativa ricavata dall'IP, log di crash, dati di performance, ID dispositivo o identificatori pubblicitari, dati pubblicitari e interazioni prodotto come visualizzazioni annuncio o eventi nell'app.",
    changesTitle: 'Modifiche',
    changesBody: "Se l'uso dei dati cambia in una versione futura, questa pagina e i dettagli privacy su App Store dovranno essere aggiornati prima della pubblicazione.",
  },
  de: {
    language: 'Deutsch',
    tagline: 'Schnelles Spiel zum Japanischlernen',
    intro: 'Kana Sprint trainiert Kana, JLPT N5-N1 Wortschatz und originale japanische Anime-Stil-Sätze in 60-Sekunden-Runden.',
    support: 'Hilfe',
    privacy: 'Datenschutz',
    licenses: 'Open Source',
    licensesTitle: 'Open-Source-Hinweise',
    facts: [
      ['Kein Konto', 'Fortschritt und Einstellungen bleiben auf dem Gerät.'],
      ['10 UI-Sprachen', 'Die App folgt der Systemsprache und kann in den Einstellungen geändert werden.'],
      ['Originale Lerninhalte', 'Anime-Stil-Sätze zitieren keine geschützten Skripte, Figuren, Marken oder Titel.'],
    ],
    supportTitle: 'Kana Sprint Hilfe',
    supportPanel: 'Kana Sprint ist ein Japanisch-Lernspiel für Kana, JLPT N5-N1 Wortschatz und originale Übungssätze im Anime-Stil.',
    contactTitle: 'Kontakt',
    contactBody: 'Für Hilfe, Fehlerberichte oder Fragen zur App Store Prüfung kontaktieren Sie den Entwickler über die Support-E-Mail in der App Store Seite.',
    accountTitle: 'Benötigt die App ein Konto?',
    accountBody: 'Nein. Kana Sprint benötigt keine Anmeldung, Kontoerstellung oder Cloud-Synchronisierung.',
    storageTitle: 'Wo wird der Fortschritt gespeichert?',
    storageBody: 'Fortschritt, Highscores, tägliche Serien, Tagesziel-Fortschritt, Einstellungen und gelernte Elemente werden lokal auf dem Gerät gespeichert. Lokaler Fortschritt kann in den Einstellungen gelöscht werden.',
    adsTitle: 'Warum sind Anzeigen nicht verfügbar?',
    adsBody: 'Die belohnte Anzeige zum Fortsetzen einer Runde erscheint nur, wenn Produktions-AdMob-App-IDs und belohnte Anzeigenblöcke für den Release-Build konfiguriert sind.',
    quoteTitle: 'Zitiert die App echte Anime?',
    quoteBody: 'Nein. Die japanischen Anime-Stil-Sätze sind originales Lernmaterial und zitieren keine geschützten Anime-Skripte, Figuren, Marken oder Titel.',
    privacyTitle: 'Datenschutzerklärung',
    privacyPanel: 'Kana Sprint selbst erhebt keine personenbezogenen Daten.',
    localDataTitle: 'Lokale Daten',
    localDataBody: 'Die App speichert Spielfortschritt, Highscores, Kombos, tägliche Serien, Tagesziel-Fortschritt, gelernte Elemente, Sprache, Musik und gewählte Schwierigkeit lokal auf dem Gerät. Lokaler Fortschritt kann in den Einstellungen gelöscht werden. Diese Daten werden nicht an den Entwickler oder einen Cloud-Dienst gesendet.',
    noTrackingTitle: 'Kein Konto und kein Tracking',
    noTrackingBody: 'Kana Sprint benötigt keine Anmeldung, Kontoerstellung, Analytics, Standort, Kontakte, Kamera, Mikrofon, Hintergrundaudio, Push-Mitteilungen oder nutzergenerierte Inhalte. Das iOS-Datenschutzmanifest des aktuellen Builds erklärt kein Tracking und keine erhobenen Daten.',
    rewardedAdsTitle: 'Belohnte Anzeigen',
    rewardedAdsBody: 'Kana Sprint enthält einen optionalen Einstieg für belohnte Anzeigen, um eine Runde fortzusetzen. Live Google Mobile Ads werden nur aktiviert, wenn gültige AdMob-IDs für einen Release-Build konfiguriert sind. Anzeigenanfragen verwenden standardmäßig nicht personalisierte Anzeigen.',
    adPrivacyBody: 'Wenn Google UMP meldet, dass Datenschutzoptionen für Anzeigen erforderlich sind, zeigt die App einen Eintrag in den Einstellungen, um das UMP-Formular zu öffnen.',
    adDataBody: 'Wenn Live Google Mobile Ads aktiviert ist, kann das Mobile Ads SDK werbebezogene Daten erhalten, darunter IP-Adresse, aus der IP abgeleiteter ungefährer Standort, Absturzprotokolle, Leistungsdaten, Geräte-ID oder Werbe-IDs, Werbedaten und Produktinteraktionen wie Anzeigenaufrufe oder App-Interaktionen.',
    changesTitle: 'Änderungen',
    changesBody: 'Wenn sich die Datennutzung in einer zukünftigen Version ändert, sollten diese Seite und die App Store Datenschutzangaben vor der Veröffentlichung aktualisiert werden.',
  },
  'es-ES': {
    language: 'Español',
    tagline: 'Juego rápido para aprender japonés',
    intro: 'Kana Sprint entrena kana, vocabulario JLPT N5-N1 y frases japonesas originales estilo anime en rondas de 60 segundos.',
    support: 'Soporte',
    privacy: 'Privacidad',
    licenses: 'Código abierto',
    licensesTitle: 'Avisos de código abierto',
    facts: [
      ['Sin cuenta', 'El progreso y los ajustes permanecen en el dispositivo.'],
      ['10 idiomas de interfaz', 'La app sigue el idioma del sistema y puede cambiarse en Ajustes.'],
      ['Contenido original', 'Las frases estilo anime no citan guiones, personajes, marcas ni títulos protegidos.'],
    ],
    supportTitle: 'Soporte de Kana Sprint',
    supportPanel: 'Kana Sprint es un juego para aprender japonés con kana, vocabulario JLPT N5-N1 y frases originales de práctica estilo anime.',
    contactTitle: 'Contacto',
    contactBody: 'Para ayuda, informes de errores o preguntas de revisión de App Store, contacta con el desarrollador mediante el correo de soporte publicado en la ficha de App Store.',
    accountTitle: '¿La app requiere una cuenta?',
    accountBody: 'No. Kana Sprint no requiere iniciar sesión, crear una cuenta ni sincronización en la nube.',
    storageTitle: '¿Dónde se guarda el progreso?',
    storageBody: 'El progreso, las mejores puntuaciones, las rachas diarias, el progreso del objetivo diario, los ajustes y el número de elementos aprendidos se guardan localmente en el dispositivo. El progreso local puede restablecerse en Ajustes.',
    adsTitle: '¿Por qué no hay anuncios disponibles?',
    adsBody: 'El anuncio recompensado para continuar una partida solo aparece cuando los IDs de producción de AdMob y la unidad recompensada están configurados para la build de lanzamiento.',
    quoteTitle: '¿La app cita anime reales?',
    quoteBody: 'No. Las frases japonesas estilo anime son material de estudio original y no citan guiones, personajes, marcas ni títulos protegidos.',
    privacyTitle: 'Política de privacidad',
    privacyPanel: 'Kana Sprint no recopila directamente datos personales.',
    localDataTitle: 'Datos locales',
    localDataBody: 'La app guarda localmente en el dispositivo el progreso, mejores puntuaciones, combos, rachas diarias, progreso del objetivo diario, elementos aprendidos, idioma, música y dificultad seleccionada. El progreso local puede restablecerse en Ajustes. Estos datos no se envían al desarrollador ni a un servicio en la nube.',
    noTrackingTitle: 'Sin cuenta ni seguimiento',
    noTrackingBody: 'Kana Sprint no requiere inicio de sesión, creación de cuenta, analíticas, ubicación, contactos, cámara, micrófono, audio en segundo plano, notificaciones push ni contenido generado por usuarios. El manifiesto de privacidad iOS de la build actual declara que no hay seguimiento ni datos recopilados.',
    rewardedAdsTitle: 'Anuncios recompensados',
    rewardedAdsBody: 'Kana Sprint incluye una entrada opcional de anuncio recompensado para continuar una partida. Google Mobile Ads en vivo solo se habilita cuando se configuran IDs AdMob válidos para una build de lanzamiento. Las solicitudes de anuncios usan por defecto anuncios no personalizados.',
    adPrivacyBody: 'Cuando Google UMP indica que se requieren opciones de privacidad de anuncios, la app muestra una entrada en Ajustes para abrir el formulario UMP.',
    adDataBody: 'Cuando Google Mobile Ads en vivo está habilitado, el SDK puede recibir datos relacionados con anuncios como dirección IP, ubicación aproximada derivada de la IP, registros de fallos, datos de rendimiento, ID del dispositivo o identificadores publicitarios, datos publicitarios e interacciones de producto como vistas de anuncios o eventos dentro de la app.',
    changesTitle: 'Cambios',
    changesBody: 'Si el uso de datos cambia en una versión futura, esta página y los detalles de privacidad de App Store deberán actualizarse antes del lanzamiento.',
  },
  ko: {
    language: '한국어',
    tagline: '일본어 스피드 학습 게임',
    intro: 'Kana Sprint는 60초 라운드로 가나, JLPT N5-N1 단어, 오리지널 애니풍 일본어 문장을 연습하는 게임입니다.',
    support: '지원',
    privacy: '개인정보 처리방침',
    licenses: '오픈소스',
    licensesTitle: '오픈소스 고지',
    facts: [
      ['계정 불필요', '진행도와 설정은 기기 안에 저장됩니다.'],
      ['10개 UI 언어', '앱은 시스템 언어를 따르며 설정에서 바꿀 수 있습니다.'],
      ['오리지널 학습 콘텐츠', '애니풍 문장은 보호되는 대본, 캐릭터, 브랜드, 제목을 인용하지 않습니다.'],
    ],
    supportTitle: 'Kana Sprint 지원',
    supportPanel: 'Kana Sprint는 가나, JLPT N5-N1 단어, 오리지널 애니풍 연습 문장을 다루는 일본어 학습 게임입니다.',
    contactTitle: '문의',
    contactBody: '도움, 오류 신고, App Store 심사 관련 문의는 App Store 페이지에 공개된 지원 이메일로 개발자에게 연락해 주세요.',
    accountTitle: '계정이 필요한가요?',
    accountBody: '아니요. Kana Sprint는 로그인, 계정 생성, 클라우드 동기화를 요구하지 않습니다.',
    storageTitle: '진행도는 어디에 저장되나요?',
    storageBody: '진행도, 최고 점수, 데일리 연속 기록, 오늘 목표 진행도, 설정, 학습한 항목 수는 기기에 로컬로 저장되며 설정에서 초기화할 수 있습니다.',
    adsTitle: '광고를 사용할 수 없는 이유는 무엇인가요?',
    adsBody: '이어하기 보상형 광고는 출시 빌드에 정식 AdMob 앱 ID와 보상형 광고 단위 ID가 설정된 경우에만 표시됩니다.',
    quoteTitle: '실제 애니메이션을 인용하나요?',
    quoteBody: '아니요. 애니풍 일본어 문장은 오리지널 학습 자료이며 보호되는 애니메이션 대본, 캐릭터, 브랜드, 제목을 인용하지 않습니다.',
    privacyTitle: '개인정보 처리방침',
    privacyPanel: 'Kana Sprint 자체는 개인 데이터를 수집하지 않습니다.',
    localDataTitle: '로컬 데이터',
    localDataBody: '앱은 게임 진행도, 최고 점수, 콤보 기록, 데일리 연속 기록, 오늘 목표 진행도, 학습한 항목 수, 언어 설정, 음악 설정, 선택한 난이도를 사용자 기기에 로컬로 저장합니다. 로컬 진행도는 설정에서 초기화할 수 있습니다. 이 데이터는 개발자나 클라우드 서비스로 전송되지 않습니다.',
    noTrackingTitle: '계정 및 추적 없음',
    noTrackingBody: 'Kana Sprint는 로그인, 계정 생성, 분석 SDK, 위치, 연락처, 카메라, 마이크, 백그라운드 오디오, 푸시 알림, 사용자 생성 콘텐츠를 요구하지 않습니다. 현재 빌드의 iOS 개인정보 매니페스트는 추적 없음과 수집 데이터 없음을 선언합니다.',
    rewardedAdsTitle: '보상형 광고',
    rewardedAdsBody: 'Kana Sprint에는 라운드를 이어하기 위한 선택형 보상형 광고 입구가 포함되어 있습니다. 유효한 AdMob ID가 출시 빌드에 설정된 경우에만 Google Mobile Ads가 활성화됩니다. 광고 요청은 기본적으로 개인 맞춤이 아닌 광고를 사용합니다.',
    adPrivacyBody: 'Google UMP가 광고 개인정보 옵션이 필요하다고 보고하면, 앱은 설정에 광고 개인정보 항목을 표시하여 UMP 개인정보 옵션 양식을 열 수 있게 합니다.',
    adDataBody: 'Google Mobile Ads가 활성화되면 해당 SDK는 IP 주소, IP에서 추정한 대략적 위치, 충돌 로그, 성능 데이터, 기기 ID 또는 광고 식별자, 광고 데이터, 광고 조회나 앱 상호작용 같은 제품 상호작용 데이터를 받을 수 있습니다.',
    changesTitle: '변경',
    changesBody: '향후 버전에서 데이터 사용 방식이 바뀌면 출시 전에 이 페이지와 App Store 개인정보 정보를 업데이트해야 합니다.',
  },
  pl: {
    language: 'Polski',
    tagline: 'Szybka gra do nauki japońskiego',
    intro: 'Kana Sprint ćwiczy kanę, słownictwo JLPT N5-N1 i oryginalne japońskie kwestie w stylu anime w rundach 60 sekund.',
    support: 'Pomoc',
    privacy: 'Prywatność',
    licenses: 'Open source',
    licensesTitle: 'Informacje open source',
    facts: [
      ['Bez konta', 'Postępy i ustawienia pozostają na urządzeniu.'],
      ['10 języków interfejsu', 'Aplikacja podąża za językiem systemu i pozwala zmienić go w ustawieniach.'],
      ['Oryginalne treści', 'Kwestie w stylu anime nie cytują chronionych scenariuszy, postaci, marek ani tytułów.'],
    ],
    supportTitle: 'Pomoc Kana Sprint',
    supportPanel: 'Kana Sprint to gra do nauki japońskiego z kaną, słownictwem JLPT N5-N1 i oryginalnymi zdaniami ćwiczeniowymi w stylu anime.',
    contactTitle: 'Kontakt',
    contactBody: 'W sprawach pomocy, błędów lub pytań z recenzji App Store skontaktuj się z deweloperem przez adres wsparcia opublikowany na stronie App Store.',
    accountTitle: 'Czy aplikacja wymaga konta?',
    accountBody: 'Nie. Kana Sprint nie wymaga logowania, tworzenia konta ani synchronizacji w chmurze.',
    storageTitle: 'Gdzie przechowywane są postępy?',
    storageBody: 'Postępy, najlepsze wyniki, dzienne serie, postęp celu dziennego, ustawienia i liczba nauczonych elementów są przechowywane lokalnie na urządzeniu. Lokalny postęp można zresetować w ustawieniach.',
    adsTitle: 'Dlaczego reklamy są niedostępne?',
    adsBody: 'Reklama z nagrodą do kontynuowania rundy pojawia się tylko wtedy, gdy produkcyjne ID aplikacji AdMob i ID jednostki z nagrodą są skonfigurowane dla buildu wydania.',
    quoteTitle: 'Czy aplikacja cytuje prawdziwe anime?',
    quoteBody: 'Nie. Japońskie kwestie w stylu anime są oryginalnym materiałem do nauki i nie cytują chronionych scenariuszy, postaci, marek ani tytułów.',
    privacyTitle: 'Polityka prywatności',
    privacyPanel: 'Kana Sprint samodzielnie nie zbiera danych osobowych.',
    localDataTitle: 'Dane lokalne',
    localDataBody: 'Aplikacja zapisuje postępy, najlepsze wyniki, combo, dzienne serie, postęp celu dziennego, liczbę nauczonych elementów, język, muzykę i wybrany poziom trudności lokalnie na urządzeniu. Lokalny postęp można zresetować w ustawieniach. Te dane nie są wysyłane do dewelopera ani do usługi chmurowej.',
    noTrackingTitle: 'Brak konta i śledzenia',
    noTrackingBody: 'Kana Sprint nie wymaga logowania, tworzenia konta, analityki, lokalizacji, kontaktów, aparatu, mikrofonu, dźwięku w tle, powiadomień push ani treści tworzonych przez użytkowników. Manifest prywatności iOS w bieżącym buildzie deklaruje brak śledzenia i brak zbieranych danych.',
    rewardedAdsTitle: 'Reklamy z nagrodą',
    rewardedAdsBody: 'Kana Sprint zawiera opcjonalne wejście do reklamy z nagrodą pozwalającej kontynuować rundę. Google Mobile Ads na żywo jest włączane tylko wtedy, gdy prawidłowe ID AdMob są skonfigurowane dla buildu wydania. Żądania reklam domyślnie używają reklam niespersonalizowanych.',
    adPrivacyBody: 'Gdy Google UMP zgłasza wymóg opcji prywatności reklam, aplikacja pokazuje wpis w ustawieniach, który otwiera formularz UMP.',
    adDataBody: 'Po włączeniu Google Mobile Ads SDK może otrzymywać dane związane z reklamami, takie jak adres IP, przybliżona lokalizacja wywnioskowana z IP, logi awarii, dane wydajności, ID urządzenia lub identyfikatory reklamowe, dane reklamowe oraz interakcje produktu, na przykład wyświetlenia reklam lub zdarzenia w aplikacji.',
    changesTitle: 'Zmiany',
    changesBody: 'Jeśli sposób użycia danych zmieni się w przyszłej wersji, ta strona oraz informacje o prywatności w App Store powinny zostać zaktualizowane przed wydaniem.',
  },
  'pt-BR': {
    language: 'Português BR',
    tagline: 'Jogo rápido para aprender japonês',
    intro: 'Kana Sprint treina kana, vocabulário JLPT N5-N1 e frases japonesas originais em estilo anime em rodadas de 60 segundos.',
    support: 'Suporte',
    privacy: 'Privacidade',
    licenses: 'Código aberto',
    licensesTitle: 'Avisos de código aberto',
    facts: [
      ['Sem conta', 'Progresso e configurações ficam no dispositivo.'],
      ['10 idiomas de UI', 'O app segue o idioma do sistema e permite troca nas configurações.'],
      ['Conteúdo original', 'Frases em estilo anime não citam roteiros, personagens, marcas ou títulos protegidos.'],
    ],
    supportTitle: 'Suporte do Kana Sprint',
    supportPanel: 'Kana Sprint é um jogo para aprender japonês com kana, vocabulário JLPT N5-N1 e frases originais de prática em estilo anime.',
    contactTitle: 'Contato',
    contactBody: 'Para ajuda, relatos de bug ou perguntas da revisão da App Store, fale com o desenvolvedor pelo email de suporte publicado na página da App Store.',
    accountTitle: 'O app exige uma conta?',
    accountBody: 'Não. Kana Sprint não exige login, criação de conta ou sincronização em nuvem.',
    storageTitle: 'Onde o progresso é salvo?',
    storageBody: 'Progresso, melhores pontuações, sequências diárias, progresso da meta diária, configurações e contagem de itens aprendidos são salvos localmente no dispositivo. O progresso local pode ser redefinido nas configurações.',
    adsTitle: 'Por que os anúncios estão indisponíveis?',
    adsBody: 'O anúncio recompensado para continuar uma rodada só aparece quando IDs AdMob de produção e IDs de unidade recompensada estão configurados para a build de lançamento.',
    quoteTitle: 'O app cita animes reais?',
    quoteBody: 'Não. As frases japonesas em estilo anime são material de estudo original e não citam roteiros, personagens, marcas ou títulos protegidos.',
    privacyTitle: 'Política de privacidade',
    privacyPanel: 'Kana Sprint em si não coleta dados pessoais.',
    localDataTitle: 'Dados locais',
    localDataBody: 'O app salva progresso, melhores pontuações, combos, sequências diárias, progresso da meta diária, contagem de itens aprendidos, idioma, música e dificuldade escolhida localmente no dispositivo. O progresso local pode ser redefinido nas configurações. Esses dados não são enviados ao desenvolvedor nem a um serviço em nuvem.',
    noTrackingTitle: 'Sem conta ou rastreamento',
    noTrackingBody: 'Kana Sprint não exige login, criação de conta, analytics, localização, contatos, câmera, microfone, áudio em segundo plano, notificações push ou conteúdo gerado por usuários. O manifesto de privacidade iOS da build atual declara sem rastreamento e sem dados coletados.',
    rewardedAdsTitle: 'Anúncios recompensados',
    rewardedAdsBody: 'Kana Sprint inclui uma entrada opcional de anúncio recompensado para continuar uma rodada. Google Mobile Ads ao vivo só é ativado quando IDs AdMob válidos estão configurados para uma build de lançamento. As solicitações de anúncio usam anúncios não personalizados por padrão.',
    adPrivacyBody: 'Quando o Google UMP informa que opções de privacidade de anúncios são necessárias, o app mostra uma entrada nas configurações para abrir o formulário UMP.',
    adDataBody: 'Quando Google Mobile Ads está ativo, o SDK pode receber dados relacionados a anúncios, como endereço IP, localização aproximada derivada do IP, logs de falha, dados de desempenho, ID do dispositivo ou identificadores de publicidade, dados de publicidade e interações de produto, como visualizações de anúncio ou eventos no app.',
    changesTitle: 'Alterações',
    changesBody: 'Se o uso de dados mudar em uma versão futura, esta página e os detalhes de privacidade da App Store devem ser atualizados antes do lançamento.',
  },
};

for (const [locale, overrides] of Object.entries(localizedCopy)) {
  copy[locale] = {
    ...copy.en,
    ...overrides,
  };
}

function pageShell(locale, title, body) {
  const values = copy[locale];
  return `<!doctype html>
<html lang="${html(locale)}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${html(title)}</title>
    <meta name="description" content="${html(values.intro)}">
    <style>${css()}</style>
  </head>
  <body>
    <main>
      ${body}
    </main>
  </body>
</html>
`;
}

function landing(locale) {
  const values = copy[locale];
  return pageShell(locale, values.title, `
      <div class="brand" aria-label="Kana Sprint">
        <div class="mark">あ</div>
        <div>
          <h1>Kana Sprint</h1>
          <p>${html(values.tagline)}</p>
        </div>
      </div>
      <p>${html(values.intro)}</p>
      <div class="links">
        <a class="button primary" href="./support/">${html(values.support)}</a>
        <a class="button" href="./privacy/">${html(values.privacy)}</a>
        <a class="button" href="./licenses/">${html(values.licenses)}</a>
      </div>
      <section class="facts" aria-label="Product facts">
        ${values.facts.map(([title, body]) => `<div class="fact"><strong>${html(title)}</strong>${html(body)}</div>`).join('\n        ')}
      </section>
      <p class="locale-note">${html(values.language)}</p>
  `);
}

function support(locale) {
  const values = copy[locale];
  return pageShell(locale, values.supportTitle, `
      <nav><a href="../">Kana Sprint</a></nav>
      <h1>${html(values.supportTitle)}</h1>
      <p class="panel">${html(values.supportPanel)}</p>
      ${section(values.contactTitle, values.contactBody)}
      ${section(values.accountTitle, values.accountBody)}
      ${section(values.storageTitle, values.storageBody)}
      ${section(values.adsTitle, values.adsBody)}
      ${section(values.quoteTitle, values.quoteBody)}
  `);
}

function privacy(locale) {
  const values = copy[locale];
  return pageShell(locale, values.privacyTitle, `
      <nav><a href="../">Kana Sprint</a></nav>
      <h1>${html(values.privacyTitle)}</h1>
      <p class="panel">${html(values.privacyPanel)}</p>
      ${section(values.localDataTitle, values.localDataBody)}
      ${section(values.noTrackingTitle, values.noTrackingBody)}
      ${section(values.rewardedAdsTitle, values.rewardedAdsBody)}
      <p>${html(values.adPrivacyBody)}</p>
      <p>${html(values.adDataBody)}</p>
      ${section(values.changesTitle, values.changesBody)}
  `);
}

function licenses(locale) {
  const values = copy[locale];
  const audit = readOptionalJson('docs/open-source-license-audit.json');
  const summary = audit?.summary;
  const directRows = (audit?.directRuntime ?? [])
    .map((entry) => tableRow([entry.name, entry.version ?? 'n/a', entry.license, entry.classification]))
    .join('\n          ');
  const reviewRows = (audit?.runtimeReviewPackages ?? []).length > 0
    ? audit.runtimeReviewPackages
      .map((entry) => tableRow([entry.name, entry.version ?? 'n/a', entry.license, entry.classification]))
      .join('\n          ')
    : tableRow(['None', 'n/a', 'n/a', 'n/a']);

  return pageShell(locale, values.licensesTitle, `
      <nav><a href="../">Kana Sprint</a></nav>
      <h1>${html(values.licensesTitle)}</h1>
      <p class="panel">${html(values.licensesPanel)}</p>
      <h2>Voice synthesis credit</h2>
      <p>Japanese pronunciation: <strong>VOICEVOX:四国めたん</strong></p>
      <ul>
        <li><a href="https://voicevox.hiroshiba.jp/term/">VOICEVOX software terms</a></li>
        <li><a href="https://zunko.jp/con_ongen_kiyaku.html">四国めたん voice library terms</a></li>
      </ul>
      <h2>${html(values.licensesSummaryTitle)}</h2>
      ${summary ? `
      <ul>
        <li>Runtime packages: ${html(summary.runtimePackages)}</li>
        <li>Direct runtime dependencies: ${html(summary.directRuntimeDependencies)}</li>
        <li>Distinct runtime licenses: ${html(summary.runtimeDistinctLicenses)}</li>
        <li>Unknown runtime licenses: ${html(summary.unknownRuntimeLicenses)}</li>
        <li>Prohibited runtime licenses: ${html(summary.prohibitedRuntimeLicenses)}</li>
        <li>Runtime packages needing notice/review: ${html(summary.reviewRuntimeLicenses)}</li>
      </ul>` : `<p>${html(values.licensesFallback)}</p>`}
      <p>${html(values.licensesGeneratedBody)}</p>
      <h2>${html(values.licensesDirectTitle)}</h2>
      <div class="table-scroll">
        <table>
          <thead><tr><th>Package</th><th>Version</th><th>License</th><th>Classification</th></tr></thead>
          <tbody>${directRows}</tbody>
        </table>
      </div>
      <h2>${html(values.licensesReviewTitle)}</h2>
      <div class="table-scroll">
        <table>
          <thead><tr><th>Package</th><th>Version</th><th>License</th><th>Classification</th></tr></thead>
          <tbody>${reviewRows}</tbody>
        </table>
      </div>
  `);
}

function section(title, body) {
  return `<h2>${html(title)}</h2>\n      <p>${html(body)}</p>`;
}

function tableRow(cells) {
  return `<tr>${cells.map((cell) => `<td>${html(cell)}</td>`).join('')}</tr>`;
}

function writePage(relativePath, content) {
  const targetPath = path.join(siteRoot, relativePath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, content.replace(/[ \t]+$/gm, ''));
  console.log(`generated ${targetPath}`);
}

function writeSiteFile(relativePath, content) {
  const targetPath = path.join(siteRoot, relativePath);
  fs.writeFileSync(targetPath, content);
  console.log(`generated ${targetPath}`);
}

function writeHostingFiles() {
  writeSiteFile('.nojekyll', '');
  writeSiteFile(
    'robots.txt',
    [
      'User-agent: *',
      'Allow: /',
      '',
    ].join('\n'),
  );
  writeSiteFile(
    '_headers',
    [
      '/*',
      '  X-Content-Type-Options: nosniff',
      '  Referrer-Policy: strict-origin-when-cross-origin',
      "  Content-Security-Policy: default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; style-src 'self' 'unsafe-inline'",
      '',
    ].join('\n'),
  );
  writeSiteFile(
    '_redirects',
    [
      '/support /support/ 301',
      '/privacy /privacy/ 301',
      '/licenses /licenses/ 301',
      ...locales.flatMap((locale) => [
        `/${locale}/support /${locale}/support/ 301`,
        `/${locale}/privacy /${locale}/privacy/ 301`,
        `/${locale}/licenses /${locale}/licenses/ 301`,
      ]),
      '',
    ].join('\n'),
  );

  const baseUrl = trimTrailingSlash(process.env.APP_STORE_BASE_URL?.trim());
  const sitemapPath = path.join(siteRoot, 'sitemap.xml');

  if (!isProductionHttpsUrl(baseUrl)) {
    fs.rmSync(sitemapPath, { force: true });
    return;
  }

  const urls = pageRoutes
    .map((route) => `  <url><loc>${xml(joinUrl(baseUrl, route))}</loc></url>`)
    .join('\n');
  writeSiteFile(
    'sitemap.xml',
    [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      urls,
      '</urlset>',
      '',
    ].join('\n'),
  );
}

function css() {
  return `
      :root {
        color-scheme: dark;
        --bg: #10151f;
        --panel: #172131;
        --ink: #fff7e8;
        --muted: #a7b0c4;
        --accent: #ffb23f;
        --green: #31c6a7;
        --line: #2e3a4e;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        background: var(--bg);
        color: var(--ink);
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        line-height: 1.65;
      }
      main {
        width: min(920px, calc(100% - 40px));
        margin: 0 auto;
        padding: 64px 0;
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 18px;
        margin-bottom: 64px;
      }
      .mark {
        display: grid;
        width: 64px;
        height: 64px;
        place-items: center;
        border-radius: 16px;
        background: var(--accent);
        color: var(--bg);
        font-size: 38px;
        font-weight: 800;
      }
      nav { margin-bottom: 48px; }
      a { color: var(--accent); }
      h1 {
        margin: 0 0 18px;
        font-size: clamp(34px, 7vw, 58px);
        line-height: 1.05;
        letter-spacing: 0;
      }
      .brand h1 {
        margin: 0;
        font-size: clamp(42px, 8vw, 76px);
        line-height: 1;
      }
      h2 {
        margin: 38px 0 10px;
        font-size: 24px;
      }
      p, li {
        max-width: 760px;
        color: var(--muted);
        font-size: 18px;
      }
      .links {
        display: flex;
        flex-wrap: wrap;
        gap: 14px;
        margin-top: 34px;
      }
      .button {
        display: inline-flex;
        min-height: 48px;
        align-items: center;
        justify-content: center;
        border: 1px solid var(--line);
        border-radius: 8px;
        padding: 0 18px;
        background: var(--panel);
        color: var(--ink);
        font-weight: 700;
        text-decoration: none;
      }
      .button.primary {
        border-color: transparent;
        background: var(--accent);
        color: var(--bg);
      }
      .facts {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 14px;
        margin-top: 60px;
      }
      .fact, .panel {
        border: 1px solid var(--line);
        border-radius: 8px;
        background: var(--panel);
        padding: 20px;
      }
      .fact strong {
        display: block;
        margin-bottom: 6px;
        color: var(--green);
      }
      .table-scroll {
        width: 100%;
        overflow-x: auto;
        margin-top: 16px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        min-width: 680px;
      }
      th, td {
        border-bottom: 1px solid var(--line);
        padding: 12px 10px;
        text-align: left;
        vertical-align: top;
      }
      th {
        color: var(--green);
        font-size: 14px;
        text-transform: uppercase;
      }
      td {
        color: var(--muted);
        font-size: 15px;
      }
      .locale-note {
        margin-top: 34px;
        font-size: 14px;
      }
    `;
}

function html(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function xml(value) {
  return html(value).replace(/'/g, '&apos;');
}

function trimTrailingSlash(value) {
  return value?.replace(/\/+$/, '');
}

function joinUrl(rootUrl, route) {
  const normalizedRoute = String(route ?? '').replace(/^\/+/, '');
  return normalizedRoute ? `${rootUrl}/${normalizedRoute}` : rootUrl;
}

function isProductionHttpsUrl(value) {
  try {
    const parsed = new URL(value);
    const hostname = parsed.hostname.toLowerCase();

    return (
      parsed.protocol === 'https:' &&
      Boolean(hostname) &&
      hostname !== 'localhost' &&
      hostname !== '127.0.0.1' &&
      hostname !== '0.0.0.0' &&
      !hostname.endsWith('.local') &&
      !hostname.endsWith('.test') &&
      !hostname.endsWith('.example') &&
      !hostname.includes('example.com')
    );
  } catch {
    return false;
  }
}

function readOptionalJson(relativePath) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
  } catch {
    return null;
  }
}

writePage('index.html', landing('en'));
writePage('support/index.html', support('en'));
writePage('privacy/index.html', privacy('en'));
writePage('licenses/index.html', licenses('en'));
for (const locale of locales) {
  writePage(`${locale}/index.html`, landing(locale));
  writePage(`${locale}/support/index.html`, support(locale));
  writePage(`${locale}/privacy/index.html`, privacy(locale));
  writePage(`${locale}/licenses/index.html`, licenses(locale));
}
writeHostingFiles();
