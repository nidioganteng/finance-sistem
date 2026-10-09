import { phpFetch, getPhpToken } from "./api-client";
import { formatRupiah } from "./dashboard-data";

export type LaporanPiutangRow = {
  id: string;
  entityName: string;
  code: string;
  name: string;
  contractValue: number;
  contractValueFmt: string;
  tertagih: number;
  tertagihFmt: string;
  belumTagih: number;
  belumTagihFmt: string;
  maxPct: number;
  deadlineFmt: string;
  isOverdue: boolean;
  status: "ACTIVE" | "COMPLETED" | "CANCELLED";
  jumlahTermin: number;
};

export type LaporanPiutangData = {
  aktif: LaporanPiutangRow[];
  selesai: LaporanPiutangRow[];
  summary: {
    totalKontrak: number;
    totalKontrakFmt: string;
    totalTagih: number;
    totalTagihFmt: string;
    totalBelumTagih: number;
    totalBelumTagihFmt: string;
    pctTagih: number;
    jumlahAktif: number;
    jumlahOverdue: number;
  };
};

export async function getLaporanPiutangData(entityIds: string[]): Promise<LaporanPiutangData> {
  const token = await getPhpToken();
  const params = new URLSearchParams();
  entityIds.forEach((id) => params.append("entityKeys[]", id));
  params.set("type", "laporan");

  return phpFetch<LaporanPiutangData>(`/api/piutang?${params.toString()}`, token);
}
