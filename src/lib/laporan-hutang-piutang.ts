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
  piutangLalu: number;
  piutangLaluFmt: string;
  piutangBerjalan: number;
  piutangBerjalanFmt: string;
  perubahan: number;
  perubahanFmt: string;
  piutang: number;
  piutangFmt: string;
}

export interface NettingRow {
  counterpartyKey: string;
  shortName: string;
  fullName: string;
  status: "UTANG" | "PIUTANG" | "NIHIL";
  saldoAwalNet: number;
  saldoAwalNetFmt: string;
  penambahanPiutang: number;
  penambahanPiutangFmt: string;
  penambahanHutang: number;
  penambahanHutangFmt: string;
  piutang: number;
  piutangFmt: string;
  hutang: number;
  hutangFmt: string;
  net: number;
  netFmt: string;
  absNet: number;
  absNetFmt: string;
  isUtang: boolean;
  neracaPosition: string;
  neracaAccountCode: string;
}

export interface MutasiAfiliasiTx {
  id: string;
  tanggal: string;
  tanggalRaw?: string;
  noBukti: string;
  keterangan: string;
  counterpartyKey: string;
  counterpartyName: string;
  counterpartyShortName?: string;
  accountType: "PIUTANG" | "HUTANG";
  efekSaldo: "TAMBAH" | "KURANG";
  coaCode: string;
  coaName: string;
  debit: number;
  kredit: number;
  debitFmt: string;
  kreditFmt: string;
  nominalMutasi: number;
  nominalMutasiFmt: string;
  saldoAkhir: number;
  saldoAkhirFmt: string;
  saldoAkhirGlobal?: number;
  saldoAkhirGlobalFmt?: string;
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
    totalPiutangLalu: number;
    totalPiutangLaluFmt: string;
    totalPerubahan: number;
    totalPerubahanFmt: string;
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

    // Periksa transaksi crossing dari entitas rekanan ini (jika kode akun sempat diubah tim finance di Jurnal)
    const extraCrossing = await prisma.transaction.findMany({
      where: {
        entityId,
        tanggal: { gte: startYear, lt: endYear },
        extraFieldsJson: { path: "$.crossingFromEntityKey", equals: cp.key },
      },
      select: { id: true, coaAccountId: true, debit: true, kredit: true, extraFieldsJson: true },
    });

    for (const ec of extraCrossing) {
      // Jika akunnya bukan akun hutang standar (misal sudah diganti oleh tim finance ke akun lain),
      // tetap hitung kewajiban kreditnya agar tidak hilang dari Laporan Hutang & Piutang!
      if (ec.coaAccountId !== coaId) {
        const extra = ec.extraFieldsJson as Record<string, unknown> | null;
        if (extra?.crossingRole === "HUTANG" || (!extra?.crossingRole && Number(ec.kredit) > 0)) {
          hutangTahunIni += Number(ec.kredit) - Number(ec.debit);
        }
      }
    }

    const extraCrossingBefore = await prisma.transaction.findMany({
      where: {
        entityId,
        tanggal: { lt: startYear },
        extraFieldsJson: { path: "$.crossingFromEntityKey", equals: cp.key },
      },
      select: { id: true, coaAccountId: true, debit: true, kredit: true, extraFieldsJson: true },
    });

