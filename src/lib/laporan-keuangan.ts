import { phpFetch, getPhpToken } from "./api-client";
import { formatRupiah } from "./dashboard-data";

export type CoaLine = {
  code: string;
  name: string;
  saldo: number;
  saldoFmt: string;
  isContra?: boolean;
};

export type ReportVersion = "INTERNAL" | "UMUM";

export type LaporanKeuanganData = {
  pendapatan: CoaLine[];
  beban: CoaLine[];
  totalPendapatan: number;
  totalBeban: number;
  labaBersih: number;
  totalPendapatanFmt: string;
  totalBebanFmt: string;
  labaBersihFmt: string;
  labaBersihPositive: boolean;
  aktivaLancar: CoaLine[];
  aktivaTetap: CoaLine[];
  totalAktivaLancar: number;
  totalAktivaTetap: number;
  totalAktiva: number;
  totalAktivaLancarFmt: string;
  totalAktivaTetapFmt: string;
  totalAktivaFmt: string;
  aset: CoaLine[];
  kewajiban: CoaLine[];
  modal: CoaLine[];
  totalAset: number;
  totalKewajiban: number;
  totalModal: number;
  totalPassiva: number;
  labaDitahan: number;
  labaDitahanFmt: string;
  totalLabaDitahan: number;
  totalLabaDitahanFmt: string;
  totalEkuitas: number;
  totalEkuitasFmt: string;
  totalModalDanLabaFmt: string;
  neracaBalanced: boolean;
  totalAsetFmt: string;
  totalKewajibanFmt: string;
  totalModalFmt: string;
  totalPassivaFmt: string;
  kasAwal: number;
  kasOperasi: number;
  kasInvestasi: number;
  kasPendanaan: number;
  kenaikanBersihKas: number;
  kasAkhir: number;
  totalKasBank: number;
  arusKasBalanced: boolean;
  perubahanAsetNonKas: number;
  perubahanKewajiban: number;
  penyesuaianNonKas: number;
  penyesuaianNonKasFmt: string;
  penyusutanOtomatis: number;
  akumulasiPenyusutanOtomatis: number;
  kasAwalFmt: string;
  kasOperasiFmt: string;
  kasInvestasiFmt: string;
  kasPendanaanFmt: string;
  kenaikanBersihFmt: string;
  kasAkhirFmt: string;
  kasAsetFmt: string;
  version: ReportVersion;
};

// Raw shape that PHP actually returns
type PhpCoaLine = {
  code: string;
  name: string;
  saldo: number;
  debit?: number;
  kredit?: number;
  isAuto?: boolean;
  isNetting?: boolean;
  labaBerjalan?: number;
};

type PhpLaporanKeuanganRaw = {
  entityIds: string[];
  entities: { id: string; key: string; name: string }[];
  year: number;
  version: string;
  labaRugi: {
    pendapatan: PhpCoaLine[];
    beban: PhpCoaLine[];
    totalPendapatan: number;
    totalBeban: number;
    labaBersih: number;
    bebanPenyusutan: number;
  };
  neraca: {
    aktivaLancar: PhpCoaLine[];
    aktivaTetap: PhpCoaLine[];
    kewajiban: PhpCoaLine[];
    modal: PhpCoaLine[];
    totalAktivaLancar: number;
    totalAktivaTetap: number;
    totalAktiva: number;
    totalKewajiban: number;
    totalModal: number;
    totalKewajibanModal: number;
    akumulasiPenyusutan: number;
  };
  arusKas: {
    monthly: {
      bulan: number;
      namaBulan: string;
      masuk: number;
      keluar: number;
      neto: number;
    }[];
    totalMasuk: number;
    totalKeluar: number;
    totalNeto: number;
  };
};

function toCoaLine(item: PhpCoaLine): CoaLine {
  const saldo = Number(item.saldo) || 0;
  return {
    code: item.code ?? "",
    name: item.name ?? "",
    saldo,
    saldoFmt: formatRupiah(Math.abs(saldo)),
    isContra: saldo < 0,
  };
}

