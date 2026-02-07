import { paginationQuerySchema } from "./validations";

export function parsePagination(searchParams: URLSearchParams) {
  const values = paginationQuerySchema.parse({
    page: searchParams.get("page") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  });

  const offset = (values.page - 1) * values.limit;

  return { ...values, offset };
}
