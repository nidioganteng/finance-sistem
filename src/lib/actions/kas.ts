"use server";

import { randomUUID } from "crypto";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions, resolveStaffId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRunningSaldo, ENTITY_PREFIX, ENTITY_PREFIX_UMUM } from "@/lib/kas";
import { isValidRekening, getRekeningNama, REKENING_COA_CODE, REKENING_BY_ENTITY } from "@/lib/bank-accounts";
import { computeNewTerminPercentage, syncProjectSpend, PIUTANG_COA } from "@/lib/piutang";
import { TerminStatus } from "@prisma/client";
import { canManageTransaksi } from "@/lib/rbac";
import { logActivity } from "@/lib/actions/log";

// Format Pengeluaran Umum: {PREFIX}{MMDD}{SEQ}
// Contoh: UK09281 (Kencana), UG09281 (Gaharu), UT09281 (Tataring), UC09281 (Cipta Asri)
// SEQ mulai dari 1, naik berurutan per hari per entitas
export async function generateNoBukti(entityKey: string, tanggal: string): Promise<string> {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Belum login.");

  const prefix = ENTITY_PREFIX_UMUM[entityKey] ?? ENTITY_PREFIX[entityKey] ?? entityKey.toUpperCase().slice(0, 2);
  const d = new Date(tanggal);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const dayPart = `${mm}${dd}`;
  const pattern = `${prefix}${dayPart}`;

  const entity = await prisma.entity.findUnique({ where: { key: entityKey } });
  if (!entity) throw new Error("Entity tidak ditemukan.");

  // Ambil semua noBukti hari itu lalu cari sequence tertinggi
  const existing = await prisma.transaction.findMany({
    where: {
      entityId: entity.id,
      noBukti: { startsWith: pattern },
    },
    select: { noBukti: true },
    distinct: ["noBukti"],
  });

  let maxSeq = 0;
  for (const row of existing) {
    const seqStr = row.noBukti.slice(pattern.length);
    const seq = parseInt(seqStr, 10);
    if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
  }

  return `${pattern}${maxSeq + 1}`;
}

type KasRowInput = { coaAccountId: string; nominal: number; keterangan?: string };

export type CreateKasTransactionInput = {
  entityKey: string;
  jenisInputKey: string;
  tanggal: string;
  noBukti: string;
  keterangan: string;
  arah: "masuk" | "keluar";
  rows: KasRowInput[];
  pagePath: string; // path buat revalidate, mis. "/kas-kecil"
  rekeningId?: string; // khusus Buku Bank
  crossingEntityKeys?: string[]; // crossing antar entitas (opsional, bisa lebih dari satu)
  projectId?: string; // uang masuk buat proyek ini → otomatis jadi progres termin
  arahLaporan?: string[]; // override output keuangan per transaksi (custom jenis input)
  syncBukuBankRekeningId?: string; // Kas Kecil masuk dari Buku Bank → auto-catat di Buku Bank
};

const KAS_KECIL_COA: Record<string, string> = {
  kencana: "1100", gaharu: "1200", tataring: "1300", ciptaAsri: "1400", umum: "1500",
};
const KAS_BESAR_COA: Record<string, string> = {
  kencana: "110", gaharu: "120", tataring: "130", ciptaAsri: "140",
};
const PIUTANG_COA_CODE: Record<string, string> = {
  kencana: "111", gaharu: "112", tataring: "113", ciptaAsri: "114", umum: "115",
};
const HUTANG_COA_CODE: Record<string, string> = {
  kencana: "311", gaharu: "312", tataring: "313", ciptaAsri: "314", umum: "315",
};

async function resolveKasCoa(jenisInputKey: string, entityKey: string, rekeningId?: string): Promise<string | null> {
  if (jenisInputKey === "kasKecil") {
    const code = KAS_KECIL_COA[entityKey];
    if (!code) return null;
    return (await prisma.coaAccount.findUnique({ where: { code } }))?.id ?? null;
  }
  if (jenisInputKey === "kasBesar") {
    const code = KAS_BESAR_COA[entityKey];
    if (!code) return null;
    return (await prisma.coaAccount.findUnique({ where: { code } }))?.id ?? null;
  }
  if (jenisInputKey === "bankBuku") {
    let effectiveRekeningId = rekeningId;
    if (!effectiveRekeningId || !isValidRekening(entityKey, effectiveRekeningId)) {
      effectiveRekeningId = REKENING_BY_ENTITY[entityKey]?.[0]?.id;
    }
    const coaCode = effectiveRekeningId ? REKENING_COA_CODE[effectiveRekeningId] : undefined;
    if (coaCode) return (await prisma.coaAccount.findUnique({ where: { code: coaCode } }))?.id ?? null;
  }
  return null;
}

