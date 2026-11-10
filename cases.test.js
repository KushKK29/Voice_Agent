import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SELLERS } from './data.js';
import { caseDrafts, queue, isApproval, restockItems, simulate } from './cases.js';

const [s1, s2, s3, s4, s5] = SELLERS;

test('queue ranks sellers by value at risk, highest first', () => {
  const q = queue(SELLERS);
  assert.deepEqual(q.map((r) => r.seller_id), ['S1001', 'S1005', 'S1004', 'S1003', 'S1002']);
  assert.deepEqual(q.map((r) => r.value_at_risk), [68000, 50100, 42300, 30000, 18400]);
});

test('every queue row has cause, sentence, next action, impact and deadline', () => {
  for (const r of queue(SELLERS)) {
    for (const k of ['top_cause', 'sentence', 'next_action', 'due_days']) assert.ok(r[k], `${r.seller_id} ${k}`);
    assert.ok(r.impact > 0, r.seller_id);
  }
});

test('next best action: estimates first; restock for stock sellers, price action for Meena', () => {
  const by = Object.fromEntries(queue(SELLERS).map((r) => [r.seller_id, r]));
  assert.equal(by.S1001.top_cause, 'inventory');
  assert.match(by.S1001.next_action, /Restock/);
  assert.equal(by.S1001.impact, 37500);
  assert.equal(by.S1001.impact_kind, 'estimate');
  assert.equal(by.S1005.top_cause, 'inventory');
  assert.equal(by.S1002.top_cause, 'price');
  assert.doesNotMatch(by.S1002.next_action, /Restock/);
  assert.equal(by.S1002.impact_kind, 'upper_bound');
});

test('one case per cause, each complete (ownership)', () => {
  const d = caseDrafts(s1);
  assert.deepEqual(d.map((c) => c.cause), ['inventory', 'cancellations']);
  for (const c of d) {
    assert.equal(c.status, 'open');
    assert.equal(c.owner, 'saathi');
    for (const k of ['evidence', 'action', 'effort']) assert.ok(c[k], k);
    assert.ok(c.impact > 0 && c.due_days > 0);
  }
});

test('healthy seller sits at the bottom with no invented problem', () => {
  const healthy = { ...structuredClone(s2), _id: 'H1', name: 'Healthy', metrics: { last_month: { sales: 100000, orders: 200, cancel_rate: 0.05, asp: 500, oos: 2 }, this_month: { sales: 110000, orders: 220, cancel_rate: 0.05, asp: 500, oos: 2 } }, visibility: undefined };
  const q = queue([healthy, s1]);
  assert.equal(q.at(-1).seller_id, 'H1');
  assert.equal(q.at(-1).healthy, true);
  assert.equal(caseDrafts(healthy).length, 0);
});

test('approval is decided in code from the seller words', () => {
  for (const t of ['yes', 'Yes please do it', 'haan kar do', 'okay go ahead', 'sure', 'Please raise a request a restock request for these items', 'raise it', 'place it', 'send it']) assert.equal(isApproval(t), true, t);
  for (const t of ['no', 'maybe later', 'nahi', 'not now', "don't", 'let me think', '', undefined, 'what will it cost', 'yes but not now']) assert.equal(isApproval(t), false, String(t));
});

test('restock request lists the top out-of-stock products only', () => {
  const items = restockItems(s1);
  assert.deepEqual(items.map((p) => p.name).slice(0, 3), ['Steel Lunch Box Set', 'Insulated Water Bottle 1L', 'Kitchen Knife Set']);
  assert.equal(items.length, 3, 'the bot says top 3, the action lists 3');
});

test('simulate +7 days: acted restores stock and recovers value; declined changes nothing', () => {
  const acted = simulate(s1, true);
  assert.equal(acted.outcome.simulated, true);
  assert.equal(acted.outcome.restocked.length, 3);
  assert.equal(acted.outcome.after.oos, 15);
  assert.equal(acted.outcome.after.cancel_rate, 0.11);
  assert.equal(acted.outcome.recovered_value, 25000);
  assert.equal(acted.outcome.still_open.length, 2);
  assert.equal(acted.seller.metrics.this_month.orders, 317);
  assert.equal(s1.metrics.this_month.orders, 270, 'input not mutated');

  const declined = simulate(s1, false);
  assert.equal(declined.outcome.recovered_value, 0);
  assert.equal(declined.outcome.restocked.length, 0);
  assert.equal(declined.seller.metrics.this_month.orders, 270);
});

test('after a simulated recovery the queue order and value at risk update', () => {
  const { seller } = simulate(s1, true);
  const q = queue([seller, s2, s3, s4, s5]);
  assert.ok(q.find((r) => r.seller_id === 'S1001').value_at_risk < 68000);
  assert.notEqual(q[0].seller_id, 'S1001');
});
