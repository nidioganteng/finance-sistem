import type { getLaporanUtangAsetData } from "@/lib/laporan-utang-aset";

type Data = Awaited<ReturnType<typeof getLaporanUtangAsetData>>;
type Row = Data["utang"]["rows"][number];

function AkunTable({ rows, emptyMsg }: { rows: Row[]; emptyMsg: string }) {
  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-muted">{emptyMsg}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[560px]">
        <thead>
          <tr className="border-b border-surface-hover text-left">
            <th className="py-3 px-5 text-[11px] font-bold text-muted-faint uppercase">Kode</th>
            <th className="py-3 px-3 text-[11px] font-bold text-muted-faint uppercase">Nama Akun</th>
            <th className="py-3 px-3 text-[11px] font-bold text-muted-faint uppercase text-right">Masuk</th>
            <th className="py-3 px-3 text-[11px] font-bold text-muted-faint uppercase text-right">Keluar</th>
            <th className="py-3 px-5 text-[11px] font-bold text-muted-faint uppercase text-right">Saldo Bersih</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.code} className="border-b border-surface-subtle hover:bg-surface-hover/30">
              <td className="py-3 px-5 font-mono text-[12px] text-muted">{r.code}</td>
              <td className="py-3 px-3 font-semibold text-navy-text text-[13px]">{r.name}</td>
              <td className="py-3 px-3 text-right tabular-nums text-[13px] text-status-green font-medium">{r.masukFmt}</td>
              <td className="py-3 px-3 text-right tabular-nums text-[13px] text-status-red font-medium">{r.keluarFmt}</td>
              <td className="py-3 px-5 text-right tabular-nums text-[13px] font-bold">
                <span className={r.saldoPositif ? "text-status-green" : "text-status-red"}>
                  {r.saldoPositif ? "+" : "-"}{r.saldoFmt}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function UtangAsetView({ data }: { data: Data }) {
  return (
    <div className="flex flex-col gap-5">
      {/* KPI ringkasan */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface-card border border-border-soft rounded-[16px] p-5">
          <div className="text-[11px] font-bold text-muted-faint uppercase mb-1.5">Total Aset Bersih</div>
          <div className="text-[18px] font-extrabold text-status-green tabular-nums">{data.aset.totalFmt}</div>
          <div className="text-[12px] text-muted mt-0.5">{data.aset.rows.length} akun aset</div>
        </div>
        <div className="bg-surface-card border border-border-soft rounded-[16px] p-5">
          <div className="text-[11px] font-bold text-muted-faint uppercase mb-1.5">Total Utang</div>
          <div className={`text-[18px] font-extrabold tabular-nums ${data.utang.total > 0 ? "text-status-red" : "text-status-green"}`}>
            {data.utang.totalFmt}
          </div>
          <div className="text-[12px] text-muted mt-0.5">{data.utang.rows.length} akun kewajiban</div>
        </div>
        <div className="bg-surface-card border border-border-soft rounded-[16px] p-5">
          <div className="text-[11px] font-bold text-muted-faint uppercase mb-1.5">Aset Bersih – Utang</div>
          <div className={`text-[18px] font-extrabold tabular-nums ${data.networthPositif ? "text-status-green" : "text-status-red"}`}>
            {data.networthPositif ? "+" : "-"}{data.networthFmt}
          </div>
          <div className="text-[12px] text-muted mt-0.5">ekuitas bersih {data.year}</div>
        </div>
      </div>

      {/* Aset */}
      <div className="bg-surface-card border border-border-soft rounded-[20px] overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-subtle">
          <h3 className="text-sm font-bold text-navy-text">Rincian Aset</h3>
          <p className="text-[12px] text-muted mt-0.5">
            Dari transaksi ke akun COA berkategori Aset — Debit = tambah aset, Kredit = kurang aset
          </p>
        </div>
        <AkunTable rows={data.aset.rows} emptyMsg="Tidak ada transaksi ke akun Aset di tahun ini." />
        {data.aset.rows.length > 0 && (
          <div className="px-5 py-3.5 border-t border-surface-subtle flex justify-between items-center">
            <span className="text-[13px] font-bold text-navy-text">Total Aset Bersih</span>
            <span className="text-[14px] font-extrabold text-status-green tabular-nums">{data.aset.totalFmt}</span>
          </div>
        )}
      </div>

      {/* Utang */}
      <div className="bg-surface-card border border-border-soft rounded-[20px] overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-subtle">
          <h3 className="text-sm font-bold text-navy-text">Rincian Utang / Kewajiban</h3>
          <p className="text-[12px] text-muted mt-0.5">
            Dari transaksi ke akun COA berkategori Kewajiban — Kredit = tambah utang, Debit = bayar utang
          </p>
        </div>
        <AkunTable rows={data.utang.rows} emptyMsg="Tidak ada transaksi ke akun Kewajiban di tahun ini." />
        {data.utang.rows.length > 0 && (
          <div className="px-5 py-3.5 border-t border-surface-subtle flex justify-between items-center">
            <span className="text-[13px] font-bold text-navy-text">Total Utang</span>
            <span className={`text-[14px] font-extrabold tabular-nums ${data.utang.total > 0 ? "text-status-red" : "text-status-green"}`}>
              {data.utang.totalFmt}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
