# CMC Market Detective

AI-ready market intelligence MVP for the CoinMarketCap API Hackathon.

## Current MVP
- Live top-50 market scan
- Rule-based anomaly detection using price, volume/market-cap ratio, short-term acceleration and 7d direction
- Investigation panel with explicit CMC endpoint + raw API evidence
- Next step: add LLM orchestration and natural-language tool calling

## CMC endpoints
- `GET /v3/cryptocurrency/listings/latest`
- `GET /v3/cryptocurrency/quotes/latest`

## Run
1. `cp .env.example .env.local`
2. Put your CMC API key in `CMC_API_KEY`.
3. `npm install`
4. `npm run dev`
5. Open `http://localhost:3000`

Never commit `.env.local` or API keys.
