/**
 * Multimodal Gateway Service
 *
 * Exposes methods to handle Image Generation, Video Generation, and Music Generation tasks,
 * translating standard/clean client requests to upstream APIs (such as Kie.ai).
 *
 * Model ID mapping table (platform DB modelId → Kie.ai upstream model + input params):
 *
 * IMAGE:
 *   flux-schnell                        → flux-schnell            (input: width, height)
 *   flux-dev                            → flux-kontext-dev        (input: width, height)
 *   flux-pro                            → flux-kontext-pro        (input: width, height)
 *   midjourney                          → mj_txt2img              (input: width, height)
 *   google-nano-banana-2-1k             → nano-banana-2           (input: resolution=1K)
 *   google-nano-banana-2-2k             → nano-banana-2           (input: resolution=2K)
 *   google-nano-banana-2-4k             → nano-banana-2           (input: resolution=4K)
 *   google-nano-banana-pro-1-2k         → nano-banana-pro         (input: resolution=2K)
 *   google-nano-banana-pro-4k           → nano-banana-pro         (input: resolution=4K)
 *   topaz-image-upscaler-2k             → topaz-image-upscaler    (input: resolution=2K)
 *   topaz-image-upscaler-4k             → topaz-image-upscaler    (input: resolution=4K)
 *   topaz-image-upscaler-8k             → topaz-image-upscaler    (input: resolution=8K)
 *   gpt-image-1.5-text-to-image-high    → gpt-image-1.5/text-to-image   (input: quality=high)
 *   gpt-image-1.5-text-to-image-medium  → gpt-image-1.5/text-to-image   (input: quality=medium)
 *   gpt-image-1.5-image-to-image-high   → gpt-image-1.5/image-to-image  (input: quality=high)
 *   gpt-image-1.5-image-to-image-medium → gpt-image-1.5/image-to-image  (input: quality=medium)
 *   gpt-image-2                              → gpt-image-2-text-to-image  (input: resolution=1K)
 *   gpt-image-2-text-to-image              → gpt-image-2-text-to-image  (input: resolution from inputPatch)
 *   gpt-image-2-text-to-image-1k           → gpt-image-2-text-to-image  (input: resolution=1K)
 *   gpt-image-2-text-to-image-2k           → gpt-image-2-text-to-image  (input: resolution=2K)
 *   gpt-image-2-text-to-image-4k           → gpt-image-2-text-to-image  (input: resolution=4K)
 *   google-imagen4                         → google-imagen4              (input: width, height)
 *
 * VIDEO:
 *   kling                               → kling-2.6/text-to-video
 *   runway                              → runway-gen3/text-to-video
 *   google-veo-3.1-text-to-video-quality-1080p  → veo3
 *   google-veo-3.1-image-to-video-quality-1080p → veo3
 *   google-veo-3.1-text-to-video-quality-4k     → veo3
 *   google-veo-3.1-image-to-video-quality-4k    → veo3
 *   grok-imagine-text-to-video-480p     → grok-imagine/text-to-video  (input: resolution=480p)
 *   grok-imagine-text-to-video-720p     → grok-imagine/text-to-video  (input: resolution=720p)
 *   grok-imagine-image-to-video-480p    → grok-imagine/image-to-video (input: resolution=480p)
 *   grok-imagine-image-to-video-720p    → grok-imagine/image-to-video (input: resolution=720p)
 *   seedance-2.0-480p-no-video-input    → bytedance/seedance-2  (input: resolution=480p)
 *   seedance-2.0-720p-no-video-input    → bytedance/seedance-2  (input: resolution=720p)
 *   seedance-2.0-480p-with-video-input  → bytedance/seedance-2  (input: resolution=480p)
 *   seedance-2.0-720p-with-video-input  → bytedance/seedance-2  (input: resolution=720p)
 *   kling-2.6-motion-control-720p       → kling-2.6/motion-control    (input: resolution=720p)
 *   kling-2.6-motion-control-1080p      → kling-2.6/motion-control    (input: resolution=1080p)
 *   gemini-omni-video-*                 → gemini-omni-video (duration/resolution extracted from ID)
 *
 * MUSIC:
 *   suno                                → suno
 */

