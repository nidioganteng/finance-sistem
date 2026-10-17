"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FileText,
  Receipt,
  TrendingUp,
  Wallet,
  Building2,
  Scale,
  Plus,
  FileSpreadsheet,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Pencil,
  Trash2,
  X,
  Calculator,
  ChevronDown,
  Info,
  Calendar,
  Layers,
  ArrowRight,
  ShieldCheck,
  Building,
  Sparkles,
  Copy,
} from "lucide-react";
import type {
  LaporanPendapatanData,
  FakturPendapatanItem,
  RekonsiliasiPajakItem,
} from "@/lib/pendapatan";
import {
  NAMA_BULAN,
  hitungPajakFaktur,
  hitungDppDariKwitansi,
  hitungDppNilaiLain,
} from "@/lib/pendapatan";
import {
  createFakturPendapatanAction,
  updateFakturPendapatanAction,
  deleteFakturPendapatanAction,
  upsertRekonsiliasiPajakAction,
  toggleCeklisDokumenFakturAction,
  type FakturPendapatanInput,
} from "@/lib/actions/pendapatan";
import { searchRekananAction, type RekananItem } from "@/lib/actions/rekanan";
import { formatRupiah } from "@/lib/dashboard-data";

interface Props {
  data: LaporanPendapatanData;
  canEdit: boolean;
  availableEntities: Array<{ id: string; key: string; name: string }>;
}

type TabType = "faktur" | "rekap-bulanan" | "rekonsiliasi";

function formatRupiahInput(val: string | number | undefined | null) {
  if (val === undefined || val === null || val === "" || val === 0 || val === "0") return "";
  const num = String(val).replace(/[^0-9]/g, "");
  if (!num) return "";
  return Number(num).toLocaleString("id-ID");
}

