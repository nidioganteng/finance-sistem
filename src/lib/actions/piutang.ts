"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { TerminStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/actions/log";
import { canManageTransaksi } from "@/lib/rbac";
import { getRunningSaldo } from "@/lib/kas";
import { PIUTANG_COA, HUTANG_COA } from "@/lib/piutang";

const KAS_KECIL_COA: Record<string, string> = {
  kencana: "1100", gaharu: "1200", tataring: "1300", ciptaAsri: "1400", umum: "1500",
};
const KAS_BESAR_COA: Record<string, string> = {
  kencana: "110", gaharu: "120", tataring: "130", ciptaAsri: "140",
};

async function resolveKasCoaId(jenisInputKey: "kasKecil" | "kasBesar", entityKey: string): Promise<string | null> {
  const coaMap = jenisInputKey === "kasKecil" ? KAS_KECIL_COA : KAS_BESAR_COA;
  const code = coaMap[entityKey];
  if (!code) return null;
  return (await prisma.coaAccount.findUnique({ where: { code }, select: { id: true } }))?.id ?? null;
}

export type CreatePelunasanInput = {
  /** The entity initiating the pelunasan (currently viewed entity) */
  currentEntityKey: string;
  /** "piutang" = current entity collecting from counterparty; "hutang" = current entity paying counterparty */
  balanceType: "piutang" | "hutang";
  counterpartyEntityKey: string;
  tanggal: string;
  noBukti: string;
  keterangan: string;
  nominal: number;
  jenisKasSumber: "kasKecil" | "kasBesar";
  /** Only for piutang side: which kas account the counterparty entity receives into */
  jenisKasTujuan?: "kasKecil" | "kasBesar";
};

