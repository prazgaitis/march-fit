"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/editor/rich-text-editor";
import { useMentionableUsers } from "@/hooks/use-mentionable-users";
import { isEditorContentEmpty } from "@/lib/rich-text-utils";

interface NewPostFormProps {
  challengeId: string;
}

export function NewPostForm({ challengeId }: NewPostFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const createPost = useMutation(api.mutations.forumPosts.create);
  const { users: mentionOptions } = useMentionableUsers(challengeId);

  const contentEmpty = !content || isEditorContentEmpty(content);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || contentEmpty) return;

    setSubmitting(true);
    try {
      const postId = await createPost({
        challengeId: challengeId as Id<"challenges">,
        title: title.trim(),
        content,
      });
      router.push(`/challenges/${challengeId}/forum/${postId}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <Link
        href={`/challenges/${challengeId}/forum`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Forum
      </Link>

      <div className="rounded-lg border border-zinc-800 p-5">
        <h1 className="mb-4 text-xl font-bold text-white">New Post</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            placeholder="Post title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          <RichTextEditor
            placeholder="What's on your mind?"
            value={content}
            onChange={setContent}
            mentionOptions={mentionOptions}
          />

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" asChild>
              <Link href={`/challenges/${challengeId}/forum`}>Cancel</Link>
            </Button>
            <Button type="submit" disabled={submitting || !title.trim() || contentEmpty}>
              {submitting ? "Posting..." : "Post"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
