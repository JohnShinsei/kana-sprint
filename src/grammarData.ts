import type { JlptLevel, StudyItem } from './gameData';
import { AppLocale, LocalizedText, makeText } from './i18n';

type GrammarConcept =
  | 'n5-topic'
  | 'n5-case'
  | 'n5-range'
  | 'n5-polite'
  | 'n5-request'
  | 'n4-experience'
  | 'n4-duty'
  | 'n4-permission'
  | 'n4-comparison'
  | 'n4-condition'
  | 'n3-decision'
  | 'n3-outcome'
  | 'n3-aspect'
  | 'n3-inference'
  | 'n3-purpose'
  | 'n2-certainty'
  | 'n2-target'
  | 'n2-contrast'
  | 'n2-necessity'
  | 'n2-evidence'
  | 'n1-effect'
  | 'n1-duty'
  | 'n1-concession'
  | 'n1-uniqueness'
  | 'n1-circumstance';

const concepts: Record<GrammarConcept, LocalizedText> = {
  'n5-topic': copy('Basic topic and addition particles', '基础主题与追加助词', '기초 주제·추가 조사', {
    fr: 'Particules de thème et d’ajout', it: 'Particelle di tema e aggiunta', de: 'Grundlegende Thema- und Zusatzpartikeln',
    'es-ES': 'Partículas básicas de tema y adición', pl: 'Podstawowe partykuły tematu i dodania', 'pt-BR': 'Partículas básicas de tópico e adição',
  }),
  'n5-case': copy('Basic case particles', '基础格助词', '기초 격조사', {
    fr: 'Particules de cas de base', it: 'Particelle di caso di base', de: 'Grundlegende Kasuspartikeln',
    'es-ES': 'Partículas de caso básicas', pl: 'Podstawowe partykuły przypadków', 'pt-BR': 'Partículas básicas de caso',
  }),
  'n5-range': copy('Starting and ending points', '起点与终点表达', '시작점과 끝점', {
    fr: 'Points de départ et d’arrivée', it: 'Punti di inizio e fine', de: 'Start- und Endpunkte',
    'es-ES': 'Puntos de inicio y final', pl: 'Punkty początkowe i końcowe', 'pt-BR': 'Pontos de início e fim',
  }),
  'n5-polite': copy('Polite verb forms', '礼貌动词形式', '정중한 동사형', {
    fr: 'Formes verbales polies', it: 'Forme verbali cortesi', de: 'Höfliche Verbformen',
    'es-ES': 'Formas verbales corteses', pl: 'Uprzejme formy czasownika', 'pt-BR': 'Formas verbais polidas',
  }),
  'n5-request': copy('Requests and wishes', '请求与愿望', '요청과 희망', {
    fr: 'Demandes et souhaits', it: 'Richieste e desideri', de: 'Bitten und Wünsche',
    'es-ES': 'Peticiones y deseos', pl: 'Prośby i pragnienia', 'pt-BR': 'Pedidos e desejos',
  }),
  'n4-experience': copy('Simultaneous actions and experience', '同时动作与经验', '동시 동작과 경험', {
    fr: 'Actions simultanées et expérience', it: 'Azioni simultanee ed esperienza', de: 'Gleichzeitige Handlungen und Erfahrung',
    'es-ES': 'Acciones simultáneas y experiencia', pl: 'Jednoczesne czynności i doświadczenie', 'pt-BR': 'Ações simultâneas e experiência',
  }),
  'n4-duty': copy('Intention and obligation', '意图与义务', '의도와 의무', {
    fr: 'Intention et obligation', it: 'Intenzione e obbligo', de: 'Absicht und Verpflichtung',
    'es-ES': 'Intención y obligación', pl: 'Zamiar i obowiązek', 'pt-BR': 'Intenção e obrigação',
  }),
  'n4-permission': copy('Permission and prohibition', '许可与禁止', '허가와 금지', {
    fr: 'Permission et interdiction', it: 'Permesso e divieto', de: 'Erlaubnis und Verbot',
    'es-ES': 'Permiso y prohibición', pl: 'Pozwolenie i zakaz', 'pt-BR': 'Permissão e proibição',
  }),
  'n4-comparison': copy('Appearance, degree, and comparison', '样态、程度与比较', '양태·정도·비교', {
    fr: 'Apparence, degré et comparaison', it: 'Aspetto, grado e confronto', de: 'Erscheinung, Grad und Vergleich',
    'es-ES': 'Apariencia, grado y comparación', pl: 'Wygląd, stopień i porównanie', 'pt-BR': 'Aparência, grau e comparação',
  }),
  'n4-condition': copy('Reasons, contrast, and conditions', '原因、转折与条件', '이유·대조·조건', {
    fr: 'Raisons, contraste et conditions', it: 'Ragioni, contrasto e condizioni', de: 'Gründe, Kontrast und Bedingungen',
    'es-ES': 'Razones, contraste y condiciones', pl: 'Powody, kontrast i warunki', 'pt-BR': 'Razões, contraste e condições',
  }),
  'n3-decision': copy('Habits and personal decisions', '习惯与个人决定', '습관과 개인 결정', {
    fr: 'Habitudes et décisions personnelles', it: 'Abitudini e decisioni personali', de: 'Gewohnheiten und persönliche Entscheidungen',
    'es-ES': 'Hábitos y decisiones personales', pl: 'Nawyki i osobiste decyzje', 'pt-BR': 'Hábitos e decisões pessoais',
  }),
  'n3-outcome': copy('Arrangements and completed outcomes', '安排与完成结果', '결정된 사항과 완료 결과', {
    fr: 'Dispositions et résultats achevés', it: 'Accordi e risultati compiuti', de: 'Regelungen und abgeschlossene Ergebnisse',
    'es-ES': 'Acuerdos y resultados completados', pl: 'Ustalenia i zakończone wyniki', 'pt-BR': 'Acordos e resultados concluídos',
  }),
  'n3-aspect': copy('Timing and aspect', '时点与体貌', '시점과 상', {
    fr: 'Moment et aspect', it: 'Tempo e aspetto', de: 'Zeitpunkt und Aspekt',
    'es-ES': 'Momento y aspecto', pl: 'Czas i aspekt', 'pt-BR': 'Momento e aspecto',
  }),
  'n3-inference': copy('Inference and expectation', '推测与预期', '추론과 예상', {
    fr: 'Déduction et attente', it: 'Inferenza e aspettativa', de: 'Schlussfolgerung und Erwartung',
    'es-ES': 'Inferencia y expectativa', pl: 'Wnioskowanie i oczekiwanie', 'pt-BR': 'Inferência e expectativa',
  }),
  'n3-purpose': copy('Purpose, means, and concession', '目的、手段与让步', '목적·수단·양보', {
    fr: 'But, moyen et concession', it: 'Scopo, mezzo e concessione', de: 'Zweck, Mittel und Einräumung',
    'es-ES': 'Finalidad, medio y concesión', pl: 'Cel, środek i ustępstwo', 'pt-BR': 'Finalidade, meio e concessão',
  }),
  'n2-certainty': copy('Partial negation and strong certainty', '部分否定与强烈确信', '부분 부정과 강한 확신', {
    fr: 'Négation partielle et forte certitude', it: 'Negazione parziale e forte certezza', de: 'Teilweise Verneinung und starke Gewissheit',
    'es-ES': 'Negación parcial y fuerte certeza', pl: 'Częściowe przeczenie i silna pewność', 'pt-BR': 'Negação parcial e forte certeza',
  }),
  'n2-target': copy('Basis, target, and topic', '依据、对象与主题', '근거·대상·주제', {
    fr: 'Base, cible et sujet', it: 'Base, destinatario e tema', de: 'Grundlage, Ziel und Thema',
    'es-ES': 'Base, objetivo y tema', pl: 'Podstawa, cel i temat', 'pt-BR': 'Base, alvo e tema',
  }),
  'n2-contrast': copy('Addition and contrast', '追加与对照', '추가와 대조', {
    fr: 'Addition et contraste', it: 'Aggiunta e contrasto', de: 'Ergänzung und Kontrast',
    'es-ES': 'Adición y contraste', pl: 'Dodawanie i kontrast', 'pt-BR': 'Adição e contraste',
  }),
  'n2-necessity': copy('Extension and unavoidable action', '递进与不得已行为', '확장과 불가피한 행동', {
    fr: 'Extension et action inévitable', it: 'Estensione e azione inevitabile', de: 'Erweiterung und unvermeidbare Handlung',
    'es-ES': 'Extensión y acción inevitable', pl: 'Rozszerzenie i nieuniknione działanie', 'pt-BR': 'Extensão e ação inevitável',
  }),
  'n2-evidence': copy('Risk and evidence-based judgment', '风险与基于证据的判断', '위험과 근거에 따른 판단', {
    fr: 'Risque et jugement fondé sur des preuves', it: 'Rischio e giudizio basato su prove', de: 'Risiko und evidenzbasiertes Urteil',
    'es-ES': 'Riesgo y juicio basado en pruebas', pl: 'Ryzyko i ocena oparta na dowodach', 'pt-BR': 'Risco e julgamento baseado em evidências',
  }),
  'n1-effect': copy('Extent and inevitable effect', '范围与必然作用', '범위와 필연적 영향', {
    fr: 'Étendue et effet inévitable', it: 'Estensione ed effetto inevitabile', de: 'Umfang und unvermeidliche Wirkung',
    'es-ES': 'Alcance y efecto inevitable', pl: 'Zakres i nieunikniony skutek', 'pt-BR': 'Alcance e efeito inevitável',
  }),
  'n1-duty': copy('Unavoidable duty and purpose', '不可回避的责任与目的', '피할 수 없는 의무와 목적', {
    fr: 'Devoir inévitable et objectif', it: 'Dovere inevitabile e scopo', de: 'Unvermeidbare Pflicht und Zweck',
    'es-ES': 'Deber inevitable y propósito', pl: 'Nieunikniony obowiązek i cel', 'pt-BR': 'Dever inevitável e propósito',
  }),
  'n1-concession': copy('Concession and starting point', '让步与起始点', '양보와 출발점', {
    fr: 'Concession et point de départ', it: 'Concessione e punto di partenza', de: 'Einräumung und Ausgangspunkt',
    'es-ES': 'Concesión y punto de partida', pl: 'Ustępstwo i punkt wyjścia', 'pt-BR': 'Concessão e ponto de partida',
  }),
  'n1-uniqueness': copy('Uniqueness and obviousness', '独有性与不言自明', '고유성과 자명함', {
    fr: 'Unicité et évidence', it: 'Unicità ed evidenza', de: 'Einzigartigkeit und Offensichtlichkeit',
    'es-ES': 'Singularidad y evidencia', pl: 'Wyjątkowość i oczywistość', 'pt-BR': 'Singularidade e evidência',
  }),
  'n1-circumstance': copy('Special circumstances, purpose, and minimum scope', '特殊情境、目的与最小范围', '특별 상황·목적·최소 범위', {
    fr: 'Circonstance spéciale, but et portée minimale', it: 'Circostanza speciale, scopo e ambito minimo', de: 'Besondere Umstände, Zweck und Mindestumfang',
    'es-ES': 'Circunstancia especial, propósito y alcance mínimo', pl: 'Szczególne okoliczności, cel i minimalny zakres', 'pt-BR': 'Circunstância especial, propósito e alcance mínimo',
  }),
};

