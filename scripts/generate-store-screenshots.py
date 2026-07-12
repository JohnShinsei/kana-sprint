from pathlib import Path
from textwrap import wrap

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "assets" / "store" / "ios"
LOCALIZED_OUT_DIR = ROOT / "assets" / "store" / "ios-localized"

SIZES = {
    "iphone-6.9": (1320, 2868),
    "iphone-6.5": (1242, 2688),
    "iphone-5.5": (1242, 2208),
    "ipad-13": (2048, 2732),
}

COLORS = {
    "bg": "#10151F",
    "panel": "#172131",
    "panel_2": "#1D2635",
    "card": "#FFF7E8",
    "muted": "#A7B0C4",
    "ink": "#10151F",
    "cream": "#FFF7E8",
    "orange": "#FFB23F",
    "green": "#31C6A7",
    "red": "#EF5D60",
    "purple": "#7A80FF",
    "cyan": "#45B7D1",
    "border": "#2E3A4E",
}

LOCALES = ["zh-Hans", "zh-Hant", "en", "fr", "it", "de", "es-ES", "ko", "pl", "pt-BR"]

LANGUAGE_CHIPS = [
    "System",
    "简体中文",
    "繁體中文",
    "English",
    "Français",
    "Italiano",
    "Deutsch",
    "Español",
    "한국어",
    "Polski",
    "Português BR",
]

PROGRESS_ROWS = [
    ("N5", "74/285", 0.26, "green"),
    ("N4", "36/132", 0.27, "orange"),
    ("N3", "22/132", 0.17, "cyan"),
    ("N2", "11/132", 0.08, "purple"),
    ("N1", "4/132", 0.03, "red"),
]

