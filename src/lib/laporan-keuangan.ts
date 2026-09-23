import { prisma } from "./prisma";
import { formatRupiah } from "./dashboard-data";
import { CoaKategori, ReportCategory } from "@prisma/client";
import {
  isDebetNormal,
  isContraAset,
  isAktivaTetap,
  isLabaDitahan,
  hitungSaldoAkhir,
  getExcludedNoBuktiForVersion,
} from "./akuntansi";
import { calculateAsetDepreciation } from "./aset-tetap";

export type CoaLine = {
  code: string;
  name: string;
  saldo: number;
  saldoFmt: string;
  isContra?: boolean;
};

export type ReportVersion = "INTERNAL" | "UMUM";

const SUMBER_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  kasKecil: { bg: "#fef3c7", color: "#92400e", label: "Kas Kecil" },
  kasBesar: { bg: "#dbeafe", color: "#1e40af", label: "Kas Besar" },
  bankBuku: { bg: "#dcfce7", color: "#166534", label: "Buku Bank" },
};

export async function getLaporanKeuanganData(
  entityIds: string[] | string,
  year: number,
  version: ReportVersion | string = "INTERNAL"
) {
  const ids = Array.isArray(entityIds) ? entityIds : [entityIds];
  const normVersion: ReportVersion = version?.toString().toUpperCase() === "UMUM" ? "UMUM" : "INTERNAL";
  const allowedCategories: ReportCategory[] =
    normVersion === "UMUM" ? [ReportCategory.UMUM, ReportCategory.SEMUA] : [ReportCategory.INTERNAL, ReportCategory.SEMUA];

  const [allCoa, saldoAwalRows, excludedNoBukti, rawAsetTetap] = await Promise.all([
    prisma.coaAccount.findMany({
      where: { reportCategory: { in: allowedCategories } },
      orderBy: { urutan: "asc" },
    }),
    prisma.saldoAwal.findMany({
      where: {
        entityId: { in: ids },
        year,
        coaAccount: { reportCategory: { in: allowedCategories } },
      },
    }),
    getExcludedNoBuktiForVersion(ids, year, normVersion),
    prisma.asetTetap.findMany({
      where: { entityId: { in: ids } },
    }),
  ]);

  const transactions = await prisma.transaction.findMany({
    where: {
      entityId: { in: ids },
      coaAccountId: { not: null },
      tanggal: {
        gte: new Date(`${year}-01-01`),
        lte: new Date(`${year}-12-31T23:59:59`),
      },
      coaAccount: { reportCategory: { in: allowedCategories } },
      ...(excludedNoBukti.length > 0 ? { noBukti: { notIn: excludedNoBukti } } : {}),
    },
    select: {
      id: true,
      coaAccountId: true,
      debit: true,
      kredit: true,
      tanggal: true,
      jenisInputId: true,
    },
    orderBy: { tanggal: "asc" },
  });

  // Agregasi debit & kredit transaksi per akun COA
  const totalsByAccount = new Map<string, { debit: number; kredit: number }>();
  for (const t of transactions) {
    if (!t.coaAccountId) continue;
    const cur = totalsByAccount.get(t.coaAccountId) ?? { debit: 0, kredit: 0 };
    cur.debit += Number(t.debit);
    cur.kredit += Number(t.kredit);
    totalsByAccount.set(t.coaAccountId, cur);
  }

  // Agregasi saldo awal per akun COA across entityIds
  const saldoAwalByAccount = new Map<string, number>();
  for (const s of saldoAwalRows) {
    saldoAwalByAccount.set(
      s.coaAccountId,
      (saldoAwalByAccount.get(s.coaAccountId) ?? 0) + Number(s.nominal)
    );
  }

  // Perhitungan otomatis jadwal penyusutan dari Modul Aset Tetap (Issue 39)
  const activeAssets = rawAsetTetap
    .map((a) => calculateAsetDepreciation(a, year))
    .filter((a) => new Date(a.tanggalPerolehan) <= new Date(year, 11, 31, 23, 59, 59));

  const totalHargaPerolehanAset = activeAssets.reduce((s, a) => s + a.hargaPerolehanNum, 0);
  const totalBebanPenyusutanAset = activeAssets.reduce((s, a) => s + a.bebanPeriodeIni, 0);
  const totalAkumulasiPenyusutanAset = activeAssets.reduce((s, a) => s + a.akumulasiPenyusutan, 0);

  // ── Laba Rugi ──────────────────────────────────────────────────────
  const pendapatan: CoaLine[] = [];
  const beban: CoaLine[] = [];

  for (const coa of allCoa) {
    const { debit, kredit } = totalsByAccount.get(coa.id) ?? { debit: 0, kredit: 0 };
    if (coa.kategori === CoaKategori.PENDAPATAN) {
      const saldo = kredit - debit;
      if (saldo !== 0 || debit !== 0 || kredit !== 0) {
        pendapatan.push({
          code: coa.code,
          name: coa.name,
          saldo,
          saldoFmt: formatRupiah(Math.abs(saldo)),
        });
      }
    } else if (coa.kategori === CoaKategori.BEBAN) {
      const isDeprCoa = coa.code === "512" || coa.code === "540" || /penyusutan/i.test(coa.name);
      if (isDeprCoa && totalBebanPenyusutanAset > 0) {
        // Disinkronkan otomatis dari modul aset tetap di bawah
      } else {
        const saldo = debit - kredit;
        if (saldo !== 0 || debit !== 0 || kredit !== 0) {
          beban.push({
            code: coa.code,
            name: coa.name,
            saldo,
            saldoFmt: formatRupiah(Math.abs(saldo)),
          });
        }
      }
    }
  }

  // Issue 39: Biaya penyusutan aset otomatis ditarik dari Modul Aktiva Tetap
  if (totalBebanPenyusutanAset > 0) {
    const existing = beban.find((b) => b.code === "512" || b.code === "540" || /penyusutan/i.test(b.name));
    if (existing) {
      existing.saldo = totalBebanPenyusutanAset;
      existing.saldoFmt = formatRupiah(totalBebanPenyusutanAset);
    } else {
      beban.push({
        code: "512",
        name: "Beban Penyusutan Aset Tetap",
        saldo: totalBebanPenyusutanAset,
        saldoFmt: formatRupiah(totalBebanPenyusutanAset),
      });
    }
  }

  const totalPendapatan = pendapatan.reduce((s, i) => s + i.saldo, 0);
  const totalBeban = beban.reduce((s, i) => s + i.saldo, 0);
  const labaBersih = totalPendapatan - totalBeban; // Laba Tahun Berjalan

  // ── Neraca ─────────────────────────────────────────────────────────
  const aktivaLancar: CoaLine[] = [];
  const aktivaTetap: CoaLine[] = [];
  const kewajiban: CoaLine[] = [];
  const modal: CoaLine[] = [];
  let labaDitahanSaldo = 0;

  const formatSaldo = (val: number, isContra: boolean) => {
    const abs = formatRupiah(Math.abs(val));
    if (isContra) return `(${abs})`;
    return val < 0 ? `-${abs}` : abs;
  };

  for (const coa of allCoa) {
    const saldoAwal = saldoAwalByAccount.get(coa.id) ?? 0;
    const { debit, kredit } = totalsByAccount.get(coa.id) ?? { debit: 0, kredit: 0 };
    const saldo = hitungSaldoAkhir(coa.kategori, coa.code, saldoAwal, debit, kredit);
    const hasActivity = saldoAwal !== 0 || debit !== 0 || kredit !== 0;
    const contra = isContraAset(coa.code);

    const line: CoaLine = {
      code: coa.code,
      name: coa.name,
      saldo,
      saldoFmt: formatSaldo(saldo, contra),
      isContra: contra,
    };

    if (coa.kategori === CoaKategori.ASET) {
      if (isAktivaTetap(coa.code, coa.name)) {
        if (hasActivity || coa.code === "100" || coa.code === "1001") {
          aktivaTetap.push(line);
        }
      } else {
        if (hasActivity) {
          aktivaLancar.push(line);
        }
      }
    } else if (coa.kategori === CoaKategori.KEWAJIBAN) {
      if (hasActivity) {
        kewajiban.push(line);
      }
    } else if (coa.kategori === CoaKategori.MODAL) {
      if (isLabaDitahan(coa.code, coa.name)) {
        labaDitahanSaldo = saldo;
      } else {
        if (hasActivity || coa.code === "320") {
          modal.push(line);
        }
      }
    }
  }

  // Issue 39: Sinkronkan saldo Aktiva Tetap & Akumulasi Penyusutan dari Modul Aset Tetap
  if (activeAssets.length > 0) {
    let akmLine = aktivaTetap.find((a) => a.isContra || a.code === "1001" || /penyusutan/i.test(a.name));
    if (akmLine) {
      akmLine.saldo = totalAkumulasiPenyusutanAset;
      akmLine.saldoFmt = formatSaldo(akmLine.saldo, true);
      akmLine.isContra = true;
    } else if (totalAkumulasiPenyusutanAset > 0) {
      aktivaTetap.push({
        code: "1001",
        name: "Akumulasi Penyusutan Aset",
        saldo: totalAkumulasiPenyusutanAset,
        saldoFmt: formatSaldo(totalAkumulasiPenyusutanAset, true),
        isContra: true,
      });
    }

    let perolehanLine = aktivaTetap.find((a) => !a.isContra && (a.code === "100" || /aktiva tetap|aset tetap/i.test(a.name)));
    if (perolehanLine) {
      if (perolehanLine.saldo === 0 || perolehanLine.saldo < totalHargaPerolehanAset) {
        perolehanLine.saldo = totalHargaPerolehanAset;
        perolehanLine.saldoFmt = formatSaldo(perolehanLine.saldo, false);
      }
    } else if (totalHargaPerolehanAset > 0) {
      aktivaTetap.unshift({
        code: "100",
        name: "Aktiva Tetap (Perolehan)",
        saldo: totalHargaPerolehanAset,
        saldoFmt: formatSaldo(totalHargaPerolehanAset, false),
        isContra: false,
      });
    }
  }

  // Formula Neraca (Issue 38 & 39):
  // • Total Aktiva Lancar: akun debet ditambah, akun kontra dikurangkan
  const totalAktivaLancar = aktivaLancar.reduce(
    (sum, item) => sum + (item.isContra ? -item.saldo : item.saldo),
    0
  );

  // • Total Aktiva Tetap: Nilai Perolehan Aktiva Tetap - Akumulasi Penyusutan (kontra)
  const totalAktivaTetap = aktivaTetap.reduce(
    (sum, item) => sum + (item.isContra ? -item.saldo : item.saldo),
    0
  );

  // • Total Aktiva = Total Aktiva Lancar + Total Aktiva Tetap
  const totalAktiva = totalAktivaLancar + totalAktivaTetap;
  const totalAset = totalAktiva;

  // • Kewajiban
  const totalKewajiban = kewajiban.reduce((sum, item) => sum + item.saldo, 0);

  // • Modal & Laba Ditahan
  // Total Pasiva = Kewajiban + Modal + Laba Ditahan
  // di mana Laba Ditahan = Saldo Akun 310 + Laba Tahun Berjalan
  const totalModal = modal.reduce((sum, item) => sum + item.saldo, 0);
  const totalLabaDitahan = labaDitahanSaldo + labaBersih;
  const totalEkuitas = totalModal + totalLabaDitahan;
  const totalPassiva = totalKewajiban + totalEkuitas;

  const neracaBalanced = Math.abs(totalAktiva - totalPassiva) < 1;
  const aset = [...aktivaLancar, ...aktivaTetap];

  // ── Arus Kas — Metode Tidak Langsung ──────────────────────────────
  // Kas/bank ASET = akun-akun kas dan rekening bank
  const kasAset = aktivaLancar.filter((i) => /kas|bank|bri|bpd|bni|mdr/i.test(i.name));
  const asetNonKas = aktivaLancar.filter((i) => !/kas|bank|bri|bpd|bni|mdr/i.test(i.name));
  const totalKasBank = kasAset.reduce((s, i) => s + (i.isContra ? -i.saldo : i.saldo), 0);

  // Saldo awal kas/bank dari Saldo Awal yang diinput
  const kasAwal = kasAset.reduce((s, i) => {
    const coa = allCoa.find((c) => c.code === i.code);
    return s + (coa ? saldoAwalByAccount.get(coa.id) ?? 0 : 0);
  }, 0);

  // Aktivitas Operasi (indirect): Laba Bersih + penyesuaian non-kas (penyusutan) + modal kerja
  const penyesuaianNonKas = totalBebanPenyusutanAset;
  const perubahanAsetNonKas = -(
    asetNonKas.reduce((s, i) => {
      const coa = allCoa.find((c) => c.code === i.code);
      const sa = coa ? saldoAwalByAccount.get(coa.id) ?? 0 : 0;
      const netVal = i.isContra ? -i.saldo : i.saldo;
      const netSa = i.isContra ? -sa : sa;
      return s + (netVal - netSa);
    }, 0)
  );
  const perubahanKewajiban = totalKewajiban;
  const kasOperasi = labaBersih + penyesuaianNonKas + perubahanAsetNonKas + perubahanKewajiban;

  // Aktivitas Investasi: perolehan aset tetap tahun berjalan
  const kasInvestasi = 0;

  // Aktivitas Pendanaan: perubahan modal tahun berjalan
  const modalAwal = modal.reduce((s, i) => {
    const coa = allCoa.find((c) => c.code === i.code);
    return s + (coa ? saldoAwalByAccount.get(coa.id) ?? 0 : 0);
  }, 0);
  const kasPendanaan = totalModal - modalAwal;

  const kenaikanBersihKas = kasOperasi + kasInvestasi + kasPendanaan;
  const kasAkhir = kasAwal + kenaikanBersihKas;
  const arusKasBalanced = Math.abs(kasAkhir - totalKasBank) < 1;

  return {
    // ── Laba Rugi
    pendapatan,
    beban,
    totalPendapatan,
    totalBeban,
    labaBersih,
    totalPendapatanFmt: formatRupiah(totalPendapatan),
    totalBebanFmt: formatRupiah(totalBeban),
    labaBersihFmt: formatRupiah(Math.abs(labaBersih)),
    labaBersihPositive: labaBersih >= 0,

    // ── Neraca
    aktivaLancar,
    aktivaTetap,
    totalAktivaLancar,
    totalAktivaTetap,
    totalAktiva,
    totalAktivaLancarFmt: formatRupiah(Math.abs(totalAktivaLancar)),
    totalAktivaTetapFmt: formatRupiah(Math.abs(totalAktivaTetap)),
    totalAktivaFmt: totalAktiva < 0 ? `-${formatRupiah(Math.abs(totalAktiva))}` : formatRupiah(totalAktiva),

    aset,
    kewajiban,
    modal,
    totalAset,
    totalKewajiban,
    totalModal,
    totalPassiva,
    labaDitahan: labaDitahanSaldo,
    labaDitahanFmt: formatRupiah(Math.abs(labaDitahanSaldo)),
    totalLabaDitahan,
    totalLabaDitahanFmt: formatRupiah(Math.abs(totalLabaDitahan)),
    totalEkuitas,
    totalEkuitasFmt: totalEkuitas < 0 ? `-${formatRupiah(Math.abs(totalEkuitas))}` : formatRupiah(totalEkuitas),
    totalModalDanLabaFmt: totalEkuitas < 0 ? `-${formatRupiah(Math.abs(totalEkuitas))}` : formatRupiah(totalEkuitas),
    neracaBalanced,
    totalAsetFmt: totalAset < 0 ? `-${formatRupiah(Math.abs(totalAset))}` : formatRupiah(totalAset),
    totalKewajibanFmt: formatRupiah(Math.abs(totalKewajiban)),
    totalModalFmt: formatRupiah(Math.abs(totalModal)),
    totalPassivaFmt: totalPassiva < 0 ? `-${formatRupiah(Math.abs(totalPassiva))}` : formatRupiah(totalPassiva),

    // ── Arus Kas
    kasAwal,
    kasOperasi,
    kasInvestasi,
    kasPendanaan,
    kenaikanBersihKas,
    kasAkhir,
    totalKasBank,
    arusKasBalanced,
    perubahanAsetNonKas,
    perubahanKewajiban,
    penyesuaianNonKas,
    penyesuaianNonKasFmt: formatRupiah(penyesuaianNonKas),
    penyusutanOtomatis: totalBebanPenyusutanAset,
    akumulasiPenyusutanOtomatis: totalAkumulasiPenyusutanAset,
    kasAwalFmt: formatRupiah(Math.abs(kasAwal)),
    kasOperasiFmt: formatRupiah(Math.abs(kasOperasi)),
    kasInvestasiFmt: formatRupiah(Math.abs(kasInvestasi)),
    kasPendanaanFmt: formatRupiah(Math.abs(kasPendanaan)),
    kenaikanBersihFmt: formatRupiah(Math.abs(kenaikanBersihKas)),
    kasAkhirFmt: formatRupiah(Math.abs(kasAkhir)),
    kasAsetFmt: formatRupiah(totalKasBank),
    version: normVersion,
  };
}

