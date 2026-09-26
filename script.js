const QUESTION_PROGRESS_STORAGE_KEY = "itPassportQuestionProgress";
const EXAM_STATE_STORAGE_KEY = "itPassportExamState";
const HISTORY_STORAGE_KEY = "itPassportHistory";
const HISTORY_EXPORT_FORMAT = "it-passport-history";

const CATEGORIES = [
  { code: "strategy", label: "ストラテジ系", ratio: 0.35 },
  { code: "management", label: "マネジメント系", ratio: 0.20 },
  { code: "technology", label: "テクノロジ系", ratio: 0.45 }
];
const CATEGORY_BY_CODE = new Map(CATEGORIES.map((cat) => [cat.code, cat]));
const QUESTIONS_BY_ID = new Map(QUESTIONS.map((q) => [q.id, q]));

const EXAM_QUESTION_COUNT = 100;
const QUICK_EXAM_QUESTION_COUNT = 10;
const EXAM_TIME_LIMIT_MINUTES = 120;
const MIN_EXAM_TIME_LIMIT_MINUTES = 5;
const SCORE_SCALE_MAX = 1000;
const PASSING_PERCENTAGE = 60;
// 本番の合格基準: 総合600点以上 かつ 3分野それぞれ300点以上(いずれも1000点満点)
const PASSING_TOTAL_SCORE = 600;
const PASSING_CATEGORY_SCORE = 300;
const EXAM_MODE_NORMAL = "normal";
const EXAM_MODE_REVIEW = "review";
const EXAM_MODE_PRACTICE = "practice";
const HISTORY_CHART_MAX_POINTS = 20;
// 苦手分析の「合格の見込み」で合わせる、直近の模試の回数
const ANALYSIS_RECENT_EXAM_COUNT = 3;
const SVG_NS = "http://www.w3.org/2000/svg";
const TIMER_TICK_MS = 1000;
const SCORE_DISCLAIMER_TEXT = "この1000点満点スコアは正答率に基づく独自の簡易換算であり、IPAの公式スコア(項目反応理論に基づく)とは異なります。参考値としてご利用ください。";

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

let examState = null;
let practiceState = null;
// 用語・計算式まとめ画面の表示条件（タブ・分野・検索語）
const glossaryFilter = { tab: "terms", category: "all", keyword: "" };
let timerIntervalId = null;

