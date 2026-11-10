// Browser <-> this server (WebSocket, PCM audio as base64 JSON) <-> Gemini Live.
// Server owns the API key, the DB and the tools; the browser only moves audio.
import { buckets, estimate, maxMerge, ZERO } from './cost.js';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { WebSocketServer } from 'ws';
import { GoogleGenAI, Modality, StartSensitivity } from '@google/genai';
import { MongoClient } from 'mongodb';
import { TOOLS, systemPrompt, makeHandlers, detectEscalation } from './kam.js';
import { queue } from './cases.js';
import { ensureCases, touchCase, runSimulation, resetDemo } from './store.js';

const { GEMINI_API_KEY, MONGODB_URI, PORT = 3000 } = process.env;
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-live';
const num = (k, d) => Number(process.env[k]) || d;
const MAX_CALLS = num('MAX_CALLS', 4);
const MAX_CALLS_PER_IP = num('MAX_CALLS_PER_IP', 2);
const MAX_CONNECTS_PER_MIN = num('MAX_CONNECTS_PER_MIN', 10);
const MAX_CALL_SECONDS = num('MAX_CALL_SECONDS', 300);
const LAST_CALL_DAYS = num('LAST_CALL_DAYS', 30);
const VAD_SILENCE_MS = num('VAD_SILENCE_MS', 600);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);
if (!GEMINI_API_KEY || !MONGODB_URI) {
  console.error('Set GEMINI_API_KEY and MONGODB_URI in .env (see .env.example)');
  process.exit(1);
}

process.on('unhandledRejection', (e) => console.error('unhandledRejection', e));
process.on('uncaughtException', (e) => console.error('uncaughtException', e));

const mongo = await new MongoClient(MONGODB_URI).connect();
const db = mongo.db('saathi'); // one client, reused
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

const MIME = { '.html': 'text/html', '.js': 'text/javascript' };
const PUBLIC = resolve('public');
const sameOrigin = (req) => { try { return !req.headers.origin || new URL(req.headers.origin).host === req.headers.host; } catch { return false; } };
const json = (res, code, o) => res.writeHead(code, { 'content-type': 'application/json' }).end(JSON.stringify(o));
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' ws: wss:; img-src 'self' data:; frame-ancestors 'none'",
  );
  try {
    const { pathname } = new URL(req.url, 'http://x');
    if (pathname === '/health') {
      try {
        await db.command({ ping: 1 });
        return json(res, 200, { ok: true });
      } catch {
        return json(res, 503, { ok: false });
      }
    }
    if (pathname === '/api/sellers') {
      try {
        return json(res, 200, await db.collection('sellers').find().toArray());
      } catch (e) {
        console.error('sellers failed', e.message);
        return json(res, 500, { error: 'Service temporarily unavailable' });
      }
    }
    if (pathname === '/api/queue') {
      try {
        const sellers = await db.collection('sellers').find().toArray();
        const cases = await ensureCases(db, sellers);
        const done = new Set(sellers.filter((s) => s.simulated).map((s) => s._id));
        const rows = queue(sellers, cases).map((r) => ({ ...r, has_outcome: done.has(r.seller_id) }));
        return json(res, 200, rows);
      } catch (e) {
        console.error('queue failed', e.message);
        return json(res, 500, { error: 'Service temporarily unavailable' });
      }
    }
    if (pathname === '/api/simulate' || pathname === '/api/reset') {
      if (req.method !== 'POST' || !sameOrigin(req)) return json(res, 403, { error: 'POST from this site only' });
      try {
        if (pathname === '/api/reset') { await resetDemo(db); return json(res, 200, { ok: true }); }
        const r = await runSimulation(db, new URL(req.url, 'http://x').searchParams.get('seller'));
        return json(res, r.status, r.error ? { error: r.error } : { outcome: r.outcome });
      } catch (e) {
        console.error('simulate/reset failed', e.message);
        return json(res, 500, { error: 'Service temporarily unavailable' });
      }
    }
    const path = resolve(PUBLIC, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!path.startsWith(PUBLIC + sep)) return res.writeHead(403).end();
    const type = MIME[extname(path)];
    if (!type) return res.writeHead(404).end('not found');
    const body = await readFile(path);
    res.writeHead(200, { 'content-type': type }).end(body);
  } catch {
    res.writeHead(404).end('not found'); // missing file, directory, bad URL
  }
});

