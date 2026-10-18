"use client";

import { useState, useEffect, useTransition, Fragment } from "react";
import { createPortal } from "react-dom";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Role } from "@/types/app-enums";
import {
  Users,
  User,
  Filter,
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
  RotateCcw,
  Sparkles,
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
  hitungPph21Ter,
} from "@/lib/payroll";
import { RekonsiliasiPajakGajiClient } from "@/components/pajak/RekonsiliasiPajakGajiClient";
import { type RekonsiliasiPajakGajiData } from "@/lib/rekonsiliasi-pajak-gaji";
import {
  createPegawaiAction,
  updatePegawaiAction,
  updatePegawaiStatusAction,
  deletePegawaiAction,
  updateBatchTransportAction,
  updatePegawaiTransportAction,
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
  const [isCustomTarifTransport, setIsCustomTarifTransport] = useState<boolean>(false);
  const [isBatchTransportModalOpen, setIsBatchTransportModalOpen] = useState<boolean>(false);
  const [batchTarifTransport, setBatchTarifTransport] = useState<number>(15000);
  const [quickTransportTarget, setQuickTransportTarget] = useState<PegawaiItem | null>(null);
  const [quickTarifTransportVal, setQuickTarifTransportVal] = useState<number>(15000);

  // Sinkronisasi state form modal gaji bulanan saat modal dibuka atau pegawai berubah
  useEffect(() => {
    if (editingGaji) {
      const p = editingGaji.pegawai;
      const g = editingGaji.gaji;
      setModalGajiPegawaiId(p.id);
      setModalGajiBulan(g?.bulan ?? selectedMonth);
      setModalGajiTahun(g?.tahun ?? selectedYear);

      // 1. Komponen Gaji Tetap (Auto-Fill dari Master jika belum ada di gaji bulan ini)
      setModalGajiPokok(g ? g.gajiPokok : p.gajiPokok);
      setModalTunjanganJabatan(g ? g.tunjanganJabatan : (p.tunjanganJabatan ?? 0));
      setModalTunjanganBpjsKes(g ? (g.tunjanganBpjsKes ?? 0) : (p.tunjanganBpjsKes ?? 0));
      setModalTunjanganBpjsTk(g ? (g.tunjanganBpjsTk ?? 0) : (p.tunjanganBpjsTk ?? 0));
      setModalTunjanganBpjs(
        g
          ? (g.tunjanganBpjs ?? ((g.tunjanganBpjsKes ?? 0) + (g.tunjanganBpjsTk ?? 0)))
          : ((p.tunjanganBpjsKes ?? 0) + (p.tunjanganBpjsTk ?? 0))
      );
      setModalBpjsKes(g ? (g.bpjsKesehatan ?? 0) : (p.bpjsKesehatan ?? 0));
      setModalBpjsTk(g ? (g.bpjsKetenagakerjaan ?? 0) : (p.bpjsKetenagakerjaan ?? 0));
      setModalPotonganBpjs(
        g
          ? (g.potonganBpjs ?? ((g.bpjsKesehatan ?? 0) + (g.bpjsKetenagakerjaan ?? 0)))
          : (p.potonganBpjs ?? ((p.bpjsKesehatan ?? 0) + (p.bpjsKetenagakerjaan ?? 0)))
      );

      // 2. Komponen Variabel Bulanan (Rutin Finance)
      const hk = g?.hariKerja ?? 20;
      const tarif = g?.tarifTransportHarian ?? p.tarifTransportHarian ?? 15000;
      setModalHariKerja(hk);
      setModalTarifTransport(tarif);
      setModalTunjanganTransport(g ? g.tunjanganTransport : (hk * tarif));
      setIsCustomTarifTransport(false);
      const tLain = g ? (g.tunjanganLainnya || g.insentif) : 0;
      setModalInsentif(tLain);
      setModalTunjanganLainnya(tLain);
      setModalThr(g?.thr ?? 0);
      setModalTunjanganPph(g?.tunjanganPph ?? 0);
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

    // 1. Komponen Gaji Tetap (Auto-Fill dari Master)
    setModalGajiPokok(g ? g.gajiPokok : target.gajiPokok);
    setModalTunjanganJabatan(g ? g.tunjanganJabatan : (target.tunjanganJabatan ?? 0));
    setModalTunjanganBpjsKes(g ? (g.tunjanganBpjsKes ?? 0) : (target.tunjanganBpjsKes ?? 0));
    setModalTunjanganBpjsTk(g ? (g.tunjanganBpjsTk ?? 0) : (target.tunjanganBpjsTk ?? 0));
    setModalTunjanganBpjs(
      g
        ? (g.tunjanganBpjs ?? ((g.tunjanganBpjsKes ?? 0) + (g.tunjanganBpjsTk ?? 0)))
        : ((target.tunjanganBpjsKes ?? 0) + (target.tunjanganBpjsTk ?? 0))
    );
    setModalBpjsKes(g ? (g.bpjsKesehatan ?? 0) : (target.bpjsKesehatan ?? 0));
    setModalBpjsTk(g ? (g.bpjsKetenagakerjaan ?? 0) : (target.bpjsKetenagakerjaan ?? 0));
    setModalPotonganBpjs(
      g
        ? (g.potonganBpjs ?? ((g.bpjsKesehatan ?? 0) + (g.bpjsKetenagakerjaan ?? 0)))
        : (target.potonganBpjs ?? ((target.bpjsKesehatan ?? 0) + (target.bpjsKetenagakerjaan ?? 0)))
    );

    // 2. Komponen Variabel Bulanan
    const hk = g?.hariKerja ?? 20;
    const tarif = g?.tarifTransportHarian ?? target.tarifTransportHarian ?? 15000;
    setModalHariKerja(hk);
    setModalTarifTransport(tarif);
    setModalTunjanganTransport(g ? g.tunjanganTransport : (hk * tarif));
    setIsCustomTarifTransport(false);
    const tLain = g ? (g.tunjanganLainnya || g.insentif) : 0;
    setModalInsentif(tLain);
    setModalTunjanganLainnya(tLain);
    setModalThr(g?.thr ?? 0);
    setModalTunjanganPph(g?.tunjanganPph ?? 0);
    setModalPph21(g?.pph21 ?? 0);
    setModalPotonganLain(g?.potonganLain ?? 0);
    setModalCatatan(g?.catatan ?? "");
  }

  function handleResetFixedComponentsToMaster() {
    if (!editingGaji) return;
    const p = editingGaji.pegawai;
    setModalGajiPokok(p.gajiPokok);
    setModalTunjanganJabatan(p.tunjanganJabatan ?? 0);
    setModalTunjanganBpjsKes(p.tunjanganBpjsKes ?? 0);
    setModalTunjanganBpjsTk(p.tunjanganBpjsTk ?? 0);
    setModalTunjanganBpjs((p.tunjanganBpjsKes ?? 0) + (p.tunjanganBpjsTk ?? 0));
    setModalBpjsKes(p.bpjsKesehatan ?? 0);
    setModalBpjsTk(p.bpjsKetenagakerjaan ?? 0);
    setModalPotonganBpjs(p.potonganBpjs ?? ((p.bpjsKesehatan ?? 0) + (p.bpjsKetenagakerjaan ?? 0)));
    const masterTarif = p.tarifTransportHarian ?? 15000;
    setModalTarifTransport(masterTarif);
    setModalTunjanganTransport(modalHariKerja * masterTarif);
    setIsCustomTarifTransport(false);
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

  // State Rekapitulasi Akumulasi Gaji Setahun Per Nama (Filter Periode Bebas)
  const [akumulasiMode, setAkumulasiMode] = useState<"per-nama" | "semua">("per-nama");
  const [selectedAkumulasiPegawaiId, setSelectedAkumulasiPegawaiId] = useState<string>("");
  const [akumulasiStartMonth, setAkumulasiStartMonth] = useState<number>(1);
  const [akumulasiEndMonth, setAkumulasiEndMonth] = useState<number>(() => (selectedMonth > 0 ? selectedMonth : 12));

  // Filter rentang bulan di Modal Riwayat Gaji Pegawai
  const [modalStartMonth, setModalStartMonth] = useState<number>(1);
  const [modalEndMonth, setModalEndMonth] = useState<number>(12);

  // Helper kalkulasi akumulasi penghasilan, tunjangan, potongan & PPh 21 rentang bulan bebas
  function getAkumulasiData(p: PegawaiItem, startM: number, endM: number) {
    const from = Math.min(startM, endM);
    const to = Math.max(startM, endM);
    let bulanTerbayar = 0;
    let totalGajiPokok = 0;
    let totalTunjanganJabatan = 0;
    let totalTunjanganTransport = 0;
    let totalInsentifThr = 0;
    let totalTunjanganBpjs = 0;
    let totalTunjanganLainnya = 0;
    let totalGajiKotor = 0;
    let totalGajiTerlaporPajak = 0;
    let totalPotonganBpjs = 0;
    let totalPotonganLain = 0;
    let totalPph21 = 0;
    let totalGajiBersih = 0;

    const monthlyBreakdown: {
      bulan: number;
      gajiRow: GajiBulananItem | null;
      isPaid: boolean;
    }[] = [];

    for (let m = from; m <= to; m++) {
      const gajiRow =
        p.riwayatGajiBulan?.[m] ||
        (p.currentGaji?.bulan === m ? p.currentGaji : null);
      const isPaid = !!gajiRow;

      if (gajiRow) {
        bulanTerbayar++;
        totalGajiPokok += gajiRow.gajiPokok || 0;
        totalTunjanganJabatan += gajiRow.tunjanganJabatan || 0;
        totalTunjanganTransport += gajiRow.tunjanganTransport || 0;
        totalInsentifThr += (gajiRow.insentif || 0) + (gajiRow.thr || 0);
        totalTunjanganLainnya += gajiRow.tunjanganLainnya || 0;
        totalTunjanganBpjs +=
          (gajiRow.tunjanganBpjsKes || 0) + (gajiRow.tunjanganBpjsTk || 0) ||
          (gajiRow.tunjanganBpjs || 0);

        totalGajiKotor += gajiRow.totalGajiKotor || 0;
        totalGajiTerlaporPajak +=
          gajiRow.totalGajiTerlaporPajak || gajiRow.totalGajiKotor || 0;

        const potBpjs =
          gajiRow.potonganBpjs ||
          ((gajiRow.bpjsKesehatan || 0) + (gajiRow.bpjsKetenagakerjaan || 0));
        totalPotonganBpjs += potBpjs;
        totalPotonganLain += gajiRow.potonganLain || 0;
        totalPph21 += gajiRow.pph21 || 0;
        totalGajiBersih += gajiRow.totalGajiBersih || 0;
      }

      monthlyBreakdown.push({ bulan: m, gajiRow, isPaid });
    }

    const totalTunjangan =
      totalTunjanganJabatan +
      totalTunjanganTransport +
      totalInsentifThr +
      totalTunjanganLainnya +
      totalTunjanganBpjs;

    const totalPotongan = totalPotonganBpjs + totalPotonganLain;

    return {
      from,
      to,
      totalBulanRentang: to - from + 1,
      bulanTerbayar,
      totalGajiPokok,
      totalTunjanganJabatan,
      totalTunjanganTransport,
      totalInsentifThr,
      totalTunjanganBpjs,
      totalTunjanganLainnya,
      totalTunjangan,
      totalGajiKotor,
      totalGajiTerlaporPajak,
      totalPotonganBpjs,
      totalPotonganLain,
      totalPotongan,
      totalPph21,
      totalGajiBersih,
      monthlyBreakdown,
    };
  }

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
  const currentAkumulasiPegawai =
    allMasterPegawai.find((p) => p.id === selectedAkumulasiPegawaiId) ||
    allMasterPegawai[0] ||
    null;
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
  const countBelumInput = data.pegawaiList.filter((p) => !p.currentGaji).length;

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
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setBatchTarifTransport(15000);
                          setIsBatchTransportModalOpen(true);
                        }}
                        className="h-8 px-3 rounded-xl border border-border bg-surface-card hover:bg-surface-hover text-navy-text text-xs font-semibold inline-flex items-center transition-colors cursor-pointer shadow-2xs"
                        title="Atur tarif transport standar untuk seluruh karyawan"
                      >
                        <span>Setting Biaya Transport</span>
                      </button>
                      <button
                        type="button"
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
                    </div>
                  ) : pegawaiSubTab === "gaji" ? (
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
                        title="Input atau sesuaikan gaji karyawan bulan ini"
                      >
                        <Plus size={14} />
                        <span>Input Gaji Pegawai</span>
                      </button>
                    </div>
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
                    <h3 className="text-sm font-bold text-navy-text flex items-center gap-2">
                      <span>Daftar Gaji Pegawai Tetap – Periode {BULAN_NAMES[selectedMonth - 1]} {selectedYear}</span>
                      {countBelumInput === 0 && data.pegawaiList.length > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                          ✓ Lengkap ({data.summaryBulanIni.totalPegawaiInput} Karyawan)
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-muted-faint mt-0.5">
                      Gaji Pokok & BPJS terisi otomatis dari Master Data. Finance cukup menyesuaikan Hari Kerja/Transport dan Pajak bila ada perubahan.
                    </p>
                  </div>
                </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[1260px] text-left text-xs border-separate border-spacing-0">
                  <thead className="bg-surface-subtle text-muted-stronger font-bold">
                    <tr>
                      <th className="py-3 px-3.5 text-left sticky left-0 z-20 bg-surface-subtle border-b border-r-2 border-border shadow-[4px_0_8px_-2px_rgba(0,0,0,0.08)] dark:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.4)] min-w-[260px] max-w-[280px]">
                        Pegawai
                      </th>
                      <th className="py-3 px-3.5 text-right whitespace-nowrap min-w-[110px] border-b border-r border-border">
                        Gaji Pokok
                      </th>
                      <th className="py-3 px-3.5 text-right whitespace-nowrap min-w-[105px] border-b border-r border-border">
                        Tunj. Jabatan
                      </th>
                      <th className="py-3 px-3.5 text-right whitespace-nowrap min-w-[120px] border-b border-r border-border">
                        Tunj. Transport
                      </th>
                      <th className="py-3 px-3.5 text-right whitespace-nowrap min-w-[105px] border-b border-r border-border">
                        Insentif/Lain
                      </th>
                      <th className="py-3 px-3.5 text-right whitespace-nowrap min-w-[95px] border-b border-r border-border">
                        THR
                      </th>
                      <th
                        className="py-3 px-3.5 text-right whitespace-nowrap min-w-[130px] bg-blue-50/70 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 border-b border-r border-blue-200 dark:border-blue-900/60"
                        title="Akumulasi seluruh penghasilan kotor (Gaji Pokok + Seluruh Tunjangan) yang menjadi dasar pelaporan PPh 21"
                      >
                        Terlapor Pajak (Bruto)
                      </th>
                      <th className="py-3 px-3.5 text-right whitespace-nowrap min-w-[95px] border-b border-r border-border">
                        BPJS
                      </th>
                      <th className="py-3 px-3.5 text-right whitespace-nowrap min-w-[90px] border-b border-r border-border">
                        PPh 21
                      </th>
                      <th
                        className="py-3 px-3.5 text-right whitespace-nowrap min-w-[130px] bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 border-b border-r border-emerald-200 dark:border-emerald-900/60"
                        title="Nominal riil ditransfer: Gaji Pokok + Tunjangan Jabatan + Transport + Insentif − Potongan BPJS (Tunjangan BPJS & PPh disetor langsung ke lembaga terkait)"
                      >
                        Gaji Bersih (THP)
                      </th>
                      <th className="py-3 px-3.5 text-center whitespace-nowrap min-w-[120px] border-b border-border">
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPegawaiList.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="py-8 text-center text-muted-faint border-b border-border">
                          Belum ada pegawai terdaftar pada entitas ini. Silakan klik "Tambah Pegawai".
                        </td>
                      </tr>
                    ) : (
                      filteredPegawaiList.map((p) => {
                        const gaji = p.currentGaji;
                        const isInputted = !!gaji;
                        return (
                          <tr key={p.id} className="group hover:bg-surface-hover/40 transition-colors">
                            <td className="py-3 px-3.5 sticky left-0 z-10 bg-surface-card group-hover:bg-surface-hover transition-colors border-b border-r-2 border-border shadow-[4px_0_8px_-2px_rgba(0,0,0,0.08)] dark:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.4)] min-w-[260px] max-w-[280px]">
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

                            <td className="py-3 px-3.5 text-right font-mono text-navy-text whitespace-nowrap border-b border-r border-border">
                              {gaji ? gaji.gajiPokokFmt : p.gajiPokokFmt}
                            </td>

                            <td className="py-3 px-3.5 text-right font-mono text-muted-stronger whitespace-nowrap border-b border-r border-border">
                              {gaji
                                ? gaji.tunjanganJabatanFmt
                                : p.tunjanganJabatanFmt || formatRupiah(p.tunjanganJabatan)}
                            </td>

                            <td className="py-3 px-3.5 text-right font-mono text-muted-stronger whitespace-nowrap border-b border-r border-border">
                              <div>{gaji ? gaji.tunjanganTransportFmt : "Rp 0"}</div>
                              {gaji && gaji.hariKerja > 0 && (
                                <div className="text-[10px] text-muted-faint font-sans">
                                  {gaji.hariKerja} hr × {formatRupiah(gaji.tarifTransportHarian || 15000)}
                                </div>
                              )}
                            </td>

                            <td className="py-3 px-3.5 text-right font-mono text-muted-stronger whitespace-nowrap border-b border-r border-border">
                              {gaji
                                ? formatRupiah(
                                    (gaji.insentif || 0) +
                                      (gaji.tunjanganBpjs || 0) +
                                      (gaji.tunjanganPph || 0)
                                  )
                                : "Rp 0"}
                            </td>

                            <td className="py-3 px-3.5 text-right font-mono text-muted-stronger whitespace-nowrap border-b border-r border-border">
                              {gaji ? (gaji.thrFmt || formatRupiah(gaji.thr || 0)) : "Rp 0"}
                            </td>

                            <td className="py-3 px-3.5 text-right font-mono font-bold text-blue-900 dark:text-blue-200 bg-blue-50/30 dark:bg-blue-950/15 whitespace-nowrap border-b border-r border-blue-200/80 dark:border-blue-900/50">
                              {gaji
                                ? (gaji.totalGajiTerlaporPajakFmt || gaji.totalGajiKotorFmt)
                                : p.gajiPokokFmt}
                            </td>

                            <td className="py-3 px-3.5 text-right font-mono text-rose-700 dark:text-rose-300 whitespace-nowrap border-b border-r border-border">
                              {gaji
                                ? (gaji.potonganBpjsFmt ||
                                    formatRupiah(
                                      gaji.potonganBpjs ||
                                        (gaji.bpjsKesehatan + gaji.bpjsKetenagakerjaan)
                                    ))
                                : "Rp 0"}
                            </td>

                            <td className="py-3 px-3.5 text-right font-mono text-amber-700 dark:text-amber-300 whitespace-nowrap border-b border-r border-border">
                              {gaji ? gaji.pph21Fmt : "Rp 0"}
                            </td>

                            <td className="py-3 px-3.5 text-right font-mono font-bold text-emerald-800 dark:text-emerald-200 bg-emerald-50/30 dark:bg-emerald-950/15 whitespace-nowrap border-b border-r border-emerald-200/80 dark:border-emerald-900/50">
                              {gaji ? gaji.totalGajiBersihFmt : p.gajiPokokFmt}
                            </td>

                            <td className="py-3 px-3.5 text-right whitespace-nowrap border-b border-border">
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
                    <tfoot className="bg-surface-subtle font-bold text-xs">
                      <tr>
                        <td className="py-3 px-3.5 text-navy-text whitespace-nowrap sticky left-0 z-10 bg-surface-subtle border-t-2 border-b border-r-2 border-border shadow-[4px_0_8px_-2px_rgba(0,0,0,0.08)] dark:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.4)] min-w-[260px] max-w-[280px]">
                          Total ({data.summaryBulanIni.totalPegawaiInput} Terinput):
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono text-navy-text whitespace-nowrap border-t-2 border-b border-r border-border bg-surface-subtle">
                          {data.summaryBulanIni.totalGajiPokokFmt}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono whitespace-nowrap border-t-2 border-b border-r border-border bg-surface-subtle">
                          {data.summaryBulanIni.totalTunjanganJabatanFmt}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono whitespace-nowrap border-t-2 border-b border-r border-border bg-surface-subtle">
                          {data.summaryBulanIni.totalTunjanganTransportFmt}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono whitespace-nowrap border-t-2 border-b border-r border-border bg-surface-subtle">
                          {formatRupiah(
                            data.summaryBulanIni.totalInsentif +
                              (data.summaryBulanIni.totalTunjanganBpjs ?? 0) +
                              (data.summaryBulanIni.totalTunjanganPph ?? 0)
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono whitespace-nowrap border-t-2 border-b border-r border-border bg-surface-subtle">
                          {data.summaryBulanIni.totalThrFmt || formatRupiah(data.summaryBulanIni.totalThr ?? 0)}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono text-blue-900 dark:text-blue-200 bg-blue-50/50 dark:bg-blue-950/30 whitespace-nowrap border-t-2 border-b border-r border-blue-200 dark:border-blue-900/60">
                          {data.summaryBulanIni.totalGajiTerlaporPajakFmt ||
                            formatRupiah(data.summaryBulanIni.totalGajiTerlaporPajak)}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono text-rose-700 dark:text-rose-300 whitespace-nowrap border-t-2 border-b border-r border-border bg-surface-subtle">
                          {data.summaryBulanIni.totalPotonganBpjsFmt ||
                            formatRupiah(
                              data.summaryBulanIni.totalPotonganBpjs ||
                                (data.summaryBulanIni.totalBpjsKesehatan +
                                  data.summaryBulanIni.totalBpjsKetenagakerjaan)
                            )}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono text-amber-700 dark:text-amber-300 whitespace-nowrap border-t-2 border-b border-r border-border bg-surface-subtle">
                          {data.summaryBulanIni.totalPph21Fmt}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono text-emerald-800 dark:text-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/30 whitespace-nowrap border-t-2 border-b border-r border-emerald-200 dark:border-emerald-900/60">
                          {data.summaryBulanIni.totalGajiBersihFmt}
                        </td>
                        <td className="py-3 px-3.5 border-t-2 border-b border-border bg-surface-subtle" />
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
                <table className="w-full min-w-[1020px] text-left text-xs border-separate border-spacing-0">
                  <thead className="bg-surface-subtle text-muted-stronger font-bold">
                    <tr>
                      <th className="py-2.5 px-3.5 border-b border-r border-border">Bulan</th>
                      <th className="py-2.5 px-3.5 text-center border-b border-r border-border">Jml Pegawai</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[110px] border-b border-r border-border">Gaji Pokok</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[100px] border-b border-r border-border">Tunjangan</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[90px] border-b border-r border-border">Insentif/THR</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[125px] bg-blue-50/60 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200 border-b border-r border-blue-200 dark:border-blue-900/60">
                        Terlapor Pajak (Bruto)
                      </th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[90px] border-b border-r border-border">BPJS</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[90px] border-b border-r border-border">PPh 21</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[125px] bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 border-b border-r border-emerald-200 dark:border-emerald-900/60">
                        Gaji Bersih (THP)
                      </th>
                      <th className="py-2.5 px-3.5 text-center whitespace-nowrap border-b border-border">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rekapBulananPegawai.map((r) => (
                      <tr
                        key={r.bulan}
                        className={`hover:bg-surface-hover/30 transition-colors ${
                          r.bulan === selectedMonth ? "bg-navy/5 font-medium" : ""
                        }`}
                      >
                        <td className="py-3 px-3.5 border-b border-r border-border">
                          <div className="font-bold text-navy-text flex items-center gap-1.5">
                            <span>{r.bulanName}</span>
                            {r.bulan === selectedMonth && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-navy text-white font-semibold">
                                Aktif
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3.5 text-center font-mono border-b border-r border-border">
                          {r.totalPegawai > 0 ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 font-bold text-[11px]">
                              {r.totalPegawai} orang
                            </span>
                          ) : (
                            <span className="text-muted-faint text-[11px]">-</span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono text-navy-text whitespace-nowrap border-b border-r border-border">
                          {r.totalGajiPokokFmt}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono text-muted-stronger whitespace-nowrap border-b border-r border-border">
                          {r.totalTunjanganFmt}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono text-muted-stronger whitespace-nowrap border-b border-r border-border">
                          {formatRupiah((r.totalInsentif || 0) + (r.totalThr || 0))}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono font-bold text-blue-900 dark:text-blue-200 bg-blue-50/30 dark:bg-blue-950/15 whitespace-nowrap border-b border-r border-blue-200/80 dark:border-blue-900/50">
                          {r.totalGajiTerlaporPajakFmt || r.totalGajiKotorFmt}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono text-rose-700 dark:text-rose-300 whitespace-nowrap border-b border-r border-border">
                          {r.totalBpjsFmt}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono text-amber-700 dark:text-amber-300 whitespace-nowrap border-b border-r border-border">
                          {r.totalPph21Fmt}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono font-bold text-emerald-800 dark:text-emerald-200 bg-emerald-50/30 dark:bg-emerald-950/15 whitespace-nowrap border-b border-r border-emerald-200/80 dark:border-emerald-900/50">
                          {r.totalGajiBersihFmt}
                        </td>
                        <td className="py-3 px-3.5 text-center whitespace-nowrap border-b border-border">
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
                  <tfoot className="bg-surface-subtle font-bold text-xs">
                    <tr>
                      <td className="py-3 px-3.5 text-navy-text border-t-2 border-b border-r border-border bg-surface-subtle">Grand Total (12 Bulan):</td>
                      <td className="py-3 px-3.5 text-center font-mono border-t-2 border-b border-r border-border bg-surface-subtle">
                        {data.rekapBulananPegawai.reduce((s, r) => s + r.totalPegawai, 0)} total
                      </td>
                      <td className="py-3 px-3.5 text-right font-mono text-navy-text whitespace-nowrap border-t-2 border-b border-r border-border bg-surface-subtle">
                        {formatRupiah(
                          data.rekapBulananPegawai.reduce((s, r) => s + r.totalGajiPokok, 0)
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-right font-mono text-muted-stronger whitespace-nowrap border-t-2 border-b border-r border-border bg-surface-subtle">
                        {formatRupiah(
                          data.rekapBulananPegawai.reduce((s, r) => s + r.totalTunjangan, 0)
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-right font-mono text-muted-stronger whitespace-nowrap border-t-2 border-b border-r border-border bg-surface-subtle">
                        {formatRupiah(
                          data.rekapBulananPegawai.reduce(
                            (s, r) => s + (r.totalInsentif || 0) + (r.totalThr || 0),
                            0
                          )
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-right font-mono font-bold text-blue-900 dark:text-blue-200 bg-blue-50/50 dark:bg-blue-950/30 whitespace-nowrap border-t-2 border-b border-r border-blue-200 dark:border-blue-900/60">
                        {formatRupiah(
                          data.rekapBulananPegawai.reduce(
                            (s, r) => s + (r.totalGajiTerlaporPajak || r.totalGajiKotor),
                            0
                          )
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-right font-mono text-rose-700 dark:text-rose-300 whitespace-nowrap border-t-2 border-b border-r border-border bg-surface-subtle">
                        {formatRupiah(
                          data.rekapBulananPegawai.reduce((s, r) => s + r.totalBpjs, 0)
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-right font-mono text-amber-700 dark:text-amber-300 whitespace-nowrap border-t-2 border-b border-r border-border bg-surface-subtle">
                        {formatRupiah(
                          data.rekapBulananPegawai.reduce((s, r) => s + r.totalPph21, 0)
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-right font-mono font-bold text-emerald-800 dark:text-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/30 whitespace-nowrap border-t-2 border-b border-r border-emerald-200 dark:border-emerald-900/60">
                        {formatRupiah(
                          data.rekapBulananPegawai.reduce((s, r) => s + r.totalGajiBersih, 0)
                        )}
                      </td>
                      <td className="py-3 px-3.5 border-t-2 border-b border-border bg-surface-subtle" />
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
                  <table className="w-full min-w-[850px] text-left text-xs border-separate border-spacing-0">
                    <thead className="bg-surface-subtle text-muted-stronger font-bold">
                      <tr>
                        <th className="py-2.5 px-3.5 whitespace-nowrap min-w-[130px] border-b border-r border-border">Tanggal & No Bukti</th>
                        <th className="py-2.5 px-3.5 whitespace-nowrap min-w-[100px] border-b border-r border-border">Sumber Jurnal</th>
                        <th className="py-2.5 px-3.5 whitespace-nowrap min-w-[140px] border-b border-r border-border">Kode & Nama Akun</th>
                        <th className="py-2.5 px-3.5 border-b border-r border-border">Keterangan / Uraian</th>
                        <th className="py-2.5 px-3.5 whitespace-nowrap min-w-[120px] border-b border-r border-border">Proyek</th>
                        <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[140px] border-b border-r border-border">Pengeluaran (Debit)</th>
                        <th className="py-2.5 px-3.5 text-center whitespace-nowrap min-w-[90px] border-b border-border">Staff</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(periodeFilterPegawai === "bulan"
                        ? data.penyesuaianJurnal.pegawai.transaksiBulan
                        : data.penyesuaianJurnal.pegawai.transaksiTahun
                      ).length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-10 text-center border-b border-border">
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
                            <td className="py-3 px-3.5 whitespace-nowrap border-b border-r border-border">
                              <div className="font-semibold text-navy-text">{tx.tanggalFmt}</div>
                              <div className="font-mono text-[11px] text-muted-faint mt-0.5">
                                Bukti: {tx.noBukti}
                              </div>
                            </td>
                            <td className="py-3 px-3.5 whitespace-nowrap border-b border-r border-border">
                              <span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-surface-subtle border border-border text-navy-text">
                                {tx.jenisInputNama}
                              </span>
                            </td>
                            <td className="py-3 px-3.5 border-b border-r border-border">
                              <div className="font-mono font-bold text-navy-text text-xs whitespace-nowrap">
                                {tx.coaCode}
                              </div>
                              <div className="text-[11px] text-muted-faint">
                                {tx.coaName}
                              </div>
                            </td>
                            <td className="py-3 px-3.5 text-muted-stronger border-b border-r border-border">
                              {tx.keterangan}
                            </td>
                            <td className="py-3 px-3.5 whitespace-nowrap border-b border-r border-border">
                              {tx.namaProyek ? (
                                <span className="font-semibold text-brand text-[11px] inline-flex items-center gap-1">
                                  <Briefcase size={11} />
                                  <span>{tx.namaProyek}</span>
                                </span>
                              ) : (
                                <span className="text-muted-faint text-[11px]">-</span>
                              )}
                            </td>
                            <td className="py-3 px-3.5 text-right font-mono font-bold text-navy-text text-sm whitespace-nowrap border-b border-r border-border">
                              {tx.debitFmt}
                            </td>
                            <td className="py-3 px-3.5 text-center text-[11px] text-muted-faint whitespace-nowrap border-b border-border">
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
                      <tfoot className="bg-surface-subtle font-bold text-xs">
                        <tr>
                          <td colSpan={5} className="py-3 px-3.5 text-navy-text border-t-2 border-b border-r border-border bg-surface-subtle">
                            Total ({(periodeFilterPegawai === "bulan"
                              ? data.penyesuaianJurnal.pegawai.transaksiBulan
                              : data.penyesuaianJurnal.pegawai.transaksiTahun
                            ).length} Transaksi Jurnal Umum):
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono text-navy-text text-sm whitespace-nowrap border-t-2 border-b border-r border-border bg-surface-subtle">
                            {periodeFilterPegawai === "bulan"
                              ? data.penyesuaianJurnal.pegawai.totalJurnalBulanFmt
                              : data.penyesuaianJurnal.pegawai.totalJurnalTahunFmt}
                          </td>
                          <td className="py-3 px-3.5 border-t-2 border-b border-border bg-surface-subtle" />
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
                <table className="w-full min-w-[1600px] text-left text-xs border-separate border-spacing-0">
                  <thead className="bg-surface-subtle text-muted-stronger font-bold">
                    <tr>
                      <th className="py-2.5 px-3.5 whitespace-nowrap sticky left-0 z-20 bg-surface-subtle w-[150px] min-w-[150px] max-w-[150px] border-b border-r border-border">
                        NIK / Kode
                      </th>
                      <th className="py-2.5 px-3.5 whitespace-nowrap sticky left-[150px] z-20 bg-surface-subtle w-[180px] min-w-[180px] max-w-[180px] border-b border-r-2 border-border shadow-[4px_0_8px_-2px_rgba(0,0,0,0.08)] dark:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.4)]">
                        Nama Pegawai
                      </th>
                      <th className="py-2.5 px-3.5 whitespace-nowrap min-w-[130px] border-b border-r border-border">Jabatan</th>
                      <th className="py-2.5 px-3.5 whitespace-nowrap min-w-[100px] border-b border-r border-border">Status PTKP</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[130px] border-b border-r border-border">PTKP Tahunan</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[140px] border-b border-r border-border">Gaji Pokok Standar</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[140px] border-b border-r border-border">Tunj. Jabatan Master</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[150px] border-b border-r border-border">Tarif Transport / Hari</th>
                      <th className="py-2.5 px-3.5 text-left whitespace-nowrap min-w-[160px] border-b border-r border-border">Mulai Bekerja / Masa Kerja</th>
                      <th className="py-2.5 px-3.5 text-left whitespace-nowrap min-w-[120px] border-b border-r border-border">Tanggal Resign</th>
                      <th className="py-2.5 px-3.5 text-center whitespace-nowrap min-w-[120px] border-b border-r border-border">Status</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[190px] border-b border-border">Aksi & Riwayat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMasterList.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="py-8 text-center text-muted-faint border-b border-border">
                          Tidak ada data karyawan ditemukan.
                        </td>
                      </tr>
                    ) : (
                      filteredMasterList.map((p) => (
                        <tr key={p.id} className="group hover:bg-surface-hover/30 transition-colors">
                          <td className="py-3 px-3.5 font-mono font-semibold text-navy-text whitespace-nowrap sticky left-0 z-10 bg-surface-card group-hover:bg-surface-hover transition-colors w-[150px] min-w-[150px] max-w-[150px] border-b border-r border-border truncate">
                            {p.nik}
                          </td>
                          <td className="py-3 px-3.5 font-bold text-navy-text whitespace-nowrap sticky left-[150px] z-10 bg-surface-card group-hover:bg-surface-hover transition-colors w-[180px] min-w-[180px] max-w-[180px] border-b border-r-2 border-border shadow-[4px_0_8px_-2px_rgba(0,0,0,0.08)] dark:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.4)] truncate" title={p.nama}>
                            {p.nama}
                          </td>
                          <td className="py-3 px-3.5 text-muted-stronger whitespace-nowrap border-b border-r border-border">
                            {p.jabatan}
                          </td>
                          <td className="py-3 px-3.5 whitespace-nowrap border-b border-r border-border">
                            <span className="px-2 py-0.5 rounded-full bg-surface-subtle font-mono text-[11px] font-semibold">
                              {p.statusKeluarga}
                            </span>
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono text-muted-stronger whitespace-nowrap border-b border-r border-border">
                            {p.ptkpFmt}
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono font-bold text-navy-text whitespace-nowrap border-b border-r border-border">
                            <div>{p.gajiPokokFmt}</div>
                            {p.totalGajiTetapFmt && (
                              <div className="text-[10px] font-normal text-muted-faint font-mono">
                                Tetap: {p.totalGajiTetapFmt}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono text-muted-stronger whitespace-nowrap border-b border-r border-border">
                            <div>{p.tunjanganJabatanFmt || formatRupiah(p.tunjanganJabatan)}</div>
                            {((p.tunjanganBpjs ?? 0) > 0 || (p.potonganBpjs ?? 0) > 0) && (
                              <div className="text-[10px] text-muted-faint font-mono">
                                BPJS: +{formatRupiah(p.tunjanganBpjs ?? 0)} / -{formatRupiah(p.potonganBpjs ?? 0)}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3.5 text-right whitespace-nowrap border-b border-r border-border">
                            <div className="flex items-center justify-end gap-1.5">
                              <span className="font-mono font-bold text-navy-text">
                                {p.tarifTransportHarianFmt || formatRupiah(p.tarifTransportHarian ?? 15000)}
                                <span className="text-[10px] text-muted-faint font-normal font-sans ml-0.5">/hr</span>
                              </span>
                              {isManager && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setQuickTransportTarget(p);
                                    setQuickTarifTransportVal(p.tarifTransportHarian ?? 15000);
                                  }}
                                  className="p-1 rounded-md text-muted-faint hover:text-navy hover:bg-surface-subtle transition-colors cursor-pointer"
                                  title="Ubah tarif transport pegawai ini"
                                >
                                  <Pencil size={11} />
                                </button>
                              )}
                            </div>
                            <span className="text-[10px] text-muted-faint block mt-0.5 font-sans">
                              Otomatis × Hari Kerja
                            </span>
                          </td>
                          <td className="py-3 px-3.5 whitespace-nowrap border-b border-r border-border">
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
                          <td className="py-3 px-3.5 whitespace-nowrap border-b border-r border-border">
                            {p.tanggalResignFmt ? (
                              <span className="font-mono text-xs font-semibold text-amber-700 dark:text-amber-300">
                                {p.tanggalResignFmt}
                              </span>
                            ) : (
                              <span className="text-muted-faint text-[11px]">-</span>
                            )}
                          </td>
                          <td className="py-3 px-3.5 text-center whitespace-nowrap border-b border-r border-border">
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
                          <td className="py-3 px-3.5 text-right whitespace-nowrap border-b border-border">
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

          {/* Sub-Tab Content 3: Rekapitulasi Akumulasi Gaji Setahun Per Nama (SPT Tahunan PPh 21) */}
          {pegawaiSubTab === "tahunan" && (
            <div className="space-y-4">
              {/* Header Box & Control Panel */}
              <div className="rounded-2xl border border-border bg-surface-card p-5 space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="p-2 rounded-xl bg-navy/10 text-navy dark:bg-navy/30 dark:text-blue-300">
                        <Briefcase size={18} />
                      </span>
                      <div>
                        <h3 className="text-base font-bold text-navy-text">
                          Rekapitulasi Akumulasi Gaji Per Nama – Tahun {selectedYear}
                        </h3>
                        <p className="text-xs text-muted-faint mt-0.5">
                          Filter periode bebas untuk melihat akumulasi rincian gaji pokok, tunjangan, potongan, dan PPh 21 untuk keperluan pelaporan SPT Pajak
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Mode Selector & Action Buttons */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center p-1 rounded-xl bg-surface-subtle border border-border">
                      <button
                        type="button"
                        onClick={() => setAkumulasiMode("per-nama")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all inline-flex items-center gap-1.5 ${
                          akumulasiMode === "per-nama"
                            ? "bg-surface-card text-navy-text shadow-2xs font-bold"
                            : "text-muted-faint hover:text-navy-text"
                        }`}
                      >
                        <User size={13} />
                        <span>Khusus Satu Orang (Per Nama)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setAkumulasiMode("semua")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all inline-flex items-center gap-1.5 ${
                          akumulasiMode === "semua"
                            ? "bg-surface-card text-navy-text shadow-2xs font-bold"
                            : "text-muted-faint hover:text-navy-text"
                        }`}
                      >
                        <Users size={13} />
                        <span>Semua Karyawan</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="h-8 px-3 rounded-xl border border-border bg-surface-subtle hover:bg-surface-hover text-navy-text text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs print:hidden"
                      title="Cetak Rekap Akumulasi SPT"
                    >
                      <Printer size={13} className="text-navy" />
                      <span>Cetak Rekap SPT</span>
                    </button>
                  </div>
                </div>

                {/* Filter Controls Row */}
                <div className="pt-3 border-t border-border flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 flex-wrap">
                  {/* Selector Pegawai (Jika di Mode Per-Nama) */}
                  {akumulasiMode === "per-nama" && (
                    <div className="flex items-center gap-2 flex-1 min-w-[280px]">
                      <span className="text-xs font-semibold text-muted-stronger whitespace-nowrap">
                        Pilih Karyawan:
                      </span>
                      <select
                        value={currentAkumulasiPegawai?.id ?? ""}
                        onChange={(e) => setSelectedAkumulasiPegawaiId(e.target.value)}
                        className="h-8 flex-1 text-xs rounded-xl border border-border bg-surface-card text-navy-text font-semibold px-3"
                      >
                        {allMasterPegawai.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nama} — {p.nik} ({p.jabatan})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Filter Periode Bebas (Rentang Bulan) */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-muted-stronger flex items-center gap-1">
                      <Filter size={12} className="text-navy" />
                      <span>Rentang Periode Bebas:</span>
                    </span>

                    <div className="inline-flex items-center gap-1.5">
                      <select
                        value={akumulasiStartMonth}
                        onChange={(e) => setAkumulasiStartMonth(Number(e.target.value))}
                        className="h-8 text-xs rounded-xl border border-border bg-surface-card text-navy-text font-semibold px-2.5"
                      >
                        {BULAN_NAMES.map((name, idx) => (
                          <option key={idx + 1} value={idx + 1}>
                            {name}
                          </option>
                        ))}
                      </select>
                      <span className="text-xs text-muted-faint font-semibold">s/d</span>
                      <select
                        value={akumulasiEndMonth}
                        onChange={(e) => setAkumulasiEndMonth(Number(e.target.value))}
                        className="h-8 text-xs rounded-xl border border-border bg-surface-card text-navy-text font-semibold px-2.5"
                      >
                        {BULAN_NAMES.map((name, idx) => (
                          <option key={idx + 1} value={idx + 1}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Quick Preset Buttons */}
                    <div className="flex items-center gap-1 flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          setAkumulasiStartMonth(1);
                          setAkumulasiEndMonth(9);
                        }}
                        className={`h-7 px-2.5 rounded-lg text-[11px] font-semibold border cursor-pointer transition-colors ${
                          akumulasiStartMonth === 1 && akumulasiEndMonth === 9
                            ? "bg-navy text-white border-navy"
                            : "bg-surface-subtle text-muted-stronger border-border hover:bg-surface-hover"
                        }`}
                        title="Rentang Januari s/d September"
                      >
                        Jan – Sep
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAkumulasiStartMonth(1);
                          setAkumulasiEndMonth(12);
                        }}
                        className={`h-7 px-2.5 rounded-lg text-[11px] font-semibold border cursor-pointer transition-colors ${
                          akumulasiStartMonth === 1 && akumulasiEndMonth === 12
                            ? "bg-navy text-white border-navy"
                            : "bg-surface-subtle text-muted-stronger border-border hover:bg-surface-hover"
                        }`}
                        title="Setahun Penuh (12 Bulan)"
                      >
                        Full 12 Bulan (Jan – Des)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAkumulasiStartMonth(1);
                          setAkumulasiEndMonth(6);
                        }}
                        className={`h-7 px-2.5 rounded-lg text-[11px] font-semibold border cursor-pointer transition-colors ${
                          akumulasiStartMonth === 1 && akumulasiEndMonth === 6
                            ? "bg-navy text-white border-navy"
                            : "bg-surface-subtle text-muted-stronger border-border hover:bg-surface-hover"
                        }`}
                      >
                        Semester 1 (Jan – Jun)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAkumulasiStartMonth(7);
                          setAkumulasiEndMonth(12);
                        }}
                        className={`h-7 px-2.5 rounded-lg text-[11px] font-semibold border cursor-pointer transition-colors ${
                          akumulasiStartMonth === 7 && akumulasiEndMonth === 12
                            ? "bg-navy text-white border-navy"
                            : "bg-surface-subtle text-muted-stronger border-border hover:bg-surface-hover"
                        }`}
                      >
                        Semester 2 (Jul – Des)
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* JIKA MODE PER-NAMA */}
              {akumulasiMode === "per-nama" && currentAkumulasiPegawai && (() => {
                const ak = getAkumulasiData(currentAkumulasiPegawai, akumulasiStartMonth, akumulasiEndMonth);
                return (
                  <div className="space-y-4">
                    {/* Profil Karyawan & Periode Terpilih */}
                    <div className="p-4 rounded-2xl border border-border bg-surface-card flex flex-wrap items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-navy-text text-base">{currentAkumulasiPegawai.nama}</span>
                          <span className="font-mono text-xs text-muted-stronger px-2 py-0.5 rounded-md bg-surface-subtle border border-border">
                            NIK: {currentAkumulasiPegawai.nik}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            {currentAkumulasiPegawai.jabatan}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              (currentAkumulasiPegawai.status ?? (currentAkumulasiPegawai.isActive ? "AKTIF" : "RESIGN")) === "AKTIF"
                                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                                : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                            }`}
                          >
                            {currentAkumulasiPegawai.status ?? "AKTIF"}
                          </span>
                        </div>
                        <div className="text-xs text-muted-faint flex items-center gap-3 flex-wrap">
                          <span>Status PTKP: <strong className="font-mono text-navy-text">{currentAkumulasiPegawai.statusKeluarga}</strong> ({currentAkumulasiPegawai.ptkpFmt || formatRupiah(currentAkumulasiPegawai.ptkp ?? 54000000)}/thn)</span>
                          <span>·</span>
                          <span>Masa Kerja: <strong className="text-navy-text">{currentAkumulasiPegawai.masaKerja || "-"}</strong></span>
                          <span>·</span>
                          <span>Mulai Bekerja: <strong className="text-navy-text">{currentAkumulasiPegawai.tanggalMasukFmt || "-"}</strong></span>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-navy/10 text-navy font-bold text-xs border border-navy/20">
                          <Calendar size={13} />
                          <span>
                            Periode: {BULAN_NAMES[ak.from - 1]} – {BULAN_NAMES[ak.to - 1]} {selectedYear} ({ak.totalBulanRentang} Bulan)
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-faint mt-1">
                          Gaji Pokok Master: <strong className="font-mono text-navy-text">{currentAkumulasiPegawai.gajiPokokFmt}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Summary Cards (Detail Pelaporan SPT Pajak PPh 21) */}
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                      <div className="p-3.5 rounded-xl border border-border bg-surface-card shadow-2xs">
                        <div className="text-[11px] text-muted-faint font-medium">Bulan Terbayar</div>
                        <div className="text-lg font-bold font-mono text-navy-text mt-1">
                          {ak.bulanTerbayar} / {ak.totalBulanRentang} Bln
                        </div>
                        <div className="text-[10px] text-muted-faint mt-0.5">
                          {ak.bulanTerbayar === ak.totalBulanRentang ? "Lengkap terbayar" : `${ak.totalBulanRentang - ak.bulanTerbayar} bln belum terinput`}
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl border border-border bg-surface-card shadow-2xs">
                        <div className="text-[11px] text-muted-faint font-medium">Total Gaji Pokok</div>
                        <div className="text-lg font-bold font-mono text-navy-text mt-1">
                          {formatRupiah(ak.totalGajiPokok)}
                        </div>
                        <div className="text-[10px] text-muted-faint mt-0.5">
                          Akumulasi gaji pokok
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl border border-border bg-surface-card shadow-2xs">
                        <div className="text-[11px] text-muted-faint font-medium">Total Tunjangan</div>
                        <div className="text-lg font-bold font-mono text-navy-text mt-1">
                          {formatRupiah(ak.totalTunjangan)}
                        </div>
                        <div className="text-[10px] text-muted-faint mt-0.5" title={`Jabatan: ${formatRupiah(ak.totalTunjanganJabatan)}, Transport: ${formatRupiah(ak.totalTunjanganTransport)}, THR/Insentif: ${formatRupiah(ak.totalInsentifThr)}`}>
                          Jabatan, transport, THR & BPJS
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20 shadow-2xs">
                        <div className="text-[11px] text-blue-900 dark:text-blue-200 font-semibold flex items-center justify-between">
                          <span>Total Bruto (SPT PPh 21)</span>
                        </div>
                        <div className="text-lg font-bold font-mono text-blue-900 dark:text-blue-300 mt-1">
                          {formatRupiah(ak.totalGajiTerlaporPajak)}
                        </div>
                        <div className="text-[10px] text-blue-700/80 dark:text-blue-400 mt-0.5">
                          Objek pemotongan pajak
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 shadow-2xs">
                        <div className="text-[11px] text-amber-900 dark:text-amber-200 font-semibold flex items-center justify-between">
                          <span>Total PPh 21 Terhitung</span>
                        </div>
                        <div className="text-lg font-bold font-mono text-amber-800 dark:text-amber-300 mt-1">
                          {formatRupiah(ak.totalPph21)}
                        </div>
                        <div className="text-[10px] text-amber-700/80 dark:text-amber-400 mt-0.5">
                          Pajak PPh 21 disetor
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-2xs">
                        <div className="text-[11px] text-emerald-900 dark:text-emerald-200 font-semibold flex items-center justify-between">
                          <span>Total Gaji Bersih (THP)</span>
                        </div>
                        <div className="text-lg font-bold font-mono text-emerald-800 dark:text-emerald-300 mt-1">
                          {formatRupiah(ak.totalGajiBersih)}
                        </div>
                        <div className="text-[10px] text-emerald-700/80 dark:text-emerald-400 mt-0.5">
                          Diterima karyawan
                        </div>
                      </div>
                    </div>

                    {/* Tabel Rincian Detail Bulanan Dalam Rentang Periode Bebas */}
                    <div className="rounded-2xl border border-border bg-surface-card overflow-hidden">
                      <div className="p-4 border-b border-border bg-surface-subtle/30 flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <h4 className="text-sm font-bold text-navy-text">
                            Rincian Gaji Bulanan: {currentAkumulasiPegawai.nama} ({BULAN_NAMES[ak.from - 1]} – {BULAN_NAMES[ak.to - 1]} {selectedYear})
                          </h4>
                          <p className="text-xs text-muted-faint mt-0.5">
                            Rincian setiap komponen penghasilan, tunjangan, potongan BPJS, kasbon, dan pajak PPh 21 per bulan selama periode dipilih
                          </p>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[1240px] text-left text-xs border-separate border-spacing-0">
                          <thead className="bg-surface-subtle text-muted-stronger font-bold">
                            <tr>
                              <th className="py-2.5 px-3.5 whitespace-nowrap min-w-[120px] border-b border-r border-border">Bulan</th>
                              <th className="py-2.5 px-3.5 text-center whitespace-nowrap min-w-[95px] border-b border-r border-border">Status</th>
                              <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[110px] border-b border-r border-border">Gaji Pokok</th>
                              <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[105px] border-b border-r border-border">Tunj. Jabatan</th>
                              <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[110px] border-b border-r border-border">Tunj. Transport</th>
                              <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[100px] border-b border-r border-border">THR & Insentif</th>
                              <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[100px] border-b border-r border-border">Tunj. BPJS</th>
                              <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[130px] bg-blue-50/60 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200 border-b border-r border-blue-200 dark:border-blue-900/60">
                                Total Bruto (SPT)
                              </th>
                              <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[100px] border-b border-r border-border">Potongan BPJS</th>
                              <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[100px] border-b border-r border-border">Potongan Lain</th>
                              <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[100px] bg-amber-50/40 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 border-b border-r border-amber-200 dark:border-amber-900/60">
                                PPh 21
                              </th>
                              <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[125px] bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 border-b border-r border-emerald-200 dark:border-emerald-900/60">
                                Gaji Bersih (THP)
                              </th>
                              <th className="py-2.5 px-3.5 text-center whitespace-nowrap min-w-[90px] border-b border-border">Aksi</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ak.monthlyBreakdown.map(({ bulan: m, gajiRow, isPaid }) => {
                              const tunjBpjs =
                                gajiRow
                                  ? (gajiRow.tunjanganBpjsKes || 0) + (gajiRow.tunjanganBpjsTk || 0) || (gajiRow.tunjanganBpjs || 0)
                                  : 0;
                              const potBpjs =
                                gajiRow
                                  ? gajiRow.potonganBpjs || ((gajiRow.bpjsKesehatan || 0) + (gajiRow.bpjsKetenagakerjaan || 0))
                                  : 0;
                              return (
                                <tr
                                  key={m}
                                  className={`hover:bg-surface-hover/30 transition-colors ${
                                    isPaid ? "" : "opacity-60 bg-surface-subtle/20"
                                  }`}
                                >
                                  <td className="py-2.5 px-3.5 font-bold text-navy-text whitespace-nowrap border-b border-r border-border">
                                    {BULAN_NAMES[m - 1]} {selectedYear}
                                  </td>
                                  <td className="py-2.5 px-3.5 text-center whitespace-nowrap border-b border-r border-border">
                                    {isPaid ? (
                                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold">
                                        Terbayar
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded-full bg-surface-subtle text-muted-faint text-[10px] font-medium">
                                        Belum Ada
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3.5 text-right font-mono text-navy-text whitespace-nowrap border-b border-r border-border">
                                    {gajiRow ? gajiRow.gajiPokokFmt : "-"}
                                  </td>
                                  <td className="py-2.5 px-3.5 text-right font-mono text-muted-stronger whitespace-nowrap border-b border-r border-border">
                                    {gajiRow ? gajiRow.tunjanganJabatanFmt || formatRupiah(gajiRow.tunjanganJabatan) : "-"}
                                  </td>
                                  <td className="py-2.5 px-3.5 text-right font-mono text-muted-stronger whitespace-nowrap border-b border-r border-border">
                                    {gajiRow ? gajiRow.tunjanganTransportFmt || formatRupiah(gajiRow.tunjanganTransport) : "-"}
                                  </td>
                                  <td className="py-2.5 px-3.5 text-right font-mono text-muted-stronger whitespace-nowrap border-b border-r border-border">
                                    {gajiRow ? formatRupiah((gajiRow.insentif || 0) + (gajiRow.thr || 0)) : "-"}
                                  </td>
                                  <td className="py-2.5 px-3.5 text-right font-mono text-muted-stronger whitespace-nowrap border-b border-r border-border">
                                    {gajiRow && tunjBpjs > 0 ? formatRupiah(tunjBpjs) : "-"}
                                  </td>
                                  <td className="py-2.5 px-3.5 text-right font-mono font-bold text-blue-900 dark:text-blue-200 bg-blue-50/30 dark:bg-blue-950/15 whitespace-nowrap border-b border-r border-blue-200/80 dark:border-blue-900/50">
                                    {gajiRow ? gajiRow.totalGajiTerlaporPajakFmt || gajiRow.totalGajiKotorFmt : "-"}
                                  </td>
                                  <td className="py-2.5 px-3.5 text-right font-mono text-rose-700 dark:text-rose-300 whitespace-nowrap border-b border-r border-border">
                                    {gajiRow && potBpjs > 0 ? formatRupiah(potBpjs) : "-"}
                                  </td>
                                  <td className="py-2.5 px-3.5 text-right font-mono text-muted-stronger whitespace-nowrap border-b border-r border-border">
                                    {gajiRow && (gajiRow.potonganLain || 0) > 0 ? formatRupiah(gajiRow.potonganLain) : "-"}
                                  </td>
                                  <td className="py-2.5 px-3.5 text-right font-mono font-bold text-amber-700 dark:text-amber-300 bg-amber-50/20 dark:bg-amber-950/10 whitespace-nowrap border-b border-r border-amber-200/80 dark:border-amber-900/50">
                                    {gajiRow ? gajiRow.pph21Fmt : "-"}
                                  </td>
                                  <td className="py-2.5 px-3.5 text-right font-mono font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50/30 dark:bg-emerald-950/15 whitespace-nowrap border-b border-r border-emerald-200/80 dark:border-emerald-900/50">
                                    {gajiRow ? gajiRow.totalGajiBersihFmt : "-"}
                                  </td>
                                  <td className="py-2.5 px-3.5 text-center whitespace-nowrap border-b border-border">
                                    {gajiRow ? (
                                      <button
                                        type="button"
                                        onClick={() => setSlipModalItem(gajiRow)}
                                        className="h-6 px-2 rounded-md border border-border bg-surface-subtle hover:bg-surface-hover text-navy-text text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                                        title="Lihat Slip Gaji"
                                      >
                                        <FileText size={11} className="text-navy" />
                                        <span>Slip</span>
                                      </button>
                                    ) : (
                                      <span className="text-muted-faint text-[11px]">-</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot className="bg-surface-subtle font-bold text-xs">
                            <tr>
                              <td className="py-3 px-3.5 text-navy-text whitespace-nowrap border-t-2 border-b border-r border-border">
                                TOTAL AKUMULASI:
                              </td>
                              <td className="py-3 px-3.5 text-center font-mono whitespace-nowrap border-t-2 border-b border-r border-border">
                                {ak.bulanTerbayar} Bln
                              </td>
                              <td className="py-3 px-3.5 text-right font-mono text-navy-text whitespace-nowrap border-t-2 border-b border-r border-border">
                                {formatRupiah(ak.totalGajiPokok)}
                              </td>
                              <td className="py-3 px-3.5 text-right font-mono whitespace-nowrap border-t-2 border-b border-r border-border">
                                {formatRupiah(ak.totalTunjanganJabatan)}
                              </td>
                              <td className="py-3 px-3.5 text-right font-mono whitespace-nowrap border-t-2 border-b border-r border-border">
                                {formatRupiah(ak.totalTunjanganTransport)}
                              </td>
                              <td className="py-3 px-3.5 text-right font-mono whitespace-nowrap border-t-2 border-b border-r border-border">
                                {formatRupiah(ak.totalInsentifThr)}
                              </td>
                              <td className="py-3 px-3.5 text-right font-mono whitespace-nowrap border-t-2 border-b border-r border-border">
                                {formatRupiah(ak.totalTunjanganBpjs)}
                              </td>
                              <td className="py-3 px-3.5 text-right font-mono text-blue-900 dark:text-blue-200 bg-blue-50/50 dark:bg-blue-950/30 whitespace-nowrap border-t-2 border-b border-r border-blue-200 dark:border-blue-900/60">
                                {formatRupiah(ak.totalGajiTerlaporPajak)}
                              </td>
                              <td className="py-3 px-3.5 text-right font-mono text-rose-700 dark:text-rose-300 whitespace-nowrap border-t-2 border-b border-r border-border">
                                {formatRupiah(ak.totalPotonganBpjs)}
                              </td>
                              <td className="py-3 px-3.5 text-right font-mono whitespace-nowrap border-t-2 border-b border-r border-border">
                                {formatRupiah(ak.totalPotonganLain)}
                              </td>
                              <td className="py-3 px-3.5 text-right font-mono text-amber-800 dark:text-amber-300 bg-amber-50/50 dark:bg-amber-950/30 whitespace-nowrap border-t-2 border-b border-r border-amber-200 dark:border-amber-900/60">
                                {formatRupiah(ak.totalPph21)}
                              </td>
                              <td className="py-3 px-3.5 text-right font-mono text-emerald-800 dark:text-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/30 whitespace-nowrap border-t-2 border-b border-r border-emerald-200 dark:border-emerald-900/60">
                                {formatRupiah(ak.totalGajiBersih)}
                              </td>
                              <td className="py-3 px-3.5 text-center border-t-2 border-b border-border">
                                -
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>

                    {/* Banner Info Kesiapan Pelaporan SPT Pajak */}
                    <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20 flex items-start gap-3">
                      <Info size={16} className="text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                      <div className="text-xs text-blue-950 dark:text-blue-200 space-y-1">
                        <div className="font-bold">Keperluan Pelaporan SPT Tahunan PPh 21 (Form 1721-A1)</div>
                        <p className="text-blue-900/80 dark:text-blue-300/80">
                          Data di atas mengakumulasi seluruh objek pajak bruto (Gaji Pokok + Seluruh Tunjangan) sebesar{" "}
                          <strong className="font-mono text-blue-900 dark:text-blue-200">{formatRupiah(ak.totalGajiTerlaporPajak)}</strong>{" "}
                          dan PPh 21 yang telah dipotong sebesar{" "}
                          <strong className="font-mono text-amber-700 dark:text-amber-300">{formatRupiah(ak.totalPph21)}</strong>{" "}
                          selama rentang {BULAN_NAMES[ak.from - 1]} s/d {BULAN_NAMES[ak.to - 1]} {selectedYear}. Siap digunakan sebagai dasar bukti potong pajak karyawan.
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* JIKA MODE SEMUA KARYAWAN */}
              {akumulasiMode === "semua" && (
                <div className="rounded-2xl border border-border bg-surface-card overflow-hidden">
                  <div className="p-4 border-b border-border bg-surface-subtle/30 flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <h4 className="text-sm font-bold text-navy-text">
                        Ringkasan Akumulasi Seluruh Karyawan ({BULAN_NAMES[Math.min(akumulasiStartMonth, akumulasiEndMonth) - 1]} – {BULAN_NAMES[Math.max(akumulasiStartMonth, akumulasiEndMonth) - 1]} {selectedYear})
                      </h4>
                      <p className="text-xs text-muted-faint mt-0.5">
                        Tabel komparasi total pembayaran gaji bruto, tunjangan, dan PPh 21 seluruh karyawan untuk rentang periode yang dipilih
                      </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1100px] text-left text-xs border-separate border-spacing-0">
                      <thead className="bg-surface-subtle text-muted-stronger font-bold">
                        <tr>
                          <th className="py-2.5 px-3.5 whitespace-nowrap min-w-[190px] border-b border-r border-border">Pegawai</th>
                          <th className="py-2.5 px-3.5 whitespace-nowrap min-w-[95px] border-b border-r border-border">Status PTKP</th>
                          <th className="py-2.5 px-3.5 text-center whitespace-nowrap min-w-[110px] border-b border-r border-border">Bulan Dibayar</th>
                          <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[125px] border-b border-r border-border">Akumulasi Pokok</th>
                          <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[125px] border-b border-r border-border">Akumulasi Tunjangan</th>
                          <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[140px] bg-blue-50/60 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200 border-b border-r border-blue-200 dark:border-blue-900/60">
                            Bruto Objek Pajak
                          </th>
                          <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[120px] bg-amber-50/40 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 border-b border-r border-amber-200 dark:border-amber-900/60">
                            PPh 21 Disetor
                          </th>
                          <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[135px] bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 border-b border-r border-emerald-200 dark:border-emerald-900/60">
                            Net (THP)
                          </th>
                          <th className="py-2.5 px-3.5 text-center whitespace-nowrap min-w-[120px] border-b border-border">Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTahunanList.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="py-8 text-center text-muted-faint border-b border-border">
                              Tidak ada data karyawan ditemukan.
                            </td>
                          </tr>
                        ) : (
                          filteredTahunanList.map((p) => {
                            const ak = getAkumulasiData(p, akumulasiStartMonth, akumulasiEndMonth);
                            return (
                              <tr key={p.id} className="hover:bg-surface-hover/30 transition-colors">
                                <td className="py-3 px-3.5 whitespace-nowrap border-b border-r border-border">
                                  <div className="font-bold text-navy-text">{p.nama}</div>
                                  <div className="text-[11px] text-muted-faint font-mono mt-0.5">
                                    {p.nik} · {p.jabatan}
                                  </div>
                                </td>
                                <td className="py-3 px-3.5 whitespace-nowrap border-b border-r border-border">
                                  <span className="px-2 py-0.5 rounded-full bg-surface-subtle font-mono text-[11px] font-semibold">
                                    {p.statusKeluarga}
                                  </span>
                                </td>
                                <td className="py-3 px-3.5 text-center font-mono font-bold text-navy-text whitespace-nowrap border-b border-r border-border">
                                  {ak.bulanTerbayar} / {ak.totalBulanRentang} Bln
                                </td>
                                <td className="py-3 px-3.5 text-right font-mono text-navy-text whitespace-nowrap border-b border-r border-border">
                                  {formatRupiah(ak.totalGajiPokok)}
                                </td>
                                <td className="py-3 px-3.5 text-right font-mono text-muted-stronger whitespace-nowrap border-b border-r border-border">
                                  {formatRupiah(ak.totalTunjangan)}
                                </td>
                                <td className="py-3 px-3.5 text-right font-mono font-bold text-blue-900 dark:text-blue-200 bg-blue-50/20 dark:bg-blue-950/10 whitespace-nowrap border-b border-r border-blue-200/80 dark:border-blue-900/50">
                                  {formatRupiah(ak.totalGajiTerlaporPajak)}
                                </td>
                                <td className="py-3 px-3.5 text-right font-mono text-amber-700 dark:text-amber-300 bg-amber-50/20 dark:bg-amber-950/10 whitespace-nowrap border-b border-r border-amber-200/80 dark:border-amber-900/50">
                                  {formatRupiah(ak.totalPph21)}
                                </td>
                                <td className="py-3 px-3.5 text-right font-mono font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50/20 dark:bg-emerald-950/10 whitespace-nowrap border-b border-r border-emerald-200/80 dark:border-emerald-900/50">
                                  {formatRupiah(ak.totalGajiBersih)}
                                </td>
                                <td className="py-3 px-3.5 text-center whitespace-nowrap border-b border-border">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedAkumulasiPegawaiId(p.id);
                                      setAkumulasiMode("per-nama");
                                    }}
                                    className="h-7 px-2.5 rounded-lg border border-border bg-surface-subtle hover:bg-surface-hover text-navy-text text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                                    title="Lihat Detail Akumulasi Khusus Karyawan Ini"
                                  >
                                    <User size={11} className="text-navy" />
                                    <span>Detail SPT</span>
                                  </button>
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
                <table className="w-full min-w-[850px] text-left text-xs border-separate border-spacing-0">
                  <thead className="bg-surface-subtle text-muted-stronger font-bold">
                    <tr>
                      <th className="py-2.5 px-3.5 border-b border-r border-border">Tanggal & Bukti</th>
                      <th className="py-2.5 px-3.5 border-b border-r border-border">Tenaga Ahli & PTKP</th>
                      {honorFilterScope === "holding" && (
                        <th className="py-2.5 px-3.5 border-b border-r border-border">Entitas</th>
                      )}
                      <th className="py-2.5 px-3.5 border-b border-r border-border">Uraian & Alokasi Proyek</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[120px] border-b border-r border-border">Gaji Bruto</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[110px] border-b border-r border-border">Pajak (PPh)</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[120px] border-b border-r border-border">Net Diterima</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[100px] border-b border-border">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHonorList.length === 0 ? (
                      <tr>
                        <td
                          colSpan={honorFilterScope === "holding" ? 8 : 7}
                          className="py-10 text-center text-muted-faint border-b border-border"
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
                            <td className="py-3 px-3.5 border-b border-r border-border">
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

                            <td className="py-3 px-3.5 border-b border-r border-border">
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
                              <td className="py-3 px-3.5 border-b border-r border-border">
                                <span className="px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-[10px] font-semibold flex items-center gap-1 w-fit">
                                  <Building2 size={10} />
                                  <span>{h.entityName}</span>
                                </span>
                              </td>
                            )}

                            <td className="py-3 px-3.5 text-muted-stronger border-b border-r border-border">
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

                            <td className="py-3 px-3.5 text-right font-mono font-bold text-navy-text whitespace-nowrap text-sm border-b border-r border-border">
                              {h.nominalHonorFmt}
                            </td>

                            <td className="py-3 px-3.5 text-right whitespace-nowrap border-b border-r border-border">
                              <div className="font-mono text-amber-700 dark:text-amber-300 font-semibold">
                                {formatRupiah(h.pph21 || 0)}
                              </div>
                              <div className="text-[10px] text-muted-faint font-mono mt-0.5">
                                {h.jenisPph || "PPh 21"}
                                {h.tarifPph21Persen ? ` (${h.tarifPph21Persen}%)` : ""}
                              </div>
                            </td>

                            <td className="py-3 px-3.5 text-right font-mono font-bold text-emerald-700 dark:text-emerald-300 whitespace-nowrap text-sm border-b border-r border-border">
                              {formatRupiah(netVal)}
                            </td>

                            <td className="py-3 px-3.5 text-right whitespace-nowrap border-b border-border">
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
                    <tfoot className="bg-surface-subtle font-bold text-xs">
                      <tr>
                        <td
                          colSpan={honorFilterScope === "holding" ? 4 : 3}
                          className="py-3 px-3.5 text-navy-text whitespace-nowrap border-t-2 border-b border-r border-border bg-surface-subtle"
                        >
                          Total ({filteredHonorList.length} Transaksi Terpilih):
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono text-navy-text whitespace-nowrap text-sm border-t-2 border-b border-r border-border bg-surface-subtle">
                          {formatRupiah(totalHonorBrutoFiltered)}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono text-amber-700 dark:text-amber-300 whitespace-nowrap text-sm border-t-2 border-b border-r border-border bg-surface-subtle">
                          {formatRupiah(totalHonorPphFiltered)}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono text-emerald-700 dark:text-emerald-300 whitespace-nowrap text-sm border-t-2 border-b border-r border-border bg-surface-subtle">
                          {formatRupiah(totalHonorBersihFiltered)}
                        </td>
                        <td className="py-3 px-3.5 border-t-2 border-b border-border bg-surface-subtle" />
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
                  <table className="w-full min-w-[800px] text-left text-xs border-separate border-spacing-0">
                    <thead className="bg-surface-subtle text-muted-stronger font-bold">
                      <tr>
                        <th className="py-2.5 px-3.5 border-b border-r border-border">Kode & Nama Proyek</th>
                        <th className="py-2.5 px-3.5 border-b border-r border-border">Tenaga Ahli Dilibatkan</th>
                        <th className="py-2.5 px-3.5 text-center border-b border-r border-border">Jml Pembayaran</th>
                        <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[130px] border-b border-r border-border">Honor Bruto</th>
                        <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[110px] border-b border-r border-border">Pajak (PPh)</th>
                        <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[130px] border-b border-r border-border">Net Diterima</th>
                        <th className="py-2.5 px-3.5 text-center whitespace-nowrap border-b border-border">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.rekapTenagaAhliPerProyek.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-10 text-center text-muted-faint border-b border-border">
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
                            <td className="py-3 px-3.5 border-b border-r border-border">
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

                            <td className="py-3 px-3.5 border-b border-r border-border">
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

                            <td className="py-3 px-3.5 text-center font-mono border-b border-r border-border">
                              <span className="px-2 py-0.5 rounded-full bg-surface-subtle font-bold text-[11px] text-navy-text">
                                {p.totalTransaksi} transaksi
                              </span>
                            </td>

                            <td className="py-3 px-3.5 text-right font-mono font-bold text-navy-text whitespace-nowrap text-sm border-b border-r border-border">
                              {p.totalHonorBrutoFmt}
                            </td>

                            <td className="py-3 px-3.5 text-right font-mono text-amber-700 dark:text-amber-300 whitespace-nowrap border-b border-r border-border">
                              {p.totalPphFmt}
                            </td>

                            <td className="py-3 px-3.5 text-right font-mono font-bold text-emerald-700 dark:text-emerald-300 whitespace-nowrap text-sm border-b border-r border-border">
                              {p.totalHonorBersihFmt}
                            </td>

                            <td className="py-3 px-3.5 text-center whitespace-nowrap border-b border-border">
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
                      <tfoot className="bg-surface-subtle font-bold text-xs">
                        <tr>
                          <td colSpan={2} className="py-3 px-3.5 text-navy-text border-t-2 border-b border-r border-border bg-surface-subtle">
                            Grand Total ({data.rekapTenagaAhliPerProyek.length} Proyek):
                          </td>
                          <td className="py-3 px-3.5 text-center font-mono border-t-2 border-b border-r border-border bg-surface-subtle">
                            {data.rekapTenagaAhliPerProyek.reduce((s, p) => s + p.totalTransaksi, 0)} transaksi
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono text-navy-text whitespace-nowrap text-sm border-t-2 border-b border-r border-border bg-surface-subtle">
                            {formatRupiah(data.rekapTenagaAhliPerProyek.reduce((s, p) => s + p.totalHonorBruto, 0))}
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono text-amber-700 dark:text-amber-300 whitespace-nowrap text-sm border-t-2 border-b border-r border-border bg-surface-subtle">
                            {formatRupiah(data.rekapTenagaAhliPerProyek.reduce((s, p) => s + p.totalPph, 0))}
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono text-emerald-700 dark:text-emerald-300 whitespace-nowrap text-sm border-t-2 border-b border-r border-border bg-surface-subtle">
                            {formatRupiah(data.rekapTenagaAhliPerProyek.reduce((s, p) => s + p.totalHonorBersih, 0))}
                          </td>
                          <td className="py-3 px-3.5 border-t-2 border-b border-border bg-surface-subtle" />
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
                <table className="w-full min-w-[550px] text-left text-xs border-separate border-spacing-0">
                  <thead className="bg-surface-subtle text-muted-stronger font-bold">
                    <tr>
                      <th className="py-2.5 px-3.5 border-b border-r border-border">Bulan</th>
                      <th className="py-2.5 px-3.5 text-center border-b border-r border-border">Jml Pembayaran</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[130px] border-b border-r border-border">Total Honorarium</th>
                      <th className="py-2.5 px-3.5 text-center whitespace-nowrap border-b border-border">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rekapBulananTenagaAhli.map((r) => (
                      <tr
                        key={r.bulan}
                        className={`hover:bg-surface-hover/30 transition-colors ${
                          r.bulan === selectedMonth ? "bg-navy/5 font-medium" : ""
                        }`}
                      >
                        <td className="py-3 px-3.5 border-b border-r border-border">
                          <div className="font-bold text-navy-text flex items-center gap-1.5">
                            <span>{r.bulanName}</span>
                            {r.bulan === selectedMonth && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-navy text-white font-semibold">
                                Aktif
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3.5 text-center font-mono border-b border-r border-border">
                          {r.totalTransaksi > 0 ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 font-bold text-[11px]">
                              {r.totalTransaksi} transaksi
                            </span>
                          ) : (
                            <span className="text-muted-faint text-[11px]">-</span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono font-bold text-navy-text whitespace-nowrap border-b border-r border-border">
                          {r.totalHonorBrutoFmt}
                        </td>
                        <td className="py-3 px-3.5 text-center whitespace-nowrap border-b border-border">
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
                  <tfoot className="bg-surface-subtle font-bold text-xs">
                    <tr>
                      <td className="py-3 px-3.5 text-navy-text border-t-2 border-b border-r border-border bg-surface-subtle">Grand Total (12 Bulan):</td>
                      <td className="py-3 px-3.5 text-center font-mono border-t-2 border-b border-r border-border bg-surface-subtle">
                        {data.rekapBulananTenagaAhli.reduce((s, r) => s + r.totalTransaksi, 0)} transaksi
                      </td>
                      <td className="py-3 px-3.5 text-right font-mono font-bold text-navy-text whitespace-nowrap border-t-2 border-b border-r border-border bg-surface-subtle">
                        {formatRupiah(
                          data.rekapBulananTenagaAhli.reduce((s, r) => s + r.totalHonorBruto, 0)
                        )}
                      </td>
                      <td className="py-3 px-3.5 border-t-2 border-b border-border bg-surface-subtle" />
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
                  <table className="w-full min-w-[850px] text-left text-xs border-separate border-spacing-0">
                    <thead className="bg-surface-subtle text-muted-stronger font-bold">
                      <tr>
                        <th className="py-2.5 px-3.5 whitespace-nowrap min-w-[130px] border-b border-r border-border">Tanggal & No Bukti</th>
                        <th className="py-2.5 px-3.5 whitespace-nowrap min-w-[100px] border-b border-r border-border">Sumber Jurnal</th>
                        <th className="py-2.5 px-3.5 whitespace-nowrap min-w-[140px] border-b border-r border-border">Kode & Nama Akun</th>
                        <th className="py-2.5 px-3.5 border-b border-r border-border">Keterangan / Uraian</th>
                        <th className="py-2.5 px-3.5 whitespace-nowrap min-w-[120px] border-b border-r border-border">Proyek</th>
                        <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[140px] border-b border-r border-border">Pengeluaran (Debit)</th>
                        <th className="py-2.5 px-3.5 text-center whitespace-nowrap min-w-[90px] border-b border-border">Staff</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(periodeFilterAhli === "bulan"
                        ? data.penyesuaianJurnal.tenagaAhli.transaksiBulan
                        : data.penyesuaianJurnal.tenagaAhli.transaksiTahun
                      ).length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-10 text-center border-b border-border">
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
                            <td className="py-3 px-3.5 whitespace-nowrap border-b border-r border-border">
                              <div className="font-semibold text-navy-text">{tx.tanggalFmt}</div>
                              <div className="font-mono text-[11px] text-muted-faint mt-0.5">
                                Bukti: {tx.noBukti}
                              </div>
                            </td>
                            <td className="py-3 px-3.5 whitespace-nowrap border-b border-r border-border">
                              <span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-surface-subtle border border-border text-navy-text">
                                {tx.jenisInputNama}
                              </span>
                            </td>
                            <td className="py-3 px-3.5 border-b border-r border-border">
                              <div className="font-mono font-bold text-navy-text text-xs whitespace-nowrap">
                                {tx.coaCode}
                              </div>
                              <div className="text-[11px] text-muted-faint">
                                {tx.coaName}
                              </div>
                            </td>
                            <td className="py-3 px-3.5 text-muted-stronger border-b border-r border-border">
                              {tx.keterangan}
                            </td>
                            <td className="py-3 px-3.5 whitespace-nowrap border-b border-r border-border">
                              {tx.namaProyek ? (
                                <span className="font-semibold text-brand text-[11px] inline-flex items-center gap-1">
                                  <Briefcase size={11} />
                                  <span>{tx.namaProyek}</span>
                                </span>
                              ) : (
                                <span className="text-muted-faint text-[11px]">-</span>
                              )}
                            </td>
                            <td className="py-3 px-3.5 text-right font-mono font-bold text-navy-text text-sm whitespace-nowrap border-b border-r border-border">
                              {tx.debitFmt}
                            </td>
                            <td className="py-3 px-3.5 text-center text-[11px] text-muted-faint whitespace-nowrap border-b border-border">
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
                      <tfoot className="bg-surface-subtle font-bold text-xs">
                        <tr>
                          <td colSpan={5} className="py-3 px-3.5 text-navy-text border-t-2 border-b border-r border-border bg-surface-subtle">
                            Total ({(periodeFilterAhli === "bulan"
                              ? data.penyesuaianJurnal.tenagaAhli.transaksiBulan
                              : data.penyesuaianJurnal.tenagaAhli.transaksiTahun
                            ).length} Transaksi Jurnal Umum):
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono text-navy-text text-sm whitespace-nowrap border-t-2 border-b border-r border-border bg-surface-subtle">
                            {periodeFilterAhli === "bulan"
                              ? data.penyesuaianJurnal.tenagaAhli.totalJurnalBulanFmt
                              : data.penyesuaianJurnal.tenagaAhli.totalJurnalTahunFmt}
                          </td>
                          <td className="py-3 px-3.5 border-t-2 border-b border-border bg-surface-subtle" />
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
                <table className="w-full min-w-[760px] text-left text-xs border-separate border-spacing-0">
                  <thead className="bg-surface-subtle text-muted-stronger font-bold">
                    <tr>
                      <th className="py-2.5 px-3.5 whitespace-nowrap min-w-[180px] border-b border-r border-border">Nama & Spesialisasi</th>
                      <th className="py-2.5 px-3.5 whitespace-nowrap min-w-[170px] border-b border-r border-border">NIK (16 Digit Terdaftar)</th>
                      <th className="py-2.5 px-3.5 whitespace-nowrap min-w-[130px] border-b border-r border-border">NPWP</th>
                      <th className="py-2.5 px-3.5 whitespace-nowrap min-w-[90px] border-b border-r border-border">Status PTKP</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[160px] border-b border-border">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRekananList.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-muted-faint border-b border-border">
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
                            <td className="py-3 px-3.5 whitespace-nowrap border-b border-r border-border">
                              <div className="font-bold text-navy-text text-sm">{r.nama}</div>
                              {r.kategori && (
                                <div className="text-[11px] text-muted-faint mt-0.5 inline-flex items-center gap-1">
                                  <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[10px] font-medium">
                                    {r.kategori}
                                  </span>
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-3.5 font-mono whitespace-nowrap border-b border-r border-border">
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
                            <td className="py-3 px-3.5 font-mono text-muted-stronger whitespace-nowrap border-b border-r border-border">
                              {hasNpwp ? r.npwp : <span className="text-muted-faint">-</span>}
                            </td>
                            <td className="py-3 px-3.5 font-mono font-bold text-navy-text whitespace-nowrap border-b border-r border-border">
                              <span className="px-2 py-0.5 rounded-md bg-surface-subtle border border-border text-[11px]">
                                {r.ptkp || "TK/0"}
                              </span>
                            </td>
                            <td className="py-3 px-3.5 text-right whitespace-nowrap border-b border-border">
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
                <table className="w-full min-w-[850px] text-left text-xs border-separate border-spacing-0">
                  <thead className="bg-surface-subtle text-muted-stronger font-bold">
                    <tr>
                      <th className="py-2.5 px-3.5 whitespace-nowrap min-w-[170px] border-b border-r border-border">NIK & Tenaga Ahli</th>
                      <th className="py-2.5 px-3.5 whitespace-nowrap min-w-[140px] border-b border-r border-border">🏢 Entitas Mana Saja</th>
                      <th className="py-2.5 px-3.5 whitespace-nowrap min-w-[140px] border-b border-r border-border">🏗️ Proyek Mana Saja</th>
                      <th className="py-2.5 px-3.5 whitespace-nowrap min-w-[130px] border-b border-r border-border">📅 Bulan Apa Saja</th>
                      <th className="py-2.5 px-3.5 text-center whitespace-nowrap min-w-[100px] border-b border-r border-border">Jml Transaksi</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[130px] border-b border-r border-border">Total Honorarium</th>
                      <th className="py-2.5 px-3.5 text-center whitespace-nowrap min-w-[100px] border-b border-border">Rincian</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRekapPerNama.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-muted-faint border-b border-border">
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
                              <td className="py-3 px-3.5 whitespace-nowrap border-b border-r border-border">
                                <div className="font-bold text-navy-text text-sm">{r.nama}</div>
                                <div className="font-mono text-[11px] text-muted-faint font-semibold mt-0.5">
                                  NIK: <span className="text-navy font-bold">{r.nik}</span>
                                  {r.npwp && <span> · NPWP: {r.npwp}</span>}
                                </div>
                              </td>

                              <td className="py-3 px-3.5 border-b border-r border-border">
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

                              <td className="py-3 px-3.5 border-b border-r border-border">
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

                              <td className="py-3 px-3.5 border-b border-r border-border">
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

                              <td className="py-3 px-3.5 text-center font-mono whitespace-nowrap border-b border-r border-border">
                                <span className="px-2 py-0.5 rounded-full bg-surface-subtle font-bold text-[11px]">
                                  {r.totalTransaksi}x
                                </span>
                              </td>

                              <td className="py-3 px-3.5 text-right font-mono font-bold text-navy-text whitespace-nowrap border-b border-r border-border">
                                {r.totalHonorBrutoFmt}
                              </td>

                              <td className="py-3 px-3.5 text-center whitespace-nowrap border-b border-border">
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
                                <td colSpan={7} className="p-3.5 border-b border-border">
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
                                      <table className="w-full text-left text-xs border-separate border-spacing-0">
                                        <thead className="bg-surface-subtle text-muted-stronger font-bold">
                                          <tr>
                                            <th className="py-2 px-3 whitespace-nowrap border-b border-r border-border">Tanggal & Bukti</th>
                                            <th className="py-2 px-3 whitespace-nowrap border-b border-r border-border">Entitas Pembayar</th>
                                            <th className="py-2 px-3 whitespace-nowrap border-b border-r border-border">Bulan</th>
                                            <th className="py-2 px-3 whitespace-nowrap border-b border-r border-border">Nama Proyek</th>
                                            <th className="py-2 px-3 border-b border-r border-border">Uraian Tugas / Jasa</th>
                                            <th className="py-2 px-3 text-right whitespace-nowrap border-b border-border">Nominal Honorarium</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {r.rincian.map((item) => (
                                            <tr key={item.id} className="hover:bg-surface-hover/20">
                                              <td className="py-2 px-3 font-medium whitespace-nowrap border-b border-r border-border">
                                                <div>{item.tanggalFmt}</div>
                                                {item.noBukti && (
                                                  <div className="text-[10px] font-mono text-muted-faint">
                                                    {item.noBukti}
                                                  </div>
                                                )}
                                              </td>
                                              <td className="py-2 px-3 whitespace-nowrap border-b border-r border-border">
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 text-[10px] font-semibold border border-purple-200 dark:border-purple-800">
                                                  <Building2 size={10} />
                                                  <span>{item.entityName}</span>
                                                </span>
                                              </td>
                                              <td className="py-2 px-3 text-muted-stronger font-medium whitespace-nowrap border-b border-r border-border">
                                                {item.bulanName}
                                              </td>
                                              <td className="py-2 px-3 border-b border-r border-border">
                                                <span className="font-semibold text-brand text-[11px] inline-flex items-center gap-1">
                                                  <Briefcase size={11} />
                                                  <span>{item.namaProyek}</span>
                                                </span>
                                              </td>
                                              <td className="py-2 px-3 text-muted-stronger border-b border-r border-border">
                                                {item.uraian}
                                              </td>
                                              <td className="py-2 px-3 text-right font-mono font-bold text-navy-text whitespace-nowrap border-b border-border">
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
                    <tfoot className="bg-surface-subtle font-bold text-xs">
                      <tr>
                        <td colSpan={5} className="py-3 px-3.5 text-navy-text border-t-2 border-b border-r border-border bg-surface-subtle">
                          Total ({filteredRekapPerNama.length} Tenaga Ahli):
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono font-bold text-navy-text whitespace-nowrap border-t-2 border-b border-r border-border bg-surface-subtle">
                          {formatRupiah(
                            filteredRekapPerNama.reduce((s, r) => s + r.totalHonorBruto, 0)
                          )}
                        </td>
                        <td className="py-3 px-3.5 border-t-2 border-b border-border bg-surface-subtle" />
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
                <table className="w-full min-w-[700px] text-left text-xs border-separate border-spacing-0">
                  <thead className="bg-surface-subtle text-muted-stronger font-bold">
                    <tr>
                      <th className="py-2.5 px-3.5 whitespace-nowrap min-w-[180px] border-b border-r border-border">Tenaga Ahli</th>
                      <th className="py-2.5 px-3.5 border-b border-r border-border">Rincian Per Entitas Pembayar</th>
                      <th className="py-2.5 px-3.5 text-center whitespace-nowrap min-w-[120px] border-b border-r border-border">Frekuensi</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[140px] border-b border-border">Total Honorarium</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredKonsolidasi.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-muted-faint border-b border-border">
                          Belum ada transaksi honorarium tenaga ahli pada tahun {selectedYear}.
                        </td>
                      </tr>
                    ) : (
                      filteredKonsolidasi.map((k) => (
                        <tr key={k.nik} className="hover:bg-surface-hover/30 transition-colors">
                          <td className="py-3 px-3.5 whitespace-nowrap border-b border-r border-border">
                            <div className="font-bold text-navy-text text-sm">{k.nama}</div>
                            <div className="text-[11px] text-muted-faint font-mono mt-0.5">
                              NIK: {k.nik} {k.npwp ? `· NPWP: ${k.npwp}` : ""}
                            </div>
                          </td>

                          <td className="py-3 px-3.5 border-b border-r border-border">
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

                          <td className="py-3 px-3.5 text-center font-mono font-bold text-navy-text whitespace-nowrap border-b border-r border-border">
                            {k.totalTransaksi} Transaksi
                          </td>

                          <td className="py-3 px-3.5 text-right font-mono font-bold text-navy-text whitespace-nowrap border-b border-border">
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
                <table className="w-full min-w-[780px] text-left text-xs border-separate border-spacing-0">
                  <thead className="bg-surface-subtle text-muted-stronger font-bold">
                    <tr>
                      <th className="py-2.5 px-3 whitespace-nowrap min-w-[130px] border-b border-r border-border">Tanggal & Bukti</th>
                      <th className="py-2.5 px-3 whitespace-nowrap min-w-[100px] border-b border-r border-border">Sumber Jurnal</th>
                      <th className="py-2.5 px-3 whitespace-nowrap min-w-[150px] border-b border-r border-border">Kode Akun</th>
                      <th className="py-2.5 px-3 border-b border-r border-border">Keterangan</th>
                      <th className="py-2.5 px-3 whitespace-nowrap min-w-[120px] border-b border-r border-border">Proyek</th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap min-w-[130px] border-b border-r border-border">Debit (Beban)</th>
                      <th className="py-2.5 px-3 text-center whitespace-nowrap min-w-[90px] border-b border-border">Staff</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(syncDetailTab === "pegawai"
                      ? data.syncData.jurnalPegawaiRows
                      : data.syncData.jurnalTenagaAhliRows
                    ).length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-muted-faint border-b border-border">
                          Belum ada transaksi di Jurnal Umum untuk {syncDetailTab === "pegawai" ? "Akun 511 (Gaji Pegawai Tetap)" : "Akun 612 (Gaji Tenaga Ahli)"} pada bulan {BULAN_NAMES[selectedMonth - 1]} {selectedYear}.
                        </td>
                      </tr>
                    ) : (
                      (syncDetailTab === "pegawai"
                        ? data.syncData.jurnalPegawaiRows
                        : data.syncData.jurnalTenagaAhliRows
                      ).map((tx) => (
                        <tr key={tx.id} className="hover:bg-surface-hover/30 transition-colors">
                          <td className="py-2.5 px-3 font-medium whitespace-nowrap border-b border-r border-border">
                            <div className="text-navy-text">{tx.tanggalFmt}</div>
                            <div className="text-[10px] font-mono text-muted-faint">{tx.noBukti}</div>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap border-b border-r border-border">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-surface-subtle border border-border text-navy-text">
                              {tx.jenisInputNama}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-navy-text whitespace-nowrap border-b border-r border-border">
                            {tx.coaCode} - {tx.coaName}
                          </td>
                          <td className="py-2.5 px-3 text-muted-stronger border-b border-r border-border">
                            {tx.keterangan}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap border-b border-r border-border">
                            {tx.namaProyek ? (
                              <span className="font-semibold text-brand text-[11px] inline-flex items-center gap-1">
                                <Briefcase size={11} />
                                <span>{tx.namaProyek}</span>
                              </span>
                            ) : (
                              <span className="text-muted-faint text-[11px]">-</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-navy-text whitespace-nowrap border-b border-r border-border">
                            {tx.debitFmt}
                          </td>
                          <td className="py-2.5 px-3 text-center text-[11px] text-muted-faint whitespace-nowrap border-b border-border">
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
                    <tfoot className="bg-surface-subtle font-bold text-xs">
                      <tr>
                        <td colSpan={5} className="py-2.5 px-3 text-navy-text border-t-2 border-b border-r border-border bg-surface-subtle">
                          Total Debit ({syncDetailTab === "pegawai" ? "Akun 511" : "Akun 612"}):
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-navy-text whitespace-nowrap border-t-2 border-b border-r border-border bg-surface-subtle">
                          {syncDetailTab === "pegawai"
                            ? data.syncData.glBebanGaji511Fmt
                            : data.syncData.glBebanTenagaAhli612Fmt}
                        </td>
                        <td className="py-2.5 px-3 border-t-2 border-b border-border bg-surface-subtle" />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-4xl bg-surface-card rounded-2xl border border-border shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
            {/* Header Sticky */}
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-border bg-surface-subtle/50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-navy/10 text-navy flex items-center justify-center shrink-0">
                  <Users size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-navy-text">
                      {editingPegawai ? "Edit Data Pegawai Tetap" : "Tambah Pegawai Tetap Baru"}
                    </h3>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-navy/10 text-navy font-sans">
                      {data.entity?.name}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-faint mt-0.5">
                    Kelola identitas, masa kerja, status kepegawaian, dan master komponen gaji tetap (auto-fill bulanan).
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPegawaiModalOpen(false)}
                className="p-1.5 text-muted-faint hover:text-navy-text rounded-lg transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form
              key={editingPegawai ? editingPegawai.id : "new-pegawai"}
              id="pegawai-form"
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
              className="flex flex-col flex-1 min-h-0 overflow-hidden"
            >
              <input type="hidden" name="entityId" value={data.entity?.id ?? ""} />
              {editingPegawai && <input type="hidden" name="id" value={editingPegawai.id} />}

              {/* Scrollable Body: 2 Kolom Responsif */}
              <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                  {/* =================================================== */}
                  {/* KOLOM 1: IDENTITAS & STATUS KEPEGAWAIAN */}
                  {/* =================================================== */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-1 border-b border-border/60">
                      <Briefcase size={14} className="text-navy" />
                      <span className="font-bold text-navy-text text-xs uppercase tracking-wider">
                        1. Identitas & Kepegawaian
                      </span>
                    </div>

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
                        Mencatat tanggal mulai bekerja untuk riwayat arsip dan kalkulasi masa kerja otomatis.
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
                        <option value="AKTIF">AKTIF – Bekerja Aktif (Otomatis muncul di daftar gaji tiap bulan)</option>
                        <option value="RESIGN">RESIGN – Berhenti / Mengundurkan Diri</option>
                        <option value="PENSIUN">PENSIUN – Pensiun</option>
                      </select>
                      <p className="text-[10px] text-muted-faint mt-1">
                        Karyawan berstatus <strong>Aktif</strong> otomatis terdaftar di penggajian bulanan tanpa input ulang.
                      </p>
                    </div>

                    {modalPegawaiStatus !== "AKTIF" && (
                      <div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/50 dark:bg-amber-950/20 space-y-2 animate-in fade-in">
                        <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 font-semibold text-xs">
                          <AlertCircle size={14} />
                          <span>Tanggal Efektif {modalPegawaiStatus === "PENSIUN" ? "Pensiun" : "Resign"} *</span>
                        </div>
                        <input
                          type="date"
                          name="tanggalResign"
                          required
                          value={modalTanggalResign}
                          onChange={(e) => setModalTanggalResign(e.target.value)}
                          className="w-full h-8 px-3 rounded-lg border border-border bg-surface-card text-foreground font-mono"
                        />
                        <p className="text-[10px] text-amber-900/80 dark:text-amber-300/80 leading-relaxed">
                          <strong>Arsip & Perpajakan:</strong> Data rekam gaji karyawan <strong>tidak dihapus</strong> dari sistem untuk arsip SPT tahunan. Namanya otomatis berhenti muncul di daftar gaji setelah tanggal ini.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* =================================================== */}
                  {/* KOLOM 2: KOMPONEN GAJI TETAP (AUTO-FILL MASTER) */}
                  {/* =================================================== */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-1 border-b border-border/60">
                      <div className="flex items-center gap-2">
                        <ShieldCheck size={14} className="text-navy" />
                        <span className="font-bold text-navy-text text-xs uppercase tracking-wider">
                          2. Komponen Gaji Tetap (Auto-Fill)
                        </span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-navy/10 text-navy font-semibold">
                        Master Data
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-surface-subtle border border-border text-[11px] text-muted-faint leading-relaxed">
                      Komponen gaji tetap diset di awal/master data ini dan akan <strong>otomatis terisi setiap bulan</strong>. Tim finance hanya perlu menginput komponen variabel bulanan (insentif, transport harian, THR).
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
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-semibold text-navy-text block">Tarif Transport Harian (Rp)</label>
                        <span className="text-[10px] text-muted-faint">Master hitung otomatis</span>
                      </div>
                      <input
                        type="text"
                        inputMode="numeric"
                        name="tarifTransportHarian"
                        defaultValue={formatRupiahInput(editingPegawai?.tarifTransportHarian ? editingPegawai.tarifTransportHarian : 15000)}
                        onChange={(e) => {
                          const num = Number(e.target.value.replace(/[^0-9]/g, "")) || 0;
                          e.target.value = formatRupiahInput(num);
                        }}
                        placeholder="15.000"
                        className="w-full h-8 px-3 rounded-lg border border-border bg-surface-card text-foreground font-mono"
                      />
                      <p className="text-[10px] text-muted-faint mt-1">
                        Tarif dasar per hari kerja (default Rp 15.000). Saat input gaji bulanan, Tim Finance cukup mengisi jumlah hari kerja.
                      </p>
                    </div>

                    {/* Paket Iuran BPJS Tetap Master Data (Auto-Fill) */}
                    <div className="p-3.5 rounded-xl bg-surface-subtle/80 border border-border space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="font-bold text-navy-text text-xs flex items-center gap-1.5">
                          <ShieldCheck size={14} className="text-navy" />
                          <span>Paket Iuran BPJS Tetap Rutin</span>
                        </div>
                        <span className="text-[10px] text-muted-faint font-medium">Kantor & Pegawai</span>
                      </div>

                      {/* Tunjangan BPJS (Kantor) */}
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[10px] font-bold text-navy uppercase tracking-wider block">
                          Tunjangan BPJS (Ditanggung Kantor)
                        </span>
                        <div className="grid grid-cols-2 gap-2.5">
                          <div>
                            <label className="text-[10px] font-semibold text-muted-stronger block mb-1">
                              BPJS Kesehatan (Kantor)
                            </label>
                            <input
                              type="text"
                              inputMode="numeric"
                              name="tunjanganBpjsKes"
                              defaultValue={formatRupiahInput(editingPegawai?.tunjanganBpjsKes ? editingPegawai.tunjanganBpjsKes : "")}
                              onChange={(e) => {
                                const num = Number(e.target.value.replace(/[^0-9]/g, "")) || 0;
                                e.target.value = formatRupiahInput(num);
                              }}
                              placeholder="0"
                              className="w-full h-8 px-2.5 rounded-lg border border-border bg-surface-card text-foreground font-mono text-xs"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-muted-stronger block mb-1">
                              BPJS TK (Kantor)
                            </label>
                            <input
                              type="text"
                              inputMode="numeric"
                              name="tunjanganBpjsTk"
                              defaultValue={formatRupiahInput(editingPegawai?.tunjanganBpjsTk ? editingPegawai.tunjanganBpjsTk : "")}
                              onChange={(e) => {
                                const num = Number(e.target.value.replace(/[^0-9]/g, "")) || 0;
                                e.target.value = formatRupiahInput(num);
                              }}
                              placeholder="0"
                              className="w-full h-8 px-2.5 rounded-lg border border-border bg-surface-card text-foreground font-mono text-xs"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Potongan BPJS (Pegawai) */}
                      <div className="space-y-1.5 pt-2 border-t border-border/50">
                        <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider block">
                          Potongan BPJS (Dipotong dari Pegawai)
                        </span>
                        <div className="grid grid-cols-2 gap-2.5">
                          <div>
                            <label className="text-[10px] font-semibold text-rose-700 dark:text-rose-400 block mb-1">
                              BPJS Kesehatan (Pegawai)
                            </label>
                            <input
                              type="text"
                              inputMode="numeric"
                              name="bpjsKesehatan"
                              defaultValue={formatRupiahInput(editingPegawai?.bpjsKesehatan ? editingPegawai.bpjsKesehatan : "")}
                              onChange={(e) => {
                                const num = Number(e.target.value.replace(/[^0-9]/g, "")) || 0;
                                e.target.value = formatRupiahInput(num);
                              }}
                              placeholder="0"
                              className="w-full h-8 px-2.5 rounded-lg border border-border bg-surface-card text-foreground font-mono text-xs"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-rose-700 dark:text-rose-400 block mb-1">
                              BPJS TK (Pegawai)
                            </label>
                            <input
                              type="text"
                              inputMode="numeric"
                              name="bpjsKetenagakerjaan"
                              defaultValue={formatRupiahInput(editingPegawai?.bpjsKetenagakerjaan ? editingPegawai.bpjsKetenagakerjaan : "")}
                              onChange={(e) => {
                                const num = Number(e.target.value.replace(/[^0-9]/g, "")) || 0;
                                e.target.value = formatRupiahInput(num);
                              }}
                              placeholder="0"
                              className="w-full h-8 px-2.5 rounded-lg border border-border bg-surface-card text-foreground font-mono text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sticky Footer */}
              <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 border-t border-border bg-surface-subtle/50 shrink-0">
                <p className="text-[11px] text-muted-faint hidden sm:block">
                  * Kolom bertanda bintang wajib diisi
                </p>
                <div className="flex items-center gap-2.5 ml-auto">
                  <button
                    type="button"
                    onClick={() => setIsPegawaiModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-muted-stronger hover:bg-surface-hover transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="px-5 py-2 rounded-xl bg-navy text-white text-xs font-bold hover:bg-navy-light transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {isPending ? "Menyimpan..." : (editingPegawai ? "Simpan Perubahan" : "Simpan Pegawai Baru")}
                  </button>
                </div>
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

        const liveTunjanganLain = Math.max(
          Number(modalTunjanganLainnya || 0),
          Number(modalInsentif || 0)
        );

        // Akumulasi PPh 21 Jan-Nov untuk kalkulasi Tunjangan PPh Desember (Penyelesaian Akhir Tahun)
        const pphJanNov = Array.from({ length: 11 }, (_, i) => i + 1).reduce((acc, m) => {
          const row = editingGaji?.pegawai.riwayatGajiBulan?.[m];
          return acc + (row?.pph21 || 0);
        }, 0);

        const liveTotalGajiKotor =
          Number(modalGajiPokok || 0) +
          Number(modalTunjanganJabatan || 0) +
          Number(modalTunjanganTransport || 0) +
          liveTunjanganLain +
          Number(modalThr || 0) +
          liveTotalTunjanganBpjs +
          Number(modalTunjanganPph || 0);

        const liveTotalGajiTerlaporPajak = liveTotalGajiKotor;
        const liveTerCalc = hitungPph21Ter(
          liveTotalGajiTerlaporPajak,
          editingGaji.pegawai.statusKeluarga
        );

        const akumulasiPphSetahun = pphJanNov + Number(modalPph21 || liveTerCalc.nominal || 0);

        // Potongan yang riil dipotong dari karyawan: BPJS (Kes + TK) dan Potongan Lain
        // PPh 21 TIDAK dipotong dari karyawan karena 100% ditanggung perusahaan
        const liveTotalPotonganKaryawan =
          liveTotalBpjs + Number(modalPotonganLain || 0);

        // Formulasi THP: Gaji Pokok + Tunjangan Jabatan + Transport + Tunjangan Lainnya/Insentif - Potongan BPJS
        // (Tunjangan BPJS dan Tunjangan PPh tidak ikut dikirim ke rekening karyawan karena dibayarkan langsung ke lembaga terkait)
        const liveTotalGajiBersih = Math.max(
          0,
          Number(modalGajiPokok || 0) +
            Number(modalTunjanganJabatan || 0) +
            Number(modalTunjanganTransport || 0) +
            liveTunjanganLain +
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
                    <span className="text-[10px] text-muted-faint block">Paket Komponen Tetap Master</span>
                    <strong className="text-navy-text font-mono text-[11px] block">
                      Pokok: {editingGaji.pegawai.gajiPokokFmt}
                    </strong>
                    <span className="text-[10px] text-muted-stronger font-mono block">
                      Jabatan: {editingGaji.pegawai.tunjanganJabatanFmt || formatRupiah(editingGaji.pegawai.tunjanganJabatan)}
                    </span>
                    <span className="text-[9px] text-muted-faint font-mono">
                      BPJS: +{formatRupiah(editingGaji.pegawai.tunjanganBpjs ?? 0)} / -{formatRupiah(editingGaji.pegawai.potonganBpjs ?? 0)}
                    </span>
                  </div>
                </div>

                {/* ========================================================= */}
                {/* 1. BAGIAN KOMPONEN GAJI TETAP (AUTO-FILL DARI MASTER DATA) */}
                {/* ========================================================= */}
                <div className="p-3.5 rounded-xl bg-surface-subtle/50 border border-border space-y-3">
                  <div className="flex items-center justify-between pb-1 border-b border-border/60">
                    <span className="font-bold text-navy-text text-xs uppercase tracking-wider">
                      1. Komponen Gaji Tetap (Auto-Fill Master)
                    </span>
                    <button
                      type="button"
                      onClick={handleResetFixedComponentsToMaster}
                      className="px-2 py-0.5 rounded-lg border border-border bg-surface-card hover:bg-surface-subtle text-[10px] font-semibold text-navy-text inline-flex items-center gap-1 transition-colors cursor-pointer"
                      title="Kembalikan nilai ke standar Master Pegawai"
                    >
                      <RotateCcw size={10} />
                      <span>Reset ke Master</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold text-navy-text block mb-1">Gaji Pokok (Rp) *</label>
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
                        Tunjangan Jabatan (Rp)
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
                    </div>
                  </div>

                  {/* BPJS Tetap (Tunjangan Kantor & Potongan Pegawai) */}
                  <div className="pt-2 border-t border-border/60 space-y-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-semibold text-muted-stronger block mb-1">
                          Tunjangan BPJS Kes (Kantor)
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          name="tunjanganBpjsKes"
                          value={formatRupiahInput(modalTunjanganBpjsKes)}
                          onChange={(e) => setModalTunjanganBpjsKes(Number(e.target.value.replace(/[^0-9]/g, "")) || 0)}
                          placeholder="0"
                          className="w-full h-8 px-2.5 rounded-lg border border-border bg-surface-card text-foreground font-mono text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-muted-stronger block mb-1">
                          Tunjangan BPJS TK (Kantor)
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          name="tunjanganBpjsTk"
                          value={formatRupiahInput(modalTunjanganBpjsTk)}
                          onChange={(e) => setModalTunjanganBpjsTk(Number(e.target.value.replace(/[^0-9]/g, "")) || 0)}
                          placeholder="0"
                          className="w-full h-8 px-2.5 rounded-lg border border-border bg-surface-card text-foreground font-mono text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-semibold text-rose-700 dark:text-rose-400 block mb-1">
                          Potongan BPJS Kes (Pegawai)
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          name="bpjsKesehatan"
                          value={formatRupiahInput(modalBpjsKes)}
                          onChange={(e) => setModalBpjsKes(Number(e.target.value.replace(/[^0-9]/g, "")) || 0)}
                          placeholder="0"
                          className="w-full h-8 px-2.5 rounded-lg border border-border bg-surface-card text-foreground font-mono text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-rose-700 dark:text-rose-400 block mb-1">
                          Potongan BPJS TK (Pegawai)
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          name="bpjsKetenagakerjaan"
                          value={formatRupiahInput(modalBpjsTk)}
                          onChange={(e) => setModalBpjsTk(Number(e.target.value.replace(/[^0-9]/g, "")) || 0)}
                          placeholder="0"
                          className="w-full h-8 px-2.5 rounded-lg border border-border bg-surface-card text-foreground font-mono text-xs"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* ========================================================= */}
                {/* 2. BAGIAN INPUT VARIABEL BULANAN */}
                {/* ========================================================= */}
                <div className="p-3.5 rounded-xl bg-surface-subtle/50 border border-border space-y-3">
                  <div className="pb-1 border-b border-border/60">
                    <span className="font-bold text-navy-text text-xs uppercase tracking-wider">
                      2. Input Variabel Bulanan
                    </span>
                  </div>

                  {/* Tunjangan Transport */}
                  <div className="p-3 rounded-xl bg-surface-card border border-border space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-navy-text text-xs">
                        Tunjangan Transport
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsCustomTarifTransport((prev) => !prev)}
                        className="text-[10px] font-semibold text-navy hover:text-navy-light underline cursor-pointer"
                        title="Klik untuk menyesuaikan tarif harian atau nominal khusus bulan ini"
                      >
                        {isCustomTarifTransport ? "Sembunyikan Penyesuaian" : "Sesuaikan Tarif"}
                      </button>
                    </div>

                    {!isCustomTarifTransport ? (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] text-muted-stronger block mb-1">
                            Jumlah Hari Kerja (Hari) *
                          </label>
                          <input
                            type="number"
                            name="hariKerja"
                            min={0}
                            max={31}
                            required
                            value={modalHariKerja || ""}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 0;
                              setModalHariKerja(val);
                              setModalTunjanganTransport(val * modalTarifTransport);
                            }}
                            placeholder="0"
                            className="w-full h-8 px-2.5 rounded-lg border border-border bg-surface-card text-foreground font-mono text-xs"
                          />
                          <span className="text-[10px] text-muted-faint mt-1 block">
                            Tarif master: {formatRupiah(modalTarifTransport)} / hari
                          </span>
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-stronger font-semibold block mb-1">
                            Total Transport (Rp) – Otomatis
                          </label>
                          <div className="w-full h-8 px-2.5 rounded-lg border border-border bg-surface-subtle text-navy-text font-bold font-mono text-xs flex items-center justify-between">
                            <span>{formatRupiah(modalTunjanganTransport)}</span>
                            <span className="text-[10px] font-normal text-muted-faint font-sans">
                              {modalHariKerja} hr × {formatRupiah(modalTarifTransport)}
                            </span>
                          </div>
                          <input type="hidden" name="tunjanganTransport" value={modalTunjanganTransport} />
                          <input type="hidden" name="tarifTransportHarian" value={modalTarifTransport} />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
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
                            <label className="text-[10px] text-muted-stronger block mb-0.5">Tarif Harian Bulan Ini (Rp)</label>
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
                            <label className="text-[10px] text-muted-stronger font-semibold block mb-0.5">
                              Total Transport (Rp)
                            </label>
                            <input
                              type="text"
                              inputMode="numeric"
                              name="tunjanganTransport"
                              value={formatRupiahInput(modalTunjanganTransport)}
                              onChange={(e) => setModalTunjanganTransport(Number(e.target.value.replace(/[^0-9]/g, "")) || 0)}
                              placeholder="0"
                              className="w-full h-8 px-2.5 rounded-lg border border-border bg-surface-subtle text-navy-text font-bold font-mono text-xs"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-muted-faint pt-1">
                          <span>
                            Tarif master standar: {formatRupiah(editingGaji.pegawai.tarifTransportHarian ?? 15000)} / hari.
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const baseTarif = editingGaji.pegawai.tarifTransportHarian ?? 15000;
                              setModalTarifTransport(baseTarif);
                              setModalTunjanganTransport(modalHariKerja * baseTarif);
                            }}
                            className="text-navy hover:underline font-semibold cursor-pointer"
                          >
                            Reset ke Tarif Master
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Insentif Bulanan & THR */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-2.5 rounded-xl bg-surface-card border border-border">
                      <label className="font-semibold text-navy-text block mb-1">
                        Insentif / Lembur (Rp)
                      </label>
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
                    </div>

                    <div className="p-2.5 rounded-xl bg-surface-card border border-border">
                      <label className="font-semibold text-navy-text block mb-1">
                        THR (Rp)
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        name="thr"
                        value={formatRupiahInput(modalThr)}
                        onChange={(e) => setModalThr(Number(e.target.value.replace(/[^0-9]/g, "")) || 0)}
                        placeholder="0"
                        className="w-full h-8 px-2.5 rounded-lg border border-border bg-surface-card text-foreground font-mono"
                      />
                    </div>
                  </div>

                  {/* Potongan Lainnya & Subsidi PPh */}
                  <div className="grid grid-cols-2 gap-3 items-stretch">
                    <div className="p-2.5 rounded-xl bg-surface-card border border-border flex flex-col justify-between">
                      <div>
                        <label className="font-semibold text-rose-700 dark:text-rose-400 block mb-1">
                          Kasbon / Potongan Lain (Rp)
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          name="potonganLain"
                          value={formatRupiahInput(modalPotonganLain)}
                          onChange={(e) => setModalPotonganLain(Number(e.target.value.replace(/[^0-9]/g, "")) || 0)}
                          placeholder="0"
                          className="w-full h-8 px-2.5 rounded-lg border border-border bg-surface-card text-foreground font-mono"
                        />
                      </div>
                      {modalGajiBulan === 12 && (
                        <p className="text-[10px] text-muted-faint pt-1.5 leading-tight">
                          Dipotong dari rekening karyawan
                        </p>
                      )}
                    </div>

                    <div className="p-2.5 rounded-xl bg-surface-card border border-border flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="font-semibold text-navy-text block">
                            Tunjangan Subsidi PPh (Rp)
                          </label>
                          {modalGajiBulan === 12 && (
                            <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                              Desember
                            </span>
                          )}
                        </div>
                        <input
                          type="text"
                          inputMode="numeric"
                          name="tunjanganPph"
                          value={formatRupiahInput(modalTunjanganPph)}
                          onChange={(e) => setModalTunjanganPph(Number(e.target.value.replace(/[^0-9]/g, "")) || 0)}
                          placeholder="0"
                          className="w-full h-8 px-2.5 rounded-lg border border-border bg-surface-card text-foreground font-mono"
                        />
                      </div>
                      {modalGajiBulan === 12 && (
                        <button
                          type="button"
                          onClick={() => setModalTunjanganPph(akumulasiPphSetahun)}
                          className={`mt-2 w-full py-1.5 px-2 text-[10.5px] font-medium rounded-lg transition-all flex items-center justify-between cursor-pointer border shadow-xs ${
                            modalTunjanganPph === akumulasiPphSetahun && akumulasiPphSetahun > 0
                              ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                              : "bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 border-blue-200/80 dark:border-blue-800/60 active:scale-[0.99]"
                          }`}
                          title="Klik untuk mengisi otomatis akumulasi PPh 21 Jan–Des"
                        >
                          <span className="flex items-center gap-1.5">
                            {modalTunjanganPph === akumulasiPphSetahun && akumulasiPphSetahun > 0 ? (
                              <CheckCircle size={11} className="text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <Sparkles size={11} className="text-blue-500" />
                            )}
                            <span className="font-semibold">Set Jan–Des</span>
                          </span>
                          <span className="font-mono font-bold text-[11px]">{formatRupiah(akumulasiPphSetahun)}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Pelaporan PPh 21 */}
                <div className="p-3.5 rounded-xl bg-surface-subtle/50 border border-border space-y-2.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="font-semibold text-navy-text text-xs flex items-center gap-1.5 flex-wrap">
                      <span>Pelaporan PPh 21 (Beban Kantor)</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-semibold font-mono">
                        TER {liveTerCalc.kategori} ({liveTerCalc.tarifPersen}%)
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-faint font-medium">
                      Ditanggung Perusahaan
                    </span>
                  </div>

                  <div className="text-[10.5px] text-muted-faint">
                    Dasar Pengenaan Pajak: PTKP <span className="font-semibold text-foreground font-mono">{editingGaji.pegawai.statusKeluarga || "TK/0"}</span> · Bruto Terlapor <span className="font-semibold text-foreground font-mono">{formatRupiah(liveTotalGajiTerlaporPajak)}</span>
                  </div>

                  <div className="pt-2 border-t border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="text-xs font-semibold text-navy-text">
                      Nominal PPh 21 (Rp)
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => setModalPph21(liveTerCalc.nominal)}
                        className="flex-1 sm:flex-none px-2.5 py-1 text-[11px] font-semibold rounded-lg border border-navy/20 bg-navy/5 text-navy hover:bg-navy/15 dark:bg-navy/30 dark:text-blue-200 transition-colors cursor-pointer text-center"
                        title="Klik untuk mengisi otomatis sesuai tarif TER PP 58/2023"
                      >
                        Terapkan TER ({formatRupiah(liveTerCalc.nominal)})
                      </button>
                      <input
                        type="text"
                        inputMode="numeric"
                        name="pph21"
                        value={formatRupiahInput(modalPph21)}
                        onChange={(e) => setModalPph21(Number(e.target.value.replace(/[^0-9]/g, "")) || 0)}
                        placeholder="0"
                        className="w-28 sm:w-32 h-8 px-2.5 rounded-lg border border-border bg-surface-card text-foreground font-mono text-xs text-right font-semibold shrink-0"
                      />
                    </div>
                  </div>
                </div>

                {/* Ringkasan Total Live Preview: Formulasi THP vs Terlapor Pajak */}
                <div className="p-3.5 rounded-xl border border-border bg-surface-subtle/40 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-stronger block">
                      Formulasi Penghitungan Gaji (THP vs Terlapor Pajak)
                    </span>
                    <span className="text-[10px] text-muted-faint font-mono">
                      Rumus Standar SAK & Pajak
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-semibold text-blue-900 dark:text-blue-300">
                          Gaji Terlapor Pajak (Bruto)
                        </span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-bold font-mono">
                          SPT PPh 21
                        </span>
                      </div>
                      <span className="text-base font-bold font-mono text-blue-900 dark:text-blue-200 block mt-0.5">
                        {formatRupiah(liveTotalGajiTerlaporPajak)}
                      </span>
                      <span className="text-[9.5px] text-blue-800/80 dark:text-blue-300/70 block mt-0.5">
                        Gaji Pokok + Seluruh Tunjangan (Jabatan, Transport, Insentif, BPJS & PPh)
                      </span>
                    </div>

                    <div className="p-3 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-semibold text-emerald-900 dark:text-emerald-300">
                          Gaji Bersih (Take Home Pay)
                        </span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 font-bold font-mono">
                          Ditransfer
                        </span>
                      </div>
                      <span className="text-base font-bold font-mono text-emerald-800 dark:text-emerald-200 block mt-0.5">
                        {formatRupiah(liveTotalGajiBersih)}
                      </span>
                      <span className="text-[9.5px] text-emerald-800/80 dark:text-emerald-300/70 block mt-0.5">
                        Gaji Pokok + Jabatan + Transport + Insentif − BPJS Karyawan {modalPotonganLain > 0 ? "− Kasbon" : ""}
                      </span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-surface-card border border-border text-[10.5px] text-muted-faint flex items-start gap-1.5">
                    <Info size={13} className="text-navy shrink-0 mt-0.5" />
                    <span>
                      <strong>Catatan Regulasi:</strong> Tunjangan BPJS ({formatRupiah(liveTotalTunjanganBpjs)}) dan Tunjangan PPh ({formatRupiah(modalTunjanganPph)}) tidak ikut dikirim ke rekening karyawan karena dibayarkan langsung ke lembaga terkait (BPJS & Kas Negara/DJP).
                    </span>
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

              {/* Filter Periode Bebas & Rekap Akumulasi */}
              {(() => {
                const modalAk = getAkumulasiData(riwayatPegawaiTarget, modalStartMonth, modalEndMonth);
                return (
                  <div className="space-y-4">
                    {/* Filter Rentang Periode di Modal */}
                    <div className="p-3.5 rounded-xl border border-border bg-surface-subtle/50 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-muted-stronger flex items-center gap-1">
                          <Filter size={12} className="text-navy" />
                          <span>Filter Periode:</span>
                        </span>
                        <div className="inline-flex items-center gap-1.5">
                          <select
                            value={modalStartMonth}
                            onChange={(e) => setModalStartMonth(Number(e.target.value))}
                            className="h-7 text-xs rounded-lg border border-border bg-surface-card text-navy-text font-semibold px-2"
                          >
                            {BULAN_NAMES.map((name, idx) => (
                              <option key={idx + 1} value={idx + 1}>
                                {name}
                              </option>
                            ))}
                          </select>
                          <span className="text-xs text-muted-faint font-semibold">s/d</span>
                          <select
                            value={modalEndMonth}
                            onChange={(e) => setModalEndMonth(Number(e.target.value))}
                            className="h-7 text-xs rounded-lg border border-border bg-surface-card text-navy-text font-semibold px-2"
                          >
                            {BULAN_NAMES.map((name, idx) => (
                              <option key={idx + 1} value={idx + 1}>
                                {name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Presets */}
                        <div className="flex items-center gap-1 flex-wrap">
                          <button
                            type="button"
                            onClick={() => {
                              setModalStartMonth(1);
                              setModalEndMonth(9);
                            }}
                            className={`h-6 px-2 rounded-md text-[10px] font-semibold border cursor-pointer transition-colors ${
                              modalStartMonth === 1 && modalEndMonth === 9
                                ? "bg-navy text-white border-navy"
                                : "bg-surface-card text-muted-stronger border-border hover:bg-surface-hover"
                            }`}
                          >
                            Jan – Sep
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setModalStartMonth(1);
                              setModalEndMonth(12);
                            }}
                            className={`h-6 px-2 rounded-md text-[10px] font-semibold border cursor-pointer transition-colors ${
                              modalStartMonth === 1 && modalEndMonth === 12
                                ? "bg-navy text-white border-navy"
                                : "bg-surface-card text-muted-stronger border-border hover:bg-surface-hover"
                            }`}
                          >
                            Full 12 Bln
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setModalStartMonth(1);
                              setModalEndMonth(6);
                            }}
                            className={`h-6 px-2 rounded-md text-[10px] font-semibold border cursor-pointer transition-colors ${
                              modalStartMonth === 1 && modalEndMonth === 6
                                ? "bg-navy text-white border-navy"
                                : "bg-surface-card text-muted-stronger border-border hover:bg-surface-hover"
                            }`}
                          >
                            Sem 1
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setModalStartMonth(7);
                              setModalEndMonth(12);
                            }}
                            className={`h-6 px-2 rounded-md text-[10px] font-semibold border cursor-pointer transition-colors ${
                              modalStartMonth === 7 && modalEndMonth === 12
                                ? "bg-navy text-white border-navy"
                                : "bg-surface-card text-muted-stronger border-border hover:bg-surface-hover"
                            }`}
                          >
                            Sem 2
                          </button>
                        </div>
                      </div>

                      <span className="text-[11px] text-muted-faint font-mono">
                        {BULAN_NAMES[modalAk.from - 1]} – {BULAN_NAMES[modalAk.to - 1]} ({modalAk.totalBulanRentang} Bulan)
                      </span>
                    </div>

                    {/* 4 Cards Summary (Dihitung Dinamis Sesuai Periode) */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3.5 rounded-xl border border-border bg-surface-card">
                        <div className="text-[11px] text-muted-faint font-medium">Bulan Terbayar</div>
                        <div className="text-lg font-bold font-mono text-navy-text mt-0.5">
                          {modalAk.bulanTerbayar} / {modalAk.totalBulanRentang} Bln
                        </div>
                      </div>
                      <div className="p-3.5 rounded-xl border border-border bg-surface-card">
                        <div className="text-[11px] text-muted-faint font-medium">Total Bruto Terlapor</div>
                        <div className="text-lg font-bold font-mono text-blue-900 dark:text-blue-300 mt-0.5">
                          {formatRupiah(modalAk.totalGajiTerlaporPajak)}
                        </div>
                      </div>
                      <div className="p-3.5 rounded-xl border border-border bg-surface-card">
                        <div className="text-[11px] text-muted-faint font-medium">Total PPh 21 Terhitung</div>
                        <div className="text-lg font-bold font-mono text-amber-700 dark:text-amber-300 mt-0.5">
                          {formatRupiah(modalAk.totalPph21)}
                        </div>
                      </div>
                      <div className="p-3.5 rounded-xl border border-border bg-surface-card">
                        <div className="text-[11px] text-muted-faint font-medium">Total Bersih (THP)</div>
                        <div className="text-lg font-bold font-mono text-emerald-700 dark:text-emerald-400 mt-0.5">
                          {formatRupiah(modalAk.totalGajiBersih)}
                        </div>
                      </div>
                    </div>

                    {/* Tabel Riwayat Bulanan Dalam Periode */}
                    <div className="rounded-xl border border-border overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[700px] text-left text-xs border-separate border-spacing-0">
                          <thead className="bg-surface-subtle text-muted-stronger font-bold">
                            <tr>
                              <th className="py-2.5 px-3.5 whitespace-nowrap min-w-[110px] border-b border-r border-border">Bulan</th>
                              <th className="py-2.5 px-3.5 text-center whitespace-nowrap min-w-[100px] border-b border-r border-border">Status</th>
                              <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[110px] border-b border-r border-border">Gaji Pokok</th>
                              <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[110px] border-b border-r border-border">Tunjangan</th>
                              <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[100px] border-b border-r border-border">Potongan BPJS</th>
                              <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[90px] border-b border-r border-border">PPh 21</th>
                              <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[120px] border-b border-r border-border">Gaji Bersih (THP)</th>
                              <th className="py-2.5 px-3.5 text-center whitespace-nowrap min-w-[100px] border-b border-border">Aksi</th>
                            </tr>
                          </thead>
                          <tbody>
                            {modalAk.monthlyBreakdown.map(({ bulan: m, gajiRow, isPaid }) => (
                              <tr
                                key={m}
                                className={`hover:bg-surface-hover/30 transition-colors ${
                                  isPaid ? "" : "opacity-60 bg-surface-subtle/20"
                                }`}
                              >
                                <td className="py-2.5 px-3.5 font-bold text-navy-text whitespace-nowrap border-b border-r border-border">
                                  {BULAN_NAMES[m - 1]} {selectedYear}
                                </td>
                                <td className="py-2.5 px-3.5 text-center whitespace-nowrap border-b border-r border-border">
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
                                <td className="py-2.5 px-3.5 text-right font-mono whitespace-nowrap border-b border-r border-border">
                                  {gajiRow ? gajiRow.gajiPokokFmt : "-"}
                                </td>
                                <td className="py-2.5 px-3.5 text-right font-mono whitespace-nowrap border-b border-r border-border">
                                  {gajiRow
                                    ? formatRupiah(
                                        (gajiRow.tunjanganJabatan || 0) +
                                          (gajiRow.tunjanganTransport || 0) +
                                          (gajiRow.insentif || 0) +
                                          (gajiRow.thr || 0)
                                      )
                                    : "-"}
                                </td>
                                <td className="py-2.5 px-3.5 text-right font-mono text-rose-700 dark:text-rose-300 whitespace-nowrap border-b border-r border-border">
                                  {gajiRow
                                    ? (gajiRow.potonganBpjsFmt ||
                                        formatRupiah(
                                          (gajiRow.bpjsKesehatan || 0) +
                                            (gajiRow.bpjsKetenagakerjaan || 0) +
                                            (gajiRow.potonganLain || 0)
                                        ))
                                    : "-"}
                                </td>
                                <td className="py-2.5 px-3.5 text-right font-mono text-amber-700 dark:text-amber-300 whitespace-nowrap border-b border-r border-border">
                                  {gajiRow ? gajiRow.pph21Fmt : "-"}
                                </td>
                                <td className="py-2.5 px-3.5 text-right font-mono font-bold text-emerald-700 dark:text-emerald-300 whitespace-nowrap border-b border-r border-border">
                                  {gajiRow ? gajiRow.totalGajiBersihFmt : "-"}
                                </td>
                                <td className="py-2.5 px-3.5 text-center whitespace-nowrap border-b border-border">
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
                            ))}
                          </tbody>
                          <tfoot className="bg-surface-subtle font-bold text-xs">
                            <tr>
                              <td className="py-2.5 px-3.5 text-navy-text border-t-2 border-b border-r border-border">
                                Total ({modalAk.bulanTerbayar} Bulan):
                              </td>
                              <td className="py-2.5 px-3.5 text-center font-mono border-t-2 border-b border-r border-border">
                                {modalAk.bulanTerbayar} / {modalAk.totalBulanRentang}
                              </td>
                              <td className="py-2.5 px-3.5 text-right font-mono border-t-2 border-b border-r border-border">
                                {formatRupiah(modalAk.totalGajiPokok)}
                              </td>
                              <td className="py-2.5 px-3.5 text-right font-mono border-t-2 border-b border-r border-border">
                                {formatRupiah(modalAk.totalTunjangan)}
                              </td>
                              <td className="py-2.5 px-3.5 text-right font-mono text-rose-700 dark:text-rose-300 border-t-2 border-b border-r border-border">
                                {formatRupiah(modalAk.totalPotonganBpjs + modalAk.totalPotonganLain)}
                              </td>
                              <td className="py-2.5 px-3.5 text-right font-mono text-amber-700 dark:text-amber-300 border-t-2 border-b border-r border-border">
                                {formatRupiah(modalAk.totalPph21)}
                              </td>
                              <td className="py-2.5 px-3.5 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400 border-t-2 border-b border-r border-border">
                                {formatRupiah(modalAk.totalGajiBersih)}
                              </td>
                              <td className="py-2.5 px-3.5 text-center border-t-2 border-b border-border">
                                -
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border bg-surface-subtle/30 flex items-center justify-between shrink-0 flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedAkumulasiPegawaiId(riwayatPegawaiTarget.id);
                  setAkumulasiMode("per-nama");
                  setAkumulasiStartMonth(modalStartMonth);
                  setAkumulasiEndMonth(modalEndMonth);
                  setPegawaiSubTab("tahunan");
                  setRiwayatPegawaiTarget(null);
                }}
                className="h-8 px-3 rounded-xl bg-navy text-white text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-navy-light transition-colors cursor-pointer shadow-2xs"
              >
                <Briefcase size={13} />
                <span>Buka Rekapitulasi Lengkap di Tab Akumulasi</span>
              </button>
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

              {/* Catatan Formulasi THP & Terlapor Pajak di Slip Gaji */}
              <div className="p-3 rounded-xl bg-surface-subtle/60 border border-border text-[10px] space-y-1">
                <div className="font-semibold text-navy-text flex items-center justify-between flex-wrap gap-1">
                  <span>Formulasi THP: Gaji Pokok + Tunjangan Jabatan + Transport + Insentif − Potongan BPJS {slipModalItem.potonganLain > 0 ? "− Kasbon" : ""}</span>
                  <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                    = {slipModalItem.totalGajiBersihFmt}
                  </span>
                </div>
                <p className="text-muted-faint text-[9.5px]">
                  * Tunjangan BPJS dan Tunjangan PPh merupakan fasilitas yang disetorkan langsung ke BPJS dan Kas Negara (DJP), sehingga tidak ikut dikirim ke rekening karyawan namun tetap diakumulasikan ke dalam Gaji Terlapor Pajak (Bruto).
                </p>
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



      {/* ========================================================= */}
      {/* MODAL 7: SETTING BIAYA TRANSPORT STANDAR (DATABASE PEGAWAI) */}
      {/* ========================================================= */}
      {mounted && isBatchTransportModalOpen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-surface-card rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface-subtle/50">
              <h3 className="text-sm font-bold text-navy-text">
                Setting Biaya Transport Pegawai
              </h3>
              <button
                onClick={() => setIsBatchTransportModalOpen(false)}
                className="p-1 text-muted-faint hover:text-navy-text rounded-lg transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                startTransition(async () => {
                  try {
                    const res = await updateBatchTransportAction(
                      data.entity?.id ?? "",
                      batchTarifTransport
                    );
                    setSuccessMsg(res.message);
                    setIsBatchTransportModalOpen(false);
                    router.refresh();
                  } catch (err: unknown) {
                    setErrorMsg((err as Error).message);
                  }
                });
              }}
              className="p-5 space-y-4 text-xs"
            >
              <div className="p-3.5 rounded-xl bg-surface-subtle border border-border space-y-1">
                <div className="text-[10px] text-muted-faint uppercase font-bold tracking-wider">
                  Entitas Terpilih
                </div>
                <div className="text-sm font-bold text-navy-text">
                  {data.entity?.name}
                </div>
                <div className="text-xs text-muted-stronger">
                  Diterapkan ke {allMasterPegawai.length} Pegawai Terdaftar
                </div>
              </div>

              <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-[11px] text-blue-900 dark:text-blue-200 space-y-1.5 leading-relaxed">
                <p className="font-semibold flex items-center gap-1.5">
                  <Info size={13} className="shrink-0 text-blue-600 dark:text-blue-400" />
                  <span>Rumus Perhitungan Otomatis:</span>
                </p>
                <p className="text-blue-800 dark:text-blue-300">
                  Tarif ini disimpan di database master karyawan. Saat penggajian bulanan, Tim Finance cukup mengisi hari kerja dan tunjangan otomatis dihitung:
                  <br />
                  <strong className="font-mono text-navy dark:text-blue-200">
                    Tunjangan Transport = Hari Kerja × Tarif Harian Master
                  </strong>
                </p>
              </div>

              <div>
                <label className="font-semibold text-navy-text block mb-1">
                  Tarif Transport Standar (Rp / Hari Kerja) *
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  value={formatRupiahInput(batchTarifTransport)}
                  onChange={(e) => {
                    const val = Number(e.target.value.replace(/[^0-9]/g, "")) || 0;
                    setBatchTarifTransport(val);
                  }}
                  placeholder="15.000"
                  className="w-full h-8 px-3 rounded-lg border border-border bg-surface-card text-foreground font-mono font-bold text-sm"
                />
                <p className="text-[10px] text-muted-faint mt-1">
                  Contoh standar: Rp 15.000 / hari (Rp 300.000 untuk 20 hari kerja).
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsBatchTransportModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-border text-muted-stronger hover:bg-surface-hover transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending || batchTarifTransport < 0}
                  className="px-4 py-1.5 rounded-lg bg-navy text-white font-semibold hover:bg-navy-light transition-colors cursor-pointer shadow-2xs inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isPending ? "Menyimpan..." : "Terapkan ke Semua Karyawan"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================= */}
      {/* MODAL 8: UBAH TARIF TRANSPORT SATUAN KARYAWAN */}
      {/* ========================================================= */}
      {mounted && quickTransportTarget && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-surface-card rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-surface-subtle/50">
              <h3 className="text-sm font-bold text-navy-text">
                Ubah Biaya Transport Karyawan
              </h3>
              <button
                onClick={() => setQuickTransportTarget(null)}
                className="p-1 text-muted-faint hover:text-navy-text rounded-lg transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                startTransition(async () => {
                  try {
                    const res = await updatePegawaiTransportAction(
                      quickTransportTarget.id,
                      quickTarifTransportVal
                    );
                    setSuccessMsg(res.message);
                    setQuickTransportTarget(null);
                    router.refresh();
                  } catch (err: unknown) {
                    setErrorMsg((err as Error).message);
                  }
                });
              }}
              className="p-5 space-y-3.5 text-xs"
            >
              <div>
                <div className="font-bold text-navy-text text-sm">{quickTransportTarget.nama}</div>
                <div className="text-muted-faint font-mono text-[11px] mt-0.5">
                  {quickTransportTarget.nik} · {quickTransportTarget.jabatan}
                </div>
              </div>

              <div>
                <label className="font-semibold text-navy-text block mb-1">
                  Tarif Transport / Hari Kerja (Rp) *
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  value={formatRupiahInput(quickTarifTransportVal)}
                  onChange={(e) => {
                    const val = Number(e.target.value.replace(/[^0-9]/g, "")) || 0;
                    setQuickTarifTransportVal(val);
                  }}
                  placeholder="15.000"
                  className="w-full h-8 px-3 rounded-lg border border-border bg-surface-card text-foreground font-mono font-bold text-sm"
                />
                <p className="text-[10px] text-muted-faint mt-1">
                  Disimpan di master database karyawan ini. Otomatis dikalikan jumlah hari kerja saat penggajian.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setQuickTransportTarget(null)}
                  className="px-3.5 py-1.5 rounded-lg border border-border text-muted-stronger hover:bg-surface-hover transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending || quickTarifTransportVal < 0}
                  className="px-4 py-1.5 rounded-lg bg-navy text-white font-semibold hover:bg-navy-light transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
                >
                  {isPending ? "Menyimpan..." : "Simpan Tarif"}
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