function loadQuestionProgress() {
  try {
    const raw = localStorage.getItem(QUESTION_PROGRESS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveQuestionProgress(progress) {
  try {
    localStorage.setItem(QUESTION_PROGRESS_STORAGE_KEY, JSON.stringify(progress));
  } catch {}
}

function loadExamState() {
  try {
    const raw = localStorage.getItem(EXAM_STATE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveExamState(state) {
  try {
    localStorage.setItem(EXAM_STATE_STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

function clearExamState() {
  try {
    localStorage.removeItem(EXAM_STATE_STORAGE_KEY);
  } catch {}
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(history) {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
  } catch {}
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

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

function isReviewEntry(entry) {
  return entry.mode === EXAM_MODE_REVIEW;
}

// 本番形式の模試かどうか(mode がない古い履歴も模試として扱う)
function isMockExamEntry(entry) {
  return !entry.mode || entry.mode === EXAM_MODE_NORMAL;
}

// 履歴(模試・復習・一問一答)を古い順にたどり、問題ごとに
// 「最初に解いたときに正解したか(first)」と「最後に解いたときに正解したか(latest)」を集める
function collectQuestionResults() {
  const history = loadHistory()
    .slice()
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  const first = new Map();
  const latest = new Map();
  history.forEach((entry) => {
    // 回答の記録がない履歴(読み込んだ古いデータなど)は飛ばす
    if (!Array.isArray(entry.questionIds) || !entry.answers || typeof entry.answers !== "object") return;
    entry.questionIds.forEach((id) => {
      const question = QUESTIONS_BY_ID.get(id);
      if (!question) return;
      const correct = entry.answers[id] === question.answerIndex;
      if (!first.has(id)) first.set(id, correct);
      latest.set(id, correct);
    });
  });
  return { first, latest };
}

// 最後に解いたときの回答が不正解・未回答だった問題を集める。復習で正解すれば、その問題は対象から外れる
function collectWrongQuestionIds() {
  const { latest } = collectQuestionResults();
  return [...latest].filter(([, correct]) => !correct).map(([id]) => id);
}

function startNewExam(desiredCount) {
  startExam(drawQuestionsForExam(desiredCount), EXAM_MODE_NORMAL);
}

function startReviewExam() {
  const questionIds = shuffleArray(collectWrongQuestionIds()).slice(0, EXAM_QUESTION_COUNT);
  if (questionIds.length === 0) return;
  startExam(questionIds, EXAM_MODE_REVIEW);
}

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

function resumeExam() {
  examState = loadExamState();
  enterExamView();
}

function enterExamView() {
  showView("exam");
  startTimerLoop();
  renderExamView();
}

function leaveExamView() {
  stopTimerLoop();
}

function selectAnswer(questionId, choiceIndex) {
  examState.answers[questionId] = choiceIndex;
  saveExamState(examState);
  renderExamView();
}

function goToQuestion(index) {
  examState.currentIndex = index;
  saveExamState(examState);
  renderExamView();
}

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

function computeRemainingMs(state) {
  return state.startTime + state.timeLimitMs - Date.now();
}

function isExamExpired(state) {
  return computeRemainingMs(state) <= 0;
}

function startTimerLoop() {
  stopTimerLoop();
  timerIntervalId = setInterval(tick, TIMER_TICK_MS);
  tick();
}

function stopTimerLoop() {
  if (timerIntervalId !== null) {
    clearInterval(timerIntervalId);
    timerIntervalId = null;
  }
}

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

function renderTimer(remainingMs) {
  examTimerEl.textContent = formatDuration(remainingMs);
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0");
}

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

// 分野ごとの { total, correct } から、分野別と総合の正答率・推定スコアを計算する
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

function generateHistoryId() {
  return Date.now();
}

function showView(viewName) {
  document.querySelectorAll(".view").forEach((el) => el.classList.remove("active"));
  document.getElementById("view-" + viewName).classList.add("active");
}

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
  const wrongCount = collectWrongQuestionIds().length;
  startReviewBtn.textContent = "間違えた問題を復習（" + wrongCount + "問）";
  startReviewBtn.disabled = wrongCount === 0;
  showView("start");
}

function renderExamView() {
  renderQuestionCard();
  renderJumpGrid();
  updateSubmitButtonState();
}

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

function updateSubmitButtonState() {
  const allAnswered = Object.values(examState.answers).every((a) => a !== null);
  submitExamBtn.disabled = !allAnswered;
}

function buildCategoryTableHtml(categoryBreakdown) {
  let html = "<tr><th>分野</th><th>正答数</th><th>正答率</th><th>推定スコア</th></tr>";
  CATEGORIES.forEach((cat) => {
    const data = categoryBreakdown[cat.code];
    html += "<tr><td>" + cat.label + "</td><td>" + data.correct + " / " + data.total + "</td><td>"
      + data.percentage.toFixed(1) + "%</td><td>" + data.scoreApprox + "</td></tr>";
  });
  return html;
}

// 本番の基準で合否を判定し、足りなかった項目の説明も返す
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

function createSvgElement(tagName, attributes) {
  const el = document.createElementNS(SVG_NS, tagName);
  for (const [name, value] of Object.entries(attributes)) {
    el.setAttribute(name, value);
  }
  return el;
}

// 直近の受験の総合正答率を折れ線グラフで描く。合格目安(60%)の線も引く
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

function deleteHistoryEntry(index) {
  if (!confirm("この履歴を削除しますか？")) return;
  const history = loadHistory();
  history.splice(index, 1);
  saveHistory(history);
  renderHistoryView();
}

function clearHistory() {
  if (!confirm("受験履歴をすべて削除しますか？この操作は元に戻せません。")) return;
  saveHistory([]);
  renderHistoryView();
}

// 分野別の一問一答。時間制限はなく、答えるたびに正誤と解説を見せる。
// 回答は mode: "practice" の履歴として1回分ずつ保存するので、間違えた問題は復習の対象にもなる
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

function showNextPracticeQuestion() {
  const progress = ensureProgressInitialized(loadQuestionProgress());
  const [id] = drawFromCategoryBag(progress, practiceState.category, 1);
  saveQuestionProgress(progress);
  practiceState.currentId = id;
  practiceState.answered = false;
  renderPracticeView();
}

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

function endPractice() {
  practiceState = null;
  renderStartView();
}

function showTransferMessage(text, isError) {
  historyTransferMessageEl.textContent = text;
  historyTransferMessageEl.classList.toggle("error", isError);
  historyTransferMessageEl.hidden = false;
}

function hideTransferMessage() {
  historyTransferMessageEl.hidden = true;
}

function buildHistoryExportFileName() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return "itpassport-history-" + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate())
    + "-" + pad(d.getHours()) + pad(d.getMinutes()) + ".json";
}

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

// 読み込むファイルは外から来るので、表示に使う項目がすべて正しい型か確かめる
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

function historyEntryKey(entry) {
  return entry.id + "|" + entry.date;
}

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

function createTextElement(tagName, className, text) {
  const el = document.createElement(tagName);
  el.className = className;
  el.textContent = text;
  return el;
}

function buildGlossaryItem(item, isFormula) {
  const details = document.createElement("details");
  details.className = "glossary-item";
  const summary = document.createElement("summary");
  const title = isFormula ? item.title : item.term + (item.reading ? "（" + item.reading + "）" : "");
  summary.appendChild(createTextElement("span", "glossary-title", title));
  summary.appendChild(createTextElement("span", "category-tag", CATEGORY_BY_CODE.get(item.category).label));
  details.appendChild(summary);
  if (isFormula) {
    details.appendChild(createTextElement("p", "glossary-formula", item.formula));
    details.appendChild(createTextElement("p", "glossary-text", item.note));
    details.appendChild(createTextElement("p", "glossary-example", "例：" + item.example));
  } else {
    details.appendChild(createTextElement("p", "glossary-text", item.description));
  }
  return details;
}

function renderGlossaryList() {
  const isFormula = glossaryFilter.tab === "formulas";
  const keyword = glossaryFilter.keyword.trim().toLowerCase();
  const items = (isFormula ? FORMULAS : GLOSSARY).filter((item) => {
    if (glossaryFilter.category !== "all" && item.category !== glossaryFilter.category) return false;
    if (!keyword) return true;
    const searchText = isFormula
      ? [item.title, item.formula, item.note, item.example]
      : [item.term, item.reading, item.description];
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

function renderGlossaryView() {
  renderGlossaryList();
  showView("glossary");
  window.scrollTo(0, 0);
}

// 問題ごとの正誤(Map: 問題ID → 正解したか)を、分野ごとの { total, correct } にまとめる
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

// 直近の模試(お試し10問も含む)を合わせて、本番の基準で推定スコアを出す。模試がなければ null
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

function toPercent(correct, total) {
  return total > 0 ? Math.round((correct / total) * 100) : 0;
}

function buildAnalysisCard(heading) {
  const card = document.createElement("div");
  card.className = "analysis-card";
  card.appendChild(createTextElement("h3", "", heading));
  analysisContentEl.appendChild(card);
  return card;
}

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

// 分野ごとの棒グラフを描き、いちばん正答率が低い分野を返す(解いた問題がなければ null)
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
