'use client';

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Editor as TiptapEditor } from '@tiptap/core';
import Placeholder from '@tiptap/extension-placeholder';
import StarterKit from '@tiptap/starter-kit';
import { ReactRenderer, useEditor, EditorContent } from '@tiptap/react';
import tippy, { type Instance as TippyInstance } from 'tippy.js';

import {
  createMentionExtension,
  isEditorContentEmpty,
  parseEditorContent,
  type MentionableUser,
} from '@/lib/rich-text';
import { cn } from '@/lib/utils';

interface RichTextEditorProps {
  id?: string;
  value?: string | null;
  onChange?: (value: string) => void;
  onIsEmptyChange?: (isEmpty: boolean) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  mentionOptions?: MentionableUser[];
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
        if (event.key === 'Enter') {
          selectItem(selectedIndex);
          return true;
        }
        return false;
      },
    }));

    return (
      <div className="flex max-h-60 min-w-[220px] flex-col overflow-y-auto rounded-md border border-border bg-popover p-1 text-sm shadow-lg">
        {items.length === 0 ? (
          <div className="px-3 py-2 text-muted-foreground">No matches</div>
        ) : (
          items.map((item, index) => {
            const isActive = index === selectedIndex;
            return (
              <button
                key={item.id}
                type="button"
                className={cn(
                  'flex w-full flex-col items-start rounded-md px-3 py-2 text-left transition-colors',
                  isActive && 'bg-muted text-foreground',
                  !isActive && 'hover:bg-muted/80',
                )}
                onClick={() => selectItem(index)}
              >
                <span className="font-medium leading-tight">
                  {item.name ?? item.username}
                </span>
                <span className="text-xs text-muted-foreground">
                  @{item.username}
                </span>
              </button>
            );
          })
        )}
      </div>
    );
  },
);
MentionList.displayName = 'MentionList';

function createMentionSuggestion(
  getItems: () => MentionableUser[],
) {
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
        onStart(props: {
          editor: TiptapEditor;
          clientRect: (() => DOMRect) | null;
          items: MentionableUser[];
          command: (attrs: Record<string, unknown>) => void;
        }) {
          // @ts-expect-error - ReactRenderer type mismatch between @tiptap versions
          component = new ReactRenderer(MentionList, {
            props: {
              items: props.items,
              command: props.command,
            },
            editor: props.editor,
          });

          if (!props.clientRect) {
            return;
          }

          popup = tippy('body', {
            getReferenceClientRect: props.clientRect!,
            appendTo: () => document.body,
            content: component!.element,
            showOnCreate: true,
            interactive: true,
            trigger: 'manual',
            placement: 'bottom-start',
          });
        },
        onUpdate(props: {
          editor: TiptapEditor;
          clientRect: (() => DOMRect) | null;
          items: MentionableUser[];
          command: (attrs: Record<string, unknown>) => void;
        }) {
          component?.updateProps({
            items: props.items,
            command: props.command,
          });

          if (!props.clientRect) {
            return;
          }

          popup[0]?.setProps({
            getReferenceClientRect: props.clientRect,
          });
        },
        onKeyDown(props: { event: KeyboardEvent }) {
          if (props.event.key === 'Escape') {
            popup[0]?.hide();
            return true;
          }

          return (component?.ref as MentionListHandle | undefined)?.onKeyDown(props.event) ?? false;
        },
        onExit() {
          popup[0]?.destroy();
          component?.destroy();
        },
      };
    },
  };
}

export function RichTextEditor({
  id,
  value,
  onChange,
  onIsEmptyChange,
  placeholder,
  disabled,
  className,
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
        // @ts-expect-error - Suggestion type mismatch between @tiptap versions
        suggestion: createMentionSuggestion(() => mentionOptionsRef.current),
      }),
    [],
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
      }),
      Placeholder.configure({
        placeholder: placeholder ?? 'Write something…',
      }),
      mentionExtension,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any,
    content: parseEditorContent(value) ?? value ?? '',
    editable: !disabled,
    editorProps: {
      attributes: {
        ...(id ? { id } : {}),
        class: cn(
          'min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors',
          'focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20',
          disabled && 'opacity-50',
        ),
      },
    },
    onUpdate({ editor }) {
      const json = editor.getJSON();
      const serialized = JSON.stringify(json);
      lastValueRef.current = serialized;
      onChange?.(serialized);
      onIsEmptyChange?.(editor.isEmpty || isEditorContentEmpty(serialized));
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [editor, disabled]);

  useEffect(() => {
    if (!editor) return;

    const incoming = value ?? '';
    if (incoming === lastValueRef.current) {
      return;
    }

    if (!incoming) {
      editor.commands.clearContent(true);
      lastValueRef.current = '';
      onIsEmptyChange?.(true);
      return;
    }

    const doc = parseEditorContent(incoming);
    if (doc) {
      editor.commands.setContent(doc, false, {
        preserveWhitespace: true,
      });
    } else {
      editor.commands.setContent(incoming, false, {
        preserveWhitespace: true,
      });
    }

    lastValueRef.current = incoming;
    onIsEmptyChange?.(isEditorContentEmpty(incoming));
  }, [editor, value, onIsEmptyChange]);

  return (
    <div className={cn('rich-text-editor space-y-2', className)}>
      <EditorContent editor={editor} />
      <div className="text-xs text-muted-foreground">
        Tip: type @ to mention a teammate.
      </div>
    </div>
  );
}
