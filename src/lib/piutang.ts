import { prisma } from "./prisma";
import { formatRupiah } from "./dashboard-data";

// ── Piutang/Hutang antar entitas ───────────────────────────────────────────
// COA 111-115 = piutang ke counterparty tertentu; 311-315 = hutang ke counterparty
const PIUTANG_CODE_TO_ENTITY: Record<string, string> = {
  "111": "kencana",
  "112": "gaharu",
  "113": "tataring",
  "114": "ciptaAsri",
  "115": "umum",
};
const HUTANG_CODE_TO_ENTITY: Record<string, string> = {
  "311": "kencana",
  "312": "gaharu",
  "313": "tataring",
  "314": "ciptaAsri",
  "315": "umum",
};
export const PIUTANG_COA: Record<string, string> = {
  kencana: "111", gaharu: "112", tataring: "113", ciptaAsri: "114", umum: "115",
};
export const HUTANG_COA: Record<string, string> = {
  kencana: "311", gaharu: "312", tataring: "313", ciptaAsri: "314", umum: "315",
};

export type InterEntityBalance = {
  type: "piutang" | "hutang";
  coaCode: string;
  coaId: string;
  counterpartyEntityKey: string;
  counterpartyEntityName: string;
  netAmount: number;
  netAmountFmt: string;
};

export async function getInterEntityBalances(entityId: string): Promise<InterEntityBalance[]> {
  // Collect all relevant COA codes: piutang (111-115) + hutang (311-315)
  const piutangCodes = Object.keys(PIUTANG_CODE_TO_ENTITY);
  const hutangCodes = Object.keys(HUTANG_CODE_TO_ENTITY);
  const allCodes = [...piutangCodes, ...hutangCodes];

  const coaAccounts = await prisma.coaAccount.findMany({
    where: { code: { in: allCodes } },
    select: { id: true, code: true },
  });

  const coaByCode = new Map(coaAccounts.map((c) => [c.code, c]));

  // Sum debit/kredit per COA for this entity
  const totals = await prisma.transaction.groupBy({
    by: ["coaAccountId"],
    where: {
      entityId,
      coaAccountId: { in: coaAccounts.map((c) => c.id) },
    },
    _sum: { debit: true, kredit: true },
  });

  const coaIdToCode = new Map(coaAccounts.map((c) => [c.id, c.code]));

  // Fetch entity names for display
  const allEntityKeys = [
    ...Object.values(PIUTANG_CODE_TO_ENTITY),
    ...Object.values(HUTANG_CODE_TO_ENTITY),
  ];
  const uniqueKeys = [...new Set(allEntityKeys)];
  const entities = await prisma.entity.findMany({
    where: { key: { in: uniqueKeys } },
    select: { key: true, name: true },
  });
  const entityNameByKey = new Map(entities.map((e) => [e.key, e.name]));

  const balances: InterEntityBalance[] = [];

  for (const row of totals) {
    if (!row.coaAccountId) continue;
    const code = coaIdToCode.get(row.coaAccountId);
    if (!code) continue;
    const sumDebit = Number(row._sum.debit ?? 0);
    const sumKredit = Number(row._sum.kredit ?? 0);

    const isPiutang = piutangCodes.includes(code);
    const isHutang = hutangCodes.includes(code);
    if (!isPiutang && !isHutang) continue;

    // Piutang: net = debit - kredit (positive = outstanding receivable)
    // Hutang: net = kredit - debit (positive = outstanding payable)
    const netAmount = isPiutang ? sumDebit - sumKredit : sumKredit - sumDebit;
    if (netAmount === 0) continue;

    const counterpartyKey = isPiutang
      ? PIUTANG_CODE_TO_ENTITY[code]
      : HUTANG_CODE_TO_ENTITY[code];

    const coa = coaByCode.get(code);
    if (!coa) continue;

    balances.push({
      type: isPiutang ? "piutang" : "hutang",
      coaCode: code,
      coaId: coa.id,
      counterpartyEntityKey: counterpartyKey,
      counterpartyEntityName: entityNameByKey.get(counterpartyKey) ?? counterpartyKey,
      netAmount,
      netAmountFmt: formatRupiah(Math.abs(netAmount)),
    });
  }

  // Sort: piutang first, then hutang; each group by net amount descending
  balances.sort((a, b) => {
    if (a.type !== b.type) return a.type === "piutang" ? -1 : 1;
    return b.netAmount - a.netAmount;
  });

  return balances;
}

