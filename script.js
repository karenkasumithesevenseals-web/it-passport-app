/**
 * ITパスポート模擬試験アプリの本体（画面の動きはすべてこのファイルに書いてある）
 *
 * ■ このファイルの読み方
 *   上から「決まった値（定数）→ 画面の部品 → アプリの状態 → 関数」の順に並んでいる。
 *   関数は「===== 番号. 見出し =====」の区切りごとに、役割でまとめてある。
 *   いちばん最後の init() がアプリの起動で、ボタンと関数をつないでいる。
 *   迷ったら init() から読むと、「どのボタンでどの関数が動くか」がわかる。
 *
 * ■ 画面の流れ
 *   開始画面 ─┬─ 新しい試験・お試し10問・今日の復習 → 試験画面 → 採点 → 結果画面
 *            ├─ 分野別の一問一答 → 1問ずつ正誤と解説
 *            ├─ 履歴を見る       → グラフと一覧（書き出し・読み込み）
 *            ├─ 苦手分析         → 合格の見込み・分野ごとの棒グラフ
 *            └─ 用語・計算式まとめ
 *
 * ■ データの保存場所（ブラウザの localStorage。端末の中に保存される）
 *   itPassportHistory          … 受験の履歴（HistoryEntry の配列）
 *   itPassportExamState        … 解いている途中の試験（ExamState）
 *   itPassportQuestionProgress … 同じ問題ばかり出ないようにするための記録
 *
 * ■ ほかのファイルから来るもの
 *   QUESTIONS（問題）、GLOSSARY（用語）、FORMULAS（計算式）は data フォルダの
 *   ファイルに書かれていて、index.html でこのファイルより先に読み込まれる。
 *
 * ■ コメントの記号の意味（JSDoc という書き方）
 *   @param   … 関数に渡すもの（引数）。{ } の中は種類（string=文字、number=数、boolean=true/false）
 *   @returns … 関数が返すもの（戻り値）
 *   ※ 時刻や時間は「ミリ秒」（1000分の1秒）で扱う。例: 60000 ミリ秒 = 1分
 */

/**
 * 問題1問分のデータ（data/questions-*.js に書かれている）
 * @typedef {Object} Question
 * @property {string} id - 問題ID（例: "R05_Q01"）
 * @property {string} category - 分野（"strategy"=ストラテジ系 / "management"=マネジメント系 / "technology"=テクノロジ系）
 * @property {string} text - 問題文
 * @property {string[]} choices - 選択肢（ふつうは4つ）
 * @property {number} answerIndex - 正解の選択肢の番号（0から数える。0が1つ目）
 * @property {string} explanation - 解説
 * @property {string[]} images - 問題の図の画像ファイル（図がなければ空）
 * @property {string} sourceUrl - 出典（IPA の公開問題）のURL
 */

/**
 * 履歴1回分（模試・復習・一問一答を1回やるごとに1件たまる）
 * @typedef {Object} HistoryEntry
 * @property {number} schemaVersion - データの形の版（今は 1）
 * @property {number} id - 履歴の番号（作った時刻のミリ秒）
 * @property {string} date - 日時（例: "2026-09-28T03:00:00.000Z"）
 * @property {string} mode - 種類（"normal"=模試 / "review"=復習 / "practice"=一問一答）
 * @property {string[]} questionIds - 出した問題IDの一覧
 * @property {Object<string, (number|null)>} answers - 問題ID → 選んだ選択肢の番号（未回答は null）
 * @property {number} totalQuestions - 問題数
 * @property {number} correctCount - 正解数
 * @property {number} percentageScore - 正答率（0〜100）
 * @property {Object} categoryBreakdown - 分野ごとの成績（buildScoreSummary() が作る形）
 * @property {number} overallScoreApprox - 推定スコア（1000点満点）
 * @property {boolean} autoSubmitted - 時間切れで自動的に採点したら true
 */

/**
 * 解いている途中の試験（途中で画面を閉じても続きから再開できるよう保存する）
 * @typedef {Object} ExamState
 * @property {string} mode - "normal"=模試 / "review"=復習
 * @property {number} startTime - 始めた時刻（ミリ秒）
 * @property {number} timeLimitMs - 制限時間（ミリ秒）
 * @property {string[]} questionIds - 出す問題IDの順番
 * @property {Object<string, (number|null)>} answers - 問題ID → 選んだ選択肢の番号（未回答は null）
 * @property {number} currentIndex - いま表示している問題が何問目か（0から数える）
 */

// ----- 決まった値（定数）-----
// 大文字の名前は、アプリの中で変わらない値。数字を変えたいときはここを直せばよい。
const QUESTION_PROGRESS_STORAGE_KEY = "itPassportQuestionProgress";
const EXAM_STATE_STORAGE_KEY = "itPassportExamState";
const HISTORY_STORAGE_KEY = "itPassportHistory";
const HISTORY_EXPORT_FORMAT = "it-passport-history";

// 3つの分野。ratio は本番100問の中での割合（ストラテジ35%・マネジメント20%・テクノロジ45%）
const CATEGORIES = [
  { code: "strategy", label: "ストラテジ系", ratio: 0.35 },
  { code: "management", label: "マネジメント系", ratio: 0.20 },
  { code: "technology", label: "テクノロジ系", ratio: 0.45 }
];
// 分野コードや問題IDから、すぐに中身を引けるようにした早見表（Map）
const CATEGORY_BY_CODE = new Map(CATEGORIES.map((cat) => [cat.code, cat]));
const QUESTIONS_BY_ID = new Map(QUESTIONS.map((q) => [q.id, q]));

// 試験の設定: 本番の問題数(100問)・お試しの問題数(10問)・本番の制限時間(120分)・いちばん短い制限時間(5分)
// SCORE_SCALE_MAX は推定スコアの満点(1000点)、PASSING_PERCENTAGE はグラフに引く合格目安の線(60%)
const EXAM_QUESTION_COUNT = 100;
const QUICK_EXAM_QUESTION_COUNT = 10;
const EXAM_TIME_LIMIT_MINUTES = 120;
const MIN_EXAM_TIME_LIMIT_MINUTES = 5;
const SCORE_SCALE_MAX = 1000;
const PASSING_PERCENTAGE = 60;
// 本番の合格基準: 総合600点以上 かつ 3分野それぞれ300点以上(いずれも1000点満点)
const PASSING_TOTAL_SCORE = 600;
const PASSING_CATEGORY_SCORE = 300;
// 履歴の種類の名前(normal=模試 / review=復習 / practice=一問一答)と、グラフに描く最大の回数
const EXAM_MODE_NORMAL = "normal";
const EXAM_MODE_REVIEW = "review";
const EXAM_MODE_PRACTICE = "practice";
const HISTORY_CHART_MAX_POINTS = 20;
// 苦手分析の「合格の見込み」で合わせる、直近の模試の回数
const ANALYSIS_RECENT_EXAM_COUNT = 3;
// 忘れたころにもう一度出す復習: 続けて1回・2回・3回正解した問題を、それぞれ何日後に再出題するか。
// この回数より多く続けて正解したら卒業(復習に出さない)
const REVIEW_INTERVAL_DAYS = [1, 3, 7];
const MS_PER_DAY = 24 * 60 * 60 * 1000;
// SVG_NS はグラフの図形を作るときに必要な決まり文句、TIMER_TICK_MS はタイマーの間隔(1000ミリ秒=1秒)、
// SCORE_DISCLAIMER_TEXT は結果画面に出す「推定スコアは公式ではない」という注意書き
const SVG_NS = "http://www.w3.org/2000/svg";
const TIMER_TICK_MS = 1000;
const SCORE_DISCLAIMER_TEXT = "この1000点満点スコアは正答率に基づく独自の簡易換算であり、IPAの公式スコア(項目反応理論に基づく)とは異なります。参考値としてご利用ください。";

// ----- 画面の部品 -----
// index.html にある部品（ボタンや文字を出す場所）を、id を目印に取り出しておく。
// 名前の最後が Btn はボタン、El は文字や中身を表示する場所、Input はファイルを選ぶ部品。
const resumeBannerEl = document.getElementById("resume-banner");
const startExamBtn = document.getElementById("start-exam-btn");
const startQuickExamBtn = document.getElementById("start-quick-exam-btn");
const resumeExamBtn = document.getElementById("resume-exam-btn");
const showHistoryBtn = document.getElementById("show-history-btn");
const startReviewBtn = document.getElementById("start-review-btn");

const practiceCategoryTagEl = document.getElementById("practice-category-tag");
const practiceScoreEl = document.getElementById("practice-score");
const practiceQuestionTextEl = document.getElementById("practice-question-text");
const practiceQuestionImagesEl = document.getElementById("practice-question-images");
const practiceChoicesEl = document.getElementById("practice-choices");
const practiceFeedbackEl = document.getElementById("practice-feedback");
const practiceExplanationEl = document.getElementById("practice-explanation");
const practiceEndBtn = document.getElementById("practice-end-btn");
const practiceNextBtn = document.getElementById("practice-next-btn");

