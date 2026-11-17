export type JobPageWindow = { page: number; pageSize: number; from: number; to: number };

export function jobPageWindow(pageRaw: unknown, pageSizeRaw: unknown): JobPageWindow {
  const pageValue = Number(pageRaw);
  const sizeValue = pageSizeRaw == null || pageSizeRaw === "" ? 1000 : Number(pageSizeRaw);
  const page = Number.isFinite(pageValue) ? Math.max(0, Math.floor(pageValue)) : 0;
  const pageSize = Number.isFinite(sizeValue) ? Math.max(1, Math.min(1000, Math.floor(sizeValue))) : 1000;
  const from = page * pageSize;
  return { page, pageSize, from, to: from + pageSize };
}

export function splitPage<T>(rows: T[] | null | undefined, pageSize: number): { items: T[]; hasMore: boolean } {
  const values = Array.isArray(rows) ? rows : [];
  return { items: values.slice(0, pageSize), hasMore: values.length > pageSize };
}
