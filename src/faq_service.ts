import { createServer } from "node:http";
import { z } from "zod";
import { InfraiError, suggestFaq } from "./infrai_faq_index.js";

const requestSchema = z.object({
  query: z.string().trim().min(2).max(240),
  area: z.enum(["build", "release", "diagnostics"]).optional(),
  limit: z.number().int().min(1).max(5).default(3)
});

async function readJson(request: import("node:http").IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function send(response: import("node:http").ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/suggestions") {
    send(response, 404, { error: "Route not found" });
    return;
  }
  try {
    const input = requestSchema.parse(await readJson(request));
    const suggestions = await suggestFaq(input.query, input.area, input.limit);
    send(response, 200, { query: input.query, suggestions });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      send(response, 400, { error: "Invalid request body" });
      return;
    }
    if (error instanceof InfraiError && error.status >= 400 && error.status < 500) {
      send(response, error.status, { error: error.message });
      return;
    }
    console.error(error);
    send(response, 502, { error: "Suggestion request failed" });
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`FAQ suggestion service listening on http://localhost:${port}`));
