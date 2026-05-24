"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useLang } from "@/lib/lang-context";

type ModelItem = {
  id: string; // "providerSlug/modelId"
  displayName: string;
  capabilities: string[];
  providerProtocol: string;
  providerSlug: string;
  modelId: string;
  pricing: number;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};

type GeneratedImage = {
  id: string;
  url: string;
  prompt: string;
  model: string;
  timestamp: string;
};

type GeneratedVideo = {
  id: string;
  url?: string;
  prompt: string;
  model: string;
  status: "waiting" | "generating" | "success" | "fail";
  taskId?: string;
  providerSlug?: string;
  failMsg?: string;
  timestamp: string;
};

type GeneratedMusic = {
  id: string;
  url?: string;
  prompt: string;
  model: string;
  status: "waiting" | "generating" | "success" | "fail";
  taskId?: string;
  providerSlug?: string;
  failMsg?: string;
  lyrics?: string;
  style?: string;
  timestamp: string;
};

export function PlaygroundClient({
  apiKey,
  models,
  userEmail,
}: {
  apiKey: string | null;
  models: ModelItem[];
  userEmail: string;
}) {
  const { t, locale } = useLang();
  const [activeTab, setActiveTab] = useState<"chat" | "image" | "video" | "music">("chat");

  // Models partitioned by category
  const chatModels = models.filter((m) => m.providerProtocol === "OPENAI" || m.providerProtocol === "ANTHROPIC" || m.providerProtocol === "GEMINI");
  const imageModels = models.filter((m) => m.modelId.includes("flux") || m.modelId.includes("midjourney") || m.modelId.includes("dall-e") || m.capabilities.includes("image"));
  const videoModels = models.filter((m) => m.modelId.includes("kling") || m.modelId.includes("runway") || m.modelId.includes("veo") || m.modelId.includes("video"));
  const musicModels = models.filter((m) => m.modelId.includes("suno") || m.modelId.includes("udio") || m.modelId.includes("music"));

  // Fallback default arrays
  const finalChatModels = chatModels.length > 0 ? chatModels : models;
  const finalImageModels = imageModels.length > 0 ? imageModels : models.slice(0, 3);
  const finalVideoModels = videoModels.length > 0 ? videoModels : models.slice(0, 3);
  const finalMusicModels = musicModels.length > 0 ? musicModels : models.slice(0, 3);

  // 💬 Chat State
  const [selectedChatModel, setSelectedChatModel] = useState(finalChatModels[0]?.id || "");
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // 🎨 Image State
  const [selectedImageModel, setSelectedImageModel] = useState(finalImageModels[0]?.id || "");
  const [imagePrompt, setImagePrompt] = useState("");
  const [imageSize, setImageSize] = useState("1024x1024");
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [imageError, setImageError] = useState("");

  // 🎬 Video State
  const [selectedVideoModel, setSelectedVideoModel] = useState(finalVideoModels[0]?.id || "");
  const [videoPrompt, setVideoPrompt] = useState("");
  const [videoAspect, setVideoAspect] = useState("16:9");
  const [videoDuration, setVideoDuration] = useState("5s");
  const [videos, setVideos] = useState<GeneratedVideo[]>([]);
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState("");

  // 🎵 Music State
  const [selectedMusicModel, setSelectedMusicModel] = useState(finalMusicModels[0]?.id || "");
  const [musicPrompt, setMusicPrompt] = useState("");
  const [musicStyle, setMusicStyle] = useState("");
  const [musicLyrics, setMusicLyrics] = useState("");
  const [musicInstrumental, setMusicInstrumental] = useState(false);
  const [songs, setSongs] = useState<GeneratedMusic[]>([]);
  const [isMusicLoading, setIsMusicLoading] = useState(false);
  const [musicError, setMusicError] = useState("");

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Polling for active video and music tasks
  useEffect(() => {
    const activeVideoTasks = videos.filter((v) => v.status === "waiting" || v.status === "generating");
    const activeMusicTasks = songs.filter((s) => s.status === "waiting" || s.status === "generating");

    if (activeVideoTasks.length === 0 && activeMusicTasks.length === 0) return;

    const interval = setInterval(async () => {
      // 1. Poll Video Tasks
      for (const video of activeVideoTasks) {
        if (!video.taskId || !video.providerSlug) continue;
        try {
          const res = await fetch(`/api/v1/tasks/status?taskId=${encodeURIComponent(video.taskId)}&providerSlug=${encodeURIComponent(video.providerSlug)}`, {
            headers: { Authorization: `Bearer ${apiKey}` },
          });
          if (res.ok) {
            const data = await res.json();
            if (data.state === "success") {
              setVideos((prev) =>
                prev.map((v) =>
                  v.id === video.id
                    ? { ...v, status: "success", url: data.resultUrls[0] }
                    : v
                )
              );
            } else if (data.state === "fail") {
              setVideos((prev) =>
                prev.map((v) =>
                  v.id === video.id
                    ? { ...v, status: "fail", failMsg: data.failMsg || "Generation failed" }
                    : v
                )
              );
            }
          }
        } catch (e) {
          console.error("Error polling video task:", e);
        }
      }

      // 2. Poll Music Tasks
      for (const song of activeMusicTasks) {
        if (!song.taskId || !song.providerSlug) continue;
        try {
          const res = await fetch(`/api/v1/tasks/status?taskId=${encodeURIComponent(song.taskId)}&providerSlug=${encodeURIComponent(song.providerSlug)}`, {
            headers: { Authorization: `Bearer ${apiKey}` },
          });
          if (res.ok) {
            const data = await res.json();
            if (data.state === "success") {
              setSongs((prev) =>
                prev.map((s) =>
                  s.id === song.id
                    ? { ...s, status: "success", url: data.resultUrls[0] }
                    : s
                )
              );
            } else if (data.state === "fail") {
              setSongs((prev) =>
                prev.map((s) =>
                  s.id === song.id
                    ? { ...s, status: "fail", failMsg: data.failMsg || "Generation failed" }
                    : s
                )
              );
            }
          }
        } catch (e) {
          console.error("Error polling music task:", e);
        }
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [videos, songs, apiKey]);

  // 💬 Handle Chat Send
  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !apiKey || isChatLoading) return;

    const userMsg: ChatMessage = {
      role: "user",
      content: chatInput,
      timestamp: new Date().toLocaleTimeString(),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput("");
    setIsChatLoading(true);

    try {
      const messagesToSend = [...chatMessages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: selectedChatModel,
          messages: messagesToSend,
          stream: false,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to fetch response");
      }

      const data = await res.json();
      const assistantText = data?.choices?.[0]?.message?.content || "No response.";

      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: assistantText,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    } catch (err: any) {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `⚠️ Error: ${err.message}`,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // 🎨 Handle Image Generation
  const handleImageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imagePrompt.trim() || !apiKey || isImageLoading) return;

    setIsImageLoading(true);
    setImageError("");

    try {
      const res = await fetch("/api/v1/images/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          prompt: imagePrompt,
          model: selectedImageModel,
          size: imageSize,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || err.details || "Generation failed");
      }

      const data = await res.json();
      const newImgUrl = data?.data?.[0]?.url;
      if (!newImgUrl) throw new Error("No image URL returned");

      setImages((prev) => [
        {
          id: Math.random().toString(),
          url: newImgUrl,
          prompt: imagePrompt,
          model: selectedImageModel,
          timestamp: new Date().toLocaleString(),
        },
        ...prev,
      ]);
      setImagePrompt("");
    } catch (err: any) {
      setImageError(err.message);
    } finally {
      setIsImageLoading(false);
    }
  };

  // 🎬 Handle Video Generation Task
  const handleVideoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoPrompt.trim() || !apiKey || isVideoLoading) return;

    setIsVideoLoading(true);
    setVideoError("");

    try {
      const res = await fetch("/api/v1/tasks/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          prompt: videoPrompt,
          model: selectedVideoModel,
          aspect_ratio: videoAspect,
          duration: videoDuration,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || err.details || "Task creation failed");
      }

      const data = await res.json();
      if (!data.success || !data.taskId) throw new Error("Did not receive a valid taskId");

      setVideos((prev) => [
        {
          id: Math.random().toString(),
          prompt: videoPrompt,
          model: selectedVideoModel,
          status: "waiting",
          taskId: data.taskId,
          providerSlug: data.providerSlug,
          timestamp: new Date().toLocaleString(),
        },
        ...prev,
      ]);
      setVideoPrompt("");
    } catch (err: any) {
      setVideoError(err.message);
    } finally {
      setIsVideoLoading(false);
    }
  };

  // 🎵 Handle Music Generation Task
  const handleMusicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!musicPrompt.trim() || !apiKey || isMusicLoading) return;

    setIsMusicLoading(true);
    setMusicError("");

    try {
      const res = await fetch("/api/v1/tasks/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          prompt: musicPrompt,
          model: selectedMusicModel,
          style: musicStyle || undefined,
          lyrics: musicLyrics || undefined,
          instrumental: musicInstrumental,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || err.details || "Task creation failed");
      }

      const data = await res.json();
      if (!data.success || !data.taskId) throw new Error("Did not receive a valid taskId");

      setSongs((prev) => [
        {
          id: Math.random().toString(),
          prompt: musicPrompt,
          model: selectedMusicModel,
          status: "waiting",
          taskId: data.taskId,
          providerSlug: data.providerSlug,
          lyrics: musicLyrics || undefined,
          style: musicStyle || undefined,
          timestamp: new Date().toLocaleString(),
        },
        ...prev,
      ]);
      setMusicPrompt("");
      setMusicStyle("");
      setMusicLyrics("");
    } catch (err: any) {
      setMusicError(err.message);
    } finally {
      setIsMusicLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12 animate-fade-in">
      {/* 👑 Dashboard Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-subtle pb-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-brand-primary to-purple-500 bg-clip-text text-transparent">
            {locale === "zh" ? "多模态测试沙盒" : "Multimodal Playground"}
          </h1>
          <p className="text-sm text-text-muted mt-2">
            {locale === "zh"
              ? "在这里直接调试和生成大模型对话、AI 绘画、AI 视频以及 AI 音乐。"
              : "Directly test and generate conversations, artwork, videos, and music with top AI models."}
          </p>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-3 bg-bg-surface border border-border-subtle rounded-xl px-4 py-3 shrink-0 backdrop-blur-md shadow-sm">
          <div className={`w-3.5 h-3.5 rounded-full ${apiKey ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-text-muted">API Connection</span>
            <span className="text-sm font-bold truncate max-w-[150px]">
              {apiKey ? `${apiKey.slice(0, 8)}...${apiKey.slice(-6)}` : "No Active Key"}
            </span>
          </div>
        </div>
      </div>

      {/* ⚠️ Warning if no API Key */}
      {!apiKey && (
        <div className="bg-red-500/10 border-2 border-red-500/30 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-md">
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-red-400">
              {locale === "zh" ? "未检测到活跃的 API 密钥" : "No Active API Key Detected"}
            </h3>
            <p className="text-sm text-text-muted">
              {locale === "zh"
                ? "测试沙盒需要至少一个活跃的 API 密钥来调起服务。请前往密钥页面创建。"
                : "The playground requires at least one active API Key to run. Please create one on the API Keys page."}
            </p>
          </div>
          <Link
            href="/dashboard/keys"
            className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold shadow-md transition-colors text-center shrink-0"
          >
            {locale === "zh" ? "创建 API 密钥 →" : "Create API Key →"}
          </Link>
        </div>
      )}

      {/* 💻 Tab Switcher */}
      <div className="flex flex-wrap border-b border-border-subtle gap-2">
        {[
          { id: "chat", label: locale === "zh" ? "💬 语言对话" : "💬 Dialogue", desc: "GPT, Claude, DeepSeek" },
          { id: "image", label: locale === "zh" ? "🎨 AI 绘画" : "🎨 AI Painting", desc: "Flux, Midjourney, DALL-E" },
          { id: "video", label: locale === "zh" ? "🎬 AI 视频" : "🎬 AI Video", desc: "Kling, Runway" },
          { id: "music", label: locale === "zh" ? "🎵 AI 音乐" : "🎵 AI Music", desc: "Suno, Udio" },
        ].map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex flex-col items-start px-6 py-4 rounded-t-2xl border-t border-x transition-all shrink-0 ${
                active
                  ? "bg-bg-surface border-border-subtle text-brand-primary shadow-[0_-4px_12px_rgba(0,0,0,0.02)]"
                  : "border-transparent text-text-muted hover:text-text-main hover:bg-bg-surface-hover"
              }`}
            >
              <span className="text-base font-bold">{tab.label}</span>
              <span className="text-2xs opacity-60 mt-0.5">{tab.desc}</span>
            </button>
          );
        })}
      </div>

      {/* 📦 Tab Content Panels */}
      <div className="bg-bg-surface border border-border-subtle rounded-3xl p-6 md:p-8 min-h-[500px] shadow-sm flex flex-col transition-colors">
        {/* -------------------- 💬 Chat Tab -------------------- */}
        {activeTab === "chat" && (
          <div className="flex-1 flex flex-col gap-6 h-full">
            {/* Header & Selector */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-subtle pb-4">
              <h3 className="text-lg font-bold text-text-main">
                {locale === "zh" ? "大语言模型调试沙盒" : "LLM Chat Sandbox"}
              </h3>
              <select
                value={selectedChatModel}
                onChange={(e) => setSelectedChatModel(e.target.value)}
                className="bg-bg-surface border border-border-subtle rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-brand-primary"
                disabled={!apiKey}
              >
                {finalChatModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName} ({m.id})
                  </option>
                ))}
              </select>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 min-h-[350px] max-h-[500px] overflow-y-auto border border-border-subtle rounded-2xl p-6 bg-bg-surface-hover/30 flex flex-col gap-4">
              {chatMessages.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-text-muted gap-2 py-12">
                  <span className="text-4xl">💬</span>
                  <p className="text-sm font-medium">
                    {locale === "zh" ? "在这里开始与选中的大模型对话..." : "Start conversing with the selected AI model..."}
                  </p>
                </div>
              ) : (
                chatMessages.map((msg, index) => {
                  const isUser = msg.role === "user";
                  return (
                    <div
                      key={index}
                      className={`flex flex-col max-w-[80%] rounded-2xl px-5 py-3.5 shadow-sm ${
                        isUser
                          ? "self-end bg-brand-primary text-brand-primary-text rounded-tr-none"
                          : "self-start bg-bg-surface border border-border-subtle rounded-tl-none text-text-main"
                      }`}
                    >
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                      <span className="text-4xs opacity-60 self-end mt-1.5">{msg.timestamp}</span>
                    </div>
                  );
                })
              )}
              {isChatLoading && (
                <div className="self-start bg-bg-surface border border-border-subtle rounded-2xl rounded-tl-none px-5 py-3.5 flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-brand-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 rounded-full bg-brand-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 rounded-full bg-brand-primary animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                  <span className="text-xs font-semibold text-text-muted">AI is thinking...</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input Bar */}
            <form onSubmit={handleChatSubmit} className="flex gap-3">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={locale === "zh" ? "发送消息给大模型..." : "Type your message..."}
                className="flex-1 bg-bg-surface border border-border-subtle rounded-xl px-5 py-3 focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:opacity-50"
                disabled={!apiKey || isChatLoading}
              />
              <button
                type="submit"
                className="px-6 bg-brand-primary hover:bg-brand-primary/95 text-brand-primary-text font-bold rounded-xl shadow-md transition-colors disabled:opacity-50"
                disabled={!apiKey || isChatLoading || !chatInput.trim()}
              >
                {locale === "zh" ? "发送" : "Send"}
              </button>
            </form>
          </div>
        )}

        {/* -------------------- 🎨 Image Tab -------------------- */}
        {activeTab === "image" && (
          <div className="flex-1 flex flex-col gap-8 h-full">
            {/* Split Screen: Form vs. Gallery */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Form Block */}
              <form onSubmit={handleImageSubmit} className="lg:col-span-4 space-y-6 bg-bg-surface-hover/30 border border-border-subtle p-6 rounded-2xl h-fit">
                <div className="space-y-1">
                  <h4 className="text-base font-bold text-text-main">
                    {locale === "zh" ? "画作参数配置" : "Artwork Parameters"}
                  </h4>
                  <p className="text-2xs text-text-muted">Configure prompt and styling specs.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-text-muted">1. Select Drawing Model</label>
                  <select
                    value={selectedImageModel}
                    onChange={(e) => setSelectedImageModel(e.target.value)}
                    className="w-full bg-bg-surface border border-border-subtle rounded-xl px-4 py-2.5 text-sm font-semibold"
                    disabled={!apiKey || isImageLoading}
                  >
                    {finalImageModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.displayName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-text-muted">2. Dimensions (Aspect Ratio)</label>
                  <select
                    value={imageSize}
                    onChange={(e) => setImageSize(e.target.value)}
                    className="w-full bg-bg-surface border border-border-subtle rounded-xl px-4 py-2.5 text-sm font-semibold"
                    disabled={!apiKey || isImageLoading}
                  >
                    <option value="1024x1024">1:1 Square (1024x1024)</option>
                    <option value="1024x768">4:3 Landscape (1024x768)</option>
                    <option value="768x1024">3:4 Portrait (768x1024)</option>
                    <option value="1024x576">16:9 Cinema (1024x576)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-text-muted">3. Art Prompt</label>
                  <textarea
                    rows={4}
                    value={imagePrompt}
                    onChange={(e) => setImagePrompt(e.target.value)}
                    placeholder={locale === "zh" ? "描述你想绘制的作品，英文描述效果最佳..." : "Describe the artwork you want to create..."}
                    className="w-full bg-bg-surface border border-border-subtle rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                    disabled={!apiKey || isImageLoading}
                  />
                </div>

                {imageError && <div className="text-xs font-bold text-red-500 bg-red-500/10 p-3 rounded-lg border border-red-500/20">{imageError}</div>}

                <button
                  type="submit"
                  className="w-full py-3.5 bg-brand-primary hover:bg-brand-primary/95 text-brand-primary-text font-bold rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  disabled={!apiKey || isImageLoading || !imagePrompt.trim()}
                >
                  {isImageLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-brand-primary-text border-t-transparent rounded-full animate-spin" />
                      <span>{locale === "zh" ? "同步生成中 (需等待 10-30s)..." : "Generating (Wait 10-30s)..."}</span>
                    </>
                  ) : (
                    <span>{locale === "zh" ? "开始绘画" : "Start Drawing"}</span>
                  )}
                </button>
              </form>

              {/* Gallery Block */}
              <div className="lg:col-span-8 space-y-4">
                <h4 className="text-base font-bold text-text-main">
                  {locale === "zh" ? "生成的画廊" : "Generated Gallery"}
                </h4>

                {images.length === 0 ? (
                  <div className="border border-dashed border-border-subtle rounded-3xl h-[420px] flex flex-col items-center justify-center text-text-muted gap-2">
                    <span className="text-5xl">🎨</span>
                    <p className="text-sm font-medium">
                      {locale === "zh" ? "提交绘画任务，生成的艺术品将在此处同步展示。" : "Submit a task; generated artwork will appear synchronously here."}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {images.map((img) => (
                      <div
                        key={img.id}
                        className="bg-bg-surface-hover/20 border border-border-subtle rounded-2xl overflow-hidden hover:shadow-md transition-all group hover:border-brand-primary/30"
                      >
                        <div className="relative aspect-square overflow-hidden bg-black/5">
                          <img
                            src={img.url}
                            alt={img.prompt}
                            className="w-full h-full object-cover transition-transform group-hover:scale-[1.02] duration-300"
                            loading="lazy"
                          />
                        </div>
                        <div className="p-4 space-y-2">
                          <p className="text-xs font-bold text-text-main line-clamp-2" title={img.prompt}>
                            {img.prompt}
                          </p>
                          <div className="flex items-center justify-between text-3xs text-text-muted font-semibold pt-2 border-t border-border-subtle">
                            <span>{img.model}</span>
                            <a
                              href={img.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-brand-primary hover:underline"
                            >
                              Download →
                            </a>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* -------------------- 🎬 Video Tab -------------------- */}
        {activeTab === "video" && (
          <div className="flex-1 flex flex-col gap-8 h-full">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Form Block */}
              <form onSubmit={handleVideoSubmit} className="lg:col-span-4 space-y-6 bg-bg-surface-hover/30 border border-border-subtle p-6 rounded-2xl h-fit">
                <div className="space-y-1">
                  <h4 className="text-base font-bold text-text-main">
                    {locale === "zh" ? "视频参数配置" : "Video Parameters"}
                  </h4>
                  <p className="text-2xs text-text-muted">Configure prompt and length.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-text-muted">1. Select Video Model</label>
                  <select
                    value={selectedVideoModel}
                    onChange={(e) => setSelectedVideoModel(e.target.value)}
                    className="w-full bg-bg-surface border border-border-subtle rounded-xl px-4 py-2.5 text-sm font-semibold"
                    disabled={!apiKey || isVideoLoading}
                  >
                    {finalVideoModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.displayName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-text-muted">2. Aspect Ratio</label>
                  <select
                    value={videoAspect}
                    onChange={(e) => setVideoAspect(e.target.value)}
                    className="w-full bg-bg-surface border border-border-subtle rounded-xl px-4 py-2.5 text-sm font-semibold"
                    disabled={!apiKey || isVideoLoading}
                  >
                    <option value="16:9">16:9 Cinema Landscape</option>
                    <option value="9:16">9:16 Mobile Portrait</option>
                    <option value="1:1">1:1 Standard Square</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-text-muted">3. Duration</label>
                  <select
                    value={videoDuration}
                    onChange={(e) => setVideoDuration(e.target.value)}
                    className="w-full bg-bg-surface border border-border-subtle rounded-xl px-4 py-2.5 text-sm font-semibold"
                    disabled={!apiKey || isVideoLoading}
                  >
                    <option value="5s">5 Seconds Standard</option>
                    <option value="10s">10 Seconds High Quality</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-text-muted">4. Video Prompt</label>
                  <textarea
                    rows={4}
                    value={videoPrompt}
                    onChange={(e) => setVideoPrompt(e.target.value)}
                    placeholder={locale === "zh" ? "描述视频里的动态画面，镜头移动，细节特征..." : "Describe the video motion, camera movements, style..."}
                    className="w-full bg-bg-surface border border-border-subtle rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                    disabled={!apiKey || isVideoLoading}
                  />
                </div>

                {videoError && <div className="text-xs font-bold text-red-500 bg-red-500/10 p-3 rounded-lg border border-red-500/20">{videoError}</div>}

                <button
                  type="submit"
                  className="w-full py-3.5 bg-brand-primary hover:bg-brand-primary/95 text-brand-primary-text font-bold rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  disabled={!apiKey || isVideoLoading || !videoPrompt.trim()}
                >
                  {isVideoLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-brand-primary-text border-t-transparent rounded-full animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <span>{locale === "zh" ? "提交视频生成任务" : "Generate Video"}</span>
                  )}
                </button>
              </form>

              {/* Video List Block */}
              <div className="lg:col-span-8 space-y-4">
                <h4 className="text-base font-bold text-text-main">
                  {locale === "zh" ? "生成的视频列表" : "Generated Videos"}
                </h4>

                {videos.length === 0 ? (
                  <div className="border border-dashed border-border-subtle rounded-3xl h-[420px] flex flex-col items-center justify-center text-text-muted gap-2">
                    <span className="text-5xl">🎬</span>
                    <p className="text-sm font-medium">
                      {locale === "zh" ? "提交视频任务，系统将进行异步调度，并在此展示进程。" : "Submit a task; video status polling progress will appear here."}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {videos.map((vid) => (
                      <div
                        key={vid.id}
                        className="bg-bg-surface-hover/20 border border-border-subtle rounded-2xl overflow-hidden hover:shadow-md transition-all group hover:border-brand-primary/30 p-4 space-y-4 flex flex-col justify-between"
                      >
                        <div className="relative aspect-video rounded-xl overflow-hidden bg-black/10 flex items-center justify-center">
                          {vid.status === "success" && vid.url ? (
                            <video src={vid.url} controls className="w-full h-full object-cover" />
                          ) : vid.status === "fail" ? (
                            <div className="text-center p-4">
                              <span className="text-2xl">⚠️</span>
                              <p className="text-xs text-red-500 font-bold mt-2">Failed</p>
                              <p className="text-4xs text-text-muted mt-1 leading-tight">{vid.failMsg || "Unknown error"}</p>
                            </div>
                          ) : (
                            <div className="text-center p-4 flex flex-col items-center gap-3">
                              <div className="relative w-10 h-10">
                                <div className="absolute inset-0 border-3 border-brand-primary/20 rounded-full" />
                                <div className="absolute inset-0 border-3 border-brand-primary border-t-transparent rounded-full animate-spin" />
                              </div>
                              <span className="text-xs font-bold text-brand-primary animate-pulse">
                                {vid.status === "waiting" ? "Queuing..." : "Generating Video..."}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <p className="text-xs font-bold text-text-main line-clamp-2" title={vid.prompt}>
                            {vid.prompt}
                          </p>
                          <div className="flex items-center justify-between text-3xs text-text-muted font-semibold pt-2 border-t border-border-subtle">
                            <span>{vid.model}</span>
                            {vid.status === "success" && vid.url ? (
                              <a href={vid.url} target="_blank" rel="noreferrer" className="text-brand-primary hover:underline">
                                Download →
                              </a>
                            ) : (
                              <span className="opacity-60">{vid.status.toUpperCase()}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* -------------------- 🎵 Music Tab -------------------- */}
        {activeTab === "music" && (
          <div className="flex-1 flex flex-col gap-8 h-full">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Form Block */}
              <form onSubmit={handleMusicSubmit} className="lg:col-span-4 space-y-6 bg-bg-surface-hover/30 border border-border-subtle p-6 rounded-2xl h-fit">
                <div className="space-y-1">
                  <h4 className="text-base font-bold text-text-main">
                    {locale === "zh" ? "音乐参数配置" : "Music Parameters"}
                  </h4>
                  <p className="text-2xs text-text-muted">Configure lyrics and instrumentation.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-text-muted">1. Select Music Model</label>
                  <select
                    value={selectedMusicModel}
                    onChange={(e) => setSelectedMusicModel(e.target.value)}
                    className="w-full bg-bg-surface border border-border-subtle rounded-xl px-4 py-2.5 text-sm font-semibold"
                    disabled={!apiKey || isMusicLoading}
                  >
                    {finalMusicModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.displayName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between bg-bg-surface border border-border-subtle rounded-xl p-3.5">
                  <span className="text-xs font-bold text-text-muted">Instrumental (纯音乐)</span>
                  <input
                    type="checkbox"
                    checked={musicInstrumental}
                    onChange={(e) => setMusicInstrumental(e.target.checked)}
                    className="w-5 h-5 accent-brand-primary"
                    disabled={!apiKey || isMusicLoading}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-text-muted">2. Music Style (e.g. pop, rock, jazz)</label>
                  <input
                    type="text"
                    value={musicStyle}
                    onChange={(e) => setMusicStyle(e.target.value)}
                    placeholder="e.g. happy acoustic pop, energetic synthwave"
                    className="w-full bg-bg-surface border border-border-subtle rounded-xl px-4 py-2.5 text-sm"
                    disabled={!apiKey || isMusicLoading}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-text-muted">3. Music Prompt / Theme</label>
                  <textarea
                    rows={3}
                    value={musicPrompt}
                    onChange={(e) => setMusicPrompt(e.target.value)}
                    placeholder={locale === "zh" ? "描述歌词大意、情绪特色..." : "Describe the mood, topic or lyrics meaning..."}
                    className="w-full bg-bg-surface border border-border-subtle rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                    disabled={!apiKey || isMusicLoading}
                  />
                </div>

                {!musicInstrumental && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-text-muted">4. Custom Lyrics (optional)</label>
                    <textarea
                      rows={4}
                      value={musicLyrics}
                      onChange={(e) => setMusicLyrics(e.target.value)}
                      placeholder="Enter custom lyrics here..."
                      className="w-full bg-bg-surface border border-border-subtle rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                      disabled={!apiKey || isMusicLoading}
                    />
                  </div>
                )}

                {musicError && <div className="text-xs font-bold text-red-500 bg-red-500/10 p-3 rounded-lg border border-red-500/20">{musicError}</div>}

                <button
                  type="submit"
                  className="w-full py-3.5 bg-brand-primary hover:bg-brand-primary/95 text-brand-primary-text font-bold rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  disabled={!apiKey || isMusicLoading || !musicPrompt.trim()}
                >
                  {isMusicLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-brand-primary-text border-t-transparent rounded-full animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <span>{locale === "zh" ? "提交音乐生成任务" : "Generate Music"}</span>
                  )}
                </button>
              </form>

              {/* Music List Block */}
              <div className="lg:col-span-8 space-y-4">
                <h4 className="text-base font-bold text-text-main">
                  {locale === "zh" ? "生成的音乐列表" : "Generated Music"}
                </h4>

                {songs.length === 0 ? (
                  <div className="border border-dashed border-border-subtle rounded-3xl h-[420px] flex flex-col items-center justify-center text-text-muted gap-2">
                    <span className="text-5xl">🎵</span>
                    <p className="text-sm font-medium">
                      {locale === "zh" ? "提交音乐任务，生成的音频和炫酷播放器将在此处展示。" : "Submit a task; music status polling and players will appear here."}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {songs.map((song) => (
                      <div
                        key={song.id}
                        className="bg-bg-surface-hover/20 border border-border-subtle rounded-2xl overflow-hidden hover:shadow-md transition-all p-5 flex flex-col justify-between hover:border-brand-primary/30"
                      >
                        {/* Audio / Loader Card */}
                        <div className="bg-bg-surface border border-border-subtle rounded-xl p-4 flex flex-col items-center justify-center h-28">
                          {song.status === "success" && song.url ? (
                            <audio src={song.url} controls className="w-full" />
                          ) : song.status === "fail" ? (
                            <div className="text-center">
                              <span className="text-xl">⚠️</span>
                              <p className="text-xs text-red-500 font-bold mt-1">Failed</p>
                              <p className="text-4xs text-text-muted">{song.failMsg || "Error generating music"}</p>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-2">
                              <div className="flex gap-1">
                                <span className="w-1.5 h-6 bg-brand-primary rounded animate-pulse" style={{ animationDelay: "0ms" }} />
                                <span className="w-1.5 h-8 bg-brand-primary rounded animate-pulse" style={{ animationDelay: "150ms" }} />
                                <span className="w-1.5 h-10 bg-brand-primary rounded animate-pulse" style={{ animationDelay: "300ms" }} />
                                <span className="w-1.5 h-8 bg-brand-primary rounded animate-pulse" style={{ animationDelay: "450ms" }} />
                                <span className="w-1.5 h-6 bg-brand-primary rounded animate-pulse" style={{ animationDelay: "600ms" }} />
                              </div>
                              <span className="text-2xs font-bold text-brand-primary animate-pulse">
                                {song.status === "waiting" ? "Queuing..." : "Generating Song..."}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Details */}
                        <div className="space-y-3 mt-4">
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-text-main line-clamp-1">{song.prompt}</p>
                            {song.style && <p className="text-4xs text-text-muted truncate">Style: {song.style}</p>}
                          </div>

                          {song.lyrics && (
                            <div className="bg-bg-surface border border-border-subtle rounded-lg p-2.5 max-h-16 overflow-y-auto text-3xs text-text-muted leading-relaxed select-all">
                              {song.lyrics}
                            </div>
                          )}

                          <div className="flex items-center justify-between text-3xs text-text-muted font-semibold pt-2 border-t border-border-subtle">
                            <span>{song.model}</span>
                            {song.status === "success" && song.url ? (
                              <a href={song.url} target="_blank" rel="noreferrer" className="text-brand-primary hover:underline">
                                Download →
                              </a>
                            ) : (
                              <span className="opacity-60">{song.status.toUpperCase()}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
