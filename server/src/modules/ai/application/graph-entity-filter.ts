// 知识图谱实体启发式过滤器。
//
// graph-weaver-service.extractEntities 在 LLM 不可用时退化为切词启发式，
// 当前会把 "10000"、"m²"、"is"、"are"、"换成" 等噪声片段当成图谱节点写进
// SQLite。这些节点权重和真实概念节点拼在一起，让 dashboard 上的
// "知识图谱热点" top N 经常被低语义片段占据。
//
// 这个 filter 只做"明显的反模式"过滤——保守起见不做语义判断：
// - 纯数字 / 数字+单位（10000、3.14）
// - 单字符到三字符的纯英文（is / are / be / am）
// - 物理化学单位（m / cm / m² / dm³ / kg / mm）
// - 单符号 / 标点片段
//
// 中文保留。即便是带数字的"3 月 8 日"也会被英文 stopword 不命中，
// 但首字符 ≥ 2 的中文名（"中点"、"辅助线"、"几何"）一律保留。
//
// 注意：当 LLM 路径可用时这个 filter 不参与决策；它只是 heuristic
// fallback 的兜底净化层。

const ENGLISH_STOPWORDS = new Set([
  'is', 'are', 'am', 'be', 'was', 'were', 'been', 'being',
  'do', 'does', 'did', 'has', 'have', 'had',
  'a', 'an', 'the', 'this', 'that', 'these', 'those',
  'and', 'or', 'but', 'so', 'if', 'as',
  'in', 'on', 'at', 'to', 'for', 'of', 'by', 'with', 'from',
  'i', 'you', 'he', 'she', 'we', 'they', 'it', 'me', 'us', 'them',
  'his', 'her', 'their', 'our', 'my', 'your',
]);

// 物理/数学/化学/几何常见单位与符号，避免把它们当成节点。
// 关注高频噪声：m, cm, mm, dm, m², cm², dm³, kg, g, ml, l。
const UNIT_PATTERN = /^[a-zA-Z]{1,3}[²³]?$/;

const PURE_NUMBER = /^-?\d+(?:[.,]\d+)?$/;
// 至少包含一个英文字母或一个中文字符；否则视为纯符号/空白片段。
// 注意 JS 默认 \w 不含中文，所以不能用 /^[\W_]+$/ 直接判定（会误伤 "中点"）。
const HAS_LETTER_OR_CHINESE = /[A-Za-z一-鿿]/;

export const isMeaningfulGraphEntity = (raw: string): boolean => {
  if (!raw) return false;
  const trimmed = raw.trim();
  if (trimmed.length < 2) return false;
  if (PURE_NUMBER.test(trimmed)) return false;
  if (!HAS_LETTER_OR_CHINESE.test(trimmed)) return false;

  // 全英文且短：扔进 stopword + 单位过滤。
  if (/^[a-zA-Z]+$/.test(trimmed)) {
    if (ENGLISH_STOPWORDS.has(trimmed.toLowerCase())) return false;
    if (UNIT_PATTERN.test(trimmed)) return false;
    if (trimmed.length <= 2) return false;
  }

  // 含数字但又不是单位：仅当包含 ≥1 个非数字非空白字符且 ≥2 个有意义字符时保留。
  // 例如 "x²"、"m²"、"3kg"、"100" 都希望被排除。
  if (/^[a-zA-Z]*[\d²³]+[a-zA-Z]*$/.test(trimmed)) return false;

  return true;
};

export const filterGraphEntities = (entities: string[]): string[] => (
  entities.filter(isMeaningfulGraphEntity)
);