// Daftar proyek satu entitas buat dropdown "Proyek Terkait" di form transaksi
// Kas/Buku Bank — dipakai staf/manajer keuangan pas mencatat uang masuk yang
// sekalian jadi pembayaran termin proyek tertentu.
export async function getProjectOptions(currentEntityId?: string) {
  const projects = await prisma.project.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      code: true,
      name: true,
      entityId: true,
      entity: { select: { id: true, key: true, name: true } },
      contractValue: true,
      termin: {
        select: { id: true, name: true, percentage: true, nominal: true },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  const mapped = projects.map((p) => {
    const contractValueNum = Number(p.contractValue);
    const sumNominal = p.termin.reduce((sum, t, i) => {
      const prevPct = i === 0 ? 0 : p.termin[i - 1].percentage;
      const nom = t.nominal && Number(t.nominal) > 0
        ? Number(t.nominal)
        : ((t.percentage - prevPct) / 100) * contractValueNum;
      return sum + nom;
    }, 0);
    const maxPct = contractValueNum > 0
      ? Math.min(100, Math.round((sumNominal / contractValueNum) * 100))
      : p.termin.reduce((max, t) => Math.max(max, t.percentage), 0);
    return {
      id: p.id,
      code: p.code,
      name: p.name,
      entityId: p.entityId,
      entityKey: p.entity.key,
      entityName: p.entity.name,
      contractValue: contractValueNum,
      contractValueFmt: formatRupiah(contractValueNum),
      maxPercentage: maxPct,
      terminCount: p.termin.length,
      totalTerminTagih: sumNominal,
    };
  });

  if (currentEntityId) {
    mapped.sort((a, b) => {
      const aCurrent = a.entityId === currentEntityId;
      const bCurrent = b.entityId === currentEntityId;
      if (aCurrent && !bCurrent) return -1;
      if (!aCurrent && bCurrent) return 1;
      return a.code.localeCompare(b.code);
    });
  } else {
    mapped.sort((a, b) => a.code.localeCompare(b.code));
  }

  return mapped;
}

// Persentase termin baru dihitung dari akumulasi uang masuk (termin-termin
// sebelumnya + pembayaran baru ini) dibanding nilai kontrak — bukan input
// manual. Dipakai saat mencatat transaksi "uang masuk" yang terkait proyek.
export function computeNewTerminPercentage(
  contractValue: number,
  existingTerminPercentages: number[],
  nominalMasuk: number,
  existingCumulativeNominal?: number
): number {
  if (contractValue <= 0) return 0;
  const cumulativeBefore =
    existingCumulativeNominal !== undefined && existingCumulativeNominal > 0
      ? existingCumulativeNominal
      : (existingTerminPercentages.reduce((max, p) => Math.max(max, p), 0) / 100) * contractValue;
  const cumulativeAfter = cumulativeBefore + nominalMasuk;
  return Math.min(100, Math.round((cumulativeAfter / contractValue) * 100));
}

export async function getPiutangData(entityId: string) {
  const [projects, loadingDockList] = await Promise.all([
    prisma.project.findMany({
      where: { entityId, status: { in: ["ACTIVE", "CANCELLED", "COMPLETED"] } },
      include: {
        termin: {
          include: { auditedBy: { select: { name: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.loadingDockTransaksi.findMany({
      where: { entityId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const now = new Date();
  let totalKontrak = 0;
  let totalTerminTagih = 0;

  const projectList = projects.map((p) => {
    const contractValue = Number(p.contractValue);
    const isCancelled = p.status === "CANCELLED";
    const isCompleted = p.status === "COMPLETED";

    const terminItems = p.termin.map((t, i) => {
      const prevPct = i === 0 ? 0 : p.termin[i - 1].percentage;
      const deltaPct = Math.max(0, t.percentage - prevPct);
      const nominalTermin =
        t.nominal && Number(t.nominal) > 0
          ? Number(t.nominal)
          : ((t.percentage - prevPct) / 100) * contractValue;
      return {
        id: t.id,
        name: t.name,
        percentage: t.percentage,
        percentageDelta: deltaPct,
        nominal: nominalTermin,
        nominalFmt: formatRupiah(nominalTermin),
        status: t.status,
        auditedAt: t.auditedAt ? t.auditedAt.toLocaleDateString("id-ID") : null,
        auditedByName: t.auditedBy?.name ?? null,
      };
    });

    const sumNominalTermin = terminItems.reduce((sum, t) => sum + t.nominal, 0);
    const maxPct = isCompleted
      ? 100
      : (contractValue > 0 ? Math.min(100, Math.round((sumNominalTermin / contractValue) * 100)) : 0);
    const terminTagih = isCompleted ? contractValue : sumNominalTermin;
    const sisaTagih = isCancelled ? 0 : Math.max(0, contractValue - terminTagih);

    // "Total Nilai Kontrak Aktif" cuma menjumlah proyek yang masih aktif
    if (!isCancelled && !isCompleted) {
      totalKontrak += contractValue;
      totalTerminTagih += terminTagih;
    }

    return {
      id: p.id,
      code: p.code,
      name: p.name,
      contractValue,
      contractValueFmt: formatRupiah(contractValue),
      deadlineFmt: p.deadline.toLocaleDateString("id-ID"),
      isOverdue: !isCancelled && !isCompleted && maxPct < 80 && p.deadline < now,
      status: p.status,
      maxPercentage: maxPct,
      terminTagih,
      terminTagihFmt: formatRupiah(terminTagih),
      sisaTagih,
      sisaTagihFmt: formatRupiah(sisaTagih),
      termin: terminItems,
    };
  });

  const sisaPiutang = totalKontrak - totalTerminTagih;

  return {
    projectList,
    summary: {
      totalKontrak,
      totalKontrakFmt: formatRupiah(totalKontrak),
      totalTerminTagih,
      totalTerminTagihFmt: formatRupiah(totalTerminTagih),
      sisaPiutang,
      sisaPiutangFmt: formatRupiah(Math.abs(sisaPiutang)),
      jumlahProyek: projects.filter((p) => p.status !== "CANCELLED").length,
    },
    loadingDockList: loadingDockList.map((d) => ({
      id: d.id,
      nama: d.nama,
      totalFmt: formatRupiah(Number(d.total)),
      status: d.status,
      createdAt: d.createdAt.toLocaleDateString("id-ID"),
    })),
  };
}
