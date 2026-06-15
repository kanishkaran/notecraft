export const CATEGORY_PALETTE = [
  "#4a9eff", "#a78bfa", "#f59e0b", "#34d399",
  "#f87171", "#38bdf8", "#fb7185", "#a3e635",
];

export type Category = {
  id: string;
  name: string;
  color: string;
  isDefault: boolean;
};

export type Entry = {
  id: string;
  date: string;
  text: string;
  timeLabel: string;
  timestamp: number;
  categoryId: string | null;
  category: Category | null;
  createdAt: string;
  updatedAt: string;
};

export type SearchResult = Entry & { similarity: number };

export async function searchEntriesApi(query: string): Promise<SearchResult[]> {
  const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error("Search failed");
  return res.json();
}

export async function fetchEntries(date: string): Promise<Entry[]> {
  const res = await fetch(`/api/entries?date=${date}`);
  if (!res.ok) return [];
  return res.json();
}

export async function fetchEntriesRange(from: string, to: string): Promise<Record<string, Entry[]>> {
  const res = await fetch(`/api/entries?from=${from}&to=${to}`);
  if (!res.ok) return {};
  return res.json();
}

export async function fetchCategories(): Promise<Category[]> {
  const res = await fetch("/api/categories");
  if (!res.ok) return [];
  return res.json();
}

export async function createCategoryApi(name: string, color: string): Promise<Category> {
  const res = await fetch("/api/categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, color }),
  });
  if (!res.ok) throw new Error("Failed to create category");
  return res.json();
}

export async function deleteCategoryApi(id: string): Promise<void> {
  await fetch(`/api/categories/${id}`, { method: "DELETE" });
}

export async function createEntry(
  date: string,
  text: string,
  timeLabel: string,
  timestamp: number,
  categoryId?: string | null,
): Promise<Entry> {
  const res = await fetch("/api/entries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date, text, timeLabel, timestamp, categoryId: categoryId ?? null }),
  });
  if (!res.ok) throw new Error("Failed to create entry");
  return res.json();
}

export async function updateEntryApi(id: string, text: string, categoryId?: string | null): Promise<Entry> {
  const body: Record<string, unknown> = { text };
  if (categoryId !== undefined) body.categoryId = categoryId;
  const res = await fetch(`/api/entries/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to update entry");
  return res.json();
}

export async function deleteEntryApi(id: string): Promise<void> {
  const res = await fetch(`/api/entries/${id}`, { method: "DELETE" });
  // A 404 means it's already gone, which is the outcome the user wanted
  if (!res.ok && res.status !== 404) throw new Error("Failed to delete entry");
}
