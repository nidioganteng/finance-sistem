import { phpFetch, getPhpToken } from "./api-client";

export interface CounterpartyConfig {
  key: string;
  shortName: string;
  fullName: string;
  piutangCode: string;
  hutangCode: string;
  isSpecial?: boolean;
}

export const COUNTERPARTIES: CounterpartyConfig[] = [
  { key: "kencana", shortName: "KAK", fullName: "Kencana", piutangCode: "111", hutangCode: "311" },
  { key: "gaharu", shortName: "GS", fullName: "Gaharu", piutangCode: "112", hutangCode: "312" },
  { key: "tataring", shortName: "TB", fullName: "Tataring", piutangCode: "113", hutangCode: "313" },
  { key: "ciptaAsri", shortName: "CAD", fullName: "Cipta Asri", piutangCode: "114", hutangCode: "314" },
  { key: "umum", shortName: "KP", fullName: "Kardi Pratama", piutangCode: "115", hutangCode: "315" },
];

export const SPECIAL_COUNTERPARTIES: CounterpartyConfig[] = [
  { key: "pemegangSaham", shortName: "PS", fullName: "Pemegang Saham", piutangCode: "117", hutangCode: "317", isSpecial: true },
  { key: "piutangLainnya", shortName: "Lainnya", fullName: "Piutang Lainnya", piutangCode: "118", hutangCode: "", isSpecial: true },
];

export const ALL_COUNTERPARTIES: CounterpartyConfig[] = [
  ...COUNTERPARTIES,
  ...SPECIAL_COUNTERPARTIES,
];

export interface SumberPengeluaranInfo {
  coaCode: string;
  coaName: string;
  namaLengkap: string;
  rekeningNama?: string;
  entityKey: string;
  entityName: string;
  entityShortName?: string;
}

export function formatAccountingRupiah(n: number): string {
  if (n === 0) return "Rp -";
  const abs = Math.round(Math.abs(n)).toLocaleString("id-ID");
  if (n < 0) return `Rp (${abs})`;
  return `Rp ${abs}`;
}