const examCategoryTagEl = document.getElementById("exam-category-tag");
const examProgressEl = document.getElementById("exam-progress");
const examTimerEl = document.getElementById("exam-timer");
const examQuestionTextEl = document.getElementById("exam-question-text");
const examQuestionImagesEl = document.getElementById("exam-question-images");
const examChoicesEl = document.getElementById("exam-choices");
const examJumpGridEl = document.getElementById("exam-jump-grid");
const prevQuestionBtn = document.getElementById("prev-question-btn");
const nextQuestionBtn = document.getElementById("next-question-btn");
const submitExamBtn = document.getElementById("submit-exam-btn");

const resultsAutoBannerEl = document.getElementById("results-auto-banner");
const resultsHeadingEl = document.getElementById("results-heading");
const resultsPassBannerEl = document.getElementById("results-pass-banner");
const resultsOverallEl = document.getElementById("results-overall");
const resultsCategoryTableEl = document.getElementById("results-category-table");
const resultsDisclaimerEl = document.getElementById("results-disclaimer");
const resultsReviewEl = document.getElementById("results-review");
const resultsBackBtn = document.getElementById("results-back-btn");
const resultsBackBottomBtn = document.getElementById("results-back-bottom-btn");

const historyChartEl = document.getElementById("history-chart");
const historyTableEl = document.getElementById("history-table");
const historyBackBtn = document.getElementById("history-back-btn");
const historyClearBtn = document.getElementById("history-clear-btn");
const historyExportBtn = document.getElementById("history-export-btn");
const historyImportBtn = document.getElementById("history-import-btn");
const historyImportInput = document.getElementById("history-import-input");
const historyTransferMessageEl = document.getElementById("history-transfer-message");

const showAnalysisBtn = document.getElementById("show-analysis-btn");
const analysisContentEl = document.getElementById("analysis-content");
const analysisPracticeBtn = document.getElementById("analysis-practice-btn");
const analysisBackBtn = document.getElementById("analysis-back-btn");

const showGlossaryBtn = document.getElementById("show-glossary-btn");
const glossarySearchEl = document.getElementById("glossary-search");
const glossaryCountEl = document.getElementById("glossary-count");
const glossaryListEl = document.getElementById("glossary-list");
const glossaryBackBtn = document.getElementById("glossary-back-btn");

// ----- アプリの状態（動いている間に変わる値）-----
// examState       … 解いている途中の模試・復習（ExamState）。試験中でなければ null
// practiceState   … 一問一答の途中の状態。一問一答中でなければ null
// timerIntervalId … 1秒ごとに残り時間を更新するタイマーの番号（止めるときに使う）
let examState = null;
let practiceState = null;
// 用語・計算式まとめ画面の表示条件（タブ・分野・検索語）
const glossaryFilter = { tab: "terms", category: "all", keyword: "" };
let timerIntervalId = null;

// ============================================================
// 1. データの保存と読み込み（ブラウザの localStorage）
// ============================================================

/**
 * 出題の記録（同じ問題ばかり出ないようにするためのもの）を読み込む。
 * @returns {Object} 分野ごとの「まだ出していない問題」と「出した問題」の記録。
 *   保存がない・壊れているときは空 {}
 */
