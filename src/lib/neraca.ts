import { phpFetch, getPhpToken } from "./api-client";
import { formatRupiah } from "./dashboard-data";
import { isContraAset } from "./akuntansi";
import type { RekapKategoriAset } from "./aset-tetap";

export type CoaLine = {
  code: string;
  name: string;
  saldo: number;
  saldoFmt: string;
  isContra?: boolean;
};

export type ReportVersion = "INTERNAL" | "UMUM";

export type NeracaData = {
  aktivaLancar: CoaLine[];
  aktivaTetap: CoaLine[];
  totalAktivaLancar: number;
  totalAktivaTetap: number;
  totalAktiva: number;
  totalAktivaLancarFmt: string;
  totalAktivaTetapFmt: string;
  totalAktivaFmt: string;
  // aset = aktivaLancar + aktivaTetap combined (alias for convenience)
  aset: CoaLine[];
  totalAset: number;
  totalAsetFmt: string;
  kewajiban: CoaLine[];
  totalKewajiban: number;
  totalKewajibanFmt: string;
  modal: CoaLine[];
  totalModal: number;
  totalModalFmt: string;
  labaDitahan: number;
  labaDitahanFmt: string;
  labaBersih: number;
  labaBersihFmt: string;
  labaBersihPositive: boolean;
  totalLabaDitahan: number;
  totalLabaDitahanFmt: string;
  totalEkuitas: number;
  totalEkuitasFmt: string;
  totalModalDanLabaFmt: string;
  totalPassiva: number;
  totalPassivaFmt: string;
  neracaBalanced: boolean;
  balanced: boolean;
  penyusutanOtomatis: number;
  akumulasiPenyusutanOtomatis: number;
  rekapPerKategoriAset: RekapKategoriAset[];
  version: ReportVersion;
};

// Shape returned by PHP
type PhpCoaEntry = {
  id?: string;
  code: string;
  name: string;
  kategori: string;
  saldo: number;
  isNetting?: boolean;
  isAuto?: boolean;
  isContra?: boolean;
  labaBerjalan?: number;
};

type PhpRekap = Record<string, { beban?: number; akumulasi?: number; count?: number; harga_perolehan?: number; nilai_buku?: number }>;

type PhpNeracaResponse = {
  entityId: string;
  year: number;
  version: string;
  aktivaLancar: PhpCoaEntry[];
  aktivaTetap: PhpCoaEntry[];
  kewajiban: PhpCoaEntry[];
  modal: PhpCoaEntry[];
  totalAktivaLancar: number;
  totalAktivaTetap: number;
  totalAktiva: number;
  totalKewajiban: number;
  totalModal: number;
  totalKewajibanModal: number;
  labaBersih: number;
  totalPendapatan: number;
  totalBeban: number;
  bebanPenyusutan: number;
  akumulasiPenyusutan: number;
  rekapPerKategoriAset?: PhpRekap;
  selisih: number;
};

const KATEGORI_LABELS: Record<string, string> = {
  TANAH: "Tanah",
  BANGUNAN: "Bangunan & Gedung",
  KENDARAAN: "Kendaraan",
  PERALATAN_KANTOR: "Peralatan & Inventaris",
};
const KATEGORI_ORDER = ["TANAH", "BANGUNAN", "KENDARAAN", "PERALATAN_KANTOR"];

function transformRekapPenyusutan(raw?: PhpRekap): RekapKategoriAset[] {
  if (!raw) {
    return KATEGORI_ORDER.map((kat) => ({
      kategori: kat,
      label: KATEGORI_LABELS[kat] ?? kat,
      jumlahAset: 0,
      totalHargaPerolehan: 0,
      totalHargaPerolehanFmt: "-",
      totalAkumulasiPenyusutan: 0,
      totalAkumulasiPenyusutanFmt: formatRupiah(0),
      totalBebanPenyusutan: 0,
      totalBebanPenyusutanFmt: formatRupiah(0),
      totalNilaiBuku: 0,
      totalNilaiBukuFmt: formatRupiah(0),
    }));
  }
  return KATEGORI_ORDER.map((kat) => {
    const r = raw[kat] ?? {};
    const hp = Number(r.harga_perolehan ?? 0);
    const akum = Number(r.akumulasi ?? 0);
    const beban = Number((r as { beban_penyusutan?: unknown }).beban_penyusutan ?? 0);
    const nb = Number(r.nilai_buku ?? Math.max(0, hp - akum));
    return {
      kategori: kat,
      label: KATEGORI_LABELS[kat] ?? kat,
      jumlahAset: Number(r.count ?? 0),
      totalHargaPerolehan: hp,
      totalHargaPerolehanFmt: hp > 0 ? formatRupiah(hp) : "-",
      totalAkumulasiPenyusutan: akum,
      totalAkumulasiPenyusutanFmt: formatRupiah(akum),
      totalBebanPenyusutan: beban,
      totalBebanPenyusutanFmt: formatRupiah(beban),
      totalNilaiBuku: nb,
      totalNilaiBukuFmt: formatRupiah(nb),
    };
  });
}

