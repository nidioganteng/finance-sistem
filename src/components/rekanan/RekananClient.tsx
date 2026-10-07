"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RekananTipe } from "@prisma/client";
import {
  RekananItem,
  createRekananAction,
  updateRekananAction,
  deleteRekananAction,
} from "@/lib/actions/rekanan";
import {
  Users,
  Search,
  Plus,
  Pencil,
  Trash2,
  X,
  Building2,
  Briefcase,
  UserCheck,
  CreditCard,
  Phone,
  Mail,
  MapPin,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

const TIPE_BADGE: Record<RekananTipe, { label: string; badgeClass: string; icon: any }> = {
  KLIEN: {
    label: "Klien / Dinas",
    badgeClass: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200",
    icon: Building2,
  },
  VENDOR: {
    label: "Vendor / Supplier",
    badgeClass: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200",
    icon: Briefcase,
  },
  TENAGA_AHLI: {
    label: "Tenaga Ahli",
    badgeClass: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200",
    icon: UserCheck,
  },
  LAINNYA: {
    label: "Lainnya",
    badgeClass: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200",
    icon: Users,
  },
};

type Props = {
  initialRekanan: RekananItem[];
  canManage: boolean;
};

export function RekananClient({ initialRekanan, canManage }: Props) {
  const router = useRouter();
  const [rekananList, setRekananList] = useState<RekananItem[]>(initialRekanan);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTipe, setSelectedTipe] = useState<string>("ALL");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRekanan, setEditingRekanan] = useState<RekananItem | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingRekanan, setDeletingRekanan] = useState<RekananItem | null>(null);

  // Form State
  const [formData, setFormData] = useState<{
    nama: string;
    npwp: string;
    nik: string;
    tipe: RekananTipe;
    kategori: string;
    alamat: string;
    telepon: string;
    email: string;
    namaBank: string;
    noRekening: string;
    atasNamaBank: string;
  }>({
    nama: "",
    npwp: "",
    nik: "",
    tipe: RekananTipe.VENDOR,
    kategori: "",
    alamat: "",
    telepon: "",
    email: "",
    namaBank: "",
    noRekening: "",
    atasNamaBank: "",
  });

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Filter List
  const filteredList = rekananList.filter((r) => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      searchQuery === "" ||
      r.nama.toLowerCase().includes(q) ||
      (r.npwp && r.npwp.toLowerCase().includes(q)) ||
      (r.nik && r.nik.toLowerCase().includes(q)) ||
      (r.kategori && r.kategori.toLowerCase().includes(q)) ||
      (r.namaBank && r.namaBank.toLowerCase().includes(q)) ||
      (r.noRekening && r.noRekening.toLowerCase().includes(q));

    const matchTipe = selectedTipe === "ALL" || r.tipe === selectedTipe;

    return matchSearch && matchTipe;
  });

  const counts = {
    ALL: rekananList.length,
    KLIEN: rekananList.filter((r) => r.tipe === RekananTipe.KLIEN).length,
    VENDOR: rekananList.filter((r) => r.tipe === RekananTipe.VENDOR).length,
    TENAGA_AHLI: rekananList.filter((r) => r.tipe === RekananTipe.TENAGA_AHLI).length,
  };

  function openCreateModal() {
    setEditingRekanan(null);
    setFormData({
      nama: "",
      npwp: "",
      nik: "",
      tipe: RekananTipe.VENDOR,
      kategori: "",
      alamat: "",
      telepon: "",
      email: "",
      namaBank: "",
      noRekening: "",
      atasNamaBank: "",
    });
    setErrorMessage(null);
    setIsModalOpen(true);
  }

  function openEditModal(r: RekananItem) {
    setEditingRekanan(r);
    setFormData({
      nama: r.nama,
      npwp: r.npwp || "",
      nik: r.nik || "",
      tipe: r.tipe,
      kategori: r.kategori || "",
      alamat: r.alamat || "",
      telepon: r.telepon || "",
      email: r.email || "",
      namaBank: r.namaBank || "",
      noRekening: r.noRekening || "",
      atasNamaBank: r.atasNamaBank || "",
    });
    setErrorMessage(null);
    setIsModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    startTransition(async () => {
      if (editingRekanan) {
        const res = await updateRekananAction(editingRekanan.id, formData);
        if (res.error) {
          setErrorMessage(res.error);
          return;
        }
      } else {
        const res = await createRekananAction(formData);
        if (res.error) {
          setErrorMessage(res.error);
          return;
        }
      }

      setIsModalOpen(false);
      router.refresh();
    });
  }

  async function handleDeleteConfirm() {
    if (!deletingRekanan) return;
    startTransition(async () => {
      const res = await deleteRekananAction(deletingRekanan.id);
      if (res.error) {
        alert(res.error);
      } else {
        setIsDeleteModalOpen(false);
        setDeletingRekanan(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Header Bar & Quick Metrics */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-card p-4 sm:p-5 rounded-2xl border border-border-soft shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-navy-text flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            Database Terpusat Rekanan
          </h2>
          <p className="text-xs text-navy-soft mt-1">
            Master NPWP, NIK, dan Rekening Bank untuk fitur Auto-Fill otomatis pada Transaksi dan E-Faktur.
          </p>
        </div>

        {canManage && (
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors shadow-xs cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            Tambah Rekanan Baru
          </button>
        )}
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Type Filter Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { key: "ALL", label: `Semua (${counts.ALL})` },
            { key: "KLIEN", label: `Klien/Dinas (${counts.KLIEN})` },
            { key: "VENDOR", label: `Vendor (${counts.VENDOR})` },
            { key: "TENAGA_AHLI", label: `Tenaga Ahli (${counts.TENAGA_AHLI})` },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setSelectedTipe(tab.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer border ${
                selectedTipe === tab.key
                  ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                  : "bg-surface-card text-navy-soft border-border-soft hover:bg-surface-hover hover:text-navy-text"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-navy-soft" />
          <input
            type="text"
            placeholder="Cari Nama, NPWP, NIK, Rekening..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-border-soft bg-surface-card text-navy-text focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-soft hover:text-navy-text text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-surface-card rounded-2xl border border-border-soft shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-surface-subtle/80 border-b border-border-soft text-navy-soft font-semibold">
                <th className="p-3.5 pl-4">Tipe Rekanan</th>
                <th className="p-3.5">Nama & Kategori</th>
                <th className="p-3.5">NPWP / NIK</th>
                <th className="p-3.5">Rekening Bank</th>
                <th className="p-3.5">Kontak & Alamat</th>
                {canManage && <th className="p-3.5 pr-4 text-center">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-soft">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 6 : 5} className="p-8 text-center text-navy-soft">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="font-medium text-sm">Tidak ada data rekanan ditemukan.</p>
                    <p className="text-xs mt-0.5">
                      {searchQuery
                        ? "Coba gunakan kata kunci pencarian yang lain."
                        : "Klik 'Tambah Rekanan Baru' untuk menambahkan."}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredList.map((r) => {
                  const badgeInfo = TIPE_BADGE[r.tipe] || TIPE_BADGE.LAINNYA;
                  const Icon = badgeInfo.icon;
                  return (
                    <tr
                      key={r.id}
                      className="hover:bg-surface-subtle/50 transition-colors"
                    >
                      {/* Tipe Rekanan */}
                      <td className="p-3.5 pl-4 align-top">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${badgeInfo.badgeClass}`}
                        >
                          <Icon className="w-3 h-3" />
                          {badgeInfo.label}
                        </span>
                      </td>

                      {/* Nama & Kategori */}
                      <td className="p-3.5 align-top">
                        <div className="font-bold text-navy-text text-sm">
                          {r.nama}
                        </div>
                        {r.kategori && (
                          <span className="text-[11px] text-navy-soft font-medium mt-0.5 block">
                            {r.kategori}
                          </span>
                        )}
                      </td>

                      {/* NPWP / NIK */}
                      <td className="p-3.5 align-top font-mono">
                        {r.npwp ? (
                          <div>
                            <span className="text-[10px] text-navy-soft font-sans font-bold uppercase tracking-wider block">
                              NPWP
                            </span>
                            <span className="font-semibold text-navy-text">
                              {r.npwp}
                            </span>
                          </div>
                        ) : null}
                        {r.nik ? (
                          <div className={r.npwp ? "mt-1.5" : ""}>
                            <span className="text-[10px] text-navy-soft font-sans font-bold uppercase tracking-wider block">
                              NIK
                            </span>
                            <span className="font-semibold text-navy-text">
                              {r.nik}
                            </span>
                          </div>
                        ) : null}
                        {!r.npwp && !r.nik && (
                          <span className="text-muted-faint italic">-</span>
                        )}
                      </td>

                      {/* Rekening Bank */}
                      <td className="p-3.5 align-top">
                        {r.namaBank || r.noRekening ? (
                          <div>
                            <div className="font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                              <CreditCard className="w-3.5 h-3.5" />
                              {r.namaBank || "Bank"}
                            </div>
                            {r.noRekening && (
                              <div className="font-mono text-navy-text font-medium text-[11px] mt-0.5">
                                {r.noRekening}
                              </div>
                            )}
                            {r.atasNamaBank && (
                              <div className="text-[10px] text-navy-soft italic">
                                a.n {r.atasNamaBank}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-faint italic">-</span>
                        )}
                      </td>

                      {/* Kontak & Alamat */}
                      <td className="p-3.5 align-top text-[11px] space-y-0.5">
                        {r.telepon && (
                          <div className="flex items-center gap-1.5 text-navy-text">
                            <Phone className="w-3 h-3 text-navy-soft" />
                            <span>{r.telepon}</span>
                          </div>
                        )}
                        {r.email && (
                          <div className="flex items-center gap-1.5 text-navy-text">
                            <Mail className="w-3 h-3 text-navy-soft" />
                            <span>{r.email}</span>
                          </div>
                        )}
                        {r.alamat && (
                          <div className="flex items-start gap-1.5 text-navy-soft text-[10px] mt-1 max-w-xs">
                            <MapPin className="w-3 h-3 shrink-0 mt-0.5" />
                            <span className="line-clamp-2">{r.alamat}</span>
                          </div>
                        )}
                        {!r.telepon && !r.email && !r.alamat && (
                          <span className="text-muted-faint italic">-</span>
                        )}
                      </td>

                      {/* Aksi */}
                      {canManage && (
                        <td className="p-3.5 pr-4 align-top text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => openEditModal(r)}
                              title="Edit Rekanan"
                              className="p-1.5 text-navy-soft hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors cursor-pointer"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setDeletingRekanan(r);
                                setIsDeleteModalOpen(true);
                              }}
                              title="Hapus Rekanan"
                              className="p-1.5 text-navy-soft hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Tambah / Edit Rekanan */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-surface-card rounded-2xl border border-border-soft shadow-2xl w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-soft bg-surface-subtle/50 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-navy-text">
                    {editingRekanan ? "Edit Rekanan" : "Tambah Rekanan Baru"}
                  </h3>
                  <p className="text-xs text-navy-soft">
                    Data tersimpan terpusat dan akan otomatis muncul saat pengetikan NPWP/NIK.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-navy-soft hover:text-navy-text hover:bg-surface-hover rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 space-y-4 overflow-y-auto flex-1">
                {errorMessage && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Grid 1: Tipe Rekanan & Kategori */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-navy-text mb-1">
                      Tipe Rekanan <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formData.tipe}
                      onChange={(e) =>
                        setFormData({ ...formData, tipe: e.target.value as RekananTipe })
                      }
                      className="w-full px-3 py-2 text-xs border border-border-soft rounded-xl text-navy-text focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                    >
                      <option value={RekananTipe.VENDOR}>Vendor / Supplier</option>
                      <option value={RekananTipe.KLIEN}>Klien / Instansi / Dinas</option>
                      <option value={RekananTipe.TENAGA_AHLI}>Tenaga Ahli</option>
                      <option value={RekananTipe.LAINNYA}>Lainnya</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-navy-text mb-1">
                      Kategori / Spesialisasi
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: Dinas Pemerintah, Supplier Beton, Ahli Struktur"
                      value={formData.kategori}
                      onChange={(e) =>
                        setFormData({ ...formData, kategori: e.target.value })
                      }
                      className="w-full px-3 py-2 text-xs border border-border-soft rounded-xl text-navy-text focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Nama Rekanan */}
                <div>
                  <label className="block text-xs font-semibold text-navy-text mb-1">
                    Nama Rekanan / Instansi / Orang <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Dinas PUPR Prov. Kalteng atau Ir. Budi Santoso"
                    value={formData.nama}
                    onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-medium border border-border-soft rounded-xl text-navy-text focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Grid 2: Identitas Pajak (NPWP & NIK) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-navy-text mb-1">
                      Nomor NPWP
                    </label>
                    <input
                      type="text"
                      placeholder="00.000.000.0-000.000 (15/16 Digit)"
                      value={formData.npwp}
                      onChange={(e) => setFormData({ ...formData, npwp: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-mono border border-border-soft rounded-xl text-navy-text focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-[10px] text-navy-soft mt-0.5 block">
                      Dipakai untuk Auto-Fill form E-Faktur.
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-navy-text mb-1">
                      Nomor Induk Kependudukan (NIK)
                    </label>
                    <input
                      type="text"
                      placeholder="16 Digit NIK KTP"
                      value={formData.nik}
                      onChange={(e) => setFormData({ ...formData, nik: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-mono border border-border-soft rounded-xl text-navy-text focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-[10px] text-navy-soft mt-0.5 block">
                      Khusus perorangan atau tenaga ahli.
                    </span>
                  </div>
                </div>

                {/* Section: Rekening Bank */}
                <div className="p-3.5 bg-surface-subtle/50 rounded-xl border border-border-soft space-y-3">
                  <span className="block text-xs font-bold text-navy-text">
                    Informasi Pembayaran / Rekening Bank Rekanan
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-navy-text mb-1">
                        Nama Bank
                      </label>
                      <input
                        type="text"
                        placeholder="Bank Kalteng, Mandiri, BRI"
                        value={formData.namaBank}
                        onChange={(e) =>
                          setFormData({ ...formData, namaBank: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 text-xs border border-border-soft rounded-lg text-navy-text focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-navy-text mb-1">
                        Nomor Rekening
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: 100.01.00.0123"
                        value={formData.noRekening}
                        onChange={(e) =>
                          setFormData({ ...formData, noRekening: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 text-xs font-mono border border-border-soft rounded-lg text-navy-text focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-navy-text mb-1">
                        Atas Nama Rekening
                      </label>
                      <input
                        type="text"
                        placeholder="Nama pemilik rek."
                        value={formData.atasNamaBank}
                        onChange={(e) =>
                          setFormData({ ...formData, atasNamaBank: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 text-xs border border-border-soft rounded-lg text-navy-text focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Grid 3: Kontak & Alamat */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-navy-text mb-1">
                      Nomor Telepon / WhatsApp
                    </label>
                    <input
                      type="text"
                      placeholder="0812-xxxx-xxxx"
                      value={formData.telepon}
                      onChange={(e) =>
                        setFormData({ ...formData, telepon: e.target.value })
                      }
                      className="w-full px-3 py-2 text-xs border border-border-soft rounded-xl text-navy-text focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-navy-text mb-1">
                      Alamat Email
                    </label>
                    <input
                      type="email"
                      placeholder="rekanan@domain.com"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      className="w-full px-3 py-2 text-xs border border-border-soft rounded-xl text-navy-text focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-navy-text mb-1">
                    Alamat Lengkap Kantor / Domisili
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Jl. Contoh No. 123, Kota..."
                    value={formData.alamat}
                    onChange={(e) => setFormData({ ...formData, alamat: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-border-soft rounded-xl text-navy-text focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border-soft bg-surface-subtle/50 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isPending}
                  className="px-4 py-2 text-xs font-semibold text-navy-soft hover:text-navy-text rounded-xl border border-border-soft transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {isPending ? "Menyimpan..." : "Simpan Rekanan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus */}
      {isDeleteModalOpen && deletingRekanan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-surface-card rounded-2xl border border-border-soft shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-base font-bold text-navy-text mb-2">
              Hapus Data Rekanan?
            </h3>
            <p className="text-xs text-navy-soft mb-4">
              Apakah Anda yakin ingin menghapus <strong>{deletingRekanan.nama}</strong> dari Master Data Rekanan? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={isPending}
                className="px-4 py-2 text-xs font-semibold text-navy-soft hover:text-navy-text rounded-xl border border-border-soft transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isPending}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {isPending ? "Menghapus..." : "Hapus Rekanan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
