/**
 * Model Registry
 *
 * Central source of truth for model routing rules.
 * Maps platform DB model IDs to their upstream routing configuration.
 *
 * Adding a new model:
 *   1. Add an entry here with the correct protocol, upstreamModelId, and optional inputPatch.
 *   2. Add the model to the static import list in admin/providers/actions.ts.
 *   3. No other files need to change.
 */

export type ModelProtocol =
  | "openai-chat"     // Standard LLM → forward via provider /v1/chat/completions
  | "anthropic-chat"  // Claude → forward via /claude/v1/messages in Anthropic format
  | "kie-task-image"  // Image → KIE async task /api/v1/jobs/createTask
  | "kie-task-video"  // Video → KIE async task /api/v1/jobs/createTask
  | "kie-task-music"; // Music → KIE async task /api/v1/jobs/createTask

export type BillingMode = "per-token" | "flat-rate";

export interface ModelRegistryEntry {
  /** ID sent to the upstream provider API */
  upstreamModelId: string;
  /** Routing protocol */
  protocol: ModelProtocol;
  /** Billing mode */
  billing: BillingMode;
  /**
   * Key-value fields to inject/override in input.* when forwarding to KIE.
   * Examples: { resolution: "1K" }, { quality: "high" }
   * These are merged with the client-provided input (client input takes precedence).
   */
  inputPatch?: Record<string, string | number | boolean>;
  /** Human-readable description */
  description?: string;
}

// ─────────────────────────────────────────────────────────────────────────────