export type ImageGenerationBody = {
  prompt: string;
  model: string;
  n?: number;
  size?: string;
  response_format?: "url" | "b64_json";
};

export type TaskCreateBody = {
  model: string;
  prompt: string;
  // Video params
  aspect_ratio?: string;
  duration?: string;
  image_url?: string;
  image_urls?: string[];
  resolution?: string;
  // HappyHorse reference-to-video: uses reference_image instead of image_urls
  reference_image?: string[];
  // HappyHorse video-edit: takes an existing video as input
  video_url?: string;
  // video-edit audio handling
  audio_setting?: string;
  // Grok Imagine specific
  mode?: string;
  // Grok Imagine upscale / extend: KIE task ID from a prior generation
  task_id?: string;
  index?: number;
  // Music params
  style?: string;
  lyrics?: string;
  instrumental?: boolean;
};


export type UnifiedTaskStatus = {
  taskId: string;
  state: "waiting" | "generating" | "success" | "fail";
  resultUrls: string[];
  failMsg?: string;
  costTime?: number;
};

// ─── Internal model mapping helpers ────────────────────────────────────────────

type ImageModelMap = {
  upstreamModelId: string;
  inputStyle: "wh" | "resolution" | "quality";
  resolution?: string;
  quality?: string;
};

/** Maps a platform DB modelId to the correct Kie.ai upstream model ID + input params for image generation. */
export function mapImageModel(platformModelId: string): ImageModelMap {
  const id = platformModelId;

  // ── Flux ──
  if (id === "flux-schnell") return { upstreamModelId: "flux-schnell", inputStyle: "wh" };
  if (id === "flux-dev" || id === "flux-kontext-dev") return { upstreamModelId: "flux-kontext-dev", inputStyle: "wh" };
  if (id === "flux-pro" || id === "flux-kontext-pro") return { upstreamModelId: "flux-kontext-pro", inputStyle: "wh" };

  // ── Midjourney ──
  if (id === "midjourney" || id === "mj_txt2img") return { upstreamModelId: "mj_txt2img", inputStyle: "wh" };

  // ── Google Nano Banana 2 ──
  if (id === "google-nano-banana-2-1k") return { upstreamModelId: "nano-banana-2", inputStyle: "resolution", resolution: "1K" };
  if (id === "google-nano-banana-2-2k") return { upstreamModelId: "nano-banana-2", inputStyle: "resolution", resolution: "2K" };
  if (id === "google-nano-banana-2-4k") return { upstreamModelId: "nano-banana-2", inputStyle: "resolution", resolution: "4K" };

  // ── Google Nano Banana Pro ──
  if (id === "google-nano-banana-pro-1-2k") return { upstreamModelId: "nano-banana-pro", inputStyle: "resolution", resolution: "2K" };
  if (id === "google-nano-banana-pro-4k") return { upstreamModelId: "nano-banana-pro", inputStyle: "resolution", resolution: "4K" };

  // ── Topaz Image Upscaler ──
  if (id === "topaz-image-upscaler-2k") return { upstreamModelId: "topaz-image-upscaler", inputStyle: "resolution", resolution: "2K" };
  if (id === "topaz-image-upscaler-4k") return { upstreamModelId: "topaz-image-upscaler", inputStyle: "resolution", resolution: "4K" };
  if (id === "topaz-image-upscaler-8k") return { upstreamModelId: "topaz-image-upscaler", inputStyle: "resolution", resolution: "8K" };

  // ── GPT Image 1.5 ──
  if (id === "gpt-image-1.5-text-to-image-high")    return { upstreamModelId: "gpt-image-1.5/text-to-image",   inputStyle: "quality", quality: "high" };
  if (id === "gpt-image-1.5-text-to-image-medium")  return { upstreamModelId: "gpt-image-1.5/text-to-image",   inputStyle: "quality", quality: "medium" };
  if (id === "gpt-image-1.5-image-to-image-high")   return { upstreamModelId: "gpt-image-1.5/image-to-image",  inputStyle: "quality", quality: "high" };
  if (id === "gpt-image-1.5-image-to-image-medium") return { upstreamModelId: "gpt-image-1.5/image-to-image",  inputStyle: "quality", quality: "medium" };

  // ── GPT Image 2 (text-to-image, resolution-tiered) ──
  // These go through /api/v1/images/generations → generateImage() → KIE /api/v1/jobs/createTask.
  // KIE expects input.resolution (not width/height) for gpt-image-2-text-to-image.
  // aspect_ratio=auto only allows 1K; 1:1+4K is forbidden per KIE API spec.
  if (id === "gpt-image-2")                    return { upstreamModelId: "gpt-image-2-text-to-image",  inputStyle: "resolution", resolution: "1K" };
  if (id === "gpt-image-2-text-to-image")      return { upstreamModelId: "gpt-image-2-text-to-image",  inputStyle: "resolution", resolution: "1K" };
  if (id === "gpt-image-2-text-to-image-1k")   return { upstreamModelId: "gpt-image-2-text-to-image",  inputStyle: "resolution", resolution: "1K" };
  if (id === "gpt-image-2-text-to-image-2k")   return { upstreamModelId: "gpt-image-2-text-to-image",  inputStyle: "resolution", resolution: "2K" };
  if (id === "gpt-image-2-text-to-image-4k")   return { upstreamModelId: "gpt-image-2-text-to-image",  inputStyle: "resolution", resolution: "4K" };

  // ── GPT Image 2 (image-to-image, resolution-tiered) ──
  // inputStyle "resolution" ensures the gateway sends input.resolution instead of width/height.
  if (id === "gpt-image-2-image-to-image")      return { upstreamModelId: "gpt-image-2-image-to-image", inputStyle: "resolution", resolution: "1K" };
  if (id === "gpt-image-2-image-to-image-1k")   return { upstreamModelId: "gpt-image-2-image-to-image", inputStyle: "resolution", resolution: "1K" };
  if (id === "gpt-image-2-image-to-image-2k")   return { upstreamModelId: "gpt-image-2-image-to-image", inputStyle: "resolution", resolution: "2K" };
  if (id === "gpt-image-2-image-to-image-4k")   return { upstreamModelId: "gpt-image-2-image-to-image", inputStyle: "resolution", resolution: "4K" };

  // ── Google Imagen 4 ──
  if (id === "google-imagen4") return { upstreamModelId: "google-imagen4", inputStyle: "wh" };

  // ── Seedream (ByteDance Image) ──
  // KIE uses date-stamped version strings. Both t2i and i2i variants share the same upstream ID.
  if (id === "seedream-4.5" || id === "seedream-4.5-text-to-image" || id === "seedream-4.5-image-to-image")
    return { upstreamModelId: "seedream-4-5-251128", inputStyle: "wh" };
  if (id === "seedream-5.0-lite" || id === "seedream-5.0-lite-text-to-image" || id === "seedream-5.0-lite-image-to-image")
    return { upstreamModelId: "seedream-5-0-260128", inputStyle: "wh" };

  // Fallback: pass through as-is using width/height
  return { upstreamModelId: id, inputStyle: "wh" };
}

