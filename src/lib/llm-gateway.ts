/**
 * LLM Gateway - protocol adapters.
 *
 * The platform speaks OpenAI Chat Completions format to the client,
 * and internally forwards to upstream providers using their native protocol.
 *
 * Input:  an OpenAI-formatted ChatCompletions body + a resolved Provider + modelId
 * Output: { response: Response; usage?: { input, output, total } } for non-stream,
 *         or a streamed SSE Response for stream=true (with a `readUsage()` callback).
 */

import type { Provider, ProviderProtocol } from "@prisma/client";

/**
 * Convert a potentially-HTML upstream error body into a clean, one-line hint.
 * Prevents raw Cloudflare/CDN HTML pages from surfacing to users.
 */
function safeErrorHint(rawText: string, status: number): string {
  const trimmed = rawText.trimStart();
  if (trimmed.startsWith("<")) {
    // HTML page (Cloudflare 502, nginx 504, etc.)
    if (status === 502) return "Bad Gateway — the upstream API server is temporarily unreachable. Please try again in a moment.";
    if (status === 503) return "Service Unavailable — the upstream API is under maintenance. Please try again later.";
    if (status === 504) return "Gateway Timeout — the upstream API did not respond in time. Please try again.";
    return `Upstream returned an HTML error page (HTTP ${status}). The API may be temporarily down.`;
  }
  return trimmed.slice(0, 200);
}

type OpenAIMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | Array<{ type: string; text?: string; image_url?: any }>;
  name?: string;
  tool_calls?: any;
  tool_call_id?: string;
};

export type OpenAIChatBody = {
  model: string;
  messages: OpenAIMessage[];
  stream?: boolean;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  [k: string]: any;
};

export type Usage = {
  input: number;
  output: number;
  total: number;
};

export async function forwardChatCompletion(args: {
  provider: Pick<Provider, "baseUrl" | "protocol" | "extraHeaders">;
  apiKey: string;
  upstreamModelId: string;
  body: OpenAIChatBody;
}): Promise<{
  streaming: boolean;
  response: Response;
  usage?: Usage;
}> {
  const { provider, apiKey, upstreamModelId, body } = args;
  const base = provider.baseUrl.replace(/\/+$/, "");
  const extra = (provider.extraHeaders as Record<string, string> | null) ?? {};

  switch (provider.protocol as ProviderProtocol) {
    case "OPENAI":
      return forwardOpenAI({ base, apiKey, upstreamModelId, body, extra });
    case "ANTHROPIC":
      return forwardAnthropic({ base, apiKey, upstreamModelId, body, extra });
    case "GEMINI":
      return forwardGemini({ base, apiKey, upstreamModelId, body, extra });
    default:
      throw new Error(`Unsupported protocol: ${provider.protocol}`);
  }
}

// ---------- OpenAI-compatible ----------

async function forwardOpenAI({
  base,
  apiKey,
  upstreamModelId,
  body,
  extra,
}: {
  base: string;
  apiKey: string;
  upstreamModelId: string;
  body: OpenAIChatBody;
  extra: Record<string, string>;
}) {
  const payload = { ...body, model: upstreamModelId };
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...extra,
    },
    body: JSON.stringify(payload),
  });

  if (payload.stream) {
    // Pass-through stream (upstream already emits OpenAI SSE format)
    if (!res.ok) {
      const rawText = await res.text();
      let data: any;
      try {
        data = JSON.parse(rawText);
      } catch {
        const hint = safeErrorHint(rawText, res.status);
        throw new Error(`[${base}] model "${upstreamModelId}" returned HTTP ${res.status}: ${hint}`);
      }
      throw new Error(`[${base}] model "${upstreamModelId}": ${data?.error?.message || data?.error || `HTTP ${res.status}`}`);
    }
    return { streaming: true, response: res };
  }

  // Safely parse — upstream may return HTML on 502/503 (e.g. Cloudflare error page)
  const rawText = await res.text();
  let data: any;
  try {
    data = JSON.parse(rawText);
  } catch {
    const hint = safeErrorHint(rawText, res.status);
    throw new Error(`Upstream API error (HTTP ${res.status}): ${hint}`);
  }

  let usage: Usage | undefined;
  if (data?.usage) {
    usage = {
      input: data.usage.prompt_tokens ?? 0,
      output: data.usage.completion_tokens ?? 0,
      total: data.usage.total_tokens ?? 0,
    };
  }
  return {
    streaming: false,
    response: new Response(JSON.stringify(data), {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    }),
    usage,
  };
}

// ---------- Anthropic native ----------

