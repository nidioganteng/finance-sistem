import { prisma } from "./prisma";

export interface CounterpartyConfig {
  key: string;
  shortName: string;
  fullName: string;
  piutangCode: string;
  hutangCode: string;
}

export const COUNTERPARTIES: CounterpartyConfig[] = [
  { key: "kencana", shortName: "KAK", fullName: "Kencana", piutangCode: "111", hutangCode: "311" },
  { key: "gaharu", shortName: "GS", fullName: "Gaharu", piutangCode: "112", hutangCode: "312" },
  { key: "tataring", shortName: "TB", fullName: "Tataring", piutangCode: "113", hutangCode: "313" },
  { key: "ciptaAsri", shortName: "CAD", fullName: "Cipta Asri", piutangCode: "114", hutangCode: "314" },
  { key: "umum", shortName: "KP", fullName: "Kardi Pratama", piutangCode: "115", hutangCode: "315" },
];

export function formatAccountingRupiah(n: number): string {
  if (n === 0) return "Rp -";
  const abs = Math.round(Math.abs(n)).toLocaleString("id-ID");
  if (n < 0) return `Rp (${abs})`;
  return `Rp ${abs}`;
}

export function formatStandardRupiah(n: number): string {
  return "Rp\u00A0" + Math.round(n).toLocaleString("id-ID");
}

export interface RekapHutangRow {
  counterpartyKey: string;
  shortName: string;
  fullName: string;
  code: string;
  accountName: string;
  hutangLalu: number;
  hutangLaluFmt: string;
  hutangTahunIni: number;
  hutangTahunIniFmt: string;
  totalHutang: number;
  totalHutangFmt: string;
}

export interface RekapPiutangRow {
  counterpartyKey: string;
  shortName: string;
  fullName: string;
  code: string;
  accountName: string;
  piutang: number;
  piutangFmt: string;
}

export interface NettingRow {
  counterpartyKey: string;
  shortName: string;
  fullName: string;
  status: "UTANG" | "PIUTANG" | "NIHIL";
  piutang: number;
  piutangFmt: string;
  hutang: number;
  hutangFmt: string;
  net: number;
  netFmt: string;
  isUtang: boolean;
}

export interface MutasiAfiliasiTx {
  id: string;
  tanggal: string;
  noBukti: string;
  keterangan: string;
  counterpartyName: string;
  accountType: "PIUTANG" | "HUTANG";
  coaCode: string;
  coaName: string;
  debit: number;
  kredit: number;
  debitFmt: string;
  kreditFmt: string;
}

export interface LaporanHutangPiutangEntityData {
  entity: { id: string; key: string; name: string };
  year: number;
  rekapHutang: {
    rows: RekapHutangRow[];
    totalHutangLalu: number;
    totalHutangLaluFmt: string;
    totalHutangTahunIni: number;
    totalHutangTahunIniFmt: string;
    totalHutang: number;
    totalHutangFmt: string;
  };
  rekapPiutang: {
    rows: RekapPiutangRow[];
    totalPiutang: number;
    totalPiutangFmt: string;
  };
  netting: {
    rows: NettingRow[];
    totalNetPiutang: number;
    totalNetUtang: number;
    posisiBersihGlobal: number;
    posisiBersihGlobalFmt: string;
    statusGlobal: "PIUTANG" | "UTANG" | "NIHIL";
  };
  transactions: MutasiAfiliasiTx[];
}

export interface InterEntityMatrixCell {
  piutang: number;
  hutang: number;
  net: number;
}

export interface ReconciliationPair {
  entityA: { key: string; name: string; shortName: string };
  entityB: { key: string; name: string; shortName: string };
  piutangAB: number;
  hutangBA: number;
  diffAB: number;
  isMatchAB: boolean;
  hutangAB: number;
  piutangBA: number;
  diffBA: number;
  isMatchBA: boolean;
}

export interface LaporanHutangPiutangGrupData {
  year: number;
  entities: { id: string; key: string; name: string; shortName: string }[];
  matrix: Record<string, Record<string, InterEntityMatrixCell>>;
  totalsByEntity: Record<
    string,
    { totalPiutang: number; totalHutang: number; net: number; status: "PIUTANG" | "UTANG" | "NIHIL" }
  >;
  grandTotalPiutang: number;
  grandTotalHutang: number;
  reconciliations: ReconciliationPair[];
}

