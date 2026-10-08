"use client";

import { useState, useTransition, Fragment } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Role } from "@prisma/client";
import {
  Users,
  Award,
  Scale,
  Plus,
  Pencil,
  Trash2,
  FileText,
  Search,
  CheckCircle,
  AlertCircle,
  Calendar,
  Building2,
  DollarSign,
  Download,
  Printer,
  X,
  CreditCard,
  Briefcase,
  ChevronRight,
  ChevronDown,
  Copy,
  HelpCircle,
} from "lucide-react";
import {
  type PegawaiItem,
  type GajiBulananItem,
  type HonorTenagaAhliItem,
  type KonsolidasiTenagaAhliItem,
  type PayrollSyncLabaRugi,
  type RekapBulanPegawaiItem,
  type RekapBulanTenagaAhliItem,
  type RekapTenagaAhliPerNamaItem,
  BULAN_NAMES,
  PTKP_RATES,
} from "@/lib/payroll";
import {
  createPegawaiAction,
  updatePegawaiAction,
  deletePegawaiAction,
  saveGajiBulananAction,
  deleteGajiBulananAction,
  saveHonorTenagaAhliAction,
  deleteHonorTenagaAhliAction,
  copyGajiBulanSebelumnyaAction,
  saveTenagaAhliMasterAction,
  deleteTenagaAhliMasterAction,
} from "@/lib/actions/payroll";
import { formatRupiah } from "@/lib/dashboard-data";

type PayrollData = {
  entity: { id: string; key: string; name: string; legalName: string } | null;
  allEntities: { id: string; key: string; name: string; legalName: string }[];
  projects: { id: string; code: string; name: string }[];
  rekananTenagaAhli: { id: string; nama: string; nik: string | null; npwp: string | null; kategori: string | null }[];
  year: number;
  month: number;
  pegawaiList: PegawaiItem[];
  gajiBulanIni: GajiBulananItem[];
  rekapBulananPegawai: RekapBulanPegawaiItem[];
  summaryBulanIni: {
    totalPegawaiAktif: number;
    totalPegawaiInput: number;
    totalGajiPokok: number;
    totalGajiPokokFmt: string;
    totalTunjanganJabatan: number;
    totalTunjanganJabatanFmt: string;
    totalTunjanganTransport: number;
    totalTunjanganTransportFmt: string;
    totalInsentif: number;
    totalInsentifFmt: string;
    totalBpjsKesehatan: number;
    totalBpjsKesehatanFmt: string;
    totalBpjsKetenagakerjaan: number;
    totalBpjsKetenagakerjaanFmt: string;
    totalPotonganLain: number;
    totalPotonganLainFmt: string;
    totalPph21: number;
    totalPph21Fmt: string;
    totalGajiKotor: number;
    totalGajiKotorFmt: string;
    totalGajiBersih: number;
    totalGajiBersihFmt: string;
  };
  honorList: HonorTenagaAhliItem[];
  rekapBulananTenagaAhli: RekapBulanTenagaAhliItem[];
  rekapTenagaAhliPerNama: RekapTenagaAhliPerNamaItem[];
  summaryHonorBulanIni: {
    totalTransaksi: number;
    totalHonorBruto: number;
    totalHonorBrutoFmt: string;
    totalPph21: number;
    totalPph21Fmt: string;
    totalHonorBersih: number;
    totalHonorBersihFmt: string;
  };
  konsolidasiTenagaAhli: KonsolidasiTenagaAhliItem[];
  syncData: PayrollSyncLabaRugi;
};