function openaiMessagesToAnthropic(messages: OpenAIMessage[]): { system?: string; messages: any[] } {
  let system: string | undefined;
  const out: any[] = [];
  for (const m of messages) {
    if (m.role === "system") {
      system = [system, typeof m.content === "string" ? m.content : ""].filter(Boolean).join("\n\n");
      continue;
    }
    const role = m.role === "assistant" ? "assistant" : "user";
    const content =
      typeof m.content === "string"
        ? [{ type: "text", text: m.content }]
        : Array.isArray(m.content)
        ? m.content.map((c) => (c.type === "text" ? { type: "text", text: c.text ?? "" } : c))
        : [{ type: "text", text: String(m.content ?? "") }];
    out.push({ role, content });
  }
  return { system, messages: out };
}

async function forwardAnthropic({
  base,
  apiKey,
  upstreamModelId,
  body,
  extra,
}: {
  base: string;
  apiKey: string;
  upstreamModelId: string;
  body: OpenAIChatBody;
  extra: Record<string, string>;
}) {
  const { system, messages } = openaiMessagesToAnthropic(body.messages);
  const payload: any = {
    model: upstreamModelId,
    messages,
    max_tokens: body.max_tokens ?? 4096,
    temperature: body.temperature,
    top_p: body.top_p,
    stream: !!body.stream,
  };
  if (system) payload.system = system;

  const res = await fetch(`${base}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      ...extra,
    },
    body: JSON.stringify(payload),
  });

  if (body.stream) {
    // Translate Anthropic SSE into OpenAI Chat SSE on the fly.
    if (!res.ok) {
      const rawText = await res.text();
      let data: any;
      try { data = JSON.parse(rawText); } catch { /* ignore */ }
      throw new Error(data?.error?.message || data?.error?.type || `Upstream API error (HTTP ${res.status})`);
    }
    if (!res.body) {
      throw new Error("Upstream returned an empty body");
    }
    const stream = anthropicStreamToOpenAI(res.body, upstreamModelId);
    return {
      streaming: true,
      response: new Response(stream, {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      }),
    };
  }

  const rawAnthText = await res.text();
  let data: any;
  try {
    data = JSON.parse(rawAnthText);
  } catch {
    const hint = safeErrorHint(rawAnthText, res.status);
    throw new Error(`Upstream API error (HTTP ${res.status}): ${hint}`);
  }

  if (!res.ok) {
    return {
      streaming: false,
      response: new Response(JSON.stringify(data), {
        status: res.status,
        headers: { "Content-Type": "application/json" },
      }),
    };
  }

  // Translate to OpenAI ChatCompletion shape
  const textOut = (data?.content || [])
    .filter((c: any) => c.type === "text")
    .map((c: any) => c.text)
    .join("");
  const usage: Usage = {
    input: data?.usage?.input_tokens ?? 0,
    output: data?.usage?.output_tokens ?? 0,
    total: (data?.usage?.input_tokens ?? 0) + (data?.usage?.output_tokens ?? 0),
  };
  const openaiShape = {
    id: data?.id,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: upstreamModelId,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: textOut },
        finish_reason: data?.stop_reason || "stop",
      },
    ],
    usage: {
      prompt_tokens: usage.input,
      completion_tokens: usage.output,
      total_tokens: usage.total,
    },
  };
  return {
    streaming: false,
    response: new Response(JSON.stringify(openaiShape), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
    usage,
  };
}


export function anthropicStreamToOpenAI(
  upstream: ReadableStream<Uint8Array>,
  model: string
): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const id = `chatcmpl-${Date.now()}`;
  const created = Math.floor(Date.now() / 1000);

  return new ReadableStream({
    async start(controller) {
      const reader = upstream.getReader();
      let buffer = "";
      const sendDelta = (delta: any, finish?: string) => {
        const chunk = {
          id,
          object: "chat.completion.chunk",
          created,
          model,
          choices: [{ index: 0, delta, finish_reason: finish ?? null }],
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
      };

      try {
        // First chunk with role
        sendDelta({ role: "assistant", content: "" });

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          // Normalize \r\n → \n so we handle both line-ending styles
          buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");

          // Process SSE events separated by blank lines (\n\n)
          let idx;
          while ((idx = buffer.indexOf("\n\n")) !== -1) {
            const raw = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);

            // Extract all data: lines from this event block
            const dataLines = raw
              .split("\n")
              .filter((l) => l.startsWith("data:"))
              .map((l) => l.slice(5).trim());

            for (const line of dataLines) {
              if (!line || line === "[DONE]") continue;
              try {
                const evt = JSON.parse(line);
                // Log first few events to help debug format differences
                if (process.env.NODE_ENV !== "production") {
                  console.log("[AnthropicStream] event type:", evt.type, JSON.stringify(evt).slice(0, 120));
                }
                if (evt.type === "content_block_delta") {
                  const delta = evt.delta;
                  if (delta?.type === "text_delta" && delta.text) {
                    sendDelta({ content: delta.text });
                  } else if (delta?.type === "input_json_delta" && delta.partial_json) {
                    // Tool use streaming — pass through as text for now
                    sendDelta({ content: delta.partial_json });
                  }
                } else if (evt.type === "message_delta" && evt.delta?.stop_reason) {
                  sendDelta({}, evt.delta.stop_reason === "end_turn" ? "stop" : evt.delta.stop_reason);
                } else if (evt.type === "message_stop") {
                  sendDelta({}, "stop");
                }
              } catch {
                /* ignore malformed lines */
              }
            }
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
}

// ---------- Google Gemini ----------

function openaiMessagesToGemini(messages: OpenAIMessage[]) {
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => (typeof m.content === "string" ? m.content : ""))
    .join("\n\n");
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: typeof m.content === "string" ? m.content : JSON.stringify(m.content) }],
    }));
  return { systemInstruction: system ? { parts: [{ text: system }] } : undefined, contents };
}

async function forwardGemini({
  base,
  apiKey,
  upstreamModelId,
  body,
  extra,
}: {
  base: string;
  apiKey: string;
  upstreamModelId: string;
  body: OpenAIChatBody;
  extra: Record<string, string>;
}) {
  const { systemInstruction, contents } = openaiMessagesToGemini(body.messages);
  const payload: any = {
    contents,
    generationConfig: {
      temperature: body.temperature,
      topP: body.top_p,
      maxOutputTokens: body.max_tokens,
    },
  };
  if (systemInstruction) payload.systemInstruction = systemInstruction;

  const method = body.stream ? "streamGenerateContent" : "generateContent";
  const url = `${base}/models/${encodeURIComponent(upstreamModelId)}:${method}?key=${encodeURIComponent(apiKey)}${
    body.stream ? "&alt=sse" : ""
  }`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...extra },
    body: JSON.stringify(payload),
  });

  if (body.stream) {
    if (!res.ok) {
      const rawText = await res.text();
      let data: any;
      try { data = JSON.parse(rawText); } catch { /* ignore */ }
      throw new Error(data?.error?.message || data?.error || `Upstream API error (HTTP ${res.status})`);
    }
    if (!res.body) {
      throw new Error("Upstream returned an empty body");
    }
    const stream = geminiStreamToOpenAI(res.body, upstreamModelId);
    return {
      streaming: true,
      response: new Response(stream, {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      }),
    };
  }

  // Safely parse — upstream may return HTML on 502/503
  const rawGemText = await res.text();
  let data: any;
  try {
    data = JSON.parse(rawGemText);
  } catch {
    const hint = safeErrorHint(rawGemText, res.status);
    throw new Error(`Upstream API error (HTTP ${res.status}): ${hint}`);
  }

  if (!res.ok) {
    return {
      streaming: false,
      response: new Response(JSON.stringify(data), {
        status: res.status,
        headers: { "Content-Type": "application/json" },
      }),
    };
  }

  const text =
    data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
  const usage: Usage = {
    input: data?.usageMetadata?.promptTokenCount ?? 0,
    output: data?.usageMetadata?.candidatesTokenCount ?? 0,
    total:
      data?.usageMetadata?.totalTokenCount ??
      (data?.usageMetadata?.promptTokenCount ?? 0) +
        (data?.usageMetadata?.candidatesTokenCount ?? 0),
  };
  const openaiShape = {
    id: `chatcmpl-${Date.now()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: upstreamModelId,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: text },
        finish_reason: data?.candidates?.[0]?.finishReason?.toLowerCase() || "stop",
      },
    ],
    usage: {
      prompt_tokens: usage.input,
      completion_tokens: usage.output,
      total_tokens: usage.total,
    },
  };
  return {
    streaming: false,
    response: new Response(JSON.stringify(openaiShape), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
    usage,
  };
}


