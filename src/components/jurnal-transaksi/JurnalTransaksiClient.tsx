"use client";

import { useState, useEffect } from "react";
import { usePageTransition as useTransition } from "@/lib/use-page-transition";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { PenLine, Plus, Trash2, AlertTriangle, CheckCircle2, CalendarDays, X, ArrowUpDown, Pencil, Briefcase, TrendingUp, Receipt, Sparkles } from "lucide-react";
import { saveJurnalTransaksi, deleteJurnalTransaksi } from "@/lib/actions/jurnal-transaksi";
import { PaginationNav } from "@/components/shared/PaginationNav";
import { CoaCombobox } from "@/components/shared/CoaCombobox";
import { formatRupiah } from "@/lib/dashboard-data";
import { sortJurnalRows, type JurnalTransaksiGroup } from "@/lib/jurnal-transaksi";
import { DeleteConfirmModal } from "@/components/kas/DeleteConfirmModal";

type CoaOption = { id: string; code: string; name: string; kategori?: string };
export type ProjectOption = {
  id: string;
  code: string;
  name: string;
  entityId?: string;
  entityKey?: string;
  entityName?: string;
  contractValue?: number;
  contractValueFmt?: string;
  maxPercentage?: number;
  terminCount?: number;
  totalTerminTagih?: number;
  termins?: Array<{
    id: string;
    name: string;
    percentage: number | null;
    nominal: number | null;
  }>;
};

export type FakturOption = {
  id: string;
  noFaktur: string;
  namaRekanan: string;
  namaJkp: string;
  dpp: number;
  dppNilaiLain: number;
  ppn: number;
  pph: number;
  nilaiProyek: number;
  labaSetelahPajak: number;
  nominalDiterima: number;
  bank?: string | null;
  projectId?: string | null;
  projectCode?: string | null;
  projectName?: string | null;
  tahunPajak: number;
  masaPajak: number;
  tanggalTerima?: string | null;
  createdAt?: string;
};

type CoaRow = {
  uid: string;
  coaAccountId: string;
  keterangan: string;
  arah: "debit" | "kredit";
  nominalRaw: string;
};

let _counter = 0;
function uid() { return `r${++_counter}`; }
function todayStr() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function makeCoaRow(): CoaRow { return { uid: uid(), coaAccountId: "", keterangan: "", arah: "debit", nominalRaw: "" }; }
const BULAN_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

function parseNum(s: string) { return parseInt(s.replace(/\./g, "").replace(/[^0-9]/g, ""), 10) || 0; }
function fmtNum(raw: string) {
  const n = parseInt(raw.replace(/\./g, "").replace(/[^0-9]/g, ""), 10);
  return n > 0 ? n.toLocaleString("id-ID") : "";
}

