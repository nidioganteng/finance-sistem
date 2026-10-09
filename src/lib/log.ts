import { phpFetch, getPhpToken } from "./api-client";

export type ActivityLogItem = {
  id: string;
  action: string;
  category: "USER_ACTIVITY" | "FINANCIAL_CHANGE";
  createdAt: Date | string;
  detail?: unknown;
  actor: {
    name: string;
    role: string;
  } | null;
  [key: string]: unknown;
};

// Shape that PHP /api/log actually returns
type PhpLogRow = {
  id: string;
  actorId: string;
  action: string;
  category: "USER_ACTIVITY" | "FINANCIAL_CHANGE";
  detail: unknown;
  createdAt: string;
  actorName: string | null;
  actorEmail: string | null;
  actorRole: string | null;
};

type PhpLogResponse = {
  data: PhpLogRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export async function getActivityLogs(category?: "USER_ACTIVITY" | "FINANCIAL_CHANGE"): Promise<ActivityLogItem[]> {
  const token = await getPhpToken();
  const params = new URLSearchParams();
  if (category) params.set("category", category);

  const result = await phpFetch<PhpLogResponse>(`/api/log?${params.toString()}`, token);

  // PHP returns { data: [...] } — map flat actorName/actorRole to nested actor object
  const rows: PhpLogRow[] = result.data ?? [];
  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    category: row.category,
    createdAt: row.createdAt,
    detail: row.detail,
    actor: row.actorName
      ? { name: row.actorName, role: row.actorRole ?? "" }
      : null,
  }));
}
