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
import { DatePicker } from "@/components/shared/DatePicker";
import {
  Plus,
  Edit2,
  Trash2,
  Building2,
  TrendingDown,
  Scale,
  Landmark,
  AlertCircle,
  X,
  Search,
} from "lucide-react";
import { LoadingOverlay } from "@/components/shared/LoadingOverlay";

const KATEGORI_OPTIONS = STANDAR_KATEGORI_ASET.map((k) => ({
  value: k.key,
  label: k.label,
}));

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
  const liveDepreciable = Math.max(0, hargaPerolehan - nilaiResidu);
  const livePenyusutanBulan = umurBulan > 0 ? liveDepreciable / umurBulan : 0;
  const livePenyusutanTahun = livePenyusutanBulan * 12;

  return (
    <div className="relative flex flex-col gap-5">
      <LoadingOverlay visible={isPending} />

      {/* ── 4 Metric Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-surface-card rounded-[20px] border border-border-soft p-4 flex items-center gap-4 min-w-0 overflow-hidden">
          <div className="w-10 h-10 rounded-[10px] bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-none">
            <Building2 size={18} />
          </div>
          <div className="min-w-0">
            <div className={`${getMetricValueFontSize(summary.totalHargaPerolehanFmt)} font-extrabold text-navy-text truncate tabular-nums`} title={summary.totalHargaPerolehanFmt}>
              {summary.totalHargaPerolehanFmt}
            </div>
            <div className="text-[11px] text-muted-faint mt-0.5 truncate">
              Nilai Perolehan · {summary.assets.length} unit
            </div>
          </div>
        </div>

        <div className="bg-surface-card rounded-[20px] border border-border-soft p-4 flex items-center gap-4 min-w-0 overflow-hidden">
          <div className="w-10 h-10 rounded-[10px] bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center flex-none">
            <TrendingDown size={18} />
          </div>
          <div className="min-w-0">
            <div className={`${getMetricValueFontSize(summary.totalBebanPenyusutanFmt)} font-extrabold text-status-red truncate tabular-nums`} title={summary.totalBebanPenyusutanFmt}>
              {summary.totalBebanPenyusutanFmt}
            </div>
            <div className="text-[11px] text-muted-faint mt-0.5 truncate">
              Beban Penyusutan {year}
            </div>
          </div>
        </div>

        <div className="bg-surface-card rounded-[20px] border border-border-soft p-4 flex items-center gap-4 min-w-0 overflow-hidden">
          <div className="w-10 h-10 rounded-[10px] bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-none">
            <Scale size={18} />
          </div>
          <div className="min-w-0">
            <div className={`${getMetricValueFontSize(summary.totalAkumulasiPenyusutanFmt)} font-extrabold text-status-amber truncate tabular-nums`} title={`(${summary.totalAkumulasiPenyusutanFmt})`}>
              ({summary.totalAkumulasiPenyusutanFmt})
            </div>
            <div className="text-[11px] text-muted-faint mt-0.5 truncate">
              Akumulasi Penyusutan
            </div>
          </div>
        </div>

        <div className="bg-surface-card rounded-[20px] border border-border-soft p-4 flex items-center gap-4 min-w-0 overflow-hidden">
          <div className="w-10 h-10 rounded-[10px] bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-none">
            <Landmark size={18} />
          </div>
          <div className="min-w-0">
            <div className={`${getMetricValueFontSize(summary.totalNilaiBukuFmt)} font-extrabold text-status-green truncate tabular-nums`} title={summary.totalNilaiBukuFmt}>
              {summary.totalNilaiBukuFmt}
            </div>
            <div className="text-[11px] text-muted-faint mt-0.5 truncate">
              Nilai Buku Bersih (Net)
            </div>
          </div>
        </div>
      </div>

      {/* ── Rekap Per Kategori ── */}
      {summary.rekapPerKategori && summary.rekapPerKategori.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-bold text-muted-faint uppercase tracking-wider">Per Kategori</p>
            {selectedKategori !== "ALL" && (
              <button onClick={() => setSelectedKategori("ALL")} className="text-[11.5px] font-bold text-brand hover:underline">
                Reset Filter
              </button>
            )}
          </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {summary.rekapPerKategori.map((rekap) => {
            const isSelected = selectedKategori === rekap.kategori;
            return (
              <button
                type="button"
                key={rekap.kategori}
                onClick={() => setSelectedKategori(isSelected ? "ALL" : rekap.kategori)}
                className={`text-left p-4 rounded-[20px] border transition-all ${
                  isSelected
                    ? "bg-brand/5 border-brand ring-1 ring-brand"
                    : "bg-surface-card border-border-soft hover:border-brand/40 hover:bg-surface-hover/30"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11.5px] font-bold text-muted-stronger uppercase tracking-wide">
                    {rekap.label}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-surface-subtle text-[10.5px] font-semibold text-muted-faint">
                    {rekap.jumlahAset} unit
                  </span>
                </div>
                <div className="text-[15px] font-extrabold text-navy-text tabular-nums leading-tight">
                  {rekap.totalNilaiBukuFmt}
                </div>
                {rekap.kategori !== "TANAH" ? (
                  <div className="text-[10.5px] text-muted-faint mt-1.5">
                    Akum.{" "}
                    <span className="text-status-amber font-semibold tabular-nums">
                      ({rekap.totalAkumulasiPenyusutanFmt})
                    </span>
                  </div>
                ) : (
                  <div className="text-[10.5px] text-blue-500 dark:text-blue-400 mt-1.5 italic">
                    Tidak disusutkan (PSAK 16)
                  </div>
                )}
              </button>
            );
          })}
        </div>
        </div>
      )}

      {/* ── Filter Bar ── */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-faint pointer-events-none" />
          <input
            type="text"
            placeholder="Cari kode atau nama aset…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-9 pr-3 w-56 bg-surface-input border border-border-soft rounded-[10px] text-[13px] text-navy-text placeholder:text-muted-faint focus:outline-none focus:border-brand"
          />
        </div>

        <select
          value={selectedKategori}
          onChange={(e) => setSelectedKategori(e.target.value)}
          className="h-9 bg-surface-input border border-border-soft rounded-[10px] px-3 text-[12.5px] font-semibold text-muted-stronger focus:outline-none focus:border-brand"
        >
          <option value="ALL">Semua Kategori</option>
          {KATEGORI_OPTIONS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>

        <button
          onClick={openAddModal}
          className="ml-auto h-9 px-4 bg-navy text-white rounded-[10px] text-[13px] font-bold flex items-center gap-2 hover:opacity-90 transition-opacity shrink-0"
        >
          <Plus size={14} />
          Tambah Aset Tetap
        </button>
      </div>

      {/* ── Tabel Daftar Aset Tetap ── */}
      <div className="bg-surface-card rounded-[20px] border border-border-soft shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border-soft flex items-center justify-between">
          <span className="font-bold text-[13px] text-navy-text">
            Inventaris Aset Tetap
            <span className="text-muted-faint font-normal ml-1.5">— {entityName}</span>
          </span>
          <span className="text-[11.5px] text-muted-faint">
            {filteredAssets.length} aset
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border-soft bg-surface-subtle/50 text-[10.5px] font-bold uppercase tracking-wider text-muted-faint">
                <th className="py-2.5 px-5">Kode</th>
                <th className="py-2.5 px-5">Nama Aset</th>
                <th className="py-2.5 px-5">Tgl Perolehan</th>
                <th className="py-2.5 px-5 text-right">Harga Perolehan</th>
                <th className="py-2.5 px-4 text-center">Umur</th>
                <th className="py-2.5 px-5 text-right">Penyusutan/Bln</th>
                <th className="py-2.5 px-5 text-right">Beban {year}</th>
                <th className="py-2.5 px-5 text-right">Akumulasi s/d {year}</th>
                <th className="py-2.5 px-5 text-right">Nilai Buku</th>
                <th className="py-2.5 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-subtle text-[12.5px]">
              {filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 px-6 text-center text-muted-faint italic text-[13px]">
                    Belum ada data aset tetap. Klik &quot;+ Tambah Aset Tetap&quot; untuk mencatat aset baru.
                  </td>
                </tr>
              ) : (
                filteredAssets.map((asset) => {
                  const katLabel =
                    asset.kategoriLabel ||
                    getKategoriLabel(asset.kategoriStandar || asset.kategori);

                  return (
                    <tr
                      key={asset.id}
                      className="hover:bg-surface-hover/40 transition-colors group"
                    >
                      <td className="py-2.5 px-5 font-mono text-[11.5px] font-semibold text-brand whitespace-nowrap">
                        {asset.kode}
                      </td>
                      <td className="py-2.5 px-5">
                        <div className="font-semibold text-navy-text">{asset.nama}</div>
                        <div className="text-[10.5px] text-muted-faint">{katLabel}</div>
                      </td>
                      <td className="py-2.5 px-5 text-[12px] text-muted-strong whitespace-nowrap">
                        {asset.tanggalPerolehanFmt}
                      </td>
                      <td className="py-2.5 px-5 text-right font-semibold text-navy-text tabular-nums whitespace-nowrap">
                        {asset.hargaPerolehanFmt}
                      </td>
                      <td className="py-2.5 px-4 text-center whitespace-nowrap">
                        {asset.kategoriStandar === "TANAH" ? (
                          <span className="px-2 py-0.5 rounded-full bg-surface-subtle text-[10.5px] font-semibold text-muted-faint">
                            —
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-surface-subtle text-[11px] font-semibold text-muted-strong">
                            {asset.umurBulan}b / {asset.umurTahun}t
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-5 text-right text-[12px] text-muted-strong tabular-nums whitespace-nowrap">
                        {asset.penyusutanPerBulanFmt}
                      </td>
                      <td className="py-2.5 px-5 text-right font-bold text-status-red tabular-nums whitespace-nowrap">
                        {asset.bebanPeriodeIniFmt}
                      </td>
                      <td className="py-2.5 px-5 text-right font-bold text-status-amber tabular-nums whitespace-nowrap">
                        ({asset.akumulasiPenyusutanFmt})
                      </td>
                      <td className="py-2.5 px-5 text-right font-extrabold text-status-green tabular-nums whitespace-nowrap">
                        {asset.nilaiBukuFmt}
                      </td>
                      <td className="py-2.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openEditModal(asset)}
                            title="Edit Aset"
                            className="p-1.5 rounded-lg hover:bg-surface-hover text-muted-strong hover:text-navy-text transition-colors"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => handleDelete(asset.id, asset.nama)}
                            title="Hapus Aset"
                            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-muted-strong hover:text-status-red transition-colors"
                          >
                            <Trash2 size={13} />
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
                <tr className="border-t-2 border-border-soft bg-surface-subtle/80 font-bold text-[12.5px]">
                  <td colSpan={3} className="py-3 px-5 text-navy-text uppercase tracking-wider text-[11px]">
                    Total
                  </td>
                  <td className="py-3 px-5 text-right text-navy-text tabular-nums whitespace-nowrap">
                    {summary.totalHargaPerolehanFmt}
                  </td>
                  <td></td>
                  <td></td>
                  <td className="py-3 px-5 text-right text-status-red tabular-nums whitespace-nowrap">
                    {summary.totalBebanPenyusutanFmt}
                  </td>
                  <td className="py-3 px-5 text-right text-status-amber tabular-nums whitespace-nowrap">
                    ({summary.totalAkumulasiPenyusutanFmt})
                  </td>
                  <td className="py-3 px-5 text-right text-status-green tabular-nums whitespace-nowrap">
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
          <div className="bg-surface-card border border-border-soft rounded-[12px] max-w-lg w-full shadow-xl overflow-hidden my-8">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-border-soft flex items-center justify-between">
              <span className="font-bold text-[14px] text-navy-text">
                {editingAsset ? "Edit Aset Tetap" : "Tambah Aset Tetap"}
              </span>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-surface-hover text-muted-faint transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-3.5">
              {formError && (
                <div className="p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-[10px] text-status-red text-[12px] flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10.5px] font-bold text-muted-strong uppercase tracking-wider mb-1">
                    Kode / Tagging *
                  </label>
                  <input
                    type="text"
                    required
                    value={kode}
                    onChange={(e) => setKode(e.target.value)}
                    placeholder="AST-001"
                    className="w-full h-9 px-3 bg-surface-input border border-border-soft rounded-[10px] text-[13px] text-navy-text focus:outline-none focus:border-brand font-mono font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-[10.5px] font-bold text-muted-strong uppercase tracking-wider mb-1">
                    Kategori *
                  </label>
                  <select
                    value={kategori}
                    onChange={(e) => handleKategoriChange(e.target.value)}
                    className="w-full h-9 px-3 bg-surface-input border border-border-soft rounded-[10px] text-[13px] text-navy-text focus:outline-none focus:border-brand"
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
                <label className="block text-[10.5px] font-bold text-muted-strong uppercase tracking-wider mb-1">
                  Nama Aset *
                </label>
                <input
                  type="text"
                  required
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  placeholder="Contoh: Toyota Avanza Operasional 2022"
                  className="w-full h-9 px-3 bg-surface-input border border-border-soft rounded-[10px] text-[13px] text-navy-text focus:outline-none focus:border-brand"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10.5px] font-bold text-muted-strong uppercase tracking-wider mb-1">
                    Tanggal Perolehan *
                  </label>
                  <DatePicker value={tanggalPerolehan} onChange={setTanggalPerolehan} required />
                </div>

                <div>
                  <label className="block text-[10.5px] font-bold text-muted-strong uppercase tracking-wider mb-1">
                    Harga Perolehan (Rp) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    required
                    value={hargaPerolehan || ""}
                    onChange={(e) => setHargaPerolehan(Number(e.target.value))}
                    placeholder="150000000"
                    className="w-full h-9 px-3 bg-surface-input border border-border-soft rounded-[10px] text-[13px] text-navy-text focus:outline-none focus:border-brand tabular-nums font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10.5px] font-bold text-muted-strong uppercase tracking-wider mb-1">
                    Nilai Residu (Rp)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    disabled={kategori === "TANAH"}
                    value={kategori === "TANAH" ? hargaPerolehan : (nilaiResidu || "")}
                    onChange={(e) => setNilaiResidu(Number(e.target.value))}
                    placeholder="0"
                    className="w-full h-9 px-3 bg-surface-input border border-border-soft rounded-[10px] text-[13px] text-navy-text focus:outline-none focus:border-brand tabular-nums disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <span className="text-[10px] text-muted-faint mt-0.5 block">
                    {kategori === "TANAH" ? "Tidak berlaku untuk Tanah" : "Biarkan 0 jika disusutkan habis"}
                  </span>
                </div>

                <div>
                  <label className="block text-[10.5px] font-bold text-muted-strong uppercase tracking-wider mb-1">
                    Umur Ekonomis {kategori === "TANAH" ? "(N/A)" : "*"}
                  </label>
                  {kategori === "TANAH" ? (
                    <div className="h-9 px-3 bg-surface-subtle border border-border-soft rounded-[10px] text-[12px] text-muted-faint italic flex items-center">
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
                          className="w-full h-9 px-3 pr-8 bg-surface-input border border-border-soft rounded-[10px] text-[13px] text-navy-text focus:outline-none focus:border-brand tabular-nums"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10.5px] text-muted-faint font-semibold pointer-events-none">
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
                          className="w-full h-9 px-3 pr-9 bg-surface-input border border-border-soft rounded-[10px] text-[13px] text-navy-text focus:outline-none focus:border-brand tabular-nums"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10.5px] text-muted-faint font-semibold pointer-events-none">
                          bln
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Live Preview */}
              {kategori === "TANAH" ? (
                <div className="p-3 bg-blue-50/60 dark:bg-blue-500/10 rounded-[10px] border border-blue-200 dark:border-blue-500/20 text-[12px]">
                  <div className="font-semibold text-navy-text flex items-center justify-between">
                    <span>Aset Tanah (PSAK 16)</span>
                    <span className="text-blue-600 dark:text-blue-400 text-[11.5px]">Tidak Disusutkan</span>
                  </div>
                  <div className="text-muted-faint text-[11px] mt-0.5">
                    Nilai buku = harga perolehan: {formatRupiah(hargaPerolehan)}
                  </div>
                </div>
              ) : hargaPerolehan > 0 ? (
                <div className="p-3 bg-surface-subtle rounded-[10px] border border-border-soft text-[12px]">
                  <div className="font-semibold text-navy-text flex items-center justify-between">
                    <span>Estimasi Penyusutan (Garis Lurus)</span>
                    <span className="text-brand font-mono text-[12.5px]">{formatRupiah(Math.round(livePenyusutanBulan))} / bln</span>
                  </div>
                  <div className="text-muted-faint text-[11px] mt-0.5">
                    Tahunan: {formatRupiah(Math.round(livePenyusutanTahun))} · Basis: {formatRupiah(liveDepreciable)}
                  </div>
                </div>
              ) : null}

              <div>
                <label className="block text-[10.5px] font-bold text-muted-strong uppercase tracking-wider mb-1">
                  Keterangan / Lokasi Fisik
                </label>
                <textarea
                  rows={2}
                  value={keterangan}
                  onChange={(e) => setKeterangan(e.target.value)}
                  placeholder="Contoh: Digunakan tim proyek Palembang, nopol B 1234 XYZ"
                  className="w-full px-3 py-2 bg-surface-input border border-border-soft rounded-[10px] text-[13px] text-navy-text focus:outline-none focus:border-brand resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-soft">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isPending}
                  className="h-9 px-4 border border-border-soft rounded-[10px] text-[12.5px] font-semibold text-muted-stronger hover:bg-surface-hover transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="h-9 px-5 bg-navy text-white rounded-[10px] text-[12.5px] font-bold hover:bg-navy-strong shadow-xs transition-colors flex items-center gap-2"
                >
                  {isPending ? "Menyimpan…" : editingAsset ? "Simpan Perubahan" : "Simpan Aset"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
