# Implementing @Mentions with Tiptap in React

A practical guide to building an @mention system using Tiptap, covering the editor component, suggestion dropdown, content storage, server-side extraction, and lightweight HTML rendering.

## Dependencies

```bash
npm install @tiptap/react @tiptap/starter-kit @tiptap/core \
  @tiptap/extension-mention @tiptap/extension-placeholder \
  @tiptap/suggestion @tiptap/html tippy.js
```

| Package | Purpose |
|---|---|
| `@tiptap/react` | React bindings for the Tiptap editor |
| `@tiptap/starter-kit` | Base extensions (bold, italic, lists, history, etc.) |
| `@tiptap/core` | Core editor engine (peer dependency) |
| `@tiptap/extension-mention` | Mention node type — renders `@user` as an inline token |
| `@tiptap/extension-placeholder` | Placeholder text when the editor is empty |
| `@tiptap/suggestion` | Autocomplete engine that powers the popup when typing `@` |
| `@tiptap/html` | Serialize Tiptap JSON back to HTML (used server-side or for emails) |
| `tippy.js` | Positions the suggestion popup relative to the cursor |

---

## Architecture Overview

The system has four layers:

1. **Editor component** — Tiptap editor with the mention extension wired up
2. **Suggestion popup** — A React component rendered via `tippy.js` that appears when the user types `@`
3. **Storage format** — Tiptap JSON stored as a serialized string in your database
4. **Consumption utilities** — Extract mentioned user IDs (server-side), convert to plain text, and render to HTML

---

## 1. Configure the Mention Extension

Create a shared mention extension factory so the same config is used by the editor and the HTML serializer:

```ts
// lib/rich-text.ts
import Mention from '@tiptap/extension-mention';

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
```

The mention node stores `id`, `label`, and optionally `username` in its attrs. The `id` is the stable user identifier; `label`/`username` are display values.

---

## 2. Build the Suggestion Popup

The suggestion popup is a React component that receives a list of filtered items and a `command` callback to insert the selected mention.

### MentionList component

```tsx
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';

interface MentionableUser {
  id: string;
  username: string;
  name: string | null;
  avatarUrl: string | null;
}

interface MentionListProps {
  items: MentionableUser[];
  command: (attrs: Record<string, unknown>) => void;
}

interface MentionListHandle {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

const MentionList = forwardRef<MentionListHandle, MentionListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    const selectItem = (index: number) => {
      const item = items[index];
      if (item) {
        command({
          id: item.id,
          label: `@${item.username}`,
          username: item.username,
          name: item.name ?? undefined,
        });
      }
    };

    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    useImperativeHandle(ref, () => ({
      onKeyDown(event) {
        if (event.key === 'ArrowDown') {
          setSelectedIndex((prev) => (prev + 1) % Math.max(items.length, 1));
          return true;
        }
        if (event.key === 'ArrowUp') {
          setSelectedIndex((prev) =>
            prev - 1 < 0 ? Math.max(items.length - 1, 0) : prev - 1,
          );
          return true;
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          selectItem(selectedIndex);
          return true;
        }
        return false;
      },
    }));

    return (
      <div className="mention-popup">
        {items.length === 0 ? (
          <div className="mention-empty">No matches</div>
        ) : (
          items.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className={index === selectedIndex ? 'active' : ''}
              onMouseDown={(e) => e.preventDefault()}
              onTouchStart={(e) => e.preventDefault()}
              onTouchEnd={(e) => {
                e.preventDefault();
                selectItem(index);
              }}
              onClick={() => selectItem(index)}
            >
              <span className="mention-name">{item.name ?? item.username}</span>
              <span className="mention-username">@{item.username}</span>
            </button>
          ))
        )}
      </div>
    );
  },
);
```

**Mobile note:** The `onTouchStart`/`onTouchEnd` handlers with `preventDefault()` are important — without them, the touch event can blur the editor and dismiss the popup before the selection registers.

### Suggestion configuration

Wire the popup to `@tiptap/suggestion` using `tippy.js` for positioning and `ReactRenderer` for rendering:

