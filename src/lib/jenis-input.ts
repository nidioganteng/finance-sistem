import { phpFetch, getPhpToken } from "./api-client";

export type JenisInputItem = {
  id: string;
  key: string;
  nama: string;
  active: boolean;
  createdAt: Date | string;
  createdBy: { name: string } | null;
  [key: string]: unknown;
};

export async function getJenisInputList(): Promise<JenisInputItem[]> {
  const token = await getPhpToken();
  const result = await phpFetch<{ data: JenisInputItem[] }>(`/api/jenis-input`, token);
  return result.data ?? [];
}
