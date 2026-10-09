import { phpFetch, getPhpToken } from "./api-client";
import { formatRupiah } from "./dashboard-data";

export type ReportVersion = "INTERNAL" | "UMUM";

export type LabaRugiItem = {
  code: string;
  name: string;
  total: number;
  totalFmt: string;
};

export type LabaRugiData = {
  pendapatanList: LabaRugiItem[];
  bebanList: LabaRugiItem[];
  totalPendapatan: number;
  totalBeban: number;
  totalPendapatanFmt: string;
  totalBebanFmt: string;
  labaBersih: number;
  labaBersihFmt: string;
  labaBersihPositive: boolean;
  penyusutanOtomatis: number;
  penyusutanOtomatisFmt: string;
  pendapatanFaktur: number;
  pendapatanFakturFmt: string;
  version: ReportVersion;
};

// PHP item shape: { id, code, name, kategori, debit, kredit, saldo, isAuto? }
type PhpLRItem = {
  id: string | null;
  code: string;
  name: string;
  kategori: string;
  debit: number;
  kredit: number;
  saldo: number;
  isAuto?: boolean;
};

// PHP response: { entityId, dari, sampai, version, pendapatan, beban, totalPendapatan, totalBeban, labaBersih, bebanPenyusutan }
type PhpLabaRugiResponse = {
  entityId: string;
  dari: string;
  sampai: string;
  version: string;
  pendapatan: PhpLRItem[];
  beban: PhpLRItem[];
  totalPendapatan: number;
  totalBeban: number;
  labaBersih: number;
  bebanPenyusutan: number;
};

function buildDateRange(year: number, month?: number): { dari: string; sampai: string } {
  if (month) {
    const lastDay = new Date(year, month, 0).getDate();
    const mm = String(month).padStart(2, "0");
    return {
      dari: `${year}-${mm}-01`,
      sampai: `${year}-${mm}-${String(lastDay).padStart(2, "0")}`,
    };
  }
  return {
    dari: `${year}-01-01`,
    sampai: `${year}-12-31`,
  };
}

export async function getLabaRugiData(
  entityId: string,
  year: number,
  month?: number,
  version: ReportVersion | string = "INTERNAL"
): Promise<LabaRugiData> {
  const token = await getPhpToken();
  const { dari, sampai } = buildDateRange(year, month);

  const params = new URLSearchParams();
  params.set("entityId", entityId);
  params.set("dari", dari);
  params.set("sampai", sampai);
  params.set("version", String(version));

  const raw = await phpFetch<PhpLabaRugiResponse>(`/api/laba-rugi?${params.toString()}`, token);

  const pendapatanList: LabaRugiItem[] = raw.pendapatan.map((item) => ({
    code: item.code,
    name: item.name,
    total: item.saldo,
    totalFmt: formatRupiah(item.saldo),
  }));

  const bebanList: LabaRugiItem[] = raw.beban.map((item) => ({
    code: item.code,
    name: item.name,
    total: item.saldo,
    totalFmt: formatRupiah(item.saldo),
  }));

  const penyusutanOtomatis = raw.bebanPenyusutan ?? 0;

  // pendapatanFaktur: first revenue item (typically "Pendapatan Jasa/Faktur"), fallback to 0
  const pendapatanFaktur = pendapatanList.length > 0 ? pendapatanList[0].total : 0;

  return {
    pendapatanList,
    bebanList,
    totalPendapatan: raw.totalPendapatan,
    totalBeban: raw.totalBeban,
    totalPendapatanFmt: formatRupiah(raw.totalPendapatan),
    totalBebanFmt: formatRupiah(raw.totalBeban),
    labaBersih: raw.labaBersih,
    labaBersihFmt: formatRupiah(Math.abs(raw.labaBersih)),
    labaBersihPositive: raw.labaBersih >= 0,
    penyusutanOtomatis,
    penyusutanOtomatisFmt: formatRupiah(penyusutanOtomatis),
    pendapatanFaktur,
    pendapatanFakturFmt: formatRupiah(pendapatanFaktur),
    version: (raw.version as ReportVersion) ?? (version as ReportVersion),
  };
}
