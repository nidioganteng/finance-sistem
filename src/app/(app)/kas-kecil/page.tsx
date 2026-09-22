import { KasScreen } from "@/components/kas/KasScreen";
import { PageTransition } from "@/components/layout/PageTransition";

export default function KasKecilPage({ searchParams }: { searchParams: { entity?: string; dari?: string; sampai?: string } }) {
  return (
    <PageTransition>
      <KasScreen
        jenisInputKey="kasKecil"
        title="Kas Kecil"
        subtitle="Input dan riwayat transaksi kas kecil"
        pagePath="/kas-kecil"
        searchParams={searchParams}
      />
    </PageTransition>
  );
}
