import { phpFetch, getPhpToken } from "./api-client";
import { TerminStatus } from "@/types/app-enums";

export const PIUTANG_COA: Record<string, string> = {
  kencana: "111", gaharu: "112", tataring: "113", ciptaAsri: "114", umum: "115",
};
export const HUTANG_COA: Record<string, string> = {
  kencana: "311", gaharu: "312", tataring: "313", ciptaAsri: "314", umum: "315",
};

export type TerminBreakdown = {
  noBukti: string | null;
  tanggalTerimaFmt: string | null;
  bank: string | null;
  gross: number;
  grossFmt: string;
  dpp: number;
  dppFmt: string;
  dppNilaiLain: number;
  dppNilaiLainFmt: string;
  ppn: number;
  ppnFmt: string;
  tarifPpnPersen: number;
  pph: number;
  pphFmt: string;
  tarifPphPersen: number;
  pphItems: Array<{
    name: string;
    amount: number;
    amountFmt: string;
  }>;
  netBank: number;
  netBankFmt: string;
  jurnalRows: Array<{
    coaCode: string;
    coaName: string;
    debit: number;
    kredit: number;
    debitFmt: string;
    kreditFmt: string;
  }>;
};

export type TerminItem = {
  id: string;
  name: string;
  percentage?: number;
  percentageDelta?: number;
  nominal: number;
  nominalFmt: string;
  status: TerminStatus;
  auditedAt: string | null;
  auditedByName: string | null;
  breakdown: TerminBreakdown;
};

export type ProjectBreakdownSummary = {
  totalGross: number;
  totalGrossFmt: string;
  totalDpp: number;
  totalDppFmt: string;
  totalDppNilaiLain: number;
  totalDppNilaiLainFmt: string;
  totalPpn: number;
  totalPpnFmt: string;
  totalPph: number;
  totalPphFmt: string;
  totalNetBank: number;
  totalNetBankFmt: string;
  sisaKontrak: number;
  sisaKontrakFmt: string;
};

export type ProjectExpenseItem = {
  id: string;
  tanggal: string;
  tanggalFmt: string;
  noBukti: string;
  keterangan: string;
  coaCode: string;
  coaName: string;
  kategoriBeban: "Gaji & Upah" | "Bahan & Material" | "Operasional & Transport" | "Pajak Proyek" | "Lainnya";
  nominal: number;
  nominalFmt: string;
  sumberKasBank: string;
};

export type ProjectExpensesSummary = {
  totalPengeluaran: number;
  totalPengeluaranFmt: string;
  totalGaji: number;
  totalGajiFmt: string;
  totalMaterial: number;
  totalMaterialFmt: string;
  totalOperasional: number;
  totalOperasionalFmt: string;
  totalPajak: number;
  totalPajakFmt: string;
  totalLainnya: number;
  totalLainnyaFmt: string;
  labaKotor: number;
  labaKotorFmt: string;
  items: ProjectExpenseItem[];
};

export type ProjectItem = {
  id: string;
  code: string;
  name: string;
  entityName?: string;
  entityKey?: string;
  contractValue: number;
  contractValueFmt: string;
  deadlineFmt: string;
  isOverdue: boolean;
  status: "ACTIVE" | "CANCELLED" | "COMPLETED";
  maxPercentage: number;
  terminTagih: number;
  terminTagihFmt: string;
  sisaTagih: number;
  sisaTagihFmt: string;
  termin: TerminItem[];
  breakdownSummary: ProjectBreakdownSummary;
  expensesSummary: ProjectExpensesSummary;
};