```tsx
import { ReactRenderer } from '@tiptap/react';
import tippy, { type Instance as TippyInstance } from 'tippy.js';

function createMentionSuggestion(getItems: () => MentionableUser[]) {
  return {
    char: '@',
    items({ query }: { query: string }) {
      const normalized = query.toLowerCase();
      return getItems()
        .filter((item) => {
          if (!normalized) return true;
          return (
            item.username.toLowerCase().includes(normalized) ||
            (item.name?.toLowerCase().includes(normalized) ?? false)
          );
        })
        .slice(0, 10);
    },
    render() {
      let component: ReactRenderer<MentionListProps> | null = null;
      let popup: TippyInstance[] = [];

      return {
        onStart(props) {
          component = new ReactRenderer(MentionList, {
            props: { items: props.items, command: props.command },
            editor: props.editor,
          });

          if (!props.clientRect) return;

          popup = tippy('body', {
            getReferenceClientRect: props.clientRect,
            appendTo: () => document.body,
            content: component.element,
            showOnCreate: true,
            interactive: true,
            trigger: 'manual',
            placement: 'bottom-start',
            touch: true,
          });
        },
        onUpdate(props) {
          component?.updateProps({
            items: props.items,
            command: props.command,
          });
          if (props.clientRect) {
            popup[0]?.setProps({ getReferenceClientRect: props.clientRect });
          }
        },
        onKeyDown(props) {
          if (props.event.key === 'Escape') {
            popup[0]?.hide();
            return true;
          }
          return component?.ref?.onKeyDown(props.event) ?? false;
        },
        onExit() {
          popup[0]?.destroy();
          component?.destroy();
        },
      };
    },
  };
}
```

---

## 3. The Editor Component

```tsx
'use client';

import { useEffect, useMemo, useRef } from 'react';
import Placeholder from '@tiptap/extension-placeholder';
import StarterKit from '@tiptap/starter-kit';
import { useEditor, EditorContent } from '@tiptap/react';
import { createMentionExtension } from './rich-text';

interface RichTextEditorProps {
  value?: string | null;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  mentionOptions?: MentionableUser[];
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  disabled,
  mentionOptions,
}: RichTextEditorProps) {
  const lastValueRef = useRef<string>(value ?? '');
  const mentionOptionsRef = useRef<MentionableUser[]>(mentionOptions ?? []);

  useEffect(() => {
    mentionOptionsRef.current = mentionOptions ?? [];
  }, [mentionOptions]);

  const mentionExtension = useMemo(
    () =>
      createMentionExtension({
        suggestion: createMentionSuggestion(() => mentionOptionsRef.current),
      }),
    [],
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: false }),
      Placeholder.configure({ placeholder: placeholder ?? 'Write something…' }),
      mentionExtension,
    ],
    content: parseEditorContent(value) ?? value ?? '',
    editable: !disabled,
    onUpdate({ editor }) {
      const json = editor.getJSON();
      const serialized = JSON.stringify(json);
      lastValueRef.current = serialized;
      onChange?.(serialized);
    },
  });

  // Sync external value changes into the editor
  useEffect(() => {
    if (!editor) return;
    const incoming = value ?? '';
    if (incoming === lastValueRef.current) return;

    if (!incoming) {
      editor.commands.clearContent(true);
      lastValueRef.current = '';
      return;
    }

    const doc = parseEditorContent(incoming);
    editor.commands.setContent(doc ?? incoming, false, {
      preserveWhitespace: true,
    });
    lastValueRef.current = incoming;
  }, [editor, value]);

  return <EditorContent editor={editor} />;
}
```

**Key patterns:**
- `mentionOptionsRef` is a ref so that the suggestion config (memoized once) always reads fresh data without re-creating the extension.
- `lastValueRef` prevents infinite loops when the parent's `onChange` triggers a re-render with the same value.
- `immediatelyRender: false` avoids SSR hydration mismatches in Next.js / server components.

---

## 4. Storage Format

The editor's `onUpdate` callback serializes the Tiptap document as JSON:

```json
{
  "type": "doc",
  "content": [
    {
      "type": "paragraph",
      "content": [
        { "type": "text", "text": "Great job " },
        {
          "type": "mention",
          "attrs": {
            "id": "user_abc123",
            "label": "@jdoe",
            "username": "jdoe"
          }
        },
        { "type": "text", "text": "!" }
      ]
    }
  ]
}
```

Store this as a string in your database. This preserves the structured mention data (including the user `id`) and is losslessly round-trippable back into the editor.

---

## 5. Server-Side Utilities

### Extract mentioned user IDs

Walk the JSON tree and collect `id` attrs from mention nodes. This is used to send notifications, check permissions, etc.

```ts
type JSONContent = {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: JSONContent[];
};

export function extractMentionedUserIds(content: string): string[] {
  if (!content.trim().startsWith('{')) return [];

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

  if (node.type === 'mention') {
    const id = typeof node.attrs?.id === 'string' ? node.attrs.id : null;
    if (id) ids.add(id);
  }

  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      collectMentions(child, ids);
    }
  }
}
```

**Important:** This utility intentionally does not import any Tiptap packages. It's pure JSON traversal, safe for server-side use with zero bundle cost.

