# Saathi — Snapdeal AI Voice KAM

Browser voice call with an AI Key Account Manager for sellers. Intern assignment (rubric: voice 30, understanding 20, recommendations 20, AI workflow 20, creativity 10). Zero budget: free Gemini key only, no paid APIs.

## Stack
Node 22 (ESM, no framework), `ws`, `mongodb`, `@google/genai`. Gemini Live (native audio, WebSocket) for voice. Plain HTML/JS front end, no build step.

## Run
- `npm start` (reads `.env` if present). Needs `GEMINI_API_KEY`, `MONGODB_URI`, optional `GEMINI_MODEL` (default `gemini-3.8-live`).
- `npm run seed` loads the 5 sample sellers into Mongo db `saathi`.
- `npm test` runs `node --test` (unit tests, no network).
- `npm run eval` runs the question-bank eval against a text model. It spends free-tier quota (500 requests/day), so run it on purpose. `TRIALS=2`, `EVAL_MODEL`, and a name filter as an argument are supported.

## Layout
- `server.js` — HTTP static server, `/health`, `/api/sellers`, WebSocket `/call` proxy to Gemini Live (keys never reach the browser). Limits: payload, concurrent calls, per-IP, call length, Origin. Saves each call to Mongo.
- `kam.js` — everything the bot knows: `systemPrompt`, `facts`, tool declarations (`TOOLS`), tool handlers (`makeHandlers`), `sanitizePlan`, `detectEscalation`.
- `analyze.js` — deterministic diagnosis and forecast. The model narrates these numbers and never does maths.
- `data.js` — 5 mock sellers. Only S1001's headline metrics come from the brief; the rest is labelled sample data in each `assumptions`.
- `cost.js` — token usage to estimated Rs/USD. Rates are assumptions set in `.env` (`RATE_*`).
- `eval.mjs` — rule-graded question bank, pass@k and pass^k, log in `.claude/evals/saathi-coverage.log`.
- `public/` — `index.html`, `app.js` (16 kHz capture via `worklet.js`, 24 kHz playback, orb pulse), no inline script (CSP).
- `.claude/prds/ai-voice-kam.prd.md` — PRD with changelog. Update it when behaviour changes.

## Rules for changes
- No per-question if/else. Coverage comes from tools plus the VERIFIED FACTS block in the prompt.
- Honesty: payments, competitor prices, ad spend, cancellation reasons are NOT AVAILABLE. The bot says so, asks, or escalates. Sample data is called "sample data" when quoted.
- Prompt limits: spoken turns about 20 words, one question. `kam.test.js` caps the prompt at 7,000 chars and checks the top and last rules. Prompt text must stay seller-agnostic (no literal numbers or product names in rules).
- LLM output enters the DOM only via `textContent`. Saved plans go through `sanitizePlan`; the previous call is injected as quoted data, never as instructions.
- Tool handlers must never throw and the server must always answer every tool call.
- Never print or commit `.env` or the API key.
- TDD: write the failing test first (`node:test`), then the code.

## Known gaps
- The browser audio path and `gemini-3.8-live` voice quality are checked by hand only.
- Last eval (47 cases, TRIALS=2): pass@2 37/47. Pending fixes: restore "sample data" disclosure and answer-don't-ask rules in the prompt; loosen two strict eval regexes. Rerun after the free-tier quota resets.
- No git repo, no CI, no deployment yet.
- Live-API usage is treated as a running total for cost; verify against AI Studio.
