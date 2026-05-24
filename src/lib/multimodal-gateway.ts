/**
 * Multimodal Gateway Service
 * 
 * Exposes methods to handle Image Generation, Video Generation, and Music Generation tasks,
 * translating standard/clean client requests to upstream APIs (such as Kie.ai).
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

/**
 * 1. Synchronous Image Generation.
 * Maps the standard request to the upstream API and formats back to OpenAI shape.
 * If the upstream is asynchronous (like Kie.ai's Flux/Midjourney), it polls internally 
 * to provide a seamless synchronous response to the client.
 */
export async function generateImage(args: {
  provider: { baseUrl: string; protocol: string; slug: string; extraHeaders?: any };
  apiKey: string;
  upstreamModelId: string;
  body: ImageGenerationBody;
}): Promise<any> {
  const { provider, apiKey, upstreamModelId, body } = args;
  const base = provider.baseUrl.replace(/\/+$/, "");
  const isKie = provider.slug.toLowerCase() === "kie" || base.includes("kie.ai");

  if (isKie) {
    // Kie.ai has custom asynchronous image generation endpoints, e.g. for Flux/Midjourney
    // Let's use the unified createTask API for Kie.ai to generate images!
    const cleanBase = base.replace(/\/v1$/, ""); // Ensure root API
    const size = body.size || "1024x1024";
    const [width, height] = size.split("x").map(Number);

    const payload = {
      model: upstreamModelId,
      input: {
        prompt: body.prompt,
        width: isNaN(width) ? 1024 : width,
        height: isNaN(height) ? 1024 : height,
      },
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

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Kie.ai Image Task Creation Failed (HTTP ${res.status}): ${text.slice(0, 200)}`);
    }

    const data = await res.json();
    const taskId = data?.data?.taskId;
    if (!taskId) {
      throw new Error(`Kie.ai did not return a taskId. Response: ${JSON.stringify(data)}`);
    }

    // Now, poll internally until the image generation completes to return a synchronous OpenAI response
    const maxRetries = 25; // max 50 seconds
    for (let i = 0; i < maxRetries; i++) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const status = await queryKieTaskStatus({ cleanBase, apiKey, taskId, extraHeaders: provider.extraHeaders });
      if (status.state === "success") {
        return {
          created: Math.floor(Date.now() / 1000),
          data: status.resultUrls.map((url) => ({ url })),
        };
      }
      if (status.state === "fail") {
        throw new Error(`Kie.ai Image Generation Failed: ${status.failMsg || "Unknown error"}`);
      }
    }

    throw new Error("Kie.ai Image Generation Timeout (50s exceeded). Please check task status in dashboard.");
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

  const cleanBase = base.replace(/\/v1$/, ""); // Ensure root API
  const payload = {
    model: upstreamModelId,
    input: {
      prompt: body.prompt,
      aspect_ratio: body.aspect_ratio || "16:9",
      duration: body.duration || "5s",
      image_url: body.image_url || undefined,
      style: body.style || undefined,
      lyrics: body.lyrics || undefined,
      instrumental: body.instrumental !== undefined ? body.instrumental : undefined,
    },
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

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Kie.ai Task Creation Failed (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  const taskId = data?.data?.taskId;
  if (!taskId) {
    throw new Error(`Kie.ai did not return a taskId. Response: ${JSON.stringify(data)}`);
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
  const base = provider.baseUrl.replace(/\/+$/, "");
  const cleanBase = base.replace(/\/v1$/, ""); // Ensure root API

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
    throw new Error(`Kie.ai task query failed (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }

  const result = await res.json();
  const taskData = result?.data;
  if (!taskData) {
    throw new Error(`Kie.ai returned empty job data for task: ${taskId}`);
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
      // Fallback in case resultJson is a direct string or formatted differently
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
