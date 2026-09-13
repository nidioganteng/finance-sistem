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

export async function getNotifikasiList(role: Role, filterType?: string) {
  return prisma.notifikasi.findMany({
    where: {
      targetRole: role,
      ...(filterType && filterType !== "semua" ? { type: filterType as NotifikasiType } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
}