COPY = {
    "zh-Hans": {
        "brand_subtitle": "日语闪答训练",
        "ready_headline": "60 秒日语速练",
        "ready_subhead": "匹配假名、JLPT N5-N1 词汇和原创动漫感短句，短局反复练。",
        "short_round": "60 秒短局",
        "hero_card": "把假名、词汇和短句练成反射",
        "metrics": ["最高", "熟练", "今日", "连续"],
        "daily_goal": ("每日目标", "2/3", "今天完成 3 局"),
        "progress_title": "N5-N1 本地进度",
        "milestones": "成就徽章",
        "badges": [("第一局", "1/1"), ("连续 3 天", "3/3"), ("熟练 20 项", "20/20"), ("N1 火花", "1/1")],
        "modes": [("综合", "假名 + 词汇 + 台词 + 文法"), ("词汇", "JLPT N5-N1 词汇"), ("假名", "平假名 / 片假名"), ("台词", "原创动漫感短句"), ("文法", "填空 / 助词 / 句型")],
        "start": "开始练习",
        "playing_headline": "快速作答，连击加分",
        "playing_subhead": "即时反馈、生命值、冲分和广告续局入口。",
        "hud": ["时间", "分数", "连击", "生命"],
        "options": ["觉悟", "矛盾", "继承", "模糊"],
        "feedback": "正确 +188",
        "ad_continue": "看广告续局",
        "levels_headline": "N5 到 N1 清晰分级",
        "levels_subhead": "从假名和日常词，到 N2 抽象词和 N1 语感逐级推进。",
        "level_rows": [("早上好", "133 词 / 42 句"), ("计划 / 日程", "90 词 / 24 句"), ("努力", "90 词 / 24 句"), ("责任", "90 词 / 24 句"), ("余韵", "90 词 / 24 句")],
        "line_label": "原创动漫感 N1 台词",
        "settings_headline": "跟随系统语言",
        "settings_subhead": "10 种 UI 语言放在设置中，日语保留为学习目标。",
        "settings": "设置",
        "language": "语言",
        "music": "音乐",
        "bgm": "经典 BGM 默认关闭",
        "local_data": "本机数据",
        "reset_progress": "重置进度",
        "support_privacy": "支持与隐私",
        "support": "支持",
        "privacy": "隐私",
        "open_source": "开源许可",
        "ad_privacy": "广告隐私",
        "note": "无登录。本地进度。短局练习。",
    },
    "zh-Hant": {
        "brand_subtitle": "日語閃答訓練",
        "ready_headline": "60 秒日語速練",
        "ready_subhead": "配對假名、JLPT N5-N1 詞彙和原創動漫感短句，短局反覆練。",
        "short_round": "60 秒短局",
        "hero_card": "把假名、詞彙和短句練成反射",
        "metrics": ["最高", "熟練", "今日", "連續"],
        "daily_goal": ("每日目標", "2/3", "今天完成 3 局"),
        "progress_title": "N5-N1 本地進度",
        "milestones": "成就徽章",
        "badges": [("第一局", "1/1"), ("連續 3 天", "3/3"), ("熟練 20 項", "20/20"), ("N1 火花", "1/1")],
        "modes": [("綜合", "假名 + 詞彙 + 台詞 + 文法"), ("詞彙", "JLPT N5-N1 詞彙"), ("假名", "平假名 / 片假名"), ("台詞", "原創動漫感短句"), ("文法", "填空 / 助詞 / 句型")],
        "start": "開始練習",
        "playing_headline": "快速作答，連擊加分",
        "playing_subhead": "即時回饋、生命值、衝分和廣告續局入口。",
        "hud": ["時間", "分數", "連擊", "生命"],
        "options": ["覺悟", "矛盾", "繼承", "模糊"],
        "feedback": "正確 +188",
        "ad_continue": "看廣告續局",
        "levels_headline": "N5 到 N1 清晰分級",
        "levels_subhead": "從假名和日常詞，到 N2 抽象詞和 N1 語感逐級推進。",
        "level_rows": [("早安", "133 詞 / 42 句"), ("計畫 / 日程", "90 詞 / 24 句"), ("努力", "90 詞 / 24 句"), ("責任", "90 詞 / 24 句"), ("餘韻", "90 詞 / 24 句")],
        "line_label": "原創動漫感 N1 台詞",
        "settings_headline": "跟隨系統語言",
        "settings_subhead": "10 種 UI 語言放在設定中，日語保留為學習目標。",
        "settings": "設定",
        "language": "語言",
        "music": "音樂",
        "bgm": "經典 BGM 預設關閉",
        "local_data": "本機資料",
        "reset_progress": "重置進度",
        "support_privacy": "支援與隱私",
        "support": "支援",
        "privacy": "隱私",
        "open_source": "開源授權",
        "ad_privacy": "廣告隱私",
        "note": "無登入。本地進度。短局練習。",
    },
    "en": {
        "brand_subtitle": "Japanese speed-learning game",
        "ready_headline": "60-second Japanese drills",
        "ready_subhead": "Match kana, JLPT N5-N1 words, and original anime-style lines in quick replayable runs.",
        "short_round": "60-second run",
        "hero_card": "Turn kana, words, and lines into reflexes",
        "metrics": ["Best", "Mastered", "Today", "Streak"],
        "daily_goal": ("Daily goal", "2/3", "Finish 3 runs today"),
        "progress_title": "N5-N1 local progress",
        "milestones": "Milestones",
        "badges": [("First run", "1/1"), ("3-day streak", "3/3"), ("20 mastered", "20/20"), ("N1 spark", "1/1")],
        "modes": [("Mix", "Kana + words + lines + grammar"), ("Words", "JLPT N5-N1 words"), ("Kana", "Hiragana / Katakana"), ("Lines", "Anime-style phrases"), ("Grammar", "Gaps / particles / patterns")],
        "start": "Start practice",
        "playing_headline": "Answer fast. Build combo.",
        "playing_subhead": "Instant feedback, hearts, score chasing, and a rewarded-ad continue entry point.",
        "hud": ["Time", "Score", "Combo", "Lives"],
        "options": ["Resolve", "Contradiction", "Inherit", "Vague"],
        "feedback": "Correct +188",
        "ad_continue": "Watch ad to continue",
        "levels_headline": "N5 to N1, clearly separated",
        "levels_subhead": "Start with kana and daily words, then climb into abstract N2 vocabulary and N1 nuance.",
        "level_rows": [("Good morning", "133 words / 42 lines"), ("Plan / schedule", "90 words / 24 lines"), ("Effort", "90 words / 24 lines"), ("Responsibility", "90 words / 24 lines"), ("Lingering impression", "90 words / 24 lines")],
        "line_label": "Original anime-style N1 line",
        "settings_headline": "Follows the system language",
        "settings_subhead": "Ten UI languages live in Settings, with Japanese kept as the study target.",
        "settings": "Settings",
        "language": "Language",
        "music": "Music",
        "bgm": "Classic BGM off by default",
        "local_data": "Local data",
        "reset_progress": "Reset progress",
        "support_privacy": "Support & Privacy",
        "support": "Support",
        "privacy": "Privacy",
        "open_source": "Open source",
        "ad_privacy": "Ad privacy",
        "note": "No login. Local progress. Quick runs.",
    },
    "fr": {
        "brand_subtitle": "Jeu rapide pour apprendre le japonais",
        "ready_headline": "Japonais en 60 secondes",
        "ready_subhead": "Associe kana, mots JLPT N5-N1 et phrases japonaises originales style anime.",
        "short_round": "Partie de 60 s",
        "hero_card": "Transforme kana, mots et phrases en réflexes",
        "metrics": ["Record", "Acquis", "Jour", "Série"],
        "daily_goal": ("Objectif du jour", "2/3", "3 parties aujourd'hui"),
        "progress_title": "Progression N5-N1",
        "milestones": "Jalons",
        "badges": [("1re partie", "1/1"), ("Série 3 j", "3/3"), ("20 acquis", "20/20"), ("Étincelle N1", "1/1")],
        "modes": [("Mix", "Kana + mots + phrases + grammaire"), ("Mots", "Mots JLPT N5-N1"), ("Kana", "Hiragana / Katakana"), ("Phrases", "Style anime original"), ("Grammaire", "Phrases à compléter")],
        "start": "Commencer",
        "playing_headline": "Réponds vite. Enchaîne.",
        "playing_subhead": "Feedback instantané, vies, score et pub bonus pour continuer.",
        "hud": ["Temps", "Score", "Combo", "Vies"],
        "options": ["Résolution", "Contradiction", "Héritage", "Vague"],
        "feedback": "Correct +188",
        "ad_continue": "Pub pour continuer",
        "levels_headline": "N5 à N1 bien séparés",
        "levels_subhead": "Des kana aux mots abstraits N2, jusqu'aux nuances N1.",
        "level_rows": [("Bonjour", "133 mots / 42 phrases"), ("Plan / horaire", "90 mots / 24 phrases"), ("Effort", "90 mots / 24 phrases"), ("Responsabilité", "90 mots / 24 phrases"), ("Impression persistante", "90 mots / 24 phrases")],
        "line_label": "Phrase N1 originale style anime",
        "settings_headline": "Suit la langue système",
        "settings_subhead": "Dix langues UI dans les réglages, japonais comme cible d'étude.",
        "settings": "Réglages",
        "language": "Langue",
        "music": "Musique",
        "bgm": "BGM classique désactivé par défaut",
        "local_data": "Données locales",
        "reset_progress": "Réinitialiser",
        "support_privacy": "Support et vie privée",
        "support": "Support",
        "privacy": "Vie privée",
        "open_source": "Open source",
        "ad_privacy": "Confidentialité pub",
        "note": "Sans compte. Progrès local. Parties courtes.",
    },
    "it": {
        "brand_subtitle": "Gioco rapido per imparare il giapponese",
        "ready_headline": "Giapponese in 60 secondi",
        "ready_subhead": "Abbina kana, parole JLPT N5-N1 e frasi originali in stile anime.",
        "short_round": "Partita da 60 s",
        "hero_card": "Trasforma kana, parole e frasi in riflessi",
        "metrics": ["Record", "Apprese", "Oggi", "Serie"],
        "daily_goal": ("Obiettivo", "2/3", "3 partite oggi"),
        "progress_title": "Progressi N5-N1",
        "milestones": "Traguardi",
        "badges": [("Prima", "1/1"), ("Serie 3 g", "3/3"), ("20 imparati", "20/20"), ("Scintilla N1", "1/1")],
        "modes": [("Mix", "Kana + parole + frasi + grammatica"), ("Parole", "Parole JLPT N5-N1"), ("Kana", "Hiragana / Katakana"), ("Frasi", "Stile anime originale"), ("Grammatica", "Frasi da completare")],
        "start": "Inizia",
        "playing_headline": "Rispondi veloce. Combo.",
        "playing_subhead": "Feedback istantaneo, vite, punteggio e annuncio per continuare.",
        "hud": ["Tempo", "Score", "Combo", "Vite"],
        "options": ["Decisione", "Contraddizione", "Ereditare", "Vago"],
        "feedback": "Corretto +188",
        "ad_continue": "Annuncio per continuare",
        "levels_headline": "Da N5 a N1 separati",
        "levels_subhead": "Dai kana e parole quotidiane fino al lessico astratto N2 e alle sfumature N1.",
        "level_rows": [("Buongiorno", "133 parole / 42 frasi"), ("Piano / orario", "90 parole / 24 frasi"), ("Impegno", "90 parole / 24 frasi"), ("Responsabilità", "90 parole / 24 frasi"), ("Eco persistente", "90 parole / 24 frasi")],
        "line_label": "Frase N1 originale stile anime",
        "settings_headline": "Segue la lingua di sistema",
        "settings_subhead": "Dieci lingue UI nelle impostazioni, giapponese come obiettivo di studio.",
        "settings": "Impostazioni",
        "language": "Lingua",
        "music": "Musica",
        "bgm": "BGM classica disattivata",
        "local_data": "Dati locali",
        "reset_progress": "Reset progressi",
        "support_privacy": "Supporto e privacy",
        "support": "Supporto",
        "privacy": "Privacy",
        "open_source": "Open source",
        "ad_privacy": "Privacy annunci",
        "note": "Nessun login. Progressi locali. Partite rapide.",
    },
    "de": {
        "brand_subtitle": "Schnelles Spiel zum Japanischlernen",
        "ready_headline": "Japanisch in 60 Sekunden",
        "ready_subhead": "Ordne Kana, JLPT N5-N1 Wörter und originale Anime-Stil-Sätze zu.",
        "short_round": "60-Sekunden-Runde",
        "hero_card": "Mach Kana, Wörter und Sätze zu Reflexen",
        "metrics": ["Bestwert", "Gelernt", "Heute", "Serie"],
        "daily_goal": ("Tagesziel", "2/3", "3 Runden heute"),
        "progress_title": "N5-N1-Fortschritt",
        "milestones": "Meilensteine",
        "badges": [("Erste Runde", "1/1"), ("3-Tage-Serie", "3/3"), ("20 gelernt", "20/20"), ("N1-Funke", "1/1")],
        "modes": [("Mix", "Kana + Wörter + Sätze + Grammatik"), ("Wörter", "JLPT N5-N1 Wörter"), ("Kana", "Hiragana / Katakana"), ("Sätze", "Originaler Anime-Stil"), ("Grammatik", "Lücken / Partikeln")],
        "start": "Starten",
        "playing_headline": "Schnell antworten. Combo.",
        "playing_subhead": "Direktes Feedback, Leben, Highscore-Jagd und Werbe-Fortsetzung.",
        "hud": ["Zeit", "Punkte", "Combo", "Leben"],
        "options": ["Entschluss", "Widerspruch", "Erben", "Vage"],
        "feedback": "Richtig +188",
        "ad_continue": "Werbung zum Fortfahren",
        "levels_headline": "N5 bis N1 klar getrennt",
        "levels_subhead": "Von Kana und Alltag bis zu abstrakten N2-Wörtern und N1-Nuancen.",
        "level_rows": [("Guten Morgen", "133 Wörter / 42 Sätze"), ("Plan / Termin", "90 Wörter / 24 Sätze"), ("Anstrengung", "90 Wörter / 24 Sätze"), ("Verantwortung", "90 Wörter / 24 Sätze"), ("Nachklang", "90 Wörter / 24 Sätze")],
        "line_label": "Originaler Anime-Stil-N1-Satz",
        "settings_headline": "Folgt der Systemsprache",
        "settings_subhead": "Zehn UI-Sprachen in den Einstellungen, Japanisch bleibt Lernziel.",
        "settings": "Einstellungen",
        "language": "Sprache",
        "music": "Musik",
        "bgm": "Klassische BGM standardmäßig aus",
        "local_data": "Lokale Daten",
        "reset_progress": "Fortschritt löschen",
        "support_privacy": "Support und Datenschutz",
        "support": "Support",
        "privacy": "Datenschutz",
        "open_source": "Open Source",
        "ad_privacy": "Werbe-Datenschutz",
        "note": "Kein Login. Lokaler Fortschritt. Kurze Runden.",
    },
    "es-ES": {
        "brand_subtitle": "Juego rápido para aprender japonés",
        "ready_headline": "Japonés en 60 segundos",
        "ready_subhead": "Relaciona kana, palabras JLPT N5-N1 y frases japonesas originales estilo anime.",
        "short_round": "Ronda de 60 s",
        "hero_card": "Convierte kana, palabras y frases en reflejos",
        "metrics": ["Récord", "Aprendido", "Hoy", "Racha"],
        "daily_goal": ("Objetivo diario", "2/3", "3 partidas hoy"),
        "progress_title": "Progreso N5-N1",
        "milestones": "Logros",
        "badges": [("1a ronda", "1/1"), ("Racha 3 d", "3/3"), ("20 dominadas", "20/20"), ("Chispa N1", "1/1")],
        "modes": [("Mixto", "Kana + palabras + frases + gramática"), ("Palabras", "Palabras JLPT N5-N1"), ("Kana", "Hiragana / Katakana"), ("Frases", "Estilo anime original"), ("Gramática", "Huecos / partículas")],
        "start": "Empezar",
        "playing_headline": "Responde rápido. Combo.",
        "playing_subhead": "Feedback instantáneo, vidas, puntuación y anuncio para continuar.",
        "hud": ["Tiempo", "Puntos", "Combo", "Vidas"],
        "options": ["Decisión", "Contradicción", "Heredar", "Vago"],
        "feedback": "Correcto +188",
        "ad_continue": "Anuncio para continuar",
        "levels_headline": "N5 a N1 bien separados",
        "levels_subhead": "De kana y palabras diarias a vocabulario N2 abstracto y matices N1.",
        "level_rows": [("Buenos días", "133 palabras / 42 frases"), ("Plan / horario", "90 palabras / 24 frases"), ("Esfuerzo", "90 palabras / 24 frases"), ("Responsabilidad", "90 palabras / 24 frases"), ("Impresión persistente", "90 palabras / 24 frases")],
        "line_label": "Frase N1 original estilo anime",
        "settings_headline": "Sigue el idioma del sistema",
        "settings_subhead": "Diez idiomas UI en Ajustes, japonés como objetivo de estudio.",
        "settings": "Ajustes",
        "language": "Idioma",
        "music": "Música",
        "bgm": "BGM clásica desactivada",
        "local_data": "Datos locales",
        "reset_progress": "Restablecer progreso",
        "support_privacy": "Soporte y privacidad",
        "support": "Soporte",
        "privacy": "Privacidad",
        "open_source": "Código abierto",
        "ad_privacy": "Privacidad anuncios",
        "note": "Sin inicio de sesión. Progreso local. Rondas rápidas.",
    },
    "ko": {
        "brand_subtitle": "일본어 스피드 학습 게임",
        "ready_headline": "60초 일본어 훈련",
        "ready_subhead": "가나, JLPT N5-N1 단어, 오리지널 애니풍 문장을 짧게 반복 학습.",
        "short_round": "60초 라운드",
        "hero_card": "가나, 단어, 문장을 반사적으로 익히기",
        "metrics": ["최고", "숙련", "오늘", "연속"],
        "daily_goal": ("오늘 목표", "2/3", "오늘 3판 완료"),
        "progress_title": "N5-N1 진행도",
        "milestones": "업적 배지",
        "badges": [("첫 라운드", "1/1"), ("3일 연속", "3/3"), ("20개 숙련", "20/20"), ("N1 불꽃", "1/1")],
        "modes": [("믹스", "가나 + 단어 + 대사 + 문법"), ("단어", "JLPT N5-N1 단어"), ("가나", "히라가나 / 가타카나"), ("대사", "오리지널 애니풍 문장"), ("문법", "빈칸 / 조사 / 문형")],
        "start": "연습 시작",
        "playing_headline": "빠르게 답하고 콤보!",
        "playing_subhead": "즉시 피드백, 라이프, 점수 경쟁, 광고로 계속하기.",
        "hud": ["시간", "점수", "콤보", "라이프"],
        "options": ["각오", "모순", "계승", "막연함"],
        "feedback": "정답 +188",
        "ad_continue": "광고로 계속",
        "levels_headline": "N5부터 N1까지 분리",
        "levels_subhead": "가나와 일상 단어에서 N2 추상어, N1 뉘앙스까지 단계적으로.",
        "level_rows": [("좋은 아침", "133 단어 / 42 문장"), ("계획 / 일정", "90 단어 / 24 문장"), ("노력", "90 단어 / 24 문장"), ("책임", "90 단어 / 24 문장"), ("여운", "90 단어 / 24 문장")],
        "line_label": "오리지널 애니풍 N1 문장",
        "settings_headline": "시스템 언어를 따름",
        "settings_subhead": "10개 UI 언어는 설정에서, 일본어는 학습 목표로 유지.",
        "settings": "설정",
        "language": "언어",
        "music": "음악",
        "bgm": "클래식 BGM 기본 꺼짐",
        "local_data": "로컬 데이터",
        "reset_progress": "진행도 초기화",
        "support_privacy": "지원 및 개인정보",
        "support": "지원",
        "privacy": "개인정보",
        "open_source": "오픈소스",
        "ad_privacy": "광고 개인정보",
        "note": "로그인 없음. 로컬 진행도. 짧은 라운드.",
    },
    "pl": {
        "brand_subtitle": "Szybka gra do nauki japońskiego",
        "ready_headline": "Japoński w 60 sekund",
        "ready_subhead": "Dopasuj kanę, słowa JLPT N5-N1 i oryginalne kwestie w stylu anime.",
        "short_round": "Runda 60 s",
        "hero_card": "Zmień kanę, słowa i kwestie w refleks",
        "metrics": ["Rekord", "Opanowane", "Dziś", "Seria"],
        "daily_goal": ("Cel dzienny", "2/3", "3 rundy dzisiaj"),
        "progress_title": "Postęp N5-N1",
        "milestones": "Kamienie milowe",
        "badges": [("1. runda", "1/1"), ("Seria 3 dni", "3/3"), ("20 opan.", "20/20"), ("Iskra N1", "1/1")],
        "modes": [("Mix", "Kana + słowa + kwestie + gramatyka"), ("Słowa", "Słowa JLPT N5-N1"), ("Kana", "Hiragana / Katakana"), ("Kwestie", "Oryginalny styl anime"), ("Gramatyka", "Luki / partykuły")],
        "start": "Start",
        "playing_headline": "Odpowiadaj szybko. Combo.",
        "playing_subhead": "Szybki feedback, życia, wynik i reklama do kontynuacji.",
        "hud": ["Czas", "Wynik", "Combo", "Życia"],
        "options": ["Determinacja", "Sprzeczność", "Dziedziczyć", "Niejasne"],
        "feedback": "Dobrze +188",
        "ad_continue": "Reklama, aby kontynuować",
        "levels_headline": "N5 do N1 jasno podzielone",
        "levels_subhead": "Od kany i codziennych słów po abstrakcyjne N2 i niuanse N1.",
        "level_rows": [("Dzień dobry", "133 słów / 42 kwestie"), ("Plan / grafik", "90 słów / 24 kwestie"), ("Wysiłek", "90 słów / 24 kwestie"), ("Odpowiedzialność", "90 słów / 24 kwestie"), ("Pozostałe wrażenie", "90 słów / 24 kwestie")],
        "line_label": "Oryginalna kwestia N1 w stylu anime",
        "settings_headline": "Podąża za językiem systemu",
        "settings_subhead": "Dziesięć języków UI w ustawieniach, japoński jako cel nauki.",
        "settings": "Ustawienia",
        "language": "Język",
        "music": "Muzyka",
        "bgm": "Klasyczne BGM domyślnie wyłączone",
        "local_data": "Dane lokalne",
        "reset_progress": "Reset postępu",
        "support_privacy": "Wsparcie i prywatność",
        "support": "Wsparcie",
        "privacy": "Prywatność",
        "open_source": "Open source",
        "ad_privacy": "Prywatność reklam",
        "note": "Bez logowania. Lokalny postęp. Krótkie rundy.",
    },
    "pt-BR": {
        "brand_subtitle": "Jogo rápido para aprender japonês",
        "ready_headline": "Japonês em 60 segundos",
        "ready_subhead": "Combine kana, palavras JLPT N5-N1 e frases japonesas originais estilo anime.",
        "short_round": "Rodada de 60 s",
        "hero_card": "Transforme kana, palavras e frases em reflexos",
        "metrics": ["Recorde", "Aprendidas", "Hoje", "Sequência"],
        "daily_goal": ("Meta diária", "2/3", "3 partidas hoje"),
        "progress_title": "Progresso N5-N1",
        "milestones": "Conquistas",
        "badges": [("1a rodada", "1/1"), ("Seq. 3 dias", "3/3"), ("20 dominadas", "20/20"), ("Faísca N1", "1/1")],
        "modes": [("Misto", "Kana + palavras + falas + gramática"), ("Palavras", "Palavras JLPT N5-N1"), ("Kana", "Hiragana / Katakana"), ("Falas", "Estilo anime original"), ("Gramática", "Lacunas / partículas")],
        "start": "Começar",
        "playing_headline": "Responda rápido. Combo.",
        "playing_subhead": "Feedback imediato, vidas, pontuação e anúncio para continuar.",
        "hud": ["Tempo", "Pontos", "Combo", "Vidas"],
        "options": ["Decisão", "Contradição", "Herdar", "Vago"],
        "feedback": "Certo +188",
        "ad_continue": "Anúncio para continuar",
        "levels_headline": "N5 a N1 bem separados",
        "levels_subhead": "De kana e palavras diárias até vocabulário abstrato N2 e nuances N1.",
        "level_rows": [("Bom dia", "133 palavras / 42 falas"), ("Plano / agenda", "90 palavras / 24 falas"), ("Esforço", "90 palavras / 24 falas"), ("Responsabilidade", "90 palavras / 24 falas"), ("Impressão persistente", "90 palavras / 24 falas")],
        "line_label": "Fala N1 original estilo anime",
        "settings_headline": "Segue o idioma do sistema",
        "settings_subhead": "Dez idiomas UI ficam nas configurações, japonês como alvo de estudo.",
        "settings": "Configurações",
        "language": "Idioma",
        "music": "Música",
        "bgm": "BGM clássica desligada por padrão",
        "local_data": "Dados locais",
        "reset_progress": "Redefinir progresso",
        "support_privacy": "Suporte e privacidade",
        "support": "Suporte",
        "privacy": "Privacidade",
        "open_source": "Código aberto",
        "ad_privacy": "Privacidade anúncios",
        "note": "Sem login. Progresso local. Rodadas rápidas.",
    },
}


