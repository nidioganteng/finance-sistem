"use server";

import { randomUUID } from "crypto";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRunningSaldo } from "@/lib/kas";
import { isValidRekening, getRekeningNama, REKENING_COA_CODE } from "@/lib/bank-accounts";
import { computeNewTerminPercentage } from "@/lib/piutang";
import { TerminStatus } from "@prisma/client";
import { canManageTransaksi } from "@/lib/rbac";
import { logActivity } from "@/lib/actions/log";

type KasRowInput = { coaAccountId: string; nominal: number };

export type CreateKasTransactionInput = {
  entityKey: string;
  jenisInputKey: string;
  tanggal: string;
  noBukti: string;
  keterangan: string;
  arah: "masuk" | "keluar";
  rows: KasRowInput[];
  pagePath: string; // path buat revalidate, mis. "/kas-kecil"
  rekeningId?: string; // khusus Bank Buku
  crossingEntityKeys?: string[]; // crossing antar entitas (opsional, bisa lebih dari satu)
  projectId?: string; // uang masuk buat proyek ini → otomatis jadi progres termin
};

const KAS_KECIL_COA: Record<string, string> = {
  kencana: "1100", gaharu: "1200", tataring: "1300", ciptaAsri: "1400", umum: "1500",
};
const KAS_BESAR_COA: Record<string, string> = {
  kencana: "110", gaharu: "120", tataring: "130", ciptaAsri: "140",
};

async function resolveKasCoa(jenisInputKey: string, entityKey: string, rekeningId?: string): Promise<string | null> {
  if (jenisInputKey === "kasKecil") {
    const code = KAS_KECIL_COA[entityKey];
    if (!code) return null;
    return (await prisma.coaAccount.findUnique({ where: { code_scope: { code, scope: "KAS" } } }))?.id ?? null;
  }
  if (jenisInputKey === "kasBesar") {
    const code = KAS_BESAR_COA[entityKey];
    if (!code) return null;
    return (await prisma.coaAccount.findUnique({ where: { code_scope: { code, scope: "KAS" } } }))?.id ?? null;
  }
  if (jenisInputKey === "bankBuku" && rekeningId) {
    const coaCode = REKENING_COA_CODE[rekeningId];
    if (coaCode) return (await prisma.coaAccount.findUnique({ where: { code_scope: { code: coaCode, scope: "BANK" } } }))?.id ?? null;
  }
  return null;
}