export async function getLaporanKeuanganData(
  entityIds: string[] | string,
  year: number,
  version: ReportVersion | string = "INTERNAL"
): Promise<LaporanKeuanganData> {
  const token = await getPhpToken();
  const ids = Array.isArray(entityIds) ? entityIds : [entityIds];
  const params = new URLSearchParams();
  ids.forEach((id) => params.append("entityIds[]", id));
  params.set("year", String(year));
  params.set("version", String(version));

  const raw = await phpFetch<PhpLaporanKeuanganRaw>(
    `/api/laporan-keuangan?${params.toString()}`,
    token
  );

  // ── Extract nested sections ──────────────────────────────────────────────────
  const lr = raw.labaRugi;
  const neraca = raw.neraca;
  const ak = raw.arusKas;

  // ── Laba Rugi ────────────────────────────────────────────────────────────────
  const pendapatan = (lr.pendapatan ?? []).map(toCoaLine);
  const beban = (lr.beban ?? []).map(toCoaLine);
  const totalPendapatan = Number(lr.totalPendapatan) || 0;
  const totalBeban = Number(lr.totalBeban) || 0;
  const labaBersih = Number(lr.labaBersih) || 0;
  const penyusutanOtomatis = Number(lr.bebanPenyusutan) || 0;

  // ── Neraca ───────────────────────────────────────────────────────────────────
  const aktivaLancar = (neraca.aktivaLancar ?? []).map(toCoaLine);
  const aktivaTetap = (neraca.aktivaTetap ?? []).map(toCoaLine);
  const kewajibanLines = (neraca.kewajiban ?? []).map(toCoaLine);
  const modalLines = (neraca.modal ?? []).map(toCoaLine);

  const totalAktivaLancar = Number(neraca.totalAktivaLancar) || 0;
  const totalAktivaTetap = Number(neraca.totalAktivaTetap) || 0;
  const totalAktiva = Number(neraca.totalAktiva) || 0;
  const totalKewajiban = Number(neraca.totalKewajiban) || 0;
  const totalModal = Number(neraca.totalModal) || 0;
  const totalKewajibanModal = Number(neraca.totalKewajibanModal) || 0;
  const akumulasiPenyusutan = Number(neraca.akumulasiPenyusutan) || 0;

  // "aset" = combined aktiva lancar + aktiva tetap (for components that use data.aset)
  const aset: CoaLine[] = [...aktivaLancar, ...aktivaTetap];

  // Laba ditahan: find modal entry that has labaBerjalan flag (PHP marks it)
  const labaDitahanEntry = (neraca.modal ?? []).find((m) => m.labaBerjalan !== undefined);
  // labaDitahan is the modal saldo BEFORE labaBerjalan was added
  const labaDitahan = labaDitahanEntry
    ? (Number(labaDitahanEntry.saldo) || 0) - (Number(labaDitahanEntry.labaBerjalan) || 0)
    : 0;

  // Total pasiva = kewajiban + modal (incl. laba berjalan already baked into modal entries by PHP)
  const totalPassiva = totalKewajibanModal;
  const totalEkuitas = totalModal;

  // modalDanLaba = modal + laba bersih tahun berjalan
  const totalModalDanLaba = totalModal; // PHP already adds labaBersih into modal entries

  const neracaBalanced = Math.abs(totalAktiva - totalPassiva) < 1;

  // ── Arus Kas (simplified indirect method from PHP monthly data) ──────────────
  // PHP returns monthly masuk/keluar for ARUS_KAS-typed CoA accounts.
  // Derive high-level summary:
  const totalMasuk = Number(ak.totalMasuk) || 0;
  const totalKeluar = Number(ak.totalKeluar) || 0;
  const totalNeto = Number(ak.totalNeto) || 0;

  // kasOperasi ≈ laba bersih + penyesuaian non-kas + perubahan aset/kewajiban
  // Since PHP doesn't break it down, use totalNeto as kasOperasi approximation
  // and derive kasAkhir from neraca (saldo kas+bank aset lancar)
  const kasOperasi = totalNeto;
  const kasInvestasi = 0; // PHP doesn't return investasi breakdown separately
  const kasPendanaan = 0; // PHP doesn't return pendanaan breakdown separately

  // Kas awal = zero (PHP doesn't compute it; would need SaldoAwal query)
  const kasAwal = 0;
  const kenaikanBersihKas = kasOperasi + kasInvestasi + kasPendanaan;
  const kasAkhir = kasAwal + kenaikanBersihKas;

  // Total kas+bank from aktiva lancar (codes starting with 1 typically = kas/bank aset)
  const totalKasBank = aktivaLancar
    .filter((a) => /^1/.test(a.code))
    .reduce((s, a) => s + a.saldo, 0);

  const arusKasBalanced = Math.abs(kasAkhir - totalKasBank) < 1 || totalKasBank === 0;

  const perubahanAsetNonKas = 0;
  const perubahanKewajiban = 0;
  const penyesuaianNonKas = penyusutanOtomatis;

  // ── Format helpers ───────────────────────────────────────────────────────────
  return {
    pendapatan,
    beban,
    totalPendapatan,
    totalBeban,
    labaBersih,
    totalPendapatanFmt: formatRupiah(totalPendapatan),
    totalBebanFmt: formatRupiah(totalBeban),
    labaBersihFmt: formatRupiah(Math.abs(labaBersih)),
    labaBersihPositive: labaBersih >= 0,

    aktivaLancar,
    aktivaTetap,
    totalAktivaLancar,
    totalAktivaTetap,
    totalAktiva,
    totalAktivaLancarFmt: formatRupiah(totalAktivaLancar),
    totalAktivaTetapFmt: formatRupiah(totalAktivaTetap),
    totalAktivaFmt: formatRupiah(totalAktiva),

    aset,
    kewajiban: kewajibanLines,
    modal: modalLines,
    totalAset: totalAktiva,
    totalKewajiban,
    totalModal,
    totalPassiva,
    labaDitahan,
    labaDitahanFmt: formatRupiah(Math.abs(labaDitahan)),
    totalLabaDitahan: labaDitahan,
    totalLabaDitahanFmt: formatRupiah(Math.abs(labaDitahan)),
    totalEkuitas,
    totalEkuitasFmt: formatRupiah(totalEkuitas),
    totalModalDanLabaFmt: formatRupiah(totalModalDanLaba),
    neracaBalanced,
    totalAsetFmt: formatRupiah(totalAktiva),
    totalKewajibanFmt: formatRupiah(totalKewajiban),
    totalModalFmt: formatRupiah(totalModal),
    totalPassivaFmt: formatRupiah(totalPassiva),

    kasAwal,
    kasOperasi,
    kasInvestasi,
    kasPendanaan,
    kenaikanBersihKas,
    kasAkhir,
    totalKasBank,
    arusKasBalanced,
    perubahanAsetNonKas,
    perubahanKewajiban,
    penyesuaianNonKas,
    penyesuaianNonKasFmt: formatRupiah(penyesuaianNonKas),
    penyusutanOtomatis,
    akumulasiPenyusutanOtomatis: akumulasiPenyusutan,
    kasAwalFmt: formatRupiah(kasAwal),
    kasOperasiFmt: formatRupiah(Math.abs(kasOperasi)),
    kasInvestasiFmt: formatRupiah(Math.abs(kasInvestasi)),
    kasPendanaanFmt: formatRupiah(Math.abs(kasPendanaan)),
    kenaikanBersihFmt: formatRupiah(Math.abs(kenaikanBersihKas)),
    kasAkhirFmt: formatRupiah(Math.abs(kasAkhir)),
    kasAsetFmt: formatRupiah(totalKasBank),
    version: (raw.version as ReportVersion) ?? (version as ReportVersion),
  };
}

