import { FeedbackContent } from "@/components/feedback/feedback-content";

interface FeedbackPageProps {
  params: Promise<{ id: string }>;
}

export default async function FeedbackPage({ params }: FeedbackPageProps) {
  const { id } = await params;
  return <FeedbackContent challengeId={id} />;
}
