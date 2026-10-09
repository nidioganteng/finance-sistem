import { phpFetch, getPhpToken } from "./api-client";

export type DokumenItem = {
  id: string;
  judul: string;
  kategori: string;
  fileUrl: string | null;
  createdAt: Date | string;
  uploadedBy: { name: string } | null;
  [key: string]: unknown;
};

export async function getDokumenList(kategori?: string): Promise<DokumenItem[]> {
  const token = await getPhpToken();
  const params = new URLSearchParams();
  if (kategori && kategori !== "semua") params.set("kategori", kategori);

  const result = await phpFetch<{ data: DokumenItem[] }>(`/api/dokumen?${params.toString()}`, token);
  return result.data ?? [];
}
