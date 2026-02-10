export const notDeleted = (q: any) => q.eq(q.field("deletedAt"), undefined);

export const isDeleted = (q: any) => q.neq(q.field("deletedAt"), undefined);
