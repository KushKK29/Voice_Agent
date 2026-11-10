import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buckets, estimate, maxMerge, ZERO } from './cost.js';

test('buckets split audio from text and cost is rate x tokens', () => {
  const b = buckets({ promptTokenCount: 1000, promptTokensDetails: [{ modality: 'AUDIO', tokenCount: 600 }], responseTokenCount: 500, responseTokensDetails: [{ modality: 'AUDIO', tokenCount: 500 }] });
  assert.deepEqual(b, { audio_in: 600, audio_out: 500, text_in: 400, text_out: 0 });
  const e = estimate(b);
  assert.equal(e.usd, +((400 * 0.5 + 600 * 3 + 500 * 12) / 1e6).toFixed(5));
  assert.ok(e.inr > 0);
});

test('running totals are not double counted, odd input does not throw', () => {
  const a = maxMerge(ZERO, { text_in: 10, text_out: 0, audio_in: 5, audio_out: 0 });
  assert.equal(maxMerge(a, { text_in: 8, text_out: 1, audio_in: 9, audio_out: 0 }).audio_in, 9);
  assert.equal(maxMerge(a, { text_in: 8, text_out: 1, audio_in: 9, audio_out: 0 }).text_in, 10);
  assert.deepEqual(buckets(), ZERO);
});
