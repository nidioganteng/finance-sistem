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



export async function getLaporanHutangPiutangEntityData(
  entityId: string,
  year: number
): Promise<LaporanHutangPiutangEntityData | null> {
  const token = await getPhpToken();
  try {
    const isUuid = entityId.length > 20 || entityId.includes("-");
    const param = isUuid ? `entityId=${encodeURIComponent(entityId)}` : `entityKey=${encodeURIComponent(entityId)}`;
    const data = await phpFetch<LaporanHutangPiutangEntityData>(
      `/api/piutang/laporan-afiliasi?${param}&year=${year}`,
      token
    );
    return data;
  } catch {
    return null;
  }
}

export async function getLaporanHutangPiutangGrupData(year: number): Promise<LaporanHutangPiutangGrupData> {
  const entities = COUNTERPARTIES.map((cp) => ({
    id: cp.key,
    key: cp.key,
    name: cp.fullName,
    shortName: cp.shortName,
  }));

  const matrix: Record<string, Record<string, InterEntityMatrixCell>> = {};
  const totalsByEntity: Record<
    string,
    { totalPiutang: number; totalHutang: number; net: number; status: "PIUTANG" | "UTANG" | "NIHIL" }
  > = {};

  let grandTotalPiutang = 0;
  let grandTotalHutang = 0;

  const psItems: PemegangSahamGrupItem[] = [];
  const piutangLainnyaItems: PiutangLainnyaGrupItem[] = [];
  let totalPsPiutang = 0;
  let totalPsHutang = 0;
  let totalPiutangLainnya = 0;

  for (const ent of entities) {
    const data = await getLaporanHutangPiutangEntityData(ent.key, year);
    matrix[ent.key] = {};

    let entPiutang = 0;
    let entHutang = 0;

    if (data) {
      for (const row of data.netting.rows) {
        const isOperatingEntity = COUNTERPARTIES.some((c) => c.key === row.counterpartyKey);
        if (isOperatingEntity) {
          matrix[ent.key][row.counterpartyKey] = {
            piutang: row.piutang,
            hutang: row.hutang,
            net: row.net,
          };
          entPiutang += row.piutang;
          entHutang += row.hutang;
        } else if (row.counterpartyKey === "pemegangSaham") {
          psItems.push({
            entityKey: ent.key,
            entityName: ent.name,
            shortName: ent.shortName,
            piutang: row.piutang,
            piutangFmt: row.piutangFmt,
            hutang: row.hutang,
            hutangFmt: row.hutangFmt,
            net: row.net,
            netFmt: row.netFmt,
            status: row.status,
          });
          totalPsPiutang += row.piutang;
          totalPsHutang += row.hutang;
        } else if (row.counterpartyKey === "piutangLainnya") {
          piutangLainnyaItems.push({
            entityKey: ent.key,
            entityName: ent.name,
            shortName: ent.shortName,
            nominal: row.piutang,
            nominalFmt: row.piutangFmt,
          });
          totalPiutangLainnya += row.piutang;
        }
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

  const netGlobalPs = totalPsPiutang - totalPsHutang;

  return {
    year,
    entities,
    matrix,
    totalsByEntity,
    grandTotalPiutang,
    grandTotalHutang,
    reconciliations,
    pemegangSahamSummary: {
      items: psItems,
      totalPiutang: totalPsPiutang,
      totalPiutangFmt: formatAccountingRupiah(totalPsPiutang),
      totalHutang: totalPsHutang,
      totalHutangFmt: formatAccountingRupiah(totalPsHutang),
      netGlobal: netGlobalPs,
      netGlobalFmt: formatAccountingRupiah(netGlobalPs),
    },
    piutangLainnyaSummary: {
      items: piutangLainnyaItems,
      total: totalPiutangLainnya,
      totalFmt: formatAccountingRupiah(totalPiutangLainnya),
    },
  };
}
