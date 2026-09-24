"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AsetTetapWithDepreciation,
  PenyusutanSummary,
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
} from "lucide-react";

const KATEGORI_OPTIONS = [
  { value: "KENDARAAN", label: "Kendaraan" },
  { value: "PERALATAN", label: "Peralatan & Perlengkapan" },
  { value: "MESIN", label: "Mesin & Alat Berat" },
  { value: "GEDUNG", label: "Gedung & Bangunan" },
  { value: "INVENTARIS", label: "Inventaris Kantor" },
  { value: "LAINNYA", label: "Aset Lainnya" },
];

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
    const matchKategori = selectedKategori === "ALL" || asset.kategori === selectedKategori;
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
    setKategori(asset.kategori);
    setTanggalPerolehan(new Date(asset.tanggalPerolehan).toISOString().slice(0, 10));
    setHargaPerolehan(asset.hargaPerolehanNum);
    setNilaiResidu(asset.nilaiResiduNum);
    setUmurBulan(asset.umurBulan);
    setUmurTahun(Math.round(asset.umurBulan / 12));
    setKeterangan(asset.keterangan || "");
    setFormError(null);
    setIsModalOpen(true);
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
    if (umurBulan <= 0) {
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
  const liveDepreciable = Math.max(0, hargaPerolehan - nilaiResidu);
  const livePenyusutanBulan = umurBulan > 0 ? liveDepreciable / umurBulan : 0;
  const livePenyusutanTahun = livePenyusutanBulan * 12;

  return (
    <div className="flex flex-col gap-6">
      {/* ── 4 Card Ringkasan Finansial Aset ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Total Harga Perolehan */}
        <div className="bg-surface-card rounded-[22px] border border-border-soft p-4 sm:p-5 shadow-xs flex flex-col justify-between min-w-0 overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[12px] font-bold text-muted-faint uppercase tracking-wider truncate">
              Nilai Perolehan
            </span>
            <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-none">
              <Building2 size={16} />
            </div>
          </div>
          <div className="min-w-0">
            <div className={`${getMetricValueFontSize(summary.totalHargaPerolehanFmt)} text-navy-text truncate`} title={summary.totalHargaPerolehanFmt}>
              {summary.totalHargaPerolehanFmt}
            </div>
            <div className="text-[11.5px] text-muted-faint mt-1 truncate">
              Total {summary.assets.length} unit aset terdaftar
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
              Nilai Buku Bersih
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
              Perolehan − Akumulasi (Net)
            </div>
          </div>
        </div>
      </div>

      {/* ── Info Banner Otomatisasi (Issue 39 & SRS v2.0) ── */}
      <div className="bg-blue-50/70 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/25 rounded-[18px] p-4 flex items-start gap-3.5">
        <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 flex items-center justify-center flex-none mt-0.5">
          <CheckCircle2 size={16} />
        </div>
        <div className="text-[12.5px] text-blue-900 dark:text-blue-200 leading-relaxed">
          <span className="font-bold">Otomatisasi Penuh Terhubung (Linked): </span>
          Biaya penyusutan aset tetap tidak perlu lagi diinput manual pada Jurnal Umum. Sistem secara otomatis menghitung penyusutan garis lurus (PSAK 16) dan menyalurkan nilainya ke akun <span className="font-semibold underline">Beban Penyusutan</span> di Laba Rugi serta akun kontra <span className="font-semibold underline">Akumulasi Penyusutan</span> di Neraca.
        </div>
      </div>

      {/* ── Filter Bar & Actions ── */}
      <div className="bg-surface-card rounded-[22px] border border-border-soft p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 w-full sm:w-auto flex-1">
          <div className="relative flex-1 max-w-xs">
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

      {/* ── Tabel Daftar Aset Tetap ── */}
      <div className="bg-surface-card rounded-[22px] border border-border-soft shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-border-soft flex items-center justify-between">
          <div className="font-bold text-[13.5px] text-navy-text uppercase tracking-wider">
            Daftar Inventaris Aset Tetap ({entityName})
          </div>
          <span className="text-[12px] font-semibold text-muted-faint">
            {filteredAssets.length} aset ditampilkan
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border-soft bg-surface-subtle/50 text-[11.5px] font-bold uppercase tracking-wider text-muted-faint">
                <th className="py-3 px-5">Kode / Tagging</th>
                <th className="py-3 px-5">Nama Aset</th>
                <th className="py-3 px-5">Tgl Perolehan</th>
                <th className="py-3 px-5 text-right">Harga Perolehan</th>
                <th className="py-3 px-4 text-center">Umur</th>
                <th className="py-3 px-5 text-right">Penyusutan/Bln</th>
                <th className="py-3 px-5 text-right">Beban {year}</th>
                <th className="py-3 px-5 text-right">Akumulasi s/d {year}</th>
                <th className="py-3 px-5 text-right">Nilai Buku (Net)</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-subtle text-[13px]">
              {filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 px-6 text-center text-muted-faint italic">
                    Belum ada data aset tetap. Klik tombol &quot;Tambah Aset Tetap&quot; untuk mencatat aset baru.
                  </td>
                </tr>
              ) : (
                filteredAssets.map((asset) => {
                  const katLabel =
                    KATEGORI_OPTIONS.find((k) => k.value === asset.kategori)?.label || asset.kategori;

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
                        <span className="px-2 py-0.5 rounded-full bg-surface-subtle text-[11.5px] font-semibold text-muted-strong">
                          {asset.umurBulan} bln ({asset.umurTahun} th)
                        </span>
                      </td>
                      <td className="py-3 px-5 text-right text-[12px] text-muted-strong tabular-nums whitespace-nowrap">
                        {asset.penyusutanPerBulanFmt}
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
                })
              )}
            </tbody>
            {filteredAssets.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-border-soft bg-surface-subtle/80 font-bold text-[13px]">
                  <td colSpan={3} className="py-3.5 px-5 text-navy-text uppercase tracking-wider">
                    Total
                  </td>
                  <td className="py-3.5 px-5 text-right text-navy-text tabular-nums whitespace-nowrap">
                    {summary.totalHargaPerolehanFmt}
                  </td>
                  <td></td>
                  <td></td>
                  <td className="py-3.5 px-5 text-right text-status-red tabular-nums whitespace-nowrap">
                    {summary.totalBebanPenyusutanFmt}
                  </td>
                  <td className="py-3.5 px-5 text-right text-status-amber tabular-nums whitespace-nowrap">
                    ({summary.totalAkumulasiPenyusutanFmt})
                  </td>
                  <td className="py-3.5 px-5 text-right text-status-green tabular-nums whitespace-nowrap">
                    {summary.totalNilaiBukuFmt}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

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
                    onChange={(e) => setKategori(e.target.value)}
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
                    type="number"
                    min="0"
                    step="1000"
                    required
                    value={hargaPerolehan || ""}
                    onChange={(e) => setHargaPerolehan(Number(e.target.value))}
                    placeholder="Contoh: 150000000"
                    className="w-full px-3 py-2 bg-surface-base border border-border-soft rounded-xl text-[13px] text-navy-text focus:outline-none focus:border-brand tabular-nums font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11.5px] font-bold text-muted-strong uppercase mb-1">
                    Nilai Residu (Sisa) Rp
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={nilaiResidu || ""}
                    onChange={(e) => setNilaiResidu(Number(e.target.value))}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-surface-base border border-border-soft rounded-xl text-[13px] text-navy-text focus:outline-none focus:border-brand tabular-nums"
                  />
                  <span className="text-[10.5px] text-muted-faint">Biarkan 0 jika disusutkan habis</span>
                </div>

                <div>
                  <label className="block text-[11.5px] font-bold text-muted-strong uppercase mb-1">
                    Umur Ekonomis *
                  </label>
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
                </div>
              </div>

              {/* Live Preview Box */}
              {hargaPerolehan > 0 && (
                <div className="p-3 bg-surface-subtle/70 rounded-xl border border-border-soft text-[12px] flex flex-col gap-1">
                  <div className="font-bold text-navy-text flex items-center justify-between">
                    <span>Estimasi Penyusutan Garis Lurus:</span>
                    <span className="text-brand font-mono">{formatRupiah(Math.round(livePenyusutanBulan))} / bulan</span>
                  </div>
                  <div className="text-muted-faint text-[11.5px]">
                    Beban tahunan: {formatRupiah(Math.round(livePenyusutanTahun))} • Basis susut: {formatRupiah(liveDepreciable)}
                  </div>
                </div>
              )}

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
