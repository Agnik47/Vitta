"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

interface CodeBlockProps {
  code: string;
  language?: string;
  title?: string;
}

export function CodeBlock({ code, language = "bash", title }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(code.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="my-5 overflow-hidden rounded-lg border border-[#2a2a2a]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#2a2a2a] bg-[#111111] px-4 py-2.5">
        <span className="text-[11px] tracking-widest text-[#555] uppercase font-medium">
          {title ?? language}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] text-[#666] hover:text-[#aaa] hover:bg-white/5 transition-all duration-200"
        >
          {copied ? (
            <>
              <Check className="size-3 text-[#00c951]" />
              <span className="text-[#00c951]">Copied</span>
            </>
          ) : (
            <>
              <Copy className="size-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      {/* Code */}
      <div className="overflow-x-auto bg-[#0d0d0d] px-5 py-5">
        <pre className="font-mono text-[13px] leading-relaxed text-[#d4d4d4] whitespace-pre">
          <code>{code.trim()}</code>
        </pre>
      </div>
    </div>
  );
}
