"use server";

import { phpFetch, getPhpToken, ApiError } from "@/lib/api-client";

// ----------------------------------------------------
// HELPER: PARSE ANGKA NOMINAL RUPIAH
// ----------------------------------------------------

/**
 * Membersihkan format Rupiah (titik pemisah ribuan, spasi, simbol Rp)
 * dan mengonversi ke number asli agar tidak menjadi NaN / 0.
 * Contoh: "5.000.000" -> 5000000, "400.000" -> 400000, "54.000.000" -> 54000000
 */
function parseRupiahNumber(
  val: FormDataEntryValue | null | undefined,
  fallback: number = 0
): number {
  if (val === null || val === undefined) return fallback;
  if (typeof val === "number") return isNaN(val) ? fallback : val;
  const str = String(val).trim();
  if (!str) return fallback;
  // Hapus semua karakter kecuali digit angka, tanda minus (-), dan koma (,)
  const clean = str.replace(/[^0-9,-]/g, "").replace(",", ".");
  const num = parseFloat(clean);
  return isNaN(num) ? fallback : num;
}

// ----------------------------------------------------
// PEGAWAI TETAP (MASTER DATA)
// ----------------------------------------------------

export async function createPegawaiAction(formData: FormData) {
  const token = await getPhpToken();
  const rawStatus = ((formData.get("status") as string) || "AKTIF").toUpperCase();
  const status = ["AKTIF", "RESIGN", "PENSIUN"].includes(rawStatus) ? rawStatus : "AKTIF";
  const tanggalResign = (formData.get("tanggalResign") as string)?.trim() || null;

  const bpjsKesehatan = parseRupiahNumber(formData.get("bpjsKesehatan"), 0);
  const bpjsKetenagakerjaan = parseRupiahNumber(formData.get("bpjsKetenagakerjaan"), 0);
  const rawPotonganBpjs = parseRupiahNumber(formData.get("potonganBpjs"), 0);
  const potonganBpjs = rawPotonganBpjs > 0 ? rawPotonganBpjs : (bpjsKesehatan + bpjsKetenagakerjaan);

  const body = {
    entityId: formData.get("entityId"),
    nik: formData.get("nik"),
    nama: formData.get("nama"),
    jabatan: formData.get("jabatan") || "Karyawan",
    statusKeluarga: formData.get("statusKeluarga") || "TK/0",
    ptkp: parseRupiahNumber(formData.get("ptkp"), 54000000),
    gajiPokok: parseRupiahNumber(formData.get("gajiPokok"), 0),
    tunjanganJabatan: parseRupiahNumber(formData.get("tunjanganJabatan"), 0),
    tunjanganBpjsKes: parseRupiahNumber(formData.get("tunjanganBpjsKes"), 0),
    tunjanganBpjsTk: parseRupiahNumber(formData.get("tunjanganBpjsTk"), 0),
    bpjsKesehatan,
    bpjsKetenagakerjaan,
    potonganBpjs,
    tanggalMasuk: (formData.get("tanggalMasuk") as string)?.trim() || null,
    status,
    tanggalResign,
    isActive: status === "AKTIF",
  };
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await phpFetch<{ success: boolean; data: any }>(
      "/api/payroll/pegawai",
      token,
      { method: "POST", body: JSON.stringify(body) }
    );
    return { success: true, data: result.data };
  } catch (e) {
    if (e instanceof ApiError) throw new Error(e.message);
    throw new Error("Terjadi kesalahan.");
  }
}

export async function updatePegawaiAction(formData: FormData) {
  const token = await getPhpToken();
  const id = formData.get("id") as string;
  const rawStatus = ((formData.get("status") as string) || "AKTIF").toUpperCase();
  const status = ["AKTIF", "RESIGN", "PENSIUN"].includes(rawStatus) ? rawStatus : "AKTIF";
  const tanggalResign = (formData.get("tanggalResign") as string)?.trim() || null;

  const bpjsKesehatan = parseRupiahNumber(formData.get("bpjsKesehatan"), 0);
  const bpjsKetenagakerjaan = parseRupiahNumber(formData.get("bpjsKetenagakerjaan"), 0);
  const rawPotonganBpjs = parseRupiahNumber(formData.get("potonganBpjs"), 0);
  const potonganBpjs = rawPotonganBpjs > 0 ? rawPotonganBpjs : (bpjsKesehatan + bpjsKetenagakerjaan);

  const body = {
    nik: formData.get("nik"),
    nama: formData.get("nama"),
    jabatan: formData.get("jabatan") || "Karyawan",
    statusKeluarga: formData.get("statusKeluarga") || "TK/0",
    ptkp: parseRupiahNumber(formData.get("ptkp"), 54000000),
    gajiPokok: parseRupiahNumber(formData.get("gajiPokok"), 0),
    tunjanganJabatan: parseRupiahNumber(formData.get("tunjanganJabatan"), 0),
    tunjanganBpjsKes: parseRupiahNumber(formData.get("tunjanganBpjsKes"), 0),
    tunjanganBpjsTk: parseRupiahNumber(formData.get("tunjanganBpjsTk"), 0),
    bpjsKesehatan,
    bpjsKetenagakerjaan,
    potonganBpjs,
    tanggalMasuk: (formData.get("tanggalMasuk") as string)?.trim() || null,
    status,
    tanggalResign,
    isActive: status === "AKTIF",
  };
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await phpFetch<{ success: boolean; data: any }>(
      `/api/payroll/pegawai/${id}`,
      token,
      { method: "PUT", body: JSON.stringify(body) }
    );
    return { success: true, data: result.data };
  } catch (e) {
    if (e instanceof ApiError) throw new Error(e.message);
    throw new Error("Terjadi kesalahan.");
  }
}

