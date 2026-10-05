"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageTransaksi } from "@/lib/rbac";
import { logActivity } from "@/lib/actions/log";

// Edit kode akun langsung dari tabel Jurnal Umum (issue #29). Kode akun disimpan
// di tabel CoaAccount yang di-share lintas entitas, jadi kita TIDAK BOLEH update
// baris CoaAccount itu langsung — itu bakal ikut mengubah kode akun di semua
// entitas lain yang kebetulan pakai akun yang sama. Sebagai gantinya, transaksi
// ini dialihkan (coaAccountId) ke CoaAccount lain yang kodenya sudah sesuai —
// supaya perubahan cuma berlaku untuk transaksi di entitas ini. Kode baru WAJIB
// sudah terdaftar di Bagan Akun (dipilih dari daftar via combobox di UI); kalau
// tidak ketemu, ditolak — tidak ada auto-create akun baru dari sini.
export async function updateKodeAkunJurnal(transactionId: string, entityId: string, newCode: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user.id || !canManageTransaksi(session.user.role)) {
    throw new Error("Kamu tidak punya akses untuk mengedit kode akun.");
  }

  const code = newCode.trim();
  if (!code) throw new Error("Kode akun wajib diisi.");

  const entity = await prisma.entity.findFirst({
    where: { id: entityId, key: { in: session.user.entityKeys } },
  });
  if (!entity) throw new Error("Kamu tidak punya akses ke entitas ini.");

  const transaction = await prisma.transaction.findFirst({
    where: { id: transactionId, entityId },
    include: { coaAccount: true },
  });
  if (!transaction) throw new Error("Transaksi tidak ditemukan di entitas ini.");
  if (!transaction.coaAccount) throw new Error("Baris ini tidak punya akun yang bisa diedit.");

  const oldAccount = transaction.coaAccount;
  if (oldAccount.code === code) return;

  const targetAccount = await prisma.coaAccount.findUnique({
    where: { code },
  });
  if (!targetAccount) {
    throw new Error(`Kode akun "${code}" tidak ditemukan di Bagan Akun. Pilih salah satu dari daftar yang muncul.`);
  }

  const { count } = await prisma.transaction.updateMany({
    where: { id: transactionId, entityId },
    data: { coaAccountId: targetAccount.id },
  });
  if (count === 0) throw new Error("Transaksi tidak ditemukan di entitas ini.");

  logActivity(session.user.id, `Edit kode akun jurnal ${oldAccount.code} → ${code} (${entity.name})`, "FINANCIAL_CHANGE", {
    transactionId,
    entityId,
    oldCode: oldAccount.code,
    newCode: code,
  });

  revalidatePath("/jurnal");
}

export async function updateProyekJurnal(transactionId: string, entityId: string, newProjectId: string | null) {
  const session = await getServerSession(authOptions);
  if (!session?.user.id || !canManageTransaksi(session.user.role)) {
    throw new Error("Kamu tidak punya akses untuk mengedit proyek transaksi.");
  }

  const entity = await prisma.entity.findFirst({
    where: { id: entityId, key: { in: session.user.entityKeys } },
  });
  if (!entity) throw new Error("Kamu tidak punya akses ke entitas ini.");

  const transaction = await prisma.transaction.findFirst({
    where: { id: transactionId, entityId },
    include: { project: true },
  });
  if (!transaction) throw new Error("Transaksi tidak ditemukan di entitas ini.");

  const targetProjectId = newProjectId?.trim() || null;
  let targetProject = null;
  if (targetProjectId) {
    targetProject = await prisma.project.findUnique({
      where: { id: targetProjectId },
      select: { id: true, code: true, name: true },
    });
    if (!targetProject) throw new Error("Proyek tidak ditemukan.");
  }

  // Update semua baris transaksi dengan noBukti yang sama di entitas ini
  await prisma.transaction.updateMany({
    where: { entityId, noBukti: transaction.noBukti },
    data: { projectId: targetProjectId },
  });

  // Update juga transaksi auto-posted jika ada (misal di buku bank entitas lain)
  await prisma.transaction.updateMany({
    where: {
      noBukti: transaction.noBukti,
      extraFieldsJson: { path: "$.autoPostedFromJurnal", equals: true },
    },
    data: { projectId: targetProjectId },
  });

  // Update juga faktur pendapatan jika ada
  await prisma.fakturPendapatan.updateMany({
    where: { noFaktur: transaction.noBukti },
    data: { projectId: targetProjectId },
  });

  logActivity(
    session.user.id,
    `Update proyek transaksi ${transaction.noBukti} (${entity.name}): ${targetProject ? targetProject.code : "Bukan Proyek"}`,
    "FINANCIAL_CHANGE",
    {
      noBukti: transaction.noBukti,
      entityId,
      oldProjectId: transaction.projectId,
      newProjectId: targetProjectId,
    }
  );

  revalidatePath("/jurnal");
  revalidatePath("/jurnal-transaksi");
  revalidatePath("/buku-besar");
  revalidatePath("/kas-kecil");
  revalidatePath("/kas-besar");
  revalidatePath("/bank-buku");
  revalidatePath("/buku-bank");
  revalidatePath("/pendapatan");
  revalidatePath("/piutang");
  revalidatePath("/laporan-keuangan");
  return { success: true };
}
