# Saathi — AI Voice KAM for Snapdeal sellers

Browser voice bot. A seller talks, Saathi finds why sales dropped (mock data), recommends 2-3 actions, then summarises.

## Run
1. `npm install`
2. Get a free key at https://aistudio.google.com/apikey and put it in `.env` (`GEMINI_API_KEY=...`). `MONGODB_URI` defaults to local Mongo; use a free Atlas M0 URI if you have no local Mongo.
3. `npm run seed && npm start`, open http://localhost:3000 in Chrome, click **Call your KAM**. Use headphones.

`npm test` checks the maths and tools. `npm run eval` runs ~33 evaluator-style questions (sales, orders, stock, cancellations, pricing, products, visibility, returns, targets, plans, payments, Hindi, jailbreaks, memory) against the real prompt and tools and prints pass/fail (`-- "text"` runs a subset, `TRIALS=3` gives pass@3).

## How it works
Browser mic (16 kHz PCM) -> WebSocket -> Node server -> Gemini Live API (speech-to-speech, one model for listening, thinking and speaking) -> audio streams back chunk by chunk. The server owns the API key, MongoDB and the tools (all in `kam.js`). The seller can ask anything in any order; the model picks the tool, so there are no per-question `if/else`:
- `analyze_sales_drop`: headline, loss, root causes (deterministic maths in `analyze.js`; the LLM never computes numbers)
- `get_business_data(topic)`: sales, orders, pricing, cancellations, inventory, products, visibility, returns, trend. Each answer says whether it is *given* or *sample* data. Payments, competitors and ad spend return "not available" so the bot cannot invent them
- `get_oos_products`: restock priority list
- `get_forecast`: recovery scenarios and targets (estimates, computed in code)
- `create_action_plan`: saves the plan and shows the card
- `escalate_to_human`: payments, blocked account, legal, or the seller asks for a person

Calls are stored in Mongo (`calls`); a returning seller is asked about last call's plan.

## Assumptions
Only the table in the brief is real. Seller name, 60 SKUs, top-10 product data, traffic, return reasons and earlier months are sample data, listed in the UI and said aloud by the bot. Cancellation reasons, payments, competitor prices and ad spend are deliberately absent: the bot asks the seller or escalates. "This month" is treated as a full month. Second seller (S1002) is a price-driven drop to show the diagnosis follows the data.

## Files
`server.js` voice relay · `kam.js` prompt + tools + data lookup · `analyze.js` diagnosis and forecast · `data.js` + `seed.js` mock data · `eval.mjs` question-bank eval · `public/` UI and audio

## Cost tracking

Each call shows an estimated cost under the transcript and stores it on the call document (`calls.cost`: tokens by text/audio in/out, USD, INR). `npm run eval` appends `est_cost_usd` to the eval log. Rates are assumptions set in `.env` (`RATE_*`, `USD_INR`); the free tier bills 0, so this is the paid-equivalent. Live-API usage is treated as a running total (max per bucket). Check the first real call against the AI Studio usage page.
