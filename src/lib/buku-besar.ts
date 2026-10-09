import { phpFetch, getPhpToken } from "./api-client";
import { formatRupiah } from "./dashboard-data";

export type BukuBesarRekapRow = {
  coaId: string;
  code: string;
  name: string;
  kategori: string;
  saldoAwal: number;
  totalDebet: number;
  totalKredit: number;
  saldoAkhir: number;
  saldoAwalFmt: string;
  totalDebetFmt: string;
  totalKreditFmt: string;
  saldoAkhirFmt: string;
  saldoAkhirNegatif: boolean;
};

export type BukuBesarRekapResult = {
  rows: BukuBesarRekapRow[];
  totalSemuaDebet: number;
  totalSemuaKredit: number;
  totalSemuaDebetFmt: string;
  totalSemuaKreditFmt: string;
  isBalanced: boolean;
};

// PHP returns: { view, year, data: [{ id, code, name, kategori, reportType, saldoAwal, totalDebit, totalKredit, saldoAkhir }] }
type PhpRekapRow = {
  id: string;
  code: string;
  name: string;
  kategori: string;
  reportType: string;
  saldoAwal: number;
  totalDebit: number;
  totalKredit: number;
  saldoAkhir: number;
};

type PhpRekapResponse = {
  view: string;
  year: number;
  data: PhpRekapRow[];
};

export async function getBukuBesarRekap(entityId: string, year: number): Promise<BukuBesarRekapResult> {
  const token = await getPhpToken();
  const raw = await phpFetch<PhpRekapResponse>(
    `/api/buku-besar?entityId=${encodeURIComponent(entityId)}&year=${year}&view=rekap`,
    token
  );

  const rows: BukuBesarRekapRow[] = raw.data.map((r) => {
    const saldoAkhir = r.saldoAkhir;
    return {
      coaId: r.id,
      code: r.code,
      name: r.name,
      kategori: r.kategori,
      saldoAwal: r.saldoAwal,
      totalDebet: r.totalDebit,
      totalKredit: r.totalKredit,
      saldoAkhir,
      saldoAwalFmt: formatRupiah(Math.abs(r.saldoAwal)),
      totalDebetFmt: formatRupiah(r.totalDebit),
      totalKreditFmt: formatRupiah(r.totalKredit),
      saldoAkhirFmt: formatRupiah(Math.abs(saldoAkhir)),
      saldoAkhirNegatif: saldoAkhir < 0,
    };
  });

  const totalSemuaDebet = rows.reduce((s, r) => s + r.totalDebet, 0);
  const totalSemuaKredit = rows.reduce((s, r) => s + r.totalKredit, 0);
  const isBalanced = Math.abs(totalSemuaDebet - totalSemuaKredit) < 1;

  return {
    rows,
    totalSemuaDebet,
    totalSemuaKredit,
    totalSemuaDebetFmt: formatRupiah(totalSemuaDebet),
    totalSemuaKreditFmt: formatRupiah(totalSemuaKredit),
    isBalanced,
  };
}

export type BukuBesarDrilldownEntry = {
  tanggal: string;
  noBukti: string;
  keterangan: string;
  debitFmt: string;
  kreditFmt: string;
  saldoFmt: string;
  saldoNegatif: boolean;
};

export type BukuBesarDrilldownResult = {
  coa: { id: string; code: string; name: string; kategori: string };
  entries: BukuBesarDrilldownEntry[];
  saldoAwal: number;
  saldoAwalFmt: string;
  saldoAwalNegatif: boolean;
  totalDebetFmt: string;
  totalKreditFmt: string;
  saldoAkhirFmt: string;
  saldoAkhirNegatif: boolean;
} | null;

// PHP returns: { view, year, akun: { id, code, name, kategori }, saldoAwal, totalDebit, totalKredit, saldoAkhir,
//               transactions: [{ id, tanggal, noBukti, keterangan, debit, kredit, saldoBerjalan, createdAt }] }
type PhpTransaction = {
  id: string;
  tanggal: string;
  noBukti: string;
  keterangan: string;
  debit: number;
  kredit: number;
  saldoBerjalan: number;
  createdAt: string;
};

type PhpDrilldownResponse = {
  view: string;
  year: number;
  akun: { id: string; code: string; name: string; kategori: string };
  saldoAwal: number;
  totalDebit: number;
  totalKredit: number;
  saldoAkhir: number;
  transactions: PhpTransaction[];
};

export async function getBukuBesarDrilldown(entityId: string, coaId: string, year: number): Promise<BukuBesarDrilldownResult> {
  const token = await getPhpToken();
  const raw = await phpFetch<PhpDrilldownResponse>(
    `/api/buku-besar?entityId=${encodeURIComponent(entityId)}&year=${year}&view=drilldown&coaId=${encodeURIComponent(coaId)}`,
    token
  );

  if (!raw || !raw.akun) return null;

  const entries: BukuBesarDrilldownEntry[] = raw.transactions.map((t) => ({
    tanggal: t.tanggal ? t.tanggal.slice(0, 10) : "",
    noBukti: t.noBukti,
    keterangan: t.keterangan,
    debitFmt: t.debit > 0 ? formatRupiah(t.debit) : "-",
    kreditFmt: t.kredit > 0 ? formatRupiah(t.kredit) : "-",
    saldoFmt: formatRupiah(Math.abs(t.saldoBerjalan)),
    saldoNegatif: t.saldoBerjalan < 0,
  }));

  return {
    coa: raw.akun,
    entries,
    saldoAwal: raw.saldoAwal,
    saldoAwalFmt: formatRupiah(Math.abs(raw.saldoAwal)),
    saldoAwalNegatif: raw.saldoAwal < 0,
    totalDebetFmt: formatRupiah(raw.totalDebit),
    totalKreditFmt: formatRupiah(raw.totalKredit),
    saldoAkhirFmt: formatRupiah(Math.abs(raw.saldoAkhir)),
    saldoAkhirNegatif: raw.saldoAkhir < 0,
  };
}
