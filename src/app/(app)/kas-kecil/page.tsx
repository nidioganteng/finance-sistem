import { KasScreen } from "@/components/kas/KasScreen";

export default function KasKecilPage({ searchParams }: { searchParams: { entity?: string } }) {
  return (
    <KasScreen
      jenisInputKey="kasKecil"
      title="Kas Kecil"
      subtitle="Input dan riwayat transaksi kas kecil"
      pagePath="/kas-kecil"
      searchParams={searchParams}
    />
  );
}