export async function getLaporanHutangPiutangEntityData(
  entityId: string,
  year: number
): Promise<LaporanHutangPiutangEntityData | null> {
  const entity = await prisma.entity.findUnique({
    where: { id: entityId },
    select: { id: true, key: true, name: true },
  });

  if (!entity) return null;

  const startYear = new Date(year, 0, 1);
  const endYear = new Date(year + 1, 0, 1);

  // Counterparty excludes self
  const counterparties = COUNTERPARTIES.filter((c) => c.key !== entity.key);

  // Collect all coa codes needed
  const hutangCodes = counterparties.map((c) => c.hutangCode);
  const piutangCodes = counterparties.map((c) => c.piutangCode);
  const allCodes = [...hutangCodes, ...piutangCodes];

  const coaAccounts = await prisma.coaAccount.findMany({
    where: { code: { in: allCodes } },
  });
  const coaMap = new Map(coaAccounts.map((c) => [c.code, c]));

  // Fetch Saldo Awal for this entity & year
  const saldoAwalRows = await prisma.saldoAwal.findMany({
    where: {
      entityId,
      year,
      coaAccountId: { in: coaAccounts.map((c) => c.id) },
    },
  });
  const saldoAwalMap = new Map(saldoAwalRows.map((s) => [s.coaAccountId, Number(s.nominal)]));

  // Transactions in current year
  const txCurrentYear = await prisma.transaction.groupBy({
    by: ["coaAccountId"],
    where: {
      entityId,
      coaAccountId: { in: coaAccounts.map((c) => c.id) },
      tanggal: { gte: startYear, lt: endYear },
    },
    _sum: { debit: true, kredit: true },
  });
  const txCurrentMap = new Map(
    txCurrentYear.map((t) => [
      t.coaAccountId,
      { debit: Number(t._sum.debit ?? 0), kredit: Number(t._sum.kredit ?? 0) },
    ])
  );

  // Transactions before current year (used if Saldo Awal not explicitly recorded)
  const txBeforeYear = await prisma.transaction.groupBy({
    by: ["coaAccountId"],
    where: {
      entityId,
      coaAccountId: { in: coaAccounts.map((c) => c.id) },
      tanggal: { lt: startYear },
    },
    _sum: { debit: true, kredit: true },
  });
  const txBeforeMap = new Map(
    txBeforeYear.map((t) => [
      t.coaAccountId,
      { debit: Number(t._sum.debit ?? 0), kredit: Number(t._sum.kredit ?? 0) },
    ])
  );

  // Build Rekap Hutang Rows
  const hutangRows: RekapHutangRow[] = [];
  let sumHutangLalu = 0;
  let sumHutangTahunIni = 0;
  let sumTotalHutang = 0;

  for (const cp of counterparties) {
    const coa = coaMap.get(cp.hutangCode);
    const coaId = coa?.id;
    let hutangLalu = 0;
    let hutangTahunIni = 0;

    if (coaId) {
      if (saldoAwalMap.has(coaId)) {
        hutangLalu = saldoAwalMap.get(coaId) ?? 0;
      } else {
        const prev = txBeforeMap.get(coaId) ?? { debit: 0, kredit: 0 };
        hutangLalu = prev.kredit - prev.debit;
      }

      const cur = txCurrentMap.get(coaId) ?? { debit: 0, kredit: 0 };
      // Kredit menambah hutang, debit mengurangi/membayar hutang
      hutangTahunIni = cur.kredit - cur.debit;
    }

    const totalHutang = hutangLalu + hutangTahunIni;

    sumHutangLalu += hutangLalu;
    sumHutangTahunIni += hutangTahunIni;
    sumTotalHutang += totalHutang;

    hutangRows.push({
      counterpartyKey: cp.key,
      shortName: cp.shortName,
      fullName: cp.fullName,
      code: cp.hutangCode,
      accountName: coa?.name ?? `Hutang ${cp.shortName}`,
      hutangLalu,
      hutangLaluFmt: formatAccountingRupiah(hutangLalu),
      hutangTahunIni,
      hutangTahunIniFmt: formatAccountingRupiah(hutangTahunIni),
      totalHutang,
      totalHutangFmt: formatAccountingRupiah(totalHutang),
    });
  }

  // Build Rekap Piutang Rows
  const piutangRows: RekapPiutangRow[] = [];
  let sumTotalPiutang = 0;

  for (const cp of counterparties) {
    const coa = coaMap.get(cp.piutangCode);
    const coaId = coa?.id;
    let piutangAwal = 0;
    let piutangTahunIni = 0;

    if (coaId) {
      if (saldoAwalMap.has(coaId)) {
        piutangAwal = saldoAwalMap.get(coaId) ?? 0;
      } else {
        const prev = txBeforeMap.get(coaId) ?? { debit: 0, kredit: 0 };
        piutangAwal = prev.debit - prev.kredit;
      }

      const cur = txCurrentMap.get(coaId) ?? { debit: 0, kredit: 0 };
      // Debit menambah piutang, kredit mengurangi piutang
      piutangTahunIni = cur.debit - cur.kredit;
    }

    const totalPiutang = piutangAwal + piutangTahunIni;
    sumTotalPiutang += totalPiutang;

    piutangRows.push({
      counterpartyKey: cp.key,
      shortName: cp.shortName,
      fullName: cp.fullName,
      code: cp.piutangCode,
      accountName: coa?.name ?? `PIUTANG ${cp.shortName}`,
      piutang: totalPiutang,
      piutangFmt: formatAccountingRupiah(totalPiutang),
    });
  }

  // Build Netting Rows
  const nettingRows: NettingRow[] = [];
  let totalNetPiutang = 0;
  let totalNetUtang = 0;

  for (let i = 0; i < counterparties.length; i++) {
    const cp = counterparties[i];
    const hRow = hutangRows[i];
    const pRow = piutangRows[i];

    const piutang = pRow.piutang;
    const hutang = hRow.totalHutang;
    const net = piutang - hutang;

    let status: "UTANG" | "PIUTANG" | "NIHIL" = "NIHIL";
    if (net > 0) {
      status = "PIUTANG";
      totalNetPiutang += net;
    } else if (net < 0) {
      status = "UTANG";
      totalNetUtang += Math.abs(net);
    }

    nettingRows.push({
      counterpartyKey: cp.key,
      shortName: cp.shortName,
      fullName: cp.fullName,
      status,
      piutang,
      piutangFmt: formatAccountingRupiah(piutang),
      hutang,
      hutangFmt: formatAccountingRupiah(hutang),
      net,
      netFmt: formatAccountingRupiah(net),
      isUtang: net < 0,
    });
  }

  const posisiBersihGlobal = sumTotalPiutang - sumTotalHutang;
  const statusGlobal: "PIUTANG" | "UTANG" | "NIHIL" =
    posisiBersihGlobal > 0 ? "PIUTANG" : posisiBersihGlobal < 0 ? "UTANG" : "NIHIL";

  // Detailed recent transactions for inter-entity accounts
  const rawTx = await prisma.transaction.findMany({
    where: {
      entityId,
      coaAccountId: { in: coaAccounts.map((c) => c.id) },
      tanggal: { gte: startYear, lt: endYear },
    },
    include: { coaAccount: true },
    orderBy: { tanggal: "desc" },
    take: 50,
  });

  const transactions: MutasiAfiliasiTx[] = rawTx.map((t) => {
    const coaCode = t.coaAccount?.code ?? "";
    const isHutang = hutangCodes.includes(coaCode);
    const cp = counterparties.find((c) => (isHutang ? c.hutangCode === coaCode : c.piutangCode === coaCode));
    return {
      id: t.id,
      tanggal: new Date(t.tanggal).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      noBukti: t.noBukti,
      keterangan: t.keterangan,
      counterpartyName: cp?.fullName ?? "-",
      accountType: isHutang ? "HUTANG" : "PIUTANG",
      coaCode,
      coaName: t.coaAccount?.name ?? "",
      debit: Number(t.debit),
      kredit: Number(t.kredit),
      debitFmt: formatStandardRupiah(Number(t.debit)),
      kreditFmt: formatStandardRupiah(Number(t.kredit)),
    };
  });

  return {
    entity,
    year,
    rekapHutang: {
      rows: hutangRows,
      totalHutangLalu: sumHutangLalu,
      totalHutangLaluFmt: formatAccountingRupiah(sumHutangLalu),
      totalHutangTahunIni: sumHutangTahunIni,
      totalHutangTahunIniFmt: formatAccountingRupiah(sumHutangTahunIni),
      totalHutang: sumTotalHutang,
      totalHutangFmt: formatAccountingRupiah(sumTotalHutang),
    },
    rekapPiutang: {
      rows: piutangRows,
      totalPiutang: sumTotalPiutang,
      totalPiutangFmt: formatAccountingRupiah(sumTotalPiutang),
    },
    netting: {
      rows: nettingRows,
      totalNetPiutang,
      totalNetUtang,
      posisiBersihGlobal,
      posisiBersihGlobalFmt: formatAccountingRupiah(posisiBersihGlobal),
      statusGlobal,
    },
    transactions,
  };
}

