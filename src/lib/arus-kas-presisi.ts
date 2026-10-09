import { phpFetch, getPhpToken } from "./api-client";
import type { ReportVersion } from "./laba-rugi";

export interface ArusKasRow {
  label: string;
  amount: number;
  level: number; // 0 = section header/major subtotal, 1 = parent item, 2 = child item, 3 = detail sub-child
  isHeader?: boolean;
  isSubtotal?: boolean;
  isTotal?: boolean;
  code?: string;
}

export interface ArusKasPresisiData {
  entityName: string;
  year: number;
  version: ReportVersion;

  labaBersihSetelahPajak: number;
  penyusutanAsetTetap: number;
  amortisasiAset: number;
  cadanganCKPN: number;
  labaOperasiSetelahPenyesuaian: number;

  piutangUsaha: number;
  piutangKAK: number;
  piutangGS: number;
  piutangTB: number;
  piutangKP: number;
  piutangCAD: number;
  piutangLainnya: number;

  utangPajak: number;
  utangKAK: number;
  utangGS: number;
  utangTB: number;
  utangCAD: number;
  utangKP: number;
  titipan: number;
  utangImbalanPascaKerja: number;

  totalModalKerja: number;
  totalArusKasOperasi: number;

  perolehanAsetTetap: number;
  perolehanAsetTidakBerwujud: number;
  totalArusKasInvestasi: number;

  labaDitahan: number;
  totalArusKasPendanaan: number;

  kenaikanBersihKas: number;
  kasAwalPeriode: number;
  kasAkhirPeriode: number;

  rows: ArusKasRow[];
}

export function formatRupiahArusKas(val: number): string {
  if (val === 0 || Math.round(val) === 0) return "Rp -";
  const abs = Math.abs(Math.round(val)).toLocaleString("id-ID");
  return val < 0 ? `Rp (${abs})` : `Rp ${abs}`;
}

export async function getArusKasPresisiData(
  entityId: string | string[],
  year: number,
  version: ReportVersion = "INTERNAL"
): Promise<ArusKasPresisiData> {
  const token = await getPhpToken();
  const ids = Array.isArray(entityId) ? entityId : [entityId];
  const params = new URLSearchParams();
  ids.forEach((id) => params.append("entityId[]", id));
  params.set("year", String(year));
  params.set("version", version);
  params.set("mode", "presisi");

  return phpFetch<ArusKasPresisiData>(`/api/arus-kas?${params.toString()}`, token);
}
