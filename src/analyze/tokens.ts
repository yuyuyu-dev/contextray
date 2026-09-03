// Zero-dependency heuristic token counter. Only used for component *attribution*:
// per-turn totals always come from the real `usage` field, so approximation error
// is absorbed into ratios, never into totals. Heuristic: 1 token per CJK char,
// ~1 token per 4 chars otherwise (matches typical English tokenizer density).
const CJK_RE = /[　-鿿＀-￯]/g;

export function countTokens(text: string): number {
  if (!text) return 0;
  const cjk = text.match(CJK_RE)?.length ?? 0;
  const other = text.length - cjk;
  return Math.ceil(other / 4) + cjk;
}
