"use client";

import { useState } from "react";
import { Eye, Pencil } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { markdownToHtml } from "@/lib/markdown";
import { cn } from "@/lib/utils";

export function MarkdownEditor({
  id,
  name,
  value,
  defaultValue,
  onChange,
  placeholder,
  rows = 8,
  hint,
}: {
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (next: string) => void;
  placeholder?: string;
  rows?: number;
  hint?: string;
}) {
  const isControlled = value !== undefined;
  const [inner, setInner] = useState(defaultValue ?? "");
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const text = isControlled ? value! : inner;

  function set(next: string) {
    if (!isControlled) setInner(next);
    onChange?.(next);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 text-xs">
        <div className="inline-flex rounded-md border bg-background p-0.5">
          <button
            type="button"
            onClick={() => setTab("edit")}
            className={cn(
              "inline-flex items-center gap-1 rounded px-2 py-1",
              tab === "edit" ? "bg-foreground text-background" : "text-muted-foreground",
            )}
          >
            <Pencil className="h-3 w-3" /> Markdown
          </button>
          <button
            type="button"
            onClick={() => setTab("preview")}
            className={cn(
              "inline-flex items-center gap-1 rounded px-2 py-1",
              tab === "preview" ? "bg-foreground text-background" : "text-muted-foreground",
            )}
          >
            <Eye className="h-3 w-3" /> Preview
          </button>
        </div>
        {hint && <span className="text-muted-foreground">{hint}</span>}
      </div>

      {tab === "edit" ? (
        <Textarea
          id={id}
          name={name}
          rows={rows}
          value={text}
          placeholder={placeholder}
          onChange={(e) => set(e.target.value)}
          className="font-mono text-sm"
        />
      ) : (
        <div
          className="prose prose-sm min-h-[160px] max-w-none rounded-md border bg-secondary/30 p-3 text-sm
                     [&>p]:my-2 [&>h1]:mb-2 [&>h2]:mb-2 [&>h3]:mb-2 [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:list-decimal [&>ol]:pl-5
                     [&_a]:text-gilt-dark [&_a]:underline"
          dangerouslySetInnerHTML={{
            __html: text.trim()
              ? markdownToHtml(text)
              : `<p class="text-muted-foreground">Niente da mostrare ancora.</p>`,
          }}
        />
      )}
      {/* Hidden mirror so plain forms (without onChange) still submit the value */}
      {!onChange && name && tab === "preview" && (
        <input type="hidden" name={name} value={text} />
      )}
    </div>
  );
}
