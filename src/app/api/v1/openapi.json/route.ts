import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/openapi.json
 *
 * Returns the platform's OpenAPI 3.0 specification.
 * The server URL is dynamically set to the current host, so importing this spec
 * into apidog/swagger/etc. will automatically point the sandbox to this platform.
 */
export async function GET(req: NextRequest) {
  let origin = req.nextUrl.origin;
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (host) {
    origin = `${proto}://${host}`;
  }
  // Ensure we don't return 0.0.0.0 or localhost in production
  if (origin.includes("0.0.0.0") || origin.includes("localhost") || origin.includes("127.0.0.1")) {
    origin = "https://aapi.togomol.com";
  }

  const spec = {
    openapi: "3.0.1",
    info: {
      title: "AggregateAPI Gateway",
      description:
        "A unified API gateway aggregating 400+ AI models (LLM, Image, Video, Music). " +
        "OpenAI-compatible for chat/completions; KIE-compatible async tasks for image/video/music generation.",
      version: "1.0.0",
    },
    servers: [
      {
        url: origin,
        description: "Platform Gateway (use your platform API key)",
      },
    ],
    security: [{ BearerAuth: [] }],
    paths: {
      // ─── LLM Chat ───────────────────────────────────────────────────────
      "/api/v1/chat/completions": {
        post: {
          summary: "Chat Completions (OpenAI-compatible)",
          description:
            "Unified LLM endpoint supporting 400+ models. Compatible with OpenAI SDK. " +
            "Use `stream: true` for streaming responses. Claude models are automatically converted to Anthropic format.",
          operationId: "chat-completions",
          tags: ["LLM"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["model", "messages"],
                  properties: {
                    model: { type: "string", example: "gemini-2.5-flash", description: "Model ID (e.g. gemini-2.5-flash, gpt-4o, claude-sonnet-4-6)" },
                    messages: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          role: { type: "string", enum: ["system", "user", "assistant"] },
                          content: { type: "string" },
                        },
                      },
                    },
                    stream: { type: "boolean", default: false },
                    max_tokens: { type: "integer", example: 1024 },
                    temperature: { type: "number", example: 0.7 },
                  },
                },
                example: {
                  model: "gemini-2.5-flash",
                  messages: [{ role: "user", content: "Hello!" }],
                  stream: false,
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Success",
              content: {
                "application/json": {
                  schema: { type: "object", description: "OpenAI-compatible chat completion response" },
                },
              },
            },
          },
        },
      },

      // ─── Image Generation (Sync) ────────────────────────────────────────
      "/api/v1/images/generations": {
        post: {
          summary: "Image Generation (OpenAI-compatible)",
          description: "Synchronous image generation. Polls KIE internally and returns image URLs when done.",
          operationId: "images-generations",
          tags: ["Image"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["model", "prompt"],
                  properties: {
                    model: { type: "string", example: "flux-schnell" },
                    prompt: { type: "string", example: "a futuristic cyberpunk city at night" },
                    size: { type: "string", example: "1024x1024", description: "Width x Height" },
                    n: { type: "integer", default: 1 },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Success",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      created: { type: "integer" },
                      data: { type: "array", items: { type: "object", properties: { url: { type: "string" } } } },
                    },
                  },
                },
              },
            },
          },
        },
      },

      // ─── Async Task Create ───────────────────────────────────────────────
      "/api/v1/tasks/create": {
        post: {
          summary: "Create Async Task (Video / Music)",
          description:
            "Creates an asynchronous generation task for video or music models. " +
            "Returns a `taskId` to poll with `/api/v1/tasks/status?taskId=...&providerSlug=...`.\n\n" +
            "**Video models:** bytedance/seedance-2, grok-imagine/image-to-video, google-veo-3.1-*, kling, etc.\n\n" +
            "**Music models:** suno",
          operationId: "tasks-create",
          tags: ["Async Tasks"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["model", "prompt"],
                  properties: {
                    model: { type: "string", example: "suno" },
                    prompt: { type: "string", example: "an uplifting electronic pop track" },
                    aspect_ratio: { type: "string", enum: ["auto", "1:1", "16:9", "9:16", "4:3", "3:4"], default: "16:9" },
                    duration: { type: "number", example: 5, description: "Video duration in seconds" },
                    image_url: { type: "string", format: "uri", description: "Single reference image URL (for video models)" },
                    style: { type: "string", description: "Music style (for Suno)" },
                    lyrics: { type: "string", description: "Lyrics (for Suno)" },
                    instrumental: { type: "boolean", description: "Instrumental only (for Suno)" },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Task created successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      taskId: { type: "string" },
                      modelId: { type: "string" },
                      providerSlug: { type: "string" },
                    },
                  },
                },
              },
            },
            "402": { description: "Insufficient balance" },
            "404": { description: "Model not available" },
          },
        },
      },

      // ─── Async Task Status ───────────────────────────────────────────────
      "/api/v1/tasks/status": {
        get: {
          summary: "Query Async Task Status & Results",
          description: "Poll task status after creating with `/api/v1/tasks/create`. Returns result URLs when state is `success`.",
          operationId: "tasks-status",
          tags: ["Async Tasks"],
          parameters: [
            { name: "taskId", in: "query", required: true, schema: { type: "string" }, example: "task_xxx_123456" },
            { name: "providerSlug", in: "query", required: true, schema: { type: "string" }, example: "kie" },
          ],
          responses: {
            "200": {
              description: "Task status",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      taskId: { type: "string" },
                      state: { type: "string", enum: ["waiting", "generating", "success", "fail"] },
                      resultUrls: { type: "array", items: { type: "string", format: "uri" } },
                      failMsg: { type: "string" },
                      costTime: { type: "integer", description: "Generation time in seconds" },
                    },
                  },
                },
              },
            },
          },
        },
      },

      // ─── Model Registry ──────────────────────────────────────────────────
      "/api/v1/model-registry": {
        get: {
          summary: "Get Model Routing Registry",
          description: "Returns all supported models with their routing protocol, upstream model ID, and input parameters.",
          operationId: "get-model-registry",
          tags: ["Meta"],
          responses: {
            "200": {
              description: "Model registry",
              content: { "application/json": { schema: { type: "object" } } },
            },
          },
        },
      },

      // ─── Models List ─────────────────────────────────────────────────────
      "/api/v1/models": {
        get: {
          summary: "List Available Models",
          description: "Returns all enabled models in OpenAI-compatible format.",
          operationId: "list-models",
          tags: ["Meta"],
          responses: {
            "200": {
              description: "Models list",
              content: { "application/json": { schema: { type: "object" } } },
            },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "API Key",
          description:
            "Use your **platform API key** (NOT the KIE key). " +
            "Create one at Dashboard → API Keys.",
        },
      },
    },
    tags: [
      { name: "LLM", description: "Language model chat completions (OpenAI-compatible)" },
      { name: "Image", description: "Synchronous image generation" },
      { name: "Async Tasks", description: "Asynchronous image/video/music generation tasks" },
      { name: "Meta", description: "Platform metadata: models, registry" },
    ],
  };

  return NextResponse.json(spec, {
    headers: {
      "Content-Type": "application/json",
      // Allow apidog/swagger sandbox to fetch this spec cross-origin
      "Access-Control-Allow-Origin": "*",
    },
  });
}
