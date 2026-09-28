"use client";

import { Printer } from "lucide-react";
import { usePathname } from "next/navigation";
import { logExportActivity } from "@/lib/actions/log";

interface PrintButtonProps {
  title?: string;
  subType?: string;
  version?: string;
  entityName?: string;
  year?: number | string;
}

const PATH_TITLE_MAP: Record<string, string> = {
  "/laporan-keuangan": "Laporan Keuangan",
  "/laporan": "Laporan Komparasi",
  "/buku-besar": "Buku Besar",
  "/daftar-akun": "Daftar Akun",
  "/jurnal": "Jurnal Umum",
  "/jurnal-transaksi": "Jurnal Transaksi",
  "/aktiva-tetap": "Aktiva Tetap",
  "/neraca": "Neraca",
  "/laba-rugi": "Laba Rugi",
  "/arus-kas": "Arus Kas",
  "/piutang": "Kontrol Piutang",
};

export function PrintButton({ title, subType, version, entityName, year }: PrintButtonProps) {
  const pathname = usePathname();

  const handleClick = () => {
    const docTitle =
      title ||
      PATH_TITLE_MAP[pathname] ||
      (typeof document !== "undefined"
        ? document.title.split("|")[0].trim()
        : "Dokumen Laporan");
    const subDesc = subType ? ` ${subType}` : "";
    const versionLabel = version
      ? version.toUpperCase() === "UMUM"
        ? "Umum"
        : "Internal"
      : undefined;
    const versionDesc = versionLabel ? ` (${versionLabel})` : "";
    const entityDesc = entityName ? ` – ${entityName}` : "";
    const yearDesc = year ? ` (${year})` : "";

    const actionText = `Export PDF ${docTitle}${subDesc}${versionDesc}${entityDesc}${yearDesc}`;

    logExportActivity(actionText, {
      format: "PDF",
      jenis: subType || docTitle,
      version: versionLabel,
      entitas: entityName || undefined,
      tahun: year || undefined,
      halaman: pathname,
    });

    window.print();
  };

  return (
    <button
      onClick={handleClick}
      className="print:hidden flex items-center gap-1.5 px-3 py-2 rounded-[11px] border border-border-soft text-[13px] font-bold text-muted-stronger bg-surface-card hover:bg-surface-hover transition-colors"
    >
      <Printer size={14} />
      Export PDF
    </button>
  );
}