async function resolveCrossingDebitCoa(
  primaryRowCoaId: string | undefined,
  targetEntityKey?: string,
  projectId?: string
): Promise<{ coaAccountId: string; role: "PIUTANG" | "BEBAN" } | null> {
  const coa = primaryRowCoaId ? await prisma.coaAccount.findUnique({ where: { id: primaryRowCoaId } }) : null;
  if (!coa) return null;

  if (coa.kategori === "BEBAN") {
    return {
      coaAccountId: coa.id,
      role: "BEBAN",
    };
  }

  // Jika transaksi ini untuk proyek (talangan pengeluaran proyek entitas rekanan):
  // Di entitas tujuan pemilik proyek, ini adalah BEBAN PROYEK!
  if (projectId) {
    const bebanProyekCoa =
      (await prisma.coaAccount.findFirst({ where: { code: "630" } })) ||
      (await prisma.coaAccount.findFirst({ where: { kategori: "BEBAN" } }));
    if (bebanProyekCoa) {
      return {
        coaAccountId: bebanProyekCoa.id,
        role: "BEBAN",
      };
    }
  }

  // Jika akun di entitas asal adalah akun piutang yang mengarah ke targetEntity itu sendiri
  // (misal Tataring talangi Gaharu dengan akun 112 Piutang GS):
  // Di Gaharu (targetEntity), akun debitnya tidak boleh 112 Piutang GS (piutang ke diri sendiri),
  // melainkan akun beban operasional rekanan.
  const targetPiutangCode = targetEntityKey ? PIUTANG_COA[targetEntityKey] : undefined;
  if (targetPiutangCode && coa.code === targetPiutangCode) {
    const fallbackBeban =
      (await prisma.coaAccount.findFirst({ where: { code: "630" } })) ||
      (await prisma.coaAccount.findFirst({ where: { code: "528" } })) ||
      (await prisma.coaAccount.findFirst({ where: { kategori: "BEBAN" } }));
    if (fallbackBeban) {
      return {
        coaAccountId: fallbackBeban.id,
        role: "BEBAN",
      };
    }
  }

  return {
    coaAccountId: coa.id,
    role: "PIUTANG",
  };
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
    if (!input.rekeningId) return { error: "Rekening/Bank wajib dipilih untuk transaksi Buku Bank." };
    if (!isValidRekening(input.entityKey, input.rekeningId)) {
      return { error: "Rekening yang dipilih tidak sesuai dengan entitas ini." };
    }
  }

  const entity = await prisma.entity.findUnique({ where: { key: input.entityKey } });
  const jenisInput = await prisma.jenisInputTransaksi.findUnique({ where: { key: input.jenisInputKey } });
  if (!entity || !jenisInput) return { error: "Entity atau jenis input tidak ditemukan." };

  // Cek duplikat noBukti per entitas
  const dupCheck = await prisma.transaction.findFirst({
    where: { entityId: entity.id, noBukti: input.noBukti },
    select: { id: true },
  });
  if (dupCheck) return { error: `No. bukti "${input.noBukti}" sudah dipakai di entitas ini.` };

  const rekeningNama = input.rekeningId ? getRekeningNama(input.entityKey, input.rekeningId) : undefined;
  const kasCoaId = await resolveKasCoa(input.jenisInputKey, input.entityKey, input.rekeningId);

  const total = validRows.reduce((sum, r) => sum + r.nominal, 0);
  const txYear = new Date(input.tanggal).getFullYear();
  const prevSaldo = await getRunningSaldo(entity.id, jenisInput.id, rekeningNama, txYear);
  const newSaldo = prevSaldo + (input.arah === "masuk" ? total : -total);
  const isKeluar = input.arah === "keluar";

  const crossingEntityKeys = (input.crossingEntityKeys ?? []).filter(Boolean);

  if (input.arah === "masuk" && crossingEntityKeys.length > 0) {
    return { error: "Pemasukan hanya boleh dari entitas yang sama, tidak bisa lintas entitas." };
  }

  const crossingGroupId = crossingEntityKeys.length > 0 ? randomUUID() : undefined;
  const arahLaporan = Array.isArray(input.arahLaporan) && input.arahLaporan.length > 0 ? input.arahLaporan : undefined;

  // Crossing entities (hanya saat keluar): langsung masuk ke Jurnal Transaksi (Non-Kas)
  type CrossingEntry = { entity: { id: string; key: string } };
  const crossingEntries: CrossingEntry[] = [];
  for (const crossKey of crossingEntityKeys) {
    const crossEntity = await prisma.entity.findUnique({ where: { key: crossKey } });
    if (crossEntity) crossingEntries.push({ entity: crossEntity });
  }

  const staffId = await resolveStaffId(session.user.id, session.user.email);

  const commonData = {
    entityId: entity.id,
    jenisInputId: jenisInput.id,
    tanggal: new Date(input.tanggal),
    noBukti: input.noBukti,
    keterangan: input.keterangan,
    saldoSetelah: newSaldo,
    staffId,
    projectId: input.projectId || null,
  };

  const akunRows = validRows.map((r) =>
    prisma.transaction.create({
      data: {
        ...commonData,
        coaAccountId: r.coaAccountId,
        debit: isKeluar ? r.nominal : 0,
        kredit: isKeluar ? 0 : r.nominal,
        ...((arahLaporan || r.keterangan || crossingGroupId)
          ? {
              extraFieldsJson: {
                ...(arahLaporan ? { arahLaporan } : {}),
                ...(r.keterangan ? { itemDescription: r.keterangan } : {}),
                ...(crossingGroupId ? { crossingEntityKeys, crossingGroupId } : {}),
              },
            }
          : {}),
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
        ...(arahLaporan ? { arahLaporan } : {}),
        ...(input.projectId ? { projectId: input.projectId } : {}),
      },
    },
  });

  // Uang masuk yang ditandai buat proyek tertentu otomatis jadi termin baru
  // proyek itu — dinomori urut per proyek (Termin 1, Termin 2, dst) dengan persentase progres.
  const terminCreate: ReturnType<typeof prisma.termin.create>[] = [];
  if (!isKeluar && input.projectId) {
    const project = await prisma.project.findUnique({
      where: { id: input.projectId },
      include: { termin: { select: { percentage: true } } },
    });
    if (project) {
      const maxPctSoFar = project.termin.map((t) => t.percentage).reduce((max, p) => Math.max(max, p), 0);
      const newPct = computeNewTerminPercentage(
        Number(project.contractValue),
        project.termin.map((t) => t.percentage),
        total
      );
      const terminKe = project.termin.length + 1;
      const deltaPct = Math.max(0, newPct - maxPctSoFar);
      terminCreate.push(
        prisma.termin.create({
          data: {
            projectId: input.projectId,
            name: `Termin ${terminKe} (${deltaPct}% Kontrak)`,
            percentage: newPct,
            status: TerminStatus.ON_TRACK,
          },
        })
      );
      // Termin 100% → proyek otomatis selesai
      if (newPct >= 100) {
        terminCreate.push(
          prisma.project.update({ where: { id: input.projectId }, data: { status: "COMPLETED" } }) as never
        );
      }
    }
  }

  // Pre-resolve hutang COA for the source entity (used as liability in crossing entries)
  const hutangCode = HUTANG_COA_CODE[input.entityKey];
  const hutangCoa = hutangCode ? await prisma.coaAccount.findUnique({ where: { code: hutangCode } }) : null;
  let jurnalJenisInput = await prisma.jenisInputTransaksi.findUnique({ where: { key: "jurnalTransaksi" } });
  if (!jurnalJenisInput) {
    jurnalJenisInput = await prisma.jenisInputTransaksi.create({
      data: { key: "jurnalTransaksi", nama: "Jurnal Transaksi", active: true },
    });
  }
  // Build crossing entity ops: tidak masuk ke kas/bank entitas tujuan,
  // melainkan langsung dicatat ke Jurnal Transaksi (Jurnal Umum & Buku Besar):
  // 1. Debet Kas/Bank rekanan jika pinjaman/piutang (atau akun Beban jika belanja riil)
  // 2. Kredit Hutang Afiliasi (Hutang entitas asal, misal 312 Hutang GS)
  const primaryRowCoaId = validRows[0]?.coaAccountId;
  const crossingOpsNested = await Promise.all(
    crossingEntries.map(async ({ entity: crossEntity }) => {
      const crossCommon = {
        entityId: crossEntity.id,
        jenisInputId: jurnalJenisInput?.id ?? jenisInput.id,
        tanggal: new Date(input.tanggal),
        noBukti: input.noBukti,
        keterangan: input.keterangan,
        saldoSetelah: 0,
        staffId,
        projectId: input.projectId || null,
      };
      const ops: ReturnType<typeof prisma.transaction.create>[] = [];

      const debitTarget = await resolveCrossingDebitCoa(primaryRowCoaId, crossEntity.key, input.projectId);

      if (debitTarget) {
        ops.push(
          prisma.transaction.create({
            data: {
              ...crossCommon,
              coaAccountId: debitTarget.coaAccountId,
              debit: total,
              kredit: 0,
              extraFieldsJson: {
                isCrossingEntry: true,
                crossingGroupId,
                crossingFromEntityKey: input.entityKey,
                crossingFromJenisInputKey: input.jenisInputKey,
                crossingFromRekeningId: input.rekeningId,
                crossingFromRekeningNama: rekeningNama,
                crossingRole: debitTarget.role,
                ...(input.projectId ? { projectId: input.projectId } : {}),
              },
            },
          })
        );
      }

      if (hutangCoa) {
        ops.push(
          prisma.transaction.create({
            data: {
              ...crossCommon,
              coaAccountId: hutangCoa.id,
              debit: 0,
              kredit: total,
              extraFieldsJson: {
                isCrossingEntry: true,
                crossingGroupId,
                crossingFromEntityKey: input.entityKey,
                crossingFromJenisInputKey: input.jenisInputKey,
                crossingFromRekeningId: input.rekeningId,
                crossingFromRekeningNama: rekeningNama,
                crossingRole: "HUTANG",
                originalHutangCoaCode: hutangCode,
                ...(input.projectId ? { projectId: input.projectId } : {}),
              },
            },
          })
        );
      }
      return ops;
    })
  );
  const crossingOps = crossingOpsNested.flat();

  // Saat auto-sync aktif, skip akunRows — Buku Bank keluar sudah jadi counterpart-nya
  const isSyncMode = !!((input.jenisInputKey === "kasKecil" || input.jenisInputKey === "kasBesar") && input.arah === "masuk" && input.syncBukuBankRekeningId);
  await prisma.$transaction([...(isSyncMode ? [] : akunRows), kasEntry, ...crossingOps, ...terminCreate]);

  // Auto-sync Kas Kecil masuk → Buku Bank keluar (jika dipilih)
  if (isSyncMode) {
    const bankJenisInput = await prisma.jenisInputTransaksi.findUnique({ where: { key: "bankBuku" } });
    if (bankJenisInput) {
      const rekeningNama = getRekeningNama(input.entityKey, input.syncBukuBankRekeningId!);
      const bankPrevSaldo = await getRunningSaldo(entity.id, bankJenisInput.id, rekeningNama, txYear);
      const bankNewSaldo = bankPrevSaldo - total;
      const bankCoaId = await resolveKasCoa("bankBuku", input.entityKey, input.syncBukuBankRekeningId);
      await prisma.transaction.create({
        data: {
          entityId: entity.id,
          jenisInputId: bankJenisInput.id,
          tanggal: new Date(input.tanggal),
          noBukti: input.noBukti,
          keterangan: `[Auto] ${input.keterangan}`,
          staffId,
          coaAccountId: bankCoaId,
          debit: 0,
          kredit: total,
          saldoSetelah: bankNewSaldo,
          extraFieldsJson: {
            isKasEntry: true,
            rekeningNama,
            syncFromKasKecil: true,
          },
        },
      });
      revalidatePath("/bank-buku");
    }
  }

  if (input.projectId) {
    await syncProjectSpend(input.projectId);
  }

  logActivity(session.user.id, `Input transaksi ${jenisInput.nama} – ${input.noBukti} (${entity.name})`, "FINANCIAL_CHANGE", { entityKey: input.entityKey, noBukti: input.noBukti, total, arah: input.arah, keterangan: input.keterangan });

  revalidatePath(input.pagePath);
  revalidatePath("/bank-buku");
  revalidatePath("/pendapatan");
  revalidatePath("/jurnal");
  revalidatePath("/jurnal-transaksi");
  revalidatePath("/buku-besar");
  revalidatePath("/piutang");
  revalidatePath("/laporan-hutang-piutang");
  revalidatePath("/neraca");
  revalidatePath("/laporan-keuangan");
  return { success: true };
}

