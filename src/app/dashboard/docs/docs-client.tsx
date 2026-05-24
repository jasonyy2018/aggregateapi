"use client";

import { useState } from "react";
import { useLang } from "@/lib/lang-context";

interface WikiSection {
  slug: string;
  titleEn: string;
  titleZh: string;
  contentEn: string;
  contentZh: string;
}

interface DocsClientProps {
  userKeys: string[];
  discountRate: number;
  wikiSections: WikiSection[];
}

export function DocsClient({ userKeys, discountRate, wikiSections }: DocsClientProps) {
  const { locale } = useLang();

  // Custom high-fidelity lightweight Markdown parser
  const parseMarkdown = (text: string) => {
    if (!text) return null;
    
    const lines = text.split("\n");
    const elements: React.ReactNode[] = [];
    let currentBlock: { type: "paragraph" | "list" | "code"; content: string[] } | null = null;
    let blockKey = 0;

    const renderInline = (str: string): React.ReactNode[] => {
      const parts: React.ReactNode[] = [];
      let i = 0;
      while (i < str.length) {
        if (str.startsWith("**", i)) {
          const nextIdx = str.indexOf("**", i + 2);
          if (nextIdx !== -1) {
            parts.push(<strong key={i} className="font-bold text-text-main">{str.substring(i + 2, nextIdx)}</strong>);
            i = nextIdx + 2;
            continue;
          }
        }
        if (str.startsWith("`", i)) {
          const nextIdx = str.indexOf("`", i + 1);
          if (nextIdx !== -1) {
            parts.push(<code key={i} className="bg-bg-main border border-border-subtle px-1.5 py-0.5 rounded text-xs font-mono text-brand-primary font-medium">{str.substring(i + 1, nextIdx)}</code>);
            i = nextIdx + 1;
            continue;
          }
        }
        if (str.startsWith("[", i)) {
          const endTextIdx = str.indexOf("]", i);
          if (endTextIdx !== -1 && str.startsWith("(", endTextIdx + 1)) {
            const endUrlIdx = str.indexOf(")", endTextIdx + 2);
            if (endUrlIdx !== -1) {
              const linkText = str.substring(i + 1, endTextIdx);
              const url = str.substring(endTextIdx + 2, endUrlIdx);
              parts.push(
                <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-brand-primary font-medium hover:underline">
                  {linkText}
                </a>
              );
              i = endUrlIdx + 1;
              continue;
            }
          }
        }
        parts.push(str[i]);
        i++;
      }
      return parts;
    };

    const flushBlock = (key: string | number) => {
      if (!currentBlock) return;
      if (currentBlock.type === "paragraph") {
        const pText = currentBlock.content.join("\n").trim();
        if (pText) {
          elements.push(
            <p key={key} className="text-text-muted leading-relaxed mb-4">
              {renderInline(pText)}
            </p>
          );
        }
      } else if (currentBlock.type === "list") {
        elements.push(
          <ul key={key} className="list-disc pl-6 space-y-2 mb-4">
            {currentBlock.content.map((item, idx) => (
              <li key={idx} className="text-text-muted leading-relaxed">
                {renderInline(item)}
              </li>
            ))}
          </ul>
        );
      } else if (currentBlock.type === "code") {
        const codeText = currentBlock.content.join("\n");
        elements.push(
          <pre key={key} className="bg-bg-main border border-border-subtle p-4 rounded-xl font-mono text-xs text-text-muted overflow-x-auto my-4 whitespace-pre">
            <code>{codeText}</code>
          </pre>
        );
      }
      currentBlock = null;
    };

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      const trimmed = line.trim();

      if (trimmed.startsWith("```")) {
        if (currentBlock && currentBlock.type === "code") {
          flushBlock(blockKey++);
        } else {
          flushBlock(blockKey++);
          currentBlock = { type: "code", content: [] };
        }
        continue;
      }

      if (currentBlock && currentBlock.type === "code") {
        currentBlock.content.push(line);
        continue;
      }

      if (trimmed.startsWith("#")) {
        flushBlock(blockKey++);
        const match = trimmed.match(/^(#{1,6})\s+(.*)$/);
        if (match) {
          const level = match[1].length;
          const headerText = match[2];
          const headingClasses = [
            "",
            "text-3xl font-extrabold text-text-main mt-8 mb-4 border-b border-border-subtle pb-2",
            "text-2xl font-bold text-text-main mt-6 mb-3 border-b border-border-subtle pb-1.5",
            "text-xl font-bold text-text-main mt-6 mb-3",
            "text-lg font-bold text-text-main mt-4 mb-2",
            "text-base font-bold text-text-main mt-4 mb-2",
            "text-sm font-bold text-text-muted mt-4 mb-2",
          ];
          const content = renderInline(headerText);
          const className = headingClasses[level];
          const key = blockKey++;
          switch (level) {
            case 1:
              elements.push(<h1 key={key} className={className}>{content}</h1>);
              break;
            case 2:
              elements.push(<h2 key={key} className={className}>{content}</h2>);
              break;
            case 3:
              elements.push(<h3 key={key} className={className}>{content}</h3>);
              break;
            case 4:
              elements.push(<h4 key={key} className={className}>{content}</h4>);
              break;
            case 5:
              elements.push(<h5 key={key} className={className}>{content}</h5>);
              break;
            case 6:
              elements.push(<h6 key={key} className={className}>{content}</h6>);
              break;
            default:
              elements.push(<p key={key} className={className}>{content}</p>);
          }
          continue;
        }
      }

      const listMatch = line.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
      if (listMatch) {
        if (currentBlock && currentBlock.type !== "list") {
          flushBlock(blockKey++);
        }
        if (!currentBlock) {
          currentBlock = { type: "list", content: [] };
        }
        currentBlock.content.push(listMatch[3]);
        continue;
      }

      if (trimmed === "") {
        flushBlock(blockKey++);
        continue;
      }

      if (!currentBlock) {
        currentBlock = { type: "paragraph", content: [] };
      }
      currentBlock.content.push(line);
    }
    flushBlock(blockKey++);

    return <div className="space-y-4">{elements}</div>;
  };

  // Compile full fallback static list from localized dictionaries
  const defaultWikiSections = [
    {
      slug: "intro",
      titleEn: enDocs.sections.intro.title,
      titleZh: zhDocs.sections.intro.title,
      contentEn: `${enDocs.sections.intro.p1}\n\n${enDocs.sections.intro.p2}`,
      contentZh: `${zhDocs.sections.intro.p1}\n\n${zhDocs.sections.intro.p2}`,
    },
    {
      slug: "quickstart",
      titleEn: enDocs.sections.quickstart.title,
      titleZh: zhDocs.sections.quickstart.title,
      contentEn: `${enDocs.sections.quickstart.desc}\n\n1. **${enDocs.sections.quickstart.step1Title}**: ${enDocs.sections.quickstart.step1Desc}\n2. **${enDocs.sections.quickstart.step2Title}**: ${enDocs.sections.quickstart.step2Desc}\n3. **${enDocs.sections.quickstart.step3Title}**: ${enDocs.sections.quickstart.step3Desc}`,
      contentZh: `${zhDocs.sections.quickstart.desc}\n\n1. **${zhDocs.sections.quickstart.step1Title}**：${zhDocs.sections.quickstart.step1Desc}\n2. **${zhDocs.sections.quickstart.step2Title}**：${zhDocs.sections.quickstart.step2Desc}\n3. **${zhDocs.sections.quickstart.step3Title}**：${zhDocs.sections.quickstart.step3Desc}`,
    },
    {
      slug: "chat",
      titleEn: enDocs.sections.chat.title,
      titleZh: zhDocs.sections.chat.title,
      contentEn: enDocs.sections.chat.desc,
      contentZh: zhDocs.sections.chat.desc,
    },
    {
      slug: "image",
      titleEn: enDocs.sections.image.title,
      titleZh: zhDocs.sections.image.title,
      contentEn: enDocs.sections.image.desc,
      contentZh: zhDocs.sections.image.desc,
    },
    {
      slug: "tasks",
      titleEn: enDocs.sections.tasks.title,
      titleZh: zhDocs.sections.tasks.title,
      contentEn: enDocs.sections.tasks.desc,
      contentZh: zhDocs.sections.tasks.desc,
    },
    {
      slug: "pricing",
      titleEn: enDocs.sections.pricing.title,
      titleZh: zhDocs.sections.pricing.title,
      contentEn: enDocs.sections.pricing.desc,
      contentZh: zhDocs.sections.pricing.desc,
    },
    {
      slug: "clients",
      titleEn: enDocs.sections.clients.title,
      titleZh: zhDocs.sections.clients.title,
      contentEn: enDocs.sections.clients.desc,
      contentZh: zhDocs.sections.clients.desc,
    },
  ];

  const activeSections = wikiSections && wikiSections.length > 0 ? wikiSections : defaultWikiSections;

  const [activeSection, setActiveSection] = useState<string>(
    activeSections.length > 0 ? activeSections[0].slug : "intro"
  );
  const [activeKey, setActiveKey] = useState<string>(
    userKeys.length > 0 ? userKeys[0] : "YOUR_API_KEY"
  );
  const [activeCodeTabs, setActiveCodeTabs] = useState<Record<string, "curl" | "node" | "python">>({
    chat: "curl",
    image: "curl",
    taskCreate: "curl",
    taskStatus: "curl",
  });
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const t = locale === "zh" ? zhDocs : enDocs;

  // Personalized calculation estimations
  const discountPercent = Math.round((1 - discountRate) * 100);
  const discountMultiplier = discountRate.toFixed(2);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(id);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleCodeTabChange = (endpoint: string, lang: "curl" | "node" | "python") => {
    setActiveCodeTabs((prev) => ({ ...prev, [endpoint]: lang }));
  };

  // Base API url (automatically maps to local or production depending on environment)
  const apiBaseUrl = typeof window !== "undefined" ? `${window.location.protocol}//${window.location.host}/api/v1` : "http://localhost:3000/api/v1";

  // Code generation helpers
  const getChatCode = (lang: "curl" | "node" | "python") => {
    switch (lang) {
      case "curl":
        return `curl -X POST "${apiBaseUrl}/chat/completions" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${activeKey}" \\
  -d '{
    "model": "gemini-2.5-flash",
    "messages": [
      {
        "role": "user",
        "content": "Hello!"
      }
    ],
    "stream": true
  }'`;
      case "node":
        return `import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: "${activeKey}",
  baseURL: "${apiBaseUrl}",
});

async function main() {
  const stream = await openai.chat.completions.create({
    model: "gemini-2.5-flash",
    messages: [{ role: "user", content: "Hello!" }],
    stream: true,
  });

  for await (const chunk of stream) {
    process.stdout.write(chunk.choices[0]?.delta?.content || "");
  }
}

main();`;
      case "python":
        return `from openai import OpenAI

client = OpenAI(
    api_key="${activeKey}",
    base_url="${apiBaseUrl}"
)

completion = client.chat.completions.create(
    model="gemini-2.5-flash",
    messages=[
        {"role": "user", "content": "Hello!"}
    ],
    stream=True
)

for chunk in completion:
    print(chunk.choices[0].delta.content or "", end="")`;
    }
  };

  const getImageCode = (lang: "curl" | "node" | "python") => {
    switch (lang) {
      case "curl":
        return `curl -X POST "${apiBaseUrl}/images/generations" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${activeKey}" \\
  -d '{
    "model": "flux-dev",
    "prompt": "a beautiful digital art of a futuristic cyberpunk city",
    "size": "1024x1024"
  }'`;
      case "node":
        return `import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: "${activeKey}",
  baseURL: "${apiBaseUrl}",
});

async function main() {
  const response = await openai.images.generate({
    model: "flux-dev",
    prompt: "a beautiful digital art of a futuristic cyberpunk city",
    size: "1024x1024"
  });

  console.log("Image URL:", response.data[0].url);
}

main();`;
      case "python":
        return `from openai import OpenAI

client = OpenAI(
    api_key="${activeKey}",
    base_url="${apiBaseUrl}"
)

response = client.images.generate(
    model="flux-dev",
    prompt="a beautiful digital art of a futuristic cyberpunk city",
    size="1024x1024"
)

print("Image URL:", response.data[0].url)`;
    }
  };

  const getTaskCreateCode = (lang: "curl" | "node" | "python") => {
    switch (lang) {
      case "curl":
        return `curl -X POST "${apiBaseUrl}/tasks/create" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${activeKey}" \\
  -d '{
    "model": "gemini-omni-video",
    "prompt": "cinematic tracking shot of a majestic dragon flying over mountains",
    "aspect_ratio": "16:9",
    "duration": "5s"
  }'`;
      case "node":
        return `// Use standard fetch to call our custom async tasks endpoint
async function createVideoTask() {
  const res = await fetch("${apiBaseUrl}/tasks/create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer ${activeKey}"
    },
    body: JSON.stringify({
      model: "gemini-omni-video",
      prompt: "cinematic tracking shot of a majestic dragon flying over mountains",
      aspect_ratio: "16:9",
      duration: "5s"
    })
  });

  const data = await res.json();
  console.log("Async Task Created:", data);
  // Returns: { success: true, taskId: "...", providerSlug: "kie", modelId: "..." }
}`;
      case "python":
        return `# Use standard requests to call our custom async tasks endpoint
import requests

response = requests.post(
    "${apiBaseUrl}/tasks/create",
    headers={"Authorization": "Bearer ${activeKey}"},
    json={
        "model": "gemini-omni-video",
        "prompt": "cinematic tracking shot of a majestic dragon flying over mountains",
        "aspect_ratio": "16:9",
        "duration": "5s"
    }
)

print(response.json())
# Returns: { "success": True, "taskId": "...", "providerSlug": "kie" }`;
    }
  };

  const getTaskStatusCode = (lang: "curl" | "node" | "python") => {
    switch (lang) {
      case "curl":
        return `curl -X GET "${apiBaseUrl}/tasks/status?taskId=TASK_ID_HERE&providerSlug=kie" \\
  -H "Authorization: Bearer ${activeKey}"`;
      case "node":
        return `async function checkTaskStatus(taskId, providerSlug = "kie") {
  const res = await fetch(\`\${apiBaseUrl}/tasks/status?taskId=\${taskId}&providerSlug=\${providerSlug}\`, {
    headers: {
      "Authorization": "Bearer ${activeKey}"
    }
  });

  const status = await res.json();
  console.log("Task Status:", status);
  /* Returns:
     {
       "taskId": "...",
       "state": "success" | "generating" | "fail" | "waiting",
       "resultUrls": ["https://..."],
       "costTime": 15
     }
  */
}`;
      case "python":
        return `import requests

def check_task_status(task_id, provider_slug="kie"):
    url = f"${apiBaseUrl}/tasks/status?taskId={task_id}&providerSlug={provider_slug}"
    response = requests.get(
        url,
        headers={"Authorization": "Bearer ${activeKey}"}
    )
    return response.json()

status = check_task_status("TASK_ID_HERE")
print(status)`;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in pb-12">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-brand-primary/10 via-brand-primary/5 to-bg-surface border border-border-subtle p-8 md:p-12 shadow-sm">
        <div className="absolute right-0 top-0 w-96 h-96 bg-brand-primary/5 rounded-full blur-3xl -z-10" />
        <div className="max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold bg-brand-primary/15 text-brand-primary border border-brand-primary/20">
            📖 AggregatAPI Wiki & Docs
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight bg-gradient-to-r from-text-main to-text-muted bg-clip-text text-transparent">
            {t.title}
          </h1>
          <p className="text-lg text-text-muted leading-relaxed">
            {t.subtitle}
          </p>
        </div>
      </div>

      {/* Real-time Interactive Key Bar */}
      <div className="bg-bg-surface border border-border-subtle rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h4 className="text-base font-semibold flex items-center gap-2 text-text-main">
            🔑 {t.keySelectorTitle}
          </h4>
          <p className="text-xs text-text-muted">
            {t.keySelectorDesc}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {userKeys.length > 0 ? (
            <select
              value={activeKey}
              onChange={(e) => setActiveKey(e.target.value)}
              className="bg-bg-main border border-border-subtle rounded-lg px-4 py-2.5 text-sm font-mono text-brand-primary font-medium focus:outline-none focus:ring-2 focus:ring-brand-primary/50 transition-all cursor-pointer min-w-[240px]"
            >
              {userKeys.map((k) => (
                <option key={k} value={k}>
                  {k.substring(0, 12)}...{k.substring(k.length - 4)}
                </option>
              ))}
            </select>
          ) : (
            <a
              href="/dashboard/keys"
              className="inline-flex items-center gap-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 px-4 py-2.5 text-sm font-semibold border border-red-500/20 transition-all"
            >
              ⚠️ {t.noKeysWarning}
            </a>
          )}
        </div>
      </div>

      {/* Docs Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Navigation Sidebar */}
        <div className="lg:col-span-1 space-y-1 bg-bg-surface border border-border-subtle rounded-xl p-4 h-fit shadow-sm">
          <p className="text-xs font-bold text-text-muted uppercase tracking-wider px-3 mb-3">
            {t.navTitle}
          </p>
          {activeSections.map((section) => (
            <button
              key={section.slug}
              onClick={() => setActiveSection(section.slug)}
              className={`w-full text-left rounded-lg px-3.5 py-3 text-sm font-medium transition-all flex items-center justify-between ${
                activeSection === section.slug
                  ? "bg-brand-primary/10 text-brand-primary border-l-4 border-brand-primary font-semibold"
                  : "text-text-muted hover:text-text-main hover:bg-bg-surface-hover"
              }`}
            >
              <span>{locale === "zh" ? section.titleZh : section.titleEn}</span>
              <span className="text-xs opacity-50">→</span>
            </button>
          ))}
        </div>

        {/* Content Pane */}
        <div className="lg:col-span-3 bg-bg-surface border border-border-subtle rounded-xl p-8 md:p-10 shadow-sm min-h-[500px]">
          {/* Dynamic Content Renderer */}
          {(() => {
            const currentSection = activeSections.find((s) => s.slug === activeSection);
            if (!currentSection) return null;

            return (
              <div className="space-y-6 animate-fade-in">
                <h2 className="text-2xl font-bold border-b border-border-subtle pb-3">
                  {locale === "zh" ? currentSection.titleZh : currentSection.titleEn}
                </h2>
                
                <div className="text-text-muted space-y-4 leading-relaxed">
                  {parseMarkdown(locale === "zh" ? currentSection.contentZh : currentSection.contentEn)}
                </div>

                {/* 1. Introduction Section Optional Grid Cards */}
                {activeSection === "intro" && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                    <div className="bg-bg-main border border-border-subtle p-5 rounded-xl hover:border-brand-primary/40 transition-colors">
                      <div className="text-2xl mb-2">🔌</div>
                      <h5 className="font-semibold text-text-main mb-1">OpenAI Compatible</h5>
                      <p className="text-xs text-text-muted">A seamless drop-in replacement API for standard OpenAI libraries and tools.</p>
                    </div>
                    <div className="bg-bg-main border border-border-subtle p-5 rounded-xl hover:border-brand-primary/40 transition-colors">
                      <div className="text-2xl mb-2">🚀</div>
                      <h5 className="font-semibold text-text-main mb-1">100+ Models</h5>
                      <p className="text-xs text-text-muted">Access leading models including GPT, Claude, Gemini, DeepSeek, and image/video generators.</p>
                    </div>
                    <div className="bg-bg-main border border-border-subtle p-5 rounded-xl hover:border-brand-primary/40 transition-colors">
                      <div className="text-2xl mb-2">💎</div>
                      <h5 className="font-semibold text-text-main mb-1">Smart Routing</h5>
                      <p className="text-xs text-text-muted">High availability and low latency with automatic upstream balancing and fallback.</p>
                    </div>
                  </div>
                )}

                {/* 2. Quick Start Section Endpoint Box */}
                {activeSection === "quickstart" && (
                  <div className="bg-brand-primary/5 rounded-xl border border-brand-primary/15 p-5 mt-4">
                    <h6 className="font-bold text-brand-primary mb-2 flex items-center gap-2">
                      💡 Custom Endpoint Details
                    </h6>
                    <div className="space-y-2 text-sm">
                      <p className="flex items-center gap-2"><strong>API Base URL:</strong> <code className="bg-bg-main border border-border-subtle px-2 py-0.5 rounded font-mono text-brand-primary">{apiBaseUrl}</code></p>
                      <p>This single Base URL is fully compatible with Dify, LobeChat, Cherry Studio, NextChat, and other libraries.</p>
                    </div>
                  </div>
                )}

                {/* 3. Chat Completions Section Code Panel */}
                {activeSection === "chat" && (
                  <div className="border border-border-subtle rounded-xl overflow-hidden shadow-sm bg-bg-main">
                    {/* Tabs Header */}
                    <div className="bg-bg-surface border-b border-border-subtle px-4 py-2 flex items-center justify-between">
                      <div className="flex gap-2">
                        {["curl", "node", "python"].map((lang) => (
                          <button
                            key={lang}
                            onClick={() => handleCodeTabChange("chat", lang as any)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                              activeCodeTabs.chat === lang
                                ? "bg-brand-primary text-brand-primary-text"
                                : "text-text-muted hover:text-text-main hover:bg-bg-surface-hover"
                            }`}
                          >
                            {lang === "curl" ? "cURL" : lang === "node" ? "Node.js" : "Python"}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => copyToClipboard(getChatCode(activeCodeTabs.chat), "chat-code")}
                        className="text-xs text-text-muted hover:text-brand-primary font-medium transition-colors"
                      >
                        {copiedText === "chat-code" ? "✓ Copied" : "📋 Copy"}
                      </button>
                    </div>
                    {/* Code Block */}
                    <pre className="p-5 font-mono text-xs overflow-x-auto text-text-muted leading-relaxed bg-bg-main select-all whitespace-pre">
                      {getChatCode(activeCodeTabs.chat)}
                    </pre>
                  </div>
                )}

                {/* 4. Image Generation Section Code Panel */}
                {activeSection === "image" && (
                  <div className="border border-border-subtle rounded-xl overflow-hidden shadow-sm bg-bg-main">
                    {/* Tabs Header */}
                    <div className="bg-bg-surface border-b border-border-subtle px-4 py-2 flex items-center justify-between">
                      <div className="flex gap-2">
                        {["curl", "node", "python"].map((lang) => (
                          <button
                            key={lang}
                            onClick={() => handleCodeTabChange("image", lang as any)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                              activeCodeTabs.image === lang
                                ? "bg-brand-primary text-brand-primary-text"
                                : "text-text-muted hover:text-text-main hover:bg-bg-surface-hover"
                            }`}
                          >
                            {lang === "curl" ? "cURL" : lang === "node" ? "Node.js" : "Python"}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => copyToClipboard(getImageCode(activeCodeTabs.image), "image-code")}
                        className="text-xs text-text-muted hover:text-brand-primary font-medium transition-colors"
                      >
                        {copiedText === "image-code" ? "✓ Copied" : "📋 Copy"}
                      </button>
                    </div>
                    {/* Code Block */}
                    <pre className="p-5 font-mono text-xs overflow-x-auto text-text-muted leading-relaxed bg-bg-main select-all whitespace-pre">
                      {getImageCode(activeCodeTabs.image)}
                    </pre>
                  </div>
                )}

                {/* 5. Asynchronous Tasks Section Subsections */}
                {activeSection === "tasks" && (
                  <>
                    {/* Subtitle A: Task Creation */}
                    <div className="space-y-3 pt-2">
                      <h4 className="text-base font-bold text-text-main flex items-center gap-2">
                        <span>1. Create Asynchronous Task</span>
                        <code className="bg-bg-main border border-border-subtle px-1.5 py-0.5 rounded text-xs font-mono text-brand-primary font-medium">POST /tasks/create</code>
                      </h4>
                      
                      {/* Code Panel */}
                      <div className="border border-border-subtle rounded-xl overflow-hidden shadow-sm bg-bg-main">
                        {/* Tabs Header */}
                        <div className="bg-bg-surface border-b border-border-subtle px-4 py-2 flex items-center justify-between">
                          <div className="flex gap-2">
                            {["curl", "node", "python"].map((lang) => (
                              <button
                                key={lang}
                                onClick={() => handleCodeTabChange("taskCreate", lang as any)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                  activeCodeTabs.taskCreate === lang
                                    ? "bg-brand-primary text-brand-primary-text"
                                    : "text-text-muted hover:text-text-main hover:bg-bg-surface-hover"
                                }`}
                              >
                                {lang === "curl" ? "cURL" : lang === "node" ? "Node.js" : "Python"}
                              </button>
                            ))}
                          </div>
                          <button
                            onClick={() => copyToClipboard(getTaskCreateCode(activeCodeTabs.taskCreate), "task-create-code")}
                            className="text-xs text-text-muted hover:text-brand-primary font-medium transition-colors"
                          >
                            {copiedText === "task-create-code" ? "✓ Copied" : "📋 Copy"}
                          </button>
                        </div>
                        {/* Code Block */}
                        <pre className="p-5 font-mono text-xs overflow-x-auto text-text-muted leading-relaxed bg-bg-main select-all whitespace-pre">
                          {getTaskCreateCode(activeCodeTabs.taskCreate)}
                        </pre>
                      </div>
                    </div>

                    {/* Subtitle B: Task Status Query */}
                    <div className="space-y-3 pt-6">
                      <h4 className="text-base font-bold text-text-main flex items-center gap-2">
                        <span>2. Query Task Status & Results</span>
                        <code className="bg-bg-main border border-border-subtle px-1.5 py-0.5 rounded text-xs font-mono text-brand-primary font-medium">GET /tasks/status</code>
                      </h4>
                      
                      {/* Code Panel */}
                      <div className="border border-border-subtle rounded-xl overflow-hidden shadow-sm bg-bg-main">
                        {/* Tabs Header */}
                        <div className="bg-bg-surface border-b border-border-subtle px-4 py-2 flex items-center justify-between">
                          <div className="flex gap-2">
                            {["curl", "node", "python"].map((lang) => (
                              <button
                                key={lang}
                                onClick={() => handleCodeTabChange("taskStatus", lang as any)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                  activeCodeTabs.taskStatus === lang
                                    ? "bg-brand-primary text-brand-primary-text"
                                    : "text-text-muted hover:text-text-main hover:bg-bg-surface-hover"
                                }`}
                              >
                                {lang === "curl" ? "cURL" : lang === "node" ? "Node.js" : "Python"}
                              </button>
                            ))}
                          </div>
                          <button
                            onClick={() => copyToClipboard(getTaskStatusCode(activeCodeTabs.taskStatus), "task-status-code")}
                            className="text-xs text-text-muted hover:text-brand-primary font-medium transition-colors"
                          >
                            {copiedText === "task-status-code" ? "✓ Copied" : "📋 Copy"}
                          </button>
                        </div>
                        {/* Code Block */}
                        <pre className="p-5 font-mono text-xs overflow-x-auto text-text-muted leading-relaxed bg-bg-main select-all whitespace-pre">
                          {getTaskStatusCode(activeCodeTabs.taskStatus)}
                        </pre>
                      </div>
                    </div>
                  </>
                )}

                {/* 6. Pricing & Personalized Discount Section */}
                {activeSection === "pricing" && (
                  <div className="space-y-6">
                    {/* Personalized Discount Banner */}
                    <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-bg-surface border border-emerald-500/20 p-6 rounded-2xl relative overflow-hidden animate-fade-in">
                      <div className="max-w-xl space-y-2">
                        <span className="text-xs font-semibold text-emerald-500 uppercase tracking-widest">
                          🎁 Personalized Member Reward
                        </span>
                        <h4 className="text-xl font-bold text-text-main">
                          {locale === "zh"
                            ? `您的专属计费折扣率已激活！`
                            : "Your Exclusive Discount is Active!"}
                        </h4>
                        <p className="text-sm text-text-muted leading-relaxed">
                          {locale === "zh"
                            ? `经平台管理配置，您的专属折扣为 ${discountPercent}% OFF（扣款费率倍率：${discountMultiplier}）。此折扣将自动应用到您发出的所有文本、图像、视频生成等 API 消费中，省钱看得见！`
                            : `Configured by admins, your custom discount gives you ${discountPercent}% OFF (billing multiplier: ${discountMultiplier}). This rate will be automatically applied to all your chat completions, image, and video generation API calls.`}
                        </p>
                      </div>

                      {/* Visual Rate Badge */}
                      <div className="absolute right-6 bottom-6 hidden md:flex flex-col items-center justify-center w-24 h-24 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 shadow-sm animate-pulse">
                        <span className="text-3xl font-extrabold">{discountPercent}%</span>
                        <span className="text-[10px] font-semibold uppercase tracking-wider">OFF</span>
                      </div>
                    </div>

                    {/* Table comparing costs */}
                    <div className="space-y-3 pt-4">
                      <h5 className="font-bold text-text-main">
                        {locale === "zh" ? "当前账户专属资费估算（实时按折扣率换算）" : "Personal Pricing Estimator (Real-time Calculated)"}
                      </h5>
                      <div className="border border-border-subtle rounded-xl overflow-hidden bg-bg-main">
                        <table className="w-full border-collapse text-left text-sm">
                          <thead>
                            <tr className="bg-bg-surface border-b border-border-subtle font-medium text-text-muted">
                              <th className="p-4">{locale === "zh" ? "模型名称" : "Model Name"}</th>
                              <th className="p-4">{locale === "zh" ? "上游官方价格" : "Official Price"}</th>
                              <th className="p-4">{locale === "zh" ? "平台标准单价" : "Standard Retail"}</th>
                              <th className="p-4 text-emerald-500">{locale === "zh" ? "您的实际折后价" : "Your Price (Discount Active)"}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border-subtle text-text-muted">
                            <tr>
                              <td className="p-4 font-bold text-text-main">GPT-4o (per 1M Prompt)</td>
                              <td className="p-4 font-mono">$5.00</td>
                              <td className="p-4 font-mono">$6.00</td>
                              <td className="p-4 font-mono font-bold text-emerald-500 bg-emerald-500/5">${(6.0 * discountRate).toFixed(3)}</td>
                            </tr>
                            <tr>
                              <td className="p-4 font-bold text-text-main">DeepSeek Chat (per 1M Output)</td>
                              <td className="p-4 font-mono">$0.28</td>
                              <td className="p-4 font-mono">$0.34</td>
                              <td className="p-4 font-mono font-bold text-emerald-500 bg-emerald-500/5">${(0.34 * discountRate).toFixed(3)}</td>
                            </tr>
                            <tr>
                              <td className="p-4 font-bold text-text-main">Flux Schnell (per Image)</td>
                              <td className="p-4 font-mono">$0.08</td>
                              <td className="p-4 font-mono">$0.05</td>
                              <td className="p-4 font-mono font-bold text-emerald-500 bg-emerald-500/5">${(0.05 * discountRate).toFixed(3)}</td>
                            </tr>
                            <tr>
                              <td className="p-4 font-bold text-text-main">Gemini Omni Video (per Video Task)</td>
                              <td className="p-4 font-mono">N/A</td>
                              <td className="p-4 font-mono">$1.20</td>
                              <td className="p-4 font-mono font-bold text-emerald-500 bg-emerald-500/5">${(1.20 * discountRate).toFixed(3)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* 7. SDK & Client Integrations Section Guide */}
                {activeSection === "clients" && (
                  <div className="bg-bg-main border border-border-subtle rounded-xl p-6 space-y-4 hover:border-brand-primary/40 transition-colors">
                    <h4 className="font-bold text-text-main flex items-center gap-2.5">
                      <span className="text-2xl">🍒</span>
                      <span>{locale === "zh" ? "Cherry Studio 接入指南" : "Cherry Studio Setup"}</span>
                    </h4>
                    <div className="space-y-3 text-sm">
                      <p>{locale === "zh" ? "Cherry Studio 是一款界面极其优雅精美、功能强大的跨平台桌面 AI 助手。接入方法如下：" : "Cherry Studio is a beautiful, feature-rich desktop client. Follow these steps to hook it up to AggregatAPI:"}</p>
                      <ol className="list-decimal list-inside space-y-2 pl-2">
                        <li>{locale === "zh" ? "打开 Cherry Studio，点击左下角的「设置」齿轮图标。" : "Open Cherry Studio, click the 'Settings' gear icon in the bottom-left corner."}</li>
                        <li>{locale === "zh" ? "在左侧栏选择「模型服务商」，在右侧自定义服务商列表中找到并点击「OpenAI 兼容」。" : "Navigate to 'Model Providers' (模型服务商) on the left sidebar, scroll down to find 'OpenAI Compatible' (OpenAI 兼容) under custom providers, and click it."}</li>
                        <li>
                          {locale === "zh" ? "将「API 基础 URL (Base URL)」配置为我们下方的网关地址" : "Set the 'API Base URL' (API Base URL) field to our gateway address"}:
                          <div className="mt-1 flex items-center gap-2">
                            <code className="bg-bg-surface border border-border-subtle px-2 py-1 rounded font-mono text-xs text-brand-primary font-medium">{apiBaseUrl}</code>
                            <button
                              onClick={() => copyToClipboard(apiBaseUrl, "base-url")}
                              className="text-xs text-brand-primary font-semibold hover:underline"
                            >
                              {copiedText === "base-url" ? "✓ Copied" : "📋 Copy"}
                            </button>
                          </div>
                        </li>
                        <li>
                          {locale === "zh" ? "将「API Key」填入我们下方自动为您预填的专属密钥" : "Set the 'API Key' field to your active token copied below"}:
                          <div className="mt-1 flex items-center gap-2">
                            <code className="bg-bg-surface border border-border-subtle px-2 py-1 rounded font-mono text-xs text-brand-primary font-medium">
                              {activeKey.substring(0, 10)}...{activeKey.substring(activeKey.length - 4)}
                            </code>
                            <button
                              onClick={() => copyToClipboard(activeKey, "secret-key")}
                              className="text-xs text-brand-primary font-semibold hover:underline"
                            >
                              {copiedText === "secret-key" ? "✓ Copied" : "📋 Copy"}
                            </button>
                          </div>
                        </li>
                        <li>{locale === "zh" ? "点击「管理/自动获取模型列表」按钮。客户端将立刻自动拉取平台已为您启用的 10 个对话模型。点击保存即可开始畅快对话！" : "Click 'Auto-detect / Manage Models' (自动获取模型列表). It will instantly load and sync all 10 enabled LLM models. Click Save and start chatting!"}</li>
                      </ol>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

// ================= English Documentation Content =================
const enDocs = {
  title: "API Integration Wiki",
  subtitle: "Connect your applications to 100+ standard models instantly using our unified OpenAI-compatible API gateway.",
  keySelectorTitle: "Select API Key for Examples",
  keySelectorDesc: "All code snippets below will be automatically injected with your chosen key.",
  noKeysWarning: "You have no active keys. Click here to generate one first.",
  navTitle: "WIKI SECTIONS",
  sections: {
    intro: {
      navLabel: "🚀 Overview",
      title: "Gateway Overview",
      p1: "Welcome to AggregatAPI documentation! AggregatAPI is a high-availability, low-latency API gateway that aggregates dozens of state-of-the-art LLMs, drawing models, and video generators. We act as a single, cohesive bridge, giving you access to all state-of-the-art models using a single API token.",
      p2: "By exposing a 100% OpenAI-compatible endpoint, we enable you to instantly integrate our catalog with standard open-source tools, chat interfaces, and libraries without modifying your application code."
    },
    quickstart: {
      navLabel: "⚡ Quick Start",
      title: "Three-Step Quick Start",
      desc: "Get integrated in under two minutes by following these simple steps:",
      step1Title: "Generate API Key",
      step1Desc: "Go to the API Keys tab in your dashboard, click 'Create New Key', and copy the token.",
      step2Title: "Update Endpoint Base URL",
      step2Desc: "Change the default OpenAI or provider endpoint base URL in your application settings to our custom URL.",
      step3Title: "Set Bearer Token",
      step3Desc: "Replace the API key string in your client with your newly generated AggregatAPI key, and select any enabled model!",
    },
    chat: {
      navLabel: "💬 Chat Completions",
      title: "Chat Completions API (/v1/chat/completions)",
      desc: "Supports single and multi-turn conversations with support for streaming, system prompts, reasoning, and tool calls. Fully compatible with OpenAI standard payload format.",
    },
    image: {
      navLabel: "🎨 Image Generation",
      title: "Image Generation API (/v1/images/generations)",
      desc: "Generate stunning high-resolution images synchronously. Features internal automatic polling for asynchronous upstream vendors (like Kie.ai Flux/Midjourney) to return a clean synchronous response to the client.",
    },
    tasks: {
      navLabel: "🎥 Video & Async Tasks",
      title: "Asynchronous Video & Music Tasks",
      desc: "For heavy multimodal generation workloads (such as Kling, Seedance, Veo videos, or Suno music), we provide a lightweight, asynchronous task gateway. Submit a request to obtain a Task ID, then poll the status endpoint for the final result URL.",
    },
    pricing: {
      navLabel: "💳 Billing & Member Rates",
      title: "Billing Details & Personalized Discounts",
      desc: "Platform pricing is billed strictly on consumption. Text models bill per token, while image and video models deduct a flat fee per successful request. To give you the ultimate deal, we support custom user-level discount multipliers.",
      compareTitle: "Personal Pricing Estimator (Real-time Calculated)",
      colModel: "Model Name",
      colOfficial: "Official Price",
      colStandard: "Standard Retail",
      colYourCost: "Your Price (Discount Active)",
    },
    clients: {
      navLabel: "🍒 Client Integrations",
      title: "Third-Party App & Client Integration",
      desc: "Our platform integrates seamlessly with standard desktop and web AI clients. Here is a step-by-step setup guide for popular clients.",
      cherryTitle: "Cherry Studio Setup",
      cherryDesc: "Cherry Studio is a beautiful, feature-rich desktop client. Follow these steps to hook it up to AggregatAPI:",
      cherryStep1: "Open Cherry Studio, click the 'Settings' gear icon in the bottom-left corner.",
      cherryStep2: "Navigate to 'Model Providers' (模型服务商) on the left sidebar, scroll down to find 'OpenAI Compatible' (OpenAI 兼容) under custom providers, and click it.",
      cherryStep3: "Set the 'API Base URL' (API 基础 URL) field to our gateway address",
      cherryStep4: "Set the 'API Key' field to your active token copied below",
      cherryStep5: "Click 'Auto-detect / Manage Models' (自动获取模型列表). It will instantly load and sync all 10 enabled LLM models. Click Save and start chatting!",
    }
  }
};

// ================= Chinese Documentation Content =================
const zhDocs = {
  title: "API 开发者集成文档 (Wiki)",
  subtitle: "通过我们统一的 OpenAI 兼容 API 网关，将您的应用一键连接至 100+ 领先的 AI 大语言模型、绘图模型与视频模型。",
  keySelectorTitle: "选择用于示例的 API 密钥",
  keySelectorDesc: "下方所有代码示例和集成指南都将自动注入您选择的密钥，方便您直接复制运行。",
  noKeysWarning: "您当前没有启用中的密钥，点击此处去创建您的第一个 API 密钥。",
  navTitle: "WIKI 目录",
  sections: {
    intro: {
      navLabel: "🚀 平台总览",
      title: "网关总览",
      p1: "欢迎阅读 AggregatAPI 开发者集成文档！AggregatAPI 是一款高可用、低延迟的 API 聚合网关，无缝整合了包括 GPT、Claude、Gemini、DeepSeek 在内的数十款主流大语言模型，以及 Flux、Suno、Veo 等优秀的图像、音乐与视频生成模型。我们充当统一的桥梁，让您只需一个 Token 即可调通全网所有顶尖大模型。",
      p2: "通过提供 100% 兼容 OpenAI 格式的标准 API 端点，您可以直接在现有的开源客户端、对话工具和代码库中无缝切换到我们的服务，无需对业务代码进行任何侵入式修改。"
    },
    quickstart: {
      navLabel: "⚡ 快速入门",
      title: "三步极速接入",
      desc: "只需不到两分钟，即可将您的应用或客户端切换至我们的聚合网关：",
      step1Title: "创建 API 密钥",
      step1Desc: "在左侧菜单进入“API 密钥”页面，点击“创建新密钥”，并复制保存生成的 Token。",
      step2Title: "替换 Base URL 接口地址",
      step2Desc: "在您的客户端或代码中，将原 OpenAI 官方 Base URL 替换为我们提供的统一网关地址。",
      step3Title: "注入 Bearer 令牌并调用",
      step3Desc: "在 API Key 字段中填入您刚刚生成的 AggregatAPI 密钥，选择任意已启用的模型，即可开启对话！",
    },
    chat: {
      navLabel: "💬 对话补全",
      title: "对话补全接口 (/v1/chat/completions)",
      desc: "支持单轮与多轮对话，完美兼容流式输出 (Streaming)、系统预设 (System Prompt)、深度推理链 (Reasoning) 以及工具调用 (Tool Call)。",
    },
    image: {
      navLabel: "🎨 图像绘制",
      title: "图像生成接口 (/v1/images/generations)",
      desc: "支持高分辨率画作同步生成。网关已在内部针对 Kie.ai 等异步上游通道（如 Flux / Midjourney 等）自动实现了高效的状态轮询，能以完美的同步响应结构直接返回图片 URL，完美兼容标准绘图客户端。",
    },
    tasks: {
      navLabel: "🎥 视频与异步任务",
      title: "视频生成与音乐生成异步网关",
      desc: "针对重型多模态任务（如 Kling、Seedance、Veo 视频生成，以及 Suno 音乐创作），我们提供了专门的轻量级异步任务接口。发送生成请求后会立即返回任务 ID (Task ID)，随后请求状态接口查询生成进度和结果链接。",
    },
    pricing: {
      navLabel: "💳 专属计费与折扣",
      title: "资费详情与专属折扣优惠",
      desc: "平台采用透明的后付费计量制：文本模型按 Token 消耗计费，绘图和视频模型按次（Request）计费。为了给您提供最优的价格，我们提供了账户级别的专属费率折扣倍率。",
      compareTitle: "当前账户专属资费估算（实时按折扣率换算）",
      colModel: "模型名称",
      colOfficial: "上游官方价格",
      colStandard: "平台标准单价",
      colYourCost: "您的实际折后价",
    },
    clients: {
      navLabel: "🍒 第三方客户端集成",
      title: "第三方软件与客户端配置指南",
      desc: "平台网关完美兼容市面上主流的桌面端与网页端 AI 软件。以下是热门客户端的详细配置说明：",
      cherryTitle: "Cherry Studio 接入指南",
      cherryDesc: "Cherry Studio 是一款界面极其优雅精美、功能强大的跨平台桌面 AI 助手。接入方法如下：",
      cherryStep1: "打开 Cherry Studio，点击左下角的「设置」齿轮图标。",
      cherryStep2: "在左侧栏选择「模型服务商」，在右侧自定义服务商列表中找到并点击「OpenAI 兼容」。",
      cherryStep3: "将「API 基础 URL (Base URL)」配置为我们下方的网关地址",
      cherryStep4: "将「API Key」填入我们下方自动为您预填的专属密钥",
      cherryStep5: "点击「管理/自动获取模型列表」按钮。客户端将立刻自动拉取平台已为您启用的 10 个对话模型。点击保存即可开始畅快对话！",
    }
  }
};