const active = new Map(); // ws -> ip, for call limits and shutdown
const hits = new Map(); // ip -> { n, reset } connection attempts per minute
setInterval(() => {
  const now = Date.now();
  for (const [ip, h] of hits) if (h.reset < now) hits.delete(ip);
}, 60000).unref();
const saves = new Set(); // pending call saves, awaited on shutdown

const wss = new WebSocketServer({ server, path: '/call', maxPayload: 64 * 1024 });
wss.on('connection', async (ws, req) => {
  ws.on('error', () => {});
  const send = (o) => ws.readyState === 1 && ws.send(JSON.stringify(o));
  const reject = (code, msg) => { send({ t: 'error', msg }); ws.close(code, msg); };

  const origin = req.headers.origin;
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    let host;
    try { host = new URL(origin).host; } catch { /* bad origin */ }
    if (host !== req.headers.host) return reject(1008, 'Origin not allowed');
  }
  const ip = req.socket.remoteAddress;
  const now = Date.now();
  let h = hits.get(ip);
  if (!h || h.reset < now) hits.set(ip, (h = { n: 0, reset: now + 60000 }));
  if (++h.n > MAX_CONNECTS_PER_MIN) return reject(1013, 'Too many attempts, try again later');
  if (active.size >= MAX_CALLS) return reject(1013, 'Server busy, try again later');
  if ([...active.values()].filter((v) => v === ip).length >= MAX_CALLS_PER_IP) return reject(1013, 'Too many calls from your address');
  active.set(ws, ip);

  let id, session, wd, limit;
  const log = (...a) => console.log(new Date().toISOString().slice(11, 19), id, ...a);
  const call = { started_at: new Date(), transcript: [], diagnosis: null, action_plan: null, escalations: [] };
  let used = ZERO; // ponytail: Live usage is a running total; keep the max per bucket

  ws.on('message', (raw) => {
    try {
      if (!session) return;
      const m = JSON.parse(raw);
      if (m?.t === 'audio' && typeof m.d === 'string' && m.d.length <= 16000) {
        session.sendRealtimeInput({ audio: { data: m.d, mimeType: 'audio/pcm;rate=16000' } });
      }
    } catch {
      /* ignore malformed frame */
    }
  });
  ws.on('close', () => {
    active.delete(ws);
    clearTimeout(wd);
    clearTimeout(limit);
    log('browser closed');
    try {
      session?.close();
    } catch {
      /* already closed */
    }
    if (call.transcript.length) {
      const p = db.collection('calls').insertOne({ ...call, ended_at: new Date(), cost: estimate(used), model: MODEL })
        .catch((e) => console.error('could not save call', e.message))
        .finally(() => saves.delete(p));
      saves.add(p);
    }
  });

  try {
    const params = new URL(req.url, 'http://x').searchParams;
    id = params.get('seller');
    const [seller, lastDoc] = await Promise.all([
      db.collection('sellers').findOne({ _id: id }),
      db.collection('calls').findOne({ seller_id: id, action_plan: { $ne: null } }, { sort: { started_at: -1 } }),
    ]);
    if (!seller) return ws.close(1008, 'unknown seller');
    const ap = lastDoc?.action_plan;
    const fresh = lastDoc && Date.now() - new Date(lastDoc.started_at) <= LAST_CALL_DAYS * 864e5;
    const last = fresh && Array.isArray(ap?.issues) && Array.isArray(ap?.actions) ? lastDoc : null;

    call.seller_id = id;
    const mode = ['outbound', 'followup'].includes(params.get('mode')) ? params.get('mode') : null;
    const outcome = mode === 'followup' ? await db.collection('outcomes').findOne({ _id: id }) : null;
    call.mode = mode;
    const lastUser = () => call.transcript.findLast((l) => l.role === 'user')?.text;
    const handlers = makeHandlers(seller, call, send, { lastUser });

    let cur = null; // role of the transcript line being built
    const text = (role, chunk) => {
      const isNew = cur !== role;
      if (isNew) call.transcript.push({ role, text: '' });
      call.transcript.at(-1).text += chunk;
      cur = role;
      send({ t: 'text', role, text: chunk, new: isNew });
    };
    // Code-gated escalation: don't rely on the model alone to call escalate_to_human.
    const checkEscalation = () => {
      const u = call.transcript.findLast((l) => l.role === 'user');
      const topic = u && detectEscalation(u.text);
      if (topic && !call.escalations.some((e) => e.topic === topic)) {
        log('auto-escalate', topic);
        handlers.escalate_to_human({ topic, reason: 'auto-detected from seller words' });
      }
    };
    const arm = () => { // log-only: model silent after user speech
      clearTimeout(wd);
      wd = setTimeout(() => log('model silent 8s after user speech'), 8000);
    };

    const onMessage = (m) => {
      try {
        if (m.usageMetadata) {
          used = maxMerge(used, buckets(m.usageMetadata));
          send({ t: 'cost', ...estimate(used) });
        }
        const c = m.serverContent;
        if (c) {
          for (const p of c.modelTurn?.parts ?? []) {
            if (p.inlineData) { clearTimeout(wd); send({ t: 'audio', d: p.inlineData.data }); }
          }
          if (c.inputTranscription?.text) { text('user', c.inputTranscription.text); arm(); }
          if (c.outputTranscription?.text) { clearTimeout(wd); text('bot', c.outputTranscription.text); }
          if (c.interrupted) { log('interrupted'); send({ t: 'interrupted' }); }
          if (c.turnComplete) { log('turnComplete'); checkEscalation(); }
          if (c.interrupted || c.turnComplete) cur = null;
        }
        if (m.toolCall) {
          clearTimeout(wd);
          const calls = m.toolCall.functionCalls;
          log('toolCall', calls.map((fc) => `${fc.name}(${JSON.stringify(fc.args)})`).join(', '));
          const functionResponses = calls.map((fc) => {
            let output;
            try {
              output = handlers[fc.name]?.(fc.args) ?? { error: 'unknown tool' };
            } catch (e) {
              log('tool failed', fc.name, e.message);
              output = { error: 'tool failed' };
            }
            if (fc.name === 'raise_restock_request' && output.executed && !output.repeat) {
              touchCase(db, id, 'inventory', 'in_progress', 'Restock request raised (demo), approved by the seller on a call.', 'seller')
                .catch((e) => console.error('case update failed', e.message));
            }
            return { id: fc.id, name: fc.name, response: { output } };
          });
          session.sendToolResponse({ functionResponses });
        }
        if (m.toolCallCancellation) log('toolCallCancellation', m.toolCallCancellation.ids);
        if (m.goAway) log('goAway', m.goAway);
      } catch (e) {
        log('message error', e);
      }
    };

    try {
      session = await ai.live.connect({
        model: MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: systemPrompt(seller, last, { mode, outcome }),
          tools: [{ functionDeclarations: TOOLS }],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          realtimeInputConfig: {
            automaticActivityDetection: {
              silenceDurationMs: VAD_SILENCE_MS,
              prefixPaddingMs: 300, // ponytail: LOW start sensitivity so "mhm" does not cut the bot off; real talk-over still interrupts
              startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_LOW,
            },
          },
        },
        callbacks: {
          onmessage: onMessage,
          onerror: (e) => send({ t: 'error', msg: e.message || 'Gemini connection error' }),
          onclose: (e) => {
            log('gemini closed', e?.code, e?.reason);
            if (e?.reason) send({ t: 'error', msg: `Gemini: ${e.reason}` });
            ws.close();
          },
        },
      });
    } catch (e) {
      console.error('gemini connect failed', e.message);
      send({ t: 'error', msg: 'Could not reach Gemini. Check GEMINI_API_KEY and model name.' });
      return ws.close();
    }
    if (ws.readyState !== 1) return session.close(); // browser left while connecting
    log('call started');
    limit = setTimeout(() => reject(1000, 'Call time limit reached'), MAX_CALL_SECONDS * 1000);
    send({ t: 'ready' });
    session.sendRealtimeInput({ text: mode ? 'The call has just connected. Open the call now exactly as the MODE section says.' : 'The call has just connected. Greet the seller now.' });
  } catch (e) {
    console.error('connection failed', e.message);
    reject(1011, 'Service temporarily unavailable');
  }
});

server.listen(PORT, () => console.log(`Saathi on http://localhost:${PORT}  (model ${MODEL})`));

let stopping;
const shutdown = async () => {
  if (stopping) return;
  stopping = true;
  server.close();
  const closed = [...active.keys()].map((ws) => new Promise((r) => { ws.once('close', r); ws.close(1001); })); // close handlers save transcripts
  const wait = async () => { await Promise.all(closed); await Promise.allSettled([...saves]); };
  await Promise.race([wait(), new Promise((r) => setTimeout(r, 3000))]);
  await mongo.close().catch(() => {});
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