export type LaporanJurnalRow = {
  id: string;
  tanggal: string;
  tanggalRaw: Date;
  noBukti: string;
  entityKey: string;
  entityName: string;
  entityColor: string;
  sumberKey: string;
  sumberLabel: string;
  sumberBg: string;
  sumberColor: string;
  keterangan: string;
  isKasEntry: boolean;
  isKredit: boolean;
  kodeAkun: string;
  namaAkun: string;
  debit: number;
  kredit: number;
  debitFmt: string;
  kreditFmt: string;
  staffName: string;
};

export async function getLaporanJurnalData(
  entityIds: string[] | string,
  year: number,
  limit = 80,
  filterSumber?: string
) {
  const ids = Array.isArray(entityIds) ? entityIds : [entityIds];
  const startDate = new Date(`${year}-01-01`);
  const endDate = new Date(`${year}-12-31T23:59:59`);

  const whereClause = {
    entityId: { in: ids },
    tanggal: { gte: startDate, lte: endDate },
    ...(filterSumber && filterSumber !== "semua" ? { jenisInput: { key: filterSumber } } : {}),
  };

  const [totalCount, rows] = await Promise.all([
    prisma.transaction.count({ where: whereClause }),
    prisma.transaction.findMany({
      where: whereClause,
      include: {
        entity: true,
        jenisInput: true,
        coaAccount: true,
        staff: true,
      },
      orderBy: [{ tanggal: "desc" }, { createdAt: "desc" }],
      take: limit,
    }),
  ]);

  // Konvensi jurnal: dalam satu noBukti, baris Debit selalu di atas Kredit
  rows.sort((a, b) => {
    const dateDiff = b.tanggal.getTime() - a.tanggal.getTime();
    if (dateDiff !== 0) return dateDiff;
    if (a.noBukti !== b.noBukti) return b.createdAt.getTime() - a.createdAt.getTime();
    return Number(b.debit) - Number(a.debit);
  });

  const totalDebit = rows.reduce((s, r) => s + Number(r.debit), 0);
  const totalKredit = rows.reduce((s, r) => s + Number(r.kredit), 0);
  const isBalanced = Math.round(totalDebit * 100) === Math.round(totalKredit * 100);

  const formattedRows: LaporanJurnalRow[] = rows.map((r) => {
    const style = SUMBER_STYLE[r.jenisInput.key] ?? { bg: "#ede9fe", color: "#6d28d9", label: r.jenisInput.nama };
    const extra = r.extraFieldsJson as Record<string, unknown> | null;
    const isKasEntry = extra?.isKasEntry === true;

    let kodeAkun = r.coaAccount?.code ?? "—";
    let namaAkun = r.coaAccount?.name ?? "—";
    if (isKasEntry && !r.coaAccount) {
      kodeAkun = "—";
      namaAkun =
        r.jenisInput.key === "kasKecil" ? "Kas Kecil" :
        r.jenisInput.key === "kasBesar" ? "Kas" :
        typeof extra?.rekeningNama === "string" ? extra.rekeningNama : "Rekening Bank";
    }

    const debit = Number(r.debit);
    const kredit = Number(r.kredit);

    return {
      id: r.id,
      tanggal: r.tanggal.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }),
      tanggalRaw: r.tanggal,
      noBukti: r.noBukti,
      entityKey: r.entity.key,
      entityName: r.entity.name,
      entityColor: r.entity.colorHex,
      sumberKey: r.jenisInput.key,
      sumberLabel: style.label,
      sumberBg: style.bg,
      sumberColor: style.color,
      keterangan: r.keterangan,
      isKasEntry,
      isKredit: kredit > 0 && debit === 0,
      kodeAkun,
      namaAkun,
      debit,
      kredit,
      debitFmt: debit > 0 ? formatRupiah(debit) : "-",
      kreditFmt: kredit > 0 ? formatRupiah(kredit) : "-",
      staffName: r.staff.name,
    };
  });

  return {
    totalCount,
    totalDebit,
    totalKredit,
    totalDebitFmt: formatRupiah(totalDebit),
    totalKreditFmt: formatRupiah(totalKredit),
    isBalanced,
    rows: formattedRows,
  };
}

