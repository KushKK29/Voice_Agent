// Cost estimates. Rates are USD per 1M tokens and are ASSUMPTIONS: set the real ones from
// https://ai.google.dev/pricing in .env. The free tier bills $0; this is the paid-equivalent.
const rate = (k, d) => Number(process.env[k] ?? d);
export const RATES = () => ({
  text_in: rate('RATE_TEXT_IN', 0.5), text_out: rate('RATE_TEXT_OUT', 2),
  audio_in: rate('RATE_AUDIO_IN', 3), audio_out: rate('RATE_AUDIO_OUT', 12),
  usd_inr: rate('USD_INR', 85),
});

const sumBy = (list, mod) => (list ?? []).filter((d) => d.modality === mod).reduce((n, d) => n + (d.tokenCount || 0), 0);

// Gemini usageMetadata -> token buckets. Unknown modality counts as text.
export function buckets(u = {}) {
  const audio_in = sumBy(u.promptTokensDetails, 'AUDIO');
  const audio_out = sumBy(u.responseTokensDetails, 'AUDIO');
  return {
    audio_in, audio_out,
    text_in: Math.max(0, (u.promptTokenCount || 0) - audio_in),
    text_out: Math.max(0, (u.responseTokenCount ?? u.candidatesTokenCount ?? 0) - audio_out) + (u.thoughtsTokenCount || 0),
  };
}

export function estimate(b) {
  const r = RATES();
  const usd = (b.text_in * r.text_in + b.text_out * r.text_out + b.audio_in * r.audio_in + b.audio_out * r.audio_out) / 1e6;
  return { ...b, usd: +usd.toFixed(5), inr: +(usd * r.usd_inr).toFixed(3) };
}

// Live sessions report running totals, so keep the highest value seen per bucket.
export const maxMerge = (a, b) => Object.fromEntries(Object.keys(a).map((k) => [k, Math.max(a[k], b[k])]));
export const addUp = (a, b) => Object.fromEntries(Object.keys(a).map((k) => [k, a[k] + b[k]]));
export const ZERO = { text_in: 0, text_out: 0, audio_in: 0, audio_out: 0 };
