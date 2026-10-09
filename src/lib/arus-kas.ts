import { phpFetch, getPhpToken } from "./api-client";
import { formatRupiah } from "./dashboard-data";

export type ReportVersion = "INTERNAL" | "UMUM";

export type ArusKasMonthly = {
  bulan: string;
  masuk: number;
  keluar: number;
  net: number;
  masukFmt: string;
  keluarFmt: string;
  netFmt: string;
  netPositive: boolean;
  hasData: boolean;
};

export type ArusKasData = {
  monthly: ArusKasMonthly[];
  totalMasuk: number;
  totalKeluar: number;
  netTotal: number;
  totalMasukFmt: string;
  totalKeluarFmt: string;
  netTotalFmt: string;
  netTotalPositive: boolean;
  version: ReportVersion;
};

// PHP monthly item: { bulan, namaBulan, masuk, keluar, neto }
type PhpMonthly = {
  bulan: number;
  namaBulan: string;
  masuk: number;
  keluar: number;
  neto: number;
};

// PHP response: { entityId, year, monthly, totalMasuk, totalKeluar, totalNeto }
type PhpArusKasResponse = {
  entityId: string;
  year: number;
  monthly: PhpMonthly[];
  totalMasuk: number;
  totalKeluar: number;
  totalNeto: number;
};

export async function getArusKasData(
  entityId: string,
  year: number,
  version: ReportVersion | string = "INTERNAL"
): Promise<ArusKasData> {
  const token = await getPhpToken();
  // version is sent but PHP currently ignores it (harmless, future-proof)
  const raw = await phpFetch<PhpArusKasResponse>(
    `/api/arus-kas?entityId=${encodeURIComponent(entityId)}&year=${year}&version=${encodeURIComponent(version)}`,
    token
  );

  const monthly: ArusKasMonthly[] = raw.monthly.map((m) => {
    const net = m.neto;
    const hasData = m.masuk > 0 || m.keluar > 0;
    return {
      bulan: m.namaBulan,
      masuk: m.masuk,
      keluar: m.keluar,
      net,
      masukFmt: hasData && m.masuk > 0 ? formatRupiah(m.masuk) : "-",
      keluarFmt: hasData && m.keluar > 0 ? formatRupiah(m.keluar) : "-",
      netFmt: formatRupiah(Math.abs(net)),
      netPositive: net >= 0,
      hasData,
    };
  });

  const totalMasuk = raw.totalMasuk;
  const totalKeluar = raw.totalKeluar;
  const netTotal = raw.totalNeto;

  return {
    monthly,
    totalMasuk,
    totalKeluar,
    netTotal,
    totalMasukFmt: formatRupiah(totalMasuk),
    totalKeluarFmt: formatRupiah(totalKeluar),
    netTotalFmt: formatRupiah(Math.abs(netTotal)),
    netTotalPositive: netTotal >= 0,
    version: version as ReportVersion,
  };
}
