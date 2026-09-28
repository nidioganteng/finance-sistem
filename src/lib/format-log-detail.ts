import { formatRupiah } from "./dashboard-data";
import { roleLabel } from "./rbac";
import { Role } from "@prisma/client";

export function formatLogDetail(detail: unknown, action: string = ""): string {
  if (!detail) return "-";
  if (typeof detail === "string") return detail;
  if (typeof detail !== "object") return String(detail);

  const d = detail as Record<string, any>;

  // Transaksi Kas / Bank (arah, total, noBukti, keterangan)
  if ("total" in d && "arah" in d) {
    const arahLabel = d.arah === "masuk" ? "Pemasukan" : "Pengeluaran";
    const totalFmt = formatRupiah(Number(d.total) || 0);
    const desc = d.keterangan ? ` – ${d.keterangan}` : "";
    return `${arahLabel}: ${totalFmt}${desc}`;
  }

  // Pelunasan Piutang / Hutang
  if ("nominal" in d && ("counterpartyEntityKey" in d || "noBukti" in d)) {
    const nomFmt = formatRupiah(Number(d.nominal) || 0);
    const bukti = d.noBukti ? ` (Bukti: ${d.noBukti})` : "";
    return `Nominal pelunasan: ${nomFmt}${bukti}`;
  }

  // Update Saldo Awal
  if ("nominal" in d && "year" in d) {
    return `Nominal: ${formatRupiah(Number(d.nominal) || 0)} (Tahun ${d.year})`;
  }

  // Aset Tetap: Update (changes object)
  if (d.changes && typeof d.changes === "object") {
    const parts: string[] = [];
    if (d.changes.nama) parts.push(`Nama: ${d.changes.nama}`);
    if (d.changes.kode) parts.push(`Kode: ${d.changes.kode}`);
    if (d.changes.hargaPerolehan !== undefined) {
      parts.push(`Harga: ${formatRupiah(Number(d.changes.hargaPerolehan) || 0)}`);
    }
    if (d.changes.umurBulan) parts.push(`Umur: ${d.changes.umurBulan} bln`);
    if (d.changes.kategori) parts.push(`Kategori: ${d.changes.kategori}`);
    return parts.length > 0 ? parts.join(" • ") : "Pembaruan data aset tetap";
  }

  // Aset Tetap: Tambah
  if ("hargaPerolehan" in d) {
    return `Harga perolehan: ${formatRupiah(Number(d.hargaPerolehan) || 0)}`;
  }

  // COA Account
  if ("kategori" in d && ("reportType" in d || "code" in d)) {
    const rep = d.reportType ? ` • Laporan: ${d.reportType}` : "";
    const katRep = d.reportCategory ? ` (${d.reportCategory})` : "";
    return `Kategori: ${d.kategori}${rep}${katRep}`;
  }

  // Jurnal perubahan kode akun
  if ("oldCode" in d && "newCode" in d) {
    return `Kode akun diubah: ${d.oldCode} → ${d.newCode}`;
  }

  // Hapus / Batch Transaksi
  if (Array.isArray(d.txIds)) {
    return `Menghapus ${d.txIds.length} baris transaksi`;
  }

  // Jenis Input
  if ("arahLaporan" in d) {
    return `Alur laporan: ${d.arahLaporan}`;
  }

  // User management
  if ("role" in d) {
    const label = d.role in Role ? roleLabel(d.role as Role) : d.role;
    return `Role akun: ${label}`;
  }

  // Termin & Proyek
  if ("status" in d) {
    return `Status: ${d.status}`;
  }

  // Ekspor Data Laporan
  if (d.format || action.startsWith("Export") || action.startsWith("Unduh") || action.startsWith("Ekspor")) {
    const parts: string[] = [];
    if (d.format) parts.push(`Format: ${d.format}`);
    if (d.year) parts.push(`Tahun: ${d.year}`);
    if (d.version) parts.push(`Versi: ${d.version === "UMUM" ? "Umum" : "Internal"}`);
    if (d.halaman) parts.push(`Halaman: ${d.halaman}`);
    return parts.length > 0 ? parts.join(" • ") : "Ekspor data laporan";
  }

  // Generic fallback: format readable key-value without raw JSON / braces
  const readable: string[] = [];
  for (const [k, v] of Object.entries(d)) {
    if (k.toLowerCase().endsWith("id") || k === "txIds" || k === "entityKeys") continue;
    if (v === null || v === undefined) continue;
    if (typeof v === "object") continue;
    readable.push(`${k}: ${v}`);
  }

  return readable.length > 0 ? readable.join(" • ") : "-";
}