function loadQuestionProgress() {
  try {
    const raw = localStorage.getItem(QUESTION_PROGRESS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * 出題の記録を保存する。保存に失敗しても（容量不足など）アプリは止めない。
 * @param {Object} progress - 保存する記録（loadQuestionProgress() と同じ形）
 */
function saveQuestionProgress(progress) {
  try {
    localStorage.setItem(QUESTION_PROGRESS_STORAGE_KEY, JSON.stringify(progress));
  } catch {}
}

/**
 * 解いている途中の試験を読み込む。
 * @returns {ExamState|null} 途中の試験。なければ null
 */
function loadExamState() {
  try {
    const raw = localStorage.getItem(EXAM_STATE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * 解いている途中の試験を保存する（答えるたび・問題を移るたびに呼ぶ）。
 * @param {ExamState} state - 保存する試験の状態
 */
function saveExamState(state) {
  try {
    localStorage.setItem(EXAM_STATE_STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

/**
 * 途中の試験の保存を消す（採点が終わったときに呼ぶ）。
 */
function clearExamState() {
  try {
    localStorage.removeItem(EXAM_STATE_STORAGE_KEY);
  } catch {}
}

/**
 * 受験の履歴を読み込む。
 * @returns {HistoryEntry[]} 履歴の一覧（ふつうは古い順）。なければ空の配列 []
 */
function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * 受験の履歴を保存する（今ある履歴を丸ごと置き換える）。
 * @param {HistoryEntry[]} history - 保存する履歴の一覧
 */
function saveHistory(history) {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
  } catch {}
}

// ============================================================
// 2. 出題する問題を選ぶ
// ============================================================

/**
 * 配列の順番をランダムに並べ替える（トランプを切るイメージ）。
 * 渡した配列そのものを並べ替えて、同じ配列を返す。
 * @param {Array} arr - 並べ替えたい配列
 * @returns {Array} 並べ替えた配列（arr と同じもの）
 */
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * 出題の記録を、今ある問題データに合わせて整える。
 *  ・分野の記録がなければ作る
 *  ・新しく追加された問題を「まだ出していない」に入れる
 *  ・問題データから消えた問題は、記録からも外す
 * @param {Object} progress - 読み込んだ出題の記録（この中身を直接書き換える）
 * @returns {Object} 整えた記録（progress と同じもの）
 */
function ensureProgressInitialized(progress) {
  for (const cat of CATEGORIES) {
    if (!progress[cat.code]) {
      progress[cat.code] = { unseenIds: [], seenIds: [] };
    }
  }
  for (const cat of CATEGORIES) {
    const bag = progress[cat.code];
    const liveIds = QUESTIONS.filter((q) => q.category === cat.code).map((q) => q.id);
    const liveIdSet = new Set(liveIds);
    let added = false;
    for (const id of liveIds) {
      if (!bag.unseenIds.includes(id) && !bag.seenIds.includes(id)) {
        bag.unseenIds.push(id);
        added = true;
      }
    }
    bag.unseenIds = bag.unseenIds.filter((id) => liveIdSet.has(id));
    bag.seenIds = bag.seenIds.filter((id) => liveIdSet.has(id));
    if (added) {
      shuffleArray(bag.unseenIds);
    }
  }
  return progress;
}

/**
 * 1つの分野から、まだ出していない問題を優先して count 問取り出す。
 * 全部出し切ったら、出した問題を混ぜ直して2周目に入る（くじ引きの箱のイメージ）。
 * @param {Object} progress - 出題の記録（取り出した問題は「出した」側に移る）
 * @param {string} categoryCode - 分野（"strategy" など）
 * @param {number} count - 取り出す問題数
 * @returns {string[]} 取り出した問題IDの一覧
 */
function drawFromCategoryBag(progress, categoryCode, count) {
  const bag = progress[categoryCode];
  const result = [];
  for (let i = 0; i < count; i++) {
    if (bag.unseenIds.length === 0) {
      if (bag.seenIds.length === 0) break;
      bag.unseenIds = shuffleArray(bag.seenIds);
      bag.seenIds = [];
    }
    const id = bag.unseenIds.shift();
    bag.seenIds.push(id);
    result.push(id);
  }
  return result;
}

/**
 * 出題数を、本番の割合（CATEGORIES の ratio）に合わせて分野ごとに割り振る。
 * 例: 100問 → ストラテジ35問・マネジメント20問・テクノロジ45問
 *  ・割り切れない端数は、切り捨てた量が大きい分野から1問ずつ足す
 *  ・ある分野の問題が足りないときは、その分を余裕のある分野に回す
 * @param {number} totalDesired - 出したい合計の問題数
 * @param {Object<string, number>} poolSizes - 分野ごとに用意されている問題の数
 * @returns {Object<string, number>} 分野ごとの出題数（例: { strategy: 35, management: 20, technology: 45 }）
 */
function computeCategoryQuotas(totalDesired, poolSizes) {
  const ideal = {};
  const quota = {};
  for (const cat of CATEGORIES) {
    ideal[cat.code] = totalDesired * cat.ratio;
    quota[cat.code] = Math.floor(ideal[cat.code]);
  }
  const assigned = CATEGORIES.reduce((sum, cat) => sum + quota[cat.code], 0);
  const remainderSeats = totalDesired - assigned;
  const byFraction = [...CATEGORIES].sort(
    (a, b) => (ideal[b.code] - quota[b.code]) - (ideal[a.code] - quota[a.code])
  );
  for (let i = 0; i < remainderSeats; i++) {
    quota[byFraction[i % byFraction.length].code]++;
  }
  let overflow = 0;
  for (const cat of CATEGORIES) {
    if (quota[cat.code] > poolSizes[cat.code]) {
      overflow += quota[cat.code] - poolSizes[cat.code];
      quota[cat.code] = poolSizes[cat.code];
    }
  }
  for (let i = 0; i < overflow; i++) {
    let bestCode = null;
    let bestSpare = 0;
    for (const cat of CATEGORIES) {
      const spare = poolSizes[cat.code] - quota[cat.code];
      if (spare > bestSpare) {
        bestSpare = spare;
        bestCode = cat.code;
      }
    }
    if (!bestCode) break;
    quota[bestCode]++;
  }
  return quota;
}

/**
 * 模試に出す問題を選ぶ。分野の割合を本番に合わせ、同じ問題ばかり出ないようにし、
 * 最後に順番を混ぜる。
 * @param {number} desiredCount - 出したい問題数（100 または 10）
 * @returns {string[]} 問題IDの一覧（問題データが足りなければ、あるだけ）
 */
function drawQuestionsForExam(desiredCount) {
  const progress = ensureProgressInitialized(loadQuestionProgress());
  const poolSizes = {};
  for (const cat of CATEGORIES) {
    poolSizes[cat.code] = QUESTIONS.filter((q) => q.category === cat.code).length;
  }
  const totalPool = CATEGORIES.reduce((sum, cat) => sum + poolSizes[cat.code], 0);
  const totalDesired = Math.min(desiredCount, totalPool);
  const quota = computeCategoryQuotas(totalDesired, poolSizes);
  let ids = [];
  for (const cat of CATEGORIES) {
    ids = ids.concat(drawFromCategoryBag(progress, cat.code, quota[cat.code]));
  }
  shuffleArray(ids);
  saveQuestionProgress(progress);
  return ids;
}

// ============================================================
// 3. 履歴から成績を集める（今日の復習・苦手分析で使う）
// ============================================================

/**
 * 履歴が「復習」の回かどうかを調べる。
 * @param {HistoryEntry} entry - 調べる履歴
 * @returns {boolean} 復習なら true
 */
function isReviewEntry(entry) {
  return entry.mode === EXAM_MODE_REVIEW;
}

/**
 * 履歴が本番形式の模試（お試し10問も含む）かどうかを調べる。
 * mode がない古い履歴も模試として扱う。
 * @param {HistoryEntry} entry - 調べる履歴
 * @returns {boolean} 模試なら true
 */
function isMockExamEntry(entry) {
  return !entry.mode || entry.mode === EXAM_MODE_NORMAL;
}

/**
 * 履歴（模試・復習・一問一答）を古い順にたどり、問題ごとの成績を集める。
 * @returns {Object} 次の5つをまとめたもの
 *   first     … Map（問題ID → 最初に解いたとき正解したか）
 *   latest    … Map（問題ID → 最後に解いたとき正解したか）
 *   everWrong … Set（一度でも間違えた・未回答だった問題IDの集まり）
 *   streak    … Map（問題ID → 最後から数えて何回続けて正解したか）
 *                間違えると 0 に戻る。再出題の日より早い正解は数えない
 *   lastTime  … Map（問題ID → streak を最後に数えた日時。ミリ秒）
 */
function collectQuestionResults() {
  const history = loadHistory()
    .slice()
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  const first = new Map();
  const latest = new Map();
  const everWrong = new Set();
  const streak = new Map();
  const lastTime = new Map();
  history.forEach((entry) => {
    // 回答の記録がない履歴(読み込んだ古いデータなど)は飛ばす
    if (!Array.isArray(entry.questionIds) || !entry.answers || typeof entry.answers !== "object") return;
    const time = Date.parse(entry.date);
    entry.questionIds.forEach((id) => {
      const question = QUESTIONS_BY_ID.get(id);
      if (!question) return;
      const correct = entry.answers[id] === question.answerIndex;
      if (!first.has(id)) first.set(id, correct);
      latest.set(id, correct);
      if (!correct) everWrong.add(id);
      const count = streak.get(id) || 0;
      // 再出題の日より前に正解しても(一問一答でたまたま出たときなど)、続けて正解した回数には数えない
      const early = correct && count > 0 && count <= REVIEW_INTERVAL_DAYS.length
        && toLocalDayNumber(time) - toLocalDayNumber(lastTime.get(id)) < REVIEW_INTERVAL_DAYS[count - 1];
      if (!early) {
        streak.set(id, correct ? count + 1 : 0);
        lastTime.set(id, time);
      }
    });
  });
  return { first, latest, everWrong, streak, lastTime };
}

/**
 * 日時を「日付の通し番号」に変える。同じ日なら同じ番号、次の日なら +1 になる。
 * 「1日後」を24時間後ではなく、日付が変わった後として数えるために使う。
 * @param {number} time - 日時（ミリ秒）
 * @returns {number} 日付の通し番号
 */
function toLocalDayNumber(time) {
  const d = new Date(time);
  return Math.round(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / MS_PER_DAY);
}

/**
 * 「今日の復習」に出す問題を集める。対象は一度でも間違えた問題だけ。
 *  ・最後に間違えた            → すぐ出す
 *  ・続けて1回・2回・3回正解  → それぞれ1日後・3日後・7日後に出す
 *  ・続けて4回正解            → 卒業（もう出さない）
 * 日数は REVIEW_INTERVAL_DAYS で決めている。
 * @returns {string[]} 今日復習する問題IDの一覧
 */
function collectTodayReviewQuestionIds() {
  const { everWrong, streak, lastTime } = collectQuestionResults();
  const today = toLocalDayNumber(Date.now());
  return [...everWrong].filter((id) => {
    const count = streak.get(id);
    if (count === 0) return true;
    if (count > REVIEW_INTERVAL_DAYS.length) return false;
    return today - toLocalDayNumber(lastTime.get(id)) >= REVIEW_INTERVAL_DAYS[count - 1];
  });
}

// ============================================================
// 4. 模試・復習の試験を進める
// ============================================================

/**
 * 新しい模試を始める。
 * @param {number} desiredCount - 問題数（100=本番形式、10=お試し）
 */
function startNewExam(desiredCount) {
  startExam(drawQuestionsForExam(desiredCount), EXAM_MODE_NORMAL);
}

/**
 * 「今日の復習」を始める（最大100問、順番はランダム）。対象がなければ何もしない。
 */
function startReviewExam() {
  const questionIds = shuffleArray(collectTodayReviewQuestionIds()).slice(0, EXAM_QUESTION_COUNT);
  if (questionIds.length === 0) return;
  startExam(questionIds, EXAM_MODE_REVIEW);
}

/**
 * 試験を始める。制限時間は、本番（100問・120分）の割合で問題数に合わせて縮める（最短5分）。
 * @param {string[]} questionIds - 出す問題IDの一覧（この順番で出す）
 * @param {string} mode - 種類（"normal"=模試 / "review"=復習）
 */
function startExam(questionIds, mode) {
  const actualCount = questionIds.length;
  // 制限時間は本番(100問・120分)の比率に合わせて出題数に応じて比例縮小する
  const timeLimitMs = Math.max(
    MIN_EXAM_TIME_LIMIT_MINUTES,
    Math.round(EXAM_TIME_LIMIT_MINUTES * actualCount / EXAM_QUESTION_COUNT)
  ) * 60000;
  examState = {
    schemaVersion: 1,
    mode,
    startTime: Date.now(),
    timeLimitMs,
    questionIds,
    answers: Object.fromEntries(questionIds.map((id) => [id, null])),
    currentIndex: 0
  };
  saveExamState(examState);
  enterExamView();
}

/**
 * 保存しておいた途中の試験を再開する。
 */
function resumeExam() {
  examState = loadExamState();
  enterExamView();
}

/**
 * 試験画面を表示して、タイマーを動かし始める。
 */
function enterExamView() {
  showView("exam");
  startTimerLoop();
  renderExamView();
}

/**
 * 試験画面を離れるときに、タイマーを止める。
 */
function leaveExamView() {
  stopTimerLoop();
}

/**
 * 試験中に選択肢を選んだときの動き。回答を記録・保存して画面を描き直す。
 * @param {string} questionId - 答えた問題のID
 * @param {number} choiceIndex - 選んだ選択肢の番号（0から数える）
 */
function selectAnswer(questionId, choiceIndex) {
  examState.answers[questionId] = choiceIndex;
  saveExamState(examState);
  renderExamView();
}

/**
 * 指定した問題へ移動する（「前へ」「次へ」や問題番号のボタンから呼ばれる）。
 * @param {number} index - 何問目か（0から数える）
 */
function goToQuestion(index) {
  examState.currentIndex = index;
  saveExamState(examState);
  renderExamView();
}

/**
 * 試験を採点し、履歴に保存して結果画面を出す。途中の試験の保存は消す。
 * @param {boolean} auto - 時間切れで自動的に採点するときは true
 */
function submitExam(auto) {
  leaveExamView();
  const breakdown = gradeExam(examState);
  const historyEntry = {
    schemaVersion: 1,
    id: generateHistoryId(),
    date: new Date().toISOString(),
    // 以前に保存された途中の試験には mode がないので通常の模試として扱う
    mode: examState.mode || EXAM_MODE_NORMAL,
    questionIds: examState.questionIds,
    answers: examState.answers,
    totalQuestions: breakdown.totalQuestions,
    correctCount: breakdown.correctCount,
    percentageScore: breakdown.percentageScore,
    categoryBreakdown: breakdown.categoryBreakdown,
    overallScoreApprox: breakdown.overallScoreApprox,
    autoSubmitted: !!auto
  };
  const history = loadHistory();
  history.push(historyEntry);
  saveHistory(history);
  clearExamState();
  examState = null;
  renderResultsView(historyEntry, !!auto);
}

// ============================================================
// 5. 制限時間のタイマー
// ============================================================

/**
 * 残り時間を計算する。
 * @param {ExamState} state - 試験の状態
 * @returns {number} 残り時間（ミリ秒）。時間切れならマイナスになる
 */
function computeRemainingMs(state) {
  return state.startTime + state.timeLimitMs - Date.now();
}

/**
 * 時間切れかどうかを調べる。
 * @param {ExamState} state - 試験の状態
 * @returns {boolean} 時間切れなら true
 */
function isExamExpired(state) {
  return computeRemainingMs(state) <= 0;
}

/**
 * 1秒ごとに tick() を呼ぶタイマーを動かす（前のタイマーがあれば止めてから）。
 */
function startTimerLoop() {
  stopTimerLoop();
  timerIntervalId = setInterval(tick, TIMER_TICK_MS);
  tick();
}

/**
 * タイマーを止める。
 */
function stopTimerLoop() {
  if (timerIntervalId !== null) {
    clearInterval(timerIntervalId);
    timerIntervalId = null;
  }
}

/**
 * タイマーから1秒ごとに呼ばれる。残り時間を表示し、時間切れなら自動で採点する。
 */
function tick() {
  // setIntervalの間隔そのものはバックグラウンドタブで遅れることがあるが、
  // 毎回startTimeからの経過時間を計算し直すため残り時間はズレない
  const remaining = computeRemainingMs(examState);
  if (remaining <= 0) {
    renderTimer(0);
    submitExam(true);
    return;
  }
  renderTimer(remaining);
}

/**
 * 残り時間を画面に表示する。
 * @param {number} remainingMs - 残り時間（ミリ秒）
 */
function renderTimer(remainingMs) {
  examTimerEl.textContent = formatDuration(remainingMs);
}

/**
 * ミリ秒を「分:秒」の文字にする。例: 90000 → "01:30"
 * @param {number} ms - 時間（ミリ秒）
 * @returns {string} "分:秒" の文字
 */
function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0");
}

// ============================================================
// 6. 採点
// ============================================================

/**
 * 分野ごとに問題数と正解数を数えて採点する（模試・復習・一問一答で共通）。
 * @param {Object} state - 試験や一問一答の状態（questionIds と answers を使う）
 * @returns {Object} 採点結果（buildScoreSummary() が返すもの）
 */
function gradeExam(state) {
  const counts = {};
  for (const cat of CATEGORIES) {
    const idsInCategory = state.questionIds.filter((id) => QUESTIONS_BY_ID.get(id).category === cat.code);
    counts[cat.code] = {
      total: idsInCategory.length,
      correct: idsInCategory.filter((id) => state.answers[id] === QUESTIONS_BY_ID.get(id).answerIndex).length
    };
  }
  return buildScoreSummary(counts);
}

/**
 * 分野ごとの問題数と正解数から、正答率と推定スコア（1000点満点）を計算する。
 * 採点と苦手分析で共通に使う部品。
 * 総合の推定スコアは、分野ごとのスコアを本番の割合（ratio）で重み付けして平均する。
 * @param {Object<string, {total: number, correct: number}>} counts - 分野ごとの問題数（total）と正解数（correct）
 * @returns {Object} 次の5つをまとめたもの
 *   categoryBreakdown  … 分野ごとの { total, correct, percentage（正答率）, scoreApprox（推定スコア） }
 *   correctCount       … 全体の正解数
 *   totalQuestions     … 全体の問題数
 *   percentageScore    … 全体の正答率（0〜100）
 *   overallScoreApprox … 総合の推定スコア（1000点満点）
 */
function buildScoreSummary(counts) {
  const categoryBreakdown = {};
  let correctCount = 0;
  let totalQuestions = 0;
  for (const cat of CATEGORIES) {
    const { total, correct } = counts[cat.code];
    const percentage = total > 0 ? (correct / total) * 100 : 0;
    const scoreApprox = total > 0 ? Math.round((correct / total) * SCORE_SCALE_MAX) : 0;
    categoryBreakdown[cat.code] = { total, correct, percentage, scoreApprox };
    correctCount += correct;
    totalQuestions += total;
  }
  const percentageScore = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;
  const presentCategories = CATEGORIES.filter((cat) => categoryBreakdown[cat.code].total > 0);
  const weightSum = presentCategories.reduce((sum, cat) => sum + cat.ratio, 0);
  const overallScoreApprox = weightSum > 0
    ? Math.round(
        presentCategories.reduce((sum, cat) => sum + categoryBreakdown[cat.code].scoreApprox * cat.ratio, 0) / weightSum
      )
    : 0;
  return { categoryBreakdown, correctCount, totalQuestions, percentageScore, overallScoreApprox };
}

/**
 * 履歴の番号を作る（今の時刻のミリ秒を使う）。
 * @returns {number} 履歴の番号
 */
function generateHistoryId() {
  return Date.now();
}

// ============================================================
// 7. 画面の表示（開始画面・試験画面）
// ============================================================

/**
 * 画面を切り替える。index.html の <section id="view-○○"> のうち、1つだけを表示する。
 * @param {string} viewName - 画面の名前（"start" / "exam" / "results" / "history" /
 *   "practice" / "analysis" / "glossary"）
 */
function showView(viewName) {
  document.querySelectorAll(".view").forEach((el) => el.classList.remove("active"));
  document.getElementById("view-" + viewName).classList.add("active");
}

/**
 * 開始画面を表示する。
 *  ・途中の試験があれば「再開」の案内を出す（時間切れなら先に採点して結果画面へ）
 *  ・「今日の復習（○問）」ボタンの数を更新する（0問なら押せない）
 */
function renderStartView() {
  const savedState = loadExamState();
  if (savedState) {
    if (isExamExpired(savedState)) {
      examState = savedState;
      submitExam(true);
      return;
    }
    resumeBannerEl.hidden = false;
  } else {
    resumeBannerEl.hidden = true;
  }
  const reviewCount = collectTodayReviewQuestionIds().length;
  startReviewBtn.textContent = "今日の復習（" + reviewCount + "問）";
  startReviewBtn.disabled = reviewCount === 0;
  showView("start");
}

/**
 * 試験画面を描き直す（問題・問題番号のボタン・採点ボタン）。
 */
function renderExamView() {
  renderQuestionCard();
  renderJumpGrid();
  updateSubmitButtonState();
}

/**
 * いまの問題（分野・問題番号・問題文・図・選択肢）を表示する。選んだ選択肢には印を付ける。
 */
function renderQuestionCard() {
  const id = examState.questionIds[examState.currentIndex];
  const question = QUESTIONS_BY_ID.get(id);
  const category = CATEGORY_BY_CODE.get(question.category);
  examCategoryTagEl.textContent = category.label;
  examProgressEl.textContent = "問 " + (examState.currentIndex + 1) + " / " + examState.questionIds.length;
  examTimerEl.textContent = formatDuration(computeRemainingMs(examState));
  examQuestionTextEl.textContent = question.text;
  examQuestionImagesEl.innerHTML = "";
  question.images.forEach((src) => {
    const img = document.createElement("img");
    img.src = src;
    img.className = "question-image";
    img.alt = question.text;
    examQuestionImagesEl.appendChild(img);
  });
  examChoicesEl.innerHTML = "";
  question.choices.forEach((choiceText, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice-btn" + (examState.answers[id] === index ? " selected" : "");
    button.textContent = choiceText;
    button.addEventListener("click", () => selectAnswer(id, index));
    examChoicesEl.appendChild(button);
  });
  prevQuestionBtn.disabled = examState.currentIndex === 0;
  nextQuestionBtn.disabled = examState.currentIndex === examState.questionIds.length - 1;
}

/**
 * 問題番号のボタンを並べる。答えた問題といまの問題には印を付け、押すとその問題へ移動する。
 */
function renderJumpGrid() {
  examJumpGridEl.innerHTML = "";
  examState.questionIds.forEach((id, index) => {
    const button = document.createElement("button");
    button.type = "button";
    const answered = examState.answers[id] !== null;
    button.className = "jump-btn"
      + (answered ? " answered" : "")
      + (index === examState.currentIndex ? " current" : "");
    button.textContent = String(index + 1);
    button.addEventListener("click", () => goToQuestion(index));
    examJumpGridEl.appendChild(button);
  });
}

/**
 * 全問答えたときだけ「採点」ボタンを押せるようにする。
 */
function updateSubmitButtonState() {
  const allAnswered = Object.values(examState.answers).every((a) => a !== null);
  submitExamBtn.disabled = !allAnswered;
}

// ============================================================
// 8. 結果画面
// ============================================================

/**
 * 分野ごとの成績表（HTMLの表）を作る。
 * @param {Object} categoryBreakdown - 分野ごとの成績（buildScoreSummary() の categoryBreakdown）
 * @returns {string} 表の中身の HTML
 */
function buildCategoryTableHtml(categoryBreakdown) {
  let html = "<tr><th>分野</th><th>正答数</th><th>正答率</th><th>推定スコア</th></tr>";
  CATEGORIES.forEach((cat) => {
    const data = categoryBreakdown[cat.code];
    html += "<tr><td>" + cat.label + "</td><td>" + data.correct + " / " + data.total + "</td><td>"
      + data.percentage.toFixed(1) + "%</td><td>" + data.scoreApprox + "</td></tr>";
  });
  return html;
}

/**
 * 本番の基準で合否を判定し、足りなかった項目の説明も返す。
 * 基準: 総合600点以上 かつ 3分野それぞれ300点以上（どちらも1000点満点）
 * @param {Object} entry - 履歴または採点結果（overallScoreApprox と categoryBreakdown を使う）
 * @returns {{passed: boolean, reasons: string[]}} 合格なら passed が true。
 *   reasons は足りなかった項目の説明（例: "総合が600点未満"）
 */
function judgePass(entry) {
  const reasons = [];
  if (entry.overallScoreApprox < PASSING_TOTAL_SCORE) {
    reasons.push("総合が" + PASSING_TOTAL_SCORE + "点未満");
  }
  CATEGORIES.forEach((cat) => {
    const data = entry.categoryBreakdown[cat.code];
    // 読み込んだ古い履歴には scoreApprox がないことがあるので正答率から計算し直す
    const score = typeof data.scoreApprox === "number"
      ? data.scoreApprox
      : (data.total > 0 ? Math.round((data.correct / data.total) * SCORE_SCALE_MAX) : 0);
    if (score < PASSING_CATEGORY_SCORE) {
      reasons.push(cat.label + "が" + PASSING_CATEGORY_SCORE + "点未満");
    }
  });
  return { passed: reasons.length === 0, reasons };
}

/**
 * 結果画面に合否の帯を出す。復習の回は合否を出さない。
 * @param {HistoryEntry} historyEntry - 表示する履歴
 */
function renderPassBanner(historyEntry) {
  if (isReviewEntry(historyEntry)) {
    resultsPassBannerEl.hidden = true;
    return;
  }
  const judgement = judgePass(historyEntry);
  resultsPassBannerEl.className = "pass-banner " + (judgement.passed ? "passed" : "failed");
  resultsPassBannerEl.textContent = judgement.passed
    ? "合格ライン到達！（総合" + PASSING_TOTAL_SCORE + "点以上・全分野" + PASSING_CATEGORY_SCORE + "点以上）"
    : "不合格：" + judgement.reasons.join("、");
  resultsPassBannerEl.hidden = false;
}

/**
 * 結果画面を表示する（合否・総合点・分野ごとの表・全問の正解と解説）。
 * @param {HistoryEntry} historyEntry - 表示する履歴
 * @param {boolean} auto - 時間切れで自動採点したときは true（その案内を出す）
 */
function renderResultsView(historyEntry, auto) {
  resultsAutoBannerEl.hidden = !auto;
  resultsHeadingEl.textContent = isReviewEntry(historyEntry) ? "復習の結果" : "結果";
  renderPassBanner(historyEntry);
  resultsOverallEl.textContent = "総合: " + historyEntry.correctCount + " / " + historyEntry.totalQuestions
    + "問正解 (" + historyEntry.percentageScore.toFixed(1) + "%) 推定スコア " + historyEntry.overallScoreApprox + "点";
  resultsCategoryTableEl.innerHTML = buildCategoryTableHtml(historyEntry.categoryBreakdown);
  resultsDisclaimerEl.textContent = SCORE_DISCLAIMER_TEXT;
  resultsReviewEl.innerHTML = "";
  historyEntry.questionIds.forEach((id) => {
    const question = QUESTIONS_BY_ID.get(id);
    if (!question) return;
    const userAnswerIndex = historyEntry.answers[id];
    const category = CATEGORY_BY_CODE.get(question.category);

    const card = document.createElement("div");
    card.className = "review-card";

    const title = document.createElement("p");
    title.className = "review-question-text";
    title.textContent = "[" + category.label + "] " + question.text;
    card.appendChild(title);

    question.images.forEach((src) => {
      const img = document.createElement("img");
      img.src = src;
      img.className = "question-image";
      img.alt = question.text;
      card.appendChild(img);
    });

    const choiceList = document.createElement("ul");
    choiceList.className = "review-choices";
    question.choices.forEach((choiceText, index) => {
      const item = document.createElement("li");
      let label = choiceText;
      if (index === question.answerIndex) {
        label = "✔正解 " + label;
      }
      if (index === userAnswerIndex && userAnswerIndex !== question.answerIndex) {
        label = "✖あなたの回答 " + label;
      }
      item.textContent = label;
      item.className = index === question.answerIndex
        ? "correct-choice"
        : (index === userAnswerIndex ? "wrong-choice" : "");
      choiceList.appendChild(item);
    });
    card.appendChild(choiceList);

    const explanation = document.createElement("p");
    explanation.className = "review-explanation";
    explanation.textContent = question.explanation;
    card.appendChild(explanation);

    resultsReviewEl.appendChild(card);
  });
  showView("results");
}

// ============================================================
// 9. 履歴画面（グラフと一覧）
// ============================================================

/**
 * グラフ用の図形（SVG という絵の部品）を作る。
 * @param {string} tagName - 部品の種類（"line"=線、"circle"=丸、"text"=文字 など）
 * @param {Object} attributes - 位置や見た目の設定（例: { x1: 0, y1: 10, class: "chart-grid" }）
 * @returns {SVGElement} 作った部品
 */
function createSvgElement(tagName, attributes) {
  const el = document.createElementNS(SVG_NS, tagName);
  for (const [name, value] of Object.entries(attributes)) {
    el.setAttribute(name, value);
  }
  return el;
}

/**
 * 直近の模試の総合正答率を折れ線グラフで描く。合格目安（60%）の線も引く。
 * @param {HistoryEntry[]} history - 模試の履歴（古い順）。最大20回分を描く
 */
function renderHistoryChart(history) {
  historyChartEl.innerHTML = "";
  if (history.length === 0) {
    historyChartEl.textContent = "まだ受験履歴がありません。試験を受けるとここに成績の推移グラフが表示されます。";
    return;
  }
  const entries = history.slice(-HISTORY_CHART_MAX_POINTS);
  const width = 600;
  const height = 240;
  const pad = { top: 16, right: 16, bottom: 32, left: 44 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const xOf = (i) => pad.left + (entries.length === 1 ? plotW / 2 : (plotW * i) / (entries.length - 1));
  const yOf = (pct) => pad.top + plotH * (1 - pct / 100);

  const svg = createSvgElement("svg", {
    viewBox: "0 0 " + width + " " + height,
    class: "history-chart-svg",
    role: "img",
    "aria-label": "総合正答率の推移グラフ(直近" + entries.length + "回)"
  });

  [0, 20, 40, 60, 80, 100].forEach((pct) => {
    svg.appendChild(createSvgElement("line", {
      x1: pad.left, x2: width - pad.right, y1: yOf(pct), y2: yOf(pct), class: "chart-grid"
    }));
    const label = createSvgElement("text", {
      x: pad.left - 8, y: yOf(pct) + 4, "text-anchor": "end", class: "chart-axis-label"
    });
    label.textContent = pct + "%";
    svg.appendChild(label);
  });

  svg.appendChild(createSvgElement("line", {
    x1: pad.left, x2: width - pad.right,
    y1: yOf(PASSING_PERCENTAGE), y2: yOf(PASSING_PERCENTAGE), class: "chart-pass-line"
  }));
  const passLabel = createSvgElement("text", {
    x: width - pad.right, y: yOf(PASSING_PERCENTAGE) - 6, "text-anchor": "end", class: "chart-pass-label"
  });
  passLabel.textContent = "合格目安 " + PASSING_PERCENTAGE + "%";
  svg.appendChild(passLabel);

  const points = entries.map((entry, i) => xOf(i) + "," + yOf(entry.percentageScore)).join(" ");
  svg.appendChild(createSvgElement("polyline", { points, class: "chart-line" }));

  entries.forEach((entry, i) => {
    const dot = createSvgElement("circle", {
      cx: xOf(i), cy: yOf(entry.percentageScore), r: 5,
      class: entry.percentageScore >= PASSING_PERCENTAGE ? "chart-dot pass" : "chart-dot"
    });
    const tooltip = createSvgElement("title", {});
    tooltip.textContent = new Date(entry.date).toLocaleString("ja-JP") + " / " + entry.percentageScore.toFixed(1) + "%";
    dot.appendChild(tooltip);
    svg.appendChild(dot);
    const xLabel = createSvgElement("text", {
      x: xOf(i), y: height - 10, "text-anchor": "middle", class: "chart-axis-label"
    });
    xLabel.textContent = String(history.length - entries.length + i + 1);
    svg.appendChild(xLabel);
  });

  historyChartEl.appendChild(svg);
  const caption = document.createElement("p");
  caption.className = "history-chart-caption";
  caption.textContent = "横軸: 受験回数 / 縦軸: 総合正答率(直近" + entries.length + "回)";
  historyChartEl.appendChild(caption);
}

/**
 * 履歴画面を表示する（グラフと一覧表）。
 * 復習や一問一答の回は出題が偏っていて成績の推移が乱れるので、グラフと表には模試だけを出す。
 */
function renderHistoryView() {
  const history = loadHistory();
  // 復習や一問一答の回は出題が偏っていて成績の推移が乱れるので、グラフと表には模試だけを出す
  const examRows = history
    .map((entry, index) => ({ entry, index }))
    .filter((row) => isMockExamEntry(row.entry));
  renderHistoryChart(examRows.map((row) => row.entry));
  let html = "<tr><th>日時</th><th>総合正答率</th><th>推定スコア</th><th>判定</th><th>ストラテジ系</th><th>マネジメント系</th><th>テクノロジ系</th><th>操作</th></tr>";
  examRows.slice().reverse().forEach(({ entry, index }) => {
    const dateLabel = new Date(entry.date).toLocaleString("ja-JP");
    const passed = judgePass(entry).passed;
    html += "<tr><td>" + dateLabel + "</td><td>" + entry.percentageScore.toFixed(1) + "%</td><td>"
      + entry.overallScoreApprox + "</td><td class=\"" + (passed ? "pass-text" : "fail-text") + "\">"
      + (passed ? "合格" : "不合格") + "</td>";
    CATEGORIES.forEach((cat) => {
      const data = entry.categoryBreakdown[cat.code];
      html += "<td>" + data.correct + "/" + data.total + "</td>";
    });
    // 削除ボタンには保存データ上の位置を持たせる
    html += "<td><button type=\"button\" class=\"danger-btn history-delete-btn\" data-index=\""
      + index + "\">削除</button></td>";
    html += "</tr>";
  });
  historyTableEl.innerHTML = html;
  historyClearBtn.hidden = history.length === 0;
  showView("history");
}

/**
 * 履歴を1件削除する（先に確認のダイアログを出す）。
 * @param {number} index - 保存データの中での位置（0から数える）
 */
function deleteHistoryEntry(index) {
  if (!confirm("この履歴を削除しますか？")) return;
  const history = loadHistory();
  history.splice(index, 1);
  saveHistory(history);
  renderHistoryView();
}

/**
 * 履歴をすべて削除する（先に確認のダイアログを出す）。
 */
function clearHistory() {
  if (!confirm("受験履歴をすべて削除しますか？この操作は元に戻せません。")) return;
  saveHistory([]);
  renderHistoryView();
}

// ============================================================
// 10. 分野別の一問一答
// ============================================================

/**
 * 分野別の一問一答を始める。時間制限はなく、答えるたびに正誤と解説を見せる。
 * 回答は mode: "practice" の履歴として保存するので、間違えた問題は「今日の復習」にも出る。
 * @param {string} categoryCode - 分野（"strategy" など）
 */
function startPractice(categoryCode) {
  practiceState = {
    historyId: generateHistoryId(),
    date: new Date().toISOString(),
    category: categoryCode,
    questionIds: [],
    answers: {},
    currentId: null,
    answered: false
  };
  showView("practice");
  showNextPracticeQuestion();
}

/**
 * 一問一答の次の問題を選んで表示する（模試と同じく、まだ出していない問題を優先する）。
 */
function showNextPracticeQuestion() {
  const progress = ensureProgressInitialized(loadQuestionProgress());
  const [id] = drawFromCategoryBag(progress, practiceState.category, 1);
  saveQuestionProgress(progress);
  practiceState.currentId = id;
  practiceState.answered = false;
  renderPracticeView();
}

/**
 * 一問一答で選択肢を選んだときの動き。回答を記録して履歴に保存し、正誤と解説を出す。
 * @param {number} choiceIndex - 選んだ選択肢の番号（0から数える）
 */
function answerPractice(choiceIndex) {
  if (practiceState.answered) return;
  const id = practiceState.currentId;
  // 同じ問題が2回出た場合は、あとの回答で上書きする
  if (!practiceState.questionIds.includes(id)) practiceState.questionIds.push(id);
  practiceState.answers[id] = choiceIndex;
  practiceState.answered = true;
  savePracticeToHistory();
  renderPracticeView();
}

/**
 * 一問一答の成績を履歴に保存する。
 * 1回の一問一答は履歴1件で、答えるたびに同じ履歴を上書きして更新する。
 */
function savePracticeToHistory() {
  const breakdown = gradeExam(practiceState);
  const historyEntry = {
    schemaVersion: 1,
    id: practiceState.historyId,
    date: practiceState.date,
    mode: EXAM_MODE_PRACTICE,
    questionIds: practiceState.questionIds,
    answers: practiceState.answers,
    totalQuestions: breakdown.totalQuestions,
    correctCount: breakdown.correctCount,
    percentageScore: breakdown.percentageScore,
    categoryBreakdown: breakdown.categoryBreakdown,
    overallScoreApprox: breakdown.overallScoreApprox,
    autoSubmitted: false
  };
  const history = loadHistory();
  const index = history.findIndex((entry) => entry.id === practiceState.historyId);
  if (index >= 0) {
    history[index] = historyEntry;
  } else {
    history.push(historyEntry);
  }
  saveHistory(history);
}

/**
 * 一問一答の画面を描き直す。答えた後は、正解を緑・間違えた選択肢を赤にして、
 * 解説と「次の問題」ボタンを出す。
 */
function renderPracticeView() {
  const id = practiceState.currentId;
  const question = QUESTIONS_BY_ID.get(id);
  const answered = practiceState.answered;
  const userAnswerIndex = practiceState.answers[id];
  const answeredCount = practiceState.questionIds.length;
  const correctCount = practiceState.questionIds.filter(
    (qid) => practiceState.answers[qid] === QUESTIONS_BY_ID.get(qid).answerIndex
  ).length;
  practiceCategoryTagEl.textContent = CATEGORY_BY_CODE.get(practiceState.category).label;
  practiceScoreEl.textContent = "正解 " + correctCount + " / " + answeredCount + "問";
  practiceQuestionTextEl.textContent = question.text;
  practiceQuestionImagesEl.innerHTML = "";
  question.images.forEach((src) => {
    const img = document.createElement("img");
    img.src = src;
    img.className = "question-image";
    img.alt = question.text;
    practiceQuestionImagesEl.appendChild(img);
  });
  practiceChoicesEl.innerHTML = "";
  question.choices.forEach((choiceText, index) => {
    const button = document.createElement("button");
    button.type = "button";
    let className = "choice-btn";
    if (answered && index === question.answerIndex) className += " correct";
    if (answered && index === userAnswerIndex && index !== question.answerIndex) className += " wrong";
    button.className = className;
    button.textContent = choiceText;
    button.disabled = answered;
    button.addEventListener("click", () => answerPractice(index));
    practiceChoicesEl.appendChild(button);
  });
  practiceFeedbackEl.hidden = !answered;
  practiceExplanationEl.hidden = !answered;
  practiceNextBtn.hidden = !answered;
  if (answered) {
    const correct = userAnswerIndex === question.answerIndex;
    practiceFeedbackEl.className = "pass-banner " + (correct ? "passed" : "failed");
    practiceFeedbackEl.textContent = correct ? "⭕ 正解！" : "❌ 不正解（正解は緑の選択肢です）";
    practiceExplanationEl.textContent = question.explanation;
  }
  window.scrollTo(0, 0);
}

/**
 * 一問一答を終えて開始画面に戻る。
 */
function endPractice() {
  practiceState = null;
  renderStartView();
}

// ============================================================
// 11. 履歴の書き出し・読み込み（別の端末への引っ越し）
// ============================================================

/**
 * 履歴画面に、書き出し・読み込みの結果メッセージを出す。
 * @param {string} text - 表示する文
 * @param {boolean} isError - エラーなら true（赤い表示になる）
 */
function showTransferMessage(text, isError) {
  historyTransferMessageEl.textContent = text;
  historyTransferMessageEl.classList.toggle("error", isError);
  historyTransferMessageEl.hidden = false;
}

/**
 * 書き出し・読み込みのメッセージを隠す。
 */
function hideTransferMessage() {
  historyTransferMessageEl.hidden = true;
}

/**
 * 書き出すファイルの名前を作る。例: "itpassport-history-20260928-1530.json"
 * @returns {string} ファイル名
 */
function buildHistoryExportFileName() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return "itpassport-history-" + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate())
    + "-" + pad(d.getHours()) + pad(d.getMinutes()) + ".json";
}

/**
 * 履歴をファイルに書き出す（別の端末へ引っ越すため）。
 * iPhone などでは共有メニュー（AirDrop・「ファイル」に保存など）、パソコンでは普通のダウンロード。
 * async … 共有メニューの操作が終わるのを待つことがある関数、という印。
 */
async function exportHistory() {
  const history = loadHistory();
  if (history.length === 0) {
    showTransferMessage("書き出す履歴がありません。", true);
    return;
  }
  const payload = { format: HISTORY_EXPORT_FORMAT, version: 1, exportedAt: new Date().toISOString(), history };
  const fileName = buildHistoryExportFileName();
  const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
  const doneText = history.length + "件の履歴を書き出しました。もう一方の端末で「履歴を読み込む」を押してください。";
  // iPhoneなどタッチ操作の端末では共有メニュー(AirDrop・「ファイル」に保存など)を出す。
  // パソコンで共有メニューを出すとかえって分かりにくいので、そちらは普通のダウンロードにする
  const file = new File([blob], fileName, { type: "application/json" });
  const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;
  if (isTouchDevice && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "ITパスポート模試の履歴" });
      showTransferMessage(doneText, false);
    } catch (err) {
      if (err.name !== "AbortError") showTransferMessage("書き出しに失敗しました。", true);
    }
    return;
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showTransferMessage(doneText, false);
}

/**
 * 読み込んだ履歴1件が正しい形か確かめる。
 * ファイルは外から来るので、表示に使う項目がすべて正しい種類（数・文字など）かを調べる。
 * @param {*} entry - 調べるもの（* はどんな種類でもよいという意味）
 * @returns {boolean} 正しければ true
 */
function isValidHistoryEntry(entry) {
  return !!entry && typeof entry === "object"
    && typeof entry.id === "number"
    && typeof entry.date === "string" && !Number.isNaN(Date.parse(entry.date))
    && typeof entry.percentageScore === "number"
    && typeof entry.overallScoreApprox === "number"
    && !!entry.categoryBreakdown && typeof entry.categoryBreakdown === "object"
    && CATEGORIES.every((cat) => {
      const data = entry.categoryBreakdown[cat.code];
      return !!data && typeof data.correct === "number" && typeof data.total === "number";
    });
}

/**
 * 同じ履歴を二重に読み込まないための目印（番号と日時をつないだ文字）を作る。
 * @param {HistoryEntry} entry - 履歴
 * @returns {string} 目印（例: "1790000000000|2026-09-28T03:00:00.000Z"）
 */
function historyEntryKey(entry) {
  return entry.id + "|" + entry.date;
}

/**
 * 書き出したファイルの中身から履歴を読み込み、今の履歴に足す。
 * すでにある履歴は足さない。結果はメッセージで知らせる。
 * @param {string} text - ファイルの中身（JSON という形式の文字）
 */
function importHistoryFromText(text) {
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    showTransferMessage("このファイルは読み込めません。「履歴を書き出す」で作ったファイルを選んでください。", true);
    return;
  }
  const entries = payload && payload.format === HISTORY_EXPORT_FORMAT ? payload.history : null;
  const validEntries = Array.isArray(entries) ? entries.filter(isValidHistoryEntry) : [];
  if (validEntries.length === 0) {
    showTransferMessage("このファイルには読み込める履歴がありません。「履歴を書き出す」で作ったファイルを選んでください。", true);
    return;
  }
  const history = loadHistory();
  const existingKeys = new Set(history.map(historyEntryKey));
  let addedCount = 0;
  validEntries.forEach((entry) => {
    const key = historyEntryKey(entry);
    if (existingKeys.has(key)) return;
    history.push(entry);
    existingKeys.add(key);
    addedCount++;
  });
  history.sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  saveHistory(history);
  renderHistoryView();
  if (addedCount === 0) {
    showTransferMessage("新しい履歴はありませんでした（すべて読み込み済みです）。", false);
    return;
  }
  const skippedCount = validEntries.length - addedCount;
  showTransferMessage(addedCount + "件の履歴を追加しました。"
    + (skippedCount > 0 ? "（" + skippedCount + "件はすでにあるため追加していません）" : ""), false);
}

/**
 * 「履歴を読み込む」でファイルを選んだときの動き。ファイルを読んで importHistoryFromText() に渡す。
 */
async function handleImportFileSelected() {
  const file = historyImportInput.files[0];
  // 同じファイルをもう一度選んでも反応するように選択を空に戻す
  historyImportInput.value = "";
  if (!file) return;
  try {
    importHistoryFromText(await file.text());
  } catch {
    showTransferMessage("ファイルを読み込めませんでした。", true);
  }
}

// ============================================================
// 12. 用語・計算式まとめ（createTextElement は画面全体で使う共通の部品）
// ============================================================

/**
 * 文字を入れた画面の部品を作る（共通の部品）。
 * 文字は textContent で入れるので、中に < > などの記号があってもそのまま安全に表示される。
 * @param {string} tagName - 部品の種類（"p"=段落、"span"=文字の一部、"h3"=見出し など）
 * @param {string} className - 見た目の指定（style.css のクラス名。なければ ""）
 * @param {string} text - 表示する文字
 * @returns {HTMLElement} 作った部品
 */
function createTextElement(tagName, className, text) {
  const el = document.createElement(tagName);
  el.className = className;
  el.textContent = text;
  return el;
}

/**
 * 略語の英語表記の部品を作る。「**」で囲んだ文字だけを太字（強調）にして表示する。
 * 例: "**S**trengths" → 「S」だけ強調された「Strengths」。
 * 文字は textContent と createTextNode で入れるので、記号があっても安全に表示される。
 * @param {string} text - 英語表記。強調したい文字を ** で囲む。改行（\n）で行を分けられる
 * @returns {HTMLElement} 作った部品（段落）
 */
function createEnglishElement(text) {
  const p = document.createElement("p");
  p.className = "glossary-english";
  p.appendChild(createTextElement("span", "glossary-english-label", "英語"));
  // "**" で区切ると、奇数番目（1, 3, 5…）が強調したい文字になる
  text.split("**").forEach((part, index) => {
    if (part === "") return;
    if (index % 2 === 1) {
      p.appendChild(createTextElement("strong", "glossary-english-mark", part));
    } else {
      p.appendChild(document.createTextNode(part));
    }
  });
  return p;
}

/**
 * 用語または計算式1つ分の表示（タップすると開く部品）を作る。
 * @param {Object} item - GLOSSARY（用語）または FORMULAS（計算式）の1件
 * @param {boolean} isFormula - 計算式なら true
 * @returns {HTMLElement} 作った部品
 */
function buildGlossaryItem(item, isFormula) {
  const details = document.createElement("details");
  details.className = "glossary-item";
  const summary = document.createElement("summary");
  const title = isFormula ? item.title : item.term + (item.reading ? "（" + item.reading + "）" : "");
  summary.appendChild(createTextElement("span", "glossary-title", title));
  summary.appendChild(createTextElement("span", "category-tag", CATEGORY_BY_CODE.get(item.category).label));
  details.appendChild(summary);
  if (item.english) {
    details.appendChild(createEnglishElement(item.english));
  }
  if (isFormula) {
    details.appendChild(createTextElement("p", "glossary-formula", item.formula));
    details.appendChild(createTextElement("p", "glossary-text", item.note));
    details.appendChild(createTextElement("p", "glossary-example", "例：" + item.example));
  } else {
    details.appendChild(createTextElement("p", "glossary-text", item.description));
  }
  return details;
}

/**
 * 用語・計算式の一覧を、今の条件（glossaryFilter のタブ・分野・検索語）で絞り込んで表示する。
 */
function renderGlossaryList() {
  const isFormula = glossaryFilter.tab === "formulas";
  const keyword = glossaryFilter.keyword.trim().toLowerCase();
  const items = (isFormula ? FORMULAS : GLOSSARY).filter((item) => {
    if (glossaryFilter.category !== "all" && item.category !== glossaryFilter.category) return false;
    if (!keyword) return true;
    // 英語表記は、強調の印（**）を取り除いた文字で探す（例: "Threats" で見つかる）
    const english = (item.english || "").split("**").join("");
    const searchText = isFormula
      ? [item.title, english, item.formula, item.note, item.example]
      : [item.term, item.reading, english, item.description];
    return searchText.join(" ").toLowerCase().includes(keyword);
  });
  document.querySelectorAll(".glossary-tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === glossaryFilter.tab);
  });
  document.querySelectorAll(".glossary-filter-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.category === glossaryFilter.category);
  });
  glossaryCountEl.textContent = items.length + "件";
  glossaryListEl.innerHTML = "";
  items.forEach((item) => glossaryListEl.appendChild(buildGlossaryItem(item, isFormula)));
  if (items.length === 0) {
    glossaryListEl.appendChild(createTextElement("p", "glossary-empty", "見つかりませんでした。別のキーワードで探してみてください。"));
  }
}

/**
 * 用語・計算式まとめの画面を表示する。
 */
function renderGlossaryView() {
  renderGlossaryList();
  showView("glossary");
  window.scrollTo(0, 0);
}

// ============================================================
// 13. 苦手分析ボード
// ============================================================

/**
 * 問題ごとの正誤を、分野ごとの問題数と正解数にまとめる。
 * @param {Map<string, boolean>} results - 問題ID → 正解したか
 * @returns {Object<string, {total: number, correct: number}>} 分野ごとの問題数と正解数
 */
function countResultsByCategory(results) {
  const counts = {};
  CATEGORIES.forEach((cat) => { counts[cat.code] = { total: 0, correct: 0 }; });
  results.forEach((correct, id) => {
    const data = counts[QUESTIONS_BY_ID.get(id).category];
    data.total += 1;
    if (correct) data.correct += 1;
  });
  return counts;
}

/**
 * 直近の模試（お試し10問も含む。回数は ANALYSIS_RECENT_EXAM_COUNT）を合わせて、
 * 本番の基準で推定スコアを出す。
 * @returns {Object|null} { examCount: 使った模試の回数, summary: 採点結果 }。模試がなければ null
 */
function summarizeRecentMockExams() {
  const exams = loadHistory()
    .filter((entry) => isMockExamEntry(entry) && entry.categoryBreakdown)
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
    .slice(-ANALYSIS_RECENT_EXAM_COUNT);
  if (exams.length === 0) return null;
  const counts = {};
  CATEGORIES.forEach((cat) => {
    counts[cat.code] = { total: 0, correct: 0 };
    exams.forEach((entry) => {
      const data = entry.categoryBreakdown[cat.code];
      if (!data) return;
      counts[cat.code].total += data.total;
      counts[cat.code].correct += data.correct;
    });
  });
  return { examCount: exams.length, summary: buildScoreSummary(counts) };
}

/**
 * 正答率を整数の % にする（問題数が0なら0）。例: toPercent(3, 4) → 75
 * @param {number} correct - 正解数
 * @param {number} total - 問題数
 * @returns {number} 正答率（0〜100）
 */
function toPercent(correct, total) {
  return total > 0 ? Math.round((correct / total) * 100) : 0;
}

/**
 * 苦手分析の画面に、見出しつきのカードを1枚足す。
 * @param {string} heading - 見出し
 * @returns {HTMLElement} 追加したカード（中身はあとから入れる）
 */
function buildAnalysisCard(heading) {
  const card = document.createElement("div");
  card.className = "analysis-card";
  card.appendChild(createTextElement("h3", "", heading));
  analysisContentEl.appendChild(card);
  return card;
}

/**
 * 「合格の見込み」カードを表示する（直近の模試から推定スコアと合否を出す）。
 */
function renderPassEstimateCard() {
  const card = buildAnalysisCard("合格の見込み");
  const recent = summarizeRecentMockExams();
  if (!recent) {
    card.appendChild(createTextElement("p", "analysis-note", "模試（お試し10問を含む）を受けると表示されます。"));
    return;
  }
  const { summary, examCount } = recent;
  const judgement = judgePass(summary);
  card.appendChild(createTextElement("p", "analysis-big",
    "推定 " + summary.overallScoreApprox + "点（合格ライン " + PASSING_TOTAL_SCORE + "点）"));
  card.appendChild(createTextElement("p", "pass-banner " + (judgement.passed ? "passed" : "failed"),
    judgement.passed ? "✅ 合格ラインに届いています" : "❌ " + judgement.reasons.join("、")));
  card.appendChild(createTextElement("p", "analysis-note",
    "直近" + examCount + "回の模試（計" + summary.totalQuestions + "問）から計算しています。"));
}

/**
 * 「本当の実力」カードを表示する。初めて解いたときの正答率を出す。
 * くり返し解くと答えを覚えてしまうので、本番の実力はこちらの数字に近い。
 * @param {Map<string, boolean>} first - 問題ID → 最初に解いたとき正解したか
 */
function renderFirstTryCard(first) {
  const card = buildAnalysisCard("本当の実力（初めて見た問題の正答率）");
  const counts = countResultsByCategory(first);
  const total = CATEGORIES.reduce((sum, cat) => sum + counts[cat.code].total, 0);
  const correct = CATEGORIES.reduce((sum, cat) => sum + counts[cat.code].correct, 0);
  card.appendChild(createTextElement("p", "analysis-big", toPercent(correct, total) + "%"));
  card.appendChild(createTextElement("p", "analysis-note",
    "初めて解いたときに正解した問題の割合です（" + total + "問中 " + correct + "問）。"
    + "同じ問題をくり返すと答えを覚えてしまうので、本番の実力はこちらの数字に近くなります。"));
}

/**
 * 分野ごとの正答率を棒グラフで描き、「合格ライン未満」「いちばん苦手」の印を付ける。
 * @param {Map<string, boolean>} latest - 問題ID → 最後に解いたとき正解したか
 * @returns {Object|null} いちばん正答率が低い分野（CATEGORIES の1つ）。解いた問題がなければ null
 */
function renderCategoryCard(latest) {
  const card = buildAnalysisCard("分野ごとの正答率（最後に解いたときの結果）");
  const counts = countResultsByCategory(latest);
  const attempted = CATEGORIES.filter((cat) => counts[cat.code].total > 0);
  const rateOf = (cat) => counts[cat.code].correct / counts[cat.code].total;
  const weakest = attempted.reduce((min, cat) => (!min || rateOf(cat) < rateOf(min) ? cat : min), null);
  // 全分野が同じ正答率なら「いちばん苦手」の印は付けない
  const markWeakest = weakest !== null && attempted.some((cat) => rateOf(cat) > rateOf(weakest));
  CATEGORIES.forEach((cat) => {
    const { total, correct } = counts[cat.code];
    const poolSize = QUESTIONS.filter((q) => q.category === cat.code).length;
    const percent = toPercent(correct, total);
    const row = document.createElement("div");
    row.className = "analysis-row";
    const label = document.createElement("div");
    label.className = "analysis-row-label";
    label.appendChild(createTextElement("span", "", cat.label));
    let status = total > 0 ? percent + "%" : "まだ解いていません";
    if (total > 0 && percent * 10 < PASSING_CATEGORY_SCORE) {
      status += " ⚠ 合格ライン未満";
    } else if (markWeakest && cat === weakest) {
      status += " ⚠ いちばん苦手";
    }
    label.appendChild(createTextElement("span", "analysis-row-status", status));
    row.appendChild(label);
    const bar = document.createElement("div");
    bar.className = "analysis-bar";
    const fill = document.createElement("div");
    fill.className = "analysis-bar-fill" + (markWeakest && cat === weakest ? " weak" : "");
    fill.style.width = percent + "%";
    bar.appendChild(fill);
    row.appendChild(bar);
    row.appendChild(createTextElement("p", "analysis-note",
      "解いたことがある問題 " + total + " / " + poolSize + "問（正解 " + correct + "問）"));
    card.appendChild(row);
  });
  return weakest;
}

/**
 * 苦手分析の画面を表示する。いちばん苦手な分野があれば「○○を一問一答で練習」ボタンも出す。
 */
function renderAnalysisView() {
  analysisContentEl.innerHTML = "";
  analysisPracticeBtn.hidden = true;
  const { first, latest } = collectQuestionResults();
  if (latest.size === 0) {
    analysisContentEl.appendChild(createTextElement("p", "analysis-note",
      "まだ履歴がありません。模試か一問一答をすると、ここに苦手な分野が表示されます。"));
  } else {
    renderPassEstimateCard();
    renderFirstTryCard(first);
    const weakest = renderCategoryCard(latest);
    if (weakest) {
      analysisPracticeBtn.textContent = weakest.label + "を一問一答で練習";
      analysisPracticeBtn.dataset.category = weakest.code;
      analysisPracticeBtn.hidden = false;
    }
  }
  showView("analysis");
  window.scrollTo(0, 0);
}

// ============================================================
// 14. アプリの起動
// ============================================================

/**
 * アプリの起動。各ボタンを押したときに動く関数を登録（addEventListener）して、開始画面を出す。
 * ファイルの最後で1回だけ呼ぶ。
 */
function init() {
  startExamBtn.addEventListener("click", () => startNewExam(EXAM_QUESTION_COUNT));
  startQuickExamBtn.addEventListener("click", () => startNewExam(QUICK_EXAM_QUESTION_COUNT));
  startReviewBtn.addEventListener("click", startReviewExam);
  document.querySelectorAll(".start-practice-btn").forEach((btn) => {
    btn.addEventListener("click", () => startPractice(btn.dataset.category));
  });
  practiceNextBtn.addEventListener("click", showNextPracticeQuestion);
  practiceEndBtn.addEventListener("click", endPractice);
  resumeExamBtn.addEventListener("click", resumeExam);
  showHistoryBtn.addEventListener("click", () => {
    hideTransferMessage();
    renderHistoryView();
  });
  historyBackBtn.addEventListener("click", renderStartView);
  historyClearBtn.addEventListener("click", clearHistory);
  historyExportBtn.addEventListener("click", exportHistory);
  historyImportBtn.addEventListener("click", () => historyImportInput.click());
  historyImportInput.addEventListener("change", handleImportFileSelected);
  historyTableEl.addEventListener("click", (event) => {
    const btn = event.target.closest(".history-delete-btn");
    if (btn) deleteHistoryEntry(Number(btn.dataset.index));
  });
  showAnalysisBtn.addEventListener("click", renderAnalysisView);
  analysisBackBtn.addEventListener("click", renderStartView);
  analysisPracticeBtn.addEventListener("click", () => startPractice(analysisPracticeBtn.dataset.category));
  showGlossaryBtn.addEventListener("click", renderGlossaryView);
  glossaryBackBtn.addEventListener("click", renderStartView);
  glossarySearchEl.addEventListener("input", () => {
    glossaryFilter.keyword = glossarySearchEl.value;
    renderGlossaryList();
  });
  document.querySelectorAll(".glossary-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      glossaryFilter.tab = btn.dataset.tab;
      renderGlossaryList();
    });
  });
  document.querySelectorAll(".glossary-filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      glossaryFilter.category = btn.dataset.category;
      renderGlossaryList();
    });
  });
  resultsBackBtn.addEventListener("click", renderStartView);
  resultsBackBottomBtn.addEventListener("click", renderStartView);
  prevQuestionBtn.addEventListener("click", () => goToQuestion(Math.max(0, examState.currentIndex - 1)));
  nextQuestionBtn.addEventListener("click", () => {
    goToQuestion(Math.min(examState.questionIds.length - 1, examState.currentIndex + 1));
  });
  submitExamBtn.addEventListener("click", () => submitExam(false));
  renderStartView();
}

init();