type VideoModelMap = {
  upstreamModelId: string;
  resolution?: string;
};

/** Maps a platform DB modelId to the correct Kie.ai upstream model ID + optional resolution for video/music tasks. */
export function mapVideoModel(platformModelId: string): VideoModelMap {
  const id = platformModelId;

  // ── Legacy ──
  if (id === "kling") return { upstreamModelId: "kling-2.6/text-to-video" };
  if (id === "runway") return { upstreamModelId: "runway-gen3/text-to-video" };
  if (id === "suno") return { upstreamModelId: "suno" };

  // ── Google Veo 3.1 ──
  if (id.startsWith("google-veo-3.1-")) return { upstreamModelId: "veo3" };

  // ── Grok Imagine ──
  if (id === "grok-imagine-text-to-video-480p")  return { upstreamModelId: "grok-imagine/text-to-video",  resolution: "480p" };
  if (id === "grok-imagine-text-to-video-720p")  return { upstreamModelId: "grok-imagine/text-to-video",  resolution: "720p" };
  if (id === "grok-imagine-image-to-video-480p") return { upstreamModelId: "grok-imagine/image-to-video", resolution: "480p" };
  if (id === "grok-imagine-image-to-video-720p") return { upstreamModelId: "grok-imagine/image-to-video", resolution: "720p" };
  // Upscale/extend operate on a prior task_id — no resolution patch needed
  if (id === "grok-imagine-video-upscale")       return { upstreamModelId: "grok-imagine/upscale" };
  if (id === "grok-imagine-video-extend")        return { upstreamModelId: "grok-imagine/extend" };


  // ── Seedance 2.0 (Bytedance) ──
  // KIE upstream model name is "bytedance/seedance-2"
  if (id === "seedance-2.0-480p-no-video-input" || id === "bytedance/seedance-2") return { upstreamModelId: "bytedance/seedance-2", resolution: "480p" };
  if (id === "seedance-2.0-720p-no-video-input")                                    return { upstreamModelId: "bytedance/seedance-2", resolution: "720p" };
  if (id === "seedance-2.0-480p-with-video-input")                                  return { upstreamModelId: "bytedance/seedance-2", resolution: "480p" };
  if (id === "seedance-2.0-720p-with-video-input")                                  return { upstreamModelId: "bytedance/seedance-2", resolution: "720p" };

  // ── Kling 2.6 Motion Control ──
  if (id === "kling-2.6-motion-control-720p")  return { upstreamModelId: "kling-2.6/motion-control", resolution: "720p" };
  if (id === "kling-2.6-motion-control-1080p") return { upstreamModelId: "kling-2.6/motion-control", resolution: "1080p" };

  // ── Gemini Omni Video: extract duration + resolution from model ID ──
  // Format: gemini-omni-video-{dur}s-{res}-{mode} e.g. "gemini-omni-video-6s-4k-no-video-input"
  if (id.startsWith("gemini-omni-video-")) {
    return { upstreamModelId: "gemini-omni-video" };
  }

  // ── Hailuo (MiniMax) ──
  if (id === "hailuo-02-text-to-video-standard")  return { upstreamModelId: "hailuo/02-text-to-video-standard" };
  if (id === "hailuo-02-image-to-video-standard") return { upstreamModelId: "hailuo/02-image-to-video-standard" };
  if (id === "hailuo-02-text-to-video-pro")       return { upstreamModelId: "hailuo/02-text-to-video-pro" };
  if (id === "hailuo-02-image-to-video-pro")      return { upstreamModelId: "hailuo/02-image-to-video-pro" };
  if (id === "hailuo-2.3-image-to-video-pro")     return { upstreamModelId: "hailuo/2-3-image-to-video-pro" };

  // ── Wan 2.6 (Alibaba) ──
  if (id === "wan-2.6-text-to-video")  return { upstreamModelId: "wan-2.6-text-to-video" };
  if (id === "wan-2.6-image-to-video") return { upstreamModelId: "wan-2.6-flash-image-to-video" };

  // ── HappyHorse (Alibaba ATH) ──
  // Upstream IDs confirmed from official KIE API docs.
  // reference-to-video sends reference_image[]; video-edit sends video_url.
  if (id === "happyhorse-text-to-video")       return { upstreamModelId: "happyhorse/text-to-video" };
  if (id === "happyhorse-image-to-video")      return { upstreamModelId: "happyhorse/image-to-video" };
  if (id === "happyhorse-reference-to-video")  return { upstreamModelId: "happyhorse/reference-to-video" };
  if (id === "happyhorse-video-edit")          return { upstreamModelId: "happyhorse/video-edit" };

  // Fallback: pass through as-is
  return { upstreamModelId: id };
}