export function formatStandardRupiah(n: number): string {
  return "Rp " + Math.round(n).toLocaleString("id-ID");
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

export interface AlokasiPenggunaanDana {
  entityKey: string;
  entityName: string;
  entityShortName?: string;
  coaCode: string;
  coaName: string;
  nominal: number;
  nominalFmt: string;
  keterangan: string;
  role: "BEBAN" | "KAS" | "HUTANG" | "PIUTANG" | "LAINNYA";
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
  sumberPengeluaran?: SumberPengeluaranInfo;
  alokasiPenggunaan?: AlokasiPenggunaanDana[];
  narasiAlur?: string;
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

export interface PemegangSahamGrupItem {
  entityKey: string;
  entityName: string;
  shortName: string;
  piutang: number;
  piutangFmt: string;
  hutang: number;
  hutangFmt: string;
  net: number;
  netFmt: string;
  status: "PIUTANG" | "UTANG" | "NIHIL";
}

export interface PiutangLainnyaGrupItem {
  entityKey: string;
  entityName: string;
  shortName: string;
  nominal: number;
  nominalFmt: string;
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
  pemegangSahamSummary: {
    items: PemegangSahamGrupItem[];
    totalPiutang: number;
    totalPiutangFmt: string;
    totalHutang: number;
    totalHutangFmt: string;
    netGlobal: number;
    netGlobalFmt: string;
  };
  piutangLainnyaSummary: {
    items: PiutangLainnyaGrupItem[];
    total: number;
    totalFmt: string;
  };
}

// PHP GET /api/piutang?entityKey=... response shape (subset needed here)
type PhpBasePiutangResponse = {
  entity: { id: string; key: string; name: string };
  saldoAntarEntitas: Record<string, number>; // coaCode -> saldo (debit - kredit)
};

const ENTITY_SHORT_NAME: Record<string, string> = {
  kencana: "KAK", gaharu: "GS", tataring: "TB", ciptaAsri: "CAD", umum: "KP",
};

function fmtRp(n: number): string {
  if (n === 0) return "Rp -";
  const abs = Math.round(Math.abs(n)).toLocaleString("id-ID");
  return n < 0 ? `Rp (${abs})` : `Rp ${abs}`;
}

/**
 * Build LaporanHutangPiutangEntityData from the base PHP piutang response.
 * PHP returns saldoAntarEntitas: { coaCode: saldo } where saldo = debit - kredit.
 * Codes 111-115 = piutang (asset), codes 311-315 = hutang (liability).
 */
function buildEntityData(
  raw: PhpBasePiutangResponse,
  year: number
): LaporanHutangPiutangEntityData {
  const saldoMap = raw.saldoAntarEntitas ?? {};
  const entity = raw.entity;

  const COA_TO_CP: Record<string, string> = {
    "111": "kencana", "112": "gaharu", "113": "tataring", "114": "ciptaAsri", "115": "umum",
    "311": "kencana", "312": "gaharu", "313": "tataring", "314": "ciptaAsri", "315": "umum",
  };

  // Separate piutang (111-115) and hutang (311-315) saldos
  const piutangByCp: Record<string, { code: string; saldo: number }> = {};
  const hutangByCp: Record<string, { code: string; saldo: number }> = {};

  for (const [code, saldo] of Object.entries(saldoMap)) {
    const cp = COA_TO_CP[code];
    if (!cp) continue;
    const num = parseInt(code);
    if (num >= 100 && num < 200) {
      // piutang codes 111-115
      piutangByCp[cp] = { code, saldo };
    } else if (num >= 300 && num < 400) {
      // hutang codes 311-315
      hutangByCp[cp] = { code, saldo };
    }
  }

  // Build rekapPiutang rows
  const rekapPiutangRows: RekapPiutangRow[] = COUNTERPARTIES.map((cp) => {
    const entry = piutangByCp[cp.key];
    const piutang = entry?.saldo ?? 0;
    return {
      counterpartyKey: cp.key,
      shortName: cp.shortName,
      fullName: cp.fullName,
      code: entry?.code ?? cp.piutangCode,
      accountName: `Piutang ke ${cp.fullName}`,
      piutangLalu: 0,
      piutangLaluFmt: fmtRp(0),
      piutangBerjalan: piutang,
      piutangBerjalanFmt: fmtRp(piutang),
      perubahan: piutang,
      perubahanFmt: fmtRp(piutang),
      piutang,
      piutangFmt: fmtRp(piutang),
    };
  });

  const totalPiutang = rekapPiutangRows.reduce((s, r) => s + r.piutang, 0);
  const rekapPiutang = {
    rows: rekapPiutangRows,
    totalPiutangLalu: 0,
    totalPiutangLaluFmt: fmtRp(0),
    totalPerubahan: totalPiutang,
    totalPerubahanFmt: fmtRp(totalPiutang),
    totalPiutang,
    totalPiutangFmt: fmtRp(totalPiutang),
  };

  // Build rekapHutang rows
  const rekapHutangRows: RekapHutangRow[] = COUNTERPARTIES.map((cp) => {
    const entry = hutangByCp[cp.key];
    // hutang saldo = debit - kredit; credit balance (negative debit-kredit) means we owe them
    const rawSaldo = entry?.saldo ?? 0;
    const hutang = rawSaldo < 0 ? Math.abs(rawSaldo) : 0;
    return {
      counterpartyKey: cp.key,
      shortName: cp.shortName,
      fullName: cp.fullName,
      code: entry?.code ?? cp.hutangCode,
      accountName: `Hutang ke ${cp.fullName}`,
      hutangLalu: 0,
      hutangLaluFmt: fmtRp(0),
      hutangTahunIni: hutang,
      hutangTahunIniFmt: fmtRp(hutang),
      totalHutang: hutang,
      totalHutangFmt: fmtRp(hutang),
    };
  });

  const totalHutang = rekapHutangRows.reduce((s, r) => s + r.totalHutang, 0);
  const rekapHutang = {
    rows: rekapHutangRows,
    totalHutangLalu: 0,
    totalHutangLaluFmt: fmtRp(0),
    totalHutangTahunIni: totalHutang,
    totalHutangTahunIniFmt: fmtRp(totalHutang),
    totalHutang,
    totalHutangFmt: fmtRp(totalHutang),
  };

  // Build netting rows
  const nettingRows: NettingRow[] = COUNTERPARTIES.map((cp) => {
    const piutang = piutangByCp[cp.key]?.saldo ?? 0;
    const rawHutangSaldo = hutangByCp[cp.key]?.saldo ?? 0;
    const hutang = rawHutangSaldo < 0 ? Math.abs(rawHutangSaldo) : 0;
    const net = piutang - hutang;
    const isUtang = net < 0;
    const absNet = Math.abs(net);
    const status: "UTANG" | "PIUTANG" | "NIHIL" = net > 0 ? "PIUTANG" : net < 0 ? "UTANG" : "NIHIL";
    return {
      counterpartyKey: cp.key,
      shortName: cp.shortName,
      fullName: cp.fullName,
      status,
      saldoAwalNet: 0,
      saldoAwalNetFmt: fmtRp(0),
      penambahanPiutang: piutang,
      penambahanPiutangFmt: fmtRp(piutang),
      penambahanHutang: hutang,
      penambahanHutangFmt: fmtRp(hutang),
      piutang,
      piutangFmt: fmtRp(piutang),
      hutang,
      hutangFmt: fmtRp(hutang),
      net,
      netFmt: fmtRp(net),
      absNet,
      absNetFmt: fmtRp(absNet),
      isUtang,
      neracaPosition: isUtang ? "Kewajiban" : "Aset",
      neracaAccountCode: isUtang ? (hutangByCp[cp.key]?.code ?? cp.hutangCode) : (piutangByCp[cp.key]?.code ?? cp.piutangCode),
    };
  });

  const posisiBersihGlobal = totalPiutang - totalHutang;
  const statusGlobal: "PIUTANG" | "UTANG" | "NIHIL" =
    posisiBersihGlobal > 0 ? "PIUTANG" : posisiBersihGlobal < 0 ? "UTANG" : "NIHIL";

  const netting = {
    rows: nettingRows,
    totalNetPiutang: Math.max(0, posisiBersihGlobal),
    totalNetUtang: Math.max(0, -posisiBersihGlobal),
    posisiBersihGlobal,
    posisiBersihGlobalFmt: fmtRp(posisiBersihGlobal),
    statusGlobal,
  };

  return {
    entity,
    year,
    rekapHutang,
    rekapPiutang,
    netting,
    transactions: [], // PHP doesn't return transaction history in this endpoint
  };
}

export async function getLaporanHutangPiutangEntityData(
  entityId: string,
  year: number
): Promise<LaporanHutangPiutangEntityData | null> {
  const token = await getPhpToken();
  try {
    // PHP only supports base piutang by entityKey — use that and compute locally
    const raw = await phpFetch<PhpBasePiutangResponse>(
      `/api/piutang?entityKey=${encodeURIComponent(entityId)}`,
      token
    );
    return buildEntityData(raw, year);
  } catch {
    return null;
  }
}

export async function getLaporanHutangPiutangGrupData(year: number): Promise<LaporanHutangPiutangGrupData> {
  const token = await getPhpToken();

  // Fetch each entity separately and aggregate — PHP requires singular entityKey
  const results = await Promise.all(
    COUNTERPARTIES.map(async (cp) => {
      try {
        const raw = await phpFetch<PhpBasePiutangResponse>(
          `/api/piutang?entityKey=${encodeURIComponent(cp.key)}`,
          token
        );
        return { cp, saldoMap: raw.saldoAntarEntitas ?? {}, entity: raw.entity };
      } catch {
        return { cp, saldoMap: {}, entity: { id: "", key: cp.key, name: cp.fullName } };
      }
    })
  );

  const COA_TO_CP: Record<string, string> = {
    "111": "kencana", "112": "gaharu", "113": "tataring", "114": "ciptaAsri", "115": "umum",
    "311": "kencana", "312": "gaharu", "313": "tataring", "314": "ciptaAsri", "315": "umum",
  };

  // Build matrix: matrix[entityKey][counterpartyKey] = { piutang, hutang, net }
  const matrix: Record<string, Record<string, InterEntityMatrixCell>> = {};
  const totalsByEntity: Record<string, { totalPiutang: number; totalHutang: number; net: number; status: "PIUTANG" | "UTANG" | "NIHIL" }> = {};

  const entities = results.map((r) => ({
    id: r.entity.id,
    key: r.cp.key,
    name: r.cp.fullName,
    shortName: ENTITY_SHORT_NAME[r.cp.key] ?? r.cp.shortName,
  }));

  for (const { cp, saldoMap } of results) {
    matrix[cp.key] = {};
    let totalPiutang = 0;
    let totalHutang = 0;

    for (const [code, saldo] of Object.entries(saldoMap)) {
      const counterpartyKey = COA_TO_CP[code];
      if (!counterpartyKey) continue;
      const num = parseInt(code);
      if (!matrix[cp.key][counterpartyKey]) {
        matrix[cp.key][counterpartyKey] = { piutang: 0, hutang: 0, net: 0 };
      }
      if (num >= 100 && num < 200) {
        matrix[cp.key][counterpartyKey].piutang += saldo;
        totalPiutang += saldo;
      } else if (num >= 300 && num < 400) {
        const hutang = saldo < 0 ? Math.abs(saldo) : 0;
        matrix[cp.key][counterpartyKey].hutang += hutang;
        totalHutang += hutang;
      }
      matrix[cp.key][counterpartyKey].net =
        matrix[cp.key][counterpartyKey].piutang - matrix[cp.key][counterpartyKey].hutang;
    }

    const net = totalPiutang - totalHutang;
    totalsByEntity[cp.key] = {
      totalPiutang,
      totalHutang,
      net,
      status: net > 0 ? "PIUTANG" : net < 0 ? "UTANG" : "NIHIL",
    };
  }

  const grandTotalPiutang = Object.values(totalsByEntity).reduce((s, v) => s + v.totalPiutang, 0);
  const grandTotalHutang = Object.values(totalsByEntity).reduce((s, v) => s + v.totalHutang, 0);

  // Build reconciliation pairs (A vs B)
  const reconciliations: ReconciliationPair[] = [];
  for (let i = 0; i < COUNTERPARTIES.length; i++) {
    for (let j = i + 1; j < COUNTERPARTIES.length; j++) {
      const a = COUNTERPARTIES[i];
      const b = COUNTERPARTIES[j];
      const piutangAB = matrix[a.key]?.[b.key]?.piutang ?? 0;
      const hutangBA = matrix[b.key]?.[a.key]?.hutang ?? 0;
      const diffAB = Math.abs(piutangAB - hutangBA);
      const hutangAB = matrix[a.key]?.[b.key]?.hutang ?? 0;
      const piutangBA = matrix[b.key]?.[a.key]?.piutang ?? 0;
      const diffBA = Math.abs(hutangAB - piutangBA);
      reconciliations.push({
        entityA: { key: a.key, name: a.fullName, shortName: a.shortName },
        entityB: { key: b.key, name: b.fullName, shortName: b.shortName },
        piutangAB,
        hutangBA,
        diffAB,
        isMatchAB: diffAB < 1,
        hutangAB,
        piutangBA,
        diffBA,
        isMatchBA: diffBA < 1,
      });
    }
  }

  return {
    year,
    entities,
    matrix,
    totalsByEntity,
    grandTotalPiutang,
    grandTotalHutang,
    reconciliations,
    pemegangSahamSummary: {
      items: [],
      totalPiutang: 0,
      totalPiutangFmt: fmtRp(0),
      totalHutang: 0,
      totalHutangFmt: fmtRp(0),
      netGlobal: 0,
      netGlobalFmt: fmtRp(0),
    },
    piutangLainnyaSummary: {
      items: [],
      total: 0,
      totalFmt: fmtRp(0),
    },
  };
}
