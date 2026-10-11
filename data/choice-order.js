/**
 * choice-order.js
 * ------------------------------------------------------------
 * 役割: 選択肢の並び（ア〜エ の順）をランダムに入れ替えるための部品。
 *   同じ問題を何回も解いたときに、答えの位置で覚えてしまわないようにする。
 * 読み方:
 *   isChoiceOrderLocked(q)    … 入れ替えてはいけない問題か調べる
 *   makeChoiceOrder(q)        … 画面に出す並び順を1つ作る
 *   getChoiceOrder(q, orders) … 記録した並び順を取り出す（なければ元の順）
 * 考え方: 「正解の番号」や「選んだ番号」は、いつも元の番号（data の choices の順）で持つ。
 *   入れ替えるのは画面に出す順番だけなので、採点や履歴の計算は変わらない。
 * ------------------------------------------------------------
 */

// 解説・選択肢・問題文が「ア」「イ」…の記号に触れているときは、入れ替えると意味が変わるので固定する
const CHOICE_LABEL_MENTION = /(^|[^ァ-ヶー])[アイウエ]([^ァ-ヶー]|$)/;
// 「いずれも」「上記」など、ほかの選択肢を指す言い方
const CHOICE_REFERENCE_WORDS = /(いずれも|どれも|上記|前述|どれでもない|選択肢)/;

/**
 * 選択肢を入れ替えてはいけない問題かどうかを調べる。
 * 次のどれかに当てはまると固定する（並びを変えると、解説や選択肢の意味が合わなくなる）。
 *  ・解説が「アは〜」のように記号に触れている
 *  ・問題文が記号に触れている
 *  ・選択肢が「アとイ」「いずれも」のように、ほかの選択肢を指している
 * @param {Object} question - 問題（text / choices / explanation を持つ）
 * @returns {boolean} 固定するなら true
 */
function isChoiceOrderLocked(question) {
  if (CHOICE_LABEL_MENTION.test(question.explanation || "")) return true;
  if (CHOICE_LABEL_MENTION.test(question.text || "")) return true;
  if (CHOICE_REFERENCE_WORDS.test(question.explanation || "")) return true;
  return question.choices.some(
    (choice) => CHOICE_LABEL_MENTION.test(choice) || CHOICE_REFERENCE_WORDS.test(choice)
  );
}

/**
 * 画面に出す選択肢の並び順を1つ作る。
 * @param {Object} question - 問題
 * @returns {number[]} 元の番号（0から数える）を、画面に出す順に並べた配列。
 *   例: [2, 0, 3, 1] なら、1番目に元の3つ目、2番目に元の1つ目…を出す。固定する問題は [0, 1, 2, 3]
 */
function makeChoiceOrder(question) {
  const order = question.choices.map((_, index) => index);
  if (isChoiceOrderLocked(question)) return order;
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/**
 * 問題ごとの並び順をまとめて作る。
 * @param {string[]} questionIds - 問題IDの一覧
 * @param {Map<string, Object>} questionsById - 問題IDから問題を引ける表
 * @returns {Object<string, number[]>} 問題ID → 並び順
 */
function makeChoiceOrders(questionIds, questionsById) {
  const orders = {};
  for (const id of questionIds) {
    const question = questionsById.get(id);
    if (question) orders[id] = makeChoiceOrder(question);
  }
  return orders;
}

/**
 * 記録してある並び順を取り出す。記録がない・壊れているときは、元の順番を返す。
 * （古い履歴や、読み込んだファイルにも対応するため）
 * @param {Object} question - 問題
 * @param {Object<string, number[]>} [orders] - 問題ID → 並び順の記録
 * @returns {number[]} 元の番号を、画面に出す順に並べた配列
 */
function getChoiceOrder(question, orders) {
  const count = question.choices.length;
  const order = orders && orders[question.id];
  const valid = Array.isArray(order) && order.length === count
    && new Set(order).size === count && order.every((n) => Number.isInteger(n) && n >= 0 && n < count);
  return valid ? order : question.choices.map((_, index) => index);
}
