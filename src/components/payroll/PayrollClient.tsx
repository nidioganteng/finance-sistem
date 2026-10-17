"use client";

import { useState, useEffect, useTransition, Fragment } from "react";
import { createPortal } from "react-dom";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Role } from "@/types/app-enums";
import {
  Users,
  Award,
  Scale,
  ShieldCheck,
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
  HelpCircle,
  ExternalLink,
  Info,
  Lock,
  History,
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
  type RekapTenagaAhliPerProyekItem,
  type JurnalTransaksiGajiItem,
  type PenyesuaianAkunGaji,
  BULAN_NAMES,
  PTKP_RATES,
} from "@/lib/payroll";
import { RekonsiliasiPajakGajiClient } from "@/components/pajak/RekonsiliasiPajakGajiClient";
import { type RekonsiliasiPajakGajiData } from "@/lib/rekonsiliasi-pajak-gaji";
import {
  createPegawaiAction,
  updatePegawaiAction,
  updatePegawaiStatusAction,
  deletePegawaiAction,
  saveGajiBulananAction,
  deleteGajiBulananAction,
  saveHonorTenagaAhliAction,
  deleteHonorTenagaAhliAction,
  saveTenagaAhliMasterAction,
  deleteTenagaAhliMasterAction,
} from "@/lib/actions/payroll";
import { formatRupiah } from "@/lib/dashboard-data";

type PayrollData = {
  entity: { id: string; key: string; name: string; legalName: string } | null;
  allEntities: { id: string; key: string; name: string; legalName: string }[];
  projects: { id: string; code: string; name: string }[];
  rekananTenagaAhli: { id: string; nama: string; nik: string | null; npwp: string | null; kategori: string | null; ptkp?: string | null }[];
  year: number;
  month: number;
  pegawaiList: PegawaiItem[];
  allPegawaiMaster?: PegawaiItem[];
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
    totalTunjanganBpjs: number;
    totalTunjanganBpjsFmt?: string;
    totalTunjanganPph: number;
    totalTunjanganPphFmt?: string;
    totalThr: number;
    totalThrFmt?: string;
    totalBpjsKesehatan: number;
    totalBpjsKesehatanFmt: string;
    totalBpjsKetenagakerjaan: number;
    totalBpjsKetenagakerjaanFmt: string;
    totalPotonganBpjs: number;
    totalPotonganBpjsFmt?: string;
    totalPotonganLain: number;
    totalPotonganLainFmt: string;
    totalPph21: number;
    totalPph21Fmt: string;
    totalGajiKotor: number;
    totalGajiKotorFmt: string;
    totalGajiTerlaporPajak: number;
    totalGajiTerlaporPajakFmt?: string;
    totalGajiBersih: number;
    totalGajiBersihFmt: string;
  };
  honorList: HonorTenagaAhliItem[];
  allHonorBulanIni: HonorTenagaAhliItem[];
  rekapBulananTenagaAhli: RekapBulanTenagaAhliItem[];
  rekapTenagaAhliPerNama: RekapTenagaAhliPerNamaItem[];
  rekapTenagaAhliPerProyek: RekapTenagaAhliPerProyekItem[];
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
  penyesuaianJurnal: PenyesuaianAkunGaji;
  syncData: PayrollSyncLabaRugi;
};

function formatRupiahInput(val: string | number | undefined | null) {
  if (val === undefined || val === null || val === "" || val === 0 || val === "0") return "";
  const num = String(val).replace(/[^0-9]/g, "");
  if (!num) return "";
  return Number(num).toLocaleString("id-ID");
}

