/**
 * Lightweight rich-text utilities that do NOT import Tiptap.
 *
 * Import from here (not rich-text.ts) when you only need parsing, empty checks,
 * or types — avoids pulling ~500KB of Tiptap into the client bundle.
 */

type Maybe<T> = T | null | undefined;

type JSONContent = {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: JSONContent[];
  text?: string;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
};

export interface MentionableUser {
  id: string;
  username: string;
  name: string | null;
  avatarUrl: string | null;
}

export const MENTION_CLASS_NAME = 'mention-token';

function isJsonContent(value: Maybe<string>): value is string {
  return typeof value === 'string' && value.trim().startsWith('{');
}

export function parseEditorContent(value: Maybe<string>): JSONContent | null {
  if (!isJsonContent(value)) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as JSONContent;
    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function collectFromNode(
  node: JSONContent,
  state: { text: string[]; mentions: Set<string> },
) {
  if (!node) return;

  if (node.type === 'text' && typeof node.text === 'string') {
    state.text.push(node.text);
  }

  if (node.type === 'mention') {
    const id = typeof node.attrs?.id === 'string' ? node.attrs.id : null;
    if (id) {
      state.mentions.add(id);
    }
    const label =
      typeof node.attrs?.label === 'string'
        ? node.attrs.label
        : typeof node.attrs?.username === 'string'
          ? `@${node.attrs.username}`
          : null;
    if (label) {
      state.text.push(label);
    }
  }

  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      collectFromNode(child, state);
    }
  }
}

export function getPlainTextFromJson(doc: JSONContent | null): string {
  if (!doc) {
    return '';
  }

  const state = { text: [] as string[], mentions: new Set<string>() };
  collectFromNode(doc, state);

  return state.text.join(' ');
}

export function getPlainTextFromValue(value: Maybe<string>): string {
  const doc = parseEditorContent(value);
  if (doc) {
    return getPlainTextFromJson(doc);
  }
  return typeof value === 'string' ? value : '';
}

export function extractMentionedUserIds(value: Maybe<string>): string[] {
  const doc = parseEditorContent(value);
  if (!doc) {
    return [];
  }

  const state = { text: [] as string[], mentions: new Set<string>() };
  collectFromNode(doc, state);
  return Array.from(state.mentions);
}

export function isEditorContentEmpty(value: Maybe<string>): boolean {
  const text = getPlainTextFromValue(value);
  return text.trim().length === 0;
}
