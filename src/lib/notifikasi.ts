import { NotifikasiType, Role } from "@prisma/client";
import { phpFetch, getPhpToken } from "./api-client";

const LABELS_CEO: Partial<Record<NotifikasiType, string>> = {
  TERMIN_BARU: "Input Termin Baru",
  PROGRES_80: "Progres Termin 80%",
  PERUBAHAN_CLOSED: "Perubahan Laporan Closed",
  BACKDATE: "Input Backdate",
  JENIS_INPUT_BARU: "Jenis Input Baru",
};

const LABELS_MANAJER: Partial<Record<NotifikasiType, string>> = {
  PENDAFTARAN: "Pendaftaran Akun",
  LOADING_DOCK: "Loading Dock",
  TERMIN_AUDIT: "Termin Perlu Diaudit",
  JENIS_INPUT_BARU: "Jenis Input Baru",
};

export function getNotifTypeLabels(role: Role) {
  return role === "MANAJER_KEUANGAN" || role === "STAF_KEUANGAN" ? LABELS_MANAJER : LABELS_CEO;
}

export function getNotifFilterOptions(role: Role) {
  const labels = getNotifTypeLabels(role);
  return [{ key: "semua", label: "Semua" }, ...Object.entries(labels).map(([key, label]) => ({ key, label: label! }))];
}

export type NotifikasiItem = {
  id: string;
  type: NotifikasiType;
  targetRole: Role;
  read: boolean;
  /** PHP returns this field as `text`. Mapped to `text` to match PHP column name. */
  text: string;
  createdAt: Date;
  [key: string]: unknown;
};

export type NotifikasiListResult = {
  list: NotifikasiItem[];
  totalCount: number;
  totalPages: number;
  page: number;
};

type PhpNotifikasiRow = {
  id: string;
  type: NotifikasiType;
  targetRole: Role;
  read: boolean;
  text: string;
  createdAt: string;
};

type PhpNotifikasiResponse = {
  data: PhpNotifikasiRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export async function getNotifikasiList(_role: Role, filterType?: string, page = 1): Promise<NotifikasiListResult> {
  const token = await getPhpToken();
  const params = new URLSearchParams();
  // PHP supports filter=unread or filter=<NotifikasiType> (e.g. TERMIN_BARU)
  if (filterType && filterType !== "semua") params.set("filter", filterType);
  params.set("page", String(page));

  const raw = await phpFetch<PhpNotifikasiResponse>(`/api/notifikasi?${params.toString()}`, token);

  return {
    list: raw.data.map((row) => ({
      ...row,
      createdAt: new Date(row.createdAt),
    })),
    totalCount: raw.pagination.total,
    totalPages: raw.pagination.totalPages,
    page: raw.pagination.page,
  };
}
