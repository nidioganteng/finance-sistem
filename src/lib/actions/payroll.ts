"use server";

import { phpFetch, getPhpToken, ApiError } from "@/lib/api-client";

// ----------------------------------------------------
// PEGAWAI TETAP (MASTER DATA)
// ----------------------------------------------------

export async function createPegawaiAction(formData: FormData) {
  const token = await getPhpToken();
  const body = {
    entityId: formData.get("entityId"),
    nik: formData.get("nik"),
    nama: formData.get("nama"),
    jabatan: formData.get("jabatan") || "Karyawan",
    statusKeluarga: formData.get("statusKeluarga") || "TK/0",
    ptkp: Number(formData.get("ptkp")) || 54000000,
    gajiPokok: Number(formData.get("gajiPokok")) || 0,
    isActive:
      formData.get("isActive") === "true" ||
      formData.get("isActive") === "on",
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
  const body = {
    nik: formData.get("nik"),
    nama: formData.get("nama"),
    jabatan: formData.get("jabatan") || "Karyawan",
    statusKeluarga: formData.get("statusKeluarga") || "TK/0",
    ptkp: Number(formData.get("ptkp")) || 54000000,
    gajiPokok: Number(formData.get("gajiPokok")) || 0,
    isActive:
      formData.get("isActive") === "true" ||
      formData.get("isActive") === "on",
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
  const body = {
    pegawaiId: formData.get("pegawaiId"),
    entityId: formData.get("entityId"),
    bulan: Number(formData.get("bulan")),
    tahun: Number(formData.get("tahun")),
    gajiPokok: Number(formData.get("gajiPokok")) || 0,
    tunjanganJabatan: Number(formData.get("tunjanganJabatan")) || 0,
    tunjanganTransport: Number(formData.get("tunjanganTransport")) || 0,
    insentif: Number(formData.get("insentif")) || 0,
    bpjsKesehatan: Number(formData.get("bpjsKesehatan")) || 0,
    bpjsKetenagakerjaan: Number(formData.get("bpjsKetenagakerjaan")) || 0,
    potonganLain: Number(formData.get("potonganLain")) || 0,
    pph21: Number(formData.get("pph21")) || 0,
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
    uraian: (formData.get("uraian") as string)?.trim(),
    tanggal: formData.get("tanggal"),
    nominalHonor: Number(formData.get("nominalHonor")) || 0,
    tarifPph21Persen: Number(formData.get("tarifPph21Persen")) || 0,
    pph21: Number(formData.get("pph21")) || 0,
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