export type PiutangSummary = {
  totalKontrak: number;
  totalKontrakFmt: string;
  totalTerminTagih: number;
  totalTerminTagihFmt: string;
  sisaPiutang: number;
  sisaPiutangFmt: string;
  jumlahProyek: number;
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
  const token = await getPhpToken();
  // PHP returns { entity, saldoAntarEntitas: { coaCode: saldo }, projects, loadingDock }
  const result = await phpFetch<{
    entity: { id: string; key: string; name: string };
    saldoAntarEntitas: Record<string, number>;
  }>(
    `/api/piutang?entityKey=${encodeURIComponent(entityId)}`,
    token
  );

  const saldoMap: Record<string, number> = result.saldoAntarEntitas ?? {};

  // Entity key -> name mapping for counterparty display
  const entityKeyMap: Record<string, string> = {
    "111": "kencana", "112": "gaharu", "113": "tataring", "114": "ciptaAsri", "115": "umum",
    "311": "kencana", "312": "gaharu", "313": "tataring", "314": "ciptaAsri", "315": "umum",
  };
  const entityNameMap: Record<string, string> = {
    kencana: "Kencana Abadi Konstruksi", gaharu: "Gaharu Sempana", tataring: "Tataring Bangun",
    ciptaAsri: "Cipta Asri Desain", umum: "Kardi Pratama (Umum)",
  };

  return Object.entries(saldoMap)
    .filter(([, saldo]) => saldo !== 0)
    .map(([code, saldo]) => {
      const isPiutang = parseInt(code) < 200; // 111-115 = piutang, 311-315 = hutang
      const counterpartyKey = entityKeyMap[code] ?? "";
      return {
        type: isPiutang ? "piutang" : "hutang",
        coaCode: code,
        coaId: code,
        counterpartyEntityKey: counterpartyKey,
        counterpartyEntityName: entityNameMap[counterpartyKey] ?? counterpartyKey,
        netAmount: Math.abs(saldo),
        netAmountFmt: "Rp " + Math.round(Math.abs(saldo)).toLocaleString("id-ID"),
      } as InterEntityBalance;
    });
}

export type ProjectOption = {
  id: string;
  code: string;
  name: string;
  entityId?: string;
  entityKey?: string;
  entityName?: string;
  contractValue?: number;
  contractValueFmt?: string;
  maxPercentage?: number;
  terminCount?: number;
  totalTerminTagih?: number;
  status?: string;
  termins?: Array<{
    id: string;
    name: string;
    percentage: number | null;
    nominal: number | null;
  }>;
};

export async function getProjectOptions(currentEntityKey?: string): Promise<ProjectOption[]> {
  const token = await getPhpToken();
  const params = new URLSearchParams();
  if (currentEntityKey) params.set("entityKey", currentEntityKey);
  params.set("type", "projects");

  const result = await phpFetch<{ projects: ProjectOption[] }>(
    `/api/piutang?${params.toString()}`,
    token
  );
  return result.projects ?? [];
}

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

export type PiutangData = {
  projectList: ProjectItem[];
  summary: PiutangSummary;
  loadingDockList: Array<{
    id: string;
    nama: string;
    totalFmt: string;
    status: string;
    createdAt: string;
  }>;
};

// Shape of raw project data from PHP
type PhpRawProject = {
  id: string;
  code: string;
  name: string;
  contractValue: number;
  spend: number;
  deadline: string | null;
  status: "ACTIVE" | "CANCELLED" | "COMPLETED";
  entity_key?: string;
  entity_name?: string;
  termin: Array<{
    id: string;
    projectId: string;
    name: string;
    percentage: number | null;
    nominal: number | null;
    status: TerminStatus;
    auditedAt: string | null;
    auditedById: string | null;
    createdAt: string;
    breakdown?: {
      noBukti: string | null;
      tanggalTerima: string | null;
      bank: string | null;
      gross: number;
      dpp: number;
      dppNilaiLain: number;
      ppn: number;
      tarifPpnPersen: number;
      pph: number;
      tarifPphPersen: number;
      pphItems: Array<{ name: string; amount: number }>;
      netBank: number;
      jurnalRows: Array<{
        coaCode: string;
        coaName: string;
        debit: number;
        kredit: number;
      }>;
    } | null;
  }>;
  expensesSummary?: {
    totalPengeluaran: number;
    totalMaterial: number;
    totalGaji: number;
    totalOperasional: number;
    totalPajak: number;
    totalLainnya: number;
    items: Array<{
      id: string;
      tanggal: string;
      noBukti: string;
      keterangan: string;
      coaCode: string;
      coaName: string;
      kategoriBeban: "Gaji & Upah" | "Bahan & Material" | "Operasional & Transport" | "Pajak Proyek" | "Lainnya";
      nominal: number;
      sumberKasBank: string;
    }>;
  } | null;
  breakdownSummary?: {
    totalGross: number;
    totalDpp: number;
    totalDppNilaiLain: number;
    totalPpn: number;
    totalPph: number;
    totalNetBank: number;
    sisaKontrak: number;
  } | null;
};

type PhpRawLoadingDock = {
  id: string;
  nama: string;
  total: number;
  status: string;
  reviewedAt: string | null;
  createdAt: string;
  entity_key?: string;
  entity_name?: string;
};