export type LaporanJurnalRow = {
  id: string;
  tanggal: string;
  tanggalRaw: Date;
  noBukti: string;
  entityKey: string;
  entityName: string;
  entityColor: string;
  sumberKey: string;
  sumberLabel: string;
  sumberBg: string;
  sumberColor: string;
  keterangan: string;
  isKasEntry: boolean;
  isKredit: boolean;
  kodeAkun: string;
  namaAkun: string;
  debit: number;
  kredit: number;
  debitFmt: string;
  kreditFmt: string;
  staffName: string;
};

export type LaporanJurnalResult = {
  totalCount: number;
  totalDebit: number;
  totalKredit: number;
  totalDebitFmt: string;
  totalKreditFmt: string;
  isBalanced: boolean;
  rows: LaporanJurnalRow[];
};

// jurnal.php reads entityId (singular) — send only the first id.
// For multi-entity group views the laporan/page.tsx calls this per-entity already
// via Promise.all, so passing the first id here is correct for the single-call case.
export async function getLaporanJurnalData(
  entityIds: string[] | string,
  year: number,
  limit = 80,
  filterSumber?: string
): Promise<LaporanJurnalResult> {
  const token = await getPhpToken();
  const ids = Array.isArray(entityIds) ? entityIds : [entityIds];
  const firstId = ids[0] ?? "";
  const params = new URLSearchParams();
  params.set("entityId", firstId);
  params.set("dari", `${year}-01-01`);
  params.set("sampai", `${year}-12-31`);
  if (filterSumber && filterSumber !== "semua") params.set("jenisInputKey", filterSumber);
  params.set("page", "1");

  const raw = await phpFetch<{
    rows: Record<string, unknown>[];
    totalDebit: number;
    totalKredit: number;
    isBalanced: boolean;
    totalCount: number;
  }>(`/api/jurnal?${params.toString()}`, token);

  return {
    totalCount: raw.totalCount ?? 0,
    totalDebit: Number(raw.totalDebit) || 0,
    totalKredit: Number(raw.totalKredit) || 0,
    totalDebitFmt: formatRupiah(Number(raw.totalDebit) || 0),
    totalKreditFmt: formatRupiah(Number(raw.totalKredit) || 0),
    isBalanced: Boolean(raw.isBalanced),
    rows: (raw.rows ?? []) as LaporanJurnalRow[],
  };
}

