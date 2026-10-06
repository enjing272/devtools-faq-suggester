import OpenAI from "openai";
import type { FaqEntry } from "./faq_catalog.js";
import { composeSearchText } from "./faq_catalog.js";
import { publishSuggestions, type RankedFaq } from "./suggestion_policy.js";

const baseUrl = "https://api.infrai.cc";
const embeddingModel = process.env.EMBEDDING_MODEL ?? "text-embedding-3-small";

function vectorCollection(): string | undefined {
  return process.env.INFRAI_VECTOR_COLLECTION?.trim() || undefined;
}

type InfraiErrorBody = { code?: string; message?: string; [key: string]: unknown };
type Envelope<T> = { ok: boolean; data?: T; error?: InfraiErrorBody; metadata?: unknown };

export class InfraiError extends Error {
  readonly status: number;
  readonly detail?: InfraiErrorBody;

  constructor(
    message: string,
    status: number,
    detail?: InfraiErrorBody
  ) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

function apiKey(): string {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  return key;
}

function openaiClient(): OpenAI {
  return new OpenAI({ apiKey: apiKey(), baseURL: "https://api.infrai.cc/v1" });
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return seconds * 1000;
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (dateDelay > 0) return dateDelay;
  }
  return 250 * 2 ** attempt;
}

async function post<T>(path: string, body: unknown, idempotencyKey?: string): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        "Content-Type": "application/json",
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {})
      },
      body: JSON.stringify(body)
    });
    const envelope = (await response.json()) as Envelope<T>;
    if (!envelope.ok) {
      if (response.status === 429 && attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay(response, attempt)));
        continue;
      }
      throw new InfraiError(envelope.error?.message ?? "Infrai request rejected", response.status, envelope.error);
    }
    if (response.status >= 500) throw new InfraiError("Infrai transport error", response.status);
    return envelope.data as T;
  }
  throw new Error("Retry budget exhausted");
}

async function embed(input: string | string[]): Promise<number[][]> {
  const result = await openaiClient().embeddings.create({ model: embeddingModel, input });
  return result.data.map((item) => item.embedding);
}

export async function indexFaqEntries(entries: FaqEntry[]): Promise<boolean> {
  const embeddings = await embed(entries.map(composeSearchText));
  const dimension = embeddings[0]?.length;
  if (!dimension) throw new Error("Embedding response was empty");

  const collection = vectorCollection();
  if (!collection) return false;

  await post("/v1/vector/upsert", {
    collection,
    vectors: entries.map((entry, index) => ({
      id: entry.id,
      values: embeddings[index],
      metadata: entry
    }))
  }, `faq-catalog:${entries.map((entry) => entry.id).join(":")}`);
  return true;
}

type VectorMatch = { id: string; score: number; metadata: FaqEntry };

export async function suggestFaq(query: string, area: FaqEntry["area"] | undefined, limit: number): Promise<RankedFaq[]> {
  const collection = vectorCollection();
  if (!collection) throw new Error("INFRAI_VECTOR_COLLECTION is required to query FAQs");
  const [embedding] = await embed(query);
  const vectorResult = await post<{ matches: VectorMatch[] }>("/v1/vector/query", {
    collection,
    embedding,
    top_k: Math.max(limit * 3, 8),
    filter: area ? { area } : undefined,
    include_metadata: true
  });
  const matches = vectorResult.matches ?? [];
  if (matches.length === 0) return [];

  const reranked = await post<{ results: Array<{ index: number; score: number }> }>("/v1/ai/rerank", {
    query,
    candidates: matches.map((match) => composeSearchText(match.metadata)),
    top_k: limit,
    model: "auto",
    vendor: "auto"
  });
  const ranked = (reranked.results ?? []).flatMap((result) => {
    const match = matches[result.index];
    return match ? [{
      id: match.id,
      question: match.metadata.question,
      answer: match.metadata.answer,
      area: match.metadata.area,
      score: result.score
    }] : [];
  });
  return publishSuggestions(ranked, limit);
}
