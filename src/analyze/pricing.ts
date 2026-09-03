import type { TurnUsage } from '../sources/types.js';

export interface ModelPrice {
  /** USD per 1M input tokens */
  inputPerM: number;
  /** USD per 1M cached input tokens */
  cacheReadPerM: number;
  /** USD per 1M output tokens */
  outputPerM: number;
  /**
   * true when `input_tokens` excludes cached tokens (deepseek-style: cache read
   * is reported separately and additively); false when `input_tokens` includes
   * the cached portion (Anthropic-style: fresh = input - cacheRead).
   */
  cacheIsAdditive: boolean;
}

// Approximate 2026 list prices (USD / 1M tokens). Defaults only; override via
// config. `cacheIsAdditive` matters a lot: mixing up the two accounting styles
// wildly misprices cached reads.
const PRICES: Array<{ match: (m: string) => boolean; price: ModelPrice }> = [
  { match: (m) => m.includes('opus'), price: { inputPerM: 15, cacheReadPerM: 1.5, outputPerM: 75, cacheIsAdditive: false } },
  { match: (m) => m.includes('sonnet'), price: { inputPerM: 3, cacheReadPerM: 0.3, outputPerM: 15, cacheIsAdditive: false } },
  { match: (m) => m.includes('haiku'), price: { inputPerM: 1, cacheReadPerM: 0.1, outputPerM: 5, cacheIsAdditive: false } },
  { match: (m) => m.includes('gpt-4o') || m.includes('gpt-4.1'), price: { inputPerM: 2.5, cacheReadPerM: 1.25, outputPerM: 10, cacheIsAdditive: false } },
  { match: (m) => m.includes('gpt-5'), price: { inputPerM: 1.25, cacheReadPerM: 0.6, outputPerM: 10, cacheIsAdditive: false } },
  { match: (m) => m.includes('gemini'), price: { inputPerM: 1.25, cacheReadPerM: 0.3, outputPerM: 10, cacheIsAdditive: false } },
  { match: (m) => m.includes('deepseek'), price: { inputPerM: 0.27, cacheReadPerM: 0.014, outputPerM: 1.1, cacheIsAdditive: true } },
  { match: (m) => m.includes('mimo'), price: { inputPerM: 0.5, cacheReadPerM: 0.05, outputPerM: 2, cacheIsAdditive: true } },
];

export function lookupPrice(model: string): ModelPrice {
  const m = model.toLowerCase();
  for (const { match, price } of PRICES) {
    if (match(m)) return price;
  }
  return PRICES[1].price; // sonnet as generic default
}

/** true when `model` matches a built-in price entry (i.e. cost is not a guess). */
export function isModelPriced(model: string): boolean {
  const m = model.toLowerCase();
  return PRICES.some(({ match }) => match(m));
}

export function turnCost(usage: TurnUsage, price: ModelPrice): number {
  let fresh = usage.input;
  let cached = 0;
  if (price.cacheIsAdditive) {
    cached = usage.cacheRead;
  } else {
    cached = Math.min(usage.cacheRead, usage.input);
    fresh = usage.input - cached;
  }
  return (
    (fresh / 1_000_000) * price.inputPerM +
    (cached / 1_000_000) * price.cacheReadPerM +
    (usage.output / 1_000_000) * price.outputPerM
  );
}
