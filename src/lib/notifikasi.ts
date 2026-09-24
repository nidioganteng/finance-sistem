import { NotifikasiType, Role } from "@prisma/client";
import { prisma } from "./prisma";

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
  return role === "MANAJER_KEUANGAN" ? LABELS_MANAJER : LABELS_CEO;
}

export function getNotifFilterOptions(role: Role) {
  const labels = getNotifTypeLabels(role);
  return [{ key: "semua", label: "Semua" }, ...Object.entries(labels).map(([key, label]) => ({ key, label: label! }))];
}

const NOTIF_PAGE_SIZE = 25;

export async function getNotifikasiList(role: Role, filterType?: string, page = 1) {
  const where = {
    targetRole: role,
    ...(filterType && filterType !== "semua" ? { type: filterType as NotifikasiType } : {}),
  };

  const [totalCount, list] = await Promise.all([
    prisma.notifikasi.count({ where }),
    prisma.notifikasi.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * NOTIF_PAGE_SIZE,
      take: NOTIF_PAGE_SIZE,
    }),
  ]);

  return {
    list,
    totalCount,
    totalPages: Math.max(1, Math.ceil(totalCount / NOTIF_PAGE_SIZE)),
    page,
  };
}