export function PayrollClient({
  data,
  userRole,
  initialTab,
  selectedYear,
  selectedMonth,
}: {
  data: PayrollData;
  userRole: Role;
  initialTab: string;
  selectedYear: number;
  selectedMonth: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const isManager =
    userRole === "MANAJER_KEUANGAN" ||
    userRole === "STAF_KEUANGAN" ||
    userRole === "SUPER_ADMIN";

  // Tab utama: "pegawai" | "tenaga-ahli" | "sync"
  const [mainTab, setMainTab] = useState<"pegawai" | "tenaga-ahli" | "sync">(
    (initialTab as "pegawai" | "tenaga-ahli" | "sync") || "pegawai"
  );

  // Sub-tab pegawai: "gaji" (Gaji Per Bulan) | "rekap-bulan" (Rekap Gaji Setahun) | "master" | "tahunan"
  const [pegawaiSubTab, setPegawaiSubTab] = useState<
    "gaji" | "rekap-bulan" | "master" | "tahunan"
  >("gaji");

  // Sub-tab tenaga ahli: "honor" (Honor Per Bulan) | "rekap-bulan" (Rekap Gaji Setahun) | "database-ahli" | "rekap-nama" | "konsolidasi"
  const [tenagaAhliSubTab, setTenagaAhliSubTab] = useState<
    "honor" | "rekap-bulan" | "database-ahli" | "rekap-nama" | "konsolidasi"
  >("honor");

  // Filter entitas untuk tab Cek Per Nama
  const [filterEntitasNama, setFilterEntitasNama] = useState<string>("ALL");

  // State expand rincian per NIK untuk Tenaga Ahli
  const [expandedNik, setExpandedNik] = useState<string | null>(null);

  // Filter search
  const [searchQuery, setSearchQuery] = useState("");

  // Modals state
  const [isPegawaiModalOpen, setIsPegawaiModalOpen] = useState(false);
  const [editingPegawai, setEditingPegawai] = useState<PegawaiItem | null>(null);

  const [isGajiModalOpen, setIsGajiModalOpen] = useState(false);
  const [editingGaji, setEditingGaji] = useState<{
    pegawai: PegawaiItem;
    gaji?: GajiBulananItem | null;
  } | null>(null);

  const [isHonorModalOpen, setIsHonorModalOpen] = useState(false);
  const [editingHonor, setEditingHonor] = useState<HonorTenagaAhliItem | null>(null);

  // Master Tenaga Ahli Modal
  const [isMasterAhliModalOpen, setIsMasterAhliModalOpen] = useState(false);
  const [editingMasterAhli, setEditingMasterAhli] = useState<{
    id?: string;
    nama: string;
    nik: string | null;
    npwp: string | null;
    kategori: string | null;
  } | null>(null);

  // State selection di modal honor
  const [selectedRekananIdForHonor, setSelectedRekananIdForHonor] = useState<string>("");

  const [slipModalItem, setSlipModalItem] = useState<GajiBulananItem | null>(null);

  // Toast / Error state
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  function handleMonthChange(newMonth: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", newMonth.toString());
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleTabChange(tab: "pegawai" | "tenaga-ahli" | "sync") {
    setMainTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.push(`${pathname}?${params.toString()}`);
  }

  // Filter items based on query
  const filteredPegawaiList = data.pegawaiList.filter(
    (p) =>
      p.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.nik.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.jabatan.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredHonorList = data.honorList.filter(
    (h) =>
      h.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.nik.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.uraian.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredKonsolidasi = data.konsolidasiTenagaAhli.filter(
    (k) =>
      k.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
      k.nik.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredRekapPerNama = data.rekapTenagaAhliPerNama.filter((k) => {
    const matchSearch =
      k.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
      k.nik.toLowerCase().includes(searchQuery.toLowerCase()) ||
      k.daftarProyek.some((p) => p.toLowerCase().includes(searchQuery.toLowerCase())) ||
      k.daftarEntitas.some((e) => e.toLowerCase().includes(searchQuery.toLowerCase())) ||
      k.daftarBulan.some((b) => b.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchEntitas =
      filterEntitasNama === "ALL" || k.daftarEntitas.includes(filterEntitasNama);

    return matchSearch && matchEntitas;
  });

  const filteredRekananList = data.rekananTenagaAhli.filter(
    (r) =>
      r.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.nik && r.nik.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (r.kategori && r.kategori.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Notifications */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="p-1 hover:opacity-75">
            <X size={14} />
          </button>
        </div>
      )}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <CheckCircle size={16} />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="p-1 hover:opacity-75">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Main Tabs Navigation */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-border pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleTabChange("pegawai")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer ${
              mainTab === "pegawai"
                ? "bg-navy text-white shadow-sm"
                : "bg-surface-subtle text-muted-stronger hover:bg-surface-hover"
            }`}
          >
            <Users size={15} />
            <span>Pegawai Tetap</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-white/20">
              {data.pegawaiList.length}
            </span>
          </button>

          <button
            onClick={() => handleTabChange("tenaga-ahli")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer ${
              mainTab === "tenaga-ahli"
                ? "bg-navy text-white shadow-sm"
                : "bg-surface-subtle text-muted-stronger hover:bg-surface-hover"
            }`}
          >
            <Award size={15} />
            <span>Tenaga Ahli (Bukan Pegawai)</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-white/20">
              {data.konsolidasiTenagaAhli.length}
            </span>
          </button>

          <button
            onClick={() => handleTabChange("sync")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer ${
              mainTab === "sync"
                ? "bg-navy text-white shadow-sm"
                : "bg-surface-subtle text-muted-stronger hover:bg-surface-hover"
            }`}
          >
            <Scale size={15} />
            <span>Sinkronisasi Laba Rugi</span>
            {data.syncData.isOverallSinkron ? (
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            )}
          </button>
        </div>

        {/* Month Selector Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto self-start sm:self-auto">
          <span className="text-[11px] text-muted-faint mr-1 flex items-center gap-1">
            <Calendar size={12} /> Bulan:
          </span>
          <select
            value={selectedMonth}
            onChange={(e) => handleMonthChange(Number(e.target.value))}
            className="h-8 text-xs font-semibold px-2.5 rounded-lg border border-border bg-surface-card text-navy-text cursor-pointer"
          >
            {BULAN_NAMES.map((name, idx) => (
              <option key={idx + 1} value={idx + 1}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: PEGAWAI TETAP */}
      {/* ========================================================= */}
      {mainTab === "pegawai" && (
        <div className="space-y-6">
          {/* Sub-Tabs Pegawai */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5 bg-surface-subtle p-1 rounded-xl border border-border/60">
              <button
                onClick={() => setPegawaiSubTab("gaji")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                  pegawaiSubTab === "gaji"
                    ? "bg-surface-card text-navy-text shadow-2xs font-bold"
                    : "text-muted-faint hover:text-navy-text hover:bg-surface-card/50"
                }`}
              >
                <CreditCard size={13} className={pegawaiSubTab === "gaji" ? "text-navy" : "text-muted-faint"} />
                <span>Gaji Bulanan</span>
                <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                  pegawaiSubTab === "gaji" ? "bg-navy/10 text-navy font-bold" : "bg-surface-card text-muted-faint"
                }`}>
                  {BULAN_NAMES[selectedMonth - 1]}
                </span>
              </button>

              <button
                onClick={() => setPegawaiSubTab("rekap-bulan")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                  pegawaiSubTab === "rekap-bulan"
                    ? "bg-surface-card text-navy-text shadow-2xs font-bold"
                    : "text-muted-faint hover:text-navy-text hover:bg-surface-card/50"
                }`}
              >
                <Calendar size={13} className={pegawaiSubTab === "rekap-bulan" ? "text-navy" : "text-muted-faint"} />
                <span>Rekap Setahun</span>
                <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                  pegawaiSubTab === "rekap-bulan" ? "bg-navy/10 text-navy font-bold" : "bg-surface-card text-muted-faint"
                }`}>
                  {selectedYear}
                </span>
              </button>

              <button
                onClick={() => setPegawaiSubTab("master")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                  pegawaiSubTab === "master"
                    ? "bg-surface-card text-navy-text shadow-2xs font-bold"
                    : "text-muted-faint hover:text-navy-text hover:bg-surface-card/50"
                }`}
              >
                <Users size={13} className={pegawaiSubTab === "master" ? "text-navy" : "text-muted-faint"} />
                <span>Database Pegawai Tetap</span>
                <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                  pegawaiSubTab === "master" ? "bg-navy/10 text-navy font-bold" : "bg-surface-card text-muted-faint"
                }`}>
                  {data.pegawaiList.length}
                </span>
              </button>

              <button
                onClick={() => setPegawaiSubTab("tahunan")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                  pegawaiSubTab === "tahunan"
                    ? "bg-surface-card text-navy-text shadow-2xs font-bold"
                    : "text-muted-faint hover:text-navy-text hover:bg-surface-card/50"
                }`}
              >
                <Briefcase size={13} className={pegawaiSubTab === "tahunan" ? "text-navy" : "text-muted-faint"} />
                <span>Akumulasi Pegawai</span>
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <div className="relative flex-1 sm:w-60">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-faint"
                />
                <input
                  type="text"
                  placeholder="Cari NIK / Nama / Jabatan..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 w-full pl-8 pr-3 text-xs rounded-xl border border-border bg-surface-card text-foreground"
                />
              </div>

              {isManager && (
                <div>
                  {pegawaiSubTab === "master" ? (
                    <button
                      onClick={() => {
                        setEditingPegawai(null);
                        setIsPegawaiModalOpen(true);
                      }}
                      className="h-8 px-3 rounded-xl bg-navy text-white text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-navy-light transition-colors whitespace-nowrap cursor-pointer shadow-2xs"
                    >
                      <Plus size={14} />
                      <span>Tambah Pegawai Baru</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        const targetPegawai = data.pegawaiList.find((p) => !p.currentGaji) || data.pegawaiList[0];
                        if (targetPegawai) {
                          setEditingGaji({ pegawai: targetPegawai, gaji: targetPegawai.currentGaji });
                          setIsGajiModalOpen(true);
                        } else {
                          setErrorMsg("Belum ada pegawai terdaftar di entitas ini. Silakan tambahkan pegawai terlebih dahulu.");
                        }
                      }}
                      className="h-8 px-3 rounded-xl bg-navy text-white text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-navy-light transition-colors whitespace-nowrap cursor-pointer shadow-2xs"
                    >
                      <Plus size={14} />
                      <span>Input Gaji Pegawai</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Stat Cards Pegawai */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            <div className="p-4 rounded-2xl border border-border bg-surface-card">
              <div className="text-[11px] font-medium text-muted-faint">
                Pegawai Terdaftar ({BULAN_NAMES[selectedMonth - 1]})
              </div>
              <div className="text-xl font-bold font-mono text-navy-text mt-1">
                {data.summaryBulanIni.totalPegawaiInput} / {data.summaryBulanIni.totalPegawaiAktif}
              </div>
              <div className="text-[10px] text-muted-faint mt-1">
                Sudah diinput dari total aktif
              </div>
            </div>

            <div className="p-4 rounded-2xl border border-border bg-surface-card">
              <div className="text-[11px] font-medium text-muted-faint">
                Gaji Pokok Total
              </div>
              <div className="text-xl font-bold font-mono text-navy-text mt-1">
                {data.summaryBulanIni.totalGajiPokokFmt}
              </div>
              <div className="text-[10px] text-muted-faint mt-1">
                Gaji pokok bulan {BULAN_NAMES[selectedMonth - 1]}
              </div>
            </div>

            <div className="p-4 rounded-2xl border border-border bg-surface-card">
              <div className="text-[11px] font-medium text-muted-faint">
                Tunjangan & Insentif
              </div>
              <div className="text-xl font-bold font-mono text-amber-700 dark:text-amber-300 mt-1">
                {formatRupiah(
                  data.summaryBulanIni.totalTunjanganJabatan +
                    data.summaryBulanIni.totalTunjanganTransport +
                    data.summaryBulanIni.totalInsentif
                )}
              </div>
              <div className="text-[10px] text-muted-faint mt-1">
                Jabatan, transport, dan insentif
              </div>
            </div>

            <div className="p-4 rounded-2xl border border-border bg-surface-card">
              <div className="text-[11px] font-medium text-muted-faint">
                Total Gaji Bersih (THP)
              </div>
              <div className="text-xl font-bold font-mono text-emerald-700 dark:text-emerald-300 mt-1">
                {data.summaryBulanIni.totalGajiBersihFmt}
              </div>
              <div className="text-[10px] text-muted-faint mt-1">
                Total ditransfer ke rekening pegawai
              </div>
            </div>
          </div>

          {/* Sub-Tab Content 1: Gaji Bulanan */}
          {pegawaiSubTab === "gaji" && (
            <div className="rounded-2xl border border-border bg-surface-card overflow-hidden">
              <div className="p-4 border-b border-border flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-sm font-bold text-navy-text">
                    Daftar Gaji Pegawai Tetap – Periode {BULAN_NAMES[selectedMonth - 1]} {selectedYear}
                  </h3>
                  <p className="text-xs text-muted-faint">
                    Entitas: {data.entity?.name} · Masukkan atau sesuaikan komponen tunjangan, insentif, dan potongan
                  </p>
                </div>

                {isManager && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const targetPegawai = data.pegawaiList.find((p) => !p.currentGaji) || data.pegawaiList[0];
                        if (targetPegawai) {
                          setEditingGaji({ pegawai: targetPegawai, gaji: targetPegawai.currentGaji });
                          setIsGajiModalOpen(true);
                        } else {
                          setErrorMsg("Belum ada pegawai terdaftar di entitas ini. Silakan tambahkan pegawai terlebih dahulu.");
                        }
                      }}
                      className="h-8 px-3 rounded-xl bg-navy text-white text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-navy-light transition-colors whitespace-nowrap cursor-pointer shadow-2xs"
                    >
                      <Plus size={14} />
                      <span>Input Gaji Pegawai</span>
                    </button>
                    <button
                      onClick={() => {
                        if (
                          confirm(
                            `Salin atau generate otomatis data gaji seluruh pegawai aktif untuk bulan ${BULAN_NAMES[selectedMonth - 1]} ${selectedYear}?`
                          )
                        ) {
                          startTransition(async () => {
                            try {
                              const res = await copyGajiBulanSebelumnyaAction(
                                data.entity?.id ?? "",
                                selectedYear,
                                selectedMonth
                              );
                              setSuccessMsg(res.message);
                              router.refresh();
                            } catch (err: unknown) {
                              setErrorMsg((err as Error).message);
                            }
                          });
                        }
                      }}
                      className="h-8 px-3 rounded-xl border border-border bg-surface-subtle hover:bg-surface-hover text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer text-navy-text shadow-2xs"
                      title="Salin data gaji dari bulan lalu atau buat otomatis dari master gaji pokok"
                    >
                      <Copy size={13} />
                      <span>Salin / Generate dari Bulan Lalu</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[960px] text-left text-xs">
                  <thead className="bg-surface-subtle border-b border-border text-muted-stronger font-bold">
                    <tr>
                      <th className="py-2.5 px-3.5">Pegawai</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[110px]">Gaji Pokok</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[100px]">Tunj. Jabatan</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[100px]">Tunj. Transport</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[90px]">Insentif</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[110px]">Total Kotor</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[90px]">BPJS</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[80px]">PPh 21</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[120px]">Net (THP)</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[130px]">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredPegawaiList.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-muted-faint">
                          Belum ada pegawai terdaftar pada entitas ini. Silakan klik "Tambah Pegawai".
                        </td>
                      </tr>
                    ) : (
                      filteredPegawaiList.map((p) => {
                        const gaji = p.currentGaji;
                        const isInputted = !!gaji;
                        return (
                          <tr key={p.id} className="hover:bg-surface-hover/30 transition-colors">
                            <td className="py-3 px-3.5">
                              <div className="font-bold text-navy-text text-sm">{p.nama}</div>
                              <div className="text-[11px] text-muted-faint mt-0.5 flex items-center gap-1.5 flex-wrap">
                                <span className="font-mono">{p.nik}</span>
                                <span>·</span>
                                <span>{p.jabatan}</span>
                                <span>·</span>
                                <span className="px-1.5 py-0.2 rounded bg-surface-subtle font-mono text-[10px]">
                                  {p.statusKeluarga}
                                </span>
                              </div>
                            </td>

                            <td className="py-3 px-3.5 text-right font-mono text-navy-text whitespace-nowrap">
                              {gaji ? gaji.gajiPokokFmt : p.gajiPokokFmt}
                            </td>

                            <td className="py-3 px-3.5 text-right font-mono text-muted-stronger whitespace-nowrap">
                              {gaji ? gaji.tunjanganJabatanFmt : "Rp 0"}
                            </td>

                            <td className="py-3 px-3.5 text-right font-mono text-muted-stronger whitespace-nowrap">
                              {gaji ? gaji.tunjanganTransportFmt : "Rp 0"}
                            </td>

                            <td className="py-3 px-3.5 text-right font-mono text-muted-stronger whitespace-nowrap">
                              {gaji ? gaji.insentifFmt : "Rp 0"}
                            </td>

                            <td className="py-3 px-3.5 text-right font-mono font-bold text-navy-text whitespace-nowrap">
                              {gaji ? gaji.totalGajiKotorFmt : p.gajiPokokFmt}
                            </td>

                            <td className="py-3 px-3.5 text-right font-mono text-rose-700 dark:text-rose-300 whitespace-nowrap">
                              {gaji
                                ? formatRupiah(gaji.bpjsKesehatan + gaji.bpjsKetenagakerjaan)
                                : "Rp 0"}
                            </td>

                            <td className="py-3 px-3.5 text-right font-mono text-amber-700 dark:text-amber-300 whitespace-nowrap">
                              {gaji ? gaji.pph21Fmt : "Rp 0"}
                            </td>

                            <td className="py-3 px-3.5 text-right font-mono font-bold text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
                              {gaji ? gaji.totalGajiBersihFmt : p.gajiPokokFmt}
                            </td>

                            <td className="py-3 px-3.5 text-right whitespace-nowrap">
                              <div className="inline-flex items-center justify-end gap-1.5">
                                {isManager && (
                                  <button
                                    onClick={() => {
                                      setEditingGaji({ pegawai: p, gaji });
                                      setIsGajiModalOpen(true);
                                    }}
                                    className="h-7 px-2.5 rounded-lg border border-border bg-surface-subtle hover:bg-surface-hover text-[11px] font-semibold text-navy-text inline-flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                                    title="Input / Edit Komponen Gaji Bulan Ini"
                                  >
                                    <Pencil size={11} />
                                    <span>{isInputted ? "Edit Gaji" : "Input Gaji"}</span>
                                  </button>
                                )}

                                {gaji && (
                                  <button
                                    onClick={() => setSlipModalItem(gaji)}
                                    className="h-7 px-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/80 dark:bg-blue-950/40 text-[11px] font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100 transition-colors cursor-pointer shadow-2xs"
                                    title="Lihat Slip Gaji"
                                  >
                                    <FileText size={12} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  {data.pegawaiList.length > 0 && (
                    <tfoot className="bg-surface-subtle border-t border-border font-bold text-xs">
                      <tr>
                        <td className="py-3 px-3.5 text-navy-text whitespace-nowrap">
                          Total ({data.summaryBulanIni.totalPegawaiInput} Pegawai Terinput):
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono text-navy-text whitespace-nowrap">
                          {data.summaryBulanIni.totalGajiPokokFmt}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono whitespace-nowrap">
                          {data.summaryBulanIni.totalTunjanganJabatanFmt}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono whitespace-nowrap">
                          {data.summaryBulanIni.totalTunjanganTransportFmt}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono whitespace-nowrap">
                          {data.summaryBulanIni.totalInsentifFmt}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono text-navy-text whitespace-nowrap">
                          {data.summaryBulanIni.totalGajiKotorFmt}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono text-rose-700 dark:text-rose-300 whitespace-nowrap">
                          {formatRupiah(
                            data.summaryBulanIni.totalBpjsKesehatan +
                              data.summaryBulanIni.totalBpjsKetenagakerjaan
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono text-amber-700 dark:text-amber-300 whitespace-nowrap">
                          {data.summaryBulanIni.totalPph21Fmt}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
                          {data.summaryBulanIni.totalGajiBersihFmt}
                        </td>
                        <td className="py-3 px-3.5" />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {/* Sub-Tab Content 2: Rekapitulasi Per Bulan Pegawai Tetap (Jan - Des) */}
          {pegawaiSubTab === "rekap-bulan" && (
            <div className="rounded-2xl border border-border bg-surface-card overflow-hidden">
              <div className="p-4 border-b border-border flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-sm font-bold text-navy-text">
                    Rekapitulasi Penggajian Pegawai Tetap Per Bulan – Tahun {selectedYear}
                  </h3>
                  <p className="text-xs text-muted-faint">
                    Ringkasan total beban gaji kotor, potongan BPJS, PPh 21, dan total gaji bersih selama 12 bulan (Entitas: {data.entity?.name})
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-left text-xs">
                  <thead className="bg-surface-subtle border-b border-border text-muted-stronger font-bold">
                    <tr>
                      <th className="py-2.5 px-3.5">Bulan</th>
                      <th className="py-2.5 px-3.5 text-center">Jml Pegawai</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[110px]">Gaji Pokok</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[100px]">Tunjangan</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[90px]">Insentif</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[120px]">Total Kotor</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[90px]">BPJS</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[90px]">PPh 21</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[120px]">Net (THP)</th>
                      <th className="py-2.5 px-3.5 text-center whitespace-nowrap">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.rekapBulananPegawai.map((r) => (
                      <tr
                        key={r.bulan}
                        className={`hover:bg-surface-hover/30 transition-colors ${
                          r.bulan === selectedMonth ? "bg-navy/5 font-medium" : ""
                        }`}
                      >
                        <td className="py-3 px-3.5">
                          <div className="font-bold text-navy-text flex items-center gap-1.5">
                            <span>{r.bulanName}</span>
                            {r.bulan === selectedMonth && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-navy text-white font-semibold">
                                Aktif
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3.5 text-center font-mono">
                          {r.totalPegawai > 0 ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[11px]">
                              {r.totalPegawai} orang
                            </span>
                          ) : (
                            <span className="text-muted-faint text-[11px]">-</span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono text-navy-text whitespace-nowrap">
                          {r.totalGajiPokokFmt}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono text-muted-stronger whitespace-nowrap">
                          {r.totalTunjanganFmt}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono text-muted-stronger whitespace-nowrap">
                          {r.totalInsentifFmt}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono font-bold text-navy-text whitespace-nowrap">
                          {r.totalGajiKotorFmt}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono text-rose-700 dark:text-rose-300 whitespace-nowrap">
                          {r.totalBpjsFmt}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono text-amber-700 dark:text-amber-300 whitespace-nowrap">
                          {r.totalPph21Fmt}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono font-bold text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
                          {r.totalGajiBersihFmt}
                        </td>
                        <td className="py-3 px-3.5 text-center whitespace-nowrap">
                          <button
                            onClick={() => {
                              handleMonthChange(r.bulan);
                              setPegawaiSubTab("gaji");
                            }}
                            className="h-7 px-2.5 rounded-lg border border-border bg-surface-subtle hover:bg-surface-hover text-[11px] font-semibold text-navy-text inline-flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                          >
                            <span>Input / Lihat Bulan Ini</span>
                            <ChevronRight size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-surface-subtle border-t-2 border-border font-bold text-xs">
                    <tr>
                      <td className="py-3 px-3.5 text-navy-text">Grand Total (12 Bulan):</td>
                      <td className="py-3 px-3.5 text-center font-mono">
                        {data.rekapBulananPegawai.reduce((s, r) => s + r.totalPegawai, 0)} total
                      </td>
                      <td className="py-3 px-3.5 text-right font-mono text-navy-text whitespace-nowrap">
                        {formatRupiah(
                          data.rekapBulananPegawai.reduce((s, r) => s + r.totalGajiPokok, 0)
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-right font-mono text-muted-stronger whitespace-nowrap">
                        {formatRupiah(
                          data.rekapBulananPegawai.reduce((s, r) => s + r.totalTunjangan, 0)
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-right font-mono text-muted-stronger whitespace-nowrap">
                        {formatRupiah(
                          data.rekapBulananPegawai.reduce((s, r) => s + r.totalInsentif, 0)
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-right font-mono font-bold text-navy-text whitespace-nowrap">
                        {formatRupiah(
                          data.rekapBulananPegawai.reduce((s, r) => s + r.totalGajiKotor, 0)
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-right font-mono text-rose-700 dark:text-rose-300 whitespace-nowrap">
                        {formatRupiah(
                          data.rekapBulananPegawai.reduce((s, r) => s + r.totalBpjs, 0)
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-right font-mono text-amber-700 dark:text-amber-300 whitespace-nowrap">
                        {formatRupiah(
                          data.rekapBulananPegawai.reduce((s, r) => s + r.totalPph21, 0)
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-right font-mono font-bold text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
                        {formatRupiah(
                          data.rekapBulananPegawai.reduce((s, r) => s + r.totalGajiBersih, 0)
                        )}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Sub-Tab Content 2: Master Database Karyawan */}
          {pegawaiSubTab === "master" && (
            <div className="rounded-2xl border border-border bg-surface-card overflow-hidden">
              <div className="p-4 border-b border-border flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-sm font-bold text-navy-text flex items-center gap-2">
                    <Users size={16} className="text-navy" />
                    <span>Database Pegawai Tetap (Master Karyawan)</span>
                  </h3>
                  <p className="text-xs text-muted-faint mt-0.5">
                    Daftar profil seluruh pegawai tetap. NIK dan gaji pokok didaftarkan sekali di sini, sehingga saat input gaji bulanan cukup memilih nama dari daftar.
                  </p>
                </div>

                {isManager && (
                  <button
                    onClick={() => {
                      setEditingPegawai(null);
                      setIsPegawaiModalOpen(true);
                    }}
                    className="h-8 px-3 rounded-xl bg-navy text-white text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-navy-light transition-colors whitespace-nowrap cursor-pointer shadow-2xs"
                  >
                    <Plus size={14} />
                    <span>Tambah Pegawai Baru</span>
                  </button>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-xs">
                  <thead className="bg-surface-subtle border-b border-border text-muted-stronger font-bold">
                    <tr>
                      <th className="py-2.5 px-3.5">NIK / Kode</th>
                      <th className="py-2.5 px-3.5">Nama Pegawai</th>
                      <th className="py-2.5 px-3.5">Jabatan</th>
                      <th className="py-2.5 px-3.5">Status PTKP</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap">PTKP Tahunan</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap">Gaji Pokok Standar</th>
                      <th className="py-2.5 px-3.5 text-center">Status</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredPegawaiList.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-muted-faint">
                          Tidak ada data karyawan ditemukan.
                        </td>
                      </tr>
                    ) : (
                      filteredPegawaiList.map((p) => (
                        <tr key={p.id} className="hover:bg-surface-hover/30 transition-colors">
                          <td className="py-3 px-3.5 font-mono font-semibold text-navy-text">
                            {p.nik}
                          </td>
                          <td className="py-3 px-3.5 font-bold text-navy-text">
                            {p.nama}
                          </td>
                          <td className="py-3 px-3.5 text-muted-stronger">
                            {p.jabatan}
                          </td>
                          <td className="py-3 px-3.5">
                            <span className="px-2 py-0.5 rounded-full bg-surface-subtle font-mono text-[11px] font-semibold">
                              {p.statusKeluarga}
                            </span>
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono text-muted-stronger">
                            {p.ptkpFmt}
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono font-bold text-navy-text">
                            {p.gajiPokokFmt}
                          </td>
                          <td className="py-3 px-3.5 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                p.isActive
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : "bg-surface-subtle text-muted-faint"
                              }`}
                            >
                              {p.isActive ? "Aktif" : "Non-Aktif"}
                            </span>
                          </td>
                          <td className="py-3 px-3.5 text-right whitespace-nowrap">
                            {isManager && (
                              <div className="inline-flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => {
                                    setEditingPegawai(p);
                                    setIsPegawaiModalOpen(true);
                                  }}
                                  className="h-7 px-2.5 rounded-lg border border-border bg-surface-subtle hover:bg-surface-hover text-[11px] font-semibold text-navy-text inline-flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                                >
                                  <Pencil size={11} />
                                  <span>Edit</span>
                                </button>
                                <button
                                  onClick={() => {
                                    if (confirm(`Hapus pegawai ${p.nama} (${p.nik})?`)) {
                                      startTransition(async () => {
                                        try {
                                          await deletePegawaiAction(p.id);
                                          setSuccessMsg(`Pegawai ${p.nama} berhasil dihapus.`);
                                          router.refresh();
                                        } catch (e: unknown) {
                                          setErrorMsg((e as Error).message);
                                        }
                                      });
                                    }
                                  }}
                                  className="h-7 px-2 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer shadow-2xs"
                                  title="Hapus Pegawai"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sub-Tab Content 3: Rekapitulasi Tahunan */}
          {pegawaiSubTab === "tahunan" && (
            <div className="rounded-2xl border border-border bg-surface-card overflow-hidden">
              <div className="p-4 border-b border-border flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-sm font-bold text-navy-text">
                    Akumulasi Penghasilan & Pajak Pegawai Tetap – Tahun {selectedYear}
                  </h3>
                  <p className="text-xs text-muted-faint">
                    Ringkasan akumulasi seluruh pembayaran gaji 12 bulan per karyawan untuk persiapan SPT Tahunan 1721-A1
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-xs">
                  <thead className="bg-surface-subtle border-b border-border text-muted-stronger font-bold">
                    <tr>
                      <th className="py-2.5 px-3.5">Pegawai</th>
                      <th className="py-2.5 px-3.5">Status PTKP</th>
                      <th className="py-2.5 px-3.5 text-center whitespace-nowrap">Bulan Dibayar</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap">Akumulasi Gaji Bruto</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap">Akumulasi PPh 21</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap">Akumulasi Net (THP)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredPegawaiList.map((p) => {
                      const ak = p.akumulasiTahun;
                      return (
                        <tr key={p.id} className="hover:bg-surface-hover/30 transition-colors">
                          <td className="py-3 px-3.5">
                            <div className="font-bold text-navy-text">{p.nama}</div>
                            <div className="text-[11px] text-muted-faint font-mono mt-0.5">
                              {p.nik} · {p.jabatan}
                            </div>
                          </td>
                          <td className="py-3 px-3.5">
                            <span className="px-2 py-0.5 rounded-full bg-surface-subtle font-mono text-[11px] font-semibold">
                              {p.statusKeluarga}
                            </span>
                          </td>
                          <td className="py-3 px-3.5 text-center font-mono font-bold text-navy-text">
                            {ak?.bulanTerbayar ?? 0} / 12 Bulan
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono font-bold text-navy-text">
                            {formatRupiah(ak?.totalGajiKotor ?? 0)}
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono text-amber-700 dark:text-amber-300">
                            {formatRupiah(ak?.totalPph21 ?? 0)}
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono font-bold text-emerald-700 dark:text-emerald-300">
                            {formatRupiah(ak?.totalGajiBersih ?? 0)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: TENAGA AHLI / BUKAN PEGAWAI */}
      {/* ========================================================= */}
      {mainTab === "tenaga-ahli" && (
        <div className="space-y-6">
          {/* Sub-Tabs Tenaga Ahli */}
          <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5 bg-surface-subtle p-1 rounded-xl border border-border/60">
              <button
                onClick={() => setTenagaAhliSubTab("honor")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                  tenagaAhliSubTab === "honor"
                    ? "bg-surface-card text-navy-text shadow-2xs font-bold"
                    : "text-muted-faint hover:text-navy-text hover:bg-surface-card/50"
                }`}
              >
                <CreditCard size={13} className={tenagaAhliSubTab === "honor" ? "text-navy" : "text-muted-faint"} />
                <span>Gaji Bulanan</span>
                <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                  tenagaAhliSubTab === "honor" ? "bg-navy/10 text-navy font-bold" : "bg-surface-card text-muted-faint"
                }`}>
                  {BULAN_NAMES[selectedMonth - 1]}
                </span>
              </button>

              <button
                onClick={() => setTenagaAhliSubTab("rekap-bulan")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                  tenagaAhliSubTab === "rekap-bulan"
                    ? "bg-surface-card text-navy-text shadow-2xs font-bold"
                    : "text-muted-faint hover:text-navy-text hover:bg-surface-card/50"
                }`}
              >
                <Calendar size={13} className={tenagaAhliSubTab === "rekap-bulan" ? "text-navy" : "text-muted-faint"} />
                <span>Rekap Setahun</span>
                <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                  tenagaAhliSubTab === "rekap-bulan" ? "bg-navy/10 text-navy font-bold" : "bg-surface-card text-muted-faint"
                }`}>
                  {selectedYear}
                </span>
              </button>

              <button
                onClick={() => setTenagaAhliSubTab("database-ahli")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                  tenagaAhliSubTab === "database-ahli"
                    ? "bg-surface-card text-navy-text shadow-2xs font-bold"
                    : "text-muted-faint hover:text-navy-text hover:bg-surface-card/50"
                }`}
              >
                <Users size={13} className={tenagaAhliSubTab === "database-ahli" ? "text-navy" : "text-muted-faint"} />
                <span>Database Tenaga Ahli</span>
                <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                  tenagaAhliSubTab === "database-ahli" ? "bg-navy/10 text-navy font-bold" : "bg-surface-card text-muted-faint"
                }`}>
                  {data.rekananTenagaAhli.length}
                </span>
              </button>

              <button
                onClick={() => setTenagaAhliSubTab("rekap-nama")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                  tenagaAhliSubTab === "rekap-nama"
                    ? "bg-surface-card text-navy-text shadow-2xs font-bold"
                    : "text-muted-faint hover:text-navy-text hover:bg-surface-card/50"
                }`}
              >
                <Award size={13} className={tenagaAhliSubTab === "rekap-nama" ? "text-navy" : "text-muted-faint"} />
                <span>Cek Per Nama (NIK)</span>
                <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                  tenagaAhliSubTab === "rekap-nama" ? "bg-navy/10 text-navy font-bold" : "bg-surface-card text-muted-faint"
                }`}>
                  {data.rekapTenagaAhliPerNama.length}
                </span>
              </button>

              <button
                onClick={() => setTenagaAhliSubTab("konsolidasi")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                  tenagaAhliSubTab === "konsolidasi"
                    ? "bg-surface-card text-navy-text shadow-2xs font-bold"
                    : "text-muted-faint hover:text-navy-text hover:bg-surface-card/50"
                }`}
              >
                <Building2 size={13} className={tenagaAhliSubTab === "konsolidasi" ? "text-navy" : "text-muted-faint"} />
                <span>Konsolidasi Holding</span>
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <div className="relative flex-1 sm:w-60">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-faint"
                />
                <input
                  type="text"
                  placeholder="Cari Tenaga Ahli / NIK / Tugas..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 w-full pl-8 pr-3 text-xs rounded-xl border border-border bg-surface-card text-foreground"
                />
              </div>

              {isManager && (
                <div>
                  {tenagaAhliSubTab === "database-ahli" ? (
                    <button
                      onClick={() => {
                        setEditingMasterAhli(null);
                        setIsMasterAhliModalOpen(true);
                      }}
                      className="h-8 px-3 rounded-xl bg-navy text-white text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-navy-light transition-colors whitespace-nowrap cursor-pointer shadow-2xs"
                    >
                      <Plus size={14} />
                      <span>Tambah Tenaga Ahli Baru</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingHonor(null);
                        if (data.rekananTenagaAhli.length > 0 && !selectedRekananIdForHonor) {
                          setSelectedRekananIdForHonor(data.rekananTenagaAhli[0].id);
                        }
                        setIsHonorModalOpen(true);
                      }}
                      className="h-8 px-3 rounded-xl bg-navy text-white text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-navy-light transition-colors whitespace-nowrap cursor-pointer shadow-2xs"
                    >
                      <Plus size={14} />
                      <span>Input Gaji Tenaga Ahli</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Stat Cards Tenaga Ahli */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            <div className="p-4 rounded-2xl border border-border bg-surface-card">
              <div className="text-[11px] font-medium text-muted-faint">
                Transaksi Gaji Bulan Ini
              </div>
              <div className="text-xl font-bold font-mono text-navy-text mt-1">
                {data.summaryHonorBulanIni.totalTransaksi} Pembayaran
              </div>
              <div className="text-[10px] text-muted-faint mt-1">
                Bulan {BULAN_NAMES[selectedMonth - 1]} {selectedYear}
              </div>
            </div>

            <div className="p-4 rounded-2xl border border-border bg-surface-card">
              <div className="text-[11px] font-medium text-muted-faint">
                Total Gaji Tenaga Ahli
              </div>
              <div className="text-xl font-bold font-mono text-navy-text mt-1">
                {data.summaryHonorBulanIni.totalHonorBrutoFmt}
              </div>
              <div className="text-[10px] text-muted-faint mt-1">
                Beban gaji bulan {BULAN_NAMES[selectedMonth - 1]}
              </div>
            </div>

            <div className="p-4 rounded-2xl border border-border bg-surface-card">
              <div className="text-[11px] font-medium text-muted-faint">
                Tenaga Ahli Terbayar
              </div>
              <div className="text-xl font-bold font-mono text-navy-text mt-1">
                {new Set(data.honorList.map((h) => h.nik)).size} Orang
              </div>
              <div className="text-[10px] text-muted-faint mt-1">
                Tenaga ahli aktif bulan ini
              </div>
            </div>

            <div className="p-4 rounded-2xl border border-border bg-surface-card">
              <div className="text-[11px] font-medium text-muted-faint">
                Database Tenaga Ahli
              </div>
              <div className="text-xl font-bold font-mono text-emerald-700 dark:text-emerald-300 mt-1">
                {data.rekananTenagaAhli.length} Terdaftar
              </div>
              <div className="text-[10px] text-muted-faint mt-1">
                Profil tersimpan di holding
              </div>
            </div>
          </div>

          {/* Sub-Tab 1: Gaji Bulanan Tenaga Ahli */}
          {tenagaAhliSubTab === "honor" && (
            <div className="rounded-2xl border border-border bg-surface-card overflow-hidden">
              <div className="p-4 border-b border-border flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-sm font-bold text-navy-text">
                    Daftar Gaji Tenaga Ahli – Periode {BULAN_NAMES[selectedMonth - 1]} {selectedYear}
                  </h3>
                  <p className="text-xs text-muted-faint">
                    Entitas: {data.entity?.name} · Pencatatan pembayaran gaji tenaga ahli lepas
                  </p>
                </div>

                {isManager && (
                  <button
                    onClick={() => {
                      setEditingHonor(null);
                      if (data.rekananTenagaAhli.length > 0 && !selectedRekananIdForHonor) {
                        setSelectedRekananIdForHonor(data.rekananTenagaAhli[0].id);
                      }
                      setIsHonorModalOpen(true);
                    }}
                    className="h-8 px-3 rounded-xl bg-navy text-white text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-navy-light transition-colors whitespace-nowrap cursor-pointer shadow-2xs"
                  >
                    <Plus size={14} />
                    <span>Input Gaji Tenaga Ahli</span>
                  </button>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-left text-xs">
                  <thead className="bg-surface-subtle border-b border-border text-muted-stronger font-bold">
                    <tr>
                      <th className="py-2.5 px-3.5">Tanggal & Bukti</th>
                      <th className="py-2.5 px-3.5">Tenaga Ahli</th>
                      <th className="py-2.5 px-3.5">Uraian / Pekerjaan</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[130px]">Nominal Gaji</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[110px]">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredHonorList.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-muted-faint">
                          Belum ada data gaji tenaga ahli pada bulan ini. Silakan klik "Input Gaji Tenaga Ahli" untuk mencatat gaji.
                        </td>
                      </tr>
                    ) : (
                      filteredHonorList.map((h) => (
                        <tr key={h.id} className="hover:bg-surface-hover/30 transition-colors">
                          <td className="py-3 px-3.5">
                            <div className="font-semibold text-navy-text">{h.tanggalFmt}</div>
                            {h.noBukti && (
                              <div className="font-mono text-[11px] text-muted-faint mt-0.5">
                                Bukti: {h.noBukti}
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-3.5">
                            <div className="font-bold text-navy-text text-sm">{h.nama}</div>
                            <div className="text-[11px] text-muted-faint font-mono mt-0.5">
                              NIK: {h.nik} {h.npwp ? `· NPWP: ${h.npwp}` : ""}
                            </div>
                          </td>

                          <td className="py-3 px-3.5 text-muted-stronger">
                            <div>{h.uraian}</div>
                            {(h.namaProyek || h.projectName) && (
                              <div className="text-[11px] text-brand font-semibold mt-0.5 inline-flex items-center gap-1">
                                <Briefcase size={11} />
                                <span>Proyek: {h.namaProyek || `[${h.projectCode}] ${h.projectName}`}</span>
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-3.5 text-right font-mono font-bold text-navy-text whitespace-nowrap text-sm">
                            {h.nominalHonorFmt}
                          </td>

                          <td className="py-3 px-3.5 text-right whitespace-nowrap">
                            {isManager && (
                              <div className="inline-flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => {
                                    setEditingHonor(h);
                                    setIsHonorModalOpen(true);
                                  }}
                                  className="h-7 px-2.5 rounded-lg border border-border bg-surface-subtle hover:bg-surface-hover text-[11px] font-semibold text-navy-text inline-flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                                >
                                  <Pencil size={11} />
                                  <span>Edit</span>
                                </button>
                                <button
                                  onClick={() => {
                                    if (confirm(`Hapus honorarium ${h.nama} sebesar ${h.nominalHonorFmt}?`)) {
                                      startTransition(async () => {
                                        try {
                                          await deleteHonorTenagaAhliAction(h.id);
                                          setSuccessMsg("Honorarium berhasil dihapus.");
                                          router.refresh();
                                        } catch (e: unknown) {
                                          setErrorMsg((e as Error).message);
                                        }
                                      });
                                    }
                                  }}
                                  className="h-7 px-2 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer shadow-2xs"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {data.honorList.length > 0 && (
                    <tfoot className="bg-surface-subtle border-t border-border font-bold text-xs">
                      <tr>
                        <td colSpan={3} className="py-3 px-3.5 text-navy-text whitespace-nowrap">
                          Total ({data.summaryHonorBulanIni.totalTransaksi} Transaksi):
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono text-navy-text whitespace-nowrap text-sm">
                          {data.summaryHonorBulanIni.totalHonorBrutoFmt}
                        </td>
                        <td className="py-3 px-3.5" />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {/* Sub-Tab Content 2: Rekapitulasi Per Bulan Tenaga Ahli (Jan - Des) */}
          {tenagaAhliSubTab === "rekap-bulan" && (
            <div className="rounded-2xl border border-border bg-surface-card overflow-hidden">
              <div className="p-4 border-b border-border flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-sm font-bold text-navy-text">
                    Rekapitulasi Honorarium Tenaga Ahli Per Bulan – Tahun {selectedYear}
                  </h3>
                  <p className="text-xs text-muted-faint">
                    Ringkasan total pembayaran honorarium tenaga ahli / bukan pegawai selama 12 bulan pada entitas {data.entity?.name}
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[550px] text-left text-xs">
                  <thead className="bg-surface-subtle border-b border-border text-muted-stronger font-bold">
                    <tr>
                      <th className="py-2.5 px-3.5">Bulan</th>
                      <th className="py-2.5 px-3.5 text-center">Jml Pembayaran</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[130px]">Total Honorarium</th>
                      <th className="py-2.5 px-3.5 text-center whitespace-nowrap">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.rekapBulananTenagaAhli.map((r) => (
                      <tr
                        key={r.bulan}
                        className={`hover:bg-surface-hover/30 transition-colors ${
                          r.bulan === selectedMonth ? "bg-navy/5 font-medium" : ""
                        }`}
                      >
                        <td className="py-3 px-3.5">
                          <div className="font-bold text-navy-text flex items-center gap-1.5">
                            <span>{r.bulanName}</span>
                            {r.bulan === selectedMonth && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-navy text-white font-semibold">
                                Aktif
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3.5 text-center font-mono">
                          {r.totalTransaksi > 0 ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[11px]">
                              {r.totalTransaksi} transaksi
                            </span>
                          ) : (
                            <span className="text-muted-faint text-[11px]">-</span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono font-bold text-navy-text whitespace-nowrap">
                          {r.totalHonorBrutoFmt}
                        </td>
                        <td className="py-3 px-3.5 text-center whitespace-nowrap">
                          <button
                            onClick={() => {
                              handleMonthChange(r.bulan);
                              setTenagaAhliSubTab("honor");
                            }}
                            className="h-7 px-2.5 rounded-lg border border-border bg-surface-subtle hover:bg-surface-hover text-[11px] font-semibold text-navy-text inline-flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                          >
                            <span>Input / Lihat Bulan Ini</span>
                            <ChevronRight size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-surface-subtle border-t-2 border-border font-bold text-xs">
                    <tr>
                      <td className="py-3 px-3.5 text-navy-text">Grand Total (12 Bulan):</td>
                      <td className="py-3 px-3.5 text-center font-mono">
                        {data.rekapBulananTenagaAhli.reduce((s, r) => s + r.totalTransaksi, 0)} transaksi
                      </td>
                      <td className="py-3 px-3.5 text-right font-mono font-bold text-navy-text whitespace-nowrap">
                        {formatRupiah(
                          data.rekapBulananTenagaAhli.reduce((s, r) => s + r.totalHonorBruto, 0)
                        )}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Sub-Tab Content: Database Tenaga Ahli */}
          {tenagaAhliSubTab === "database-ahli" && (
            <div className="rounded-2xl border border-border bg-surface-card overflow-hidden">
              <div className="p-4 border-b border-border flex items-center justify-between flex-wrap gap-3 bg-surface-subtle/30">
                <div>
                  <h3 className="text-sm font-bold text-navy-text flex items-center gap-2">
                    <Users size={16} className="text-navy" />
                    <span>Database Pegawai Tenaga Ahli (Master Rekanan)</span>
                  </h3>
                  <p className="text-xs text-muted-faint mt-0.5">
                    Daftar profil tenaga ahli lepas / konsultan holding. NIK dan NPWP didaftarkan sekali di sini, sehingga saat input gaji bulanan cukup memilih nama dari daftar tanpa perlu mengetik ulang NIK dan NPWP.
                  </p>
                </div>

                {isManager && (
                  <button
                    onClick={() => {
                      setEditingMasterAhli(null);
                      setIsMasterAhliModalOpen(true);
                    }}
                    className="h-8 px-3 rounded-xl bg-navy text-white text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-navy-light transition-colors cursor-pointer shadow-2xs"
                  >
                    <Plus size={14} />
                    <span>Tambah Tenaga Ahli Baru</span>
                  </button>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-left text-xs">
                  <thead className="bg-surface-subtle border-b border-border text-muted-stronger font-bold">
                    <tr>
                      <th className="py-2.5 px-3.5">Nama & Spesialisasi</th>
                      <th className="py-2.5 px-3.5">NIK (16 Digit Terdaftar)</th>
                      <th className="py-2.5 px-3.5">NPWP</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredRekananList.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-muted-faint">
                          {searchQuery
                            ? "Tidak ada tenaga ahli yang cocok dengan pencarian."
                            : "Belum ada tenaga ahli yang didaftarkan. Silakan klik '+ Tambah Tenaga Ahli Baru' untuk mendaftarkan profil tenaga ahli."}
                        </td>
                      </tr>
                    ) : (
                      filteredRekananList.map((r) => {
                        const hasNpwp = !!(r.npwp && r.npwp.trim());
                        return (
                          <tr key={r.id} className="hover:bg-surface-hover/30 transition-colors">
                            <td className="py-3 px-3.5">
                              <div className="font-bold text-navy-text text-sm">{r.nama}</div>
                              {r.kategori && (
                                <div className="text-[11px] text-muted-faint mt-0.5 inline-flex items-center gap-1">
                                  <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[10px] font-medium">
                                    {r.kategori}
                                  </span>
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-3.5 font-mono">
                              {r.nik ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold">
                                  <CheckCircle size={12} />
                                  <span>{r.nik}</span>
                                </span>
                              ) : (
                                <span className="text-amber-600 dark:text-amber-400 font-sans italic text-[11px]">
                                  Belum diisi
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3.5 font-mono text-muted-stronger">
                              {hasNpwp ? r.npwp : <span className="text-muted-faint">-</span>}
                            </td>
                            <td className="py-3 px-3.5 text-right whitespace-nowrap">
                              <div className="inline-flex items-center justify-end gap-1.5">
                                {isManager && (
                                  <>
                                    <button
                                      onClick={() => {
                                        setSelectedRekananIdForHonor(r.id);
                                        setEditingHonor(null);
                                        setIsHonorModalOpen(true);
                                      }}
                                      className="h-7 px-2.5 rounded-lg bg-navy text-white text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors shadow-2xs hover:bg-navy-light"
                                      title="Input Gaji untuk Tenaga Ahli ini"
                                    >
                                      <Plus size={11} />
                                      <span>Input Gaji</span>
                                    </button>
                                    <button
                                      onClick={() => {
                                        setEditingMasterAhli(r);
                                        setIsMasterAhliModalOpen(true);
                                      }}
                                      className="h-7 px-2.5 rounded-lg border border-border bg-surface-subtle hover:bg-surface-hover text-[11px] font-semibold text-navy-text inline-flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                                    >
                                      <Pencil size={11} />
                                      <span>Edit</span>
                                    </button>
                                    <button
                                      onClick={() => {
                                        if (
                                          confirm(
                                            `Hapus ${r.nama} dari database tenaga ahli? Tindakan ini hanya diperbolehkan jika belum ada riwayat pembayaran honor.`
                                          )
                                        ) {
                                          startTransition(async () => {
                                            try {
                                              const res = await deleteTenagaAhliMasterAction(r.id);
                                              setSuccessMsg(res.message);
                                              router.refresh();
                                            } catch (err: unknown) {
                                              setErrorMsg((err as Error).message);
                                            }
                                          });
                                        }
                                      }}
                                      className="h-7 w-7 rounded-lg border border-rose-200 dark:border-rose-900 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 inline-flex items-center justify-center cursor-pointer transition-colors"
                                      title="Hapus Tenaga Ahli"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sub-Tab Content 3: Cek Per Nama (Patokan NIK) */}
          {tenagaAhliSubTab === "rekap-nama" && (
            <div className="rounded-2xl border border-border bg-surface-card overflow-hidden">
              <div className="p-4 border-b border-border flex items-center justify-between flex-wrap gap-3 bg-surface-subtle/30">
                <div>
                  <h3 className="text-sm font-bold text-navy-text flex items-center gap-2">
                    <Award size={16} className="text-navy" />
                    <span>Cek Gaji Per Nama (Patokan NIK Tenaga Ahli) – Tahun {selectedYear}</span>
                  </h3>
                  <p className="text-xs text-muted-faint mt-0.5">
                    Lacak riwayat honorarium per nama/NIK: dapat gaji dari proyek mana saja, entitas mana saja di grup holding, dan pada bulan apa saja.
                  </p>
                </div>

                {/* Filter Entitas Pills */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] text-muted-faint font-semibold flex items-center gap-1">
                    <Building2 size={12} /> Filter Entitas:
                  </span>
                  <button
                    onClick={() => setFilterEntitasNama("ALL")}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                      filterEntitasNama === "ALL"
                        ? "bg-navy text-white shadow-2xs"
                        : "bg-surface-card border border-border text-muted-stronger hover:bg-surface-hover"
                    }`}
                  >
                    Semua Holding ({data.rekapTenagaAhliPerNama.length})
                  </button>
                  {data.allEntities.map((ent) => (
                    <button
                      key={ent.id}
                      onClick={() => setFilterEntitasNama(ent.name)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                        filterEntitasNama === ent.name
                          ? "bg-navy text-white shadow-2xs"
                          : "bg-surface-card border border-border text-muted-stronger hover:bg-surface-hover"
                      }`}
                    >
                      {ent.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] text-left text-xs">
                  <thead className="bg-surface-subtle border-b border-border text-muted-stronger font-bold">
                    <tr>
                      <th className="py-2.5 px-3.5">NIK & Tenaga Ahli</th>
                      <th className="py-2.5 px-3.5">🏢 Entitas Mana Saja</th>
                      <th className="py-2.5 px-3.5">🏗️ Proyek Mana Saja</th>
                      <th className="py-2.5 px-3.5">📅 Bulan Apa Saja</th>
                      <th className="py-2.5 px-3.5 text-center">Jml Transaksi</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[120px]">Total Honorarium</th>
                      <th className="py-2.5 px-3.5 text-center whitespace-nowrap">Rincian</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredRekapPerNama.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-muted-faint">
                          Belum ada transaksi honorarium tenaga ahli untuk filter terpilih tahun {selectedYear}.
                        </td>
                      </tr>
                    ) : (
                      filteredRekapPerNama.map((r) => {
                        const isExpanded = expandedNik === r.nik;
                        return (
                          <Fragment key={r.nik}>
                            <tr
                              className={`hover:bg-surface-hover/30 transition-colors ${
                                isExpanded ? "bg-surface-subtle/60" : ""
                              }`}
                            >
                              <td className="py-3 px-3.5">
                                <div className="font-bold text-navy-text text-sm">{r.nama}</div>
                                <div className="font-mono text-[11px] text-muted-faint font-semibold mt-0.5">
                                  NIK: <span className="text-navy font-bold">{r.nik}</span>
                                  {r.npwp && <span> · NPWP: {r.npwp}</span>}
                                </div>
                              </td>

                              <td className="py-3 px-3.5">
                                <div className="flex flex-wrap gap-1 max-w-xs">
                                  {r.daftarEntitas.length > 0 ? (
                                    r.daftarEntitas.map((entName, i) => (
                                      <span
                                        key={i}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 text-[10px] font-semibold border border-purple-200 dark:border-purple-800"
                                      >
                                        <Building2 size={10} />
                                        <span>{entName}</span>
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-muted-faint text-[11px]">-</span>
                                  )}
                                </div>
                              </td>

                              <td className="py-3 px-3.5">
                                <div className="flex flex-wrap gap-1 max-w-xs">
                                  {r.daftarProyek.length > 0 ? (
                                    r.daftarProyek.map((projName, i) => (
                                      <span
                                        key={i}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 text-[10px] font-medium border border-blue-200 dark:border-blue-800"
                                      >
                                        <Briefcase size={10} />
                                        <span>{projName}</span>
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-muted-faint text-[11px]">-</span>
                                  )}
                                </div>
                              </td>

                              <td className="py-3 px-3.5">
                                <div className="flex flex-wrap gap-1 max-w-xs">
                                  {r.daftarBulan.length > 0 ? (
                                    r.daftarBulan.map((bulanName, i) => (
                                      <span
                                        key={i}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 text-[10px] font-semibold border border-amber-200 dark:border-amber-800"
                                      >
                                        <Calendar size={10} />
                                        <span>{bulanName}</span>
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-muted-faint text-[11px]">-</span>
                                  )}
                                </div>
                              </td>

                              <td className="py-3 px-3.5 text-center font-mono">
                                <span className="px-2 py-0.5 rounded-full bg-surface-subtle font-bold text-[11px]">
                                  {r.totalTransaksi}x
                                </span>
                              </td>

                              <td className="py-3 px-3.5 text-right font-mono font-bold text-navy-text whitespace-nowrap">
                                {r.totalHonorBrutoFmt}
                              </td>

                              <td className="py-3 px-3.5 text-center whitespace-nowrap">
                                <button
                                  onClick={() => setExpandedNik(isExpanded ? null : r.nik)}
                                  className={`h-7 px-2.5 rounded-lg border text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors shadow-2xs ${
                                    isExpanded
                                      ? "bg-navy text-white border-navy"
                                      : "border-border bg-surface-subtle hover:bg-surface-hover text-navy-text"
                                  }`}
                                >
                                  <span>{isExpanded ? "Tutup" : "Lihat Detail"}</span>
                                  {isExpanded ? (
                                    <ChevronDown size={12} />
                                  ) : (
                                    <ChevronRight size={12} />
                                  )}
                                </button>
                              </td>
                            </tr>

                            {/* Accordion Rincian Transaksi */}
                            {isExpanded && (
                              <tr className="bg-surface-subtle/30">
                                <td colSpan={7} className="p-3.5">
                                  <div className="rounded-xl border border-border bg-surface-card p-3.5 shadow-inner">
                                    <div className="flex items-center justify-between flex-wrap gap-2 mb-3 pb-2 border-b border-border">
                                      <div className="text-xs font-bold text-navy-text flex items-center gap-1.5">
                                        <Briefcase size={14} className="text-navy" />
                                        <span>
                                          Rincian Pembayaran Honorarium: {r.nama} (NIK: {r.nik})
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2 text-[11px] flex-wrap">
                                        <span className="text-muted-faint">Entitas:</span>
                                        <span className="font-semibold text-navy-text">
                                          {r.daftarEntitas.join(", ")}
                                        </span>
                                        <span className="text-muted-faint ml-2">Total Honor:</span>
                                        <span className="font-bold text-navy-text font-mono">
                                          {r.totalHonorBrutoFmt}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-left text-xs">
                                        <thead className="bg-surface-subtle border-b border-border text-muted-stronger font-bold">
                                          <tr>
                                            <th className="py-2 px-3">Tanggal & Bukti</th>
                                            <th className="py-2 px-3">Entitas Pembayar</th>
                                            <th className="py-2 px-3">Bulan</th>
                                            <th className="py-2 px-3">Nama Proyek</th>
                                            <th className="py-2 px-3">Uraian Tugas / Jasa</th>
                                            <th className="py-2 px-3 text-right">Nominal Honorarium</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                          {r.rincian.map((item) => (
                                            <tr key={item.id} className="hover:bg-surface-hover/20">
                                              <td className="py-2 px-3 font-medium whitespace-nowrap">
                                                <div>{item.tanggalFmt}</div>
                                                {item.noBukti && (
                                                  <div className="text-[10px] font-mono text-muted-faint">
                                                    {item.noBukti}
                                                  </div>
                                                )}
                                              </td>
                                              <td className="py-2 px-3 whitespace-nowrap">
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 text-[10px] font-semibold border border-purple-200 dark:border-purple-800">
                                                  <Building2 size={10} />
                                                  <span>{item.entityName}</span>
                                                </span>
                                              </td>
                                              <td className="py-2 px-3 text-muted-stronger font-medium whitespace-nowrap">
                                                {item.bulanName}
                                              </td>
                                              <td className="py-2 px-3">
                                                <span className="font-semibold text-brand text-[11px] inline-flex items-center gap-1">
                                                  <Briefcase size={11} />
                                                  <span>{item.namaProyek}</span>
                                                </span>
                                              </td>
                                              <td className="py-2 px-3 text-muted-stronger">
                                                {item.uraian}
                                              </td>
                                              <td className="py-2 px-3 text-right font-mono font-bold text-navy-text whitespace-nowrap">
                                                {item.nominalHonorFmt}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })
                    )}
                  </tbody>
                  {filteredRekapPerNama.length > 0 && (
                    <tfoot className="bg-surface-subtle border-t-2 border-border font-bold text-xs">
                      <tr>
                        <td colSpan={5} className="py-3 px-3.5 text-navy-text">
                          Total ({filteredRekapPerNama.length} Tenaga Ahli):
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono font-bold text-navy-text whitespace-nowrap">
                          {formatRupiah(
                            filteredRekapPerNama.reduce((s, r) => s + r.totalHonorBruto, 0)
                          )}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {/* Sub-Tab 4: Konsolidasi Tahunan Lintas Entitas */}
          {tenagaAhliSubTab === "konsolidasi" && (
            <div className="rounded-2xl border border-border bg-surface-card overflow-hidden">
              <div className="p-4 border-b border-border flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-sm font-bold text-navy-text">
                    Laporan Konsolidasi Tahunan Tenaga Ahli – Tahun {selectedYear}
                  </h3>
                  <p className="text-xs text-muted-faint">
                    Akumulasi penghasilan per tenaga ahli dari seluruh entitas perusahaan dalam holding group
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[650px] text-left text-xs">
                  <thead className="bg-surface-subtle border-b border-border text-muted-stronger font-bold">
                    <tr>
                      <th className="py-2.5 px-3.5">Tenaga Ahli</th>
                      <th className="py-2.5 px-3.5">Rincian Per Entitas Pembayar</th>
                      <th className="py-2.5 px-3.5 text-center whitespace-nowrap">Frekuensi</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap">Total Honorarium</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredKonsolidasi.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-muted-faint">
                          Belum ada transaksi honorarium tenaga ahli pada tahun {selectedYear}.
                        </td>
                      </tr>
                    ) : (
                      filteredKonsolidasi.map((k) => (
                        <tr key={k.nik} className="hover:bg-surface-hover/30 transition-colors">
                          <td className="py-3 px-3.5">
                            <div className="font-bold text-navy-text text-sm">{k.nama}</div>
                            <div className="text-[11px] text-muted-faint font-mono mt-0.5">
                              NIK: {k.nik} {k.npwp ? `· NPWP: ${k.npwp}` : ""}
                            </div>
                          </td>

                          <td className="py-3 px-3.5">
                            <div className="flex flex-wrap gap-1.5">
                              {k.perEntitas.map((ent) => (
                                <span
                                  key={ent.entityId}
                                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border border-border bg-surface-subtle text-[11px]"
                                >
                                  <strong className="text-navy-text">{ent.entityName}:</strong>
                                  <span className="font-mono text-muted-stronger">{ent.nominalHonorFmt}</span>
                                  <span className="text-muted-faint">({ent.transaksiCount}x)</span>
                                </span>
                              ))}
                            </div>
                          </td>

                          <td className="py-3 px-3.5 text-center font-mono font-bold text-navy-text">
                            {k.totalTransaksi} Transaksi
                          </td>

                          <td className="py-3 px-3.5 text-right font-mono font-bold text-navy-text whitespace-nowrap">
                            {k.totalHonorBrutoFmt}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: SINKRONISASI LABA RUGI */}
      {/* ========================================================= */}
      {mainTab === "sync" && (
        <div className="space-y-6">
          <div className="p-5 rounded-2xl border border-border bg-surface-card space-y-4">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <h3 className="text-base font-bold text-navy-text flex items-center gap-2">
                  <Scale size={18} className="text-brand" />
                  <span>Verifikasi Rekonsiliasi Payroll vs Laporan Laba Rugi</span>
                </h3>
                <p className="text-xs text-muted-faint mt-1">
                  Memverifikasi pengeluaran modul Payroll sinkron 100% dengan akun Biaya Gaji (511) dan Biaya Tenaga Ahli (612) di Laba Rugi entitas {data.entity?.name} (Bulan {BULAN_NAMES[selectedMonth - 1]} {selectedYear})
                </p>
              </div>

              <div>
                {data.syncData.isOverallSinkron ? (
                  <span className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs">
                    <CheckCircle size={14} />
                    <span>100% SINKRON</span>
                  </span>
                ) : (
                  <span className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs">
                    <AlertCircle size={14} />
                    <span>SELISIH: {data.syncData.totalSelisihFmt}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Comparison Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {/* Card 1: Gaji Pegawai Tetap */}
              <div className="p-4 rounded-xl border border-border bg-surface-subtle/40 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-navy-text">
                    1. Beban Gaji Pegawai Tetap (Akun 511)
                  </span>
                  {data.syncData.isGajiPegawaiSinkron ? (
                    <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                      <CheckCircle size={12} /> Sinkron
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1">
                      <AlertCircle size={12} /> Selisih {data.syncData.selisihGajiPegawaiFmt}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 rounded-lg bg-surface-card border border-border">
                    <span className="text-[11px] text-muted-faint block">Modul Payroll (Gaji Kotor)</span>
                    <strong className="text-sm font-mono text-navy-text">
                      {data.syncData.payrollGajiPegawaiFmt}
                    </strong>
                  </div>
                  <div className="p-2.5 rounded-lg bg-surface-card border border-border">
                    <span className="text-[11px] text-muted-faint block">Buku Besar / GL (Akun 511)</span>
                    <strong className="text-sm font-mono text-navy-text">
                      {data.syncData.glBebanGaji511Fmt}
                    </strong>
                  </div>
                </div>

                <p className="text-[11px] text-muted-faint">
                  Catatan: Jika ada selisih, pastikan transaksi jurnal pengeluaran gaji telah dicatat ke akun 511 dengan nominal kotor yang sama.
                </p>
              </div>

              {/* Card 2: Honor Tenaga Ahli */}
              <div className="p-4 rounded-xl border border-border bg-surface-subtle/40 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-navy-text">
                    2. Beban Tenaga Ahli / Honor (Akun 612)
                  </span>
                  {data.syncData.isTenagaAhliSinkron ? (
                    <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                      <CheckCircle size={12} /> Sinkron
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1">
                      <AlertCircle size={12} /> Selisih {data.syncData.selisihTenagaAhliFmt}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 rounded-lg bg-surface-card border border-border">
                    <span className="text-[11px] text-muted-faint block">Modul Payroll (Honor Bruto)</span>
                    <strong className="text-sm font-mono text-navy-text">
                      {data.syncData.payrollHonorTenagaAhliFmt}
                    </strong>
                  </div>
                  <div className="p-2.5 rounded-lg bg-surface-card border border-border">
                    <span className="text-[11px] text-muted-faint block">Buku Besar / GL (Akun 612)</span>
                    <strong className="text-sm font-mono text-navy-text">
                      {data.syncData.glBebanTenagaAhli612Fmt}
                    </strong>
                  </div>
                </div>

                <p className="text-[11px] text-muted-faint">
                  Catatan: Pengeluaran honorarium tenaga ahli di jurnal dicatat debet pada akun 612 dan kredit pada kas/bank.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: FORM TAMBAH / EDIT PEGAWAI TETAP */}
      {/* ========================================================= */}
      {isPegawaiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-surface-card rounded-2xl border border-border shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface-subtle/50">
              <h3 className="text-sm font-bold text-navy-text flex items-center gap-2">
                <Users size={16} />
                <span>{editingPegawai ? "Edit Data Pegawai Tetap" : "Tambah Pegawai Tetap Baru"}</span>
              </h3>
              <button
                onClick={() => setIsPegawaiModalOpen(false)}
                className="p-1 text-muted-faint hover:text-navy-text rounded-lg transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const fd = new FormData(form);
                startTransition(async () => {
                  try {
                    if (editingPegawai) {
                      await updatePegawaiAction(fd);
                      setSuccessMsg(`Data pegawai ${fd.get("nama")} berhasil diupdate.`);
                    } else {
                      await createPegawaiAction(fd);
                      setSuccessMsg(`Pegawai ${fd.get("nama")} berhasil ditambahkan.`);
                    }
                    setIsPegawaiModalOpen(false);
                    router.refresh();
                  } catch (err: unknown) {
                    setErrorMsg((err as Error).message);
                  }
                });
              }}
              className="p-5 space-y-4 text-xs"
            >
              <input type="hidden" name="entityId" value={data.entity?.id ?? ""} />
              {editingPegawai && <input type="hidden" name="id" value={editingPegawai.id} />}

              <div>
                <label className="font-semibold text-navy-text block mb-1">NIK / Kode Karyawan *</label>
                <input
                  type="text"
                  name="nik"
                  required
                  defaultValue={editingPegawai?.nik ?? ""}
                  placeholder="Contoh: KRY-001 atau 16 digit NIK"
                  className="w-full h-8 px-3 rounded-lg border border-border bg-surface-card text-foreground font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-navy-text block mb-1">Nama Lengkap *</label>
                <input
                  type="text"
                  name="nama"
                  required
                  defaultValue={editingPegawai?.nama ?? ""}
                  placeholder="Nama lengkap pegawai"
                  className="w-full h-8 px-3 rounded-lg border border-border bg-surface-card text-foreground"
                />
              </div>

              <div>
                <label className="font-semibold text-navy-text block mb-1">Jabatan / Posisi *</label>
                <input
                  type="text"
                  name="jabatan"
                  required
                  defaultValue={editingPegawai?.jabatan ?? ""}
                  placeholder="Contoh: Drafter, Engineer, Keuangan, dsb."
                  className="w-full h-8 px-3 rounded-lg border border-border bg-surface-card text-foreground"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-navy-text block mb-1">Status PTKP *</label>
                  <select
                    name="statusKeluarga"
                    defaultValue={editingPegawai?.statusKeluarga ?? "TK/0"}
                    onChange={(e) => {
                      const form = e.target.form;
                      if (form && PTKP_RATES[e.target.value]) {
                        const ptkpInput = form.elements.namedItem("ptkp") as HTMLInputElement;
                        if (ptkpInput) ptkpInput.value = PTKP_RATES[e.target.value].toString();
                      }
                    }}
                    className="w-full h-8 px-2.5 rounded-lg border border-border bg-surface-card text-foreground font-mono"
                  >
                    {Object.keys(PTKP_RATES).map((key) => (
                      <option key={key} value={key}>
                        {key}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-navy-text block mb-1">Nominal PTKP (Thn)</label>
                  <input
                    type="number"
                    name="ptkp"
                    defaultValue={editingPegawai?.ptkp ?? 54000000}
                    className="w-full h-8 px-3 rounded-lg border border-border bg-surface-card text-foreground font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-navy-text block mb-1">Gaji Pokok Standar (Rp) *</label>
                <input
                  type="number"
                  name="gajiPokok"
                  required
                  defaultValue={editingPegawai?.gajiPokok ?? 0}
                  className="w-full h-8 px-3 rounded-lg border border-border bg-surface-card text-foreground font-mono"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  name="isActive"
                  id="isActive"
                  defaultChecked={editingPegawai?.isActive ?? true}
                  className="rounded border-border text-navy"
                />
                <label htmlFor="isActive" className="text-xs text-navy-text cursor-pointer">
                  Pegawai aktif bekerja
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsPegawaiModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-border text-muted-stronger hover:bg-surface-hover transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-1.5 rounded-lg bg-navy text-white font-semibold hover:bg-navy-light transition-colors cursor-pointer shadow-2xs"
                >
                  {isPending ? "Menyimpan..." : "Simpan Pegawai"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: FORM INPUT / EDIT GAJI BULANAN */}
      {/* ========================================================= */}
      {isGajiModalOpen && editingGaji && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-surface-card rounded-2xl border border-border shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface-subtle/50">
              <div>
                <h3 className="text-sm font-bold text-navy-text flex items-center gap-2">
                  <CreditCard size={16} />
                  <span>Komponen Gaji: {editingGaji.pegawai.nama}</span>
                </h3>
                <p className="text-[11px] text-muted-faint mt-0.5">
                  Periode: {BULAN_NAMES[selectedMonth - 1]} {selectedYear} · {editingGaji.pegawai.jabatan}
                </p>
              </div>
              <button
                onClick={() => setIsGajiModalOpen(false)}
                className="p-1 text-muted-faint hover:text-navy-text rounded-lg transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const fd = new FormData(form);
                startTransition(async () => {
                  try {
                    await saveGajiBulananAction(fd);
                    setSuccessMsg(`Gaji ${editingGaji.pegawai.nama} bulan ${BULAN_NAMES[selectedMonth - 1]} berhasil disimpan.`);
                    setIsGajiModalOpen(false);
                    router.refresh();
                  } catch (err: unknown) {
                    setErrorMsg((err as Error).message);
                  }
                });
              }}
              className="p-5 space-y-4 text-xs overflow-y-auto flex-1"
            >
              <input type="hidden" name="pegawaiId" value={editingGaji.pegawai.id} />
              <input type="hidden" name="entityId" value={data.entity?.id ?? ""} />
              <input type="hidden" name="bulan" value={selectedMonth} />
              <input type="hidden" name="tahun" value={selectedYear} />

              <div>
                <label className="font-semibold text-navy-text block mb-1">
                  Pilih Pegawai Terdaftar *
                </label>
                <select
                  value={editingGaji.pegawai.id}
                  onChange={(e) => {
                    const sel = data.pegawaiList.find((p) => p.id === e.target.value);
                    if (sel) {
                      setEditingGaji({ pegawai: sel, gaji: sel.currentGaji });
                    }
                  }}
                  className="w-full h-8 px-2.5 rounded-lg border border-border bg-surface-card text-foreground font-semibold"
                >
                  {data.pegawaiList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nama} – {p.jabatan} {p.currentGaji ? "(Sudah Ada Data Bulan Ini)" : "(Belum Diinput)"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3 rounded-xl bg-surface-subtle border border-border flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-muted-faint block">NIK & Status Pajak (Terkunci)</span>
                  <strong className="text-navy-text font-mono">
                    {editingGaji.pegawai.nik}
                  </strong>
                  <div className="text-[11px] text-muted-faint">
                    {editingGaji.pegawai.statusKeluarga} (PTKP: {editingGaji.pegawai.ptkpFmt})
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-muted-faint block">Gaji Pokok Master</span>
                  <strong className="text-navy-text font-mono">
                    {editingGaji.pegawai.gajiPokokFmt}
                  </strong>
                </div>
              </div>

              {/* Penghasilan / Pendapatan */}
              <div className="space-y-2.5">
                <h4 className="font-bold text-navy-text uppercase tracking-wider text-[10px] text-muted-stronger">
                  A. Komponen Penghasilan (Kotor)
                </h4>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-navy-text block mb-1">Gaji Pokok (Bulan ini)</label>
                    <input
                      type="number"
                      name="gajiPokok"
                      required
                      defaultValue={editingGaji.gaji?.gajiPokok ?? editingGaji.pegawai.gajiPokok}
                      className="w-full h-8 px-3 rounded-lg border border-border bg-surface-card text-foreground font-mono"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-navy-text block mb-1">Tunjangan Jabatan</label>
                    <input
                      type="number"
                      name="tunjanganJabatan"
                      defaultValue={editingGaji.gaji?.tunjanganJabatan ?? 0}
                      className="w-full h-8 px-3 rounded-lg border border-border bg-surface-card text-foreground font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-navy-text block mb-1">Tunjangan Transport & Makan</label>
                    <input
                      type="number"
                      name="tunjanganTransport"
                      defaultValue={editingGaji.gaji?.tunjanganTransport ?? 0}
                      className="w-full h-8 px-3 rounded-lg border border-border bg-surface-card text-foreground font-mono"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-navy-text block mb-1">Insentif / Bonus / Lembur</label>
                    <input
                      type="number"
                      name="insentif"
                      defaultValue={editingGaji.gaji?.insentif ?? 0}
                      className="w-full h-8 px-3 rounded-lg border border-border bg-surface-card text-foreground font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Potongan */}
              <div className="space-y-2.5 pt-2 border-t border-border">
                <h4 className="font-bold text-navy-text uppercase tracking-wider text-[10px] text-rose-700 dark:text-rose-400">
                  B. Komponen Potongan
                </h4>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-navy-text block mb-1">BPJS Kesehatan (Potongan)</label>
                    <input
                      type="number"
                      name="bpjsKesehatan"
                      defaultValue={editingGaji.gaji?.bpjsKesehatan ?? 0}
                      className="w-full h-8 px-3 rounded-lg border border-border bg-surface-card text-foreground font-mono"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-navy-text block mb-1">BPJS Ketenagakerjaan</label>
                    <input
                      type="number"
                      name="bpjsKetenagakerjaan"
                      defaultValue={editingGaji.gaji?.bpjsKetenagakerjaan ?? 0}
                      className="w-full h-8 px-3 rounded-lg border border-border bg-surface-card text-foreground font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-navy-text block mb-1">Potongan PPh 21 (Pajak)</label>
                    <input
                      type="number"
                      name="pph21"
                      defaultValue={editingGaji.gaji?.pph21 ?? 0}
                      className="w-full h-8 px-3 rounded-lg border border-border bg-surface-card text-foreground font-mono"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-navy-text block mb-1">Potongan Lainnya / Kasbon</label>
                    <input
                      type="number"
                      name="potonganLain"
                      defaultValue={editingGaji.gaji?.potonganLain ?? 0}
                      className="w-full h-8 px-3 rounded-lg border border-border bg-surface-card text-foreground font-mono"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="font-semibold text-navy-text block mb-1">Catatan / Keterangan</label>
                <input
                  type="text"
                  name="catatan"
                  defaultValue={editingGaji.gaji?.catatan ?? ""}
                  placeholder="Opsional: Keterangan lembur / penyesuaian"
                  className="w-full h-8 px-3 rounded-lg border border-border bg-surface-card text-foreground"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-border">
                {editingGaji.gaji && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("Hapus data input gaji bulan ini untuk pegawai ini?")) {
                        startTransition(async () => {
                          try {
                            await deleteGajiBulananAction(editingGaji.gaji!.id);
                            setSuccessMsg("Input gaji bulan ini berhasil dihapus.");
                            setIsGajiModalOpen(false);
                            router.refresh();
                          } catch (err: unknown) {
                            setErrorMsg((err as Error).message);
                          }
                        });
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold cursor-pointer"
                  >
                    Hapus Input Gaji
                  </button>
                )}

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setIsGajiModalOpen(false)}
                    className="px-3.5 py-1.5 rounded-lg border border-border text-muted-stronger hover:bg-surface-hover transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="px-4 py-1.5 rounded-lg bg-navy text-white font-semibold hover:bg-navy-light transition-colors cursor-pointer shadow-2xs"
                  >
                    {isPending ? "Menyimpan..." : "Simpan Gaji Pegawai"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: FORM INPUT / EDIT GAJI TENAGA AHLI */}
      {/* ========================================================= */}
      {isHonorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-surface-card rounded-2xl border border-border shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface-subtle/50">
              <h3 className="text-sm font-bold text-navy-text flex items-center gap-2">
                <CreditCard size={16} />
                <span>
                  {editingHonor
                    ? "Edit Gaji Tenaga Ahli"
                    : "Input Gaji Tenaga Ahli"}
                </span>
              </h3>
              <button
                onClick={() => setIsHonorModalOpen(false)}
                className="p-1 text-muted-faint hover:text-navy-text rounded-lg transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const fd = new FormData(form);
                startTransition(async () => {
                  try {
                    await saveHonorTenagaAhliAction(fd);
                    setSuccessMsg("Data gaji tenaga ahli berhasil disimpan.");
                    setIsHonorModalOpen(false);
                    router.refresh();
                  } catch (err: unknown) {
                    setErrorMsg((err as Error).message);
                  }
                });
              }}
              className="p-5 space-y-3.5 text-xs overflow-y-auto flex-1"
            >
              {editingHonor && <input type="hidden" name="id" value={editingHonor.id} />}
              <input type="hidden" name="entityId" value={data.entity?.id ?? ""} />

              {/* Pemilihan Tenaga Ahli Terdaftar dari Database */}
              {(() => {
                const currentExpert = editingHonor
                  ? {
                      id: editingHonor.rekananId || "",
                      nama: editingHonor.nama,
                      nik: editingHonor.nik,
                      npwp: editingHonor.npwp,
                      kategori: null as string | null,
                    }
                  : data.rekananTenagaAhli.find((r) => r.id === selectedRekananIdForHonor) ||
                    data.rekananTenagaAhli[0] ||
                    null;

                return (
                  <div className="space-y-2.5">
                    <input type="hidden" name="rekananId" value={currentExpert?.id ?? ""} />
                    <input type="hidden" name="nama" value={currentExpert?.nama ?? ""} />
                    <input type="hidden" name="nik" value={currentExpert?.nik ?? ""} />
                    <input type="hidden" name="npwp" value={currentExpert?.npwp ?? ""} />

                    {!editingHonor && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="font-semibold text-navy-text block text-xs">
                            Pilih Tenaga Ahli Terdaftar *
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setIsHonorModalOpen(false);
                              setEditingMasterAhli(null);
                              setIsMasterAhliModalOpen(true);
                            }}
                            className="text-[11px] font-semibold text-brand hover:underline inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Plus size={12} />
                            <span>+ Daftarkan Tenaga Ahli Baru</span>
                          </button>
                        </div>

                        {data.rekananTenagaAhli.length === 0 ? (
                          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs flex items-center justify-between">
                            <div>
                              <p className="font-bold">Belum Ada Tenaga Ahli di Database</p>
                              <p className="text-[11px] mt-0.5">Daftarkan profil tenaga ahli terlebih dahulu.</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setIsHonorModalOpen(false);
                                setEditingMasterAhli(null);
                                setIsMasterAhliModalOpen(true);
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-navy text-white text-[11px] font-semibold cursor-pointer"
                            >
                              + Tambah Ahli
                            </button>
                          </div>
                        ) : (
                          <select
                            value={currentExpert?.id || ""}
                            onChange={(e) => {
                              setSelectedRekananIdForHonor(e.target.value);
                            }}
                            className="w-full h-8 px-2.5 rounded-lg border border-border bg-surface-card text-foreground font-semibold"
                          >
                            {data.rekananTenagaAhli.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.nama} {r.kategori ? `· ${r.kategori}` : ""} (NIK: {r.nik || "-"})
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    )}

                    {/* Locked Identity Card (Read-only dari Database) */}
                    {currentExpert && (
                      <div className="p-3 rounded-xl bg-surface-subtle border border-border space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-navy-text">
                            {currentExpert.nama}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold flex items-center gap-1">
                            <CheckCircle size={10} /> Terverifikasi di Database
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] pt-1.5 border-t border-border/60">
                          <div>
                            <span className="text-muted-faint block">NIK (16 Digit Terkunci):</span>
                            <span className="font-mono font-bold text-navy-text">
                              {currentExpert.nik || "-"}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-faint block">NPWP (Terkunci):</span>
                            <span className="font-mono text-muted-stronger">
                              {currentExpert.npwp || "Tanpa NPWP"}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              <div>
                <label className="font-semibold text-navy-text block mb-1">Uraian Tugas / Jasa Keahlian *</label>
                <input
                  type="text"
                  name="uraian"
                  required
                  defaultValue={editingHonor?.uraian ?? ""}
                  placeholder="Contoh: Honor Tenaga Ahli Struktur Proyek RSUD"
                  className="w-full h-8 px-3 rounded-lg border border-border bg-surface-card text-foreground"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-navy-text block mb-1">Tanggal Pembayaran *</label>
                  <input
                    type="date"
                    name="tanggal"
                    required
                    defaultValue={
                      editingHonor
                        ? new Date(editingHonor.tanggal).toISOString().split("T")[0]
                        : new Date().toISOString().split("T")[0]
                    }
                    className="w-full h-8 px-3 rounded-lg border border-border bg-surface-card text-foreground"
                  />
                </div>
                <div>
                  <label className="font-semibold text-navy-text block mb-1">No. Bukti / Voucher (Opsional)</label>
                  <input
                    type="text"
                    name="noBukti"
                    defaultValue={editingHonor?.noBukti ?? ""}
                    placeholder="Contoh: BKK-091"
                    className="w-full h-8 px-3 rounded-lg border border-border bg-surface-card text-foreground font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-navy-text block mb-1">
                  Nama Proyek (Alokasi Pekerjaan) *
                </label>
                <div className="space-y-1.5">
                  {data.projects.length > 0 && (
                    <select
                      onChange={(e) => {
                        const val = e.target.value;
                        const matched = data.projects.find((p) => p.id === val);
                        const inputEl = document.getElementById("inputNamaProyek") as HTMLInputElement;
                        const projIdEl = document.getElementById("inputProjectId") as HTMLInputElement;
                        if (matched && inputEl) {
                          inputEl.value = `${matched.code} - ${matched.name}`;
                          if (projIdEl) projIdEl.value = matched.id;
                        } else if (projIdEl) {
                          projIdEl.value = "";
                        }
                      }}
                      className="w-full h-8 px-2.5 rounded-lg border border-border bg-surface-subtle text-foreground text-xs"
                    >
                      <option value="">-- Pilih dari Daftar Proyek Entitas (Opsional) --</option>
                      {data.projects.map((pr) => (
                        <option key={pr.id} value={pr.id}>
                          [{pr.code}] {pr.name}
                        </option>
                      ))}
                    </select>
                  )}
                  <input
                    type="hidden"
                    id="inputProjectId"
                    name="projectId"
                    defaultValue={editingHonor?.projectId ?? ""}
                  />
                  <input
                    type="text"
                    id="inputNamaProyek"
                    name="namaProyek"
                    required
                    defaultValue={editingHonor?.namaProyek || editingHonor?.projectName || ""}
                    placeholder="Contoh: Pembangunan Gedung RSUD Doris Sylvanus"
                    className="w-full h-8 px-3 rounded-lg border border-border bg-surface-card text-foreground"
                  />
                </div>
                <span className="text-[10px] text-muted-faint mt-0.5 block">
                  Ketik nama proyek secara langsung atau pilih dari daftar proyek di atas.
                </span>
              </div>

              {/* Nominal Gaji Tenaga Ahli */}
              <div>
                <label className="font-semibold text-navy-text block mb-1">Nominal Gaji (Rp) *</label>
                <input
                  type="number"
                  name="nominalHonor"
                  required
                  defaultValue={editingHonor?.nominalHonor ?? 0}
                  placeholder="0"
                  className="w-full h-8 px-3 rounded-lg border border-border bg-surface-card text-foreground font-mono font-bold"
                />
                <input type="hidden" name="tarifPph21Persen" value="0" />
                <input type="hidden" name="pph21" value="0" />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsHonorModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-border text-muted-stronger hover:bg-surface-hover transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-1.5 rounded-lg bg-navy text-white font-semibold hover:bg-navy-light transition-colors cursor-pointer shadow-2xs"
                >
                  {isPending ? "Menyimpan..." : "Simpan Gaji Tenaga Ahli"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 4: SLIP GAJI PEGAWAI TETAP */}
      {/* ========================================================= */}
      {slipModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-surface-card rounded-2xl border border-border shadow-2xl overflow-hidden">
            {/* Slip Header */}
            <div className="p-6 border-b border-border bg-surface-subtle/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-navy text-white flex items-center justify-center font-bold">
                  <CreditCard size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-navy-text">SLIP GAJI KARYAWAN</h3>
                  <p className="text-xs text-muted-faint">
                    {data.entity?.legalName || data.entity?.name} · Periode {BULAN_NAMES[slipModalItem.bulan - 1]} {slipModalItem.tahun}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSlipModalItem(null)}
                className="p-1.5 text-muted-faint hover:text-navy-text rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            {/* Slip Content */}
            <div className="p-6 space-y-5 text-xs">
              {/* Employee info */}
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-surface-subtle border border-border">
                <div>
                  <span className="text-muted-faint block text-[11px]">Nama Pegawai</span>
                  <strong className="text-navy-text text-sm">{slipModalItem.pegawaiNama}</strong>
                </div>
                <div>
                  <span className="text-muted-faint block text-[11px]">NIK / Kode</span>
                  <span className="font-mono text-navy-text">{slipModalItem.pegawaiNik}</span>
                </div>
                <div>
                  <span className="text-muted-faint block text-[11px]">Jabatan</span>
                  <span className="text-navy-text">{slipModalItem.pegawaiJabatan}</span>
                </div>
                <div>
                  <span className="text-muted-faint block text-[11px]">Periode Penggajian</span>
                  <span className="text-navy-text">{BULAN_NAMES[slipModalItem.bulan - 1]} {slipModalItem.tahun}</span>
                </div>
              </div>

              {/* Items Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Penerimaan */}
                <div className="space-y-2">
                  <h4 className="font-bold text-navy-text border-b border-border pb-1">
                    Penerimaan (Earnings)
                  </h4>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-muted-faint">Gaji Pokok:</span>
                      <span className="font-mono">{slipModalItem.gajiPokokFmt}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-faint">Tunjangan Jabatan:</span>
                      <span className="font-mono">{slipModalItem.tunjanganJabatanFmt}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-faint">Tunjangan Transport:</span>
                      <span className="font-mono">{slipModalItem.tunjanganTransportFmt}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-faint">Insentif / Bonus:</span>
                      <span className="font-mono">{slipModalItem.insentifFmt}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-border font-bold">
                      <span>Total Gaji Kotor:</span>
                      <span className="font-mono text-navy-text">{slipModalItem.totalGajiKotorFmt}</span>
                    </div>
                  </div>
                </div>

                {/* Potongan */}
                <div className="space-y-2">
                  <h4 className="font-bold text-rose-700 dark:text-rose-400 border-b border-border pb-1">
                    Potongan (Deductions)
                  </h4>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-muted-faint">BPJS Kesehatan:</span>
                      <span className="font-mono">{slipModalItem.bpjsKesehatanFmt}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-faint">BPJS Ketenagakerjaan:</span>
                      <span className="font-mono">{slipModalItem.bpjsKetenagakerjaanFmt}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-faint">Potongan PPh 21:</span>
                      <span className="font-mono">{slipModalItem.pph21Fmt}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-faint">Potongan Lainnya:</span>
                      <span className="font-mono">{slipModalItem.potonganLainFmt}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-border font-bold text-rose-700 dark:text-rose-400">
                      <span>Total Potongan:</span>
                      <span className="font-mono">
                        {formatRupiah(
                          slipModalItem.bpjsKesehatan +
                            slipModalItem.bpjsKetenagakerjaan +
                            slipModalItem.pph21 +
                            slipModalItem.potonganLain
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Net Take Home Pay */}
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-emerald-800 dark:text-emerald-300 font-semibold block">
                    TOTAL DITERIMA (TAKE HOME PAY)
                  </span>
                  <span className="text-[10px] text-muted-faint">
                    Ditransfer ke rekening pegawai
                  </span>
                </div>
                <div className="text-lg font-bold font-mono text-emerald-700 dark:text-emerald-300">
                  {slipModalItem.totalGajiBersihFmt}
                </div>
              </div>

              {slipModalItem.catatan && (
                <div className="text-[11px] text-muted-faint italic">
                  Catatan: {slipModalItem.catatan}
                </div>
              )}

              {/* Action */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl bg-navy text-white text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-navy-light transition-colors cursor-pointer shadow-2xs"
                >
                  <Printer size={14} />
                  <span>Cetak Slip Gaji</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 5: MASTER DATABASE TENAGA AHLI */}
      {/* ========================================================= */}
      {isMasterAhliModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-surface-card rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface-subtle/50">
              <h3 className="text-sm font-bold text-navy-text flex items-center gap-2">
                <Users size={16} />
                <span>
                  {editingMasterAhli?.id
                    ? "Edit Data Tenaga Ahli"
                    : "Tambah Tenaga Ahli Baru"}
                </span>
              </h3>
              <button
                onClick={() => setIsMasterAhliModalOpen(false)}
                className="p-1 text-muted-faint hover:text-navy-text rounded-lg transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const fd = new FormData(form);
                startTransition(async () => {
                  try {
                    const res = await saveTenagaAhliMasterAction(fd);
                    setSuccessMsg(res.message);
                    setIsMasterAhliModalOpen(false);
                    if (res.data?.id) {
                      setSelectedRekananIdForHonor(res.data.id);
                    }
                    router.refresh();
                  } catch (err: unknown) {
                    setErrorMsg((err as Error).message);
                  }
                });
              }}
              className="p-5 space-y-4 text-xs"
            >
              {editingMasterAhli?.id && (
                <input type="hidden" name="id" value={editingMasterAhli.id} />
              )}
              <input type="hidden" name="entityId" value={data.entity?.id ?? ""} />

              <div>
                <label className="font-semibold text-navy-text block mb-1">
                  Nama Lengkap & Gelar *
                </label>
                <input
                  type="text"
                  name="nama"
                  required
                  defaultValue={editingMasterAhli?.nama ?? ""}
                  placeholder="Contoh: Ir. Budi Santoso, M.T."
                  className="w-full h-8 px-3 rounded-lg border border-border bg-surface-card text-foreground font-semibold"
                />
              </div>

              <div>
                <label className="font-semibold text-navy-text block mb-1">
                  NIK (Nomor Induk Kependudukan - 16 Digit) *
                </label>
                <input
                  type="text"
                  name="nik"
                  required
                  minLength={16}
                  maxLength={16}
                  defaultValue={editingMasterAhli?.nik ?? ""}
                  placeholder="Contoh: 6203011204850002"
                  className="w-full h-8 px-3 rounded-lg border border-border bg-surface-card text-foreground font-mono"
                />
                <span className="text-[10px] text-muted-faint mt-0.5 block">
                  Wajib 16 digit angka. NIK menjadi patokan pelacakan honor lintas entitas dan proyek.
                </span>
              </div>

              <div>
                <label className="font-semibold text-navy-text block mb-1">
                  NPWP (Opsional)
                </label>
                <input
                  type="text"
                  name="npwp"
                  defaultValue={editingMasterAhli?.npwp ?? ""}
                  placeholder="Contoh: 75.888.999.1-711.000"
                  className="w-full h-8 px-3 rounded-lg border border-border bg-surface-card text-foreground font-mono"
                />
                <span className="text-[10px] text-muted-faint mt-0.5 block">
                  Nomor Pokok Wajib Pajak tenaga ahli (opsional sebagai kelengkapan administrasi).
                </span>
              </div>

              <div>
                <label className="font-semibold text-navy-text block mb-1">
                  Bidang Keahlian / Spesialisasi (Opsional)
                </label>
                <input
                  type="text"
                  name="kategori"
                  defaultValue={editingMasterAhli?.kategori ?? ""}
                  placeholder="Contoh: Tenaga Ahli Struktur / Arsitektur / Geoteknik"
                  className="w-full h-8 px-3 rounded-lg border border-border bg-surface-card text-foreground"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsMasterAhliModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-border text-muted-stronger hover:bg-surface-hover transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-1.5 rounded-lg bg-navy text-white font-semibold hover:bg-navy-light transition-colors cursor-pointer shadow-2xs"
                >
                  {isPending ? "Menyimpan..." : "Simpan Tenaga Ahli"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
