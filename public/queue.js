const $ = (id) => document.getElementById(id);
const inr = (n) => '₹' + Math.round(n).toLocaleString('en-IN');
// Server data goes in via textContent only, never innerHTML.
const el = (tag, text, kids = [], cls) => { const e = document.createElement(tag); if (text) e.textContent = text; if (cls) e.className = cls; e.append(...kids); return e; };
const label = (s) => String(s).replace('_', ' ');

const fail = (m) => { $('msg').textContent = m; };

function caseView(c) {
  return el('div', '', [
    el('b', `${c.cause} · ${label(c.status)}`),
    el('div', c.action),
    el('ul', '', (c.history || []).map((h) => el('li', `${new Date(h.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · ${h.by}: ${h.note}`))),
  ], 'case');
}

function row(r, i) {
  const call = el('a', 'Call about this case', [], 'btn primary');
  call.href = `/?seller=${r.seller_id}&mode=outbound`;
  const acts = el('div', '', [call], 'acts');
  const sim = el('button', 'Simulate +7 days');
  sim.type = 'button';
  sim.onclick = async () => {
    sim.disabled = true;
    const res = await fetch(`/api/simulate?seller=${r.seller_id}`, { method: 'POST' });
    if (!res.ok) fail((await res.json().catch(() => ({}))).error || 'Could not simulate.');
    load();
  };
  acts.append(sim);
  if (r.has_outcome) {
    const f = el('a', 'Follow-up call (simulated)', [], 'btn primary');
    f.href = `/?seller=${r.seller_id}&mode=followup`;
    acts.append(f);
  }
  const why = el('div', '', [
    el('div', r.sentence),
    ...(r.healthy ? [] : [el('div', `Next: ${r.next_action}. ${r.impact_kind === 'estimate' ? 'Estimated gain' : 'At most'} ${inr(r.impact)} · ${r.effort} effort · within ${r.due_days} days`, [], 'next')]),
  ], 'why');
  return el('article', '', [
    el('div', '', [
      el('div', String(i + 1), [], 'rank'),
      el('div', '', [el('b', r.name), el('span', `${r.city} · ${r.owner}`)], 'who'),
      el('div', '', [el('b', r.healthy ? '₹0' : inr(r.value_at_risk)), el('span', 'delivered value lost this month')], 'risk'),
      why,
      el('span', label(r.status), [], `chip ${r.status}`),
    ], 'top'),
    acts,
    ...(r.cases?.length ? [el('details', '', [el('summary', `Case history (${r.cases.length})`), ...r.cases.map(caseView)])] : []),
  ], 'row');
}

async function load() {
  try {
    const rows = await (await fetch('/api/queue')).json();
    if (!Array.isArray(rows)) throw new Error('bad response');
    $('rows').replaceChildren(...rows.map(row));
  } catch {
    fail('Could not load the queue. Is the server running and seeded?');
  }
}

$('reset').onclick = async () => {
  $('msg').textContent = '';
  await fetch('/api/reset', { method: 'POST' });
  load();
};
load();
