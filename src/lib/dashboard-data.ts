import { phpFetch, getPhpToken } from "./api-client";
import { Role } from "@prisma/client";

export function formatRupiah(n: number) {
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}

export function getMetricValueFontSize(str?: string | number): string {
  const text = typeof str === "number" ? str.toString() : (str ?? "");
  const len = text.length;
  if (len >= 22) return "text-[14.5px] sm:text-[16px] xl:text-[16.5px] 2xl:text-[19px] font-extrabold tabular-nums tracking-tight";
  if (len >= 18) return "text-[15.5px] sm:text-[17px] xl:text-[17.5px] 2xl:text-[20px] font-extrabold tabular-nums tracking-tight";
  if (len >= 14) return "text-[17px] sm:text-[18.5px] xl:text-[19px] 2xl:text-[21px] font-extrabold tabular-nums tracking-tight";
  return "text-[19px] sm:text-[21px] xl:text-[21px] 2xl:text-[22px] font-extrabold tabular-nums";
}

export interface AccessibleEntity {
  id: string;
  key: string;
  name: string;
  legalName: string;
  colorHex: string;
  isUmum: boolean;
  revenue: number;
  beban?: number;
  spend: number;
  profit: number;
  talanganKeluar?: number;
  talanganMasuk?: number;
  projects: {
    code: string;
    name: string;
    contractValue: number;
    spend: number;
    profit: number;
    termin: {
      name: string;
      percentage: number;
      status: string;
    }[];
  }[];
}

type RawEntityFromPhp = {
  id: string;
  key: string;
  name: string;
  legalName: string;
  colorHex: string;
  isUmum: boolean;
  revenue: number;
  beban: number;
  laba: number;
};

export async function getAccessibleEntities(
  entityKeys: string[],
  targetYear: number = new Date().getFullYear()
): Promise<AccessibleEntity[]> {
  const token = await getPhpToken();
  const params = new URLSearchParams();
  entityKeys.forEach((k) => params.append("entityKeys[]", k));
  params.set("year", String(targetYear));
  const result = await phpFetch<{ data: { entities: RawEntityFromPhp[] } }>(
    `/api/dashboard?${params.toString()}`,
    token
  );
  return result.data.entities.map((e) => ({
    id: e.id,
    key: e.key,
    name: e.name,
    legalName: e.legalName,
    colorHex: e.colorHex,
    isUmum: e.isUmum,
    revenue: e.revenue,
    beban: e.beban,
    // PHP returns beban (operational expenses) and laba (profit)
    spend: e.beban,
    profit: e.laba,
    talanganKeluar: 0,
    talanganMasuk: 0,
    projects: [],
  }));
}

export async function getUnreadNotificationCount(role: Role): Promise<number> {
  const token = await getPhpToken();
  // PHP GET /api/notifikasi/count?role=<ROLE> returns { count: number }
  const result = await phpFetch<{ count: number }>(
    `/api/notifikasi/count?role=${encodeURIComponent(role)}`,
    token
  );
  return result.count;
}

export type OverdueProjectAlert = {
  id: string;
  code: string;
  name: string;
  entityKey: string;
  entityName: string;
  contractValue: number;
  contractValueFmt: string;
  deadline: Date;
  deadlineFmt: string;
  daysOverdue: number;
  maxPercentage: number;
  terminTagih: number;
  terminTagihFmt: string;
  sisaPiutang: number;
  sisaPiutangFmt: string;
};

export type PiutangMetricsResult = {
  terminPerluPerhatian: number;
  totalPiutangBelumTertagih: number;
  overdueProjects: OverdueProjectAlert[];
};

export async function getGrupPiutangMetrics(entityKeys?: string[]): Promise<PiutangMetricsResult> {
  const token = await getPhpToken();
  const params = new URLSearchParams();
  if (entityKeys && entityKeys.length > 0) {
    entityKeys.forEach((k) => params.append("entityKeys[]", k));
  }
  return phpFetch<PiutangMetricsResult>(
    `/api/piutang/metrics?${params.toString()}`,
    token
  );
}

export async function getMonthlyChartData(entityKeys: string[], year: number, version: string = "INTERNAL") {
  const token = await getPhpToken();
  const params = new URLSearchParams();
  entityKeys.forEach((k) => params.append("entityKeys[]", k));
  params.set("year", String(year));
  params.set("version", version);
  return phpFetch<Record<string, string | number>[]>(
    `/api/dashboard/chart?${params.toString()}`,
    token
  );
}

export async function getMonthlyByYear(entityIds: string[], years: number[], version: string = "INTERNAL") {
  if (years.length === 0) return [];
  const token = await getPhpToken();
  const params = new URLSearchParams();
  entityIds.forEach((id) => params.append("entityIds[]", id));
  years.forEach((y) => params.append("years[]", String(y)));
  params.set("version", version);
  return phpFetch<Record<string, string | number>[]>(
    `/api/dashboard/chart-by-year?${params.toString()}`,
    token
  );
}

export function formatMiliar(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  const formatNum = (val: number, maxDec: number = 2) => {
    const factor = Math.pow(10, maxDec);
    const truncated = Math.floor(val * factor + 1e-9) / factor;
    return truncated.toLocaleString("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: maxDec });
  };

  if (abs >= 1e12) return `${sign}Rp ${formatNum(abs / 1e12, 2)} T`;
  if (abs >= 1e9) return `${sign}Rp ${formatNum(abs / 1e9, 2)} M`;
  if (abs >= 1e6) return `${sign}Rp ${formatNum(abs / 1e6, 1)} JT`;
  if (abs >= 1e3) return `${sign}Rp ${formatNum(abs / 1e3, 1)} rb`;
  return formatRupiah(n);
}
