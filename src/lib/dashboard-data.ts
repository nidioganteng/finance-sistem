import { prisma } from "./prisma";
import { Role, type ReportCategory } from "@prisma/client";
import { calculateAsetDepreciation } from "./aset-tetap";
import { getExcludedNoBuktiForVersion } from "./akuntansi";

export function formatRupiah(n: number) {
  return "Rp\u00A0" + Math.round(n).toLocaleString("id-ID");
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

export async function getAccessibleEntities(
  entityKeys: string[],
  targetYear: number = new Date().getFullYear()
): Promise<AccessibleEntity[]> {
  const entities = await prisma.entity.findMany({
    where: { key: { in: entityKeys } },
    include: { projects: { where: { status: "ACTIVE" }, include: { termin: true } } },
    orderBy: { createdAt: "asc" },
  });

  const entityIds = entities.map((e) => e.id);
  const excludedNoBukti = await getExcludedNoBuktiForVersion(entityIds, targetYear, "INTERNAL");

  // Revenue & spend dihitung dari transaksi aktual (COA kategori PENDAPATAN/BEBAN)
  // disinkronkan dengan Modul Aktiva Tetap (Issue 39) dan dikunci ke Versi Internal (Issue 41) pada targetYear.
  const [txRows, assetsRaw, talanganKeluarTx, talanganMasukTx] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        entityId: { in: entityIds },
        tanggal: {
          gte: new Date(`${targetYear}-01-01`),
          lte: new Date(`${targetYear}-12-31T23:59:59`),
        },
        coaAccount: {
          kategori: { in: ["PENDAPATAN", "BEBAN"] },
          reportCategory: { in: ["INTERNAL", "SEMUA"] },
        },
        ...(excludedNoBukti.length > 0 ? { noBukti: { notIn: excludedNoBukti } } : {}),
      },
      select: {
        entityId: true,
        kredit: true,
        debit: true,
        coaAccount: { select: { kategori: true, code: true, name: true } },
      },
    }),
    prisma.asetTetap.findMany({
      where: { entityId: { in: entityIds } },
    }),
    // Mutasi kas keluar talangan / piutang afiliasi (kode akun 111-115) di targetYear
    prisma.transaction.findMany({
      where: {
        entityId: { in: entityIds },
        tanggal: {
          gte: new Date(`${targetYear}-01-01`),
          lte: new Date(`${targetYear}-12-31T23:59:59`),
        },
        coaAccount: { code: { in: ["111", "112", "113", "114", "115"] } },
        debit: { gt: 0 },
      },
      select: { entityId: true, debit: true, kredit: true },
    }),
    // Mutasi talangan masuk / hutang afiliasi (kode akun 311-315) di targetYear
    prisma.transaction.findMany({
      where: {
        entityId: { in: entityIds },
        tanggal: {
          gte: new Date(`${targetYear}-01-01`),
          lte: new Date(`${targetYear}-12-31T23:59:59`),
        },
        coaAccount: { code: { in: ["311", "312", "313", "314", "315"] } },
        kredit: { gt: 0 },
      },
      select: { entityId: true, debit: true, kredit: true },
    }),
  ]);

  const revenueMap = new Map<string, number>();
  const spendMap = new Map<string, number>();
  for (const tx of txRows) {
    if (tx.coaAccount?.kategori === "PENDAPATAN") {
      revenueMap.set(
        tx.entityId,
        (revenueMap.get(tx.entityId) ?? 0) + Number(tx.kredit) - Number(tx.debit)
      );
    } else if (tx.coaAccount?.kategori === "BEBAN") {
      const isDeprCoa =
        tx.coaAccount.code === "512" ||
        tx.coaAccount.code === "540" ||
        /penyusutan/i.test(tx.coaAccount.name);
      if (!isDeprCoa) {
        spendMap.set(
          tx.entityId,
          (spendMap.get(tx.entityId) ?? 0) + Number(tx.debit) - Number(tx.kredit)
        );
      }
    }
  }

  // Tambahkan beban penyusutan aset tetap per entitas untuk targetYear (Issue 39 & sinkronisasi Laba Rugi)
  for (const asset of assetsRaw) {
    const tgl = new Date(asset.tanggalPerolehan);
    const endDate = new Date(targetYear, 11, 31, 23, 59, 59);
    if (tgl <= endDate) {
      const dep = calculateAsetDepreciation(asset, targetYear);
      spendMap.set(asset.entityId, (spendMap.get(asset.entityId) ?? 0) + dep.bebanPeriodeIni);
    }
  }

  const talanganKeluarMap = new Map<string, number>();
  for (const t of talanganKeluarTx) {
    talanganKeluarMap.set(
      t.entityId,
      (talanganKeluarMap.get(t.entityId) ?? 0) + Number(t.debit) - Number(t.kredit)
    );
  }

  const talanganMasukMap = new Map<string, number>();
  for (const t of talanganMasukTx) {
    talanganMasukMap.set(
      t.entityId,
      (talanganMasukMap.get(t.entityId) ?? 0) + Number(t.kredit) - Number(t.debit)
    );
  }

  return entities.map((e) => {
    const revenue = revenueMap.get(e.id) ?? 0;
    const beban = spendMap.get(e.id) ?? 0;
    const talanganKeluar = Math.max(0, talanganKeluarMap.get(e.id) ?? 0);
    const talanganMasuk = Math.max(0, talanganMasukMap.get(e.id) ?? 0);
    // Spend di dashboard entitas mencakup beban operasional ditambah arus kas keluar talangan afiliasi
    const spend = beban + talanganKeluar;
    // Profit operasional entitas dihitung dari pendapatan dikurangi beban operasional
    // (talangan keluar adalah piutang/aset yang akan kembali, bukan kerugian operasional)
    const profit = revenue - beban;
    return {
      id: e.id,
      key: e.key,
      name: e.name,
      legalName: e.legalName,
      colorHex: e.colorHex,
      isUmum: e.isUmum,
      revenue,
      beban,
      spend,
      profit,
      talanganKeluar,
      talanganMasuk,
      projects: e.projects.map((p) => ({
        code: p.code,
        name: p.name,
        contractValue: Number(p.contractValue),
        spend: Number(p.spend),
        profit: Number(p.contractValue) - Number(p.spend),
        termin: p.termin.map((t) => ({ name: t.name, percentage: t.percentage, status: t.status })),
      })),
    };
  });
}

