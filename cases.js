// The ownership layer: cases, the attention queue, the approval gate and the +7-day simulation.
// Pure functions. All rupee figures come from analyze.js maths, never from the model.
import { analyze, forecast } from './analyze.js';

const PLAYBOOK = { // cause -> what to do, effort, days to do it
  inventory: { action: 'Restock the top out-of-stock products within 72 hours', effort: 'medium', due_days: 3 },
  cancellations: { action: 'Update panel stock daily and switch off zero-stock listings', effort: 'low', due_days: 14 },
  price: { action: 'Compare competitor prices on the top products and test a smaller price rise', effort: 'low', due_days: 7 },
  visibility: { action: 'Fix titles, images and keywords on the best-selling listings and check search ranking', effort: 'medium', due_days: 14 },
};
const SCENARIO = { inventory: 'restock_top_oos', cancellations: 'cancel_to_8' }; // causes with a forecast estimate

const net = (m) => m.orders - Math.round(m.orders * m.cancel_rate);
const netValue = (m) => net(m) * m.asp;
const oosProducts = (s) => (s.products || []).filter((p) => p.stock === 0).sort((a, b) => b.last_month_orders - a.last_month_orders);

// One case per cause. impact = estimate (from the forecast) or an upper bound (the whole loss) when no forecast exists.
export function caseDrafts(seller) {
  const a = analyze(seller);
  if (a.net_value_drop <= 0) return [];
  const f = forecast(seller);
  return a.findings.map((x) => {
    const sc = f.scenarios.find((s) => s.key === SCENARIO[x.key]);
    const estimate = !!sc;
    return {
      seller_id: seller._id, cause: x.key, evidence: x.evidence, value_at_risk: a.net_value_drop,
      ...PLAYBOOK[x.key],
      impact: estimate ? Math.min(sc.gain_vs_now, a.net_value_drop) : a.net_value_drop, // ponytail: cap so a recovery never exceeds the loss
      impact_kind: estimate ? 'estimate' : 'upper_bound',
      owner: 'saathi', status: 'open', history: [],
    };
  });
}

// Estimates beat upper bounds, then bigger first.
export const bestFirst = (drafts) => [...drafts].sort((x, y) => (y.impact_kind === 'estimate') - (x.impact_kind === 'estimate') || y.impact - x.impact);

const STATUS_RANK = ['escalated', 'in_progress', 'improving', 'open']; // most urgent shown for a seller with several cases
export function queue(sellers, cases = []) {
  return sellers.map((s) => {
    const best = bestFirst(caseDrafts(s))[0];
    const own = cases.filter((c) => c.seller_id === s._id);
    const base = { seller_id: s._id, name: s.name, owner: s.owner, city: s.city, status: own.length ? own.map((c) => c.status).sort((x, y) => STATUS_RANK.indexOf(x) - STATUS_RANK.indexOf(y))[0] : best ? 'open' : 'healthy', cases: own };
    if (!best) return { ...base, healthy: true, value_at_risk: 0, sentence: 'No problem found in the data.' };
    return {
      ...base, value_at_risk: best.value_at_risk, top_cause: best.cause, sentence: best.evidence,
      next_action: best.action, impact: best.impact, impact_kind: best.impact_kind, effort: best.effort, due_days: best.due_days,
    };
  }).sort((x, y) => y.value_at_risk - x.value_at_risk);
}

// Approval is decided here, from the seller's own words, not by the model.
const NO = /\b(no|nahi|nahin|nope|don'?t|not|maybe|later|wait|hold|think|baad)\b/;
const YES = /\b(yes|yeah|yep|haan|han|ha|ok|okay|sure|go ahead|do it|kar do|karo|approve|approved|theek hai|please do|raise|raise it|place it|send it)\b/;
export const isApproval = (t) => { const x = String(t ?? '').toLowerCase(); return x.split(/\s+/).length <= 12 && !NO.test(x) && YES.test(x); };

export const restockItems = (s) => oosProducts(s).slice(0, 3);

const snap = (m) => ({ orders: m.orders, cancel_rate: m.cancel_rate, oos: m.oos, net_value: netValue(m) });

// +7 days. If the seller approved a restock the top 3 items come back and cancellations ease 3 points; otherwise nothing moves.
// Every figure is simulated, and the outcome says so.
export function simulate(seller, acted) {
  const s = structuredClone(seller);
  const T = s.metrics.this_month;
  const L = s.metrics.last_month;
  const before = snap(T);
  const restocked = [];
  if (acted) {
    for (const p of oosProducts(s).slice(0, 3)) {
      const back = Math.round(p.last_month_orders * 0.8);
      T.orders += back - p.this_month_orders;
      p.this_month_orders = back;
      p.stock = 40;
      restocked.push(p.name);
    }
    if (restocked.length) {
      T.oos -= restocked.length;
      T.cancel_rate = Math.round(Math.max(L.cancel_rate, T.cancel_rate - 0.03) * 100) / 100;
      T.sales = T.orders * T.asp;
    }
    s.simulated = { day: 7, acted: true };
  }
  const after = snap(T);
  return {
    seller: s,
    outcome: {
      simulated: true, acted: !!restocked.length, before, after, restocked,
      still_open: oosProducts(s).slice(0, 5).map((p) => p.name),
      recovered_value: after.net_value - before.net_value,
    },
  };
}