export function PayrollClient({
  data,
  rekonsiliasiData,
  userRole,
  initialTab,
  selectedYear,
  selectedMonth,
}: {
  data: PayrollData;
  rekonsiliasiData: RekonsiliasiPajakGajiData;
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

  // Tab utama: "pegawai" | "tenaga-ahli" | "sync" | "rekonsiliasi"
  const [mainTab, setMainTab] = useState<"pegawai" | "tenaga-ahli" | "sync" | "rekonsiliasi">(
    (initialTab as "pegawai" | "tenaga-ahli" | "sync" | "rekonsiliasi") || "pegawai"
  );

  // Sub-tab pegawai: "gaji" (Gaji Per Bulan) | "rekap-bulan" (Rekap Gaji Setahun) | "penyesuaian" | "master" | "tahunan"
  const [pegawaiSubTab, setPegawaiSubTab] = useState<
    "gaji" | "rekap-bulan" | "penyesuaian" | "master" | "tahunan"
  >("gaji");

  // Sub-tab tenaga ahli: "honor" (Honor Per Bulan) | "rekap-proyek" (Rekap Per Proyek) | "rekap-bulan" (Rekap Gaji Setahun) | "penyesuaian" | "database-ahli" | "rekap-nama" | "konsolidasi"
  const [tenagaAhliSubTab, setTenagaAhliSubTab] = useState<
    "honor" | "rekap-proyek" | "rekap-bulan" | "penyesuaian" | "database-ahli" | "rekap-nama" | "konsolidasi"
  >("honor");

  // Filter Tenaga Ahli (Gaji Bulanan)
  const [honorFilterScope, setHonorFilterScope] = useState<"entitas" | "holding">("entitas");
  const [honorFilterProyek, setHonorFilterProyek] = useState<string>("ALL");

  // Filter periode penyesuaian jurnal (Bulan ini vs Sepanjang tahun)
  const [periodeFilterPegawai, setPeriodeFilterPegawai] = useState<"bulan" | "tahun">("bulan");
  const [periodeFilterAhli, setPeriodeFilterAhli] = useState<"bulan" | "tahun">("bulan");

  // Tab rincian transaksi di Tab Sinkronisasi: "pegawai" (Akun 511) | "tenaga-ahli" (Akun 612)
  const [syncDetailTab, setSyncDetailTab] = useState<"pegawai" | "tenaga-ahli">("pegawai");

  // Filter entitas untuk tab Cek Per Nama
  const [filterEntitasNama, setFilterEntitasNama] = useState<string>("ALL");

  // State expand rincian per NIK untuk Tenaga Ahli
  const [expandedNik, setExpandedNik] = useState<string | null>(null);

  // Filter search
  const [searchQuery, setSearchQuery] = useState("");

  // Modals state
  const [isPegawaiModalOpen, setIsPegawaiModalOpen] = useState(false);
  const [editingPegawai, setEditingPegawai] = useState<PegawaiItem | null>(null);
  const [modalPegawaiStatus, setModalPegawaiStatus] = useState<"AKTIF" | "RESIGN" | "PENSIUN">("AKTIF");
  const [modalTanggalResign, setModalTanggalResign] = useState<string>("");
  const [masterStatusFilter, setMasterStatusFilter] = useState<"ALL" | "AKTIF" | "RESIGN" | "PENSIUN">("ALL");
  const [quickStatusTarget, setQuickStatusTarget] = useState<{
    pegawai: PegawaiItem;
    status: "AKTIF" | "RESIGN" | "PENSIUN";
    tanggal: string;
  } | null>(null);

  // Modal konfirmasi hapus kustom (menggantikan browser confirm)
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    title: string;
    itemName: string;
    itemSub?: string;
    warningNote?: string;
    confirmLabel?: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  const [isGajiModalOpen, setIsGajiModalOpen] = useState(false);
  const [editingGaji, setEditingGaji] = useState<{
    pegawai: PegawaiItem;
    gaji?: GajiBulananItem | null;
  } | null>(null);

  // Controlled state untuk Modal Gaji Bulanan (Dinamis Bulan, Tahun, Otomatisasi Transport, Dual Total)
  const [modalGajiBulan, setModalGajiBulan] = useState<number>(selectedMonth);
  const [modalGajiTahun, setModalGajiTahun] = useState<number>(selectedYear);
  const [modalGajiPegawaiId, setModalGajiPegawaiId] = useState<string>("");
  const [modalGajiPokok, setModalGajiPokok] = useState<number>(0);
  const [modalTunjanganJabatan, setModalTunjanganJabatan] = useState<number>(0);
  const [modalHariKerja, setModalHariKerja] = useState<number>(20);
  const [modalTarifTransport, setModalTarifTransport] = useState<number>(15000);
  const [modalTunjanganTransport, setModalTunjanganTransport] = useState<number>(300000);
  const [modalInsentif, setModalInsentif] = useState<number>(0);
  const [modalTunjanganLainnya, setModalTunjanganLainnya] = useState<number>(0);
  const [modalThr, setModalThr] = useState<number>(0);
  const [modalTunjanganBpjs, setModalTunjanganBpjs] = useState<number>(0);
  const [modalTunjanganBpjsKes, setModalTunjanganBpjsKes] = useState<number>(0);
  const [modalTunjanganBpjsTk, setModalTunjanganBpjsTk] = useState<number>(0);
  const [modalTunjanganPph, setModalTunjanganPph] = useState<number>(0);
  const [modalPotonganBpjs, setModalPotonganBpjs] = useState<number>(0);
  const [modalBpjsKes, setModalBpjsKes] = useState<number>(0);
  const [modalBpjsTk, setModalBpjsTk] = useState<number>(0);
  const [modalPph21, setModalPph21] = useState<number>(0);
  const [modalPotonganLain, setModalPotonganLain] = useState<number>(0);
  const [modalCatatan, setModalCatatan] = useState<string>("");

  // Sinkronisasi state form modal gaji bulanan saat modal dibuka atau pegawai berubah
  useEffect(() => {
    if (editingGaji) {
      const p = editingGaji.pegawai;
      const g = editingGaji.gaji;
      setModalGajiPegawaiId(p.id);
      setModalGajiBulan(g?.bulan ?? selectedMonth);
      setModalGajiTahun(g?.tahun ?? selectedYear);
      setModalGajiPokok(g ? g.gajiPokok : p.gajiPokok);
      // Poin 3: Tunjangan Jabatan terisi otomatis dari master data jika belum ada input bulanan
      setModalTunjanganJabatan(g ? g.tunjanganJabatan : (p.tunjanganJabatan ?? 0));
      // Poin 2: Hari kerja & tarif harian (default 15.000, fleksibel diedit per bulan)
      const hk = g?.hariKerja ?? 20;
      const tarif = g?.tarifTransportHarian ?? 15000;
      setModalHariKerja(hk);
      setModalTarifTransport(tarif);
      setModalTunjanganTransport(g?.tunjanganTransport ?? (hk * tarif));
      const tLain = g ? (g.tunjanganLainnya || g.insentif) : 0;
      setModalInsentif(tLain);
      setModalTunjanganLainnya(tLain);
      setModalThr(g?.thr ?? 0);
      setModalTunjanganBpjsKes(g?.tunjanganBpjsKes ?? 0);
      setModalTunjanganBpjsTk(g?.tunjanganBpjsTk ?? 0);
      setModalTunjanganBpjs(
        g?.tunjanganBpjs ?? ((g?.tunjanganBpjsKes ?? 0) + (g?.tunjanganBpjsTk ?? 0))
      );
      setModalTunjanganPph(g?.tunjanganPph ?? 0);
      setModalPotonganBpjs(
        g?.potonganBpjs ?? ((g?.bpjsKesehatan ?? 0) + (g?.bpjsKetenagakerjaan ?? 0))
      );
      setModalBpjsKes(g?.bpjsKesehatan ?? 0);
      setModalBpjsTk(g?.bpjsKetenagakerjaan ?? 0);
      setModalPph21(g?.pph21 ?? 0);
      setModalPotonganLain(g?.potonganLain ?? 0);
      setModalCatatan(g?.catatan ?? "");
    }
  }, [editingGaji, selectedMonth, selectedYear]);

  function handleSelectPegawaiInModal(pegawaiId: string) {
    const target = data.pegawaiList.find((p) => p.id === pegawaiId);
    if (!target) return;
    setEditingGaji({ pegawai: target, gaji: target.currentGaji });
    setModalGajiPegawaiId(target.id);
    const g = target.currentGaji;
    setModalGajiPokok(g ? g.gajiPokok : target.gajiPokok);
    setModalTunjanganJabatan(g ? g.tunjanganJabatan : (target.tunjanganJabatan ?? 0));
    const hk = g?.hariKerja ?? 20;
    const tarif = g?.tarifTransportHarian ?? modalTarifTransport ?? 15000;
    setModalHariKerja(hk);
    setModalTarifTransport(tarif);
    setModalTunjanganTransport(g?.tunjanganTransport ?? (hk * tarif));
    const tLain = g ? (g.tunjanganLainnya || g.insentif) : 0;
    setModalInsentif(tLain);
    setModalTunjanganLainnya(tLain);
    setModalThr(g?.thr ?? 0);
    setModalTunjanganBpjsKes(g?.tunjanganBpjsKes ?? 0);
    setModalTunjanganBpjsTk(g?.tunjanganBpjsTk ?? 0);
    setModalTunjanganBpjs(
      g?.tunjanganBpjs ?? ((g?.tunjanganBpjsKes ?? 0) + (g?.tunjanganBpjsTk ?? 0))
    );
    setModalTunjanganPph(g?.tunjanganPph ?? 0);
    setModalPotonganBpjs(
      g?.potonganBpjs ?? ((g?.bpjsKesehatan ?? 0) + (g?.bpjsKetenagakerjaan ?? 0))
    );
    setModalBpjsKes(g?.bpjsKesehatan ?? 0);
    setModalBpjsTk(g?.bpjsKetenagakerjaan ?? 0);
    setModalPph21(g?.pph21 ?? 0);
    setModalPotonganLain(g?.potonganLain ?? 0);
    setModalCatatan(g?.catatan ?? "");
  }

  const [isHonorModalOpen, setIsHonorModalOpen] = useState(false);
  const [editingHonor, setEditingHonor] = useState<HonorTenagaAhliItem | null>(null);

  // Controlled states untuk Modal Gaji Tenaga Ahli (Periode Dinamis, PTKP, PPh 21/23 Manual, Realisasi Proyek)
  const [modalHonorBulan, setModalHonorBulan] = useState<number>(selectedMonth);
  const [modalHonorTahun, setModalHonorTahun] = useState<number>(selectedYear);
  const [modalHonorTanggal, setModalHonorTanggal] = useState<string>("");
  const [modalHonorPtkp, setModalHonorPtkp] = useState<string>("TK/0");
  const [modalHonorJenisPph, setModalHonorJenisPph] = useState<string>("PPh 21");
  const [modalHonorNominal, setModalHonorNominal] = useState<number>(0);
  const [modalHonorTarifPph, setModalHonorTarifPph] = useState<number>(0);
  const [modalHonorNominalPph, setModalHonorNominalPph] = useState<number>(0);
  const [modalHonorProjectId, setModalHonorProjectId] = useState<string>("");
  const [modalHonorNamaProyek, setModalHonorNamaProyek] = useState<string>("");
  const [modalHonorUraian, setModalHonorUraian] = useState<string>("");
  const [modalHonorNoBukti, setModalHonorNoBukti] = useState<string>("");

  function openHonorModal(h?: HonorTenagaAhliItem | null, rekananId?: string) {
    if (h) {
      setEditingHonor(h);
      setModalHonorBulan(h.bulan);
      setModalHonorTahun(h.tahun);
      const dStr = h.tanggal
        ? new Date(h.tanggal).toISOString().split("T")[0]
        : `${h.tahun}-${String(h.bulan).padStart(2, "0")}-01`;
      setModalHonorTanggal(dStr);
      setModalHonorPtkp(h.ptkp || "TK/0");
      setModalHonorJenisPph(h.jenisPph || "PPh 21");
      setModalHonorNominal(h.nominalHonor || 0);
      setModalHonorTarifPph(h.tarifPph21Persen || 0);
      setModalHonorNominalPph(h.pph21 || 0);
      setModalHonorProjectId(h.projectId || "");
      setModalHonorNamaProyek(h.namaProyek || h.projectName || "");
      setModalHonorUraian(h.uraian || "");
      setModalHonorNoBukti(h.noBukti || "");
      setSelectedRekananIdForHonor(h.rekananId || "");
    } else {
      setEditingHonor(null);
      setModalHonorBulan(selectedMonth);
      setModalHonorTahun(selectedYear);
      const today = new Date();
      const isCurrentPeriod =
        today.getFullYear() === selectedYear && today.getMonth() + 1 === selectedMonth;
      const defaultDate = isCurrentPeriod
        ? today.toISOString().split("T")[0]
        : `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-01`;
      setModalHonorTanggal(defaultDate);
      const targetRekananId = rekananId || (data.rekananTenagaAhli.length > 0 ? data.rekananTenagaAhli[0].id : "");
      setSelectedRekananIdForHonor(targetRekananId);
      const matchedRekanan = data.rekananTenagaAhli.find((r) => r.id === targetRekananId);
      setModalHonorPtkp(matchedRekanan?.ptkp || "TK/0");
      setModalHonorJenisPph("PPh 21");
      setModalHonorNominal(0);
      setModalHonorTarifPph(0);
      setModalHonorNominalPph(0);
      setModalHonorProjectId("");
      setModalHonorNamaProyek("");
      setModalHonorUraian("");
      setModalHonorNoBukti("");
    }
    setIsHonorModalOpen(true);
  }

  // Master Tenaga Ahli Modal
  const [isMasterAhliModalOpen, setIsMasterAhliModalOpen] = useState(false);
  const [editingMasterAhli, setEditingMasterAhli] = useState<{
    id?: string;
    nama: string;
    nik: string | null;
    npwp: string | null;
    kategori: string | null;
    ptkp?: string | null;
  } | null>(null);

  // State selection di modal honor
  const [selectedRekananIdForHonor, setSelectedRekananIdForHonor] = useState<string>("");

  const [slipModalItem, setSlipModalItem] = useState<GajiBulananItem | null>(null);
  const [riwayatPegawaiTarget, setRiwayatPegawaiTarget] = useState<PegawaiItem | null>(null);

  // Toast / Error state
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Bersihkan notifikasi error/sukses setiap kali berganti tab utama atau sub-tab
  useEffect(() => {
    setErrorMsg(null);
    setSuccessMsg(null);
  }, [mainTab, pegawaiSubTab, tenagaAhliSubTab]);

  function handleMonthChange(newMonth: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", newMonth.toString());
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleTabChange(tab: "pegawai" | "tenaga-ahli" | "sync" | "rekonsiliasi") {
    setErrorMsg(null);
    setSuccessMsg(null);
    setMainTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.push(`${pathname}?${params.toString()}`);
  }

  // Filter items based on query untuk penggajian bulanan:
  // Karyawan berstatus RESIGN atau PENSIUN hanya muncul jika memang SUDAH memiliki data gaji di bulan ini (arsip).
  // Jika belum digaji di bulan ini, langsung dihilangkan dari daftar input penggajian bulanan.
  const filteredPegawaiList = data.pegawaiList.filter((p) => {
    const isInactive =
      (p.status ?? (p.isActive ? "AKTIF" : "RESIGN")) === "RESIGN" ||
      (p.status ?? (p.isActive ? "AKTIF" : "RESIGN")) === "PENSIUN" ||
      !p.isActive;
    if (isInactive && !p.currentGaji) {
      return false;
    }

    return (
      p.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.nik.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.jabatan.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  // Master Pegawai Tetap (seluruh profil karyawan)
  const allMasterPegawai = data.allPegawaiMaster ?? data.pegawaiList;
  const filteredMasterList = allMasterPegawai.filter((p) => {
    const matchesSearch =
      p.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.nik.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.jabatan.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    const currentStatus = p.status ?? (p.isActive ? "AKTIF" : "RESIGN");
    if (masterStatusFilter === "ALL") return true;
    return currentStatus === masterStatusFilter;
  });

  const masterCountAktif = allMasterPegawai.filter(
    (p) => (p.status ?? (p.isActive ? "AKTIF" : "RESIGN")) === "AKTIF"
  ).length;
  const masterCountResign = allMasterPegawai.filter(
    (p) => (p.status ?? (p.isActive ? "AKTIF" : "RESIGN")) === "RESIGN"
  ).length;
  const masterCountPensiun = allMasterPegawai.filter(
    (p) => (p.status ?? (p.isActive ? "AKTIF" : "RESIGN")) === "PENSIUN"
  ).length;

  // Filter rekapitulasi tahunan (menampilkan seluruh pegawai yang pernah digaji tahun ini atau berstatus aktif)
  const filteredTahunanList = allMasterPegawai.filter((p) => {
    const matchesSearch =
      p.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.nik.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.jabatan.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    return (p.akumulasiTahun?.bulanTerbayar ?? 0) > 0 || (p.status ?? (p.isActive ? "AKTIF" : "RESIGN")) === "AKTIF";
  });

  const baseHonorList =
    honorFilterScope === "holding"
      ? data.allHonorBulanIni || data.honorList
      : data.honorList;

  const filteredHonorList = baseHonorList.filter((h) => {
    const matchSearch =
      h.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.nik.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.uraian.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (h.namaProyek && h.namaProyek.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (h.projectName && h.projectName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (h.entityName && h.entityName.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchProyek =
      honorFilterProyek === "ALL" ||
      h.projectId === honorFilterProyek ||
      h.projectCode === honorFilterProyek ||
      h.namaProyek === honorFilterProyek;

    return matchSearch && matchProyek;
  });

  const totalHonorBrutoFiltered = filteredHonorList.reduce(
    (acc, h) => acc + h.nominalHonor,
    0
  );
  const totalHonorPphFiltered = filteredHonorList.reduce(
    (acc, h) => acc + (h.pph21 || 0),
    0
  );
  const totalHonorBersihFiltered = filteredHonorList.reduce(
    (acc, h) =>
      acc + (h.nominalBersih || Math.max(0, h.nominalHonor - (h.pph21 || 0))),
    0
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

          <button
            onClick={() => handleTabChange("rekonsiliasi")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer ${
              mainTab === "rekonsiliasi"
                ? "bg-navy text-white shadow-sm"
                : "bg-surface-subtle text-muted-stronger hover:bg-surface-hover"
            }`}
          >
            <ShieldCheck size={15} />
            <span>Rekonsiliasi PPh 21 (SPT)</span>
            {rekonsiliasiData?.summary.overallStatus === "ALL_BALANCED" ? (
              <span className="w-2 h-2 rounded-full bg-emerald-400" title="Semua 12 Bulan Balance" />
            ) : rekonsiliasiData?.summary.overallStatus === "HAS_DIFF" ? (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" title="Terdapat Selisih Jurnal vs SPT" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-amber-400" title="Sebagian Belum Dilaporkan" />
            )}
          </button>
        </div>

        {/* Month Selector Pills (Hanya saat di Tab Bulanan) */}
        {mainTab !== "rekonsiliasi" && (
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
        )}
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
                onClick={() => setPegawaiSubTab("penyesuaian")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                  pegawaiSubTab === "penyesuaian"
                    ? "bg-surface-card text-navy-text shadow-2xs font-bold"
                    : "text-muted-faint hover:text-navy-text hover:bg-surface-card/50"
                }`}
              >
                <Scale size={13} className={pegawaiSubTab === "penyesuaian" ? "text-navy" : "text-muted-faint"} />
                <span>Penyesuaian Gaji</span>
                {(periodeFilterPegawai === "bulan"
                  ? data.penyesuaianJurnal.pegawai.isSinkronBulan
                  : data.penyesuaianJurnal.pegawai.isSinkronTahun) ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                )}
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
                  {pegawaiSubTab === "penyesuaian" ? (
                    <Link
                      href={`/jurnal?entity=${data.entity?.key ?? ""}`}
                      className="h-8 px-3 rounded-xl bg-navy text-white text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-navy-light transition-colors whitespace-nowrap cursor-pointer shadow-2xs"
                    >
                      <ExternalLink size={14} />
                      <span>Buka Jurnal Umum</span>
                    </Link>
                  ) : pegawaiSubTab === "master" ? (
                    <button
                      onClick={() => {
                        setEditingPegawai(null);
                        setModalPegawaiStatus("AKTIF");
                        setModalTanggalResign("");
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
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
            <div className="p-4 rounded-2xl border border-border bg-surface-card flex flex-col justify-between">
              <div>
                <div className="text-[11px] font-medium text-muted-faint truncate">
                  Pegawai Terdaftar ({BULAN_NAMES[selectedMonth - 1]})
                </div>
                <div className="text-xl font-bold font-mono text-navy-text mt-1">
                  {data.summaryBulanIni.totalPegawaiInput} / {data.summaryBulanIni.totalPegawaiAktif}
                </div>
              </div>
              <div className="text-[10px] text-muted-faint mt-1 truncate">
                Sudah diinput dari total aktif
              </div>
            </div>

            <div className="p-4 rounded-2xl border border-border bg-surface-card flex flex-col justify-between">
              <div>
                <div className="text-[11px] font-medium text-muted-faint truncate">
                  Gaji Pokok Total
                </div>
                <div className="text-xl font-bold font-mono text-navy-text mt-1">
                  {data.summaryBulanIni.totalGajiPokokFmt}
                </div>
              </div>
              <div className="text-[10px] text-muted-faint mt-1 truncate">
                Gaji pokok bulan {BULAN_NAMES[selectedMonth - 1]}
              </div>
            </div>

            <div className="p-4 rounded-2xl border border-border bg-surface-card flex flex-col justify-between">
              <div>
                <div className="text-[11px] font-medium text-muted-faint truncate">
                  Tunjangan, THR & Insentif
                </div>
                <div className="text-xl font-bold font-mono text-amber-700 dark:text-amber-300 mt-1">
                  {formatRupiah(
                    data.summaryBulanIni.totalTunjanganJabatan +
                      data.summaryBulanIni.totalTunjanganTransport +
                      data.summaryBulanIni.totalInsentif +
                      (data.summaryBulanIni.totalThr ?? 0) +
                      (data.summaryBulanIni.totalTunjanganBpjs ?? 0) +
                      (data.summaryBulanIni.totalTunjanganPph ?? 0)
                  )}
                </div>
              </div>
              <div className="text-[10px] text-muted-faint mt-1 truncate">
                Jabatan, transport, THR & tunjangan
              </div>
            </div>

            <div className="p-4 rounded-2xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20 flex flex-col justify-between">
              <div>
                <div className="text-[11px] font-semibold text-blue-800 dark:text-blue-300 flex items-center justify-between gap-1.5">
                  <span className="truncate">Total Terlapor Pajak</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 font-mono font-bold whitespace-nowrap shrink-0">
                    SPT PPh 21
                  </span>
                </div>
                <div className="text-xl font-bold font-mono text-blue-900 dark:text-blue-200 mt-1">
                  {data.summaryBulanIni.totalGajiTerlaporPajakFmt || formatRupiah(data.summaryBulanIni.totalGajiTerlaporPajak)}
                </div>
              </div>
              <div className="text-[10px] text-blue-700/80 dark:text-blue-300/70 mt-1 flex items-center justify-between gap-1">
                <span className="truncate">Total bruto pelaporan SPT Masa</span>
                <span className="text-[9px] font-semibold text-blue-600 dark:text-blue-400 whitespace-nowrap shrink-0">
                  Ditanggung
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20 flex flex-col justify-between">
              <div>
                <div className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 flex items-center justify-between gap-1.5">
                  <span className="truncate">Total Gaji Bersih</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-200 font-mono font-bold whitespace-nowrap shrink-0">
                    Kas / GL 511
                  </span>
                </div>
                <div className="text-xl font-bold font-mono text-emerald-800 dark:text-emerald-200 mt-1">
                  {data.summaryBulanIni.totalGajiBersihFmt}
                </div>
              </div>
              <div className="text-[10px] text-emerald-700/80 dark:text-emerald-300/70 mt-1 flex items-center justify-between gap-1">
                <span className="truncate">Setelah BPJS & kasbon</span>
                {data.penyesuaianJurnal.pegawai.isSinkronBulan ? (
                  <span className="text-[9px] font-semibold text-emerald-700 dark:text-emerald-300 font-mono whitespace-nowrap shrink-0">
                    ✓ Balance
                  </span>
                ) : (
                  <button
                    onClick={() => setPegawaiSubTab("penyesuaian")}
                    className="text-[9px] font-bold text-amber-700 dark:text-amber-300 hover:underline cursor-pointer whitespace-nowrap shrink-0"
                    title={`Selisih Akun 511: ${data.penyesuaianJurnal.pegawai.selisihBulanFmt}`}
                  >
                    ⚠️ Cek Jurnal
                  </button>
                )}
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
                </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] text-left text-xs">
                  <thead className="bg-surface-subtle border-b border-border text-muted-stronger font-bold">
                    <tr>
                      <th className="py-2.5 px-3.5">Pegawai</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[105px]">Gaji Pokok</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[95px]">Tunj. Jabatan</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[115px]">Tunj. Transport</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[95px]">Insentif/Lain</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[85px]">THR</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[125px] bg-blue-50/60 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200">
                        Terlapor Pajak (Bruto)
                      </th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[85px]">BPJS</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[80px]">PPh 21</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[125px] bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200">
                        Gaji Bersih (THP)
                      </th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[120px]">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredPegawaiList.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="py-8 text-center text-muted-faint">
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
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-navy-text text-sm">{p.nama}</span>
                                {p.status === "RESIGN" && (
                                  <span
                                    className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60"
                                    title={`Karyawan Resign: ${p.tanggalResignFmt ?? "-"}`}
                                  >
                                    Resign {p.tanggalResignFmt ? `(${p.tanggalResignFmt})` : ""}
                                  </span>
                                )}
                                {p.status === "PENSIUN" && (
                                  <span
                                    className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60"
                                    title={`Karyawan Pensiun: ${p.tanggalResignFmt ?? "-"}`}
                                  >
                                    Pensiun {p.tanggalResignFmt ? `(${p.tanggalResignFmt})` : ""}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-muted-faint mt-0.5 flex items-center gap-1.5 flex-wrap">
                                <span className="font-mono">{p.nik}</span>
                                <span>·</span>
                                <span>{p.jabatan}</span>
                                <span>·</span>
                                <span className="px-1.5 py-0.2 rounded bg-surface-subtle font-mono text-[10px]">
                                  {p.statusKeluarga}
                                </span>
                                {p.masaKerja && (
                                  <>
                                    <span>·</span>
                                    <span
                                      className="px-1.5 py-0.2 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-mono text-[10px] font-medium border border-amber-200 dark:border-amber-800/60"
                                      title={`Mulai Bekerja: ${p.tanggalMasukFmt ?? "-"}`}
                                    >
                                      Masa Kerja: {p.masaKerja}
                                    </span>
                                  </>
                                )}
                              </div>
                            </td>

                            <td className="py-3 px-3.5 text-right font-mono text-navy-text whitespace-nowrap">
                              {gaji ? gaji.gajiPokokFmt : p.gajiPokokFmt}
                            </td>

                            <td className="py-3 px-3.5 text-right font-mono text-muted-stronger whitespace-nowrap">
                              {gaji
                                ? gaji.tunjanganJabatanFmt
                                : p.tunjanganJabatanFmt || formatRupiah(p.tunjanganJabatan)}
                            </td>

                            <td className="py-3 px-3.5 text-right font-mono text-muted-stronger whitespace-nowrap">
                              <div>{gaji ? gaji.tunjanganTransportFmt : "Rp 0"}</div>
                              {gaji && gaji.hariKerja > 0 && (
                                <div className="text-[10px] text-muted-faint font-sans">
                                  {gaji.hariKerja} hr × {formatRupiah(gaji.tarifTransportHarian || 15000)}
                                </div>
                              )}
                            </td>

                            <td className="py-3 px-3.5 text-right font-mono text-muted-stronger whitespace-nowrap">
                              {gaji
                                ? formatRupiah(
                                    (gaji.insentif || 0) +
                                      (gaji.tunjanganBpjs || 0) +
                                      (gaji.tunjanganPph || 0)
                                  )
                                : "Rp 0"}
                            </td>

                            <td className="py-3 px-3.5 text-right font-mono text-muted-stronger whitespace-nowrap">
                              {gaji ? (gaji.thrFmt || formatRupiah(gaji.thr || 0)) : "Rp 0"}
                            </td>

                            <td className="py-3 px-3.5 text-right font-mono font-bold text-blue-900 dark:text-blue-200 bg-blue-50/30 dark:bg-blue-950/15 whitespace-nowrap">
                              {gaji
                                ? (gaji.totalGajiTerlaporPajakFmt || gaji.totalGajiKotorFmt)
                                : p.gajiPokokFmt}
                            </td>

                            <td className="py-3 px-3.5 text-right font-mono text-rose-700 dark:text-rose-300 whitespace-nowrap">
                              {gaji
                                ? (gaji.potonganBpjsFmt ||
                                    formatRupiah(
                                      gaji.potonganBpjs ||
                                        (gaji.bpjsKesehatan + gaji.bpjsKetenagakerjaan)
                                    ))
                                : "Rp 0"}
                            </td>

                            <td className="py-3 px-3.5 text-right font-mono text-amber-700 dark:text-amber-300 whitespace-nowrap">
                              {gaji ? gaji.pph21Fmt : "Rp 0"}
                            </td>

                            <td className="py-3 px-3.5 text-right font-mono font-bold text-emerald-800 dark:text-emerald-200 bg-emerald-50/30 dark:bg-emerald-950/15 whitespace-nowrap">
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
                          Total ({data.summaryBulanIni.totalPegawaiInput} Terinput):
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
                          {formatRupiah(
                            data.summaryBulanIni.totalInsentif +
                              (data.summaryBulanIni.totalTunjanganBpjs ?? 0) +
                              (data.summaryBulanIni.totalTunjanganPph ?? 0)
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono whitespace-nowrap">
                          {data.summaryBulanIni.totalThrFmt || formatRupiah(data.summaryBulanIni.totalThr ?? 0)}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono text-blue-900 dark:text-blue-200 bg-blue-50/40 dark:bg-blue-950/20 whitespace-nowrap">
                          {data.summaryBulanIni.totalGajiTerlaporPajakFmt ||
                            formatRupiah(data.summaryBulanIni.totalGajiTerlaporPajak)}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono text-rose-700 dark:text-rose-300 whitespace-nowrap">
                          {data.summaryBulanIni.totalPotonganBpjsFmt ||
                            formatRupiah(
                              data.summaryBulanIni.totalPotonganBpjs ||
                                (data.summaryBulanIni.totalBpjsKesehatan +
                                  data.summaryBulanIni.totalBpjsKetenagakerjaan)
                            )}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono text-amber-700 dark:text-amber-300 whitespace-nowrap">
                          {data.summaryBulanIni.totalPph21Fmt}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono text-emerald-800 dark:text-emerald-200 bg-emerald-50/40 dark:bg-emerald-950/20 whitespace-nowrap">
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
                <table className="w-full min-w-[1020px] text-left text-xs">
                  <thead className="bg-surface-subtle border-b border-border text-muted-stronger font-bold">
                    <tr>
                      <th className="py-2.5 px-3.5">Bulan</th>
                      <th className="py-2.5 px-3.5 text-center">Jml Pegawai</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[110px]">Gaji Pokok</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[100px]">Tunjangan</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[90px]">Insentif/THR</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[125px] bg-blue-50/60 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200">
                        Terlapor Pajak (Bruto)
                      </th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[90px]">BPJS</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[90px]">PPh 21</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[125px] bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200">
                        Gaji Bersih (THP)
                      </th>
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
                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 font-bold text-[11px]">
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
                          {formatRupiah((r.totalInsentif || 0) + (r.totalThr || 0))}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono font-bold text-blue-900 dark:text-blue-200 bg-blue-50/30 dark:bg-blue-950/15 whitespace-nowrap">
                          {r.totalGajiTerlaporPajakFmt || r.totalGajiKotorFmt}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono text-rose-700 dark:text-rose-300 whitespace-nowrap">
                          {r.totalBpjsFmt}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono text-amber-700 dark:text-amber-300 whitespace-nowrap">
                          {r.totalPph21Fmt}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono font-bold text-emerald-800 dark:text-emerald-200 bg-emerald-50/30 dark:bg-emerald-950/15 whitespace-nowrap">
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
                          data.rekapBulananPegawai.reduce(
                            (s, r) => s + (r.totalInsentif || 0) + (r.totalThr || 0),
                            0
                          )
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-right font-mono font-bold text-blue-900 dark:text-blue-200 bg-blue-50/40 dark:bg-blue-950/20 whitespace-nowrap">
                        {formatRupiah(
                          data.rekapBulananPegawai.reduce(
                            (s, r) => s + (r.totalGajiTerlaporPajak || r.totalGajiKotor),
                            0
                          )
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
                      <td className="py-3 px-3.5 text-right font-mono font-bold text-emerald-800 dark:text-emerald-200 bg-emerald-50/40 dark:bg-emerald-950/20 whitespace-nowrap">
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

          {/* Sub-Tab Content 3: Penyesuaian Gaji Pegawai Tetap & Tarikan Jurnal Umum */}
          {pegawaiSubTab === "penyesuaian" && (
            <div className="space-y-6">
              {/* Card 1: Ringkasan Rekonsiliasi & Status */}
              <div className="p-5 rounded-2xl border border-border bg-surface-card space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="p-2 rounded-xl bg-navy/10 text-navy font-bold">
                        <Scale size={18} />
                      </span>
                      <div>
                        <h3 className="text-sm font-bold text-navy-text">
                          Penyesuaian Gaji Pegawai Tetap & Transaksi Jurnal Umum
                        </h3>
                        <p className="text-xs text-muted-faint mt-0.5">
                          Pencocokan antara catatan gaji modul payroll dengan transaksi riil yang ditarik dari Jurnal Umum (Akun 511 - Gaji) pada entitas {data.entity?.name}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Filter Periode Toggle (Bulan Ini vs Sepanjang Tahun) */}
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <div className="flex items-center bg-surface-subtle p-1 rounded-xl border border-border">
                      <button
                        onClick={() => setPeriodeFilterPegawai("bulan")}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                          periodeFilterPegawai === "bulan"
                            ? "bg-surface-card text-navy-text shadow-2xs font-bold"
                            : "text-muted-faint hover:text-navy-text"
                        }`}
                      >
                        Bulan Ini ({BULAN_NAMES[selectedMonth - 1]})
                      </button>
                      <button
                        onClick={() => setPeriodeFilterPegawai("tahun")}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                          periodeFilterPegawai === "tahun"
                            ? "bg-surface-card text-navy-text shadow-2xs font-bold"
                            : "text-muted-faint hover:text-navy-text"
                        }`}
                      >
                        Sepanjang Tahun ({selectedYear})
                      </button>
                    </div>
                  </div>
                </div>

                {/* Status Badge & Alert */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-surface-subtle/50 border border-border">
                  <div className="flex items-center gap-2.5">
                    {(periodeFilterPegawai === "bulan"
                      ? data.penyesuaianJurnal.pegawai.isSinkronBulan
                      : data.penyesuaianJurnal.pegawai.isSinkronTahun) ? (
                      <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                        <CheckCircle size={18} />
                        <div>
                          <span className="text-xs font-bold block">100% SINKRON (Sesuai)</span>
                          <span className="text-[11px] text-muted-faint">
                            Tidak ada selisih antara pencatatan payroll dan transaksi Akun 511 di Jurnal Umum.
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                        <AlertCircle size={18} />
                        <div>
                          <span className="text-xs font-bold block">
                            TERDAPAT SELISIH PENYESUAIAN:{" "}
                            {periodeFilterPegawai === "bulan"
                              ? data.penyesuaianJurnal.pegawai.selisihBulanFmt
                              : data.penyesuaianJurnal.pegawai.selisihTahunFmt}
                          </span>
                          <span className="text-[11px] text-muted-faint">
                            Nominal di Jurnal Umum berbeda dengan total rekap gaji pegawai pada periode ini.
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <Link
                    href={`/jurnal?entity=${data.entity?.key ?? ""}`}
                    className="h-7 px-3 rounded-lg border border-border bg-surface-card hover:bg-surface-hover text-navy-text text-xs font-semibold inline-flex items-center gap-1.5 transition-colors self-start sm:self-auto shadow-2xs"
                  >
                    <ExternalLink size={12} />
                    <span>Buka Jurnal Umum</span>
                  </Link>
                </div>

                {/* 3 Metric Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                  <div className="p-4 rounded-xl border border-border bg-surface-card shadow-2xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-faint font-medium">Catatan Modul Penggajian</span>
                      <Users size={14} className="text-muted-faint" />
                    </div>
                    <div className="text-lg font-bold font-mono text-navy-text">
                      {periodeFilterPegawai === "bulan"
                        ? data.penyesuaianJurnal.pegawai.totalPayrollBulanFmt
                        : data.penyesuaianJurnal.pegawai.totalPayrollTahunFmt}
                    </div>
                    <p className="text-[11px] text-muted-faint">
                      Total gaji kotor ({periodeFilterPegawai === "bulan" ? `Bulan ${BULAN_NAMES[selectedMonth - 1]}` : `Tahun ${selectedYear}`})
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-border bg-surface-card shadow-2xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-faint font-medium">Ditarik dari Jurnal Umum</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-navy/10 text-navy">
                        Akun 511 · Gaji
                      </span>
                    </div>
                    <div className="text-lg font-bold font-mono text-navy-text">
                      {periodeFilterPegawai === "bulan"
                        ? data.penyesuaianJurnal.pegawai.totalJurnalBulanFmt
                        : data.penyesuaianJurnal.pegawai.totalJurnalTahunFmt}
                    </div>
                    <p className="text-[11px] text-muted-faint">
                      Total debet akun 511 ({periodeFilterPegawai === "bulan" ? data.penyesuaianJurnal.pegawai.transaksiBulan.length : data.penyesuaianJurnal.pegawai.transaksiTahun.length} transaksi)
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-border bg-surface-card shadow-2xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-faint font-medium">Selisih Penyesuaian</span>
                      <Scale size={14} className="text-muted-faint" />
                    </div>
                    <div className={`text-lg font-bold font-mono ${(periodeFilterPegawai === "bulan" ? data.penyesuaianJurnal.pegawai.isSinkronBulan : data.penyesuaianJurnal.pegawai.isSinkronTahun) ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                      {periodeFilterPegawai === "bulan"
                        ? data.penyesuaianJurnal.pegawai.selisihBulanFmt
                        : data.penyesuaianJurnal.pegawai.selisihTahunFmt}
                    </div>
                    <p className="text-[11px] text-muted-faint">
                      {(periodeFilterPegawai === "bulan" ? data.penyesuaianJurnal.pegawai.isSinkronBulan : data.penyesuaianJurnal.pegawai.isSinkronTahun)
                        ? "Saldo telah sesuai (sinkron)"
                        : "Perlu penyesuaian di jurnal umum"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Card 2: Tabel Transaksi Jurnal Umum Akun 511 */}
              <div className="rounded-2xl border border-border bg-surface-card overflow-hidden">
                <div className="p-4 border-b border-border flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-navy-text flex items-center gap-2">
                      <FileText size={16} className="text-navy" />
                      <span>Daftar Transaksi Akun Pegawai Tetap yang Ditarik dari Jurnal Umum (Kode Akun 511)</span>
                    </h3>
                    <p className="text-xs text-muted-faint mt-0.5">
                      Daftar transaksi pengeluaran gaji riil yang menggunakan kode akun 511 pada entitas {data.entity?.name} ({periodeFilterPegawai === "bulan" ? `Periode ${BULAN_NAMES[selectedMonth - 1]} ${selectedYear}` : `Tahun ${selectedYear}`})
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[850px] text-left text-xs">
                    <thead className="bg-surface-subtle border-b border-border text-muted-stronger font-bold">
                      <tr>
                        <th className="py-2.5 px-3.5 whitespace-nowrap min-w-[130px]">Tanggal & No Bukti</th>
                        <th className="py-2.5 px-3.5 whitespace-nowrap min-w-[100px]">Sumber Jurnal</th>
                        <th className="py-2.5 px-3.5 whitespace-nowrap min-w-[140px]">Kode & Nama Akun</th>
                        <th className="py-2.5 px-3.5">Keterangan / Uraian</th>
                        <th className="py-2.5 px-3.5 whitespace-nowrap min-w-[120px]">Proyek</th>
                        <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[140px]">Pengeluaran (Debit)</th>
                        <th className="py-2.5 px-3.5 text-center whitespace-nowrap min-w-[90px]">Staff</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y border-b border-border">
                      {(periodeFilterPegawai === "bulan"
                        ? data.penyesuaianJurnal.pegawai.transaksiBulan
                        : data.penyesuaianJurnal.pegawai.transaksiTahun
                      ).length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-10 text-center">
                            <div className="flex flex-col items-center justify-center gap-2 text-muted-faint max-w-md mx-auto">
                              <FileText size={32} className="opacity-40" />
                              <p className="font-semibold text-navy-text">
                                Belum Ada Transaksi di Jurnal Umum untuk Akun 511 (Gaji)
                              </p>
                              <p className="text-[11px] leading-relaxed">
                                Sistem siap menarik data. Jika staf mencatat transaksi pengeluaran gaji melalui <strong>Kas Kecil</strong>, <strong>Kas Besar</strong>, atau <strong>Buku Bank</strong> menggunakan kode akun <strong>511</strong>, data akan otomatis ditarik dan muncul di tabel ini untuk penyesuaian.
                              </p>
                              <Link
                                href={`/jurnal?entity=${data.entity?.key ?? ""}`}
                                className="mt-2 h-7 px-3 rounded-lg border border-border bg-surface-subtle hover:bg-surface-hover text-navy-text text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                              >
                                <ExternalLink size={12} />
                                <span>Buka Jurnal Umum</span>
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        (periodeFilterPegawai === "bulan"
                          ? data.penyesuaianJurnal.pegawai.transaksiBulan
                          : data.penyesuaianJurnal.pegawai.transaksiTahun
                        ).map((tx) => (
                          <tr key={tx.id} className="hover:bg-surface-hover/30 transition-colors">
                            <td className="py-3 px-3.5 whitespace-nowrap">
                              <div className="font-semibold text-navy-text">{tx.tanggalFmt}</div>
                              <div className="font-mono text-[11px] text-muted-faint mt-0.5">
                                Bukti: {tx.noBukti}
                              </div>
                            </td>
                            <td className="py-3 px-3.5 whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-surface-subtle border border-border text-navy-text">
                                {tx.jenisInputNama}
                              </span>
                            </td>
                            <td className="py-3 px-3.5">
                              <div className="font-mono font-bold text-navy-text text-xs whitespace-nowrap">
                                {tx.coaCode}
                              </div>
                              <div className="text-[11px] text-muted-faint">
                                {tx.coaName}
                              </div>
                            </td>
                            <td className="py-3 px-3.5 text-muted-stronger">
                              {tx.keterangan}
                            </td>
                            <td className="py-3 px-3.5 whitespace-nowrap">
                              {tx.namaProyek ? (
                                <span className="font-semibold text-brand text-[11px] inline-flex items-center gap-1">
                                  <Briefcase size={11} />
                                  <span>{tx.namaProyek}</span>
                                </span>
                              ) : (
                                <span className="text-muted-faint text-[11px]">-</span>
                              )}
                            </td>
                            <td className="py-3 px-3.5 text-right font-mono font-bold text-navy-text text-sm whitespace-nowrap">
                              {tx.debitFmt}
                            </td>
                            <td className="py-3 px-3.5 text-center text-[11px] text-muted-faint whitespace-nowrap">
                              {tx.staffName || "-"}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {(periodeFilterPegawai === "bulan"
                      ? data.penyesuaianJurnal.pegawai.transaksiBulan
                      : data.penyesuaianJurnal.pegawai.transaksiTahun
                    ).length > 0 && (
                      <tfoot className="bg-surface-subtle border-t-2 border-border font-bold text-xs">
                        <tr>
                          <td colSpan={5} className="py-3 px-3.5 text-navy-text">
                            Total ({(periodeFilterPegawai === "bulan"
                              ? data.penyesuaianJurnal.pegawai.transaksiBulan
                              : data.penyesuaianJurnal.pegawai.transaksiTahun
                            ).length} Transaksi Jurnal Umum):
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono text-navy-text text-sm whitespace-nowrap">
                            {periodeFilterPegawai === "bulan"
                              ? data.penyesuaianJurnal.pegawai.totalJurnalBulanFmt
                              : data.penyesuaianJurnal.pegawai.totalJurnalTahunFmt}
                          </td>
                          <td />
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Sub-Tab Content 2: Master Database Karyawan */}
          {pegawaiSubTab === "master" && (
            <div className="rounded-2xl border border-border bg-surface-card overflow-hidden">
              <div className="p-4 border-b border-border flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h3 className="text-sm font-bold text-navy-text flex items-center gap-2">
                    <Users size={16} className="text-navy" />
                    <span>Database Pegawai Tetap (Master Karyawan)</span>
                  </h3>
                  <p className="text-xs text-muted-faint mt-0.5">
                    Daftar profil seluruh pegawai tetap. NIK dan gaji pokok didaftarkan sekali di sini, sehingga saat input gaji bulanan cukup memilih nama dari daftar.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-surface-subtle border border-border text-xs">
                  <button
                    onClick={() => setMasterStatusFilter("ALL")}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                      masterStatusFilter === "ALL"
                        ? "bg-surface-card text-navy font-bold shadow-2xs"
                        : "text-muted-faint hover:text-navy-text"
                    }`}
                  >
                    Semua ({allMasterPegawai.length})
                  </button>
                  <button
                    onClick={() => setMasterStatusFilter("AKTIF")}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                      masterStatusFilter === "AKTIF"
                        ? "bg-surface-card text-emerald-700 dark:text-emerald-400 font-bold shadow-2xs"
                        : "text-muted-faint hover:text-navy-text"
                    }`}
                  >
                    Aktif ({masterCountAktif})
                  </button>
                  <button
                    onClick={() => setMasterStatusFilter("RESIGN")}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                      masterStatusFilter === "RESIGN"
                        ? "bg-surface-card text-amber-700 dark:text-amber-400 font-bold shadow-2xs"
                        : "text-muted-faint hover:text-navy-text"
                    }`}
                  >
                    Resign ({masterCountResign})
                  </button>
                  <button
                    onClick={() => setMasterStatusFilter("PENSIUN")}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                      masterStatusFilter === "PENSIUN"
                        ? "bg-surface-card text-purple-700 dark:text-purple-400 font-bold shadow-2xs"
                        : "text-muted-faint hover:text-navy-text"
                    }`}
                  >
                    Pensiun ({masterCountPensiun})
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[1240px] text-left text-xs">
                  <thead className="bg-surface-subtle border-b border-border text-muted-stronger font-bold">
                    <tr>
                      <th className="py-2.5 px-3.5 whitespace-nowrap min-w-[110px]">NIK / Kode</th>
                      <th className="py-2.5 px-3.5 whitespace-nowrap min-w-[160px]">Nama Pegawai</th>
                      <th className="py-2.5 px-3.5 whitespace-nowrap min-w-[130px]">Jabatan</th>
                      <th className="py-2.5 px-3.5 whitespace-nowrap min-w-[100px]">Status PTKP</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[130px]">PTKP Tahunan</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[140px]">Gaji Pokok Standar</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[140px]">Tunj. Jabatan Master</th>
                      <th className="py-2.5 px-3.5 text-left whitespace-nowrap min-w-[160px]">Mulai Bekerja / Masa Kerja</th>
                      <th className="py-2.5 px-3.5 text-left whitespace-nowrap min-w-[120px]">Tanggal Resign</th>
                      <th className="py-2.5 px-3.5 text-center whitespace-nowrap min-w-[120px]">Status</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[190px]">Aksi & Riwayat</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredMasterList.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="py-8 text-center text-muted-faint">
                          Tidak ada data karyawan ditemukan.
                        </td>
                      </tr>
                    ) : (
                      filteredMasterList.map((p) => (
                        <tr key={p.id} className="hover:bg-surface-hover/30 transition-colors">
                          <td className="py-3 px-3.5 font-mono font-semibold text-navy-text whitespace-nowrap">
                            {p.nik}
                          </td>
                          <td className="py-3 px-3.5 font-bold text-navy-text whitespace-nowrap">
                            {p.nama}
                          </td>
                          <td className="py-3 px-3.5 text-muted-stronger whitespace-nowrap">
                            {p.jabatan}
                          </td>
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-full bg-surface-subtle font-mono text-[11px] font-semibold">
                              {p.statusKeluarga}
                            </span>
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono text-muted-stronger whitespace-nowrap">
                            {p.ptkpFmt}
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono font-bold text-navy-text whitespace-nowrap">
                            {p.gajiPokokFmt}
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono text-muted-stronger whitespace-nowrap">
                            {p.tunjanganJabatanFmt || formatRupiah(p.tunjanganJabatan)}
                          </td>
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            {p.tanggalMasukFmt ? (
                              <div>
                                <div className="font-semibold text-navy-text text-xs">{p.tanggalMasukFmt}</div>
                                <div className="text-[10px] font-mono text-muted-stronger">
                                  Masa Kerja: <span className="text-emerald-700 dark:text-emerald-400 font-bold">{p.masaKerja}</span>
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-faint text-[11px]">-</span>
                            )}
                          </td>
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            {p.tanggalResignFmt ? (
                              <span className="font-mono text-xs font-semibold text-amber-700 dark:text-amber-300">
                                {p.tanggalResignFmt}
                              </span>
                            ) : (
                              <span className="text-muted-faint text-[11px]">-</span>
                            )}
                          </td>
                          <td className="py-3 px-3.5 text-center whitespace-nowrap">
                            {isManager ? (
                              <div className="relative inline-flex items-center">
                                <select
                                  value={p.status ?? (p.isActive ? "AKTIF" : "RESIGN")}
                                  onChange={(e) => {
                                    const newStatus = e.target.value as "AKTIF" | "RESIGN" | "PENSIUN";
                                    const currentStatus = p.status ?? (p.isActive ? "AKTIF" : "RESIGN");
                                    if (newStatus === currentStatus) return;

                                    if (newStatus === "AKTIF") {
                                      startTransition(async () => {
                                        try {
                                          await updatePegawaiStatusAction(p.id, "AKTIF", null);
                                          setSuccessMsg(`Status ${p.nama} berhasil diubah menjadi Aktif.`);
                                          router.refresh();
                                        } catch (err: unknown) {
                                          setErrorMsg((err as Error).message);
                                        }
                                      });
                                    } else {
                                      setQuickStatusTarget({
                                        pegawai: p,
                                        status: newStatus,
                                        tanggal:
                                          p.tanggalResign?.split("T")[0] ||
                                          new Date().toISOString().split("T")[0],
                                      });
                                    }
                                  }}
                                  className={`no-custom-chevron text-[11px] font-bold pl-3 pr-6 py-1 rounded-full border cursor-pointer appearance-none text-left outline-none transition-all shadow-2xs ${
                                    (p.status ?? (p.isActive ? "AKTIF" : "RESIGN")) === "AKTIF"
                                      ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100"
                                      : (p.status ?? (p.isActive ? "AKTIF" : "RESIGN")) === "RESIGN"
                                      ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60 hover:bg-amber-100"
                                      : "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/60 hover:bg-purple-100"
                                  }`}
                                  style={{ backgroundImage: "none" }}
                                  title="Klik untuk mengubah status (Aktif, Resign, atau Pensiun)"
                                >
                                  <option value="AKTIF" className="bg-surface-card text-foreground font-semibold">Aktif</option>
                                  <option value="RESIGN" className="bg-surface-card text-foreground font-semibold">Resign</option>
                                  <option value="PENSIUN" className="bg-surface-card text-foreground font-semibold">Pensiun</option>
                                </select>
                                <ChevronDown
                                  size={11}
                                  className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-current opacity-70"
                                />
                              </div>
                            ) : (
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  p.status === "RESIGN"
                                    ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60"
                                    : p.status === "PENSIUN"
                                    ? "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60"
                                    : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60"
                                }`}
                              >
                                {p.status === "RESIGN" ? "Resign" : p.status === "PENSIUN" ? "Pensiun" : "Aktif"}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3.5 text-right whitespace-nowrap">
                            <div className="inline-flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setRiwayatPegawaiTarget(p)}
                                className="h-7 px-2.5 rounded-lg border border-border bg-surface-subtle hover:bg-surface-hover text-[11px] font-semibold text-navy-text inline-flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                                title="Lihat Rekam Jejak dan Riwayat Gaji Karyawan"
                              >
                                <History size={11} className="text-navy" />
                                <span>Riwayat Gaji</span>
                                {(p.akumulasiTahun?.bulanTerbayar ?? 0) > 0 && (
                                  <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-navy/10 text-navy font-bold text-[10px]">
                                    {p.akumulasiTahun?.bulanTerbayar} bln
                                  </span>
                                )}
                              </button>
                              {isManager && (
                                <>
                                  <button
                                    onClick={() => {
                                      setEditingPegawai(p);
                                      setModalPegawaiStatus(p.status ?? (p.isActive ? "AKTIF" : "RESIGN"));
                                      setModalTanggalResign(p.tanggalResign ? p.tanggalResign.split("T")[0] : "");
                                      setIsPegawaiModalOpen(true);
                                    }}
                                    className="h-7 px-2.5 rounded-lg border border-border bg-surface-subtle hover:bg-surface-hover text-[11px] font-semibold text-navy-text inline-flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                                  >
                                    <Pencil size={11} />
                                    <span>Edit</span>
                                  </button>
                                {(p.akumulasiTahun?.bulanTerbayar ?? 0) > 0 ? (
                                  <button
                                    disabled
                                    className="h-7 px-2 rounded-lg border border-border bg-surface-subtle text-muted-faint cursor-not-allowed opacity-60 inline-flex items-center gap-1 shadow-2xs"
                                    title="Data terkunci: Memiliki riwayat penggajian arsip laporan tahunan & pajak. Karyawan resign/pensiun tidak boleh dihapus, cukup ubah status."
                                  >
                                    <Lock size={12} />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setDeleteDialog({
                                        isOpen: true,
                                        title: "Hapus Pegawai Tetap",
                                        itemName: `${p.nama} (${p.nik})`,
                                        itemSub: `${p.jabatan} · Gaji Pokok Master: ${p.gajiPokokFmt}`,
                                        warningNote:
                                          "Jika karyawan ini sudah berhenti bekerja, disarankan untuk mengubah status menjadi Resign atau Pensiun agar rekam arsip penggajian dan pajak tahunan tetap terjaga.",
                                        confirmLabel: "Ya, Hapus Pegawai",
                                        onConfirm: async () => {
                                          try {
                                            await deletePegawaiAction(p.id);
                                            setSuccessMsg(`Pegawai ${p.nama} berhasil dihapus.`);
                                            setDeleteDialog(null);
                                            router.refresh();
                                          } catch (e: unknown) {
                                            setErrorMsg((e as Error).message);
                                            setDeleteDialog(null);
                                          }
                                        },
                                      });
                                    }}
                                    className="h-7 px-2 rounded-lg border border-rose-200 dark:border-rose-800/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer shadow-2xs"
                                    title="Hapus Pegawai"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
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
                <table className="w-full min-w-[880px] text-left text-xs">
                  <thead className="bg-surface-subtle border-b border-border text-muted-stronger font-bold">
                    <tr>
                      <th className="py-2.5 px-3.5 whitespace-nowrap min-w-[180px]">Pegawai</th>
                      <th className="py-2.5 px-3.5 whitespace-nowrap min-w-[100px]">Status PTKP</th>
                      <th className="py-2.5 px-3.5 text-center whitespace-nowrap min-w-[130px]">Bulan Dibayar</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[150px]">Akumulasi Gaji Bruto</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[140px]">Akumulasi PPh 21</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[150px]">Akumulasi Net (THP)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredTahunanList.map((p) => {
                      const ak = p.akumulasiTahun;
                      return (
                        <tr key={p.id} className="hover:bg-surface-hover/30 transition-colors">
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            <div className="font-bold text-navy-text">{p.nama}</div>
                            <div className="text-[11px] text-muted-faint font-mono mt-0.5">
                              {p.nik} · {p.jabatan}
                            </div>
                          </td>
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-full bg-surface-subtle font-mono text-[11px] font-semibold">
                              {p.statusKeluarga}
                            </span>
                          </td>
                          <td className="py-3 px-3.5 text-center font-mono font-bold text-navy-text whitespace-nowrap">
                            {ak?.bulanTerbayar ?? 0} / 12 Bulan
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono font-bold text-navy-text whitespace-nowrap">
                            {formatRupiah(ak?.totalGajiKotor ?? 0)}
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono text-amber-700 dark:text-amber-300 whitespace-nowrap">
                            {formatRupiah(ak?.totalPph21 ?? 0)}
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono font-bold text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
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
                onClick={() => setTenagaAhliSubTab("rekap-proyek")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                  tenagaAhliSubTab === "rekap-proyek"
                    ? "bg-surface-card text-navy-text shadow-2xs font-bold"
                    : "text-muted-faint hover:text-navy-text hover:bg-surface-card/50"
                }`}
              >
                <Briefcase size={13} className={tenagaAhliSubTab === "rekap-proyek" ? "text-navy" : "text-muted-faint"} />
                <span>Rekap Per Proyek</span>
                <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                  tenagaAhliSubTab === "rekap-proyek" ? "bg-navy/10 text-navy font-bold" : "bg-surface-card text-muted-faint"
                }`}>
                  {data.rekapTenagaAhliPerProyek.length}
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
                onClick={() => setTenagaAhliSubTab("penyesuaian")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                  tenagaAhliSubTab === "penyesuaian"
                    ? "bg-surface-card text-navy-text shadow-2xs font-bold"
                    : "text-muted-faint hover:text-navy-text hover:bg-surface-card/50"
                }`}
              >
                <Scale size={13} className={tenagaAhliSubTab === "penyesuaian" ? "text-navy" : "text-muted-faint"} />
                <span>Penyesuaian Gaji</span>
                {(periodeFilterAhli === "bulan"
                  ? data.penyesuaianJurnal.tenagaAhli.isSinkronBulan
                  : data.penyesuaianJurnal.tenagaAhli.isSinkronTahun) ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                )}
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
                  {tenagaAhliSubTab === "penyesuaian" ? (
                    <Link
                      href={`/jurnal?entity=${data.entity?.key ?? ""}`}
                      className="h-8 px-3 rounded-xl bg-navy text-white text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-navy-light transition-colors whitespace-nowrap cursor-pointer shadow-2xs"
                    >
                      <ExternalLink size={14} />
                      <span>Buka Jurnal Umum</span>
                    </Link>
                  ) : tenagaAhliSubTab === "database-ahli" ? (
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
                        if (data.rekananTenagaAhli.length === 0) {
                          setErrorMsg("Belum ada tenaga ahli terdaftar di entitas ini. Silakan tambahkan tenaga ahli terlebih dahulu.");
                          return;
                        }
                        openHonorModal();
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
                Transaksi Honorarium
              </div>
              <div className="text-xl font-bold font-mono text-navy-text mt-1">
                {filteredHonorList.length} Pembayaran
              </div>
              <div className="text-[10px] text-muted-faint mt-1">
                {honorFilterScope === "holding" ? "Seluruh Holding" : data.entity?.name} · {BULAN_NAMES[selectedMonth - 1]} {selectedYear}
              </div>
            </div>

            <div className="p-4 rounded-2xl border border-border bg-surface-card">
              <div className="text-[11px] font-medium text-muted-faint">
                Total Gaji Bruto
              </div>
              <div className="text-xl font-bold font-mono text-navy-text mt-1">
                {formatRupiah(totalHonorBrutoFiltered)}
              </div>
              <div className="text-[10px] text-muted-faint mt-1">
                Total beban honor bruto
              </div>
            </div>

            <div className="p-4 rounded-2xl border border-border bg-surface-card">
              <div className="text-[11px] font-medium text-muted-faint">
                Potongan Pajak (PPh)
              </div>
              <div className="text-xl font-bold font-mono text-amber-700 dark:text-amber-300 mt-1">
                {formatRupiah(totalHonorPphFiltered)}
              </div>
              <div className="text-[10px] text-muted-faint mt-1">
                PPh 21 / PPh 23 terpotong
              </div>
            </div>

            <div className="p-4 rounded-2xl border border-border bg-surface-card">
              <div className="text-[11px] font-medium text-muted-faint">
                Total Gaji Bersih (Net)
              </div>
              <div className="text-xl font-bold font-mono text-emerald-700 dark:text-emerald-300 mt-1">
                {formatRupiah(totalHonorBersihFiltered)}
              </div>
              <div className="text-[10px] text-muted-faint mt-1">
                Net diterima tenaga ahli
              </div>
            </div>
          </div>

          {/* Sub-Tab 1: Gaji Bulanan Tenaga Ahli */}
          {tenagaAhliSubTab === "honor" && (
            <div className="rounded-2xl border border-border bg-surface-card overflow-hidden">
              <div className="p-4 border-b border-border flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h3 className="text-sm font-bold text-navy-text">
                    Daftar Gaji Tenaga Ahli – Periode {BULAN_NAMES[selectedMonth - 1]} {selectedYear}
                  </h3>
                  <p className="text-xs text-muted-faint mt-0.5">
                    {honorFilterScope === "holding"
                      ? "Konsolidasi Seluruh Entitas Holding"
                      : `Entitas: ${data.entity?.name}`} · Pengelolaan honorarium, PTKP, potongan pajak & alokasi proyek
                  </p>
                </div>

                {/* Multi-Filter Bar: Scope Entitas vs Holding & Filter Proyek */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Scope Selector */}
                  <div className="flex items-center bg-surface-subtle p-1 rounded-xl border border-border text-xs">
                    <button
                      type="button"
                      onClick={() => setHonorFilterScope("entitas")}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                        honorFilterScope === "entitas"
                          ? "bg-surface-card text-navy-text shadow-2xs font-bold"
                          : "text-muted-faint hover:text-navy-text"
                      }`}
                    >
                      <Building2 size={12} />
                      <span>{data.entity?.name || "Entitas Ini"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setHonorFilterScope("holding")}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                        honorFilterScope === "holding"
                          ? "bg-surface-card text-navy-text shadow-2xs font-bold"
                          : "text-muted-faint hover:text-navy-text"
                      }`}
                    >
                      <span>Semua Holding</span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] bg-navy/10 text-navy font-bold">
                        {(data.allHonorBulanIni || []).length}
                      </span>
                    </button>
                  </div>

                  {/* Filter Proyek Dropdown */}
                  <div className="flex items-center gap-1.5">
                    <Briefcase size={13} className="text-muted-faint" />
                    <select
                      value={honorFilterProyek}
                      onChange={(e) => setHonorFilterProyek(e.target.value)}
                      className="h-8 px-2.5 rounded-xl border border-border bg-surface-card text-foreground text-xs font-semibold max-w-[200px]"
                    >
                      <option value="ALL">Semua Proyek</option>
                      {data.projects.map((pr) => (
                        <option key={pr.id} value={pr.id}>
                          [{pr.code}] {pr.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] text-left text-xs">
                  <thead className="bg-surface-subtle border-b border-border text-muted-stronger font-bold">
                    <tr>
                      <th className="py-2.5 px-3.5">Tanggal & Bukti</th>
                      <th className="py-2.5 px-3.5">Tenaga Ahli & PTKP</th>
                      {honorFilterScope === "holding" && (
                        <th className="py-2.5 px-3.5">Entitas</th>
                      )}
                      <th className="py-2.5 px-3.5">Uraian & Alokasi Proyek</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[120px]">Gaji Bruto</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[110px]">Pajak (PPh)</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[120px]">Net Diterima</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[100px]">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredHonorList.length === 0 ? (
                      <tr>
                        <td
                          colSpan={honorFilterScope === "holding" ? 8 : 7}
                          className="py-10 text-center text-muted-faint"
                        >
                          <CreditCard size={28} className="mx-auto mb-2 opacity-40" />
                          <p className="font-semibold text-navy-text">
                            Belum ada data gaji tenaga ahli pada filter ini.
                          </p>
                          <p className="text-[11px] mt-0.5">
                            Klik &quot;Input Gaji Tenaga Ahli&quot; untuk mencatat pembayaran baru.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      filteredHonorList.map((h) => {
                        const netVal =
                          h.nominalBersih ||
                          Math.max(0, h.nominalHonor - (h.pph21 || 0));
                        return (
                          <tr key={h.id} className="hover:bg-surface-hover/30 transition-colors">
                            <td className="py-3 px-3.5">
                              <div className="font-semibold text-navy-text">{h.tanggalFmt}</div>
                              {h.noBukti ? (
                                <div className="font-mono text-[11px] text-muted-faint mt-0.5">
                                  Bukti: {h.noBukti}
                                </div>
                              ) : (
                                <div className="text-[10px] text-muted-faint/60 mt-0.5">
                                  Bulan {h.bulan}/{h.tahun}
                                </div>
                              )}
                            </td>

                            <td className="py-3 px-3.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-navy-text text-sm">{h.nama}</span>
                                <span className="px-1.5 py-0.2 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[10px] font-bold">
                                  {h.ptkp || "TK/0"}
                                </span>
                              </div>
                              <div className="text-[11px] text-muted-faint font-mono mt-0.5">
                                NIK: {h.nik} {h.npwp ? `· NPWP: ${h.npwp}` : ""}
                              </div>
                            </td>

                            {honorFilterScope === "holding" && (
                              <td className="py-3 px-3.5">
                                <span className="px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-[10px] font-semibold flex items-center gap-1 w-fit">
                                  <Building2 size={10} />
                                  <span>{h.entityName}</span>
                                </span>
                              </td>
                            )}

                            <td className="py-3 px-3.5 text-muted-stronger">
                              <div>{h.uraian}</div>
                              {(h.namaProyek || h.projectName) ? (
                                <div className="text-[11px] text-brand font-semibold mt-0.5 inline-flex items-center gap-1">
                                  <Briefcase size={11} />
                                  <span>{h.namaProyek || `[${h.projectCode}] ${h.projectName}`}</span>
                                  <span className="text-[10px] text-emerald-600 font-medium ml-1">
                                    (Realisasi Proyek)
                                  </span>
                                </div>
                              ) : (
                                <div className="text-[10px] text-muted-faint mt-0.5 italic">
                                  Non-proyek
                                </div>
                              )}
                            </td>

                            <td className="py-3 px-3.5 text-right font-mono font-bold text-navy-text whitespace-nowrap text-sm">
                              {h.nominalHonorFmt}
                            </td>

                            <td className="py-3 px-3.5 text-right whitespace-nowrap">
                              <div className="font-mono text-amber-700 dark:text-amber-300 font-semibold">
                                {formatRupiah(h.pph21 || 0)}
                              </div>
                              <div className="text-[10px] text-muted-faint font-mono mt-0.5">
                                {h.jenisPph || "PPh 21"}
                                {h.tarifPph21Persen ? ` (${h.tarifPph21Persen}%)` : ""}
                              </div>
                            </td>

                            <td className="py-3 px-3.5 text-right font-mono font-bold text-emerald-700 dark:text-emerald-300 whitespace-nowrap text-sm">
                              {formatRupiah(netVal)}
                            </td>

                            <td className="py-3 px-3.5 text-right whitespace-nowrap">
                              {isManager && (
                                <div className="inline-flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => {
                                      openHonorModal(h);
                                    }}
                                    className="h-7 px-2.5 rounded-lg border border-border bg-surface-subtle hover:bg-surface-hover text-[11px] font-semibold text-navy-text inline-flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                                  >
                                    <Pencil size={11} />
                                    <span>Edit</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      setDeleteDialog({
                                        isOpen: true,
                                        title: "Hapus Honorarium Tenaga Ahli",
                                        itemName: h.nama,
                                        itemSub: `Nominal: ${h.nominalHonorFmt} · ${h.uraian}`,
                                        warningNote:
                                          "Data transaksi honorarium ini akan dihapus dari rekapitulasi penggajian dan jurnal beban honor.",
                                        confirmLabel: "Ya, Hapus Honor",
                                        onConfirm: async () => {
                                          try {
                                            await deleteHonorTenagaAhliAction(h.id);
                                            setSuccessMsg("Honorarium berhasil dihapus.");
                                            setDeleteDialog(null);
                                            router.refresh();
                                          } catch (e: unknown) {
                                            setErrorMsg((e as Error).message);
                                            setDeleteDialog(null);
                                          }
                                        },
                                      });
                                    }}
                                    className="h-7 px-2 rounded-lg border border-rose-200 dark:border-rose-800/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer shadow-2xs"
                                    title="Hapus Honorarium"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  {filteredHonorList.length > 0 && (
                    <tfoot className="bg-surface-subtle border-t border-border font-bold text-xs">
                      <tr>
                        <td
                          colSpan={honorFilterScope === "holding" ? 4 : 3}
                          className="py-3 px-3.5 text-navy-text whitespace-nowrap"
                        >
                          Total ({filteredHonorList.length} Transaksi Terpilih):
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono text-navy-text whitespace-nowrap text-sm">
                          {formatRupiah(totalHonorBrutoFiltered)}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono text-amber-700 dark:text-amber-300 whitespace-nowrap text-sm">
                          {formatRupiah(totalHonorPphFiltered)}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono text-emerald-700 dark:text-emerald-300 whitespace-nowrap text-sm">
                          {formatRupiah(totalHonorBersihFiltered)}
                        </td>
                        <td className="py-3 px-3.5" />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {/* Sub-Tab Baru: Rekapitulasi Gaji Tenaga Ahli Per Proyek */}
          {tenagaAhliSubTab === "rekap-proyek" && (
            <div className="space-y-6">
              {/* Card Banner & Penjelasan Realisasi Biaya Proyek */}
              <div className="p-5 rounded-2xl border border-border bg-surface-card space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="p-2 rounded-xl bg-navy/10 text-navy font-bold">
                        <Briefcase size={18} />
                      </span>
                      <div>
                        <h3 className="text-sm font-bold text-navy-text">
                          Rekapitulasi Honorarium Tenaga Ahli Per Kode Proyek
                        </h3>
                        <p className="text-xs text-muted-faint mt-0.5">
                          Alokasi beban honorarium per proyek pada entitas {data.entity?.name} – Periode {BULAN_NAMES[selectedMonth - 1]} {selectedYear}. Seluruh honor yang terhubung ke kode proyek otomatis memotong realisasi biaya proyek (<code className="font-mono text-navy">Project.spend</code>) dan tersinkronisasi ke laporan profitabilitas.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4 Stat Cards Rekap Proyek */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 pt-1">
                  <div className="p-3.5 rounded-xl border border-border bg-surface-subtle/50 space-y-1">
                    <span className="text-[11px] text-muted-faint font-medium">Proyek Terlibat</span>
                    <div className="text-lg font-bold font-mono text-navy-text">
                      {data.rekapTenagaAhliPerProyek.length} Proyek
                    </div>
                    <span className="text-[10px] text-muted-faint">Memiliki alokasi honor</span>
                  </div>

                  <div className="p-3.5 rounded-xl border border-border bg-surface-subtle/50 space-y-1">
                    <span className="text-[11px] text-muted-faint font-medium">Total Honor Bruto</span>
                    <div className="text-lg font-bold font-mono text-navy-text">
                      {formatRupiah(data.rekapTenagaAhliPerProyek.reduce((s, p) => s + p.totalHonorBruto, 0))}
                    </div>
                    <span className="text-[10px] text-muted-faint">Beban biaya proyek riil</span>
                  </div>

                  <div className="p-3.5 rounded-xl border border-border bg-surface-subtle/50 space-y-1">
                    <span className="text-[11px] text-muted-faint font-medium">Potongan Pajak (PPh)</span>
                    <div className="text-lg font-bold font-mono text-amber-700 dark:text-amber-300">
                      {formatRupiah(data.rekapTenagaAhliPerProyek.reduce((s, p) => s + p.totalPph, 0))}
                    </div>
                    <span className="text-[10px] text-muted-faint">PPh 21 / PPh 23</span>
                  </div>

                  <div className="p-3.5 rounded-xl border border-border bg-surface-subtle/50 space-y-1">
                    <span className="text-[11px] text-muted-faint font-medium">Net Terbayarkan</span>
                    <div className="text-lg font-bold font-mono text-emerald-700 dark:text-emerald-300">
                      {formatRupiah(data.rekapTenagaAhliPerProyek.reduce((s, p) => s + p.totalHonorBersih, 0))}
                    </div>
                    <span className="text-[10px] text-muted-faint">Kas keluar untuk honor</span>
                  </div>
                </div>
              </div>

              {/* Tabel Rekapitulasi Per Proyek */}
              <div className="rounded-2xl border border-border bg-surface-card overflow-hidden">
                <div className="p-4 border-b border-border flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-navy-text">
                      Rincian Biaya Honorarium Tenaga Ahli Per Proyek
                    </h3>
                    <p className="text-xs text-muted-faint">
                      Akumulasi honor tenaga ahli per proyek dan daftar tenaga ahli yang ditugaskan
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[800px] text-left text-xs">
                    <thead className="bg-surface-subtle border-b border-border text-muted-stronger font-bold">
                      <tr>
                        <th className="py-2.5 px-3.5">Kode & Nama Proyek</th>
                        <th className="py-2.5 px-3.5">Tenaga Ahli Dilibatkan</th>
                        <th className="py-2.5 px-3.5 text-center">Jml Pembayaran</th>
                        <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[130px]">Honor Bruto</th>
                        <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[110px]">Pajak (PPh)</th>
                        <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[130px]">Net Diterima</th>
                        <th className="py-2.5 px-3.5 text-center whitespace-nowrap">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {data.rekapTenagaAhliPerProyek.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-10 text-center text-muted-faint">
                            <Briefcase size={28} className="mx-auto mb-2 opacity-40" />
                            <p className="font-semibold text-navy-text">
                              Belum ada alokasi honor tenaga ahli ke proyek pada bulan {BULAN_NAMES[selectedMonth - 1]} {selectedYear}.
                            </p>
                            <p className="text-[11px] mt-0.5">
                              Saat menginput gaji tenaga ahli, pilih Kode Proyek agar honorarium otomatis tercatat pada realisasi biaya proyek.
                            </p>
                          </td>
                        </tr>
                      ) : (
                        data.rekapTenagaAhliPerProyek.map((p, idx) => (
                          <tr key={p.projectId || `proyek-${idx}`} className="hover:bg-surface-hover/30 transition-colors">
                            <td className="py-3 px-3.5">
                              <div className="font-bold text-navy-text text-sm">
                                {p.projectName}
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                {p.projectCode && (
                                  <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded bg-navy/10 text-navy">
                                    {p.projectCode}
                                  </span>
                                )}
                                <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-medium flex items-center gap-1">
                                  <CheckCircle size={10} /> Terkoneksi ke Realisasi Biaya Proyek
                                </span>
                              </div>
                            </td>

                            <td className="py-3 px-3.5">
                              <div className="flex flex-wrap gap-1 max-w-xs">
                                {p.tenagaAhliList.map((namaAhli, i) => (
                                  <span
                                    key={i}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-[10px] font-medium border border-blue-200 dark:border-blue-800"
                                  >
                                    <Award size={10} />
                                    <span>{namaAhli}</span>
                                  </span>
                                ))}
                              </div>
                            </td>

                            <td className="py-3 px-3.5 text-center font-mono">
                              <span className="px-2 py-0.5 rounded-full bg-surface-subtle font-bold text-[11px] text-navy-text">
                                {p.totalTransaksi} transaksi
                              </span>
                            </td>

                            <td className="py-3 px-3.5 text-right font-mono font-bold text-navy-text whitespace-nowrap text-sm">
                              {p.totalHonorBrutoFmt}
                            </td>

                            <td className="py-3 px-3.5 text-right font-mono text-amber-700 dark:text-amber-300 whitespace-nowrap">
                              {p.totalPphFmt}
                            </td>

                            <td className="py-3 px-3.5 text-right font-mono font-bold text-emerald-700 dark:text-emerald-300 whitespace-nowrap text-sm">
                              {p.totalHonorBersihFmt}
                            </td>

                            <td className="py-3 px-3.5 text-center whitespace-nowrap">
                              <button
                                onClick={() => {
                                  setHonorFilterProyek(p.projectId || p.projectName);
                                  setTenagaAhliSubTab("honor");
                                }}
                                className="h-7 px-2.5 rounded-lg border border-border bg-surface-subtle hover:bg-surface-hover text-[11px] font-semibold text-navy-text inline-flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                              >
                                <span>Lihat Rincian</span>
                                <ChevronRight size={12} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {data.rekapTenagaAhliPerProyek.length > 0 && (
                      <tfoot className="bg-surface-subtle border-t-2 border-border font-bold text-xs">
                        <tr>
                          <td colSpan={2} className="py-3 px-3.5 text-navy-text">
                            Grand Total ({data.rekapTenagaAhliPerProyek.length} Proyek):
                          </td>
                          <td className="py-3 px-3.5 text-center font-mono">
                            {data.rekapTenagaAhliPerProyek.reduce((s, p) => s + p.totalTransaksi, 0)} transaksi
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono text-navy-text whitespace-nowrap text-sm">
                            {formatRupiah(data.rekapTenagaAhliPerProyek.reduce((s, p) => s + p.totalHonorBruto, 0))}
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono text-amber-700 dark:text-amber-300 whitespace-nowrap text-sm">
                            {formatRupiah(data.rekapTenagaAhliPerProyek.reduce((s, p) => s + p.totalPph, 0))}
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono text-emerald-700 dark:text-emerald-300 whitespace-nowrap text-sm">
                            {formatRupiah(data.rekapTenagaAhliPerProyek.reduce((s, p) => s + p.totalHonorBersih, 0))}
                          </td>
                          <td />
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
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
                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 font-bold text-[11px]">
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

          {/* Sub-Tab Content 3: Penyesuaian Gaji Tenaga Ahli & Tarikan Jurnal Umum */}
          {tenagaAhliSubTab === "penyesuaian" && (
            <div className="space-y-6">
              {/* Card 1: Ringkasan Rekonsiliasi & Status */}
              <div className="p-5 rounded-2xl border border-border bg-surface-card space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="p-2 rounded-xl bg-navy/10 text-navy font-bold">
                        <Scale size={18} />
                      </span>
                      <div>
                        <h3 className="text-sm font-bold text-navy-text">
                          Penyesuaian Gaji Tenaga Ahli & Transaksi Jurnal Umum
                        </h3>
                        <p className="text-xs text-muted-faint mt-0.5">
                          Pencocokan antara catatan honorarium modul tenaga ahli dengan transaksi riil yang ditarik dari Jurnal Umum (Akun 612 - Gaji Tenaga Ahli) pada entitas {data.entity?.name}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Filter Periode Toggle (Bulan Ini vs Sepanjang Tahun) */}
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <div className="flex items-center bg-surface-subtle p-1 rounded-xl border border-border">
                      <button
                        onClick={() => setPeriodeFilterAhli("bulan")}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                          periodeFilterAhli === "bulan"
                            ? "bg-surface-card text-navy-text shadow-2xs font-bold"
                            : "text-muted-faint hover:text-navy-text"
                        }`}
                      >
                        Bulan Ini ({BULAN_NAMES[selectedMonth - 1]})
                      </button>
                      <button
                        onClick={() => setPeriodeFilterAhli("tahun")}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                          periodeFilterAhli === "tahun"
                            ? "bg-surface-card text-navy-text shadow-2xs font-bold"
                            : "text-muted-faint hover:text-navy-text"
                        }`}
                      >
                        Sepanjang Tahun ({selectedYear})
                      </button>
                    </div>
                  </div>
                </div>

                {/* Status Badge & Alert */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-surface-subtle/50 border border-border">
                  <div className="flex items-center gap-2.5">
                    {(periodeFilterAhli === "bulan"
                      ? data.penyesuaianJurnal.tenagaAhli.isSinkronBulan
                      : data.penyesuaianJurnal.tenagaAhli.isSinkronTahun) ? (
                      <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                        <CheckCircle size={18} />
                        <div>
                          <span className="text-xs font-bold block">100% SINKRON (Sesuai)</span>
                          <span className="text-[11px] text-muted-faint">
                            Tidak ada selisih antara pencatatan honorarium dan transaksi Akun 612 di Jurnal Umum.
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                        <AlertCircle size={18} />
                        <div>
                          <span className="text-xs font-bold block">
                            TERDAPAT SELISIH PENYESUAIAN:{" "}
                            {periodeFilterAhli === "bulan"
                              ? data.penyesuaianJurnal.tenagaAhli.selisihBulanFmt
                              : data.penyesuaianJurnal.tenagaAhli.selisihTahunFmt}
                          </span>
                          <span className="text-[11px] text-muted-faint">
                            Nominal di Jurnal Umum berbeda dengan total rekap honor tenaga ahli pada periode ini.
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <Link
                    href={`/jurnal?entity=${data.entity?.key ?? ""}`}
                    className="h-7 px-3 rounded-lg border border-border bg-surface-card hover:bg-surface-hover text-navy-text text-xs font-semibold inline-flex items-center gap-1.5 transition-colors self-start sm:self-auto shadow-2xs"
                  >
                    <ExternalLink size={12} />
                    <span>Buka Jurnal Umum</span>
                  </Link>
                </div>

                {/* 3 Metric Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                  <div className="p-4 rounded-xl border border-border bg-surface-card shadow-2xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-faint font-medium">Catatan Modul Tenaga Ahli</span>
                      <Award size={14} className="text-muted-faint" />
                    </div>
                    <div className="text-lg font-bold font-mono text-navy-text">
                      {periodeFilterAhli === "bulan"
                        ? data.penyesuaianJurnal.tenagaAhli.totalPayrollBulanFmt
                        : data.penyesuaianJurnal.tenagaAhli.totalPayrollTahunFmt}
                    </div>
                    <p className="text-[11px] text-muted-faint">
                      Total honorarium bruto ({periodeFilterAhli === "bulan" ? `Bulan ${BULAN_NAMES[selectedMonth - 1]}` : `Tahun ${selectedYear}`})
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-border bg-surface-card shadow-2xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-faint font-medium">Ditarik dari Jurnal Umum</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-navy/10 text-navy">
                        Akun 612 · Gaji Tenaga Ahli
                      </span>
                    </div>
                    <div className="text-lg font-bold font-mono text-navy-text">
                      {periodeFilterAhli === "bulan"
                        ? data.penyesuaianJurnal.tenagaAhli.totalJurnalBulanFmt
                        : data.penyesuaianJurnal.tenagaAhli.totalJurnalTahunFmt}
                    </div>
                    <p className="text-[11px] text-muted-faint">
                      Total debet akun 612 ({periodeFilterAhli === "bulan" ? data.penyesuaianJurnal.tenagaAhli.transaksiBulan.length : data.penyesuaianJurnal.tenagaAhli.transaksiTahun.length} transaksi)
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-border bg-surface-card shadow-2xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-faint font-medium">Selisih Penyesuaian</span>
                      <Scale size={14} className="text-muted-faint" />
                    </div>
                    <div className={`text-lg font-bold font-mono ${(periodeFilterAhli === "bulan" ? data.penyesuaianJurnal.tenagaAhli.isSinkronBulan : data.penyesuaianJurnal.tenagaAhli.isSinkronTahun) ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                      {periodeFilterAhli === "bulan"
                        ? data.penyesuaianJurnal.tenagaAhli.selisihBulanFmt
                        : data.penyesuaianJurnal.tenagaAhli.selisihTahunFmt}
                    </div>
                    <p className="text-[11px] text-muted-faint">
                      {(periodeFilterAhli === "bulan" ? data.penyesuaianJurnal.tenagaAhli.isSinkronBulan : data.penyesuaianJurnal.tenagaAhli.isSinkronTahun)
                        ? "Saldo telah sesuai (sinkron)"
                        : "Perlu penyesuaian di jurnal umum"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Card 2: Tabel Transaksi Jurnal Umum Akun 612 */}
              <div className="rounded-2xl border border-border bg-surface-card overflow-hidden">
                <div className="p-4 border-b border-border flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-navy-text flex items-center gap-2">
                      <FileText size={16} className="text-navy" />
                      <span>Daftar Transaksi Akun Tenaga Ahli yang Ditarik dari Jurnal Umum (Kode Akun 612)</span>
                    </h3>
                    <p className="text-xs text-muted-faint mt-0.5">
                      Daftar transaksi pengeluaran honor tenaga ahli riil yang menggunakan kode akun 612 pada entitas {data.entity?.name} ({periodeFilterAhli === "bulan" ? `Periode ${BULAN_NAMES[selectedMonth - 1]} ${selectedYear}` : `Tahun ${selectedYear}`})
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[850px] text-left text-xs">
                    <thead className="bg-surface-subtle border-b border-border text-muted-stronger font-bold">
                      <tr>
                        <th className="py-2.5 px-3.5 whitespace-nowrap min-w-[130px]">Tanggal & No Bukti</th>
                        <th className="py-2.5 px-3.5 whitespace-nowrap min-w-[100px]">Sumber Jurnal</th>
                        <th className="py-2.5 px-3.5 whitespace-nowrap min-w-[140px]">Kode & Nama Akun</th>
                        <th className="py-2.5 px-3.5">Keterangan / Uraian</th>
                        <th className="py-2.5 px-3.5 whitespace-nowrap min-w-[120px]">Proyek</th>
                        <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[140px]">Pengeluaran (Debit)</th>
                        <th className="py-2.5 px-3.5 text-center whitespace-nowrap min-w-[90px]">Staff</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {(periodeFilterAhli === "bulan"
                        ? data.penyesuaianJurnal.tenagaAhli.transaksiBulan
                        : data.penyesuaianJurnal.tenagaAhli.transaksiTahun
                      ).length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-10 text-center">
                            <div className="flex flex-col items-center justify-center gap-2 text-muted-faint max-w-md mx-auto">
                              <FileText size={32} className="opacity-40" />
                              <p className="font-semibold text-navy-text">
                                Belum Ada Transaksi di Jurnal Umum untuk Akun 612 (Gaji Tenaga Ahli)
                              </p>
                              <p className="text-[11px] leading-relaxed">
                                Sistem siap menarik data. Jika staf mencatat transaksi pengeluaran honor melalui <strong>Kas Kecil</strong>, <strong>Kas Besar</strong>, atau <strong>Buku Bank</strong> menggunakan kode akun <strong>612</strong>, data akan otomatis ditarik dan muncul di tabel ini untuk penyesuaian.
                              </p>
                              <Link
                                href={`/jurnal?entity=${data.entity?.key ?? ""}`}
                                className="mt-2 h-7 px-3 rounded-lg border border-border bg-surface-subtle hover:bg-surface-hover text-navy-text text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                              >
                                <ExternalLink size={12} />
                                <span>Buka Jurnal Umum</span>
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        (periodeFilterAhli === "bulan"
                          ? data.penyesuaianJurnal.tenagaAhli.transaksiBulan
                          : data.penyesuaianJurnal.tenagaAhli.transaksiTahun
                        ).map((tx) => (
                          <tr key={tx.id} className="hover:bg-surface-hover/30 transition-colors">
                            <td className="py-3 px-3.5 whitespace-nowrap">
                              <div className="font-semibold text-navy-text">{tx.tanggalFmt}</div>
                              <div className="font-mono text-[11px] text-muted-faint mt-0.5">
                                Bukti: {tx.noBukti}
                              </div>
                            </td>
                            <td className="py-3 px-3.5 whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-surface-subtle border border-border text-navy-text">
                                {tx.jenisInputNama}
                              </span>
                            </td>
                            <td className="py-3 px-3.5">
                              <div className="font-mono font-bold text-navy-text text-xs whitespace-nowrap">
                                {tx.coaCode}
                              </div>
                              <div className="text-[11px] text-muted-faint">
                                {tx.coaName}
                              </div>
                            </td>
                            <td className="py-3 px-3.5 text-muted-stronger">
                              {tx.keterangan}
                            </td>
                            <td className="py-3 px-3.5 whitespace-nowrap">
                              {tx.namaProyek ? (
                                <span className="font-semibold text-brand text-[11px] inline-flex items-center gap-1">
                                  <Briefcase size={11} />
                                  <span>{tx.namaProyek}</span>
                                </span>
                              ) : (
                                <span className="text-muted-faint text-[11px]">-</span>
                              )}
                            </td>
                            <td className="py-3 px-3.5 text-right font-mono font-bold text-navy-text text-sm whitespace-nowrap">
                              {tx.debitFmt}
                            </td>
                            <td className="py-3 px-3.5 text-center text-[11px] text-muted-faint whitespace-nowrap">
                              {tx.staffName || "-"}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {(periodeFilterAhli === "bulan"
                      ? data.penyesuaianJurnal.tenagaAhli.transaksiBulan
                      : data.penyesuaianJurnal.tenagaAhli.transaksiTahun
                    ).length > 0 && (
                      <tfoot className="bg-surface-subtle border-t-2 border-border font-bold text-xs">
                        <tr>
                          <td colSpan={5} className="py-3 px-3.5 text-navy-text">
                            Total ({(periodeFilterAhli === "bulan"
                              ? data.penyesuaianJurnal.tenagaAhli.transaksiBulan
                              : data.penyesuaianJurnal.tenagaAhli.transaksiTahun
                            ).length} Transaksi Jurnal Umum):
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono text-navy-text text-sm whitespace-nowrap">
                            {periodeFilterAhli === "bulan"
                              ? data.penyesuaianJurnal.tenagaAhli.totalJurnalBulanFmt
                              : data.penyesuaianJurnal.tenagaAhli.totalJurnalTahunFmt}
                          </td>
                          <td />
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Sub-Tab Content: Database Tenaga Ahli */}
          {tenagaAhliSubTab === "database-ahli" && (
            <div className="rounded-2xl border border-border bg-surface-card overflow-hidden">
              <div className="p-4 border-b border-border bg-surface-subtle/30">
                <h3 className="text-sm font-bold text-navy-text flex items-center gap-2">
                  <Users size={16} className="text-navy" />
                  <span>Database Pegawai Tenaga Ahli (Master Rekanan)</span>
                </h3>
                <p className="text-xs text-muted-faint mt-0.5">
                  Daftar profil tenaga ahli lepas / konsultan holding. NIK dan NPWP didaftarkan sekali di sini, sehingga saat input gaji bulanan cukup memilih nama dari daftar tanpa perlu mengetik ulang NIK dan NPWP.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-xs">
                  <thead className="bg-surface-subtle border-b border-border text-muted-stronger font-bold">
                    <tr>
                      <th className="py-2.5 px-3.5 whitespace-nowrap min-w-[180px]">Nama & Spesialisasi</th>
                      <th className="py-2.5 px-3.5 whitespace-nowrap min-w-[170px]">NIK (16 Digit Terdaftar)</th>
                      <th className="py-2.5 px-3.5 whitespace-nowrap min-w-[130px]">NPWP</th>
                      <th className="py-2.5 px-3.5 whitespace-nowrap min-w-[90px]">Status PTKP</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[160px]">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredRekananList.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-muted-faint">
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
                            <td className="py-3 px-3.5 whitespace-nowrap">
                              <div className="font-bold text-navy-text text-sm">{r.nama}</div>
                              {r.kategori && (
                                <div className="text-[11px] text-muted-faint mt-0.5 inline-flex items-center gap-1">
                                  <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[10px] font-medium">
                                    {r.kategori}
                                  </span>
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-3.5 font-mono whitespace-nowrap">
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
                            <td className="py-3 px-3.5 font-mono text-muted-stronger whitespace-nowrap">
                              {hasNpwp ? r.npwp : <span className="text-muted-faint">-</span>}
                            </td>
                            <td className="py-3 px-3.5 font-mono font-bold text-navy-text whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded-md bg-surface-subtle border border-border text-[11px]">
                                {r.ptkp || "TK/0"}
                              </span>
                            </td>
                            <td className="py-3 px-3.5 text-right whitespace-nowrap">
                              <div className="inline-flex items-center justify-end gap-1.5">
                                {isManager && (
                                  <>
                                    <button
                                      onClick={() => {
                                        openHonorModal(null, r.id);
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
                                        setDeleteDialog({
                                          isOpen: true,
                                          title: "Hapus Master Tenaga Ahli",
                                          itemName: r.nama,
                                          itemSub: `NIK: ${r.nik || "-"} · NPWP: ${r.npwp || "-"}`,
                                          warningNote:
                                            "Tindakan ini hanya diperbolehkan jika belum ada riwayat pembayaran honorarium pada tenaga ahli ini.",
                                          confirmLabel: "Ya, Hapus Rekanan",
                                          onConfirm: async () => {
                                            try {
                                              const res = await deleteTenagaAhliMasterAction(r.id);
                                              setSuccessMsg(res.message);
                                              setDeleteDialog(null);
                                              router.refresh();
                                            } catch (err: unknown) {
                                              setErrorMsg((err as Error).message);
                                              setDeleteDialog(null);
                                            }
                                          },
                                        });
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
                      <th className="py-2.5 px-3.5 whitespace-nowrap min-w-[170px]">NIK & Tenaga Ahli</th>
                      <th className="py-2.5 px-3.5 whitespace-nowrap min-w-[140px]">🏢 Entitas Mana Saja</th>
                      <th className="py-2.5 px-3.5 whitespace-nowrap min-w-[140px]">🏗️ Proyek Mana Saja</th>
                      <th className="py-2.5 px-3.5 whitespace-nowrap min-w-[130px]">📅 Bulan Apa Saja</th>
                      <th className="py-2.5 px-3.5 text-center whitespace-nowrap min-w-[100px]">Jml Transaksi</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[130px]">Total Honorarium</th>
                      <th className="py-2.5 px-3.5 text-center whitespace-nowrap min-w-[100px]">Rincian</th>
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
                              <td className="py-3 px-3.5 whitespace-nowrap">
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

                              <td className="py-3 px-3.5 text-center font-mono whitespace-nowrap">
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
                                            <th className="py-2 px-3 whitespace-nowrap">Tanggal & Bukti</th>
                                            <th className="py-2 px-3 whitespace-nowrap">Entitas Pembayar</th>
                                            <th className="py-2 px-3 whitespace-nowrap">Bulan</th>
                                            <th className="py-2 px-3 whitespace-nowrap">Nama Proyek</th>
                                            <th className="py-2 px-3">Uraian Tugas / Jasa</th>
                                            <th className="py-2 px-3 text-right whitespace-nowrap">Nominal Honorarium</th>
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
                <table className="w-full min-w-[700px] text-left text-xs">
                  <thead className="bg-surface-subtle border-b border-border text-muted-stronger font-bold">
                    <tr>
                      <th className="py-2.5 px-3.5 whitespace-nowrap min-w-[180px]">Tenaga Ahli</th>
                      <th className="py-2.5 px-3.5">Rincian Per Entitas Pembayar</th>
                      <th className="py-2.5 px-3.5 text-center whitespace-nowrap min-w-[120px]">Frekuensi</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[140px]">Total Honorarium</th>
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
                          <td className="py-3 px-3.5 whitespace-nowrap">
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

                          <td className="py-3 px-3.5 text-center font-mono font-bold text-navy-text whitespace-nowrap">
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

            {/* Tabel Penarikan Transaksi Jurnal Umum Riil */}
            <div className="pt-2 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-navy" />
                  <div>
                    <h4 className="text-xs font-bold text-navy-text">
                      Daftar Transaksi yang Ditarik Langsung dari Jurnal Umum
                    </h4>
                    <p className="text-[11px] text-muted-faint">
                      Transaksi beban penggajian riil dari Jurnal Umum entitas {data.entity?.name} (Bulan {BULAN_NAMES[selectedMonth - 1]} {selectedYear})
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 bg-surface-subtle p-1 rounded-xl border border-border">
                  <button
                    onClick={() => setSyncDetailTab("pegawai")}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
                      syncDetailTab === "pegawai"
                        ? "bg-surface-card text-navy-text shadow-2xs font-bold"
                        : "text-muted-faint hover:text-navy-text"
                    }`}
                  >
                    <span>Akun 511 (Gaji Pegawai)</span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-navy/10 text-navy">
                      {data.syncData.jurnalPegawaiRows.length}
                    </span>
                  </button>

                  <button
                    onClick={() => setSyncDetailTab("tenaga-ahli")}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
                      syncDetailTab === "tenaga-ahli"
                        ? "bg-surface-card text-navy-text shadow-2xs font-bold"
                        : "text-muted-faint hover:text-navy-text"
                    }`}
                  >
                    <span>Akun 612 (Tenaga Ahli)</span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-navy/10 text-navy">
                      {data.syncData.jurnalTenagaAhliRows.length}
                    </span>
                  </button>
                </div>
              </div>

              {/* Tabel Transaksi Tab Terpilih */}
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full min-w-[780px] text-left text-xs">
                  <thead className="bg-surface-subtle border-b border-border text-muted-stronger font-bold">
                    <tr>
                      <th className="py-2.5 px-3 whitespace-nowrap min-w-[130px]">Tanggal & Bukti</th>
                      <th className="py-2.5 px-3 whitespace-nowrap min-w-[100px]">Sumber Jurnal</th>
                      <th className="py-2.5 px-3 whitespace-nowrap min-w-[150px]">Kode Akun</th>
                      <th className="py-2.5 px-3">Keterangan</th>
                      <th className="py-2.5 px-3 whitespace-nowrap min-w-[120px]">Proyek</th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap min-w-[130px]">Debit (Beban)</th>
                      <th className="py-2.5 px-3 text-center whitespace-nowrap min-w-[90px]">Staff</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(syncDetailTab === "pegawai"
                      ? data.syncData.jurnalPegawaiRows
                      : data.syncData.jurnalTenagaAhliRows
                    ).length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-muted-faint">
                          Belum ada transaksi di Jurnal Umum untuk {syncDetailTab === "pegawai" ? "Akun 511 (Gaji Pegawai Tetap)" : "Akun 612 (Gaji Tenaga Ahli)"} pada bulan {BULAN_NAMES[selectedMonth - 1]} {selectedYear}.
                        </td>
                      </tr>
                    ) : (
                      (syncDetailTab === "pegawai"
                        ? data.syncData.jurnalPegawaiRows
                        : data.syncData.jurnalTenagaAhliRows
                      ).map((tx) => (
                        <tr key={tx.id} className="hover:bg-surface-hover/30 transition-colors">
                          <td className="py-2.5 px-3 font-medium whitespace-nowrap">
                            <div className="text-navy-text">{tx.tanggalFmt}</div>
                            <div className="text-[10px] font-mono text-muted-faint">{tx.noBukti}</div>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-surface-subtle border border-border text-navy-text">
                              {tx.jenisInputNama}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-navy-text whitespace-nowrap">
                            {tx.coaCode} - {tx.coaName}
                          </td>
                          <td className="py-2.5 px-3 text-muted-stronger">
                            {tx.keterangan}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {tx.namaProyek ? (
                              <span className="font-semibold text-brand text-[11px] inline-flex items-center gap-1">
                                <Briefcase size={11} />
                                <span>{tx.namaProyek}</span>
                              </span>
                            ) : (
                              <span className="text-muted-faint text-[11px]">-</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-navy-text whitespace-nowrap">
                            {tx.debitFmt}
                          </td>
                          <td className="py-2.5 px-3 text-center text-[11px] text-muted-faint whitespace-nowrap">
                            {tx.staffName || "-"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {(syncDetailTab === "pegawai"
                    ? data.syncData.jurnalPegawaiRows
                    : data.syncData.jurnalTenagaAhliRows
                  ).length > 0 && (
                    <tfoot className="bg-surface-subtle border-t border-border font-bold text-xs">
                      <tr>
                        <td colSpan={5} className="py-2.5 px-3 text-navy-text">
                          Total Debit ({syncDetailTab === "pegawai" ? "Akun 511" : "Akun 612"}):
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-navy-text whitespace-nowrap">
                          {syncDetailTab === "pegawai"
                            ? data.syncData.glBebanGaji511Fmt
                            : data.syncData.glBebanTenagaAhli612Fmt}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 4: REKONSILIASI PAJAK GAJI & PPH 21 (SPT MASA 1721) */}
      {/* ========================================================= */}
      {mainTab === "rekonsiliasi" && (
        <RekonsiliasiPajakGajiClient
          data={rekonsiliasiData}
          canEdit={isManager}
          entityKey={data.entity?.key ?? ""}
        />
      )}

      {/* ========================================================= */}
      {/* MODAL 1: FORM TAMBAH / EDIT PEGAWAI TETAP */}
      {/* ========================================================= */}
      {mounted && isPegawaiModalOpen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-surface-card rounded-2xl border border-border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface-subtle/50">
              <h3 className="text-sm font-bold text-navy-text flex items-center gap-2">
                <Users size={16} />
                <span>{editingPegawai ? "Edit Data Pegawai Tetap" : "Tambah Pegawai Tetap Baru"}</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-navy/10 text-navy font-sans">
                  {data.entity?.name}
                </span>
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
                        if (ptkpInput) ptkpInput.value = formatRupiahInput(PTKP_RATES[e.target.value]);
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
                    type="text"
                    inputMode="numeric"
                    name="ptkp"
                    defaultValue={formatRupiahInput(editingPegawai?.ptkp ?? 54000000)}
                    onChange={(e) => {
                      const num = Number(e.target.value.replace(/[^0-9]/g, "")) || 0;
                      e.target.value = formatRupiahInput(num);
                    }}
                    className="w-full h-8 px-3 rounded-lg border border-border bg-surface-card text-foreground font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-navy-text block mb-1">Gaji Pokok Standar (Rp) *</label>
                <input
                  type="text"
                  inputMode="numeric"
                  name="gajiPokok"
                  required
                  defaultValue={formatRupiahInput(editingPegawai?.gajiPokok ? editingPegawai.gajiPokok : "")}
                  onChange={(e) => {
                    const num = Number(e.target.value.replace(/[^0-9]/g, "")) || 0;
                    e.target.value = formatRupiahInput(num);
                  }}
                  placeholder="0"
                  className="w-full h-8 px-3 rounded-lg border border-border bg-surface-card text-foreground font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-navy-text block mb-1">Tunjangan Jabatan Rutin (Rp)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  name="tunjanganJabatan"
                  defaultValue={formatRupiahInput(editingPegawai?.tunjanganJabatan ? editingPegawai.tunjanganJabatan : "")}
                  onChange={(e) => {
                    const num = Number(e.target.value.replace(/[^0-9]/g, "")) || 0;
                    e.target.value = formatRupiahInput(num);
                  }}
                  placeholder="0"
                  className="w-full h-8 px-3 rounded-lg border border-border bg-surface-card text-foreground font-mono"
                />
                <p className="text-[10px] text-muted-faint mt-0.5">
                  Disimpan permanen di master data dan otomatis terisi saat input gaji bulanan tanpa perlu ketik ulang.
                </p>
              </div>

              <div>
                <label className="font-semibold text-navy-text block mb-1">
                  Bulan & Tahun Mulai Bekerja (Tanggal Masuk)
                </label>
                <input
                  type="date"
                  name="tanggalMasuk"
                  defaultValue={
                    editingPegawai?.tanggalMasuk
                      ? new Date(editingPegawai.tanggalMasuk).toISOString().split("T")[0]
                      : ""
                  }
                  className="w-full h-8 px-3 rounded-lg border border-border bg-surface-card text-foreground font-mono"
                />
                <p className="text-[10px] text-muted-faint mt-0.5">
                  Mencatat tanggal/bulan/tahun mulai bekerja (misalnya masuk tahun 2014) untuk histori dan otomatis menghitung masa kerja karyawan.
                </p>
              </div>

              <div>
                <label className="font-semibold text-navy-text block mb-1">Status Karyawan *</label>
                <select
                  name="status"
                  value={modalPegawaiStatus}
                  onChange={(e) => {
                    const val = e.target.value as "AKTIF" | "RESIGN" | "PENSIUN";
                    setModalPegawaiStatus(val);
                    if (val === "AKTIF") {
                      setModalTanggalResign("");
                    }
                  }}
                  className="w-full h-8 px-2.5 rounded-lg border border-border bg-surface-card text-foreground font-semibold"
                >
                  <option value="AKTIF">AKTIF – Bekerja Aktif (Otomatis muncul di daftar gaji setiap bulan)</option>
                  <option value="RESIGN">RESIGN – Berhenti / Mengundurkan Diri</option>
                  <option value="PENSIUN">PENSIUN – Pensiun</option>
                </select>
                <p className="text-[10px] text-muted-faint mt-1">
                  Karyawan berstatus <strong>Aktif</strong> otomatis muncul di daftar gaji setiap bulan tanpa perlu di-input ulang.
                </p>
              </div>

              {modalPegawaiStatus !== "AKTIF" && (
                <div className="p-3 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/50 dark:bg-amber-950/20 space-y-2 animate-in fade-in">
                  <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 font-semibold text-xs">
                    <AlertCircle size={14} />
                    <span>Tanggal {modalPegawaiStatus === "PENSIUN" ? "Pensiun" : "Resign"}</span>
                  </div>
                  <input
                    type="date"
                    name="tanggalResign"
                    value={modalTanggalResign}
                    onChange={(e) => setModalTanggalResign(e.target.value)}
                    className="w-full h-8 px-3 rounded-lg border border-border bg-surface-card text-foreground font-mono"
                  />
                  <p className="text-[10px] text-amber-900/80 dark:text-amber-300/80 leading-relaxed">
                    <strong>Arsip & Perpajakan:</strong> Data rekam gaji karyawan ini <strong>tidak boleh dihapus</strong> untuk arsip dan SPT tahunan. Namanya secara otomatis tidak akan muncul lagi di daftar gaji setelah tanggal {modalPegawaiStatus === "PENSIUN" ? "pensiun" : "resign"} ini.
                  </p>
                </div>
              )}

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
        </div>,
        document.body
      )}

      {/* ========================================================= */}
      {/* MODAL 1B: QUICK DIALOG STATUS RESIGN / PENSIUN */}
      {/* ========================================================= */}
      {mounted && quickStatusTarget && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-surface-card rounded-2xl border border-border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-surface-subtle/50">
              <h3 className="text-sm font-bold text-navy-text flex items-center gap-2">
                <AlertCircle size={16} className={quickStatusTarget.status === "PENSIUN" ? "text-purple-600" : "text-amber-600"} />
                <span>Ubah Status Pegawai</span>
              </h3>
              <button
                onClick={() => setQuickStatusTarget(null)}
                className="p-1 text-muted-faint hover:text-navy-text rounded-lg transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs">
              <div>
                <div className="font-bold text-navy-text text-sm">{quickStatusTarget.pegawai.nama}</div>
                <div className="text-muted-faint font-mono text-[11px] mt-0.5">
                  {quickStatusTarget.pegawai.nik} · {quickStatusTarget.pegawai.jabatan}
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-surface-subtle border border-border space-y-1">
                <div className="text-[11px] text-muted-faint font-medium">Status Baru:</div>
                <div className="font-bold text-xs">
                  {quickStatusTarget.status === "PENSIUN" ? (
                    <span className="text-purple-700 dark:text-purple-300">Pensiun</span>
                  ) : (
                    <span className="text-amber-700 dark:text-amber-300">Resign / Berhenti Bekerja</span>
                  )}
                </div>
              </div>

              <div>
                <label className="font-semibold text-navy-text block mb-1">
                  Tanggal Efektif {quickStatusTarget.status === "PENSIUN" ? "Pensiun" : "Resign"} *
                </label>
                <input
                  type="date"
                  value={quickStatusTarget.tanggal}
                  onChange={(e) =>
                    setQuickStatusTarget((prev) =>
                      prev ? { ...prev, tanggal: e.target.value } : null
                    )
                  }
                  required
                  className="w-full h-8 px-3 rounded-lg border border-border bg-surface-card text-foreground font-mono"
                />
                <p className="text-[10px] text-muted-faint mt-1 leading-relaxed">
                  Data penggajian sebelum dan pada tanggal ini tetap diarsip utuh. Karyawan otomatis tidak muncul di daftar gaji pada bulan-bulan setelah tanggal ini.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setQuickStatusTarget(null)}
                  className="px-3.5 py-1.5 rounded-lg border border-border text-muted-stronger hover:bg-surface-hover transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={isPending || !quickStatusTarget.tanggal}
                  onClick={() => {
                    startTransition(async () => {
                      try {
                        await updatePegawaiStatusAction(
                          quickStatusTarget.pegawai.id,
                          quickStatusTarget.status,
                          quickStatusTarget.tanggal
                        );
                        setSuccessMsg(
                          `Status ${quickStatusTarget.pegawai.nama} berhasil diubah menjadi ${
                            quickStatusTarget.status === "PENSIUN" ? "Pensiun" : "Resign"
                          }.`
                        );
                        setQuickStatusTarget(null);
                        router.refresh();
                      } catch (err: unknown) {
                        setErrorMsg((err as Error).message);
                      }
                    });
                  }}
                  className="px-4 py-1.5 rounded-lg bg-navy text-white font-semibold hover:bg-navy-light transition-colors cursor-pointer shadow-2xs"
                >
                  {isPending ? "Menyimpan..." : "Simpan Status"}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================= */}
      {/* MODAL 1C: DIALOG KONFIRMASI HAPUS DATA KUSTOM */}
      {/* ========================================================= */}
      {mounted && deleteDialog && deleteDialog.isOpen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-surface-card rounded-2xl border border-border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-surface-subtle/50">
              <h3 className="text-sm font-bold text-navy-text flex items-center gap-2">
                <Trash2 size={16} className="text-rose-600" />
                <span>{deleteDialog.title}</span>
              </h3>
              <button
                onClick={() => setDeleteDialog(null)}
                className="p-1 text-muted-faint hover:text-navy-text rounded-lg transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60 flex items-center justify-center shrink-0 mt-0.5">
                  <Trash2 size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-navy-text">
                    Apakah Anda yakin ingin menghapus data ini?
                  </h4>
                  <p className="text-muted-faint mt-1 leading-relaxed">
                    Tindakan ini tidak dapat dibatalkan. Pastikan data yang dipilih sudah benar.
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-subtle border border-border space-y-1">
                <div className="text-[10px] font-bold text-muted-faint uppercase tracking-wider">
                  Rincian Data
                </div>
                <div className="text-sm font-bold text-navy-text">
                  {deleteDialog.itemName}
                </div>
                {deleteDialog.itemSub && (
                  <div className="text-xs text-muted-stronger">
                    {deleteDialog.itemSub}
                  </div>
                )}
              </div>

              {deleteDialog.warningNote && (
                <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-300 text-[11px] leading-relaxed flex items-start gap-2">
                  <AlertCircle size={15} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                  <span>{deleteDialog.warningNote}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => setDeleteDialog(null)}
                  className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-muted-stronger hover:bg-surface-hover transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    startTransition(async () => {
                      await deleteDialog.onConfirm();
                    });
                  }}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isPending ? "Menghapus..." : deleteDialog.confirmLabel || "Ya, Hapus"}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================= */}
      {/* MODAL 2: FORM INPUT / EDIT GAJI BULANAN */}
      {/* ========================================================= */}
      {mounted && isGajiModalOpen && editingGaji && typeof document !== "undefined" && (() => {
        const liveTotalBpjs = Number(modalBpjsKes || 0) + Number(modalBpjsTk || 0);
        const liveTotalTunjanganBpjs =
          Number(modalTunjanganBpjsKes || 0) + Number(modalTunjanganBpjsTk || 0);

        const liveTotalGajiKotor =
          Number(modalGajiPokok || 0) +
          Number(modalTunjanganJabatan || 0) +
          Number(modalTunjanganTransport || 0) +
          Number(modalTunjanganLainnya || 0) +
          Number(modalThr || 0) +
          liveTotalTunjanganBpjs +
          Number(modalTunjanganPph || 0);

        const liveTotalGajiTerlaporPajak = liveTotalGajiKotor;

        // Potongan yang riil dipotong dari karyawan: BPJS (Kes + TK) dan Potongan Lain
        // PPh 21 TIDAK dipotong dari karyawan karena 100% ditanggung perusahaan
        const liveTotalPotonganKaryawan =
          liveTotalBpjs + Number(modalPotonganLain || 0);

        const liveTotalGajiBersih = Math.max(
          0,
          Number(modalGajiPokok || 0) +
            Number(modalTunjanganJabatan || 0) +
            Number(modalTunjanganTransport || 0) +
            Number(modalTunjanganLainnya || 0) +
            Number(modalThr || 0) -
            liveTotalPotonganKaryawan
        );

        return createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="w-full max-w-xl bg-surface-card rounded-2xl border border-border shadow-2xl overflow-hidden max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface-subtle/50">
                <div>
                  <h3 className="text-sm font-bold text-navy-text flex items-center gap-2">
                    <CreditCard size={16} />
                    <span>Komponen Gaji: {editingGaji.pegawai.nama}</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-navy/10 text-navy font-sans">
                      {data.entity?.name}
                    </span>
                  </h3>
                  <p className="text-[11px] text-muted-faint mt-0.5">
                    Periode: {BULAN_NAMES[modalGajiBulan - 1]} {modalGajiTahun} · {editingGaji.pegawai.jabatan}
                  </p>
                </div>
                <button
                  onClick={() => setIsGajiModalOpen(false)}
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
                      await saveGajiBulananAction(fd);
                      setSuccessMsg(
                        `Gaji ${editingGaji.pegawai.nama} periode ${BULAN_NAMES[modalGajiBulan - 1]} ${modalGajiTahun} berhasil disimpan.`
                      );
                      setIsGajiModalOpen(false);
                      if (modalGajiBulan !== selectedMonth || modalGajiTahun !== selectedYear) {
                        router.push(`${pathname}?tab=pegawai&year=${modalGajiTahun}&month=${modalGajiBulan}`);
                      } else {
                        router.refresh();
                      }
                    } catch (err: unknown) {
                      setErrorMsg((err as Error).message);
                    }
                  });
                }}
                className="p-5 space-y-4 text-xs overflow-y-auto flex-1"
              >
                <input type="hidden" name="pegawaiId" value={modalGajiPegawaiId} />
                <input type="hidden" name="entityId" value={data.entity?.id ?? ""} />
                <input type="hidden" name="tunjanganBpjs" value={modalTunjanganBpjsKes + modalTunjanganBpjsTk} />
                <input type="hidden" name="potonganBpjs" value={modalBpjsKes + modalBpjsTk} />
                <input type="hidden" name="insentif" value={modalTunjanganLainnya} />

                {/* 1. Pemilihan Periode Bulan & Tahun Dinamis */}
                <div className="p-3.5 rounded-xl bg-surface-subtle border border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-navy-text text-xs">
                      Periode Bulan & Tahun Transaksi *
                    </span>
                    <span className="text-[10px] text-muted-faint font-medium">
                      Bebas pilih bulan lalu / berjalan / mendatang
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-muted-stronger block mb-1">Bulan Transaksi</label>
                      <select
                        name="bulan"
                        value={modalGajiBulan}
                        onChange={(e) => setModalGajiBulan(Number(e.target.value))}
                        className="w-full h-8 px-2.5 rounded-lg border border-border bg-surface-card text-foreground font-semibold"
                      >
                        {BULAN_NAMES.map((mName, idx) => (
                          <option key={idx + 1} value={idx + 1}>
                            Bulan {idx + 1} – {mName}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-stronger block mb-1">Tahun Transaksi</label>
                      <input
                        type="number"
                        name="tahun"
                        value={modalGajiTahun}
                        onChange={(e) => setModalGajiTahun(Number(e.target.value) || selectedYear)}
                        min={2000}
                        max={2100}
                        className="w-full h-8 px-3 rounded-lg border border-border bg-surface-card text-foreground font-mono font-semibold"
                      />
                    </div>
                  </div>
                </div>

                {/* Pemilihan Pegawai */}
                <div>
                  <label className="font-semibold text-navy-text block mb-1">
                    Pilih Pegawai Terdaftar *
                  </label>
                  <select
                    value={modalGajiPegawaiId}
                    onChange={(e) => handleSelectPegawaiInModal(e.target.value)}
                    className="w-full h-8 px-2.5 rounded-lg border border-border bg-surface-card text-foreground font-semibold"
                  >
                    {data.pegawaiList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nama} – {p.jabatan} {p.currentGaji ? "(Sudah Ada Data Bulan Ini)" : "(Belum Diinput)"}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Master Pegawai Summary Card */}
                <div className="p-3 rounded-xl bg-surface-subtle border border-border grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-muted-faint block">NIK & PTKP</span>
                    <strong className="text-navy-text font-mono text-[11px]">
                      {editingGaji.pegawai.nik}
                    </strong>
                    <div className="text-[10px] text-muted-faint">
                      {editingGaji.pegawai.statusKeluarga} (PTKP: {editingGaji.pegawai.ptkpFmt})
                    </div>
                    {editingGaji.pegawai.masaKerja && (
                      <div className="text-[10px] text-muted-stronger mt-1">
                        Masa Kerja: <span className="font-semibold text-emerald-700 dark:text-emerald-400 font-mono">{editingGaji.pegawai.masaKerja}</span>
                        {editingGaji.pegawai.tanggalMasukFmt && (
                          <span className="text-muted-faint text-[9px] block">
                            (Sejak {editingGaji.pegawai.tanggalMasukFmt})
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-muted-faint block">Gaji Pokok & Tunj. Jabatan Master</span>
                    <strong className="text-navy-text font-mono text-[11px] block">
                      Pokok: {editingGaji.pegawai.gajiPokokFmt}
                    </strong>
                    <span className="text-[10px] text-muted-stronger font-mono">
                      Jabatan: {editingGaji.pegawai.tunjanganJabatanFmt || formatRupiah(editingGaji.pegawai.tunjanganJabatan)}
                    </span>
                  </div>
                </div>

                {/* Penghasilan / Pendapatan */}
                <div className="space-y-2.5">
                  <h4 className="font-bold text-navy-text uppercase tracking-wider text-[10px] text-muted-stronger">
                    A. Komponen Penghasilan & Tunjangan (Bruto)
                  </h4>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold text-navy-text block mb-1">Gaji Pokok (Bulan ini) *</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        name="gajiPokok"
                        required
                        value={formatRupiahInput(modalGajiPokok)}
                        onChange={(e) => setModalGajiPokok(Number(e.target.value.replace(/[^0-9]/g, "")) || 0)}
                        placeholder="0"
                        className="w-full h-8 px-3 rounded-lg border border-border bg-surface-card text-foreground font-mono"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-navy-text block mb-1">
                        Tunjangan Jabatan (Rutin)
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        name="tunjanganJabatan"
                        value={formatRupiahInput(modalTunjanganJabatan)}
                        onChange={(e) => setModalTunjanganJabatan(Number(e.target.value.replace(/[^0-9]/g, "")) || 0)}
                        placeholder="0"
                        className="w-full h-8 px-3 rounded-lg border border-border bg-surface-card text-foreground font-mono"
                      />
                      <span className="text-[10px] text-muted-faint block mt-0.5">
                        Otomatis terisi dari master data karyawan
                      </span>
                    </div>
                  </div>

                  {/* 2. Otomatisasi Tunjangan Transport (Hari Kerja x Tarif Harian Dinamis/Editable) */}
                  <div className="p-3 rounded-xl bg-surface-subtle/80 border border-border space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="font-semibold text-navy-text block text-xs">
                        Otomatisasi Tunjangan Transport
                      </label>
                      <span className="text-[10px] text-muted-faint font-mono">
                        Hari Kerja × Tarif Harian
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-muted-stronger block mb-0.5">Hari Kerja (Hari)</label>
                        <input
                          type="number"
                          name="hariKerja"
                          min={0}
                          max={31}
                          value={modalHariKerja || ""}
                          onChange={(e) => {
                            const val = Number(e.target.value) || 0;
                            setModalHariKerja(val);
                            setModalTunjanganTransport(val * modalTarifTransport);
                          }}
                          placeholder="0"
                          className="w-full h-8 px-2.5 rounded-lg border border-border bg-surface-card text-foreground font-mono text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-stronger block mb-0.5">Tarif Harian (Rp)</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          name="tarifTransportHarian"
                          value={formatRupiahInput(modalTarifTransport)}
                          onChange={(e) => {
                            const val = Number(e.target.value.replace(/[^0-9]/g, "")) || 0;
                            setModalTarifTransport(val);
                            setModalTunjanganTransport(modalHariKerja * val);
                          }}
                          placeholder="0"
                          className="w-full h-8 px-2.5 rounded-lg border border-border bg-surface-card text-foreground font-mono text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-navy-text font-semibold block mb-0.5">
                          Total Transport (Rp)
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          name="tunjanganTransport"
                          value={formatRupiahInput(modalTunjanganTransport)}
                          onChange={(e) => setModalTunjanganTransport(Number(e.target.value.replace(/[^0-9]/g, "")) || 0)}
                          placeholder="0"
                          className="w-full h-8 px-2.5 rounded-lg border border-border bg-surface-card text-navy-text font-bold font-mono text-xs"
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-faint">
                      💡 Tarif harian fleksibel dapat diedit per bulan (misal bulan ini Rp 15.000/hari, bulan depan Rp 20.000/hari).
                    </p>
                  </div>

                  {/* 3. Komponen Tunjangan Tambahan */}
                  <div className="space-y-2.5 pt-2 border-t border-border/60">
                    <h5 className="font-bold text-navy-text uppercase tracking-wider text-[10px] text-muted-stronger">
                      Komponen Tunjangan Tambahan
                    </h5>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="font-semibold text-navy-text block mb-1">Tunjangan BPJS Kesehatan</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          name="tunjanganBpjsKes"
                          value={formatRupiahInput(modalTunjanganBpjsKes)}
                          onChange={(e) => setModalTunjanganBpjsKes(Number(e.target.value.replace(/[^0-9]/g, "")) || 0)}
                          placeholder="0"
                          className="w-full h-8 px-3 rounded-lg border border-border bg-surface-card text-foreground font-mono"
                        />
                        <span className="text-[10px] text-muted-faint block mt-0.5">
                          Tunjangan BPJS Kesehatan ditanggung pemberi kerja
                        </span>
                      </div>
                      <div>
                        <label className="font-semibold text-navy-text block mb-1">Tunjangan BPJS Ketenagakerjaan</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          name="tunjanganBpjsTk"
                          value={formatRupiahInput(modalTunjanganBpjsTk)}
                          onChange={(e) => setModalTunjanganBpjsTk(Number(e.target.value.replace(/[^0-9]/g, "")) || 0)}
                          placeholder="0"
                          className="w-full h-8 px-3 rounded-lg border border-border bg-surface-card text-foreground font-mono"
                        />
                        <span className="text-[10px] text-muted-faint block mt-0.5">
                          Tunjangan BPJS TK ditanggung pemberi kerja
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2.5">
                      <div>
                        <label className="font-semibold text-navy-text block mb-1">Tunjangan THR</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          name="thr"
                          value={formatRupiahInput(modalThr)}
                          onChange={(e) => setModalThr(Number(e.target.value.replace(/[^0-9]/g, "")) || 0)}
                          placeholder="0"
                          className="w-full h-8 px-2.5 rounded-lg border border-border bg-surface-card text-foreground font-mono"
                        />
                        <span className="text-[10px] text-muted-faint block mt-0.5">
                          Tunjangan Hari Raya
                        </span>
                      </div>
                      <div>
                        <label className="font-semibold text-navy-text block mb-1">Tunjangan PPh</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          name="tunjanganPph"
                          value={formatRupiahInput(modalTunjanganPph)}
                          onChange={(e) => setModalTunjanganPph(Number(e.target.value.replace(/[^0-9]/g, "")) || 0)}
                          placeholder="0"
                          className="w-full h-8 px-2.5 rounded-lg border border-border bg-surface-card text-foreground font-mono"
                        />
                        <span className="text-[10px] text-muted-faint block mt-0.5">
                          Subsidi PPh 21 kantor
                        </span>
                      </div>
                      <div>
                        <label className="font-semibold text-navy-text block mb-1">Tunjangan Lainnya</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          name="tunjanganLainnya"
                          value={formatRupiahInput(modalTunjanganLainnya)}
                          onChange={(e) => {
                            const val = Number(e.target.value.replace(/[^0-9]/g, "")) || 0;
                            setModalTunjanganLainnya(val);
                            setModalInsentif(val);
                          }}
                          placeholder="0"
                          className="w-full h-8 px-2.5 rounded-lg border border-border bg-surface-card text-foreground font-mono"
                        />
                        <span className="text-[10px] text-muted-faint block mt-0.5">
                          Insentif / lembur / bonus
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Potongan */}
                <div className="space-y-2.5 pt-2 border-t border-border">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-navy-text uppercase tracking-wider text-[10px] text-rose-700 dark:text-rose-400">
                      B. Komponen Potongan (Deductions)
                    </h4>
                    <span className="text-[10px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 font-semibold">
                      ✓ PPh 21 Ditanggung Perusahaan (Rp 0 Dipotong dari Karyawan)
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    <div>
                      <label className="font-semibold text-navy-text block mb-1">Potongan BPJS Kesehatan</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        name="bpjsKesehatan"
                        value={formatRupiahInput(modalBpjsKes)}
                        onChange={(e) => setModalBpjsKes(Number(e.target.value.replace(/[^0-9]/g, "")) || 0)}
                        placeholder="0"
                        className="w-full h-8 px-2.5 rounded-lg border border-border bg-surface-card text-foreground font-mono"
                      />
                      <span className="text-[10px] text-muted-faint block mt-0.5">
                        BPJS Kesehatan pegawai
                      </span>
                    </div>
                    <div>
                      <label className="font-semibold text-navy-text block mb-1">Potongan BPJS TK</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        name="bpjsKetenagakerjaan"
                        value={formatRupiahInput(modalBpjsTk)}
                        onChange={(e) => setModalBpjsTk(Number(e.target.value.replace(/[^0-9]/g, "")) || 0)}
                        placeholder="0"
                        className="w-full h-8 px-2.5 rounded-lg border border-border bg-surface-card text-foreground font-mono"
                      />
                      <span className="text-[10px] text-muted-faint block mt-0.5">
                        BPJS Ketenagakerjaan
                      </span>
                    </div>
                    <div>
                      <label className="font-semibold text-navy-text block mb-1">Potongan Lain</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        name="potonganLain"
                        value={formatRupiahInput(modalPotonganLain)}
                        onChange={(e) => setModalPotonganLain(Number(e.target.value.replace(/[^0-9]/g, "")) || 0)}
                        placeholder="0"
                        className="w-full h-8 px-2.5 rounded-lg border border-border bg-surface-card text-foreground font-mono"
                      />
                      <span className="text-[10px] text-muted-faint block mt-0.5">
                        Kasbon / pinjaman
                      </span>
                    </div>
                  </div>

                  {/* PPh 21 Ditanggung Perusahaan Card */}
                  <div className="p-2.5 rounded-xl bg-surface-subtle border border-border flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-navy-text text-xs">
                        Pelaporan PPh 21 (SPT Pajak)
                      </div>
                      <div className="text-[10px] text-muted-faint">
                        PPh 21 ditanggung perusahaan sehingga <strong className="text-emerald-700 dark:text-emerald-400">tidak memotong Take Home Pay</strong> karyawan.
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        name="pph21"
                        value={formatRupiahInput(modalPph21)}
                        onChange={(e) => setModalPph21(Number(e.target.value.replace(/[^0-9]/g, "")) || 0)}
                        placeholder="0"
                        className="w-32 h-8 px-2.5 rounded-lg border border-border bg-surface-card text-foreground font-mono text-xs text-right"
                      />
                      <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2 py-1 rounded border border-amber-200 dark:border-amber-800 whitespace-nowrap">
                        Beban Kantor
                      </span>
                    </div>
                  </div>
                </div>

                {/* 5. Dual Total Live Preview Card */}
                <div className="p-3.5 rounded-2xl border border-border bg-surface-subtle/50 space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-stronger flex items-center justify-between">
                    <span>Perbandingan Dual Total (Live Preview)</span>
                    <span className="text-[10px] text-muted-faint font-normal font-sans">Otomatis dihitung</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    {/* Dual Total 1: Terlapor Pajak */}
                    <div className="p-2.5 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/60 dark:bg-blue-950/30">
                      <div className="text-[10px] font-semibold text-blue-800 dark:text-blue-300 flex items-center justify-between">
                        <span>Bruto Terlapor Pajak</span>
                        <span className="text-[9px] px-1 py-0.2 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 font-mono font-bold">
                          SPT PPh 21
                        </span>
                      </div>
                      <div className="text-base font-bold font-mono text-blue-900 dark:text-blue-200 mt-1">
                        {formatRupiah(liveTotalGajiTerlaporPajak)}
                      </div>
                      <div className="text-[9px] text-blue-700/80 dark:text-blue-300/70 mt-0.5">
                        Dasar pelaporan SPT Masa Pajak
                      </div>
                    </div>

                    {/* Dual Total 2: Take Home Pay */}
                    <div className="p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/60 dark:bg-emerald-950/30">
                      <div className="text-[10px] font-semibold text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                        <span>Gaji Bersih (THP)</span>
                        <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-200 font-mono font-bold">
                          Kas / GL 511
                        </span>
                      </div>
                      <div className="text-base font-bold font-mono text-emerald-800 dark:text-emerald-200 mt-1">
                        {formatRupiah(liveTotalGajiBersih)}
                      </div>
                      <div className="text-[9px] text-emerald-700/80 dark:text-emerald-300/70 mt-0.5">
                        Dana riil keluar dari rekening
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-navy-text block mb-1">Catatan / Keterangan</label>
                  <input
                    type="text"
                    name="catatan"
                    value={modalCatatan}
                    onChange={(e) => setModalCatatan(e.target.value)}
                    placeholder="Opsional: Keterangan lembur / penyesuaian"
                    className="w-full h-8 px-3 rounded-lg border border-border bg-surface-card text-foreground"
                  />
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-border">
                  {editingGaji.gaji && (
                    <button
                      type="button"
                      onClick={() => {
                        const gajiId = editingGaji.gaji!.id;
                        const pegawaiNama = editingGaji.pegawai.nama;
                        setDeleteDialog({
                          isOpen: true,
                          title: "Hapus Input Gaji Bulan Ini",
                          itemName: `Gaji ${pegawaiNama}`,
                          itemSub: `Periode: ${BULAN_NAMES[modalGajiBulan]} ${modalGajiTahun}`,
                          warningNote:
                            "Data input gaji bulan ini akan dihapus dan nilai komponen gaji akan kembali mengikuti standar gaji pokok master.",
                          confirmLabel: "Ya, Hapus Input Gaji",
                          onConfirm: async () => {
                            try {
                              await deleteGajiBulananAction(gajiId);
                              setSuccessMsg("Input gaji bulan ini berhasil dihapus.");
                              setIsGajiModalOpen(false);
                              setDeleteDialog(null);
                              router.refresh();
                            } catch (err: unknown) {
                              setErrorMsg((err as Error).message);
                              setDeleteDialog(null);
                            }
                          },
                        });
                      }}
                      className="px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-800/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold cursor-pointer"
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
          </div>,
          document.body
        );
      })()}

      {/* ========================================================= */}
      {/* MODAL 3: FORM INPUT / EDIT GAJI TENAGA AHLI */}
      {/* ========================================================= */}
      {mounted && isHonorModalOpen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-xl bg-surface-card rounded-2xl border border-border shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
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
                const targetBulan = modalHonorBulan;
                const targetTahun = modalHonorTahun;
                startTransition(async () => {
                  try {
                    await saveHonorTenagaAhliAction(fd);
                    setSuccessMsg(
                      `Data gaji tenaga ahli berhasil disimpan pada periode ${BULAN_NAMES[targetBulan - 1]} ${targetTahun}.`
                    );
                    setIsHonorModalOpen(false);
                    if (targetBulan !== selectedMonth || targetTahun !== selectedYear) {
                      const params = new URLSearchParams(searchParams.toString());
                      params.set("tab", "tenaga-ahli");
                      params.set("year", targetTahun.toString());
                      params.set("month", targetBulan.toString());
                      router.push(`${pathname}?${params.toString()}`);
                    } else {
                      router.refresh();
                    }
                  } catch (err: unknown) {
                    setErrorMsg((err as Error).message);
                  }
                });
              }}
              className="p-5 space-y-3.5 text-xs overflow-y-auto flex-1"
            >
              {editingHonor && <input type="hidden" name="id" value={editingHonor.id} />}
              <input type="hidden" name="entityId" value={data.entity?.id ?? ""} />

              {/* Card 1: Pemilihan Periode Bulan Transaksi Dinamis */}
              <div className="p-3.5 rounded-xl bg-surface-subtle border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-navy-text block text-xs flex items-center gap-1.5">
                    <Calendar size={14} className="text-navy" />
                    <span>Periode Bulan Transaksi (Dinamis) *</span>
                  </label>
                  <span className="text-[10px] text-muted-faint font-mono">
                    Aktif: {BULAN_NAMES[selectedMonth - 1]} {selectedYear}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-muted-faint block mb-0.5">Bulan Pembayaran</span>
                    <select
                      name="bulan"
                      value={modalHonorBulan}
                      onChange={(e) => {
                        const newBulan = Number(e.target.value);
                        setModalHonorBulan(newBulan);
                        const currentDay = modalHonorTanggal ? modalHonorTanggal.split("-")[2] || "01" : "01";
                        const maxDays = new Date(modalHonorTahun, newBulan, 0).getDate();
                        const validDay = Math.min(parseInt(currentDay, 10), maxDays).toString().padStart(2, "0");
                        setModalHonorTanggal(`${modalHonorTahun}-${String(newBulan).padStart(2, "0")}-${validDay}`);
                      }}
                      className="w-full h-8 px-2.5 rounded-lg border border-border bg-surface-card text-foreground font-semibold text-xs"
                    >
                      {BULAN_NAMES.map((name, idx) => (
                        <option key={idx + 1} value={idx + 1}>
                          {idx + 1} - {name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-faint block mb-0.5">Tahun</span>
                    <input
                      type="number"
                      name="tahun"
                      required
                      value={modalHonorTahun}
                      onChange={(e) => {
                        const newTahun = Number(e.target.value) || selectedYear;
                        setModalHonorTahun(newTahun);
                        const currentDay = modalHonorTanggal ? modalHonorTanggal.split("-")[2] || "01" : "01";
                        const maxDays = new Date(newTahun, modalHonorBulan, 0).getDate();
                        const validDay = Math.min(parseInt(currentDay, 10), maxDays).toString().padStart(2, "0");
                        setModalHonorTanggal(`${newTahun}-${String(modalHonorBulan).padStart(2, "0")}-${validDay}`);
                      }}
                      className="w-full h-8 px-2.5 rounded-lg border border-border bg-surface-card text-foreground font-mono font-semibold text-xs"
                    />
                  </div>
                </div>

                {(modalHonorBulan !== selectedMonth || modalHonorTahun !== selectedYear) && (
                  <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-[11px] flex items-center gap-1.5">
                    <Info size={13} className="shrink-0" />
                    <span>
                      Transaksi akan disimpan pada periode <strong>{BULAN_NAMES[modalHonorBulan - 1]} {modalHonorTahun}</strong>. Setelah disimpan, sistem akan otomatis mengarahkan ke periode tersebut.
                    </span>
                  </div>
                )}
              </div>

              {/* Card 2: Pemilihan Tenaga Ahli Terdaftar dari Database */}
              {(() => {
                const currentExpert = editingHonor
                  ? {
                      id: editingHonor.rekananId || "",
                      nama: editingHonor.nama,
                      nik: editingHonor.nik,
                      npwp: editingHonor.npwp,
                      kategori: null as string | null,
                      ptkp: editingHonor.ptkp || "TK/0",
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
                    <input type="hidden" name="ptkp" value={currentExpert?.ptkp || modalHonorPtkp || "TK/0"} />

                    {!editingHonor && (
                      <div className="space-y-1.5">
                        {data.rekananTenagaAhli.length === 0 ? (
                          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs flex items-center justify-between gap-3">
                            <div>
                              <p className="font-bold">Belum Ada Tenaga Ahli di Database</p>
                              <p className="text-[11px] mt-0.5 text-amber-700 dark:text-amber-300">
                                Daftarkan profil tenaga ahli terlebih dahulu.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setIsHonorModalOpen(false);
                                setEditingMasterAhli(null);
                                setIsMasterAhliModalOpen(true);
                              }}
                              className="h-7 px-3 rounded-lg bg-navy text-white text-[11px] font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-2xs hover:bg-navy-light"
                            >
                              <Plus size={12} />
                              <span>Daftarkan Tenaga Ahli Baru</span>
                            </button>
                          </div>
                        ) : (
                          <>
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
                                <span>Daftarkan Tenaga Ahli Baru</span>
                              </button>
                            </div>
                            <select
                              value={currentExpert?.id || ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                setSelectedRekananIdForHonor(val);
                                const matched = data.rekananTenagaAhli.find((r) => r.id === val);
                                if (matched) {
                                  setModalHonorPtkp(matched.ptkp || "TK/0");
                                }
                              }}
                              className="w-full h-8 px-2.5 rounded-lg border border-border bg-surface-card text-foreground font-semibold"
                            >
                              {data.rekananTenagaAhli.map((r) => (
                                <option key={r.id} value={r.id}>
                                  {r.nama} {r.kategori ? `· ${r.kategori}` : ""} (NIK: {r.nik || "-"})
                                </option>
                              ))}
                            </select>
                          </>
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
                        <div className="grid grid-cols-3 gap-2 text-[11px] pt-1.5 border-t border-border/60">
                          <div>
                            <span className="text-muted-faint block">NIK (16 Digit):</span>
                            <span className="font-mono font-bold text-navy-text">
                              {currentExpert.nik || "-"}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-faint block">NPWP:</span>
                            <span className="font-mono text-muted-stronger">
                              {currentExpert.npwp || "Tanpa NPWP"}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-faint block">Status PTKP:</span>
                            <span className="font-mono font-bold text-navy-text">
                              {currentExpert.ptkp || "TK/0"}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Tanggal Pembayaran */}
              <div>
                <label className="font-semibold text-navy-text block mb-1">
                  Tanggal Pembayaran *
                </label>
                <input
                  type="date"
                  name="tanggal"
                  required
                  value={modalHonorTanggal}
                  onChange={(e) => {
                    const newDate = e.target.value;
                    setModalHonorTanggal(newDate);
                    const parts = newDate.split("-");
                    if (parts.length === 3) {
                      const y = parseInt(parts[0], 10);
                      const m = parseInt(parts[1], 10);
                      if (!isNaN(y) && !isNaN(m) && m >= 1 && m <= 12) {
                        setModalHonorTahun(y);
                        setModalHonorBulan(m);
                      }
                    }
                  }}
                  className="w-full h-8 px-3 rounded-lg border border-border bg-surface-card text-foreground font-mono"
                />
              </div>

              {/* Uraian Tugas */}
              <div>
                <label className="font-semibold text-navy-text block mb-1">
                  Uraian Tugas / Jasa Keahlian *
                </label>
                <input
                  type="text"
                  name="uraian"
                  required
                  value={modalHonorUraian}
                  onChange={(e) => setModalHonorUraian(e.target.value)}
                  placeholder="Contoh: Honor Tenaga Ahli Struktur Proyek RSUD"
                  className="w-full h-8 px-3 rounded-lg border border-border bg-surface-card text-foreground"
                />
              </div>

              {/* Penghubung ke Kode Proyek (Realisasi Biaya Proyek) */}
              <div>
                <label className="font-semibold text-navy-text block mb-1 flex items-center justify-between">
                  <span>Alokasi Kode Proyek</span>
                  <span className="text-[10px] text-muted-faint font-normal">
                    (Opsional - Terhubung ke Biaya Proyek)
                  </span>
                </label>
                <div className="space-y-1.5">
                  {data.projects.length > 0 && (
                    <select
                      value={modalHonorProjectId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setModalHonorProjectId(val);
                        const matched = data.projects.find((p) => p.id === val);
                        if (matched) {
                          setModalHonorNamaProyek(`[${matched.code}] ${matched.name}`);
                        }
                      }}
                      className="w-full h-8 px-2.5 rounded-lg border border-border bg-surface-card text-foreground text-xs font-semibold"
                    >
                      <option value="">-- Tanpa Alokasi Proyek (Non-Proyek) --</option>
                      {data.projects.map((pr) => (
                        <option key={pr.id} value={pr.id}>
                          [{pr.code}] {pr.name}
                        </option>
                      ))}
                    </select>
                  )}
                  <input
                    type="hidden"
                    name="projectId"
                    value={modalHonorProjectId}
                  />
                  <input
                    type="text"
                    name="namaProyek"
                    value={modalHonorNamaProyek}
                    onChange={(e) => setModalHonorNamaProyek(e.target.value)}
                    placeholder="Nama proyek (otomatis terisi atau ketik manual)"
                    className="w-full h-8 px-3 rounded-lg border border-border bg-surface-subtle text-foreground text-xs"
                  />
                </div>
                {modalHonorProjectId ? (
                  <div className="mt-1.5 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-[11px] flex items-center gap-1.5 font-medium">
                    <CheckCircle size={13} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span>✓ Otomatis tercatat pada realisasi biaya proyek &amp; profitabilitas.</span>
                  </div>
                ) : (
                  <span className="text-[10px] text-muted-faint mt-0.5 block">
                    Pilih proyek untuk mengalokasikan honorarium langsung ke realisasi pengeluaran proyek (Project Spend).
                  </span>
                )}
              </div>

              {/* Nominal Honor Bruto */}
              <div>
                <label className="font-semibold text-navy-text block mb-1">
                  Nominal Gaji Bruto (Rp) *
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  name="nominalHonor"
                  required
                  value={formatRupiahInput(modalHonorNominal)}
                  onChange={(e) => {
                    const val = Number(e.target.value.replace(/[^0-9]/g, "")) || 0;
                    setModalHonorNominal(val);
                  }}
                  placeholder="0"
                  className="w-full h-8 px-3 rounded-lg border border-border bg-surface-card text-foreground font-mono font-bold"
                />
              </div>

              {/* Jenis Pajak & Potongan Pajak */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-navy-text block mb-1">
                    Jenis Pajak
                  </label>
                  <select
                    name="jenisPph"
                    value={modalHonorJenisPph}
                    onChange={(e) => setModalHonorJenisPph(e.target.value)}
                    className="w-full h-8 px-2.5 rounded-lg border border-border bg-surface-card text-foreground font-semibold text-xs"
                  >
                    <option value="PPh 21">PPh 21</option>
                    <option value="PPh 23">PPh 23</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-navy-text block mb-1">
                    Potongan Pajak (Rp)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    name="pph21"
                    value={formatRupiahInput(modalHonorNominalPph)}
                    onChange={(e) => {
                      const pphVal = Number(e.target.value.replace(/[^0-9]/g, "")) || 0;
                      setModalHonorNominalPph(pphVal);
                      if (modalHonorNominal > 0) {
                        setModalHonorTarifPph(Number(((pphVal / modalHonorNominal) * 100).toFixed(2)));
                      }
                    }}
                    placeholder="0"
                    className="w-full h-8 px-3 rounded-lg border border-border bg-surface-card text-foreground font-mono"
                  />
                  <input
                    type="hidden"
                    name="tarifPph21Persen"
                    value={modalHonorTarifPph}
                  />
                </div>
              </div>

              {/* Ringkasan Bersih Sederhana */}
              <div className="p-3 rounded-xl bg-surface-subtle border border-border flex items-center justify-between text-xs">
                <span className="text-muted-faint font-medium">Gaji Bersih Diterima:</span>
                <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300 text-sm">
                  {formatRupiah(Math.max(0, modalHonorNominal - modalHonorNominalPph))}
                </span>
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
                  disabled={isPending || (!editingHonor && data.rekananTenagaAhli.length === 0)}
                  className="px-4 py-1.5 rounded-lg bg-navy text-white font-semibold hover:bg-navy-light transition-colors cursor-pointer shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPending ? "Menyimpan..." : "Simpan Gaji Tenaga Ahli"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================= */}
      {/* MODAL: RIWAYAT & REKAM JEJAK GAJI KARYAWAN (Database Karyawan) */}
      {/* ========================================================= */}
      {mounted && riwayatPegawaiTarget && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-4xl max-h-[90vh] bg-surface-card rounded-2xl border border-border shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-5 border-b border-border bg-surface-subtle/50 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-navy/10 text-navy flex items-center justify-center font-bold">
                  <History size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-navy-text">
                    Rekam Jejak & Riwayat Gaji Karyawan – Tahun {selectedYear}
                  </h3>
                  <p className="text-xs text-muted-faint">
                    Arsip seluruh rekam penggajian dan data pajak {riwayatPegawaiTarget.nama} (Entitas: {data.entity?.name})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRiwayatPegawaiTarget(null)}
                className="p-1.5 text-muted-faint hover:text-navy-text rounded-lg hover:bg-surface-hover transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content Scrollable */}
            <div className="p-5 space-y-5 overflow-y-auto">
              {/* Profil Singkat */}
              <div className="p-4 rounded-xl border border-border bg-surface-subtle/40 flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-navy-text text-base">{riwayatPegawaiTarget.nama}</span>
                    <span className="font-mono text-xs text-muted-stronger">({riwayatPegawaiTarget.nik})</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        (riwayatPegawaiTarget.status ?? (riwayatPegawaiTarget.isActive ? "AKTIF" : "RESIGN")) === "AKTIF"
                          ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                          : (riwayatPegawaiTarget.status ?? (riwayatPegawaiTarget.isActive ? "AKTIF" : "RESIGN")) === "RESIGN"
                          ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                          : "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                      }`}
                    >
                      {riwayatPegawaiTarget.status === "RESIGN"
                        ? `Resign (${riwayatPegawaiTarget.tanggalResignFmt ?? "-"})`
                        : riwayatPegawaiTarget.status === "PENSIUN"
                        ? `Pensiun (${riwayatPegawaiTarget.tanggalResignFmt ?? "-"})`
                        : "Aktif"}
                    </span>
                  </div>
                  <div className="text-xs text-muted-faint flex items-center gap-2 flex-wrap">
                    <span>Jabatan: <strong className="text-navy-text">{riwayatPegawaiTarget.jabatan}</strong></span>
                    <span>·</span>
                    <span>Status PTKP: <strong className="font-mono text-navy-text">{riwayatPegawaiTarget.statusKeluarga}</strong></span>
                    <span>·</span>
                    <span>Masa Kerja: <strong className="text-navy-text">{riwayatPegawaiTarget.masaKerja || "-"}</strong></span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-muted-faint">Gaji Pokok Master</div>
                  <div className="font-mono font-bold text-navy-text text-sm">{riwayatPegawaiTarget.gajiPokokFmt}</div>
                </div>
              </div>

              {/* 4 Cards Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl border border-border bg-surface-card">
                  <div className="text-[11px] text-muted-faint font-medium">Bulan Terbayar</div>
                  <div className="text-lg font-bold font-mono text-navy-text mt-0.5">
                    {riwayatPegawaiTarget.akumulasiTahun?.bulanTerbayar ?? 0} / 12 Bln
                  </div>
                </div>
                <div className="p-3.5 rounded-xl border border-border bg-surface-card">
                  <div className="text-[11px] text-muted-faint font-medium">Total Bruto Terlapor</div>
                  <div className="text-lg font-bold font-mono text-blue-900 dark:text-blue-300 mt-0.5">
                    {formatRupiah(riwayatPegawaiTarget.akumulasiTahun?.totalGajiKotor ?? 0)}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl border border-border bg-surface-card">
                  <div className="text-[11px] text-muted-faint font-medium">Total PPh 21 Terhitung</div>
                  <div className="text-lg font-bold font-mono text-amber-700 dark:text-amber-300 mt-0.5">
                    {formatRupiah(riwayatPegawaiTarget.akumulasiTahun?.totalPph21 ?? 0)}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl border border-border bg-surface-card">
                  <div className="text-[11px] text-muted-faint font-medium">Total Bersih (THP)</div>
                  <div className="text-lg font-bold font-mono text-emerald-700 dark:text-emerald-400 mt-0.5">
                    {formatRupiah(riwayatPegawaiTarget.akumulasiTahun?.totalGajiBersih ?? 0)}
                  </div>
                </div>
              </div>

              {/* Tabel Riwayat Bulanan (Jan - Des) */}
              <div className="rounded-xl border border-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px] text-left text-xs">
                    <thead className="bg-surface-subtle border-b border-border text-muted-stronger font-bold">
                      <tr>
                        <th className="py-2.5 px-3.5 whitespace-nowrap min-w-[110px]">Bulan</th>
                        <th className="py-2.5 px-3.5 text-center whitespace-nowrap min-w-[100px]">Status</th>
                        <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[110px]">Gaji Pokok</th>
                        <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[110px]">Tunjangan</th>
                        <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[100px]">Potongan BPJS</th>
                        <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[90px]">PPh 21</th>
                        <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[120px]">Gaji Bersih (THP)</th>
                        <th className="py-2.5 px-3.5 text-center whitespace-nowrap min-w-[100px]">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                        const gajiRow =
                          riwayatPegawaiTarget.riwayatGajiBulan?.[m] ||
                          (riwayatPegawaiTarget.currentGaji?.bulan === m ? riwayatPegawaiTarget.currentGaji : null);
                        const isPaid = !!gajiRow;

                        return (
                          <tr
                            key={m}
                            className={`hover:bg-surface-hover/30 transition-colors ${
                              isPaid ? "" : "opacity-60 bg-surface-subtle/20"
                            }`}
                          >
                            <td className="py-2.5 px-3.5 font-bold text-navy-text whitespace-nowrap">
                              {BULAN_NAMES[m - 1]} {selectedYear}
                            </td>
                            <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                              {isPaid ? (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold">
                                  Terbayar
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-surface-subtle text-muted-faint text-[10px] font-medium">
                                  Tidak Digaji
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3.5 text-right font-mono whitespace-nowrap">
                              {gajiRow ? gajiRow.gajiPokokFmt : "-"}
                            </td>
                            <td className="py-2.5 px-3.5 text-right font-mono whitespace-nowrap">
                              {gajiRow
                                ? formatRupiah(
                                    (gajiRow.tunjanganJabatan || 0) +
                                      (gajiRow.tunjanganTransport || 0) +
                                      (gajiRow.insentif || 0) +
                                      (gajiRow.thr || 0)
                                  )
                                : "-"}
                            </td>
                            <td className="py-2.5 px-3.5 text-right font-mono text-rose-700 dark:text-rose-300 whitespace-nowrap">
                              {gajiRow
                                ? (gajiRow.potonganBpjsFmt ||
                                    formatRupiah(
                                      (gajiRow.bpjsKesehatan || 0) +
                                        (gajiRow.bpjsKetenagakerjaan || 0) +
                                        (gajiRow.potonganLain || 0)
                                    ))
                                : "-"}
                            </td>
                            <td className="py-2.5 px-3.5 text-right font-mono text-amber-700 dark:text-amber-300 whitespace-nowrap">
                              {gajiRow ? gajiRow.pph21Fmt : "-"}
                            </td>
                            <td className="py-2.5 px-3.5 text-right font-mono font-bold text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
                              {gajiRow ? gajiRow.totalGajiBersihFmt : "-"}
                            </td>
                            <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                              {gajiRow ? (
                                <button
                                  onClick={() => setSlipModalItem(gajiRow)}
                                  className="h-6 px-2 rounded-md border border-border bg-surface-subtle hover:bg-surface-hover text-navy-text text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                                  title="Lihat & Cetak Slip Gaji Bulan Ini"
                                >
                                  <FileText size={11} className="text-navy" />
                                  <span>Slip Gaji</span>
                                </button>
                              ) : (
                                <span className="text-muted-faint text-[11px]">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border bg-surface-subtle/30 flex items-center justify-between shrink-0">
              <span className="text-xs text-muted-faint">
                Rekam penggajian karyawan diarsipkan secara aman untuk laporan pajak & keuangan.
              </span>
              <button
                onClick={() => setRiwayatPegawaiTarget(null)}
                className="h-8 px-4 rounded-xl border border-border bg-surface-subtle hover:bg-surface-hover text-xs font-semibold text-navy-text cursor-pointer transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================= */}
      {/* MODAL 4: SLIP GAJI PEGAWAI TETAP */}
      {/* ========================================================= */}
      {mounted && slipModalItem && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-surface-card rounded-2xl border border-border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
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
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-3.5 rounded-xl bg-surface-subtle border border-border">
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
                  <span className="text-muted-faint block text-[11px]">Mulai / Masa Kerja</span>
                  <span className="text-navy-text font-semibold">
                    {slipModalItem.pegawaiMasaKerja || "-"}
                  </span>
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
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-muted-faint">Gaji Pokok:</span>
                      <span className="font-mono whitespace-nowrap shrink-0">{slipModalItem.gajiPokokFmt}</span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-muted-faint">Tunjangan Jabatan:</span>
                      <span className="font-mono whitespace-nowrap shrink-0">{slipModalItem.tunjanganJabatanFmt}</span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-muted-faint">
                        Tunjangan Transport
                        {slipModalItem.hariKerja > 0 && (
                          <span className="text-[10px] text-muted-faint ml-1">
                            ({slipModalItem.hariKerja} hr × {formatRupiah(slipModalItem.tarifTransportHarian || 15000)})
                          </span>
                        )}:
                      </span>
                      <span className="font-mono whitespace-nowrap shrink-0">{slipModalItem.tunjanganTransportFmt}</span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-muted-faint">Tunjangan Lainnya:</span>
                      <span className="font-mono whitespace-nowrap shrink-0">{slipModalItem.tunjanganLainnyaFmt || slipModalItem.insentifFmt}</span>
                    </div>
                    {slipModalItem.thr > 0 && (
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-muted-faint">Tunjangan THR:</span>
                        <span className="font-mono whitespace-nowrap shrink-0">{slipModalItem.thrFmt}</span>
                      </div>
                    )}
                    {slipModalItem.tunjanganBpjsKes > 0 && (
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-muted-faint">Tunjangan BPJS Kesehatan:</span>
                        <span className="font-mono whitespace-nowrap shrink-0">{slipModalItem.tunjanganBpjsKesFmt}</span>
                      </div>
                    )}
                    {slipModalItem.tunjanganBpjsTk > 0 && (
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-muted-faint">Tunjangan BPJS Ketenagakerjaan:</span>
                        <span className="font-mono whitespace-nowrap shrink-0">{slipModalItem.tunjanganBpjsTkFmt}</span>
                      </div>
                    )}
                    {slipModalItem.tunjanganBpjsKes === 0 &&
                      slipModalItem.tunjanganBpjsTk === 0 &&
                      slipModalItem.tunjanganBpjs > 0 && (
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-muted-faint">Tunjangan BPJS Kes/TK:</span>
                          <span className="font-mono whitespace-nowrap shrink-0">{slipModalItem.tunjanganBpjsFmt}</span>
                        </div>
                      )}
                    {slipModalItem.tunjanganPph > 0 && (
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-muted-faint">Tunjangan PPh:</span>
                        <span className="font-mono whitespace-nowrap shrink-0">{slipModalItem.tunjanganPphFmt}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center gap-2 pt-1 border-t border-border font-bold">
                      <span className="text-blue-900 dark:text-blue-300">Total Bruto Terlapor Pajak:</span>
                      <span className="font-mono text-blue-900 dark:text-blue-300 whitespace-nowrap shrink-0">
                        {slipModalItem.totalGajiTerlaporPajakFmt || slipModalItem.totalGajiKotorFmt}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Potongan */}
                <div className="space-y-2">
                  <h4 className="font-bold text-rose-700 dark:text-rose-400 border-b border-border pb-1">
                    Potongan (Deductions)
                  </h4>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-muted-faint">Potongan BPJS Kesehatan:</span>
                      <span className="font-mono whitespace-nowrap shrink-0">
                        {slipModalItem.bpjsKesehatanFmt || formatRupiah(slipModalItem.bpjsKesehatan)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-muted-faint">Potongan BPJS TK:</span>
                      <span className="font-mono whitespace-nowrap shrink-0">
                        {slipModalItem.bpjsKetenagakerjaanFmt || formatRupiah(slipModalItem.bpjsKetenagakerjaan)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-muted-faint">Potongan PPh 21:</span>
                      <span className="font-mono text-emerald-700 dark:text-emerald-400 font-semibold text-[10px] whitespace-nowrap shrink-0">
                        Rp 0 (Ditanggung Kantor)
                      </span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-muted-faint">Potongan Lainnya / Kasbon:</span>
                      <span className="font-mono whitespace-nowrap shrink-0">{slipModalItem.potonganLainFmt}</span>
                    </div>
                    <div className="flex justify-between items-center gap-2 pt-1 border-t border-border font-bold text-rose-700 dark:text-rose-400">
                      <span>Total Potongan Karyawan:</span>
                      <span className="font-mono whitespace-nowrap shrink-0">
                        {formatRupiah(
                          (slipModalItem.potonganBpjs ||
                            slipModalItem.bpjsKesehatan + slipModalItem.bpjsKetenagakerjaan) +
                            slipModalItem.potonganLain
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Dual Total Comparison Cards di Slip Gaji */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900">
                  <span className="text-[10px] text-blue-800 dark:text-blue-300 font-semibold block">
                    TOTAL BRUTO TERLAPOR PAJAK
                  </span>
                  <div className="text-base font-bold font-mono text-blue-900 dark:text-blue-200 mt-0.5">
                    {slipModalItem.totalGajiTerlaporPajakFmt || slipModalItem.totalGajiKotorFmt}
                  </div>
                  <span className="text-[9px] text-blue-700/80 dark:text-blue-300/70">
                    Dasar SPT Masa PPh 21
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                  <span className="text-[10px] text-emerald-800 dark:text-emerald-300 font-semibold block">
                    TOTAL DITERIMA (TAKE HOME PAY)
                  </span>
                  <div className="text-base font-bold font-mono text-emerald-700 dark:text-emerald-300 mt-0.5">
                    {slipModalItem.totalGajiBersihFmt}
                  </div>
                  <span className="text-[9px] text-emerald-700/80 dark:text-emerald-300/70">
                    Ditransfer riil ke pegawai
                  </span>
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
        </div>,
        document.body
      )}

      {/* ========================================================= */}
      {/* MODAL 5: MASTER DATABASE TENAGA AHLI */}
      {/* ========================================================= */}
      {mounted && isMasterAhliModalOpen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-surface-card rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-navy-text block mb-1">
                    Status PTKP *
                  </label>
                  <select
                    name="ptkp"
                    defaultValue={editingMasterAhli?.ptkp ?? "TK/0"}
                    className="w-full h-8 px-2.5 rounded-lg border border-border bg-surface-card text-foreground font-semibold text-xs"
                  >
                    <option value="TK/0">TK/0</option>
                    <option value="TK/1">TK/1</option>
                    <option value="TK/2">TK/2</option>
                    <option value="TK/3">TK/3</option>
                    <option value="K/0">K/0</option>
                    <option value="K/1">K/1</option>
                    <option value="K/2">K/2</option>
                    <option value="K/3">K/3</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-navy-text block mb-1">
                    Bidang Keahlian / Spesialisasi
                  </label>
                  <input
                    type="text"
                    name="kategori"
                    defaultValue={editingMasterAhli?.kategori ?? ""}
                    placeholder="Contoh: Ahli Struktur / Arsitektur"
                    className="w-full h-8 px-3 rounded-lg border border-border bg-surface-card text-foreground"
                  />
                </div>
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
        </div>,
        document.body
      )}
    </div>
  );
}