def font(size, bold=False, value=""):
    if has_hangul(value):
        names = [
            "malgunbd.ttf" if bold else "malgun.ttf",
            "msyhbd.ttc" if bold else "msyh.ttc",
            "meiryob.ttc" if bold else "meiryo.ttc",
            "seguisb.ttf" if bold else "segoeui.ttf",
        ]
    elif has_cjk(value):
        names = [
            "msyhbd.ttc" if bold else "msyh.ttc",
            "simhei.ttf",
            "simsun.ttc",
            "meiryob.ttc" if bold else "meiryo.ttc",
            "YuGothB.ttc" if bold else "YuGothM.ttc",
            "malgunbd.ttf" if bold else "malgun.ttf",
        ]
    else:
        names = [
            "seguisb.ttf" if bold else "segoeui.ttf",
            "arialbd.ttf" if bold else "arial.ttf",
            "msyhbd.ttc" if bold else "msyh.ttc",
            "malgunbd.ttf" if bold else "malgun.ttf",
        ]

    paths = [Path("C:/Windows/Fonts") / name for name in names]
    if has_cjk(value) or has_hangul(value):
        paths.extend([
            Path("/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc" if bold else "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"),
            Path("/System/Library/Fonts/PingFang.ttc"),
        ])
    else:
        paths.extend([
            Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
            Path("/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf"),
        ])

    for path in paths:
        if path.exists():
            return ImageFont.truetype(str(path), size)

    return ImageFont.load_default()