export function JurnalTransaksiClient({
  entityKey, coa, history, projectOptions = [], fakturOptions = [], page, totalPages, dari = "", sampai = "",
}: {
  entityKey: string;
  coa: CoaOption[];
  history: JurnalTransaksiGroup[];
  projectOptions?: ProjectOption[];
  fakturOptions?: FakturOption[];
  page: number;
  totalPages: number;
  dari?: string;
  sampai?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [panelOpen, setPanelOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<JurnalTransaksiGroup | null>(null);
  const [deletingGroup, setDeletingGroup] = useState<JurnalTransaksiGroup | null>(null);
  const [sortAsc, setSortAsc] = useState(false);

  const [filterDari, setFilterDari] = useState(dari);
  const [filterSampai, setFilterSampai] = useState(sampai);
  const isFiltered = !!dari || !!sampai;

  const [noBukti, setNoBukti] = useState("");
  const [tanggal, setTanggal] = useState(todayStr());
  const [projectId, setProjectId] = useState("");
  const [terminId, setTerminId] = useState("__NEW__");
  const [fakturId, setFakturId] = useState("");
  const [periodeBulanGaji, setPeriodeBulanGaji] = useState<number | null>(null);
  const [periodeTahunGaji, setPeriodeTahunGaji] = useState<number | null>(null);
  const [coaRows, setCoaRows] = useState<CoaRow[]>([makeCoaRow()]);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const hasSalaryAccount = coaRows.some((r) => {
    const c = coa.find((acc) => acc.id === r.coaAccountId);
    if (!c) return false;
    return c.code === "511" || c.code === "612" || c.code.startsWith("511") || c.code.startsWith("612") || /gaji|honor|upah|tenaga ahli|payroll/i.test(c.name);
  });

  useEffect(() => {
    if (hasSalaryAccount) {
      if (periodeBulanGaji === null) {
        const txDate = tanggal ? new Date(tanggal) : new Date();
        const curM = txDate.getMonth() + 1;
        const defM = curM === 1 ? 12 : curM - 1;
        const defY = curM === 1 ? txDate.getFullYear() - 1 : txDate.getFullYear();
        setPeriodeBulanGaji(defM);
        setPeriodeTahunGaji(defY);
      }
    } else {
      if (periodeBulanGaji !== null) {
        setPeriodeBulanGaji(null);
        setPeriodeTahunGaji(null);
      }
    }
  }, [hasSalaryAccount, tanggal, periodeBulanGaji]);

  const totalDebit = coaRows.reduce((s, r) => s + (r.arah === "debit" ? parseNum(r.nominalRaw) : 0), 0);
  const totalKredit = coaRows.reduce((s, r) => s + (r.arah === "kredit" ? parseNum(r.nominalRaw) : 0), 0);
  const isBalanced = totalDebit > 0 && totalKredit > 0 && totalDebit === totalKredit;
  const validRowCount = coaRows.filter((r) => r.coaAccountId && parseNum(r.nominalRaw) > 0).length;
  const canSubmit = tanggal.length > 0 && validRowCount >= 1 && !isPending;

  const selectedProject = projectOptions?.find((p) => p.id === projectId);
  const selectedFaktur = fakturOptions?.find((f) => f.id === fakturId);
  const isOtherEntity = selectedProject?.entityKey && selectedProject.entityKey !== entityKey;
  const currentEntityProjects = (projectOptions ?? []).filter((p) => !p.entityKey || p.entityKey === entityKey);
  const otherEntityProjects = (projectOptions ?? []).filter((p) => p.entityKey && p.entityKey !== entityKey);
  const otherByEntity = otherEntityProjects.reduce((acc, p) => {
    const key = p.entityName || p.entityKey || "Entitas Lain";
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {} as Record<string, typeof otherEntityProjects>);

  // Filter faktur berdasarkan proyek jika proyek dipilih
  const currentProjectFakturs = projectId
    ? (fakturOptions ?? []).filter((f) => f.projectId === projectId)
    : [];
  const otherFakturs = projectId
    ? (fakturOptions ?? []).filter((f) => f.projectId !== projectId)
    : (fakturOptions ?? []);

  // Mapping prioritas kode bank per entitas (BPD diutamakan untuk dinas/pemda, disusul BRI, BNI, Mandiri)
  const entityBankCodes: Record<string, string[]> = {
    gaharu: ["22", "21", "23", "24"],      // BPD GS, BRI GS, BNI GS, MDR GS
    kencana: ["12", "11", "13", "14"],     // BPD KAK, BRI KAK, BNI KAK, MDR KAK
    tataring: ["31", "32"],                // BPD TB, BNI TB
    ciptaAsri: ["41"],                     // BPD CAD
    umum: ["51"],                          // BPD KP
  };

  // Default COA Accounts untuk automasi E-Faktur:
  // Pilih akun Bank sesuai entitas yang sedang dibuka (bukan Kas dan bukan entitas lain)
  const targetBankCodes = entityBankCodes[entityKey] || [];
  const fakturBankName = selectedFaktur?.bank?.trim().toLowerCase();

  const defaultBankAcc =
    // 1. Jika ada preferensi bank dari faktur (misal "BRI" atau "BPD"), pilih bank entitas ini yang cocok
    (fakturBankName
      ? targetBankCodes
          .map((code) => coa.find((c) => c.code === code))
          .find((c) => c && c.name.toLowerCase().includes(fakturBankName))
      : undefined) ||
    // 2. Ambil bank utama entitas ini berdasarkan daftar kode bank resmi
    targetBankCodes
      .map((code) => coa.find((c) => c.code === code))
      .find(Boolean) ||
    // 3. Fallback: cari akun bank yang mengandung suffix entitas (GS, KAK, TB, CAD, KP)
    coa.find(
      (c) =>
        /bpd|bri|bni|mdr|bank/i.test(c.name) &&
        (entityKey === "gaharu" ? /gs|gaharu/i.test(c.name) :
         entityKey === "kencana" ? /kak|kencana/i.test(c.name) :
         entityKey === "tataring" ? /tb|tataring/i.test(c.name) :
         entityKey === "ciptaAsri" ? /cad|cipta/i.test(c.name) :
         entityKey === "umum" ? /kp/i.test(c.name) : true)
    ) ||
    // 4. Fallback umum: akun Bank pertama (bukan kas)
    coa.find((c) => /^(11|12|13|14|21|22|23|24|31|32|41|51)$/.test(c.code) || /bpd|bri|bni|bank/i.test(c.name)) ||
    coa[0];

  const defaultPphAcc = coa.find((c) => c.code === "534" || /pph final|pasal 4 ayat 2/i.test(c.name))
    || coa.find((c) => c.code.startsWith("53") && /pph/i.test(c.name))
    || coa.find((c) => /pph/i.test(c.name));
  const defaultPendapatanAcc = coa.find((c) => c.code === "400" || c.code === "410" || (c.code.startsWith("4") && /pendapatan/i.test(c.name)))
    || coa.find((c) => c.kategori === "PENDAPATAN")
    || coa.find((c) => c.code.startsWith("4"));
  const defaultPpnAcc = coa.find((c) => c.code === "535" || /ppn/i.test(c.name));

  // Hitung nominal uang masuk / termin dari baris yang diisi:
  // 1. Prioritas pendapatan (kredit akun kategori PENDAPATAN atau kode 4xx)
  // 2. Prioritas bank/kas (debit akun kas/bank)
  // 3. Fallback: total kredit atau total debit
  const pendapatanRows = coaRows.filter((r) => {
    const c = coa.find((acc) => acc.id === r.coaAccountId);
    return r.arah === "kredit" && (c?.kategori === "PENDAPATAN" || c?.code.startsWith("4"));
  });
  const totalPendapatan = pendapatanRows.reduce((sum, r) => sum + parseNum(r.nominalRaw), 0);

  const bankRows = coaRows.filter((r) => {
    const c = coa.find((acc) => acc.id === r.coaAccountId);
    return r.arah === "debit" && (/^(11|12|13|14|21|22|23|24|31|32|41|51)$/.test(c?.code ?? "") || /bank|bpd|bri|bni|mdr/i.test(c?.name ?? ""));
  });
  const totalBank = bankRows.reduce((sum, r) => sum + parseNum(r.nominalRaw), 0);

  const nominalTermin = totalPendapatan > 0 ? totalPendapatan : (totalBank > 0 ? totalBank : (totalKredit > 0 ? totalKredit : totalDebit));

  const contractVal = selectedProject?.contractValue ?? 0;
  const maxPctSoFar = selectedProject?.maxPercentage ?? 0;
  const terminCount = selectedProject?.terminCount ?? 0;
  const nextTerminKe = terminCount + 1;
  const cumulativeBefore = selectedProject?.totalTerminTagih !== undefined && selectedProject.totalTerminTagih > 0
    ? selectedProject.totalTerminTagih
    : (maxPctSoFar / 100) * contractVal;
  const cumulativeAfter = cumulativeBefore + nominalTermin;
  const newPct = contractVal > 0 ? Math.min(100, Math.round((cumulativeAfter / contractVal) * 100)) : maxPctSoFar;
  const deltaPct = Math.max(0, newPct - maxPctSoFar);

  const selectedTermin = selectedProject?.termins?.find((t) => t.id === terminId);

  const autoKeterangan = selectedProject
    ? (selectedTermin
        ? `Pendapatan ${selectedTermin.name} - ${selectedProject.name} (${selectedProject.code})`
        : `Pendapatan Termin ${nextTerminKe} - ${selectedProject.name} (${selectedProject.code})`)
    : "";

  function handleProjectChange(newProjectId: string) {
    setProjectId(newProjectId);
    if (!newProjectId) {
      setTerminId("__NEW__");
      return;
    }
    const sel = projectOptions.find((p) => p.id === newProjectId);
    if (!sel) return;
    const firstTerm = sel.termins && sel.termins.length > 0 ? sel.termins[0].id : "__NEW__";
    setTerminId(firstTerm);

    const targetTerm = sel.termins?.find((t) => t.id === firstTerm);
    const nextKe = (sel.terminCount ?? 0) + 1;
    const autoKet = targetTerm
      ? `Pendapatan ${targetTerm.name} - ${sel.name} (${sel.code})`
      : `Pendapatan Termin ${nextKe} - ${sel.name} (${sel.code})`;
    setCoaRows((prev) => {
      if (prev.length > 0 && (!prev[0].keterangan.trim() || prev[0].keterangan.startsWith("Pendapatan Termin"))) {
        const [first, ...rest] = prev;
        return [{ ...first, keterangan: autoKet }, ...rest];
      }
      return prev;
    });
  }

  function handleTerminChange(newTerminId: string) {
    setTerminId(newTerminId);
    if (!selectedProject) return;
    const term = selectedProject.termins?.find((t) => t.id === newTerminId);
    const nextKe = (selectedProject.terminCount ?? 0) + 1;
    const ket = term
      ? `Pendapatan ${term.name} - ${selectedProject.name} (${selectedProject.code})`
      : `Pendapatan Termin ${nextKe} - ${selectedProject.name} (${selectedProject.code})`;
    setCoaRows((prev) => {
      if (prev.length > 0 && (!prev[0].keterangan.trim() || prev[0].keterangan.startsWith("Pendapatan Termin") || prev[0].keterangan.startsWith("Pencairan Faktur"))) {
        const [first, ...rest] = prev;
        return [{ ...first, keterangan: ket }, ...rest];
      }
      return prev;
    });
  }

  function handleFakturChange(newFakturId: string) {
    setFakturId(newFakturId);
    if (!newFakturId) return;
    const selFaktur = (fakturOptions ?? []).find((f) => f.id === newFakturId);
    if (!selFaktur) return;

    // Otomatis isi kode proyek jika E-Faktur terdaftar di suatu proyek
    if (selFaktur.projectId) {
      setProjectId(selFaktur.projectId);
      const sel = projectOptions.find((p) => p.id === selFaktur.projectId);
      if (sel?.termins && sel.termins.length > 0) {
        const matched = sel.termins.find((t) => t.nominal === selFaktur.dpp) || sel.termins[0];
        setTerminId(matched.id);
      } else {
        setTerminId("__NEW__");
      }
    }

    // Default keterangan transaksi pencairan faktur
    const ketFaktur = `Pencairan Faktur ${selFaktur.noFaktur} - ${selFaktur.namaRekanan}`;
    setCoaRows((prev) => {
      if (prev.length > 0 && (!prev[0].keterangan.trim() || prev[0].keterangan.startsWith("Pendapatan Termin") || prev[0].keterangan.startsWith("Pencairan Faktur"))) {
        const [first, ...rest] = prev;
        return [{ ...first, keterangan: ketFaktur }, ...rest];
      }
      return prev;
    });
  }

  function applyFakturRows() {
    if (!selectedFaktur) return;
    const pphVal = selectedFaktur.pph || 0;
    const ppnVal = selectedFaktur.ppn || 0;
    const dppVal = selectedFaktur.dpp || 0;

    // Nilai Pendapatan bruto (nilaiProyek, atau dpp + ppn, atau dpp)
    const pendapatanVal = selectedFaktur.nilaiProyek > 0
      ? selectedFaktur.nilaiProyek
      : (dppVal > 0 ? (ppnVal > 0 ? dppVal + ppnVal : dppVal) : 0);

    // Nilai Bank (Netto yang masuk rekening):
    // Jika ada labaSetelahPajak di faktur, gunakan itu. Jika tidak, sisa pendapatan dikurangi PPN dan PPh.
    const nettoVal = selectedFaktur.labaSetelahPajak > 0
      ? selectedFaktur.labaSetelahPajak
      : (pendapatanVal > 0 ? Math.max(0, pendapatanVal - ppnVal - pphVal) : 0);

    const ketBase = `Pencairan Faktur ${selectedFaktur.noFaktur} - ${selectedFaktur.namaRekanan}`;
    const rows: CoaRow[] = [];

    // Baris 1: Kas / Bank (Debit) - Netto yang masuk rekening (dapat disesuaikan)
    rows.push({
      uid: uid(),
      coaAccountId: defaultBankAcc?.id ?? "",
      keterangan: `${ketBase} (Bank)`,
      arah: "debit",
      nominalRaw: nettoVal > 0 ? fmtNum(String(nettoVal)) : "",
    });

    // Baris 2: PPN (Debit) - potongan / perlakuan PPN sesuai faktur
    rows.push({
      uid: uid(),
      coaAccountId: defaultPpnAcc?.id ?? "",
      keterangan: `PPN Faktur ${selectedFaktur.noFaktur}`,
      arah: "debit",
      nominalRaw: ppnVal > 0 ? fmtNum(String(ppnVal)) : "",
    });

    // Baris 3: PPh Final (Debit) - potongan PPh Final Pasal 4 Ayat 2 sesuai faktur
    rows.push({
      uid: uid(),
      coaAccountId: defaultPphAcc?.id ?? "",
      keterangan: `Potongan PPh Final - ${selectedFaktur.noFaktur}`,
      arah: "debit",
      nominalRaw: pphVal > 0 ? fmtNum(String(pphVal)) : "",
    });

    // Baris 4: Pendapatan (Kredit) - nilai pekerjaan / pendapatan proyek
    rows.push({
      uid: uid(),
      coaAccountId: defaultPendapatanAcc?.id ?? "",
      keterangan: `${ketBase} (Pendapatan)`,
      arah: "kredit",
      nominalRaw: pendapatanVal > 0 ? fmtNum(String(pendapatanVal)) : "",
    });

    setCoaRows(rows);
  }

  function addPphRow() {
    if (!selectedFaktur || selectedFaktur.pph <= 0) return;
    setCoaRows((prev) => [
      ...prev,
      {
        uid: uid(),
        coaAccountId: defaultPphAcc?.id ?? "",
        keterangan: `Potongan PPh Final - ${selectedFaktur.noFaktur}`,
        arah: "debit",
        nominalRaw: fmtNum(String(selectedFaktur.pph)),
      },
    ]);
  }

  function addPpnRow() {
    if (!selectedFaktur || selectedFaktur.ppn <= 0) return;
    setCoaRows((prev) => [
      ...prev,
      {
        uid: uid(),
        coaAccountId: defaultPpnAcc?.id ?? "",
        keterangan: `PPN Faktur ${selectedFaktur.noFaktur}`,
        arah: "debit",
        nominalRaw: fmtNum(String(selectedFaktur.ppn)),
      },
    ]);
  }

  function applyAutoKeterangan() {
    if (!autoKeterangan) return;
    setCoaRows((prev) =>
      prev.map((r, i) => (i === 0 || !r.keterangan.trim() ? { ...r, keterangan: autoKeterangan } : r))
    );
  }

  function resetForm() {
    setNoBukti(""); setTanggal(todayStr()); setProjectId(""); setFakturId("");
    setTerminId("__NEW__");
    setPeriodeBulanGaji(null); setPeriodeTahunGaji(null);
    setCoaRows([makeCoaRow()]); setFeedback(null); setEditingGroup(null);
  }

  function openPanel() { resetForm(); setPanelOpen(true); }

  function openEdit(group: JurnalTransaksiGroup) {
    setEditingGroup(group);
    setNoBukti(group.noBukti);
    setTanggal(group.tanggalRaw.slice(0, 10));
    setProjectId(group.projectId ?? "");
    setFakturId(group.fakturId ?? "");
    setTerminId(group.terminId || "__NEW__");
    setPeriodeBulanGaji(group.periodeBulanGaji ?? null);
    setPeriodeTahunGaji(group.periodeTahunGaji ?? null);
    const sortedRows = sortJurnalRows(group.rows);
    setCoaRows(sortedRows.map((r) => ({
      uid: uid(),
      coaAccountId: r.coaAccountId,
      keterangan: r.keterangan,
      arah: r.debit > 0 ? "debit" : "kredit",
      nominalRaw: r.debit > 0 ? r.debit.toLocaleString("id-ID") : r.kredit.toLocaleString("id-ID"),
    })));
    setFeedback(null);
    setPanelOpen(true);
  }

  function updateRow(rowUid: string, patch: Partial<Omit<CoaRow, "uid">>) {
    setCoaRows((prev) => prev.map((r) => r.uid === rowUid ? { ...r, ...patch } : r));
  }

  function applyDateFilter() {
    const params = new URLSearchParams(searchParams.toString());
    if (filterDari) params.set("dari", filterDari); else params.delete("dari");
    if (filterSampai) params.set("sampai", filterSampai); else params.delete("sampai");
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  function resetDateFilter() {
    setFilterDari(""); setFilterSampai("");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("dari"); params.delete("sampai"); params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFeedback(null);
    const fd = new FormData();
    fd.set("entityKey", entityKey);
    fd.set("noBukti", noBukti);
    fd.set("tanggal", tanggal);
    if (projectId) {
      fd.set("projectId", projectId);
      if (terminId) fd.set("terminId", terminId);
    }
    if (fakturId) fd.set("fakturId", fakturId);
    if (periodeBulanGaji) {
      fd.set("periodeBulanGaji", String(periodeBulanGaji));
      fd.set("periodeTahunGaji", String(periodeTahunGaji || new Date(tanggal).getFullYear()));
    }
    if (editingGroup) fd.set("editNoBukti", editingGroup.noBukti);

    const sortedFormRows = [...coaRows]
      .filter((r) => r.coaAccountId && parseNum(r.nominalRaw) > 0)
      .sort((a, b) => {
        const aIsCredit = a.arah === "kredit";
        const bIsCredit = b.arah === "kredit";
        if (!aIsCredit && bIsCredit) return -1;
        if (aIsCredit && !bIsCredit) return 1;
        if (aIsCredit && bIsCredit) {
          const coaA = coa.find((c) => c.id === a.coaAccountId);
          const coaB = coa.find((c) => c.id === b.coaAccountId);
          const aIsPendapatan = coaA?.code?.startsWith("4") || /pendapatan/i.test(coaA?.name || "");
          const bIsPendapatan = coaB?.code?.startsWith("4") || /pendapatan/i.test(coaB?.name || "");
          if (!aIsPendapatan && bIsPendapatan) return -1;
          if (aIsPendapatan && !bIsPendapatan) return 1;
        }
        return 0;
      });

    fd.set("rows", JSON.stringify(
      sortedFormRows.map((r) => ({
        coaAccountId: r.coaAccountId,
        keterangan: r.keterangan,
        debit: r.arah === "debit" ? parseNum(r.nominalRaw) : 0,
        kredit: r.arah === "kredit" ? parseNum(r.nominalRaw) : 0,
      }))
    ));
    startTransition(async () => {
      try {
        const result = await saveJurnalTransaksi(fd);
        if (result?.error) {
          setFeedback({ type: "error", msg: result.error });
        } else {
          resetForm();
          setPanelOpen(false);
          router.refresh();
        }
      } catch (err) {
        setFeedback({ type: "error", msg: err instanceof Error ? err.message : "Terjadi kesalahan tak terduga." });
      }
    });
  }

  function handleDelete(group: JurnalTransaksiGroup) {
    setDeletingGroup(group);
  }

  function handleConfirmDelete() {
    if (!deletingGroup) return;
    startTransition(async () => {
      const res = await deleteJurnalTransaksi(deletingGroup.allTxIds);
      if (res?.error) {
        setActionError(res.error);
      } else {
        setDeletingGroup(null);
        router.refresh();
      }
    });
  }

  const sortedHistory = [...history].sort((a, b) => {
    const diff = new Date(a.tanggalRaw).getTime() - new Date(b.tanggalRaw).getTime();
    return sortAsc ? diff : -diff;
  });

  return (
    <div className="flex flex-col gap-5">

      {/* Filter tanggal */}
      <div className="flex items-center gap-2 flex-wrap">
        <CalendarDays size={14} className="text-muted-faint flex-none" />
        <input type="date" value={filterDari} onChange={(e) => setFilterDari(e.target.value)}
          className="text-[12.5px] font-semibold text-muted-stronger border border-border-soft rounded-[9px] px-2.5 py-2 bg-surface-input focus:outline-none" />
        <span className="text-[12px] text-muted-faint">—</span>
        <input type="date" value={filterSampai} onChange={(e) => setFilterSampai(e.target.value)}
          className="text-[12.5px] font-semibold text-muted-stronger border border-border-soft rounded-[9px] px-2.5 py-2 bg-surface-input focus:outline-none" />
        <button onClick={applyDateFilter} className="px-3 py-2 rounded-[9px] bg-navy text-white text-[12px] font-bold">Terapkan</button>
        {isFiltered && (
          <button onClick={resetDateFilter} className="flex items-center gap-1 px-2.5 py-2 rounded-[9px] border border-border-soft text-[12px] font-semibold text-muted-stronger hover:bg-surface-hover">
            <X size={11} /> Reset
          </button>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-[11px] border border-border-soft bg-surface-card text-[12.5px] font-semibold text-muted-stronger">
          <PenLine size={13} className="text-brand" /> Jurnal transaksi manual
        </div>
        <button
          onClick={() => { if (panelOpen && !editingGroup) { setPanelOpen(false); resetForm(); } else openPanel(); }}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-[11px] bg-navy text-white text-[13px] font-bold hover:opacity-90 transition-opacity shadow-xs cursor-pointer">
          {panelOpen && !editingGroup ? (
            <>
              <X size={14} className="flex-none" />
              <span>Tutup Form</span>
            </>
          ) : (
            <>
              <Plus size={14} className="flex-none" />
              <span>Entry Jurnal</span>
            </>
          )}
        </button>
      </div>

      {/* Form panel */}
      {panelOpen && (
        <div className="bg-surface-card border border-border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-[10px] bg-brand/10 flex items-center justify-center flex-none">
                <PenLine size={15} className="text-brand" />
              </div>
              <div>
                <h2 className="text-[14.5px] font-bold text-navy-text">
                  {editingGroup ? `Edit Jurnal – ${editingGroup.noBukti}` : "Entry Jurnal Baru"}
                </h2>
                <p className="text-[11.5px] text-muted">Tambah baris akun sesuai kebutuhan jurnal</p>
              </div>
            </div>
            <button onClick={() => { setPanelOpen(false); resetForm(); }}
              className="p-1.5 rounded-lg text-muted-faint hover:text-navy-text hover:bg-surface-hover transition-colors">
              <X size={16} />
            </button>
          </div>

          {feedback && (
            <div className={`flex items-start gap-2.5 rounded-[12px] px-4 py-3 mb-4 text-[13px] ${
              feedback.type === "success"
                ? "bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 text-status-green"
                : "bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-status-red"
            }`}>
              {feedback.type === "success" ? <CheckCircle2 size={15} className="mt-0.5 flex-none" /> : <AlertTriangle size={15} className="mt-0.5 flex-none" />}
              <span>{feedback.msg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Header: No. Bukti + Tanggal */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10.5px] font-bold text-muted-faint uppercase tracking-widest">No. Bukti</label>
                  <span className="text-[9.5px] text-muted-faint font-medium">Opsional</span>
                </div>
                <input type="text" value={noBukti} onChange={(e) => setNoBukti(e.target.value)}
                  placeholder="Otomatis jika kosong (JU-...)"
                  className="h-9 px-3 rounded-[9px] border border-border-soft bg-surface-input text-[13px] text-navy-text font-mono placeholder:text-muted focus:outline-none focus:border-brand transition-colors" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10.5px] font-bold text-muted-faint uppercase tracking-widest">Tanggal</label>
                <input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} required
                  className="h-9 px-3 rounded-[9px] border border-border-soft bg-surface-input text-[13px] text-navy-text focus:outline-none focus:border-brand transition-colors" />
              </div>
            </div>

            {/* Integrasi E-Faktur & Proyek KOSHA */}
            <div className="mb-5 flex flex-col gap-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* 1. E-Faktur Terkait */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-muted-stronger uppercase tracking-wide flex items-center gap-1.5">
                      <Receipt size={12} className="text-muted-faint" />
                      E-Faktur Terkait (Opsional)
                    </label>
                    {selectedFaktur && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-800/40">
                        DPP: Rp {Math.round(selectedFaktur.dpp).toLocaleString("id-ID")}
                      </span>
                    )}
                  </div>

                  <select
                    value={fakturId}
                    onChange={(e) => handleFakturChange(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-[9px] border border-border-soft bg-surface-input text-[12.5px] text-navy-text focus:outline-none focus:border-brand transition-colors truncate"
                  >
                    <option value="">— Tanpa E-Faktur —</option>
                    {currentProjectFakturs.length > 0 && (
                      <optgroup label="E-Faktur Proyek Ini">
                        {currentProjectFakturs.map((f) => {
                          const sameNumber = (fakturOptions ?? []).filter((x) => x.noFaktur.trim().toLowerCase() === f.noFaktur.trim().toLowerCase());
                          const isDup = sameNumber.length > 1;
                          const partIdx = isDup ? sameNumber.findIndex((x) => x.id === f.id) + 1 : null;
                          const partTag = isDup ? `[Termin #${partIdx}] ` : "";
                          const isCair = (f.nominalDiterima && f.nominalDiterima > 0) || !!f.tanggalTerima;
                          const statusTag = isCair ? " · [Lunas/Cair]" : " · [Belum Cair]";
                          const netto = f.labaSetelahPajak > 0 ? f.labaSetelahPajak : Math.max(0, f.dpp - f.pph);
                          return (
                            <option key={f.id} value={f.id}>
                              {partTag}{f.noFaktur} · {f.namaRekanan} · DPP: Rp {Math.round(f.dpp).toLocaleString("id-ID")} · Netto: Rp {Math.round(netto).toLocaleString("id-ID")}{statusTag}
                            </option>
                          );
                        })}
                      </optgroup>
                    )}
                    {otherFakturs.length > 0 && (
                      <optgroup label={currentProjectFakturs.length > 0 ? "E-Faktur Lainnya" : "Daftar E-Faktur"}>
                        {otherFakturs.map((f) => {
                          const sameNumber = (fakturOptions ?? []).filter((x) => x.noFaktur.trim().toLowerCase() === f.noFaktur.trim().toLowerCase());
                          const isDup = sameNumber.length > 1;
                          const partIdx = isDup ? sameNumber.findIndex((x) => x.id === f.id) + 1 : null;
                          const partTag = isDup ? `[Termin #${partIdx}] ` : "";
                          const isCair = (f.nominalDiterima && f.nominalDiterima > 0) || !!f.tanggalTerima;
                          const statusTag = isCair ? " · [Lunas/Cair]" : " · [Belum Cair]";
                          const netto = f.labaSetelahPajak > 0 ? f.labaSetelahPajak : Math.max(0, f.dpp - f.pph);
                          return (
                            <option key={f.id} value={f.id}>
                              {partTag}{f.noFaktur} · {f.namaRekanan} {f.projectCode ? `[${f.projectCode}]` : ""} · DPP: Rp {Math.round(f.dpp).toLocaleString("id-ID")} · Netto: Rp {Math.round(netto).toLocaleString("id-ID")}{statusTag}
                            </option>
                          );
                        })}
                      </optgroup>
                    )}
                  </select>
                  <p className="text-[10.5px] text-muted-faint">
                    Pilih E-Faktur untuk mengisi otomatis proyek terkait serta menarik data PPN & PPh.
                  </p>
                </div>

                {/* 2. Proyek Terkait (KOSHA) */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-muted-stronger uppercase tracking-wide flex items-center gap-1.5">
                      <Briefcase size={12} className="text-muted-faint" />
                      Proyek Terkait (KOSHA)
                      {isOtherEntity && (
                        <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 px-1.5 py-0.5 rounded border border-purple-200/60 dark:border-purple-800/40">
                          Lintas Entitas
                        </span>
                      )}
                    </label>
                    {selectedProject && (
                      <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/40">
                        {selectedTermin ? selectedTermin.name : `Termin Ke-${nextTerminKe}`}
                      </span>
                    )}
                  </div>

                  <select
                    value={projectId}
                    onChange={(e) => handleProjectChange(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-[9px] border border-border-soft bg-surface-input text-[12.5px] text-navy-text focus:outline-none focus:border-brand transition-colors truncate"
                  >
                    <option value="">— Bukan transaksi proyek —</option>
                    {currentEntityProjects.length > 0 && (
                      <optgroup label="Proyek Entitas Ini">
                        {currentEntityProjects.map((p) => (
                          <option key={p.id} value={p.id}>
                            [{p.code}] {p.name} · Kontrak: {p.contractValueFmt ?? "-"} · Progres: {p.maxPercentage ?? 0}%
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {Object.entries(otherByEntity).map(([entName, projs]) => (
                      <optgroup key={entName} label={`Proyek ${entName} (Lintas Entitas)`}>
                        {projs.map((p) => (
                          <option key={p.id} value={p.id}>
                            [{p.code}] {p.name} · Kontrak: {p.contractValueFmt ?? "-"} · Progres: {p.maxPercentage ?? 0}%
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <p className="text-[10.5px] text-muted-faint">
                    Sinkronisasi termin otomatis ke Kontrol Piutang & Laporan Pendapatan.
                  </p>
                </div>
              </div>

              {/* Card E-Faktur Terpilih & Aksi Tarik Data */}
              {selectedFaktur && (
                <div className="rounded-[12px] border border-blue-200/80 dark:border-blue-800/40 bg-blue-50/40 dark:bg-blue-950/20 p-3.5 flex flex-col gap-3">
                  <div className="flex items-center justify-between flex-wrap gap-2 text-[12px]">
                    <div className="flex items-center gap-2">
                      <Receipt size={15} className="text-blue-600 dark:text-blue-400 flex-none" />
                      <span className="font-bold font-mono text-[12px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                        {selectedFaktur.noFaktur}
                      </span>
                      {(() => {
                        const sameNumber = (fakturOptions ?? []).filter((x) => x.noFaktur.trim().toLowerCase() === selectedFaktur.noFaktur.trim().toLowerCase());
                        const isDup = sameNumber.length > 1;
                        const partIdx = isDup ? sameNumber.findIndex((x) => x.id === selectedFaktur.id) + 1 : null;
                        const isCair = (selectedFaktur.nominalDiterima && selectedFaktur.nominalDiterima > 0) || !!selectedFaktur.tanggalTerima;
                        return (
                          <>
                            {isDup && (
                              <span className="font-bold text-[10.5px] px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">
                                Termin #{partIdx}
                              </span>
                            )}
                            {isCair ? (
                              <span className="font-bold text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                                Sudah Cair
                              </span>
                            ) : (
                              <span className="font-bold text-[10px] px-2 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/40">
                                Belum Cair
                              </span>
                            )}
                          </>
                        );
                      })()}
                      <span className="font-semibold text-navy-text">
                        {selectedFaktur.namaRekanan}
                      </span>
                      <span className="text-[10.5px] text-muted-faint">
                        ({selectedFaktur.namaJkp || `Masa ${selectedFaktur.masaPajak}/${selectedFaktur.tahunPajak}`})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={applyFakturRows}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-blue-600 hover:bg-blue-700 text-white text-[11.5px] font-bold shadow-sm transition-colors"
                      title="Otomatis buat 4 baris: Bank, PPN, PPh Final, dan Pendapatan"
                    >
                      <Sparkles size={13} /> Tarik ke Baris Jurnal (4 Baris Seimbang)
                    </button>
                  </div>

                  {/* 4 Metrik E-Faktur */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                    <div className="bg-surface-card p-2 rounded-[8px] border border-border-subtle min-w-0 overflow-hidden" title={`DPP: Rp ${Math.round(selectedFaktur.dpp).toLocaleString("id-ID")}`}>
                      <span className="text-muted-faint block text-[10px] uppercase font-bold truncate">DPP (Pendapatan)</span>
                      <span className="font-bold font-mono text-navy-text truncate block">Rp {Math.round(selectedFaktur.dpp).toLocaleString("id-ID")}</span>
                    </div>
                    <div className="bg-surface-card p-2 rounded-[8px] border border-border-subtle min-w-0 overflow-hidden" title={`PPN: Rp ${Math.round(selectedFaktur.ppn).toLocaleString("id-ID")}`}>
                      <span className="text-muted-faint block text-[10px] uppercase font-bold truncate">PPN</span>
                      <span className="font-bold font-mono text-blue-600 dark:text-blue-400 truncate block">Rp {Math.round(selectedFaktur.ppn).toLocaleString("id-ID")}</span>
                    </div>
                    <div className="bg-surface-card p-2 rounded-[8px] border border-border-subtle min-w-0 overflow-hidden" title={`Potongan PPh: Rp ${Math.round(selectedFaktur.pph).toLocaleString("id-ID")}`}>
                      <span className="text-muted-faint block text-[10px] uppercase font-bold truncate">Potongan PPh</span>
                      <span className="font-bold font-mono text-amber-600 dark:text-amber-400 truncate block">Rp {Math.round(selectedFaktur.pph).toLocaleString("id-ID")}</span>
                    </div>
                    <div className="bg-surface-card p-2 rounded-[8px] border border-border-subtle min-w-0 overflow-hidden" title={`Estimasi Netto: Rp ${Math.round(selectedFaktur.labaSetelahPajak > 0 ? selectedFaktur.labaSetelahPajak : selectedFaktur.dpp - selectedFaktur.pph).toLocaleString("id-ID")}`}>
                      <span className="text-muted-faint block text-[10px] uppercase font-bold truncate">Estimasi Netto Cair</span>
                      <span className="font-bold font-mono text-status-green truncate block">
                        Rp {Math.round(selectedFaktur.labaSetelahPajak > 0 ? selectedFaktur.labaSetelahPajak : selectedFaktur.dpp - selectedFaktur.pph).toLocaleString("id-ID")}
                      </span>
                    </div>
                  </div>

                  {/* Quick add chips */}
                  <div className="flex items-center justify-between gap-2 flex-wrap text-[11px]">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-muted-faint text-[10.5px]">Tambah satuan baris:</span>
                      {selectedFaktur.pph > 0 && (
                        <button
                          type="button"
                          onClick={addPphRow}
                          className="px-2 py-0.5 rounded border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 hover:bg-amber-100 transition-colors font-medium text-[10.5px]"
                        >
                          + Baris PPh (Rp {Math.round(selectedFaktur.pph).toLocaleString("id-ID")})
                        </button>
                      )}
                      {selectedFaktur.ppn > 0 && (
                        <button
                          type="button"
                          onClick={addPpnRow}
                          className="px-2 py-0.5 rounded border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 transition-colors font-medium text-[10.5px]"
                        >
                          + Baris PPN (Rp {Math.round(selectedFaktur.ppn).toLocaleString("id-ID")})
                        </button>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-faint italic">
                      *Tarik 4 baris: Debit Bank (Netto) + Debit PPN + Debit PPh Final = Kredit Pendapatan
                    </span>
                  </div>
                </div>
              )}

              {/* Rincian & Simulasi Termin Proyek jika Proyek Terpilih */}
              {selectedProject && (
                <div className="rounded-[12px] border border-emerald-200/80 dark:border-emerald-800/40 bg-emerald-50/30 dark:bg-emerald-950/10 p-3.5 flex flex-col gap-3">
                  {/* Top Header Row of Project Info */}
                  <div className="flex items-center justify-between flex-wrap gap-2 text-[12px]">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold font-mono text-[11.5px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                        {selectedProject.code}
                      </span>
                      <span className="font-semibold text-navy-text">
                        {selectedProject.name}
                      </span>
                      {selectedProject.entityName && (
                        <span className="text-[10px] font-bold text-muted-faint bg-surface-card px-1.5 py-0.5 rounded border border-border-subtle">
                          {selectedProject.entityName}
                        </span>
                      )}
                    </div>
                    <div className="text-muted-faint text-[11px]">
                      Nilai Kontrak: <span className="font-bold text-navy-text">{selectedProject.contractValueFmt ?? `Rp ${contractVal.toLocaleString("id-ID")}`}</span>
                    </div>
                  </div>

                  {/* Pilihan Tahap / Termin Pencairan */}
                  <div className="flex flex-col gap-1.5 p-2.5 rounded-[9px] bg-surface-card border border-border-subtle">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-navy-text flex items-center gap-1.5">
                        <Sparkles size={12} className="text-emerald-600 dark:text-emerald-400" />
                        Tahap / Termin Pencairan Proyek
                      </label>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-emerald-800 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-950/60 border border-emerald-200/60 dark:border-emerald-800/40">
                        {selectedTermin ? `Alokasi ke: ${selectedTermin.name}` : `Termin Baru (Ke-${nextTerminKe})`}
                      </span>
                    </div>

                    <select
                      value={terminId}
                      onChange={(e) => handleTerminChange(e.target.value)}
                      className="w-full h-8.5 px-2.5 rounded-[8px] border border-emerald-300/80 dark:border-emerald-700/60 bg-surface-input text-[12px] text-navy-text focus:outline-none focus:border-brand font-medium cursor-pointer"
                    >
                      {selectedProject.termins && selectedProject.termins.length > 0 && (
                        <optgroup label="Termin Terdaftar (Cicilan / Penyesuaian Pajak)">
                          {selectedProject.termins.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name} · {t.percentage ?? 0}% Kontrak · Rp {Math.round(t.nominal ?? 0).toLocaleString("id-ID")}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      <optgroup label="Buat Tahap Baru">
                        <option value="__NEW__">
                          + Buat Termin Baru (Termin Ke-{nextTerminKe})
                        </option>
                      </optgroup>
                    </select>

                    <p className="text-[10px] text-muted-faint">
                      {selectedTermin
                        ? `Uang masuk akan dialokasikan ke ${selectedTermin.name} tanpa membuat termin baru (mencegah duplikasi termin saat pencairan bertahap).`
                        : `Sistem akan otomatis mencatat Termin ke-${nextTerminKe} baru di Kontrol Piutang & Laporan Pendapatan.`}
                    </p>
                  </div>

                  {/* Termin Simulation Box */}
                  {nominalTermin === 0 ? (
                    <div className="text-[11.5px] text-muted-strong bg-surface-card border border-border-subtle rounded-[9px] p-2.5">
                      Progres saat ini: <b className="text-navy-text">{maxPctSoFar}%</b> ({terminCount} termin tercatat). Masukkan nominal uang masuk pada Rincian Akun di bawah untuk melihat simulasi {selectedTermin ? selectedTermin.name : `termin ke-${nextTerminKe}`}.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2.5 bg-surface-card border border-border-subtle rounded-[10px] p-3">
                      <div className="flex items-center justify-between text-[11.5px] font-semibold">
                        <span className="flex items-center gap-1.5 text-navy-text">
                          <TrendingUp size={13} className="text-emerald-500" />
                          Simulasi Progres Termin:
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-muted-faint">{maxPctSoFar}%</span>
                          <span className="text-muted-faint">→</span>
                          <span className="text-status-green font-bold text-[12.5px]">{newPct}%</span>
                          <span className="text-[10.5px] font-bold text-brand bg-blue-50 dark:bg-blue-500/20 px-1.5 py-0.5 rounded">
                            +{deltaPct}%
                          </span>
                        </div>
                      </div>

                      {/* Visual 2-color Progress Bar */}
                      <div className="w-full h-2 bg-surface-hover rounded-full overflow-hidden flex">
                        <div
                          className="h-full bg-status-green transition-all"
                          style={{ width: `${Math.min(maxPctSoFar, 100)}%` }}
                          title={`Progres sebelumnya: ${maxPctSoFar}%`}
                        />
                        <div
                          className="h-full bg-blue-500 transition-all"
                          style={{ width: `${Math.min(deltaPct, 100 - maxPctSoFar)}%` }}
                          title={`Penambahan transaksi ini: +${deltaPct}%`}
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-[10.5px] pt-2 border-t border-border-subtle">
                        <div>
                          <span className="text-muted-faint block">Sebelumnya</span>
                          <span className="font-bold text-navy-text">Rp {Math.round(cumulativeBefore).toLocaleString("id-ID")}</span>
                        </div>
                        <div>
                          <span className="text-muted-faint block">{selectedTermin ? selectedTermin.name : `Termin ${nextTerminKe}`}</span>
                          <span className="font-bold text-status-green">+Rp {Math.round(nominalTermin).toLocaleString("id-ID")}</span>
                        </div>
                        <div>
                          <span className="text-muted-faint block">Sisa Kontrak</span>
                          <span className="font-bold text-muted-stronger">Rp {Math.round(Math.max(0, contractVal - cumulativeAfter)).toLocaleString("id-ID")}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {autoKeterangan && (
                    <div className="flex items-center justify-between gap-2 pt-1 text-[11px]">
                      <span className="text-muted-faint truncate">
                        Format Keterangan: <span className="font-mono text-navy-text font-medium">{autoKeterangan}</span>
                      </span>
                      <button
                        type="button"
                        onClick={applyAutoKeterangan}
                        className="text-[10.5px] font-bold text-brand hover:underline shrink-0"
                      >
                        Terapkan ke baris
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Pilihan Periode Beban Gaji (Akrual) — Langsung tampil saat input gaji */}
            {hasSalaryAccount && (
              <div className="mb-4 rounded-[12px] border border-border-soft bg-surface-card p-4 flex flex-col gap-3 shadow-xs">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="text-[11.5px] font-bold text-navy-text uppercase tracking-wide">
                    Periode Beban Gaji (Akrual)
                  </label>
                  {periodeBulanGaji && (
                    <span className="text-[11px] font-semibold text-brand">
                      Beban Diakui: {BULAN_NAMES[periodeBulanGaji - 1]} {periodeTahunGaji || new Date(tanggal).getFullYear()}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10.5px] font-bold text-muted-stronger uppercase tracking-wide block mb-1">
                      Bulan Gaji
                    </label>
                    <select
                      value={periodeBulanGaji ?? ""}
                      onChange={(e) => {
                        const val = e.target.value ? parseInt(e.target.value, 10) : null;
                        setPeriodeBulanGaji(val);
                        if (val && !periodeTahunGaji) {
                          setPeriodeTahunGaji(new Date(tanggal).getFullYear());
                        }
                      }}
                      className="w-full h-8 px-2.5 rounded-[8px] border border-border-soft bg-surface-input text-xs text-navy-text focus:outline-none focus:border-brand"
                    >
                      <option value="">Sesuai Tanggal Transaksi ({BULAN_NAMES[new Date(tanggal).getMonth()]})</option>
                      {BULAN_NAMES.map((name, i) => (
                        <option key={i + 1} value={i + 1}>
                          Bulan {name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10.5px] font-bold text-muted-stronger uppercase tracking-wide block mb-1">
                      Tahun Gaji
                    </label>
                    <input
                      type="number"
                      value={periodeTahunGaji ?? (periodeBulanGaji ? new Date(tanggal).getFullYear() : "")}
                      onChange={(e) => setPeriodeTahunGaji(e.target.value ? parseInt(e.target.value, 10) : null)}
                      placeholder={String(new Date(tanggal).getFullYear())}
                      className="w-full h-8 px-2.5 rounded-[8px] border border-border-soft bg-surface-input text-xs text-navy-text font-mono focus:outline-none focus:border-brand"
                    />
                  </div>
                </div>

                <p className="text-[11px] text-muted-faint leading-relaxed">
                  Dicatat di tanggal pembayaran riil, namun dibukukan sebagai biaya operasional bulan yang dipilih secara akrual.
                </p>
              </div>
            )}

            {/* Tabel baris COA */}
            <div className="rounded-[12px] border border-border-soft overflow-hidden mb-4">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-surface-subtle border-b border-border-soft">
                    <th className="text-left px-3 py-2.5 text-[10.5px] font-bold text-muted-faint w-7">#</th>
                    <th className="text-left px-3 py-2.5 text-[10.5px] font-bold text-muted-faint w-[28%]">AKUN COA</th>
                    <th className="text-left px-3 py-2.5 text-[10.5px] font-bold text-muted-faint">KETERANGAN</th>
                    <th className="text-center px-3 py-2.5 text-[10.5px] font-bold text-muted-faint w-36">DEBIT / KREDIT</th>
                    <th className="text-right px-3 py-2.5 text-[10.5px] font-bold text-muted-faint w-36">NOMINAL (Rp)</th>
                    <th className="px-2 py-2.5 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {coaRows.map((row, idx) => (
                    <tr key={row.uid} className="border-b border-border-soft last:border-0 hover:bg-surface-hover/40 transition-colors">
                      <td className="px-3 py-2 text-[12px] text-muted">{idx + 1}</td>
                      <td className="px-3 py-2">
                        <CoaCombobox
                          value={row.coaAccountId}
                          onChange={(id) => updateRow(row.uid, { coaAccountId: id })}
                          options={coa}
                          className="h-8"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input type="text" value={row.keterangan}
                          onChange={(e) => updateRow(row.uid, { keterangan: e.target.value })}
                          placeholder="Deskripsi transaksi…"
                          className="w-full h-8 px-2 rounded-[8px] border border-border-soft bg-surface-input text-[12.5px] text-navy-text placeholder:text-muted-faint focus:outline-none focus:border-brand transition-colors" />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex rounded-[8px] border border-border-soft overflow-hidden h-8 w-full">
                          <button type="button"
                            onClick={() => updateRow(row.uid, { arah: "debit" })}
                            className={`flex-1 text-[11.5px] font-bold transition-colors ${
                              row.arah === "debit"
                                ? "bg-blue-500 text-white"
                                : "bg-surface-input text-muted hover:bg-surface-hover"
                            }`}>
                            Debit
                          </button>
                          <button type="button"
                            onClick={() => updateRow(row.uid, { arah: "kredit" })}
                            className={`flex-1 text-[11.5px] font-bold transition-colors border-l border-border-soft ${
                              row.arah === "kredit"
                                ? "bg-status-green text-white"
                                : "bg-surface-input text-muted hover:bg-surface-hover"
                            }`}>
                            Kredit
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <input type="text" inputMode="numeric" value={row.nominalRaw}
                          onChange={(e) => updateRow(row.uid, { nominalRaw: fmtNum(e.target.value) })}
                          placeholder="—"
                          className={`w-full h-8 px-2 rounded-[8px] border border-border-soft bg-surface-input text-[12.5px] text-navy-text text-right placeholder:text-muted-faint focus:outline-none transition-colors ${
                            row.arah === "debit" ? "focus:border-blue-400" : "focus:border-green-400"
                          }`} />
                      </td>
                      <td className="px-2 py-2 text-center">
                        {coaRows.length > 1 && (
                          <button type="button" onClick={() => setCoaRows((p) => p.filter((r) => r.uid !== row.uid))}
                            className="p-1 rounded-[6px] text-muted hover:text-status-red hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-surface-subtle border-t border-border-soft">
                    <td colSpan={4} className="px-3 py-2.5 text-[12px] font-bold text-muted-stronger">Total</td>
                    <td className="px-3 py-2.5 text-right">
                      {totalDebit > 0 || totalKredit > 0 ? (
                        <div className="flex flex-col items-end gap-0.5">
                          {totalDebit > 0 && (
                            <span className={`text-[12px] font-bold tabular-nums ${isBalanced ? "text-status-green" : "text-blue-500"}`}>
                              D {formatRupiah(totalDebit)}
                            </span>
                          )}
                          {totalKredit > 0 && (
                            <span className={`text-[12px] font-bold tabular-nums ${isBalanced ? "text-status-green" : "text-status-amber"}`}>
                              K {formatRupiah(totalKredit)}
                            </span>
                          )}
                        </div>
                      ) : <span className="text-muted text-[13px]">—</span>}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="flex items-center justify-between gap-3 flex-wrap">
              <button type="button" onClick={() => setCoaRows((p) => [...p, makeCoaRow()])}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] border border-border-soft text-[12.5px] font-semibold text-muted-stronger hover:bg-surface-hover hover:text-navy-text transition-colors">
                <Plus size={14} /> Tambah Baris Akun
              </button>
              <div className="flex items-center gap-3">
                {totalDebit > 0 && totalKredit > 0 && !isBalanced && (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 text-[11.5px] font-bold">
                    <AlertTriangle size={12} /> Tidak seimbang
                  </span>
                )}
                {isBalanced && (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 text-[11.5px] font-bold">
                    <CheckCircle2 size={12} /> Seimbang
                  </span>
                )}
                <button type="submit" disabled={!canSubmit}
                  className="px-5 py-2 rounded-[10px] bg-navy text-white text-[13px] font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity">
                  {isPending ? "Menyimpan…" : editingGroup ? "Simpan Perubahan" : "Simpan Jurnal"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {actionError && (
        <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-status-red text-[13px]">
          {actionError}
        </div>
      )}

      {/* Tabel history */}
      <div className="bg-surface-card border border-border-soft rounded-[20px] p-5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-hover text-left text-[11px] font-bold text-muted-faint">
              <td className="py-2 px-1.5">
                <button onClick={() => setSortAsc((v) => !v)} className="flex items-center gap-1 hover:text-navy-text transition-colors">
                  TANGGAL <ArrowUpDown size={10} />
                </button>
              </td>
              <td className="py-2 px-1.5">NO. BUKTI</td>
              <td className="py-2 px-1.5 whitespace-nowrap">PROYEK / E-FAKTUR</td>
              <td className="py-2 px-1.5">AKUN</td>
              <td className="py-2 px-1.5">KETERANGAN</td>
              <td className="py-2 px-1.5 text-right text-blue-500">DEBIT</td>
              <td className="py-2 px-1.5 text-right text-status-green">KREDIT</td>
              <td className="py-2 px-1.5 text-right">AKSI</td>
            </tr>
          </thead>
          <tbody>
            {sortedHistory.length === 0 ? (
              <tr><td colSpan={8} className="py-10 text-center text-[13px] text-muted">Belum ada entri jurnal.</td></tr>
            ) : (
              sortedHistory.map((group) => {
                const groupRows = sortJurnalRows(group.rows);
                return groupRows.map((row, rowIdx) => (
                  <tr key={`${group.noBukti}-${rowIdx}`}
                    className={`border-b align-top hover:bg-surface-hover/30 group transition-colors ${rowIdx === groupRows.length - 1 ? "border-border" : "border-surface-subtle"}`}>
                    {rowIdx === 0 ? (
                      <>
                        <td className="py-2.5 px-1.5 text-[12.5px] text-muted whitespace-nowrap">{group.tanggal}</td>
                        <td className="py-2.5 px-1.5 text-xs text-muted font-mono">
                          <div>{group.noBukti}</div>
                          {group.periodeBulanGaji && (
                            <span
                              className="mt-0.5 inline-flex items-center gap-1 text-[9.5px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-800/40 px-1.5 py-0.5 rounded font-sans"
                              title={`Diakui Beban: Bulan ${BULAN_NAMES[group.periodeBulanGaji - 1]} ${group.periodeTahunGaji ?? ""}`}
                            >
                              <CalendarDays size={8} className="text-blue-500 flex-none" />
                              Akrual: {BULAN_NAMES[group.periodeBulanGaji - 1].slice(0, 3)} {group.periodeTahunGaji ?? ""}
                            </span>
                          )}
                          {group.tanggalNota && group.tanggalNota !== group.tanggalRaw?.slice(0, 10) && (
                            <div className="mt-0.5">
                              <span
                                className="inline-flex items-center gap-1 text-[9.5px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-800/40 px-1.5 py-0.5 rounded font-sans"
                                title={`Tanggal nota/kuitansi fisik: ${group.tanggalNota}`}
                              >
                                <Receipt size={8} className="text-blue-500 flex-none" />
                                Nota: {group.tanggalNota}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-1.5 whitespace-nowrap">
                          <div className="flex flex-col gap-1 items-start">
                            {group.project ? (
                              <span
                                className="inline-flex items-center gap-1 text-[10.5px] font-mono font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/20 border border-amber-200 dark:border-amber-500/30 px-2 py-0.5 rounded-md"
                                title={group.project.name}
                              >
                                {group.project.code}
                              </span>
                            ) : null}
                            {group.faktur ? (
                              <span
                                className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-500/20 border border-blue-200 dark:border-blue-500/30 px-1.5 py-0.5 rounded"
                                title={`E-Faktur: ${group.faktur.noFaktur} (${group.faktur.namaRekanan})`}
                              >
                                <Receipt size={9} className="text-blue-500 flex-none" />
                                {group.faktur.noFaktur}
                              </span>
                            ) : null}
                            {!group.project && !group.faktur && (
                              <span className="text-muted-faint text-[12px]">—</span>
                            )}
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-2.5 px-1.5" />
                        <td className="py-2.5 px-1.5" />
                        <td className="py-2.5 px-1.5" />
                      </>
                    )}
                    <td className={`py-2.5 px-1.5 text-[12.5px] ${row.kredit > 0 ? "pl-5 text-muted" : "text-muted-stronger font-medium"}`}>
                      <span className="font-mono text-[11px] text-muted mr-1.5">{row.coaCode}</span>{row.coaName}
                    </td>
                    <td className="py-2.5 px-1.5 text-[13px] text-navy-text max-w-[200px] truncate">{row.keterangan || <span className="text-muted-faint">—</span>}</td>
                    <td className="py-2.5 px-1.5 text-[13px] font-bold text-right tabular-nums text-blue-600 dark:text-blue-400">
                      {row.debit > 0 ? formatRupiah(row.debit) : <span className="text-muted-faint font-normal">—</span>}
                    </td>
                    <td className="py-2.5 px-1.5 text-[13px] font-bold text-right tabular-nums text-status-green">
                      {row.kredit > 0 ? formatRupiah(row.kredit) : <span className="text-muted-faint font-normal">—</span>}
                    </td>
                    {rowIdx === 0 ? (
                      <td className="py-2.5 px-1.5 text-right">
                        <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEdit(group)} className="p-1.5 rounded-lg hover:bg-surface-hover text-muted-stronger" title="Edit">
                            <Pencil size={13} />
                          </button>
                          <button onClick={() => handleDelete(group)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-muted-stronger hover:text-status-red" title="Hapus">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    ) : <td className="py-2.5 px-1.5" />}
                  </tr>
                ));
              })
            )}
          </tbody>
        </table>
      </div>

      <PaginationNav
        page={page} totalPages={totalPages}
        buildHref={(p) => {
          const params = new URLSearchParams(searchParams.toString());
          params.set("page", String(p));
          return `${pathname}?${params.toString()}`;
        }}
      />

      {/* Modal Konfirmasi Hapus Jurnal */}
      {deletingGroup && (
        <DeleteConfirmModal
          title="Hapus Jurnal Transaksi?"
          noBukti={deletingGroup.noBukti}
          keterangan={
            deletingGroup.keterangan ||
            deletingGroup.rows.find((r) => r.keterangan)?.keterangan ||
            (deletingGroup.project ? `Proyek ${deletingGroup.project.code} - ${deletingGroup.project.name}` : "Jurnal Transaksi")
          }
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeletingGroup(null)}
          isPending={isPending}
        />
      )}
    </div>
  );
}