### Convert to plain text

```ts
export function getPlainText(content: string): string {
  const doc = parseEditorContent(content);
  if (!doc) return content ?? '';

  const parts: string[] = [];
  collectText(doc, parts);
  return parts.join(' ');
}

function collectText(
  node: JSONContent,
  parts: string[],
) {
  if (node.type === 'text' && typeof node.text === 'string') {
    parts.push(node.text);
  }
  if (node.type === 'mention') {
    const label = node.attrs?.label ?? `@${node.attrs?.username ?? node.attrs?.id}`;
    parts.push(String(label));
  }
  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      collectText(child, parts);
    }
  }
}
```

---

## 6. Rendering Stored Content as HTML

### Option A: Using `@tiptap/html` (full fidelity)

```ts
import { generateHTML } from '@tiptap/html';
import StarterKit from '@tiptap/starter-kit';
import { createMentionExtension } from './rich-text';

export function contentToHtml(value: string): string | null {
  const doc = parseEditorContent(value);
  if (!doc) return null;
  return generateHTML(doc, [StarterKit, createMentionExtension()]);
}
```

**Downside:** Pulls in ~500KB of Tiptap into the client bundle.

### Option B: Lightweight custom renderer (recommended for read-only views)

A zero-dependency renderer that handles the node types you actually use:

```ts
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderMarks(text: string, marks?: Mark[]): string {
  if (!marks?.length) return escapeHtml(text);
  let html = escapeHtml(text);
  for (const mark of marks) {
    switch (mark.type) {
      case 'bold':    html = `<strong>${html}</strong>`; break;
      case 'italic':  html = `<em>${html}</em>`; break;
      case 'strike':  html = `<s>${html}</s>`; break;
      case 'code':    html = `<code>${html}</code>`; break;
      case 'link': {
        const href = escapeHtml(String(mark.attrs?.href ?? ''));
        html = `<a href="${href}" rel="noopener noreferrer nofollow">${html}</a>`;
        break;
      }
    }
  }
  return html;
}

function renderNode(node: JSONContent): string {
  if (node.type === 'text' && typeof node.text === 'string') {
    return renderMarks(node.text, node.marks);
  }

  const children = node.content?.map(renderNode).join('') ?? '';

  switch (node.type) {
    case 'doc':           return children;
    case 'paragraph':     return `<p>${children || '<br>'}</p>`;
    case 'blockquote':    return `<blockquote>${children}</blockquote>`;
    case 'bulletList':    return `<ul>${children}</ul>`;
    case 'orderedList':   return `<ol>${children}</ol>`;
    case 'listItem':      return `<li>${children}</li>`;
    case 'codeBlock':     return `<pre><code>${children}</code></pre>`;
    case 'horizontalRule': return '<hr>';
    case 'hardBreak':     return '<br>';
    case 'mention': {
      const username =
        typeof node.attrs?.username === 'string'
          ? node.attrs.username
          : typeof node.attrs?.label === 'string'
            ? String(node.attrs.label).replace(/^@/, '')
            : String(node.attrs?.id ?? '');
      return `<span class="mention-token">@${escapeHtml(username)}</span>`;
    }
    default:
      return children;
  }
}

export function contentToHtmlLite(doc: JSONContent): string {
  return renderNode(doc);
}
```

This saves ~500KB from the client bundle and renders all the node types that matter for display.

---

## 7. Backward Compatibility with Plain Text

If your system previously stored plain strings, handle both formats:

```ts
function parseEditorContent(value: string | null | undefined): JSONContent | null {
  if (typeof value !== 'string' || !value.trim().startsWith('{')) return null;
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === 'object' && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}
```

Use this check everywhere content is consumed. If it parses as Tiptap JSON, process it as structured content. Otherwise, treat it as a plain string. This lets you migrate incrementally without a backfill.

---

## Summary

| Layer | What | Imports Tiptap? |
|---|---|---|
| Editor component | `useEditor` + `EditorContent` with mention extension | Yes |
| Suggestion popup | `ReactRenderer` + `tippy.js` for positioning | Yes |
| Extract mention IDs | Recursive JSON traversal for `type: "mention"` nodes | No |
| Plain text extraction | Recursive JSON traversal collecting `.text` values | No |
| HTML rendering (lite) | Custom `renderNode` switch statement | No |
| HTML rendering (full) | `generateHTML()` from `@tiptap/html` | Yes |

The key insight is to **only import Tiptap where the editor is actually mounted**. All read-only consumption (notifications, feeds, server-side processing) can use lightweight JSON traversal with zero dependencies.