export async function getUnreadNotificationCount(role: Role) {
  return prisma.notifikasi.count({ where: { targetRole: role, read: false } });
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

// Warning termin cuma muncul untuk proyek aktif yang progres pembayarannya
// masih di bawah 80% DAN sudah lewat batas kontrak (deadline)
export async function getGrupPiutangMetrics(entityKeys?: string[]): Promise<PiutangMetricsResult> {
  const whereClause: { status: "ACTIVE"; entity?: { key: { in: string[] } } } = { status: "ACTIVE" };
  if (entityKeys && entityKeys.length > 0) {
    whereClause.entity = { key: { in: entityKeys } };
  }

  const projects = await prisma.project.findMany({
    where: whereClause,
    select: {
      id: true,
      code: true,
      name: true,
      contractValue: true,
      deadline: true,
      entity: { select: { key: true, name: true } },
      termin: { select: { percentage: true } },
    },
  });

  const now = new Date();
  let terminPerluPerhatian = 0;
  let totalPiutangBelumTertagih = 0;
  const overdueProjects: OverdueProjectAlert[] = [];

  for (const p of projects) {
    const maxPct = p.termin.reduce((max, t) => Math.max(max, t.percentage), 0);
    const isOverdue = p.deadline < now;
    if (maxPct < 80 && isOverdue) {
      terminPerluPerhatian += 1;
      const val = Number(p.contractValue);
      const sisa = val * (1 - maxPct / 100);
      const cair = val * (maxPct / 100);
      totalPiutangBelumTertagih += sisa;
      const daysOverdue = Math.max(1, Math.floor((now.getTime() - p.deadline.getTime()) / (1000 * 60 * 60 * 24)));
      overdueProjects.push({
        id: p.id,
        code: p.code,
        name: p.name,
        entityKey: p.entity.key,
        entityName: p.entity.name,
        contractValue: val,
        contractValueFmt: formatRupiah(val),
        deadline: p.deadline,
        deadlineFmt: p.deadline.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }),
        daysOverdue,
        maxPercentage: maxPct,
        terminTagih: cair,
        terminTagihFmt: formatRupiah(cair),
        sisaPiutang: sisa,
        sisaPiutangFmt: formatRupiah(sisa),
      });
    }
  }

  overdueProjects.sort((a, b) => b.daysOverdue - a.daysOverdue);

  return { terminPerluPerhatian, totalPiutangBelumTertagih, overdueProjects };
}

const BULAN = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];

export async function getMonthlyChartData(entityKeys: string[], year: number, version: string = "INTERNAL") {
  const start = new Date(`${year}-01-01`);
  const end = new Date(`${year + 1}-01-01`);
  const allowedCategories: ReportCategory[] =
    version.toUpperCase() === "UMUM" ? ["UMUM", "SEMUA"] : ["INTERNAL", "SEMUA"];

  const rows = await prisma.transaction.findMany({
    where: {
      entity: { key: { in: entityKeys } },
      tanggal: { gte: start, lt: end },
      coaAccount: {
        kategori: "PENDAPATAN",
        reportCategory: { in: allowedCategories },
      },
    },
    select: {
      tanggal: true,
      kredit: true,
      entity: { select: { key: true } },
    },
  });

  return BULAN.map((month, i) => {
    const entry: Record<string, string | number> = { month };
    for (const key of entityKeys) {
      entry[key] = rows
        .filter((r) => r.entity.key === key && new Date(r.tanggal).getMonth() === i)
        .reduce((s, r) => s + Number(r.kredit), 0);
    }
    return entry;
  });
}

// Pendapatan bulanan satu (atau beberapa) entitas, dipecah per TAHUN alih-alih
// per entitas — dipakai chart komparasi antar-tahun saat cuma 1 entitas yang
// dipilih (warna chart jadi merepresentasikan tahun, bukan entitas).
export async function getMonthlyByYear(entityIds: string[], years: number[], version: string = "INTERNAL") {
  if (years.length === 0) return [];
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  const allowedCategories: ReportCategory[] =
    version.toUpperCase() === "UMUM" ? ["UMUM", "SEMUA"] : ["INTERNAL", "SEMUA"];

  const rows = await prisma.transaction.findMany({
    where: {
      entityId: { in: entityIds },
      tanggal: { gte: new Date(`${minYear}-01-01`), lt: new Date(`${maxYear + 1}-01-01`) },
      coaAccount: {
        kategori: "PENDAPATAN",
        reportCategory: { in: allowedCategories },
      },
    },
    select: { tanggal: true, kredit: true },
  });

  return BULAN.map((month, i) => {
    const entry: Record<string, string | number> = { month };
    for (const y of years) {
      entry[String(y)] = rows
        .filter((r) => {
          const d = new Date(r.tanggal);
          return d.getFullYear() === y && d.getMonth() === i;
        })
        .reduce((s, r) => s + Number(r.kredit), 0);
    }
    return entry;
  });
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