// ─── Safe JSON parse helper ─────────────────────────────────────────────────

async function safeJsonParse(res: Response, context: string): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    // Detect HTML error pages (Cloudflare 502, nginx, etc.) and produce a clean message
    const trimmed = text.trimStart();
    let hint: string;
    if (trimmed.startsWith("<")) {
      if (res.status === 502) hint = "Bad Gateway — Upstream service is temporarily unreachable. Please try again in a moment.";
      else if (res.status === 503) hint = "Service Unavailable — Upstream service is under maintenance. Please try again later.";
      else if (res.status === 504) hint = "Gateway Timeout — Upstream service did not respond in time.";
      else hint = `Upstream returned an HTML error page (HTTP ${res.status}). The API may be temporarily down.`;
    } else {
      hint = trimmed.slice(0, 200);
    }
    throw new Error(`${context}: ${hint}`);
  }
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * 1. Synchronous Image Generation.
 * Maps the standard request to the upstream API and formats back to OpenAI shape.
 * If the upstream is asynchronous, it polls internally
 * to provide a seamless synchronous response to the client.
 */
import { getCleanDomainBase } from "@/lib/shared";

export async function generateImage(args: {
  provider: { baseUrl: string; slug: string; extraHeaders?: any };
  apiKey: string;
  upstreamModelId: string;
  body: ImageGenerationBody;
}): Promise<any> {
  const { provider, apiKey, upstreamModelId, body } = args;
  const base = provider.baseUrl.replace(/\/+$/, "");
  const isKie = provider.slug.toLowerCase() === "kie" || base.includes("kie.ai");

  if (isKie) {
    const cleanBase = getCleanDomainBase(provider.baseUrl);

    // Use registry for model ID and inputPatch (falls back to identity if not in registry)
    const { getRegistryEntry } = await import("@/lib/model-registry");
    const registryEntry = getRegistryEntry(upstreamModelId);
    const kieModelId = registryEntry?.upstreamModelId ?? upstreamModelId;
    const inputPatch = registryEntry?.inputPatch ?? {};

    console.log(`[Image Gateway] Platform model "${upstreamModelId}" → Upstream "${kieModelId}"${Object.keys(inputPatch).length ? ` + patch ${JSON.stringify(inputPatch)}` : ""}`);

    // Build base input from prompt + size
    const size = body.size || "1024x1024";
    const [w, h] = size.split("x").map(Number);
    const baseInput: Record<string, any> = {
      prompt: body.prompt,
      width:  isNaN(w) ? 1024 : w,
      height: isNaN(h) ? 1024 : h,
    };

    // Apply inputPatch (overrides defaults like width/height with resolution/quality/etc.)
    const input = { ...baseInput, ...inputPatch };

    // KIE models that use resolution or quality do NOT accept width/height — strip them.
    if ("resolution" in inputPatch || "quality" in inputPatch) {
      delete input.width;
      delete input.height;
    }

    const payload = { model: kieModelId, input };

    const res = await fetch(`${cleanBase}/api/v1/jobs/createTask`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        ...(provider.extraHeaders as Record<string, string> | null ?? {}),
      },
      body: JSON.stringify(payload),
    });

    const data = await safeJsonParse(res, `createTask[${kieModelId}]`);

    if (data?.code && data.code !== 0 && data.code !== 200) {
      throw new Error(`Upstream Image Task Creation Failed: ${data.msg || JSON.stringify(data)}`);
    }

    if (!res.ok) {
      throw new Error(`Upstream Image Task Creation Failed (HTTP ${res.status}): ${JSON.stringify(data).slice(0, 200)}`);
    }

    const taskId = data?.data?.taskId;
    if (!taskId) {
      throw new Error(`Upstream did not return a taskId. Response: ${JSON.stringify(data)}`);
    }

    const maxRetries = 18;       // 18 × 3s = 54s — fits within 60s OpenResty proxy_read_timeout
    const pollIntervalMs = 3000; // 3s between polls
    for (let i = 0; i < maxRetries; i++) {
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      const status = await queryKieTaskStatus({ cleanBase, apiKey, taskId, extraHeaders: provider.extraHeaders });
      if (status.state === "success") {
        return {
          created: Math.floor(Date.now() / 1000),
          data: status.resultUrls.map((url) => ({ url })),
        };
      }
      if (status.state === "fail") {
        throw new Error(`Image Generation Failed: ${status.failMsg || "Unknown error"}`);
      }
    }

    throw new Error("Image Generation Timeout (54s exceeded). The task may still be running — check task status in dashboard.");

  }

  // Fallback: standard OpenAI-compatible synchronous image generations
  const res = await fetch(`${base}/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...(provider.extraHeaders as Record<string, string> | null ?? {}),
    },
    body: JSON.stringify({
      prompt: body.prompt,
      model: upstreamModelId,
      n: body.n ?? 1,
      size: body.size ?? "1024x1024",
      response_format: body.response_format ?? "url",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upstream Image Generation Failed (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }

  return res.json();
}

/**
 * 2. Create Asynchronous Task (for Video and Music generation).
 * Returns the taskId.
 */
export async function createVideoMusicTask(args: {
  provider: { baseUrl: string; protocol: string; slug: string; extraHeaders?: any };
  apiKey: string;
  upstreamModelId: string;
  body: TaskCreateBody;
}): Promise<string> {
  const { provider, apiKey, upstreamModelId, body } = args;
  const base = provider.baseUrl.replace(/\/+$/, "");
  const isKie = provider.slug.toLowerCase() === "kie" || base.includes("kie.ai");

  if (!isKie) {
    throw new Error(`Asynchronous task creation is currently only supported for Kie.ai provider. '${provider.slug}' protocol is not supported.`);
  }

  const cleanBase = getCleanDomainBase(provider.baseUrl);

  // Use registry for model ID and inputPatch
  const { getRegistryEntry } = await import("@/lib/model-registry");
  const { parseGeminiOmniVideoId } = await import("@/lib/pricing");
  const registryEntry = getRegistryEntry(upstreamModelId);
  const kieModelId = registryEntry?.upstreamModelId ?? upstreamModelId;
  const inputPatchFromRegistry = registryEntry?.inputPatch ?? {};

  console.log(`[Task Gateway] Platform model "${upstreamModelId}" → Upstream "${kieModelId}"${Object.keys(inputPatchFromRegistry).length ? ` + patch ${JSON.stringify(inputPatchFromRegistry)}` : ""}`);

  // Build input — registry patch provides defaults, body overrides them
  let effectiveResolution = body.resolution || (inputPatchFromRegistry.resolution as string | undefined);
  let parsedDuration: number | undefined = undefined;

  // Extract defaults from model ID if it is a gemini-omni-video variant
  if (upstreamModelId.startsWith("gemini-omni-video-")) {
    const extracted = parseGeminiOmniVideoId(upstreamModelId);
    if (extracted.duration !== undefined) {
      parsedDuration = extracted.duration;
    }
    if (extracted.resolution !== undefined && !effectiveResolution) {
      effectiveResolution = extracted.resolution;
    }
  }

  if (body.duration !== undefined && body.duration !== null) {
    if (typeof body.duration === "number") {
      parsedDuration = body.duration;
    } else if (typeof body.duration === "string") {
      const num = parseFloat(body.duration);
      if (!isNaN(num)) {
        parsedDuration = num;
      }
    }
  }

  const input: Record<string, any> = {
    prompt: body.prompt || undefined,
    aspect_ratio: body.aspect_ratio || undefined,
    duration: parsedDuration || undefined,
    image_url: body.image_url || undefined,
    image_urls: body.image_urls?.length ? body.image_urls : undefined,
    // HappyHorse reference-to-video: 1-9 reference images
    reference_image: body.reference_image?.length ? body.reference_image : undefined,
    // HappyHorse video-edit: input video URL
    video_url: body.video_url || undefined,
    audio_setting: body.audio_setting || undefined,
    // Grok Imagine: task_id for upscale/extend/image-to-video-from-task
    task_id: body.task_id || undefined,
    index: body.index !== undefined ? body.index : undefined,
    style: body.style || undefined,
    lyrics: body.lyrics || undefined,
    instrumental: body.instrumental !== undefined ? body.instrumental : undefined,
    mode: body.mode || undefined,
    resolution: effectiveResolution || undefined,
  };


  // Remove undefined keys to keep payload clean
  const cleanInput = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));

  const payload = {
    model: kieModelId,
    input: cleanInput,
  };

  const res = await fetch(`${cleanBase}/api/v1/jobs/createTask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...(provider.extraHeaders as Record<string, string> | null ?? {}),
    },
    body: JSON.stringify(payload),
  });

  const data = await safeJsonParse(res, `createTask[${kieModelId}]`);

  if (data?.code && data.code !== 0 && data.code !== 200) {
    throw new Error(`Upstream Task Creation Failed: ${data.msg || JSON.stringify(data)}`);
  }

  if (!res.ok) {
    throw new Error(`Upstream Task Creation Failed (HTTP ${res.status}): ${JSON.stringify(data).slice(0, 200)}`);
  }

  const taskId = data?.data?.taskId;
  if (!taskId) {
    throw new Error(`Upstream did not return a taskId. Response: ${JSON.stringify(data)}`);
  }

  return taskId;
}

