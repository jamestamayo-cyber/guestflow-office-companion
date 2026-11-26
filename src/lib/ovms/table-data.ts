export function selectTableRows<T>(rows: T[], query: string, search: (row: T) => string, compare: (a: T, b: T) => number, descending: boolean, page: number, size: number) {
  const q = query.trim().toLowerCase();
  const filtered = rows.filter((row) => search(row).toLowerCase().includes(q)).sort((a, b) => compare(a, b) * (descending ? -1 : 1));
  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const current = Math.min(Math.max(page, 1), pages);
  return { rows: filtered.slice((current - 1) * size, current * size), total: filtered.length, pages, page: current };
}