"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateNoBukti } from "@/lib/actions/kas";
import { canManageTransaksi } from "@/lib/rbac";
import { logActivity } from "@/lib/actions/log";

type JurnalRow = { coaAccountId: string; debit: number; kredit: number };

export async function saveJurnalTransaksi(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Belum login." };
  if (!canManageTransaksi(session.user.role)) {
    return { error: "Kamu tidak punya akses untuk input jurnal transaksi." };
  }

  const keterangan = (formData.get("keterangan") as string | null)?.trim() ?? "";
  const tanggal = (formData.get("tanggal") as string | null)?.trim() ?? "";
  const entityKey = (formData.get("entityKey") as string | null)?.trim() ?? "";

  if (!keterangan) return { error: "Keterangan wajib diisi." };
  if (!tanggal) return { error: "Tanggal wajib diisi." };
  if (!entityKey) return { error: "Entity tidak ditemukan." };

  if (!session.user.entityKeys.includes(entityKey)) {
    return { error: "Kamu tidak punya akses ke entity ini." };
  }

  // Parse rows
  const rowsJson = formData.get("rows") as string | null;
  let rows: JurnalRow[] = [];
  try {
    rows = JSON.parse(rowsJson ?? "[]");
  } catch {
    return { error: "Format baris akun tidak valid." };
  }

  const validRows = rows.filter(
    (r) => r.coaAccountId && (r.debit > 0 || r.kredit > 0)
  );

  if (validRows.length < 2) {
    return { error: "Minimal 2 baris akun diperlukan untuk jurnal double-entry." };
  }

  const totalDebit = validRows.reduce((s, r) => s + (r.debit ?? 0), 0);
  const totalKredit = validRows.reduce((s, r) => s + (r.kredit ?? 0), 0);

  if (Math.round(totalDebit * 100) !== Math.round(totalKredit * 100)) {
    return {
      error: `Jurnal tidak seimbang. Total Debit (${totalDebit.toLocaleString("id-ID")}) ≠ Total Kredit (${totalKredit.toLocaleString("id-ID")}).`,
    };
  }

  const entity = await prisma.entity.findUnique({ where: { key: entityKey } });
  if (!entity) return { error: "Entity tidak ditemukan." };

  const jenisInput = await prisma.jenisInputTransaksi.findUnique({
    where: { key: "jurnalTransaksi" },
  });
  if (!jenisInput) return { error: "Jenis input 'Jurnal Transaksi' belum dikonfigurasi di sistem." };

  const noBukti = await generateNoBukti(entityKey, tanggal);

  await prisma.$transaction(
    validRows.map((r) =>
      prisma.transaction.create({
        data: {
          entityId: entity.id,
          jenisInputId: jenisInput.id,
          tanggal: new Date(tanggal),
          noBukti,
          keterangan,
          coaAccountId: r.coaAccountId,
          debit: r.debit ?? 0,
          kredit: r.kredit ?? 0,
          saldoSetelah: 0,
          staffId: session.user.id,
        },
      })
    )
  );

  logActivity(
    session.user.id,
    `Input Jurnal Transaksi – ${noBukti} (${entity.name})`,
    "FINANCIAL_CHANGE",
    { entityKey, noBukti, totalDebit }
  );

  revalidatePath("/jurnal-transaksi");
  revalidatePath("/jurnal");
  return { success: true };
}

export async function deleteJurnalTransaksi(txIds: string[]) {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Belum login." };
  if (!canManageTransaksi(session.user.role)) return { error: "Tidak punya akses." };
  if (!txIds.length) return { error: "Tidak ada transaksi yang dihapus." };

  await prisma.transaction.deleteMany({ where: { id: { in: txIds } } });

  logActivity(session.user.id, `Hapus Jurnal Transaksi (${txIds.length} baris)`, "FINANCIAL_CHANGE", { txIds });
  revalidatePath("/jurnal-transaksi");
  revalidatePath("/jurnal");
  return { success: true };
}