const grammarTopics: Record<JlptLevel, LocalizedText> = {
  N5: levelTopic('N5 grammar', 'N5 基础文法', 'N5 기초 문법', 'Grammaire N5', 'Grammatica N5', 'N5-Grammatik', 'Gramática N5', 'Gramatyka N5', 'Gramática N5'),
  N4: levelTopic('N4 grammar', 'N4 日常文法', 'N4 일상 문법', 'Grammaire N4', 'Grammatica N4', 'N4-Grammatik', 'Gramática N4', 'Gramatyka N4', 'Gramática N4'),
  N3: levelTopic('N3 grammar', 'N3 会话文法', 'N3 회화 문법', 'Grammaire N3', 'Grammatica N3', 'N3-Grammatik', 'Gramática N3', 'Gramatyka N3', 'Gramática N3'),
  N2: levelTopic('N2 grammar', 'N2 进阶文法', 'N2 고급 문법', 'Grammaire N2', 'Grammatica N2', 'N2-Grammatik', 'Gramática N2', 'Gramatyka N2', 'Gramática N2'),
  N1: levelTopic('N1 grammar', 'N1 高阶文法', 'N1 최상급 문법', 'Grammaire N1', 'Grammatica N1', 'N1-Grammatik', 'Gramática N1', 'Gramatyka N1', 'Gramática N1'),
};