export async function createKasTransaction(input: CreateKasTransactionInput) {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Belum login." };
  if (!canManageTransaksi(session.user.role)) return { error: "Kamu tidak punya akses untuk input transaksi ini." };
  if (!session.user.entityKeys.includes(input.entityKey)) return { error: "Kamu tidak punya akses ke entity ini." };

  const validRows = input.rows.filter((r) => r.coaAccountId && r.nominal > 0);
  if (validRows.length === 0) return { error: "Isi minimal satu baris akun dengan nominal." };
  if (!input.noBukti || !input.keterangan) return { error: "No. bukti dan keterangan wajib diisi." };

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
  const kasCoaId = await resolveKasCoa(input.jenisInputKey, input.entityKey, input.rekeningId);

  const total = validRows.reduce((sum, r) => sum + r.nominal, 0);
  const prevSaldo = await getRunningSaldo(entity.id, jenisInput.id, rekeningNama);
  const newSaldo = prevSaldo + (input.arah === "masuk" ? total : -total);
  const isKeluar = input.arah === "keluar";

  const crossingEntityKeys = (input.crossingEntityKeys ?? []).filter(Boolean);
  const crossingGroupId = crossingEntityKeys.length > 0 ? randomUUID() : undefined;

  // Pre-calculate crossing entity saldos (read-only, safe to do before transaction)
  type CrossingEntry = { entity: { id: string; key: string }; newSaldo: number };
  const crossingEntries: CrossingEntry[] = [];
  for (const crossKey of crossingEntityKeys) {
    const crossEntity = await prisma.entity.findUnique({ where: { key: crossKey } });
    if (!crossEntity) continue;
    const crossPrev = await getRunningSaldo(crossEntity.id, jenisInput.id);
    const crossNewSaldo = crossPrev + (isKeluar ? -total : total);
    crossingEntries.push({ entity: crossEntity, newSaldo: crossNewSaldo });
  }

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
        ...(crossingGroupId ? { crossingEntityKeys, crossingGroupId } : {}),
      },
    },
  });

  // Uang masuk yang ditandai buat proyek tertentu otomatis jadi termin baru
  // proyek itu — dinomori urut per proyek (Termin 1, Termin 2, dst), bukan
  // diberi nama tanggal. Persentase tetap dihitung & disimpan di belakang
  // layar (dipakai buku besar perhitungan Piutang Perlu Perhatian dkk), tapi
  // bukan yang ditampilkan/diinput Keuangan — itu bagian tampilan Sidamon.
  const terminCreate: ReturnType<typeof prisma.termin.create>[] = [];
  if (!isKeluar && input.projectId) {
    const project = await prisma.project.findUnique({
      where: { id: input.projectId },
      include: { termin: { select: { percentage: true } } },
    });
    if (project) {
      const newPct = computeNewTerminPercentage(
        Number(project.contractValue),
        project.termin.map((t) => t.percentage),
        total
      );
      const terminKe = project.termin.length + 1;
      terminCreate.push(
        prisma.termin.create({
          data: {
            projectId: input.projectId,
            name: `Termin ${terminKe}`,
            percentage: newPct,
            status: newPct >= 80 ? TerminStatus.ON_TRACK : TerminStatus.AT_RISK,
          },
        })
      );
      // Termin 100% → proyek otomatis selesai, hilang dari Kontrol Piutang.
      // Jurnal transaksinya tetap ada.
      if (newPct >= 100) {
        terminCreate.push(
          prisma.project.update({ where: { id: input.projectId }, data: { status: "COMPLETED" } }) as never
        );
      }
    }
  }

  // Build crossing entity ops — tagged with crossingGroupId so they can be deleted/found together
  const crossingOps = crossingEntries.flatMap(({ entity: crossEntity, newSaldo: crossNewSaldo }) => {
    const crossCommon = {
      entityId: crossEntity.id,
      jenisInputId: jenisInput.id,
      tanggal: new Date(input.tanggal),
      noBukti: input.noBukti,
      keterangan: input.keterangan,
      saldoSetelah: crossNewSaldo,
      staffId: session.user.id,
    };
    const crossAkun = validRows.map((r) =>
      prisma.transaction.create({
        data: {
          ...crossCommon,
          coaAccountId: r.coaAccountId,
          debit: isKeluar ? r.nominal : 0,
          kredit: isKeluar ? 0 : r.nominal,
          extraFieldsJson: { crossingGroupId, crossingFromEntityKey: input.entityKey },
        },
      })
    );
    const crossKas = prisma.transaction.create({
      data: {
        ...crossCommon,
        coaAccountId: kasCoaId,
        debit: isKeluar ? 0 : total,
        kredit: isKeluar ? total : 0,
        extraFieldsJson: { isKasEntry: true, crossingGroupId, crossingFromEntityKey: input.entityKey },
      },
    });
    return [...crossAkun, crossKas];
  });

  await prisma.$transaction([...akunRows, kasEntry, ...crossingOps, ...terminCreate]);

  logActivity(session.user.id, `Input transaksi ${jenisInput.nama} – ${input.noBukti} (${entity.name})`, "FINANCIAL_CHANGE", { entityKey: input.entityKey, noBukti: input.noBukti, total, arah: input.arah });

  revalidatePath(input.pagePath);
  revalidatePath("/jurnal");
  revalidatePath("/piutang");
  return { success: true };
}

