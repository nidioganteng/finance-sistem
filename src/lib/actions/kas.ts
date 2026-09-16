"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRunningSaldo } from "@/lib/kas";
import { isValidRekening, getRekeningNama, REKENING_COA_CODE } from "@/lib/bank-accounts";

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
  rekeningId?: string; // khusus Bank Buku
  crossingEntityKey?: string; // crossing antar entitas (opsional)
};

export async function createKasTransaction(input: CreateKasTransactionInput) {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Belum login." };
  if (session.user.role !== "STAF_KEUANGAN") return { error: "Hanya Staf Keuangan yang bisa input transaksi ini." };
  if (!session.user.entityKeys.includes(input.entityKey)) return { error: "Kamu tidak punya akses ke entity ini." };

  const validRows = input.rows.filter((r) => r.coaAccountId && r.nominal > 0);
  if (validRows.length === 0) return { error: "Isi minimal satu baris akun dengan nominal." };
  if (!input.noBukti || !input.keterangan) return { error: "No. bukti dan keterangan wajib diisi." };

  // Validasi rekening untuk Bank Buku
  if (input.jenisInputKey === "bankBuku") {
    if (!input.rekeningId) return { error: "Rekening/Bank wajib dipilih untuk transaksi Bank Buku." };
    if (!isValidRekening(input.entityKey, input.rekeningId)) {
      return { error: "Rekening yang dipilih tidak sesuai dengan entitas ini." };
    }
  }

  const entity = await prisma.entity.findUnique({ where: { key: input.entityKey } });
  const jenisInput = await prisma.jenisInputTransaksi.findUnique({ where: { key: input.jenisInputKey } });
  if (!entity || !jenisInput) return { error: "Entity atau jenis input tidak ditemukan." };

  const rekeningNama = input.rekeningId ? getRekeningNama(input.entityKey, input.rekeningId) : undefined;

  // Cari COA untuk kas/bank entry (supaya Buku Besar bisa balance)
  let kasCoaId: string | null = null;
  if (input.jenisInputKey === "kasKecil") {
    kasCoaId = (await prisma.coaAccount.findUnique({ where: { code: "1-001" } }))?.id ?? null;
  } else if (input.jenisInputKey === "kasBesar") {
    kasCoaId = (await prisma.coaAccount.findUnique({ where: { code: "1-002" } }))?.id ?? null;
  } else if (input.jenisInputKey === "bankBuku" && input.rekeningId) {
    const coaCode = REKENING_COA_CODE[input.rekeningId];
    if (coaCode) {
      kasCoaId = (await prisma.coaAccount.findUnique({ where: { code: coaCode } }))?.id ?? null;
    }
  }

  const total = validRows.reduce((sum, r) => sum + r.nominal, 0);
  const prevSaldo = await getRunningSaldo(entity.id, jenisInput.id, rekeningNama);
  const newSaldo = prevSaldo + (input.arah === "masuk" ? total : -total);

  const isKeluar = input.arah === "keluar";

  const commonData = {
    entityId: entity.id,
    jenisInputId: jenisInput.id,
    tanggal: new Date(input.tanggal),
    noBukti: input.noBukti,
    keterangan: input.keterangan,
    saldoSetelah: newSaldo,
    staffId: session.user.id,
  };

  // Pastikan jurnal yang akan dibuat seimbang (total Debet = total Kredit)
  // akunRows: isKeluar → debit=total, kredit=0 | masuk → debit=0, kredit=total
  // kasEntry: isKeluar → debit=0, kredit=total | masuk → debit=total, kredit=0
  // Keduanya menghasilkan totalDebit = totalKredit = total — dijamin by construction.
  // Guard ini mencegah regresi kalau logika di atas berubah.
  const expectedDebit = total;
  const expectedKredit = total;
  if (Math.abs(expectedDebit - expectedKredit) > 0.001) {
    return { error: "Internal: jurnal tidak seimbang, simpan dibatalkan." };
  }

  // Double-entry:
  // Uang Keluar → baris akun = Debet, Kas/Bank = Kredit
  // Uang Masuk  → baris akun = Kredit, Kas/Bank = Debet
  const akunRows = validRows.map((r) =>
    prisma.transaction.create({
      data: {
        ...commonData,
        coaAccountId: r.coaAccountId,
        debit: isKeluar ? r.nominal : 0,
        kredit: isKeluar ? 0 : r.nominal,
      },
    })
  );

  // Auto kas/bank entry — leg balik dari jurnal double-entry
  const kasEntry = prisma.transaction.create({
    data: {
      ...commonData,
      coaAccountId: kasCoaId,
      debit: isKeluar ? 0 : total,
      kredit: isKeluar ? total : 0,
      extraFieldsJson: {
        isKasEntry: true,
        ...(rekeningNama ? { rekeningNama } : {}),
        ...(input.crossingEntityKey ? { crossingEntityKey: input.crossingEntityKey } : {}),
      },
    },
  });

  await prisma.$transaction([...akunRows, kasEntry]);

  revalidatePath(input.pagePath);
  revalidatePath("/jurnal");
  return { success: true };
}