export async function createPelunasan(input: CreatePelunasanInput): Promise<{ error?: string; success?: boolean }> {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Belum login." };
  if (!canManageTransaksi(session.user.role)) return { error: "Kamu tidak punya akses untuk input transaksi ini." };
  if (!session.user.entityKeys.includes(input.currentEntityKey)) {
    return { error: "Kamu tidak punya akses ke entitas ini." };
  }
  if (input.nominal <= 0) return { error: "Nominal harus lebih dari 0." };
  if (!input.noBukti || !input.keterangan) return { error: "No. bukti dan keterangan wajib diisi." };

  const currentEntity = await prisma.entity.findUnique({ where: { key: input.currentEntityKey } });
  const counterpartyEntity = await prisma.entity.findUnique({ where: { key: input.counterpartyEntityKey } });
  if (!currentEntity || !counterpartyEntity) return { error: "Entitas tidak ditemukan." };

  // Cek duplikat noBukti pada current entity
  const dupCheck = await prisma.transaction.findFirst({
    where: { entityId: currentEntity.id, noBukti: input.noBukti },
    select: { id: true },
  });
  if (dupCheck) return { error: `No. bukti "${input.noBukti}" sudah dipakai di entitas ini.` };

  const sumberKey = input.jenisKasSumber;
  const tujuanKey = input.jenisKasTujuan ?? input.jenisKasSumber;

  const jenisInputSrc = await prisma.jenisInputTransaksi.findUnique({ where: { key: sumberKey } });
  const jenisInputDst = await prisma.jenisInputTransaksi.findUnique({ where: { key: tujuanKey } });
  if (!jenisInputSrc || !jenisInputDst) return { error: "Jenis input tidak ditemukan." };

  const nom = input.nominal;

  if (input.balanceType === "piutang") {
    // Current entity = RECEIVER (collecting money it lent)
    // Current entity (e.g. Kencana): Dr. Kas Kencana (masuk) / Cr. PIUTANG_CAD (114)
    // Counterparty entity (e.g. Cipta Asri): Dr. HUTANG_KAK (311) / Cr. Kas Cipta Asri (keluar)

    const currentKasCoaId = await resolveKasCoaId(sumberKey, input.currentEntityKey);
    const currentPiutangCoaCode = PIUTANG_COA[input.counterpartyEntityKey]; // piutang TO counterparty
    const currentPiutangCoa = currentPiutangCoaCode
      ? await prisma.coaAccount.findUnique({ where: { code: currentPiutangCoaCode }, select: { id: true } })
      : null;
    if (!currentPiutangCoa) return { error: "COA piutang tidak ditemukan." };

    // Counterparty side: hutang COA of current entity (the liability counterparty owes to current)
    const counterpartyHutangCoaCode = HUTANG_COA[input.currentEntityKey];
    const counterpartyHutangCoa = counterpartyHutangCoaCode
      ? await prisma.coaAccount.findUnique({ where: { code: counterpartyHutangCoaCode }, select: { id: true } })
      : null;
    if (!counterpartyHutangCoa) return { error: "COA hutang counterparty tidak ditemukan." };

    const counterpartyKasCoaId = await resolveKasCoaId(tujuanKey, input.counterpartyEntityKey);

    // Running saldo calculations
    const currentPrevSaldo = await getRunningSaldo(currentEntity.id, jenisInputSrc.id);
    const currentNewSaldo = currentPrevSaldo + nom; // masuk

    const counterpartyPrevSaldo = await getRunningSaldo(counterpartyEntity.id, jenisInputDst.id);
    const counterpartyNewSaldo = counterpartyPrevSaldo - nom; // keluar

    const tanggalDate = new Date(input.tanggal);

    const ops = [
      // Current entity - kasEntry (masuk: Dr. Kas)
      prisma.transaction.create({
        data: {
          entityId: currentEntity.id,
          jenisInputId: jenisInputSrc.id,
          tanggal: tanggalDate,
          noBukti: input.noBukti,
          keterangan: input.keterangan,
          saldoSetelah: currentNewSaldo,
          staffId: session.user.id,
          coaAccountId: currentKasCoaId,
          debit: nom,
          kredit: 0,
          extraFieldsJson: { isKasEntry: true, pelunasanType: "piutang" },
        },
      }),
      // Current entity - akunRow (Cr. PIUTANG)
      prisma.transaction.create({
        data: {
          entityId: currentEntity.id,
          jenisInputId: jenisInputSrc.id,
          tanggal: tanggalDate,
          noBukti: input.noBukti,
          keterangan: input.keterangan,
          saldoSetelah: currentNewSaldo,
          staffId: session.user.id,
          coaAccountId: currentPiutangCoa.id,
          debit: 0,
          kredit: nom,
        },
      }),
      // Counterparty entity - kasEntry (keluar: Cr. Kas)
      prisma.transaction.create({
        data: {
          entityId: counterpartyEntity.id,
          jenisInputId: jenisInputDst.id,
          tanggal: tanggalDate,
          noBukti: input.noBukti,
          keterangan: input.keterangan,
          saldoSetelah: counterpartyNewSaldo,
          staffId: session.user.id,
          coaAccountId: counterpartyKasCoaId,
          debit: 0,
          kredit: nom,
          extraFieldsJson: { isKasEntry: true, pelunasanType: "hutang" },
        },
      }),
      // Counterparty entity - akunRow (Dr. HUTANG)
      prisma.transaction.create({
        data: {
          entityId: counterpartyEntity.id,
          jenisInputId: jenisInputDst.id,
          tanggal: tanggalDate,
          noBukti: input.noBukti,
          keterangan: input.keterangan,
          saldoSetelah: counterpartyNewSaldo,
          staffId: session.user.id,
          coaAccountId: counterpartyHutangCoa.id,
          debit: nom,
          kredit: 0,
        },
      }),
    ];

    await prisma.$transaction(ops);

    logActivity(
      session.user.id,
      `Pelunasan piutang ${input.noBukti} – ${currentEntity.name} terima dari ${counterpartyEntity.name} (${formatNominal(nom)})`,
      "FINANCIAL_CHANGE",
      { noBukti: input.noBukti, entityKey: input.currentEntityKey, counterpartyEntityKey: input.counterpartyEntityKey, nominal: nom },
    );
  } else {
    // balanceType === "hutang"
    // Current entity = PAYER (paying off its own debt)
    // Current entity (payer): Dr. HUTANG_X (Cr. counterparty COA) / Cr. Kas (keluar)
    // Counterparty entity (receiver): Dr. Kas (masuk) / Cr. PIUTANG_current

    const currentKasCoaId = await resolveKasCoaId(sumberKey, input.currentEntityKey);
    const currentHutangCoaCode = HUTANG_COA[input.counterpartyEntityKey]; // current owes counterparty
    const currentHutangCoa = currentHutangCoaCode
      ? await prisma.coaAccount.findUnique({ where: { code: currentHutangCoaCode }, select: { id: true } })
      : null;
    if (!currentHutangCoa) return { error: "COA hutang tidak ditemukan." };

    // Counterparty receives: piutang COA of counterparty pointing to current entity
    const counterpartyPiutangCoaCode = PIUTANG_COA[input.currentEntityKey];
    const counterpartyPiutangCoa = counterpartyPiutangCoaCode
      ? await prisma.coaAccount.findUnique({ where: { code: counterpartyPiutangCoaCode }, select: { id: true } })
      : null;
    if (!counterpartyPiutangCoa) return { error: "COA piutang counterparty tidak ditemukan." };

    const counterpartyKasCoaId = await resolveKasCoaId(tujuanKey, input.counterpartyEntityKey);

    // Running saldo calculations
    const currentPrevSaldo = await getRunningSaldo(currentEntity.id, jenisInputSrc.id);
    const currentNewSaldo = currentPrevSaldo - nom; // keluar

    const counterpartyPrevSaldo = await getRunningSaldo(counterpartyEntity.id, jenisInputDst.id);
    const counterpartyNewSaldo = counterpartyPrevSaldo + nom; // masuk

    const tanggalDate = new Date(input.tanggal);

    const ops = [
      // Current entity - kasEntry (keluar: Cr. Kas)
      prisma.transaction.create({
        data: {
          entityId: currentEntity.id,
          jenisInputId: jenisInputSrc.id,
          tanggal: tanggalDate,
          noBukti: input.noBukti,
          keterangan: input.keterangan,
          saldoSetelah: currentNewSaldo,
          staffId: session.user.id,
          coaAccountId: currentKasCoaId,
          debit: 0,
          kredit: nom,
          extraFieldsJson: { isKasEntry: true, pelunasanType: "hutang" },
        },
      }),
      // Current entity - akunRow (Dr. HUTANG)
      prisma.transaction.create({
        data: {
          entityId: currentEntity.id,
          jenisInputId: jenisInputSrc.id,
          tanggal: tanggalDate,
          noBukti: input.noBukti,
          keterangan: input.keterangan,
          saldoSetelah: currentNewSaldo,
          staffId: session.user.id,
          coaAccountId: currentHutangCoa.id,
          debit: nom,
          kredit: 0,
        },
      }),
      // Counterparty entity - kasEntry (masuk: Dr. Kas)
      prisma.transaction.create({
        data: {
          entityId: counterpartyEntity.id,
          jenisInputId: jenisInputDst.id,
          tanggal: tanggalDate,
          noBukti: input.noBukti,
          keterangan: input.keterangan,
          saldoSetelah: counterpartyNewSaldo,
          staffId: session.user.id,
          coaAccountId: counterpartyKasCoaId,
          debit: nom,
          kredit: 0,
          extraFieldsJson: { isKasEntry: true, pelunasanType: "piutang" },
        },
      }),
      // Counterparty entity - akunRow (Cr. PIUTANG)
      prisma.transaction.create({
        data: {
          entityId: counterpartyEntity.id,
          jenisInputId: jenisInputDst.id,
          tanggal: tanggalDate,
          noBukti: input.noBukti,
          keterangan: input.keterangan,
          saldoSetelah: counterpartyNewSaldo,
          staffId: session.user.id,
          coaAccountId: counterpartyPiutangCoa.id,
          debit: 0,
          kredit: nom,
        },
      }),
    ];

    await prisma.$transaction(ops);

    logActivity(
      session.user.id,
      `Pelunasan hutang ${input.noBukti} – ${currentEntity.name} bayar ke ${counterpartyEntity.name} (${formatNominal(nom)})`,
      "FINANCIAL_CHANGE",
      { noBukti: input.noBukti, entityKey: input.currentEntityKey, counterpartyEntityKey: input.counterpartyEntityKey, nominal: nom },
    );
  }

  revalidatePath("/piutang");
  revalidatePath("/jurnal");
  return { success: true };
}

