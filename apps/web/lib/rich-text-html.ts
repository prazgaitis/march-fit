/**
 * Lightweight JSON-to-HTML converter for Tiptap content.
 *
 * This replaces the heavy `generateHTML()` from @tiptap/html which pulls in
 * StarterKit (~500KB). The feed viewer only needs to render paragraphs, text
 * with marks, mentions, lists, blockquotes, code blocks, and hard breaks.
 */

type JSONContent = {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: JSONContent[];
  text?: string;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderMarks(text: string, marks?: JSONContent["marks"]): string {
  if (!marks || marks.length === 0) return escapeHtml(text);

  let html = escapeHtml(text);
  for (const mark of marks) {
    switch (mark.type) {
      case "bold":
        html = `<strong>${html}</strong>`;
        break;
      case "italic":
        html = `<em>${html}</em>`;
        break;
      case "strike":
        html = `<s>${html}</s>`;
        break;
      case "code":
        html = `<code>${html}</code>`;
        break;
      case "link": {
        const href = escapeHtml(String(mark.attrs?.href ?? ""));
        html = `<a href="${href}" rel="noopener noreferrer nofollow">${html}</a>`;
        break;
      }
    }
  }
  return html;
}

function renderNode(node: JSONContent): string {
  if (node.type === "text" && typeof node.text === "string") {
    return renderMarks(node.text, node.marks);
  }

  const children = node.content?.map(renderNode).join("") ?? "";

  switch (node.type) {
    case "doc":
      return children;
    case "paragraph":
      return `<p>${children || "<br>"}</p>`;
    case "heading": {
      const level = Math.min(Math.max(Number(node.attrs?.level) || 1, 1), 6);
      return `<h${level}>${children}</h${level}>`;
    }
    case "blockquote":
      return `<blockquote>${children}</blockquote>`;
    case "bulletList":
      return `<ul>${children}</ul>`;
    case "orderedList": {
      const start = node.attrs?.start;
      const attr = start && start !== 1 ? ` start="${start}"` : "";
      return `<ol${attr}>${children}</ol>`;
    }
    case "listItem":
      return `<li>${children}</li>`;
    case "codeBlock":
      return `<pre><code>${children}</code></pre>`;
    case "horizontalRule":
      return "<hr>";
    case "hardBreak":
      return "<br>";
    case "mention": {
      const username =
        typeof node.attrs?.username === "string"
          ? node.attrs.username
          : typeof node.attrs?.label === "string"
            ? String(node.attrs.label).replace(/^@/, "")
            : String(node.attrs?.id ?? "");
      return `<span class="mention-token">@${escapeHtml(username)}</span>`;
    }
    default:
      return children;
  }
}

/**
 * Convert Tiptap JSON content to HTML without importing @tiptap/html or StarterKit.
 * Supports paragraphs, headings, lists, blockquotes, code blocks, mentions,
 * and inline marks (bold, italic, strike, code, link).
 */
export function convertContentToHtmlLite(doc: JSONContent): string {
  return renderNode(doc);
}