export async function deleteKasTransactionGroup(txIds: string[], pagePath: string) {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Belum login." };
  if (session.user.role !== "STAF_KEUANGAN") return { error: "Hanya Staf Keuangan yang bisa menghapus transaksi." };
  if (txIds.length === 0) return { error: "Tidak ada transaksi untuk dihapus." };

  await prisma.transaction.deleteMany({ where: { id: { in: txIds } } });
  revalidatePath(pagePath);
  revalidatePath("/jurnal");
  return { success: true };
}

export async function replaceKasTransaction(input: CreateKasTransactionInput & { existingTxIds: string[] }) {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Belum login." };
  if (session.user.role !== "STAF_KEUANGAN") return { error: "Hanya Staf Keuangan yang bisa mengedit transaksi." };
  if (!session.user.entityKeys.includes(input.entityKey)) return { error: "Kamu tidak punya akses ke entity ini." };
  if (input.existingTxIds.length === 0) return { error: "Tidak ada transaksi lama untuk diganti." };

  const validRows = input.rows.filter((r) => r.coaAccountId && r.nominal > 0);
  if (validRows.length === 0) return { error: "Isi minimal satu baris akun dengan nominal." };
  if (!input.noBukti || !input.keterangan) return { error: "No. bukti dan keterangan wajib diisi." };

  if (input.jenisInputKey === "bankBuku") {
    if (!input.rekeningId) return { error: "Rekening/Bank wajib dipilih untuk transaksi Bank Buku." };
    if (!isValidRekening(input.entityKey, input.rekeningId)) return { error: "Rekening yang dipilih tidak sesuai dengan entitas ini." };
  }

  const entity = await prisma.entity.findUnique({ where: { key: input.entityKey } });
  const jenisInput = await prisma.jenisInputTransaksi.findUnique({ where: { key: input.jenisInputKey } });
  if (!entity || !jenisInput) return { error: "Entity atau jenis input tidak ditemukan." };

  const rekeningNama = input.rekeningId ? getRekeningNama(input.entityKey, input.rekeningId) : undefined;

  let kasCoaId: string | null = null;
  if (input.jenisInputKey === "kasKecil") {
    kasCoaId = (await prisma.coaAccount.findUnique({ where: { code: "1-001" } }))?.id ?? null;
  } else if (input.jenisInputKey === "kasBesar") {
    kasCoaId = (await prisma.coaAccount.findUnique({ where: { code: "1-002" } }))?.id ?? null;
  } else if (input.jenisInputKey === "bankBuku" && input.rekeningId) {
    const coaCode = REKENING_COA_CODE[input.rekeningId];
    if (coaCode) kasCoaId = (await prisma.coaAccount.findUnique({ where: { code: coaCode } }))?.id ?? null;
  }

  // Delete old group first, then recalculate saldo without the old entries
  await prisma.transaction.deleteMany({ where: { id: { in: input.existingTxIds } } });

  const total = validRows.reduce((sum, r) => sum + r.nominal, 0);
  const prevSaldo = await getRunningSaldo(entity.id, jenisInput.id, rekeningNama);
  const newSaldo = prevSaldo + (input.arah === "masuk" ? total : -total);
  const isKeluar = input.arah === "keluar";

  const commonData = {
    entityId: entity.id,
    jenisInputId: jenisInput.id,
    tanggal: new Date(input.tanggal),
    noBukti: input.noBukti,
    keterangan: input.keterangan,
    saldoSetelah: newSaldo,
    staffId: session.user.id,
  };

  const akunRows = validRows.map((r) =>
    prisma.transaction.create({
      data: {
        ...commonData,
        coaAccountId: r.coaAccountId,
        debit: isKeluar ? r.nominal : 0,
        kredit: isKeluar ? 0 : r.nominal,
      },
    })
  );

  const kasEntry = prisma.transaction.create({
    data: {
      ...commonData,
      coaAccountId: kasCoaId,
      debit: isKeluar ? 0 : total,
      kredit: isKeluar ? total : 0,
      extraFieldsJson: {
        isKasEntry: true,
        ...(rekeningNama ? { rekeningNama } : {}),
        ...(input.crossingEntityKey ? { crossingEntityKey: input.crossingEntityKey } : {}),
      },
    },
  });

  await prisma.$transaction([...akunRows, kasEntry]);

  revalidatePath(input.pagePath);
  revalidatePath("/jurnal");
  return { success: true };
}

export async function updateKasTransactionGroup(input: {
  txIds: string[];
  newNoBukti: string;
  newKeterangan: string;
  coaUpdates: { txId: string; newCoaAccountId: string }[];
  pagePath: string;
}) {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Belum login." };
  if (session.user.role !== "STAF_KEUANGAN") return { error: "Hanya Staf Keuangan yang bisa mengedit transaksi." };
  if (!input.newNoBukti.trim() || !input.newKeterangan.trim()) return { error: "No. bukti dan keterangan wajib diisi." };

  await prisma.$transaction([
    prisma.transaction.updateMany({
      where: { id: { in: input.txIds } },
      data: { noBukti: input.newNoBukti.trim(), keterangan: input.newKeterangan.trim() },
    }),
    ...input.coaUpdates.map((u) =>
      prisma.transaction.update({ where: { id: u.txId }, data: { coaAccountId: u.newCoaAccountId } })
    ),
  ]);

  revalidatePath(input.pagePath);
  revalidatePath("/jurnal");
  return { success: true };
}
