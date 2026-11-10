const $ = (id) => document.getElementById(id);
const inr = (n) => '₹' + n.toLocaleString('en-IN');
const ROWS = [ // [label, key (matches a finding), formatter]
  ['Sales', null, (m) => inr(m.sales)],
  ['Orders', null, (m) => m.orders],
  ['Cancellation rate', 'cancellations', (m) => Math.round(m.cancel_rate * 100) + '%'],
  ['Average selling price', 'price', (m) => inr(m.asp)],
  ['Out-of-stock products', 'inventory', (m) => m.oos],
];
const Q = new URLSearchParams(location.search);
const MODE = ['outbound', 'followup'].includes(Q.get('mode')) ? Q.get('mode') : '';
const GATE = 0.04; // mic loudness (0..1 RMS) needed to count as speech while the bot is talking
let sellers = [], ws, stream, capCtx, playCtx, sources = [], nextT = 0, planText = '';

const LABEL = { listening: 'Listening', speaking: 'Saathi is speaking', thinking: 'Thinking', connecting: 'Connecting' };
const setState = (s) => { $('state').textContent = s; $('state').dataset.s = s; $('orb').dataset.s = s; $('cap-label').textContent = LABEL[s] || ''; };
const fail = (msg) => { $('msg').textContent = msg; };

function renderSeller() {
  const s = sellers.find((x) => x._id === $('seller').value);
  if (!s) return;
  $('who').textContent = `${s.name} · ${s.city} · ${s.active_skus} active products`;
  const { last_month: L, this_month: T } = s.metrics;
  $('metrics').innerHTML = ROWS.map(([label, key, f]) =>
    `<tr data-f="${key || ''}"><td>${label}</td><td>${f(L)}</td><td>${f(T)}</td></tr>`).join('');
  $('assumptions').replaceChildren(...s.assumptions.map((a) => el('li', a)));
}

function highlight(keys) {
  document.querySelectorAll('#metrics tr').forEach((tr) => tr.classList.toggle('hot', keys.includes(tr.dataset.f)));
}

function addText({ role, text, new: isNew }) {
  let el = $('log').lastElementChild;
  if (isNew || !el) { el = document.createElement('p'); el.className = role; $('log').append(el); }
  el.textContent += text;
  if (role === 'bot') $('cap').textContent = el.textContent; // big live caption
  $('log').scrollTop = $('log').scrollHeight;
  if (role === 'user' && !sources.length) setState('thinking');
}

// LLM output goes in via textContent only, never innerHTML.
const el = (tag, text, kids = []) => { const e = document.createElement(tag); if (text) e.textContent = text; e.append(...kids); return e; };
const list = (tag, items) => el(tag, '', items.map((t) => el('li', t)));

function showPlan({ issues = [], actions = [], follow_up_date }) {
  const body = $('planBody');
  body.replaceChildren(
    el('p', '', [el('strong', 'Key issues')]), list('ul', issues),
    el('p', '', [el('strong', 'Actions')]), list('ol', actions.map((a) => `${a.what} — ${a.target || ''} (${a.by_when || ''})`)),
  );
  if (follow_up_date) body.append(el('p', `Follow-up: ${follow_up_date}`));
  planText = body.innerText;
  $('plan').hidden = false;
}

function showAction({ items = [] }) {
  $('actionList').append(el('li', `Restock request raised for ${items.join(', ')}. Demo action: nothing was sent to a real supplier.`));
  $('actions').hidden = false;
}

// --- audio out: queue 24 kHz PCM chunks back-to-back; flush on interruption ---
function play(b64) {
  const u8 = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const i16 = new Int16Array(u8.buffer, 0, u8.length >> 1);
  const buf = playCtx.createBuffer(1, i16.length, 24000);
  buf.copyToChannel(Float32Array.from(i16, (v) => v / 32768), 0);
  const src = playCtx.createBufferSource();
  src.buffer = buf;
  src.connect(analyser);
  nextT = Math.max(nextT, playCtx.currentTime + 0.12);
  src.start(nextT);
  nextT += buf.duration;
  sources.push(src);
  src.onended = () => {
    sources = sources.filter((s) => s !== src);
    // wait a beat: chunks arrive back to back, so a gap this short is not the end of speech
    if (!sources.length) setTimeout(() => { if (!sources.length && ws) setState('listening'); }, 250);
  };
  setState('speaking');
}
// Orb pulses with the loudness of Saathi's voice (RMS of the playback signal, smoothed).
let analyser, raf, lvl = 0;
function pulse() {
  const d = new Uint8Array(analyser.fftSize);
  const tick = () => {
    analyser.getByteTimeDomainData(d);
    let sum = 0;
    for (const v of d) sum += ((v - 128) / 128) ** 2;
    const target = Math.min(1, Math.sqrt(sum / d.length) * 4);
    lvl += (target - lvl) * 0.35;
    $('orb').style.setProperty('--lvl', lvl.toFixed(3));
    raf = requestAnimationFrame(tick);
  };
  tick();
}
function flush() {
  sources.forEach((s) => { s.onended = null; try { s.stop(); } catch {} });
  sources = []; nextT = 0;
  setState('listening');
}

