import type { ReactNode } from "react";

export type AssistantMarkdownBlock =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "quote"; text: string }
  | { type: "code"; language: string; code: string }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "hr" };

function splitTableRow(line: string): string[] {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

function isTableDivider(line: string): boolean {
  const cells = splitTableRow(line);
  return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s/g, "")));
}

function isHorizontalRule(line: string): boolean {
  const trimmed = line.trim();
  return /^#{1,6}\s*[-—–]{3,}\s*$/.test(trimmed) || /^(?:---+|\*\*\*+|___+)\s*$/.test(trimmed);
}

function listMatch(line: string): { ordered: boolean; text: string } | null {
  const match = line.match(/^\s*(?:([-*+])|(\d+)[.)])\s+(.+)$/);
  if (!match) return null;
  return { ordered: Boolean(match[2]), text: match[3] };
}

function isBlockStart(lines: string[], index: number): boolean {
  const line = lines[index] || "";
  return isHorizontalRule(line)
    || /^\s{0,3}#{1,4}\s+\S/.test(line)
    || /^\s{0,3}```/.test(line)
    || /^\s*>\s?/.test(line)
    || listMatch(line) !== null
    || (line.includes("|") && index + 1 < lines.length && isTableDivider(lines[index + 1]));
}

export function parseAssistantMarkdown(content: string): AssistantMarkdownBlock[] {
  const lines = String(content || "").replace(/\r\n?/g, "\n").split("\n");
  const blocks: AssistantMarkdownBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i += 1; continue; }

    if (isHorizontalRule(line)) {
      blocks.push({ type: "hr" });
      i += 1;
      continue;
    }

    const codeStart = line.match(/^\s{0,3}```\s*([\w-]+)?\s*$/);
    if (codeStart) {
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !/^\s{0,3}```/.test(lines[i])) {
        codeLines.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1;
      blocks.push({ type: "code", language: codeStart[1] || "", code: codeLines.join("\n") });
      continue;
    }

    const heading = line.match(/^\s{0,3}(#{1,4})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      blocks.push({ type: "heading", level: heading[1].length, text: heading[2].trim() });
      i += 1;
      continue;
    }

    if (line.includes("|") && i + 1 < lines.length && isTableDivider(lines[i + 1])) {
      const headers = splitTableRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) {
        rows.push(splitTableRow(lines[i]));
        i += 1;
      }
      blocks.push({ type: "table", headers, rows });
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        quote.push(lines[i].replace(/^\s*>\s?/, "").trim());
        i += 1;
      }
      blocks.push({ type: "quote", text: quote.join(" ") });
      continue;
    }

    const firstList = listMatch(line);
    if (firstList) {
      const items: string[] = [firstList.text];
      const ordered = firstList.ordered;
      i += 1;
      while (i < lines.length) {
        const item = listMatch(lines[i]);
        if (!item || item.ordered !== ordered) break;
        items.push(item.text);
        i += 1;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    const paragraph: string[] = [line.trim()];
    i += 1;
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines, i)) {
      paragraph.push(lines[i].trim());
      i += 1;
    }
    blocks.push({ type: "paragraph", text: paragraph.join(" ") });
  }

  return blocks;
}

function renderInline(value: string, prefix: string): ReactNode[] {
  const tokenRegex = /(\*\*[\s\S]+?\*\*|__[\s\S]+?__|`[^`]+?`|\[[^\]]+\]\(https?:\/\/[^)\s]+\)|https?:\/\/[^\s<>]+)/g;
  return value.split(tokenRegex).filter(Boolean).map((part, index) => {
    const key = `${prefix}-inline-${index}`;
    if ((part.startsWith("**") && part.endsWith("**")) || (part.startsWith("__") && part.endsWith("__"))) {
      return <strong key={key} className="font-semibold text-foreground">{renderInline(part.slice(2, -2), key)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={key} className="rounded-md bg-muted px-1.5 py-0.5 text-[0.9em]">{part.slice(1, -1)}</code>;
    }
    const markdownLink = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/);
    if (markdownLink) {
      return <a key={key} href={markdownLink[2]} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary">{renderInline(markdownLink[1], key)}</a>;
    }
    if (/^https?:\/\//.test(part)) {
      const url = part.replace(/[),.;!?،؛]+$/, "");
      const suffix = part.slice(url.length);
      return <span key={key}><a href={url} target="_blank" rel="noopener noreferrer" className="break-all text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary">{url}</a>{suffix}</span>;
    }
    return <span key={key}>{part}</span>;
  });
}

export function AssistantMessage({ content, lang }: { content: string; lang: "ar" | "en" | "ku" }) {
  const blocks = parseAssistantMarkdown(content);
  return (
    <div className="min-w-0 space-y-3 break-words" dir="auto" lang={lang} data-testid="assistant-message">
      {blocks.map((block, index) => {
        const key = `${block.type}-${index}`;
        if (block.type === "hr") return <hr key={key} className="my-4 border-border" />;
        if (block.type === "heading") {
          const className = block.level === 1
            ? "text-lg font-bold tracking-tight text-foreground"
            : block.level === 2
              ? "text-base font-bold tracking-tight text-foreground"
              : "text-sm font-semibold text-foreground";
          if (block.level === 1) return <h2 key={key} className={className}>{renderInline(block.text, key)}</h2>;
          if (block.level === 2) return <h3 key={key} className={className}>{renderInline(block.text, key)}</h3>;
          return <h4 key={key} className={className}>{renderInline(block.text, key)}</h4>;
        }
        if (block.type === "list") {
          const ListTag = block.ordered ? "ol" : "ul";
          return <ListTag key={key} className={`space-y-1.5 ps-5 ${block.ordered ? "list-decimal" : "list-disc"}`}>{block.items.map((item, itemIndex) => <li key={itemIndex} className="ps-1 leading-7">{renderInline(item, `${key}-item-${itemIndex}`)}</li>)}</ListTag>;
        }
        if (block.type === "quote") return <blockquote key={key} className="border-s-2 border-primary/40 ps-3 text-muted-foreground">{renderInline(block.text, key)}</blockquote>;
        if (block.type === "code") return <pre key={key} className="overflow-x-auto rounded-xl bg-muted p-3 text-xs leading-6"><code data-language={block.language || undefined}>{block.code}</code></pre>;
        if (block.type === "table") return <div key={key} className="overflow-x-auto rounded-lg border border-border"><table className="w-full min-w-[320px] border-collapse text-start text-sm"><thead className="bg-muted/60"><tr>{block.headers.map((cell, cellIndex) => <th key={cellIndex} scope="col" className="border-b border-border px-3 py-2 font-semibold">{renderInline(cell, `${key}-head-${cellIndex}`)}</th>)}</tr></thead><tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex} className="border-b border-border last:border-0">{block.headers.map((_, cellIndex) => <td key={cellIndex} className="px-3 py-2 align-top">{renderInline(row[cellIndex] || "", `${key}-row-${rowIndex}-cell-${cellIndex}`)}</td>)}</tr>)}</tbody></table></div>;
        return <p key={key} className="leading-7 text-foreground/95">{renderInline(block.text, key)}</p>;
      })}
    </div>
  );
}
