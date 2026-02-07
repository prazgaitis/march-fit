import type { JSONContent } from '@tiptap/core';
import { generateHTML } from '@tiptap/html';
import Mention from '@tiptap/extension-mention';
import StarterKit from '@tiptap/starter-kit';

type Maybe<T> = T | null | undefined;

export interface MentionableUser {
  id: string;
  username: string;
  name: string | null;
  avatarUrl: string | null;
}

export const MENTION_CLASS_NAME = 'mention-token';

export function createMentionExtension(
  options?: Parameters<typeof Mention.configure>[0],
) {
  return Mention.configure({
    HTMLAttributes: {
      class: MENTION_CLASS_NAME,
    },
    renderLabel({ node }) {
      const username =
        typeof node.attrs?.username === 'string'
          ? node.attrs.username
          : typeof node.attrs?.label === 'string'
            ? node.attrs.label.replace(/^@/, '')
            : node.attrs?.id ?? '';
      return `@${username}`;
    },
    ...options,
  });
}

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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function convertContentToHtml(value: Maybe<string>): string | null {
  const doc = parseEditorContent(value);
  if (doc) {
    return generateHTML(doc, [
      StarterKit,
      createMentionExtension(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const escaped = escapeHtml(value);
    return escaped.replace(/\n/g, '<br />');
  }

  return null;
}