function formatNominal(n: number): string {
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}

export async function auditTermin(terminId: string) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Belum login.");

  const termin = await prisma.termin.findUnique({ where: { id: terminId }, select: { name: true, project: { select: { code: true } } } });
  await prisma.termin.update({
    where: { id: terminId },
    data: {
      status: TerminStatus.ON_TRACK,
      auditedAt: new Date(),
      auditedById: session.user.id,
    },
  });
  logActivity(session.user.id, `Audit termin ${termin?.name ?? terminId} – Proyek ${termin?.project?.code ?? ""}`, "FINANCIAL_CHANGE", { terminId });
  revalidatePath("/piutang");
}

export async function updateTerminStatus(terminId: string, status: TerminStatus) {
  const session = await getServerSession(authOptions);
  const termin = await prisma.termin.findUnique({ where: { id: terminId }, select: { name: true, project: { select: { code: true } } } });
  await prisma.termin.update({ where: { id: terminId }, data: { status } });
  if (session?.user.id) {
    logActivity(session.user.id, `Update status termin ${termin?.name ?? terminId} → ${status}`, "FINANCIAL_CHANGE", { terminId, status });
  }
  revalidatePath("/piutang");
}

// Menyelesaikan proyek: status jadi COMPLETED, hilang dari Kontrol Piutang.
// Transaksi di jurnal tetap ada — hanya tampilan piutang yang menyembunyikannya.
export async function completeProject(projectId: string) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Belum login.");
  if (session.user.role !== "MANAJER_KEUANGAN" && session.user.role !== "SUPER_ADMIN") {
    throw new Error("Hanya Manajer Keuangan yang bisa menyelesaikan proyek.");
  }

  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { code: true, name: true } });
  await prisma.project.update({ where: { id: projectId }, data: { status: "COMPLETED" } });

  logActivity(session.user.id, `Selesaikan proyek ${project?.code ?? projectId} – ${project?.name ?? ""}`, "FINANCIAL_CHANGE", { projectId });
  revalidatePath("/piutang");
  revalidatePath("/dashboard");
}

// Membatalkan proyek: termin yang belum terbayar (sisa termin berjalan) dihapus
// supaya proyek dianggap selesai dan tidak terus memicu warning piutang.
export async function cancelProject(projectId: string) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Belum login.");
  if (session.user.role !== "MANAJER_KEUANGAN") {
    throw new Error("Hanya Manajer Keuangan yang bisa membatalkan proyek.");
  }

  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { code: true, name: true } });
  await prisma.$transaction([
    prisma.termin.deleteMany({ where: { projectId } }),
    prisma.project.update({ where: { id: projectId }, data: { status: "CANCELLED" } }),
  ]);

  logActivity(session.user.id, `Batalkan proyek ${project?.code ?? projectId} – ${project?.name ?? ""}`, "FINANCIAL_CHANGE", { projectId });
  revalidatePath("/piutang");
  revalidatePath("/dashboard");
}
