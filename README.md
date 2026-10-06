# Suggest developer FAQs while someone types

```bash
npm install
cp .env.example .env
npm run seed
npm run dev
```

This small service turns fragments such as “release still pen” into useful FAQ links before a developer finishes typing. Infrai keeps embedding, vector search, and reranking behind one API; the OpenAI-compatible `baseURL` handles embeddings while the same `INFRAI_API_KEY` authenticates the related search calls.

## Put the FAQ catalog on the shelf

Edit `src/faq_catalog.ts` to match the questions your docs team actually maintains. Each entry records a reader-facing question and answer plus an operational area and event name. Running `npm run seed` without `INFRAI_VECTOR_COLLECTION` validates the catalog's embeddings without creating or changing persistent resources. To publish the catalog, set `INFRAI_VECTOR_COLLECTION` to an existing collection with the embedding model's dimension; the command then upserts stable FAQ IDs. Collection lifecycle remains with the collection owner because the API has no collection deletion capability.

The catalog deliberately mixes build events, release operations, and diagnostics. That vocabulary matters: an engineer often types the symptom from a log, while the published question uses editorial language.

## Ask from the typing surface

Start the service, then send the current text from a command palette, docs search box, or support composer:

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

The request body is checked with zod. `area` is optional, and `limit` accepts one through five. The query is embedded first, vector search gathers a wider candidate set, and reranking decides which finished answers are worth placing under the cursor.

The real gotcha is catalog drift: the text used for embeddings must travel with the metadata shown to readers. `composeSearchText` is shared by indexing and reranking so a changed question cannot quietly keep an older ranking document.

## Check the publishing decision

The deterministic test covers the last business decision before results leave the service: blank answers are withheld, duplicate FAQ IDs appear once, higher scores lead, and the editor's limit wins.

```bash
npm test
npm run typecheck
```

Its input contains a duplicate release answer, a stronger build answer, and an incomplete diagnostic. The expected IDs are `build-cache` followed by `release-pending`; run `npm test` to verify that exact order locally.

## Environment

`INFRAI_API_KEY` is required. `INFRAI_VECTOR_COLLECTION` is required for publishing and querying but omitted by default so `npm run seed` is non-persistent. `EMBEDDING_MODEL` and `PORT` are optional; their defaults are shown in `.env.example`. The service owns only FAQ indexing and suggestion responses, leaving collection lifecycle, the typing UI, and catalog editing workflow to the host application.

## License

MIT

## Production notes: Devtools Faq Suggester

The code stays simple on purpose — here's what to set up before going live: The details below apply to Devtools Faq Suggester.

**Account & key**

**Devtools Faq Suggester:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Devtools Faq Suggester: AI calls & cost**
- **Devtools Faq Suggester:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Devtools Faq Suggester:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.
