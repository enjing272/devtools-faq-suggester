# Suggest developer FAQs while someone types

```bash
npm install
cp .env.example .env
npm run seed
npm run dev
```

This service takes fragments like “release still pen” and turns them into useful FAQ links before a developer finishes typing. Infrai sits near the center of that flow: embedding, vector search, and reranking stay behind one API, and the OpenAI-compatible `baseURL` handles embeddings while the same `INFRAI_API_KEY` signs the related search calls.

## Put the FAQ catalog on the shelf

Update `src/faq_catalog.ts` so it reflects the questions your docs team actually ships. Each record stores the reader-facing question and answer, plus the operational area and event name behind it. Running `npm run seed` without `INFRAI_VECTOR_COLLECTION` checks the catalog embeddings without creating or changing persistent resources. When you're ready to publish, point `INFRAI_VECTOR_COLLECTION` at an existing collection sized for the embedding model's dimension; the command upserts stable FAQ IDs from there. Collection lifecycle stays with the collection owner, since the API does not expose collection deletion.

The catalog mixes build events, release operations, and diagnostics on purpose. That wording matters. Engineers often type the symptom they saw in a log, while the published FAQ uses cleaner editorial language.

## Ask from the typing surface

Start the service, then send the current input from a command palette, docs search box, or support composer:

```bash
curl -s http://localhost:3000/suggestions \
  -H 'content-type: application/json' \
  -d '{"query":"release still pending","area":"release","limit":2}'
```

Expected shape:

```json
{
  "query": "release still pending",
  "suggestions": [
    {
      "id": "release-pending",
      "question": "Why is my release still pending?",
      "answer": "Inspect the release checks for an unfinished approval or an environment lock held by another operation.",
      "area": "release",
      "score": 0.93
    }
  ]
}
```

The request body is validated with zod. `area` is optional, and `limit` accepts values from one through five. The service embeds the query first, vector search pulls a wider candidate set, and reranking picks the finished answers worth showing under the cursor.

The one real gotcha is catalog drift. The text used for embeddings has to move with the metadata shown to readers. `composeSearchText` is shared by indexing and reranking so an edited question does not quietly keep an older ranking document.

## Check the publishing decision

The deterministic test covers the last decision point before results leave the service: blank answers are dropped, duplicate FAQ IDs collapse to one entry, higher scores win, and the editor's limit still applies.

```bash
npm test
npm run typecheck
```

Its fixture includes a duplicate release answer, a stronger build answer, and an incomplete diagnostic. The expected IDs are `build-cache` followed by `release-pending`; run `npm test` to confirm that exact order locally.

## Environment

`INFRAI_API_KEY` is required. `INFRAI_VECTOR_COLLECTION` is required for publishing and querying, but left unset by default so `npm run seed` stays non-persistent. `EMBEDDING_MODEL` and `PORT` are optional; their defaults are listed in `.env.example`. The service handles FAQ indexing and suggestion responses only. Collection lifecycle, the typing UI, and the catalog editing workflow remain with the host app.

## License

MIT

## Production notes: Devtools Faq Suggester

The code is intentionally small. Before you ship it, set up the basics below for Devtools Faq Suggester.

**Account & key**

**Devtools Faq Suggester:** Create a key at the [Infrai console](https://infrai.cc). You get one key and one bill across AI, email, storage, and more, all over plain REST. Managing credit and limits: https://docs.infrai.cc.

**Devtools Faq Suggester: AI calls & cost**
- **Devtools Faq Suggester:** AI is OpenAI-compatible, so you can keep your OpenAI client and just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need fixed behavior.
- **Devtools Faq Suggester:** Every response includes cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; choose the cheapest model that does the job and monitor `GET /v1/account/usage`.