// Local enum & type definitions — replaces @prisma/client imports
// Source of truth: prisma/schema.prisma (now removed, backend is PHP)

export type Role =
  | "SUPER_ADMIN"
  | "MANAJER_KEUANGAN"
  | "STAF_KEUANGAN"
  | "MANAGER_ADMIN"
  | "ADMIN_SIDAMON";

export const Role = {
  SUPER_ADMIN: "SUPER_ADMIN",
  MANAJER_KEUANGAN: "MANAJER_KEUANGAN",
  STAF_KEUANGAN: "STAF_KEUANGAN",
  MANAGER_ADMIN: "MANAGER_ADMIN",
  ADMIN_SIDAMON: "ADMIN_SIDAMON",
} as const;

export type UserStatus = "PENDING" | "ACTIVE" | "INACTIVE";
export const UserStatus = {
  PENDING: "PENDING",
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
} as const;

export type TerminStatus = "ON_TRACK" | "AT_RISK" | "NEEDS_AUDIT";
export const TerminStatus = {
  ON_TRACK: "ON_TRACK",
  AT_RISK: "AT_RISK",
  NEEDS_AUDIT: "NEEDS_AUDIT",
} as const;

export type CoaKategori = "PENDAPATAN" | "BEBAN" | "ASET" | "KEWAJIBAN" | "MODAL";
export const CoaKategori = {
  PENDAPATAN: "PENDAPATAN",
  BEBAN: "BEBAN",
  ASET: "ASET",
  KEWAJIBAN: "KEWAJIBAN",
  MODAL: "MODAL",
} as const;

export type ReportType = "NERACA" | "LABA_RUGI" | "ARUS_KAS";
export const ReportType = {
  NERACA: "NERACA",
  LABA_RUGI: "LABA_RUGI",
  ARUS_KAS: "ARUS_KAS",
} as const;

export type ReportCategory = "INTERNAL" | "UMUM" | "SEMUA";
export const ReportCategory = {
  INTERNAL: "INTERNAL",
  UMUM: "UMUM",
  SEMUA: "SEMUA",
} as const;

export type NotifikasiType =
  | "PENDAFTARAN"
  | "LOADING_DOCK"
  | "TERMIN_AUDIT"
  | "TERMIN_BARU"
  | "PROGRES_80"
  | "PERUBAHAN_CLOSED"
  | "BACKDATE"
  | "JENIS_INPUT_BARU";

export const NotifikasiType = {
  PENDAFTARAN: "PENDAFTARAN",
  LOADING_DOCK: "LOADING_DOCK",
  TERMIN_AUDIT: "TERMIN_AUDIT",
  TERMIN_BARU: "TERMIN_BARU",
  PROGRES_80: "PROGRES_80",
  PERUBAHAN_CLOSED: "PERUBAHAN_CLOSED",
  BACKDATE: "BACKDATE",
  JENIS_INPUT_BARU: "JENIS_INPUT_BARU",
} as const;

export type RekananTipe = "VENDOR" | "KLIEN" | "TENAGA_AHLI" | "SUBKONTRAKTOR" | "LAINNYA";
export const RekananTipe = {
  VENDOR: "VENDOR",
  KLIEN: "KLIEN",
  TENAGA_AHLI: "TENAGA_AHLI",
  SUBKONTRAKTOR: "SUBKONTRAKTOR",
  LAINNYA: "LAINNYA",
} as const;

export type LogCategory = "USER_ACTIVITY" | "FINANCIAL_CHANGE";
export const LogCategory = {
  USER_ACTIVITY: "USER_ACTIVITY",
  FINANCIAL_CHANGE: "FINANCIAL_CHANGE",
} as const;

export type ProjectStatus = "ACTIVE" | "COMPLETED" | "CANCELLED";
export const ProjectStatus = {
  ACTIVE: "ACTIVE",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
} as const;

// Base type matching AsetTetap Prisma model (used in aset-tetap.ts)
export type AsetTetap = {
  id: string;
  entityId: string;
  kode: string;
  nama: string;
  kategori: string;
  tanggalPerolehan: Date;
  hargaPerolehan: number;
  nilaiResidu: number;
  umurBulan: number;
  metode: string;
  keterangan: string | null;
  createdAt: Date;
  updatedAt: Date;
};