async function start() {
  $('msg').textContent = ''; $('log').innerHTML = ''; $('cap').textContent = ''; $('actions').hidden = true; $('actionList').replaceChildren(); $('plan').hidden = true; $('cost').textContent = ''; highlight([]);
  $('call').disabled = true; $('seller').disabled = true; setState('connecting');
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
  } catch {
    fail('Microphone is blocked. Allow mic access in the browser and try again.');
    return reset();
  }
  capCtx = new AudioContext({ sampleRate: 16000 });
  playCtx = new AudioContext({ sampleRate: 24000 });
  await Promise.all([capCtx.resume(), playCtx.resume(), capCtx.audioWorklet.addModule('worklet.js')]);
  if (playCtx.state !== 'running') { // autostart without a click can be blocked by the browser
    fail('Browser blocked audio. Press Call to start.');
    reset(); return setState('idle');
  }
  analyser = playCtx.createAnalyser();
  analyser.fftSize = 512;
  analyser.connect(playCtx.destination);
  pulse();

  ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/call?seller=${$('seller').value}${MODE ? `&mode=${MODE}` : ''}`);
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.t === 'audio') play(m.d);
    else if (m.t === 'interrupted') flush();
    else if (m.t === 'text') addText(m);
    else if (m.t === 'findings') highlight(m.keys);
    else if (m.t === 'plan') showPlan(m.plan);
    else if (m.t === 'action') showAction(m.action);
    else if (m.t === 'cost') $('cost').textContent = `Est. Rs${m.inr.toFixed(2)} ($${m.usd.toFixed(4)}) · ${m.audio_in + m.audio_out + m.text_in + m.text_out} tokens · free tier bills 0`;
    else if (m.t === 'escalate') fail(`Handed to a human account manager (demo): ${m.topic || 'your request'}`);
    else if (m.t === 'error') fail(m.msg);
    else if (m.t === 'ready') {
      const node = new AudioWorkletNode(capCtx, 'pcm');
      node.port.onmessage = (ev) => {
        if (ws.readyState !== 1) return;
        let u8 = new Uint8Array(ev.data);
        // Noise gate while Saathi talks: quiet sounds ("mhm", room noise, speaker bleed) become silence,
        // so only real speech interrupts. Tune GATE if real talk-over feels slow.
        if (sources.length) {
          const s16 = new Int16Array(ev.data);
          let sum = 0;
          for (const v of s16) sum += (v / 32768) ** 2;
          if (Math.sqrt(sum / s16.length) < GATE) u8 = new Uint8Array(u8.length);
        }
        ws.send(JSON.stringify({ t: 'audio', d: btoa(String.fromCharCode(...u8)) }));
      };
      capCtx.createMediaStreamSource(stream).connect(node);
      $('end').disabled = false;
      setState('listening');
    }
  };
  ws.onclose = () => { if (ws) end(); };
  ws.onerror = () => fail('Connection lost. Please try again.');
}

function reset() {
  stream?.getTracks().forEach((t) => t.stop());
  cancelAnimationFrame(raf); lvl = 0; $('orb').style.setProperty('--lvl', 0);
  capCtx?.close(); playCtx?.close();
  stream = capCtx = playCtx = null; sources = []; nextT = 0;
  $('call').disabled = false; $('seller').disabled = false; $('end').disabled = true;
}
function end() {
  const w = ws; ws = null; w?.close();
  reset(); setState('ended');
}

$('call').onclick = start;
$('end').onclick = end;
$('seller').onchange = renderSeller;
$('copy').onclick = () => navigator.clipboard?.writeText(planText).then(() => { $('copy').textContent = 'Copied'; });

fetch('/api/sellers').then((r) => r.json()).then((list) => {
  sellers = list;
  $('seller').replaceChildren(...list.map((s) => Object.assign(el('option', s.name), { value: s._id })));
  if (Q.get('seller') && list.some((s) => s._id === Q.get('seller'))) $('seller').value = Q.get('seller');
  renderSeller();
  if (MODE === 'outbound') $('cap').textContent = 'Outbound call: Saathi will open with this seller\'s open case.';
  if (MODE === 'followup') $('cap').textContent = 'Follow-up call, 7 days later. The new numbers are simulated.';
  if (MODE && Q.get('seller') === $('seller').value) start(); // arrived from the queue: dial straight away
}).catch(() => fail('Could not load sellers. Is the server running and seeded?'));
