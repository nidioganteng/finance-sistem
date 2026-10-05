"use client";

import { useState, useTransition, useMemo } from "react";
import { Pencil, Check, X, Search, Lock } from "lucide-react";
import { upsertSaldoAwal } from "@/lib/actions/saldo-awal";
import { getCoaOwnerEntityKey, ENTITY_NAMES, isSelfIntercompanyAccount } from "@/lib/bank-accounts";

type Row = {
  coaId: string;
  code: string;
  name: string;
  kategori: string;
  saldoAwal: number;
  saldoAwalFmt: string;
  totalDebetFmt: string;
  totalKreditFmt: string;
  saldoAkhirFmt: string;
  saldoAkhirNegatif: boolean;
  punyaTransaksi: boolean;
  alokasi: "NERACA" | "LABA_RUGI";
};

const KATEGORI_BADGE: Record<string, string> = {
  PENDAPATAN: "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400",
  BEBAN: "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400",
  ASET: "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400",
  KEWAJIBAN: "bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400",
  MODAL: "bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400",
};

const ALOKASI_LABEL: Record<Row["alokasi"], string> = {
  NERACA: "Neraca",
  LABA_RUGI: "Laba Rugi",
};

const ALOKASI_BADGE: Record<Row["alokasi"], string> = {
  NERACA: "bg-slate-100 dark:bg-slate-500/20 text-slate-700 dark:text-slate-300",
  LABA_RUGI: "bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-400",
};

function highlightMatch(text: string, query: string) {
  const q = query.trim();
  if (!q) return text;
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "i"));
  if (parts.length === 1) return text;
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === q.toLowerCase() ? (
          <mark key={i} className="bg-yellow-200/90 dark:bg-yellow-500/30 text-navy-text rounded-xs px-0.5">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}

