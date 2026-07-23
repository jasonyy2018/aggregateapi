/**
 * Input validation helpers for API endpoints.
 *
 * Provides type-safe validation functions that return errors on invalid input,
 * allowing callers to handle validation failures consistently.
 */

// ─── Chat Completions Validation ──────────────────────────────────────────────

export interface ChatValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate chat completion request body.
 * Returns an error message if validation fails, or null if valid.
 */
export function validateChatBody(body: any): string | null {
  if (!body || typeof body !== "object") {
    return "Request body must be a JSON object";
  }

  // Model is required
  if (!body.model || typeof body.model !== "string" || !body.model.trim()) {
    return "Missing or invalid 'model' field";
  }

  // Messages is required and must be a non-empty array
  if (!Array.isArray(body.messages)) {
    return "'messages' must be an array";
  }
  if (body.messages.length === 0) {
    return "'messages' must not be empty";
  }

  // Validate each message
  const validRoles = new Set(["system", "user", "assistant", "tool"]);
  for (let i = 0; i < body.messages.length; i++) {
    const msg = body.messages[i];
    if (!msg || typeof msg !== "object") {
      return `Message at index ${i} must be an object`;
    }
    if (!validRoles.has(msg.role)) {
      return `Invalid role '${msg.role}' in message at index ${i}. Valid roles: system, user, assistant, tool`;
    }
    if (msg.content === undefined || msg.content === null) {
      return `Missing 'content' in message at index ${i}`;
    }
    if (typeof msg.content !== "string" && !Array.isArray(msg.content)) {
      return `Invalid 'content' type in message at index ${i}. Must be string or array`;
    }
  }

  // Temperature bounds
  if (body.temperature !== undefined) {
    const t = Number(body.temperature);
    if (isNaN(t) || t < 0 || t > 2) {
      return "'temperature' must be between 0 and 2";
    }
  }

  // Max tokens must be positive integer
  if (body.max_tokens !== undefined) {
    const mt = Number(body.max_tokens);
    if (!Number.isInteger(mt) || mt <= 0) {
      return "'max_tokens' must be a positive integer";
    }
  }

  // Top-p bounds
  if (body.top_p !== undefined) {
    const tp = Number(body.top_p);
    if (isNaN(tp) || tp < 0 || tp > 1) {
      return "'top_p' must be between 0 and 1";
    }
  }

  return null; // Valid
}

// ─── Image Generation Validation ──────────────────────────────────────────────

/**
 * Validate image generation request body.
 * Returns an error message if validation fails, or null if valid.
 */
export function validateImageBody(body: any): string | null {
  if (!body || typeof body !== "object") {
    return "Request body must be a JSON object";
  }

  // Model is required
  if (!body.model || typeof body.model !== "string" || !body.model.trim()) {
    return "Missing or invalid 'model' field";
  }

  // Prompt is required and must be non-empty string
  if (!body.prompt || typeof body.prompt !== "string" || !body.prompt.trim()) {
    return "Missing or empty 'prompt' field";
  }

  // Size validation (optional but if provided must match pattern)
  if (body.size !== undefined) {
    if (typeof body.size !== "string" || !/^\d+x\d+$/.test(body.size)) {
      return "'size' must match format like '1024x1024'";
    }
  }

  // N validation
  if (body.n !== undefined) {
    const n = Number(body.n);
    if (!Number.isInteger(n) || n < 1 || n > 10) {
      return "'n' must be an integer between 1 and 10";
    }
  }

  // Response format validation
  if (body.response_format !== undefined) {
    const validFormats = ["url", "b64_json"];
    if (!validFormats.includes(body.response_format)) {
      return "'response_format' must be one of: url, b64_json";
    }
  }

  return null; // Valid
}

// ─── Task Creation Validation ─────────────────────────────────────────────────

/**
 * Validate task creation request body.
 * Returns an error message if validation fails, or null if valid.
 */
export function validateTaskBody(body: any): string | null {
  if (!body || typeof body !== "object") {
    return "Request body must be a JSON object";
  }

  // Model is required
  if (!body.model || typeof body.model !== "string" || !body.model.trim()) {
    return "Missing or invalid 'model' field";
  }

  // Prompt is required and must be non-empty string
  if (!body.prompt || typeof body.prompt !== "string" || !body.prompt.trim()) {
    return "Missing or empty 'prompt' field";
  }

  // Aspect ratio validation (optional)
  if (body.aspect_ratio !== undefined) {
    const validRatios = ["auto", "1:1", "16:9", "9:16", "4:3", "3:4"];
    if (!validRatios.includes(body.aspect_ratio)) {
      return `Invalid 'aspect_ratio'. Valid values: ${validRatios.join(", ")}`;
    }
  }

  // Duration validation (optional)
  if (body.duration !== undefined) {
    const dur = typeof body.duration === "number" ? body.duration : parseFloat(body.duration);
    if (isNaN(dur) || dur <= 0) {
      return "'duration' must be a positive number";
    }
  }

  // Image URL validation (optional)
  if (body.image_url !== undefined) {
    if (typeof body.image_url !== "string" || !/^https?:\/\/.+/.test(body.image_url)) {
      return "'image_url' must be a valid HTTP(S) URL";
    }
  }

  // Image URLs array validation (optional)
  if (body.image_urls !== undefined) {
    if (!Array.isArray(body.image_urls)) {
      return "'image_urls' must be an array";
    }
    for (let i = 0; i < body.image_urls.length; i++) {
      if (typeof body.image_urls[i] !== "string" || !/^https?:\/\/.+/.test(body.image_urls[i])) {
        return `Invalid URL in 'image_urls' at index ${i}`;
      }
    }
  }

  return null; // Valid
}

// ─── Payment Validation ───────────────────────────────────────────────────────

/**
 * Validate payment amount.
 * Returns an error message if validation fails, or null if valid.
 */
export function validatePaymentAmount(amount: any): string | null {
  if (amount === undefined || amount === null) {
    return "Amount is required";
  }

  const num = Number(amount);
  if (isNaN(num)) {
    return "Amount must be a number";
  }
  if (num <= 0) {
    return "Amount must be greater than 0";
  }
  if (num > 10000) {
    return "Amount must not exceed $10,000";
  }

  return null; // Valid
}
