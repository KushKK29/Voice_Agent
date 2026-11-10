import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, forecast } from './analyze.js';
import { SELLERS } from './data.js';

const [s1, s2] = SELLERS;

test('S1001 derived numbers match the PRD', () => {
  const r = analyze(s1);
  assert.equal(r.sales_change_pct, -32.5);
  assert.equal(r.orders_change_pct, -32.5);
  assert.equal(r.cancel_rate_change_pp, 6);
  assert.equal(r.oos_multiple, 3.6);
  assert.equal(r.net_orders.this_month, 232);
  assert.equal(r.net_value_drop, 68000);
  assert.equal(r.sales_drop, 65000);
  assert.equal(r.orders_gap, 130);
  assert.equal(r.volume_driven, true);
});

test('S1001: the top out-of-stock products explain most of the lost orders', () => {
  assert.equal(analyze(s1).top_oos_lost_orders, 87);
});

test('S1001 decline is sudden: five stable months, then a fall', () => {
  assert.equal(analyze(s1).sudden_drop, true);
  assert.equal(analyze(s2).sudden_drop, false);
});

test('S1001 forecast scenarios are deterministic estimates', () => {
  const f = forecast(s1);
  const by = Object.fromEntries(f.scenarios.map((s) => [s.key, s.gain_vs_now]));
  assert.equal(f.current_net_value, 116000);
  assert.deepEqual(by, { cancel_to_8: 8000, restock_top_oos: 37500, restock_and_cancel: 48000, full_recovery: 68000 });
});

test('S1001 blames inventory first, then cancellations, never price', () => {
  const keys = analyze(s1).findings.map((f) => f.key);
  assert.deepEqual(keys, ['inventory', 'cancellations']);
});

test('S1002 is a price problem, not inventory', () => {
  const r = analyze(s2);
  assert.deepEqual(r.findings.map((f) => f.key), ['price']);
  assert.equal(r.volume_driven, false);
});

test('every finding carries evidence and an action', () => {
  for (const f of analyze(s1).findings) {
    assert.ok(f.evidence && f.action && f.severity);
  }
});

test('scaled sample sellers each get the diagnosis their data implies', async () => {
  const { SELLERS } = await import('./data.js');
  const keys = Object.fromEntries(SELLERS.map((s) => [s._id, analyze(s).findings.map((f) => f.key)]));
  assert.equal(SELLERS.length, 5);
  assert.deepEqual(keys.S1003, ['cancellations']);
  assert.deepEqual(keys.S1004, ['visibility']);
  assert.deepEqual(keys.S1005, ['inventory', 'price']);
  assert.equal(SELLERS[0].products.length, 60);
});