export type LaporanBankRow = {
  id: string;
  tanggal: string;
  tanggalRaw: Date;
  noBukti: string;
  entityKey: string;
  entityName: string;
  entityColor: string;
  rekeningNama: string;
  keterangan: string;
  isKasEntry: boolean;
  kodeAkun: string;
  namaAkun: string;
  penerimaan: number;
  pengeluaran: number;
  penerimaanFmt: string;
  pengeluaranFmt: string;
  saldoSetelah: number;
  saldoSetelahFmt: string;
  staffName: string;
};

export type LaporanBankResult = {
  totalCount: number;
  totalPenerimaan: number;
  totalPengeluaran: number;
  totalPenerimaanFmt: string;
  totalPengeluaranFmt: string;
  netMutasi: number;
  netMutasiFmt: string;
  netPositive: boolean;
  rows: LaporanBankRow[];
};

// kas.php ledger reads entityId (singular) — send only the first id.
export async function getLaporanBankData(
  entityIds: string[] | string,
  year: number,
  limit = 80
): Promise<LaporanBankResult> {
  const token = await getPhpToken();
  const ids = Array.isArray(entityIds) ? entityIds : [entityIds];
  const firstId = ids[0] ?? "";
  const params = new URLSearchParams();
  params.set("entityId", firstId);
  params.set("jenisInputKey", "bankBuku");
  params.set("dari", `${year}-01-01`);
  params.set("sampai", `${year}-12-31`);
  params.set("page", "1");

  const raw = await phpFetch<{
    rows: Record<string, unknown>[];
    totalDebit: number;
    totalKredit: number;
    isBalanced: boolean;
    totalCount: number;
  }>(`/api/kas/ledger?${params.toString()}`, token);

  const totalPenerimaan = Number(raw.totalDebit) || 0;
  const totalPengeluaran = Number(raw.totalKredit) || 0;
  const netMutasi = totalPenerimaan - totalPengeluaran;

  return {
    totalCount: raw.totalCount ?? 0,
    totalPenerimaan,
    totalPengeluaran,
    totalPenerimaanFmt: formatRupiah(totalPenerimaan),
    totalPengeluaranFmt: formatRupiah(totalPengeluaran),
    netMutasi,
    netMutasiFmt: formatRupiah(Math.abs(netMutasi)),
    netPositive: netMutasi >= 0,
    rows: (raw.rows ?? []) as LaporanBankRow[],
  };
}