function toCoaLine(e: PhpCoaEntry): CoaLine {
  const isContra = Boolean(e.isContra || isContraAset(e.code) || (e.isAuto && e.code === "1001"));
  const abs = formatRupiah(Math.abs(e.saldo));
  return {
    code: e.code,
    name: e.name,
    saldo: e.saldo,
    saldoFmt: isContra ? `(${abs})` : (e.saldo < 0 ? `-${abs}` : abs),
    isContra,
  };
}

export async function getNeracaData(
  entityId: string,
  year: number,
  version: ReportVersion | string = "INTERNAL"
): Promise<NeracaData> {
  const token = await getPhpToken();
  const raw = await phpFetch<PhpNeracaResponse>(
    `/api/neraca?entityId=${encodeURIComponent(entityId)}&year=${year}&version=${encodeURIComponent(version)}`,
    token
  );

  const aktivaLancar = raw.aktivaLancar.map(toCoaLine);
  const aktivaTetap = raw.aktivaTetap.map(toCoaLine);
  const kewajiban = raw.kewajiban.map(toCoaLine);
  const modal = raw.modal.map(toCoaLine);

  const totalAktivaLancar = raw.totalAktivaLancar;
  const totalAktivaTetap = raw.totalAktivaTetap;
  const totalAktiva = raw.totalAktiva;
  const totalKewajiban = raw.totalKewajiban;
  const totalModal = raw.totalModal;
  const totalPassiva = raw.totalKewajibanModal;
  const labaBersih = raw.labaBersih;

  // aset = combined list (lancar first, then tetap)
  const aset: CoaLine[] = [...aktivaLancar, ...aktivaTetap];
  const totalAset = totalAktiva;

  // labaDitahan: find the entry that has labaBerjalan embedded (laba ditahan akun)
  const labaDitahanEntry = raw.modal.find((m) => m.labaBerjalan !== undefined);
  const labaDitahan = labaDitahanEntry
    ? labaDitahanEntry.saldo - (labaDitahanEntry.labaBerjalan ?? 0)
    : 0;
  const totalLabaDitahan = labaDitahan + labaBersih;

  // totalEkuitas = totalModal (already includes laba bersih berjalan)
  const totalEkuitas = totalModal;

  const balanced = Math.abs(totalAktiva - totalPassiva) < 1;

  return {
    aktivaLancar,
    aktivaTetap,
    totalAktivaLancar,
    totalAktivaTetap,
    totalAktiva,
    totalAktivaLancarFmt: formatRupiah(totalAktivaLancar),
    totalAktivaTetapFmt: formatRupiah(totalAktivaTetap),
    totalAktivaFmt: formatRupiah(totalAktiva),
    aset,
    totalAset,
    totalAsetFmt: formatRupiah(totalAset),
    kewajiban,
    totalKewajiban,
    totalKewajibanFmt: formatRupiah(totalKewajiban),
    modal,
    totalModal,
    totalModalFmt: formatRupiah(totalModal),
    labaDitahan,
    labaDitahanFmt: formatRupiah(Math.abs(labaDitahan)),
    labaBersih,
    labaBersihFmt: formatRupiah(Math.abs(labaBersih)),
    labaBersihPositive: labaBersih >= 0,
    totalLabaDitahan,
    totalLabaDitahanFmt: formatRupiah(Math.abs(totalLabaDitahan)),
    totalEkuitas,
    totalEkuitasFmt: formatRupiah(totalEkuitas),
    totalModalDanLabaFmt: formatRupiah(totalModal),
    totalPassiva,
    totalPassivaFmt: formatRupiah(totalPassiva),
    neracaBalanced: balanced,
    balanced,
    penyusutanOtomatis: raw.bebanPenyusutan,
    akumulasiPenyusutanOtomatis: raw.akumulasiPenyusutan,
    rekapPerKategoriAset: transformRekapPenyusutan(raw.rekapPerKategoriAset),
    version: (raw.version as ReportVersion) ?? (version as ReportVersion),
  };
}