export function DaftarAkunClient({
  rows,
  entityId,
  currentEntityKey,
  year,
  canEdit,
}: {
  rows: Row[];
  entityId: string;
  currentEntityKey?: string;
  year: number;
  canEdit: boolean;
}) {
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const matchCode = r.code.toLowerCase().includes(q);
      const matchName = r.name.toLowerCase().includes(q);
      return matchCode || matchName;
    });
  }, [rows, search]);

  function handleSave(coaId: string, formData: FormData) {
    const raw = (formData.get("saldoAwal") as string)?.trim().replace(/[^0-9-]/g, "");
    const nominal = raw ? parseInt(raw, 10) : 0;
    if (Number.isNaN(nominal)) return;
    setError(null);
    startTransition(async () => {
      try {
        await upsertSaldoAwal(entityId, coaId, year, nominal);
        setEditingId(null);
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  return (
    <div className="bg-surface-card border border-border-soft rounded-[20px] overflow-hidden">
      {/* ── Toolbar: Search & Info ── */}
      <div className="px-5 py-3.5 border-b border-surface-subtle flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 print:hidden">
        <div className="relative w-full sm:w-80 md:w-96">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-faint pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setSearch("");
            }}
            placeholder="Cari kode akun (522) atau nama akun..."
            className="w-full pl-9 pr-8 py-2 bg-surface-base border border-border-soft rounded-pill text-[13px] text-navy-text placeholder:text-muted-faint focus:outline-none focus:border-brand transition-colors"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-muted-faint hover:text-navy-text hover:bg-surface-hover transition-colors"
              title="Hapus pencarian (Esc)"
            >
              <X size={13} />
            </button>
          )}
        </div>
        <div className="text-[12px] font-semibold text-muted-faint self-start sm:self-center">
          {search.trim() ? (
            <span>
              Menampilkan <strong className="text-navy-text font-bold">{filteredRows.length}</strong> dari {rows.length} akun
            </span>
          ) : (
            <span>
              Total <strong className="text-navy-text font-bold">{rows.length}</strong> akun
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="mx-5 mt-4 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-500/10 text-status-red text-sm">{error}</div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-surface-hover text-left text-[11px] font-bold text-muted-faint whitespace-nowrap">
              <th className="py-3 px-5">KODE AKUN</th>
              <th className="py-3 px-3">NAMA AKUN</th>
              <th className="py-3 px-3">KATEGORI</th>
              <th className="py-3 px-3 text-right">SALDO AWAL</th>
              <th className="py-3 px-3 text-right">TOTAL DEBET</th>
              <th className="py-3 px-3 text-right">TOTAL KREDIT</th>
              <th className="py-3 px-5 text-right">SALDO AKHIR</th>
              <th className="py-3 px-5">ALOKASI</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-14 text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-surface-hover flex items-center justify-center text-muted-faint mb-1">
                      <Search size={20} />
                    </div>
                    <p className="text-[13.5px] font-semibold text-navy-text">
                      Tidak ada akun yang cocok
                    </p>
                    <p className="text-[12px] text-muted-faint max-w-sm">
                      Tidak ditemukan akun dengan kode atau nama yang mengandung &ldquo;<span className="font-semibold text-navy-text">{search}</span>&rdquo;.
                    </p>
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      className="mt-2 px-3 py-1.5 rounded-lg bg-surface-hover hover:bg-surface-subtle text-[12px] font-semibold text-brand transition-colors"
                    >
                      Reset Pencarian
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
            filteredRows.map((r) => {
              const ownerKey = getCoaOwnerEntityKey(r.code);
              const isKasBankLocked = ownerKey !== null && currentEntityKey !== undefined && ownerKey !== currentEntityKey;
              const isSelfIntercompany = currentEntityKey !== undefined && isSelfIntercompanyAccount(currentEntityKey, r.code);
              const isLocked = isKasBankLocked || isSelfIntercompany;

              const ownerName = ownerKey ? ENTITY_NAMES[ownerKey] ?? ownerKey : null;
              const lockTitle = isSelfIntercompany
                ? "Terkunci: Akun lawan yang digunakan oleh entitas rekanan untuk mencatat hutang/piutang ke entitas ini."
                : `Terkunci: Akun Kas/Bank khusus entitas ${ownerName}. Silakan beralih ke entitas ${ownerName} untuk mengubah saldo awal.`;

              return (
                <tr key={r.coaId} className="border-b border-surface-subtle hover:bg-surface-hover/40">
                  <td className="py-3 px-5 font-mono font-bold text-navy-text text-[13px] whitespace-nowrap">
                    {highlightMatch(r.code, search)}
                  </td>
                  <td className="py-3 px-3 text-[13px] font-semibold text-navy-text">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span>{highlightMatch(r.name, search)}</span>
                      {isKasBankLocked && ownerName && (
                        <span
                          className="text-[10px] font-semibold text-muted-faint bg-surface-hover border border-border-soft px-1.5 py-0.5 rounded whitespace-nowrap inline-flex items-center gap-1"
                          title={lockTitle}
                        >
                          <Lock size={9} />
                          Khusus {ownerName}
                        </span>
                      )}
                      {isSelfIntercompany && (
                        <span
                          className="text-[10px] font-semibold text-muted-faint bg-surface-hover border border-border-soft px-1.5 py-0.5 rounded whitespace-nowrap inline-flex items-center gap-1"
                          title={lockTitle}
                        >
                          <Lock size={9} />
                          Khusus Entitas Rekanan
                        </span>
                      )}
                      {!isLocked && ownerKey && ownerName && (
                        <span
                          className="text-[10px] font-semibold text-brand bg-brand/10 border border-brand/20 px-1.5 py-0.5 rounded whitespace-nowrap inline-flex items-center gap-1"
                          title={`Akun Kas/Bank ${ownerName}`}
                        >
                          {ownerName}
                        </span>
                      )}
                      {!r.punyaTransaksi && (
                        <span className="ml-0.5 text-[10px] font-bold text-muted-faint bg-surface-hover px-1.5 py-0.5 rounded whitespace-nowrap">
                          belum ada transaksi
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-md ${KATEGORI_BADGE[r.kategori] ?? "bg-surface-hover text-muted"}`}>
                      {r.kategori}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right whitespace-nowrap">
                    {editingId === r.coaId ? (
                      <form action={(fd) => handleSave(r.coaId, fd)} className="flex items-center justify-end gap-1">
                        <input
                          name="saldoAwal"
                          required
                          autoFocus
                          inputMode="numeric"
                          defaultValue={r.saldoAwal}
                          className="w-28 px-2 py-1 rounded-md border border-border text-[12.5px] text-right bg-surface-card"
                        />
                        <button type="submit" disabled={isPending} className="p-1 rounded hover:bg-surface-hover text-status-green" title="Simpan">
                          <Check size={13} />
                        </button>
                        <button type="button" onClick={() => setEditingId(null)} className="p-1 rounded hover:bg-surface-hover text-muted-stronger" title="Batal">
                          <X size={13} />
                        </button>
                      </form>
                    ) : (
                      <div className="flex items-center justify-end gap-1.5">
                        <span className={`tabular-nums text-[13px] whitespace-nowrap ${isLocked ? "text-muted-faint/70" : "text-muted"}`}>
                          {r.saldoAwalFmt}
                        </span>
                        {canEdit && (
                          isLocked ? (
                            <span
                              className="p-1 text-muted-faint/60 cursor-not-allowed inline-flex items-center justify-center"
                              title={lockTitle}
                            >
                              <Lock size={11} />
                            </span>
                          ) : (
                            <button
                              onClick={() => setEditingId(r.coaId)}
                              className="p-0.5 rounded hover:bg-surface-hover text-muted-faint hover:text-navy-text"
                              title="Edit saldo awal"
                            >
                              <Pencil size={11} />
                            </button>
                          )
                        )}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums text-[13px] text-navy-text whitespace-nowrap">{r.totalDebetFmt}</td>
                  <td className="py-3 px-3 text-right tabular-nums text-[13px] text-navy-text whitespace-nowrap">{r.totalKreditFmt}</td>
                  <td className="py-3 px-5 text-right tabular-nums text-[13px] font-bold whitespace-nowrap">
                    <span className={r.saldoAkhirNegatif ? "text-status-red" : "text-navy-text"}>
                      {r.saldoAkhirNegatif ? "-" : ""}{r.saldoAkhirFmt}
                    </span>
                  </td>
                  <td className="py-3 px-5">
                    <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-md whitespace-nowrap ${ALOKASI_BADGE[r.alokasi]}`}>
                      {ALOKASI_LABEL[r.alokasi]}
                    </span>
                  </td>
                </tr>
              );
            })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
