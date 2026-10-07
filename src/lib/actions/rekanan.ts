"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageTransaksi } from "@/lib/rbac";
import { logActivity } from "@/lib/actions/log";
import { RekananTipe } from "@prisma/client";

export type RekananInput = {
  nama: string;
  npwp?: string | null;
  nik?: string | null;
  tipe?: RekananTipe;
  kategori?: string | null;
  alamat?: string | null;
  telepon?: string | null;
  email?: string | null;
  namaBank?: string | null;
  noRekening?: string | null;
  atasNamaBank?: string | null;
  entityId?: string | null;
};

export type RekananItem = {
  id: string;
  nama: string;
  npwp: string | null;
  nik: string | null;
  tipe: RekananTipe;
  kategori: string | null;
  alamat: string | null;
  telepon: string | null;
  email: string | null;
  namaBank: string | null;
  noRekening: string | null;
  atasNamaBank: string | null;
  entityId: string | null;
  entityName?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Normalisasi format NPWP atau NIK (menghilangkan titik, strip, spasi)
 */
export function cleanIdentityNumber(val: string): string {
  return val.replace(/[\s.\-_/]/g, "").trim();
}

/**
 * Pencarian Rekanan Terpusat untuk fitur Auto-Fill
 * Dapat mencari berdasarkan NPWP, NIK, atau Nama
 */
export async function searchRekananAction(
  query: string,
  tipe?: RekananTipe
): Promise<{ data: RekananItem[] }> {
  const q = query.trim();
  if (!q) {
    const defaultList = await prisma.rekanan.findMany({
      where: {
        ...(tipe ? { tipe } : {}),
      },
      orderBy: { nama: "asc" },
      take: 15,
      include: { entity: { select: { name: true } } },
    });
    return {
      data: defaultList.map((r) => ({
        ...r,
        entityName: r.entity?.name ?? null,
      })),
    };
  }

  const cleanedQ = cleanIdentityNumber(q);

  // Cari berdasarkan nama, NPWP asli, NIK asli, atau angka bersih
  const list = await prisma.rekanan.findMany({
    where: {
      ...(tipe ? { tipe } : {}),
      OR: [
        { nama: { contains: q } },
        { npwp: { contains: q } },
        { nik: { contains: q } },
        ...(cleanedQ.length >= 3
          ? [
              { npwp: { contains: cleanedQ } },
              { nik: { contains: cleanedQ } },
            ]
          : []),
      ],
    },
    orderBy: { nama: "asc" },
    take: 15,
    include: { entity: { select: { name: true } } },
  });

  return {
    data: list.map((r) => ({
      ...r,
      entityName: r.entity?.name ?? null,
    })),
  };
}

/**
 * Mengambil daftar rekanan lengkap untuk Halaman Master Data Rekanan
 */
export async function getRekananListAction(params?: {
  search?: string;
  tipe?: string;
  entityId?: string;
}): Promise<{ data: RekananItem[] }> {
  const q = params?.search?.trim() || "";
  const tipeFilter =
    params?.tipe && params.tipe !== "ALL"
      ? (params.tipe as RekananTipe)
      : undefined;

  const list = await prisma.rekanan.findMany({
    where: {
      ...(tipeFilter ? { tipe: tipeFilter } : {}),
      ...(params?.entityId ? { entityId: params.entityId } : {}),
      ...(q
        ? {
            OR: [
              { nama: { contains: q } },
              { npwp: { contains: q } },
              { nik: { contains: q } },
              { kategori: { contains: q } },
              { noRekening: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: [{ tipe: "asc" }, { nama: "asc" }],
    include: { entity: { select: { name: true } } },
  });

  return {
    data: list.map((r) => ({
      ...r,
      entityName: r.entity?.name ?? null,
    })),
  };
}

/**
 * Tambah Rekanan Baru
 */
export async function createRekananAction(data: RekananInput) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: "Belum login." };
  }
  if (!canManageTransaksi(session.user.role) && session.user.role !== "SUPER_ADMIN") {
    return { error: "Kamu tidak memiliki wewenang untuk menambah master rekanan." };
  }

  if (!data.nama?.trim()) {
    return { error: "Nama rekanan wajib diisi." };
  }

  // Cek duplikasi berdasarkan NPWP (jika diisi)
  if (data.npwp?.trim()) {
    const cleaned = cleanIdentityNumber(data.npwp);
    const existing = await prisma.rekanan.findFirst({
      where: {
        OR: [
          { npwp: data.npwp.trim() },
          { npwp: cleaned },
        ],
      },
    });
    if (existing) {
      return { error: `Rekanan dengan NPWP ini sudah terdaftar: ${existing.nama}` };
    }
  }

  const created = await prisma.rekanan.create({
    data: {
      nama: data.nama.trim(),
      npwp: data.npwp?.trim() || null,
      nik: data.nik?.trim() || null,
      tipe: data.tipe || RekananTipe.VENDOR,
      kategori: data.kategori?.trim() || null,
      alamat: data.alamat?.trim() || null,
      telepon: data.telepon?.trim() || null,
      email: data.email?.trim() || null,
      namaBank: data.namaBank?.trim() || null,
      noRekening: data.noRekening?.trim() || null,
      atasNamaBank: data.atasNamaBank?.trim() || null,
      entityId: data.entityId || null,
    },
  });

  logActivity(
    session.user.id,
    `Tambah master rekanan: ${created.nama} (${created.tipe})`,
    "FINANCIAL_CHANGE",
    {
      rekananId: created.id,
      nama: created.nama,
      tipe: created.tipe,
      npwp: created.npwp,
      nik: created.nik,
    }
  );

  revalidatePath("/rekanan");
  revalidatePath("/pendapatan");
  return { success: true, id: created.id };
}

/**
 * Edit Rekanan
 */
export async function updateRekananAction(id: string, data: Partial<RekananInput>) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: "Belum login." };
  }
  if (!canManageTransaksi(session.user.role) && session.user.role !== "SUPER_ADMIN") {
    return { error: "Kamu tidak memiliki wewenang untuk mengubah master rekanan." };
  }

  const existing = await prisma.rekanan.findUnique({ where: { id } });
  if (!existing) return { error: "Rekanan tidak ditemukan." };

  const updated = await prisma.rekanan.update({
    where: { id },
    data: {
      ...(data.nama ? { nama: data.nama.trim() } : {}),
      ...(data.npwp !== undefined ? { npwp: data.npwp?.trim() || null } : {}),
      ...(data.nik !== undefined ? { nik: data.nik?.trim() || null } : {}),
      ...(data.tipe ? { tipe: data.tipe } : {}),
      ...(data.kategori !== undefined ? { kategori: data.kategori?.trim() || null } : {}),
      ...(data.alamat !== undefined ? { alamat: data.alamat?.trim() || null } : {}),
      ...(data.telepon !== undefined ? { telepon: data.telepon?.trim() || null } : {}),
      ...(data.email !== undefined ? { email: data.email?.trim() || null } : {}),
      ...(data.namaBank !== undefined ? { namaBank: data.namaBank?.trim() || null } : {}),
      ...(data.noRekening !== undefined ? { noRekening: data.noRekening?.trim() || null } : {}),
      ...(data.atasNamaBank !== undefined ? { atasNamaBank: data.atasNamaBank?.trim() || null } : {}),
      ...(data.entityId !== undefined ? { entityId: data.entityId || null } : {}),
    },
  });

  logActivity(
    session.user.id,
    `Ubah master rekanan: ${updated.nama} (${updated.tipe})`,
    "FINANCIAL_CHANGE",
    {
      rekananId: updated.id,
      nama: updated.nama,
      tipe: updated.tipe,
    }
  );

  revalidatePath("/rekanan");
  revalidatePath("/pendapatan");
  return { success: true, id: updated.id };
}