export const GRAMMAR_ITEMS: StudyItem[] = [
  grammar('topic-wa', 'N5', '私＿＿学生です。', '私は学生です。', 'は', ['は', 'を', 'に', 'で'], 'n5-topic'),
  grammar('addition-mo', 'N5', '妹＿＿学生です。', '妹も学生です。', 'も', ['も', 'へ', 'で', 'を'], 'n5-topic'),
  grammar('object-wo', 'N5', 'パン＿＿食べます。', 'パンを食べます。', 'を', ['を', 'が', 'に', 'から'], 'n5-case'),
  grammar('time-ni', 'N5', '七時＿＿起きます。', '七時に起きます。', 'に', ['に', 'で', 'を', 'へ'], 'n5-case'),
  grammar('place-de', 'N5', '図書館＿＿勉強します。', '図書館で勉強します。', 'で', ['で', 'に', 'を', 'の'], 'n5-case'),
  grammar('direction-e', 'N5', '日本＿＿行きます。', '日本へ行きます。', 'へ', ['へ', 'を', 'で', 'が'], 'n5-case'),
  grammar('possession-no', 'N5', 'これは先生＿＿本です。', 'これは先生の本です。', 'の', ['の', 'も', 'と', 'から'], 'n5-case'),
  grammar('start-kara', 'N5', '九時＿＿五時まで働きます。', '九時から五時まで働きます。', 'から', ['から', 'まで', 'より', 'ので'], 'n5-range'),
  grammar('end-made', 'N5', '九時から五時＿＿働きます。', '九時から五時まで働きます。', 'まで', ['まで', 'から', 'だけ', 'しか'], 'n5-range'),
  grammar('negative-masen', 'N5', 'コーヒーを飲み＿＿。', 'コーヒーを飲みません。', 'ません', ['ません', 'ました', 'ましょう', 'たいです'], 'n5-polite'),
  grammar('desire-tai', 'N5', '日本へ行き＿＿。', '日本へ行きたいです。', 'たいです', ['たいです', 'ません', 'ました', 'ています'], 'n5-request'),
  grammar('request-te-kudasai', 'N5', '名前を書い＿＿。', '名前を書いてください。', 'てください', ['てください', 'ています', 'てもいい', 'てから'], 'n5-request'),
  grammar('question-ka', 'N5', 'これは何です＿＿。', 'これは何ですか。', 'か', ['か', 'を', 'に', 'で'], 'n5-topic'),
  grammar('subject-ga', 'N5', '教室に学生＿＿います。', '教室に学生がいます。', 'が', ['が', 'を', 'へ', 'で'], 'n5-case'),
  grammar('companion-to', 'N5', '友達＿＿映画を見ます。', '友達と映画を見ます。', 'と', ['と', 'を', 'へ', 'から'], 'n5-case'),
  grammar('means-de', 'N5', '箸＿＿ご飯を食べます。', '箸でご飯を食べます。', 'で', ['で', 'に', 'が', 'へ'], 'n5-case'),
  grammar('past-mashita', 'N5', '昨日、図書館へ行き＿＿。', '昨日、図書館へ行きました。', 'ました', ['ました', 'ません', 'ましょう', 'たいです'], 'n5-polite'),
  grammar('invitation-mashou', 'N5', '一緒に帰り＿＿。', '一緒に帰りましょう。', 'ましょう', ['ましょう', 'ません', 'ました', 'ています'], 'n5-request'),
  grammar('progressive-teimasu', 'N5', '今、日本語を勉強し＿＿。', '今、日本語を勉強しています。', 'ています', ['ています', 'てください', 'てもいいです', 'てから'], 'n5-polite'),
  grammar('existence-ga', 'N5', '机の上に本＿＿あります。', '机の上に本があります。', 'が', ['が', 'を', 'で', 'へ'], 'n5-case'),

  grammar('simultaneous-nagara', 'N4', '音楽を聞き＿＿勉強します。', '音楽を聞きながら勉強します。', 'ながら', ['ながら', 'まで', 'だけ', 'そう'], 'n4-experience'),
  grammar('experience-koto-ga-aru', 'N4', '日本へ行った＿＿。', '日本へ行ったことがあります。', 'ことがあります', ['ことがあります', 'つもりです', 'そうです', 'ほうがいいです'], 'n4-experience'),
  grammar('intention-tsumori', 'N4', '来年、日本で働く＿＿。', '来年、日本で働くつもりです。', 'つもりです', ['つもりです', 'ことがあります', 'ところです', 'そうでした'], 'n4-duty'),
  grammar('obligation-nakereba', 'N4', '明日までに出さ＿＿。', '明日までに出さなければなりません。', 'なければなりません', ['なければなりません', 'なくてもいいです', 'ないほうがいいです', 'ないでください'], 'n4-duty'),
  grammar('permission-temo-ii', 'N4', 'ここで写真を撮っ＿＿。', 'ここで写真を撮ってもいいです。', 'てもいいです', ['てもいいです', 'てはいけません', 'てしまいました', 'ているそうです'], 'n4-permission'),
  grammar('prohibition-tewa-ikenai', 'N4', 'この部屋に入っ＿＿。', 'この部屋に入ってはいけません。', 'てはいけません', ['てはいけません', 'てもいいです', 'てみます', 'てあります'], 'n4-permission'),
  grammar('appearance-sou', 'N4', 'このケーキはおいし＿＿。', 'このケーキはおいしそうです。', 'そうです', ['そうです', 'すぎます', 'らしいです', 'はずです'], 'n4-comparison'),
  grammar('excess-sugite', 'N4', '食べ＿＿、動けません。', '食べすぎて、動けません。', 'すぎて', ['すぎて', 'ながら', 'やすくて', 'そうで'], 'n4-comparison'),
  grammar('comparison-yori', 'N4', '電車＿＿バスのほうが安いです。', '電車よりバスのほうが安いです。', 'より', ['より', 'ほど', 'しか', 'まで'], 'n4-comparison'),
  grammar('reason-node', 'N4', '雨が降っている＿＿、家にいます。', '雨が降っているので、家にいます。', 'ので', ['ので', 'のに', 'なら', 'ても'], 'n4-condition'),
  grammar('contrast-noni', 'N4', '勉強した＿＿、試験に落ちました。', '勉強したのに、試験に落ちました。', 'のに', ['のに', 'ので', 'なら', 'から'], 'n4-condition'),
  grammar('condition-nara', 'N4', '時間がない＿＿、タクシーで行きましょう。', '時間がないなら、タクシーで行きましょう。', 'なら', ['なら', 'ので', 'のに', 'まで'], 'n4-condition'),
  grammar('try-te-miru', 'N4', 'この料理を食べ＿＿。', 'この料理を食べてみます。', 'てみます', ['てみます', 'てあります', 'ておきます', 'ています'], 'n4-experience'),
  grammar('prepare-te-oku', 'N4', '旅行の前にホテルを予約し＿＿。', '旅行の前にホテルを予約しておきます。', 'ておきます', ['ておきます', 'てみます', 'てあります', 'てしまいます'], 'n4-duty'),
  grammar('result-state-te-aru', 'N4', '壁に写真が貼っ＿＿。', '壁に写真が貼ってあります。', 'てあります', ['てあります', 'てみます', 'ておきます', 'ています'], 'n4-experience'),
  grammar('easy-yasui', 'N4', 'このペンは書き＿＿。', 'このペンは書きやすいです。', 'やすいです', ['やすいです', 'にくいです', 'すぎます', 'そうです'], 'n4-comparison'),
  grammar('difficult-nikui', 'N4', 'この漢字は覚え＿＿。', 'この漢字は覚えにくいです。', 'にくいです', ['にくいです', 'やすいです', 'すぎます', 'そうです'], 'n4-comparison'),
  grammar('condition-tara', 'N4', '駅に着い＿＿、電話してください。', '駅に着いたら、電話してください。', 'たら', ['たら', 'ても', 'ので', 'のに'], 'n4-condition'),
  grammar('condition-ba', 'N4', '時間があれ＿＿、手伝います。', '時間があれば、手伝います。', 'ば', ['ば', 'ても', 'ので', 'のに'], 'n4-condition'),
  grammar('listing-shi', 'N4', 'この町は静かだ＿＿、便利です。', 'この町は静かだし、便利です。', 'し', ['し', 'ので', 'のに', 'なら'], 'n4-condition'),

  grammar('habit-you-ni-suru', 'N3', '毎日、日記を書く＿＿。', '毎日、日記を書くようにしています。', 'ようにしています', ['ようにしています', 'ことにしました', 'ところでした', 'わけがあります'], 'n3-decision'),
  grammar('decision-koto-ni-suru', 'N3', '今日は早く寝る＿＿。', '今日は早く寝ることにしました。', 'ことにしました', ['ことにしました', 'ようになりました', 'はずでした', 'らしいです'], 'n3-decision'),
  grammar('arrangement-koto-ni-naru', 'N3', '校則が変わり、来月から制服を着る＿＿。', '校則が変わり、来月から制服を着ることになりました。', 'ことになりました', ['ことになりました', 'ことにしました', 'ようにしました', '必要がなくなりました'], 'n3-outcome'),
  grammar('regret-te-shimau', 'N3', '宿題を忘れ＿＿。', '宿題を忘れてしまいました。', 'てしまいました', ['てしまいました', 'てみました', 'てありました', 'ておきました'], 'n3-outcome'),
  grammar('just-did-bakari', 'N3', 'さっき昼ご飯を食べた＿＿です。', 'さっき昼ご飯を食べたばかりです。', 'ばかり', ['ばかり', 'ところ', 'はず', 'わけ'], 'n3-aspect'),
  grammar('about-to-tokoro', 'N3', '今、出かける＿＿です。', '今、出かけるところです。', 'ところ', ['ところ', 'ばかり', 'ため', 'つもり'], 'n3-aspect'),
  grammar('hearsay-rashii', 'N3', '彼は来月結婚する＿＿です。', '彼は来月結婚するらしいです。', 'らしい', ['らしい', 'はず', 'わけ', 'ため'], 'n3-inference'),
  grammar('expectation-hazu', 'N3', '電車はもう着く＿＿です。', '電車はもう着くはずです。', 'はず', ['はず', 'らしい', 'ばかり', 'ところ'], 'n3-inference'),
  grammar('reason-wake', 'N3', '彼が怒った＿＿が分かりません。', '彼が怒ったわけが分かりません。', 'わけ', ['わけ', 'はず', 'ため', 'ところ'], 'n3-inference'),
  grammar('purpose-tame-ni', 'N3', '日本で働く＿＿、日本語を勉強しています。', '日本で働くために、日本語を勉強しています。', 'ために', ['ために', 'によって', 'について', 'として'], 'n3-purpose'),
  grammar('means-ni-yotte', 'N3', 'この町は観光＿＿発展しました。', 'この町は観光によって発展しました。', 'によって', ['によって', 'について', 'に対して', 'として'], 'n3-purpose'),
  grammar('concession-temo', 'N3', '雨が降っ＿＿、試合は行われます。', '雨が降っても、試合は行われます。', 'ても', ['ても', 'ので', 'のに', 'なら'], 'n3-purpose'),
  grammar('thanks-okage-de', 'N3', '先生が助けてくれた＿＿、合格できました。', '先生が助けてくれたおかげで、合格できました。', 'おかげで', ['おかげで', 'せいで', 'うちに', 'たびに'], 'n3-outcome'),
  grammar('blame-sei-de', 'N3', '電車が遅れた＿＿、会議に遅刻しました。', '電車が遅れたせいで、会議に遅刻しました。', 'せいで', ['せいで', 'おかげで', 'ために', 'うちに'], 'n3-outcome'),
  grammar('while-uchi-ni', 'N3', '温かい＿＿、食べてください。', '温かいうちに、食べてください。', 'うちに', ['うちに', 'たびに', 'ところに', 'ばかりに'], 'n3-aspect'),
  grammar('whenever-tabi-ni', 'N3', 'この歌を聞く＿＿、故郷を思い出します。', 'この歌を聞くたびに、故郷を思い出します。', 'たびに', ['たびに', 'うちに', 'ところに', 'ばかりに'], 'n3-aspect'),
  grammar('middle-saichuu-ni', 'N3', '会議の＿＿、電話が鳴りました。', '会議の最中に、電話が鳴りました。', '最中に', ['最中に', 'うちに', 'たびに', 'ために'], 'n3-aspect'),
  grammar('according-ni-yoru-to', 'N3', '天気予報＿＿、明日は雪です。', '天気予報によると、明日は雪です。', 'によると', ['によると', 'によって', 'について', 'に対して'], 'n3-inference'),
  grammar('attempt-you-to-suru', 'N3', '子どもが道路を渡ろう＿＿。', '子どもが道路を渡ろうとしています。', 'としています', ['としています', 'にしています', 'としてあります', 'となっています'], 'n3-decision'),
  grammar('no-need-koto-wa-nai', 'N3', 'まだ時間があるので、急ぐ＿＿。', 'まだ時間があるので、急ぐことはありません。', 'ことはありません', ['ことはありません', 'はずがありません', 'わけがありません', 'ところではありません'], 'n3-inference'),

  grammar('partial-negation-wake-dewa-nai', 'N2', '全員が賛成した＿＿。', '全員が賛成したわけではありません。', 'わけではありません', ['わけではありません', 'に違いありません', 'ことがあります', 'はずがありません'], 'n2-certainty'),
  grammar('certainty-ni-chigai-nai', 'N2', '電気がついています。誰かいる＿＿。', '電気がついています。誰かいるに違いありません。', 'に違いありません', ['に違いありません', 'わけではありません', 'ことになりません', 'ものではありません'], 'n2-certainty'),
  grammar('basis-koto-kara', 'N2', '空が急に暗くなった＿＿、嵐が近いと判断しました。', '空が急に暗くなったことから、嵐が近いと判断しました。', 'ことから', ['ことから', 'ものの', 'ばかりか', 'に対して'], 'n2-target'),
  grammar('target-ni-taishite', 'N2', '先生は学生＿＿公平です。', '先生は学生に対して公平です。', 'に対して', ['に対して', 'に関して', 'に加えて', 'に基づいて'], 'n2-target'),
  grammar('topic-ni-kanshite', 'N2', '環境問題＿＿話し合いました。', '環境問題に関して話し合いました。', 'に関して', ['に関して', 'に対して', 'に加えて', 'によって'], 'n2-target'),
  grammar('addition-ni-kuwaete', 'N2', '経験＿＿、冷静さも必要です。', '経験に加えて、冷静さも必要です。', 'に加えて', ['に加えて', 'に対して', 'に関して', 'に基づいて'], 'n2-contrast'),
  grammar('concession-monono', 'N2', '毎日練習した＿＿、本番ではうまく話せませんでした。', '毎日練習したものの、本番ではうまく話せませんでした。', 'ものの', ['ものの', 'ことから', 'ばかりか', 'おかげで'], 'n2-contrast'),
  grammar('two-sides-ippou-de', 'N2', '都会は便利な＿＿、生活費が高いです。', '都会は便利な一方で、生活費が高いです。', '一方で', ['一方で', 'ことから', 'ばかりか', 'に加えて'], 'n2-contrast'),
  grammar('not-only-bakari-ka', 'N2', '彼は英語＿＿、中国語も話せます。', '彼は英語ばかりか、中国語も話せます。', 'ばかりか', ['ばかりか', 'ものの', '一方で', 'ことから'], 'n2-necessity'),
  grammar('unavoidable-zaru-wo-enai', 'N2', '電車が止まり、ほかに交通手段もなかったので、＿＿。', '電車が止まり、ほかに交通手段もなかったので、歩かざるを得ませんでした。', '歩かざるを得ませんでした', ['歩かざるを得ませんでした', '歩かずにすみました', '歩く必要はありませんでした', '歩くことはありませんでした'], 'n2-necessity'),
  grammar('risk-kanenai', 'N2', 'このまま放置すれば、事故になり＿＿。', 'このまま放置すれば、事故になりかねません。', 'かねません', ['かねません', 'ざるを得ません', 'に違いません', 'わけではありません'], 'n2-evidence'),
  grammar('basis-ni-motozuite', 'N2', '調査結果＿＿、計画を変更しました。', '調査結果に基づいて、計画を変更しました。', 'に基づいて', ['に基づいて', 'に関して', 'に対して', 'に加えて'], 'n2-evidence'),
  grammar('far-from-dokoro-ka', 'N2', '彼は謝る＿＿、責任を否定しました。', '彼は謝るどころか、責任を否定しました。', 'どころか', ['どころか', 'ものの', 'ばかりか', 'ことから'], 'n2-contrast'),
  grammar('not-limited-ni-kagirazu', 'N2', 'この店は週末＿＿、平日も混んでいます。', 'この店は週末に限らず、平日も混んでいます。', 'に限らず', ['に限らず', 'に対して', 'に加えて', 'に関して'], 'n2-target'),
  grammar('according-ni-oujite', 'N2', '能力＿＿、仕事を任せます。', '能力に応じて、仕事を任せます。', 'に応じて', ['に応じて', 'に基づいて', 'に対して', 'に加えて'], 'n2-target'),
  grammar('along-with-ni-tomonatte', 'N2', '人口の増加＿＿、住宅が不足しています。', '人口の増加に伴って、住宅が不足しています。', 'に伴って', ['に伴って', 'に応じて', 'に対して', 'に限らず'], 'n2-necessity'),
  grammar('after-uede', 'N2', '内容を確認した＿＿、署名してください。', '内容を確認した上で、署名してください。', '上で', ['上で', '末に', 'あげく', '一方で'], 'n2-evidence'),
  grammar('after-long-sue-ni', 'N2', '何度も話し合った＿＿、計画を変更しました。', '何度も話し合った末に、計画を変更しました。', '末に', ['末に', '上で', 'あげく', '一方で'], 'n2-evidence'),
  grammar('after-all-ageku', 'N2', '長い間迷った＿＿、何も買いませんでした。', '長い間迷ったあげく、何も買いませんでした。', 'あげく', ['あげく', '末に', '上で', '一方で'], 'n2-evidence'),
  grammar('cannot-kaneru', 'N2', 'そのご依頼はお受けし＿＿。', 'そのご依頼はお受けしかねます。', 'かねます', ['かねます', 'かねません', 'ざるを得ません', 'に違いありません'], 'n2-necessity'),

  grammar('extent-ni-itaru-made', 'N1', '社長から新入社員＿＿、全員が参加しました。', '社長から新入社員に至るまで、全員が参加しました。', 'に至るまで', ['に至るまで', 'を皮切りに', 'ならでは', 'とあって'], 'n1-effect'),
  grammar('inevitable-effect-zuniwa-okanai', 'N1', 'この映画は観客を感動させ＿＿。', 'この映画は観客を感動させずにはおきません。', 'ずにはおきません', ['ずにはおきません', 'ないではすみません', 'ものを', 'たりとも'], 'n1-effect'),
  grammar('duty-naidewa-sumanai', 'N1', 'ミスを隠した以上、＿＿。', 'ミスを隠した以上、謝らないではすみません。', '謝らないではすみません', ['謝らないではすみません', '謝ったことはありません', '謝るつもりはありません', '謝らなくてもかまいません'], 'n1-duty'),
  grammar('purpose-n-ga-tame', 'N1', '夢を実現せ＿＿、彼は故郷を出ました。', '夢を実現せんがため、彼は故郷を出ました。', 'んがため', ['んがため', 'とはいえ', 'とあって', 'ものを'], 'n1-duty'),
  grammar('concession-to-wa-ie', 'N1', '春になった＿＿、朝はまだ寒いです。', '春になったとはいえ、朝はまだ寒いです。', 'とはいえ', ['とはいえ', 'とあって', 'ものを', 'ならでは'], 'n1-concession'),
  grammar('starting-wo-kawagiri-ni', 'N1', '東京公演＿＿、全国ツアーが始まりました。', '東京公演を皮切りに、全国ツアーが始まりました。', 'を皮切りに', ['を皮切りに', 'に至るまで', 'ならでは', 'とあって'], 'n1-concession'),
  grammar('unique-nara-dewa', 'N1', 'この味は老舗＿＿のものです。', 'この味は老舗ならではのものです。', 'ならでは', ['ならでは', 'までもなく', 'たりとも', 'ものを'], 'n1-uniqueness'),
  grammar('obvious-mademo-naku', 'N1', '結果は言う＿＿、明らかです。', '結果は言うまでもなく、明らかです。', 'までもなく', ['までもなく', 'ならでは', 'とあって', 'べく'], 'n1-uniqueness'),
  grammar('circumstance-to-atte', 'N1', '人気俳優が来る＿＿、会場は満員です。', '人気俳優が来るとあって、会場は満員です。', 'とあって', ['とあって', 'とはいえ', 'ものを', 'べく'], 'n1-circumstance'),
  grammar('purpose-beku', 'N1', '国際会議に出席す＿＿、資料を準備しました。', '国際会議に出席すべく、資料を準備しました。', 'べく', ['べく', 'ものを', 'たりとも', 'ならでは'], 'n1-circumstance'),
  grammar('regret-monowo', 'N1', '早く相談してくれれば助けられた＿＿。', '早く相談してくれれば助けられたものを。', 'ものを', ['ものを', 'とはいえ', 'とあって', 'までもなく'], 'n1-concession'),
  grammar('minimum-taridomo', 'N1', '一秒＿＿、気を抜けません。', '一秒たりとも、気を抜けません。', 'たりとも', ['たりとも', 'ならでは', 'を皮切りに', 'に至るまで'], 'n1-circumstance'),
  grammar('depending-ikan-de', 'N1', '試験の結果＿＿、進路を決めます。', '試験の結果いかんで、進路を決めます。', 'いかんで', ['いかんで', 'をものともせず', 'にひきかえ', 'が早いか'], 'n1-effect'),
  grammar('despite-wo-mono-to-mo-sezu', 'N1', '彼は周囲の反対＿＿、計画を実行しました。', '彼は周囲の反対をものともせず、計画を実行しました。', 'をものともせず', ['をものともせず', 'にひきかえ', 'が早いか', 'そばから'], 'n1-concession'),
  grammar('covered-mamire', 'N1', '泥＿＿になって働きました。', '泥まみれになって働きました。', 'まみれ', ['まみれ', 'ずくめ', 'が早いか', 'かたわら'], 'n1-circumstance'),
  grammar('all-zukume', 'N1', '今年はうれしいこと＿＿でした。', '今年はうれしいことずくめでした。', 'ずくめ', ['ずくめ', 'まみれ', 'そばから', 'にひきかえ'], 'n1-circumstance'),
  grammar('as-soon-as-ga-hayai-ka', 'N1', 'ベルが鳴る＿＿、学生は教室を飛び出しました。', 'ベルが鳴るが早いか、学生は教室を飛び出しました。', 'が早いか', ['が早いか', 'そばから', 'かたわら', 'にひきかえ'], 'n1-circumstance'),
  grammar('even-as-soba-kara', 'N1', '片づける＿＿、子どもがおもちゃを散らかします。', '片づけるそばから、子どもがおもちゃを散らかします。', 'そばから', ['そばから', 'が早いか', 'かたわら', 'にひきかえ'], 'n1-circumstance'),
  grammar('alongside-katawara', 'N1', '彼女は会社で働く＿＿、小説を書いています。', '彼女は会社で働くかたわら、小説を書いています。', 'かたわら', ['かたわら', 'そばから', 'が早いか', 'にひきかえ'], 'n1-circumstance'),
  grammar('contrast-ni-hikikae', 'N1', '兄は社交的なの＿＿、弟は無口です。', '兄は社交的なのにひきかえ、弟は無口です。', 'にひきかえ', ['にひきかえ', 'をものともせず', 'そばから', 'かたわら'], 'n1-effect'),
];

function grammar(
  id: string,
  level: JlptLevel,
  prompt: string,
  completedSentence: string,
  answer: string,
  options: string[],
  concept: GrammarConcept,
): StudyItem {
  return {
    id: `grammar-${id}`,
    kind: 'grammar',
    level,
    display: prompt,
    kana: completedSentence,
    romaji: answer,
    meaning: concepts[concept],
    topic: grammarTopics[level],
    grammar: {
      answer,
      completedSentence,
      options,
    },
  };
}

function copy(
  en: string,
  zhHans: string,
  ko: string,
  overrides: Partial<Record<AppLocale, string>>,
) {
  return makeText(en, zhHans, en, ko, overrides);
}

function levelTopic(
  en: string,
  zhHans: string,
  ko: string,
  fr: string,
  it: string,
  de: string,
  es: string,
  pl: string,
  ptBr: string,
) {
  return copy(en, zhHans, ko, { fr, it, de, 'es-ES': es, pl, 'pt-BR': ptBr });
}