export const MODEL_REGISTRY: Record<string, ModelRegistryEntry> = {

  // ═══════════════════════════════════════════════════════════════════════════
  // CLAUDE (Anthropic format via KIE /claude/v1/messages)
  // ═══════════════════════════════════════════════════════════════════════════

  "claude-sonnet-4-6":  { upstreamModelId: "claude-sonnet-4-6",  protocol: "anthropic-chat", billing: "per-token", description: "Claude Sonnet 4.6" },
  "claude-sonnet-4.6":  { upstreamModelId: "claude-sonnet-4-6",  protocol: "anthropic-chat", billing: "per-token", description: "Claude Sonnet 4.6 (dot alias)" },
  "claude-opus-4-5":    { upstreamModelId: "claude-opus-4-5",    protocol: "anthropic-chat", billing: "per-token", description: "Claude Opus 4.5" },
  "claude-opus-4.5":    { upstreamModelId: "claude-opus-4-5",    protocol: "anthropic-chat", billing: "per-token", description: "Claude Opus 4.5 (dot alias)" },
  "claude-opus-4.7":    { upstreamModelId: "claude-opus-4.7",    protocol: "anthropic-chat", billing: "per-token", description: "Claude Opus 4.7" },
  "claude-opus-4-7":    { upstreamModelId: "claude-opus-4.7",    protocol: "anthropic-chat", billing: "per-token", description: "Claude Opus 4.7 (hyphen alias)" },
  "claude-haiku-3-5":   { upstreamModelId: "claude-haiku-3-5",   protocol: "anthropic-chat", billing: "per-token", description: "Claude Haiku 3.5" },
  "claude-haiku-3.5":   { upstreamModelId: "claude-haiku-3-5",   protocol: "anthropic-chat", billing: "per-token", description: "Claude Haiku 3.5 (dot alias)" },

  // ═══════════════════════════════════════════════════════════════════════════
  // IMAGE GENERATION (KIE async task)
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Flux ──
  "flux-schnell":     { upstreamModelId: "flux-schnell",      protocol: "kie-task-image", billing: "flat-rate", description: "Flux Schnell" },
  "flux-dev":         { upstreamModelId: "flux-kontext-dev",  protocol: "kie-task-image", billing: "flat-rate", description: "Flux Dev" },
  "flux-kontext-dev": { upstreamModelId: "flux-kontext-dev",  protocol: "kie-task-image", billing: "flat-rate", description: "Flux Kontext Dev" },
  "flux-pro":         { upstreamModelId: "flux-kontext-pro",  protocol: "kie-task-image", billing: "flat-rate", description: "Flux Pro" },
  "flux-kontext-pro": { upstreamModelId: "flux-kontext-pro",  protocol: "kie-task-image", billing: "flat-rate", description: "Flux Kontext Pro" },

  // ── Midjourney ──
  "midjourney": { upstreamModelId: "mj_txt2img", protocol: "kie-task-image", billing: "flat-rate", description: "Midjourney" },
  "mj_txt2img": { upstreamModelId: "mj_txt2img", protocol: "kie-task-image", billing: "flat-rate", description: "Midjourney (upstream alias)" },

  // ── Google Nano Banana 2 ──
  "google-nano-banana-2-1k": { upstreamModelId: "nano-banana-2", protocol: "kie-task-image", billing: "flat-rate", inputPatch: { resolution: "1K" }, description: "Nano Banana 2 (1K)" },
  "google-nano-banana-2-2k": { upstreamModelId: "nano-banana-2", protocol: "kie-task-image", billing: "flat-rate", inputPatch: { resolution: "2K" }, description: "Nano Banana 2 (2K)" },
  "google-nano-banana-2-4k": { upstreamModelId: "nano-banana-2", protocol: "kie-task-image", billing: "flat-rate", inputPatch: { resolution: "4K" }, description: "Nano Banana 2 (4K)" },

  // ── Google Nano Banana Pro ──
  "google-nano-banana-pro-1-2k": { upstreamModelId: "nano-banana-pro", protocol: "kie-task-image", billing: "flat-rate", inputPatch: { resolution: "2K" }, description: "Nano Banana Pro (2K)" },
  "google-nano-banana-pro-4k":   { upstreamModelId: "nano-banana-pro", protocol: "kie-task-image", billing: "flat-rate", inputPatch: { resolution: "4K" }, description: "Nano Banana Pro (4K)" },

  // ── Topaz Image Upscaler ──
  "topaz-image-upscaler-2k": { upstreamModelId: "topaz-image-upscaler", protocol: "kie-task-image", billing: "flat-rate", inputPatch: { resolution: "2K" }, description: "Topaz Image Upscaler (2K)" },
  "topaz-image-upscaler-4k": { upstreamModelId: "topaz-image-upscaler", protocol: "kie-task-image", billing: "flat-rate", inputPatch: { resolution: "4K" }, description: "Topaz Image Upscaler (4K)" },
  "topaz-image-upscaler-8k": { upstreamModelId: "topaz-image-upscaler", protocol: "kie-task-image", billing: "flat-rate", inputPatch: { resolution: "8K" }, description: "Topaz Image Upscaler (8K)" },

  // ── GPT Image 1.5 ──
  "gpt-image-1.5-text-to-image-high":    { upstreamModelId: "gpt-image-1.5/text-to-image",  protocol: "kie-task-image", billing: "flat-rate", inputPatch: { quality: "high" },   description: "GPT Image 1.5 Text-to-Image (High)" },
  "gpt-image-1.5-text-to-image-medium":  { upstreamModelId: "gpt-image-1.5/text-to-image",  protocol: "kie-task-image", billing: "flat-rate", inputPatch: { quality: "medium" }, description: "GPT Image 1.5 Text-to-Image (Medium)" },
  "gpt-image-1.5-image-to-image-high":   { upstreamModelId: "gpt-image-1.5/image-to-image", protocol: "kie-task-image", billing: "flat-rate", inputPatch: { quality: "high" },   description: "GPT Image 1.5 Image-to-Image (High)" },
  "gpt-image-1.5-image-to-image-medium": { upstreamModelId: "gpt-image-1.5/image-to-image", protocol: "kie-task-image", billing: "flat-rate", inputPatch: { quality: "medium" }, description: "GPT Image 1.5 Image-to-Image (Medium)" },

  // ── GPT Image 2 ──
  // NOTE: KIE rejects "gpt-image-2" as unsupported. Correct upstream names use the official KIE model ID.
  "gpt-image-2":                   { upstreamModelId: "gpt-image-2-text-to-image",   protocol: "kie-task-image", billing: "flat-rate",                                  description: "GPT Image 2 Text-to-Image (legacy alias)" },
  // Text-to-Image: resolution must match aspect_ratio constraints per KIE API spec.
  // 1:1 + 4K is forbidden; aspect_ratio=auto only allows 1K (otherwise task creation fails).
  "gpt-image-2-text-to-image":     { upstreamModelId: "gpt-image-2-text-to-image",  protocol: "kie-task-image", billing: "flat-rate",                                  description: "GPT Image 2 Text-to-Image (auto resolution)" },
  "gpt-image-2-text-to-image-1k":  { upstreamModelId: "gpt-image-2-text-to-image",  protocol: "kie-task-image", billing: "flat-rate", inputPatch: { resolution: "1K" }, description: "GPT Image 2 Text-to-Image (1K)" },
  "gpt-image-2-text-to-image-2k":  { upstreamModelId: "gpt-image-2-text-to-image",  protocol: "kie-task-image", billing: "flat-rate", inputPatch: { resolution: "2K" }, description: "GPT Image 2 Text-to-Image (2K)" },
  "gpt-image-2-text-to-image-4k":  { upstreamModelId: "gpt-image-2-text-to-image",  protocol: "kie-task-image", billing: "flat-rate", inputPatch: { resolution: "4K" }, description: "GPT Image 2 Text-to-Image (4K)" },
  "gpt-image-2-image-to-image":    { upstreamModelId: "gpt-image-2-image-to-image",  protocol: "kie-task-image", billing: "flat-rate",                                  description: "GPT Image 2 Image-to-Image (auto resolution)" },
  "gpt-image-2-image-to-image-1k": { upstreamModelId: "gpt-image-2-image-to-image",  protocol: "kie-task-image", billing: "flat-rate", inputPatch: { resolution: "1K" }, description: "GPT Image 2 Image-to-Image (1K)" },
  "gpt-image-2-image-to-image-2k": { upstreamModelId: "gpt-image-2-image-to-image",  protocol: "kie-task-image", billing: "flat-rate", inputPatch: { resolution: "2K" }, description: "GPT Image 2 Image-to-Image (2K)" },
  "gpt-image-2-image-to-image-4k": { upstreamModelId: "gpt-image-2-image-to-image",  protocol: "kie-task-image", billing: "flat-rate", inputPatch: { resolution: "4K" }, description: "GPT Image 2 Image-to-Image (4K)" },

  // ── Google Imagen 4 ──
  "google-imagen4": { upstreamModelId: "google-imagen4", protocol: "kie-task-image", billing: "flat-rate", description: "Google Imagen 4" },

  // ── Seedream (ByteDance Image) ──
  // Upstream IDs confirmed from KIE integration docs: date-stamped version strings.
  "seedream-4.5":                 { upstreamModelId: "seedream-4-5-251128", protocol: "kie-task-image", billing: "flat-rate", description: "Seedream 4.5" },
  "seedream-4.5-text-to-image":   { upstreamModelId: "seedream-4-5-251128", protocol: "kie-task-image", billing: "flat-rate", description: "Seedream 4.5 Text-to-Image" },
  "seedream-4.5-image-to-image":  { upstreamModelId: "seedream-4-5-251128", protocol: "kie-task-image", billing: "flat-rate", description: "Seedream 4.5 Image-to-Image" },
  "seedream-5.0-lite":                { upstreamModelId: "seedream-5-0-260128", protocol: "kie-task-image", billing: "flat-rate", description: "Seedream 5.0 Lite" },
  "seedream-5.0-lite-text-to-image":  { upstreamModelId: "seedream-5-0-260128", protocol: "kie-task-image", billing: "flat-rate", description: "Seedream 5.0 Lite Text-to-Image" },
  "seedream-5.0-lite-image-to-image": { upstreamModelId: "seedream-5-0-260128", protocol: "kie-task-image", billing: "flat-rate", description: "Seedream 5.0 Lite Image-to-Image" },


  // ═══════════════════════════════════════════════════════════════════════════
  // VIDEO GENERATION (KIE async task)
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Legacy ──
  "kling":  { upstreamModelId: "kling-2.6/text-to-video",   protocol: "kie-task-video", billing: "flat-rate", description: "Kling (legacy alias)" },
  "runway": { upstreamModelId: "runway-gen3/text-to-video", protocol: "kie-task-video", billing: "flat-rate", description: "Runway Gen3 (legacy alias)" },

  // ── Google Veo 3.1 ──
  "google-veo-3.1-text-to-video-quality-1080p":  { upstreamModelId: "veo3", protocol: "kie-task-video", billing: "flat-rate", description: "Google Veo 3.1 Text-to-Video 1080p" },
  "google-veo-3.1-image-to-video-quality-1080p": { upstreamModelId: "veo3", protocol: "kie-task-video", billing: "flat-rate", description: "Google Veo 3.1 Image-to-Video 1080p" },
  "google-veo-3.1-text-to-video-quality-4k":     { upstreamModelId: "veo3", protocol: "kie-task-video", billing: "flat-rate", description: "Google Veo 3.1 Text-to-Video 4K" },
  "google-veo-3.1-image-to-video-quality-4k":    { upstreamModelId: "veo3", protocol: "kie-task-video", billing: "flat-rate", description: "Google Veo 3.1 Image-to-Video 4K" },

  // ── Grok Imagine ──
  "grok-imagine-text-to-video-480p":  { upstreamModelId: "grok-imagine/text-to-video",  protocol: "kie-task-video", billing: "flat-rate", inputPatch: { resolution: "480p" }, description: "Grok Imagine Text-to-Video (480p)" },
  "grok-imagine-text-to-video-720p":  { upstreamModelId: "grok-imagine/text-to-video",  protocol: "kie-task-video", billing: "flat-rate", inputPatch: { resolution: "720p" }, description: "Grok Imagine Text-to-Video (720p)" },
  "grok-imagine-image-to-video-480p": { upstreamModelId: "grok-imagine/image-to-video", protocol: "kie-task-video", billing: "flat-rate", inputPatch: { resolution: "480p" }, description: "Grok Imagine Image-to-Video (480p)" },
  "grok-imagine-image-to-video-720p": { upstreamModelId: "grok-imagine/image-to-video", protocol: "kie-task-video", billing: "flat-rate", inputPatch: { resolution: "720p" }, description: "Grok Imagine Image-to-Video (720p)" },
  // Post-processing: operate on a previously generated KIE task_id
  "grok-imagine-video-upscale": { upstreamModelId: "grok-imagine/upscale", protocol: "kie-task-video", billing: "flat-rate", description: "Grok Imagine Video Upscale (enhance resolution of prior generation)" },
  "grok-imagine-video-extend":  { upstreamModelId: "grok-imagine/extend",  protocol: "kie-task-video", billing: "flat-rate", description: "Grok Imagine Video Extend (lengthen a prior generation)" },


  // ── Seedance 2.0 (Bytedance) ──
  "seedance-2.0-480p-no-video-input":   { upstreamModelId: "bytedance/seedance-2", protocol: "kie-task-video", billing: "flat-rate", inputPatch: { resolution: "480p" }, description: "Seedance 2.0 480p (Text-to-Video)" },
  "seedance-2.0-720p-no-video-input":   { upstreamModelId: "bytedance/seedance-2", protocol: "kie-task-video", billing: "flat-rate", inputPatch: { resolution: "720p" }, description: "Seedance 2.0 720p (Text-to-Video)" },
  "seedance-2.0-480p-with-video-input": { upstreamModelId: "bytedance/seedance-2", protocol: "kie-task-video", billing: "flat-rate", inputPatch: { resolution: "480p" }, description: "Seedance 2.0 480p (Image-to-Video)" },
  "seedance-2.0-720p-with-video-input": { upstreamModelId: "bytedance/seedance-2", protocol: "kie-task-video", billing: "flat-rate", inputPatch: { resolution: "720p" }, description: "Seedance 2.0 720p (Image-to-Video)" },
  "bytedance/seedance-2-fast":          { upstreamModelId: "bytedance/seedance-2-fast", protocol: "kie-task-video", billing: "flat-rate", description: "Bytedance Seedance 2.0 Fast (Official KIE name)" },

  // ── Kling 2.6 Motion Control ──
  "kling-2.6-motion-control-720p":  { upstreamModelId: "kling-2.6/motion-control", protocol: "kie-task-video", billing: "flat-rate", inputPatch: { resolution: "720p"  }, description: "Kling 2.6 Motion Control (720p)" },
  "kling-2.6-motion-control-1080p": { upstreamModelId: "kling-2.6/motion-control", protocol: "kie-task-video", billing: "flat-rate", inputPatch: { resolution: "1080p" }, description: "Kling 2.6 Motion Control (1080p)" },

  // ── Gemini Omni Video ──
  "gemini-omni-video-6s-4k-no-video-input":    { upstreamModelId: "gemini-omni-video", protocol: "kie-task-video", billing: "flat-rate", description: "Gemini Omni Video 6s 4K (no input)" },
  "gemini-omni-video-4k-with-video-input":     { upstreamModelId: "gemini-omni-video", protocol: "kie-task-video", billing: "flat-rate", description: "Gemini Omni Video 4K (with input)" },
  "gemini-omni-video-1080p-with-video-input":  { upstreamModelId: "gemini-omni-video", protocol: "kie-task-video", billing: "flat-rate", description: "Gemini Omni Video 1080p (with input)" },
  "gemini-omni-video-720p-with-video-input":   { upstreamModelId: "gemini-omni-video", protocol: "kie-task-video", billing: "flat-rate", description: "Gemini Omni Video 720p (with input)" },
  "gemini-omni-video-10s-4k-no-video-input":   { upstreamModelId: "gemini-omni-video", protocol: "kie-task-video", billing: "flat-rate", description: "Gemini Omni Video 10s 4K (no input)" },
  "gemini-omni-video-8s-4k-no-video-input":    { upstreamModelId: "gemini-omni-video", protocol: "kie-task-video", billing: "flat-rate", description: "Gemini Omni Video 8s 4K (no input)" },
  "gemini-omni-video-4s-4k-no-video-input":    { upstreamModelId: "gemini-omni-video", protocol: "kie-task-video", billing: "flat-rate", description: "Gemini Omni Video 4s 4K (no input)" },
  "gemini-omni-video-10s-1080p-no-video-input":{ upstreamModelId: "gemini-omni-video", protocol: "kie-task-video", billing: "flat-rate", description: "Gemini Omni Video 10s 1080p (no input)" },
  "gemini-omni-video-8s-1080p-no-video-input": { upstreamModelId: "gemini-omni-video", protocol: "kie-task-video", billing: "flat-rate", description: "Gemini Omni Video 8s 1080p (no input)" },
  "gemini-omni-video-6s-1080p-no-video-input": { upstreamModelId: "gemini-omni-video", protocol: "kie-task-video", billing: "flat-rate", description: "Gemini Omni Video 6s 1080p (no input)" },
  "gemini-omni-video-4s-1080p-no-video-input": { upstreamModelId: "gemini-omni-video", protocol: "kie-task-video", billing: "flat-rate", description: "Gemini Omni Video 4s 1080p (no input)" },
  "gemini-omni-video-10s-720p-no-video-input": { upstreamModelId: "gemini-omni-video", protocol: "kie-task-video", billing: "flat-rate", description: "Gemini Omni Video 10s 720p (no input)" },
  "gemini-omni-video-8s-720p-no-video-input":  { upstreamModelId: "gemini-omni-video", protocol: "kie-task-video", billing: "flat-rate", description: "Gemini Omni Video 8s 720p (no input)" },
  "gemini-omni-video-6s-720p-no-video-input":  { upstreamModelId: "gemini-omni-video", protocol: "kie-task-video", billing: "flat-rate", description: "Gemini Omni Video 6s 720p (no input)" },
  "gemini-omni-video-4s-720p-no-video-input":  { upstreamModelId: "gemini-omni-video", protocol: "kie-task-video", billing: "flat-rate", description: "Gemini Omni Video 4s 720p (no input)" },

  // ── Hailuo (MiniMax Video) ──
  // Upstream IDs confirmed from KIE docs: hailuo/02-* and hailuo/2-3-* format.
  "hailuo-02-text-to-video-standard":  { upstreamModelId: "hailuo/02-text-to-video-standard",  protocol: "kie-task-video", billing: "flat-rate", description: "Hailuo 02 Text-to-Video (Standard)" },
  "hailuo-02-image-to-video-standard": { upstreamModelId: "hailuo/02-image-to-video-standard", protocol: "kie-task-video", billing: "flat-rate", description: "Hailuo 02 Image-to-Video (Standard)" },
  "hailuo-02-text-to-video-pro":       { upstreamModelId: "hailuo/02-text-to-video-pro",       protocol: "kie-task-video", billing: "flat-rate", description: "Hailuo 02 Text-to-Video (Pro)" },
  "hailuo-02-image-to-video-pro":      { upstreamModelId: "hailuo/02-image-to-video-pro",      protocol: "kie-task-video", billing: "flat-rate", description: "Hailuo 02 Image-to-Video (Pro)" },
  "hailuo-2.3-image-to-video-pro":     { upstreamModelId: "hailuo/2-3-image-to-video-pro",     protocol: "kie-task-video", billing: "flat-rate", description: "Hailuo 2.3 Image-to-Video (Pro)" },

  // ── Wan 2.6 (Alibaba Video) ──
  // Upstream IDs confirmed from KIE community integration nodes.
  "wan-2.6-text-to-video":   { upstreamModelId: "wan-2.6-text-to-video",        protocol: "kie-task-video", billing: "flat-rate", description: "Wan 2.6 Text-to-Video" },
  "wan-2.6-image-to-video":  { upstreamModelId: "wan-2.6-flash-image-to-video", protocol: "kie-task-video", billing: "flat-rate", description: "Wan 2.6 Flash Image-to-Video" },

  // ══════════════════════════════════════════════════════════════════════════
  // MUSIC GENERATION (KIE async task)
  // ══════════════════════════════════════════════════════════════════════════

  "suno": { upstreamModelId: "suno", protocol: "kie-task-music", billing: "flat-rate", description: "Suno Music Generation" },

  // ══════════════════════════════════════════════════════════════════════════
  // HAPPYHORSE — Alibaba ATH (video generation + editing)
  // Upstream IDs confirmed from official KIE API docs (happyhorse/* namespace).
  // ══════════════════════════════════════════════════════════════════════════

  // text-to-video: prompt + aspect_ratio + resolution + duration
  "happyhorse-text-to-video":      { upstreamModelId: "happyhorse/text-to-video",      protocol: "kie-task-video", billing: "flat-rate", description: "HappyHorse Text-to-Video" },
  // image-to-video: image_urls (1 image) + prompt + resolution + duration
  "happyhorse-image-to-video":     { upstreamModelId: "happyhorse/image-to-video",     protocol: "kie-task-video", billing: "flat-rate", description: "HappyHorse Image-to-Video" },
  // reference-to-video: reference_image[] (1-9) + prompt + aspect_ratio + resolution + duration
  "happyhorse-reference-to-video": { upstreamModelId: "happyhorse/reference-to-video", protocol: "kie-task-video", billing: "flat-rate", description: "HappyHorse Reference-to-Video (multi-subject)" },
  // video-edit: video_url + prompt + reference_image[] (0-5) + resolution + audio_setting
  "happyhorse-video-edit":         { upstreamModelId: "happyhorse/video-edit",         protocol: "kie-task-video", billing: "flat-rate", description: "HappyHorse Video Edit (style transfer / local replacement)" },

};


