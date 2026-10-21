export type GajiTenagaAhliBulan = {
  bulan: string;
  nominal: number | null;
  catatan: string;
};

export type ReferensiGajiTenagaAhli = {
  namaPekerjaan: string | null;
  manMonth: number | null;
  gajiRab: number | null;
  spmkMulai: string | null;
  spmkSelesai: string | null;
};

export type GajiTenagaAhliKontrak = ReferensiGajiTenagaAhli & {
  id: string;
  rekananId: string;
  projectId: string;
  sumber: "MANUAL" | "SIDAMON";
  gajiNegosiasi: number | null;
  basisNegosiasi: "BULAN" | "KONTRAK";
  jadwal: GajiTenagaAhliBulan[] | null;
  revision: number;
};

export type SaveGajiTenagaAhliKontrak = {
  rekananId: string;
  projectId: string;
  gajiNegosiasi: number;
  basisNegosiasi: "BULAN" | "KONTRAK";
  jadwal: GajiTenagaAhliBulan[];
  referensi: ReferensiGajiTenagaAhli;
  revision: number;
};

// Hindari perhitungan timezone dan pergeseran tanggal akhir bulan (misalnya 31 Januari).
export function bulanDariSpmk(mulai?: string | null, selesai?: string | null): GajiTenagaAhliBulan[] {
  if (!mulai || !selesai || mulai > selesai) return [];
  const valid = /^(20\d{2}|21\d{2})-(0[1-9]|1[0-2])-\d{2}$/;
  const validDate = (value: string) => {
    if (!valid.test(value)) return false;
    const [year, month, day] = value.split("-").map(Number);
    return day >= 1 && day <= new Date(year, month, 0).getDate();
  };
  if (!validDate(mulai) || !validDate(selesai)) return [];
  const [y1, m1] = mulai.split("-").map(Number);
  const [y2, m2] = selesai.split("-").map(Number);
  const count = (y2 - y1) * 12 + m2 - m1 + 1;
  if (count > 600) return [];
  return Array.from({ length: count }, (_, i) => {
    const index = y1 * 12 + m1 - 1 + i;
    return { bulan: `${Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, "0")}`, nominal: null, catatan: "" };
  });
}

export function bulanBerikutnya(bulan: string): string {
  const [year, month] = bulan.split("-").map(Number);
  return month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;
}

export function penugasanPadaEntitas(
  person: { entityId?: string | null },
  project: { projectEntityId?: string | null },
  entityId?: string,
): boolean {
  return !!entityId && (project.projectEntityId || person.entityId) === entityId;
}

export function ringkasanGajiTenagaAhli(
  rows: GajiTenagaAhliBulan[],
  history: { id: string; projectId?: string | null; nominalHonor: number; nominalBersih: number }[],
  projectId: string,
) {
  const unique = new Map(history.filter(item => item.projectId === projectId).map(item => [item.id, item]));
  const dibayar = [...unique.values()].reduce((sum, item) => sum + item.nominalHonor, 0);
  const dibayarNetto = [...unique.values()].reduce((sum, item) => sum + item.nominalBersih, 0);
  const terisi = rows.filter(row => row.nominal !== null).length;
  const totalGaji = terisi ? rows.reduce((sum, row) => sum + (row.nominal ?? 0), 0) : null;
  return { dibayar, dibayarNetto, totalGaji, balance: totalGaji === null ? null : totalGaji - dibayar,
    terisi, jumlahBulan: rows.length, lengkap: rows.length > 0 && terisi === rows.length };
}