export async function deleteKasTransactionGroup(txIds: string[], pagePath: string) {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Belum login." };
  if (!canManageTransaksi(session.user.role)) return { error: "Kamu tidak punya akses untuk menghapus transaksi." };
  if (txIds.length === 0) return { error: "Tidak ada transaksi untuk dihapus." };

  const affectedProjects = await prisma.transaction.findMany({
    where: { id: { in: txIds } },
    select: { projectId: true },
  });
  const projectIdsToSync = [...new Set(affectedProjects.map((p) => p.projectId).filter(Boolean))] as string[];

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

  for (const pId of projectIdsToSync) {
    await syncProjectSpend(pId);
  }

  logActivity(session.user.id, `Hapus transaksi (${txIds.length} baris)`, "FINANCIAL_CHANGE", { txIds });

  revalidatePath(pagePath);
  revalidatePath("/jurnal");
  revalidatePath("/jurnal-transaksi");
  revalidatePath("/buku-besar");
  revalidatePath("/laporan-hutang-piutang");
  revalidatePath("/neraca");
  revalidatePath("/laporan-keuangan");
  return { success: true };
}

export async function replaceKasTransaction(input: CreateKasTransactionInput & { existingTxIds: string[] }) {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Belum login." };
  if (!canManageTransaksi(session.user.role)) return { error: "Kamu tidak punya akses untuk mengedit transaksi." };
  if (!session.user.entityKeys.includes(input.entityKey)) return { error: "Kamu tidak punya akses ke entity ini." };
  if (input.existingTxIds.length === 0) return { error: "Tidak ada transaksi lama untuk diganti." };

  const validRows = input.rows.filter((r) => r.coaAccountId && r.nominal > 0);
  if (validRows.length === 0) return { error: "Isi minimal satu baris akun dengan nominal." };
  if (!input.noBukti || !input.keterangan) return { error: "No. bukti dan keterangan wajib diisi." };

  if (input.jenisInputKey === "bankBuku") {
    if (!input.rekeningId) return { error: "Rekening/Bank wajib dipilih untuk transaksi Buku Bank." };
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
  const txYear = new Date(input.tanggal).getFullYear();
  const prevSaldo = await getRunningSaldo(entity.id, jenisInput.id, rekeningNama, txYear);
  const newSaldo = prevSaldo + (input.arah === "masuk" ? total : -total);
  const isKeluar = input.arah === "keluar";

  const crossingEntityKeys = (input.crossingEntityKeys ?? []).filter(Boolean);

  if (input.arah === "masuk" && crossingEntityKeys.length > 0) {
    return { error: "Pemasukan hanya boleh dari entitas yang sama, tidak bisa lintas entitas." };
  }

  const crossingGroupId = crossingEntityKeys.length > 0 ? randomUUID() : undefined;
  const arahLaporan = Array.isArray(input.arahLaporan) && input.arahLaporan.length > 0 ? input.arahLaporan : undefined;

  // Entitas tujuan crossing: tidak masuk ke kas/bank tujuan, melainkan langsung ke Jurnal Transaksi
  type CrossingEntry = { entity: { id: string; key: string } };
  const crossingEntries: CrossingEntry[] = [];
  for (const crossKey of crossingEntityKeys) {
    const crossEntity = await prisma.entity.findUnique({ where: { key: crossKey } });
    if (crossEntity) crossingEntries.push({ entity: crossEntity });
  }

  const staffId = await resolveStaffId(session.user.id, session.user.email);

  const commonData = {
    entityId: entity.id,
    jenisInputId: jenisInput.id,
    tanggal: new Date(input.tanggal),
    noBukti: input.noBukti,
    keterangan: input.keterangan,
    saldoSetelah: newSaldo,
    staffId,
    projectId: input.projectId || null,
  };

  const akunRows = validRows.map((r) =>
    prisma.transaction.create({
      data: {
        ...commonData,
        coaAccountId: r.coaAccountId,
        debit: isKeluar ? r.nominal : 0,
        kredit: isKeluar ? 0 : r.nominal,
        ...((arahLaporan || r.keterangan || crossingGroupId)
          ? {
              extraFieldsJson: {
                ...(arahLaporan ? { arahLaporan } : {}),
                ...(r.keterangan ? { itemDescription: r.keterangan } : {}),
                ...(crossingGroupId ? { crossingEntityKeys, crossingGroupId } : {}),
              },
            }
          : {}),
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
        ...(arahLaporan ? { arahLaporan } : {}),
        ...(input.projectId ? { projectId: input.projectId } : {}),
      },
    },
  });

  // Pre-resolve hutang COA for the source entity (used as liability in crossing entries)
  const hutangCodeReplace = HUTANG_COA_CODE[input.entityKey];
  const hutangCoaReplace = hutangCodeReplace ? await prisma.coaAccount.findUnique({ where: { code: hutangCodeReplace } }) : null;
  let jurnalJenisInputReplace = await prisma.jenisInputTransaksi.findUnique({ where: { key: "jurnalTransaksi" } });
  if (!jurnalJenisInputReplace) {
    jurnalJenisInputReplace = await prisma.jenisInputTransaksi.create({
      data: { key: "jurnalTransaksi", nama: "Jurnal Transaksi", active: true },
    });
  }
  // Source KELUAR: Entity A Dr. PIUTANG_B / Cr. Kas A  →  Entity B Dr. Kas (atau Beban) / Cr. HUTANG_A (masuk ke Jurnal Transaksi)
  const primaryRowCoaIdReplace = validRows[0]?.coaAccountId;
  const crossingOpsNested = await Promise.all(
    crossingEntries.map(async ({ entity: crossEntity }) => {
      const crossCommon = {
        entityId: crossEntity.id,
        jenisInputId: jurnalJenisInputReplace?.id ?? jenisInput.id,
        tanggal: new Date(input.tanggal),
        noBukti: input.noBukti,
        keterangan: input.keterangan,
        saldoSetelah: 0,
        staffId,
        projectId: input.projectId || null,
      };
      const ops: ReturnType<typeof prisma.transaction.create>[] = [];

      const debitTarget = await resolveCrossingDebitCoa(primaryRowCoaIdReplace, crossEntity.key, input.projectId);

      if (debitTarget) {
        ops.push(
          prisma.transaction.create({
            data: {
              ...crossCommon,
              coaAccountId: debitTarget.coaAccountId,
              debit: total,
              kredit: 0,
              extraFieldsJson: {
                isCrossingEntry: true,
                crossingGroupId,
                crossingFromEntityKey: input.entityKey,
                crossingFromJenisInputKey: input.jenisInputKey,
                crossingFromRekeningId: input.rekeningId,
                crossingFromRekeningNama: rekeningNama,
                crossingRole: debitTarget.role,
                ...(input.projectId ? { projectId: input.projectId } : {}),
              },
            },
          })
        );
      }

      if (hutangCoaReplace) {
        ops.push(
          prisma.transaction.create({
            data: {
              ...crossCommon,
              coaAccountId: hutangCoaReplace.id,
              debit: 0,
              kredit: total,
              extraFieldsJson: {
                isCrossingEntry: true,
                crossingGroupId,
                crossingFromEntityKey: input.entityKey,
                crossingFromJenisInputKey: input.jenisInputKey,
                crossingFromRekeningId: input.rekeningId,
                crossingFromRekeningNama: rekeningNama,
                crossingRole: "HUTANG",
                originalHutangCoaCode: hutangCodeReplace,
                ...(input.projectId ? { projectId: input.projectId } : {}),
              },
            },
          })
        );
      }
      return ops;
    })
  );
  const crossingOps = crossingOpsNested.flat();

  await prisma.$transaction([...akunRows, kasEntry, ...crossingOps]);

  if (input.projectId) {
    await syncProjectSpend(input.projectId);
  }

  logActivity(session.user.id, `Edit transaksi – ${input.noBukti} (${entity.name})`, "FINANCIAL_CHANGE", { entityKey: input.entityKey, noBukti: input.noBukti, total, arah: input.arah, keterangan: input.keterangan });

  revalidatePath(input.pagePath);
  revalidatePath("/bank-buku");
  revalidatePath("/pendapatan");
  revalidatePath("/jurnal");
  revalidatePath("/jurnal-transaksi");
  revalidatePath("/buku-besar");
  revalidatePath("/piutang");
  revalidatePath("/laporan-hutang-piutang");
  revalidatePath("/neraca");
  revalidatePath("/laporan-keuangan");
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
  revalidatePath("/laporan-hutang-piutang");
  revalidatePath("/neraca");
  revalidatePath("/laporan-keuangan");
  return { success: true };
}
