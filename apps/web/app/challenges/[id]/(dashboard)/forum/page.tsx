import { ForumContent } from "@/components/forum/forum-content";

interface ForumPageProps {
  params: Promise<{ id: string }>;
}

export default async function ForumPage({ params }: ForumPageProps) {
  const { id } = await params;

  return <ForumContent challengeId={id} />;
}