export async function updatePegawaiStatusAction(
  id: string,
  status: "AKTIF" | "RESIGN" | "PENSIUN",
  tanggalResign: string | null = null
) {
  const token = await getPhpToken();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await phpFetch<{ success: boolean; data: any }>(
      `/api/payroll/pegawai/${id}`,
      token,
      {
        method: "PUT",
        body: JSON.stringify({
          status,
          tanggalResign,
          isActive: status === "AKTIF",
        }),
      }
    );
    return { success: true, data: result.data };
  } catch (e) {
    if (e instanceof ApiError) throw new Error(e.message);
    throw new Error("Gagal mengubah status pegawai.");
  }
}

export async function deletePegawaiAction(id: string) {
  const token = await getPhpToken();
  try {
    await phpFetch<{ success: boolean }>(
      `/api/payroll/pegawai/${id}`,
      token,
      { method: "DELETE" }
    );
    return { success: true };
  } catch (e) {
    if (e instanceof ApiError) throw new Error(e.message);
    throw new Error("Terjadi kesalahan.");
  }
}

// ----------------------------------------------------
// GAJI BULANAN PEGAWAI TETAP
// ----------------------------------------------------

export async function saveGajiBulananAction(formData: FormData) {
  const token = await getPhpToken();
  const bpjsKesehatan = parseRupiahNumber(formData.get("bpjsKesehatan"), 0);
  const bpjsKetenagakerjaan = parseRupiahNumber(formData.get("bpjsKetenagakerjaan"), 0);
  const rawPotonganBpjs = parseRupiahNumber(formData.get("potonganBpjs"), 0);
  const potonganBpjs = rawPotonganBpjs > 0 ? rawPotonganBpjs : (bpjsKesehatan + bpjsKetenagakerjaan);

  const tunjanganBpjsKes = parseRupiahNumber(formData.get("tunjanganBpjsKes"), 0);
  const tunjanganBpjsTk = parseRupiahNumber(formData.get("tunjanganBpjsTk"), 0);
  const rawTunjanganBpjs = parseRupiahNumber(formData.get("tunjanganBpjs"), 0);
  const tunjanganBpjs = rawTunjanganBpjs > 0 ? rawTunjanganBpjs : (tunjanganBpjsKes + tunjanganBpjsTk);

  const insentif = parseRupiahNumber(formData.get("insentif"), 0);
  const tunjanganLainnya = parseRupiahNumber(formData.get("tunjanganLainnya"), 0) || insentif;

  const body = {
    pegawaiId: formData.get("pegawaiId"),
    entityId: formData.get("entityId"),
    bulan: Number(formData.get("bulan")),
    tahun: Number(formData.get("tahun")),
    gajiPokok: parseRupiahNumber(formData.get("gajiPokok"), 0),
    tunjanganJabatan: parseRupiahNumber(formData.get("tunjanganJabatan"), 0),
    hariKerja: parseRupiahNumber(formData.get("hariKerja"), 0),
    tarifTransportHarian: parseRupiahNumber(formData.get("tarifTransportHarian"), 15000),
    tunjanganTransport: parseRupiahNumber(formData.get("tunjanganTransport"), 0),
    tunjanganLainnya,
    insentif,
    tunjanganBpjs,
    tunjanganBpjsKes,
    tunjanganBpjsTk,
    tunjanganPph: parseRupiahNumber(formData.get("tunjanganPph"), 0),
    thr: parseRupiahNumber(formData.get("thr"), 0),
    bpjsKesehatan,
    bpjsKetenagakerjaan,
    potonganBpjs,
    potonganLain: parseRupiahNumber(formData.get("potonganLain"), 0),
    pph21: parseRupiahNumber(formData.get("pph21"), 0),
    catatan: (formData.get("catatan") as string)?.trim() || null,
  };
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await phpFetch<{ success: boolean; data: any }>(
      "/api/payroll/gaji",
      token,
      { method: "POST", body: JSON.stringify(body) }
    );
    return { success: true, data: result.data };
  } catch (e) {
    if (e instanceof ApiError) throw new Error(e.message);
    throw new Error("Terjadi kesalahan.");
  }
}