/**
 * 3. Query Asynchronous Task Status.
 */
export async function queryTaskStatus(args: {
  provider: { baseUrl: string; slug: string; extraHeaders?: any };
  apiKey: string;
  taskId: string;
}): Promise<UnifiedTaskStatus> {
  const { provider, apiKey, taskId } = args;
  const cleanBase = getCleanDomainBase(provider.baseUrl);

  return queryKieTaskStatus({
    cleanBase,
    apiKey,
    taskId,
    extraHeaders: provider.extraHeaders,
  });
}

// ----- Internals -----

async function queryKieTaskStatus(args: {
  cleanBase: string;
  apiKey: string;
  taskId: string;
  extraHeaders?: any;
}): Promise<UnifiedTaskStatus> {
  const { cleanBase, apiKey, taskId, extraHeaders } = args;

  const res = await fetch(`${cleanBase}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(extraHeaders as Record<string, string> | null ?? {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upstream task query failed (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }

  const result = await safeJsonParse(res, `recordInfo[${taskId}]`);
  const taskData = result?.data;
  if (!taskData) {
    throw new Error(`Upstream returned empty job data for task: ${taskId}`);
  }

  const rawState = taskData.state || "waiting";
  let mappedState: UnifiedTaskStatus["state"] = "waiting";

  if (rawState === "success") {
    mappedState = "success";
  } else if (rawState === "fail") {
    mappedState = "fail";
  } else if (rawState === "generating" || rawState === "queuing") {
    mappedState = "generating";
  }

  // Parse resultJson if success
  let resultUrls: string[] = [];
  if (mappedState === "success" && taskData.resultJson) {
    try {
      const parsed = JSON.parse(taskData.resultJson);
      resultUrls = parsed.resultUrls || [];
    } catch {
      // Fallback in case resultJson is a direct string
      if (typeof taskData.resultJson === "string") {
        resultUrls = [taskData.resultJson];
      }
    }
  }

  return {
    taskId,
    state: mappedState,
    resultUrls,
    failMsg: taskData.failMsg || undefined,
    costTime: taskData.costTime || undefined,
  };
}
