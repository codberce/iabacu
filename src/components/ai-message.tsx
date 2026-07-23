"use client";

import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import {
  AiSectionCard,
  hasSectionMarkers,
  parseAiSections,
} from "@/components/ai-message-sections";

type AiMessageProps = {
  content: string;
};

const markdownComponents = {
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-3 last:mb-0 leading-6">{children}</p>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="mb-3 list-disc space-y-1 pl-5 last:mb-0">
      {children}
    </ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="mb-3 list-decimal space-y-1 pl-5 last:mb-0">
      {children}
    </ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="pl-1">{children}</li>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold text-zinc-950">{children}</strong>
  ),
  code: ({ children }: { children?: React.ReactNode }) => (
    <code className="border border-zinc-200 bg-white px-1.5 py-0.5 font-mono text-[0.92em]">
      {children}
    </code>
  ),
  pre: ({ children }: { children?: React.ReactNode }) => (
    <pre className="mb-3 overflow-auto border border-zinc-200 bg-white p-3 text-xs last:mb-0">
      {children}
    </pre>
  ),
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="mb-2 text-base font-semibold">{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="mb-2 text-base font-semibold">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="mb-2 text-sm font-semibold">{children}</h3>
  ),
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="mb-3 overflow-auto border border-zinc-200 bg-white last:mb-0">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="border-b border-zinc-200 bg-zinc-100 px-2 py-1.5 text-left font-semibold">
      {children}
    </th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="border-b border-zinc-100 px-2 py-1.5 align-top">{children}</td>
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="mb-3 border-l-2 border-zinc-300 pl-3 text-zinc-700 last:mb-0">
      {children}
    </blockquote>
  ),
};

function MarkdownBlock({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={markdownComponents}
    >
      {content}
    </ReactMarkdown>
  );
}

export function AiMessage({ content }: AiMessageProps) {
  if (!hasSectionMarkers(content)) {
    return <MarkdownBlock content={content} />;
  }

  const { intro, sections } = parseAiSections(content);
  return (
    <div>
      {intro ? <MarkdownBlock content={intro} /> : null}
      {sections.map((section, index) => (
        <AiSectionCard key={`${section.kind}-${index}`} kind={section.kind}>
          <MarkdownBlock content={section.content} />
        </AiSectionCard>
      ))}
    </div>
  );
}