// PHP GET /api/piutang?entityKey=... response shape
type PhpPiutangResponse = {
  entity: { id: string; key: string; name: string };
  saldoAntarEntitas: Record<string, number>;
  projects: PhpRawProject[];
  loadingDock: PhpRawLoadingDock[];
};

function fmt(n: number): string {
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}

function fmtDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function mapRawProject(p: PhpRawProject): ProjectItem {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadlineDate = p.deadline ? new Date(p.deadline) : null;
  const isOverdue =
    p.status === "ACTIVE" &&
    deadlineDate !== null &&
    deadlineDate < today;

  // Sum of nominally paid termin (PHP PDO may return DECIMAL as string, so coerce)
  const terminTagih = p.termin.reduce((sum, t) => sum + (Number(t.nominal) || 0), 0);
  const sisaTagih = Math.max(0, Number(p.contractValue) - terminTagih);
  const maxPercentage = p.termin.reduce((max, t) => Math.max(max, Number(t.percentage) || 0), 0);

  const termins: TerminItem[] = p.termin.map((t) => {
    const nom = Number(t.nominal) || 0;
    const bd = t.breakdown;
    const breakdown: TerminBreakdown = bd
      ? {
          noBukti: bd.noBukti ?? null,
          tanggalTerimaFmt: fmtDate(bd.tanggalTerima),
          bank: bd.bank ?? null,
          gross: Number(bd.gross) || nom,
          grossFmt: fmt(Number(bd.gross) || nom),
          dpp: Number(bd.dpp) || nom,
          dppFmt: fmt(Number(bd.dpp) || nom),
          dppNilaiLain: Number(bd.dppNilaiLain) || 0,
          dppNilaiLainFmt: fmt(Number(bd.dppNilaiLain) || 0),
          ppn: Number(bd.ppn) || 0,
          ppnFmt: fmt(Number(bd.ppn) || 0),
          tarifPpnPersen: Number(bd.tarifPpnPersen) || 0,
          pph: Number(bd.pph) || 0,
          pphFmt: fmt(Number(bd.pph) || 0),
          tarifPphPersen: Number(bd.tarifPphPersen) || 0,
          pphItems: (bd.pphItems || []).map((pi) => ({
            name: pi.name,
            amount: Number(pi.amount) || 0,
            amountFmt: fmt(Number(pi.amount) || 0),
          })),
          netBank: Number(bd.netBank) || nom,
          netBankFmt: fmt(Number(bd.netBank) || nom),
          jurnalRows: (bd.jurnalRows || []).map((jr) => ({
            coaCode: jr.coaCode,
            coaName: jr.coaName,
            debit: Number(jr.debit) || 0,
            kredit: Number(jr.kredit) || 0,
            debitFmt: fmt(Number(jr.debit) || 0),
            kreditFmt: fmt(Number(jr.kredit) || 0),
          })),
        }
      : {
          noBukti: null,
          tanggalTerimaFmt: null,
          bank: null,
          gross: nom,
          grossFmt: fmt(nom),
          dpp: nom,
          dppFmt: fmt(nom),
          dppNilaiLain: 0,
          dppNilaiLainFmt: fmt(0),
          ppn: 0,
          ppnFmt: fmt(0),
          tarifPpnPersen: 0,
          pph: 0,
          pphFmt: fmt(0),
          tarifPphPersen: 0,
          pphItems: [],
          netBank: nom,
          netBankFmt: fmt(nom),
          jurnalRows: [],
        };

    return {
      id: t.id,
      name: t.name,
      percentage: t.percentage != null ? Number(t.percentage) : undefined,
      nominal: nom,
      nominalFmt: fmt(nom),
      status: t.status,
      auditedAt: t.auditedAt,
      auditedByName: null,
      breakdown,
    };
  });

  const bds = p.breakdownSummary;
  const totalGross = bds ? Number(bds.totalGross) : terminTagih;
  const breakdownSummary: ProjectBreakdownSummary = {
    totalGross,
    totalGrossFmt: fmt(totalGross),
    totalDpp: bds ? Number(bds.totalDpp) : totalGross,
    totalDppFmt: fmt(bds ? Number(bds.totalDpp) : totalGross),
    totalDppNilaiLain: bds ? Number(bds.totalDppNilaiLain) : 0,
    totalDppNilaiLainFmt: fmt(bds ? Number(bds.totalDppNilaiLain) : 0),
    totalPpn: bds ? Number(bds.totalPpn) : 0,
    totalPpnFmt: fmt(bds ? Number(bds.totalPpn) : 0),
    totalPph: bds ? Number(bds.totalPph) : 0,
    totalPphFmt: fmt(bds ? Number(bds.totalPph) : 0),
    totalNetBank: bds ? Number(bds.totalNetBank) : totalGross,
    totalNetBankFmt: fmt(bds ? Number(bds.totalNetBank) : totalGross),
    sisaKontrak: bds ? Number(bds.sisaKontrak) : sisaTagih,
    sisaKontrakFmt: fmt(bds ? Number(bds.sisaKontrak) : sisaTagih),
  };

  const es = p.expensesSummary;
  const spend = es ? Number(es.totalPengeluaran) : (Number(p.spend) || 0);
  const labaKotor = terminTagih - spend;

  const expenseItems: ProjectExpenseItem[] = (es?.items || []).map((item) => ({
    id: item.id,
    tanggal: item.tanggal,
    tanggalFmt: fmtDate(item.tanggal),
    noBukti: item.noBukti,
    keterangan: item.keterangan,
    coaCode: item.coaCode,
    coaName: item.coaName,
    kategoriBeban: item.kategoriBeban,
    nominal: Number(item.nominal) || 0,
    nominalFmt: fmt(Number(item.nominal) || 0),
    sumberKasBank: item.sumberKasBank || "Kas / Bank",
  }));

  const expensesSummary: ProjectExpensesSummary = {
    totalPengeluaran: spend,
    totalPengeluaranFmt: fmt(spend),
    totalGaji: es ? Number(es.totalGaji) : 0,
    totalGajiFmt: fmt(es ? Number(es.totalGaji) : 0),
    totalMaterial: es ? Number(es.totalMaterial) : 0,
    totalMaterialFmt: fmt(es ? Number(es.totalMaterial) : 0),
    totalOperasional: es ? Number(es.totalOperasional) : 0,
    totalOperasionalFmt: fmt(es ? Number(es.totalOperasional) : 0),
    totalPajak: es ? Number(es.totalPajak) : 0,
    totalPajakFmt: fmt(es ? Number(es.totalPajak) : 0),
    totalLainnya: es ? Number(es.totalLainnya) : spend,
    totalLainnyaFmt: fmt(es ? Number(es.totalLainnya) : spend),
    labaKotor,
    labaKotorFmt: fmt(labaKotor),
    items: expenseItems,
  };

  return {
    id: p.id,
    code: p.code,
    name: p.name,
    entityName: p.entity_name,
    entityKey: p.entity_key,
    contractValue: Number(p.contractValue) || 0,
    contractValueFmt: fmt(Number(p.contractValue) || 0),
    deadlineFmt: fmtDate(p.deadline),
    isOverdue,
    status: p.status,
    maxPercentage,
    terminTagih,
    terminTagihFmt: fmt(terminTagih),
    sisaTagih,
    sisaTagihFmt: fmt(sisaTagih),
    termin: termins,
    breakdownSummary,
    expensesSummary,
  };
}

