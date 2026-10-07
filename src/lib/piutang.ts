import { prisma } from "./prisma";
import { formatRupiah } from "./dashboard-data";
import { hitungDppDariKwitansi, hitungDppNilaiLain } from "./pendapatan";
import { TerminStatus } from "@prisma/client";

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

export async function getPiutangData(entityId: string | string[]) {
  const ids = Array.isArray(entityId) ? entityId : [entityId];
  const [projects, loadingDockList] = await Promise.all([
    prisma.project.findMany({
      where: { entityId: { in: ids }, status: { in: ["ACTIVE", "CANCELLED", "COMPLETED"] } },
      include: {
        entity: { select: { id: true, key: true, name: true } },
        termin: {
          include: { auditedBy: { select: { name: true } } },
          orderBy: { createdAt: "asc" },
        },
        fakturPendapatan: {
          orderBy: { tanggalTerima: "asc" },
        },
        jurnal: {
          include: { coaAccount: true, jenisInput: true },
          orderBy: { tanggal: "desc" },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.loadingDockTransaksi.findMany({
      where: { entityId: { in: ids } },
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

      // Ekstrak noBukti dari nama termin, contoh: [pdppt]
      const noBuktiMatch = t.name.match(/\[(.*?)\]/);
      const noBukti = noBuktiMatch ? noBuktiMatch[1] : null;

      // Cari faktur terkait proyek & noBukti
      const matchedFaktur = p.fakturPendapatan.find(
        (f) => (noBukti && f.noFaktur === noBukti) || Number(f.nilaiProyek) === nominalTermin
      );

      // Cari transaksi jurnal terkait noBukti
      const matchedJurnals = p.jurnal.filter(
        (j) => noBukti && j.noBukti === noBukti
      );

      let gross = nominalTermin;
      let dpp = hitungDppDariKwitansi(gross);
      let dppNilaiLain = hitungDppNilaiLain(dpp);
      let tarifPpn = 12;
      let ppn = Math.round((dppNilaiLain * tarifPpn) / 100);
      let tarifPph = 3.5;
      let pph = Math.round((dpp * tarifPph) / 100);
      let netBank = Math.max(0, gross - ppn - pph);
      let bankName = "BPD";
      let tanggalFmt = t.createdAt.toLocaleDateString("id-ID");

      if (matchedJurnals.length > 0) {
        // Realisasi Eksklusif dari Entry Jurnal Umum (Issue 85: Anti-Double Counting)
        const incomeRows = matchedJurnals.filter(
          (j) =>
            j.coaAccount &&
            (j.coaAccount.kategori === "PENDAPATAN" ||
              /pendapatan/i.test(j.coaAccount.name) ||
              j.coaAccount.code === "400") &&
            Number(j.kredit) > 0
        );
        const pphDebitRows = matchedJurnals.filter(
          (j) => j.coaAccount && /pph|pajak/i.test(j.coaAccount.name) && Number(j.debit) > 0
        );
        const ppnRows = matchedJurnals.filter(
          (j) => j.coaAccount && /ppn/i.test(j.coaAccount.name) && Number(j.debit || j.kredit) > 0
        );
        const bankDebitRows = matchedJurnals.filter(
          (j) => j.coaAccount && /bank|kas|bpd|bri|bni|mdr/i.test(j.coaAccount.name) && Number(j.debit) > 0
        );

        const totalIncomeJurnal = incomeRows.reduce((sum, j) => sum + Number(j.kredit), 0);
        if (totalIncomeJurnal > 0) gross = totalIncomeJurnal;

        const pphDebit = pphDebitRows.reduce((sum, j) => sum + Number(j.debit), 0);
        if (pphDebit > 0) pph = pphDebit;

        const ppnVal = ppnRows.reduce((sum, j) => sum + Number(j.debit || j.kredit), 0);
        if (ppnVal > 0) ppn = ppnVal;

        const bankDebit = bankDebitRows.reduce((sum, j) => sum + Number(j.debit), 0);
        if (bankDebit > 0) netBank = bankDebit;

        if (bankDebitRows.length > 0 && bankDebitRows[0].coaAccount) {
          bankName = bankDebitRows[0].coaAccount.name;
        }
        if (matchedJurnals[0]?.tanggal) {
          tanggalFmt = matchedJurnals[0].tanggal.toLocaleDateString("id-ID");
        }

        if (matchedFaktur) {
          dpp = Number(matchedFaktur.dpp) || hitungDppDariKwitansi(gross);
          dppNilaiLain = Number(matchedFaktur.dppNilaiLain) || hitungDppNilaiLain(dpp);
          tarifPpn = Number(matchedFaktur.tarifPpnPersen);
          tarifPph = Number(matchedFaktur.tarifPphPersen);
        } else {
          dpp = hitungDppDariKwitansi(gross);
          dppNilaiLain = hitungDppNilaiLain(dpp);
        }
      } else if (matchedFaktur) {
        gross = Number(matchedFaktur.nilaiProyek) || nominalTermin;
        dpp = Number(matchedFaktur.dpp);
        dppNilaiLain = Number(matchedFaktur.dppNilaiLain);
        tarifPpn = Number(matchedFaktur.tarifPpnPersen);
        tarifPph = Number(matchedFaktur.tarifPphPersen);
        ppn = Number(matchedFaktur.ppn);
        pph = Number(matchedFaktur.pph);
        netBank = Number(matchedFaktur.nominalDiterima);
        bankName = matchedFaktur.bank || "-";
        tanggalFmt = matchedFaktur.tanggalTerima ? matchedFaktur.tanggalTerima.toLocaleDateString("id-ID") : "-";
      }

      const pphDebitRows = matchedJurnals.filter(
        (j) => j.coaAccount && /pph|pajak/i.test(j.coaAccount.name) && Number(j.debit) > 0
      );
      const pphItems =
        pphDebitRows.length > 0
          ? pphDebitRows.map((j) => ({
              name: j.coaAccount?.name || "Potongan PPh Proyek",
              amount: Number(j.debit),
              amountFmt: formatRupiah(Number(j.debit)),
            }))
          : pph > 0
          ? [
              {
                name: `Potongan PPh (${tarifPph}%)`,
                amount: pph,
                amountFmt: formatRupiah(pph),
              },
            ]
          : [];

      const jurnalRows = matchedJurnals.map((j) => ({
        coaCode: j.coaAccount?.code || "-",
        coaName: j.coaAccount?.name || "-",
        debit: Number(j.debit),
        kredit: Number(j.kredit),
        debitFmt: formatRupiah(Number(j.debit)),
        kreditFmt: formatRupiah(Number(j.kredit)),
      }));

      const breakdown: TerminBreakdown = {
        noBukti,
        tanggalTerimaFmt: tanggalFmt,
        bank: bankName,
        gross,
        grossFmt: formatRupiah(gross),
        dpp,
        dppFmt: formatRupiah(dpp),
        dppNilaiLain,
        dppNilaiLainFmt: formatRupiah(dppNilaiLain),
        ppn,
        ppnFmt: formatRupiah(ppn),
        tarifPpnPersen: tarifPpn,
        pph,
        pphFmt: formatRupiah(pph),
        tarifPphPersen: tarifPph,
        pphItems,
        netBank,
        netBankFmt: formatRupiah(netBank),
        jurnalRows,
      };

      return {
        id: t.id,
        name: t.name,
        percentage: t.percentage,
        percentageDelta: deltaPct,
        nominal: gross,
        nominalFmt: formatRupiah(gross),
        status: t.status,
        auditedAt: t.auditedAt ? t.auditedAt.toLocaleDateString("id-ID") : null,
        auditedByName: t.auditedBy?.name ?? null,
        breakdown,
      };
    });

    const totalGross = terminItems.reduce((sum, t) => sum + t.breakdown.gross, 0);
    const totalDpp = terminItems.reduce((sum, t) => sum + t.breakdown.dpp, 0);
    const totalDppNilaiLain = terminItems.reduce((sum, t) => sum + t.breakdown.dppNilaiLain, 0);
    const totalPpn = terminItems.reduce((sum, t) => sum + t.breakdown.ppn, 0);
    const totalPph = terminItems.reduce((sum, t) => sum + t.breakdown.pph, 0);
    const totalNetBank = terminItems.reduce((sum, t) => sum + t.breakdown.netBank, 0);
    const sisaKontrak = isCancelled ? 0 : Math.max(0, contractValue - totalGross);

    const breakdownSummary: ProjectBreakdownSummary = {
      totalGross,
      totalGrossFmt: formatRupiah(totalGross),
      totalDpp,
      totalDppFmt: formatRupiah(totalDpp),
      totalDppNilaiLain,
      totalDppNilaiLainFmt: formatRupiah(totalDppNilaiLain),
      totalPpn,
      totalPpnFmt: formatRupiah(totalPpn),
      totalPph,
      totalPphFmt: formatRupiah(totalPph),
      totalNetBank,
      totalNetBankFmt: formatRupiah(totalNetBank),
      sisaKontrak,
      sisaKontrakFmt: formatRupiah(sisaKontrak),
    };

    // 1. Kumpulkan noBukti yang merupakan pendapatan termin (ada akun kategori PENDAPATAN atau kredit ke 400)
    const incomeNoBuktis = new Set<string>();
    p.jurnal.forEach((j) => {
      if (
        j.noBukti &&
        (j.coaAccount?.kategori === "PENDAPATAN" ||
          j.coaAccount?.code === "400" ||
          /pendapatan/i.test(j.coaAccount?.name ?? ""))
      ) {
        incomeNoBuktis.add(j.noBukti);
      }
    });
    p.termin.forEach((t) => {
      const m = t.name.match(/\[(.*?)\]/);
      if (m && m[1]) incomeNoBuktis.add(m[1]);
    });

    // 2. Kumpulkan baris pengeluaran proyek (Beban: Pembelian Material, Upah/Gaji, Operasional, Pajak Proyek, dll.)
    const expenseRows = p.jurnal.filter((j) => {
      // Jika transaksi ini merupakan penerimaan termin:
      // Hanya sertakan potongan pajak proyek (PPh/PPN/Pajak), abaikan kas/bank masuk atau piutang.
      if (j.noBukti && incomeNoBuktis.has(j.noBukti)) {
        const isTaxDeduction =
          Number(j.debit) > 0 &&
          (j.coaAccount?.kategori === "BEBAN" ||
            /pph|pajak|ppn|bupot/i.test(j.coaAccount?.name ?? "") ||
            /pph|pajak|ppn|potongan/i.test(j.keterangan ?? ""));
        return isTaxDeduction;
      }

      // Untuk transaksi non-pendapatan termin:
      const isBeban =
        j.coaAccount?.kategori === "BEBAN" ||
        j.coaAccount?.code?.startsWith("5") ||
        j.coaAccount?.code?.startsWith("6");
      if (isBeban && Number(j.debit) > 0) return true;
      if (Number(j.debit) > 0 && !/bank|kas|piutang/i.test(j.coaAccount?.name ?? "")) {
        return true;
      }
      return false;
    });

    const expenseItems: ProjectExpenseItem[] = expenseRows.map((j) => {
      const nominal = Number(j.debit);
      const txt = `${j.coaAccount?.name || ""} ${j.keterangan || ""}`.toLowerCase();
      let kategoriBeban: "Gaji & Upah" | "Bahan & Material" | "Operasional & Transport" | "Pajak Proyek" | "Lainnya" = "Lainnya";

      if (/pajak|pph|ppn|potongan pph|bupot/i.test(txt)) {
        kategoriBeban = "Pajak Proyek";
      } else if (/gaji|upah|mandor|tukang|honor|tenaga ahli/i.test(txt)) {
        kategoriBeban = "Gaji & Upah";
      } else if (/bahan|material|perlengkapan|semen|pasir|besi|batu|kayu|cat|baut|alat/i.test(txt)) {
        kategoriBeban = "Bahan & Material";
      } else if (/transport|perjalanan|bensin|bbm|solar|konsumsi|makan|listrik|telepon|pdam|survey|sewa|akomodasi/i.test(txt)) {
        kategoriBeban = "Operasional & Transport";
      }

      // Cari baris pasangan dengan noBukti yang sama yang memiliki kredit > 0 (sumber kas/bank)
      const counterpart = p.jurnal.find(
        (c) => c.noBukti === j.noBukti && Number(c.kredit) > 0 && c.id !== j.id
      );
      let sumberKasBank = counterpart?.coaAccount?.name || counterpart?.jenisInput?.nama || "Kas / Bank";
      if (
        counterpart &&
        (counterpart.coaAccount?.kategori === "PENDAPATAN" ||
          /pendapatan/i.test(counterpart.coaAccount?.name ?? ""))
      ) {
        sumberKasBank = "Potongan Penerimaan Termin";
      }

      return {
        id: j.id,
        tanggal: j.tanggal.toISOString(),
        tanggalFmt: j.tanggal.toLocaleDateString("id-ID"),
        noBukti: j.noBukti || "-",
        keterangan: j.keterangan || j.coaAccount?.name || "Pengeluaran Proyek",
        coaCode: j.coaAccount?.code || "-",
        coaName: j.coaAccount?.name || "-",
        kategoriBeban,
        nominal,
        nominalFmt: formatRupiah(nominal),
        sumberKasBank,
      };
    });

    let totalGaji = 0;
    let totalMaterial = 0;
    let totalOperasional = 0;
    let totalPajak = 0;
    let totalLainnya = 0;
    expenseItems.forEach((it) => {
      if (it.kategoriBeban === "Gaji & Upah") totalGaji += it.nominal;
      else if (it.kategoriBeban === "Bahan & Material") totalMaterial += it.nominal;
      else if (it.kategoriBeban === "Operasional & Transport") totalOperasional += it.nominal;
      else if (it.kategoriBeban === "Pajak Proyek") totalPajak += it.nominal;
      else totalLainnya += it.nominal;
    });

    let totalPengeluaran = expenseItems.reduce((acc, it) => acc + it.nominal, 0);
    if (totalPengeluaran === 0 && Number(p.spend) > 0) {
      totalPengeluaran = Number(p.spend);
    }

    const expensesSummary: ProjectExpensesSummary = {
      totalPengeluaran,
      totalPengeluaranFmt: formatRupiah(totalPengeluaran),
      totalGaji,
      totalGajiFmt: formatRupiah(totalGaji),
      totalMaterial,
      totalMaterialFmt: formatRupiah(totalMaterial),
      totalOperasional,
      totalOperasionalFmt: formatRupiah(totalOperasional),
      totalPajak,
      totalPajakFmt: formatRupiah(totalPajak),
      totalLainnya,
      totalLainnyaFmt: formatRupiah(totalLainnya),
      labaKotor: totalGross - totalPengeluaran,
      labaKotorFmt: formatRupiah(totalGross - totalPengeluaran),
      items: expenseItems,
    };

    const maxPct = isCompleted
      ? 100
      : (contractValue > 0 ? Math.min(100, Math.round((totalGross / contractValue) * 100)) : 0);
    const terminTagih = isCompleted ? contractValue : totalGross;
    const sisaTagih = sisaKontrak;

    // "Total Nilai Kontrak Aktif" cuma menjumlah proyek yang masih aktif
    if (!isCancelled && !isCompleted) {
      totalKontrak += contractValue;
      totalTerminTagih += terminTagih;
    }

    return {
      id: p.id,
      code: p.code,
      name: p.name,
      entityName: p.entity?.name,
      entityKey: p.entity?.key,
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
      breakdownSummary,
      expensesSummary,
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

/**
 * Sinkronisasi kolom `spend` pada model Project dengan data Jurnal Umum.
 * Menghitung akumulasi pengeluaran riil termasuk potongan pajak proyek (Issue 85).
 */
export async function syncProjectSpend(projectId: string): Promise<number> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      jurnal: {
        include: { coaAccount: true },
      },
    },
  });
  if (!project) return 0;

  const incomeNoBuktis = new Set<string>();
  project.jurnal.forEach((j) => {
    if (
      j.noBukti &&
      (j.coaAccount?.kategori === "PENDAPATAN" ||
        j.coaAccount?.code === "400" ||
        /pendapatan/i.test(j.coaAccount?.name ?? ""))
    ) {
      incomeNoBuktis.add(j.noBukti);
    }
  });

  let totalSpend = 0;
  for (const j of project.jurnal) {
    if (j.noBukti && incomeNoBuktis.has(j.noBukti)) {
      const isTaxDeduction =
        Number(j.debit) > 0 &&
        (j.coaAccount?.kategori === "BEBAN" ||
          /pph|pajak|ppn|bupot/i.test(j.coaAccount?.name ?? "") ||
          /pph|pajak|ppn|potongan/i.test(j.keterangan ?? ""));
      if (isTaxDeduction) totalSpend += Number(j.debit);
    } else {
      const isBeban =
        j.coaAccount?.kategori === "BEBAN" ||
        j.coaAccount?.code?.startsWith("5") ||
        j.coaAccount?.code?.startsWith("6");
      if (isBeban && Number(j.debit) > 0) {
        totalSpend += Number(j.debit);
      } else if (Number(j.debit) > 0 && !/bank|kas|piutang/i.test(j.coaAccount?.name ?? "")) {
        totalSpend += Number(j.debit);
      }
    }
  }

  await prisma.project.update({
    where: { id: projectId },
    data: { spend: totalSpend },
  });

  return totalSpend;
}
