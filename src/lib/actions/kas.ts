"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRunningSaldo } from "@/lib/kas";

type KasRowInput = { coaAccountId: string; nominal: number };

export type CreateKasTransactionInput = {
  entityKey: string;
  jenisInputKey: string; // "kasKecil" | "kasBesar" | "bankBuku"
  tanggal: string; // yyyy-mm-dd
  noBukti: string;
  keterangan: string;
  arah: "masuk" | "keluar";
  rows: KasRowInput[];
  pagePath: string; // path buat revalidate, mis. "/kas-kecil"
};

export async function createKasTransaction(input: CreateKasTransactionInput) {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Belum login." };
  if (session.user.role !== "STAF_KEUANGAN") return { error: "Hanya Staf Keuangan yang bisa input transaksi ini." };
  if (!session.user.entityKeys.includes(input.entityKey)) return { error: "Kamu tidak punya akses ke entity ini." };

  const validRows = input.rows.filter((r) => r.coaAccountId && r.nominal > 0);
  if (validRows.length === 0) return { error: "Isi minimal satu baris akun dengan nominal." };
  if (!input.noBukti || !input.keterangan) return { error: "No. bukti dan keterangan wajib diisi." };

  const entity = await prisma.entity.findUnique({ where: { key: input.entityKey } });
  const jenisInput = await prisma.jenisInputTransaksi.findUnique({ where: { key: input.jenisInputKey } });
  if (!entity || !jenisInput) return { error: "Entity atau jenis input tidak ditemukan." };

  const total = validRows.reduce((sum, r) => sum + r.nominal, 0);
  const prevSaldo = await getRunningSaldo(entity.id, jenisInput.id);
  const newSaldo = prevSaldo + (input.arah === "masuk" ? total : -total);

  await prisma.$transaction(
    validRows.map((r) =>
      prisma.transaction.create({
        data: {
          entityId: entity.id,
          jenisInputId: jenisInput.id,
          tanggal: new Date(input.tanggal),
          noBukti: input.noBukti,
          keterangan: input.keterangan,
          coaAccountId: r.coaAccountId,
          debit: input.arah === "masuk" ? r.nominal : 0,
          kredit: input.arah === "keluar" ? r.nominal : 0,
          saldoSetelah: newSaldo,
          staffId: session.user.id,
        },
      })
    )
  );

  revalidatePath(input.pagePath);
  revalidatePath("/jurnal");
  return { success: true };
}