export async function getLaporanHutangPiutangGrupData(year: number): Promise<LaporanHutangPiutangGrupData> {
  const entities = await prisma.entity.findMany({
    select: { id: true, key: true, name: true },
    orderBy: { key: "asc" },
  });

  const entityShortNameMap: Record<string, string> = {
    kencana: "KAK",
    gaharu: "GS",
    tataring: "TB",
    ciptaAsri: "CAD",
    umum: "KP",
  };

  const matrix: Record<string, Record<string, InterEntityMatrixCell>> = {};
  const totalsByEntity: Record<
    string,
    { totalPiutang: number; totalHutang: number; net: number; status: "PIUTANG" | "UTANG" | "NIHIL" }
  > = {};

  let grandTotalPiutang = 0;
  let grandTotalHutang = 0;

  for (const ent of entities) {
    const data = await getLaporanHutangPiutangEntityData(ent.id, year);
    matrix[ent.key] = {};

    let entPiutang = 0;
    let entHutang = 0;

    if (data) {
      for (const row of data.netting.rows) {
        matrix[ent.key][row.counterpartyKey] = {
          piutang: row.piutang,
          hutang: row.hutang,
          net: row.net,
        };
        entPiutang += row.piutang;
        entHutang += row.hutang;
      }
    }

    grandTotalPiutang += entPiutang;
    grandTotalHutang += entHutang;

    const net = entPiutang - entHutang;
    totalsByEntity[ent.key] = {
      totalPiutang: entPiutang,
      totalHutang: entHutang,
      net,
      status: net > 0 ? "PIUTANG" : net < 0 ? "UTANG" : "NIHIL",
    };
  }

  // Cross entity reconciliations
  const reconciliations: ReconciliationPair[] = [];
  for (let i = 0; i < COUNTERPARTIES.length; i++) {
    for (let j = i + 1; j < COUNTERPARTIES.length; j++) {
      const a = COUNTERPARTIES[i];
      const b = COUNTERPARTIES[j];
      const cellAB = matrix[a.key]?.[b.key] ?? { piutang: 0, hutang: 0, net: 0 };
      const cellBA = matrix[b.key]?.[a.key] ?? { piutang: 0, hutang: 0, net: 0 };

      const diffAB = cellAB.piutang - cellBA.hutang;
      const diffBA = cellAB.hutang - cellBA.piutang;

      reconciliations.push({
        entityA: { key: a.key, name: a.fullName, shortName: a.shortName },
        entityB: { key: b.key, name: b.fullName, shortName: b.shortName },
        piutangAB: cellAB.piutang,
        hutangBA: cellBA.hutang,
        diffAB,
        isMatchAB: Math.abs(diffAB) < 1,
        hutangAB: cellAB.hutang,
        piutangBA: cellBA.piutang,
        diffBA,
        isMatchBA: Math.abs(diffBA) < 1,
      });
    }
  }

  return {
    year,
    entities: entities.map((e) => ({
      ...e,
      shortName: entityShortNameMap[e.key] ?? e.name.substring(0, 3).toUpperCase(),
    })),
    matrix,
    totalsByEntity,
    grandTotalPiutang,
    grandTotalHutang,
    reconciliations,
  };
}