export async function deleteGajiBulananAction(id: string) {
  const token = await getPhpToken();
  try {
    await phpFetch<{ success: boolean }>(`/api/payroll/gaji/${id}`, token, {
      method: "DELETE",
    });
    return { success: true };
  } catch (e) {
    if (e instanceof ApiError) throw new Error(e.message);
    throw new Error("Terjadi kesalahan.");
  }
}

// ----------------------------------------------------
// SUB-MODUL TENAGA AHLI / BUKAN PEGAWAI
// ----------------------------------------------------

export async function saveHonorTenagaAhliAction(formData: FormData) {
  const token = await getPhpToken();
  const body = {
    id: (formData.get("id") as string)?.trim() || null,
    entityId: formData.get("entityId"),
    rekananId: (formData.get("rekananId") as string)?.trim() || null,
    nik: (formData.get("nik") as string)?.trim(),
    nama: (formData.get("nama") as string)?.trim(),
    npwp: (formData.get("npwp") as string)?.trim() || null,
    ptkp: (formData.get("ptkp") as string)?.trim() || "TK/0",
    uraian: (formData.get("uraian") as string)?.trim(),
    tanggal: formData.get("tanggal"),
    bulan: Number(formData.get("bulan")) || null,
    tahun: Number(formData.get("tahun")) || null,
    nominalHonor: parseRupiahNumber(formData.get("nominalHonor"), 0),
    jenisPph: (formData.get("jenisPph") as string)?.trim() || "PPh 21",
    tarifPph21Persen: parseRupiahNumber(formData.get("tarifPph21Persen"), 0),
    pph21: parseRupiahNumber(formData.get("pph21"), 0),
    projectId: (formData.get("projectId") as string)?.trim() || null,
    namaProyek: (formData.get("namaProyek") as string)?.trim() || null,
    noBukti: (formData.get("noBukti") as string)?.trim() || null,
  };
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await phpFetch<{ success: boolean; data: any }>(
      "/api/payroll/honor",
      token,
      { method: "POST", body: JSON.stringify(body) }
    );
    return { success: true, data: result.data };
  } catch (e) {
    if (e instanceof ApiError) throw new Error(e.message);
    throw new Error("Terjadi kesalahan.");
  }
}

export async function deleteHonorTenagaAhliAction(id: string) {
  const token = await getPhpToken();
  try {
    await phpFetch<{ success: boolean }>(`/api/payroll/honor/${id}`, token, {
      method: "DELETE",
    });
    return { success: true };
  } catch (e) {
    if (e instanceof ApiError) throw new Error(e.message);
    throw new Error("Terjadi kesalahan.");
  }
}

// ----------------------------------------------------
// AUTO-GENERATE / SALIN GAJI DARI BULAN SEBELUMNYA
// ----------------------------------------------------

export async function copyGajiBulanSebelumnyaAction(
  entityId: string,
  targetYear: number,
  targetMonth: number
) {
  const token = await getPhpToken();
  try {
    const result = await phpFetch<{
      success: boolean;
      count: number;
      message: string;
    }>("/api/payroll/copy-gaji", token, {
      method: "POST",
      body: JSON.stringify({ entityId, targetYear, targetMonth }),
    });
    return result;
  } catch (e) {
    if (e instanceof ApiError) throw new Error(e.message);
    throw new Error("Terjadi kesalahan.");
  }
}

/**
 * Tambah / Edit Tenaga Ahli ke Master Database
 */
export async function saveTenagaAhliMasterAction(formData: FormData) {
  const token = await getPhpToken();
  const body = {
    id: (formData.get("id") as string)?.trim() || null,
    nama: (formData.get("nama") as string)?.trim(),
    nik: (formData.get("nik") as string)?.trim(),
    npwp: (formData.get("npwp") as string)?.trim() || null,
    ptkp: (formData.get("ptkp") as string)?.trim() || "TK/0",
    kategori: (formData.get("kategori") as string)?.trim() || null,
    entityId: (formData.get("entityId") as string)?.trim() || null,
  };
  try {
    const result = await phpFetch<{
      success: boolean;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: any;
      message: string;
    }>("/api/payroll/tenaga-ahli", token, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return result;
  } catch (e) {
    if (e instanceof ApiError) throw new Error(e.message);
    throw new Error("Terjadi kesalahan.");
  }
}

/**
 * Hapus Tenaga Ahli dari Master Database
 */
export async function deleteTenagaAhliMasterAction(id: string) {
  const token = await getPhpToken();
  try {
    const result = await phpFetch<{ success: boolean; message: string }>(
      `/api/payroll/tenaga-ahli/${id}`,
      token,
      { method: "DELETE" }
    );
    return result;
  } catch (e) {
    if (e instanceof ApiError) throw new Error(e.message);
    throw new Error("Terjadi kesalahan.");
  }
}