def has_cjk(value):
    return any(
        "\u3040" <= char <= "\u30ff" or "\u3400" <= char <= "\u9fff"
        for char in value
    )


def has_hangul(value):
    return any("\uac00" <= char <= "\ud7af" for char in value)


def rounded(draw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def text(draw, xy, value, size, fill, bold=False, anchor=None, max_width=None, line_gap=8):
    fnt = font(size, bold, value)
    if max_width is None:
        draw.text(xy, value, font=fnt, fill=fill, anchor=anchor)
        return

    lines = wrap_text(draw, value, fnt, max_width)
    x, y = xy
    for line in lines:
        line_font = font(size, bold, line)
        draw.text((x, y), line, font=line_font, fill=fill, anchor=anchor)
        box = draw.textbbox((x, y), line, font=line_font)
        y += (box[3] - box[1]) + line_gap


def fit_text(draw, xy, value, max_size, min_size, fill, bold=False, anchor="mm", max_width=None):
    size = max_size
    max_width = max_width or 999999

    while size > min_size:
        fnt = font(size, bold, value)
        if draw.textlength(value, font=fnt) <= max_width:
            break
        size -= 1

    draw.text(xy, value, font=font(size, bold, value), fill=fill, anchor=anchor)


def wrap_text(draw, value, fnt, max_width):
    if draw.textlength(value, font=fnt) <= max_width:
        return [value]

    words = value.split()
    if len(words) > 1:
        lines = []
        current = ""
        for word in words:
            candidate = word if not current else f"{current} {word}"
            if draw.textlength(candidate, font=fnt) <= max_width:
                current = candidate
            else:
                if current:
                    lines.append(current)
                current = word
        if current:
            lines.append(current)
        return lines

    lines = []
    current = ""
    for char in value:
        candidate = f"{current}{char}"
        if not current or draw.textlength(candidate, font=fnt) <= max_width:
            current = candidate
        else:
            lines.append(current)
            current = char
    if current:
        lines.append(current)
    return lines


def draw_brand(draw, w, top, scale, copy):
    mark = int(82 * scale)
    x = int(84 * scale)
    rounded(draw, (x, top, x + mark, top + mark), int(22 * scale), COLORS["orange"])
    fit_text(draw, (x + mark / 2, top + mark / 2 - int(3 * scale)), "あ", int(46 * scale), int(32 * scale), COLORS["ink"], True)
    text(draw, (x + mark + int(24 * scale), top + int(7 * scale)), "Kana Sprint", int(38 * scale), COLORS["cream"], True)
    fit_text(draw, (x + mark + int(24 * scale), top + int(65 * scale)), copy["brand_subtitle"], int(22 * scale), int(14 * scale), COLORS["muted"], True, "la", w - x - mark - int(120 * scale))


def draw_headline(draw, w, y, headline, subhead, scale):
    x = int(84 * scale)
    text(draw, (x, y), headline, int(66 * scale), COLORS["cream"], True, max_width=w - x * 2, line_gap=int(10 * scale))
    text(draw, (x, y + int(170 * scale)), subhead, int(30 * scale), COLORS["muted"], True, max_width=w - x * 2, line_gap=int(8 * scale))


def phone_frame(draw, w, h, scale):
    frame_w = int(min(w * 0.78, 910 * scale))
    frame_h = int(min(h * 0.58, 1540 * scale))
    left = (w - frame_w) // 2
    top = int(h * 0.36)
    rounded(draw, (left, top, left + frame_w, top + frame_h), int(42 * scale), COLORS["panel"], COLORS["border"], int(3 * scale))
    return left, top, frame_w, frame_h


def pill(draw, box, label, fill, fg, scale):
    rounded(draw, box, int(18 * scale), fill)
    fit_text(draw, ((box[0] + box[2]) / 2, (box[1] + box[3]) / 2), label, int(24 * scale), int(16 * scale), fg, True, max_width=(box[2] - box[0]) - int(10 * scale))


def metric(draw, box, label, value, scale):
    rounded(draw, box, int(14 * scale), COLORS["panel"])
    fit_text(draw, (box[0] + int(18 * scale), box[1] + int(24 * scale)), label, int(18 * scale), int(11 * scale), COLORS["muted"], True, "la", (box[2] - box[0]) - int(36 * scale))
    fit_text(draw, (box[0] + int(18 * scale), box[1] + int(68 * scale)), value, int(35 * scale), int(22 * scale), COLORS["cream"], True, "la", (box[2] - box[0]) - int(36 * scale))


def progress_row(draw, box, level, value, percent, color_key, scale):
    rounded(draw, box, int(14 * scale), COLORS["panel_2"], COLORS["border"], int(2 * scale))
    label_x = box[0] + int(18 * scale)
    value_x = box[2] - int(18 * scale)
    center_y = box[1] + int(24 * scale)
    text(draw, (label_x, center_y), level, int(21 * scale), COLORS["cream"], True, "lm")
    text(draw, (value_x, center_y), value, int(19 * scale), COLORS["muted"], True, "rm")

    track_left = box[0] + int(18 * scale)
    track_top = box[1] + int(41 * scale)
    track_right = box[2] - int(18 * scale)
    track_bottom = box[3] - int(10 * scale)
    rounded(draw, (track_left, track_top, track_right, track_bottom), int(7 * scale), COLORS["panel"])
    fill_width = max(int(6 * scale), int((track_right - track_left) * percent))
    rounded(draw, (track_left, track_top, track_left + fill_width, track_bottom), int(7 * scale), COLORS[color_key])


def badge(draw, box, label, value, active, scale):
    fill = COLORS["green"] if active else COLORS["panel_2"]
    fg = COLORS["ink"] if active else COLORS["cream"]
    rounded(draw, box, int(14 * scale), fill, COLORS["border"], int(2 * scale))
    fit_text(draw, ((box[0] + box[2]) / 2, box[1] + int(22 * scale)), label, int(17 * scale), int(9 * scale), fg, True, max_width=(box[2] - box[0]) - int(14 * scale))
    fit_text(draw, ((box[0] + box[2]) / 2, box[1] + int(47 * scale)), value, int(19 * scale), int(11 * scale), fg, True, max_width=(box[2] - box[0]) - int(14 * scale))


def daily_goal_card(draw, box, goal, scale):
    label, value, body = goal
    rounded(draw, box, int(14 * scale), COLORS["panel"], COLORS["orange"], int(2 * scale))
    fit_text(draw, (box[0] + int(16 * scale), box[1] + int(18 * scale)), label, int(16 * scale), int(9 * scale), COLORS["orange"], True, "la", (box[2] - box[0]) - int(86 * scale))
    fit_text(draw, (box[2] - int(16 * scale), box[1] + int(18 * scale)), value, int(24 * scale), int(15 * scale), COLORS["cream"], True, "ra", int(62 * scale))
    fit_text(draw, (box[0] + int(16 * scale), box[1] + int(47 * scale)), body, int(14 * scale), int(8 * scale), COLORS["muted"], True, "la", (box[2] - box[0]) - int(32 * scale))
    track_left = box[0] + int(16 * scale)
    track_right = box[2] - int(16 * scale)
    track_top = box[3] - int(14 * scale)
    rounded(draw, (track_left, track_top, track_right, track_top + int(6 * scale)), int(3 * scale), COLORS["panel_2"])
    rounded(draw, (track_left, track_top, track_left + int((track_right - track_left) * 0.67), track_top + int(6 * scale)), int(3 * scale), COLORS["green"])


def draw_ready(draw, w, h, scale, copy):
    draw_brand(draw, w, int(72 * scale), scale, copy)
    draw_headline(draw, w, int(260 * scale), copy["ready_headline"], copy["ready_subhead"], scale)

    x, y, fw, fh = phone_frame(draw, w, h, scale)
    pad = int(34 * scale)
    rounded(draw, (x + pad, y + pad, x + fw - pad, y + int(285 * scale)), int(22 * scale), COLORS["card"])
    text(draw, (x + pad * 2, y + pad * 2), copy["short_round"], int(24 * scale), COLORS["red"], True)
    daily_goal_card(draw, (x + fw - pad * 2 - int(250 * scale), y + pad + int(14 * scale), x + fw - pad * 2, y + pad + int(92 * scale)), copy["daily_goal"], scale)
    text(draw, (x + pad * 2, y + int(118 * scale)), copy["hero_card"], int(42 * scale), COLORS["ink"], True, max_width=fw - pad * 4)
    stats_top = y + int(320 * scale)
    gap = int(14 * scale)
    metric_w = (fw - pad * 2 - gap * 3) // 4
    for i, (label, value) in enumerate(zip(copy["metrics"], ["8420", "128", "3910", "12"])):
        left = x + pad + i * (metric_w + gap)
        metric(draw, (left, stats_top, left + metric_w, stats_top + int(120 * scale)), label, value, scale)

    modes_top = stats_top + int(160 * scale)
    mode_w = (fw - pad * 2 - gap * 2) // 3
    for i, (label, detail) in enumerate(copy["modes"]):
        selected = i == 0
        left = x + pad + (i % 3) * (mode_w + gap)
        top = modes_top + (i // 3) * int(145 * scale)
        fill = COLORS["green"] if selected else COLORS["panel_2"]
        fg = COLORS["ink"] if selected else COLORS["cream"]
        rounded(draw, (left, top, left + mode_w, top + int(122 * scale)), int(16 * scale), fill, COLORS["border"])
        fit_text(draw, (left + int(24 * scale), top + int(38 * scale)), label, int(34 * scale), int(20 * scale), fg, True, "la", mode_w - int(48 * scale))
        fit_text(draw, (left + int(24 * scale), top + int(84 * scale)), detail, int(18 * scale), int(11 * scale), COLORS["ink"] if selected else COLORS["muted"], True, "la", mode_w - int(48 * scale))

    levels_top = modes_top + int(322 * scale)
    for i, level in enumerate(["N5", "N4", "N3", "N2", "N1"]):
        left = x + pad + i * ((fw - pad * 2) // 5)
        pill(draw, (left, levels_top, left + int(112 * scale), levels_top + int(66 * scale)), level, COLORS["orange"] if level == "N5" else COLORS["panel_2"], COLORS["ink"] if level == "N5" else COLORS["cream"], scale)

    progress_top = levels_top + int(96 * scale)
    text(draw, (x + pad, progress_top), copy["progress_title"], int(24 * scale), COLORS["muted"], True)
    row_h = int(56 * scale)
    row_gap = int(8 * scale)
    for i, (level, value, percent, color_key) in enumerate(PROGRESS_ROWS):
        top = progress_top + int(34 * scale) + i * (row_h + row_gap)
        progress_row(draw, (x + pad, top, x + fw - pad, top + row_h), level, value, percent, color_key, scale)

    badges_top = progress_top + int(364 * scale)
    text(draw, (x + pad, badges_top), copy["milestones"], int(22 * scale), COLORS["muted"], True)
    badge_gap = int(10 * scale)
    badge_w = (fw - pad * 2 - badge_gap * 3) // 4
    for i, (label, value) in enumerate(copy["badges"]):
        left = x + pad + i * (badge_w + badge_gap)
        top = badges_top + int(30 * scale)
        badge(draw, (left, top, left + badge_w, top + int(60 * scale)), label, value, i < 2, scale)

    button_top = y + fh - int(150 * scale)
    rounded(draw, (x + pad, button_top, x + fw - pad, button_top + int(82 * scale)), int(18 * scale), COLORS["orange"])
    fit_text(draw, (x + fw / 2, button_top + int(41 * scale)), copy["start"], int(30 * scale), int(18 * scale), COLORS["ink"], True, max_width=fw - pad * 4)


def draw_playing(draw, w, h, scale, copy):
    draw_brand(draw, w, int(72 * scale), scale, copy)
    draw_headline(draw, w, int(260 * scale), copy["playing_headline"], copy["playing_subhead"], scale)

    x, y, fw, fh = phone_frame(draw, w, h, scale)
    pad = int(34 * scale)
    strip_y = y + pad
    gap = int(12 * scale)
    metric_w = (fw - pad * 2 - gap * 3) // 4
    for i, (label, value) in enumerate(zip(copy["hud"], ["42s", "2680", "11", "● ● ○"])):
        left = x + pad + i * (metric_w + gap)
        metric(draw, (left, strip_y, left + metric_w, strip_y + int(110 * scale)), label, value, scale)

    track_y = strip_y + int(135 * scale)
    rounded(draw, (x + pad, track_y, x + fw - pad, track_y + int(18 * scale)), int(9 * scale), COLORS["panel_2"])
    rounded(draw, (x + pad, track_y, x + int(fw * 0.66), track_y + int(18 * scale)), int(9 * scale), COLORS["orange"])

    q_top = track_y + int(60 * scale)
    rounded(draw, (x + pad, q_top, x + fw - pad, q_top + int(355 * scale)), int(24 * scale), COLORS["card"], COLORS["orange"], int(5 * scale))
    text(draw, (x + fw / 2, q_top + int(56 * scale)), "N1 / Reading", int(24 * scale), COLORS["red"], True, "mm")
    text(draw, (x + fw / 2, q_top + int(178 * scale)), "覚悟", int(104 * scale), COLORS["ink"], True, "mm")
    text(draw, (x + fw / 2, q_top + int(282 * scale)), "かくご / kakugo", int(28 * scale), "#566073", True, "mm")

    option_top = q_top + int(400 * scale)
    option_w = (fw - pad * 2 - gap) // 2
    for i, label in enumerate(copy["options"]):
        fill = COLORS["green"] if i == 0 else COLORS["panel_2"]
        left = x + pad + (i % 2) * (option_w + gap)
        top = option_top + (i // 2) * int(150 * scale)
        rounded(draw, (left, top, left + option_w, top + int(126 * scale)), int(18 * scale), fill, COLORS["border"])
        fit_text(draw, (left + option_w / 2, top + int(63 * scale)), label, int(34 * scale), int(18 * scale), COLORS["ink"] if fill == COLORS["green"] else COLORS["cream"], True, max_width=option_w - int(24 * scale))

    bottom = y + fh - int(170 * scale)
    fit_text(draw, (x + fw / 2, bottom - int(28 * scale)), copy["feedback"], int(30 * scale), int(18 * scale), COLORS["green"], True, max_width=fw - pad * 2)
    rounded(draw, (x + pad * 2, bottom, x + fw - pad * 2, bottom + int(74 * scale)), int(18 * scale), COLORS["purple"])
    fit_text(draw, (x + fw / 2, bottom + int(37 * scale)), copy["ad_continue"], int(27 * scale), int(15 * scale), COLORS["cream"], True, max_width=fw - pad * 4)


def draw_levels(draw, w, h, scale, copy):
    draw_brand(draw, w, int(72 * scale), scale, copy)
    draw_headline(draw, w, int(260 * scale), copy["levels_headline"], copy["levels_subhead"], scale)

    x, y, fw, fh = phone_frame(draw, w, h, scale)
    pad = int(42 * scale)
    row_h = int(220 * scale)
    rows = [
        ("N5", "おはよう", copy["level_rows"][0][0], copy["level_rows"][0][1], COLORS["orange"]),
        ("N4", "予定", copy["level_rows"][1][0], copy["level_rows"][1][1], COLORS["green"]),
        ("N3", "努力", copy["level_rows"][2][0], copy["level_rows"][2][1], COLORS["cyan"]),
        ("N2", "責任", copy["level_rows"][3][0], copy["level_rows"][3][1], COLORS["purple"]),
        ("N1", "余韻", copy["level_rows"][4][0], copy["level_rows"][4][1], COLORS["red"]),
    ]
    for i, (level, sample, meaning, count, accent) in enumerate(rows):
        top = y + pad + i * row_h
        rounded(draw, (x + pad, top, x + fw - pad, top + row_h - int(24 * scale)), int(24 * scale), COLORS["panel_2"], COLORS["border"])
        rounded(draw, (x + pad + int(24 * scale), top + int(34 * scale), x + pad + int(132 * scale), top + int(142 * scale)), int(22 * scale), accent)
        text(draw, (x + pad + int(78 * scale), top + int(88 * scale)), level, int(36 * scale), COLORS["ink"] if accent != COLORS["purple"] else COLORS["cream"], True, "mm")
        text(draw, (x + pad + int(168 * scale), top + int(32 * scale)), sample, int(54 * scale), COLORS["cream"], True)
        fit_text(draw, (x + pad + int(168 * scale), top + int(118 * scale)), meaning, int(26 * scale), int(16 * scale), COLORS["muted"], True, "la", int(fw * 0.43))
        fit_text(draw, (x + fw - pad - int(24 * scale), top + int(72 * scale)), count, int(22 * scale), int(12 * scale), COLORS["orange"], True, "ra", int(fw * 0.34))

    quote_top = y + fh - int(235 * scale)
    rounded(draw, (x + pad, quote_top, x + fw - pad, quote_top + int(150 * scale)), int(22 * scale), COLORS["card"])
    fit_text(draw, (x + fw / 2, quote_top + int(52 * scale)), "理念は闇の中でも揺らがない", int(38 * scale), int(22 * scale), COLORS["ink"], True, max_width=fw - pad * 3)
    fit_text(draw, (x + fw / 2, quote_top + int(104 * scale)), copy["line_label"], int(24 * scale), int(14 * scale), "#566073", True, max_width=fw - pad * 3)


def draw_settings(draw, w, h, scale, copy):
    draw_brand(draw, w, int(72 * scale), scale, copy)
    draw_headline(draw, w, int(260 * scale), copy["settings_headline"], copy["settings_subhead"], scale)

    x, y, fw, fh = phone_frame(draw, w, h, scale)
    pad = int(40 * scale)
    rounded(draw, (x + pad, y + pad, x + fw - pad, y + fh - pad), int(28 * scale), COLORS["panel_2"], COLORS["border"])
    fit_text(draw, (x + pad * 2, y + pad * 2 + int(28 * scale)), copy["settings"], int(48 * scale), int(30 * scale), COLORS["cream"], True, "la", fw - pad * 4)
    text(draw, (x + pad * 2, y + int(168 * scale)), copy["language"], int(24 * scale), COLORS["muted"], True)

    chip_w = (fw - pad * 4 - int(22 * scale)) // 2
    chip_h = int(72 * scale)
    start_y = y + int(215 * scale)
    for i, label in enumerate(LANGUAGE_CHIPS):
        left = x + pad * 2 + (i % 2) * (chip_w + int(22 * scale))
        top = start_y + (i // 2) * int(92 * scale)
        selected = i == 0
        rounded(draw, (left, top, left + chip_w, top + chip_h), int(18 * scale), COLORS["green"] if selected else COLORS["panel"], COLORS["border"])
        fit_text(draw, (left + chip_w / 2, top + chip_h / 2), label, int(24 * scale), int(13 * scale), COLORS["ink"] if selected else COLORS["cream"], True, max_width=chip_w - int(16 * scale))

    music_y = start_y + int(590 * scale)
    text(draw, (x + pad * 2, music_y), copy["music"], int(24 * scale), COLORS["muted"], True)
    rounded(draw, (x + pad * 2, music_y + int(48 * scale), x + fw - pad * 2, music_y + int(128 * scale)), int(18 * scale), COLORS["orange"])
    fit_text(draw, (x + fw / 2, music_y + int(88 * scale)), copy["bgm"], int(28 * scale), int(16 * scale), COLORS["ink"], True, max_width=fw - pad * 4)

    links_y = music_y + int(165 * scale)
    fit_text(draw, (x + pad * 2, links_y + int(15 * scale)), copy["support_privacy"], int(24 * scale), int(14 * scale), COLORS["muted"], True, "la", fw - pad * 4)
    link_w = (fw - pad * 4 - int(18 * scale)) // 2
    for i, label in enumerate([copy["support"], copy["privacy"]]):
        left = x + pad * 2 + i * (link_w + int(18 * scale))
        top = links_y + int(48 * scale)
        rounded(draw, (left, top, left + link_w, top + int(76 * scale)), int(18 * scale), COLORS["panel"], COLORS["orange"])
        fit_text(draw, (left + link_w / 2, top + int(38 * scale)), label, int(26 * scale), int(15 * scale), COLORS["cream"], True, max_width=link_w - int(18 * scale))

    license_top = links_y + int(138 * scale)
    rounded(draw, (x + pad * 2, license_top, x + fw - pad * 2, license_top + int(76 * scale)), int(18 * scale), COLORS["panel"], COLORS["orange"])
    fit_text(draw, (x + fw / 2, license_top + int(38 * scale)), copy["open_source"], int(26 * scale), int(15 * scale), COLORS["cream"], True, max_width=fw - pad * 4)

    ad_top = license_top + int(90 * scale)
    rounded(draw, (x + pad * 2, ad_top, x + fw - pad * 2, ad_top + int(76 * scale)), int(18 * scale), COLORS["panel"], COLORS["orange"])
    fit_text(draw, (x + fw / 2, ad_top + int(38 * scale)), copy["ad_privacy"], int(26 * scale), int(15 * scale), COLORS["cream"], True, max_width=fw - pad * 4)

    data_y = y + fh - int(205 * scale)
    rounded(draw, (x + pad * 2, data_y, x + fw - pad * 2, data_y + int(120 * scale)), int(18 * scale), COLORS["card"])
    fit_text(draw, (x + fw / 2, data_y + int(32 * scale)), copy["local_data"], int(24 * scale), int(14 * scale), COLORS["ink"], True, max_width=fw - pad * 4)
    rounded(draw, (x + pad * 3, data_y + int(58 * scale), x + fw - pad * 3, data_y + int(104 * scale)), int(14 * scale), COLORS["cyan"])
    fit_text(draw, (x + fw / 2, data_y + int(81 * scale)), copy["reset_progress"], int(22 * scale), int(12 * scale), COLORS["ink"], True, max_width=fw - pad * 6)


SCENES = [
    ("01-ready.png", draw_ready),
    ("02-playing.png", draw_playing),
    ("03-levels.png", draw_levels),
    ("04-settings.png", draw_settings),
]


def render_scene(path, size_name, size, renderer, copy):
    w, h = size
    scale = min(w / 1320, h / 2868)
    image = Image.new("RGB", (w, h), COLORS["bg"])
    draw = ImageDraw.Draw(image)
    renderer(draw, w, h, scale, copy)
    image.save(path, "PNG", optimize=True)
    print(f"generated {path}")


def generate_pack(target_root, locale):
    copy = COPY[locale]

    for size_name, size in SIZES.items():
        target_dir = target_root / size_name
        target_dir.mkdir(parents=True, exist_ok=True)

        for filename, renderer in SCENES:
            render_scene(target_dir / filename, size_name, size, renderer, copy)


def generate():
    generate_pack(OUT_DIR, "en")

    for locale in LOCALES:
        generate_pack(LOCALIZED_OUT_DIR / locale, locale)


if __name__ == "__main__":
    generate()
