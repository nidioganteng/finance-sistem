"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AsetTetapWithDepreciation,
  PenyusutanSummary,
  STANDAR_KATEGORI_ASET,
  getKategoriLabel,
} from "@/lib/aset-tetap";
import {
  createAsetTetapAction,
  updateAsetTetapAction,
  deleteAsetTetapAction,
  type AsetTetapInput,
} from "@/lib/actions/aset-tetap";
import { formatRupiah, getMetricValueFontSize } from "@/lib/dashboard-data";
import {
  Plus,
  Edit2,
  Trash2,
  Building2,
  TrendingDown,
  Scale,
  Landmark,
  CheckCircle2,
  AlertCircle,
  X,
  Search,
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
  Car,
  Armchair,
  LandPlot,
  RotateCcw,
} from "lucide-react";

const KATEGORI_OPTIONS = STANDAR_KATEGORI_ASET.map((k) => ({
  value: k.key,
  label: k.label,
}));

function formatRupiahInput(val: string | number | undefined | null) {
  if (val === undefined || val === null || val === "" || val === 0 || val === "0") return "";
  const num = String(val).replace(/[^0-9]/g, "");
  if (!num) return "";
  return Number(num).toLocaleString("id-ID");
}

export function AktivaTetapManager({
  summary,
  entityId,
  entityName,
  year,
}: {
  summary: PenyusutanSummary;
  entityId: string;
  entityName: string;
  year: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState("");
  const [selectedKategori, setSelectedKategori] = useState<string>("ALL");
  const [expandedKategori, setExpandedKategori] = useState<string[]>([]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<AsetTetapWithDepreciation | null>(null);

  // Form State
  const [kode, setKode] = useState("");
  const [nama, setNama] = useState("");
  const [kategori, setKategori] = useState("KENDARAAN");
  const [tanggalPerolehan, setTanggalPerolehan] = useState(new Date().toISOString().slice(0, 10));
  const [hargaPerolehan, setHargaPerolehan] = useState<number>(0);
  const [nilaiResidu, setNilaiResidu] = useState<number>(0);
  const [umurTahun, setUmurTahun] = useState<number>(4);
  const [umurBulan, setUmurBulan] = useState<number>(48);
  const [keterangan, setKeterangan] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // Filtered Assets
  const filteredAssets = summary.assets.filter((asset) => {
    const matchSearch =
      asset.kode.toLowerCase().includes(search.toLowerCase()) ||
      asset.nama.toLowerCase().includes(search.toLowerCase()) ||
      (asset.keterangan && asset.keterangan.toLowerCase().includes(search.toLowerCase()));
    const matchKategori =
      selectedKategori === "ALL" ||
      asset.kategoriStandar === selectedKategori ||
      asset.kategori === selectedKategori;
    return matchSearch && matchKategori;
  });

  const openAddModal = () => {
    setEditingAsset(null);
    setKode(`AST-${String(summary.assets.length + 1).padStart(3, "0")}`);
    setNama("");
    setKategori("KENDARAAN");
    setTanggalPerolehan(new Date().toISOString().slice(0, 10));
    setHargaPerolehan(0);
    setNilaiResidu(0);
    setUmurTahun(4);
    setUmurBulan(48);
    setKeterangan("");
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (asset: AsetTetapWithDepreciation) => {
    setEditingAsset(asset);
    setKode(asset.kode);
    setNama(asset.nama);
    setKategori(asset.kategoriStandar || asset.kategori);
    setTanggalPerolehan(new Date(asset.tanggalPerolehan).toISOString().slice(0, 10));
    setHargaPerolehan(asset.hargaPerolehanNum);
    setNilaiResidu(asset.nilaiResiduNum);
    setUmurBulan(asset.umurBulan);
    setUmurTahun(Math.round(asset.umurBulan / 12));
    setKeterangan(asset.keterangan || "");
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleKategoriChange = (newKat: string) => {
    setKategori(newKat);
    if (newKat === "TANAH") {
      setUmurBulan(0);
      setUmurTahun(0);
      setNilaiResidu(hargaPerolehan);
    } else if (umurBulan === 0) {
      setUmurBulan(48);
      setUmurTahun(4);
      setNilaiResidu(0);
    }
  };

  const handleUmurTahunChange = (thn: number) => {
    setUmurTahun(thn);
    setUmurBulan(thn * 12);
  };

  const handleUmurBulanChange = (bln: number) => {
    setUmurBulan(bln);
    setUmurTahun(Number((bln / 12).toFixed(1)));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!kode.trim()) {
      setFormError("Kode/Tagging aset wajib diisi.");
      return;
    }
    if (!nama.trim()) {
      setFormError("Nama aset wajib diisi.");
      return;
    }
    if (hargaPerolehan <= 0) {
      setFormError("Harga perolehan harus lebih dari Rp 0.");
      return;
    }
    if (kategori !== "TANAH" && umurBulan <= 0) {
      setFormError("Umur ekonomis harus lebih dari 0 bulan.");
      return;
    }

    startTransition(async () => {
      try {
        const payload: AsetTetapInput = {
          entityId,
          kode: kode.trim(),
          nama: nama.trim(),
          kategori,
          tanggalPerolehan,
          hargaPerolehan,
          nilaiResidu,
          umurBulan,
          keterangan,
        };

        if (editingAsset) {
          await updateAsetTetapAction(editingAsset.id, payload);
        } else {
          await createAsetTetapAction(payload);
        }

        setIsModalOpen(false);
        router.refresh();
      } catch (err: unknown) {
        setFormError(err instanceof Error ? err.message : "Terjadi kesalahan saat menyimpan data.");
      }
    });
  };

  const handleDelete = (id: string, namaAset: string) => {
    if (!confirm(`Yakin ingin menghapus aset "${namaAset}"? Data penyusutan akan otomatis terupdate di Laporan Keuangan.`)) {
      return;
    }

    startTransition(async () => {
      try {
        await deleteAsetTetapAction(id);
        router.refresh();
      } catch (err: unknown) {
        alert(err instanceof Error ? err.message : "Gagal menghapus aset.");
      }
    });
  };

  // Preview hitungan live di modal
  const liveDepreciable = Math.max(0, hargaPerolehan);
  const livePenyusutanBulan = kategori !== "TANAH" && umurBulan > 0 ? liveDepreciable / umurBulan : 0;
  const livePenyusutanTahun = livePenyusutanBulan * 12;

  const totalNilaiBukuAwal = summary.assets.reduce((total, asset) => total + asset.nilaiBukuAwalTahun, 0);
  const totalNilaiBukuAwalFmt = formatRupiah(totalNilaiBukuAwal);

  const filteredTotals = filteredAssets.reduce(
    (total, asset) => ({
      perolehan: total.perolehan + asset.hargaPerolehanNum,
      awalTahun: total.awalTahun + asset.nilaiBukuAwalTahun,
      beban: total.beban + asset.bebanPeriodeIni,
      akumulasi: total.akumulasi + asset.akumulasiPenyusutan,
      nilaiBuku: total.nilaiBuku + asset.nilaiBuku,
    }),
    { perolehan: 0, awalTahun: 0, beban: 0, akumulasi: 0, nilaiBuku: 0 }
  );

  return (
    <div className="flex flex-col gap-6">
      {/* ── 4 Card Ringkasan Finansial Aset ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Total Harga Perolehan */}
        <div className="bg-surface-card rounded-[22px] border border-border-soft p-4 sm:p-5 shadow-xs flex flex-col justify-between min-w-0 overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[12px] font-bold text-muted-faint uppercase tracking-wider truncate">
              Nilai Buku Awal {year}
            </span>
            <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-none">
              <Building2 size={16} />
            </div>
          </div>
          <div className="min-w-0">
            <div className={`${getMetricValueFontSize(totalNilaiBukuAwalFmt)} text-navy-text truncate`} title={totalNilaiBukuAwalFmt}>
              {totalNilaiBukuAwalFmt}
            </div>
            <div className="text-[11.5px] text-muted-faint mt-1 truncate">
              Saldo bawaan + perolehan baru {year}
            </div>
          </div>
        </div>

        {/* Beban Penyusutan Berjalan */}
        <div className="bg-surface-card rounded-[22px] border border-border-soft p-4 sm:p-5 shadow-xs flex flex-col justify-between min-w-0 overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[12px] font-bold text-muted-faint uppercase tracking-wider truncate">
              Beban Tahun {year}
            </span>
            <div className="w-8 h-8 rounded-full bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center flex-none">
              <TrendingDown size={16} />
            </div>
          </div>
          <div className="min-w-0">
            <div className={`${getMetricValueFontSize(summary.totalBebanPenyusutanFmt)} text-status-red truncate`} title={summary.totalBebanPenyusutanFmt}>
              {summary.totalBebanPenyusutanFmt}
            </div>
            <div className="text-[11.5px] text-blue-600 dark:text-blue-400 font-semibold mt-1 flex items-center gap-1 truncate">
              <CheckCircle2 size={12} className="flex-none" />
              Ditarik ke Laba Rugi
            </div>
          </div>
        </div>

        {/* Total Akumulasi Penyusutan */}
        <div className="bg-surface-card rounded-[22px] border border-border-soft p-4 sm:p-5 shadow-xs flex flex-col justify-between min-w-0 overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[12px] font-bold text-muted-faint uppercase tracking-wider truncate">
              Akumulasi Penyusutan
            </span>
            <div className="w-8 h-8 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-none">
              <Scale size={16} />
            </div>
          </div>
          <div className="min-w-0">
            <div className={`${getMetricValueFontSize(summary.totalAkumulasiPenyusutanFmt)} text-status-amber truncate`} title={`(${summary.totalAkumulasiPenyusutanFmt})`}>
              ({summary.totalAkumulasiPenyusutanFmt})
            </div>
            <div className="text-[11.5px] text-amber-700 dark:text-amber-400 font-semibold mt-1 flex items-center gap-1 truncate">
              <CheckCircle2 size={12} className="flex-none" />
              Kontra Aset di Neraca
            </div>
          </div>
        </div>

        {/* Total Nilai Buku Bersih (Net) */}
        <div className="bg-surface-card rounded-[22px] border border-border-soft p-4 sm:p-5 shadow-xs flex flex-col justify-between min-w-0 overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[12px] font-bold text-muted-faint uppercase tracking-wider truncate">
              Saldo Akhir {year}
            </span>
            <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-none">
              <Landmark size={16} />
            </div>
          </div>
          <div className="min-w-0">
            <div className={`${getMetricValueFontSize(summary.totalNilaiBukuFmt)} text-status-green truncate`} title={summary.totalNilaiBukuFmt}>
              {summary.totalNilaiBukuFmt}
            </div>
            <div className="text-[11.5px] text-muted-faint mt-1 truncate">
              Menjadi saldo awal {year + 1}
            </div>
          </div>
        </div>
      </div>

      {/* Ringkasan kategori mengikuti filter inventaris. */}
      {summary.rekapPerKategori.length > 0 && (
        <section className="bg-surface-card rounded-[22px] border border-border-soft shadow-xs overflow-hidden" aria-label="Ringkasan kategori aset">
          <div className="px-5 sm:px-6 py-4 border-b border-border-soft flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-[15px] font-bold text-navy-text">Ringkasan kategori aset</h3>
              <p className="text-[12px] text-muted-strong mt-1">Posisi per 31 Desember {year} · Terhubung ke Neraca</p>
            </div>
            {selectedKategori !== "ALL" && (
              <button
                type="button"
                onClick={() => setSelectedKategori("ALL")}
                className="inline-flex items-center gap-2 rounded-pill border border-border-soft px-3 py-2 text-[12px] font-semibold text-muted-strong hover:bg-surface-hover hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand transition-colors"
              >
                <RotateCcw size={13} /> Semua Kategori
              </button>
            )}
          </div>
          <div className={`grid gap-3 p-4 sm:p-5 ${selectedKategori === "ALL" ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4" : "grid-cols-1"}`}>
            {summary.rekapPerKategori
              .filter((rekap) => selectedKategori === "ALL" || rekap.kategori === selectedKategori)
              .map((rekap) => {
                const isSelected = selectedKategori === rekap.kategori;
                const iconMap: Record<string, typeof LandPlot> = {
                  TANAH: LandPlot,
                  BANGUNAN: Building2,
                  KENDARAAN: Car,
                  PERALATAN_KANTOR: Armchair,
                };
                const CategoryIcon = iconMap[rekap.kategori] ?? Armchair;
                return (
                  <button
                    type="button"
                    key={rekap.kategori}
                    aria-pressed={isSelected}
                    onClick={() => setSelectedKategori(isSelected ? "ALL" : rekap.kategori)}
                    className={`group min-w-0 rounded-[16px] border p-5 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand ${
                      isSelected
                        ? "grid gap-6 md:grid-cols-[minmax(200px,1fr)_2fr] md:items-center border-brand/30 bg-brand/5"
                        : "border-border-soft bg-surface-card hover:border-brand/40 hover:bg-surface-hover"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-3 mb-4">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                          <CategoryIcon size={20} strokeWidth={1.7} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[14px] font-bold text-navy-text">{rekap.label}</span>
                          <span className="block text-[12px] text-muted-strong mt-0.5">{rekap.jumlahAset} unit aset</span>
                        </span>
                        {!isSelected && <ChevronRight size={15} className="shrink-0 text-muted-strong group-hover:text-brand" />}
                      </div>
                      <div className="text-[11px] font-medium text-muted-strong mb-1">Saldo akhir {year}</div>
                      <div className={`${isSelected ? "text-[28px]" : "text-[22px]"} font-bold tracking-tight text-navy-text tabular-nums break-words`}>
                        {rekap.totalNilaiBukuFmt}
                      </div>
                    </div>
                    <div className={isSelected
                      ? "grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-brand/15 pt-5 md:border-t-0 md:border-l md:pl-6 md:pt-0"
                      : "mt-4 border-t border-border-soft pt-3 space-y-2"}>
                      {[
                        { label: "Harga perolehan", value: rekap.totalHargaPerolehanFmt, tone: "text-navy-text" },
                        { label: `Beban ${year}`, value: rekap.totalBebanPenyusutanFmt, tone: "text-status-red" },
                        { label: "Akumulasi penyusutan", value: rekap.totalAkumulasiPenyusutanFmt, tone: "text-status-amber" },
                      ].map((metric) => (
                        <span key={metric.label} className={isSelected ? "block min-w-0" : "flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1"}>
                          <span className={`text-[11px] text-muted-strong ${isSelected ? "block mb-2" : ""}`}>{metric.label}</span>
                          <span className={`${isSelected ? "text-[16px]" : "text-[12px]"} font-semibold tabular-nums break-words ${metric.tone}`}>{metric.value}</span>
                        </span>
                      ))}
                      {rekap.kategori === "TANAH" && (
                        <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium text-brand ${isSelected ? "sm:col-span-3" : "pt-1"}`}>
                          <CheckCircle2 size={12} /> Tanah tidak disusutkan
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
          </div>
        </section>
      )}

      <div className="flex items-start gap-3 rounded-[16px] border border-border-soft bg-surface-subtle px-5 py-3.5 text-[12px] text-muted-strong leading-relaxed">
        <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-brand" />
        <p><span className="font-semibold text-navy-text">Laporan tersinkron otomatis.</span> Beban penyusutan masuk ke Laba Rugi dan akumulasi penyusutan ke Neraca, tanpa input jurnal manual.</p>
      </div>

      {/* ── Filter Bar & Actions ── */}
      <div className="bg-surface-card rounded-[22px] border border-border-soft p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto flex-1">
          <div className="relative flex-1 sm:max-w-sm">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-faint" />
            <input
              type="text"
              placeholder="Cari kode atau nama aset..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-surface-base border border-border-soft rounded-pill text-[13px] text-navy-text placeholder:text-muted-faint focus:outline-none focus:border-brand"
            />
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <SlidersHorizontal size={14} className="text-muted-faint ml-1" />
            <select
              value={selectedKategori}
              onChange={(e) => setSelectedKategori(e.target.value)}
              className="bg-surface-base border border-border-soft rounded-pill px-3 py-2 text-[12.5px] font-semibold text-muted-strong focus:outline-none focus:border-brand"
            >
              <option value="ALL">Semua Kategori</option>
              {KATEGORI_OPTIONS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={openAddModal}
          className="w-full sm:w-auto px-4 py-2 bg-navy text-white rounded-pill text-[13px] font-bold flex items-center justify-center gap-2 hover:bg-navy-strong shadow-xs transition-colors shrink-0"
        >
          <Plus size={16} />
          Tambah Aset Tetap
        </button>
      </div>

      {/* Inventaris dua tingkat: ringkasan kategori dan rincian unit. */}
      <section className="bg-surface-card rounded-[22px] border border-border-soft shadow-xs overflow-hidden" aria-label="Inventaris aset tetap">
        <div className="px-5 sm:px-6 py-5 border-b border-border-soft flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-[15px] font-bold text-navy-text">Inventaris aset tetap</h3>
            <p className="mt-1 text-[12px] text-muted-strong">{entityName} · Tahun {year} · Buka kategori untuk melihat rincian unit</p>
          </div>
          <span className="rounded-pill bg-brand/10 px-3 py-1.5 text-[12px] font-semibold text-brand">{filteredAssets.length} unit aset</span>
        </div>
        {filteredAssets.length === 0 ? (
          <div className="py-12 px-6 text-center">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-[16px] bg-brand/10 text-brand"><Building2 size={23} strokeWidth={1.5} /></div>
                    <div className="text-[15px] font-bold text-navy-text">{summary.assets.length === 0 ? "Inventaris aset masih kosong" : "Tidak ada aset yang cocok"}</div>
                    <p className="mx-auto mt-2 max-w-sm text-[12px] leading-relaxed text-muted-strong">{summary.assets.length === 0 ? "Tambahkan aset pertama untuk mulai menghitung penyusutan dan nilai buku secara otomatis." : "Coba kata kunci lain atau pilih Semua Kategori untuk melihat aset yang tersedia."}</p>
                    {summary.assets.length === 0 && (
                      <button type="button" onClick={openAddModal} className="mt-5 inline-flex items-center gap-2 rounded-pill bg-navy px-4 py-2.5 text-[12px] font-semibold text-white hover:bg-navy-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"><Plus size={15} /> Tambah Aset Tetap</button>
                    )}
          </div>
        ) : (
          <div className="divide-y divide-border-soft">
            {STANDAR_KATEGORI_ASET
              .filter((kat) => filteredAssets.some((asset) => asset.kategoriStandar === kat.key))
              .map((kat) => {
                const categoryAssets = filteredAssets.filter((asset) => asset.kategoriStandar === kat.key);
                const isExpanded = expandedKategori.includes(kat.key);
                const totals = categoryAssets.reduce(
                  (total, asset) => ({
                    perolehan: total.perolehan + asset.hargaPerolehanNum,
                    beban: total.beban + asset.bebanPeriodeIni,
                    akumulasi: total.akumulasi + asset.akumulasiPenyusutan,
                    nilaiBuku: total.nilaiBuku + asset.nilaiBuku,
                  }),
                  { perolehan: 0, beban: 0, akumulasi: 0, nilaiBuku: 0 }
                );
                const iconMapKat: Record<string, typeof LandPlot> = { TANAH: LandPlot, BANGUNAN: Building2, KENDARAAN: Car, PERALATAN_KANTOR: Armchair };
                const CategoryIcon = iconMapKat[kat.key] ?? Armchair;
                return (
                  <div key={kat.key}>
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      aria-controls={`rincian-${kat.key}`}
                      onClick={() => setExpandedKategori((current) => current.includes(kat.key) ? current.filter((key) => key !== kat.key) : [...current, kat.key])}
                      className={`group w-full p-5 sm:px-6 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand focus-visible:-outline-offset-2 ${isExpanded ? "bg-brand/5" : "hover:bg-surface-hover"}`}
                    >
                      <span className="grid grid-cols-1 xl:grid-cols-[minmax(210px,1.2fr)_3fr] gap-5 items-center">
                        <span className="flex items-center gap-3">
                          <span className="h-10 w-10 flex shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand"><CategoryIcon size={19} strokeWidth={1.7} /></span>
                          <span className="flex-1">
                            <span className="block text-[14px] font-bold text-navy-text">{kat.label}</span>
                            <span className="block mt-0.5 text-[11px] text-muted-strong">{categoryAssets.length} unit · {isExpanded ? "Tutup rincian" : "Lihat rincian"}</span>
                          </span>
                          {isExpanded ? <ChevronDown size={17} className="text-brand xl:hidden" /> : <ChevronRight size={17} className="text-muted-strong xl:hidden" />}
                        </span>
                        <span className="grid grid-cols-2 sm:grid-cols-4 gap-x-5 gap-y-4">
                          {[
                            { label: "Harga perolehan", value: totals.perolehan, tone: "text-navy-text" },
                            { label: `Beban ${year}`, value: totals.beban, tone: "text-status-red" },
                            { label: "Akumulasi", value: totals.akumulasi, tone: "text-status-amber" },
                            { label: `Saldo akhir ${year}`, value: totals.nilaiBuku, tone: "text-status-green" },
                          ].map((metric) => (
                            <span key={metric.label} className="block min-w-0">
                              <span className="block text-[11px] font-medium text-muted-strong mb-1.5">{metric.label}</span>
                              <span className={`block text-[13px] sm:text-[14px] font-bold tabular-nums break-words ${metric.tone}`}>{formatRupiah(metric.value)}</span>
                            </span>
                          ))}
                        </span>
                      </span>
                    </button>
                    <div id={`rincian-${kat.key}`} hidden={!isExpanded} className="border-t border-border-soft">
                      <div className="overflow-x-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand" role="region" aria-label={`Rincian unit ${kat.label}, geser untuk melihat seluruh kolom`} tabIndex={0}>
                        <table className="w-full min-w-[1560px] text-left border-collapse">
            <thead className="[&_th]:whitespace-nowrap">
              <tr className="border-b border-border-soft bg-surface-subtle/50 text-[11.5px] font-bold uppercase tracking-wider text-muted-faint">
                <th className="py-3 px-5">Kode / Tagging</th>
                <th className="py-3 px-5">Nama Aset</th>
                <th className="py-3 px-5">Tgl Perolehan</th>
                <th className="py-3 px-5 text-right">Harga Perolehan</th>
                <th className="py-3 px-4 text-center">Umur</th>
                <th className="py-3 px-5 text-right">Penyusutan/Bln</th>
                <th className="py-3 px-5 text-right">Nilai Buku Awal {year}</th>
                <th className="py-3 px-5 text-right">Beban {year}</th>
                <th className="py-3 px-5 text-right">Akumulasi s/d {year}</th>
                <th className="py-3 px-5 text-right">Saldo Akhir {year}</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
                          <tbody className="divide-y divide-border-soft text-[13px]">
                        {categoryAssets.map((asset) => {
                          const katLabel =
                            asset.kategoriLabel ||
                            getKategoriLabel(asset.kategoriStandar || asset.kategori);

                          return (
                            <tr
                              key={asset.id}
                              className="hover:bg-surface-hover/40 transition-colors group"
                            >
                              <td className="py-3 px-5 font-mono text-[12px] font-semibold text-brand shrink-0">
                                {asset.kode}
                              </td>
                              <td className="py-3 px-5">
                                <div className="font-bold text-navy-text">{asset.nama}</div>
                                <div className="text-[11px] text-muted-faint">{katLabel}</div>
                              </td>
                              <td className="py-3 px-5 text-[12.5px] text-muted-strong whitespace-nowrap">
                                {asset.tanggalPerolehanFmt}
                              </td>
                              <td className="py-3 px-5 text-right font-semibold text-navy-text tabular-nums whitespace-nowrap">
                                {asset.hargaPerolehanFmt}
                              </td>
                              <td className="py-3 px-4 text-center whitespace-nowrap">
                                {asset.kategoriStandar === "TANAH" ? (
                                  <span className="px-2 py-0.5 rounded-full bg-surface-subtle text-[11px] font-semibold text-muted-faint">
                                    Tidak disusutkan
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full bg-surface-subtle text-[11.5px] font-semibold text-muted-strong">
                                    {asset.umurBulan} bln ({asset.umurTahun} th)
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-5 text-right text-[12px] text-muted-strong tabular-nums whitespace-nowrap">
                                {asset.penyusutanPerBulanFmt}
                              </td>
                              <td className="py-3 px-5 text-right font-semibold text-navy-text tabular-nums whitespace-nowrap" title={`Akumulasi s/d ${year - 1}: ${asset.akumulasiPenyusutanAwalTahunFmt}`}>
                                {asset.nilaiBukuAwalTahunFmt}
                              </td>
                              <td className="py-3 px-5 text-right font-bold text-status-red tabular-nums whitespace-nowrap">
                                {asset.bebanPeriodeIniFmt}
                              </td>
                              <td className="py-3 px-5 text-right font-bold text-status-amber tabular-nums whitespace-nowrap">
                                ({asset.akumulasiPenyusutanFmt})
                              </td>
                              <td className="py-3 px-5 text-right font-extrabold text-status-green tabular-nums whitespace-nowrap">
                                {asset.nilaiBukuFmt}
                              </td>
                              <td className="py-3 px-4 text-center whitespace-nowrap">
                                <div className="flex items-center justify-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => openEditModal(asset)}
                                    title="Edit Aset"
                                    className="p-1.5 rounded-lg hover:bg-surface-hover text-muted-strong hover:text-navy-text transition-colors"
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(asset.id, asset.nama)}
                                    title="Hapus Aset"
                                    className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-muted-strong hover:text-status-red transition-colors"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
        {filteredAssets.length > 0 && (
          <div className="border-t border-border-soft bg-surface-subtle px-5 sm:px-6 py-5">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="text-[12px] font-bold text-navy-text">Total inventaris ditampilkan</span>
              <span className="text-[11px] text-muted-strong">· {filteredAssets.length} unit sesuai filter</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
              {[
                { label: "Harga perolehan", value: filteredTotals.perolehan, tone: "text-navy-text" },
                { label: `Nilai buku awal ${year}`, value: filteredTotals.awalTahun, tone: "text-navy-text" },
                { label: `Beban ${year}`, value: filteredTotals.beban, tone: "text-status-red" },
                { label: "Akumulasi penyusutan", value: filteredTotals.akumulasi, tone: "text-status-amber" },
                { label: `Saldo akhir ${year}`, value: filteredTotals.nilaiBuku, tone: "text-status-green" },
              ].map((metric) => (
                <div key={metric.label} className="min-w-0">
                  <div className="text-[11px] text-muted-strong mb-1.5">{metric.label}</div>
                  <div className={`text-[15px] font-bold tabular-nums break-words ${metric.tone}`}>{formatRupiah(metric.value)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── Modal Dialog Form (Tambah / Edit Aset) ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-surface-card border border-border-soft rounded-[24px] max-w-lg w-full shadow-xl overflow-hidden my-8">
            <div className="px-6 py-4 border-b border-border-soft flex items-center justify-between bg-surface-subtle/40">
              <div className="font-extrabold text-[15px] text-navy-text">
                {editingAsset ? "Edit Aset Tetap" : "Tambah Aset Tetap Baru"}
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg hover:bg-surface-hover text-muted-faint"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
              {formError && (
                <div className="p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl text-status-red text-[12.5px] flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11.5px] font-bold text-muted-strong uppercase mb-1">
                    Kode / Tagging Aset *
                  </label>
                  <input
                    type="text"
                    required
                    value={kode}
                    onChange={(e) => setKode(e.target.value)}
                    placeholder="Contoh: AST-001"
                    className="w-full px-3 py-2 bg-surface-base border border-border-soft rounded-xl text-[13px] text-navy-text focus:outline-none focus:border-brand font-mono font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-[11.5px] font-bold text-muted-strong uppercase mb-1">
                    Kategori Aset *
                  </label>
                  <select
                    value={kategori}
                    onChange={(e) => handleKategoriChange(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-base border border-border-soft rounded-xl text-[13px] text-navy-text focus:outline-none focus:border-brand"
                  >
                    {KATEGORI_OPTIONS.map((k) => (
                      <option key={k.value} value={k.value}>
                        {k.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11.5px] font-bold text-muted-strong uppercase mb-1">
                  Nama Aset Tetap *
                </label>
                <input
                  type="text"
                  required
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  placeholder="Contoh: Toyota Avanza Operasional 2022"
                  className="w-full px-3 py-2 bg-surface-base border border-border-soft rounded-xl text-[13px] text-navy-text focus:outline-none focus:border-brand"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11.5px] font-bold text-muted-strong uppercase mb-1">
                    Tanggal Perolehan *
                  </label>
                  <input
                    type="date"
                    required
                    value={tanggalPerolehan}
                    onChange={(e) => setTanggalPerolehan(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-base border border-border-soft rounded-xl text-[13px] text-navy-text focus:outline-none focus:border-brand"
                  />
                </div>

                <div>
                  <label className="block text-[11.5px] font-bold text-muted-strong uppercase mb-1">
                    Harga Perolehan (Rp) *
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    value={formatRupiahInput(hargaPerolehan)}
                    onChange={(e) => setHargaPerolehan(Number(e.target.value.replace(/[^0-9]/g, "")) || 0)}
                    placeholder="Contoh: 150.000.000"
                    className="w-full px-3 py-2 bg-surface-base border border-border-soft rounded-xl text-[13px] text-navy-text focus:outline-none focus:border-brand tabular-nums font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11.5px] font-bold text-muted-strong uppercase mb-1">
                    Nilai Residu (Referensi) Rp
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    disabled={kategori === "TANAH"}
                    value={kategori === "TANAH" ? formatRupiahInput(hargaPerolehan) : formatRupiahInput(nilaiResidu)}
                    onChange={(e) => setNilaiResidu(Number(e.target.value.replace(/[^0-9]/g, "")) || 0)}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-surface-base border border-border-soft rounded-xl text-[13px] text-navy-text focus:outline-none focus:border-brand tabular-nums disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                  <span className="text-[10.5px] text-muted-faint">
                    {kategori === "TANAH"
                      ? "Tanah tidak memiliki nilai residu terpisah"
                      : "Referensi saja; penyusutan dihitung dari harga perolehan penuh"}
                  </span>
                </div>

                <div>
                  <label className="block text-[11.5px] font-bold text-muted-strong uppercase mb-1">
                    Umur Ekonomis {kategori === "TANAH" ? "(N/A)" : "*"}
                  </label>
                  {kategori === "TANAH" ? (
                    <div className="px-3 py-2 bg-surface-subtle border border-border-soft rounded-xl text-[12px] text-muted-faint italic flex items-center h-[38px]">
                      Tidak disusutkan (PSAK 16)
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="relative">
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={umurTahun || ""}
                          onChange={(e) => handleUmurTahunChange(Number(e.target.value))}
                          className="w-full px-3 py-2 bg-surface-base border border-border-soft rounded-xl text-[13px] text-navy-text focus:outline-none focus:border-brand tabular-nums pr-8"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-muted-faint font-semibold">
                          th
                        </span>
                      </div>
                      <div className="relative">
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={umurBulan || ""}
                          onChange={(e) => handleUmurBulanChange(Number(e.target.value))}
                          className="w-full px-3 py-2 bg-surface-base border border-border-soft rounded-xl text-[13px] text-navy-text focus:outline-none focus:border-brand tabular-nums pr-9"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-muted-faint font-semibold">
                          bln
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Live Preview Box */}
              {kategori === "TANAH" ? (
                <div className="p-3 bg-blue-50/60 dark:bg-blue-500/10 rounded-xl border border-blue-200 dark:border-blue-500/20 text-[12px] flex flex-col gap-1">
                  <div className="font-bold text-navy-text flex items-center justify-between">
                    <span>Klasifikasi: Aset Tanah (PSAK 16)</span>
                    <span className="text-blue-600 dark:text-blue-400 font-semibold">Tidak Disusutkan</span>
                  </div>
                  <div className="text-muted-faint text-[11.5px]">
                    Nilai buku tercatat utuh sebesar harga perolehan: {formatRupiah(hargaPerolehan)}.
                  </div>
                </div>
              ) : hargaPerolehan > 0 ? (
                <div className="p-3 bg-surface-subtle/70 rounded-xl border border-border-soft text-[12px] flex flex-col gap-1">
                  <div className="font-bold text-navy-text flex items-center justify-between">
                    <span>Estimasi Penyusutan Garis Lurus:</span>
                    <span className="text-brand font-mono">{formatRupiah(Math.round(livePenyusutanBulan))} / bulan</span>
                  </div>
                  <div className="text-muted-faint text-[11.5px]">
                    Beban tahunan: {formatRupiah(Math.round(livePenyusutanTahun))} • Basis susut: {formatRupiah(liveDepreciable)}
                  </div>
                </div>
              ) : null}

              <div>
                <label className="block text-[11.5px] font-bold text-muted-strong uppercase mb-1">
                  Keterangan / Lokasi Fisik
                </label>
                <textarea
                  rows={2}
                  value={keterangan}
                  onChange={(e) => setKeterangan(e.target.value)}
                  placeholder="Contoh: Digunakan tim proyek Palembang, nopol B 1234 XYZ"
                  className="w-full px-3 py-2 bg-surface-base border border-border-soft rounded-xl text-[13px] text-navy-text focus:outline-none focus:border-brand"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border-soft">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isPending}
                  className="px-4 py-2 border border-border-soft rounded-pill text-[13px] font-semibold text-muted-strong hover:bg-surface-hover transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 bg-navy text-white rounded-pill text-[13px] font-bold hover:bg-navy-strong shadow-xs transition-colors flex items-center gap-2"
                >
                  {isPending ? "Menyimpan..." : editingAsset ? "Simpan Perubahan" : "Simpan Aset"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