export type LaporanBankRow = {
  id: string;
  tanggal: string;
  tanggalRaw: Date;
  noBukti: string;
  entityKey: string;
  entityName: string;
  entityColor: string;
  rekeningNama: string;
  keterangan: string;
  isKasEntry: boolean;
  kodeAkun: string;
  namaAkun: string;
  penerimaan: number;
  pengeluaran: number;
  penerimaanFmt: string;
  pengeluaranFmt: string;
  saldoSetelah: number;
  saldoSetelahFmt: string;
  staffName: string;
};

export async function getLaporanBankData(
  entityIds: string[] | string,
  year: number,
  limit = 80
) {
  const ids = Array.isArray(entityIds) ? entityIds : [entityIds];
  const startDate = new Date(`${year}-01-01`);
  const endDate = new Date(`${year}-12-31T23:59:59`);

  const whereClause = {
    entityId: { in: ids },
    jenisInput: { key: "bankBuku" },
    tanggal: { gte: startDate, lte: endDate },
  };

  const [totalCount, rows] = await Promise.all([
    prisma.transaction.count({ where: whereClause }),
    prisma.transaction.findMany({
      where: whereClause,
      include: {
        entity: true,
        coaAccount: true,
        staff: true,
      },
      orderBy: [{ tanggal: "desc" }, { createdAt: "desc" }],
      take: limit,
    }),
  ]);

  let totalPenerimaan = 0;
  let totalPengeluaran = 0;

  const formattedRows: LaporanBankRow[] = rows.map((r) => {
    const extra = r.extraFieldsJson as Record<string, unknown> | null;
    const isKasEntry = extra?.isKasEntry === true;
    const rekeningNama = typeof extra?.rekeningNama === "string" ? extra.rekeningNama : "Rekening Bank";

    const debit = Number(r.debit);
    const kredit = Number(r.kredit);

    let penerimaan = 0;
    let pengeluaran = 0;
    if (isKasEntry) {
      penerimaan = debit;
      pengeluaran = kredit;
    } else {
      penerimaan = kredit;
      pengeluaran = debit;
    }
    totalPenerimaan += penerimaan;
    totalPengeluaran += pengeluaran;

    let kodeAkun = r.coaAccount?.code ?? "—";
    let namaAkun = r.coaAccount?.name ?? (isKasEntry ? rekeningNama : "—");

    return {
      id: r.id,
      tanggal: r.tanggal.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }),
      tanggalRaw: r.tanggal,
      noBukti: r.noBukti,
      entityKey: r.entity.key,
      entityName: r.entity.name,
      entityColor: r.entity.colorHex,
      rekeningNama,
      keterangan: r.keterangan,
      isKasEntry,
      kodeAkun,
      namaAkun,
      penerimaan,
      pengeluaran,
      penerimaanFmt: penerimaan > 0 ? formatRupiah(penerimaan) : "-",
      pengeluaranFmt: pengeluaran > 0 ? formatRupiah(pengeluaran) : "-",
      saldoSetelah: Number(r.saldoSetelah),
      saldoSetelahFmt: formatRupiah(Number(r.saldoSetelah)),
      staffName: r.staff.name,
    };
  });

  return {
    totalCount,
    totalPenerimaan,
    totalPengeluaran,
    totalPenerimaanFmt: formatRupiah(totalPenerimaan),
    totalPengeluaranFmt: formatRupiah(totalPengeluaran),
    netMutasi: totalPenerimaan - totalPengeluaran,
    netMutasiFmt: formatRupiah(Math.abs(totalPenerimaan - totalPengeluaran)),
    netPositive: totalPenerimaan >= totalPengeluaran,
    rows: formattedRows,
  };
}
