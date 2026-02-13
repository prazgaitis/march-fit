'use client';

import { useMemo } from 'react';

import { convertContentToHtmlLite } from '@/lib/rich-text-html';
import { cn } from '@/lib/utils';

type Maybe<T> = T | null | undefined;

function parseJsonContent(value: Maybe<string>) {
  if (typeof value !== 'string' || !value.trim().startsWith('{')) return null;
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === 'object' && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function toHtml(content: Maybe<string>): string | null {
  const doc = parseJsonContent(content);
  if (doc) {
    return convertContentToHtmlLite(doc);
  }
  if (typeof content === 'string' && content.trim().length > 0) {
    return escapeHtml(content).replace(/\n/g, '<br />');
  }
  return null;
}

interface RichTextViewerProps {
  content?: string | null;
  className?: string;
}

export function RichTextViewer({ content, className }: RichTextViewerProps) {
  const html = useMemo(() => toHtml(content), [content]);

  if (!html) {
    return null;
  }

  return (
    <div
      className={cn('rich-text-output text-sm leading-relaxed', className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
