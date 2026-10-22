import type { TenagaAhliProjectAssignment } from "./payroll";

export type PeriodeTenagaAhli = { year: number; month?: number; untilMonth?: number };

// Bulan mulai/akhir dihitung inklusif. Jadwal tambahan yang disimpan merupakan
// perpanjangan eksplisit, termasuk jika nominal bulan tersebut belum diisi.
export function penugasanDalamPeriode(project: Partial<TenagaAhliProjectAssignment>, period: PeriodeTenagaAhli): boolean {
  const from = `${period.year}-${String(period.month || 1).padStart(2, "0")}`;
  const to = `${period.year}-${String(period.month || period.untilMonth || 12).padStart(2, "0")}`;
  const start = (project.tanggalMulaiTugas || project.spmkMulai || project.gajiKontrak?.spmkMulai)?.slice(0, 7);
  const end = (project.tanggalSelesaiTugas || project.spmkSelesai || project.gajiKontrak?.spmkSelesai)?.slice(0, 7);
  const schedule = project.gajiKontrak?.jadwal;
  if (schedule?.some(row => row.bulan >= from && row.bulan <= to && (!start || row.bulan < start || !end || row.bulan > end))) return true;
  if (start || end) return (!start || start <= to) && (!end || end >= from);
  if (schedule?.length) return schedule.some(row => row.bulan >= from && row.bulan <= to);
  // Data lama tanpa tanggal tetap dapat diakses untuk dilengkapi di database.
  return true;
}
