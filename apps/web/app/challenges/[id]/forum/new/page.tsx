import { NewPostForm } from "@/components/forum/new-post-form";

interface NewForumPostPageProps {
  params: Promise<{ id: string }>;
}

export default async function NewForumPostPage({ params }: NewForumPostPageProps) {
  const { id } = await params;

  return <NewPostForm challengeId={id} />;
}