export async function getPiutangData(entityId: string | string[]): Promise<PiutangData> {
  const token = await getPhpToken();
  // PHP only supports singular entityKey — always use the first one
  const key = Array.isArray(entityId) ? entityId[0] : entityId;

  const raw = await phpFetch<PhpPiutangResponse>(
    `/api/piutang?entityKey=${encodeURIComponent(key)}`,
    token
  );

  const projectList = (raw.projects ?? []).map(mapRawProject);

  const activeProjects = projectList.filter((p) => p.status === "ACTIVE");
  const totalKontrak = activeProjects.reduce((s, p) => s + p.contractValue, 0);
  const totalTerminTagih = activeProjects.reduce((s, p) => s + p.terminTagih, 0);
  const sisaPiutang = Math.max(0, totalKontrak - totalTerminTagih);

  const summary: PiutangSummary = {
    totalKontrak,
    totalKontrakFmt: fmt(totalKontrak),
    totalTerminTagih,
    totalTerminTagihFmt: fmt(totalTerminTagih),
    sisaPiutang,
    sisaPiutangFmt: fmt(sisaPiutang),
    jumlahProyek: activeProjects.length,
  };

  const loadingDockList = (raw.loadingDock ?? []).map((ld) => ({
    id: ld.id,
    nama: ld.nama,
    totalFmt: fmt(ld.total ?? 0),
    status: ld.status,
    createdAt: ld.createdAt,
  }));

  return { projectList, summary, loadingDockList };
}
