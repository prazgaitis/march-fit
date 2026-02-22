import { getConvexClient } from "@/lib/convex-server";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";

import { getChallengeOrThrow } from "@/lib/challenge-helpers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminCategoriesTable } from "@/components/admin/admin-categories-table";
import { fetchAuthQuery } from "@/lib/server-auth";

interface CategoriesAdminPageProps {
  params: Promise<{ id: string }>;
}

export default async function CategoriesAdminPage({
  params,
}: CategoriesAdminPageProps) {
  const convex = getConvexClient();
  const { id } = await params;
  const challenge = await getChallengeOrThrow(id);

  const adminStatus = await fetchAuthQuery<{
    isAdmin: boolean;
    reason: "global_admin" | "creator" | "challenge_admin" | null;
  }>(api.queries.participations.isUserChallengeAdmin, {
    challengeId: challenge.id as Id<"challenges">,
  });

  if (!adminStatus.isAdmin) {
    return null;
  }

  const categories = await convex.query(api.queries.categories.getAll, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle>Categories</CardTitle>
      </CardHeader>
      <CardContent>
        <AdminCategoriesTable initialCategories={categories} />
      </CardContent>
    </Card>
  );
}