    for (const ec of extraCrossingBefore) {
      if (ec.coaAccountId !== coaId) {
        const extra = ec.extraFieldsJson as Record<string, unknown> | null;
        if (extra?.crossingRole === "HUTANG" || (!extra?.crossingRole && Number(ec.kredit) > 0)) {
          hutangLalu += Number(ec.kredit) - Number(ec.debit);
        }
      }
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
  let sumPiutangLalu = 0;
  let sumPerubahan = 0;
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
    sumPiutangLalu += piutangAwal;
    sumPerubahan += piutangTahunIni;
    sumTotalPiutang += totalPiutang;

    piutangRows.push({
      counterpartyKey: cp.key,
      shortName: cp.shortName,
      fullName: cp.fullName,
      code: cp.piutangCode,
      accountName: coa?.name ?? `PIUTANG ${cp.shortName}`,
      piutangLalu: piutangAwal,
      piutangLaluFmt: formatAccountingRupiah(piutangAwal),
      piutangBerjalan: totalPiutang,
      piutangBerjalanFmt: formatAccountingRupiah(totalPiutang),
      perubahan: piutangTahunIni,
      perubahanFmt: formatAccountingRupiah(piutangTahunIni),
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
    let neracaPosition = "Tidak Masuk Neraca (Saling Hapus)";
    let neracaAccountCode = "-";

    if (net > 0) {
      status = "PIUTANG";
      neracaPosition = `Aktiva Lancar (Akun ${cp.piutangCode})`;
      neracaAccountCode = cp.piutangCode;
      totalNetPiutang += net;
    } else if (net < 0) {
      status = "UTANG";
      neracaPosition = `Kewajiban (Akun ${cp.hutangCode})`;
      neracaAccountCode = cp.hutangCode;
      totalNetUtang += Math.abs(net);
    }

    const saldoAwalNet = pRow.piutangLalu - hRow.hutangLalu;
    const penambahanPiutang = pRow.perubahan;
    const penambahanHutang = hRow.hutangTahunIni;

    nettingRows.push({
      counterpartyKey: cp.key,
      shortName: cp.shortName,
      fullName: cp.fullName,
      status,
      saldoAwalNet,
      saldoAwalNetFmt: formatAccountingRupiah(saldoAwalNet),
      penambahanPiutang,
      penambahanPiutangFmt: formatAccountingRupiah(penambahanPiutang),
      penambahanHutang,
      penambahanHutangFmt: formatAccountingRupiah(penambahanHutang),
      piutang,
      piutangFmt: formatAccountingRupiah(piutang),
      hutang,
      hutangFmt: formatAccountingRupiah(hutang),
      net,
      netFmt: formatAccountingRupiah(net),
      absNet: Math.abs(net),
      absNetFmt: formatAccountingRupiah(Math.abs(net)),
      isUtang: net < 0,
      neracaPosition,
      neracaAccountCode,
    });
  }

  const posisiBersihGlobal = sumTotalPiutang - sumTotalHutang;
  const statusGlobal: "PIUTANG" | "UTANG" | "NIHIL" =
    posisiBersihGlobal > 0 ? "PIUTANG" : posisiBersihGlobal < 0 ? "UTANG" : "NIHIL";

  // Detailed recent transactions for inter-entity accounts (diurutkan kronologis untuk running balance)
  const rawTx = await prisma.transaction.findMany({
    where: {
      entityId,
      tanggal: { gte: startYear, lt: endYear },
      OR: [
        { coaAccountId: { in: coaAccounts.map((c) => c.id) } },
        {
          extraFieldsJson: {
            path: "$.isCrossingEntry",
            equals: true,
          },
        },
      ],
    },
    include: { coaAccount: true },
    orderBy: [{ tanggal: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    take: 200,
  });

  const cpRunningBalances = new Map<string, number>();
  for (const nr of nettingRows) {
    cpRunningBalances.set(nr.counterpartyKey, nr.saldoAwalNet);
  }
  let globalRunningBalance = sumPiutangLalu - sumHutangLalu;

  const chronologicalTransactions: MutasiAfiliasiTx[] = [];

  for (const t of rawTx) {
    const coaCode = t.coaAccount?.code ?? "";
    const isStandardHutang = hutangCodes.includes(coaCode);
    const isStandardPiutang = piutangCodes.includes(coaCode);
    const extra = t.extraFieldsJson as Record<string, unknown> | null;

    let cp: CounterpartyConfig | undefined;
    let accountType: "PIUTANG" | "HUTANG" = "PIUTANG";
    let coaName = t.coaAccount?.name ?? "";
    let displayCoaCode = coaCode;

    if (extra?.crossingFromEntityKey) {
      const fromKey = String(extra.crossingFromEntityKey);
      cp = counterparties.find((c) => c.key === fromKey);
      accountType = "HUTANG";

      // Lewati baris BEBAN jika bukan akun hutang/piutang standar (hanya baris kewajiban/hutang yang ditampilkan)
      if (extra.crossingRole === "BEBAN" && !isStandardHutang && !isStandardPiutang) {
        continue;
      }

      displayCoaCode = coaCode || (typeof extra.originalHutangCoaCode === "string" ? extra.originalHutangCoaCode : "-");
      coaName =
        t.coaAccount?.name && !isStandardHutang
          ? `${t.coaAccount.name} (Hutang Crossing)`
          : t.coaAccount?.name ?? `Hutang Afiliasi (${cp?.shortName ?? fromKey})`;
    } else if (isStandardHutang || isStandardPiutang) {
      accountType = isStandardHutang ? "HUTANG" : "PIUTANG";
      cp = counterparties.find((c) => (accountType === "HUTANG" ? c.hutangCode === coaCode : c.piutangCode === coaCode));
    } else {
      continue;
    }

    if (!cp) continue;

    const debit = Number(t.debit);
    const kredit = Number(t.kredit);

    // Rumus running balance sesuai instruksi finance:
    // Setiap transaksi piutang menambah saldo (+)
    // Setiap transaksi hutang mengurangi saldo (-)
    const nominalMutasi = debit - kredit;
    const efekSaldo: "TAMBAH" | "KURANG" = nominalMutasi >= 0 ? "TAMBAH" : "KURANG";

    const prevCpBalance = cpRunningBalances.get(cp.key) ?? 0;
    const newCpBalance = prevCpBalance + nominalMutasi;
    cpRunningBalances.set(cp.key, newCpBalance);

    globalRunningBalance += nominalMutasi;

    chronologicalTransactions.push({
      id: t.id,
      tanggal: new Date(t.tanggal).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      tanggalRaw: new Date(t.tanggal).toISOString(),
      noBukti: t.noBukti,
      keterangan: t.keterangan,
      counterpartyKey: cp.key,
      counterpartyName: cp.fullName,
      counterpartyShortName: cp.shortName,
      accountType,
      efekSaldo,
      coaCode: displayCoaCode,
      coaName,
      debit,
      kredit,
      debitFmt: formatStandardRupiah(debit),
      kreditFmt: formatStandardRupiah(kredit),
      nominalMutasi,
      nominalMutasiFmt: formatStandardRupiah(Math.abs(nominalMutasi)),
      saldoAkhir: newCpBalance,
      saldoAkhirFmt: formatAccountingRupiah(newCpBalance),
      saldoAkhirGlobal: globalRunningBalance,
      saldoAkhirGlobalFmt: formatAccountingRupiah(globalRunningBalance),
    });
  }

  // Tampilkan riwayat dengan transaksi terbaru di atas
  const pagedTransactions = [...chronologicalTransactions].reverse().slice(0, 100);

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
      totalPiutangLalu: sumPiutangLalu,
      totalPiutangLaluFmt: formatAccountingRupiah(sumPiutangLalu),
      totalPerubahan: sumPerubahan,
      totalPerubahanFmt: formatAccountingRupiah(sumPerubahan),
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
    transactions: pagedTransactions,
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
