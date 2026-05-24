"use client";

import { useState, useTransition } from "react";
import { updateWikiSection } from "../actions";

interface WikiSection {
  slug: string;
  titleEn: string;
  titleZh: string;
  contentEn: string;
  contentZh: string;
}

interface WikiEditorClientProps {
  initialSections: WikiSection[];
}

export function WikiEditorClient({ initialSections }: WikiEditorClientProps) {
  const [sections, setSections] = useState<WikiSection[]>(initialSections);
  const [selectedSlug, setSelectedSlug] = useState<string>(
    initialSections.length > 0 ? initialSections[0].slug : "intro"
  );
  
  const currentSection = sections.find((s) => s.slug === selectedSlug) || {
    slug: selectedSlug,
    titleEn: "",
    titleZh: "",
    contentEn: "",
    contentZh: "",
  };

  const [titleEn, setTitleEn] = useState(currentSection.titleEn);
  const [titleZh, setTitleZh] = useState(currentSection.titleZh);
  const [contentEn, setContentEn] = useState(currentSection.contentEn);
  const [contentZh, setContentZh] = useState(currentSection.contentZh);
  
  const [isPending, startTransition] = useTransition();
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSectionChange = (slug: string) => {
    setSelectedSlug(slug);
    const target = sections.find((s) => s.slug === slug) || {
      slug,
      titleEn: "",
      titleZh: "",
      contentEn: "",
      contentZh: "",
    };
    setTitleEn(target.titleEn);
    setTitleZh(target.titleZh);
    setContentEn(target.contentEn);
    setContentZh(target.contentZh);
    setSaveStatus("idle");
  };

  const handleSave = () => {
    setSaveStatus("idle");
    setErrorMsg("");

    startTransition(async () => {
      const result = await updateWikiSection(
        selectedSlug,
        titleEn,
        titleZh,
        contentEn,
        contentZh
      );

      if (result.success) {
        setSaveStatus("success");
        // Update local sections state so switching back preserves edited content
        setSections((prev) =>
          prev.map((s) =>
            s.slug === selectedSlug
              ? { ...s, titleEn, titleZh, contentEn, contentZh }
              : s
          )
        );
        setTimeout(() => setSaveStatus("idle"), 3000);
      } else {
        setSaveStatus("error");
        setErrorMsg(result.error || "Failed to update documentation");
      }
    });
  };

  const sectionOptions = [
    { slug: "intro", label: "🚀 Overview / 平台总览" },
    { slug: "quickstart", label: "⚡ Quick Start / 快速接入" },
    { slug: "chat", label: "💬 Chat Completions / 对话补全" },
    { slug: "image", label: "🎨 Image Generation / 图像生成" },
    { slug: "tasks", label: "🎥 Video & Async Tasks / 视频与音乐生成" },
    { slug: "pricing", label: "💳 Pricing & Discounts / 专属计费与折扣" },
    { slug: "clients", label: "🍒 Client Integrations / 客户端集成配置" },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-subtle pb-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">📖 Wiki Documentation Editor</h1>
          <p className="text-sm text-text-muted">
            Manage the content, titles, and bilingual instructions displayed in the User API Docs page.
          </p>
        </div>
        <div>
          <button
            onClick={handleSave}
            disabled={isPending}
            className={`w-full md:w-auto px-6 py-2.5 rounded-lg font-semibold text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
              isPending
                ? "bg-brand-primary/50 text-brand-primary-text cursor-not-allowed"
                : saveStatus === "success"
                ? "bg-emerald-500 text-white"
                : "bg-brand-primary hover:bg-brand-primary/95 text-brand-primary-text hover:shadow-md"
            }`}
          >
            {isPending ? (
              <>⏳ Saving...</>
            ) : saveStatus === "success" ? (
              <>✓ Changes Saved</>
            ) : (
              <>💾 Save Wiki Section</>
            )}
          </button>
        </div>
      </div>

      {/* Success / Error Banners */}
      {saveStatus === "success" && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 px-4 py-3 rounded-lg text-sm font-medium animate-fade-in flex items-center gap-2">
          <span>✓</span> Documentation section <strong>{selectedSlug}</strong> has been updated successfully in English & Chinese!
        </div>
      )}
      {saveStatus === "error" && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-500 px-4 py-3 rounded-lg text-sm font-medium animate-fade-in">
          ⚠️ Save Failed: {errorMsg}
        </div>
      )}

      {/* Selector card */}
      <div className="bg-bg-surface border border-border-subtle rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center gap-4 justify-between">
        <div className="space-y-1">
          <h4 className="text-sm font-semibold text-text-main">Select Section to Edit</h4>
          <p className="text-xs text-text-muted">Choose a category tab to edit its bilingual markdown text.</p>
        </div>
        <select
          value={selectedSlug}
          onChange={(e) => handleSectionChange(e.target.value)}
          className="bg-bg-main border border-border-subtle rounded-lg px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-primary/50 min-w-[320px] transition-all cursor-pointer"
        >
          {sectionOptions.map((opt) => (
            <option key={opt.slug} value={opt.slug}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Main Grid Editor */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* English Content Card */}
        <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6 md:p-8 flex flex-col gap-6 shadow-sm">
          <div className="border-b border-border-subtle pb-4 flex items-center justify-between">
            <h3 className="font-bold text-text-main flex items-center gap-2">
              <span>🇺🇸</span> English Translation
            </h3>
            <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider">Markdown Supported</span>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-text-muted uppercase">Section Title (English)</label>
            <input
              type="text"
              value={titleEn}
              onChange={(e) => setTitleEn(e.target.value)}
              placeholder="e.g. Overview"
              className="bg-bg-main border border-border-subtle rounded-lg px-4 py-2.5 text-sm font-medium text-text-main focus:outline-none focus:ring-2 focus:ring-brand-primary/50 transition-all"
            />
          </div>

          <div className="flex-1 flex flex-col gap-2 min-h-[360px]">
            <label className="text-xs font-bold text-text-muted uppercase">Markdown Body (English)</label>
            <textarea
              value={contentEn}
              onChange={(e) => setContentEn(e.target.value)}
              placeholder="Write raw markdown code for this section..."
              className="w-full flex-1 bg-bg-main border border-border-subtle rounded-lg p-4 text-sm font-mono text-text-main leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand-primary/50 transition-all resize-none min-h-[320px]"
            />
          </div>
        </div>

        {/* Chinese Content Card */}
        <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6 md:p-8 flex flex-col gap-6 shadow-sm">
          <div className="border-b border-border-subtle pb-4 flex items-center justify-between">
            <h3 className="font-bold text-text-main flex items-center gap-2">
              <span>🇨🇳</span> Chinese Translation
            </h3>
            <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider">支持 Markdown</span>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-text-muted uppercase">模块标题 (中文)</label>
            <input
              type="text"
              value={titleZh}
              onChange={(e) => setTitleZh(e.target.value)}
              placeholder="例如：平台总览"
              className="bg-bg-main border border-border-subtle rounded-lg px-4 py-2.5 text-sm font-medium text-text-main focus:outline-none focus:ring-2 focus:ring-brand-primary/50 transition-all"
            />
          </div>

          <div className="flex-1 flex flex-col gap-2 min-h-[360px]">
            <label className="text-xs font-bold text-text-muted uppercase">Markdown 正文 (中文)</label>
            <textarea
              value={contentZh}
              onChange={(e) => setContentZh(e.target.value)}
              placeholder="在此输入中文 Markdown 内容..."
              className="w-full flex-1 bg-bg-main border border-border-subtle rounded-lg p-4 text-sm font-mono text-text-main leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand-primary/50 transition-all resize-none min-h-[320px]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
