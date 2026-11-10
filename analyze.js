// Deterministic diagnosis. The LLM narrates these numbers and never does maths itself.
export const r1 = (n) => Math.round(n * 10) / 10;
export const pct = (a, b) => r1(((b - a) / a) * 100);
const net = (m) => m.orders - Math.round(m.orders * m.cancel_rate);
const rank = { high: 0, medium: 1 };
// orders lost on the products that are out of stock now (sample product data)
const oosLost = (s) => (s.products || []).filter((p) => p.stock === 0).reduce((n, p) => n + p.last_month_orders - p.this_month_orders, 0);

// Recovery estimates. Assumes recovered orders sell at last month's pace. Estimates only.
export function forecast(seller) {
  const L = seller.metrics.last_month;
  const T = seller.metrics.this_month;
  const now = net(T) * T.asp;
  const scenario = (key, label, orders, rate) => {
    const n = orders - Math.round(orders * rate);
    return { key, label, net_orders: n, net_value: n * T.asp, gain_vs_now: n * T.asp - now };
  };
  const back = T.orders + oosLost(seller);
  return {
    current_net_value: now,
    scenarios: [
      scenario('cancel_to_8', "Bring cancellations back to last month's rate", T.orders, L.cancel_rate),
      scenario('restock_top_oos', 'Restock the top out-of-stock products', back, T.cancel_rate),
      scenario('restock_and_cancel', 'Restock the top out-of-stock products and fix cancellations', back, L.cancel_rate),
      scenario('full_recovery', "Fully back to last month's level", L.orders, L.cancel_rate),
    ],
  };
}

export function analyze(seller) {
  const L = seller.metrics.last_month;
  const T = seller.metrics.this_month;
  const aspChange = pct(L.asp, T.asp);
  const cancelPp = r1((T.cancel_rate - L.cancel_rate) * 100);
  const oosShare = T.oos / seller.active_skus;
  const findings = [];

  if (T.oos / L.oos - 1 > 0.5 || oosShare > 0.15) {
    findings.push({
      key: 'inventory',
      severity: oosShare > 0.15 ? 'high' : 'medium',
      evidence: `Out-of-stock products rose from ${L.oos} to ${T.oos} (${Math.round(oosShare * 100)}% of ${seller.active_skus} active products).`,
      action: 'Restock the top out-of-stock products by last-month orders within 48-72 hours and set reorder alerts.',
    });
  }
  if (T.cancel_rate > 0.1 || cancelPp >= 3) {
    findings.push({
      key: 'cancellations',
      severity: T.cancel_rate > 0.1 ? 'high' : 'medium',
      evidence: `Cancellation rate rose from ${L.cancel_rate * 100}% to ${T.cancel_rate * 100}% (+${cancelPp} points).`,
      action: 'Update panel stock daily, switch off listings at zero stock, target under 8% within 2 weeks.',
    });
  }
  if (Math.abs(aspChange) > 10) {
    findings.push({
      key: 'price',
      severity: 'high',
      evidence: `Average selling price moved from Rs ${L.asp} to Rs ${T.asp} (${aspChange}%).`,
      action: 'Check competitor prices on the top products and test a smaller price rise.',
    });
  }
  // visibility: only when impressions fall by more than 40% (sample traffic data)
  const v = seller.visibility;
  if (v && v.this_month.impressions < v.last_month.impressions * 0.6) {
    findings.push({
      key: 'visibility',
      severity: 'high',
      evidence: `Impressions fell from ${v.last_month.impressions} to ${v.this_month.impressions} (${pct(v.last_month.impressions, v.this_month.impressions)}%) while the click rate held (sample data).`,
      action: 'Check listing quality (titles, images, keywords), search ranking and ad visibility; restore the best-selling listings first.',
    });
  }
  findings.sort((a, b) => rank[a.severity] - rank[b.severity]);

  // sudden = earlier months within 10% of each other, then this month well below all of them (sample history)
  const hist = (seller.monthly_sales || []).filter((m) => m.ago > 0).map((m) => m.sales);
  const lo = Math.min(...hist);
  const sudden = hist.length ? (Math.max(...hist) - lo) / lo < 0.1 && T.sales < lo * 0.8 : null;

  return {
    seller_id: seller._id,
    sales_drop: L.sales - T.sales,
    sales_change_pct: pct(L.sales, T.sales),
    orders_change_pct: pct(L.orders, T.orders),
    orders_gap: L.orders - T.orders,
    top_oos_lost_orders: oosLost(seller),
    asp_change_pct: aspChange,
    cancel_rate_change_pp: cancelPp,
    oos_multiple: r1(T.oos / L.oos),
    oos_share_pct: Math.round(oosShare * 100),
    net_orders: { last_month: net(L), this_month: net(T) },
    net_value_drop: net(L) * L.asp - net(T) * T.asp,
    volume_driven: Math.abs(aspChange) < 5,
    sudden_drop: sudden,
    findings,
  };
}
