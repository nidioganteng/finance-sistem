"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions, resolveStaffId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRunningSaldo } from "@/lib/kas";
import { canManageTransaksi } from "@/lib/rbac";
import { logActivity } from "@/lib/actions/log";
import { REKENING_BY_ENTITY, REKENING_COA_CODE } from "@/lib/bank-accounts";
import { computeNewTerminPercentage } from "@/lib/piutang";
import { TerminStatus } from "@prisma/client";

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
  const projectId = (formData.get("projectId") as string | null)?.trim() || null;

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

  let jenisInput = await prisma.jenisInputTransaksi.findUnique({ where: { key: "jurnalTransaksi" } });
  if (!jenisInput) {
    jenisInput = await prisma.jenisInputTransaksi.create({
      data: { key: "jurnalTransaksi", nama: "Jurnal Transaksi", active: true },
    });
  }

  let preservedCrossingInfo: { crossingGroupId?: string; crossingFromEntityKey?: string; originalHutangCoaCode?: string } | null = null;

  if (editNoBukti) {
    const oldTxs = await prisma.transaction.findMany({
      where: {
        entityId: entity.id,
        jenisInputId: jenisInput.id,
        noBukti: editNoBukti,
      },
      select: { extraFieldsJson: true },
    });
    for (const ot of oldTxs) {
      const extra = ot.extraFieldsJson as Record<string, unknown> | null;
      if (extra?.crossingFromEntityKey) {
        preservedCrossingInfo = {
          ...(typeof extra.crossingGroupId === "string" ? { crossingGroupId: extra.crossingGroupId } : {}),
          ...(typeof extra.crossingFromEntityKey === "string" ? { crossingFromEntityKey: extra.crossingFromEntityKey } : {}),
          ...(typeof extra.originalHutangCoaCode === "string" ? { originalHutangCoaCode: extra.originalHutangCoaCode } : {}),
        };
        break;
      }
    }

    await prisma.transaction.deleteMany({
      where: { entityId: entity.id, jenisInputId: jenisInput.id, noBukti: editNoBukti },
    });
    await prisma.transaction.deleteMany({
      where: {
        noBukti: editNoBukti,
        extraFieldsJson: { path: "$.autoPostedFromJurnal", equals: true },
      },
    });
    await prisma.fakturPendapatan.deleteMany({
      where: { noFaktur: editNoBukti },
    });
    await prisma.termin.deleteMany({
      where: { name: { contains: `[${editNoBukti}]` } },
    });
  } else {
    const dup = await prisma.transaction.findFirst({
      where: { entityId: entity.id, noBukti },
      select: { id: true },
    });
    if (dup) return { error: `No. Bukti "${noBukti}" sudah dipakai di entitas ini.` };
  }

  try {
  const coaIds = [...new Set(validRows.map((r) => r.coaAccountId))];
  const coaList = await prisma.coaAccount.findMany({
    where: { id: { in: coaIds } },
    select: { id: true, code: true, name: true, kategori: true, reportType: true },
  });
  const coaMap = new Map(coaList.map((c) => [c.id, c]));

  const bankCoaMap = buildBankCoaMap();
  const kasKecilCodeToEntity = Object.fromEntries(Object.entries(KAS_KECIL_COA).map(([k, v]) => [v, k]));
  const kasBesarCodeToEntity = Object.fromEntries(Object.entries(KAS_BESAR_COA).map(([k, v]) => [v, k]));

  type Ops = ReturnType<typeof prisma.transaction.create>;
  const allOps: Ops[] = [];
  const staffId = await resolveStaffId(session.user.id, session.user.email);
  const firstKeterangan = validRows[0]?.keterangan?.trim() ?? "";

  // Main journal rows
  for (const row of validRows) {
    const isKredit = (row.kredit ?? 0) > 0;
    const extraFieldsJson = preservedCrossingInfo
      ? {
          isCrossingEntry: true,
          ...preservedCrossingInfo,
          crossingRole: isKredit ? "HUTANG" : "BEBAN",
        }
      : undefined;

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
          staffId,
          projectId: projectId || null,
          ...(extraFieldsJson ? { extraFieldsJson } : {}),
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

    const txYear = new Date(tanggal).getFullYear();
    const prevSaldo = await getRunningSaldo(targetEntityId, targetJenisInputId, rekeningNama, txYear);
    const newSaldo = prevSaldo + (arahMasuk ? nominal : -nominal);

    // Kas/Bank primary entry
    allOps.push(
      prisma.transaction.create({
        data: {
          entityId: targetEntityId,
          jenisInputId: targetJenisInputId,
          tanggal: new Date(tanggal),
          noBukti,
          keterangan: row.keterangan?.trim() || firstKeterangan,
          coaAccountId: row.coaAccountId,
          debit: arahMasuk ? nominal : 0,
          kredit: arahMasuk ? 0 : nominal,
          saldoSetelah: newSaldo,
          staffId,
          projectId: projectId || null,
          extraFieldsJson: {
            isKasEntry: true,
            autoPostedFromJurnal: true,
            ...(rekeningNama ? { rekeningNama } : {}),
          },
        },
      })
    );

    // Salin baris-baris akun lawan (pendapatan, pajak, beban, dll) ke ledger bank/kas
    // agar kolom AKUN di Buku Bank menampilkan rincian akun transaksi
    for (const counterpartRow of validRows) {
      if (counterpartRow.coaAccountId === row.coaAccountId) continue;
      const cpCoa = coaMap.get(counterpartRow.coaAccountId);
      if (cpCoa && (bankCoaMap[cpCoa.code] || kasKecilCodeToEntity[cpCoa.code] || kasBesarCodeToEntity[cpCoa.code])) {
        continue;
      }
      allOps.push(
        prisma.transaction.create({
          data: {
            entityId: targetEntityId,
            jenisInputId: targetJenisInputId,
            tanggal: new Date(tanggal),
            noBukti,
            keterangan: counterpartRow.keterangan?.trim() || firstKeterangan,
            coaAccountId: counterpartRow.coaAccountId,
            debit: counterpartRow.debit ?? 0,
            kredit: counterpartRow.kredit ?? 0,
            saldoSetelah: newSaldo,
            staffId,
            projectId: projectId || null,
            extraFieldsJson: {
              autoPostedFromJurnal: true,
              ...(rekeningNama ? { rekeningNama } : {}),
            },
          },
        })
      );
    }
  }

  await prisma.$transaction(allOps);

  // ── SINKRONISASI KE LAPORAN PENDAPATAN & KONTROL TERMIN ──────────────────
  const pendapatanRows = validRows.filter((r) => {
    const c = coaMap.get(r.coaAccountId);
    return c && (c.kategori === "PENDAPATAN" || c.code.startsWith("4")) && (r.kredit ?? 0) > 0;
  });

  const pphRows = validRows.filter((r) => {
    const c = coaMap.get(r.coaAccountId);
    return c && (c.code === "533" || c.code === "534" || /pph/i.test(c.name)) && (r.debit ?? 0) > 0;
  });

  const ppnRows = validRows.filter((r) => {
    const c = coaMap.get(r.coaAccountId);
    return c && (c.code === "535" || c.code === "536" || /ppn/i.test(c.name));
  });

  const bankRows = validRows.filter((r) => {
    const c = coaMap.get(r.coaAccountId);
    return c && (bankCoaMap[c.code] || (c.reportType === "ARUS_KAS" && /bank|bpd|bri|bni|mdr/i.test(c.name)));
  });

  const totalDpp = pendapatanRows.reduce((s, r) => s + (r.kredit ?? 0), 0);
  const totalPph = pphRows.reduce((s, r) => s + (r.debit ?? 0), 0);
  const totalPpn = ppnRows.reduce((s, r) => s + ((r.debit ?? 0) || (r.kredit ?? 0)), 0);
  const bankDebitTotal = bankRows.filter((r) => (r.debit ?? 0) > 0).reduce((s, r) => s + (r.debit ?? 0), 0);

  const firstBankRow = bankRows.find((r) => (r.debit ?? 0) > 0) || bankRows[0];
  const bankCoa = firstBankRow ? coaMap.get(firstBankRow.coaAccountId) : null;
  const bankName = bankCoa ? (bankCoaMap[bankCoa.code]?.rekeningNama || bankCoa.name) : "BPD";

  if (totalDpp > 0 || (projectId && bankDebitTotal > 0) || (totalPph > 0 && bankDebitTotal > 0)) {
    const project = projectId ? await prisma.project.findUnique({ where: { id: projectId } }) : null;
    const nominalDiterima = bankDebitTotal > 0 ? bankDebitTotal : Math.max(0, totalDpp - totalPph + totalPpn);
    const dpp = totalDpp > 0 ? totalDpp : (nominalDiterima > 0 ? nominalDiterima + totalPph - totalPpn : 0);

    const tarifPphPersen = dpp > 0 && totalPph > 0 ? Number(((totalPph / dpp) * 100).toFixed(2)) : 3.5;
    const tarifPpnPersen = dpp > 0 && totalPpn > 0 ? Number(((totalPpn / dpp) * 100).toFixed(2)) : (totalPpn > 0 ? 11 : 0);
    const nilaiProyek = totalPpn > 0 ? dpp + totalPpn : dpp;
    const labaSetelahPajak = dpp - totalPph;

    const targetEntityIdForFaktur = project?.entityId ?? entity.id;
    const txDate = new Date(tanggal);

    const existingFaktur = await prisma.fakturPendapatan.findFirst({
      where: {
        noFaktur: noBukti,
        entityId: targetEntityIdForFaktur,
      },
    });

    const fakturData = {
      entityId: targetEntityIdForFaktur,
      npwp: "-",
      noFaktur: noBukti,
      masaPajak: txDate.getMonth() + 1,
      tahunPajak: txDate.getFullYear(),
      namaRekanan: project?.name ?? entity.name,
      namaJkp: firstKeterangan || (project ? `Jasa Konsultansi ${project.name}` : `Pendapatan ${noBukti}`),
      dpp,
      dppNilaiLain: dpp,
      tarifPpnPersen,
      tarifPphPersen,
      ppn: totalPpn,
      pph: totalPph,
      nilaiProyek,
      labaSetelahPajak,
      kodeJenisProyek: 1,
      pekerjaanPerusahaan: dpp,
      pekerjaanYangDipinjam: 0,
      tanggalTerima: txDate,
      bank: bankName,
      nominalDiterima,
      projectId: projectId || null,
      createdById: session.user.id,
    };

    if (existingFaktur) {
      await prisma.fakturPendapatan.update({
        where: { id: existingFaktur.id },
        data: fakturData,
      });
    } else {
      await prisma.fakturPendapatan.create({
        data: fakturData,
      });
    }

    // Update / Tambah Progres Termin di Kontrol Piutang jika ada proyek yang dipilih
    if (projectId && project) {
      const projectWithTermins = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
          termin: {
            select: { id: true, name: true, percentage: true, createdAt: true },
            orderBy: { createdAt: "asc" },
          },
        },
      });

      if (projectWithTermins) {
        const oldTermin = projectWithTermins.termin.find(
          (t) => t.name.includes(`[${noBukti}]`) || (editNoBukti && t.name.includes(`[${editNoBukti}]`))
        );
        if (oldTermin) {
          await prisma.termin.delete({ where: { id: oldTermin.id } });
        }

        const remainingTermins = projectWithTermins.termin.filter(
          (t) => !oldTermin || t.id !== oldTermin.id
        );
        const existingPcts = remainingTermins.map((t) => t.percentage);
        const maxPctSoFar = existingPcts.reduce((max, p) => Math.max(max, p), 0);

        const nominalTermin = dpp > 0 ? dpp : nominalDiterima;
        if (nominalTermin > 0) {
          const newPct = computeNewTerminPercentage(
            Number(projectWithTermins.contractValue),
            existingPcts,
            nominalTermin
          );
          const terminKe = remainingTermins.length + 1;
          const deltaPct = Math.max(0, newPct - maxPctSoFar);

          await prisma.termin.create({
            data: {
              projectId: projectWithTermins.id,
              name: `Termin ${terminKe} (${deltaPct}% Kontrak) [${noBukti}]`,
              percentage: newPct,
              status: newPct >= 80 ? TerminStatus.ON_TRACK : TerminStatus.AT_RISK,
            },
          });

          if (newPct >= 100) {
            await prisma.project.update({
              where: { id: projectWithTermins.id },
              data: { status: "COMPLETED" },
            });
          }
        }
      }
    }
  }

  logActivity(
    session.user.id,
    `${editNoBukti ? "Edit" : "Input"} Jurnal Transaksi – ${noBukti} (${entity.name})${firstKeterangan ? ": " + firstKeterangan : ""}`,
    "FINANCIAL_CHANGE",
    { entityKey, noBukti, projectId, rowCount: validRows.length }
  );

  revalidatePath("/jurnal-transaksi");
  revalidatePath("/jurnal");
  revalidatePath("/buku-besar");
  revalidatePath("/kas-kecil");
  revalidatePath("/kas-besar");
  revalidatePath("/bank-buku");
  revalidatePath("/buku-bank");
  revalidatePath("/pendapatan");
  revalidatePath("/piutang");
  revalidatePath("/laporan-hutang-piutang");
  revalidatePath("/neraca");
  revalidatePath("/laporan-keuangan");
  revalidatePath("/laba-rugi");
  return { success: true };
  } catch (e) {
    console.error("[saveJurnalTransaksi]", e);
    const msg = e instanceof Error ? e.message : String(e);
    return { error: `Gagal menyimpan jurnal: ${msg}` };
  }
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

    await prisma.fakturPendapatan.deleteMany({
      where: { noFaktur: firstTx.noBukti },
    });

    const termins = await prisma.termin.findMany({
      where: { name: { contains: `[${firstTx.noBukti}]` } },
      select: { id: true, projectId: true },
    });
    if (termins.length > 0) {
      await prisma.termin.deleteMany({
        where: { id: { in: termins.map((t) => t.id) } },
      });
      for (const t of termins) {
        const remaining = await prisma.termin.findMany({
          where: { projectId: t.projectId },
          select: { percentage: true },
        });
        const maxRem = remaining.reduce((max, r) => Math.max(max, r.percentage), 0);
        if (maxRem < 100) {
          await prisma.project.update({
            where: { id: t.projectId },
            data: { status: "ACTIVE" },
          });
        }
      }
    }
  }

  logActivity(session.user.id, `Hapus Jurnal Transaksi (${txIds.length} baris)`, "FINANCIAL_CHANGE", { txIds });
  revalidatePath("/jurnal-transaksi");
  revalidatePath("/jurnal");
  revalidatePath("/buku-besar");
  revalidatePath("/kas-kecil");
  revalidatePath("/kas-besar");
  revalidatePath("/bank-buku");
  revalidatePath("/buku-bank");
  revalidatePath("/pendapatan");
  revalidatePath("/piutang");
  revalidatePath("/laporan-hutang-piutang");
  revalidatePath("/neraca");
  revalidatePath("/laporan-keuangan");
  revalidatePath("/laba-rugi");
  return { success: true };
}
