'use client';

import { useMemo } from 'react';

import { convertContentToHtml } from '@/lib/rich-text';
import { cn } from '@/lib/utils';

interface RichTextViewerProps {
  content?: string | null;
  className?: string;
}

export function RichTextViewer({ content, className }: RichTextViewerProps) {
  const html = useMemo(() => convertContentToHtml(content), [content]);

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
