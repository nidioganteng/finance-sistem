"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRunningSaldo } from "@/lib/kas";
import { canManageTransaksi } from "@/lib/rbac";
import { logActivity } from "@/lib/actions/log";
import { REKENING_BY_ENTITY, REKENING_COA_CODE } from "@/lib/bank-accounts";

type JurnalRow = { coaAccountId: string; debit: number; kredit: number; keterangan: string };

const KAS_KECIL_COA: Record<string, string> = {
  kencana: "1100", gaharu: "1200", tataring: "1300", ciptaAsri: "1400", umum: "1500",
};
const KAS_BESAR_COA: Record<string, string> = {
  kencana: "110", gaharu: "120", tataring: "130", ciptaAsri: "140",
};

type BankMatch = { rekeningId: string; entityKey: string; rekeningNama: string };

function buildBankCoaMap(): Record<string, BankMatch> {
  const map: Record<string, BankMatch> = {};
  for (const [entityKey, rekenings] of Object.entries(REKENING_BY_ENTITY)) {
    for (const rekening of rekenings) {
      const code = REKENING_COA_CODE[rekening.id];
      if (code) map[code] = { rekeningId: rekening.id, entityKey, rekeningNama: rekening.nama };
    }
  }
  return map;
}

export async function saveJurnalTransaksi(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Belum login." };
  if (!canManageTransaksi(session.user.role)) {
    return { error: "Kamu tidak punya akses untuk input jurnal transaksi." };
  }

  const tanggal = (formData.get("tanggal") as string | null)?.trim() ?? "";
  const entityKey = (formData.get("entityKey") as string | null)?.trim() ?? "";
  const noBukti = (formData.get("noBukti") as string | null)?.trim() ?? "";
  const editNoBukti = (formData.get("editNoBukti") as string | null)?.trim() ?? "";

  if (!tanggal) return { error: "Tanggal wajib diisi." };
  if (!noBukti) return { error: "No. Bukti wajib diisi." };
  if (!entityKey) return { error: "Entity tidak ditemukan." };

  if (!session.user.entityKeys.includes(entityKey)) {
    return { error: "Kamu tidak punya akses ke entity ini." };
  }

  const rowsJson = formData.get("rows") as string | null;
  let rows: JurnalRow[] = [];
  try {
    rows = JSON.parse(rowsJson ?? "[]");
  } catch {
    return { error: "Format baris tidak valid." };
  }

  const validRows = rows.filter((r) => r.coaAccountId && (r.debit > 0 || r.kredit > 0));
  if (validRows.length < 1) {
    return { error: "Isi minimal satu baris akun dengan nominal." };
  }

  const entity = await prisma.entity.findUnique({ where: { key: entityKey } });
  if (!entity) return { error: "Entity tidak ditemukan." };

  const jenisInput = await prisma.jenisInputTransaksi.findUnique({ where: { key: "jurnalTransaksi" } });
  if (!jenisInput) return { error: "Jenis input 'Jurnal Transaksi' belum dikonfigurasi di sistem." };

  if (editNoBukti) {
    await prisma.transaction.deleteMany({
      where: { entityId: entity.id, jenisInputId: jenisInput.id, noBukti: editNoBukti },
    });
    await prisma.transaction.deleteMany({
      where: {
        noBukti: editNoBukti,
        extraFieldsJson: { path: "$.autoPostedFromJurnal", equals: true },
      },
    });
  } else {
    const dup = await prisma.transaction.findFirst({
      where: { entityId: entity.id, noBukti },
      select: { id: true },
    });
    if (dup) return { error: `No. Bukti "${noBukti}" sudah dipakai di entitas ini.` };
  }

  const coaIds = [...new Set(validRows.map((r) => r.coaAccountId))];
  const coaList = await prisma.coaAccount.findMany({
    where: { id: { in: coaIds } },
    select: { id: true, code: true, name: true },
  });
  const coaMap = new Map(coaList.map((c) => [c.id, c]));

  const bankCoaMap = buildBankCoaMap();
  const kasKecilCodeToEntity = Object.fromEntries(Object.entries(KAS_KECIL_COA).map(([k, v]) => [v, k]));
  const kasBesarCodeToEntity = Object.fromEntries(Object.entries(KAS_BESAR_COA).map(([k, v]) => [v, k]));

  type Ops = ReturnType<typeof prisma.transaction.create>;
  const allOps: Ops[] = [];

  // Main journal rows
  for (const row of validRows) {
    allOps.push(
      prisma.transaction.create({
        data: {
          entityId: entity.id,
          jenisInputId: jenisInput.id,
          tanggal: new Date(tanggal),
          noBukti,
          keterangan: row.keterangan?.trim() ?? "",
          coaAccountId: row.coaAccountId,
          debit: row.debit ?? 0,
          kredit: row.kredit ?? 0,
          saldoSetelah: 0,
          staffId: session.user.id,
        },
      })
    );
  }

  // Auto-post ke kas/bank ledger jika COA cocok
  for (const row of validRows) {
    const coa = coaMap.get(row.coaAccountId);
    if (!coa) continue;

    const debit = row.debit ?? 0;
    const kredit = row.kredit ?? 0;
    const arahMasuk = debit > 0;
    const nominal = arahMasuk ? debit : kredit;

    let targetEntityId: string | null = null;
    let targetJenisInputId: string | null = null;
    let rekeningNama: string | undefined;

    const bankMatch = bankCoaMap[coa.code];
    if (bankMatch) {
      const tEntity = await prisma.entity.findUnique({ where: { key: bankMatch.entityKey } });
      const tJenis = await prisma.jenisInputTransaksi.findUnique({ where: { key: "bankBuku" } });
      if (tEntity && tJenis) {
        targetEntityId = tEntity.id; targetJenisInputId = tJenis.id; rekeningNama = bankMatch.rekeningNama;
      }
    } else {
      const kkKey = kasKecilCodeToEntity[coa.code];
      if (kkKey) {
        const tEntity = await prisma.entity.findUnique({ where: { key: kkKey } });
        const tJenis = await prisma.jenisInputTransaksi.findUnique({ where: { key: "kasKecil" } });
        if (tEntity && tJenis) { targetEntityId = tEntity.id; targetJenisInputId = tJenis.id; }
      } else {
        const kbKey = kasBesarCodeToEntity[coa.code];
        if (kbKey) {
          const tEntity = await prisma.entity.findUnique({ where: { key: kbKey } });
          const tJenis = await prisma.jenisInputTransaksi.findUnique({ where: { key: "kasBesar" } });
          if (tEntity && tJenis) { targetEntityId = tEntity.id; targetJenisInputId = tJenis.id; }
        }
      }
    }

    if (!targetEntityId || !targetJenisInputId) continue;

    const prevSaldo = await getRunningSaldo(targetEntityId, targetJenisInputId, rekeningNama);
    const newSaldo = prevSaldo + (arahMasuk ? nominal : -nominal);

    allOps.push(
      prisma.transaction.create({
        data: {
          entityId: targetEntityId,
          jenisInputId: targetJenisInputId,
          tanggal: new Date(tanggal),
          noBukti,
          keterangan: row.keterangan?.trim() ?? "",
          coaAccountId: row.coaAccountId,
          debit: arahMasuk ? nominal : 0,
          kredit: arahMasuk ? 0 : nominal,
          saldoSetelah: newSaldo,
          staffId: session.user.id,
          extraFieldsJson: {
            isKasEntry: true,
            autoPostedFromJurnal: true,
            ...(rekeningNama ? { rekeningNama } : {}),
          },
        },
      })
    );
  }

  await prisma.$transaction(allOps);

  const firstKeterangan = validRows[0]?.keterangan?.trim() ?? "";
  logActivity(
    session.user.id,
    `${editNoBukti ? "Edit" : "Input"} Jurnal Transaksi – ${noBukti} (${entity.name})${firstKeterangan ? ": " + firstKeterangan : ""}`,
    "FINANCIAL_CHANGE",
    { entityKey, noBukti, rowCount: validRows.length }
  );

  revalidatePath("/jurnal-transaksi");
  revalidatePath("/jurnal");
  revalidatePath("/kas-kecil");
  revalidatePath("/kas-besar");
  revalidatePath("/buku-bank");
  return { success: true };
}

export async function deleteJurnalTransaksi(txIds: string[]) {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Belum login." };
  if (!canManageTransaksi(session.user.role)) return { error: "Tidak punya akses." };
  if (!txIds.length) return { error: "Tidak ada transaksi yang dihapus." };

  const firstTx = await prisma.transaction.findUnique({
    where: { id: txIds[0] },
    select: { noBukti: true },
  });

  await prisma.transaction.deleteMany({ where: { id: { in: txIds } } });

  if (firstTx?.noBukti) {
    await prisma.transaction.deleteMany({
      where: {
        noBukti: firstTx.noBukti,
        extraFieldsJson: { path: "$.autoPostedFromJurnal", equals: true },
      },
    });
  }

  logActivity(session.user.id, `Hapus Jurnal Transaksi (${txIds.length} baris)`, "FINANCIAL_CHANGE", { txIds });
  revalidatePath("/jurnal-transaksi");
  revalidatePath("/jurnal");
  revalidatePath("/kas-kecil");
  revalidatePath("/kas-besar");
  revalidatePath("/buku-bank");
  return { success: true };
}