/**
 * Hapus Rekanan
 */
export async function deleteRekananAction(id: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: "Belum login." };
  }
  if (!canManageTransaksi(session.user.role) && session.user.role !== "SUPER_ADMIN") {
    return { error: "Kamu tidak memiliki wewenang untuk menghapus master rekanan." };
  }

  const existing = await prisma.rekanan.findUnique({ where: { id } });
  if (!existing) return { error: "Rekanan tidak ditemukan." };

  await prisma.rekanan.delete({ where: { id } });

  logActivity(
    session.user.id,
    `Hapus master rekanan: ${existing.nama}`,
    "FINANCIAL_CHANGE",
    {
      rekananId: existing.id,
      nama: existing.nama,
    }
  );

  revalidatePath("/rekanan");
  revalidatePath("/pendapatan");
  return { success: true };
}

/**
 * Utility otomatis: jika pengguna menginput NPWP/Nama baru pada Faktur / Transaksi,
 * otomatis simpan ke Master Data jika belum terdaftar.
 */
export async function autoRegisterRekananIfNew(
  npwp: string,
  nama: string,
  tipe: RekananTipe = RekananTipe.KLIEN
) {
  const cleanNpwp = npwp.trim();
  const cleanNama = nama.trim();
  if (!cleanNama) return;

  const existing = await prisma.rekanan.findFirst({
    where: {
      OR: [
        ...(cleanNpwp ? [{ npwp: cleanNpwp }] : []),
        { nama: cleanNama },
      ],
    },
  });

  if (!existing) {
    try {
      await prisma.rekanan.create({
        data: {
          nama: cleanNama,
          npwp: cleanNpwp || null,
          tipe,
        },
      });
      revalidatePath("/rekanan");
    } catch {
      // Abaikan jika ada concurrency race condition
    }
  } else if (!existing.npwp && cleanNpwp) {
    // Perbarui jika sebelumnya NPWP-nya kosong
    try {
      await prisma.rekanan.update({
        where: { id: existing.id },
        data: { npwp: cleanNpwp },
      });
      revalidatePath("/rekanan");
    } catch {
      // Abaikan
    }
  }
}
