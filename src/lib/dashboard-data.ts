import { prisma } from "./prisma";
import { Role } from "@prisma/client";

export function formatRupiah(n: number) {
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}

export async function getAccessibleEntities(entityKeys: string[]) {
  const [entities, txRows] = await Promise.all([
    prisma.entity.findMany({
      where: { key: { in: entityKeys } },
      include: { projects: { where: { status: "ACTIVE" }, include: { termin: true } } },
      orderBy: { createdAt: "asc" },
    }),
    // Revenue & spend dihitung dari transaksi aktual (COA kategori PENDAPATAN/BEBAN)
    // supaya Dashboard Manager konsisten dengan Laporan Keuangan Staff.
    prisma.transaction.findMany({
      where: {
        entity: { key: { in: entityKeys } },
        coaAccount: { kategori: { in: ["PENDAPATAN", "BEBAN"] } },
      },
      select: {
        entityId: true,
        kredit: true,
        debit: true,
        coaAccount: { select: { kategori: true } },
      },
    }),
  ]);

  const revenueMap = new Map<string, number>();
  const spendMap = new Map<string, number>();
  for (const tx of txRows) {
    if (tx.coaAccount?.kategori === "PENDAPATAN") {
      revenueMap.set(tx.entityId, (revenueMap.get(tx.entityId) ?? 0) + Number(tx.kredit));
    } else if (tx.coaAccount?.kategori === "BEBAN") {
      spendMap.set(tx.entityId, (spendMap.get(tx.entityId) ?? 0) + Number(tx.debit));
    }
  }

  return entities.map((e) => {
    const revenue = revenueMap.get(e.id) ?? 0;
    const spend = spendMap.get(e.id) ?? 0;
    return {
      id: e.id,
      key: e.key,
      name: e.name,
      legalName: e.legalName,
      colorHex: e.colorHex,
      isUmum: e.isUmum,
      revenue,
      spend,
      profit: revenue - spend,
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

// Warning piutang cuma muncul untuk proyek aktif yang progres pembayarannya
// masih di bawah 80% DAN sudah lewat batas kontrak (deadline) — proyek yang
// progresnya rendah tapi belum jatuh tempo tidak dianggap bermasalah.
export async function getGrupPiutangMetrics() {
  const projects = await prisma.project.findMany({
    where: { status: "ACTIVE" },
    select: {
      contractValue: true,
      deadline: true,
      termin: { select: { percentage: true } },
    },
  });

  const now = new Date();
  let terminPerluPerhatian = 0;
  let totalPiutangBelumTertagih = 0;

  for (const p of projects) {
    const maxPct = p.termin.reduce((max, t) => Math.max(max, t.percentage), 0);
    const isOverdue = p.deadline < now;
    if (maxPct < 80 && isOverdue) {
      terminPerluPerhatian += 1;
      totalPiutangBelumTertagih += Number(p.contractValue) * (1 - maxPct / 100);
    }
  }

  return { terminPerluPerhatian, totalPiutangBelumTertagih };
}

const BULAN = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];

export async function getMonthlyChartData(entityKeys: string[], year: number) {
  const start = new Date(`${year}-01-01`);
  const end = new Date(`${year + 1}-01-01`);

  const rows = await prisma.transaction.findMany({
    where: {
      entity: { key: { in: entityKeys } },
      tanggal: { gte: start, lt: end },
      coaAccount: { kategori: "PENDAPATAN" },
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
export async function getMonthlyByYear(entityIds: string[], years: number[]) {
  if (years.length === 0) return [];
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);

  const rows = await prisma.transaction.findMany({
    where: {
      entityId: { in: entityIds },
      tanggal: { gte: new Date(`${minYear}-01-01`), lt: new Date(`${maxYear + 1}-01-01`) },
      coaAccount: { kategori: "PENDAPATAN" },
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
  if (abs >= 1e12) return sign + "Rp " + (abs / 1e12).toFixed(1).replace(".", ",") + " T";
  if (abs >= 1e9) return sign + "Rp " + (abs / 1e9).toFixed(1).replace(".", ",") + " M";
  if (abs >= 1e6) return sign + "Rp " + (abs / 1e6).toFixed(1).replace(".", ",") + " JT";
  if (abs >= 1e3) return sign + "Rp " + (abs / 1e3).toFixed(1).replace(".", ",") + " rb";
  return formatRupiah(n);
}