export async function deleteKasTransactionGroup(txIds: string[], pagePath: string) {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Belum login." };
  if (!canManageTransaksi(session.user.role)) return { error: "Kamu tidak punya akses untuk menghapus transaksi." };
  if (txIds.length === 0) return { error: "Tidak ada transaksi untuk dihapus." };

  // Find crossingGroupIds from the source transactions
  const sourceTxs = await prisma.transaction.findMany({
    where: { id: { in: txIds } },
    select: { extraFieldsJson: true },
  });
  const crossingGroupIds = sourceTxs
    .map((tx) => (tx.extraFieldsJson as Record<string, unknown> | null)?.crossingGroupId)
    .filter((v): v is string => typeof v === "string");

  const deleteOps = [
    prisma.transaction.deleteMany({ where: { id: { in: txIds } } }),
    ...crossingGroupIds.map((gid) =>
      prisma.transaction.deleteMany({
        where: { extraFieldsJson: { path: "$.crossingGroupId", equals: gid } },
      })
    ),
  ];

  await prisma.$transaction(deleteOps);

  logActivity(session.user.id, `Hapus transaksi (${txIds.length} baris)`, "FINANCIAL_CHANGE", { txIds });

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
  const kasCoaId = await resolveKasCoa(input.jenisInputKey, input.entityKey, input.rekeningId);

  // Find old crossingGroupIds before deleting
  const existingTxs = await prisma.transaction.findMany({
    where: { id: { in: input.existingTxIds } },
    select: { extraFieldsJson: true },
  });
  const oldCrossingGroupIds = existingTxs
    .map((tx) => (tx.extraFieldsJson as Record<string, unknown> | null)?.crossingGroupId)
    .filter((v): v is string => typeof v === "string");

  // Delete source + all old crossing transactions
  await prisma.$transaction([
    prisma.transaction.deleteMany({ where: { id: { in: input.existingTxIds } } }),
    ...oldCrossingGroupIds.map((gid) =>
      prisma.transaction.deleteMany({
        where: { extraFieldsJson: { path: "$.crossingGroupId", equals: gid } },
      })
    ),
  ]);

  // Recalculate with new values
  const total = validRows.reduce((sum, r) => sum + r.nominal, 0);
  const prevSaldo = await getRunningSaldo(entity.id, jenisInput.id, rekeningNama);
  const newSaldo = prevSaldo + (input.arah === "masuk" ? total : -total);
  const isKeluar = input.arah === "keluar";

  const crossingEntityKeys = (input.crossingEntityKeys ?? []).filter(Boolean);
  const crossingGroupId = crossingEntityKeys.length > 0 ? randomUUID() : undefined;

  type CrossingEntry = { entity: { id: string; key: string }; newSaldo: number };
  const crossingEntries: CrossingEntry[] = [];
  for (const crossKey of crossingEntityKeys) {
    const crossEntity = await prisma.entity.findUnique({ where: { key: crossKey } });
    if (!crossEntity) continue;
    const crossPrev = await getRunningSaldo(crossEntity.id, jenisInput.id);
    const crossNewSaldo = crossPrev + (isKeluar ? -total : total);
    crossingEntries.push({ entity: crossEntity, newSaldo: crossNewSaldo });
  }

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
        ...(crossingGroupId ? { crossingEntityKeys, crossingGroupId } : {}),
      },
    },
  });

  const crossingOps = crossingEntries.flatMap(({ entity: crossEntity, newSaldo: crossNewSaldo }) => {
    const crossCommon = {
      entityId: crossEntity.id,
      jenisInputId: jenisInput.id,
      tanggal: new Date(input.tanggal),
      noBukti: input.noBukti,
      keterangan: input.keterangan,
      saldoSetelah: crossNewSaldo,
      staffId: session.user.id,
    };
    const crossAkun = validRows.map((r) =>
      prisma.transaction.create({
        data: {
          ...crossCommon,
          coaAccountId: r.coaAccountId,
          debit: isKeluar ? r.nominal : 0,
          kredit: isKeluar ? 0 : r.nominal,
          extraFieldsJson: { crossingGroupId, crossingFromEntityKey: input.entityKey },
        },
      })
    );
    const crossKas = prisma.transaction.create({
      data: {
        ...crossCommon,
        coaAccountId: kasCoaId,
        debit: isKeluar ? 0 : total,
        kredit: isKeluar ? total : 0,
        extraFieldsJson: { isKasEntry: true, crossingGroupId, crossingFromEntityKey: input.entityKey },
      },
    });
    return [...crossAkun, crossKas];
  });

  await prisma.$transaction([...akunRows, kasEntry, ...crossingOps]);

  logActivity(session.user.id, `Edit transaksi – ${input.noBukti} (${entity.name})`, "FINANCIAL_CHANGE", { entityKey: input.entityKey, noBukti: input.noBukti, total, arah: input.arah });

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
  if (!canManageTransaksi(session.user.role)) return { error: "Kamu tidak punya akses untuk mengedit transaksi." };
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

  logActivity(session.user.id, `Update keterangan/COA transaksi – ${input.newNoBukti.trim()}`, "FINANCIAL_CHANGE", { txIds: input.txIds });

  revalidatePath(input.pagePath);
  revalidatePath("/jurnal");
  return { success: true };
}
