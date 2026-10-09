import { phpFetch, getPhpToken } from "./api-client";

export type CoaAccountItem = {
  id: string;
  code: string;
  name: string;
  kategori: string;
  reportCategory: string;
  reportType: string | null;
  urutan: number;
  createdAt: string | Date;
  [key: string]: unknown;
};

export async function getCOAList(): Promise<CoaAccountItem[]> {
  const token = await getPhpToken();
  const result = await phpFetch<{ data: CoaAccountItem[] }>(`/api/coa`, token);
  return result.data ?? [];
}