function geminiStreamToOpenAI(
  upstream: ReadableStream<Uint8Array>,
  model: string
): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const id = `chatcmpl-${Date.now()}`;
  const created = Math.floor(Date.now() / 1000);

  return new ReadableStream({
    async start(controller) {
      const reader = upstream.getReader();
      let buffer = "";
      const sendDelta = (delta: any, finish?: string) => {
        const chunk = {
          id,
          object: "chat.completion.chunk",
          created,
          model,
          choices: [{ index: 0, delta, finish_reason: finish ?? null }],
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
      };

      try {
        sendDelta({ role: "assistant", content: "" });

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let idx;
          while ((idx = buffer.indexOf("\n\n")) !== -1) {
            const raw = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            const dataLines = raw
              .split("\n")
              .filter((l) => l.startsWith("data:"))
              .map((l) => l.slice(5).trim());
            for (const line of dataLines) {
              if (!line) continue;
              try {
                const evt = JSON.parse(line);
                const text =
                  evt?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
                if (text) sendDelta({ content: text });
                const finish = evt?.candidates?.[0]?.finishReason;
                if (finish && finish !== "FINISH_REASON_UNSPECIFIED") {
                  sendDelta({}, String(finish).toLowerCase());
                }
              } catch {
                /* ignore */
              }
            }
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
}
