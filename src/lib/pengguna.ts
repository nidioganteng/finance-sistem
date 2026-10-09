import { phpFetch, getPhpToken } from "./api-client";

// Shape returned by PHP GET /api/pengguna
type RawUserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  // PHP returns flat string[] (keys), frontend needs nested entityAccess
  entityKeys: string[];
  [key: string]: unknown;
};

export type UserItem = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt: Date | string;
  updatedAt?: Date | string;
  // Nested format that components expect
  entityAccess: Array<{
    entity: { id: string; name: string; key: string };
  }>;
  // Also keep the flat array for convenience
  entityKeys: string[];
};

export type EntityItem = {
  id: string;
  name: string;
  key: string;
  legalName?: string;
  colorHex?: string;
  isUmum?: boolean;
  createdAt?: string;
};

export async function getUserList(): Promise<UserItem[]> {
  const token = await getPhpToken();
  // PHP returns a bare array (not wrapped in { users: [...] })
  const rows = await phpFetch<RawUserRow[]>(`/api/pengguna`, token);
  // Transform flat entityKeys → nested entityAccess expected by components
  // Entity name/id is not returned by PHP's user list, so we stub them with key only.
  // If full entity objects are needed, the component should cross-reference getAllEntities().
  return (rows ?? []).map((row) => ({
    ...row,
    entityKeys: row.entityKeys ?? [],
    entityAccess: (row.entityKeys ?? []).map((key) => ({
      entity: { id: key, name: key, key },
    })),
  }));
}

export async function getAllEntities(): Promise<EntityItem[]> {
  const token = await getPhpToken();
  // PHP returns a bare array (not wrapped in { entities: [...] })
  const rows = await phpFetch<EntityItem[]>(`/api/entities`, token);
  return rows ?? [];
}