export function LaporanPendapatanClient({
  data,
  canEdit,
  availableEntities,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [activeTab, setActiveTab] = useState<TabType>("faktur");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterJenisProyek, setFilterJenisProyek] = useState<string>("ALL");

  // Modals state
  const [isFakturModalOpen, setIsFakturModalOpen] = useState(false);
  const [editingFaktur, setEditingFaktur] = useState<FakturPendapatanItem | null>(null);

  const [isReconModalOpen, setIsReconModalOpen] = useState(false);
  const [editingRecon, setEditingRecon] = useState<RekonsiliasiPajakItem | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingFaktur, setDeletingFaktur] = useState<FakturPendapatanItem | null>(null);

  // Form states for Faktur
  const [formFaktur, setFormFaktur] = useState({
    npwp: "",
    noFaktur: "",
    masaPajak: data.masaPajak ?? 1,
    tahunPajak: data.year,
    namaRekanan: "",
    namaJkp: "",
    nilaiKuitansi: 0, // Input Utama
    dpp: 0,
    dppNilaiLain: 0,
    tarifPpnPersen: 12,
    tarifPphPersen: 3.5,
    kodeJenisProyek: 1, // 1 = Perencanaan, 2 = Pengawasan
    pekerjaanPerusahaan: 0,
    pekerjaanYangDipinjam: 0,
    tanggalTerima: "",
    bank: "",
    nominalDiterima: 0,
    ceklisPpn: false,
    ceklisPph: false,
    ceklisBuktiPotong: false,
    projectId: "",
  });

  // Termin selection state for auto-syncing DPP
  const [selectedTerminId, setSelectedTerminId] = useState<string>("");
  const [showManualDppFallback, setShowManualDppFallback] = useState(false);

  // Amrahan / Multi-Termin detection state (Issue 101)
  const [amrahanDetected, setAmrahanDetected] = useState<FakturPendapatanItem | null>(null);
  // Mode input nomor faktur: "existing" (pilih dari riwayat nomor faktur proyek) atau "new" (input nomor faktur baru manual)
  const [noFakturMode, setNoFakturMode] = useState<"existing" | "new">("new");

  // Auto-Fill Master Rekanan state (Issue 84 & 102)
  const [rekananSuggestions, setRekananSuggestions] = useState<RekananItem[]>([]);
  const [showRekananDropdown, setShowRekananDropdown] = useState(false);
  const [matchedRekananMaster, setMatchedRekananMaster] = useState<RekananItem | null>(null);
  const [isSearchingRekanan, setIsSearchingRekanan] = useState(false);
  const [selectedRekananId, setSelectedRekananId] = useState<string>("");

  // Form state for Rekonsiliasi
  const [formRecon, setFormRecon] = useState({
    month: 1,
    dppTerlapor: 0,
    pajakTerlapor: 0,
    pphTerlapor: 0,
    keterangan: "",
  });

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter faktur list
  const filteredFaktur = data.fakturList.filter((f) => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      searchQuery === "" ||
      f.noFaktur.toLowerCase().includes(q) ||
      f.npwp.toLowerCase().includes(q) ||
      f.namaRekanan.toLowerCase().includes(q) ||
      f.namaJkp.toLowerCase().includes(q) ||
      (f.bank ? f.bank.toLowerCase().includes(q) : false) ||
      (f.projectCode ? f.projectCode.toLowerCase().includes(q) : false) ||
      (f.projectName ? f.projectName.toLowerCase().includes(q) : false);

    const matchJenis =
      filterJenisProyek === "ALL" ||
      (filterJenisProyek === "1" && f.kodeJenisProyek === 1) ||
      (filterJenisProyek === "2" && f.kodeJenisProyek === 2);

    return matchSearch && matchJenis;
  });

  // Rekonsiliasi 12-month totals (Lapis 3 Footer)
  const rekonTotals = useMemo(() => {
    return data.rekonsiliasiList.reduce(
      (acc, r) => {
        acc.dppRekap += r.dppRekap;
        acc.dppTerlapor += r.dppTerlapor;
        acc.selisihDpp += r.selisihDpp;
        acc.ppnRekap += r.ppnRekap;
        acc.pajakTerlapor += r.pajakTerlapor;
        acc.selisihPajak += r.selisihPajak;
        acc.pphRekap += r.pphRekap;
        acc.pphTerlapor += r.pphTerlapor;
        acc.selisihPph += r.selisihPph;
        acc.totalPajakRekap += r.totalPajakRekap;
        acc.totalPajakTerlapor += r.totalPajakTerlapor;
        acc.selisihTotalPajak += r.selisihTotalPajak;
        return acc;
      },
      {
        dppRekap: 0,
        dppTerlapor: 0,
        selisihDpp: 0,
        ppnRekap: 0,
        pajakTerlapor: 0,
        selisihPajak: 0,
        pphRekap: 0,
        pphTerlapor: 0,
        selisihPph: 0,
        totalPajakRekap: 0,
        totalPajakTerlapor: 0,
        selisihTotalPajak: 0,
      }
    );
  }, [data.rekonsiliasiList]);

  // Live calculation for Faktur Form
  const liveCalc = hitungPajakFaktur(
    formFaktur.dpp,
    formFaktur.dppNilaiLain,
    formFaktur.tarifPpnPersen,
    formFaktur.tarifPphPersen,
    formFaktur.nilaiKuitansi > 0 ? formFaktur.nilaiKuitansi : undefined
  );

  // Selected project & termin helpers for auto-syncing DPP
  const selectedProject = data.projectOptions.find((p) => p.id === formFaktur.projectId);
  const selectedTermin = selectedProject?.termins.find((t) => t.id === selectedTerminId);

  // Riwayat nomor faktur unik pada proyek yang dipilih untuk dukungan Amrahan / Multi-Termin
  const distinctProjectFakturs = useMemo(() => {
    if (!selectedProject?.existingFakturs || selectedProject.existingFakturs.length === 0) {
      return [];
    }
    const map = new Map<
      string,
      {
        noFaktur: string;
        count: number;
        latest: (typeof selectedProject.existingFakturs)[0];
      }
    >();
    for (const f of selectedProject.existingFakturs) {
      const key = f.noFaktur.trim();
      if (!key) continue;
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(key, { noFaktur: key, count: 1, latest: f });
      }
    }
    return Array.from(map.values());
  }, [selectedProject]);

  function handleSelectExistingProjectFaktur(chosenNoFaktur: string) {
    if (!chosenNoFaktur || chosenNoFaktur === "__MANUAL_NEW__") {
      setNoFakturMode("new");
      setFormFaktur((prev) => ({ ...prev, noFaktur: "" }));
      setAmrahanDetected(null);
      return;
    }

    const match =
      selectedProject?.existingFakturs?.find(
        (f) => f.noFaktur.trim().toLowerCase() === chosenNoFaktur.trim().toLowerCase()
      ) ||
      data.fakturList.find(
        (f) => f.noFaktur.trim().toLowerCase() === chosenNoFaktur.trim().toLowerCase()
      );

    if (match) {
      setAmrahanDetected(match as any);
      const prevKuitansi =
        match.nilaiProyek || (match.dpp > 0 ? Math.round((match.dpp * 111) / 100) : 0);
      setFormFaktur((prev) => ({
        ...prev,
        noFaktur: match.noFaktur,
        namaRekanan: match.namaRekanan,
        npwp: match.npwp ?? "",
        namaJkp: match.namaJkp,
        nilaiKuitansi: prevKuitansi,
        dpp: match.dpp,
        dppNilaiLain: match.dppNilaiLain,
        tarifPpnPersen: match.tarifPpnPersen,
        tarifPphPersen: match.tarifPphPersen,
        bank: "",
        tanggalTerima: "",
        nominalDiterima: 0,
      }));

      const cleanNpwp = (match.npwp || "").replace(/[\s.\-_/]/g, "").toLowerCase();
      const matchedRek = (data.rekananOptions || []).find(
        (r) =>
          (r.npwp && r.npwp.replace(/[\s.\-_/]/g, "").toLowerCase() === cleanNpwp) ||
          r.nama.toLowerCase() === (match.namaRekanan || "").toLowerCase()
      );
      if (matchedRek) {
        setSelectedRekananId(matchedRek.id);
        setMatchedRekananMaster(matchedRek as any);
      }
    } else {
      setFormFaktur((prev) => ({ ...prev, noFaktur: chosenNoFaktur }));
    }
  }

  function handleSelectTermin(terminId: string) {
    setSelectedTerminId(terminId);
    if (!terminId || terminId === "manual") {
      setShowManualDppFallback(true);
      return;
    }
    setShowManualDppFallback(false);
    const proj = data.projectOptions.find((x) => x.id === formFaktur.projectId);
    const term = proj?.termins.find((t) => t.id === terminId);
    if (term) {
      const nominal = term.nominal;
      const dpp = hitungDppDariKwitansi(nominal);
      const dppNilaiLain = dpp;
      setFormFaktur((prev) => ({
        ...prev,
        nilaiKuitansi: nominal,
        dpp,
        dppNilaiLain,
        pekerjaanPerusahaan: dpp,
        pekerjaanYangDipinjam: 0,
        namaJkp: proj ? `Jasa Konsultansi ${proj.name} - ${term.name}` : prev.namaJkp,
        nominalDiterima: 0,
      }));
    }
  }

  // Navigation handlers
  function handleFilterChange(newEntity?: string, newYear?: number, newMasa?: number | null) {
    const currentYear = newYear !== undefined ? newYear : data.year;
    const currentEntity = newEntity !== undefined ? newEntity : data.entity.key;
    const currentMasa = newMasa !== undefined ? newMasa : data.masaPajak;

    if (newEntity) {
      document.cookie = `lastEntityKey=${newEntity}; path=/; max-age=2592000`;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.set("entity", currentEntity);
    params.set("year", currentYear.toString());
    if (currentMasa) {
      params.set("masaPajak", currentMasa.toString());
    } else {
      params.delete("masaPajak");
    }

    startTransition(() => {
      router.push(`/pendapatan?${params.toString()}`);
    });
  }

  function handleSelectRekananFromDropdown(id: string) {
    if (id === "__MANUAL__") {
      setSelectedRekananId("__MANUAL__");
      setMatchedRekananMaster(null);
      return;
    }
    setSelectedRekananId(id);
    if (!id) {
      setMatchedRekananMaster(null);
      return;
    }
    const sel = data.rekananOptions?.find((r) => r.id === id);
    if (sel) {
      setFormFaktur((prev) => ({
        ...prev,
        namaRekanan: sel.nama,
        npwp: sel.npwp || prev.npwp,
      }));
      setMatchedRekananMaster(sel as any);
      setShowRekananDropdown(false);
    }
  }

  async function handleNpwpChange(val: string) {
    setFormFaktur((prev) => ({ ...prev, npwp: val }));
    const trimmed = val.trim();
    if (trimmed.length >= 3) {
      setIsSearchingRekanan(true);
      try {
        const res = await searchRekananAction(trimmed);
        if (res.data && res.data.length > 0) {
          const cleanedInput = trimmed.replace(/[\s.\-_/]/g, "").toLowerCase();
          const match =
            res.data.find((r) => {
              const rNpwp = (r.npwp || "").replace(/[\s.\-_/]/g, "").toLowerCase();
              return rNpwp === cleanedInput || rNpwp.includes(cleanedInput);
            }) || res.data[0];

          if (match) {
            setMatchedRekananMaster(match);
            setSelectedRekananId(match.id);
            setFormFaktur((prev) => ({
              ...prev,
              namaRekanan: match.nama,
            }));
          } else {
            setMatchedRekananMaster(null);
            setSelectedRekananId("__MANUAL__");
          }
        } else {
          setMatchedRekananMaster(null);
          setSelectedRekananId("__MANUAL__");
        }
      } catch {
        // ignore
      } finally {
        setIsSearchingRekanan(false);
      }
    } else {
      setMatchedRekananMaster(null);
    }
  }

  async function handleNamaRekananChange(val: string) {
    setFormFaktur((prev) => ({ ...prev, namaRekanan: val }));
    const trimmed = val.trim();
    if (trimmed.length >= 2) {
      try {
        const res = await searchRekananAction(trimmed);
        if (res.data && res.data.length > 0) {
          setRekananSuggestions(res.data);
          setShowRekananDropdown(true);
        } else {
          setRekananSuggestions([]);
          setShowRekananDropdown(false);
        }
      } catch {
        // ignore
      }
    } else {
      setRekananSuggestions([]);
      setShowRekananDropdown(false);
    }
  }

  function handleSelectRekanan(r: RekananItem) {
    setSelectedRekananId(r.id);
    setFormFaktur((prev) => ({
      ...prev,
      namaRekanan: r.nama,
      npwp: r.npwp || prev.npwp,
    }));
    setMatchedRekananMaster(r);
    setShowRekananDropdown(false);
  }

  function openCreateFakturModal() {
    setEditingFaktur(null);
    setSelectedTerminId("");
    setSelectedRekananId("");
    setShowManualDppFallback(false);
    setMatchedRekananMaster(null);
    setRekananSuggestions([]);
    setShowRekananDropdown(false);
    setAmrahanDetected(null);
    setNoFakturMode("new");
    setFormFaktur({
      npwp: "",
      noFaktur: "",
      masaPajak: data.masaPajak ?? new Date().getMonth() + 1,
      tahunPajak: data.year,
      namaRekanan: "",
      namaJkp: "",
      nilaiKuitansi: 0,
      dpp: 0,
      dppNilaiLain: 0,
      tarifPpnPersen: 12,
      tarifPphPersen: 3.5,
      kodeJenisProyek: 1,
      pekerjaanPerusahaan: 0,
      pekerjaanYangDipinjam: 0,
      tanggalTerima: "",
      bank: "",
      nominalDiterima: 0,
      ceklisPpn: false,
      ceklisPph: false,
      ceklisBuktiPotong: false,
      projectId: "",
    });
    setErrorMessage(null);
    setIsFakturModalOpen(true);
  }

  function openEditFakturModal(f: FakturPendapatanItem) {
    setEditingFaktur(f);
    setAmrahanDetected(null);
    setNoFakturMode("new");
    const proj = data.projectOptions.find((p) => p.id === f.projectId);
    const matchedTermin = proj?.termins.find((t) => t.nominal === f.dpp);
    if (matchedTermin) {
      setSelectedTerminId(matchedTermin.id);
      setShowManualDppFallback(false);
    } else {
      setSelectedTerminId("");
      setShowManualDppFallback(true);
    }
    const cleanFakturNpwp = (f.npwp || "").replace(/[\s.\-_/]/g, "").toLowerCase();
    const matchedRek = (data.rekananOptions || []).find(
      (r) =>
        (r.npwp && r.npwp.replace(/[\s.\-_/]/g, "").toLowerCase() === cleanFakturNpwp) ||
        r.nama.toLowerCase() === (f.namaRekanan || "").toLowerCase()
    );
    setSelectedRekananId(matchedRek?.id || "__MANUAL__");
    setMatchedRekananMaster((matchedRek as any) ?? null);
    setRekananSuggestions([]);
    setShowRekananDropdown(false);
    const initialKuitansi = f.nilaiProyek || (f.dpp > 0 ? Math.round((f.dpp * 111) / 100) : 0);
    setFormFaktur({
      npwp: f.npwp,
      noFaktur: f.noFaktur,
      masaPajak: f.masaPajak,
      tahunPajak: f.tahunPajak,
      namaRekanan: f.namaRekanan,
      namaJkp: f.namaJkp,
      nilaiKuitansi: initialKuitansi,
      dpp: f.dpp,
      dppNilaiLain: f.dppNilaiLain,
      tarifPpnPersen: f.tarifPpnPersen,
      tarifPphPersen: f.tarifPphPersen,
      kodeJenisProyek: f.kodeJenisProyek,
      pekerjaanPerusahaan: f.pekerjaanPerusahaan,
      pekerjaanYangDipinjam: f.pekerjaanYangDipinjam,
      tanggalTerima: f.tanggalTerima ?? "",
      bank: f.bank ?? "",
      nominalDiterima: f.nominalDiterima,
      ceklisPpn: f.ceklisPpn,
      ceklisPph: f.ceklisPph,
      ceklisBuktiPotong: f.ceklisBuktiPotong,
      projectId: f.projectId ?? "",
    });
    setErrorMessage(null);
    setIsFakturModalOpen(true);
  }

  function handleNoFakturChange(val: string) {
    setFormFaktur((prev) => ({ ...prev, noFaktur: val }));
    if (editingFaktur) return;

    const trimmed = val.trim().toLowerCase();
    if (trimmed.length >= 3) {
      let match = selectedProject?.existingFakturs?.find(
        (f) => f.noFaktur.trim().toLowerCase() === trimmed
      ) as any;
      if (!match) {
        match = data.fakturList.find(
          (f) => f.noFaktur.trim().toLowerCase() === trimmed
        ) as any;
      }
      if (!match) {
        for (const pr of data.projectOptions) {
          const m = pr.existingFakturs?.find(
            (f) => f.noFaktur.trim().toLowerCase() === trimmed
          );
          if (m) {
            match = { ...m, projectId: pr.id } as any;
            break;
          }
        }
      }

      if (match) {
        setAmrahanDetected(match);
        const prevKuitansi = match.nilaiProyek || (match.dpp > 0 ? Math.round((match.dpp * 111) / 100) : 0);
        setFormFaktur((prev) => ({
          ...prev,
          noFaktur: val,
          namaRekanan: match.namaRekanan,
          npwp: match.npwp,
          projectId: match.projectId || prev.projectId,
          namaJkp: match.namaJkp,
          nilaiKuitansi: prevKuitansi,
          dpp: match.dpp,
          dppNilaiLain: match.dppNilaiLain,
          tarifPpnPersen: match.tarifPpnPersen,
          tarifPphPersen: match.tarifPphPersen,
          kodeJenisProyek: match.kodeJenisProyek,
          bank: match.bank || prev.bank,
        }));
        const cleanNpwp = (match.npwp || "").replace(/[\s.\-_/]/g, "").toLowerCase();
        const matchedRek = (data.rekananOptions || []).find(
          (r) =>
            (r.npwp && r.npwp.replace(/[\s.\-_/]/g, "").toLowerCase() === cleanNpwp) ||
            r.nama.toLowerCase() === (match.namaRekanan || "").toLowerCase()
        );
        if (matchedRek) {
          setSelectedRekananId(matchedRek.id);
          setMatchedRekananMaster(matchedRek as any);
        }
      } else {
        setAmrahanDetected(null);
      }
    } else {
      setAmrahanDetected(null);
    }
  }

  function handleToggleCeklis(fakturId: string, field: "ppn" | "pph" | "buktiPotong", currentValue: boolean) {
    if (!canEdit) return;
    startTransition(async () => {
      const res = await toggleCeklisDokumenFakturAction(fakturId, field, !currentValue);
      if (res?.error) {
        alert(res.error);
      } else {
        router.refresh();
      }
    });
  }

  function openReconModal(rec: RekonsiliasiPajakItem) {
    setEditingRecon(rec);
    setFormRecon({
      month: rec.month,
      dppTerlapor: rec.dppTerlapor,
      pajakTerlapor: rec.pajakTerlapor,
      pphTerlapor: rec.pphTerlapor,
      keterangan: rec.keterangan,
    });
    setErrorMessage(null);
    setIsReconModalOpen(true);
  }

  async function handleSaveFaktur(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const kuitansiVal = Number(formFaktur.nilaiKuitansi) || (formFaktur.dpp > 0 ? Math.round((formFaktur.dpp * 111) / 100) : 0);
      const dppVal = formFaktur.dpp > 0 ? Number(formFaktur.dpp) : (kuitansiVal > 0 ? Math.round((kuitansiVal * 100) / 111) : 0);
      const payload: FakturPendapatanInput = {
        entityId: data.entity.id,
        npwp: formFaktur.npwp,
        noFaktur: formFaktur.noFaktur,
        masaPajak: Number(formFaktur.masaPajak),
        tahunPajak: Number(formFaktur.tahunPajak),
        namaRekanan: formFaktur.namaRekanan,
        namaJkp: formFaktur.namaJkp,
        nilaiKuitansi: kuitansiVal,
        dpp: dppVal,
        dppNilaiLain: Number(formFaktur.dppNilaiLain) || dppVal,
        tarifPpnPersen: Number(formFaktur.tarifPpnPersen),
        tarifPphPersen: Number(formFaktur.tarifPphPersen),
        kodeJenisProyek: Number(formFaktur.kodeJenisProyek),
        pekerjaanPerusahaan: dppVal,
        pekerjaanYangDipinjam: 0,
        tanggalTerima: formFaktur.tanggalTerima.trim() ? formFaktur.tanggalTerima.trim() : null,
        bank: formFaktur.bank.trim() ? formFaktur.bank.trim() : null,
        nominalDiterima: Number(formFaktur.nominalDiterima) || 0,
        ceklisPpn: formFaktur.ceklisPpn,
        ceklisPph: formFaktur.ceklisPph,
        ceklisBuktiPotong: formFaktur.ceklisBuktiPotong,
        projectId: formFaktur.projectId || null,
      };

      let res;
      if (editingFaktur) {
        res = await updateFakturPendapatanAction(editingFaktur.id, payload);
      } else {
        res = await createFakturPendapatanAction(payload);
      }

      if (res.error) {
        setErrorMessage(res.error);
        setIsSubmitting(false);
        return;
      }

      setIsFakturModalOpen(false);
      startTransition(() => {
        router.refresh();
      });
    } catch (err: any) {
      setErrorMessage(err.message || "Terjadi kesalahan sistem.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteFaktur() {
    if (!deletingFaktur) return;
    setIsSubmitting(true);
    try {
      const res = await deleteFakturPendapatanAction(deletingFaktur.id);
      if (res.error) {
        alert(res.error);
      } else {
        setIsDeleteModalOpen(false);
        setDeletingFaktur(null);
        startTransition(() => {
          router.refresh();
        });
      }
    } catch (err: any) {
      alert(err.message || "Gagal menghapus faktur.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSaveRecon(e: React.FormEvent) {
    e.preventDefault();
    if (!editingRecon) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await upsertRekonsiliasiPajakAction({
        entityId: data.entity.id,
        year: data.year,
        month: formRecon.month,
        dppTerlapor: Number(formRecon.dppTerlapor),
        pajakTerlapor: Number(formRecon.pajakTerlapor),
        pphTerlapor: Number(formRecon.pphTerlapor),
        keterangan: formRecon.keterangan,
      });

      if (res.error) {
        setErrorMessage(res.error);
        setIsSubmitting(false);
        return;
      }

      setIsReconModalOpen(false);
      startTransition(() => {
        router.refresh();
      });
    } catch (err: any) {
      setErrorMessage(err.message || "Terjadi kesalahan.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const exportUrl = `/api/pendapatan/export?entityId=${data.entity.id}&year=${data.year}${
    data.masaPajak ? `&masaPajak=${data.masaPajak}` : ""
  }`;

  return (
    <div className="space-y-6">
      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TOOLBAR: FILTERS & ACTIONS */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between bg-surface-card p-3.5 sm:p-4 rounded-2xl border border-border-soft shadow-xs">
        {/* Left: Filter Controls & Audit Status Badge */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Filter Pill: Tahun */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-subtle/80 border border-border-soft text-xs text-navy-text">
            <Calendar className="w-3.5 h-3.5 text-navy-soft" />
            <span className="font-medium text-navy-soft">Tahun:</span>
            <select
              value={data.year}
              onChange={(e) => handleFilterChange(undefined, Number(e.target.value))}
              className="bg-transparent font-bold text-navy-text focus:outline-none cursor-pointer pr-1"
            >
              {[2024, 2025, 2026, 2027].map((yr) => (
                <option key={yr} value={yr} className="bg-surface-card text-navy-text">
                  {yr}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Pill: Masa Pajak */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-subtle/80 border border-border-soft text-xs text-navy-text">
            <Filter className="w-3.5 h-3.5 text-navy-soft" />
            <span className="font-medium text-navy-soft">Masa Pajak:</span>
            <select
              value={data.masaPajak ?? ""}
              onChange={(e) =>
                handleFilterChange(
                  undefined,
                  undefined,
                  e.target.value ? Number(e.target.value) : null
                )
              }
              className="bg-transparent font-bold text-navy-text focus:outline-none cursor-pointer pr-1"
            >
              <option value="" className="bg-surface-card text-navy-text">Semua Masa (12 Bulan)</option>
              {NAMA_BULAN.map((m, idx) => (
                <option key={idx + 1} value={idx + 1} className="bg-surface-card text-navy-text">
                  Bulan {idx + 1} ({m})
                </option>
              ))}
            </select>
          </div>

          <div className="h-5 w-px bg-border-soft hidden sm:block" />

          {/* Audit SPT Status Badge */}
          {data.kpiSummary.statusAudit === "SEMUA_SESUAI" ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>
                <strong className="font-semibold text-navy-soft">Audit SPT:</strong> Match 100% Sesuai
              </span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-300 text-xs">
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <span>
                <strong className="font-semibold text-navy-soft">Audit SPT:</strong> {data.kpiSummary.jumlahBulanSelisih} Bulan Selisih
              </span>
            </div>
          )}
        </div>

        {/* Right: Action Buttons */}
        <div className="flex items-center gap-2.5">
          <a
            href={exportUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800 transition-colors shadow-xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Ekspor Excel</span>
          </a>

          {canEdit && (
            <button
              onClick={openCreateFakturModal}
              className="inline-flex items-center gap-2 px-4 py-1.5 text-xs font-bold rounded-xl bg-navy text-white hover:opacity-90 transition-opacity shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Input E-Faktur</span>
            </button>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 6 KPI SUMMARY METRICS */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* KPI 1 */}
        <div className="bg-surface-card p-4 rounded-xl border border-border-soft shadow-xs min-w-0">
          <div className="flex items-center justify-between text-navy-soft mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider truncate">
              Nilai Proyek (111%)
            </span>
            <TrendingUp className="w-4 h-4 text-blue-500 shrink-0 ml-1" />
          </div>
          <div className="text-lg font-bold text-navy-text truncate" title={data.kpiSummary.totalNilaiProyekFmt}>
            {data.kpiSummary.totalNilaiProyekFmt}
          </div>
          <p className="text-[11px] text-navy-soft mt-1 truncate">
            Diakui sebagai Pendapatan di Laba Rugi
          </p>
        </div>

        {/* KPI 2 */}
        <div className="bg-surface-card p-4 rounded-xl border border-border-soft shadow-xs min-w-0">
          <div className="flex items-center justify-between text-navy-soft mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider truncate">
              Total DPP
            </span>
            <FileText className="w-4 h-4 text-indigo-500 shrink-0 ml-1" />
          </div>
          <div className="text-lg font-bold text-navy-text truncate" title={data.kpiSummary.totalDppFmt}>
            {data.kpiSummary.totalDppFmt}
          </div>
          <p className="text-[11px] text-navy-soft mt-1 truncate">
            DPP Nilai Lain: {data.totalPeriod.dppNilaiLainFmt}
          </p>
        </div>

        {/* KPI 3 */}
        <div className="bg-surface-card p-4 rounded-xl border border-border-soft shadow-xs min-w-0">
          <div className="flex items-center justify-between text-navy-soft mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider truncate">
              Kewajiban Pajak
            </span>
            <Receipt className="w-4 h-4 text-purple-500 shrink-0 ml-1" />
          </div>
          <div className="text-lg font-bold text-navy-text truncate" title={data.kpiSummary.totalPajakFmt}>
            {data.kpiSummary.totalPajakFmt}
          </div>
          <p className="text-[11px] text-navy-soft mt-1 truncate">
            PPN: {data.totalPeriod.ppnFmt} | PPh: {data.totalPeriod.pphFmt}
          </p>
        </div>

        {/* KPI 4 */}
        <div className="bg-surface-card p-4 rounded-xl border border-border-soft shadow-xs min-w-0">
          <div className="flex items-center justify-between text-navy-soft mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider truncate">
              Laba Stlh Pajak
            </span>
            <Wallet className="w-4 h-4 text-emerald-500 shrink-0 ml-1" />
          </div>
          <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 truncate" title={data.kpiSummary.totalLabaSetelahPajakFmt}>
            {data.kpiSummary.totalLabaSetelahPajakFmt}
          </div>
          <p className="text-[11px] text-navy-soft mt-1 truncate">
            Margin bersih setelah PPN & PPh
          </p>
        </div>

        {/* KPI 5 */}
        <div className="bg-surface-card p-4 rounded-xl border border-border-soft shadow-xs min-w-0">
          <div className="flex items-center justify-between text-navy-soft mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider truncate">
              Total Dana Cair
            </span>
            <Building2 className="w-4 h-4 text-sky-500 shrink-0 ml-1" />
          </div>
          <div className="text-lg font-bold text-navy-text truncate" title={data.kpiSummary.totalNominalDiterimaFmt}>
            {data.kpiSummary.totalNominalDiterimaFmt}
          </div>
          <p className="text-[11px] text-navy-soft mt-1 truncate">
            {data.totalPeriod.jumlahFaktur} faktur tercatat
          </p>
        </div>

        {/* KPI 6 */}
        <div className="bg-surface-card p-4 rounded-xl border border-border-soft shadow-xs min-w-0">
          <div className="flex items-center justify-between text-navy-soft mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider truncate">
              Audit SPT Pajak
            </span>
            <Scale className="w-4 h-4 text-amber-500 shrink-0 ml-1" />
          </div>
          <div className="text-lg font-bold text-navy-text truncate" title={data.kpiSummary.statusAudit === "SEMUA_SESUAI" ? "Match 100%" : `${data.kpiSummary.jumlahBulanSelisih} Bulan Beda`}>
            {data.kpiSummary.statusAudit === "SEMUA_SESUAI" ? (
              <span className="text-emerald-600 dark:text-emerald-400">Match 100%</span>
            ) : (
              <span className="text-rose-600 dark:text-rose-400">{data.kpiSummary.jumlahBulanSelisih} Bulan Beda</span>
            )}
          </div>
          <p className="text-[11px] text-navy-soft mt-1 truncate">
            Selisih Pajak: {data.kpiSummary.totalSelisihPajakFmt}
          </p>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 3 LAYER TABS NAVIGATION */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="flex border-b border-border-soft bg-surface-card rounded-t-2xl px-4 pt-2">
        <button
          onClick={() => setActiveTab("faktur")}
          className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "faktur"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-navy-soft hover:text-navy-text"
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Lapis 1: Daftar E-Faktur & Total Periode</span>
          <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300">
            {filteredFaktur.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("rekap-bulanan")}
          className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "rekap-bulanan"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-navy-soft hover:text-navy-text"
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Lapis 2: Rekap Bulanan (Jan - Des)</span>
        </button>

        <button
          onClick={() => setActiveTab("rekonsiliasi")}
          className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "rekonsiliasi"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-navy-soft hover:text-navy-text"
          }`}
        >
          <Scale className="w-4 h-4" />
          <span>Lapis 3: Rekonsiliasi Audit Pajak (Faktur vs SPT)</span>
          {data.kpiSummary.jumlahBulanSelisih > 0 && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-bold">
              {data.kpiSummary.jumlahBulanSelisih}
            </span>
          )}
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: LAPIS 1 - DAFTAR E-FAKTUR & TOTAL PERIODE */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === "faktur" && (
        <div className="bg-surface-card rounded-b-2xl border border-border-soft p-5 shadow-xs space-y-4">
          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-3 text-navy-soft" />
              <input
                type="text"
                placeholder="Cari no. faktur, rekanan, JKP, bank..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-surface-card border border-border-soft rounded-xl text-navy-text focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-3 text-navy-soft hover:text-navy-text"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs text-navy-soft font-medium">Jenis:</span>
              <select
                value={filterJenisProyek}
                onChange={(e) => setFilterJenisProyek(e.target.value)}
                className="px-3 py-2 text-sm bg-surface-card border border-border-soft rounded-xl text-navy-text focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              >
                <option value="ALL">Semua Jenis Proyek</option>
                <option value="1">Perencanaan</option>
                <option value="2">Pengawasan</option>
              </select>
            </div>
          </div>

          {/* Data Table */}
          <div className="overflow-x-auto rounded-xl border border-border-soft">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-surface-subtle text-navy-text border-b border-border-soft font-semibold">
                <tr>
                  <th className="p-3 text-center w-10">No</th>
                  <th className="p-3">No. Faktur / NPWP</th>
                  <th className="p-3">Rekanan & Uraian JKP</th>
                  <th className="p-3 text-blue-700 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-500/10">Proyek Terkait</th>
                  <th className="p-3 text-center">Masa</th>
                  <th className="p-3 text-right">DPP</th>
                  <th className="p-3 text-right">DPP Nilai Lain</th>
                  <th className="p-3 text-right">PPN Realisasi</th>
                  <th className="p-3 text-right">PPh Realisasi</th>
                  <th className="p-3 text-right font-bold text-blue-700 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-500/10">
                    Nilai Kuitansi Bruto (111%)
                  </th>
                  <th className="p-3 text-right text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-500/10">
                    Netto Tagihan
                  </th>
                  <th className="p-3 text-right">Dana Cair Bank</th>
                  <th className="p-3 text-center">Balance Control</th>
                  <th className="p-3">Tgl & Rekening Bank</th>
                  <th className="p-3 text-center">Ceklis Fisik</th>
                  <th className="p-3 text-center">Jenis</th>
                  {canEdit && <th className="p-3 text-center w-20">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-soft text-navy-text">
                {filteredFaktur.length === 0 ? (
                  <tr>
                    <td
                      colSpan={canEdit ? 17 : 16}
                      className="p-8 text-center text-navy-soft"
                    >
                      <Receipt className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                      Tidak ada data e-faktur untuk periode ini.
                    </td>
                  </tr>
                ) : (
                  filteredFaktur.map((f, idx) => (
                    <tr
                      key={f.id}
                      className="hover:bg-surface-hover/50 transition-colors"
                    >
                      <td className="p-3 text-center text-navy-soft">{idx + 1}</td>
                      <td className="p-3">
                        <div className="font-bold text-navy-text flex items-center gap-1.5">
                          <Receipt size={13} className="text-blue-600 shrink-0" />
                          <span>{f.noFaktur}</span>
                        </div>
                        <div className="text-[11px] text-navy-soft font-mono mt-0.5">
                          NPWP: {f.npwp}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="font-medium text-navy-text max-w-xs truncate" title={f.namaRekanan}>
                          {f.namaRekanan}
                        </div>
                        <div className="text-[11px] text-navy-soft max-w-xs truncate" title={f.namaJkp}>
                          {f.namaJkp}
                        </div>
                      </td>
                      <td className="p-3">
                        {f.projectCode ? (
                          <div>
                            <span className="px-2 py-0.5 text-xs font-mono font-bold rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60">
                              {f.projectCode}
                            </span>
                            {f.projectName && (
                              <div
                                className="text-[10px] text-navy-soft max-w-[130px] truncate mt-0.5"
                                title={f.projectName}
                              >
                                {f.projectName}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 font-mono text-xs">-</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <span className="px-2 py-1 text-[11px] font-medium rounded-full bg-surface-hover text-muted-stronger">
                          {f.namaBulan}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono">{f.dppFmt}</td>
                      <td className="p-3 text-right font-mono text-navy-soft">
                        {f.dppNilaiLainFmt}
                      </td>
                      <td className="p-3 text-right font-mono text-purple-700 dark:text-purple-400" title={`Tarif PPN: ${f.tarifPpnPersen}%`}>
                        {f.ppnRealisasiFmt}
                        {f.isRealized && f.tarifPpnPersen !== 12 && (
                          <span className="ml-1 text-[10px] text-navy-soft font-sans">({f.tarifPpnPersen}%)</span>
                        )}
                      </td>
                      <td className="p-3 text-right font-mono text-amber-700 dark:text-amber-400" title={`Tarif PPh: ${f.tarifPphPersen}%`}>
                        {f.pphRealisasiFmt}
                        {f.isRealized && f.tarifPphPersen !== 3.5 && (
                          <span className="ml-1 text-[10px] text-navy-soft font-sans">({f.tarifPphPersen}%)</span>
                        )}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-blue-700 dark:text-blue-400 bg-blue-50/30 dark:bg-blue-500/10">
                        {f.nilaiProyekFmt}
                      </td>
                      <td className="p-3 text-right font-mono font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50/30 dark:bg-emerald-500/10">
                        {f.labaSetelahPajakFmt}
                      </td>
                      <td className="p-3 text-right font-mono font-medium">
                        {f.isRealized ? (
                          <span className="text-emerald-700 dark:text-emerald-400 font-semibold">{f.nominalDiterimaFmt}</span>
                        ) : (
                          <span className="text-muted-faint text-[11px] italic">Belum Cair</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {f.balanceStatus === "BALANCE" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 dark:bg-green-950/50 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800/60">
                            <CheckCircle2 size={10} /> Balance
                          </span>
                        ) : f.balanceStatus === "SELISIH" ? (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60"
                            title={`Selisih dengan net tagihan: ${f.selisihBankFmt}`}
                          >
                            <AlertTriangle size={10} /> Selisih: {f.selisihBankFmt}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-surface-subtle text-muted-faint border border-border">
                            Belum Cair
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        {f.tanggalTerima ? (
                          <>
                            <div className="font-mono text-xs">{f.tanggalTerima}</div>
                            <div className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                              {f.bank || "-"}
                            </div>
                          </>
                        ) : (
                          <span className="text-muted-faint text-[11px] italic">Belum Diterima</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleToggleCeklis(f.id, "ppn", f.ceklisPpn)}
                            disabled={!canEdit || isPending}
                            title={f.ceklisPpn ? "Fisik PPN: Diterima (Klik untuk ubah)" : "Fisik PPN: Belum Diterima (Klik untuk ceklis)"}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                              f.ceklisPpn
                                ? "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-800/60"
                                : "bg-surface-subtle text-muted-faint border-border hover:bg-surface-hover"
                            }`}
                          >
                            PPN {f.ceklisPpn ? "✓" : "○"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleCeklis(f.id, "pph", f.ceklisPph)}
                            disabled={!canEdit || isPending}
                            title={f.ceklisPph ? "Fisik PPh: Diterima (Klik untuk ubah)" : "Fisik PPh: Belum Diterima (Klik untuk ceklis)"}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                              f.ceklisPph
                                ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800/60"
                                : "bg-surface-subtle text-muted-faint border-border hover:bg-surface-hover"
                            }`}
                          >
                            PPh {f.ceklisPph ? "✓" : "○"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleCeklis(f.id, "buktiPotong", f.ceklisBuktiPotong)}
                            disabled={!canEdit || isPending}
                            title={f.ceklisBuktiPotong ? "Bukti Potong: Diterima (Klik untuk ubah)" : "Bukti Potong: Belum Diterima (Klik untuk ceklis)"}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                              f.ceklisBuktiPotong
                                ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800/60"
                                : "bg-surface-subtle text-muted-faint border-border hover:bg-surface-hover"
                            }`}
                          >
                            Bupot {f.ceklisBuktiPotong ? "✓" : "○"}
                          </button>
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                            f.kodeJenisProyek === 2
                              ? "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60"
                              : "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60"
                          }`}
                        >
                          {f.jenisProyekLabel}
                        </span>
                        {f.pekerjaanYangDipinjam > 0 && (
                          <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
                            Dipinjam: {f.pekerjaanYangDipinjamFmt}
                          </div>
                        )}
                      </td>
                      {canEdit && (
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => openEditFakturModal(f)}
                              title="Edit Faktur"
                              className="p-1.5 text-navy-soft hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                setDeletingFaktur(f);
                                setIsDeleteModalOpen(true);
                              }}
                              title="Hapus Faktur"
                              className="p-1.5 text-navy-soft hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
              {/* Footer Total */}
              <tfoot className="bg-surface-subtle font-bold text-navy-text border-t-2 border-border-soft">
                <tr>
                  <td colSpan={5} className="p-3 text-center uppercase tracking-wider">
                    Total Periode ({data.totalPeriod.jumlahFaktur} Faktur)
                  </td>
                  <td className="p-3 text-right font-mono">
                    {data.totalPeriod.dppFmt}
                  </td>
                  <td className="p-3 text-right font-mono text-navy-soft">
                    {data.totalPeriod.dppNilaiLainFmt}
                  </td>
                  <td className="p-3 text-right font-mono text-purple-700 dark:text-purple-400">
                    {data.totalPeriod.ppnRealisasiFmt}
                  </td>
                  <td className="p-3 text-right font-mono text-amber-700 dark:text-amber-400">
                    {data.totalPeriod.pphRealisasiFmt}
                  </td>
                  <td className="p-3 text-right font-mono text-blue-700 dark:text-blue-400 bg-blue-100/50 dark:bg-blue-500/15">
                    {data.totalPeriod.nilaiProyekFmt}
                  </td>
                  <td className="p-3 text-right font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-100/50 dark:bg-emerald-500/15">
                    {data.totalPeriod.labaSetelahPajakFmt}
                  </td>
                  <td className="p-3 text-right font-mono">
                    {data.totalPeriod.nominalDiterimaFmt}
                  </td>
                  <td colSpan={canEdit ? 5 : 4}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: LAPIS 2 - REKAP BULANAN */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === "rekap-bulanan" && (
        <div className="bg-surface-card rounded-b-2xl border border-border-soft p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-navy-text">
                Rekapitulasi Pendapatan Dinamis Bulanan (Tahun {data.year})
              </h2>
              <p className="text-xs text-navy-soft">
                Agregasi otomatis berdasarkan Masa Pajak (Januari - Desember)
              </p>
            </div>
            <a
              href={exportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800/60 transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Ekspor Rekap</span>
            </a>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border-soft">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-surface-subtle text-navy-text border-b border-border-soft font-semibold">
                <tr>
                  <th className="p-3 text-center w-12">Bulan</th>
                  <th className="p-3">Nama Bulan</th>
                  <th className="p-3 text-center">Jml Faktur</th>
                  <th className="p-3 text-right">Total DPP</th>
                  <th className="p-3 text-right">Total DPP Nilai Lain</th>
                  <th className="p-3 text-right">Total PPN (12%)</th>
                  <th className="p-3 text-right">Total PPh (3.5%)</th>
                  <th className="p-3 text-right font-bold text-blue-700 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-500/10">
                    Nilai Proyek (111%)
                  </th>
                  <th className="p-3 text-right text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-500/10">
                    Laba Stlh Pajak
                  </th>
                  <th className="p-3 text-right">Total Cair</th>
                  <th className="p-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-soft text-navy-text">
                {data.rekapBulanan.map((b) => (
                  <tr
                    key={b.month}
                    className="hover:bg-surface-hover/50 transition-colors"
                  >
                    <td className="p-3 text-center font-mono font-bold text-navy-soft">
                      {String(b.month).padStart(2, "0")}
                    </td>
                    <td className="p-3 font-semibold text-navy-text">
                      {b.namaBulan}
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                          b.jumlahFaktur > 0
                            ? "bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30"
                            : "bg-surface-hover text-muted-faint"
                        }`}
                      >
                        {b.jumlahFaktur} faktur
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono">{b.dppFmt}</td>
                    <td className="p-3 text-right font-mono text-navy-soft">
                      {b.dppNilaiLainFmt}
                    </td>
                    <td className="p-3 text-right font-mono text-purple-700 dark:text-purple-400">
                      {b.ppnFmt}
                    </td>
                    <td className="p-3 text-right font-mono text-amber-700 dark:text-amber-400">
                      {b.pphFmt}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-blue-700 dark:text-blue-400 bg-blue-50/30 dark:bg-blue-500/10">
                      {b.nilaiProyekFmt}
                    </td>
                    <td className="p-3 text-right font-mono font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50/30 dark:bg-emerald-500/10">
                      {b.labaSetelahPajakFmt}
                    </td>
                    <td className="p-3 text-right font-mono">
                      {b.nominalDiterimaFmt}
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => {
                          handleFilterChange(undefined, undefined, b.month);
                          setActiveTab("faktur");
                        }}
                        className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
                      >
                        <span>Lihat Faktur</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-surface-subtle font-bold text-navy-text border-t-2 border-border-soft">
                <tr>
                  <td colSpan={2} className="p-3 text-center uppercase tracking-wider">
                    Total Setahun
                  </td>
                  <td className="p-3 text-center font-mono">
                    {data.totalTahunanRekap.jumlahFaktur} faktur
                  </td>
                  <td className="p-3 text-right font-mono">
                    {data.totalTahunanRekap.dppFmt}
                  </td>
                  <td className="p-3 text-right font-mono text-navy-soft">
                    {data.totalTahunanRekap.dppNilaiLainFmt}
                  </td>
                  <td className="p-3 text-right font-mono text-purple-700 dark:text-purple-400">
                    {data.totalTahunanRekap.ppnFmt}
                  </td>
                  <td className="p-3 text-right font-mono text-amber-700 dark:text-amber-400">
                    {data.totalTahunanRekap.pphFmt}
                  </td>
                  <td className="p-3 text-right font-mono text-blue-700 dark:text-blue-400 bg-blue-100/50 dark:bg-blue-500/15">
                    {data.totalTahunanRekap.nilaiProyekFmt}
                  </td>
                  <td className="p-3 text-right font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-100/50 dark:bg-emerald-500/15">
                    {data.totalTahunanRekap.labaSetelahPajakFmt}
                  </td>
                  <td className="p-3 text-right font-mono">
                    {data.totalTahunanRekap.nominalDiterimaFmt}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 3: LAPIS 3 - REKONSILIASI AUDIT PAJAK (FAKTUR VS SPT) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === "rekonsiliasi" && (
        <div className="bg-surface-card rounded-b-2xl border border-border-soft p-5 shadow-xs space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 p-4 rounded-xl bg-surface-subtle border border-border-soft">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-navy-text">
                  Audit Kepatuhan & Rekonsiliasi Faktur vs SPT Pajak Resmi
                </h3>
                <p className="text-xs text-navy-soft mt-0.5 max-w-2xl leading-relaxed">
                  Membandingkan DPP, PPN, dan PPh hasil rekap faktur sistem dengan angka yang dilaporkan resmi ke kantor pajak (SPT Masa).
                  Baris bertanda merah mengindikasikan adanya selisih pada PPN atau PPh yang perlu disesuaikan.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap self-start lg:self-center">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 whitespace-nowrap shadow-2xs">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>Selisih Rp 0 = Sesuai</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 whitespace-nowrap shadow-2xs">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-600 dark:text-rose-400" />
                <span>Selisih ≠ 0 = Alert</span>
              </span>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border-soft">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-surface-subtle text-navy-text border-b border-border-soft font-semibold">
                <tr>
                  <th className="p-3 text-center w-10">Bulan</th>
                  <th className="p-3">Nama Masa</th>
                  <th className="p-3 text-right">DPP Rekap Faktur</th>
                  <th className="p-3 text-right bg-blue-50/50 dark:bg-blue-500/10">DPP Terlapor (SPT)</th>
                  <th className="p-3 text-right">Selisih DPP</th>
                  <th className="p-3 text-right">PPN Rekap Faktur</th>
                  <th className="p-3 text-right bg-blue-50/50 dark:bg-blue-500/10">PPN Terlapor (SPT)</th>
                  <th className="p-3 text-right">Selisih PPN</th>
                  <th className="p-3 text-right">PPh Rekap Faktur</th>
                  <th className="p-3 text-right bg-blue-50/50 dark:bg-blue-500/10">PPh Terlapor (SPT)</th>
                  <th className="p-3 text-right">Selisih PPh</th>
                  <th className="p-3 text-right">Total Pajak Rekap</th>
                  <th className="p-3 text-right bg-blue-50/50 dark:bg-blue-500/10">Total Pajak SPT</th>
                  <th className="p-3 text-right">Selisih Total Pajak</th>
                  <th className="p-3 text-center">Status Audit</th>
                  <th className="p-3">Catatan / Tindak Lanjut</th>
                  {canEdit && <th className="p-3 text-center w-16">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-soft text-navy-text">
                {data.rekonsiliasiList.map((rec) => {
                  const isMatch = rec.status === "MATCH";
                  const isUnreported = rec.status === "BELUM_DILAPORKAN";
                  const rowAlertBg = isMatch
                    ? ""
                    : isUnreported
                    ? "bg-amber-50/30 dark:bg-amber-500/10"
                    : "bg-rose-50/40 dark:bg-rose-500/10";

                  return (
                    <tr
                      key={rec.month}
                      className={`hover:bg-surface-hover/50 transition-colors ${rowAlertBg}`}
                    >
                      <td className="p-3 text-center font-mono font-bold text-navy-soft">
                        {String(rec.month).padStart(2, "0")}
                      </td>
                      <td className="p-3 font-semibold text-navy-text">
                        {rec.namaBulan}
                      </td>
                      <td className="p-3 text-right font-mono">
                        {rec.dppRekapFmt}
                      </td>
                      <td className="p-3 text-right font-mono font-semibold bg-blue-50/30 dark:bg-blue-500/10 text-blue-800 dark:text-blue-300">
                        {rec.dppTerlaporFmt}
                      </td>
                      <td className="p-3 text-right font-mono">
                        <span
                          className={`font-semibold ${
                            Math.abs(rec.selisihDpp) > 0.01
                              ? "text-rose-600 dark:text-rose-400"
                              : "text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {rec.selisihDppFmt}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono text-purple-700 dark:text-purple-400">
                        {rec.ppnRekapFmt}
                      </td>
                      <td className="p-3 text-right font-mono font-semibold bg-blue-50/30 dark:bg-blue-500/10 text-blue-800 dark:text-blue-300">
                        {rec.pajakTerlaporFmt}
                      </td>
                      <td className="p-3 text-right font-mono">
                        <span
                          className={`font-semibold ${
                            Math.abs(rec.selisihPajak) > 0.01
                              ? "text-rose-600 dark:text-rose-400"
                              : "text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {rec.selisihPajakFmt}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono text-amber-700 dark:text-amber-400">
                        {rec.pphRekapFmt}
                      </td>
                      <td className="p-3 text-right font-mono font-semibold bg-blue-50/30 dark:bg-blue-500/10 text-blue-800 dark:text-blue-300">
                        {rec.pphTerlaporFmt}
                      </td>
                      <td className="p-3 text-right font-mono">
                        <span
                          className={`font-semibold ${
                            Math.abs(rec.selisihPph) > 0.01
                              ? "text-rose-600 dark:text-rose-400"
                              : "text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {rec.selisihPphFmt}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono font-medium">
                        {rec.totalPajakRekapFmt}
                      </td>
                      <td className="p-3 text-right font-mono font-semibold bg-blue-50/30 dark:bg-blue-500/10 text-blue-800 dark:text-blue-300">
                        {rec.totalPajakTerlaporFmt}
                      </td>
                      <td className="p-3 text-right font-mono">
                        <span
                          className={`font-semibold ${
                            Math.abs(rec.selisihTotalPajak) > 0.01
                              ? "text-rose-600 dark:text-rose-400"
                              : "text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {rec.selisihTotalPajakFmt}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        {isMatch ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            SESUAI
                          </span>
                        ) : isUnreported ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800/60">
                            <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                            BELUM LAPOR
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-rose-100 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800/60">
                            <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                            SELISIH
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-xs text-navy-soft max-w-xs truncate">
                        {rec.keterangan || "-"}
                      </td>
                      {canEdit && (
                        <td className="p-3 text-center">
                          <button
                            onClick={() => openReconModal(rec)}
                            title="Edit Angka Terlapor SPT"
                            className="p-1.5 text-navy-soft hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-surface-subtle font-bold text-navy-text border-t-2 border-border-soft">
                <tr>
                  <td colSpan={2} className="p-3 text-center uppercase tracking-wider">
                    Total Setahun
                  </td>
                  <td className="p-3 text-right font-mono">
                    {formatRupiah(rekonTotals.dppRekap)}
                  </td>
                  <td className="p-3 text-right font-mono bg-blue-100/50 dark:bg-blue-500/15 text-blue-900 dark:text-blue-200">
                    {formatRupiah(rekonTotals.dppTerlapor)}
                  </td>
                  <td className="p-3 text-right font-mono">
                    <span
                      className={
                        Math.abs(rekonTotals.selisihDpp) > 0.01
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-emerald-600 dark:text-emerald-400"
                      }
                    >
                      {formatRupiah(rekonTotals.selisihDpp)}
                    </span>
                  </td>
                  <td className="p-3 text-right font-mono text-purple-700 dark:text-purple-400">
                    {formatRupiah(rekonTotals.ppnRekap)}
                  </td>
                  <td className="p-3 text-right font-mono bg-blue-100/50 dark:bg-blue-500/15 text-blue-900 dark:text-blue-200">
                    {formatRupiah(rekonTotals.pajakTerlapor)}
                  </td>
                  <td className="p-3 text-right font-mono">
                    <span
                      className={
                        Math.abs(rekonTotals.selisihPajak) > 0.01
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-emerald-600 dark:text-emerald-400"
                      }
                    >
                      {formatRupiah(rekonTotals.selisihPajak)}
                    </span>
                  </td>
                  <td className="p-3 text-right font-mono text-amber-700 dark:text-amber-400">
                    {formatRupiah(rekonTotals.pphRekap)}
                  </td>
                  <td className="p-3 text-right font-mono bg-blue-100/50 dark:bg-blue-500/15 text-blue-900 dark:text-blue-200">
                    {formatRupiah(rekonTotals.pphTerlapor)}
                  </td>
                  <td className="p-3 text-right font-mono">
                    <span
                      className={
                        Math.abs(rekonTotals.selisihPph) > 0.01
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-emerald-600 dark:text-emerald-400"
                      }
                    >
                      {formatRupiah(rekonTotals.selisihPph)}
                    </span>
                  </td>
                  <td className="p-3 text-right font-mono">
                    {formatRupiah(rekonTotals.totalPajakRekap)}
                  </td>
                  <td className="p-3 text-right font-mono bg-blue-100/50 dark:bg-blue-500/15 text-blue-900 dark:text-blue-200">
                    {formatRupiah(rekonTotals.totalPajakTerlapor)}
                  </td>
                  <td className="p-3 text-right font-mono">
                    <span
                      className={
                        Math.abs(rekonTotals.selisihTotalPajak) > 0.01
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-emerald-600 dark:text-emerald-400"
                      }
                    >
                      {formatRupiah(rekonTotals.selisihTotalPajak)}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    {data.kpiSummary.statusAudit === "SEMUA_SESUAI" ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                        SEMUA SESUAI
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-rose-100 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60">
                        {data.kpiSummary.jumlahBulanSelisih} BULAN BEDA
                      </span>
                    )}
                  </td>
                  <td></td>
                  {canEdit && <td></td>}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL: INPUT / EDIT FAKTUR PENDAPATAN */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {mounted && isFakturModalOpen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-surface-card rounded-2xl border border-border-soft shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header (Fixed at top) */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-soft bg-surface-subtle/50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-navy/10 dark:bg-navy/30 text-navy-text dark:text-white">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-navy-text">
                    {editingFaktur ? "Edit E-Faktur Pendapatan" : "Input E-Faktur Baru"}
                  </h3>
                  <p className="text-xs text-navy-soft">
                    {data.entity.legalName} • Tahun {formFaktur.tahunPajak}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFakturModalOpen(false)}
                className="p-1.5 text-navy-soft hover:text-navy-text hover:bg-surface-hover rounded-lg transition-colors cursor-pointer"
                aria-label="Tutup Modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveFaktur} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-6 space-y-5 overflow-y-auto flex-1">
              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 text-xs font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Form Section 1: Kode Proyek dari Sidamon */}
              <div className="p-4 rounded-xl bg-blue-50/60 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-navy-text flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-blue-600" />
                    Pilih Kode Proyek (Master Proyek Sidamon)
                  </label>
                  {formFaktur.projectId && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTerminId("");
                        setShowManualDppFallback(false);
                        setNoFakturMode("new");
                        setFormFaktur((prev) => ({
                          ...prev,
                          projectId: "",
                          dpp: 0,
                          dppNilaiLain: 0,
                          nominalDiterima: 0,
                        }));
                      }}
                      className="text-[11px] font-semibold text-rose-600 hover:text-rose-800 cursor-pointer"
                    >
                      Batal Pilih Proyek
                    </button>
                  )}
                </div>
                <select
                  value={formFaktur.projectId}
                  onChange={(e) => {
                    const selectedProjId = e.target.value;
                    const p = data.projectOptions.find((x) => x.id === selectedProjId);
                    setSelectedTerminId("");
                    setShowManualDppFallback(false);
                    if (p?.existingFakturs && p.existingFakturs.length > 0) {
                      setNoFakturMode("existing");
                    } else {
                      setNoFakturMode("new");
                    }
                    setFormFaktur((prev) => ({
                      ...prev,
                      projectId: selectedProjId,
                      namaRekanan: prev.namaRekanan,
                      namaJkp: p ? p.name : prev.namaJkp,
                    }));
                  }}
                  className="w-full px-3 py-2 text-xs border border-blue-300 dark:border-blue-500/40 rounded-xl bg-surface-input text-navy-text focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium cursor-pointer"
                >
                  <option value="">-- Pilih Kode Proyek yang Sesuai --</option>
                  {(() => {
                    const curProjs = data.projectOptions.filter((p) => !p.entityId || p.entityId === data.entity.id);
                    const otherProjs = data.projectOptions.filter((p) => p.entityId && p.entityId !== data.entity.id);
                    const otherByEntity = otherProjs.reduce((acc, p) => {
                      const key = p.entityName || p.entityKey || "Entitas Lain";
                      if (!acc[key]) acc[key] = [];
                      acc[key].push(p);
                      return acc;
                    }, {} as Record<string, typeof otherProjs>);

                    return (
                      <>
                        {curProjs.length > 0 && (
                          <optgroup label={`Proyek ${data.entity.name} (Entitas Ini)`}>
                            {curProjs.map((p) => (
                              <option key={p.id} value={p.id}>
                                [{p.code}] {p.name} {p.contractValueFmt ? `• Nilai Kontrak: ${p.contractValueFmt}` : ""}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {Object.entries(otherByEntity).map(([entName, projs]) => (
                          <optgroup key={entName} label={`Proyek ${entName} (Lintas Entitas)`}>
                            {projs.map((p) => (
                              <option key={p.id} value={p.id}>
                                [{p.code}] {p.name} {p.contractValueFmt ? `• Nilai Kontrak: ${p.contractValueFmt}` : ""}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </>
                    );
                  })()}
                </select>
                {formFaktur.projectId ? (
                  (() => {
                    const sel = data.projectOptions.find((x) => x.id === formFaktur.projectId);
                    return sel ? (
                      <div className="space-y-2.5 pt-1">
                        <div className="text-[11px] text-blue-800 dark:text-blue-300 bg-surface-input p-2.5 rounded-lg border border-blue-100 dark:border-blue-500/20 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
                          <span>
                            Kode Proyek: <strong className="font-mono">{sel.code}</strong> • {sel.name}
                          </span>
                          <span className="font-semibold text-navy-text">
                            Nilai Kontrak: {sel.contractValueFmt}
                          </span>
                        </div>

                        {/* Dropdown Termin untuk Sinkronisasi DPP */}
                        {sel.termins && sel.termins.length > 0 ? (
                          <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-500/10 border border-emerald-200/90 dark:border-emerald-500/20 space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Pilih Termin Proyek (Sumber Otomatis Nilai DPP)</span>
                              </label>
                              <span className="text-[10px] bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-400 px-2 py-0.5 rounded-full font-semibold">
                                {sel.termins.length} Termin Terdaftar
                              </span>
                            </div>
                            <select
                              value={selectedTerminId}
                              onChange={(e) => handleSelectTermin(e.target.value)}
                              className="w-full px-3 py-2 text-xs border border-emerald-300 dark:border-emerald-500/40 rounded-lg bg-surface-input text-navy-text focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold cursor-pointer"
                            >
                              <option value="">-- Pilih Termin yang Ditagihkan --</option>
                              {sel.termins.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.name} ({t.percentage}% Kontrak) — {t.nominalFmt}
                                </option>
                              ))}
                              <option value="manual">Input Nilai DPP Manual (Tanpa Termin)</option>
                            </select>
                            {selectedTermin ? (
                              <div className="text-[11px] text-emerald-900 dark:text-emerald-300 bg-surface-input p-2 rounded-lg border border-emerald-100 dark:border-emerald-500/20 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
                                <span className="inline-flex items-center gap-1.5">
                                  <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                  <span>
                                    Nilai Termin: <strong className="font-mono">{selectedTermin.nominalFmt}</strong> ({selectedTermin.percentage}% dari nilai kontrak)
                                  </span>
                                </span>
                                <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/15 px-1.5 py-0.5 rounded">
                                  DPP otomatis tersinkron
                                </span>
                              </div>
                            ) : (
                              <p className="text-[11px] text-emerald-800 dark:text-emerald-300">
                                Pilih termin yang sedang ditagihkan agar nilai DPP & DPP Nilai Lain langsung terisi otomatis sesuai termin di Finance.
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="p-3 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
                            <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold">Belum ada termin pembayaran tercatat di Finance untuk proyek ini.</span>
                              <p className="text-amber-700 dark:text-amber-400 text-[11px] mt-0.5">
                                Proyek telah didaftarkan Sidamon. Anda dapat menginput nilai DPP secara manual pada bagian perhitungan pajak di bawah.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : null;
                  })()
                ) : (
                  <p className="text-[11px] text-navy-soft">
                    Pilih proyek dari daftar proyek yang sudah diinput oleh Admin Sidamon untuk entitas ini.
                  </p>
                )}
              </div>

              {/* Form Grid 1: Basic Faktur Details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-navy-text">
                      Nomor E-Faktur <span className="text-rose-500">*</span>
                    </label>
                    {distinctProjectFakturs.length > 0 && !editingFaktur && (
                      <button
                        type="button"
                        onClick={() => {
                          const nextMode = noFakturMode === "existing" ? "new" : "existing";
                          setNoFakturMode(nextMode);
                          if (nextMode === "new") {
                            setFormFaktur((prev) => ({ ...prev, noFaktur: "" }));
                            setAmrahanDetected(null);
                          }
                        }}
                        className="text-[10.5px] text-blue-600 dark:text-blue-400 font-semibold hover:underline cursor-pointer"
                      >
                        {noFakturMode === "existing" ? "Ketik Baru" : "Pilih dari Proyek"}
                      </button>
                    )}
                  </div>

                  {distinctProjectFakturs.length > 0 && noFakturMode === "existing" && !editingFaktur ? (
                    <select
                      value={formFaktur.noFaktur}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!val || val === "__NEW__") {
                          setNoFakturMode("new");
                          setFormFaktur((prev) => ({ ...prev, noFaktur: "" }));
                          setAmrahanDetected(null);
                        } else {
                          handleSelectExistingProjectFaktur(val);
                        }
                      }}
                      className="w-full px-3 py-2 text-xs font-mono font-medium border border-border-soft rounded-xl bg-surface-input text-navy-text focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                      <option value="">-- Pilih Nomor Faktur --</option>
                      {distinctProjectFakturs.map((df) => (
                        <option key={df.noFaktur} value={df.noFaktur}>
                          {df.noFaktur} — {df.latest.namaJkp} (Amrahan ke-{df.count + 1})
                        </option>
                      ))}
                      <option value="__NEW__">+ Ketik Nomor Baru Manual...</option>
                    </select>
                  ) : (
                    <input
                      type="text"
                      required
                      placeholder="010.000-24.00000001"
                      value={formFaktur.noFaktur}
                      onChange={(e) => handleNoFakturChange(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono border border-border-soft rounded-xl bg-surface-input text-navy-text focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                  {selectedProject && (
                    <span className="text-[10px] text-navy-soft mt-1 block">
                      {amrahanDetected
                        ? `Nomor faktur amrahan untuk proyek ${selectedProject.code}.`
                        : `Akan tersimpan ke proyek ${selectedProject.code}.`}
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-navy-text mb-1">
                    Masa Pajak <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formFaktur.masaPajak}
                    onChange={(e) =>
                      setFormFaktur({
                        ...formFaktur,
                        masaPajak: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 text-xs border border-border-soft rounded-xl bg-surface-input text-navy-text focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium cursor-pointer"
                  >
                    {NAMA_BULAN.map((m, idx) => (
                      <option key={idx + 1} value={idx + 1} className="bg-surface-card text-navy-text">
                        Bulan {idx + 1} - {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-navy-text mb-1">
                    Uraian JKP / Pekerjaan <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Perencanaan Gedung Rawat Inap"
                    value={formFaktur.namaJkp}
                    onChange={(e) =>
                      setFormFaktur({ ...formFaktur, namaJkp: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs border border-border-soft rounded-xl bg-surface-input text-navy-text focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Notifikasi Amrahan / Multi-Termin Berulang */}
              {amrahanDetected && !editingFaktur && (
                <div className="p-3.5 rounded-xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 text-xs text-amber-950 dark:text-amber-200 flex items-start gap-3">
                  <div className="p-1.5 rounded-lg bg-amber-200/80 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-amber-900 dark:text-amber-200">
                        Multi-Termin / Amrahan Terdeteksi ({amrahanDetected.noFaktur})
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200/70 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300">
                        Nomor Faktur Sama Diizinkan
                      </span>
                    </div>
                    <p className="text-[11.5px] text-amber-800 dark:text-amber-300 leading-relaxed">
                      Sistem otomatis memanggil rincian proyek, rekanan, dan nominal lama. Seluruh uraian dan nominal tetap dapat diedit bebas (misal merubah kata &quot;Uang Muka&quot; menjadi &quot;Tagihan Amrahan Ke-2&quot;).
                    </p>
                  </div>
                </div>
              )}

              {/* Form Section: Data Rekanan & NPWP */}
              <div className="p-4 rounded-2xl bg-surface-subtle/70 border border-border-soft space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-brand" />
                    <span className="text-xs font-bold text-navy-text uppercase tracking-wide">
                      Identitas Rekanan / Klien
                    </span>
                  </div>
                  {selectedRekananId && selectedRekananId !== "__MANUAL__" && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRekananId("__MANUAL__");
                        setMatchedRekananMaster(null);
                      }}
                      className="text-[11px] font-semibold text-brand hover:underline cursor-pointer"
                    >
                      + Input Rekanan Baru
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  {/* Dropdown Master Rekanan */}
                  <div>
                    <label className="block text-xs font-semibold text-navy-text mb-1">
                      Pilih Master Rekanan
                    </label>
                    <select
                      value={selectedRekananId}
                      onChange={(e) => handleSelectRekananFromDropdown(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-border-soft rounded-xl bg-surface-card text-navy-text focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium cursor-pointer"
                    >
                      <option value="">-- Pilih dari Master Rekanan --</option>
                      {data.rekananOptions && data.rekananOptions.length > 0 && (
                        <>
                          <optgroup label="🏢 Klien / Pemberi Kerja">
                            {data.rekananOptions
                              .filter((r) => !r.tipe || r.tipe === "KLIEN")
                              .map((r) => (
                                <option key={r.id} value={r.id} className="bg-surface-card text-navy-text">
                                  {r.nama} {r.npwp ? `(${r.npwp})` : "(Tanpa NPWP)"}
                                </option>
                              ))}
                          </optgroup>
                          {data.rekananOptions.some((r) => r.tipe && r.tipe !== "KLIEN") && (
                            <optgroup label="📦 Vendor & Tenaga Ahli">
                              {data.rekananOptions
                                .filter((r) => r.tipe && r.tipe !== "KLIEN")
                                .map((r) => (
                                  <option key={r.id} value={r.id} className="bg-surface-card text-navy-text">
                                    {r.nama} {r.npwp ? `(${r.npwp})` : "(Tanpa NPWP)"} [{r.tipe}]
                                  </option>
                                ))}
                            </optgroup>
                          )}
                        </>
                      )}
                      <optgroup label="Input Manual">
                        <option value="__MANUAL__" className="bg-surface-card font-semibold text-blue-600 dark:text-blue-400">
                          ✏️ Rekanan Baru / Input Manual...
                        </option>
                      </optgroup>
                    </select>
                  </div>

                  {/* Input Nama Rekanan */}
                  <div className="relative">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-navy-text">
                        Nama Rekanan / Klien <span className="text-rose-500">*</span>
                      </label>
                      {isSearchingRekanan && (
                        <span className="text-[10px] text-blue-600 animate-pulse font-medium">
                          Mencari...
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: RSUD dr. Doris Sylvanus"
                      value={formFaktur.namaRekanan}
                      onChange={(e) => handleNamaRekananChange(e.target.value)}
                      onFocus={() => {
                        if (rekananSuggestions.length > 0) setShowRekananDropdown(true);
                      }}
                      className="w-full px-3 py-2 text-xs border border-border-soft rounded-xl bg-surface-card text-navy-text focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />

                    {/* Floating Auto-complete dropdown */}
                    {showRekananDropdown && rekananSuggestions.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-surface-card border border-border-soft rounded-xl shadow-xl max-h-56 overflow-y-auto divide-y divide-border-soft">
                        <div className="p-2 text-[10px] font-bold text-navy-soft uppercase tracking-wider bg-surface-subtle/50 flex items-center justify-between">
                          <span>Saran Rekanan Terdaftar:</span>
                          <button
                            type="button"
                            onClick={() => setShowRekananDropdown(false)}
                            className="text-navy-soft hover:text-navy-text cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                        {rekananSuggestions.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleSelectRekanan(item)}
                            className="w-full p-2.5 text-left hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors flex items-start justify-between gap-2 cursor-pointer"
                          >
                            <div>
                              <div className="text-xs font-bold text-navy-text">{item.nama}</div>
                              {item.npwp && (
                                <div className="text-[10px] font-mono text-navy-soft">NPWP: {item.npwp}</div>
                              )}
                            </div>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-surface-subtle text-navy-soft border border-border-soft uppercase shrink-0">
                              {item.tipe}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Input NPWP Rekanan */}
                  <div>
                    <label className="block text-xs font-semibold text-navy-text mb-1">
                      NPWP Rekanan <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="00.000.000.0-000.000"
                      value={formFaktur.npwp}
                      onChange={(e) => {
                        const val = e.target.value;
                        handleNpwpChange(val);
                      }}
                      className="w-full px-3 py-2 text-xs font-mono border border-border-soft rounded-xl bg-surface-card text-navy-text focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Banner Status Auto-Fill / Auto-Save */}
                {matchedRekananMaster ? (
                  <div className="flex items-center gap-2 text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">
                      Terhubung dengan Master Rekanan: <strong>{matchedRekananMaster.nama}</strong> {matchedRekananMaster.npwp ? `(${matchedRekananMaster.npwp})` : ""}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-[11px] text-blue-700 dark:text-blue-400 bg-blue-50/70 dark:bg-blue-950/30 px-3 py-1.5 rounded-xl border border-blue-200/60 dark:border-blue-800/40">
                    <Sparkles className="w-3.5 h-3.5 shrink-0 text-blue-500" />
                    <span>
                      Rekanan & NPWP baru ini akan <strong>otomatis disimpan</strong> ke Database Master Rekanan saat e-faktur disimpan.
                    </span>
                  </div>
                )}
              </div>

              {/* Form Section 3: Input Nilai Kuitansi Bruto & Kalkulasi Pajak Otomatis */}
              <div className="p-4 sm:p-5 rounded-2xl bg-surface-subtle/50 border border-border-soft space-y-4">
                {/* Header Section */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-border-soft">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                      <Calculator className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-navy-text uppercase tracking-wider">
                        Form E-Faktur Berbasis Nilai Kuitansi Bruto
                      </h4>
                      <p className="text-[11px] text-navy-soft">
                        Input utama adalah Nilai Kuitansi Bruto. Nilai DPP (100/111) dan PPN (11/111) dikalkulasi secara otomatis.
                      </p>
                    </div>
                  </div>
                  {selectedTermin && (
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 self-start sm:self-auto flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      Tersinkron dari Termin: {selectedTermin.name} ({selectedTermin.percentage}%)
                    </span>
                  )}
                </div>

                {/* INPUT UTAMA: Nilai Kuitansi Bruto */}
                <div className="p-4 rounded-xl bg-surface-card border-2 border-blue-500/40 dark:border-blue-500/50 shadow-xs space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <label className="text-xs font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5 uppercase tracking-wide">
                      <Receipt className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      Nilai Kuitansi Bruto (Input Utama) <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[10px] text-navy-soft font-mono">
                      Rumus otomatis: DPP = 100/111 × Kuitansi • PPN = 11/111 × Kuitansi
                    </span>
                  </div>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-sm font-black text-blue-700 dark:text-blue-400">
                      Rp
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      required
                      placeholder="0"
                      value={formatRupiahInput(
                        formFaktur.nilaiKuitansi || (formFaktur.dpp > 0 ? Math.round((formFaktur.dpp * 111) / 100) : 0)
                      )}
                      onChange={(e) => {
                        const kuitansi = Number(e.target.value.replace(/[^0-9]/g, "")) || 0;
                        const dpp = hitungDppDariKwitansi(kuitansi);
                        setFormFaktur((prev) => ({
                          ...prev,
                          nilaiKuitansi: kuitansi,
                          dpp,
                          dppNilaiLain: dpp,
                          pekerjaanPerusahaan: dpp,
                          pekerjaanYangDipinjam: 0,
                        }));
                      }}
                      className="w-full pl-11 pr-4 py-2.5 text-base sm:text-lg font-mono font-black border border-blue-300 dark:border-blue-700 rounded-xl bg-surface-input text-navy-text focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-inner"
                    />
                  </div>
                </div>

                {/* Hasil Kalkulasi Otomatis: DPP & PPN */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Card DPP Dasar */}
                  <div className="p-3.5 rounded-xl bg-surface-card border border-border-soft shadow-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-navy-text uppercase tracking-wider">
                        DPP Dasar (100/111 × Kuitansi)
                      </span>
                      <span className="text-[9.5px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/15 px-1.5 py-0.5 rounded">
                        Otomatis
                      </span>
                    </div>
                    <div className="text-lg font-bold font-mono text-navy-text">
                      {formatRupiah(formFaktur.dpp)}
                    </div>
                    <span className="text-[10px] text-navy-soft block">
                      Dasar pengenaan PPh Final ({formFaktur.tarifPphPersen}%)
                    </span>
                  </div>

                  {/* Card PPN */}
                  <div className="p-3.5 rounded-xl bg-surface-card border border-border-soft shadow-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-navy-text uppercase tracking-wider">
                        PPN (11/111 × Kuitansi)
                      </span>
                      <span className="text-[9.5px] font-semibold text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/15 px-1.5 py-0.5 rounded">
                        Otomatis
                      </span>
                    </div>
                    <div className="text-lg font-bold font-mono text-purple-700 dark:text-purple-300">
                      {formatRupiah(liveCalc.ppn)}
                    </div>
                    <span className="text-[10px] text-navy-soft block">
                      PPN terutang / dipungut rekanan ({formFaktur.tarifPpnPersen}%)
                    </span>
                  </div>
                </div>

                {/* Sub-grid 2: Tarif Pajak */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Tarif PPN */}
                  <div>
                    <label className="block text-xs font-semibold text-navy-text mb-1">
                      Tarif PPN
                    </label>
                    <select
                      value={formFaktur.tarifPpnPersen}
                      onChange={(e) =>
                        setFormFaktur({
                          ...formFaktur,
                          tarifPpnPersen: Number(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 text-xs border border-border-soft rounded-xl text-navy-text bg-surface-input focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium cursor-pointer"
                    >
                      <option value={11}>PPN 11% (Standar Tarif Kuitansi 100/111)</option>
                      <option value={12}>PPN 12%</option>
                      <option value={0}>Bebas PPN (0%)</option>
                    </select>
                    <span className="text-[10px] text-navy-soft mt-1 block">
                      Kalkulasi standar: 11/111 × Kuitansi Bruto
                    </span>
                  </div>

                  {/* Tarif PPh Final */}
                  <div>
                    <label className="block text-xs font-semibold text-navy-text mb-1">
                      Tarif PPh Final Jasa Konstruksi
                    </label>
                    <select
                      value={formFaktur.tarifPphPersen}
                      onChange={(e) =>
                        setFormFaktur({
                          ...formFaktur,
                          tarifPphPersen: Number(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 text-xs border border-border-soft rounded-xl text-navy-text bg-surface-input focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium cursor-pointer"
                    >
                      <option value={3.5}>PPh Final 3.5% (Standar Konsultansi / Pengawasan)</option>
                      <option value={2.65}>PPh Final 2.65% (Kualifikasi Usaha Kecil)</option>
                      <option value={0}>Tanpa Pemotongan PPh (0%)</option>
                    </select>
                    <span className="text-[10px] text-navy-soft mt-1 block">
                      Dipotong rekanan dari DPP ({formFaktur.tarifPphPersen}% × DPP)
                    </span>
                  </div>
                </div>

                {/* Sub-grid 3: Live Automatic Calculation Summary Cards */}
                <div className="pt-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
                    <span className="text-[11px] font-bold text-navy-soft uppercase tracking-wider">
                      Estimasi Tagihan & Potensi Pajak:
                    </span>
                    <div className="inline-flex items-center gap-1.5 text-xs text-amber-800 dark:text-amber-300 bg-amber-50/90 dark:bg-amber-950/40 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-800/60 font-medium">
                      <Info className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span>Di laporan, kolom PPN & PPh otomatis terisi saat transaksi tersimpan di Jurnal Umum</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* Card 1: PPN */}
                    <div className="p-3 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/50 min-w-0 overflow-hidden flex flex-col justify-between">
                      <div className="flex items-center justify-between text-purple-700 dark:text-purple-300 mb-1">
                        <span className="text-[11px] font-semibold truncate">PPN Dipungut</span>
                        <Receipt className="w-3.5 h-3.5 shrink-0 ml-1" />
                      </div>
                      <div
                        className="text-xs sm:text-[13px] md:text-sm font-bold font-mono tracking-tight text-purple-800 dark:text-purple-200 truncate block"
                        title={formatRupiah(liveCalc.ppn)}
                      >
                        {formatRupiah(liveCalc.ppn)}
                      </div>
                      <span className="text-[10px] text-purple-600 dark:text-purple-400 mt-0.5 block truncate">
                        11/111 × Kuitansi
                      </span>
                    </div>

                    {/* Card 2: PPh */}
                    <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 min-w-0 overflow-hidden flex flex-col justify-between">
                      <div className="flex items-center justify-between text-amber-700 dark:text-amber-300 mb-1">
                        <span className="text-[11px] font-semibold truncate">PPh Dipotong</span>
                        <FileText className="w-3.5 h-3.5 shrink-0 ml-1" />
                      </div>
                      <div
                        className="text-xs sm:text-[13px] md:text-sm font-bold font-mono tracking-tight text-amber-800 dark:text-amber-200 truncate block"
                        title={formatRupiah(liveCalc.pph)}
                      >
                        {formatRupiah(liveCalc.pph)}
                      </div>
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5 block truncate">
                        {formFaktur.tarifPphPersen}% × DPP
                      </span>
                    </div>

                    {/* Card 3: Nilai Kuitansi Bruto */}
                    <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 min-w-0 overflow-hidden flex flex-col justify-between">
                      <div className="flex items-center justify-between text-blue-700 dark:text-blue-300 mb-1">
                        <span className="text-[11px] font-semibold truncate">Kuitansi Bruto (111%)</span>
                        <TrendingUp className="w-3.5 h-3.5 shrink-0 ml-1" />
                      </div>
                      <div
                        className="text-xs sm:text-[13px] md:text-sm font-bold font-mono tracking-tight text-blue-800 dark:text-blue-200 truncate block"
                        title={formatRupiah(formFaktur.nilaiKuitansi || liveCalc.nilaiProyek)}
                      >
                        {formatRupiah(formFaktur.nilaiKuitansi || liveCalc.nilaiProyek)}
                      </div>
                      <span className="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5 block truncate">
                        DPP + PPN 11%
                      </span>
                    </div>

                    {/* Card 4: Laba Bersih Setelah Pajak */}
                    <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800/60 shadow-xs min-w-0 overflow-hidden flex flex-col justify-between">
                      <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-300 mb-1">
                        <span className="text-[11px] font-bold truncate">Laba Stlh Pajak</span>
                        <Wallet className="w-3.5 h-3.5 shrink-0 ml-1" />
                      </div>
                      <div
                        className="text-xs sm:text-[13px] md:text-sm font-extrabold font-mono tracking-tight text-emerald-800 dark:text-emerald-200 truncate block"
                        title={formatRupiah(liveCalc.labaSetelahPajak)}
                      >
                        {formatRupiah(liveCalc.labaSetelahPajak)}
                      </div>
                      <span className="text-[10px] text-emerald-700 dark:text-emerald-400 mt-0.5 block font-medium truncate">
                        DPP Dasar − PPh Final
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Form Grid 4: Jenis Proyek */}
              <div>
                <label className="block text-xs font-semibold text-navy-text mb-1">
                  Jenis Proyek <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formFaktur.kodeJenisProyek}
                  onChange={(e) =>
                    setFormFaktur({
                      ...formFaktur,
                      kodeJenisProyek: Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 text-xs border border-border-soft rounded-xl bg-surface-input text-navy-text focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium cursor-pointer"
                >
                  <option value={1} className="bg-surface-card text-navy-text">1 - Perencanaan</option>
                  <option value={2} className="bg-surface-card text-navy-text">2 - Pengawasan</option>
                </select>
              </div>

              <div className="p-3.5 bg-surface-subtle rounded-xl border border-border-soft text-xs text-navy-soft">
                Dana cair, PPN Realisasi, dan PPh Realisasi terisi otomatis setelah
                penerimaan bank dicatat di Entry Jurnal dengan faktur dan proyek ini.
              </div>

              {/* Form Grid 6: Kontrol Administratif Dokumen Fisik Pajak */}
              <div className="p-3.5 bg-surface-subtle/70 rounded-xl border border-border-soft">
                <span className="block text-xs font-bold text-navy-text mb-2">
                  Kontrol Administratif Dokumen Fisik Pajak
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="flex items-center gap-2.5 p-2 bg-surface-card rounded-lg border border-border-soft cursor-pointer hover:bg-surface-hover transition-colors">
                    <input
                      type="checkbox"
                      checked={formFaktur.ceklisPpn}
                      onChange={(e) =>
                        setFormFaktur({ ...formFaktur, ceklisPpn: e.target.checked })
                      }
                      className="w-4 h-4 text-purple-600 rounded border-border-soft focus:ring-purple-500"
                    />
                    <div className="text-xs">
                      <span className="font-semibold text-navy-text block">Faktur Pajak PPN</span>
                      <span className="text-[10px] text-navy-soft">Fisik faktur diterima</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 p-2 bg-surface-card rounded-lg border border-border-soft cursor-pointer hover:bg-surface-hover transition-colors">
                    <input
                      type="checkbox"
                      checked={formFaktur.ceklisPph}
                      onChange={(e) =>
                        setFormFaktur({ ...formFaktur, ceklisPph: e.target.checked })
                      }
                      className="w-4 h-4 text-amber-600 rounded border-border-soft focus:ring-amber-500"
                    />
                    <div className="text-xs">
                      <span className="font-semibold text-navy-text block">Bukti Bayar PPh</span>
                      <span className="text-[10px] text-navy-soft">Fisik SSP/NTPN ada</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 p-2 bg-surface-card rounded-lg border border-border-soft cursor-pointer hover:bg-surface-hover transition-colors">
                    <input
                      type="checkbox"
                      checked={formFaktur.ceklisBuktiPotong}
                      onChange={(e) =>
                        setFormFaktur({ ...formFaktur, ceklisBuktiPotong: e.target.checked })
                      }
                      className="w-4 h-4 text-emerald-600 rounded border-border-soft focus:ring-emerald-500"
                    />
                    <div className="text-xs">
                      <span className="font-semibold text-navy-text block">Sertifikat Bukti Potong</span>
                      <span className="text-[10px] text-navy-soft">Bupot resmi diterima</span>
                    </div>
                  </label>
                </div>
              </div>

              </div>

              {/* Modal Footer (Fixed at bottom) */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border-soft bg-surface-subtle/30 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsFakturModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-navy-soft hover:text-navy-text hover:bg-surface-hover rounded-xl border border-border-soft transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-navy hover:opacity-90 rounded-xl transition-opacity shadow-sm disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmitting ? "Menyimpan..." : "Simpan Faktur"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL: EDIT REKONSILIASI SPT */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {mounted && isReconModalOpen && editingRecon && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-surface-card rounded-2xl border border-border-soft shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-soft bg-surface-subtle/50 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-navy/10 dark:bg-navy/30 text-navy-text dark:text-white">
                  <Scale className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-navy-text">
                    Input Data SPT Terlapor (Masa {editingRecon.namaBulan})
                  </h3>
                  <p className="text-xs text-navy-soft">
                    {data.entity.legalName} • Tahun {data.year}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsReconModalOpen(false)}
                className="p-1.5 text-navy-soft hover:text-navy-text hover:bg-surface-hover rounded-lg transition-colors cursor-pointer"
                aria-label="Tutup Modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRecon} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 text-xs font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Reference from invoices & Copy Button */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-surface-subtle border border-slate-200 dark:border-border-soft space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-navy-text">
                    Nilai Rekap Sistem (Masa {editingRecon.namaBulan})
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setFormRecon((prev) => ({
                        ...prev,
                        dppTerlapor: editingRecon.dppRekap,
                        pajakTerlapor: editingRecon.ppnRekap,
                        pphTerlapor: editingRecon.pphRekap,
                      }));
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800/60 transition-colors cursor-pointer"
                    title="Salin nilai DPP, PPN, dan PPh rekap sistem ke formulir terlapor SPT"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Salin dari Rekap Sistem</span>
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2.5 text-xs pt-1">
                  <div className="bg-surface-card p-2 rounded-lg border border-border-soft">
                    <span className="text-navy-soft block text-[10px] uppercase font-semibold">
                      DPP Rekap:
                    </span>
                    <span className="font-mono font-bold text-navy-text text-xs">
                      {editingRecon.dppRekapFmt}
                    </span>
                  </div>
                  <div className="bg-surface-card p-2 rounded-lg border border-border-soft">
                    <span className="text-navy-soft block text-[10px] uppercase font-semibold">
                      PPN Rekap:
                    </span>
                    <span className="font-mono font-bold text-purple-700 dark:text-purple-400 text-xs">
                      {editingRecon.ppnRekapFmt}
                    </span>
                  </div>
                  <div className="bg-surface-card p-2 rounded-lg border border-border-soft">
                    <span className="text-navy-soft block text-[10px] uppercase font-semibold">
                      PPh Rekap:
                    </span>
                    <span className="font-mono font-bold text-amber-700 dark:text-amber-400 text-xs">
                      {editingRecon.pphRekapFmt}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-navy-text mb-1">
                  DPP Terlapor di SPT Masa Resmi
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-xs font-bold text-navy-soft">
                    Rp
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={formatRupiahInput(formRecon.dppTerlapor)}
                    onChange={(e) =>
                      setFormRecon({
                        ...formRecon,
                        dppTerlapor: Number(e.target.value.replace(/[^0-9]/g, "")) || 0,
                      })
                    }
                    className="w-full pl-9 pr-3 py-2 text-xs font-mono font-bold border border-border-soft rounded-xl bg-surface-input text-navy-text focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-navy-text mb-1">
                    PPN Terlapor di SPT Masa Resmi
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-xs font-bold text-navy-soft">
                      Rp
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={formatRupiahInput(formRecon.pajakTerlapor)}
                      onChange={(e) =>
                        setFormRecon({
                          ...formRecon,
                          pajakTerlapor: Number(e.target.value.replace(/[^0-9]/g, "")) || 0,
                        })
                      }
                      className="w-full pl-9 pr-3 py-2 text-xs font-mono font-bold border border-border-soft rounded-xl bg-surface-input text-navy-text focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-navy-text mb-1">
                    PPh Terlapor di SPT Masa Resmi
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-xs font-bold text-navy-soft">
                      Rp
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={formatRupiahInput(formRecon.pphTerlapor)}
                      onChange={(e) =>
                        setFormRecon({
                          ...formRecon,
                          pphTerlapor: Number(e.target.value.replace(/[^0-9]/g, "")) || 0,
                        })
                      }
                      className="w-full pl-9 pr-3 py-2 text-xs font-mono font-bold border border-border-soft rounded-xl bg-surface-input text-navy-text focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Live Preview of Differences */}
              <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 space-y-2 text-xs">
                <span className="font-bold text-blue-950 dark:text-blue-200 block text-[11px] uppercase tracking-wider">
                  Live Selisih (Rekap Sistem vs Input SPT):
                </span>
                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <span className="text-blue-700 dark:text-blue-300 block text-[10px] font-semibold">
                      Selisih DPP:
                    </span>
                    <span
                      className={`font-mono font-bold ${
                        Math.abs(editingRecon.dppRekap - formRecon.dppTerlapor) > 0.01
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {formatRupiah(editingRecon.dppRekap - formRecon.dppTerlapor)}
                    </span>
                  </div>
                  <div>
                    <span className="text-blue-700 dark:text-blue-300 block text-[10px] font-semibold">
                      Selisih PPN:
                    </span>
                    <span
                      className={`font-mono font-bold ${
                        Math.abs(editingRecon.ppnRekap - formRecon.pajakTerlapor) > 0.01
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {formatRupiah(editingRecon.ppnRekap - formRecon.pajakTerlapor)}
                    </span>
                  </div>
                  <div>
                    <span className="text-blue-700 dark:text-blue-300 block text-[10px] font-semibold">
                      Selisih PPh:
                    </span>
                    <span
                      className={`font-mono font-bold ${
                        Math.abs(editingRecon.pphRekap - formRecon.pphTerlapor) > 0.01
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {formatRupiah(editingRecon.pphRekap - formRecon.pphTerlapor)}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-navy-text mb-1">
                  Catatan Rekonsiliasi / Keterangan
                </label>
                <textarea
                  rows={2}
                  placeholder="Misal: Faktur 010.xxx belum dilaporkan di SPT Masa bulan ini, akan dilaporkan pembetulan..."
                  value={formRecon.keterangan}
                  onChange={(e) =>
                    setFormRecon({ ...formRecon, keterangan: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs border border-border-soft rounded-xl bg-surface-input text-navy-text focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border-soft bg-surface-subtle/30 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsReconModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-navy-soft hover:text-navy-text hover:bg-surface-hover rounded-xl border border-border-soft transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-navy hover:opacity-90 rounded-xl transition-opacity shadow-sm disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmitting ? "Menyimpan..." : "Simpan SPT"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL: DELETE CONFIRMATION */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {mounted && isDeleteModalOpen && deletingFaktur && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-surface-card rounded-2xl border border-border-soft shadow-2xl w-full max-w-md overflow-hidden p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="p-2.5 rounded-full bg-rose-100 dark:bg-rose-950/50">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-navy-text">
                Hapus Faktur Pendapatan?
              </h3>
            </div>
            <p className="text-xs text-navy-soft leading-relaxed">
              Apakah Anda yakin ingin menghapus faktur nomor{" "}
              <strong className="text-navy-text font-mono">
                {deletingFaktur.noFaktur}
              </strong>{" "}
              atas nama rekanan{" "}
              <strong className="text-navy-text">
                {deletingFaktur.namaRekanan}
              </strong>
              ? Data yang dihapus tidak dapat dipulihkan.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-semibold text-navy-soft hover:text-navy-text hover:bg-surface-hover rounded-xl border border-border-soft transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteFaktur}
                disabled={isSubmitting}
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? "Menghapus..." : "Ya, Hapus Faktur"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
