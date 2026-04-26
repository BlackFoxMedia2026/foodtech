// Tiny markdown → HTML converter. Supports the subset we actually need for
// transactional emails and campaign bodies: paragraphs, line breaks, headings
// (#–###), bold (**text** / __text__), italic (*text* / _text_), inline code
// (`code`), links ([label](url)), unordered (- ) and ordered (1. ) lists.
// No code blocks, no tables, no nested lists. Output is HTML-escaped first.

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function inline(s: string): string {
  let out = s;
  // links [label](url)
  out = out.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    (_m, label: string, href: string) => {
      const safeHref = href.startsWith("http://") || href.startsWith("https://") || href.startsWith("mailto:")
        ? href
        : "#";
      return `<a href="${safeHref}" target="_blank" rel="noopener">${label}</a>`;
    },
  );
  // bold
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  // italic
  out = out.replace(/(^|[^*])\*([^*\n]+)\*([^*]|$)/g, "$1<em>$2</em>$3");
  out = out.replace(/(^|[^_])_([^_\n]+)_([^_]|$)/g, "$1<em>$2</em>$3");
  // inline code
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  return out;
}

export function markdownToHtml(input: string): string {
  if (!input) return "";
  const escaped = escapeHtml(input);
  const lines = escaped.split(/\r?\n/);
  const out: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let paragraph: string[] = [];

  function flushParagraph() {
    if (paragraph.length === 0) return;
    out.push(`<p>${inline(paragraph.join("<br>"))}</p>`);
    paragraph = [];
  }

  function flushList() {
    if (listType) {
      out.push(`</${listType}>`);
      listType = null;
    }
  }

  for (const raw of lines) {
    const line = raw.trim();

    if (line === "") {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }

    const ul = line.match(/^[-*]\s+(.+)$/);
    if (ul) {
      flushParagraph();
      if (listType !== "ul") {
        flushList();
        listType = "ul";
        out.push("<ul>");
      }
      out.push(`<li>${inline(ul[1])}</li>`);
      continue;
    }

    const ol = line.match(/^\d+\.\s+(.+)$/);
    if (ol) {
      flushParagraph();
      if (listType !== "ol") {
        flushList();
        listType = "ol";
        out.push("<ol>");
      }
      out.push(`<li>${inline(ol[1])}</li>`);
      continue;
    }

    flushList();
    paragraph.push(inline(line));
  }
  flushParagraph();
  flushList();
  return out.join("\n");
}
