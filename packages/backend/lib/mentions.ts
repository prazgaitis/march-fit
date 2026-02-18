/**
 * Server-side utility to extract mentioned user IDs from Tiptap JSON content.
 */

type JSONContent = {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: JSONContent[];
};

/**
 * Extract all mentioned user IDs from a Tiptap JSON content string.
 * Returns an empty array if the content is not valid JSON or has no mentions.
 */
export function extractMentionedUserIds(content: string): string[] {
  if (!content.trim().startsWith("{")) return [];

  let doc: JSONContent;
  try {
    doc = JSON.parse(content);
  } catch {
    return [];
  }

  const ids = new Set<string>();
  collectMentions(doc, ids);
  return Array.from(ids);
}

function collectMentions(node: JSONContent, ids: Set<string>) {
  if (!node) return;

  if (node.type === "mention") {
    const id = typeof node.attrs?.id === "string" ? node.attrs.id : null;
    if (id) ids.add(id);
  }

  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      collectMentions(child, ids);
    }
  }
}
