/**
 * similar-groups.js
 * ------------------------------------------------------------
 * 役割: 「同じ内容を聞いている問題」をグループにまとめた表。
 * 読み方: SIMILAR_QUESTION_GROUPS の中の [ ] 1つが1グループ。
 *   同じグループの問題は、1回の試験に1問までしか出さない。
 *   （例: OSS を聞く問題が年度をまたいで5問あるので、模試には1問だけ入れる）
 * 作り方: 文章の似かたを機械で調べて候補を出し、人が内容を見て決めた。
 *   新しい年度の問題を足したら、似た問題がないか見て、ここに書き足す。
 *   グループの中の問題は、すべて同じ分野（ストラテジ系など）にそろえること。
 *   （scripts/check_questions.py が、IDの間違いや分野のちがいを点検する）
 * ------------------------------------------------------------
 */
const SIMILAR_QUESTION_GROUPS = [
  // ---- ストラテジ・マネジメントなど（ID の分野は check_questions.py で確認） ----
  ["R05_Q82", "R06_Q80", "R07_Q96", "R08_Q73", "R08_Q97"], // OSS（ライセンス・再配布）
  ["R05_Q56", "R06_Q82"], // ISMSクラウドセキュリティ認証
  ["R05_Q94", "R07_Q84"], // ISMSの情報セキュリティ方針
  ["R05_Q40", "R06_Q47"], // DevOps
  ["R05_Q05", "R07_Q24", "R08_Q22"], // RPA
  ["R06_Q18", "R07_Q23"], // コーポレートガバナンス
  ["R06_Q02", "R08_Q21"], // サイバーセキュリティ基本法
  ["R05_Q15", "R07_Q16"], // 不正アクセス禁止法
  ["R05_Q36", "R08_Q42"], // サービスデスク
  ["R06_Q46", "R08_Q46"], // 問題管理
  ["R06_Q86", "R07_Q83"], // PDCA・是正処置
  ["R05_Q72", "R06_Q64", "R07_Q91"], // リスク対応
  ["R05_Q95", "R06_Q75", "R07_Q97"], // 機密性・完全性・可用性
  ["R07_Q88", "R08_Q94"], // 情報セキュリティ対策の分類
  ["R07_Q93", "R08_Q89"], // 脆弱性と脅威
  ["R06_Q98", "R07_Q92", "R08_Q63"], // ランサムウェア
  ["R05_Q81", "R06_Q91"], // 廃棄・データ消去
  ["R05_Q99", "R06_Q72", "R07_Q69", "R08_Q80"], // 生体認証（バイオメトリクス）
  ["R07_Q90", "R08_Q59"], // 無線LANの安全対策
  // ---- テクノロジ系 ----
  ["R06_Q96", "R08_Q75"], // 電子メール（To・Cc・Bcc）
  ["R05_Q60", "R08_Q67"], // プログラム（配列と繰り返し）
  ["R06_Q25", "R07_Q19"], // AR
  ["R06_Q67", "R07_Q94"], // 稼働率（並列）
  ["R05_Q66", "R06_Q74", "R08_Q56"], // コミットとロールバック
  ["R06_Q79", "R07_Q57"], // プロキシサーバ
  ["R07_Q56", "R08_Q81"], // Bluetooth
  ["R06_Q59", "R07_Q81"], // OCR
  ["R05_Q63", "R06_Q69"] // RAIDの容量計算
];

/**
 * 問題IDから、その問題が入っているグループの番号を引けるようにした表。
 * グループに入っていない問題は載っていない。
 * @type {Map<string, number>}
 */
const SIMILAR_GROUP_INDEX_BY_ID = new Map();
SIMILAR_QUESTION_GROUPS.forEach((ids, index) => {
  ids.forEach((id) => SIMILAR_GROUP_INDEX_BY_ID.set(id, index));
});

/**
 * 問題が入っているグループの番号を返す。
 * @param {string} id - 問題ID
 * @returns {number|null} グループの番号。どのグループにも入っていなければ null
 */
function getSimilarGroupIndex(id) {
  return SIMILAR_GROUP_INDEX_BY_ID.has(id) ? SIMILAR_GROUP_INDEX_BY_ID.get(id) : null;
}

/**
 * 同じグループに入っている、ほかの問題のIDを返す。
 * @param {string} id - 問題ID
 * @returns {string[]} 似た問題のID（自分は含まない）。なければ空の配列
 */
function getSimilarQuestionIds(id) {
  const index = getSimilarGroupIndex(id);
  return index === null ? [] : SIMILAR_QUESTION_GROUPS[index].filter((other) => other !== id);
}