// ─────────────────────────────────────────────────────────────────────────────
// Lookup helpers
// ─────────────────────────────────────────────────────────────────────────────

const KIE_TASK_PROTOCOLS = new Set<ModelProtocol>(["kie-task-image", "kie-task-video", "kie-task-music"]);

/**
 * Look up a model in the registry.
 * Returns undefined if not found (caller should fall back to DB capabilities / provider protocol).
 */
export function getRegistryEntry(modelId: string): ModelRegistryEntry | undefined {
  // Exact match
  if (MODEL_REGISTRY[modelId]) return MODEL_REGISTRY[modelId];
  // Prefix match for gemini-omni-video-* variants not explicitly listed
  if (modelId.startsWith("gemini-omni-video-")) {
    return { upstreamModelId: "gemini-omni-video", protocol: "kie-task-video", billing: "flat-rate" };
  }
  // Prefix match for google-veo-3.1-* variants not explicitly listed
  if (modelId.startsWith("google-veo-3.1-")) {
    return { upstreamModelId: "veo3", protocol: "kie-task-video", billing: "flat-rate" };
  }
  // Prefix match for any claude-* model not explicitly listed
  if (modelId.toLowerCase().startsWith("claude-")) {
    return { upstreamModelId: modelId, protocol: "anthropic-chat", billing: "per-token" };
  }
  return undefined;
}

/** Returns true if the model should be routed via a KIE async task. */
export function isKieTaskModel(modelId: string): boolean {
  const entry = getRegistryEntry(modelId);
  return entry !== undefined && KIE_TASK_PROTOCOLS.has(entry.protocol);
}

/** Returns true if the model should use Anthropic format (/claude/v1/messages). */
export function isAnthropicModel(modelId: string): boolean {
  const entry = getRegistryEntry(modelId);
  return entry?.protocol === "anthropic-chat";
}

/** Returns the full registry as a public-safe object (no sensitive data). */
export function getPublicRegistry(): Record<string, Omit<ModelRegistryEntry, never>> {
  return MODEL_REGISTRY;
}
