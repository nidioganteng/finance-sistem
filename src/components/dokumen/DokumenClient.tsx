"use client";

import { useRef, useState, useTransition } from "react";
import { ExternalLink, Plus, Trash2, X, Upload, FileText, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { DokumenFilterTabs } from "./DokumenFilterTabs";
import { uploadDokumen, deleteDokumen } from "@/lib/actions/dokumen";

type Dokumen = {
  id: string;
  judul: string;
  kategori: "SOP" | "DOKUMEN_PENDUKUNG";
  fileUrl: string;
  createdAt: Date;
  uploadedBy: { name: string };
};

const KATEGORI_LABEL: Record<string, string> = {
  SOP: "SOP",
  DOKUMEN_PENDUKUNG: "Dokumen Pendukung",
};

const KATEGORI_COLOR: Record<string, string> = {
  SOP: "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400",
  DOKUMEN_PENDUKUNG: "bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400",
};

export function DokumenClient({
  dokumen,
  kategori,
  canUpload,
  canDelete,
}: {
  dokumen: Dokumen[];
  kategori: string;
  canUpload: boolean;
  canDelete: boolean;
}) {
  const [showModal, setShowModal] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setFileName(file ? file.name : null);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await uploadDokumen(fd);
      if (res?.error) {
        setError(res.error);
      } else {
        setSuccessMsg("Dokumen berhasil diupload.");
        setFileName(null);
        formRef.current?.reset();
        setTimeout(() => {
          setShowModal(false);
          setSuccessMsg(null);
        }, 1200);
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Yakin ingin menghapus dokumen ini?")) return;
    setDeletingId(id);
    startTransition(async () => {
      await deleteDokumen(id);
      setDeletingId(null);
    });
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <DokumenFilterTabs current={kategori} />
        {canUpload && (
          <button
            onClick={() => { setShowModal(true); setError(null); setSuccessMsg(null); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-navy text-white text-[13px] font-semibold hover:bg-navy/90 transition-colors"
          >
            <Plus size={15} /> Upload Dokumen
          </button>
        )}
      </div>

      <div className="bg-surface-card rounded-[20px] border border-border-soft overflow-hidden">
        {dokumen.length === 0 ? (
          <div className="py-16 text-center">
            <FileText size={36} className="mx-auto text-muted-faint mb-3" />
            <div className="text-sm font-semibold text-muted-stronger mb-1">Belum ada dokumen</div>
            <p className="text-[13px] text-muted">Belum ada dokumen tersimpan untuk kategori ini.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[520px]">
              <thead>
                <tr className="border-b border-surface-hover text-left">
                  <th className="py-3 px-6 text-[11px] font-bold text-muted-faint uppercase">Judul</th>
                  <th className="py-3 px-3 text-[11px] font-bold text-muted-faint uppercase">Kategori</th>
                  <th className="py-3 px-3 text-[11px] font-bold text-muted-faint uppercase">Diupload Oleh</th>
                  <th className="py-3 px-3 text-[11px] font-bold text-muted-faint uppercase">Tanggal</th>
                  <th className="py-3 px-6 text-[11px] font-bold text-muted-faint uppercase">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {dokumen.map((d) => (
                  <tr key={d.id} className="border-b border-surface-subtle hover:bg-surface-hover/30">
                    <td className="py-3 px-6 font-semibold text-navy-text">{d.judul}</td>
                    <td className="py-3 px-3">
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-md ${KATEGORI_COLOR[d.kategori] ?? "bg-surface-hover text-muted-stronger"}`}>
                        {KATEGORI_LABEL[d.kategori] ?? d.kategori}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-[12.5px] text-muted">{d.uploadedBy.name}</td>
                    <td className="py-3 px-3 text-[12.5px] text-muted">
                      {new Date(d.createdAt).toLocaleDateString("id-ID")}
                    </td>
                    <td className="py-3 px-6">
                      <div className="flex items-center gap-2">
                        <a
                          href={d.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-[12.5px] font-semibold text-brand hover:underline"
                        >
                          <ExternalLink size={13} /> Buka
                        </a>
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(d.id)}
                            disabled={deletingId === d.id}
                            className="p-1.5 rounded-lg text-muted-faint hover:text-status-red hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-40"
                          >
                            {deletingId === d.id
                              ? <Loader2 size={13} className="animate-spin" />
                              : <Trash2 size={13} />
                            }
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-surface-card border border-border-soft rounded-[24px] w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-6 pb-4 border-b border-border-soft">
              <h3 className="font-bold text-[16px] text-navy-text">Upload Dokumen Baru</h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg hover:bg-surface-hover text-muted-faint transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <form ref={formRef} onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
              {error && (
                <div className="flex items-center gap-2 text-[13px] text-status-red bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl px-3 py-2.5">
                  <AlertCircle size={14} className="flex-none" /> {error}
                </div>
              )}
              {successMsg && (
                <div className="flex items-center gap-2 text-[13px] text-status-green bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-xl px-3 py-2.5">
                  <CheckCircle2 size={14} className="flex-none" /> {successMsg}
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-bold text-muted-stronger uppercase tracking-wide">Judul Dokumen</label>
                <input
                  name="judul"
                  required
                  placeholder="Contoh: SOP Pengajuan Anggaran"
                  className="w-full bg-surface-input border border-border rounded-xl px-3.5 py-2.5 text-sm text-navy-text placeholder:text-muted-faint focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-bold text-muted-stronger uppercase tracking-wide">Kategori</label>
                <select
                  name="kategori"
                  required
                  defaultValue=""
                  className="w-full bg-surface-input border border-border rounded-xl px-3.5 py-2.5 text-sm text-navy-text focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all"
                >
                  <option value="" disabled>Pilih kategori...</option>
                  <option value="SOP">SOP</option>
                  <option value="DOKUMEN_PENDUKUNG">Dokumen Pendukung</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-bold text-muted-stronger uppercase tracking-wide">File</label>
                <label className="flex flex-col items-center gap-2 border-2 border-dashed border-border rounded-xl px-4 py-5 cursor-pointer hover:border-brand hover:bg-surface-hover/50 transition-all">
                  <Upload size={22} className="text-muted-faint" />
                  <span className="text-[13px] font-semibold text-muted-stronger">
                    {fileName ?? "Klik untuk pilih file"}
                  </span>
                  <span className="text-[11px] text-muted">PDF, Word, Excel, JPG, PNG — maks. 10 MB</span>
                  <input
                    name="file"
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                    required
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-navy text-white text-[13px] font-bold hover:bg-navy/90 transition-colors disabled:opacity-60 mt-1"
              >
                {isPending ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                {isPending ? "Mengupload..." : "Upload Dokumen"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
