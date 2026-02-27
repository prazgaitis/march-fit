import { ReactNode } from "react";

interface ForumLayoutProps {
  children: ReactNode;
}

export default function ForumLayout({
  children,
}: ForumLayoutProps) {
  return <div className="mx-auto max-w-2xl px-4 py-6">{children}</div>;
}
