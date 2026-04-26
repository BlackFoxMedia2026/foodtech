import { describe, expect, it } from "vitest";
import { markdownToHtml, escapeHtml } from "@/lib/markdown";

describe("markdown / escapeHtml", () => {
  it("escapes html-significant characters", () => {
    expect(escapeHtml(`<p>"a" & 'b'</p>`)).toBe(
      "&lt;p&gt;&quot;a&quot; &amp; &#39;b&#39;&lt;/p&gt;",
    );
  });
});

describe("markdown / markdownToHtml", () => {
  it("renders paragraphs and bold/italic/code", () => {
    const out = markdownToHtml("Ciao **mondo** e *grazie* per `Tavolo`");
    expect(out).toContain("<p>");
    expect(out).toContain("<strong>mondo</strong>");
    expect(out).toContain("<em>grazie</em>");
    expect(out).toContain("<code>Tavolo</code>");
  });

  it("renders headings 1-3", () => {
    const out = markdownToHtml("# H1\n## H2\n### H3\nciao");
    expect(out).toContain("<h1>H1</h1>");
    expect(out).toContain("<h2>H2</h2>");
    expect(out).toContain("<h3>H3</h3>");
    expect(out).toContain("<p>ciao</p>");
  });

  it("renders unordered and ordered lists", () => {
    const out = markdownToHtml("- a\n- b\n\n1. uno\n2. due");
    expect(out).toContain("<ul>");
    expect(out).toContain("<li>a</li>");
    expect(out).toContain("<ol>");
    expect(out).toContain("<li>uno</li>");
  });

  it("renders safe links", () => {
    const out = markdownToHtml("[Tavolo](https://example.com)");
    expect(out).toContain('href="https://example.com"');
    const danger = markdownToHtml("[bad](javascript:alert(1))");
    expect(danger).toContain('href="#"');
  });

  it("escapes html in body", () => {
    const out = markdownToHtml("<script>alert(1)</script>");
    expect(out).toContain("&lt;script&gt;");
  });
});
