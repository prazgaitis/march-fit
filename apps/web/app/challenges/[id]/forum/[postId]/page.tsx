import { ForumPostDetail } from "@/components/forum/forum-post-detail";

interface ForumPostPageProps {
  params: Promise<{ id: string; postId: string }>;
}

export default async function ForumPostPage({ params }: ForumPostPageProps) {
  const { id, postId } = await params;

  return <ForumPostDetail postId={postId} challengeId={id} />;
}
